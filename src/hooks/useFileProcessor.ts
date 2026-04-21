import { useState, useCallback, useMemo, useRef } from 'react';
import { normalizeFilename, needsNormalization } from '@/utils/normalizeFilename';
import { createZip, downloadBlob, downloadSingleFile, getRootFolderName, getDatePrefix, type FileWithPath, type ZipOptions } from '@/utils/zipFiles';
import { isZipFile, isZipEncrypted, extractZip } from '@/utils/extractZip';

export interface ProcessedFile {
  id: string;
  file: File;
  originalName: string;
  normalizedName: string;
  path: string;
  normalizedPath: string;
  needsNormalization: boolean;
  size: number;
}

export interface UseFileProcessorReturn {
  files: ProcessedFile[];
  isProcessing: boolean;
  error: string | null;
  folderName: string | null;
  needsPassword: boolean;
  progress: { current: number; total: number } | null;
  addFiles: (fileList: FileList | File[]) => Promise<void>;
  removeFile: (id: string) => void;
  removeFiles: (ids: string[]) => void;
  renameFile: (id: string, newName: string) => void;
  clearFiles: () => void;
  downloadAsZip: (zipFilename?: string, options?: ZipOptions) => Promise<void>;
  downloadSingle: () => void;
  submitZipPassword: (password: string) => Promise<void>;
  cancelZipPassword: () => void;
}

// Files to exclude from the list
const EXCLUDED_FILES = ['.DS_Store', 'Thumbs.db', 'desktop.ini', '._.DS_Store'];

function shouldExclude(filename: string): boolean {
  return EXCLUDED_FILES.includes(filename) || filename.startsWith('._');
}

let fileIdCounter = 0;

function generateId(): string {
  return `file-${++fileIdCounter}-${Date.now()}`;
}

