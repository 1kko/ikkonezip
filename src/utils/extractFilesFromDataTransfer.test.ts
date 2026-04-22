import { describe, it, expect } from 'vitest';
import { extractFilesFromDataTransfer } from './extractFilesFromDataTransfer';

function makeDT(files: File[], items?: DataTransferItem[]): DataTransfer {
  return {
    files: files as unknown as FileList,
    items: (items ?? []) as unknown as DataTransferItemList,
  } as DataTransfer;
}

describe('extractFilesFromDataTransfer', () => {
  it('returns empty array when no files and no items', async () => {
    expect(await extractFilesFromDataTransfer(makeDT([]))).toEqual([]);
  });

  it('returns files from .files when no .items entries available', async () => {
    const a = new File(['a'], 'a.txt');
    const b = new File(['b'], 'b.txt');
    const result = await extractFilesFromDataTransfer(makeDT([a, b]));
    expect(result).toHaveLength(2);
    expect(result.map((f) => f.name)).toEqual(['a.txt', 'b.txt']);
  });

  it('uses .items entries when available (folder support path)', async () => {
    const fileEntry = {
      isFile: true,
      isDirectory: false,
      name: 'f.txt',
      fullPath: '/f.txt',
      file: (cb: (f: File) => void) => cb(new File(['x'], 'f.txt')),
    };
    const item = {
      kind: 'file',
      webkitGetAsEntry: () => fileEntry,
    } as unknown as DataTransferItem;
    const dt = makeDT([new File(['x'], 'f.txt')], [item]);
    const result = await extractFilesFromDataTransfer(dt);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('f.txt');
  });

  it('drains all readEntries batches for folders with >100 files (no truncation)', async () => {
    let callCount = 0;
    const totalFiles = 250;
    const allEntries = Array.from({ length: totalFiles }, (_, i) => ({
      isFile: true,
      isDirectory: false,
      name: `f${i}.txt`,
      fullPath: `/dir/f${i}.txt`,
      file: (cb: (f: File) => void) => cb(new File(['x'], `f${i}.txt`)),
    }));

    const reader = {
      readEntries: (cb: (e: unknown[]) => void) => {
        const start = callCount * 100;
        const batch = allEntries.slice(start, start + 100);
        callCount++;
        cb(batch);
      },
    };

    const dirEntry = {
      isFile: false,
      isDirectory: true,
      name: 'dir',
      fullPath: '/dir',
      createReader: () => reader,
    };

    const item = {
      kind: 'file',
      webkitGetAsEntry: () => dirEntry,
    } as unknown as DataTransferItem;

    const dt = {
      files: [] as unknown as FileList,
      items: [item] as unknown as DataTransferItemList,
    } as DataTransfer;

    const result = await extractFilesFromDataTransfer(dt);
    expect(result).toHaveLength(totalFiles);
  });

  it('falls back to dt.files when items are present but yield no entries (non-Chromium browser)', async () => {
    // Item with webkitGetAsEntry returning null — simulates Firefox/Safari without entry support
    const item = {
      kind: 'file',
      webkitGetAsEntry: () => null,
    } as unknown as DataTransferItem;
    const fallback = new File(['x'], 'fallback.txt');
    const dt = {
      files: [fallback] as unknown as FileList,
      items: [item] as unknown as DataTransferItemList,
    } as DataTransfer;

    const result = await extractFilesFromDataTransfer(dt);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('fallback.txt');
  });

  it('safely skips entries that are neither file nor directory', async () => {
    // Hypothetical entry with both isFile and isDirectory false (defensive branch)
    const weirdEntry = {
      isFile: false,
      isDirectory: false,
      name: 'weird',
      fullPath: '/weird',
    } as unknown as object;
    const item = {
      kind: 'file',
      webkitGetAsEntry: () => weirdEntry,
    } as unknown as DataTransferItem;
    const dt = {
      files: [] as unknown as FileList,
      items: [item] as unknown as DataTransferItemList,
    } as DataTransfer;

    const result = await extractFilesFromDataTransfer(dt);
    expect(result).toEqual([]);
  });
});
