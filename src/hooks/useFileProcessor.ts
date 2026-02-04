import { useState, useCallback, useMemo } from 'react';
import { normalizeFilename, needsNormalization } from '@/utils/normalizeFilename';
import { createZip, downloadBlob, downloadSingleFile, getRootFolderName, getDatePrefix, type FileWithPath, type ZipOptions } from '@/utils/zipFiles';

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
  addFiles: (fileList: FileList | File[]) => void;
  removeFile: (id: string) => void;
  clearFiles: () => void;
  downloadAsZip: (zipFilename?: string, options?: ZipOptions) => Promise<void>;
  downloadSingle: () => void;
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

  // Detect folder name from uploaded files
  const folderName = useMemo(() => {
    if (files.length === 0) return null;
    const fileData: FileWithPath[] = files.map(f => ({ file: f.file, path: f.path }));
    return getRootFolderName(fileData);
  }, [files]);

  const addFiles = useCallback((fileList: FileList | File[]) => {
    const newFiles: ProcessedFile[] = [];

    for (const file of Array.from(fileList)) {
      // Skip excluded files (like .DS_Store)
      if (shouldExclude(file.name)) {
        continue;
      }

      // Handle files from directory upload (webkitRelativePath) or regular upload
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

    setFiles(prev => [...prev, ...newFiles]);
    setError(null);
  }, []);

  const removeFile = useCallback((id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
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

    try {
      const fileData: FileWithPath[] = files.map(f => ({
        file: f.file,
        path: f.path,
      }));

      const zipBlob = await createZip(fileData, options);

      // Add date prefix to filename
      const datePrefix = getDatePrefix();
      const finalFilename = datePrefix + normalizeFilename(zipFilename);

      downloadBlob(zipBlob, finalFilename);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create ZIP file');
    } finally {
      setIsProcessing(false);
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
    addFiles,
    removeFile,
    clearFiles,
    downloadAsZip,
    downloadSingle,
  };
}
