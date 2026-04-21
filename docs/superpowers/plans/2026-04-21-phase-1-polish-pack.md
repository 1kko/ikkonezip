# Phase 1 — Polish Pack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship three small UX wins for ikkonezip in one bundled PR: a real progress bar during ZIP creation, a bidirectional NFC↔NFD direction toggle, and global keyboard shortcuts.

**Architecture:** Pure additive changes to existing files plus one new hook (`useKeyboardShortcuts`). No new npm dependencies needed — the project already ships a hand-rolled `<Progress>` component (`src/components/ui/progress.tsx`) and `@zip.js/zip.js` exposes `onprogress` via its per-entry add() options. Settings persistence reuses the existing `useSettings` localStorage layer.

**Tech Stack:** React 19, TypeScript, Vite 7, @zip.js/zip.js, Vitest + happy-dom, @testing-library/react.

**Reference spec:** `docs/superpowers/specs/2026-04-21-feature-improvements-design.md` (Phase 1 section).

---

## File structure

**Files to MODIFY:**

| File | Why |
|---|---|
| `src/utils/normalizeFilename.ts` | Add `targetForm: 'NFC' \| 'NFD'` parameter (default 'NFC' = no behavior change) |
| `src/utils/normalizeFilename.test.ts` | Add NFC→NFD test cases |
| `src/utils/zipFiles.ts` | Accept optional `onProgress` and `targetForm` in `ZipOptions`; thread into the add loop |
| `src/utils/zipFiles.test.ts` | Add tests for progress callback firing and NFD output |
| `src/hooks/useSettings.ts` | Add `normalizationForm` to `Settings` interface and DEFAULT_SETTINGS |
| `src/hooks/useSettings.test.ts` | Add tests for new setting persistence + default |
| `src/hooks/useFileProcessor.ts` | Track `progress` state; consume `normalizationForm` from settings; pass both into `createZip` |
| `src/hooks/useFileProcessor.test.ts` | Add tests for progress updates and direction-aware output |
| `src/components/DownloadButton.tsx` | Render `<Progress>` when progress > 0; add segmented NFC↔NFD direction toggle UI |
| `src/App.tsx` | Wire `useKeyboardShortcuts` with action handlers from `useFileProcessor` |

**Files to CREATE:**

| File | Why |
|---|---|
| `src/hooks/useKeyboardShortcuts.ts` | Global keyboard shortcut hook with cross-platform Cmd/Ctrl detection and input-focus exclusion |
| `src/hooks/useKeyboardShortcuts.test.ts` | Tests for binding, modifier handling, and input-focus exclusion |

**No npm dependencies added.** `<Progress>` already in `src/components/ui/progress.tsx` (no Radix dep — pure CSS). All other code uses the existing toolset.

---

## Branch strategy

Single branch, single PR: `feat/phase-1-polish-pack`. Each task ends with a focused commit so reviewers can step through the diff.

---

## Task 0: Setup branch

- [ ] **Step 1: Sync main and create the feature branch**

```bash
git checkout main
git pull --ff-only
git checkout -b feat/phase-1-polish-pack
```

Expected: clean working tree, new branch tracking nothing yet.

---

## Task 1: Extend `normalizeFilename` with target form parameter

Adds the API surface needed by 1B (bidirectional direction toggle). Default behavior is unchanged so this commit is a pure refactor when isolated.

**Files:**
- Modify: `src/utils/normalizeFilename.ts`
- Test: `src/utils/normalizeFilename.test.ts`

- [ ] **Step 1: Add failing tests for target-form parameter**

Add these tests at the end of `src/utils/normalizeFilename.test.ts` (inside the existing `describe('normalizeFilename', ...)` block):

```ts
describe('targetForm parameter', () => {
  it('defaults to NFC when no targetForm passed', () => {
    const nfd = '\u1100\u1161.txt'; // 가 (NFD)
    const nfc = '\uAC00.txt';
    expect(normalizeFilename(nfd)).toBe(nfc);
  });

  it('converts NFC to NFD when targetForm is NFD', () => {
    const nfc = '\uAC00.txt';        // 가 (NFC composed)
    const nfd = '\u1100\u1161.txt';  // 가 (NFD decomposed)
    expect(normalizeFilename(nfc, 'NFD')).toBe(nfd);
  });

  it('explicit NFC target matches default behavior', () => {
    const nfd = '\u1100\u1161.txt';
    const nfc = '\uAC00.txt';
    expect(normalizeFilename(nfd, 'NFC')).toBe(nfc);
  });

  it('leaves already-NFD filename unchanged when targetForm is NFD', () => {
    const nfd = '\u1100\u1161.txt';
    expect(normalizeFilename(nfd, 'NFD')).toBe(nfd);
  });

  it('handles full path with NFC→NFD conversion', () => {
    const nfcPath = '\uD3F4\uB354/\uD30C\uC77C.txt';  // 폴더/파일.txt
    const result = normalizeFilename(nfcPath, 'NFD');
    expect(result).toBe(nfcPath.normalize('NFD'));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- normalizeFilename`
