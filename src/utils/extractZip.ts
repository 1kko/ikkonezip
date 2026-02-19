import { BlobReader, BlobWriter, ZipReader } from '@zip.js/zip.js';

export interface ExtractedFile {
  file: File;
  path: string;
}

const ZIP_EXTENSIONS = ['.zip'];
const ZIP_MIME_TYPES = ['application/zip', 'application/x-zip-compressed'];

/**
 * Checks if a file is a ZIP archive based on extension or MIME type.
 */
export function isZipFile(file: File): boolean {
  const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
  if (ZIP_EXTENSIONS.includes(ext)) return true;
  if (ZIP_MIME_TYPES.includes(file.type)) return true;
  return false;
}

/**
 * Checks if a ZIP file contains encrypted entries.
 */
export async function isZipEncrypted(file: File): Promise<boolean> {
  const reader = new ZipReader(new BlobReader(file));
  try {
    const entries = await reader.getEntries();
    return entries.some((entry) => entry.encrypted);
  } finally {
    await reader.close();
  }
}

/**
 * Extracts files from a ZIP archive.
 * Returns files with paths prefixed by the ZIP filename (without extension) as root folder.
 * Skips directory entries and empty entries.
 */
export async function extractZip(
  file: File,
  options?: { password?: string }
): Promise<ExtractedFile[]> {
  const reader = new ZipReader(new BlobReader(file), {
    password: options?.password,
  });

  const entries = await reader.getEntries();
  const results: ExtractedFile[] = [];

  // Use ZIP filename (without extension) as root folder
  const zipName = file.name.replace(/\.zip$/i, '');

  for (const entry of entries) {
    // Skip directories
    if (entry.directory || !entry.getData) continue;

    // Skip entries with no data
    if (entry.uncompressedSize === 0) continue;

    const blob = await entry.getData(new BlobWriter());

    const filename = extractFilename(entry.filename);
    const extractedFile = new File([blob], filename, {
      lastModified: entry.lastModDate?.getTime(),
    });

    const path = `${zipName}/${entry.filename}`;
    Object.defineProperty(extractedFile, 'webkitRelativePath', {
      value: path,
      writable: false,
    });

    results.push({ file: extractedFile, path });
  }

  await reader.close();
  return results;
}

/**
 * Extracts the filename from a full entry path.
 */
function extractFilename(entryPath: string): string {
  const parts = entryPath.split('/');
  return parts[parts.length - 1] || entryPath;
}
