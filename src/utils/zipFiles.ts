import { BlobWriter, BlobReader, ZipWriter } from '@zip.js/zip.js';
import { normalizeFilename } from './normalizeFilename';

export interface FileWithPath {
  file: File;
  path: string;
}

export interface ZipOptions {
  password?: string;
}

// Files to exclude from ZIP
const EXCLUDED_FILES = ['.DS_Store', 'Thumbs.db', 'desktop.ini', '._.DS_Store'];

/**
 * Check if a file should be excluded from the ZIP
 */
function shouldExclude(path: string): boolean {
  const filename = path.split('/').pop() || '';
  return EXCLUDED_FILES.includes(filename) || filename.startsWith('._');
}

/**
 * Get date prefix in YYMMDD format
 */
export function getDatePrefix(): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yy}${mm}${dd}_`;
}

/**
 * Creates a ZIP file with normalized (NFC) filenames.
 * Excludes .DS_Store and other system files.
 * Supports password encryption (AES-256, Windows compatible).
 */
export async function createZip(files: FileWithPath[], options: ZipOptions = {}): Promise<Blob> {
  const zipFileWriter = new BlobWriter('application/zip');

  // Configure ZipWriter with optional password (AES-256 encryption)
  const zipWriter = new ZipWriter(zipFileWriter, {
    password: options.password || undefined,
    encryptionStrength: 3, // AES-256
  });

  let fileCount = 0;

  for (const { file, path } of files) {
    // Skip excluded files
    if (shouldExclude(path)) {
      continue;
    }

    const normalizedPath = normalizeFilename(path);
    await zipWriter.add(normalizedPath, new BlobReader(file));
    fileCount++;
  }

  // If no files remain after filtering, throw error
  if (fileCount === 0) {
    await zipWriter.close();
    throw new Error('압축할 파일이 없습니다');
  }

  await zipWriter.close();
  return await zipFileWriter.getData();
}

/**
 * Downloads a blob as a file.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Downloads a single file with normalized filename.
 */
export function downloadSingleFile(file: File, normalizedName: string): void {
  const blob = new Blob([file], { type: file.type || 'application/octet-stream' });
  downloadBlob(blob, normalizedName);
}

/**
 * Get the root folder name from uploaded files
 */
export function getRootFolderName(files: FileWithPath[]): string | null {
  if (files.length === 0) return null;

  // Check if files have webkitRelativePath (folder upload)
  const firstPath = files[0].path;
  if (firstPath.includes('/')) {
    // Extract root folder name
    const rootFolder = firstPath.split('/')[0];
    // Verify all files are from the same root folder
    const allSameRoot = files.every(f => f.path.startsWith(rootFolder + '/'));
    if (allSameRoot) {
      return normalizeFilename(rootFolder);
    }
  }

  return null;
}
