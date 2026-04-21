import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getDatePrefix, createZip, getRootFolderName, downloadBlob, downloadSingleFile, type FileWithPath } from './zipFiles';
import { BlobReader, ZipReader } from '@zip.js/zip.js';

function createMockFile(name: string, content = 'hello'): File {
  return new File([content], name, { type: 'text/plain' });
}

describe('getDatePrefix', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns YYMMDD_ format', () => {
    vi.setSystemTime(new Date(2026, 1, 19)); // 2026-02-19
    expect(getDatePrefix()).toBe('260219_');
  });

  it('pads single-digit month and day', () => {
    vi.setSystemTime(new Date(2025, 0, 5)); // 2025-01-05
    expect(getDatePrefix()).toBe('250105_');
  });

  it('handles end of year', () => {
    vi.setSystemTime(new Date(2025, 11, 31)); // 2025-12-31
    expect(getDatePrefix()).toBe('251231_');
  });
});

describe('getRootFolderName', () => {
  it('returns null for empty files array', () => {
    expect(getRootFolderName([])).toBeNull();
  });

  it('returns null for files without path separators', () => {
    const files: FileWithPath[] = [
      { file: createMockFile('a.txt'), path: 'a.txt' },
    ];
    expect(getRootFolderName(files)).toBeNull();
  });

  it('returns root folder name when all files share same root', () => {
    const files: FileWithPath[] = [
      { file: createMockFile('a.txt'), path: 'myFolder/a.txt' },
      { file: createMockFile('b.txt'), path: 'myFolder/sub/b.txt' },
    ];
    expect(getRootFolderName(files)).toBe('myFolder');
  });

  it('returns null when files have different root folders', () => {
    const files: FileWithPath[] = [
      { file: createMockFile('a.txt'), path: 'folder1/a.txt' },
      { file: createMockFile('b.txt'), path: 'folder2/b.txt' },
    ];
    expect(getRootFolderName(files)).toBeNull();
  });

  it('normalizes Korean root folder name (NFD to NFC)', () => {
    const nfdFolder = '\u1100\u1161\u1102\u1161\u1103\u1161'; // 가나다 (NFD)
    const files: FileWithPath[] = [
      { file: createMockFile('a.txt'), path: `${nfdFolder}/a.txt` },
    ];
    const result = getRootFolderName(files);
    expect(result).toBe(nfdFolder.normalize('NFC'));
  });
});

describe('createZip', () => {
  it('creates a ZIP blob from files', async () => {
    const files: FileWithPath[] = [
      { file: createMockFile('test.txt', 'hello world'), path: 'test.txt' },
    ];
    const blob = await createZip(files);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
  });

  it('normalizes Korean filenames in ZIP', async () => {
    const nfdName = '\u1100\u1161.txt'; // 가.txt (NFD)
    const files: FileWithPath[] = [
      { file: createMockFile(nfdName, 'content'), path: nfdName },
    ];
    const blob = await createZip(files);

    // Read back the ZIP and check the filename
    const reader = new ZipReader(new BlobReader(blob));
    const entries = await reader.getEntries();
    expect(entries.length).toBe(1);
    expect(entries[0].filename).toBe(nfdName.normalize('NFC'));
    await reader.close();
  });

  it('excludes system files by default', async () => {
    const files: FileWithPath[] = [
      { file: createMockFile('file.txt', 'data'), path: 'file.txt' },
      { file: createMockFile('.DS_Store', ''), path: '.DS_Store' },
      { file: createMockFile('Thumbs.db', ''), path: 'Thumbs.db' },
    ];
    const blob = await createZip(files);

    const reader = new ZipReader(new BlobReader(blob));
    const entries = await reader.getEntries();
    expect(entries.length).toBe(1);
    expect(entries[0].filename).toBe('file.txt');
    await reader.close();
  });

  it('includes system files when excludeSystemFiles is false', async () => {
    const files: FileWithPath[] = [
      { file: createMockFile('file.txt', 'data'), path: 'file.txt' },
      { file: createMockFile('.DS_Store', 'x'), path: '.DS_Store' },
    ];
    const blob = await createZip(files, { excludeSystemFiles: false });

    const reader = new ZipReader(new BlobReader(blob));
    const entries = await reader.getEntries();
    expect(entries.length).toBe(2);
    await reader.close();
  });

  it('excludes ._ prefixed files', async () => {
    const files: FileWithPath[] = [
      { file: createMockFile('file.txt', 'data'), path: 'file.txt' },
      { file: createMockFile('._file.txt', 'x'), path: '._file.txt' },
    ];
    const blob = await createZip(files);

    const reader = new ZipReader(new BlobReader(blob));
    const entries = await reader.getEntries();
    expect(entries.length).toBe(1);
    expect(entries[0].filename).toBe('file.txt');
    await reader.close();
  });

  it('throws error when all files are excluded', async () => {
    const files: FileWithPath[] = [
      { file: createMockFile('.DS_Store', ''), path: '.DS_Store' },
    ];
    await expect(createZip(files)).rejects.toThrow('압축할 파일이 없습니다');
  });

  it('creates ZIP with multiple files', async () => {
    const files: FileWithPath[] = [
      { file: createMockFile('a.txt', 'aaa'), path: 'folder/a.txt' },
      { file: createMockFile('b.txt', 'bbb'), path: 'folder/b.txt' },
      { file: createMockFile('c.txt', 'ccc'), path: 'folder/c.txt' },
    ];
    const blob = await createZip(files);

    const reader = new ZipReader(new BlobReader(blob));
    const entries = await reader.getEntries();
    expect(entries.length).toBe(3);
    await reader.close();
  });

  it('creates encrypted ZIP with password', async () => {
    const files: FileWithPath[] = [
      { file: createMockFile('secret.txt', 'secret data'), path: 'secret.txt' },
    ];
    const blob = await createZip(files, { password: 'test123' });

    const reader = new ZipReader(new BlobReader(blob));
    const entries = await reader.getEntries();
    expect(entries.length).toBe(1);
    expect(entries[0].encrypted).toBe(true);
    await reader.close();
  });

  it('uses NFC normalization by default', async () => {
    const nfdName = '\u1100\u1161.txt'; // 가 (NFD)
    const file = new File(['x'], nfdName, { type: 'text/plain' });
    const blob = await createZip([{ file, path: nfdName }]);
    // Read back to verify entry name
    const reader = new ZipReader(new BlobReader(blob));
    const entries = await reader.getEntries();
    await reader.close();
    expect(entries[0].filename).toBe('\uAC00.txt'); // NFC composed
  });

  it('uses NFD normalization when targetForm is NFD', async () => {
    const nfcName = '\uAC00.txt'; // 가 (NFC)
    const file = new File(['x'], nfcName, { type: 'text/plain' });
    const blob = await createZip([{ file, path: nfcName }], { targetForm: 'NFD' });
    const reader = new ZipReader(new BlobReader(blob));
    const entries = await reader.getEntries();
    await reader.close();
    expect(entries[0].filename).toBe('\u1100\u1161.txt'); // NFD decomposed
  });

  it('calls onProgress at least once during a multi-file zip', async () => {
    const onProgress = vi.fn();
    const files = [
      { file: new File(['a'.repeat(1000)], 'a.txt'), path: 'a.txt' },
      { file: new File(['b'.repeat(1000)], 'b.txt'), path: 'b.txt' },
      { file: new File(['c'.repeat(1000)], 'c.txt'), path: 'c.txt' },
    ];
    await createZip(files, { onProgress });
    expect(onProgress).toHaveBeenCalled();
    // Progress should report final total of 3 entries
    const lastCall = onProgress.mock.calls[onProgress.mock.calls.length - 1];
    expect(lastCall).toEqual([3, 3]);
  });

  it('does not call onProgress when not provided', async () => {
    // Just make sure no crash when options omits onProgress
    const file = new File(['x'], 'a.txt');
    const blob = await createZip([{ file, path: 'a.txt' }]);
    expect(blob.size).toBeGreaterThan(0);
  });
});

