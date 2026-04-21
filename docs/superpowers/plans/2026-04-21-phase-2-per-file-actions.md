# Phase 2 — Per-File Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development with superpowers:using-git-worktrees + superpowers:dispatching-parallel-agents for the parallel tracks. The prep refactor is a single sequential PR; the three feature tracks (2A/2B/2C) run as parallel subagents in isolated git worktrees once the refactor lands. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Ship three per-file actions for ikkonezip — preview-before-convert modal, inline filename editing, and image thumbnails — sharing a refactored FileList component surface that lets the three features land in parallel without merge conflicts.

**Architecture:** First a small sequential refactor PR splits the monolithic `FileList.tsx` (171 lines, single component) into four focused files: `FileList` (parent — owns selection state + bulk actions + scroll container), `FileListRow` (single-row layout coordinator), `FileListRowFilename` (filename cell), `FileListRowMeta` (icon + size + NFD badge). After that lands on main, three feature tracks are dispatched in parallel via git worktrees, each with strict file ownership: 2A creates a brand-new `PreviewModal` + Dialog primitive (zero overlap), 2B owns `FileListRowFilename` + adds `renameFile` to `useFileProcessor`, 2C creates `useThumbnail` hook + owns `FileListRowMeta`. Each track opens its own PR, all merge cleanly.

**Tech Stack:** React 19, TypeScript, Vite 7, @zip.js/zip.js, **new dep: @radix-ui/react-dialog** (~8 KB gzipped), Vitest + happy-dom, @testing-library/react.

**Reference spec:** `docs/superpowers/specs/2026-04-21-feature-improvements-design.md` (Phase 2 section).

---

## File structure

### Sequential prep refactor (Task 1) — single PR `chore/phase-2-prep-filelist-split`

| File | Status | Responsibility |
|---|---|---|
| `src/components/FileList.tsx` | **Modified** (171 → ~80 lines) | Parent: owns `selectedIds` Set state, bulk-select + delete logic, scroll container, header card |
| `src/components/FileListRow.tsx` | **Created** (~30 lines) | Single-row layout: combines checkbox + sub-components; receives `file`, `selected`, `onToggleSelect` |
| `src/components/FileListRowFilename.tsx` | **Created** (~15 lines) | Filename cell only — renders `<span>{file.path}</span>` plus the `NFD` badge if needed |
| `src/components/FileListRowMeta.tsx` | **Created** (~30 lines) | Icon (via `getFileIcon`) + formatted file size — encapsulates the right-hand metadata column |
| `src/components/FileList.test.tsx` | **Created** | Renders N files → N rows; bulk-select toggles; remove-selected fires correctly |
| `src/components/FileListRow.test.tsx` | **Created** | Renders one file with all three sub-components; click toggles selection |

### Parallel feature tracks (after Task 1 lands)

#### Track 2A — Preview modal (`feat/phase-2-preview-modal`)

| File | Status | Owner |
|---|---|---|
| `package.json` | **Modified** (1 new dep: `@radix-ui/react-dialog`) | 2A |
| `src/components/ui/dialog.tsx` | **Created** (~80 lines, shadcn pattern) | 2A |
| `src/components/PreviewModal.tsx` | **Created** (~70 lines) | 2A |
| `src/components/PreviewModal.test.tsx` | **Created** | 2A |
| `src/App.tsx` | **Modified** (~6 lines: state + render Modal + gate downloadAsZip) | 2A |

#### Track 2B — Inline filename editing (`feat/phase-2-inline-edit`)

| File | Status | Owner |
|---|---|---|
| `src/components/FileListRowFilename.tsx` | **Modified** (adds edit mode + commit/cancel) | 2B |
| `src/components/FileListRowFilename.test.tsx` | **Created** | 2B |
| `src/hooks/useFileProcessor.ts` | **Modified** (adds `renameFile` action; passes through `FileList`) | 2B |
| `src/hooks/useFileProcessor.test.ts` | **Modified** (adds renameFile tests) | 2B |
| `src/components/FileList.tsx` | **Modified** (1 line: `onRename` prop pass-through to FileListRow) | 2B |
| `src/components/FileListRow.tsx` | **Modified** (1 line: forward `onRename` to FileListRowFilename) | 2B |
| `src/App.tsx` | **Modified** (1 line: `onRename={renameFile}` on FileList) | 2B |

#### Track 2C — Image thumbnails (`feat/phase-2-thumbnails`)

| File | Status | Owner |
|---|---|---|
| `src/hooks/useThumbnail.ts` | **Created** (~40 lines) | 2C |
| `src/hooks/useThumbnail.test.ts` | **Created** | 2C |
| `src/components/FileListRowMeta.tsx` | **Modified** (renders thumbnail when image, fallback to icon) | 2C |

### Files NOT touched (anywhere in Phase 2)

`src/utils/normalizeFilename.ts`, `src/utils/zipFiles.ts`, `src/utils/extractZip.ts`, `src/hooks/useSettings.ts`, `src/hooks/useKeyboardShortcuts.ts`, `src/components/DownloadButton.tsx`, `src/components/FileUploader.tsx`, `src/components/Header.tsx`, `src/components/Footer.tsx`, `src/components/ZipPasswordPrompt.tsx`. If a track wants to touch any of these, **stop and escalate** — it's a sign the design is shifting.

### File ownership matrix (parallel tracks)

| | 2A | 2B | 2C |
|---|---|---|---|
| `package.json` | ✏ | – | – |
| `src/components/ui/dialog.tsx` | ✏ new | – | – |
| `src/components/PreviewModal*.tsx` | ✏ new | – | – |
| `src/components/FileList.tsx` | – | ✏ 1 line | – |
| `src/components/FileListRow.tsx` | – | ✏ 1 line | – |
| `src/components/FileListRowFilename.tsx` | – | ✏ | – |
| `src/components/FileListRowMeta.tsx` | – | – | ✏ |
| `src/hooks/useFileProcessor.ts` | – | ✏ | – |
| `src/hooks/useFileProcessor.test.ts` | – | ✏ | – |
| `src/hooks/useThumbnail*.ts` | – | – | ✏ new |
| `src/App.tsx` | ✏ | ✏ 1 line | – |

**Conflict potential:** 2A and 2B both touch `App.tsx`. 2A adds the modal state + render; 2B adds one prop on `FileList`. These touch different lines and merge cleanly in 99% of cases, but the second-merging PR may need a 30-second rebase. 2B touches `FileList.tsx` and `FileListRow.tsx` for one-line prop forwarding — also cleanly mergeable as long as Task 1's refactor leaves stable insertion points.

---

## Branch strategy

**Step 1 (sequential):** Create branch `chore/phase-2-prep-filelist-split` off main, ship Task 1, merge to main.

