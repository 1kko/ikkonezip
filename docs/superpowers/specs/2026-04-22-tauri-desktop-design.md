# Tauri Desktop App — Design

**Date:** 2026-04-22
**Status:** Approved (design)
**Scope:** Wrap the existing SPA as an unsigned macOS desktop app via Tauri 2.

## Goals

Three user-visible motivations, in priority order:

1. **Easier install** — download a DMG, double-click, drag to Applications. Lower friction than the PWA "Add to Dock" dance for non-technical users.
2. **Native macOS file integration** — `.zip` files appear in the "다음으로 열기" submenu and route into the existing `addFiles` flow when chosen.
3. **Offline-first by default** — the app embeds the SPA build, never hits the origin server during normal use, works without network.

## Non-goals

- Code signing / Apple notarization (no Apple Developer Program enrollment)
- Windows / Linux builds in this phase
- Mac App Store submission
- Homebrew cask
- Background auto-update (Sparkle-style apply-and-relaunch)
- Native file dialogs that bypass the WebView (HTML5 `<input type="file">` and drag/drop continue to handle everything)
- Migration of any web-side feature to Rust

## Architecture

A Tauri 2 wrapper at `app/` in the existing repo. The Tauri binary loads the SPA from `../dist/` baked into the `.app` bundle — exactly the same artifact that ships to `https://zip.1kko.com`. WKWebView is the runtime (system Safari engine). All ZIP processing runs in the WebView via `@zip.js/zip.js` exactly as on the web.

Result: a ~12 MB unsigned DMG that is functionally indistinguishable from the web app, fully offline, with one outbound request per launch — to `https://zip.1kko.com/desktop-latest.json` for update checking. No third-party services. No GitHub API. No telemetry.

## Repo Layout

```
ikkonezip/
  src/                            (existing SPA — untouched)
  dist/                           (Vite build output — shared with desktop)
  public/
    desktop-latest.json           (NEW — version manifest, served at /desktop-latest.json)
  app/                            (NEW — Tauri shell)
    src-tauri/
      tauri.conf.json
      src/main.rs                 (minimal: app setup + file-open handler)
      icons/                      (icns + png variants from existing PWA assets)
      Cargo.toml
    package.json                  (thin wrapper: tauri:dev, tauri:build scripts)
    README.md
  .github/workflows/
    desktop-release.yml           (NEW — builds DMG on tag push, attaches to GH release, updates desktop-latest.json)
```

`src/` is untouched by Stage 1. `app/` does not import anything from `src/`. The shared artifact is `dist/`, produced by the existing `npm run build` in the repo root. The desktop build runs `npm run build` first (in the root), then `cargo tauri build` (in `app/src-tauri`).

## Desktop Chrome (Hide Web-Specific UI)

When running inside the Tauri WebView, the SPA hides UI elements that duplicate native chrome:

- The big in-app title banner ("이코네Zip" + "맥에서 만든 파일의 한글 파일명 깨짐을 해결하고 압축합니다") — redundant with the OS title bar and dock icon.
- The footer (theme switcher + "트래킹 없음" promise text) — desktop users get the same theme via system preferences and the no-trackers promise lives on the website / install page.

These are gated by the `isTauri()` helper from Stage 2A. Web behavior is unchanged. Implementation lives in `App.tsx` as conditional `{!isTauri() && <Header />}` and `{!isTauri() && <Footer />}` wrappers.

## File Associations (motivation 2)

`tauri.conf.json` declares the app handles `.zip`:

```jsonc
"bundle": {
  "fileAssociations": [{
    "ext": ["zip"],
    "name": "ZIP Archive",
    "role": "Editor",
    "description": "이코네Zip — 한글 파일명 정규화"
  }]
}
```

This puts the app in macOS's "다음으로 열기" submenu for any `.zip` file. The user can opt-in to "Change All" to make double-click default to the app.

When the OS launches the app with a file argv (e.g., on double-click after "Change All"), `main.rs` catches the path and emits a Tauri event into the WebView:

```rust
// In main.rs, simplified
tauri::Builder::default()
  .setup(|app| {
    let args: Vec<String> = std::env::args().skip(1).collect();
    if let Some(path) = args.first() {
      let main = app.get_webview_window("main").unwrap();
      main.emit("file-opened", path.clone()).ok();
    }
    Ok(())
  })
```

The SPA listens for the event and feeds the file into `addFiles`:

```ts
import { listen } from '@tauri-apps/api/event';
listen<string>('file-opened', async ({ payload }) => {
  const file = await readFileFromDisk(payload);  // tauri fs api
  await addFiles([file]);
});
```

A small `useTauri` guard ensures this code only runs in the desktop context (typeof `__TAURI_INTERNALS__` !== 'undefined').

Drag-from-Finder onto the open window works automatically via the existing HTML5 drag/drop handlers — no native code needed.

## Update Notification (motivation 1 polish)

On launch, after a 1.5s delay (UI is ready, no jank), the SPA fetches:

```
GET https://zip.1kko.com/desktop-latest.json
```

Response shape:

