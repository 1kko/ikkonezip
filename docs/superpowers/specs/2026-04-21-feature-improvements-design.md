# Feature improvements — design

**Date**: 2026-04-21
**Status**: Approved during brainstorming session; awaiting plan
**Owner**: 1kko

## Goal

Ship 7 user-facing improvements to ikkonezip in three phases. Each phase
ships independently. Phases 2 and 3 use parallel subagents in git
worktrees to compress wall-clock time; Phase 1 ships as one bundled PR.

## Non-goals

- No backend or server-side processing — ikkonezip remains a static SPA
- No third-party telemetry or trackers (see project memory: "no trackers
  promise")
- No new file format support beyond ZIP (TAR/7z deferred)
- No URL/clipboard upload paths in this batch (separate brainstorm)

## What's in scope

| Phase | Items | Effort | Parallel? |
|---|---|---|---|
| Phase 1 — Polish pack | C1 progress bar, A3 bidirectional NFC↔NFD, C4 keyboard shortcuts | ~1 day | No (bundle) |
| Phase 2 — Per-file actions | Prep refactor, A1 inline filename edit, A2 preview-before-convert, C2 image thumbnails | ~2-3 days | Yes (post-refactor) |
| Phase 3 — Rename rules | A4 regex/rename rules engine + UI + integration | ~3-5 days | Yes (engine and UI parallel) |

C3 (bulk select) was originally in Phase 1; dropped after reading
`FileList.tsx:43-126` and finding it already implemented. C2 was
originally "size + type + thumbnails"; narrowed to thumbnails only since
size and type icons already ship.

---

## Phase 1 — Polish pack

Three small, independent UX wins shipped as one PR. ~1 day total.
Skipping parallel: setup overhead would eat the gain on items this small.

### 1A — Real progress bar

Replaces the spinner during ZIP creation with a real progress bar driven
by `ZipWriter.add()`'s `onprogress` callback.

**Architecture**:
- `useFileProcessor.ts`: add `progress: { current: number; total: number } | null` to the hook's return; wire `ZipWriter` `onprogress` events to update it
- `DownloadButton.tsx`: when `isProcessing && progress`, render a `<Progress>` component (add `@radix-ui/react-progress`) instead of just the spinner; spinner remains for the brief pre-progress phase
- Fallback: if `onprogress` doesn't fire, the spinner stays visible — no regression

**Tests**: `useFileProcessor.test.ts` gains 1-2 tests verifying `progress` updates fire during a real `createZip` call.

### 1B — Bidirectional NFC↔NFD

Lets users explicitly choose normalization direction. Default stays NFC
(Mac → Windows) so existing users see no change.

**Architecture**:
- `normalizeFilename.ts`: add `normalizationForm: 'NFC' | 'NFD' = 'NFC'` parameter
- `useSettings.ts`: add `normalizationForm` to settings persistence
- `DownloadButton.tsx`: small toggle in settings UI ("Mac → Windows" / "Windows → Mac" segment control)
- `useFileProcessor.ts`: thread the setting through to the zip pipeline

**Tests**: `normalizeFilename.test.ts` gains ~5 NFC→NFD test cases.

### 1C — Keyboard shortcuts

| Binding | Action |
|---|---|
| `Cmd/Ctrl+O` | Open file picker |
| `Cmd/Ctrl+Shift+O` | Open folder picker |
| `Enter` | Trigger download (when files loaded) |
| `Esc` | Clear all files |

**Architecture**:
- New `src/hooks/useKeyboardShortcuts.ts`: thin hook accepting an action map; attaches/detaches `keydown` listeners; cross-platform Cmd vs Ctrl detection via `event.metaKey || event.ctrlKey`
- `App.tsx`: invoke the hook with action handlers wired to existing `addFiles` / `downloadAsZip` / `clearFiles`
- Skip shortcuts when focus is in an `<input>` (avoid hijacking typing)
- `<kbd>` hint UI deferred (separate follow-up if requested)

**Tests**: New `useKeyboardShortcuts.test.ts` — 5-6 tests covering bind/unbind, modifier handling, input-focus exclusion.

### Phase 1 acceptance criteria

- [ ] Zipping a 100-file folder shows real-time progress
- [ ] Settings UI has a clear NFC↔NFD toggle; choice persists across sessions
- [ ] `Cmd+O` opens file picker on Mac, `Ctrl+O` on Windows; `Enter` downloads when files loaded; `Esc` clears
- [ ] Lighthouse a11y still 100
- [ ] All existing tests pass; new tests bring 100% coverage on new code

### Phase 1 file ownership (if parallel chosen — recommendation: bundle)

| Track | Files |
|---|---|
| 1A | `useFileProcessor.ts`, `DownloadButton.tsx` |
| 1B | `normalizeFilename.ts`, `useSettings.ts`, `useFileProcessor.ts`, `DownloadButton.tsx` |
| 1C | New `useKeyboardShortcuts.ts`, `App.tsx` |

1A and 1B both touch `useFileProcessor.ts` and `DownloadButton.tsx` —
parallel here loses ~1hr to merge conflicts vs ~6hr serial-bundled total.
Bundling is faster.

---

## Phase 2 — Per-file actions

Prep refactor + 3 features that all touch the per-file UI surface.
~2-3 days; parallel after the prep refactor.

### Prep refactor (single PR before parallel work begins, ~2hr)

`FileList.tsx` is currently 171 lines, single component. Three Phase 2
features all need to add or modify per-row UI. Without splitting, agents
conflict on the same JSX block.

**New structure**:
```
src/components/FileList.tsx                  (parent — was 171 lines, becomes ~80)
src/components/FileListRow.tsx               (NEW — single-row layout, ~30 lines)
src/components/FileListRowFilename.tsx       (NEW — filename column, ~15 lines)
src/components/FileListRowMeta.tsx           (NEW — icon + size + NFD badge, ~30 lines)
```

`FileListRow` accepts `file: ProcessedFile` and renders the existing row
layout, delegating to its sub-components. `FileList` keeps the
bulk-select state, scroll container, and header.

**Tests added during refactor**:
- `FileList.test.tsx` — render with N files, verify N rows; bulk-select toggles
- `FileListRow.test.tsx` — render single file, verify filename/size/NFD badge present

**Risk mitigation**: Take screenshots before/after the refactor (light + dark + with NFD files); diff visually before merging.

### 2A — Preview-before-convert

Modal showing rename diffs (`originalName` → `normalizedName`) for files
that need normalization. User confirms or cancels before download
proceeds.

**Architecture**:
- New `src/components/PreviewModal.tsx`: takes `files: ProcessedFile[]`, renders a list of `오리지널 → 정규화` rows with a confirm/cancel footer; uses shadcn `<Dialog>` (add `@radix-ui/react-dialog`)
- `App.tsx` integration: one new state `[previewOpen, setPreviewOpen]`, gate the existing download flow through the modal when at least one file has `needsNormalization === true`
- MVP: no per-file skip (just preview-or-cancel); skip toggle deferred

**Tests**: `PreviewModal.test.tsx` — renders rename diffs; confirm/cancel callbacks fire.

### 2B — Inline filename editing

Click filename in the file list → switch to `<Input>`. Enter or blur
commits, Escape cancels.

**Architecture**:
- `FileListRowFilename.tsx` (owned solely by 2B): adds local edit state; commit calls `onRename(id, newName)` callback
- `useFileProcessor.ts`: add `renameFile(id: string, newName: string)` action; updates `normalizedName` and `normalizedPath`; leaves `originalName` untouched
- `FileList.tsx` passes `onRename` down to rows

**Edge cases**:
- Empty input → revert to previous name (no commit)
- Duplicate name within the same folder → inline error border, no commit
- Filenames containing `/` → strip them (path injection prevention)

**Tests**: `FileListRowFilename.test.tsx` (edit toggle, escape cancels, enter commits) + new `useFileProcessor` test for `renameFile`.

### 2C — Image thumbnails

Replace the static file icon with a thumbnail when the file is an image.

**Architecture**:
- New `src/hooks/useThumbnail.ts`: takes a `File`, returns `string | null` data URL via `URL.createObjectURL(file)` for images; null for non-images; revokes URL on cleanup
- `FileListRowMeta.tsx` (owned solely by 2C): replaces the static file icon with the thumbnail when one exists; falls back to icon otherwise
- IntersectionObserver-driven lazy generation to avoid memory spikes on 1000-file uploads

**Performance**: Eager generation for hundreds of images would hang the browser. Lazy via IntersectionObserver.

**Tests**: `useThumbnail.test.ts` — image file returns URL, non-image returns null, cleanup revokes URLs.

### Phase 2 acceptance criteria

- [ ] Refactor PR: identical visual output before/after; FileList tests pass; no behavior change
- [ ] Preview modal opens when downloading files needing normalization; cancel returns to file list
- [ ] Inline edit: click filename → edit → Enter commits, Esc cancels; duplicate names blocked
- [ ] Thumbnails appear for image files (jpg/png/gif/webp); fall back to icon for others; lazy-load via IntersectionObserver
- [ ] Bundle size stays under 500 KB JS budget
- [ ] Lighthouse still 100/100/100/100

### Phase 2 file ownership (after prep refactor)

| Track | Allow-listed files |
|---|---|
| 2A | New `PreviewModal.tsx`; `App.tsx` (one import + one Dialog instance) |
| 2B | `FileListRowFilename.tsx` only; `useFileProcessor.ts` (new `renameFile` action) |
| 2C | New `useThumbnail.ts`; `FileListRowMeta.tsx` only |

`useFileProcessor.ts` is touched only by 2B in this phase — no overlap.
`App.tsx` is touched only by 2A in this phase — no overlap.

---

## Phase 3 — Rename rules

Power-user feature: define rename rules that transform multiple
filenames in bulk. Builds on Phase 2's preview modal so users see rule
effects before commit. ~3-5 days; splits cleanly into 3 parallel tracks.

### Rule data model

```ts
export type Rule =
  | { kind: 'replace'; pattern: string; replacement: string; isRegex: boolean; scope: RuleScope }
  | { kind: 'prefix'; text: string; scope: RuleScope }
  | { kind: 'suffix'; text: string; scope: RuleScope }
  | { kind: 'transform'; op: 'lowercase' | 'uppercase' | 'trim'; scope: RuleScope };

export type RuleScope =
  | { type: 'all' }
  | { type: 'extension'; ext: string }
  | { type: 'needsNormalization' };
```

Multiple rules apply in order. Per-rule scopes (not a single global
filter) for flexibility.

### 3A — Rule engine (pure functions)

**File**: `src/utils/renameRules.ts` (NEW)

**API**:
```ts
export function applyRules(filename: string, rules: Rule[]): string;
export function previewRules(files: ProcessedFile[], rules: Rule[]): RulePreview[];
```

**Error handling**:
- Invalid regex pattern → `applyRules` throws `RuleError` with index of bad rule
- Replacement that produces empty filename → revert to original
- Replacement that produces a path-injection (`/`, `..`) → strip illegal chars

**Tests**: New `renameRules.test.ts` — every rule kind × every scope × edge cases (empty, regex errors, conflicts). Target: 100% coverage on this file.

### 3B — Rule definition UI

**File**: `src/components/RenameRulesPanel.tsx` (NEW)

Collapsible card under the file list with "+ Add rule" button. Each
rule renders as a row with: kind dropdown, pattern input, replacement
input (or N/A for transforms), scope selector, drag handle (reorder),
remove button.

Drag-to-reorder via `@dnd-kit/sortable` (~10 KB gzipped). MVP could use
up/down buttons instead — open question.

State local to the panel, lifted to App via `onRulesChange(rules: Rule[])`.
Persisted to localStorage via `useSettings.ts` (small extension).

**Tests**: `RenameRulesPanel.test.tsx` — add/remove/edit a rule, drag-to-reorder, validation errors render correctly.

### 3C — Integration

**Waits for 3A and 3B** to ship their APIs first.

**Architecture**:
- `App.tsx`: keeps `[rules, setRules]`, passes to `RenameRulesPanel` for editing and to `PreviewModal` for showing rule effects
- Modify Phase 2's `PreviewModal` to accept rules and show post-rule names in the right column (instead of just NFC-normalized)
- `useFileProcessor.ts`: gain a `rules` parameter on `downloadAsZip(zipFilename, options, rules)`; inside, run `applyRules(file.normalizedName, rules)` before adding to ZIP

**Data flow**:
```
[Files] → NFC normalize → applyRules → preview → ZIP
                                          ↑
                         user sees post-rule names, can cancel
```

**Error handling**: If rules fail validation when user clicks Download, show inline error in the preview modal: "Rule #2: Invalid regex `[abc`". Don't open the modal.

**Tests**: Integration test for `downloadAsZip` with rules — 1 happy path, 1 invalid-regex path.

### Phase 3 acceptance criteria

- [ ] User can add, remove, reorder, and edit rules in the UI
- [ ] Rules persist across browser sessions (localStorage)
- [ ] Preview modal shows post-rule filenames (not just NFC-normalized)
- [ ] Invalid regex shows inline error, doesn't crash
- [ ] All 4 rule kinds (replace/prefix/suffix/transform) × all 3 scopes work and are tested
- [ ] Zero rules defined → app behaves identically to today (no regression)
- [ ] Bundle size stays under 500 KB JS budget
- [ ] Lighthouse still 100/100/100/100

### Phase 3 file ownership

| Track | Allow-listed files |
|---|---|
| 3A | New `src/utils/renameRules.ts`, new `renameRules.test.ts` |
| 3B | New `src/components/RenameRulesPanel.tsx`, `useSettings.ts` (small addition) |
| 3C | `App.tsx`, `useFileProcessor.ts`, `PreviewModal.tsx` (waits for 3A and 3B) |

3A and 3B run truly parallel (1.5 days each), 3C runs alone after both
(~1 day) = 2.5 days vs 3-5 days serial.

---

## Deferred items

These were considered and intentionally deferred:

- **Rule presets and rule sharing** (Phase 3): "save my favorite ruleset" or "share via URL". Easy follow-ups; data model already supports.
- **Per-file skip in preview modal** (Phase 2): toggle to skip normalization on specific files. MVP is preview-or-cancel only.
- **`<kbd>` hint UI for keyboard shortcuts** (Phase 1): visual indicators on buttons. MVP has shortcuts but no on-screen hints.
- **Up/down reorder buttons as fallback for drag-and-drop** (Phase 3): if `@dnd-kit/sortable` adds too much weight, swap to buttons.
- **TAR / 7z output formats**: separate brainstorm.
- **URL / clipboard upload paths**: separate brainstorm.

---

## Cross-phase concerns

### Test coverage strategy

- Each phase must keep `npm run test:coverage` at the existing 100/94/100/100 baseline (statements/branches/functions/lines on hooks and utils)
- New components added in Phases 2 and 3 should have tests — exact threshold for component coverage to be set in writing-plans
- The prep refactor (Phase 2) adds the first FileList component tests; future component additions inherit that pattern

### Bundle budget

- Current: JS 395.6 KB / 500 KB (79% of budget); CSS 29.3 KB / 200 KB (15%)
- Phase 1 net addition: ~5 KB (Progress component + small hook code)
- Phase 2 net addition: ~10 KB (Dialog component + thumbnail hook + refactor neutral)
- Phase 3 net addition: ~15 KB (rule engine + UI; +10 KB if `@dnd-kit/sortable` ships)
- Total projected: ~425 KB JS — still under budget

### Accessibility

Each phase's new UI must keep Lighthouse a11y at 100:
- Progress bar: `<Progress>` from Radix has built-in `aria-*` attributes
- Inline edit: `<Input>` needs `aria-label` referencing the original filename
- Preview modal: Radix `<Dialog>` ships with focus trap and `aria-labelledby`
- Rule panel: each input needs `aria-describedby` for validation errors
- Keyboard shortcuts: must not interfere with native focus/tab order

### Dependencies to add

| Phase | Dep | Size (gzipped) |
|---|---|---|
| 1 | `@radix-ui/react-progress` | ~3 KB |
| 2 | `@radix-ui/react-dialog` | ~8 KB |
| 3 | `@dnd-kit/sortable` (optional) | ~10 KB |

All dev deps go through Dependabot security alerts (PR-flow disabled per
recent decision; manual `npm audit` cadence applies).

---

## Execution model

### Phase 1: serial, single PR
Bundle 1A + 1B + 1C into one PR. Single agent. ~1 day.

### Phase 2: prep PR + 3 parallel agents
1. Prep refactor PR (single agent or human, ~2hr) — splits FileList; lands first
2. Create 3 git worktrees for 2A / 2B / 2C
3. Dispatch 3 parallel subagents via `superpowers:dispatching-parallel-agents`
4. Each subagent works to its acceptance criteria + writes tests
5. Each opens its own PR; merge in any order (file-ownership prevents conflicts)

### Phase 3: 2 parallel + 1 serial
1. Create 2 git worktrees for 3A and 3B
2. Dispatch 2 parallel subagents
3. After both merge to main, single agent (or human) executes 3C integration
4. 3C opens one PR

---

## Open questions / decisions deferred to writing-plans

- Exact `<Progress>` component customization (style, indeterminate vs determinate behavior on slow `onprogress` events)
- Per-rule UI ergonomics (compact vs roomy layout for the rules panel)
- Whether the preview modal supports keyboard navigation (Tab through file list)
- Whether to ship Phase 1 + Phase 2 prep refactor as a single PR or two separate PRs