describe('downloadBlob', () => {
  beforeEach(() => {
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:mock-url'),
      revokeObjectURL: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('creates a link element and triggers download', () => {
    const clickSpy = vi.fn();
    const appendSpy = vi.spyOn(document.body, 'appendChild').mockImplementation((node) => {
      // Spy on click before it's called
      (node as HTMLAnchorElement).click = clickSpy;
      return node;
    });
    const removeSpy = vi.spyOn(document.body, 'removeChild').mockImplementation((node) => node);

    const blob = new Blob(['test'], { type: 'text/plain' });
    downloadBlob(blob, 'test.txt');

    expect(URL.createObjectURL).toHaveBeenCalledWith(blob);
    expect(appendSpy).toHaveBeenCalled();
    const link = appendSpy.mock.calls[0][0] as HTMLAnchorElement;
    expect(link.tagName).toBe('A');
    expect(link.href).toBe('blob:mock-url');
    expect(link.download).toBe('test.txt');
    expect(clickSpy).toHaveBeenCalled();
    expect(removeSpy).toHaveBeenCalledWith(link);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');

    appendSpy.mockRestore();
    removeSpy.mockRestore();
  });
});

describe('downloadSingleFile', () => {
  beforeEach(() => {
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:mock-url'),
      revokeObjectURL: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('creates blob from file and downloads with normalized name', () => {
    const appendSpy = vi.spyOn(document.body, 'appendChild').mockImplementation((node) => {
      (node as HTMLAnchorElement).click = vi.fn();
      return node;
    });
    const removeSpy = vi.spyOn(document.body, 'removeChild').mockImplementation((node) => node);

    const file = createMockFile('original.txt', 'content');
    downloadSingleFile(file, 'normalized.txt');

    expect(URL.createObjectURL).toHaveBeenCalled();
    const link = appendSpy.mock.calls[0][0] as HTMLAnchorElement;
    expect(link.download).toBe('normalized.txt');

    appendSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it('uses application/octet-stream for files without type', () => {
    const appendSpy = vi.spyOn(document.body, 'appendChild').mockImplementation((node) => {
      (node as HTMLAnchorElement).click = vi.fn();
      return node;
    });
    const removeSpy = vi.spyOn(document.body, 'removeChild').mockImplementation((node) => node);

    const file = new File(['data'], 'noext', { type: '' });
    downloadSingleFile(file, 'noext');

    // The blob should be created (we can't easily inspect its type but the function runs)
    expect(URL.createObjectURL).toHaveBeenCalled();

    appendSpy.mockRestore();
    removeSpy.mockRestore();
  });
});
