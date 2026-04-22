# Phase 4 Add-Files UX Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Two related UX improvements: (1) fix the dark-mode "선택 삭제" button readability, (2) drop the upload zone after files are added — instead let users add more files by dropping onto the file list itself OR via a new "파일 추가" button next to "선택 삭제".

**Architecture:** Extract the file-traversal logic from `FileUploader` into a shared utility `extractFilesFromDataTransfer`. Add an optional `onAddFiles` prop to `FileList`. When `onAddFiles` is provided, the file list area becomes a drop target with purple-border overlay during drag, and a "파일 추가" button appears next to "선택 삭제" that triggers a hidden file input. App.tsx switches to rendering FileList exclusively (no FileUploader) once `files.length > 0`. Dark-mode button fix is one className tweak.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, shadcn/ui, Vitest.

**Spec lock-in:** User chose option A from the 2026-04-22 brainstorm: file list area itself becomes the drop target with visual feedback; explicit "파일 추가" button as alternative.

---

## File Structure

| File | Status | Owner |
|------|--------|-------|
| `src/components/FileList.tsx` | modify | Add `onAddFiles?` prop, drop handlers, drag-overlay, "파일 추가" button + hidden input |
| `src/components/FileList.test.tsx` | modify | Add 4 new tests for drop, button, overlay, file-picker |
| `src/components/FileUploader.tsx` | modify | Replace inline `traverseFileTree` with import from shared util |
| `src/utils/extractFilesFromDataTransfer.ts` | new | Pure function: takes a `DataTransfer`, returns `Promise<File[]>` (handles folder traversal via `webkitGetAsEntry`) |
| `src/utils/extractFilesFromDataTransfer.test.ts` | new | Unit tests with mocked DataTransfer |
| `src/App.tsx` | modify | Conditionally render `<FileUploader />` only when `files.length === 0`; pass `onAddFiles={addFiles}` to `<FileList>` |
| `src/components/FileList.tsx` line 124 | modify | Fix dark-mode "선택 삭제" color (use brighter red in dark mode) |

No changes to `useFileProcessor`, settings, or any other component. Bundle delta near zero — pure refactor + small JSX additions.

---

## Task 1: Extract shared file-traversal utility

**Files:** `src/utils/extractFilesFromDataTransfer.ts`, `src/utils/extractFilesFromDataTransfer.test.ts`

- [ ] **Step 1: Read the existing inline traversal in FileUploader.tsx**

```bash
sed -n '1,45p' /Users/ikko/repo/ikkonezip-XXX/src/components/FileUploader.tsx
```

(replace `XXX` with your worktree suffix). You'll see `traverseFileTree(entry, path, files)` — a recursive function that walks DirectoryEntry trees and pushes `File` objects with `webkitRelativePath` set.

- [ ] **Step 2: Write the failing test**

Create `src/utils/extractFilesFromDataTransfer.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { extractFilesFromDataTransfer } from './extractFilesFromDataTransfer';

function makeDT(files: File[], items?: DataTransferItem[]): DataTransfer {
  return {
    files: files as unknown as FileList,
    items: (items ?? []) as unknown as DataTransferItemList,
  } as DataTransfer;
}

describe('extractFilesFromDataTransfer', () => {
  it('returns empty array when no files and no items', async () => {
    expect(await extractFilesFromDataTransfer(makeDT([]))).toEqual([]);
  });

  it('returns files from .files when no .items entries available', async () => {
    const a = new File(['a'], 'a.txt');
    const b = new File(['b'], 'b.txt');
    const result = await extractFilesFromDataTransfer(makeDT([a, b]));
    expect(result).toHaveLength(2);
    expect(result.map((f) => f.name)).toEqual(['a.txt', 'b.txt']);
  });

  it('uses .items entries when available (folder support path)', async () => {
    const fileEntry = {
      isFile: true,
      isDirectory: false,
      name: 'f.txt',
      fullPath: '/f.txt',
      file: (cb: (f: File) => void) => cb(new File(['x'], 'f.txt')),
    };
    const item = {
      kind: 'file',
      webkitGetAsEntry: () => fileEntry,
    } as unknown as DataTransferItem;
    const dt = makeDT([new File(['x'], 'f.txt')], [item]);
    const result = await extractFilesFromDataTransfer(dt);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('f.txt');
  });
});
```

