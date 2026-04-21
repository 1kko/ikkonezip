import { Badge } from '@/components/ui/badge';
import type { ProcessedFile } from '@/hooks/useFileProcessor';
import { FileListRowFilename } from './FileListRowFilename';
import { FileListRowMeta } from './FileListRowMeta';
import { formatFileSize } from '@/utils/formatFileSize';

interface FileListRowProps {
  file: ProcessedFile;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onRename: (id: string, newName: string) => void;
}

export function FileListRow({ file, selected, onToggleSelect, onRename }: FileListRowProps) {
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
      <FileListRowFilename file={file} onRename={onRename} />
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
