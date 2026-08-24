const express = require('express');
const multer = require('multer');
const archiver = require('archiver');
const fs = require('fs');
const fsPromises = require('fs/promises');
const path = require('path');
const os = require('os');
const cors = require('cors');
const { convertFile, findODAConverter, AUTOCAD_VERSIONS } = require('./oda-converter');

const app = express();
const port = process.env.PORT || 7860;

app.use(cors());
app.use(express.json());

const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 200 * 1024 * 1024, files: 50 },
});

app.get('/', (req, res) => {
  res.json({ message: 'DWG/DXF Conversion Microservice is running.' });
});

app.get('/api/check-oda', async (req, res) => {
  try {
    const odaPath = await findODAConverter();
    res.json({
      installed: !!odaPath,
      path: odaPath,
      versions: AUTOCAD_VERSIONS,
    });
  } catch (error) {
    res.status(500).json({ installed: false, error: 'Failed to check ODA installation' });
  }
});

app.post('/api/convert', upload.array('files'), async (req, res) => {
  const files = req.files;
  const outputFormat = req.body.outputFormat || 'DWG';
  const targetVersion = outputFormat === 'SHP' ? (req.body.targetVersion || 'ACAD2010') : req.body.targetVersion;
  const targetCRS = req.body.targetCRS; // e.g. "EPSG:4326"

  if (!files || files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded' });
  }

  if (outputFormat !== 'SHP' && (!targetVersion || !AUTOCAD_VERSIONS.find(v => v.code === targetVersion))) {
    return res.status(400).json({ error: 'Invalid target version' });
  }

  const tempDir = path.join(os.tmpdir(), 'convert_' + Date.now());
  await fsPromises.mkdir(tempDir, { recursive: true });
  const outputDir = path.join(tempDir, 'output');
  await fsPromises.mkdir(outputDir, { recursive: true });

  try {
    const results = [];

    let i = 0;
    for (const file of files) {
      const originalName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      const sourceFilePath = path.join(tempDir, `${i++}_${originalName}`);

      await fsPromises.copyFile(file.path, sourceFilePath);

      const result = await convertFile({
        sourceFilePath: sourceFilePath,
        outputDir: outputDir,
        targetVersion: targetVersion,
        outputFormat: outputFormat,
        targetCRS: targetCRS,
        audit: true,
      });

      results.push({
        name: file.originalname,
        success: result.success,
        outputPath: result.outputFilePath,
        error: result.error,
        duration: result.duration,
      });
    }

    const successResults = results.filter(r => r.success && r.outputPath);

    if (successResults.length === 0) {
      await fsPromises.rm(tempDir, { recursive: true, force: true }).catch(() => {});
      return res.status(500).json({ error: 'All conversions failed', details: results });
    }

    if (successResults.length === 1 && files.length === 1) {
      const outputPath = successResults[0].outputPath;
      const rawName = path.basename(outputPath).replace(/^\d+_/, '');
      const fileName = rawName.replace(/[\r\n"]/g, '_');
      const encodedName = encodeURIComponent(rawName);

      res.set({
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${fileName}"; filename*=UTF-8''${encodedName}`,
        'X-Conversion-Results': JSON.stringify(results),
      });

      const fileStream = fs.createReadStream(outputPath);
      fileStream.pipe(res);

      fileStream.on('close', () => {
        fsPromises.rm(tempDir, { recursive: true, force: true }).catch(() => {});
      });
      fileStream.on('error', () => {
        fsPromises.rm(tempDir, { recursive: true, force: true }).catch(() => {});
        if (!res.headersSent) res.status(500).json({ error: 'Stream failed' });
      });
      return;
    }

    const zipPath = path.join(tempDir, 'converted_files.zip');
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 6 } });

    let settled = false;
    const finish = (err) => {
      if (settled) return;
      settled = true;
      if (err) {
        fsPromises.rm(tempDir, { recursive: true, force: true }).catch(() => {});
        if (!res.headersSent) res.status(500).json({ error: err.message });
        return;
      }
      const rawName = `converted_${targetVersion || 'unknown'}_${outputFormat}.zip`;
      const safeVersion = (targetVersion || 'unknown').replace(/[^A-Za-z0-9._-]/g, '_');
      const safeFormat = String(outputFormat).replace(/[^A-Za-z0-9]/g, '');
      const asciiName = `converted_${safeVersion}_${safeFormat}.zip`;
      const encodedName = encodeURIComponent(rawName);
      res.set({
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${asciiName}"; filename*=UTF-8''${encodedName}`,
        'X-Conversion-Results': JSON.stringify(results),
      });

      const zipStream = fs.createReadStream(zipPath);
      zipStream.pipe(res);

      zipStream.on('close', () => {
        fsPromises.rm(tempDir, { recursive: true, force: true }).catch(() => {});
      });
      zipStream.on('error', () => {
        fsPromises.rm(tempDir, { recursive: true, force: true }).catch(() => {});
        if (!res.headersSent) res.status(500).json({ error: 'Zip stream failed' });
      });
    };

    output.on('close', () => finish());
    output.on('error', (err) => finish(err));
    archive.on('error', (err) => finish(err));
    archive.on('warning', (err) => {
      if (err && err.code === 'ENOENT') finish(err);
    });

    archive.pipe(output);

    for (const result of successResults) {
      if (result.outputPath) {
        const cleanName = path.basename(result.outputPath).replace(/^\d+_/, '');
        archive.file(result.outputPath, { name: cleanName });
      }
    }

    archive.finalize();

  } catch (error) {
    await fsPromises.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    if (!res.headersSent) {
      const message = error instanceof Error ? error.message : 'Internal server error';
      res.status(500).json({ error: message });
    }
  } finally {
    if (files) {
      for (const file of files) {
        await fsPromises.unlink(file.path).catch(() => {});
      }
    }
  }
});

app.listen(port, () => {
  console.log(`Conversion microservice listening on port ${port}`);
});
