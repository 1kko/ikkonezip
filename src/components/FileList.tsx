import { useState, useCallback, useMemo, useRef, useEffect, type DragEvent, type PointerEvent } from 'react';
import { FileText, Trash2, AlertTriangle, Plus, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import type { ProcessedFile } from '@/hooks/useFileProcessor';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileListRow } from './FileListRow';
import { FileListSearch } from './FileListSearch';
import { formatFileSize } from '@/utils/formatFileSize';
import { cn } from '@/lib/utils';
import { extractFilesFromDataTransfer } from '@/utils/extractFilesFromDataTransfer';

interface FileListProps {
  files: ProcessedFile[];
  onRemoveFiles: (ids: string[]) => void;
  onRename: (id: string, newName: string) => void;
  /** When provided, the file list area becomes a drop target and a "파일 추가" button appears. */
  onAddFiles?: (files: FileList | File[]) => void;
}

type SortKey = 'name' | 'size' | 'path';
type SortDirection = 'asc' | 'desc';
interface SortState {
  key: SortKey;
  direction: SortDirection;
}

interface ColumnWidths {
  name: number;
  size: number;
  path: number;
}
const DEFAULT_WIDTHS: ColumnWidths = { name: 320, size: 80, path: 220 };
const MIN_WIDTHS: ColumnWidths = { name: 120, size: 60, path: 80 };
// Grid column: [checkbox | name (incl. icon + filename) | size | path]
const CHECKBOX_COL = '20px';

function buildGridTemplate(widths: ColumnWidths): string {
  return `${CHECKBOX_COL} ${widths.name}px ${widths.size}px ${widths.path}px`;
}

function folderOf(normalizedPath: string): string {
  const i = normalizedPath.lastIndexOf('/');
  return i >= 0 ? normalizedPath.slice(0, i) : '';
}

function compareFiles(a: ProcessedFile, b: ProcessedFile, key: SortKey): number {
  switch (key) {
    case 'name':
      return a.normalizedName.localeCompare(b.normalizedName, 'ko');
    case 'size':
      return a.size - b.size;
    case 'path':
      return folderOf(a.normalizedPath).localeCompare(folderOf(b.normalizedPath), 'ko');
  }
}