**Step 2 (parallel via worktrees):** From the freshly-merged main:

```bash
# Worktree 1 — 2A
git worktree add ../ikkonezip-2a feat/phase-2-preview-modal main
# Worktree 2 — 2B
git worktree add ../ikkonezip-2b feat/phase-2-inline-edit main
# Worktree 3 — 2C
git worktree add ../ikkonezip-2c feat/phase-2-thumbnails main
```

Each subagent runs `npm ci` in its own worktree (one-time per worktree), then implements its track's tasks.

**Step 3:** Each track opens its own PR. Merge in any order (file ownership prevents conflicts, except the App.tsx touchpoint between 2A and 2B which may require trivial rebase).

**Step 4:** After all three tracks merge, single integration check task verifies the combined behavior.

---

## Task 1: Sequential prep — split FileList into four files

Lands on its own branch `chore/phase-2-prep-filelist-split`, single PR. Behavior MUST be byte-for-byte unchanged in the rendered DOM.

**Files:**
- Modify: `src/components/FileList.tsx`
- Create: `src/components/FileListRow.tsx`
- Create: `src/components/FileListRowFilename.tsx`
- Create: `src/components/FileListRowMeta.tsx`
- Create: `src/components/FileList.test.tsx`
- Create: `src/components/FileListRow.test.tsx`

- [ ] **Step 1: Create branch and verify clean state**

```bash
git checkout main
git pull --ff-only
git checkout -b chore/phase-2-prep-filelist-split
```

- [ ] **Step 2: Take baseline screenshots for visual diffing**

Build, run in container, screenshot light + dark + with-files states. Save to `/tmp/filelist-before-light.png`, `/tmp/filelist-before-dark.png`, `/tmp/filelist-before-empty.png`.

```bash
npm run build
docker build -t ikkonezip-baseline .
docker rm -f ikbase 2>/dev/null
docker run -d --name ikbase -p 13020:3000 ikkonezip-baseline
```

Use chrome-devtools-mcp to:
1. Open `http://localhost:13020/` and take a screenshot to `/tmp/filelist-before-empty.png`
2. Run JS via `evaluate_script` to programmatically upload 3 mock files (use the FileUploader hidden input, same pattern as the Phase 1 keyboard test), then screenshot to `/tmp/filelist-before-light.png`
3. `emulate({ colorScheme: 'dark' })`, reload, screenshot to `/tmp/filelist-before-dark.png`

Stop the container: `docker rm -f ikbase`. The screenshots are visual-diff baselines for Step 9.

- [ ] **Step 3: Create `FileListRowMeta.tsx` (icon only)**

This component owns ONLY the file-type icon (left of filename in the row). The NFD badge and file size are row-positional concerns and live inline in `FileListRow` (Step 5). Track 2C extends this file later to add image thumbnails.

Create `src/components/FileListRowMeta.tsx`:

```tsx
import { FileText, Image, Archive, Code, File } from 'lucide-react';
import type { ProcessedFile } from '@/hooks/useFileProcessor';
import type { ReactNode } from 'react';

interface FileListRowMetaProps {
  file: ProcessedFile;
}

function getFileIcon(filename: string): ReactNode {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const iconClass = "w-4 h-4";

  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) {
    return <Image className={`${iconClass} text-pink-500`} />;
  }
  if (['pdf', 'doc', 'docx', 'txt', 'rtf'].includes(ext)) {
    return <FileText className={`${iconClass} text-blue-500`} />;
  }
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
    return <Archive className={`${iconClass} text-amber-500`} />;
  }
  if (['js', 'ts', 'jsx', 'tsx', 'html', 'css', 'json', 'py', 'java'].includes(ext)) {
    return <Code className={`${iconClass} text-emerald-500`} />;
  }
  return <File className={`${iconClass} text-muted-foreground`} />;
}

export function FileListRowMeta({ file }: FileListRowMetaProps) {
  return (
    <div className="flex-shrink-0">
      {getFileIcon(file.originalName)}
    </div>
  );
}
```

- [ ] **Step 4: Create `FileListRowFilename.tsx`**

Create `src/components/FileListRowFilename.tsx`:

```tsx
import type { ProcessedFile } from '@/hooks/useFileProcessor';

interface FileListRowFilenameProps {
  file: ProcessedFile;
}

export function FileListRowFilename({ file }: FileListRowFilenameProps) {
  return (
    <span className="flex-1 min-w-0 text-sm truncate" title={file.path}>
      {file.path}
    </span>
  );
}
```

(Track 2B will extend this with edit mode later.)

- [ ] **Step 5: Create `FileListRow.tsx`**

Create `src/components/FileListRow.tsx`. Visual order: checkbox → icon (via `<FileListRowMeta>`) → filename (via `<FileListRowFilename>`) → NFD badge → size. The NFD badge and file size live inline here because they're row-layout concerns, not metadata-fetching concerns:

```tsx
import { Badge } from '@/components/ui/badge';
import type { ProcessedFile } from '@/hooks/useFileProcessor';
import { FileListRowFilename } from './FileListRowFilename';
import { FileListRowMeta } from './FileListRowMeta';

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

interface FileListRowProps {
  file: ProcessedFile;
  selected: boolean;
  onToggleSelect: (id: string) => void;
}

export function FileListRow({ file, selected, onToggleSelect }: FileListRowProps) {
  return (
    <div
      className="group flex items-center gap-2 px-3 py-2 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
      title={file.path}
      onClick={() => onToggleSelect(file.id)}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={() => onToggleSelect(file.id)}
        onClick={(e) => e.stopPropagation()}
        className="flex-shrink-0 w-3.5 h-3.5 rounded border-input accent-primary cursor-pointer"
      />
      <FileListRowMeta file={file} />
      <FileListRowFilename file={file} />
      {file.needsNormalization && (
        <Badge variant="warning" className="flex-shrink-0 text-[10px] px-1.5 py-0">
          NFD
        </Badge>
      )}
      <span className="flex-shrink-0 text-xs text-muted-foreground font-mono">
        {formatFileSize(file.size)}
      </span>
    </div>
  );
}
```

Note `formatFileSize` is duplicated locally here — same function appears in `FileList.tsx` for the total-size badge in the header. Each component owns its own size formatting and they evolve independently (YAGNI deduplication for now).

- [ ] **Step 6: Update `FileList.tsx` to use `FileListRow`**

Replace the body of `src/components/FileList.tsx` with:

