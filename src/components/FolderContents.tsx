import { useMemo } from 'react';
import { ChevronRight, Folder, Home, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { collectDescendantFiles, type TreeNode } from '@/utils/buildFileTree';
import { formatFileSize } from '@/utils/formatFileSize';
import type { ProcessedFile } from '@/hooks/useFileProcessor';
import { FileListRow } from './FileListRow';
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

interface FolderContentsProps {
  selectedPath: string | null;
  directChildren: TreeNode[];
  /** When a search query is active, show flat results and skip breadcrumb navigation. */
  searchActive: boolean;
  searchResults: ProcessedFile[];
  selectedIds: Set<string>;
  visibleFileIds: Set<string>;
  onNavigate: (path: string | null) => void;
  onToggleSelect: (id: string) => void;
  onRenameFile: (id: string, newName: string) => void;
  onReorder: (fromId: string, toId: string) => void;
  onRemoveFolder: (path: string) => void;
}

export function FolderContents({
  selectedPath,
  directChildren,
  searchActive,
  searchResults,
  selectedIds,
  visibleFileIds,
  onNavigate,
  onToggleSelect,
  onRenameFile,
  onReorder,
  onRemoveFolder,
}: FolderContentsProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    onReorder(String(active.id), String(over.id));
  };

  const visibleDirectChildren = useMemo(() => {
    if (searchActive) return [];
    return directChildren.filter((child) => {
      if (child.kind === 'file') return visibleFileIds.has(child.id);
      return collectDescendantFiles(child).some((f) => visibleFileIds.has(f.id));
    });
  }, [directChildren, searchActive, visibleFileIds]);

  const sortableIds = searchActive
    ? searchResults.map((f) => f.id)
    : visibleDirectChildren
        .filter((c) => c.kind === 'file')
        .map((c) => (c.kind === 'file' ? c.id : ''));

  const breadcrumbs = useMemo(() => {
    if (!selectedPath) return [];
    const segments = selectedPath.split('/');
    return segments.map((name, i) => ({
      name,
      path: segments.slice(0, i + 1).join('/'),
    }));
  }, [selectedPath]);

  return (
    <div className="flex-1 min-w-0">
      {!searchActive && (
        <div className="flex items-center gap-2 px-1 pb-3 text-sm">
          <button
            type="button"
            onClick={() => onNavigate(null)}
            className={cn(
              'flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-accent transition-colors',
              selectedPath === null && 'text-foreground font-medium',
              selectedPath !== null && 'text-muted-foreground',
            )}
          >
            <Home className="w-3.5 h-3.5" />
            <span>루트</span>
          </button>
          {breadcrumbs.map((crumb, i) => {
            const isLast = i === breadcrumbs.length - 1;
            return (
              <div key={crumb.path} className="flex items-center gap-2">
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                <button
                  type="button"
                  onClick={() => onNavigate(crumb.path)}
                  className={cn(
                    'px-1.5 py-0.5 rounded hover:bg-accent transition-colors truncate max-w-[180px]',
                    isLast ? 'text-foreground font-medium' : 'text-muted-foreground',
                  )}
                  title={crumb.path}
                >
                  {crumb.name}
                </button>
              </div>
            );
          })}
          {selectedPath && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onRemoveFolder(selectedPath)}
              className="ml-auto gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="w-3.5 h-3.5" />
              폴더 삭제
            </Button>
          )}
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {searchActive ? (
              searchResults.length === 0 ? (
                <EmptyState message="검색 결과가 없습니다" />
              ) : (
                searchResults.map((file) => (
                  <FileListRow
                    key={file.id}
                    file={{
                      id: file.id,
                      file: file.file,
                      originalName: file.originalName,
                      normalizedName: file.normalizedName,
                      path: file.path,
                      normalizedPath: file.normalizedPath,
                      needsNormalization: file.needsNormalization,
                      size: file.size,
                    }}
                    selected={selectedIds.has(file.id)}
                    onToggleSelect={onToggleSelect}
                    onRename={onRenameFile}
                  />
                ))
              )
            ) : visibleDirectChildren.length === 0 ? (
              <EmptyState message="이 폴더는 비어있습니다" />
            ) : (
              visibleDirectChildren.map((child) =>
                child.kind === 'folder' ? (
                  <SubfolderRow
                    key={`folder:${child.path}`}
                    node={child}
                    onEnter={() => onNavigate(child.path)}
                  />
                ) : (
                  <FileListRow
                    key={child.id}
                    file={child.file}
                    selected={selectedIds.has(child.id)}
                    onToggleSelect={onToggleSelect}
                    onRename={onRenameFile}
                  />
                ),
              )
            )}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function SubfolderRow({
  node,
  onEnter,
}: {
  node: Extract<TreeNode, { kind: 'folder' }>;
  onEnter: () => void;
}) {
  const files = useMemo(() => collectDescendantFiles(node), [node]);
  const totalSize = files.reduce((sum, f) => sum + f.size, 0);

  return (
    <button
      type="button"
      onClick={onEnter}
      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer text-left"
      title={node.path}
    >
      <Folder className="flex-shrink-0 w-4 h-4 text-amber-500" />
      <span className="flex-1 min-w-0 text-sm font-medium truncate">{node.name}</span>
      <Badge variant="outline" className="flex-shrink-0 text-[10px] px-1.5 py-0">
        {files.length}개
      </Badge>
      <span className="flex-shrink-0 text-xs text-muted-foreground font-mono">
        {formatFileSize(totalSize)}
      </span>
      <ChevronRight className="flex-shrink-0 w-4 h-4 text-muted-foreground" />
    </button>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="py-10 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}
