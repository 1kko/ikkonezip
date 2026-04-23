import { useState, useCallback, useMemo, useRef, type DragEvent } from 'react';
import { FileText, Trash2, AlertTriangle, Plus } from 'lucide-react';
import type { ProcessedFile } from '@/hooks/useFileProcessor';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileListRow } from './FileListRow';
import { FileListSearch } from './FileListSearch';
import { FolderSidebar } from './FolderSidebar';
import { FolderContents } from './FolderContents';
import { buildFileTree, findFolderNode } from '@/utils/buildFileTree';
import { formatFileSize } from '@/utils/formatFileSize';
import { cn } from '@/lib/utils';
import { extractFilesFromDataTransfer } from '@/utils/extractFilesFromDataTransfer';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';

interface FileListProps {
  files: ProcessedFile[];
  onRemoveFiles: (ids: string[]) => void;
  onRename: (id: string, newName: string) => void;
  onReorder: (fromId: string, toId: string) => void;
  /** Rename a folder by its full normalized path — propagates to every descendant file. */
  onRenameFolder?: (folderPath: string, newName: string) => void;
  /** Remove a folder and every descendant file by the folder's full normalized path. */
  onRemoveFolder?: (folderPath: string) => void;
  /** When provided, the file list area becomes a drop target and a "파일 추가" button appears. */
  onAddFiles?: (files: FileList | File[]) => void;
}

export function FileList({
  files,
  onRemoveFiles,
  onRename,
  onReorder,
  onRenameFolder,
  onRemoveFolder,
  onAddFiles,
}: FileListProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  const showSearch = files.length >= 50;
  const normalizedQuery = useMemo(
    () => searchQuery.trim().toLowerCase(),
    [searchQuery]
  );
  const searchActive = normalizedQuery.length > 0;
  const visibleFiles = useMemo(() => {
    if (!searchActive) return files;
    return files.filter((f) =>
      f.normalizedName.toLowerCase().includes(normalizedQuery)
    );
  }, [files, normalizedQuery, searchActive]);
  const visibleFileIds = useMemo(() => new Set(visibleFiles.map((f) => f.id)), [visibleFiles]);

  const hasFolders = useMemo(
    () => files.some((f) => f.normalizedPath.includes('/')),
    [files],
  );
  const tree = useMemo(() => buildFileTree(files), [files]);

  // Sidebar expand/collapse: folders are expanded by default; only explicitly
  // collapsed folders are tracked. New folders appear expanded.
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());
  const toggleExpand = useCallback((path: string) => {
    setCollapsedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const directChildren = useMemo(() => {
    if (selectedPath === null) return tree;
    const folder = findFolderNode(tree, selectedPath);
    return folder?.children ?? [];
  }, [tree, selectedPath]);

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

  // Folder rename: propagate the path change into selectedPath so the right
  // pane keeps showing the same folder under its new name.
  const handleRenameFolder = useCallback(
    (path: string, newName: string) => {
      onRenameFolder?.(path, newName);
      // eslint-disable-next-line no-control-regex
      const sanitized = newName.replace(/[/\\\x00]/g, '').trim();
      if (!sanitized) return;
      const lastSlash = path.lastIndexOf('/');
      const parentPrefix = lastSlash >= 0 ? path.slice(0, lastSlash + 1) : '';
      const newPath = parentPrefix + sanitized;
      if (newPath === path) return;
      setSelectedPath((prev) => {
        if (prev === null) return prev;
        if (prev === path) return newPath;
        if (prev.startsWith(path + '/')) return newPath + prev.slice(path.length);
        return prev;
      });
    },
    [onRenameFolder],
  );

  // Folder delete: if the currently-viewed folder is gone, jump to root.
  const handleRemoveFolder = useCallback(
    (path: string) => {
      onRemoveFolder?.(path);
      setSelectedPath((prev) => {
        if (prev === null) return prev;
        if (prev === path || prev.startsWith(path + '/')) return null;
        return prev;
      });
    },
    [onRemoveFolder],
  );

  // Flat-mode DnD wiring (stays identical to previous behavior).
  const flatSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const handleFlatDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    onReorder(String(active.id), String(over.id));
  }, [onReorder]);

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
    // Only clear when truly leaving the Card boundary, not when crossing a child.
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

  if (files.length === 0) {
    return null;
  }

  const totalSize = files.reduce((sum, f) => sum + f.size, 0);
  const filesNeedingNormalization = files.filter(f => f.needsNormalization).length;
  const allVisibleSelected = visibleFiles.length > 0 && visibleFiles.every(f => selectedIds.has(f.id));

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
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFilePicked}
          />
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
      </CardHeader>
      <CardContent className="pt-0">
        {showSearch && (
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <FileListSearch value={searchQuery} onChange={setSearchQuery} />
            {searchActive && (
              <Badge variant="secondary">
                검색 활성: {visibleFiles.length}개 표시
              </Badge>
            )}
          </div>
        )}
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
        {hasFolders ? (
          <div className="flex flex-col md:flex-row gap-4 pt-2">
            <aside className="md:w-64 md:flex-shrink-0 md:border-r md:pr-4">
              <ScrollArea className="max-h-72 md:max-h-96 custom-scrollbar pr-2">
                <FolderSidebar
                  tree={tree}
                  selectedPath={selectedPath}
                  collapsed={collapsedFolders}
                  onSelect={setSelectedPath}
                  onToggleCollapse={toggleExpand}
                  onRenameFolder={handleRenameFolder}
                  onRemoveFolder={handleRemoveFolder}
                />
              </ScrollArea>
            </aside>
            <ScrollArea className="flex-1 min-w-0 max-h-72 md:max-h-96 custom-scrollbar pr-3">
              <FolderContents
                selectedPath={selectedPath}
                directChildren={directChildren}
                searchActive={searchActive}
                searchResults={visibleFiles}
                selectedIds={selectedIds}
                visibleFileIds={visibleFileIds}
                onNavigate={setSelectedPath}
                onToggleSelect={toggleSelect}
                onRenameFile={onRename}
                onReorder={onReorder}
                onRemoveFolder={handleRemoveFolder}
              />
            </ScrollArea>
          </div>
        ) : (
          <ScrollArea className="max-h-72 custom-scrollbar pr-3">
            <div className="space-y-2">
              <DndContext
                sensors={flatSensors}
                collisionDetection={closestCenter}
                onDragEnd={handleFlatDragEnd}
              >
                <SortableContext
                  items={visibleFiles.map((f) => f.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {visibleFiles.map((file) => (
                    <FileListRow
                      key={file.id}
                      file={file}
                      selected={selectedIds.has(file.id)}
                      onToggleSelect={toggleSelect}
                      onRename={onRename}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