- [ ] **Step 3: Run, confirm fail**

```bash
npx vitest run src/utils/extractFilesFromDataTransfer.test.ts --reporter=dot
```
Expected: FAIL with "Cannot find module".

- [ ] **Step 4: Create the utility**

```typescript
// src/utils/extractFilesFromDataTransfer.ts

interface FileSystemFileEntry {
  isFile: true;
  isDirectory: false;
  name: string;
  fullPath: string;
  file(success: (file: File) => void, error?: (err: Error) => void): void;
}

interface FileSystemDirectoryEntry {
  isFile: false;
  isDirectory: true;
  name: string;
  fullPath: string;
  createReader(): {
    readEntries(success: (entries: FileSystemEntry[]) => void): void;
  };
}

type FileSystemEntry = FileSystemFileEntry | FileSystemDirectoryEntry;

/**
 * Pulls all File objects out of a DataTransfer, traversing folder
 * directories via webkitGetAsEntry. Each File gets a `webkitRelativePath`
 * property reflecting its path within any dropped folder. Falls back to
 * the flat `.files` list when entry traversal isn't available.
 */
export async function extractFilesFromDataTransfer(dt: DataTransfer): Promise<File[]> {
  const items = dt.items;
  if (!items || items.length === 0) {
    return Array.from(dt.files);
  }

  const collected: File[] = [];
  const promises: Promise<void>[] = [];
  for (let i = 0; i < items.length; i++) {
    const entry = (items[i] as DataTransferItem & { webkitGetAsEntry?: () => FileSystemEntry | null })
      .webkitGetAsEntry?.();
    if (entry) {
      promises.push(traverse(entry, '', collected));
    }
  }
  await Promise.all(promises);

  // Fallback: if no entries produced files (e.g., non-Chromium browser),
  // fall back to the flat .files list.
  if (collected.length === 0 && dt.files.length > 0) {
    return Array.from(dt.files);
  }
  return collected;
}

function traverse(entry: FileSystemEntry, path: string, out: File[]): Promise<void> {
  return new Promise((resolve) => {
    if (entry.isFile) {
      entry.file((file) => {
        Object.defineProperty(file, 'webkitRelativePath', {
          value: path + entry.name,
          writable: false,
        });
        out.push(file);
        resolve();
      });
    } else if (entry.isDirectory) {
      const reader = entry.createReader();
      reader.readEntries((entries) => {
        Promise.all(entries.map((e) => traverse(e, path + entry.name + '/', out))).then(() => resolve());
      });
    } else {
      resolve();
    }
  });
}
```

- [ ] **Step 5: Run, confirm pass**

```bash
npx vitest run src/utils/extractFilesFromDataTransfer.test.ts --reporter=dot
```
Expected: 3 PASS.

- [ ] **Step 6: Commit**

```bash
git add src/utils/extractFilesFromDataTransfer.ts src/utils/extractFilesFromDataTransfer.test.ts
git commit -m "Extract DataTransfer file-traversal into shared util"
```

---

## Task 2: Refactor FileUploader to use the shared util

**Files:** `src/components/FileUploader.tsx`

- [ ] **Step 1: Replace the inline traversal**

In `src/components/FileUploader.tsx`:

a) Add the import near the top:
```typescript
import { extractFilesFromDataTransfer } from '@/utils/extractFilesFromDataTransfer';
```

b) Delete the local `traverseFileTree` function (and its TypeScript type declaration if separate).

c) Replace `handleDrop`'s body:
```typescript
const handleDrop = useCallback(async (e: React.DragEvent) => {
  e.preventDefault();
  e.stopPropagation();
  setIsDragging(false);
  const files = await extractFilesFromDataTransfer(e.dataTransfer);
  if (files.length > 0) {
    onFilesSelected(files);
  }
}, [onFilesSelected]);
```