export function FileList({ files, onRemoveFiles, onRename, onAddFiles }: FileListProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [sort, setSort] = useState<SortState | null>(null);
  const [widths, setWidths] = useState<ColumnWidths>(DEFAULT_WIDTHS);

  const showSearch = files.length >= 50;
  const normalizedQuery = useMemo(
    () => searchQuery.trim().toLowerCase(),
    [searchQuery]
  );
  const filteredFiles = useMemo(() => {
    if (normalizedQuery.length === 0) return files;
    return files.filter((f) =>
      f.normalizedName.toLowerCase().includes(normalizedQuery)
    );
  }, [files, normalizedQuery]);

  const visibleFiles = useMemo(() => {
    if (!sort) return filteredFiles;
    const dir = sort.direction === 'asc' ? 1 : -1;
    return [...filteredFiles].sort((a, b) => compareFiles(a, b, sort.key) * dir);
  }, [filteredFiles, sort]);

  const toggleSort = useCallback((key: SortKey) => {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, direction: 'asc' };
      return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
    });
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
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

  const resizingRef = useRef<{ key: keyof ColumnWidths; startX: number; startWidth: number } | null>(null);

  const startResize = useCallback((key: keyof ColumnWidths) => (e: PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    resizingRef.current = { key, startX: e.clientX, startWidth: widths[key] };
  }, [widths]);

  const handleResizeMove = useCallback((e: PointerEvent<HTMLDivElement>) => {
    const ctx = resizingRef.current;
    if (!ctx) return;
    const delta = e.clientX - ctx.startX;
    const next = Math.max(MIN_WIDTHS[ctx.key], ctx.startWidth + delta);
    setWidths((w) => (w[ctx.key] === next ? w : { ...w, [ctx.key]: next }));
  }, []);

  const endResize = useCallback((e: PointerEvent<HTMLDivElement>) => {
    const target = e.currentTarget as HTMLDivElement;
    if (target.hasPointerCapture(e.pointerId)) target.releasePointerCapture(e.pointerId);
    resizingRef.current = null;
  }, []);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const handleDropZoneDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    if (!onAddFiles) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  }, [onAddFiles]);

  const handleDropZoneDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    if (!onAddFiles) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDraggingOver(false);
  }, [onAddFiles]);

  const handleDropZoneDrop = useCallback(async (e: DragEvent<HTMLDivElement>) => {
    if (!onAddFiles) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    const files = await extractFilesFromDataTransfer(e.dataTransfer);
    if (files.length > 0) {
      onAddFiles(files);
    }
  }, [onAddFiles]);

  const handleAddClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFilePicked = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0 && onAddFiles) {
      onAddFiles(e.target.files);
      e.target.value = '';
    }
  }, [onAddFiles]);

  // While a resize is in progress, suppress text selection on the whole document.
  useEffect(() => {
    const before = document.body.style.userSelect;
    return () => {
      document.body.style.userSelect = before;
    };
  }, []);

  if (files.length === 0) {
    return null;
  }

  const totalSize = files.reduce((sum, f) => sum + f.size, 0);
  const filesNeedingNormalization = files.filter(f => f.needsNormalization).length;
  const allVisibleSelected = visibleFiles.length > 0 && visibleFiles.every(f => selectedIds.has(f.id));
  const gridTemplateColumns = buildGridTemplate(widths);

  return (
    <Card
      data-dropzone="filelist"
      className={cn(
        "animate-fadeIn relative",
        isDraggingOver && onAddFiles && "ring-2 ring-primary ring-offset-2"
      )}
      onDragOver={handleDropZoneDragOver}
      onDragLeave={handleDropZoneDragLeave}
      onDrop={handleDropZoneDrop}
    >
      {isDraggingOver && onAddFiles && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-primary/10 backdrop-blur-sm">
          <span className="text-lg font-semibold text-primary">여기에 놓아 추가</span>
        </div>
      )}
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
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
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFilePicked}
          />
          <div className="flex items-center gap-2 ml-auto">
            {onAddFiles && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddClick}
                className="gap-1.5"
              >
                <Plus className="h-4 w-4" />
                파일 추가
              </Button>
            )}
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
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {showSearch && (
          <div className="flex items-center justify-end gap-3 px-4 py-3">
            {normalizedQuery.length > 0 && (
              <Badge variant="secondary">
                검색 활성: {visibleFiles.length}개 표시
              </Badge>
            )}
            <FileListSearch value={searchQuery} onChange={setSearchQuery} />
          </div>
        )}
        {/* Header row + resize handles */}
        <div
          role="row"
          style={{ gridTemplateColumns }}
          className="grid items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground select-none"
        >
          <input
            type="checkbox"
            aria-label="전체 선택"
            checked={allVisibleSelected}
            onChange={toggleSelectAll}
            className="w-3.5 h-3.5 rounded border-input accent-primary cursor-pointer"
          />
          <HeaderCell
            label="이름"
            active={sort?.key === 'name'}
            direction={sort?.key === 'name' ? sort.direction : null}
            onClick={() => toggleSort('name')}
            onResize={startResize('name')}
            onResizeMove={handleResizeMove}
            onResizeEnd={endResize}
          />
          <HeaderCell
            label="크기"
            active={sort?.key === 'size'}
            direction={sort?.key === 'size' ? sort.direction : null}
            onClick={() => toggleSort('size')}
            align="right"
            onResize={startResize('size')}
            onResizeMove={handleResizeMove}
            onResizeEnd={endResize}
          />
          <HeaderCell
            label="경로"
            active={sort?.key === 'path'}
            direction={sort?.key === 'path' ? sort.direction : null}
            onClick={() => toggleSort('path')}
            onResize={startResize('path')}
            onResizeMove={handleResizeMove}
            onResizeEnd={endResize}
            isLast
          />
        </div>
        <ScrollArea className="max-h-72 custom-scrollbar pr-3">
          <div className="space-y-2">
            {visibleFiles.map((file) => (
              <FileListRow
                key={file.id}
                file={file}
                selected={selectedIds.has(file.id)}
                onToggleSelect={toggleSelect}
                onRename={onRename}
                gridTemplateColumns={gridTemplateColumns}
              />
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

interface HeaderCellProps {
  label: string;
  active: boolean;
  direction: SortDirection | null;
  onClick: () => void;
  onResize: (e: PointerEvent<HTMLDivElement>) => void;
  onResizeMove: (e: PointerEvent<HTMLDivElement>) => void;
  onResizeEnd: (e: PointerEvent<HTMLDivElement>) => void;
  align?: 'left' | 'right';
  /** Last column: no resize handle. */
  isLast?: boolean;
}

function HeaderCell({
  label,
  active,
  direction,
  onClick,
  onResize,
  onResizeMove,
  onResizeEnd,
  align = 'left',
  isLast,
}: HeaderCellProps) {
  return (
    <div className="relative flex items-center min-w-0">
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "flex items-center gap-1 w-full hover:text-foreground transition-colors",
          align === 'right' && "justify-end"
        )}
      >
        <span className="truncate">{label}</span>
        {active && direction === 'asc' && <ChevronUp className="w-3 h-3" />}
        {active && direction === 'desc' && <ChevronDown className="w-3 h-3" />}
        {!active && <ChevronsUpDown className="w-3 h-3 opacity-40" />}
      </button>
      {!isLast && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label={`${label} 컬럼 너비 조절`}
          onPointerDown={onResize}
          onPointerMove={onResizeMove}
          onPointerUp={onResizeEnd}
          onPointerCancel={onResizeEnd}
          className="absolute -right-1 top-0 h-full w-2 cursor-col-resize flex items-center justify-center group/resize"
        >
          <div className="w-px h-3 bg-border group-hover/resize:bg-primary transition-colors" />
        </div>
      )}
    </div>
  );
}
