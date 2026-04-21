import { useState, useEffect, useRef, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import type { ProcessedFile } from '@/hooks/useFileProcessor';

interface FileListRowFilenameProps {
  file: ProcessedFile;
  onRename: (id: string, newName: string) => void;
}

export function FileListRowFilename({ file, onRename }: FileListRowFilenameProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(file.normalizedName);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus and select input when entering edit mode
  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const commit = useCallback(() => {
    if (draft !== file.normalizedName) {
      onRename(file.id, draft);
    }
    setEditing(false);
  }, [draft, file.id, file.normalizedName, onRename]);

  const cancel = useCallback(() => {
    setDraft(file.normalizedName);
    setEditing(false);
  }, [file.normalizedName]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLSpanElement>) => {
    e.stopPropagation();
    setDraft(file.normalizedName);
    setEditing(true);
  }, [file.normalizedName]);

  if (editing) {
    return (
      <Input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          else if (e.key === 'Escape') cancel();
        }}
        onBlur={commit}
        onClick={(e) => e.stopPropagation()}
        className="flex-1 min-w-0 h-6 px-2 py-0 text-sm"
      />
    );
  }

  return (
    <span
      className="flex-1 min-w-0 text-sm truncate cursor-text hover:bg-accent/30 rounded px-1 -mx-1"
      title={file.path}
      onClick={handleClick}
    >
      {file.normalizedName}
    </span>
  );
}