```tsx
import { useState, useCallback } from 'react';
import { FileText, Trash2, AlertTriangle } from 'lucide-react';
import type { ProcessedFile } from '@/hooks/useFileProcessor';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileListRow } from './FileListRow';

interface FileListProps {
  files: ProcessedFile[];
  onRemoveFiles: (ids: string[]) => void;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function FileList({ files, onRemoveFiles }: FileListProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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
      if (prev.size === files.length) {
        return new Set();
      }
      return new Set(files.map(f => f.id));
    });
  }, [files]);

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
  const allSelected = selectedIds.size === files.length;

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
        <ScrollArea className="max-h-72 custom-scrollbar pr-2">
          <div className="space-y-2">
            <label className="flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleSelectAll}
                className="w-3.5 h-3.5 rounded border-input accent-primary cursor-pointer"
              />
              전체 선택
            </label>
            {files.map((file) => (
              <FileListRow
                key={file.id}
                file={file}
                selected={selectedIds.has(file.id)}
                onToggleSelect={toggleSelect}
              />
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
```

The header keeps `formatFileSize` (used for total). The row's `formatFileSize` is duplicated locally in `FileListRow.tsx` — this is intentional: each component owns its own size formatting and they evolve independently. (If one ever changes, the other doesn't have to change in lockstep. YAGNI deduplication for now.)

- [ ] **Step 7: Add `FileList.test.tsx`**

Create `src/components/FileList.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FileList } from './FileList';
import type { ProcessedFile } from '@/hooks/useFileProcessor';

function makeFile(overrides: Partial<ProcessedFile> = {}): ProcessedFile {
  return {
    id: overrides.id ?? `file-${Math.random()}`,
    file: new File(['x'], overrides.originalName ?? 'a.txt'),
    originalName: overrides.originalName ?? 'a.txt',
    normalizedName: overrides.normalizedName ?? 'a.txt',
    path: overrides.path ?? 'a.txt',
    normalizedPath: overrides.normalizedPath ?? 'a.txt',
    needsNormalization: overrides.needsNormalization ?? false,
    size: overrides.size ?? 100,
  };
}

describe('FileList', () => {
  it('renders nothing when files array is empty', () => {
    const { container } = render(<FileList files={[]} onRemoveFiles={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders one row per file', () => {
    const files = [
      makeFile({ id: '1', path: 'a.txt' }),
      makeFile({ id: '2', path: 'b.txt' }),
      makeFile({ id: '3', path: 'c.txt' }),
    ];
    render(<FileList files={files} onRemoveFiles={vi.fn()} />);
    expect(screen.getByText('a.txt')).toBeInTheDocument();
    expect(screen.getByText('b.txt')).toBeInTheDocument();
    expect(screen.getByText('c.txt')).toBeInTheDocument();
  });

  it('shows total file count badge', () => {
    const files = [makeFile({ id: '1' }), makeFile({ id: '2' })];
    render(<FileList files={files} onRemoveFiles={vi.fn()} />);
    expect(screen.getByText('2개 파일')).toBeInTheDocument();
  });

  it('shows NFD-needed count when any files need normalization', () => {
    const files = [
      makeFile({ id: '1', needsNormalization: true }),
      makeFile({ id: '2', needsNormalization: false }),
    ];
    render(<FileList files={files} onRemoveFiles={vi.fn()} />);
    expect(screen.getByText('1개 정규화 필요')).toBeInTheDocument();
  });

  it('select-all toggles all rows', () => {
    const files = [makeFile({ id: '1' }), makeFile({ id: '2' })];
    const onRemoveFiles = vi.fn();
    render(<FileList files={files} onRemoveFiles={onRemoveFiles} />);

    const selectAll = screen.getByText('전체 선택').previousSibling as HTMLInputElement;
    fireEvent.click(selectAll);

    const removeBtn = screen.getByRole('button', { name: /선택 삭제/ });
    fireEvent.click(removeBtn);

    expect(onRemoveFiles).toHaveBeenCalledWith(expect.arrayContaining(['1', '2']));
  });

  it('remove-selected button is disabled when nothing selected', () => {
    render(<FileList files={[makeFile({ id: '1' })]} onRemoveFiles={vi.fn()} />);
    const removeBtn = screen.getByRole('button', { name: /선택 삭제/ });
    expect(removeBtn).toBeDisabled();
  });
});
```

- [ ] **Step 8: Add `FileListRow.test.tsx`**

Create `src/components/FileListRow.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FileListRow } from './FileListRow';
import type { ProcessedFile } from '@/hooks/useFileProcessor';

function makeFile(overrides: Partial<ProcessedFile> = {}): ProcessedFile {
  return {
    id: overrides.id ?? 'test-1',
    file: new File(['x'], overrides.originalName ?? 'a.txt'),
    originalName: overrides.originalName ?? 'a.txt',
    normalizedName: overrides.normalizedName ?? 'a.txt',
    path: overrides.path ?? 'a.txt',
    normalizedPath: overrides.normalizedPath ?? 'a.txt',
    needsNormalization: overrides.needsNormalization ?? false,
    size: overrides.size ?? 1024,
  };
}

describe('FileListRow', () => {
  it('renders the filename', () => {
    render(<FileListRow file={makeFile({ path: 'hello.txt' })} selected={false} onToggleSelect={vi.fn()} />);
    expect(screen.getByText('hello.txt')).toBeInTheDocument();
  });

  it('shows NFD badge when needsNormalization is true', () => {
    render(<FileListRow file={makeFile({ needsNormalization: true })} selected={false} onToggleSelect={vi.fn()} />);
    expect(screen.getByText('NFD')).toBeInTheDocument();
  });

  it('does not show NFD badge when needsNormalization is false', () => {
    render(<FileListRow file={makeFile({ needsNormalization: false })} selected={false} onToggleSelect={vi.fn()} />);
    expect(screen.queryByText('NFD')).not.toBeInTheDocument();
  });

  it('shows formatted file size', () => {
    render(<FileListRow file={makeFile({ size: 1024 })} selected={false} onToggleSelect={vi.fn()} />);
    expect(screen.getByText('1 KB')).toBeInTheDocument();
  });

  it('calls onToggleSelect with file id when row clicked', () => {
    const onToggle = vi.fn();
    render(<FileListRow file={makeFile({ id: 'abc' })} selected={false} onToggleSelect={onToggle} />);
    fireEvent.click(screen.getByText('a.txt'));
    expect(onToggle).toHaveBeenCalledWith('abc');
  });

  it('checkbox reflects selected prop', () => {
    const { rerender } = render(<FileListRow file={makeFile()} selected={false} onToggleSelect={vi.fn()} />);
    expect(screen.getByRole('checkbox')).not.toBeChecked();

    rerender(<FileListRow file={makeFile()} selected={true} onToggleSelect={vi.fn()} />);
    expect(screen.getByRole('checkbox')).toBeChecked();
  });
});
```

- [ ] **Step 9: Run all checks**

```bash
npm run lint
npm run test:coverage
npm run build
./scripts/check-bundle-size.sh
```

