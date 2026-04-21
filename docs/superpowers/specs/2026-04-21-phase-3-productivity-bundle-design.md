# Phase 3 — Productivity Bundle Design

**Date:** 2026-04-21
**Status:** Approved (design)
**Scope:** Four independent productivity features, executable in parallel.

## Goals

Raise the ceiling of the app for users who handle many files, by fixing three quality-of-life gaps and one reachability gap:

1. **PWA update toast** — returning users discover new features without manually closing all tabs.
2. **Drag-to-reorder** — users control the order of entries inside the output ZIP.
3. **Rename persists into ZIP** — inline filename edits flow through to the actual ZIP entry paths (fixes a Phase 2B gap).
4. **Search/filter in file list** — at ≥50 files, a search box appears so users can locate and operate on subsets.

## Non-goals

- Cloud storage, uploads to a server, or multi-device sync. The "no trackers" promise still applies; everything runs in-browser.
- Full keyboard commander UX (Cmd-K palette). Out of scope.
- Saved search/recent searches. Out of scope.

## Execution Model

Four features, one spec, four independent implementation tracks. After writing the plan, execute each track in its own git worktree via parallel subagent-driven development (same pattern that shipped Phase 2). Each track owns a distinct file set; no cross-track merge conflicts expected.

| Track | Deps added | Cross-cutting risk |
|-------|------------|---------------------|
| 1. PWA toast | none | touches `vite.config.ts`, `main.tsx`, `App.tsx` |
| 2. DnD reorder | `@dnd-kit/core`, `@dnd-kit/sortable` | touches `FileList.tsx`, `FileListRow.tsx`, `useFileProcessor.ts` |
| 3. Rename → ZIP | none | touches `useFileProcessor.ts`, `zipFiles.ts` |
| 4. Search/filter | none | touches `FileList.tsx` only (+ one new child) |

Tracks 2 and 3 both edit `useFileProcessor.ts`. Integration order: ship track 3 first (single-line wiring), then track 2 (adds `reorderFiles` action). Track 4 is fully isolated.

## Feature 1 — PWA Update Toast

### Architecture

- Switch `vite-plugin-pwa` from the current silent registration to `registerType: 'prompt'`.
- Use the plugin's `useRegisterSW` hook (no new runtime dep; it ships inside the plugin).
- New component `src/components/PwaUpdateToast.tsx`: fixed-position toast, bottom-center, with two actions.
- Mounted once from `src/App.tsx`.

### UX

- Toast copy (Korean): title `새 버전 사용 가능`, body `새로고침하면 최신 버전이 적용됩니다`.
- Primary button: `새로고침` (triggers `updateSW(true)`; the plugin reloads after SW activation).
- Secondary: X close button. Dismissal is remembered for the current app version only — if the SW later detects *another* update, the toast reappears.
- Animation: fade + slide-up, respects `prefers-reduced-motion` (no motion when set).

### Error handling

If `updateSW` throws, fall back to `location.reload()`. Extremely unlikely but cheap insurance.

### Testing

- Unit test for the dismissal-state hook: dismiss once → toast stays hidden for that version string; new version → toast reappears.
- No E2E in this phase — requires a real SW cycle, which is out of scope for Vitest.
- Lighthouse PWA score must not drop.

### Acceptance

- [ ] On next deploy after first install, a returning user sees the toast within 5s of the SW detecting an update.
- [ ] Clicking `새로고침` reloads the tab with the new bundle.
- [ ] Dismissed toast does not reappear until a new update is available.
- [ ] No regression in Lighthouse PWA category.

---

## Feature 2 — Drag-to-Reorder

### Architecture

- Add `@dnd-kit/core@^6` and `@dnd-kit/sortable@^8`.
- Wrap `FileList` children in `DndContext` + `SortableContext`.
- Each `FileListRow` uses `useSortable({ id: file.id })`; it exposes `listeners` and `attributes` that bind to a new left-side drag handle (grip icon).
- New action `reorderFiles(fromId: string, toId: string)` on `useFileProcessor` — uses `arrayMove` from `@dnd-kit/sortable`. State update is a pure index swap; it does not touch any file contents.
- Drag handle is a small `button` with `aria-label="파일 순서 변경 핸들"`, placed before the row's selection checkbox. The handle is the ONLY drag surface — clicking elsewhere on the row keeps existing selection behavior.

### Accessibility

- `@dnd-kit`'s `KeyboardSensor` wired with `sortableKeyboardCoordinates`.
- Keyboard flow: Tab to handle → Space to grab → ArrowUp/Down to move → Space to drop, Esc to cancel.
- Screen-reader announcements via `@dnd-kit`'s built-in live region.

### Output contract

The order of entries inside the ZIP MUST match the order of `files` in state. Already true because `downloadAsZip` maps over `files` in array order — no change to `zipFiles.ts` required.

### Testing

- Unit test for `reorderFiles`: 3 files, reorder index 0 → 2, state array order matches.
- Component test on FileListRow: drag handle renders with aria-label; clicking the handle focus but does not toggle selection.
- No end-to-end drag simulation in unit tests (too brittle); rely on @dnd-kit's own test suite.

### Acceptance