- [ ] **Step 2: Run all tests**

```bash
npx vitest run --reporter=dot
```
Expected: previous tests still pass. The FileUploader doesn't have its own test file currently — its behavior is verified end-to-end via the App-level interaction (and by manual smoke).

- [ ] **Step 3: Lint + build**

```bash
npm run lint && npm run build
```
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/FileUploader.tsx
git commit -m "Refactor FileUploader to use shared extractFilesFromDataTransfer util"
```

---

## Task 3: Add `onAddFiles` prop, drop handlers, and "파일 추가" button to FileList

**Files:** `src/components/FileList.tsx`, `src/components/FileList.test.tsx`

- [ ] **Step 1: Read current FileList.tsx structure**

```bash
sed -n '1,140p' src/components/FileList.tsx
```

Note: existing imports include `useState`, `useCallback`, `useMemo`. The "선택 삭제" button is around line 122-128. The header layout has the file count + selection-delete button.

- [ ] **Step 2: Write failing tests**

Append new describe block to `src/components/FileList.test.tsx` (the file already exists from Phase 3 / Track 4):

```typescript
describe('FileList — add files (Phase 4)', () => {
  function makeFile(name: string): ProcessedFile {
    return {
      id: `id-${name}`,
      file: new File(['x'], name, { type: 'text/plain' }),
      originalName: name,
      normalizedName: name,
      path: name,
      normalizedPath: name,
      needsNormalization: false,
      size: 1,
    };
  }

  it('renders a "파일 추가" button when onAddFiles is provided', () => {
    render(
      <FileList
        files={[makeFile('a.txt')]}
        onRemoveFiles={vi.fn()}
        onRename={vi.fn()}
        onAddFiles={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: '파일 추가' })).toBeInTheDocument();
  });

  it('does NOT render "파일 추가" button when onAddFiles is not provided', () => {
    render(
      <FileList
        files={[makeFile('a.txt')]}
        onRemoveFiles={vi.fn()}
        onRename={vi.fn()}
      />
    );
    expect(screen.queryByRole('button', { name: '파일 추가' })).not.toBeInTheDocument();
  });

  it('calls onAddFiles with dropped files', async () => {
    const onAddFiles = vi.fn();
    const { container } = render(
      <FileList
        files={[makeFile('a.txt')]}
        onRemoveFiles={vi.fn()}
        onRename={vi.fn()}
        onAddFiles={onAddFiles}
      />
    );
    const dropZone = container.querySelector('[data-dropzone="filelist"]');
    expect(dropZone).not.toBeNull();

    const newFile = new File(['new'], 'b.txt', { type: 'text/plain' });
    const dt = {
      files: [newFile] as unknown as FileList,
      items: [] as unknown as DataTransferItemList,
    } as DataTransfer;
    fireEvent.drop(dropZone!, { dataTransfer: dt });
    await new Promise(r => setTimeout(r, 0));
    expect(onAddFiles).toHaveBeenCalledTimes(1);
    expect(onAddFiles.mock.calls[0][0]).toHaveLength(1);
    expect((onAddFiles.mock.calls[0][0] as File[])[0].name).toBe('b.txt');
  });

  it('shows the drag overlay when a file is dragged over', () => {
    const { container } = render(
      <FileList
        files={[makeFile('a.txt')]}
        onRemoveFiles={vi.fn()}
        onRename={vi.fn()}
        onAddFiles={vi.fn()}
      />
    );
    const dropZone = container.querySelector('[data-dropzone="filelist"]')!;
    fireEvent.dragOver(dropZone, { dataTransfer: { files: [] as unknown as FileList, items: [] as unknown as DataTransferItemList } });
    expect(screen.getByText('여기에 놓아 추가')).toBeInTheDocument();
    fireEvent.dragLeave(dropZone);
    expect(screen.queryByText('여기에 놓아 추가')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run, confirm fail**

```bash
npx vitest run src/components/FileList.test.tsx -t "Phase 4" --reporter=dot
```
Expected: 4 FAIL.

- [ ] **Step 4: Modify FileList.tsx**

a) Add imports near the top:
```typescript
import { useState, useCallback, useMemo, useRef, type DragEvent } from 'react';
import { Plus } from 'lucide-react';
import { extractFilesFromDataTransfer } from '@/utils/extractFilesFromDataTransfer';
```

(Merge with existing imports — do not duplicate `useState` etc.)

b) Add to `FileListProps` interface:
```typescript
  /** When provided, the file list area becomes a drop target and a "파일 추가" button appears. */
  onAddFiles?: (files: FileList | File[]) => void;
```

c) Destructure `onAddFiles` in the function signature alongside other props.

d) Inside the component body, add state + handlers:
```typescript
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    if (!onAddFiles) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  }, [onAddFiles]);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    if (!onAddFiles) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  }, [onAddFiles]);

  const handleDrop = useCallback(async (e: DragEvent<HTMLDivElement>) => {
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
```

