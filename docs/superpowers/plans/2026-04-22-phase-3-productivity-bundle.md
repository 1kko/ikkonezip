# Phase 3 Productivity Bundle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship four user-visible productivity features (PWA update toast, drag-to-reorder, rename-persists-into-ZIP, search/filter at ≥50 files) without exceeding the 500 KB JS bundle budget.

**Architecture:** Four independent feature tracks dispatched via three execution stages. Stage 1 = the one-line ZIP rename fix (sequential, blocks nothing else). Stage 2 = PWA toast + search/filter in parallel worktrees (no file overlap). Stage 3 = drag-to-reorder last because it integrates with FileList from Stage 2.

**Tech Stack:** React 19, TypeScript, Vite 7, vite-plugin-pwa, @dnd-kit/core@^6 + @dnd-kit/sortable@^8 (Track 2 only), Tailwind v4, shadcn/ui, Vitest + happy-dom + @testing-library/react.

**Spec:** `docs/superpowers/specs/2026-04-21-phase-3-productivity-bundle-design.md`

---

## File Ownership Matrix

| Track | Files (created or modified) |
|-------|------------------------------|
| T3 (rename→zip) | `src/hooks/useFileProcessor.ts:238-241`, `src/hooks/useFileProcessor.test.ts` (additions) |
| T1 (PWA toast) | `vite.config.ts`, `src/main.tsx`, `src/App.tsx`, `src/components/PwaUpdateToast.tsx` (new), `src/components/PwaUpdateToast.test.tsx` (new), `src/types/virtual-pwa.d.ts` (new if needed) |
| T4 (search) | `src/components/FileList.tsx`, `src/components/FileListSearch.tsx` (new), `src/components/FileListSearch.test.tsx` (new), `src/components/FileList.test.tsx` (new cases) |
| T2 (DnD) | `package.json`, `package-lock.json`, `src/hooks/useFileProcessor.ts` (new `reorderFiles`), `src/hooks/useFileProcessor.test.ts` (new cases), `src/components/FileList.tsx` (wrap), `src/components/FileListRow.tsx` (sortable), `src/components/DragHandle.tsx` (new) |

**Conflict notes:**
- T2 and T4 both edit `FileList.tsx` → schedule T4 before T2.
- T2 and T3 both edit `useFileProcessor.ts` → T3 stage 1, T2 stage 3.
- T1 has zero overlap with the other three.

---

## Stage 1 — Sequential prep: Track 3 (PR-1)

Branch: `fix/rename-persists-in-zip` from `main`.

### Task 3.1: Add a failing test asserting the renamed name appears in the ZIP