- [ ] Mouse drag on the handle reorders visible rows.
- [ ] Touch drag works on mobile (iOS Safari + Android Chrome).
- [ ] Keyboard-only reorder works (Tab, Space, Arrow, Space).
- [ ] Output ZIP entries appear in the new user-specified order.
- [ ] Existing bulk-selection UI is unaffected by the handle.

---

## Feature 3 — Rename Persists Into ZIP

### Bug being fixed

`useFileProcessor.renameFile` (Phase 2B) updates `normalizedName` and `normalizedPath` for display purposes. But `downloadAsZip` maps `{ file: f.file, path: f.path }` — still the original upload path. So the user sees the renamed file in the UI but the ZIP entry keeps the old name.

### Fix

One-line wiring: `downloadAsZip` changes `path: f.path` to `path: f.normalizedPath`. `normalizedPath` is already maintained by the existing code — it's set at upload (to the NFC form of the original path) and updated by `renameFile` when the user edits. So it transparently carries both the rename and the at-upload NFC normalization.

### Interaction with NFC↔NFD toggle

Unchanged. `zipFiles.ts` continues to apply the `targetForm` normalization per entry path. Since `normalizedPath` is NFC on input, the toggle normalizes from NFC to NFC (no-op) or NFC to NFD (re-encode) as the user picks — same behavior users saw in Phase 1 for un-renamed files, now extended transparently to renamed ones.

### Testing

New cases in `useFileProcessor.test.ts` and `zipFiles.test.ts`:

- Rename then download — ZIP entry path equals the new name, not the original.
- Rename in NFC mode → entry stays NFC even if the form toggle is set to NFD.
- No rename → target-form toggle still works as before (regression check).

### Acceptance

- [ ] Rename `foo.txt` → `bar.txt`, download ZIP, extract — archive contains exactly one entry named `bar.txt`.
- [ ] Rename preserves folder depth (`folder/foo.txt` → `folder/bar.txt`).
- [ ] NFC↔NFD form toggle still applies to non-renamed files.

---

## Feature 4 — Search/Filter at ≥50 Files

### Architecture

- New component `src/components/FileListSearch.tsx` — shadcn `<Input>` + clear button.
- Rendered from `FileList.tsx` above the row list, ONLY when `files.length >= 50`.
- Local component state (`useState<string>`) — not lifted to `useFileProcessor`. No need to persist across navigations.
- Case-insensitive `.includes()` substring match against `file.normalizedName`. Korean substring matching "just works" on UTF-16 code points for NFC-normalized strings.

### UX

- Placeholder: `파일 이름 검색…`.
- Clear X button appears inside the input when it has a value.
- When a search is active, show a small badge beside the "1개 파일 / 262 B" header: `검색 활성: N개 표시` — prevents the footgun where a user forgets they're filtered and accidentally bulk-deletes what they *think* is everything.

### Selection semantics

- "전체 선택" checkbox toggles selection only on the CURRENTLY VISIBLE (filtered) rows.
- Bulk "선택 삭제" deletes only selected (which, by construction, are visible).
- Files that are hidden by search but selected from a previous search stay selected — this matches typical file-manager behavior.

### Testing

- Component test: 50+ files → search box renders, <50 files → it does not.
- Filter correctness: typing "abc" reduces rows to those whose normalized name contains "abc" case-insensitively.
- Selection: select all while filtered → only visible rows flip to selected.
- Clear search: clearing restores all rows; already-selected rows stay selected.

### Acceptance

- [ ] At 49 files: no search box.
- [ ] At 50 files: search box appears.
- [ ] Typing filters in real-time; no observable lag at 500 files.
- [ ] "Search active" badge appears when input has a value.
- [ ] Bulk selection and delete obey filtered subset.

---

## Cross-Cutting Concerns

### Bundle budget

Current main bundle is ~478 KB (under the 500 KB cap). Adding @dnd-kit/core+sortable adds roughly **20–25 KB gzipped**. Post-phase target: keep under 500 KB gz; if we go over, split a dynamic import for the DnD code (load only when files.length >= 2).

### Accessibility

- All four features must preserve Lighthouse a11y 100.
- Feature 2 introduces a new interactive surface (drag handle) and must have keyboard path + aria labels.
- Feature 1's toast uses `role="status"` and `aria-live="polite"`.

### i18n / copy

- All user-visible strings are Korean (matching existing app).
- No plan to externalize into locale files in this phase.

### Observability

- Nothing new. The "no trackers" promise still stands.

## Open questions

None. All design decisions locked in the Q1–Q4 batch of 2026-04-21.

## Risks / mitigations

| Risk | Mitigation |
|------|-----------|
| @dnd-kit bumps bundle over budget | Dynamic import gated on `files.length >= 2` |
| Renamed path collides with existing path in the ZIP | zip.js already handles this (last-write wins); acceptable for v1. Future work: warn on rename if it creates a duplicate. |
| Search box at exactly 50 files appears/disappears each drop | Fine. Threshold is a design choice; UI is stable above/below it. |
| PWA toast fires on every tab if the user has many open | The plugin's `updateSW` invokes the same SW; toast shows per-tab but reload fixes all. Acceptable. |
