import { describe, it, expect, vi } from 'vitest';
import { isZipFile, isZipEncrypted, extractZip } from './extractZip';
import { BlobWriter, BlobReader, ZipWriter } from '@zip.js/zip.js';

function createMockFile(name: string, content = 'hello', type = 'text/plain'): File {
  return new File([content], name, { type });
}

/** Helper: create a real ZIP blob */
async function buildZip(
  entries: { name: string; content: string }[],
  options?: { password?: string }
): Promise<Blob> {
  const blobWriter = new BlobWriter('application/zip');
  const writer = new ZipWriter(blobWriter, {
    password: options?.password,
    encryptionStrength: options?.password ? 3 : undefined,
  });
  for (const entry of entries) {
    await writer.add(entry.name, new BlobReader(new Blob([entry.content])));
  }
  await writer.close();
  return await blobWriter.getData();
}

describe('isZipFile', () => {
  it('detects .zip extension', () => {
    expect(isZipFile(createMockFile('archive.zip'))).toBe(true);
  });

  it('detects .ZIP extension (case insensitive)', () => {
    expect(isZipFile(createMockFile('archive.ZIP'))).toBe(true);
  });

  it('detects application/zip MIME type', () => {
    expect(isZipFile(createMockFile('noext', '', 'application/zip'))).toBe(true);
  });

  it('detects application/x-zip-compressed MIME type', () => {
    expect(isZipFile(createMockFile('noext', '', 'application/x-zip-compressed'))).toBe(true);
  });

  it('rejects non-zip files', () => {
    expect(isZipFile(createMockFile('document.pdf'))).toBe(false);
  });

  it('rejects text files', () => {
    expect(isZipFile(createMockFile('readme.txt'))).toBe(false);
  });

  it('rejects files with zip in name but not extension', () => {
    expect(isZipFile(createMockFile('zip-archive.tar'))).toBe(false);
  });
});

describe('isZipEncrypted', () => {
  it('returns false for unencrypted ZIP', async () => {
    const blob = await buildZip([{ name: 'test.txt', content: 'hello' }]);
    const file = new File([blob], 'test.zip', { type: 'application/zip' });
    expect(await isZipEncrypted(file)).toBe(false);
  });

  it('returns true for encrypted ZIP', async () => {
    const blob = await buildZip(
      [{ name: 'secret.txt', content: 'secret' }],
      { password: 'pass123' }
    );
    const file = new File([blob], 'test.zip', { type: 'application/zip' });
    expect(await isZipEncrypted(file)).toBe(true);
  });
});

