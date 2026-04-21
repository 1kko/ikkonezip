import { useState, useCallback, useMemo } from 'react';
import { FileText, Trash2, AlertTriangle } from 'lucide-react';
import type { ProcessedFile } from '@/hooks/useFileProcessor';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileListRow } from './FileListRow';
import { FileListSearch } from './FileListSearch';
import { formatFileSize } from '@/utils/formatFileSize';

interface FileListProps {
  files: ProcessedFile[];
  onRemoveFiles: (ids: string[]) => void;
  onRename: (id: string, newName: string) => void;
}

export function FileList({ files, onRemoveFiles, onRename }: FileListProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  const showSearch = files.length >= 50;
  const normalizedQuery = useMemo(
    () => searchQuery.trim().toLowerCase(),
    [searchQuery]
  );
  const visibleFiles = useMemo(() => {
    if (normalizedQuery.length === 0) return files;
    return files.filter((f) =>
      f.normalizedName.toLowerCase().includes(normalizedQuery)
    );
  }, [files, normalizedQuery]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds(prev => {
      const visibleIds = visibleFiles.map((f) => f.id);
      const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => prev.has(id));
      const next = new Set(prev);
      if (allVisibleSelected) {
        for (const id of visibleIds) next.delete(id);
      } else {
        for (const id of visibleIds) next.add(id);
      }
      return next;
    });
  }, [visibleFiles]);

  const handleRemoveSelected = useCallback(() => {
    if (selectedIds.size === 0) return;
    onRemoveFiles(Array.from(selectedIds));
    setSelectedIds(new Set());
  }, [selectedIds, onRemoveFiles]);

  if (files.length === 0) {
    return null;
  }

  const totalSize = files.reduce((sum, f) => sum + f.size, 0);
  const filesNeedingNormalization = files.filter(f => f.needsNormalization).length;
  const allVisibleSelected = visibleFiles.length > 0 && visibleFiles.every(f => selectedIds.has(f.id));

  return (
    <Card className="animate-fadeIn">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="gap-1.5">
              <FileText className="w-3 h-3" />
              {files.length}개 파일
            </Badge>
            <Badge variant="outline" className="text-muted-foreground">
              {formatFileSize(totalSize)}
            </Badge>
            {filesNeedingNormalization > 0 && (
              <Badge variant="warning" className="gap-1">
                <AlertTriangle className="w-3 h-3" />
                {filesNeedingNormalization}개 정규화 필요
              </Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRemoveSelected}
            disabled={selectedIds.size === 0}
            className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5"
          >
            <Trash2 className="w-4 h-4" />
            선택 삭제
            {selectedIds.size > 0 && (
              <span className="ml-0.5 text-xs">({selectedIds.size})</span>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {showSearch && (
          <div className="flex items-center justify-between gap-3 px-4 pt-3">
            <FileListSearch value={searchQuery} onChange={setSearchQuery} />
            {normalizedQuery.length > 0 && (
              <Badge variant="secondary">
                검색 활성: {visibleFiles.length}개 표시
              </Badge>
            )}
          </div>
        )}
        <ScrollArea className="max-h-72 custom-scrollbar pr-2">
          <div className="space-y-2">
            <label className="flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
              <input
                type="checkbox"
                aria-label="전체 선택"
                checked={allVisibleSelected}
                onChange={toggleSelectAll}
                className="w-3.5 h-3.5 rounded border-input accent-primary cursor-pointer"
              />
              전체 선택
            </label>
            {visibleFiles.map((file) => (
              <FileListRow
                key={file.id}
                file={file}
                selected={selectedIds.has(file.id)}
                onToggleSelect={toggleSelect}
                onRename={onRename}
              />
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
