import type { ProcessedFile } from '@/hooks/useFileProcessor';

interface FileListRowFilenameProps {
  file: ProcessedFile;
}

export function FileListRowFilename({ file }: FileListRowFilenameProps) {
  return (
    <span className="flex-1 min-w-0 text-sm truncate" title={file.path}>
      {file.path}
    </span>
  );
}
