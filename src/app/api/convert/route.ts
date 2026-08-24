import { NextRequest, NextResponse } from 'next/server';
import { convertFile, AUTOCAD_VERSIONS, resetODAConverterCache, type OutputFormat } from '@/lib/oda-converter';
import { createTempDir, cleanupTempDir, cleanupOldTempDirs, isValidCADFile, sanitizeFileName } from '@/lib/file-utils';
import path from 'path';
import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import type { Archiver, ArchiverOptions } from 'archiver';
import * as archiverModule from 'archiver';

function makeArchive(format: 'zip', opts: ArchiverOptions): Archiver {
  const factory = (archiverModule as unknown as { default: typeof archiverModule }).default ?? archiverModule;
  return (factory as unknown as (f: string, o: ArchiverOptions) => Archiver)(format, opts);
}

async function rebuildFormData(original: FormData): Promise<FormData> {
  const fd = new FormData();
  for (const file of original.getAll('files')) {
    fd.append('files', file);
  }
  const targetVersion = original.get('targetVersion');
  const outputFormat = original.get('outputFormat');
  const targetCRS = original.get('targetCRS');
  if (targetVersion != null) fd.append('targetVersion', String(targetVersion));
  if (outputFormat != null) fd.append('outputFormat', String(outputFormat));
  if (targetCRS != null) fd.append('targetCRS', String(targetCRS));
  return fd;
}

// Run periodic temp cleanup once per server lifetime (best-effort).
// Cleared on SIGTERM/SIGINT so hot-reload doesnt leak timers.
let cleanupTimer: NodeJS.Timeout | null = null;
function ensureCleanupStarted() {
  if (cleanupTimer) return;
  cleanupOldTempDirs().catch(() => {});
  cleanupTimer = setInterval(() => { cleanupOldTempDirs().catch(() => {}); }, 60 * 60 * 1000);
  if (cleanupTimer.unref) cleanupTimer.unref();
  const stop = () => {
    if (cleanupTimer) {
      clearInterval(cleanupTimer);
      cleanupTimer = null;
    }
  };
  process.once('SIGTERM', stop);
  process.once('SIGINT', stop);
}