**Files:**
- Modify: `src/hooks/useFileProcessor.test.ts` (append a new `describe` block at end, before the closing brace of the file's outer describe)

- [ ] **Step 1: Inspect the existing test infrastructure for `downloadAsZip`**

```bash
grep -n "downloadAsZip\|createZip" src/hooks/useFileProcessor.test.ts | head -10
```

You'll see existing tests already mock `createZip` from `@/utils/zipFiles`. Reuse that pattern.

- [ ] **Step 2: Write the failing test (rename then download → ZIP entry uses new name)**

Append this new `describe` block inside the outer `describe('useFileProcessor', () => {` block, just before its closing `});`. If your file already has it as the very top-level, append at end.

```typescript
  describe('rename persists into ZIP entry path', () => {
    it('uses the renamed normalizedPath, not the original upload path', async () => {
      const createZipMock = vi.mocked(createZip);
      createZipMock.mockResolvedValue(new Blob());

      const { result } = renderHook(() => useFileProcessor());

      // Upload "original.txt" via the helper that the rest of the test file uses.
      const file = new File(['hi'], 'original.txt', { type: 'text/plain' });
      await act(async () => {
        await result.current.addFiles([file]);
      });
      const id = result.current.files[0].id;

      // Rename to "renamed.txt"
      act(() => {
        result.current.renameFile(id, 'renamed.txt');
      });

      // Trigger download
      await act(async () => {
        await result.current.downloadAsZip();
      });

      // createZip should have been called with the renamed path
      const passedFiles = createZipMock.mock.calls[0][0];
      expect(passedFiles).toHaveLength(1);
      expect(passedFiles[0].path).toBe('renamed.txt');
    });

    it('preserves folder depth on rename', async () => {
      const createZipMock = vi.mocked(createZip);
      createZipMock.mockResolvedValue(new Blob());

      const { result } = renderHook(() => useFileProcessor());

      // Simulate a folder upload by giving the File a webkitRelativePath
      const file = new File(['hi'], 'foo.txt', { type: 'text/plain' });
      Object.defineProperty(file, 'webkitRelativePath', {
        value: 'docs/foo.txt',
        writable: false,
      });
      await act(async () => {
        await result.current.addFiles([file]);
      });
      const id = result.current.files[0].id;

      act(() => {
        result.current.renameFile(id, 'bar.txt');
      });

      await act(async () => {
        await result.current.downloadAsZip();
      });

      const passedFiles = createZipMock.mock.calls[0][0];
      expect(passedFiles[0].path).toBe('docs/bar.txt');
    });
  });
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/hooks/useFileProcessor.test.ts -t "rename persists" --reporter=dot`
Expected: 2 failures with "expected 'original.txt' to be 'renamed.txt'" (or similar). The current `downloadAsZip` passes `f.path`, not `f.normalizedPath`.

- [ ] **Step 4: Apply the one-line fix**

Edit `src/hooks/useFileProcessor.ts` lines 238–241. Find:

```typescript
      const fileData: FileWithPath[] = files.map(f => ({
        file: f.file,
        path: f.path,
      }));
```

Change to:

```typescript
      const fileData: FileWithPath[] = files.map(f => ({
        file: f.file,
        path: f.normalizedPath,
      }));
```

`normalizedPath` is already maintained by both `addFiles` (NFC-normalized at upload) and `renameFile` (updated when the user edits). So this single-word change makes renamed names flow through, and continues to NFC-normalize un-renamed ones.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/hooks/useFileProcessor.test.ts -t "rename persists" --reporter=dot`
Expected: PASS (2 tests).

- [ ] **Step 6: Run full suite to verify no regression**

Run: `npx vitest run --reporter=dot`
Expected: All tests pass (current baseline 188 tests; this adds 2 → 190).

- [ ] **Step 7: Run lint**

Run: `npm run lint`
Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add src/hooks/useFileProcessor.ts src/hooks/useFileProcessor.test.ts
git commit -m "$(cat <<'EOF'
Persist inline-renamed filenames into ZIP entry paths

Phase 2B added inline filename editing that updated the displayed name
(`normalizedName`/`normalizedPath`), but `downloadAsZip` mapped over
`f.path` (the original upload path), so the ZIP entry kept the old
name. This routes through `f.normalizedPath` which already encodes
both NFC normalization and any rename — one-word change.

Two new test cases in useFileProcessor.test.ts cover rename at root and
rename inside a folder.
EOF
)"
```

- [ ] **Step 9: Push and open PR**

```bash
git push -u origin fix/rename-persists-in-zip
gh pr create --title "Persist inline-renamed filenames into ZIP entry paths" --body "$(cat <<'EOF'
## Summary
Phase 2B's inline rename only changed the *displayed* filename. The actual ZIP entry kept the original path. This wires `normalizedPath` (which `renameFile` already maintains) into `downloadAsZip`. One-word change.

## Test plan
- [x] 2 new test cases in useFileProcessor.test.ts covering rename at root and inside a folder
- [x] Full suite passes (190/188+2)
- [x] Lint clean
- [ ] Verify in production: rename a file in the UI, download ZIP, extract → archive shows the new name
EOF
)"
```

---

## Stage 2 — Parallel pair: Track 1 (PWA toast) + Track 4 (search/filter)

After Stage 1 PR lands, set up two worktrees off the freshly-merged main.

```bash
cd /Users/ikko/repo/ikkonezip
git checkout main && git pull --ff-only
git worktree add ../ikkonezip-3a feat/p3-pwa-update-toast
git worktree add ../ikkonezip-3d feat/p3-search-filter
```

Each worktree runs `npm install` once.

---

### Track 1 (PWA Toast) — runs in `../ikkonezip-3a`

### Task 1.1: Switch vite-plugin-pwa to prompt mode

**Files:**
- Modify: `vite.config.ts:24` (the `registerType` line)

- [ ] **Step 1: Inspect current setting**

```bash
grep -n "registerType" vite.config.ts
```

You'll see `registerType: 'autoUpdate',` near the top of the `VitePWA({ ... })` call.

- [ ] **Step 2: Change `'autoUpdate'` to `'prompt'`**

Edit `vite.config.ts`. In the `VitePWA({ ... })` config, change:

```typescript
        registerType: 'autoUpdate',
```

to:

```typescript
        registerType: 'prompt',
```

`'prompt'` opt-out from the plugin's auto-reload. We'll wire `useRegisterSW` in Task 1.2 + 1.3 to expose the update event to React.

- [ ] **Step 3: Confirm build still succeeds**

Run: `npm run build`
Expected: build succeeds; no new warnings about service worker registration.

- [ ] **Step 4: Commit**

```bash
git add vite.config.ts
git commit -m "Switch PWA registerType to prompt for explicit update UX"
```

### Task 1.2: Create PwaUpdateToast component with dismissal-state hook

**Files:**
- Create: `src/components/PwaUpdateToast.tsx`
- Create: `src/components/PwaUpdateToast.test.tsx`

- [ ] **Step 1: Write the failing test for the dismissal-state hook**

Create `src/components/PwaUpdateToast.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { PwaUpdateToast } from './PwaUpdateToast';

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: vi.fn(),
}));

import { useRegisterSW } from 'virtual:pwa-register/react';

describe('PwaUpdateToast', () => {
  let updateMock: ReturnType<typeof vi.fn>;
  let setNeedRefreshMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    updateMock = vi.fn();
    setNeedRefreshMock = vi.fn();
  });

  function mockHook(needRefresh: boolean) {
    vi.mocked(useRegisterSW).mockReturnValue({
      needRefresh: [needRefresh, setNeedRefreshMock],
      offlineReady: [false, vi.fn()],
      updateServiceWorker: updateMock,
    });
  }

  it('renders nothing when no update is available', () => {
    mockHook(false);
    const { container } = render(<PwaUpdateToast />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the toast with title, body, and refresh button when an update is available', () => {
    mockHook(true);
    render(<PwaUpdateToast />);
    expect(screen.getByText('새 버전 사용 가능')).toBeInTheDocument();
    expect(screen.getByText('새로고침하면 최신 버전이 적용됩니다')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '새로고침' })).toBeInTheDocument();
  });

  it('calls updateServiceWorker(true) when the refresh button is clicked', () => {
    mockHook(true);
    render(<PwaUpdateToast />);
    fireEvent.click(screen.getByRole('button', { name: '새로고침' }));
    expect(updateMock).toHaveBeenCalledWith(true);
  });

  it('calls setNeedRefresh(false) when the close button is clicked', () => {
    mockHook(true);
    render(<PwaUpdateToast />);
    fireEvent.click(screen.getByRole('button', { name: '닫기' }));
    expect(setNeedRefreshMock).toHaveBeenCalledWith(false);
  });

  it('uses role="status" with aria-live="polite" for screen readers', () => {
    mockHook(true);
    render(<PwaUpdateToast />);
    const toast = screen.getByRole('status');
    expect(toast).toHaveAttribute('aria-live', 'polite');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/PwaUpdateToast.test.tsx --reporter=dot`
Expected: FAIL with "Cannot find module './PwaUpdateToast'".

- [ ] **Step 3: Create the component**

Create `src/components/PwaUpdateToast.tsx`:

```typescript
import { useRegisterSW } from 'virtual:pwa-register/react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function PwaUpdateToast() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-lg border bg-popover text-popover-foreground shadow-lg px-4 py-3 max-w-[90vw] motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4"
    >
      <div className="flex flex-col">
        <span className="text-sm font-medium">새 버전 사용 가능</span>
        <span className="text-xs text-muted-foreground">새로고침하면 최신 버전이 적용됩니다</span>
      </div>
      <Button
        type="button"
        size="sm"
        onClick={() => {
          try {
            void updateServiceWorker(true);
          } catch {
            location.reload();
          }
        }}
      >
        새로고침
      </Button>
      <button
        type="button"
        aria-label="닫기"
        onClick={() => setNeedRefresh(false)}
        className="ml-1 rounded p-1 text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Add a virtual-module type stub if TypeScript complains**

Run: `npx tsc -b`

If TypeScript reports an error like `Cannot find module 'virtual:pwa-register/react'`, create `src/types/virtual-pwa.d.ts`:

```typescript
/// <reference types="vite-plugin-pwa/react" />
```

If `tsc -b` already passes, skip creating the file.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/components/PwaUpdateToast.test.tsx --reporter=dot`
Expected: 5 tests PASS.

- [ ] **Step 6: Lint**

Run: `npm run lint`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/components/PwaUpdateToast.tsx src/components/PwaUpdateToast.test.tsx src/types/virtual-pwa.d.ts 2>/dev/null
git commit -m "Add PwaUpdateToast component with dismissal + reload actions"
```

(The `2>/dev/null` swallows the harmless error if the type stub wasn't needed.)

### Task 1.3: Mount PwaUpdateToast in App.tsx

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Import the component at the top of `src/App.tsx`**

After the existing component imports (look for the block around line 4-12), add:

```typescript
import { PwaUpdateToast } from '@/components/PwaUpdateToast';
```

- [ ] **Step 2: Mount it once at the end of the App's returned JSX**

Find the closing tag of the App's outermost wrapper (likely a `<div>` or fragment). Just before the closing tag of the outer wrapper, add:

```tsx
<PwaUpdateToast />
```

The toast is fixed-position so it doesn't matter where in the tree it lives, but placing it at the bottom keeps the diff minimal.

- [ ] **Step 3: Build to verify**

Run: `npm run build`
Expected: build succeeds. Bundle size should grow by <1 KB gz (just the new component).

- [ ] **Step 4: Run full suite**

Run: `npx vitest run --reporter=dot`
Expected: All previous tests still pass + 5 new toast tests.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "Mount PwaUpdateToast in App"
```

### Task 1.4: Open PR for Track 1

- [ ] **Step 1: Push and open PR**

```bash
git push -u origin feat/p3-pwa-update-toast
gh pr create --title "Add PWA update toast (Phase 3 / T1)" --body "$(cat <<'EOF'
## Summary
- Switches `vite-plugin-pwa` from `registerType: 'autoUpdate'` to `'prompt'`
- New `PwaUpdateToast` component shows a bottom-center toast with a "새로고침" button when the SW detects a new version
- Dismissible (X button); reappears on the next update

## Why
Returning users were stuck on the old bundle until they manually closed every tab — they'd miss new features for hours or days.

## Test plan
- [x] 5 unit tests cover render-when-needed, button click, dismiss, a11y attributes
- [x] Full suite passes
- [x] Bundle delta <1 KB gz
- [ ] Verify in production: deploy, wait for auto-discovery (~5s), confirm toast renders, click "새로고침" reloads with new bundle
EOF
)"
```

---

### Track 4 (Search/Filter) — runs in `../ikkonezip-3d`

### Task 4.1: Create FileListSearch component

**Files:**
- Create: `src/components/FileListSearch.tsx`
- Create: `src/components/FileListSearch.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/FileListSearch.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { FileListSearch } from './FileListSearch';

describe('FileListSearch', () => {
  it('renders an input with the Korean placeholder', () => {
    render(<FileListSearch value="" onChange={() => {}} />);
    expect(screen.getByPlaceholderText('파일 이름 검색…')).toBeInTheDocument();
  });

  it('calls onChange with the typed value', () => {
    const onChange = vi.fn();
    render(<FileListSearch value="" onChange={onChange} />);
    fireEvent.change(screen.getByPlaceholderText('파일 이름 검색…'), {
      target: { value: 'abc' },
    });
    expect(onChange).toHaveBeenCalledWith('abc');
  });

  it('does not show a clear button when value is empty', () => {
    render(<FileListSearch value="" onChange={() => {}} />);
    expect(screen.queryByRole('button', { name: '검색어 지우기' })).not.toBeInTheDocument();
  });

  it('shows a clear button when value is non-empty and clears via that button', () => {
    const onChange = vi.fn();
    render(<FileListSearch value="abc" onChange={onChange} />);
    const clearBtn = screen.getByRole('button', { name: '검색어 지우기' });
    fireEvent.click(clearBtn);
    expect(onChange).toHaveBeenCalledWith('');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/FileListSearch.test.tsx --reporter=dot`
Expected: FAIL with "Cannot find module './FileListSearch'".

- [ ] **Step 3: Create the component**

Create `src/components/FileListSearch.tsx`:

```typescript
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface FileListSearchProps {
  value: string;
  onChange: (next: string) => void;
}

export function FileListSearch({ value, onChange }: FileListSearchProps) {
  return (
    <div className="relative w-full max-w-sm">
      <Search className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="파일 이름 검색…"
        className="pl-8 pr-8"
      />
      {value.length > 0 && (
        <button
          type="button"
          aria-label="검색어 지우기"
          onClick={() => onChange('')}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/components/FileListSearch.test.tsx --reporter=dot`
Expected: 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/FileListSearch.tsx src/components/FileListSearch.test.tsx
git commit -m "Add FileListSearch input with clear button"
```

### Task 4.2: Wire search into FileList with conditional rendering at ≥50 files

**Files:**
- Modify: `src/components/FileList.tsx`
- Create: `src/components/FileList.test.tsx`

- [ ] **Step 1: Read the current FileList.tsx to find the integration point**

```bash
sed -n '1,120p' src/components/FileList.tsx
```

Note the existing `selectedIds` state, the file-row mapping, and the header that shows "1개 파일 / 262 B".

- [ ] **Step 2: Write tests for the conditional rendering and filter behavior**

Create `src/components/FileList.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { FileList } from './FileList';
import type { ProcessedFile } from '@/hooks/useFileProcessor';

function makeFiles(n: number): ProcessedFile[] {
  return Array.from({ length: n }, (_, i) => {
    const name = `file-${String(i).padStart(3, '0')}.txt`;
    return {
      id: `id-${i}`,
      file: new File(['x'], name, { type: 'text/plain' }),
      originalName: name,
      normalizedName: name,
      path: name,
      normalizedPath: name,
      needsNormalization: false,
      size: 1,
    };
  });
}

describe('FileList — search/filter at ≥50 files', () => {
  it('does NOT render the search input when files.length < 50', () => {
    render(
      <FileList
        files={makeFiles(49)}
        onRemoveFiles={vi.fn()}
        onRename={vi.fn()}
      />
    );
    expect(screen.queryByPlaceholderText('파일 이름 검색…')).not.toBeInTheDocument();
  });

  it('renders the search input when files.length >= 50', () => {
    render(
      <FileList
        files={makeFiles(50)}
        onRemoveFiles={vi.fn()}
        onRename={vi.fn()}
      />
    );
    expect(screen.getByPlaceholderText('파일 이름 검색…')).toBeInTheDocument();
  });

  it('filters rows in real time by case-insensitive substring match on normalizedName', () => {
    render(
      <FileList
        files={makeFiles(50)}
        onRemoveFiles={vi.fn()}
        onRename={vi.fn()}
      />
    );
    const input = screen.getByPlaceholderText('파일 이름 검색…');
    fireEvent.change(input, { target: { value: '042' } });

    expect(screen.getByText('file-042.txt')).toBeInTheDocument();
    expect(screen.queryByText('file-001.txt')).not.toBeInTheDocument();
  });

  it('shows a "검색 활성" badge when the search input has a value', () => {
    render(
      <FileList
        files={makeFiles(50)}
        onRemoveFiles={vi.fn()}
        onRename={vi.fn()}
      />
    );
    fireEvent.change(screen.getByPlaceholderText('파일 이름 검색…'), {
      target: { value: 'foo' },
    });
    expect(screen.getByText(/검색 활성/)).toBeInTheDocument();
  });

  it('"전체 선택" toggles only the visible (filtered) rows', () => {
    const onRemove = vi.fn();
    render(
      <FileList
        files={makeFiles(50)}
        onRemoveFiles={onRemove}
        onRename={vi.fn()}
      />
    );

    // Filter to a single file
    fireEvent.change(screen.getByPlaceholderText('파일 이름 검색…'), {
      target: { value: '042' },
    });

    // Click "전체 선택"
    const selectAllCheckbox = screen.getByRole('checkbox', { name: '전체 선택' });
    fireEvent.click(selectAllCheckbox);

    // Click "선택 삭제"
    fireEvent.click(screen.getByRole('button', { name: '선택 삭제' }));
    expect(onRemove).toHaveBeenCalledWith(['id-42']);
  });
});
```

- [ ] **Step 3: Run the new tests to confirm they fail**

Run: `npx vitest run src/components/FileList.test.tsx --reporter=dot`
Expected: 5 failures.

- [ ] **Step 4: Modify FileList.tsx — add search state, threshold rendering, and filter wiring**

Open `src/components/FileList.tsx`. Make these changes:

a) Top of file imports — add `FileListSearch` and `Badge` (Badge already imported, leave as is):

```typescript
import { FileListSearch } from './FileListSearch';
```

b) Below the existing `selectedIds` `useState`, add:

```typescript
  const [searchQuery, setSearchQuery] = useState('');

  const showSearch = files.length >= 50;
  const visibleFiles = searchQuery.trim().length === 0
    ? files
    : files.filter((f) =>
        f.normalizedName.toLowerCase().includes(searchQuery.trim().toLowerCase())
      );
```

c) Update `toggleSelectAll` so it operates on the visible subset:

Replace the existing `toggleSelectAll` callback with:

```typescript
  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      const visibleIds = visibleFiles.map((f) => f.id);
      const allVisibleSelected = visibleIds.length > 0 &&
        visibleIds.every((id) => prev.has(id));
      const next = new Set(prev);
      if (allVisibleSelected) {
        for (const id of visibleIds) next.delete(id);
      } else {
        for (const id of visibleIds) next.add(id);
      }
      return next;
    });
  }, [visibleFiles]);
