import { NextRequest, NextResponse } from 'next/server';
import { convertFile, AUTOCAD_VERSIONS, type OutputFormat } from '@/lib/oda-converter';
import { createTempDir, cleanupTempDir, isValidCADFile, sanitizeFileName } from '@/lib/file-utils';
import path from 'path';
import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import * as archiverNamespace from 'archiver';
const archiver = (archiverNamespace as any).default || archiverNamespace;


export async function POST(request: NextRequest) {
  let tempDir: string | null = null;

  try {
    const formData = await request.formData();
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
    if (externalUrl) {
      // Forward the entire FormData to the external microservice
      const response = await fetch(`${externalUrl}/api/convert`, {
        method: 'POST',
        body: formData,
        // Let fetch automatically handle multipart/form-data boundary
      });

      if (!response.ok) {
        let errorMessage = 'External conversion failed';
        let errorDetails = null;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
          errorDetails = errorData.details || null;
          
          if (errorDetails && Array.isArray(errorDetails) && errorDetails.length > 0 && errorDetails[0].error) {
            errorMessage += '\n\nDetail:\n' + errorDetails[0].error;
          }
        } catch (e) {}
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

    for (const file of files) {
      const safeName = sanitizeFileName(file.name);

      if (!isValidCADFile(safeName)) {
        results.push({ name: file.name, success: false, error: 'Invalid file format. Only .dwg and .dxf files are supported.' });
        continue;
      }

      // Save to temp
      const filePath = path.join(tempDir, safeName);
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
      const fileName = path.basename(outputPath);

      // Schedule cleanup
      setTimeout(() => cleanupTempDir(tempDir!), 5000);

      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${fileName}"`,
          'X-Conversion-Results': JSON.stringify(results),
        },
      });
    }

    // Multiple files - create ZIP
    const zipPath = path.join(tempDir, 'converted_files.zip');

    await new Promise<void>((resolve, reject) => {
      const output = createWriteStream(zipPath);
      const archive = archiver('zip', { zlib: { level: 6 } });

      output.on('close', resolve);
      archive.on('error', reject);

      archive.pipe(output);

      for (const result of successResults) {
        if (result.outputPath) {
          archive.file(result.outputPath, { name: path.basename(result.outputPath) });
        }
      }

      archive.finalize();
    });

    const zipBuffer = await fs.readFile(zipPath);

    // Schedule cleanup
    setTimeout(() => cleanupTempDir(tempDir!), 5000);

    return new NextResponse(zipBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="converted_${targetVersion}_${outputFormat}.zip"`,
        'X-Conversion-Results': JSON.stringify(results),
      },
    });

  } catch (error) {
    if (tempDir) await cleanupTempDir(tempDir);

    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