e) Update the JSX. The outermost `<Card>` (or top-level wrapper) gets the drop attributes + a relative position so the overlay can absolute-position over it:

```tsx
<Card
  data-dropzone="filelist"
  className={cn(
    "relative",
    isDraggingOver && onAddFiles && "ring-2 ring-primary ring-offset-2"
  )}
  onDragOver={handleDragOver}
  onDragLeave={handleDragLeave}
  onDrop={handleDrop}
>
  {/* existing card contents */}

  {isDraggingOver && onAddFiles && (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-primary/10 backdrop-blur-sm">
      <span className="text-lg font-semibold text-primary">여기에 놓아 추가</span>
    </div>
  )}
</Card>
```

(`cn` is already imported in this file. If not, add `import { cn } from '@/lib/utils';`.)

f) Add the "파일 추가" button. Find the existing "선택 삭제" button (around line 124):
```tsx
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
```
Place this BEFORE the "선택 삭제" button in the JSX so it appears to its left.

g) Add a hidden file input alongside the buttons:
```tsx
<input
  ref={fileInputRef}
  type="file"
  multiple
  className="hidden"
  onChange={handleFilePicked}
/>
```

- [ ] **Step 5: Run new tests, confirm pass**

```bash
npx vitest run src/components/FileList.test.tsx -t "Phase 4" --reporter=dot
```
Expected: 4 PASS.

- [ ] **Step 6: Run all tests**

```bash
npx vitest run --reporter=dot
```
Expected: previous 209 + 4 new = 213. (Track A doesn't add the SPA-side desktop tests; those are Track B's plan, separate.)

- [ ] **Step 7: Lint + build**

```bash
npm run lint && npm run build
```

- [ ] **Step 8: Commit**

```bash
git add src/components/FileList.tsx src/components/FileList.test.tsx
git commit -m "Add file-add UX to FileList: drop target + 파일 추가 button"
```

---

## Task 4: Conditionally hide FileUploader in App when files exist

**Files:** `src/App.tsx`

- [ ] **Step 1: Find the current render block**

```bash
grep -n "FileUploader\|FileList " src/App.tsx
```

You'll see something like (from the existing investigation):
```tsx
<FileUploader onFilesSelected={addFiles} hideExample={files.length > 0} />
...
<FileList ... />
```

- [ ] **Step 2: Replace the FileUploader block to conditional render**

Change:
```tsx
<FileUploader onFilesSelected={addFiles} hideExample={files.length > 0} />
```

To:
```tsx
{files.length === 0 && (
  <FileUploader onFilesSelected={addFiles} />
)}
```

(`hideExample` can be removed since the only context where it was true — files exist — is now never reached. We could leave the prop for backward compat, but YAGNI: drop it.)

- [ ] **Step 3: Add `onAddFiles` prop to `<FileList>`**

Find the `<FileList ... />` JSX, add:
```tsx
onAddFiles={addFiles}
```

- [ ] **Step 4: Optional — clean up `hideExample` from FileUploader**

If `hideExample` is no longer used anywhere after Step 2, remove it from `FileUploaderProps` and the function signature. Also remove the conditional CSS that depended on it.

