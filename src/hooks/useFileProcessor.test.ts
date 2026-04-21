import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFileProcessor } from './useFileProcessor';
import { BlobWriter, BlobReader, ZipWriter } from '@zip.js/zip.js';

function createMockFile(name: string, content = 'hello'): File {
  return new File([content], name, { type: 'text/plain' });
}

function createMockFileWithPath(name: string, relativePath: string, content = 'hello'): File {
  const file = new File([content], name, { type: 'text/plain' });
  Object.defineProperty(file, 'webkitRelativePath', {
    value: relativePath,
    writable: false,
  });
  return file;
}

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

// Mock downloadBlob and downloadSingleFile to prevent DOM side effects
vi.mock('@/utils/zipFiles', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/zipFiles')>();
  return {
    ...actual,
    downloadBlob: vi.fn(),
    downloadSingleFile: vi.fn(),
  };
});

describe('useFileProcessor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('starts with empty files list', () => {
      const { result } = renderHook(() => useFileProcessor());
      expect(result.current.files).toEqual([]);
    });

    it('starts with isProcessing false', () => {
      const { result } = renderHook(() => useFileProcessor());
      expect(result.current.isProcessing).toBe(false);
    });

    it('starts with no error', () => {
      const { result } = renderHook(() => useFileProcessor());
      expect(result.current.error).toBeNull();
    });

    it('starts with no folder name', () => {
      const { result } = renderHook(() => useFileProcessor());
      expect(result.current.folderName).toBeNull();
    });

    it('starts with needsPassword false', () => {
      const { result } = renderHook(() => useFileProcessor());
      expect(result.current.needsPassword).toBe(false);
    });
  });

  describe('addFiles - regular files', () => {
    it('adds a single file', async () => {
      const { result } = renderHook(() => useFileProcessor());
      const file = createMockFile('test.txt');

      await act(async () => {
        await result.current.addFiles([file]);
      });

      expect(result.current.files).toHaveLength(1);
      expect(result.current.files[0].originalName).toBe('test.txt');
    });

    it('adds multiple files', async () => {
      const { result } = renderHook(() => useFileProcessor());

      await act(async () => {
        await result.current.addFiles([
          createMockFile('a.txt'),
          createMockFile('b.txt'),
          createMockFile('c.txt'),
        ]);
      });

      expect(result.current.files).toHaveLength(3);
    });

    it('excludes .DS_Store files', async () => {
      const { result } = renderHook(() => useFileProcessor());

      await act(async () => {
        await result.current.addFiles([
          createMockFile('file.txt'),
          createMockFile('.DS_Store'),
        ]);
      });

      expect(result.current.files).toHaveLength(1);
      expect(result.current.files[0].originalName).toBe('file.txt');
    });

    it('excludes ._ prefixed files', async () => {
      const { result } = renderHook(() => useFileProcessor());

      await act(async () => {
        await result.current.addFiles([
          createMockFile('file.txt'),
          createMockFile('._file.txt'),
        ]);
      });

      expect(result.current.files).toHaveLength(1);
    });

    it('excludes Thumbs.db and desktop.ini', async () => {
      const { result } = renderHook(() => useFileProcessor());

      await act(async () => {
        await result.current.addFiles([
          createMockFile('file.txt'),
          createMockFile('Thumbs.db'),
          createMockFile('desktop.ini'),
        ]);
      });

      expect(result.current.files).toHaveLength(1);
    });

    it('accumulates files across multiple addFiles calls', async () => {
      const { result } = renderHook(() => useFileProcessor());

      await act(async () => {
        await result.current.addFiles([createMockFile('a.txt')]);
      });
      await act(async () => {
        await result.current.addFiles([createMockFile('b.txt')]);
      });

      expect(result.current.files).toHaveLength(2);
    });

    it('normalizes Korean filenames (NFD to NFC)', async () => {
      const { result } = renderHook(() => useFileProcessor());
      const nfdName = '\u1100\u1161.txt'; // 가.txt in NFD

      await act(async () => {
        await result.current.addFiles([createMockFile(nfdName)]);
      });

      expect(result.current.files[0].needsNormalization).toBe(true);
      expect(result.current.files[0].normalizedName).toBe(nfdName.normalize('NFC'));
    });

    it('detects files that do not need normalization', async () => {
      const { result } = renderHook(() => useFileProcessor());

      await act(async () => {
        await result.current.addFiles([createMockFile('hello.txt')]);
      });

      expect(result.current.files[0].needsNormalization).toBe(false);
    });

    it('uses webkitRelativePath as path when available', async () => {
      const { result } = renderHook(() => useFileProcessor());
      const file = createMockFileWithPath('a.txt', 'myFolder/a.txt');

      await act(async () => {
        await result.current.addFiles([file]);
      });

      expect(result.current.files[0].path).toBe('myFolder/a.txt');
    });

    it('clears error on successful addFiles', async () => {
      const { result } = renderHook(() => useFileProcessor());

      // Trigger error first
      await act(async () => {
        await result.current.downloadAsZip();
      });
      expect(result.current.error).not.toBeNull();

      // Add files should clear error
      await act(async () => {
        await result.current.addFiles([createMockFile('file.txt')]);
      });
      expect(result.current.error).toBeNull();
    });
  });

  describe('addFiles - ZIP extraction', () => {
    it('extracts files from an unencrypted ZIP', async () => {
      const { result } = renderHook(() => useFileProcessor());
      const zipBlob = await buildZip([
        { name: 'inner.txt', content: 'inner content' },
      ]);
      const zipFile = new File([zipBlob], 'archive.zip', { type: 'application/zip' });

      await act(async () => {
        await result.current.addFiles([zipFile]);
      });

      expect(result.current.files).toHaveLength(1);
      expect(result.current.files[0].originalName).toBe('inner.txt');
      expect(result.current.files[0].path).toBe('archive/inner.txt');
    });

    it('handles ZIP + regular files together', async () => {
      const { result } = renderHook(() => useFileProcessor());
      const zipBlob = await buildZip([
        { name: 'zipped.txt', content: 'zipped' },
      ]);
      const zipFile = new File([zipBlob], 'test.zip', { type: 'application/zip' });
      const regularFile = createMockFile('regular.txt');

      await act(async () => {
        await result.current.addFiles([regularFile, zipFile]);
      });

      expect(result.current.files).toHaveLength(2);
      const names = result.current.files.map(f => f.originalName);
      expect(names).toContain('regular.txt');
      expect(names).toContain('zipped.txt');
    });

    it('sets needsPassword for encrypted ZIP', async () => {
      const { result } = renderHook(() => useFileProcessor());
      const zipBlob = await buildZip(
        [{ name: 'secret.txt', content: 'secret' }],
        { password: 'pass123' }
      );
      const zipFile = new File([zipBlob], 'encrypted.zip', { type: 'application/zip' });

      await act(async () => {
        await result.current.addFiles([zipFile]);
      });

      expect(result.current.needsPassword).toBe(true);
      expect(result.current.files).toHaveLength(0);
    });

    it('adds regular files even when encrypted ZIP triggers password prompt', async () => {
      const { result } = renderHook(() => useFileProcessor());
      const zipBlob = await buildZip(
        [{ name: 'secret.txt', content: 'secret' }],
        { password: 'pass123' }
      );
      const zipFile = new File([zipBlob], 'encrypted.zip', { type: 'application/zip' });
      const regularFile = createMockFile('regular.txt');

      await act(async () => {
        await result.current.addFiles([regularFile, zipFile]);
      });

      expect(result.current.needsPassword).toBe(true);
      expect(result.current.files).toHaveLength(1);
      expect(result.current.files[0].originalName).toBe('regular.txt');
    });

    it('sets error for corrupted ZIP', async () => {
      const { result } = renderHook(() => useFileProcessor());
      const corruptedFile = new File(['not a zip'], 'bad.zip', { type: 'application/zip' });

      await act(async () => {
        await result.current.addFiles([corruptedFile]);
      });

      expect(result.current.error).toContain('ZIP 파일 처리 실패');
      expect(result.current.error).toContain('bad.zip');
    });

    it('extracts ZIP with nested folder structure', async () => {
      const { result } = renderHook(() => useFileProcessor());
      const zipBlob = await buildZip([
        { name: 'folder/sub/deep.txt', content: 'deep' },
      ]);
      const zipFile = new File([zipBlob], 'nested.zip', { type: 'application/zip' });

      await act(async () => {
        await result.current.addFiles([zipFile]);
      });

      expect(result.current.files).toHaveLength(1);
      expect(result.current.files[0].path).toBe('nested/folder/sub/deep.txt');
    });

    it('excludes system files from extracted ZIP', async () => {
      const { result } = renderHook(() => useFileProcessor());
      const zipBlob = await buildZip([
        { name: 'file.txt', content: 'data' },
        { name: '.DS_Store', content: 'x' },
      ]);
      const zipFile = new File([zipBlob], 'mixed.zip', { type: 'application/zip' });

      await act(async () => {
        await result.current.addFiles([zipFile]);
      });

      expect(result.current.files).toHaveLength(1);
      expect(result.current.files[0].originalName).toBe('file.txt');
    });
  });

  describe('submitZipPassword', () => {
    it('extracts encrypted ZIP with correct password', async () => {
      const { result } = renderHook(() => useFileProcessor());
      const zipBlob = await buildZip(
        [{ name: 'secret.txt', content: 'classified' }],
        { password: 'correct' }
      );
      const zipFile = new File([zipBlob], 'locked.zip', { type: 'application/zip' });

      // First trigger password prompt
      await act(async () => {
        await result.current.addFiles([zipFile]);
      });
      expect(result.current.needsPassword).toBe(true);

      // Submit correct password
      await act(async () => {
        await result.current.submitZipPassword('correct');
      });

      expect(result.current.needsPassword).toBe(false);
      expect(result.current.files).toHaveLength(1);
      expect(result.current.files[0].originalName).toBe('secret.txt');
    });

    it('sets error on wrong password', async () => {
      const { result } = renderHook(() => useFileProcessor());
      const zipBlob = await buildZip(
        [{ name: 'secret.txt', content: 'classified' }],
        { password: 'correct' }
      );
      const zipFile = new File([zipBlob], 'locked.zip', { type: 'application/zip' });

      await act(async () => {
        await result.current.addFiles([zipFile]);
      });

      await act(async () => {
        await result.current.submitZipPassword('wrong');
      });

      expect(result.current.error).toBe('암호가 올바르지 않거나 ZIP 파일을 읽을 수 없습니다');
      expect(result.current.needsPassword).toBe(true);
    });

    it('resets isProcessing after submit', async () => {
      const { result } = renderHook(() => useFileProcessor());
      const zipBlob = await buildZip(
        [{ name: 'secret.txt', content: 'data' }],
        { password: 'pass' }
      );
      const zipFile = new File([zipBlob], 'locked.zip', { type: 'application/zip' });

      await act(async () => {
        await result.current.addFiles([zipFile]);
      });
      await act(async () => {
        await result.current.submitZipPassword('pass');
      });

      expect(result.current.isProcessing).toBe(false);
    });

    it('does nothing if no pending ZIP file', async () => {
      const { result } = renderHook(() => useFileProcessor());

      await act(async () => {
        await result.current.submitZipPassword('anything');
      });

      expect(result.current.files).toHaveLength(0);
      expect(result.current.isProcessing).toBe(false);
    });
  });

  describe('cancelZipPassword', () => {
    it('clears needsPassword state', async () => {
      const { result } = renderHook(() => useFileProcessor());
      const zipBlob = await buildZip(
        [{ name: 'secret.txt', content: 'data' }],
        { password: 'pass' }
      );
      const zipFile = new File([zipBlob], 'locked.zip', { type: 'application/zip' });

      await act(async () => {
        await result.current.addFiles([zipFile]);
      });
      expect(result.current.needsPassword).toBe(true);

      act(() => {
        result.current.cancelZipPassword();
      });

      expect(result.current.needsPassword).toBe(false);
    });

    it('allows retrying with a new ZIP after cancel', async () => {
      const { result } = renderHook(() => useFileProcessor());
      const zipBlob = await buildZip(
        [{ name: 'file.txt', content: 'data' }],
        { password: 'pass' }
      );
      const zipFile = new File([zipBlob], 'locked.zip', { type: 'application/zip' });

      await act(async () => {
        await result.current.addFiles([zipFile]);
      });
      act(() => {
        result.current.cancelZipPassword();
      });

      // Submit should do nothing since pending was cleared
      await act(async () => {
        await result.current.submitZipPassword('pass');
      });
      expect(result.current.files).toHaveLength(0);
    });
  });

  describe('removeFile', () => {
    it('removes a file by id', async () => {
      const { result } = renderHook(() => useFileProcessor());

      await act(async () => {
        await result.current.addFiles([
          createMockFile('a.txt'),
          createMockFile('b.txt'),
        ]);
      });

      const idToRemove = result.current.files[0].id;

      act(() => {
        result.current.removeFile(idToRemove);
      });

      expect(result.current.files).toHaveLength(1);
      expect(result.current.files[0].originalName).toBe('b.txt');
    });

    it('does nothing for non-existent id', async () => {
      const { result } = renderHook(() => useFileProcessor());

      await act(async () => {
        await result.current.addFiles([createMockFile('a.txt')]);
      });

      act(() => {
        result.current.removeFile('non-existent-id');
      });

      expect(result.current.files).toHaveLength(1);
    });
  });

  describe('removeFiles', () => {
    it('removes multiple files by ids', async () => {
      const { result } = renderHook(() => useFileProcessor());

      await act(async () => {
        await result.current.addFiles([
          createMockFile('a.txt'),
          createMockFile('b.txt'),
          createMockFile('c.txt'),
        ]);
      });

      const idsToRemove = [result.current.files[0].id, result.current.files[2].id];

      act(() => {
        result.current.removeFiles(idsToRemove);
      });

      expect(result.current.files).toHaveLength(1);
      expect(result.current.files[0].originalName).toBe('b.txt');
    });

    it('does nothing for non-existent ids', async () => {
      const { result } = renderHook(() => useFileProcessor());

      await act(async () => {
        await result.current.addFiles([createMockFile('a.txt')]);
      });

      act(() => {
        result.current.removeFiles(['non-existent-1', 'non-existent-2']);
      });

      expect(result.current.files).toHaveLength(1);
    });
  });

  describe('renameFile', () => {
    it('updates a file\'s normalizedName and normalizedPath, leaves originalName intact', async () => {
      const { result } = renderHook(() => useFileProcessor());

      await act(async () => {
        await result.current.addFiles([createMockFile('original.txt')]);
      });

      const id = result.current.files[0].id;

      act(() => {
        result.current.renameFile(id, 'renamed.txt');
      });

      const renamed = result.current.files.find((f) => f.id === id);
      expect(renamed?.normalizedName).toBe('renamed.txt');
      expect(renamed?.normalizedPath).toBe('renamed.txt');
      expect(renamed?.originalName).toBe('original.txt');
    });

    it('preserves directory part of path when renaming', async () => {
      const { result } = renderHook(() => useFileProcessor());

      const fileWithPath = createMockFileWithPath('a.txt', 'folder/sub/a.txt');
      await act(async () => {
        await result.current.addFiles([fileWithPath]);
      });

      const id = result.current.files[0].id;
      act(() => {
        result.current.renameFile(id, 'renamed.txt');
      });

      const renamed = result.current.files.find((f) => f.id === id);
      expect(renamed?.normalizedPath).toBe('folder/sub/renamed.txt');
    });

    it('strips slashes from the new name (path injection prevention)', async () => {
      const { result } = renderHook(() => useFileProcessor());

      await act(async () => {
        await result.current.addFiles([createMockFile('a.txt')]);
      });

      const id = result.current.files[0].id;
      act(() => {
        result.current.renameFile(id, '../etc/passwd');
      });

      const renamed = result.current.files.find((f) => f.id === id);
      expect(renamed?.normalizedName).not.toContain('/');
      expect(renamed?.normalizedName).toBe('..etcpasswd');
    });

    it('does nothing when name is empty (after trim)', async () => {
      const { result } = renderHook(() => useFileProcessor());

      await act(async () => {
        await result.current.addFiles([createMockFile('a.txt')]);
      });

      const id = result.current.files[0].id;
      const before = result.current.files[0].normalizedName;
      act(() => {
        result.current.renameFile(id, '   ');
      });

      expect(result.current.files[0].normalizedName).toBe(before);
    });

    it('does nothing for unknown id', async () => {
      const { result } = renderHook(() => useFileProcessor());

      await act(async () => {
        await result.current.addFiles([createMockFile('a.txt')]);
      });

      const before = result.current.files[0];
      act(() => {
        result.current.renameFile('nonexistent-id', 'newname.txt');
      });

      expect(result.current.files[0]).toEqual(before);
    });
  });

  describe('clearFiles', () => {
    it('removes all files', async () => {
      const { result } = renderHook(() => useFileProcessor());

      await act(async () => {
        await result.current.addFiles([
          createMockFile('a.txt'),
          createMockFile('b.txt'),
        ]);
      });

      act(() => {
        result.current.clearFiles();
      });

      expect(result.current.files).toHaveLength(0);
    });

    it('clears error', async () => {
      const { result } = renderHook(() => useFileProcessor());

      await act(async () => {
        await result.current.downloadAsZip();
      });
      expect(result.current.error).not.toBeNull();

      act(() => {
        result.current.clearFiles();
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe('folderName', () => {
    it('returns null when files have no common root folder', async () => {
      const { result } = renderHook(() => useFileProcessor());

      await act(async () => {
        await result.current.addFiles([createMockFile('a.txt')]);
      });

      expect(result.current.folderName).toBeNull();
    });

    it('detects common root folder from webkitRelativePath', async () => {
      const { result } = renderHook(() => useFileProcessor());

      await act(async () => {
        await result.current.addFiles([
          createMockFileWithPath('a.txt', 'myFolder/a.txt'),
          createMockFileWithPath('b.txt', 'myFolder/b.txt'),
        ]);
      });

      expect(result.current.folderName).toBe('myFolder');
    });
  });

  describe('progress tracking', () => {
    it('starts with progress null', () => {
      const { result } = renderHook(() => useFileProcessor());
      expect(result.current.progress).toBeNull();
    });

    it('resets progress to null after downloadAsZip completes', async () => {
      const { result } = renderHook(() => useFileProcessor());

      await act(async () => {
        await result.current.addFiles([
          createMockFile('a.txt'),
          createMockFile('b.txt'),
        ]);
      });

      await act(async () => {
        await result.current.downloadAsZip('test.zip');
      });

      // After completion, progress is reset to null
      expect(result.current.progress).toBeNull();
    });
  });

  describe('downloadAsZip', () => {
    it('sets error when no files', async () => {
      const { result } = renderHook(() => useFileProcessor());

      await act(async () => {
        await result.current.downloadAsZip();
      });

      expect(result.current.error).toBe('No files to download');
    });

    it('creates and downloads ZIP successfully', async () => {
      const { downloadBlob } = await import('@/utils/zipFiles');
      const { result } = renderHook(() => useFileProcessor());

      await act(async () => {
        await result.current.addFiles([createMockFile('test.txt', 'content')]);
      });

      await act(async () => {
        await result.current.downloadAsZip('output.zip');
      });

      expect(result.current.error).toBeNull();
      expect(result.current.isProcessing).toBe(false);
      expect(downloadBlob).toHaveBeenCalled();
    });

    it('handles non-Error throw in downloadAsZip', async () => {
      const zipFiles = await import('@/utils/zipFiles');
      const { result } = renderHook(() => useFileProcessor());

      await act(async () => {
        await result.current.addFiles([createMockFile('test.txt', 'content')]);
      });

      // Mock createZip to throw a non-Error value
      const origCreateZip = zipFiles.createZip;
      vi.spyOn(zipFiles, 'createZip').mockRejectedValueOnce('string error');

      await act(async () => {
        await result.current.downloadAsZip('output.zip');
      });

      expect(result.current.error).toBe('Failed to create ZIP file');
      expect(result.current.isProcessing).toBe(false);

      // Restore
      vi.mocked(zipFiles.createZip).mockImplementation(origCreateZip);
    });
  });

  describe('downloadSingle', () => {
    it('sets error when not exactly one file', async () => {
      const { result } = renderHook(() => useFileProcessor());

      act(() => {
        result.current.downloadSingle();
      });

      expect(result.current.error).toBe('downloadSingle requires exactly one file');
    });

    it('downloads single file successfully', async () => {
      const { downloadSingleFile } = await import('@/utils/zipFiles');
      const { result } = renderHook(() => useFileProcessor());

      await act(async () => {
        await result.current.addFiles([createMockFile('test.txt', 'content')]);
      });

      act(() => {
        result.current.downloadSingle();
      });

      expect(downloadSingleFile).toHaveBeenCalled();
    });
  });

  describe('rename persists into ZIP entry path', () => {
    it('uses the renamed normalizedPath, not the original upload path', async () => {
      const zipFiles = await import('@/utils/zipFiles');
      const origCreateZip = zipFiles.createZip;
      vi.spyOn(zipFiles, 'createZip').mockResolvedValueOnce(new Blob());

      const { result } = renderHook(() => useFileProcessor());

      const file = new File(['hi'], 'original.txt', { type: 'text/plain' });
      await act(async () => {
        await result.current.addFiles([file]);
      });
      const id = result.current.files[0].id;

      act(() => {
        result.current.renameFile(id, 'renamed.txt');
      });

      await act(async () => {
        await result.current.downloadAsZip();
      });

      const createZipMock = vi.mocked(zipFiles.createZip);
      expect(createZipMock).toHaveBeenCalledTimes(1);
      const passedFiles = createZipMock.mock.calls[0][0];
      expect(passedFiles).toHaveLength(1);
      expect(passedFiles[0].path).toBe('renamed.txt');

      // Restore
      vi.mocked(zipFiles.createZip).mockImplementation(origCreateZip);
    });

    it('preserves folder depth on rename', async () => {
      const zipFiles = await import('@/utils/zipFiles');
      const origCreateZip = zipFiles.createZip;
      vi.spyOn(zipFiles, 'createZip').mockResolvedValueOnce(new Blob());

      const { result } = renderHook(() => useFileProcessor());

      const file = new File(['hi'], 'foo.txt', { type: 'text/plain' });
      Object.defineProperty(file, 'webkitRelativePath', {
        value: 'docs/foo.txt',
        writable: false,
      });
      await act(async () => {
        await result.current.addFiles([file]);
      });
      const id = result.current.files[0].id;

      act(() => {
        result.current.renameFile(id, 'bar.txt');
      });

      await act(async () => {
        await result.current.downloadAsZip();
      });

      const createZipMock = vi.mocked(zipFiles.createZip);
      expect(createZipMock).toHaveBeenCalledTimes(1);
      const passedFiles = createZipMock.mock.calls[0][0];
      expect(passedFiles[0].path).toBe('docs/bar.txt');

      // Restore
      vi.mocked(zipFiles.createZip).mockImplementation(origCreateZip);
    });
  });
});
