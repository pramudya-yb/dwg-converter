const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const crypto = require('crypto');
const os = require('os');

const execAsync = promisify(exec);

const AUTOCAD_VERSIONS = [
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
];

async function findODAConverter() {
  const envPath = process.env.ODA_CONVERTER_PATH;
  if (envPath && fs.existsSync(envPath)) return envPath;

  if (process.platform === 'linux') {
    try {
      const { stdout } = await execAsync('which ODAFileConverter');
      const found = stdout.trim().split('\n')[0];
      if (found && fs.existsSync(found)) return found;
    } catch {}
    
    const linuxCommonPaths = ['/usr/bin/ODAFileConverter', '/usr/local/bin/ODAFileConverter'];
    for (const p of linuxCommonPaths) {
      if (fs.existsSync(p)) return p;
    }
  }

  return null;
}

async function convertFile(options) {
  const startTime = Date.now();
  
  const odaPath = await findODAConverter();
  if (!odaPath) {
    return { success: false, error: 'ODA File Converter not found in microservice.' };
  }

  const fileName = path.basename(options.sourceFilePath);
  const ext = path.extname(fileName).toLowerCase();
  const baseName = path.basename(fileName, ext);
  const outputExt = options.outputFormat === 'DWG' ? '.dwg' : '.dxf';

  const tempSourceDir = path.join(options.outputDir, '_source_' + Date.now());
  await fs.promises.mkdir(tempSourceDir, { recursive: true });
  await fs.promises.copyFile(options.sourceFilePath, path.join(tempSourceDir, fileName));

  const tempOutputDir = path.join(options.outputDir, '_output_' + Date.now());
  await fs.promises.mkdir(tempOutputDir, { recursive: true });

  const typeCode = options.outputFormat === 'DWG' ? '0' : '2';
  const auditFlag = options.audit ? '1' : '0';

  let command = `"${odaPath}" "${tempSourceDir}" "${tempOutputDir}" "${options.targetVersion}" "${typeCode}" "0" "${auditFlag}"`;

  if (process.platform === 'linux') {
    // Rely on the background Xvfb server started in Dockerfile
    command = `env DISPLAY=:99 ${command}`;
  }

  try {
    const { stdout, stderr } = await execAsync(command, { timeout: 120000 });

    const files = await fs.promises.readdir(tempOutputDir);
    let outputFile = files.find(f => f.toLowerCase().endsWith(outputExt));

    if (!outputFile) {
      const anyFile = files.find(f => !f.startsWith('.'));
      if (!anyFile) {
        return { success: false, error: 'Conversion produced no output file.', duration: Date.now() - startTime };
      }
      outputFile = anyFile;
    }

    const finalPath = path.join(options.outputDir, baseName + outputExt);
    await fs.promises.rename(path.join(tempOutputDir, outputFile), finalPath);

    await fs.promises.rm(tempSourceDir, { recursive: true, force: true });
    await fs.promises.rm(tempOutputDir, { recursive: true, force: true });

    return { success: true, outputFilePath: finalPath, duration: Date.now() - startTime };
  } catch (err) {
    try {
      await fs.promises.rm(tempSourceDir, { recursive: true, force: true });
      await fs.promises.rm(tempOutputDir, { recursive: true, force: true });
    } catch {}
    
    return { success: false, error: err.message + '\nExitCode: ' + (err.code || 'N/A') + '\nSignal: ' + (err.signal || 'N/A') + '\nSTDERR: ' + (err.stderr || '') + '\nSTDOUT: ' + (err.stdout || ''), duration: Date.now() - startTime };
  }
}

module.exports = {
  AUTOCAD_VERSIONS,
  findODAConverter,
  convertFile
};