Expected: 5 failures with `TypeError: ... is not a function` or similar — the second argument is being ignored.

- [ ] **Step 3: Add `targetForm` parameter to implementation**

Replace the body of `normalizeFilename` in `src/utils/normalizeFilename.ts`:

```ts
export type NormalizationForm = 'NFC' | 'NFD';

/**
 * Normalizes a filename to the requested Unicode normalization form.
 *
 * Default 'NFC' fixes the macOS→Windows case (NFD-decomposed Korean filenames
 * appear garbled on Windows). Use 'NFD' for the reverse direction
 * (Windows→macOS) when the destination expects decomposed form.
 */
export function normalizeFilename(
  filename: string,
  targetForm: NormalizationForm = 'NFC'
): string {
  return filename.normalize(targetForm);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- normalizeFilename`
Expected: All `normalizeFilename` tests pass (existing 7 + new 5 = 12).

- [ ] **Step 5: Commit**

```bash
git add src/utils/normalizeFilename.ts src/utils/normalizeFilename.test.ts
git commit -m "Add targetForm parameter to normalizeFilename (default NFC)"
```

---

## Task 2: Add `normalizationForm` to settings

Persists the user's choice of NFC vs NFD across sessions. Default 'NFC' keeps existing behavior.

**Files:**
- Modify: `src/hooks/useSettings.ts`
- Test: `src/hooks/useSettings.test.ts`

- [ ] **Step 1: Add failing test for new setting default**

Add these tests inside `src/hooks/useSettings.test.ts`'s `describe('default settings', ...)` block:

```ts
it('returns default normalizationForm of NFC', () => {
  const { result } = renderHook(() => useSettings());
  expect(result.current.settings.normalizationForm).toBe('NFC');
});
```

And add this test inside `describe('updateSetting', ...)`:

```ts
it('updates normalizationForm', () => {
  const { result } = renderHook(() => useSettings());

  act(() => {
    result.current.updateSetting('normalizationForm', 'NFD');
  });

  expect(result.current.settings.normalizationForm).toBe('NFD');
});

it('persists normalizationForm to localStorage', () => {
  const { result } = renderHook(() => useSettings());

  act(() => {
    result.current.updateSetting('normalizationForm', 'NFD');
  });

  const stored = JSON.parse(mockStorage.getItem(STORAGE_KEY)!);
  expect(stored.normalizationForm).toBe('NFD');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- useSettings`
Expected: 3 failures — `normalizationForm` is not on the type, default is undefined.

- [ ] **Step 3: Extend `Settings` interface and DEFAULT_SETTINGS**

In `src/hooks/useSettings.ts`, modify the imports and the `Settings` interface + `DEFAULT_SETTINGS`:

```ts
import { useState, useCallback } from 'react';
import type { NormalizationForm } from '@/utils/normalizeFilename';

const STORAGE_KEY = 'ikkonezip-settings';

export interface Settings {
  compressionLevel: 0 | 5 | 9;
  excludeSystemFiles: boolean;
  compressSingle: boolean;
  normalizationForm: NormalizationForm;
}

const DEFAULT_SETTINGS: Settings = {
  compressionLevel: 5,
  excludeSystemFiles: true,
  compressSingle: true,
  normalizationForm: 'NFC',
};
```

