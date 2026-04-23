import { Badge } from '@/components/ui/badge';
import type { ProcessedFile } from '@/hooks/useFileProcessor';
import { FileListRowFilename } from './FileListRowFilename';
import { FileListRowMeta } from './FileListRowMeta';
import { formatFileSize } from '@/utils/formatFileSize';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { DragHandle } from './DragHandle';
import type React from 'react';

interface FileListRowProps {
  file: ProcessedFile;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onRename: (id: string, newName: string) => void;
}

export function FileListRow({ file, selected, onToggleSelect, onRename }: FileListRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: file.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
  };

  const lastSlash = file.normalizedPath.lastIndexOf('/');
  const folderPath = lastSlash >= 0 ? file.normalizedPath.slice(0, lastSlash) : '';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group flex items-center gap-2 px-3 py-2 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
      title={file.path}
      onClick={() => onToggleSelect(file.id)}
    >
      <DragHandle
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
      />
      <input
        type="checkbox"
        checked={selected}
        onChange={() => onToggleSelect(file.id)}
        onClick={(e) => e.stopPropagation()}
        className="flex-shrink-0 w-3.5 h-3.5 rounded border-input accent-primary cursor-pointer"
      />
      <FileListRowMeta file={file} />
      <FileListRowFilename file={file} onRename={onRename} />
      {folderPath && (
        <span
          className="hidden sm:inline flex-shrink min-w-0 max-w-[40%] text-xs text-muted-foreground truncate font-mono"
          title={folderPath}
        >
          {folderPath}
        </span>
      )}
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
