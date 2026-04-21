import { BlobWriter, BlobReader, ZipWriter } from '@zip.js/zip.js';
import { normalizeFilename, type NormalizationForm } from './normalizeFilename';

export interface FileWithPath {
  file: File;
  path: string;
}

export interface ZipOptions {
  password?: string;
  compressionLevel?: number; // 0 (저장만) ~ 9 (최대 압축), 기본값: 5
  excludeSystemFiles?: boolean; // 시스템 파일 제외 여부, 기본값: true
  /** Unicode normalization form for output filenames. @defaultValue 'NFC' */
  targetForm?: NormalizationForm;
  /**
   * Called as entries finish compressing.
   * `current` = entries completed so far, `total` = total entries to write.
   */
  onProgress?: (current: number, total: number) => void;
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
 * Creates a ZIP file with normalized filenames.
 * Excludes .DS_Store and other system files.
 * Supports password encryption (AES-256, Windows compatible).
 */
export async function createZip(files: FileWithPath[], options: ZipOptions = {}): Promise<Blob> {
  const zipFileWriter = new BlobWriter('application/zip');

  const compressionLevel = options.compressionLevel ?? 5;
  const targetForm = options.targetForm ?? 'NFC';
  const excludeSystemFiles = options.excludeSystemFiles ?? true;

  const zipWriter = new ZipWriter(zipFileWriter, {
    password: options.password || undefined,
    encryptionStrength: 3, // AES-256
    level: compressionLevel as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9,
  });

  // Pre-filter so total reflects the actual entry count
  const eligible = excludeSystemFiles
    ? files.filter(({ path }) => !shouldExclude(path))
    : files;

  if (eligible.length === 0) {
    await zipWriter.close();
    throw new Error('압축할 파일이 없습니다');
  }

  const total = eligible.length;
  let completed = 0;

  for (const { file, path } of eligible) {
    const normalizedPath = normalizeFilename(path, targetForm);
    await zipWriter.add(normalizedPath, new BlobReader(file));
    completed++;
    options.onProgress?.(completed, total);
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