```

d) In the JSX, find the existing block where rows are rendered (`files.map(...)` inside the ScrollArea). Change it to render `visibleFiles.map(...)` instead.

e) Above that, but inside the same `CardContent`, render the search bar conditionally:

```tsx
        {showSearch && (
          <div className="flex items-center justify-between gap-3 px-4 pt-3">
            <FileListSearch value={searchQuery} onChange={setSearchQuery} />
            {searchQuery.trim().length > 0 && (
              <Badge variant="secondary">
                검색 활성: {visibleFiles.length}개 표시
              </Badge>
            )}
          </div>
        )}
```

f) The exact JSX shape varies based on the current file. The principle: `FileListSearch + Badge` go above the rows; `files.map` becomes `visibleFiles.map`; `toggleSelectAll` operates on visibleIds.

- [ ] **Step 5: Run tests until green**

Run: `npx vitest run src/components/FileList.test.tsx --reporter=dot`
Expected: 5 PASS. If any fail, read the error and adjust.

- [ ] **Step 6: Run full suite**

Run: `npx vitest run --reporter=dot`
Expected: All tests pass.

- [ ] **Step 7: Lint and build**

Run: `npm run lint && npm run build`
Expected: clean lint, build succeeds.

- [ ] **Step 8: Commit**

```bash
git add src/components/FileList.tsx src/components/FileList.test.tsx
git commit -m "Add search/filter to FileList at >=50 files"
```

### Task 4.3: Open PR for Track 4

- [ ] **Step 1: Push and open PR**

```bash
git push -u origin feat/p3-search-filter
gh pr create --title "Add file-list search/filter at ≥50 files (Phase 3 / T4)" --body "$(cat <<'EOF'
## Summary
- New `FileListSearch` component (case-insensitive substring match on `normalizedName`)
- Renders only when `files.length >= 50` (out of the way for typical use)
- Selection and bulk delete operate on the *visible* subset
- "검색 활성: N개 표시" badge prevents the footgun where users forget the filter is on
- No new deps

