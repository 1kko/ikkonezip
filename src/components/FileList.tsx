import { useState, useCallback, useMemo, useRef, type DragEvent } from 'react';
import { FileText, Trash2, AlertTriangle, Plus } from 'lucide-react';
import type { ProcessedFile } from '@/hooks/useFileProcessor';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileListRow } from './FileListRow';
import { FileListSearch } from './FileListSearch';
import { FileTreeNode } from './FileTreeNode';
import { buildFileTree } from '@/utils/buildFileTree';
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

export function FileList({ files, onRemoveFiles, onRename, onReorder, onRenameFolder, onRemoveFolder, onAddFiles }: FileListProps) {
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
  const visibleFileIds = useMemo(() => new Set(visibleFiles.map((f) => f.id)), [visibleFiles]);

  const hasFolders = useMemo(
    () => files.some((f) => f.normalizedPath.includes('/')),
    [files],
  );
  const tree = useMemo(() => buildFileTree(files), [files]);

  // Folders are expanded by default; only explicitly collapsed folders are
  // tracked. New folders that appear after a rename or upload are expanded
  // automatically because their paths aren't in this set.
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());
  const toggleExpand = useCallback((path: string) => {
    setCollapsedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  // During search, force every folder that contains a match to be open.
  const forceExpand = useMemo(() => {
    if (normalizedQuery.length === 0) return null;
    const paths = new Set<string>();
    for (const f of visibleFiles) {
      const parts = f.normalizedPath.split('/');
      let acc = '';
      for (let i = 0; i < parts.length - 1; i++) {
        acc = acc ? `${acc}/${parts[i]}` : parts[i];
        paths.add(acc);
      }
    }
    return paths;
  }, [normalizedQuery, visibleFiles]);

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

  const toggleSelectMany = useCallback((ids: string[], select: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (select) next.add(id);
        else next.delete(id);
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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    if (hasFolders) {
      // In tree mode, only reorder within the same parent folder. Cross-folder
      // drag is out of scope for this iteration.
      const fromPath = files.find((f) => f.id === active.id)?.normalizedPath;
      const toPath = files.find((f) => f.id === over.id)?.normalizedPath;
      if (!fromPath || !toPath) return;
      const fromParent = fromPath.slice(0, fromPath.lastIndexOf('/'));
      const toParent = toPath.slice(0, toPath.lastIndexOf('/'));
      if (fromParent !== toParent) return;
    }
    onReorder(String(active.id), String(over.id));
  }, [onReorder, hasFolders, files]);

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
            {normalizedQuery.length > 0 && (
              <Badge variant="secondary">
                검색 활성: {visibleFiles.length}개 표시
              </Badge>
            )}
          </div>
        )}
        <ScrollArea className="max-h-72 custom-scrollbar pr-3">
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
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              {hasFolders ? (
                <SortableContext
                  items={tree.filter((n) => n.kind === 'file').map((n) => (n.kind === 'file' ? n.id : ''))}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-1">
                    {tree.map((node) => (
                      <FileTreeNode
                        key={node.kind === 'folder' ? `folder:${node.path}` : `file:${node.id}`}
                        node={node}
                        depth={0}
                        collapsed={collapsedFolders}
                        forceExpand={forceExpand}
                        selectedIds={selectedIds}
                        visibleFileIds={visibleFileIds}
                        onToggleExpand={toggleExpand}
                        onToggleSelect={toggleSelect}
                        onToggleSelectMany={toggleSelectMany}
                        onRenameFile={onRename}
                        onRenameFolder={onRenameFolder ?? (() => {})}
                        onRemoveFolder={onRemoveFolder ?? (() => {})}
                      />
                    ))}
                  </div>
                </SortableContext>
              ) : (
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
              )}
            </DndContext>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
