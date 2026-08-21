import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

export { formatFileSize } from './format';

const TEMP_BASE = path.join(os.tmpdir(), 'dwg-converter');

export async function createTempDir(): Promise<string> {
  const id = crypto.randomUUID();
  const dir = path.join(TEMP_BASE, id);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export async function cleanupTempDir(dir: string): Promise<void> {
  try {
    if (dir.startsWith(TEMP_BASE)) {
      await fs.rm(dir, { recursive: true, force: true });
    }
  } catch {}
}

export function getFileExtension(filename: string): string {
  return path.extname(filename).toLowerCase();
}

export function isValidCADFile(filename: string): boolean {
  const ext = getFileExtension(filename);
  return ext === '.dwg' || ext === '.dxf';
}

export function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

// Cleanup old temp directories (older than 1 hour)
export async function cleanupOldTempDirs(): Promise<void> {
  try {
    await fs.mkdir(TEMP_BASE, { recursive: true });
    const dirs = await fs.readdir(TEMP_BASE);
    const oneHourAgo = Date.now() - 3600000;

    for (const dir of dirs) {
      const dirPath = path.join(TEMP_BASE, dir);
      try {
        const stat = await fs.stat(dirPath);
        if (stat.isDirectory() && stat.mtimeMs < oneHourAgo) {
          await fs.rm(dirPath, { recursive: true, force: true });
        }
      } catch {}
    }
  } catch {}
}