## Test plan
- [x] 9 new tests across FileListSearch + FileList
- [x] Full suite passes
- [x] Lint + build clean
- [ ] Verify in production: upload 50+ files, type to filter, "전체 선택" + "선택 삭제" only affect visible
EOF
)"
```

---

## Stage 3 — Sequential: Track 2 (Drag-to-reorder)

After Stage 2's two PRs land, set up the final worktree off the freshly-merged main.

```bash
cd /Users/ikko/repo/ikkonezip
git checkout main && git pull --ff-only
git worktree add ../ikkonezip-3b feat/p3-dnd-reorder
cd ../ikkonezip-3b
npm install
```

### Task 2.1: Add @dnd-kit dependencies

**Files:**
- Modify: `package.json`, `package-lock.json`

- [ ] **Step 1: Install the deps**

Run: `npm install --save @dnd-kit/core@^6 @dnd-kit/sortable@^8`
Expected: 0 vulnerabilities; lockfile updated.

- [ ] **Step 2: Verify the bundle budget after installing (no source changes yet)**

Run: `npm run build 2>&1 | grep -E "index-.*\.js"`
Expected: bundle still under 500 KB gz (we should be ~478 KB pre, ~498 KB post — fine).

If the bundle exceeds 500 KB, revert and switch the strategy to a dynamic import:
```bash
git checkout package.json package-lock.json
```
Then re-do Task 2.1 with `npm install --save-dev` and use `React.lazy` later. (Unlikely; @dnd-kit is small.)

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "Add @dnd-kit/core and @dnd-kit/sortable for file-list reorder"
```

