import { Badge } from '@/components/ui/badge';
import type { ProcessedFile } from '@/hooks/useFileProcessor';
import { FileListRowFilename } from './FileListRowFilename';
import { FileListRowMeta } from './FileListRowMeta';

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

interface FileListRowProps {
  file: ProcessedFile;
  selected: boolean;
  onToggleSelect: (id: string) => void;
}

export function FileListRow({ file, selected, onToggleSelect }: FileListRowProps) {
  return (
    <div
      className="group flex items-center gap-2 px-3 py-2 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
      title={file.path}
      onClick={() => onToggleSelect(file.id)}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={() => onToggleSelect(file.id)}
        onClick={(e) => e.stopPropagation()}
        className="flex-shrink-0 w-3.5 h-3.5 rounded border-input accent-primary cursor-pointer"
      />
      <FileListRowMeta file={file} />
      <FileListRowFilename file={file} />
      {file.needsNormalization && (
        <Badge variant="warning" className="flex-shrink-0 text-[10px] px-1.5 py-0">
          NFD
        </Badge>
      )}
      <span className="flex-shrink-0 text-xs text-muted-foreground font-mono">
        {formatFileSize(file.size)}
      </span>
    </div>
  );
}