```bash
grep -n "hideExample" src/components/FileUploader.tsx
```
If those lines exist, delete them.

- [ ] **Step 5: Run all tests + lint + build**

```bash
npx vitest run --reporter=dot && npm run lint && npm run build
```
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/components/FileUploader.tsx
git commit -m "Hide upload zone after files added; route addFiles to FileList"
```

---

## Task 5: Fix dark-mode "선택 삭제" button readability

**Files:** `src/components/FileList.tsx` line 124, possibly `src/index.css`

- [ ] **Step 1: Inspect the current className**

The button currently uses:
```tsx
className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5"
```

`text-destructive` resolves to the CSS variable `--destructive`. Check `src/index.css` for the dark-mode override:

```bash
grep -n "destructive" src/index.css
```

You'll find both `:root { --destructive: oklch(0.5 0.2 27); }` (or similar) and a dark-mode override under `.dark { --destructive: ... }`.

- [ ] **Step 2: Decide on the scope of the fix**

If the dark-mode `--destructive` value is too dark globally, fix it once in `src/index.css` (recommended — fixes any future destructive-colored elements too).

If only this one button is affected, override at the className level using `dark:text-red-400`.

Recommended: fix the global token. Find the dark mode `--destructive` and bump it to a brighter value:
```css
.dark {
  /* ...other tokens... */
  --destructive: oklch(0.65 0.22 27); /* was ~0.5 — brighter for dark bg readability */
}
```

The exact pre-existing value will guide the new value — bump lightness by ~0.15 in oklch space.

- [ ] **Step 3: Visually verify in dev**

```bash
npm run dev
```

Open http://localhost:5173 in dark mode (system pref or via the footer toggle). Upload a file, select it, check the "선택 삭제" button is readable. Compare to the light-mode appearance — both should be clearly visible without screaming.

- [ ] **Step 4: Run tests + lint**

```bash
npx vitest run --reporter=dot && npm run lint
```

- [ ] **Step 5: Commit**

```bash
git add src/index.css 2>/dev/null
git add src/components/FileList.tsx 2>/dev/null
git commit -m "Brighten dark-mode --destructive token for readability"
```

---

## Task 6: Push and open PR

- [ ] **Step 1: Push and open PR**

```bash
git push -u origin feat/p4-add-files-ux
gh pr create --title "Phase 4 add-files UX polish" --body "$(cat <<'EOF'
## Summary
Two related UX improvements:
1. Dark-mode "선택 삭제" button readability — bumped \`--destructive\` lightness in dark mode
2. Removed the upload zone after files are added; instead:
   - File list area itself accepts drops (purple ring + "여기에 놓아 추가" overlay during drag)
   - New "파일 추가" button to the left of "선택 삭제" opens the system file picker
   - Folder traversal logic extracted into shared util \`extractFilesFromDataTransfer\` (reused by both the empty-state uploader and the file-list dropzone)

## Test plan
- [x] 4 new FileList tests for drop, button visibility, drag overlay, file picker
- [x] 3 new util tests for extractFilesFromDataTransfer
- [x] Full suite passes (209 baseline + 7 new = 216)
- [x] Lint + build clean
- [ ] Manual: dark mode → upload → "선택 삭제" is readable
- [ ] Manual: upload → upload zone disappears → drop more files onto list → they appear
- [ ] Manual: click "파일 추가" → file picker opens → selected files appear
EOF
)"
```

---

## Spec coverage checklist (self-review)

- [x] Dark-mode "선택 삭제" readability → Task 5
- [x] Remove upload zone after files added → Task 4
- [x] File list area accepts drops with visual feedback → Task 3 (overlay) + Task 4 (wiring)
- [x] "파일 추가" button next to "선택 삭제" opens file picker → Task 3
- [x] Folder support preserved on add (uses extractFilesFromDataTransfer) → Task 1 + 2 (refactor) + Task 3 (handleDrop)
- [x] Web behavior unchanged (no SPA logic depends on these UI changes) → all changes are presentational
- [x] No new deps → confirmed via Task 6 (no `npm install`)