### Task 2.2: Add reorderFiles action to useFileProcessor

**Files:**
- Modify: `src/hooks/useFileProcessor.ts` (add to interface, implement, export)
- Modify: `src/hooks/useFileProcessor.test.ts` (new tests)

- [ ] **Step 1: Write the failing tests**

Append to `src/hooks/useFileProcessor.test.ts` inside the outer `describe`:

```typescript
  describe('reorderFiles', () => {
    it('moves a file from one position to another', async () => {
      const { result } = renderHook(() => useFileProcessor());
      const a = new File(['a'], 'a.txt');
      const b = new File(['b'], 'b.txt');
      const c = new File(['c'], 'c.txt');
      await act(async () => {
        await result.current.addFiles([a, b, c]);
      });
      const ids = result.current.files.map((f) => f.id);

      // Move A (index 0) to where C is (index 2)
      act(() => {
        result.current.reorderFiles(ids[0], ids[2]);
      });

      const after = result.current.files.map((f) => f.originalName);
      expect(after).toEqual(['b.txt', 'c.txt', 'a.txt']);
    });

    it('is a no-op when from === to', async () => {
      const { result } = renderHook(() => useFileProcessor());
      const a = new File(['a'], 'a.txt');
      const b = new File(['b'], 'b.txt');
      await act(async () => {
        await result.current.addFiles([a, b]);
      });
      const ids = result.current.files.map((f) => f.id);
      act(() => {
        result.current.reorderFiles(ids[0], ids[0]);
      });
      expect(result.current.files.map((f) => f.originalName)).toEqual(['a.txt', 'b.txt']);
    });

    it('is a no-op when either id is unknown', async () => {
      const { result } = renderHook(() => useFileProcessor());
      const a = new File(['a'], 'a.txt');
      await act(async () => {
        await result.current.addFiles([a]);
      });
      act(() => {
        result.current.reorderFiles('does-not-exist', result.current.files[0].id);
      });
      expect(result.current.files).toHaveLength(1);
    });
  });
```

