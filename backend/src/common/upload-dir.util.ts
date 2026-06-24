import { existsSync, mkdirSync } from 'fs';
import { isAbsolute, join } from 'path';

export function uploadRootDir() {
  const configured = process.env.UPLOAD_DIR || './uploads';
  return isAbsolute(configured) ? configured : join(process.cwd(), configured);
}

export function ensureUploadDir(folder?: string) {
  const dir = folder ? join(uploadRootDir(), folder) : uploadRootDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}
