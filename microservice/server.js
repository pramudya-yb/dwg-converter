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

const upload = multer({ dest: os.tmpdir() });

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
  const targetVersion = req.body.targetVersion;
  const outputFormat = req.body.outputFormat || 'DWG';
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

    for (const file of files) {
      const originalName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      const sourceFilePath = path.join(tempDir, originalName);
      
      await fsPromises.rename(file.path, sourceFilePath);

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
      const fileName = path.basename(outputPath);
      
      res.set({
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'X-Conversion-Results': JSON.stringify(results),
      });
      
      const fileStream = fs.createReadStream(outputPath);
      fileStream.pipe(res);
      
      fileStream.on('close', () => {
        fsPromises.rm(tempDir, { recursive: true, force: true }).catch(() => {});
      });
      return;
    }

    const zipPath = path.join(tempDir, 'converted_files.zip');
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 6 } });

    output.on('close', () => {
      res.set({
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="converted_${targetVersion}_${outputFormat}.zip"`,
        'X-Conversion-Results': JSON.stringify(results),
      });
      
      const zipStream = fs.createReadStream(zipPath);
      zipStream.pipe(res);
      
      zipStream.on('close', () => {
        fsPromises.rm(tempDir, { recursive: true, force: true }).catch(() => {});
      });
    });

    archive.on('error', (err) => {
      res.status(500).json({ error: err.message });
    });

    archive.pipe(output);

    for (const result of successResults) {
      if (result.outputPath) {
        archive.file(result.outputPath, { name: path.basename(result.outputPath) });
      }
    }

    archive.finalize();

  } catch (error) {
    await fsPromises.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

app.listen(port, () => {
  console.log(`Conversion microservice listening on port ${port}`);
});