- [ ] **Step 2: Run to confirm they fail**

Run: `npx vitest run src/hooks/useFileProcessor.test.ts -t "reorderFiles" --reporter=dot`
Expected: FAIL — `result.current.reorderFiles is not a function`.

- [ ] **Step 3: Add the action to the interface**

Edit `src/hooks/useFileProcessor.ts`. In the `UseFileProcessorReturn` interface, after `removeFiles`, add:

```typescript
  reorderFiles: (fromId: string, toId: string) => void;
```

- [ ] **Step 4: Implement the action**

In the body of `useFileProcessor`, near `removeFiles`, add:

```typescript
  const reorderFiles = useCallback((fromId: string, toId: string) => {
    if (fromId === toId) return;
    setFiles((prev) => {
      const fromIdx = prev.findIndex((f) => f.id === fromId);
      const toIdx = prev.findIndex((f) => f.id === toId);
      if (fromIdx < 0 || toIdx < 0) return prev;
      const next = prev.slice();
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
  }, []);
```

- [ ] **Step 5: Add to the returned object**

Find the `return { ... }` block at the end of `useFileProcessor`. Add `reorderFiles,` after `removeFiles,`.

- [ ] **Step 6: Run tests**

Run: `npx vitest run src/hooks/useFileProcessor.test.ts -t "reorderFiles" --reporter=dot`
Expected: 3 PASS.

- [ ] **Step 7: Commit**