export function useFileProcessor(): UseFileProcessorReturn {
  const [files, setFiles] = useState<ProcessedFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const pendingZipFileRef = useRef<File | null>(null);
  const pendingNonZipFilesRef = useRef<ProcessedFile[]>([]);

  // Detect folder name from uploaded files
  const folderName = useMemo(() => {
    if (files.length === 0) return null;
    const fileData: FileWithPath[] = files.map(f => ({ file: f.file, path: f.path }));
    return getRootFolderName(fileData);
  }, [files]);

  const processRegularFiles = useCallback((fileList: File[]): ProcessedFile[] => {
    const newFiles: ProcessedFile[] = [];
    for (const file of fileList) {
      if (shouldExclude(file.name)) continue;
      const path = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
      const normalizedPath = normalizeFilename(path);
      const normalizedName = normalizeFilename(file.name);
      newFiles.push({
        id: generateId(),
        file,
        originalName: file.name,
        normalizedName,
        path,
        normalizedPath,
        needsNormalization: needsNormalization(path),
        size: file.size,
      });
    }
    return newFiles;
  }, []);

  const processExtractedFiles = useCallback((extracted: { file: File; path: string }[]): ProcessedFile[] => {
    const newFiles: ProcessedFile[] = [];
    for (const { file, path } of extracted) {
      if (shouldExclude(file.name)) continue;
      const normalizedPath = normalizeFilename(path);
      const normalizedName = normalizeFilename(file.name);
      newFiles.push({
        id: generateId(),
        file,
        originalName: file.name,
        normalizedName,
        path,
        normalizedPath,
        needsNormalization: needsNormalization(path),
        size: file.size,
      });
    }
    return newFiles;
  }, []);

  const addFiles = useCallback(async (fileList: FileList | File[]) => {
    const allFiles = Array.from(fileList);
    const regularFiles: File[] = [];
    const zipFiles: File[] = [];

    for (const file of allFiles) {
      if (isZipFile(file)) {
        zipFiles.push(file);
      } else {
        regularFiles.push(file);
      }
    }

    // Process regular files immediately
    const processedRegular = processRegularFiles(regularFiles);

    // Process ZIP files
    const allExtracted: ProcessedFile[] = [];
    for (const zipFile of zipFiles) {
      try {
        const encrypted = await isZipEncrypted(zipFile);
        if (encrypted) {
          // Store pending state for password prompt
          pendingZipFileRef.current = zipFile;
          pendingNonZipFilesRef.current = processedRegular;
          setNeedsPassword(true);
          // Add regular files now, ZIP will be added after password
          if (processedRegular.length > 0) {
            setFiles(prev => [...prev, ...processedRegular]);
          }
          setError(null);
          return;
        }
        const extracted = await extractZip(zipFile);
        allExtracted.push(...processExtractedFiles(extracted));
      } catch (err) {
        setError(
          err instanceof Error
            ? `ZIP 파일 처리 실패 (${zipFile.name}): ${err.message}`
            : `ZIP 파일 처리 실패 (${zipFile.name})`
        );
        return;
      }
    }

    const allNew = [...processedRegular, ...allExtracted];
    if (allNew.length > 0) {
      setFiles(prev => [...prev, ...allNew]);
    }
    setError(null);
  }, [processRegularFiles, processExtractedFiles]);

  const submitZipPassword = useCallback(async (password: string) => {
    const zipFile = pendingZipFileRef.current;
    if (!zipFile) return;

    setIsProcessing(true);
    setError(null);

    try {
      const extracted = await extractZip(zipFile, { password });
      const processedFiles = processExtractedFiles(extracted);

      setFiles(prev => [...prev, ...processedFiles]);
      setNeedsPassword(false);
      pendingZipFileRef.current = null;
      pendingNonZipFilesRef.current = [];
    } catch {
      setError('암호가 올바르지 않거나 ZIP 파일을 읽을 수 없습니다');
    } finally {
      setIsProcessing(false);
    }
  }, [processExtractedFiles]);

  const cancelZipPassword = useCallback(() => {
    setNeedsPassword(false);
    pendingZipFileRef.current = null;
    pendingNonZipFilesRef.current = [];
  }, []);

  const removeFile = useCallback((id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  }, []);

  const removeFiles = useCallback((ids: string[]) => {
    const idSet = new Set(ids);
    setFiles(prev => prev.filter(f => !idSet.has(f.id)));
  }, []);

  const renameFile = useCallback((id: string, newName: string) => {
    // Strip path separators (forward + backslash) and null bytes — defense
    // against path-injection in case the rename ever flows to a server path.
    // eslint-disable-next-line no-control-regex
    const sanitized = newName.replace(/[/\\\x00]/g, '').trim();
    if (sanitized.length === 0) return;

    setFiles((prev) =>
      prev.map((f) => {
        if (f.id !== id) return f;
        const lastSlash = f.normalizedPath.lastIndexOf('/');
        const newPath =
          lastSlash >= 0
            ? f.normalizedPath.slice(0, lastSlash + 1) + sanitized
            : sanitized;
        return {
          ...f,
          normalizedName: sanitized,
          normalizedPath: newPath,
        };
      })
    );
  }, []);

  const clearFiles = useCallback(() => {
    setFiles([]);
    setError(null);
  }, []);

  const downloadAsZip = useCallback(async (zipFilename: string = 'files.zip', options: ZipOptions = {}) => {
    if (files.length === 0) {
      setError('No files to download');
      return;
    }

    setIsProcessing(true);
    setError(null);
    // Initialize progress immediately so the bar appears at 0/N as soon as
    // zipping begins. createZip's first onProgress callback overwrites this
    // with the post-filter total — slight transient mismatch is invisible to
    // users compared to the bar simply not appearing for small/fast zips.
    setProgress({ current: 0, total: files.length });

    try {
      const fileData: FileWithPath[] = files.map(f => ({
        file: f.file,
        path: f.path,
      }));

      const zipBlob = await createZip(fileData, {
        ...options,
        onProgress: (current, total) => setProgress({ current, total }),
      });

      // ZIP filename always normalized to NFC (user types on NFC keyboard;
      // the per-entry filenames inside the zip honor options.targetForm).
      const datePrefix = getDatePrefix();
      const finalFilename = datePrefix + normalizeFilename(zipFilename);

      downloadBlob(zipBlob, finalFilename);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create ZIP file');
    } finally {
      setIsProcessing(false);
      setProgress(null);
    }
  }, [files]);

  const downloadSingle = useCallback(() => {
    if (files.length !== 1) {
      setError('downloadSingle requires exactly one file');
      return;
    }

    const { file, normalizedName } = files[0];

    // Add date prefix to filename
    const datePrefix = getDatePrefix();
    const finalFilename = datePrefix + normalizedName;

    downloadSingleFile(file, finalFilename);
  }, [files]);

  return {
    files,
    isProcessing,
    error,
    folderName,
    needsPassword,
    progress,
    addFiles,
    removeFile,
    removeFiles,
    renameFile,
    clearFiles,
    downloadAsZip,
    downloadSingle,
    submitZipPassword,
    cancelZipPassword,
  };
}