(The rest of the file — `loadSettings`, `saveSettings`, `useSettings` — stays unchanged; `updateSetting`'s generic `<K extends keyof Settings>` automatically picks up the new key.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- useSettings`
Expected: All 11 existing + 3 new = 14 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useSettings.ts src/hooks/useSettings.test.ts
git commit -m "Add normalizationForm setting (default NFC)"
```

---

## Task 3: Thread `targetForm` and `onProgress` through `zipFiles`

Adds the two new options to `ZipOptions`. `targetForm` shapes the output filenames; `onProgress` reports compression progress as files complete.

**Files:**
- Modify: `src/utils/zipFiles.ts`
- Test: `src/utils/zipFiles.test.ts`

- [ ] **Step 1: Add failing tests for new options**

Add these tests in `src/utils/zipFiles.test.ts` (find the existing `describe('createZip', ...)` block; add inside):

```ts
it('uses NFC normalization by default', async () => {
  const nfdName = '\u1100\u1161.txt'; // 가 (NFD)
  const file = new File(['x'], nfdName, { type: 'text/plain' });
  const blob = await createZip([{ file, path: nfdName }]);
  // Read back to verify entry name
  const reader = new ZipReader(new BlobReader(blob));
  const entries = await reader.getEntries();
  await reader.close();
  expect(entries[0].filename).toBe('\uAC00.txt'); // NFC composed
});

it('uses NFD normalization when targetForm is NFD', async () => {
  const nfcName = '\uAC00.txt'; // 가 (NFC)
  const file = new File(['x'], nfcName, { type: 'text/plain' });
  const blob = await createZip([{ file, path: nfcName }], { targetForm: 'NFD' });
  const reader = new ZipReader(new BlobReader(blob));
  const entries = await reader.getEntries();
  await reader.close();
  expect(entries[0].filename).toBe('\u1100\u1161.txt'); // NFD decomposed
});

it('calls onProgress at least once during a multi-file zip', async () => {
  const onProgress = vi.fn();
  const files = [
    { file: new File(['a'.repeat(1000)], 'a.txt'), path: 'a.txt' },
    { file: new File(['b'.repeat(1000)], 'b.txt'), path: 'b.txt' },
    { file: new File(['c'.repeat(1000)], 'c.txt'), path: 'c.txt' },
  ];
  await createZip(files, { onProgress });
  expect(onProgress).toHaveBeenCalled();
  // Progress should report final total of 3 entries
  const lastCall = onProgress.mock.calls[onProgress.mock.calls.length - 1];
  expect(lastCall).toEqual([3, 3]);
});

it('does not call onProgress when not provided', async () => {
  // Just make sure no crash when options omits onProgress
  const file = new File(['x'], 'a.txt');
  const blob = await createZip([{ file, path: 'a.txt' }]);
  expect(blob.size).toBeGreaterThan(0);
});
```

You'll also need to add `vi` and `ZipReader`, `BlobReader` to the imports at the top of the test file if they're not already there:

```ts
import { describe, it, expect, vi } from 'vitest';
import { createZip, /* ...existing imports... */ } from './zipFiles';
import { ZipReader, BlobReader } from '@zip.js/zip.js';
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- zipFiles`
Expected: 3 failures — `targetForm` ignored (still uses NFC), `onProgress` never called.

- [ ] **Step 3: Add the new options to `ZipOptions` and implement**

In `src/utils/zipFiles.ts`, modify the imports and `ZipOptions`:

```ts
import { BlobWriter, BlobReader, ZipWriter } from '@zip.js/zip.js';
import { normalizeFilename, type NormalizationForm } from './normalizeFilename';

export interface FileWithPath {
  file: File;
  path: string;
}

export interface ZipOptions {
  password?: string;
  compressionLevel?: number;
  excludeSystemFiles?: boolean;
  /** Unicode normalization form for output filenames. @defaultValue 'NFC' */
  targetForm?: NormalizationForm;
  /**
   * Called as entries finish compressing.
   * `current` = entries completed so far, `total` = total entries to write.
   */
  onProgress?: (current: number, total: number) => void;
}
```

Then modify `createZip` to thread both through:

```ts
export async function createZip(files: FileWithPath[], options: ZipOptions = {}): Promise<Blob> {
  const zipFileWriter = new BlobWriter('application/zip');
  const compressionLevel = options.compressionLevel ?? 5;
  const targetForm = options.targetForm ?? 'NFC';
  const excludeSystemFiles = options.excludeSystemFiles ?? true;

  const zipWriter = new ZipWriter(zipFileWriter, {
    password: options.password || undefined,
    encryptionStrength: 3,
    level: compressionLevel as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9,
  });

  // Pre-filter so total reflects the actual entry count
  const eligible = excludeSystemFiles
    ? files.filter(({ path }) => !shouldExclude(path))
    : files;

  if (eligible.length === 0) {
    await zipWriter.close();
    throw new Error('압축할 파일이 없습니다');
  }

  const total = eligible.length;
  let completed = 0;

  for (const { file, path } of eligible) {
    const normalizedPath = normalizeFilename(path, targetForm);
    await zipWriter.add(normalizedPath, new BlobReader(file));
    completed++;
    options.onProgress?.(completed, total);
  }

  await zipWriter.close();
  return await zipFileWriter.getData();
}
```

(The `fileCount === 0` throw moves up; everything else stays.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- zipFiles`
Expected: existing tests still green + 4 new tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/utils/zipFiles.ts src/utils/zipFiles.test.ts
git commit -m "Add targetForm and onProgress options to createZip"
```

---

## Task 4: Wire progress + normalizationForm into `useFileProcessor`

The hook surfaces a new `progress` state for the UI and consumes `normalizationForm` from settings.

**Files:**
- Modify: `src/hooks/useFileProcessor.ts`
- Test: `src/hooks/useFileProcessor.test.ts`

- [ ] **Step 1: Add failing test for `progress` state and direction-aware output**

Add to `src/hooks/useFileProcessor.test.ts` (inside the existing `describe('downloadAsZip', ...)` or similar block — create one if missing):

```ts
describe('progress tracking', () => {
  it('starts with progress null', () => {
    const { result } = renderHook(() => useFileProcessor());
    expect(result.current.progress).toBeNull();
  });

  it('updates progress during downloadAsZip', async () => {
    const { result } = renderHook(() => useFileProcessor());

    await act(async () => {
      await result.current.addFiles([
        createMockFile('a.txt'),
        createMockFile('b.txt'),
      ]);
    });

    await act(async () => {
      await result.current.downloadAsZip('test.zip');
    });

    // After completion, progress is reset to null
    expect(result.current.progress).toBeNull();
  });
});
```

(If `useFileProcessor.test.ts` doesn't already mock `useSettings`, you can rely on its default; the existing test setup mocks `downloadBlob` so no actual file is saved.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- useFileProcessor`
Expected: 2 failures — `progress` is undefined on the hook return.

- [ ] **Step 3: Add `progress` state and pass-through `onProgress`**

**Important design note:** `useFileProcessor` does NOT import `useSettings` — that would create state drift (each `useState` call inside `useSettings` gets its own copy). Instead, the caller (`DownloadButton`, Task 5) reads settings and passes `targetForm` into `downloadAsZip(filename, options)`. The hook just threads the option through to `createZip`.

In `src/hooks/useFileProcessor.ts`, leave the imports as-is (no new imports needed). Update the `UseFileProcessorReturn` interface to include `progress`:

```ts
export interface UseFileProcessorReturn {
  files: ProcessedFile[];
  isProcessing: boolean;
  error: string | null;
  folderName: string | null;
  needsPassword: boolean;
  progress: { current: number; total: number } | null;
  addFiles: (fileList: FileList | File[]) => Promise<void>;
  removeFile: (id: string) => void;
  removeFiles: (ids: string[]) => void;
  clearFiles: () => void;
  downloadAsZip: (zipFilename?: string, options?: ZipOptions) => Promise<void>;
  downloadSingle: () => void;
  submitZipPassword: (password: string) => Promise<void>;
  cancelZipPassword: () => void;
}
```

Add `progress` state inside the hook body (near the other `useState` calls):

```ts
const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
```

Update the `downloadAsZip` implementation to wire progress (no settings reference):

```ts
const downloadAsZip = useCallback(async (zipFilename: string = 'files.zip', options: ZipOptions = {}) => {
  if (files.length === 0) {
    setError('No files to download');
    return;
  }

  setIsProcessing(true);
  setError(null);
  setProgress({ current: 0, total: files.length });

  try {
    const fileData: FileWithPath[] = files.map(f => ({
      file: f.file,
      path: f.path,
    }));

    const zipBlob = await createZip(fileData, {
      ...options,
      onProgress: (current, total) => setProgress({ current, total }),
    });

    // ZIP filename always normalized to NFC (user types on NFC keyboard;
    // the per-entry filenames inside the zip honor options.targetForm).
    const datePrefix = getDatePrefix();
    const finalFilename = datePrefix + normalizeFilename(zipFilename);

    downloadBlob(zipBlob, finalFilename);
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Failed to create ZIP file');
  } finally {
    setIsProcessing(false);
    setProgress(null);
  }
}, [files]);
```

Add `progress` to the returned object at the bottom of the hook:

```ts
return {
  files,
  isProcessing,
  error,
  folderName,
  needsPassword,
  progress,
  addFiles,
  removeFile,
  removeFiles,
  clearFiles,
  downloadAsZip,
  downloadSingle,
  submitZipPassword,
  cancelZipPassword,
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- useFileProcessor`
Expected: All existing 41 tests still green + 2 new tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useFileProcessor.ts src/hooks/useFileProcessor.test.ts
git commit -m "Surface progress state and use normalizationForm in useFileProcessor"
```

---

## Task 5: Render Progress bar + NFC↔NFD toggle in `DownloadButton`

UI wiring for both 1A (progress bar) and 1B (direction toggle).

**Files:**
- Modify: `src/components/DownloadButton.tsx`

- [ ] **Step 1: Update component imports and props**

In `src/components/DownloadButton.tsx`, add the Progress import near the top:

```ts
import { Progress } from '@/components/ui/progress';
```

Add a Korean-locale icon for direction (Apple/Monitor are already imported in FileUploader; use the same):

```ts
import { Apple, Monitor } from 'lucide-react';
```

Extend `DownloadButtonProps` to receive the progress object:

```ts
interface DownloadButtonProps {
  fileCount: number;
  isProcessing: boolean;
  folderName: string | null;
  progress: { current: number; total: number } | null;
  onDownloadZip: (filename: string, options?: ZipOptions) => Promise<void>;
  onDownloadSingle: () => void;
}
```

Update the destructured signature:

```ts
export function DownloadButton({
  fileCount,
  isProcessing,
  folderName,
  progress,
  onDownloadZip,
  onDownloadSingle,
}: DownloadButtonProps) {
```

- [ ] **Step 2a: Pass `targetForm` from settings into the download options**

Find the existing `handleDownload` function and add `targetForm` to the options object:

```ts
const handleDownload = async () => {
  if (isSingleFile && !settings.compressSingle) {
    onDownloadSingle();
  } else {
    const options: ZipOptions = {
      compressionLevel: settings.compressionLevel,
      excludeSystemFiles: settings.excludeSystemFiles,
      targetForm: settings.normalizationForm,
    };
    if (password.trim()) {
      options.password = password.trim();
    }
    await onDownloadZip(zipFilename, options);
  }
};
```

This is what makes the user's NFC↔NFD choice actually affect the produced ZIP — `useFileProcessor` is decoupled from settings (see Task 4 design note), so settings → options handoff happens here.

- [ ] **Step 2b: Add the NFC↔NFD direction toggle UI**

Find the existing settings block in `DownloadButton.tsx` (the one with compression level buttons) and add a new direction row above it. Use the same visual pattern as the "압축률" row.

```tsx
{/* Normalization direction */}
<div className="flex items-center gap-3">
  <Label className="flex items-center gap-2 text-muted-foreground whitespace-nowrap w-16">
    방향
  </Label>
  <div className="flex-1 flex gap-2">
    <button
      type="button"
      onClick={() => updateSetting('normalizationForm', 'NFC')}
      className={cn(
        "flex-1 px-3 py-1.5 rounded-lg border-2 transition-all text-sm font-medium flex items-center justify-center gap-1.5",
        settings.normalizationForm === 'NFC'
          ? "border-primary bg-primary/10 text-primary"
          : "border-transparent bg-secondary text-muted-foreground hover:bg-secondary/80"
      )}
      aria-label="Mac에서 Windows로 (NFD → NFC)"
    >
      <Apple className="w-4 h-4" />
      → 
      <Monitor className="w-4 h-4" />
    </button>
    <button
      type="button"
      onClick={() => updateSetting('normalizationForm', 'NFD')}
      className={cn(
        "flex-1 px-3 py-1.5 rounded-lg border-2 transition-all text-sm font-medium flex items-center justify-center gap-1.5",
        settings.normalizationForm === 'NFD'
          ? "border-primary bg-primary/10 text-primary"
          : "border-transparent bg-secondary text-muted-foreground hover:bg-secondary/80"
      )}
      aria-label="Windows에서 Mac으로 (NFC → NFD)"
    >
      <Monitor className="w-4 h-4" />
      → 
      <Apple className="w-4 h-4" />
    </button>
  </div>
</div>
```

- [ ] **Step 3: Replace the spinner area with progress bar when progress > 0**

Find the existing button JSX (the `<Button>` with the `<Loader2 className="animate-spin" />` block). Modify the processing state to show the Progress bar:

```tsx
<Button
  onClick={handleDownload}
  disabled={isProcessing}
  size="lg"
  className={cn(
    "w-full gap-2",
    password.trim() && "gradient-button"
  )}
>
  {isProcessing ? (
    <>
      <Loader2 className="w-4 h-4 animate-spin" />
      {progress ? `압축 중... ${progress.current}/${progress.total}` : '압축 중...'}
    </>
  ) : (
    <>
      {/* existing non-processing block unchanged */}
    </>
  )}
</Button>
{isProcessing && progress && (
  <Progress
    value={(progress.current / progress.total) * 100}
    className="mt-2"
    aria-label={`압축 진행: ${progress.current}/${progress.total}`}
  />
)}
```

(The non-processing branch is unchanged — keep what's already there.)

- [ ] **Step 4: Update App.tsx to pass `progress` to DownloadButton**

In `src/App.tsx`, add `progress` to the destructure and pass it down:

```tsx
const {
  files,
  isProcessing,
  error,
  folderName,
  needsPassword,
  progress,
  // ... rest
} = useFileProcessor();
```

```tsx
<DownloadButton
  fileCount={files.length}
  isProcessing={isProcessing}
  folderName={folderName}
  progress={progress}
  onDownloadZip={downloadAsZip}
  onDownloadSingle={downloadSingle}
/>
```

- [ ] **Step 5: Run all checks**

```bash
npm run lint
npm run test:coverage
npm run build
```

Expected: lint clean, all tests pass at the existing baseline (100/94.25/100/100), build succeeds.

- [ ] **Step 6: Manual visual sanity check**

```bash
docker build -t ikkonezip-phase1 . && \
  docker run -d --name ikp1 -p 13010:3000 ikkonezip-phase1
```

Open http://localhost:13010 in a browser and:
- Upload a folder with 50+ files; click download; verify the progress bar moves and the count text updates
- Toggle the direction button; download a small file; extract the zip; verify the filename is in the chosen form (NFC or NFD)

Cleanup: `docker rm -f ikp1`

- [ ] **Step 7: Commit**

```bash
git add src/components/DownloadButton.tsx src/App.tsx
git commit -m "Render progress bar and NFC↔NFD direction toggle in DownloadButton"
```

---

## Task 6: Create `useKeyboardShortcuts` hook

Pure hook with input-focus exclusion and cross-platform Cmd/Ctrl handling.

**Files:**
- Create: `src/hooks/useKeyboardShortcuts.ts`
- Test: `src/hooks/useKeyboardShortcuts.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/hooks/useKeyboardShortcuts.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useKeyboardShortcuts, type ShortcutMap } from './useKeyboardShortcuts';

describe('useKeyboardShortcuts', () => {
  let actions: ShortcutMap;
  let downloadHandler: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    downloadHandler = vi.fn();
    actions = {
      'mod+o': vi.fn(),
      'mod+shift+o': vi.fn(),
      'enter': downloadHandler,
      'escape': vi.fn(),
    };
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  function fireKey(key: string, opts: KeyboardEventInit = {}) {
    window.dispatchEvent(new KeyboardEvent('keydown', { key, ...opts }));
  }

  it('fires the registered handler on plain key (Enter)', () => {
    renderHook(() => useKeyboardShortcuts(actions));
    fireKey('Enter');
    expect(actions['enter']).toHaveBeenCalledTimes(1);
  });

  it('fires the registered handler on Cmd+O (mod = metaKey)', () => {
    renderHook(() => useKeyboardShortcuts(actions));
    fireKey('o', { metaKey: true });
    expect(actions['mod+o']).toHaveBeenCalledTimes(1);
  });

  it('fires the registered handler on Ctrl+O (mod = ctrlKey)', () => {
    renderHook(() => useKeyboardShortcuts(actions));
    fireKey('o', { ctrlKey: true });
    expect(actions['mod+o']).toHaveBeenCalledTimes(1);
  });

  it('distinguishes mod+o and mod+shift+o', () => {
    renderHook(() => useKeyboardShortcuts(actions));
    fireKey('o', { metaKey: true, shiftKey: true });
    expect(actions['mod+shift+o']).toHaveBeenCalledTimes(1);
    expect(actions['mod+o']).not.toHaveBeenCalled();
  });

  it('does not fire when focus is in an <input>', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    renderHook(() => useKeyboardShortcuts(actions));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(downloadHandler).not.toHaveBeenCalled();
  });

  it('does not fire when focus is in a <textarea>', () => {
    const ta = document.createElement('textarea');
    document.body.appendChild(ta);
    ta.focus();

    renderHook(() => useKeyboardShortcuts(actions));
    ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(downloadHandler).not.toHaveBeenCalled();
  });

  it('does not fire when focus is in a contenteditable element', () => {
    const div = document.createElement('div');
    div.setAttribute('contenteditable', 'true');
    document.body.appendChild(div);
    div.focus();

    renderHook(() => useKeyboardShortcuts(actions));
    div.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(downloadHandler).not.toHaveBeenCalled();
  });

  it('removes listener on unmount', () => {
    const { unmount } = renderHook(() => useKeyboardShortcuts(actions));
    unmount();
    fireKey('Enter');
    expect(downloadHandler).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- useKeyboardShortcuts`
Expected: All fail because the file doesn't exist (`Cannot find module`).

- [ ] **Step 3: Implement the hook**

Create `src/hooks/useKeyboardShortcuts.ts`:

```ts
import { useEffect } from 'react';

export type ShortcutMap = Record<string, (event: KeyboardEvent) => void>;

/**
 * Global keyboard shortcut hook. Keys use a normalized format:
 *   "mod+o"        → Cmd+O on macOS or Ctrl+O elsewhere
 *   "mod+shift+o"  → adds Shift modifier
 *   "enter"        → plain Enter, no modifiers
 *   "escape"       → plain Escape
 *
 * Shortcuts do NOT fire when the user is typing in an editable element
 * (input, textarea, or contenteditable).
 */
export function useKeyboardShortcuts(shortcuts: ShortcutMap): void {
  useEffect(() => {
    function handler(event: KeyboardEvent) {
      if (isEditableTarget(event.target)) return;

      const combo = comboFromEvent(event);
      const action = shortcuts[combo];
      if (action) {
        event.preventDefault();
        action(event);
      }
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [shortcuts]);
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return true;
  if (target.isContentEditable) return true;
  return false;
}

function comboFromEvent(event: KeyboardEvent): string {
  const parts: string[] = [];
  if (event.metaKey || event.ctrlKey) parts.push('mod');
  if (event.shiftKey) parts.push('shift');
  if (event.altKey) parts.push('alt');
  parts.push(event.key.toLowerCase());
  return parts.join('+');
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- useKeyboardShortcuts`
Expected: 8 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useKeyboardShortcuts.ts src/hooks/useKeyboardShortcuts.test.ts
git commit -m "Add useKeyboardShortcuts hook with input-focus exclusion"
```

---

## Task 7: Wire shortcuts in `App.tsx`

Connects the hook to the existing `useFileProcessor` actions.

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add the hook invocation with action map**

In `src/App.tsx`, add the import:

```ts
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
```

Add `useRef` for the file/folder input refs (if not already present — currently the FileUploader owns the refs). For Phase 1 MVP we'll use a simple programmatic click via querySelector. Inside the App component, just after the `useFileProcessor` destructure, add:

```ts
useKeyboardShortcuts({
  'mod+o': () => {
    // Click the hidden file input that FileUploader rendered
    const input = document.querySelector<HTMLInputElement>(
      'input[type="file"]:not([webkitdirectory])'
    );
    input?.click();
  },
  'mod+shift+o': () => {
    const input = document.querySelector<HTMLInputElement>(
      'input[type="file"][webkitdirectory]'
    );
    input?.click();
  },
  'enter': () => {
    if (files.length > 0 && !isProcessing) {
      // Use default zip filename — same as button click with empty input
      void downloadAsZip();
    }
  },
  'escape': () => {
    if (files.length > 0) clearFiles();
  },
});
```

- [ ] **Step 2: Run all checks**

```bash
npm run lint
npm run test:coverage
npm run build
```

Expected: lint clean, all tests pass at baseline, build succeeds.

- [ ] **Step 3: Manual smoke test**

```bash
docker build -t ikkonezip-phase1 . && \
  docker rm -f ikp1 2>/dev/null; \
  docker run -d --name ikp1 -p 13010:3000 ikkonezip-phase1
```

Open http://localhost:13010 in a browser and verify:
- `Cmd+O` (Mac) or `Ctrl+O` (other) opens the file picker
- `Cmd+Shift+O` opens the folder picker
- After uploading a file, `Enter` triggers download
- After uploading a file, `Esc` clears the list
- Typing in any input field does NOT trigger shortcuts

Cleanup: `docker rm -f ikp1`

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "Wire keyboard shortcuts to file processor actions"
```

---

## Task 8: Final integration check + bundle/lighthouse verification

Catches anything missed by per-task tests.

- [ ] **Step 1: Run the full CI gate locally**

```bash
npm run lint
npm run test:coverage
npm run build
./scripts/check-bundle-size.sh
```

Expected:
- Lint: clean
- Tests: 121 + new tests pass; coverage stays at 100/94.25/100/100 (or improves)
- Build: succeeds, PWA precache 20+ entries
- Bundle: JS under 500 KB, CSS under 200 KB

- [ ] **Step 2: Run Lighthouse against the production build**

```bash
rm -rf .lighthouseci
npx --yes @lhci/cli@0.15 collect --staticDistDir=./dist --numberOfRuns=1 --settings.preset=desktop
```

Open the report URL printed at the end. Verify all four categories still score 1.0 (100/100/100/100).

- [ ] **Step 3: Push the branch**

```bash
git push -u origin feat/phase-1-polish-pack
```

- [ ] **Step 4: Open the PR**

```bash
gh pr create --base main --head feat/phase-1-polish-pack \
  --title "Phase 1: real progress bar, bidirectional NFC↔NFD, keyboard shortcuts" \
  --body "$(cat <<'EOF'
## Summary

Implements Phase 1 of the [feature improvements design](docs/superpowers/specs/2026-04-21-feature-improvements-design.md). Three small UX wins bundled in one PR.

### 1A — Real progress bar
- `useFileProcessor` exposes `progress: { current, total } | null`
- `createZip` calls `onProgress(completed, total)` after each entry
- `DownloadButton` renders a `<Progress>` bar (existing CSS-only component, no new dep) when zipping

### 1B — Bidirectional NFC↔NFD
- `normalizeFilename` accepts `targetForm: 'NFC' | 'NFD'` (default 'NFC')
- New `normalizationForm` setting persists choice across sessions
- Direction toggle in DownloadButton (Apple→Windows / Windows→Apple icons)

### 1C — Keyboard shortcuts
- New `useKeyboardShortcuts` hook with input-focus exclusion + cross-platform mod key
- `Cmd/Ctrl+O` opens file picker, `Cmd/Ctrl+Shift+O` opens folder picker
- `Enter` triggers download when files loaded, `Esc` clears the list

## Test plan

- [x] `npm run lint`, `npm run test:coverage`, `npm run build` all pass
- [x] Coverage stays at 100/94.25/100/100 (or improves)
- [x] Bundle stays under budget
- [x] Lighthouse: 100/100/100/100
- [x] Manual: progress bar moves on a 50+ file folder
- [x] Manual: NFD output verified by extracting a test ZIP
- [x] Manual: shortcuts work, are blocked when typing in inputs

## Notes for reviewer

No new npm dependencies — `<Progress>` was already in the shadcn ui kit (`src/components/ui/progress.tsx`, hand-rolled CSS).
EOF
)"
```

- [ ] **Step 5: Watch CI green**

```bash
RUN_ID=$(gh run list --branch feat/phase-1-polish-pack --limit 1 --json databaseId --jq '.[0].databaseId')
gh run watch "$RUN_ID" --exit-status
```

If anything fails, fix in place, commit, push. Re-watch.

---

## Self-review checklist (run before declaring "done")

- [ ] All 8 tasks committed
- [ ] Each commit message uses imperative mood matching the existing repo style ("Add X" not "Added X")
- [ ] No new npm dependencies introduced (verify with `git diff main -- package.json`)
- [ ] All acceptance criteria from the design spec satisfied:
  - [ ] Zipping a 100-file folder shows real-time progress
  - [ ] Settings UI has a clear NFC↔NFD toggle; choice persists across sessions
  - [ ] `Cmd+O` opens file picker on Mac, `Ctrl+O` on Windows; `Enter` downloads when files loaded; `Esc` clears
  - [ ] Lighthouse a11y still 100
  - [ ] All existing tests pass; new tests bring 100% coverage on the new code
- [ ] Manual smoke tests in browser passed (progress moves, direction toggle works, shortcuts fire)

---

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| `onprogress` per-entry doesn't fire for very small files (zip.js may bypass progress callback) | Test 3 of Task 3 verifies `onProgress` fires at least once for a 3-file zip; if it doesn't, fall back to manual increment after `await zipWriter.add()` (already in plan) |
| `Enter` shortcut interferes with the password input in `ZipPasswordPrompt` | The `useKeyboardShortcuts` hook excludes events fired from `<input>` elements; password modal uses a real input so this is covered |
| Cross-platform Cmd/Ctrl confusion in shortcut tests | Tests in Task 6 cover both `metaKey` and `ctrlKey` paths explicitly |
| The direction toggle UI is in Korean — translation/icon ambiguity | Use Apple and Monitor icons + arrow notation for self-explanatory direction; aria-labels in Korean spell it out for screen readers |

---

## Done definition

When all of the following are true, Phase 1 is complete:
1. PR `feat/phase-1-polish-pack` is merged to main
2. Coolify deploy reports `running:healthy`
3. The live site at `https://zip.1kko.com/` exhibits all three features (verify in browser)
4. No new Lighthouse a11y/performance/best-practices/SEO regressions
