import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, Folder, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { formatFileSize } from '@/utils/formatFileSize';
import { collectDescendantFiles, type TreeNode } from '@/utils/buildFileTree';
import { FileListRow } from './FileListRow';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';

interface FileTreeNodeProps {
  node: TreeNode;
  depth: number;
  collapsed: Set<string>;
  forceExpand: Set<string> | null;
  selectedIds: Set<string>;
  visibleFileIds: Set<string>;
  onToggleExpand: (path: string) => void;
  onToggleSelect: (id: string) => void;
  onToggleSelectMany: (ids: string[], select: boolean) => void;
  onRenameFile: (id: string, newName: string) => void;
  onRenameFolder: (path: string, newName: string) => void;
  onRemoveFolder: (path: string) => void;
}

export function FileTreeNode(props: FileTreeNodeProps) {
  if (props.node.kind === 'file') {
    return <FileNode {...props} node={props.node} />;
  }
  return <FolderNode {...props} node={props.node} />;
}

function FileNode(props: FileTreeNodeProps & { node: Extract<TreeNode, { kind: 'file' }> }) {
  const { node, depth, visibleFileIds, selectedIds, onToggleSelect, onRenameFile } = props;
  if (!visibleFileIds.has(node.id)) return null;
  return (
    <div style={{ paddingLeft: depth * 16 }}>
      <FileListRow
        file={node.file}
        selected={selectedIds.has(node.id)}
        onToggleSelect={onToggleSelect}
        onRename={onRenameFile}
      />
    </div>
  );
}

function FolderNode(props: FileTreeNodeProps & { node: Extract<TreeNode, { kind: 'folder' }> }) {
  const {
    node,
    depth,
    collapsed,
    forceExpand,
    selectedIds,
    visibleFileIds,
    onToggleExpand,
    onToggleSelectMany,
    onRenameFolder,
    onRemoveFolder,
  } = props;

  const descendantFiles = useMemo(() => collectDescendantFiles(node), [node]);
  const descendantIds = useMemo(() => descendantFiles.map((f) => f.id), [descendantFiles]);
  const hasVisibleDescendant = useMemo(
    () => descendantFiles.some((f) => visibleFileIds.has(f.id)),
    [descendantFiles, visibleFileIds],
  );

  const selectState: 'none' | 'all' | 'partial' = useMemo(() => {
    if (descendantIds.length === 0) return 'none';
    const selectedCount = descendantIds.filter((id) => selectedIds.has(id)).length;
    return selectedCount === 0 ? 'none' : selectedCount === descendantIds.length ? 'all' : 'partial';
  }, [descendantIds, selectedIds]);

  const checkboxRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (checkboxRef.current) checkboxRef.current.indeterminate = selectState === 'partial';
  }, [selectState]);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(node.name);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const commit = useCallback(() => {
    if (draft !== node.name) onRenameFolder(node.path, draft);
    setEditing(false);
  }, [draft, node.name, node.path, onRenameFolder]);
  const cancel = useCallback(() => {
    setDraft(node.name);
    setEditing(false);
  }, [node.name]);

  const handleCheckbox = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      e.stopPropagation();
      onToggleSelectMany(descendantIds, selectState !== 'all');
    },
    [descendantIds, selectState, onToggleSelectMany],
  );

  const fileChildIds = useMemo(
    () => node.children.filter((c): c is Extract<TreeNode, { kind: 'file' }> => c.kind === 'file').map((c) => c.id),
    [node.children],
  );

  if (!hasVisibleDescendant) return null;

  const totalSize = descendantFiles.reduce((sum, f) => sum + f.size, 0);
  const isExpanded = forceExpand ? forceExpand.has(node.path) : !collapsed.has(node.path);

  return (
    <div>
      <div
        style={{ paddingLeft: depth * 16 }}
        className="group flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-accent/40 transition-colors"
      >
        <button
          type="button"
          onClick={() => onToggleExpand(node.path)}
          aria-label={isExpanded ? '폴더 접기' : '폴더 펼치기'}
          aria-expanded={isExpanded}
          className="flex-shrink-0 p-0.5 rounded text-muted-foreground hover:text-foreground"
        >
          {isExpanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </button>
        <input
          ref={checkboxRef}
          type="checkbox"
          aria-label={`${node.name} 전체 선택`}
          checked={selectState === 'all'}
          onChange={handleCheckbox}
          onClick={(e) => e.stopPropagation()}
          className="flex-shrink-0 w-3.5 h-3.5 rounded border-input accent-primary cursor-pointer"
        />
        <Folder className="flex-shrink-0 w-4 h-4 text-amber-500" />
        {editing ? (
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
        ) : (
          <span
            className="flex-1 min-w-0 text-sm font-medium truncate cursor-text hover:bg-accent/40 rounded px-1 -mx-1"
            title={node.path}
            onClick={(e) => {
              e.stopPropagation();
              setDraft(node.name);
              setEditing(true);
            }}
          >
            {node.name}
          </span>
        )}
        <Badge variant="outline" className="flex-shrink-0 text-[10px] px-1.5 py-0">
          {descendantFiles.length}개
        </Badge>
        <span className="flex-shrink-0 text-xs text-muted-foreground font-mono">
          {formatFileSize(totalSize)}
        </span>
        <button
          type="button"
          aria-label={`${node.name} 폴더 삭제`}
          onClick={(e) => {
            e.stopPropagation();
            onRemoveFolder(node.path);
          }}
          className="flex-shrink-0 p-1 rounded text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10 transition"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      {isExpanded && (
        <SortableContext
          items={fileChildIds}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-1">
            {node.children.map((child) => (
              <FileTreeNode
                key={child.kind === 'folder' ? `folder:${child.path}` : `file:${child.id}`}
                {...props}
                node={child}
                depth={depth + 1}
              />
            ))}
          </div>
        </SortableContext>
      )}
    </div>
  );
}