```bash
git add src/hooks/useFileProcessor.ts src/hooks/useFileProcessor.test.ts
git commit -m "Add reorderFiles action to useFileProcessor"
```

### Task 2.3: Create DragHandle component

**Files:**
- Create: `src/components/DragHandle.tsx`

- [ ] **Step 1: Create the component**

```typescript
import { GripVertical } from 'lucide-react';
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export const DragHandle = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement>>(
  function DragHandle({ className, ...props }, ref) {
    return (
      <button
        ref={ref}
        type="button"
        aria-label="파일 순서 변경 핸들"
        className={cn(
          'flex-shrink-0 cursor-grab text-muted-foreground hover:text-foreground active:cursor-grabbing focus:outline-none focus:ring-2 focus:ring-ring rounded p-0.5 touch-none',
          className,
        )}
        {...props}
      >
        <GripVertical className="h-4 w-4" />
      </button>
    );
  },
);
```

`touch-none` is critical — without it, mobile browsers' default scroll-on-drag behavior fights with @dnd-kit's pointer sensor.

- [ ] **Step 2: Commit**

```bash
git add src/components/DragHandle.tsx
git commit -m "Add DragHandle component (grip icon, keyboard-accessible)"
```

### Task 2.4: Wrap FileList in DndContext + SortableContext

**Files:**
- Modify: `src/components/FileList.tsx`

- [ ] **Step 1: Add the imports at the top of FileList.tsx**

```typescript
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
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
```

- [ ] **Step 2: Extend FileListProps to accept onReorder**

Find the `FileListProps` interface and add:

```typescript
  onReorder: (fromId: string, toId: string) => void;
```

- [ ] **Step 3: Inside the component, set up sensors and the drag-end handler**

Just below the existing `useState`/`useCallback` blocks, add:

```typescript
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    onReorder(String(active.id), String(over.id));
  }, [onReorder]);
```

`activationConstraint: { distance: 4 }` requires 4px of movement before drag starts — this preserves click-to-select on the row body.

- [ ] **Step 4: Wrap the rows in DndContext + SortableContext**

Find the JSX where `visibleFiles.map(...)` (or `files.map(...)` if Stage 2 didn't land, but it should have) renders the rows. Wrap that loop:

```tsx
<DndContext
  sensors={sensors}
  collisionDetection={closestCenter}
  onDragEnd={handleDragEnd}
>
  <SortableContext
    items={visibleFiles.map((f) => f.id)}
    strategy={verticalListSortingStrategy}
  >
    {visibleFiles.map((f) => (
      <FileListRow
        key={f.id}
        file={f}
        selected={selectedIds.has(f.id)}
        onToggleSelect={toggleSelect}
        onRename={onRename}
      />
    ))}
  </SortableContext>
</DndContext>
```

Important: `arrayMove` is imported but used inside `useFileProcessor.reorderFiles` — actually we already implemented our own splice-based reorder there. The `arrayMove` import is convenience for tests; we can drop it if unused. Lint will flag unused imports.

Remove `arrayMove` from the import line if you don't end up using it.

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/components/FileList.tsx
git commit -m "Wrap FileList rows in DndContext + SortableContext"
```

### Task 2.5: Make FileListRow sortable, add drag handle

**Files:**
- Modify: `src/components/FileListRow.tsx`

- [ ] **Step 1: Inspect current FileListRow.tsx**

```bash
cat src/components/FileListRow.tsx
```

- [ ] **Step 2: Modify FileListRow.tsx — add useSortable + render the DragHandle**

At the top:

```typescript
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { DragHandle } from './DragHandle';
```

Inside the component body, before the existing JSX return, add:

```typescript
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: file.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
  };
```

Then in the JSX:
- Add `ref={setNodeRef}` and `style={style}` to the row's outermost element.
- Render `<DragHandle {...attributes} {...listeners} />` as the FIRST child of the row, before the existing checkbox.

Example shape:

```tsx
<div ref={setNodeRef} style={style} className="...existing classes...">
  <DragHandle {...attributes} {...listeners} />
  {/* existing checkbox + thumbnail + filename + size cells */}
</div>
```

- [ ] **Step 3: Update FileListRow.test.tsx if it exists**

Run: `ls src/components/FileListRow.test.tsx 2>/dev/null && echo "exists" || echo "missing"`

If it exists, the existing tests render `<FileListRow />` without a `<DndContext>` wrapper. `useSortable` will throw without that wrapper. Wrap in tests:

```typescript
import { DndContext } from '@dnd-kit/core';
import { SortableContext } from '@dnd-kit/sortable';

// In each test's render call, wrap:
render(
  <DndContext>
    <SortableContext items={[file.id]}>
      <FileListRow file={file} ... />
    </SortableContext>
  </DndContext>
);
```

If a test helper exists, update it once.

- [ ] **Step 4: Run row tests**

Run: `npx vitest run src/components/FileListRow.test.tsx --reporter=dot`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/FileListRow.tsx src/components/FileListRow.test.tsx 2>/dev/null
git commit -m "Make FileListRow sortable with DragHandle"
```