Expected:
- Lint: clean
- Tests: 146 existing + 12 new = 158 (or close — Step 7 has 6 tests, Step 8 has 6 tests). Coverage stays at 100% statements
- Build: succeeds
- Bundle: stays under budget (refactor is structural — bundle should not grow)

- [ ] **Step 10: Visual diff vs baseline screenshots**

```bash
docker build -t ikkonezip-after .
docker rm -f ikafter 2>/dev/null
docker run -d --name ikafter -p 13020:3000 ikkonezip-after
```

Repeat the screenshot capture from Step 2 with the post-refactor build. Save to `/tmp/filelist-after-empty.png`, `/tmp/filelist-after-light.png`, `/tmp/filelist-after-dark.png`.

Compare each pair via the Read tool to view the images side by side, OR use ImageMagick if available:
```bash
compare -metric AE /tmp/filelist-before-empty.png /tmp/filelist-after-empty.png /tmp/diff-empty.png 2>&1
```

Expected: visual output is byte-identical or pixel-identical (any visual delta beyond anti-aliasing differences is a regression).

Cleanup: `docker rm -f ikafter`

- [ ] **Step 11: Commit and push**

```bash
git add src/components/FileList.tsx src/components/FileListRow.tsx src/components/FileListRowFilename.tsx src/components/FileListRowMeta.tsx src/components/FileList.test.tsx src/components/FileListRow.test.tsx
git commit -m "Split FileList.tsx into FileList + FileListRow + sub-components"
git push -u origin chore/phase-2-prep-filelist-split
```

- [ ] **Step 12: Open PR and watch CI green**

```bash
gh pr create --base main --head chore/phase-2-prep-filelist-split \
  --title "Refactor: split FileList into FileList + FileListRow + sub-components" \
  --body "Prep refactor for Phase 2's parallel feature work. No behavior change.

## Summary
- FileList.tsx (171 lines, monolithic) splits into 4 focused files
- FileListRow owns the per-row layout
- FileListRowFilename and FileListRowMeta are extension points for Phase 2 features (inline edit, thumbnails)
- 12 new component tests added (FileList had no tests previously)

## Test plan
- [x] Lint clean, all tests pass, coverage 100% statements
- [x] Visual diff vs main: identical (light + dark + with-files)
- [x] Bundle size unchanged (structural refactor)"

# wait for CI
RUN_ID=$(gh run list --branch chore/phase-2-prep-filelist-split --limit 1 --json databaseId --jq '.[0].databaseId')
gh run watch "$RUN_ID" --exit-status
```

- [ ] **Step 13: Merge to main**

```bash
gh pr merge --merge --delete-branch
git checkout main
git pull --ff-only
```

After this lands on main, the three parallel tracks (2A/2B/2C) can be dispatched.

---

## Setup for parallel tracks (after Task 1 lands)

- [ ] **Step 1: Create three worktrees from fresh main**

```bash
git checkout main
git pull --ff-only

git worktree add ../ikkonezip-2a feat/phase-2-preview-modal -b feat/phase-2-preview-modal
git worktree add ../ikkonezip-2b feat/phase-2-inline-edit -b feat/phase-2-inline-edit
git worktree add ../ikkonezip-2c feat/phase-2-thumbnails -b feat/phase-2-thumbnails
```

- [ ] **Step 2: Each worktree gets its own npm install (one-time)**

```bash
(cd ../ikkonezip-2a && npm install)
(cd ../ikkonezip-2b && npm install)
(cd ../ikkonezip-2c && npm install)
```

(Each worktree gets its own `node_modules` — ~150 MB extra disk per worktree. Cleaned up at the end via `git worktree remove`.)

Now Task 2A, 2B, 2C can be dispatched as parallel subagents per the dispatching-parallel-agents skill. Each agent works in its own worktree.

---

## Task 2A — Preview-before-convert modal

**Working directory:** `/Users/ikko/repo/ikkonezip-2a`
**Branch:** `feat/phase-2-preview-modal`

### Files this track owns

- Create: `src/components/ui/dialog.tsx`
- Create: `src/components/PreviewModal.tsx`
- Create: `src/components/PreviewModal.test.tsx`
- Modify: `src/App.tsx` (state + render + gate downloadAsZip)
- Modify: `package.json` + `package-lock.json` (add `@radix-ui/react-dialog`)

### Steps

- [ ] **Step 1: Add the npm dependency**

```bash
cd /Users/ikko/repo/ikkonezip-2a
npm install @radix-ui/react-dialog@^1.1.0
```

Verify: `npm ls @radix-ui/react-dialog` returns the installed version with no peer-dep warnings.

- [ ] **Step 2: Create `src/components/ui/dialog.tsx`** (shadcn standard wrapper)

Create the file with the standard shadcn dialog template:

```tsx
import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

const Dialog = DialogPrimitive.Root
const DialogTrigger = DialogPrimitive.Trigger
const DialogPortal = DialogPrimitive.Portal
const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:rounded-lg",
        className
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
))
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)} {...props} />
)
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)} {...props} />
)
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title ref={ref} className={cn("text-lg font-semibold leading-none tracking-tight", className)} {...props} />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
}
```

- [ ] **Step 3: Write failing tests for PreviewModal**

Create `src/components/PreviewModal.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PreviewModal } from './PreviewModal';
import type { ProcessedFile } from '@/hooks/useFileProcessor';

function makeFile(overrides: Partial<ProcessedFile> = {}): ProcessedFile {
  return {
    id: overrides.id ?? `file-${Math.random()}`,
    file: new File(['x'], overrides.originalName ?? 'a.txt'),
    originalName: overrides.originalName ?? 'a.txt',
    normalizedName: overrides.normalizedName ?? 'a.txt',
    path: overrides.path ?? 'a.txt',
    normalizedPath: overrides.normalizedPath ?? 'a.txt',
    needsNormalization: overrides.needsNormalization ?? false,
    size: overrides.size ?? 100,
  };
}

describe('PreviewModal', () => {
  it('renders nothing when open is false', () => {
    render(
      <PreviewModal
        open={false}
        files={[makeFile({ needsNormalization: true })]}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.queryByText(/미리보기/)).not.toBeInTheDocument();
  });

  it('shows rename diffs for files needing normalization', () => {
    const files = [
      makeFile({ id: '1', path: '\u1100\u1161.txt', normalizedPath: '\uAC00.txt', needsNormalization: true }),
      makeFile({ id: '2', path: 'normal.txt', normalizedPath: 'normal.txt', needsNormalization: false }),
    ];
    render(<PreviewModal open={true} files={files} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText('\u1100\u1161.txt')).toBeInTheDocument();
    expect(screen.getByText('\uAC00.txt')).toBeInTheDocument();
  });

  it('only lists files needing normalization (filters unchanged)', () => {
    const files = [
      makeFile({ id: '1', path: 'unchanged.txt', needsNormalization: false }),
      makeFile({ id: '2', path: 'will-change.txt', normalizedPath: 'will-change-normalized.txt', needsNormalization: true }),
    ];
    render(<PreviewModal open={true} files={files} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.queryByText('unchanged.txt')).not.toBeInTheDocument();
    expect(screen.getByText('will-change.txt')).toBeInTheDocument();
  });

  it('calls onConfirm when confirm button clicked', () => {
    const onConfirm = vi.fn();
    render(
      <PreviewModal
        open={true}
        files={[makeFile({ needsNormalization: true })]}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /다운로드 진행/ }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when cancel button clicked', () => {
    const onCancel = vi.fn();
    render(
      <PreviewModal
        open={true}
        files={[makeFile({ needsNormalization: true })]}
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /취소/ }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
```