```json
{
  "version": "1.2.0",
  "releasedAt": "2026-04-22",
  "downloadUrl": "https://github.com/1kko/ikkonezip/releases/download/v1.2.0/IkkoneZip-1.2.0.dmg",
  "notes": "드래그 정렬, 검색/필터 기능 추가"
}
```

Logic:

```ts
async function checkForUpdate() {
  if (!settings.checkForUpdates) return;
  try {
    const r = await fetch('https://zip.1kko.com/desktop-latest.json', { cache: 'no-cache' });
    const latest = await r.json();
    if (semverGt(latest.version, APP_VERSION)) {
      showDesktopUpdateToast({
        version: latest.version,
        notes: latest.notes,
        onDownload: () => open(latest.downloadUrl),
      });
    }
  } catch {
    // Offline — silently skip. Try again on next launch.
  }
}
```

`APP_VERSION` is read from `import.meta.env.VITE_APP_VERSION`, baked at build time from `package.json`'s version field.

The toast is a new component `DesktopUpdateToast.tsx` (separate from the web `PwaUpdateToast` because the action differs: open URL vs reload SW).

A small "Settings → 업데이트 자동 확인" toggle (default on) lets privacy-conscious users disable the launch ping. State persists in localStorage.

### Why static JSON, not Web Push or GitHub API

- **GitHub API** has 60 req/hr unauthenticated rate limit per IP — fine for individuals but breaks under shared NATs.
- **Web Push** requires VAPID + a push service (FCM, Mozilla AutoPush, etc.), which adds a third-party tracker and conflicts with the "no trackers" promise.
- **Static JSON on our own origin** has zero rate limit (nginx serves it in <1ms), no third party, is publicly inspectable in a browser, and is the standard pattern (Sparkle, Squirrel, Tauri's own updater all use this shape).

The JSON is updated by CI on tag push (see Distribution below).

## Distribution

**Build**: A new GitHub Actions workflow `.github/workflows/desktop-release.yml` triggers on tags matching `v*-desktop` (separate tag namespace from web releases — keeps the workflows independent).

Workflow steps:
1. Run `npm ci && npm run build` (produces `dist/`)
2. Setup Rust + macOS targets (universal binary: aarch64 + x86_64)
3. Run `cargo tauri build --target universal-apple-darwin`
4. Output: `app/src-tauri/target/universal-apple-darwin/release/bundle/dmg/IkkoneZip_<version>_universal.dmg`
5. Create GitHub Release with the DMG attached
6. Generate `public/desktop-latest.json` from the tag name + release URL
7. Open a tiny PR (or commit directly to main) that updates `public/desktop-latest.json`
8. The web deploy workflow picks up that commit and ships the new JSON to `https://zip.1kko.com/desktop-latest.json` automatically

The website gets a "데스크톱 앱 다운로드" section with:
- Latest version + release date
- Big DMG download button (links to the GH release asset)
- Brief instructions: "처음 실행 시 우클릭 → 열기 (Apple 미서명 앱)"
- Optional collapsible: "왜 보안 경고가 뜨나요?" — explains Gatekeeper without scaring users

## Testing

- **Smoke test in Tauri's `cargo tauri dev`** — manual verification on a macOS machine. No automated cross-platform CI for desktop in this phase.
- **The SPA's existing 209 Vitest tests** — already cover all the in-WebView logic. They run in happy-dom / jsdom which is the same engine model. No new test infra.
- **One new test** — for `checkForUpdate`: assert that a newer remote version triggers `showDesktopUpdateToast`, that an equal/older version does not, and that a fetch error is silently swallowed. Covers the only desktop-specific TypeScript logic.

## Acceptance Criteria

- [ ] DMG download link on website works
- [ ] After right-click → Open on first launch, app opens to the existing SPA UI
- [ ] App works fully offline (disconnect Wi-Fi, all features still work)
- [ ] Right-click on a `.zip` in Finder → "다음으로 열기" → 이코네Zip → file appears in the file list
- [ ] App size < 20 MB
- [ ] Update toast appears on launch when `desktop-latest.json` reports a higher version
- [ ] Toggling "업데이트 자동 확인" off prevents the launch ping
- [ ] Quitting and re-opening the app from the dock works (no crash, no relaunch lag > 2s)

## Risks / Mitigations

| Risk | Mitigation |
|------|-----------|
| Gatekeeper warning intimidates users | Website install page in Korean explaining the right-click → Open dance + reasoning |
| WKWebView CSS quirks vs Chrome | The PWA already targets Safari; existing tests cover most issues |
| `desktop-latest.json` fetch fails | Silently skip; try again next launch. Offline-first promise upheld |
| Universal binary build adds ~5 minutes to CI | Acceptable; desktop releases are infrequent (monthly cadence) |
| Tauri 2 in flux | Pin specific minor version in Cargo.toml; review Tauri release notes before bumping |
| File-association OS handler timing | If app is closed when user double-clicks .zip, OS launches it; if open, OS sends a fresh argv via `re-open` event. Handle both paths in `main.rs` |
| Korean filename in DMG path | Use ASCII-safe asset name `IkkoneZip-<version>.dmg` (matches GitHub Release URL convention) |

## Open Questions

None — all design decisions locked.