export async function POST(request: NextRequest) {
  ensureCleanupStarted();
  let tempDir: string | null = null;

  try {
    const formData = await request.formData();
    // Force re-detection of ODA converter per request so a freshly-installed binary
    // is picked up without restarting the server.
    resetODAConverterCache();
    const files = formData.getAll('files') as File[];
    const targetVersion = formData.get('targetVersion') as string;
    const outputFormat = (formData.get('outputFormat') as string || 'DWG') as OutputFormat;
    const targetCRS = formData.get('targetCRS') as string || '';

    // Validate
    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files uploaded' }, { status: 400 });
    }

    if (outputFormat !== 'SHP' && (!targetVersion || !AUTOCAD_VERSIONS.find(v => v.code === targetVersion))) {
      return NextResponse.json({ error: 'Invalid target version' }, { status: 400 });
    }

    const externalUrl = process.env.EXTERNAL_CONVERTER_URL;
    if (outputFormat === 'SHP' && !externalUrl) {
      return NextResponse.json({ error: 'Shapefile (.SHP) conversion requires the external microservice to be configured. Please set EXTERNAL_CONVERTER_URL.' }, { status: 400 });
    }
    if (outputFormat === 'SHP' && externalUrl) {
      // SHP requires GDAL/ogr2ogr — forward only shapefile jobs to the microservice.
      const cleanUrl = externalUrl.replace(/\/+$/, '');
      const forwardData = await rebuildFormData(formData);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 180000);
      let response: Response;
      try {
        response = await fetch(`${cleanUrl}/api/convert`, {
          method: 'POST',
          body: forwardData,
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }

      if (!response.ok) {
        let errorMessage = 'External conversion failed';
        let errorDetails: unknown = null;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
          errorDetails = errorData.details || null;

          if (errorDetails && Array.isArray(errorDetails) && errorDetails.length > 0 && errorDetails[0].error) {
            errorMessage += '\n\nDetail:\n' + errorDetails[0].error;
          }
        } catch {}
        return NextResponse.json({ error: errorMessage, details: errorDetails }, { status: response.status });
      }

      const contentType = response.headers.get('Content-Type');
      const disposition = response.headers.get('Content-Disposition');
      const resultsHeader = response.headers.get('X-Conversion-Results');

      const arrayBuffer = await response.arrayBuffer();

      return new NextResponse(arrayBuffer, {
        headers: {
          'Content-Type': contentType || 'application/octet-stream',
          ...(disposition ? { 'Content-Disposition': disposition } : {}),
          ...(resultsHeader ? { 'X-Conversion-Results': resultsHeader } : {}),
        },
      });
    }

    // Create temp directory
    tempDir = await createTempDir();
    const outputDir = path.join(tempDir, 'output');
    await fs.mkdir(outputDir, { recursive: true });

    // Save uploaded files and convert
    const results: Array<{ name: string; success: boolean; outputPath?: string; error?: string; duration?: number }> = [];

    let i = 0;
    for (const file of files) {
      const safeName = sanitizeFileName(file.name);

      if (!isValidCADFile(safeName)) {
        results.push({ name: file.name, success: false, error: 'Invalid file format. Only .dwg and .dxf files are supported.' });
        continue;
      }

      // Save to temp; prefix with a per-request id segment so duplicate names don't collide on disk
      const filePath = path.join(tempDir, `${i++}_${safeName}`);
      const arrayBuffer = await file.arrayBuffer();
      await fs.writeFile(filePath, Buffer.from(arrayBuffer));

      // Convert
      const result = await convertFile({
        sourceFilePath: filePath,
        outputDir: outputDir,
        targetVersion: targetVersion,
        outputFormat: outputFormat,
        targetCRS: targetCRS,
        audit: true,
      });

      results.push({
        name: file.name,
        success: result.success,
        outputPath: result.outputFilePath,
        error: result.error,
        duration: result.duration,
      });
    }

    const successResults = results.filter(r => r.success && r.outputPath);

    if (successResults.length === 0) {
      await cleanupTempDir(tempDir);
      return NextResponse.json(
        { error: 'All conversions failed', details: results },
        { status: 500 }
      );
    }

    // Single file - return directly
    if (successResults.length === 1 && files.length === 1) {
      const outputPath = successResults[0].outputPath!;
      const fileBuffer = await fs.readFile(outputPath);
      // Strip the per-request "0_" prefix that prevents name collisions in temp dir
      const rawName = path.basename(outputPath).replace(/^\d+_/, '');
      const fileName = rawName.replace(/[\r\n"]/g, '_');
      const encodedName = encodeURIComponent(rawName);

      // Schedule cleanup
      setTimeout(() => cleanupTempDir(tempDir!), 5000);

      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${fileName}"; filename*=UTF-8''${encodedName}`,
          'X-Conversion-Results': JSON.stringify(results),
        },
      });
    }

    // Multiple files - create ZIP
    const zipPath = path.join(tempDir, 'converted_files.zip');

    await new Promise<void>((resolve, reject) => {
      const output = createWriteStream(zipPath);
      const archive = makeArchive('zip', { zlib: { level: 6 } });

      let settled = false;
      const settle = (err?: unknown) => {
        if (settled) return;
        settled = true;
        if (err) reject(err instanceof Error ? err : new Error(String(err)));
        else resolve();
      };

      output.on('close', () => settle());
      output.on('error', (err) => settle(err));
      archive.on('error', (err: Error) => settle(err));
      archive.on('warning', (err: Error) => {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') settle(err);
      });

      archive.pipe(output);

      for (const result of successResults) {
        if (result.outputPath) {
          // Strip the per-request "0_myfile.dwg" prefix so users see clean names in the ZIP
          const cleanName = path.basename(result.outputPath).replace(/^\d+_/, '');
          archive.file(result.outputPath, { name: cleanName });
        }
      }

      archive.finalize();
    });

    const zipBuffer = await fs.readFile(zipPath);

    // Schedule cleanup
    setTimeout(() => cleanupTempDir(tempDir!), 5000);

    const rawName = `converted_${targetVersion || 'unknown'}_${outputFormat}.zip`;
    const safeVersion = (targetVersion || 'unknown').replace(/[^A-Za-z0-9._-]/g, '_');
    const safeFormat = String(outputFormat).replace(/[^A-Za-z0-9]/g, '');
    const asciiName = `converted_${safeVersion}_${safeFormat}.zip`;
    const encodedName = encodeURIComponent(rawName);
    return new NextResponse(zipBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${asciiName}"; filename*=UTF-8''${encodedName}`,
        'X-Conversion-Results': JSON.stringify(results),
      },
    });

  } catch (error) {
    if (tempDir) await cleanupTempDir(tempDir);

    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
