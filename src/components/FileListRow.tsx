import type { CSSProperties } from 'react';
import type { ProcessedFile } from '@/hooks/useFileProcessor';
import { FileListRowFilename } from './FileListRowFilename';
import { FileListRowMeta } from './FileListRowMeta';
import { formatFileSize } from '@/utils/formatFileSize';

interface FileListRowProps {
  file: ProcessedFile;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onRename: (id: string, newName: string) => void;
  /** Grid template passed from the parent so rows align with the header. */
  gridTemplateColumns: string;
}

export function FileListRow({
  file,
  selected,
  onToggleSelect,
  onRename,
  gridTemplateColumns,
}: FileListRowProps) {
  const lastSlash = file.normalizedPath.lastIndexOf('/');
  const folderPath = lastSlash >= 0 ? file.normalizedPath.slice(0, lastSlash) : '';

  const style: CSSProperties = { gridTemplateColumns };

  return (
    <div
      style={style}
      className="group grid items-center gap-2 px-3 py-2 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
      title={file.path}
      onClick={() => onToggleSelect(file.id)}
    >
      <input
        type="checkbox"
        aria-label={`${file.normalizedName} 선택`}
        checked={selected}
        onChange={() => onToggleSelect(file.id)}
        onClick={(e) => e.stopPropagation()}
        className="flex-shrink-0 w-3.5 h-3.5 rounded border-input accent-primary cursor-pointer"
      />
      <div className="flex items-center gap-2 min-w-0">
        <FileListRowMeta file={file} />
        <FileListRowFilename file={file} onRename={onRename} />
        {file.needsNormalization && (
          <span
            aria-label="NFD (정규화 필요)"
            title="NFD (정규화 필요)"
            className="flex-shrink-0 w-2 h-2 rounded-full bg-amber-500"
          />
        )}
      </div>
      <div className="min-w-0 text-right">
        <span className="text-xs text-muted-foreground font-mono">
          {formatFileSize(file.size)}
        </span>
      </div>
      <div className="min-w-0" title={folderPath}>
        <span className="block text-xs text-muted-foreground truncate font-mono">
          {folderPath || '—'}
        </span>
      </div>
    </div>
  );
}