### Task 2.6: Wire onReorder from App to FileList

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: In App.tsx, destructure `reorderFiles` from `useFileProcessor()`**

Find where `useFileProcessor()` is destructured. Add `reorderFiles` to the list:

```typescript
const {
  files,
  // …existing fields…
  reorderFiles,
} = useFileProcessor();
```

- [ ] **Step 2: Pass to FileList as `onReorder` prop**

Find the `<FileList ... />` JSX and add:

```tsx
<FileList
  files={files}
  onRemoveFiles={removeFiles}
  onRename={renameFile}
  onReorder={reorderFiles}
/>
```

- [ ] **Step 3: Run full test suite**

Run: `npx vitest run --reporter=dot`
Expected: All tests pass.

- [ ] **Step 4: Build and confirm bundle within budget**

Run: `npm run build 2>&1 | grep -E "index-.*\.js"`
Expected: JS gzip size <500 KB. If over, revisit dynamic import strategy.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "Wire reorderFiles from App to FileList onReorder"
```

### Task 2.7: Open PR for Track 2

- [ ] **Step 1: Push and open PR**

```bash
git push -u origin feat/p3-dnd-reorder
gh pr create --title "Add drag-to-reorder for file list (Phase 3 / T2)" --body "$(cat <<'EOF'
## Summary
- Adds `@dnd-kit/core` + `@dnd-kit/sortable` (~20 KB gz combined)
- New `DragHandle` component (grip icon, keyboard-accessible)
- New `reorderFiles(fromId, toId)` action on `useFileProcessor`
- ZIP entry order matches the user-arranged order

## A11y
- Pointer sensor: 4px activation distance preserves click-to-select on the row body
- Keyboard sensor: Tab → handle, Space → grab, Arrow keys → move, Space → drop, Esc → cancel
- @dnd-kit's built-in live-region announcements

## Bundle
- Pre-Phase-3: 478 KB / 35 KB
- Post-Phase-3 with this PR: <see actual numbers in CI>; budget is 500 KB

## Test plan
- [x] 3 new tests on `reorderFiles` (move, no-op same id, no-op unknown id)
- [x] FileListRow tests updated to wrap in DndContext
- [x] Full suite passes
- [ ] Verify in production: drag a row, ZIP, extract, confirm new order
EOF
)"
```

---

## Final Step — verification + cleanup

After all four PRs are merged into main:

- [ ] **Step 1: Verify on production**

Use the same recipe from earlier sessions:
1. Force-rebuild via `gh workflow run deploy.yml --ref main -f force=true`
2. Wait for Coolify build (poll bundle hash on `https://zip.1kko.com/`)
3. Unregister SW + ignoreCache reload via Chrome DevTools MCP
4. Manually exercise each feature; confirm acceptance criteria from the spec

- [ ] **Step 2: Clean up worktrees**

```bash
git worktree remove ../ikkonezip-3a
git worktree remove ../ikkonezip-3d
git worktree remove ../ikkonezip-3b
git worktree prune
```

- [ ] **Step 3: Delete merged branches**

```bash
git branch --merged main | grep -v '^\*\|^  main$' | xargs -n1 git branch -d
```

---

## Spec coverage checklist (self-review)

Mapping spec acceptance criteria to plan tasks:

| Spec acceptance | Plan task |
|------------------|-----------|
| F1: toast within 5s of update | Task 1.2 (component) + Task 1.3 (mount); 5s is the SW poll interval, no plan task |
| F1: dismiss + reappear on next update | Task 1.2 Step 3 (`setNeedRefresh(false)` and the hook re-fires on new update) |
| F1: no Lighthouse PWA regression | Verified by existing Lighthouse CI on the PR |
| F2: mouse drag reorders | Task 2.4 + 2.5 + 2.6 |
| F2: touch drag works | DragHandle has `touch-none`; PointerSensor handles touch |
| F2: keyboard reorder | KeyboardSensor in Task 2.4 |
| F2: ZIP order respects new order | reorderFiles mutates state array → existing `downloadAsZip` already iterates state in order |
| F3: rename → ZIP entry uses new name | Task 3.1 covers both root and folder cases |
| F3: NFC↔NFD toggle still works for un-renamed | No regression test added explicitly, but existing `targetForm` tests (Phase 1) still pass |
| F4: search hidden at 49 / shown at 50 | Task 4.2 Step 4 tests |
| F4: real-time filter | Task 4.2 Step 4 test "filters rows in real time" |
| F4: 검색 활성 badge | Task 4.2 Step 4 test |
| F4: bulk select operates on visible | Task 4.2 Step 4 final test |

All spec criteria mapped. The "no observable lag at 500 files" criterion is not unit-tested (would need a benchmark) — covered implicitly by `String.includes` being O(n) and React's reconciler being fast. If the user reports lag, defer to a follow-up perf PR.
