import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, Folder, FolderRoot, Pencil, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { collectDescendantFiles, type TreeNode } from '@/utils/buildFileTree';

interface FolderSidebarProps {
  tree: TreeNode[];
  selectedPath: string | null;
  collapsed: Set<string>;
  onSelect: (path: string | null) => void;
  onToggleCollapse: (path: string) => void;
  onRenameFolder: (path: string, newName: string) => void;
  onRemoveFolder: (path: string) => void;
}

export function FolderSidebar({
  tree,
  selectedPath,
  collapsed,
  onSelect,
  onToggleCollapse,
  onRenameFolder,
  onRemoveFolder,
}: FolderSidebarProps) {
  const folderNodes = tree.filter(
    (n): n is Extract<TreeNode, { kind: 'folder' }> => n.kind === 'folder',
  );
  const looseRootFiles = tree.filter((n) => n.kind === 'file').length;

  return (
    <nav aria-label="폴더 구조" className="text-sm">
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={cn(
          'w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-accent transition-colors',
          selectedPath === null && 'bg-accent text-accent-foreground',
        )}
      >
        <FolderRoot className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        <span className="flex-1 text-left truncate">루트</span>
        {looseRootFiles > 0 && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            {looseRootFiles}
          </Badge>
        )}
      </button>
      <div className="mt-1 space-y-0.5">
        {folderNodes.map((node) => (
          <SidebarFolderNode
            key={node.path}
            node={node}
            depth={0}
            selectedPath={selectedPath}
            collapsed={collapsed}
            onSelect={onSelect}
            onToggleCollapse={onToggleCollapse}
            onRenameFolder={onRenameFolder}
            onRemoveFolder={onRemoveFolder}
          />
        ))}
      </div>
    </nav>
  );
}

interface SidebarFolderNodeProps {
  node: Extract<TreeNode, { kind: 'folder' }>;
  depth: number;
  selectedPath: string | null;
  collapsed: Set<string>;
  onSelect: (path: string | null) => void;
  onToggleCollapse: (path: string) => void;
  onRenameFolder: (path: string, newName: string) => void;
  onRemoveFolder: (path: string) => void;
}

function SidebarFolderNode(props: SidebarFolderNodeProps) {
  const {
    node,
    depth,
    selectedPath,
    collapsed,
    onSelect,
    onToggleCollapse,
    onRenameFolder,
    onRemoveFolder,
  } = props;

  const isSelected = selectedPath === node.path;
  const isExpanded = !collapsed.has(node.path);
  const folderChildren = useMemo(
    () =>
      node.children.filter(
        (c): c is Extract<TreeNode, { kind: 'folder' }> => c.kind === 'folder',
      ),
    [node.children],
  );
  const descendantFileCount = useMemo(
    () => collectDescendantFiles(node).length,
    [node],
  );

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

  return (
    <div>
      <div
        className={cn(
          'group flex items-center gap-1 px-1 py-1 rounded-lg hover:bg-accent/60 transition-colors',
          isSelected && 'bg-accent text-accent-foreground',
        )}
        style={{ paddingLeft: depth * 12 + 4 }}
      >
        {folderChildren.length > 0 ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleCollapse(node.path);
            }}
            aria-label={isExpanded ? '하위 폴더 접기' : '하위 폴더 펼치기'}
            aria-expanded={isExpanded}
            className="flex-shrink-0 p-0.5 rounded text-muted-foreground hover:text-foreground"
          >
            {isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
          </button>
        ) : (
          <span className="flex-shrink-0 w-4" aria-hidden="true" />
        )}
        <button
          type="button"
          onClick={() => onSelect(node.path)}
          className="flex-1 min-w-0 flex items-center gap-1.5 text-left"
        >
          <Folder className="w-4 h-4 text-amber-500 flex-shrink-0" />
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
            <span className="flex-1 min-w-0 truncate" title={node.path}>
              {node.name}
            </span>
          )}
        </button>
        <Badge variant="outline" className="flex-shrink-0 text-[10px] px-1 py-0">
          {descendantFileCount}
        </Badge>
        {!editing && (
          <div className="flex-shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
            <button
              type="button"
              aria-label={`${node.name} 폴더 이름 바꾸기`}
              onClick={(e) => {
                e.stopPropagation();
                setDraft(node.name);
                setEditing(true);
              }}
              className="p-0.5 rounded text-muted-foreground hover:text-foreground"
            >
              <Pencil className="w-3 h-3" />
            </button>
            <button
              type="button"
              aria-label={`${node.name} 폴더 삭제`}
              onClick={(e) => {
                e.stopPropagation();
                onRemoveFolder(node.path);
              }}
              className="p-0.5 rounded text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
      {isExpanded && folderChildren.length > 0 && (
        <div className="space-y-0.5">
          {folderChildren.map((child) => (
            <SidebarFolderNode
              key={child.path}
              {...props}
              node={child}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
