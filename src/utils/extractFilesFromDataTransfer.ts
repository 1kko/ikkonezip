// src/utils/extractFilesFromDataTransfer.ts

interface FsFileEntry {
  isFile: true;
  isDirectory: false;
  name: string;
  fullPath: string;
  file(success: (file: File) => void, error?: (err: Error) => void): void;
}

interface FsDirectoryEntry {
  isFile: false;
  isDirectory: true;
  name: string;
  fullPath: string;
  createReader(): {
    readEntries(success: (entries: FsEntry[]) => void): void;
  };
}

type FsEntry = FsFileEntry | FsDirectoryEntry;

/**
 * Pulls all File objects out of a DataTransfer, traversing folder
 * directories via webkitGetAsEntry. Each File gets a `webkitRelativePath`
 * property reflecting its path within any dropped folder. Falls back to
 * the flat `.files` list when entry traversal isn't available.
 */
export async function extractFilesFromDataTransfer(dt: DataTransfer): Promise<File[]> {
  const items = dt.items;
  if (!items || items.length === 0) {
    return Array.from(dt.files);
  }

  const collected: File[] = [];
  const promises: Promise<void>[] = [];
  for (let i = 0; i < items.length; i++) {
    // webkitGetAsEntry is not in all TS lib versions; cast via unknown to our own FsEntry shape
    const rawEntry = (items[i] as unknown as { webkitGetAsEntry?(): unknown })
      .webkitGetAsEntry?.();
    const entry = rawEntry as FsEntry | null | undefined;
    if (entry) {
      promises.push(traverse(entry, '', collected));
    }
  }
  await Promise.all(promises);

  // Fallback: if no entries produced files (e.g., non-Chromium browser),
  // fall back to the flat .files list.
  if (collected.length === 0 && dt.files.length > 0) {
    return Array.from(dt.files);
  }
  return collected;
}

function traverse(entry: FsEntry, path: string, out: File[]): Promise<void> {
  return new Promise((resolve) => {
    if (entry.isFile) {
      entry.file((file) => {
        Object.defineProperty(file, 'webkitRelativePath', {
          value: path + entry.name,
          writable: false,
        });
        out.push(file);
        resolve();
      });
    } else if (entry.isDirectory) {
      const reader = entry.createReader();
      readAllEntries(reader).then((entries) => {
        Promise.all(entries.map((e) => traverse(e, path + entry.name + '/', out))).then(() => resolve());
      });
    } else {
      resolve();
    }
  });
}

function readAllEntries(
  reader: { readEntries(cb: (entries: FsEntry[]) => void): void },
): Promise<FsEntry[]> {
  return new Promise((resolve) => {
    const all: FsEntry[] = [];
    function next() {
      reader.readEntries((batch) => {
        if (batch.length === 0) {
          resolve(all);
        } else {
          all.push(...batch);
          next();
        }
      });
    }
    next();
  });
}
