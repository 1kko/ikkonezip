import { describe, it, expect } from 'vitest';
import { buildFileTree, collectDescendantFiles, collectFolderPaths, type TreeNode } from './buildFileTree';
import type { ProcessedFile } from '@/hooks/useFileProcessor';

function makeFile(id: string, normalizedPath: string, normalizedName?: string): ProcessedFile {
  const name = normalizedName ?? normalizedPath.split('/').pop()!;
  return {
    id,
    file: new File(['x'], name, { type: 'text/plain' }),
    originalName: name,
    normalizedName: name,
    path: normalizedPath,
    normalizedPath,
    needsNormalization: false,
    size: 1,
  };
}

describe('buildFileTree', () => {
  it('returns an empty array for no files', () => {
    expect(buildFileTree([])).toEqual([]);
  });

  it('renders a single flat file as a file node', () => {
    const tree = buildFileTree([makeFile('a', 'a.txt')]);
    expect(tree).toHaveLength(1);
    expect(tree[0].kind).toBe('file');
    if (tree[0].kind === 'file') {
      expect(tree[0].id).toBe('a');
    }
  });

  it('creates nested folder chain from a single deep path', () => {
    const tree = buildFileTree([makeFile('a', 'root/sub/deep.txt')]);
    expect(tree).toHaveLength(1);
    expect(tree[0].kind).toBe('folder');
    if (tree[0].kind !== 'folder') return;
    expect(tree[0].name).toBe('root');
    expect(tree[0].path).toBe('root');
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children[0].kind).toBe('folder');
    if (tree[0].children[0].kind !== 'folder') return;
    expect(tree[0].children[0].name).toBe('sub');
    expect(tree[0].children[0].path).toBe('root/sub');
    expect(tree[0].children[0].children).toHaveLength(1);
    expect(tree[0].children[0].children[0].kind).toBe('file');
  });

  it('shares folder nodes across siblings with a common prefix', () => {
    const tree = buildFileTree([
      makeFile('a', 'root/a.txt'),
      makeFile('b', 'root/b.txt'),
    ]);
    expect(tree).toHaveLength(1);
    expect(tree[0].kind).toBe('folder');
    if (tree[0].kind !== 'folder') return;
    expect(tree[0].children).toHaveLength(2);
    expect(tree[0].children.every((n) => n.kind === 'file')).toBe(true);
  });

  it('supports multiple top-level roots', () => {
    const tree = buildFileTree([
      makeFile('a', 'alpha/a.txt'),
      makeFile('b', 'beta/b.txt'),
      makeFile('c', 'loose.txt'),
    ]);
    expect(tree).toHaveLength(3);
    expect(tree.map((n) => (n.kind === 'folder' ? n.name : n.file.normalizedName)))
      .toEqual(['alpha', 'beta', 'loose.txt']);
  });

  it('preserves insertion order inside each folder', () => {
    const tree = buildFileTree([
      makeFile('z', 'root/z.txt'),
      makeFile('a', 'root/a.txt'),
      makeFile('m', 'root/m.txt'),
    ]);
    if (tree[0].kind !== 'folder') throw new Error('expected folder');
    const ids = tree[0].children.map((n) => (n.kind === 'file' ? n.id : n.path));
    expect(ids).toEqual(['z', 'a', 'm']);
  });
});

describe('collectDescendantFiles', () => {
  it('walks a folder and returns every file descendant', () => {
    const tree = buildFileTree([
      makeFile('a', 'root/a.txt'),
      makeFile('b', 'root/sub/b.txt'),
      makeFile('c', 'root/sub/deeper/c.txt'),
    ]);
    const ids = collectDescendantFiles(tree).map((f) => f.id).sort();
    expect(ids).toEqual(['a', 'b', 'c']);
  });

  it('returns the single file for a file node', () => {
    const node: TreeNode = { kind: 'file', id: 'x', file: makeFile('x', 'x.txt') };
    expect(collectDescendantFiles(node)).toHaveLength(1);
  });
});

describe('collectFolderPaths', () => {
  it('returns every folder path in the tree', () => {
    const tree = buildFileTree([
      makeFile('a', 'root/a.txt'),
      makeFile('b', 'root/sub/b.txt'),
      makeFile('c', 'other/c.txt'),
    ]);
    const paths = collectFolderPaths(tree).sort();
    expect(paths).toEqual(['other', 'root', 'root/sub']);
  });

  it('returns empty for a flat file list', () => {
    const tree = buildFileTree([makeFile('a', 'a.txt'), makeFile('b', 'b.txt')]);
    expect(collectFolderPaths(tree)).toEqual([]);
  });
});