Run: `npm test -- PreviewModal`. Expected: ALL fail (component doesn't exist yet).

- [ ] **Step 4: Implement `PreviewModal.tsx`**

Create `src/components/PreviewModal.tsx`:

```tsx
import { ArrowRight } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { ProcessedFile } from '@/hooks/useFileProcessor';

interface PreviewModalProps {
  open: boolean;
  files: ProcessedFile[];
  onConfirm: () => void;
  onCancel: () => void;
}

export function PreviewModal({ open, files, onConfirm, onCancel }: PreviewModalProps) {
  const filesToRename = files.filter((f) => f.needsNormalization);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>파일명 미리보기</DialogTitle>
          <DialogDescription>
            아래 {filesToRename.length}개 파일이 정규화됩니다. 진행하시겠습니까?
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-72 pr-4">
          <div className="space-y-2">
            {filesToRename.map((file) => (
              <div
                key={file.id}
                className="grid grid-cols-[1fr_auto_1fr] gap-3 items-center text-sm"
              >
                <code className="px-2 py-1 bg-red-500/10 text-red-700 dark:text-red-300 rounded text-xs font-mono truncate">
                  {file.path}
                </code>
                <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <code className="px-2 py-1 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 rounded text-xs font-mono truncate">
                  {file.normalizedPath}
                </code>
              </div>
            ))}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="ghost" onClick={onCancel}>
            취소
          </Button>
          <Button onClick={onConfirm}>다운로드 진행</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

Run tests: `npm test -- PreviewModal`. Expected: all 5 pass.

- [ ] **Step 5: Wire PreviewModal in `src/App.tsx`**

Add the import:
```tsx
import { PreviewModal } from '@/components/PreviewModal';
import { useState } from 'react';  // (add useState if not already in the React import)
```

Inside the App component, add a state and a confirm handler. Place after the existing destructure of `useFileProcessor`:

```tsx
const [previewOpen, setPreviewOpen] = useState(false);

// Wraps downloadAsZip to gate it through the preview modal when any file
// needs normalization. The actual download triggers from PreviewModal's
// onConfirm.
const downloadWithPreview = async (zipFilename: string, options?: ZipOptions) => {
  const anyNeedsNormalization = files.some((f) => f.needsNormalization);
  if (anyNeedsNormalization) {
    setPreviewOpen(true);
    pendingDownloadRef.current = { zipFilename, options };
    return;
  }
  await downloadAsZip(zipFilename, options);
};
```

Add a `useRef` for the pending args (so the modal's onConfirm can replay the call with the original args):

```tsx
import { useRef } from 'react';  // add to React imports
// ...
const pendingDownloadRef = useRef<{ zipFilename: string; options?: ZipOptions } | null>(null);
```

Add the modal render right above the closing tag of the `<main>` block (or anywhere inside the main column — modal is portal-rendered so position in JSX doesn't matter for visual placement):

```tsx
<PreviewModal
  open={previewOpen}
  files={files}
  onConfirm={async () => {
    setPreviewOpen(false);
    const args = pendingDownloadRef.current;
    pendingDownloadRef.current = null;
    if (args) await downloadAsZip(args.zipFilename, args.options);
  }}
  onCancel={() => {
    setPreviewOpen(false);
    pendingDownloadRef.current = null;
  }}
/>
```

Replace the existing `onDownloadZip={downloadAsZip}` prop on `<DownloadButton>` with `onDownloadZip={downloadWithPreview}`.

- [ ] **Step 6: Add `ZipOptions` import in App.tsx**

You'll need the type for the function signature:

```tsx
import type { ZipOptions } from '@/utils/zipFiles';
```

- [ ] **Step 7: Run all checks**

```bash
npm run lint
npm run test:coverage
npm run build
./scripts/check-bundle-size.sh
```

Expected: lint clean, tests pass, build succeeds. Bundle should grow by ~8 KB gzipped (Radix Dialog) — verify still within 500 KB budget.

- [ ] **Step 8: Manual smoke test**

```bash
docker build -t ikkonezip-2a .
docker rm -f ik2a 2>/dev/null
docker run -d --name ik2a -p 13030:3000 ikkonezip-2a
```

Open `http://localhost:13030` in browser:
- Upload an NFD-named file (rename a Korean file to NFD form using `mv`)
- Click download → modal opens with rename diff
- Cancel → modal closes, no download
- Re-click download → modal opens, click confirm → ZIP downloads

Cleanup: `docker rm -f ik2a`

- [ ] **Step 9: Commit + push + open PR**

```bash
git add package.json package-lock.json src/components/ui/dialog.tsx src/components/PreviewModal.tsx src/components/PreviewModal.test.tsx src/App.tsx
git commit -m "Add preview-before-convert modal for filename normalization"
git push -u origin feat/phase-2-preview-modal
gh pr create --base main --head feat/phase-2-preview-modal \
  --title "Phase 2A: preview-before-convert modal" \
  --body "Gates download through a preview modal when any file needs NFC/NFD normalization. New @radix-ui/react-dialog dep (~8KB gz). PreviewModal + Dialog primitive in shadcn/ui style. Wired through App.tsx."
```

Wait for CI green; merge.

---

## Task 2B — Inline filename editing

**Working directory:** `/Users/ikko/repo/ikkonezip-2b`
**Branch:** `feat/phase-2-inline-edit`

### Files this track owns

- Modify: `src/components/FileListRowFilename.tsx` (adds edit mode)
- Create: `src/components/FileListRowFilename.test.tsx`
- Modify: `src/hooks/useFileProcessor.ts` (adds renameFile action)
- Modify: `src/hooks/useFileProcessor.test.ts` (adds renameFile tests)
- Modify: `src/components/FileList.tsx` (1 line: pass onRename to row)
- Modify: `src/components/FileListRow.tsx` (1 line: forward onRename)
- Modify: `src/App.tsx` (1 line: pass renameFile)

### Steps

- [ ] **Step 1: Add failing test for `renameFile` in useFileProcessor**

Add inside `src/hooks/useFileProcessor.test.ts` (in a new `describe('renameFile', ...)` block):

```ts
describe('renameFile', () => {
  it('updates a file\'s normalizedName and normalizedPath, leaves originalName intact', async () => {
    const { result } = renderHook(() => useFileProcessor());

    await act(async () => {
      await result.current.addFiles([createMockFile('original.txt')]);
    });

    const id = result.current.files[0].id;

    act(() => {
      result.current.renameFile(id, 'renamed.txt');
    });

    const renamed = result.current.files.find((f) => f.id === id);
    expect(renamed?.normalizedName).toBe('renamed.txt');
    expect(renamed?.normalizedPath).toBe('renamed.txt');
    expect(renamed?.originalName).toBe('original.txt');
  });

  it('preserves directory part of path when renaming', async () => {
    const { result } = renderHook(() => useFileProcessor());

    const fileWithPath = createMockFileWithPath('a.txt', 'folder/sub/a.txt');
    await act(async () => {
      await result.current.addFiles([fileWithPath]);
    });

    const id = result.current.files[0].id;
    act(() => {
      result.current.renameFile(id, 'renamed.txt');
    });

    const renamed = result.current.files.find((f) => f.id === id);
    expect(renamed?.normalizedPath).toBe('folder/sub/renamed.txt');
  });

  it('strips slashes from the new name (path injection prevention)', async () => {
    const { result } = renderHook(() => useFileProcessor());

    await act(async () => {
      await result.current.addFiles([createMockFile('a.txt')]);
    });

    const id = result.current.files[0].id;
    act(() => {
      result.current.renameFile(id, '../etc/passwd');
    });

    const renamed = result.current.files.find((f) => f.id === id);
    // Slashes stripped, dots preserved as part of valid name
    expect(renamed?.normalizedName).not.toContain('/');
    expect(renamed?.normalizedName).toBe('..etcpasswd');
  });

  it('does nothing when name is empty (after trim)', async () => {
    const { result } = renderHook(() => useFileProcessor());

    await act(async () => {
      await result.current.addFiles([createMockFile('a.txt')]);
    });

    const id = result.current.files[0].id;
    const before = result.current.files[0].normalizedName;
    act(() => {
      result.current.renameFile(id, '   ');
    });

    expect(result.current.files[0].normalizedName).toBe(before);
  });

  it('does nothing for unknown id', async () => {
    const { result } = renderHook(() => useFileProcessor());

    await act(async () => {
      await result.current.addFiles([createMockFile('a.txt')]);
    });

    const before = result.current.files[0];
    act(() => {
      result.current.renameFile('nonexistent-id', 'newname.txt');
    });

    expect(result.current.files[0]).toEqual(before);
  });
});
```

Run: `npm test -- useFileProcessor`. Expected: 5 failures (`renameFile` is not on the hook).

- [ ] **Step 2: Add `renameFile` to `useFileProcessor`**

In `src/hooks/useFileProcessor.ts`, add the action. Place it near the other action callbacks (after `removeFiles`):

```ts
const renameFile = useCallback((id: string, newName: string) => {
  // Strip slashes (path injection) and trim whitespace
  const sanitized = newName.replace(/\//g, '').trim();
  if (sanitized.length === 0) return;

  setFiles((prev) =>
    prev.map((f) => {
      if (f.id !== id) return f;
      // Replace the last segment of the path with the new name
      const lastSlash = f.normalizedPath.lastIndexOf('/');
      const newPath =
        lastSlash >= 0
          ? f.normalizedPath.slice(0, lastSlash + 1) + sanitized
          : sanitized;
      return {
        ...f,
        normalizedName: sanitized,
        normalizedPath: newPath,
      };
    })
  );
}, []);
```

Add `renameFile` to the `UseFileProcessorReturn` interface (between `removeFiles` and `clearFiles`):

```ts
removeFile: (id: string) => void;
removeFiles: (ids: string[]) => void;
renameFile: (id: string, newName: string) => void;
clearFiles: () => void;
```

Add `renameFile` to the returned object at the bottom of the hook:

```ts
removeFile,
removeFiles,
renameFile,
clearFiles,
```

Run: `npm test -- useFileProcessor`. Expected: all tests including the 5 new ones pass.

- [ ] **Step 3: Write failing tests for `FileListRowFilename` edit mode**

Create `src/components/FileListRowFilename.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FileListRowFilename } from './FileListRowFilename';
import type { ProcessedFile } from '@/hooks/useFileProcessor';

function makeFile(overrides: Partial<ProcessedFile> = {}): ProcessedFile {
  return {
    id: overrides.id ?? 'test-1',
    file: new File(['x'], overrides.originalName ?? 'a.txt'),
    originalName: overrides.originalName ?? 'a.txt',
    normalizedName: overrides.normalizedName ?? 'a.txt',
    path: overrides.path ?? 'a.txt',
    normalizedPath: overrides.normalizedPath ?? 'a.txt',
    needsNormalization: overrides.needsNormalization ?? false,
    size: overrides.size ?? 100,
  };
}

describe('FileListRowFilename', () => {
  it('renders the filename as a span by default', () => {
    render(<FileListRowFilename file={makeFile({ path: 'hello.txt' })} onRename={vi.fn()} />);
    expect(screen.getByText('hello.txt')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('switches to input on click', () => {
    render(<FileListRowFilename file={makeFile({ path: 'hello.txt' })} onRename={vi.fn()} />);
    fireEvent.click(screen.getByText('hello.txt'));
    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveValue('hello.txt');
  });

  it('commits on Enter and calls onRename', () => {
    const onRename = vi.fn();
    render(<FileListRowFilename file={makeFile({ id: 'abc', path: 'hello.txt' })} onRename={onRename} />);
    fireEvent.click(screen.getByText('hello.txt'));
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'newname.txt' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onRename).toHaveBeenCalledWith('abc', 'newname.txt');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('cancels on Escape, does not call onRename', () => {
    const onRename = vi.fn();
    render(<FileListRowFilename file={makeFile({ path: 'hello.txt' })} onRename={onRename} />);
    fireEvent.click(screen.getByText('hello.txt'));
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'newname.txt' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onRename).not.toHaveBeenCalled();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByText('hello.txt')).toBeInTheDocument();
  });

  it('commits on blur', () => {
    const onRename = vi.fn();
    render(<FileListRowFilename file={makeFile({ id: 'abc', path: 'hello.txt' })} onRename={onRename} />);
    fireEvent.click(screen.getByText('hello.txt'));
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'blur-commit.txt' } });
    fireEvent.blur(input);
    expect(onRename).toHaveBeenCalledWith('abc', 'blur-commit.txt');
  });

  it('does not commit if value unchanged', () => {
    const onRename = vi.fn();
    render(<FileListRowFilename file={makeFile({ path: 'hello.txt' })} onRename={onRename} />);
    fireEvent.click(screen.getByText('hello.txt'));
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
    expect(onRename).not.toHaveBeenCalled();
  });
});
```

Run: `npm test -- FileListRowFilename`. Expected: failures (no edit mode yet).

- [ ] **Step 4: Implement edit mode in `FileListRowFilename.tsx`**

Replace the body with:

```tsx
import { useState, useEffect, useRef } from 'react';
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

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  // Reset draft when leaving edit mode (commit or cancel)
  useEffect(() => {
    if (!editing) setDraft(file.normalizedName);
  }, [editing, file.normalizedName]);

  function commit() {
    if (draft !== file.normalizedName) {
      onRename(file.id, draft);
    }
    setEditing(false);
  }

  function cancel() {
    setDraft(file.normalizedName);
    setEditing(false);
  }

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
      onClick={(e) => {
        e.stopPropagation();
        setEditing(true);
      }}
    >
      {file.normalizedName}
    </span>
  );
}
```

Note the `e.stopPropagation()` on the click — without it, clicking the filename would also trigger the row's `onToggleSelect`. Same for the Input's onClick.

Run: `npm test -- FileListRowFilename`. Expected: 6 tests pass.

- [ ] **Step 5: Forward `onRename` through FileList → FileListRow → FileListRowFilename**

In `src/components/FileList.tsx`:
- Add `onRename` to props interface:
```ts
interface FileListProps {
  files: ProcessedFile[];
  onRemoveFiles: (ids: string[]) => void;
  onRename: (id: string, newName: string) => void;
}
```
- Destructure: `export function FileList({ files, onRemoveFiles, onRename }: FileListProps)`
- Pass to row: `<FileListRow ... onRename={onRename} />`

In `src/components/FileListRow.tsx`:
- Add to props: `onRename: (id: string, newName: string) => void;`
- Destructure: `({ file, selected, onToggleSelect, onRename })`
- Pass to filename: `<FileListRowFilename file={file} onRename={onRename} />`

In `src/App.tsx`:
- Add `renameFile` to the `useFileProcessor` destructure
- Pass to FileList: `onRename={renameFile}`

- [ ] **Step 6: Run all checks**

```bash
npm run lint
npm run test:coverage
npm run build
./scripts/check-bundle-size.sh
```

Expected: clean, all pass, no bundle growth (text input + state is tiny).

- [ ] **Step 7: Commit + push + open PR**

```bash
git add src/hooks/useFileProcessor.ts src/hooks/useFileProcessor.test.ts src/components/FileListRowFilename.tsx src/components/FileListRowFilename.test.tsx src/components/FileList.tsx src/components/FileListRow.tsx src/App.tsx
git commit -m "Add inline filename editing in FileList"
git push -u origin feat/phase-2-inline-edit
gh pr create --base main --head feat/phase-2-inline-edit \
  --title "Phase 2B: inline filename editing" \
  --body "Click a filename in the list → input → Enter commits, Esc cancels. Adds renameFile action to useFileProcessor. Strips slashes (path injection prevention). Empty/whitespace input does not commit."
```

Wait CI green; merge.

---

## Task 2C — Image thumbnails

**Working directory:** `/Users/ikko/repo/ikkonezip-2c`
**Branch:** `feat/phase-2-thumbnails`

### Files this track owns

- Create: `src/hooks/useThumbnail.ts`
- Create: `src/hooks/useThumbnail.test.ts`
- Modify: `src/components/FileListRowMeta.tsx` (renders thumbnail when image, fallback to icon)

### Steps

- [ ] **Step 1: Write failing tests for `useThumbnail`**

Create `src/hooks/useThumbnail.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useThumbnail } from './useThumbnail';

describe('useThumbnail', () => {
  let createObjectURL: typeof URL.createObjectURL;
  let revokeObjectURL: typeof URL.revokeObjectURL;

  beforeEach(() => {
    createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
    revokeObjectURL = vi.fn();
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns null for non-image file', () => {
    const file = new File(['x'], 'doc.pdf', { type: 'application/pdf' });
    const { result } = renderHook(() => useThumbnail(file));
    expect(result.current).toBeNull();
  });

  it('returns blob URL for image file by mime type', () => {
    const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' });
    const { result } = renderHook(() => useThumbnail(file));
    expect(result.current).toBe('blob:mock-url');
    expect(createObjectURL).toHaveBeenCalledWith(file);
  });

  it('returns blob URL for image file by extension when mime is missing', () => {
    const file = new File(['x'], 'photo.png', { type: '' });
    const { result } = renderHook(() => useThumbnail(file));
    expect(result.current).toBe('blob:mock-url');
  });

  it('revokes URL on unmount', () => {
    const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' });
    const { unmount } = renderHook(() => useThumbnail(file));
    unmount();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });

  it('revokes old URL when file changes', async () => {
    const file1 = new File(['a'], 'a.jpg', { type: 'image/jpeg' });
    const file2 = new File(['b'], 'b.jpg', { type: 'image/jpeg' });
    const { rerender } = renderHook(({ f }: { f: File }) => useThumbnail(f), {
      initialProps: { f: file1 },
    });
    rerender({ f: file2 });
    await waitFor(() => {
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    });
  });

  it('does not call createObjectURL for non-image', () => {
    const file = new File(['x'], 'doc.pdf', { type: 'application/pdf' });
    renderHook(() => useThumbnail(file));
    expect(createObjectURL).not.toHaveBeenCalled();
  });
});
```

Run: `npm test -- useThumbnail`. Expected: all fail (file doesn't exist).

- [ ] **Step 2: Implement `useThumbnail.ts`**

Create `src/hooks/useThumbnail.ts`:

```ts
import { useState, useEffect } from 'react';

const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg']);

function isImage(file: File): boolean {
  if (file.type.startsWith('image/')) return true;
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  return IMAGE_EXTENSIONS.has(ext);
}

/**
 * Generates a temporary blob URL for image files. Returns null for non-images.
 * Automatically revokes the URL on unmount or when the file changes.
 */
export function useThumbnail(file: File): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!isImage(file)) {
      setUrl(null);
      return;
    }

    const blobUrl = URL.createObjectURL(file);
    setUrl(blobUrl);

    return () => {
      URL.revokeObjectURL(blobUrl);
    };
  }, [file]);

  return url;
}
```

Run: `npm test -- useThumbnail`. Expected: all 6 pass.

- [ ] **Step 3: Update `FileListRowMeta.tsx` to render thumbnails**

Replace the body of `src/components/FileListRowMeta.tsx`:

```tsx
import { FileText, Image, Archive, Code, File } from 'lucide-react';
import { useThumbnail } from '@/hooks/useThumbnail';
import type { ProcessedFile } from '@/hooks/useFileProcessor';
import type { ReactNode } from 'react';

interface FileListRowMetaProps {
  file: ProcessedFile;
}

function getFileIcon(filename: string): ReactNode {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const iconClass = "w-4 h-4";

  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) {
    return <Image className={`${iconClass} text-pink-500`} />;
  }
  if (['pdf', 'doc', 'docx', 'txt', 'rtf'].includes(ext)) {
    return <FileText className={`${iconClass} text-blue-500`} />;
  }
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
    return <Archive className={`${iconClass} text-amber-500`} />;
  }
  if (['js', 'ts', 'jsx', 'tsx', 'html', 'css', 'json', 'py', 'java'].includes(ext)) {
    return <Code className={`${iconClass} text-emerald-500`} />;
  }
  return <File className={`${iconClass} text-muted-foreground`} />;
}

export function FileListRowMeta({ file }: FileListRowMetaProps) {
  const thumbnailUrl = useThumbnail(file.file);

  if (thumbnailUrl) {
    return (
      <div className="flex-shrink-0 w-4 h-4 rounded overflow-hidden bg-muted">
        <img
          src={thumbnailUrl}
          alt=""
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </div>
    );
  }

  return (
    <div className="flex-shrink-0">
      {getFileIcon(file.originalName)}
    </div>
  );
}
```

`alt=""` is intentional: the thumbnail is decorative (the filename is right next to it, providing the same information). `loading="lazy"` defers off-screen image loading natively (no IntersectionObserver needed for MVP).

- [ ] **Step 4: Run all checks**

```bash
npm run lint
npm run test:coverage
npm run build
./scripts/check-bundle-size.sh
```

Expected: clean, all pass, bundle within budget.

- [ ] **Step 5: Manual smoke test**

Build container, upload a folder containing a few image files, verify thumbnails appear in the list (4×4 px is small but visible).

- [ ] **Step 6: Commit + push + open PR**

```bash
git add src/hooks/useThumbnail.ts src/hooks/useThumbnail.test.ts src/components/FileListRowMeta.tsx
git commit -m "Add image thumbnails to file list rows"
git push -u origin feat/phase-2-thumbnails
gh pr create --base main --head feat/phase-2-thumbnails \
  --title "Phase 2C: image thumbnails in file list" \
  --body "Replaces the static image icon with an actual thumbnail (4×4 in the row) for image files. Lazy-loaded via the native loading attribute. Falls back to the icon for non-images. New useThumbnail hook handles blob URL lifecycle."
```

Wait CI green; merge.

---

## Final integration check (after all three feature PRs merged)

- [ ] **Step 1: Sync local main**

```bash
git checkout main
git pull --ff-only
```

- [ ] **Step 2: Run all gates locally**

```bash
npm run lint
npm run test:coverage
npm run build
./scripts/check-bundle-size.sh
rm -rf .lighthouseci
npx --yes @lhci/cli@0.15 collect --staticDistDir=./dist --numberOfRuns=1 --settings.preset=desktop
```

Expected:
- Lint clean
- All tests pass
- Coverage above thresholds
- Build succeeds
- Bundle within 500 KB JS / 200 KB CSS budget
- Lighthouse 100/100/100/100

- [ ] **Step 3: Manual end-to-end browser test**

```bash
docker build -t ikkonezip-phase2 .
docker rm -f ikp2 2>/dev/null
docker run -d --name ikp2 -p 13050:3000 ikkonezip-phase2
```

Open `http://localhost:13050` and verify all three Phase 2 features work together:
1. Upload a folder containing images + an NFD-named file
2. Click a filename → edit it → Enter commits (verify rename)
3. See image thumbnails in the rows
4. Click download → preview modal opens showing rename diffs (including the user's edited names)
5. Confirm → ZIP downloads with edited + normalized names

Cleanup: `docker rm -f ikp2`

- [ ] **Step 4: Cleanup worktrees**

```bash
git worktree remove ../ikkonezip-2a
git worktree remove ../ikkonezip-2b
git worktree remove ../ikkonezip-2c
```

- [ ] **Step 5: Verify production deploy after merges**

Check Coolify status and verify production reaches `running:healthy` after the final merge.

```bash
ssh svc.1kko.com 'docker exec coolify-db psql -U coolify -d coolify -tAc "SELECT status FROM applications WHERE uuid='"'"'o0o0cckk480soss4sowggk04'"'"';"'
```

---

## Phase 2 acceptance criteria

- [ ] Refactor PR (Task 1): identical visual output before/after; FileList tests pass; no behavior change
- [ ] Preview modal opens when downloading files needing normalization; cancel returns to file list; confirm proceeds with download
- [ ] Inline edit: click filename → edit → Enter commits, Esc cancels; whitespace-only blocked; slash-injection blocked
- [ ] Thumbnails appear for image files (jpg/png/gif/webp/svg/bmp); fall back to icon for others
- [ ] Bundle size stays under 500 KB JS budget (Radix Dialog adds ~8 KB)
- [ ] Lighthouse stays at 100/100/100/100

---

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Refactor (Task 1) silently changes pixel layout | Visual diff via screenshots in Step 2 + Step 10 of Task 1 |
| 2A and 2B both touch App.tsx → merge conflict | 2A's changes are concentrated (state + render + new prop on DownloadButton); 2B's is one line on FileList. Even if conflict, ~2 min to resolve. Merge 2A first if possible. |
| Radix Dialog focus trap interferes with happy-dom tests | If tests fail with focus-related errors, add `pretendToBeVisual: true` to vitest's happy-dom config. (No change anticipated; happy-dom handles this.) |
| Thumbnail URLs leaked (not revoked) for fast scrolling | useThumbnail's effect cleanup handles unmount; `loading="lazy"` defers off-screen creation natively |
| Inline edit triggers row's toggleSelect | Both the span and the input call `e.stopPropagation()` on click |
| User renames file but the rename happens AFTER NFC normalization in createZip | createZip uses `path` (which becomes the new normalizedPath after rename); test verifies path is updated post-rename |

---

## Done definition

When all of the following are true, Phase 2 is complete:
1. PRs `chore/phase-2-prep-filelist-split`, `feat/phase-2-preview-modal`, `feat/phase-2-inline-edit`, `feat/phase-2-thumbnails` all merged to main
2. Coolify reports `running:healthy` after final merge
3. Live site `https://zip.1kko.com/` exhibits all three features end-to-end (verify in browser)
4. Lighthouse at 100/100/100/100; bundle within budget; coverage at threshold
5. Worktrees removed; local main is up to date with origin
