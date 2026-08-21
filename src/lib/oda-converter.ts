import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';

const execAsync = promisify(exec);

// All supported AutoCAD versions for conversion
export const AUTOCAD_VERSIONS = [
  { code: 'ACAD9', name: 'AutoCAD R9', year: '1987', acadver: 'AC1004' },
  { code: 'ACAD10', name: 'AutoCAD R10', year: '1988', acadver: 'AC1006' },
  { code: 'ACAD12', name: 'AutoCAD R12', year: '1992', acadver: 'AC1009' },
  { code: 'ACAD13', name: 'AutoCAD R13', year: '1994', acadver: 'AC1012' },
  { code: 'ACAD14', name: 'AutoCAD R14', year: '1997', acadver: 'AC1014' },
  { code: 'ACAD2000', name: 'AutoCAD 2000', year: '1999', acadver: 'AC1015' },
  { code: 'ACAD2004', name: 'AutoCAD 2004', year: '2003', acadver: 'AC1018' },
  { code: 'ACAD2007', name: 'AutoCAD 2007', year: '2006', acadver: 'AC1021' },
  { code: 'ACAD2010', name: 'AutoCAD 2010', year: '2009', acadver: 'AC1024' },
  { code: 'ACAD2013', name: 'AutoCAD 2013', year: '2012', acadver: 'AC1027' },
  { code: 'ACAD2018', name: 'AutoCAD 2018', year: '2017', acadver: 'AC1032' },
] as const;

export type AutoCADVersion = typeof AUTOCAD_VERSIONS[number];
export type OutputFormat = 'DWG' | 'DXF' | 'SHP';

// Common install paths for ODA File Converter on Windows
const ODA_SEARCH_PATHS = [
  'C:\\Program Files\\ODA\\ODAFileConverter\\ODAFileConverter.exe',
  'C:\\Program Files (x86)\\ODA\\ODAFileConverter\\ODAFileConverter.exe',
  'C:\\Program Files\\ODA\\ODAFileConverter 25.12\\ODAFileConverter.exe',
  'C:\\Program Files\\ODA\\ODAFileConverter 24.12\\ODAFileConverter.exe',
  'C:\\Program Files\\ODA\\ODAFileConverter 23.12\\ODAFileConverter.exe',
];

export async function findODAConverter(): Promise<string | null> {
  // Check environment variable first
  const envPath = process.env.ODA_CONVERTER_PATH;
  if (envPath && existsSync(envPath)) return envPath;

  // Search common paths
  for (const p of ODA_SEARCH_PATHS) {
    if (existsSync(p)) return p;
  }

  // Try to find via where command on Windows
  try {
    const { stdout } = await execAsync('where ODAFileConverter');
    const found = stdout.trim().split(/\r?\n/)[0]?.trim();
    if (found && existsSync(found)) return found;
  } catch {}

  // Try searching in Program Files with dir command
  try {
    const { stdout } = await execAsync('dir /s /b "C:\\Program Files\\ODA*\\ODAFileConverter.exe" 2>nul');
    const found = stdout.trim().split(/\r?\n/)[0]?.trim();
    if (found && existsSync(found)) return found;
  } catch {}

  // Try Linux typical paths
  try {
    const { stdout } = await execAsync('which ODAFileConverter');
    const found = stdout.trim().split(/\r?\n/)[0]?.trim();
    if (found && existsSync(found)) return found;
  } catch {}

  return null;
}

export interface ConversionOptions {
  sourceFilePath: string;
  outputDir: string;
  targetVersion: AutoCADVersion['code'] | string;
  outputFormat: OutputFormat;
  targetCRS?: string;
  audit?: boolean;
}

export interface ConversionResult {
  success: boolean;
  outputFilePath?: string;
  error?: string;
  duration?: number;
}

export async function convertFile(options: ConversionOptions): Promise<ConversionResult> {
  const startTime = Date.now();

  const odaPath = await findODAConverter();
  if (!odaPath) {
    return { success: false, error: 'ODA File Converter not found. Please install it first.' };
  }

  const fileName = path.basename(options.sourceFilePath);
  const ext = path.extname(fileName).toLowerCase();
  const baseName = path.basename(fileName, ext);

  if (options.outputFormat === 'SHP') {
    return { success: false, error: 'SHP conversion is only supported via the external microservice. Set EXTERNAL_CONVERTER_URL to use SHP output.' };
  }

  const outputExt = options.outputFormat === 'DWG' ? '.dwg' : '.dxf';
  const inputIsDXF = ext === '.dxf';

  // Create a temp source directory with just this file (ODA works with directories)
  const tempSourceDir = path.join(options.outputDir, '_source_' + Date.now());
  await fs.mkdir(tempSourceDir, { recursive: true });
  await fs.copyFile(options.sourceFilePath, path.join(tempSourceDir, fileName));

  const tempOutputDir = path.join(options.outputDir, '_output_' + Date.now());
  await fs.mkdir(tempOutputDir, { recursive: true });

  // Build the ODA command
  // ODAFileConverter <source> <target> <version> <type> <recurse> <audit>
  // type: 0 = DWG→DWG, 1 = DWG→DXF binary, 2 = DWG→DXF ASCII, 3 = DXF→DWG, 4 = DXF→DXF
  let typeCode: string;
  if (inputIsDXF) {
    typeCode = options.outputFormat === 'DWG' ? '3' : '4';
  } else {
    typeCode = options.outputFormat === 'DWG' ? '0' : '2';
  }
  const auditFlag = options.audit ? '1' : '0';

  let command = `"${odaPath}" "${tempSourceDir}" "${tempOutputDir}" "${options.targetVersion}" "${typeCode}" "0" "${auditFlag}"`;

  // Use xvfb-run on Linux since ODA Converter requires an X server (GUI)
  if (process.platform === 'linux') {
    command = `xvfb-run -a ${command}`;
  }

  try {
    await execAsync(command, { timeout: 120000 }); // 2 minute timeout

    // Find the output file
    const files = await fs.readdir(tempOutputDir);
    const outputFile = files.find(f => f.toLowerCase().endsWith(outputExt));

    if (!outputFile) {
      // Sometimes ODA keeps original extension, check for any file
      const anyFile = files.find(f => !f.startsWith('.'));
      if (!anyFile) {
        return { success: false, error: 'Conversion produced no output file.', duration: Date.now() - startTime };
      }

      const finalPath = path.join(options.outputDir, baseName + outputExt);
      await fs.rename(path.join(tempOutputDir, anyFile), finalPath);

      // Cleanup temp dirs
      await fs.rm(tempSourceDir, { recursive: true, force: true });
      await fs.rm(tempOutputDir, { recursive: true, force: true });

      return { success: true, outputFilePath: finalPath, duration: Date.now() - startTime };
    }

    const finalPath = path.join(options.outputDir, baseName + outputExt);
    await fs.rename(path.join(tempOutputDir, outputFile), finalPath);

    // Cleanup
    await fs.rm(tempSourceDir, { recursive: true, force: true });
    await fs.rm(tempOutputDir, { recursive: true, force: true });

    return { success: true, outputFilePath: finalPath, duration: Date.now() - startTime };
  } catch (err: unknown) {
    // Cleanup on error too
    try {
      await fs.rm(tempSourceDir, { recursive: true, force: true });
      await fs.rm(tempOutputDir, { recursive: true, force: true });
    } catch {}

    const message = err instanceof Error ? err.message : 'Unknown conversion error';
    return { success: false, error: message, duration: Date.now() - startTime };
  }
}