describe('extractZip', () => {
  it('extracts files from unencrypted ZIP', async () => {
    const blob = await buildZip([
      { name: 'hello.txt', content: 'hello world' },
      { name: 'data.txt', content: 'some data' },
    ]);
    const zipFile = new File([blob], 'archive.zip', { type: 'application/zip' });
    const results = await extractZip(zipFile);

    expect(results).toHaveLength(2);
    expect(results[0].path).toBe('archive/hello.txt');
    expect(results[1].path).toBe('archive/data.txt');
    expect(results[0].file.name).toBe('hello.txt');
    expect(results[1].file.name).toBe('data.txt');
  });

  it('sets webkitRelativePath on extracted files', async () => {
    const blob = await buildZip([{ name: 'file.txt', content: 'data' }]);
    const zipFile = new File([blob], 'myzip.zip');
    const results = await extractZip(zipFile);

    expect(results).toHaveLength(1);
    const extracted = results[0].file as File & { webkitRelativePath: string };
    expect(extracted.webkitRelativePath).toBe('myzip/file.txt');
  });

  it('uses ZIP filename without extension as root folder', async () => {
    const blob = await buildZip([{ name: 'doc.txt', content: 'text' }]);
    const zipFile = new File([blob], 'MyArchive.zip');
    const results = await extractZip(zipFile);

    expect(results[0].path).toBe('MyArchive/doc.txt');
  });

  it('handles case-insensitive .ZIP extension for root folder', async () => {
    const blob = await buildZip([{ name: 'doc.txt', content: 'text' }]);
    const zipFile = new File([blob], 'MyArchive.ZIP');
    const results = await extractZip(zipFile);

    expect(results[0].path).toBe('MyArchive/doc.txt');
  });

  it('preserves nested folder structure', async () => {
    const blob = await buildZip([
      { name: 'folder/sub/deep.txt', content: 'deep' },
    ]);
    const zipFile = new File([blob], 'nested.zip');
    const results = await extractZip(zipFile);

    expect(results).toHaveLength(1);
    expect(results[0].path).toBe('nested/folder/sub/deep.txt');
    expect(results[0].file.name).toBe('deep.txt');
  });

  it('extracts encrypted ZIP with correct password', async () => {
    const blob = await buildZip(
      [{ name: 'secret.txt', content: 'classified' }],
      { password: 'mypass' }
    );
    const zipFile = new File([blob], 'encrypted.zip');
    const results = await extractZip(zipFile, { password: 'mypass' });

    expect(results).toHaveLength(1);
    expect(results[0].file.name).toBe('secret.txt');
  });

  it('returns empty array for empty ZIP', async () => {
    const blobWriter = new BlobWriter('application/zip');
    const writer = new ZipWriter(blobWriter);
    await writer.close();
    const blob = await blobWriter.getData();

    const zipFile = new File([blob], 'empty.zip');
    const results = await extractZip(zipFile);

    expect(results).toHaveLength(0);
  });

  it('extracts files with Korean names', async () => {
    const blob = await buildZip([
      { name: '한글파일.txt', content: 'korean content' },
    ]);
    const zipFile = new File([blob], '한글.zip');
    const results = await extractZip(zipFile);

    expect(results).toHaveLength(1);
    expect(results[0].file.name).toBe('한글파일.txt');
    expect(results[0].path).toBe('한글/한글파일.txt');
  });

  it('skips directory entries in ZIP', async () => {
    // Create a ZIP that contains a directory entry + a file
    const blobWriter = new BlobWriter('application/zip');
    const writer = new ZipWriter(blobWriter);
    // Adding "folder/" as a directory entry (trailing slash = directory)
    await writer.add('folder/', undefined!);
    await writer.add('folder/file.txt', new BlobReader(new Blob(['data'])));
    await writer.close();
    const blob = await blobWriter.getData();

    const zipFile = new File([blob], 'withdir.zip');
    const results = await extractZip(zipFile);

    // Should only contain the file, not the directory
    expect(results).toHaveLength(1);
    expect(results[0].file.name).toBe('file.txt');
    expect(results[0].path).toBe('withdir/folder/file.txt');
  });

  it('skips entries with getData missing', async () => {
    // Mock ZipReader to return an entry without getData
    const { ZipReader: OrigZipReader } = await import('@zip.js/zip.js');
    const blob = await buildZip([{ name: 'test.txt', content: 'data' }]);

    const mockGetEntries = vi.fn().mockResolvedValue([
      {
        filename: 'no-data.txt',
        directory: false,
        getData: undefined, // no getData
        uncompressedSize: 100,
        encrypted: false,
      },
      {
        filename: 'real.txt',
        directory: false,
        getData: vi.fn().mockResolvedValue(new Blob(['real data'])),
        uncompressedSize: 9,
        encrypted: false,
        lastModDate: new Date(),
      },
    ]);
    const mockClose = vi.fn();

    vi.spyOn(OrigZipReader.prototype, 'getEntries').mockImplementation(mockGetEntries);
    vi.spyOn(OrigZipReader.prototype, 'close').mockImplementation(mockClose);

    const zipFile = new File([blob], 'test.zip');
    const results = await extractZip(zipFile);

    // Should skip the entry without getData
    expect(results).toHaveLength(1);
    expect(results[0].file.name).toBe('real.txt');

    vi.restoreAllMocks();
  });

  it('skips entries with uncompressedSize 0', async () => {
    const { ZipReader: OrigZipReader } = await import('@zip.js/zip.js');
    const blob = await buildZip([{ name: 'test.txt', content: 'data' }]);

    const mockGetEntries = vi.fn().mockResolvedValue([
      {
        filename: 'empty.txt',
        directory: false,
        getData: vi.fn(),
        uncompressedSize: 0, // zero-size
        encrypted: false,
      },
      {
        filename: 'real.txt',
        directory: false,
        getData: vi.fn().mockResolvedValue(new Blob(['content'])),
        uncompressedSize: 7,
        encrypted: false,
        lastModDate: new Date(),
      },
    ]);
    const mockClose = vi.fn();

    vi.spyOn(OrigZipReader.prototype, 'getEntries').mockImplementation(mockGetEntries);
    vi.spyOn(OrigZipReader.prototype, 'close').mockImplementation(mockClose);

    const zipFile = new File([blob], 'test.zip');
    const results = await extractZip(zipFile);

    expect(results).toHaveLength(1);
    expect(results[0].file.name).toBe('real.txt');

    vi.restoreAllMocks();
  });
});
