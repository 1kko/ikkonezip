import type { ProcessedFile } from '@/hooks/useFileProcessor';

export type TreeNode =
  | { kind: 'file'; id: string; file: ProcessedFile }
  | { kind: 'folder'; name: string; path: string; children: TreeNode[] };

/**
 * Derive a tree view from the flat file list, using each file's
 * `normalizedPath` as the hierarchy source. Input order is preserved within
 * each folder — the flat array still drives createZip, so DnD reordering
 * survives the round-trip.
 */
export function buildFileTree(files: ProcessedFile[]): TreeNode[] {
  const roots: TreeNode[] = [];
  const folderIndex = new Map<string, TreeNode & { kind: 'folder' }>();

  for (const file of files) {
    const segments = file.normalizedPath.split('/').filter(Boolean);
    if (segments.length <= 1) {
      roots.push({ kind: 'file', id: file.id, file });
      continue;
    }

    let parentList = roots;
    let accumulated = '';
    for (let i = 0; i < segments.length - 1; i++) {
      accumulated = accumulated ? `${accumulated}/${segments[i]}` : segments[i];
      let folder = folderIndex.get(accumulated);
      if (!folder) {
        folder = { kind: 'folder', name: segments[i], path: accumulated, children: [] };
        folderIndex.set(accumulated, folder);
        parentList.push(folder);
      }
      parentList = folder.children;
    }
    parentList.push({ kind: 'file', id: file.id, file });
  }

  return roots;
}

/** Collect every file descendant under a node (or array of nodes). */
export function collectDescendantFiles(node: TreeNode | TreeNode[]): ProcessedFile[] {
  const out: ProcessedFile[] = [];
  const stack: TreeNode[] = Array.isArray(node) ? [...node] : [node];
  while (stack.length > 0) {
    const n = stack.pop()!;
    if (n.kind === 'file') {
      out.push(n.file);
    } else {
      stack.push(...n.children);
    }
  }
  return out;
}

/**
 * Walk the tree to find a folder node at the given full path
 * (e.g. "root/sub"). Returns null if no folder matches.
 */
export function findFolderNode(
  tree: TreeNode[],
  path: string,
): Extract<TreeNode, { kind: 'folder' }> | null {
  if (!path) return null;
  const segments = path.split('/').filter(Boolean);
  let list: TreeNode[] = tree;
  let found: Extract<TreeNode, { kind: 'folder' }> | null = null;
  for (const seg of segments) {
    const next = list.find((n): n is Extract<TreeNode, { kind: 'folder' }> =>
      n.kind === 'folder' && n.name === seg,
    );
    if (!next) return null;
    found = next;
    list = next.children;
  }
  return found;
}

/** Every folder path inside the tree (used for default-expanded state). */
export function collectFolderPaths(nodes: TreeNode[]): string[] {
  const paths: string[] = [];
  const walk = (list: TreeNode[]) => {
    for (const n of list) {
      if (n.kind === 'folder') {
        paths.push(n.path);
        walk(n.children);
      }
    }
  };
  walk(nodes);
  return paths;
}
