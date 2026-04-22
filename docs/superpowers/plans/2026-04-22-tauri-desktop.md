# Tauri Desktop Wrapper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wrap the existing SPA as an unsigned macOS Tauri 2 desktop app with file associations for `.zip`, embed-the-build offline mode, and update notifications via a static JSON file on our origin (no GitHub API, no Web Push).

**Architecture:** New sibling `app/` folder containing a Tauri 2 Rust crate (`app/src-tauri/`) that loads the existing `dist/` SPA into a WKWebView. Native code is minimal — only file-association handling for "open with" support. SPA-side additions are gated by `typeof window.__TAURI_INTERNALS__ !== 'undefined'` so the web build is unaffected. CI publishes a universal-binary DMG to GitHub Releases on tag push and refreshes `public/desktop-latest.json` so the launch update-check finds it.

**Tech Stack:** Tauri 2, Rust (minimal), `@tauri-apps/cli@^2`, `@tauri-apps/api@^2`, `@tauri-apps/plugin-fs@^2`, `@tauri-apps/plugin-shell@^2`, GitHub Actions for macOS-x14 runners (universal binary builds).

**Spec:** `docs/superpowers/specs/2026-04-22-tauri-desktop-design.md`

---

## File Structure

| File | Status | Owner |
|------|--------|-------|
| `app/package.json` | new | Tauri shell — wraps `@tauri-apps/cli` scripts (`tauri:dev`, `tauri:build`, `tauri:icon`) |
| `app/src-tauri/Cargo.toml` | new | Rust crate metadata + Tauri deps |
| `app/src-tauri/build.rs` | new | Tauri build script (boilerplate from `tauri init`) |
| `app/src-tauri/tauri.conf.json` | new | Bundle config: window, security CSP, file associations, identifier |
| `app/src-tauri/src/main.rs` | new | App entry, file-open argv handler, single-instance guard |
| `app/src-tauri/icons/*` | new | icns + PNG icon variants generated from existing pwa-512x512.png |
| `app/src-tauri/capabilities/default.json` | new | Tauri 2 capability declarations (fs, shell, event, dialog scopes) |
| `app/.gitignore` | new | Rust target/ + node_modules + bundle artifacts |
| `app/README.md` | new | Desktop-specific dev + build notes |
| `src/utils/tauri.ts` | new | `isTauri()` + `onFileOpened()` helpers (no-ops in web context) |
| `src/utils/tauri.test.ts` | new | Unit tests for the guard logic |
| `src/utils/checkForUpdate.ts` | new | Pure async function — fetches manifest, compares versions, returns descriptor |
| `src/utils/checkForUpdate.test.ts` | new | Unit tests with mocked fetch |
| `src/utils/semverGt.ts` | new | Tiny semver-greater-than for the version compare |
| `src/utils/semverGt.test.ts` | new | Unit tests |
| `src/components/DesktopUpdateToast.tsx` | new | Toast UI, fixed bottom-center, links to release URL |
| `src/components/DesktopUpdateToast.test.tsx` | new | Render + interaction tests |
| `src/hooks/useSettings.ts` | modify | Add `checkDesktopUpdates: boolean` field, default true |
| `src/App.tsx` | modify | Mount `<DesktopUpdateToast />` + run `checkForUpdate` once on mount + listen for file-opened |
| `public/desktop-latest.json` | new (placeholder) | First version: `{ "version": "0.0.0", ... }` so the launch ping always succeeds |
| `public/desktop-install.html` | new | Standalone Korean Gatekeeper instructions page |
| `src/components/Footer.tsx` (or wherever the footer lives) | modify | Add "데스크톱 앱 다운로드" link to the install page |
| `.github/workflows/desktop-release.yml` | new | macOS runner; builds universal DMG on tag `v*-desktop`, attaches to GH release, refreshes `desktop-latest.json` |
| `package.json` | modify | Add `@tauri-apps/api`, `@tauri-apps/plugin-fs`, `@tauri-apps/plugin-shell` deps; add `desktop:dev` + `desktop:build` scripts that delegate into `app/` |

`src/` is otherwise untouched. `app/src-tauri/src/main.rs` stays under 60 lines.

---

## Stage 1 — Tauri scaffolding (sequential, single PR)

Branch: `feat/tauri-desktop-scaffold` from `main`.

### Task 1: Install Tauri CLI and scaffold the `app/` folder

**Files:** `app/package.json`, `app/src-tauri/**`, root `package.json`

- [ ] **Step 1: Verify Rust toolchain is installed**

```bash
rustc --version || (echo "Install Rust: https://rustup.rs"; exit 1)
rustup target list --installed
```

If the macOS targets aren't there:

```bash
rustup target add aarch64-apple-darwin x86_64-apple-darwin
```

- [ ] **Step 2: Create `app/package.json`**

```bash
mkdir -p app
cat > app/package.json <<'EOF'
{
  "name": "ikkonezip-desktop",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "tauri:dev": "tauri dev",
    "tauri:build": "tauri build --target universal-apple-darwin",
    "tauri:icon": "tauri icon ../public/pwa-512x512.png"
  },
  "devDependencies": {
    "@tauri-apps/cli": "^2.0.0"
  }
}
EOF
cd app && npm install --silent && cd -
```

- [ ] **Step 3: Initialize Tauri inside `app/`**

```bash
cd app
npx @tauri-apps/cli@^2 init \
  --app-name "이코네Zip" \
  --window-title "이코네Zip" \
  --frontend-dist "../../dist" \
  --dev-url "http://localhost:5173" \
  --before-dev-command "cd .. && npm run dev" \
  --before-build-command "cd .. && npm run build"
cd -
```

This creates `app/src-tauri/` with `Cargo.toml`, `build.rs`, `src/main.rs`, `tauri.conf.json`, `capabilities/`, and `icons/`.

- [ ] **Step 4: Replace `app/src-tauri/tauri.conf.json` with our final shape**

```jsonc
{
  "$schema": "https://schema.tauri.app/config/2.0.0",
  "productName": "이코네Zip",
  "version": "0.1.0",
  "identifier": "com.1kko.ikkonezip",
  "build": {
    "frontendDist": "../../dist",
    "devUrl": "http://localhost:5173",
    "beforeDevCommand": "cd .. && npm run dev",
    "beforeBuildCommand": "cd .. && npm run build"
  },
  "app": {
    "windows": [
      {
        "label": "main",
        "title": "이코네Zip",
        "width": 980,
        "height": 720,
        "minWidth": 640,
        "minHeight": 480,
        "resizable": true,
        "fullscreen": false,
        "decorations": true,
        "transparent": false,
        "dragDropEnabled": false
      }
    ],
    "security": {
      "csp": "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; worker-src 'self' blob:; connect-src 'self' https://zip.1kko.com https://api.github.com"
    }
  },
  "bundle": {
    "active": true,
    "targets": ["dmg"],
    "category": "Utility",
    "shortDescription": "한글 파일명 정규화 & 압축",
    "longDescription": "맥에서 만든 파일의 한글 파일명을 윈도우 호환 형식으로 변환하여 압축합니다 (NFD→NFC).",
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns"
    ],
    "fileAssociations": [
      {
        "ext": ["zip"],
        "name": "ZIP Archive",
        "role": "Editor",
        "description": "이코네Zip — 한글 파일명 정규화"
      }
    ],
    "macOS": {
      "minimumSystemVersion": "10.15",
      "frameworks": []
    }
  }
}
```

`connect-src` lists exactly two endpoints: our origin (for `desktop-latest.json`) and api.github.com (allowed for future-proofing in case we ever want a fallback to releases API; not used in v0.1).

**Critical: `"dragDropEnabled": false`** on the window. By default, Tauri 2's WebView intercepts native file-drop events at the window level and never forwards them to HTML5 drag/drop handlers. Without disabling it, the entire add-files UX (existing FileUploader dropzone + new FileList drop target) is silently broken inside the desktop app. Setting this to false delegates drop handling to the WebView's normal HTML5 events, matching web behavior exactly.

- [ ] **Step 5: Verify `cargo tauri dev` builds and opens a window**

```bash
cd app
npx tauri dev
```

The app window should open showing the SPA. Close with Cmd+Q.

This is a manual smoke test; if it fails, do not proceed — debug the scaffold output. Common issues:
- `frontendDist` path wrong → adjust relative to `app/src-tauri/`
- Missing Rust target → run rustup add command from Step 1
- `dist/` doesn't exist yet → run `cd .. && npm run build` first

- [ ] **Step 6: Commit**

```bash
cd /Users/ikko/repo/ikkonezip
git checkout -b feat/tauri-desktop-scaffold
git add app/ package.json package-lock.json 2>/dev/null
git commit -m "Scaffold Tauri 2 desktop wrapper at app/"
```

### Task 2: Generate macOS icns icons from existing PWA assets

**Files:** `app/src-tauri/icons/*`

- [ ] **Step 1: Run the Tauri icon generator**

```bash
cd app
npx tauri icon ../../public/pwa-512x512.png
```

Tauri reads the 512px source PNG and emits the full icon set (`32x32.png`, `128x128.png`, `128x128@2x.png`, `icon.icns`, `Square*.png` for Windows — we ignore the Windows ones).

- [ ] **Step 2: Verify the icns is valid**

```bash
file app/src-tauri/icons/icon.icns
```

Expected output should mention `Mac OS X icon`.

- [ ] **Step 3: Commit**

```bash
git add app/src-tauri/icons/
git commit -m "Generate macOS icns icons from existing PWA assets"
```

### Task 3: Minimal Rust main.rs with file-open argv handler + single-instance guard

**Files:** `app/src-tauri/src/main.rs`, `app/src-tauri/Cargo.toml`

- [ ] **Step 1: Add the single-instance plugin to Cargo.toml**

In `app/src-tauri/Cargo.toml`, under `[dependencies]` add:

```toml
tauri-plugin-single-instance = "2"
tauri-plugin-shell = "2"
```

(`tauri-plugin-shell` enables `open()` from JS for the update-toast download link.)

- [ ] **Step 2: Replace `src/main.rs` with the full app entry**

```rust
// Prevents additional console window on Windows (no-op on macOS but required for cross-compile).
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            // Second-instance launch (e.g., user double-clicks another .zip while app is open).
            // Re-emit any file argv into the existing window.
            if let Some(path) = argv.iter().skip(1).find(|a| !a.starts_with('-')) {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.emit("file-opened", path.clone());
                    let _ = window.set_focus();
                }
            }
        }))
        .setup(|app| {
            // First-instance launch (cold start with file argv).
            let argv: Vec<String> = std::env::args().skip(1).collect();
            if let Some(path) = argv.iter().find(|a| !a.starts_with('-')) {
                let path = path.clone();
                let window = app.get_webview_window("main").unwrap();
                // Defer until the WebView is ready to receive events.
                let _ = window.eval(&format!(
                    "window.addEventListener('DOMContentLoaded', () => {{ window.dispatchEvent(new CustomEvent('tauri-file-opened', {{ detail: {} }})); }});",
                    serde_json::to_string(&path).unwrap_or_default()
                ));
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

The cold-start path uses `eval` because the WebView isn't ready to receive Tauri events at `setup()` time. Using a CustomEvent on `window` lets the SPA listen with a plain `window.addEventListener` — no Tauri imports needed for the cold path. The hot path (single-instance) uses Tauri's normal `emit`/`listen` bridge.

- [ ] **Step 3: Add serde_json to Cargo.toml**

```toml
serde_json = "1"
```

- [ ] **Step 4: Update `app/src-tauri/capabilities/default.json` to allow shell:open**

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Default capability set for the main window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "shell:allow-open"
  ]
}
```

- [ ] **Step 5: Smoke test the build**

```bash
cd app
npx tauri build --debug
```

Expected: succeeds in ~3-5 minutes. Output DMG path printed at the end.

If it fails on signing (it shouldn't, since signing isn't configured), check `tauri.conf.json` has no `signingIdentity` field.

- [ ] **Step 6: Commit**

```bash
cd /Users/ikko/repo/ikkonezip
git add app/src-tauri/
git commit -m "Add file-open argv handler + single-instance guard"
```

### Task 4: Push and open Stage 1 PR

- [ ] **Step 1: Push and open PR**

```bash
git push -u origin feat/tauri-desktop-scaffold
gh pr create --title "Scaffold Tauri 2 desktop wrapper" --body "$(cat <<'EOF'
## Summary
- New \`app/\` folder containing Tauri 2 Rust crate
- Loads the existing \`dist/\` SPA into WKWebView (offline)
- File associations declared for \`.zip\` (motivation B)
- Minimal \`main.rs\`: argv handler for cold-start file open + single-instance guard for re-open
- Icons generated from existing \`public/pwa-512x512.png\`

## Verified
- \`cd app && npx tauri dev\` opens the SPA in a window
- \`cd app && npx tauri build --debug\` produces an unsigned DMG

## Out of scope (separate PRs)
- SPA-side update toast + file-opened listener (Stage 2)
- CI release workflow (Stage 3)
- Website download section (Stage 3)

## Test plan
- [x] Manual: \`tauri dev\` opens SPA in a window
- [x] Manual: \`tauri build --debug\` succeeds and produces a DMG
- [ ] Manual after merge: download the debug DMG, verify it opens (right-click → Open)
EOF
)"
```

---

## Stage 2 — SPA integrations (parallel pair after Stage 1 lands)

Set up two worktrees off freshly-merged main:

```bash
cd /Users/ikko/repo/ikkonezip
git checkout main && git pull --ff-only
git worktree add ../ikkonezip-d2a -b feat/tauri-spa-integrations
git worktree add ../ikkonezip-d2b -b feat/tauri-release-pipeline
(cd ../ikkonezip-d2a && npm install --silent) &
(cd ../ikkonezip-d2b && npm install --silent) &
wait
```

T-2A handles SPA-side desktop features. T-2B handles CI + release plumbing. They share zero file overlap.

### Track 2A — SPA desktop features (worktree: `../ikkonezip-d2a`)

#### Task 2A.1: Add Tauri JS deps + tauri.ts guard helpers

**Files:** `package.json`, `src/utils/tauri.ts`, `src/utils/tauri.test.ts`

- [ ] **Step 1: Install runtime deps**

```bash
cd /Users/ikko/repo/ikkonezip-d2a
npm install --save @tauri-apps/api@^2 @tauri-apps/plugin-shell@^2
```

- [ ] **Step 2: Write the failing test**

Create `src/utils/tauri.test.ts`:

```typescript
import { describe, it, expect, afterEach } from 'vitest';
import { isTauri } from './tauri';

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

describe('isTauri', () => {
  afterEach(() => {
    delete window.__TAURI_INTERNALS__;
  });

  it('returns false in a normal web context', () => {
    expect(isTauri()).toBe(false);
  });

  it('returns true when window.__TAURI_INTERNALS__ is defined', () => {
    window.__TAURI_INTERNALS__ = {};
    expect(isTauri()).toBe(true);
  });
});
```

- [ ] **Step 3: Run to confirm failure**

```bash
npx vitest run src/utils/tauri.test.ts --reporter=dot
```

Expected: FAIL with `Cannot find module './tauri'`.

- [ ] **Step 4: Create `src/utils/tauri.ts`**

```typescript
declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

/**
 * True iff the SPA is running inside a Tauri WebView (desktop).
 * In web contexts this returns false, and all desktop-only side effects
 * (file-opened listener, update check) become no-ops.
 */
export function isTauri(): boolean {
  return typeof window !== 'undefined' && typeof window.__TAURI_INTERNALS__ !== 'undefined';
}

export {};
```

- [ ] **Step 5: Run to confirm pass**

```bash
npx vitest run src/utils/tauri.test.ts --reporter=dot
```

Expected: 2 PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/utils/tauri.ts src/utils/tauri.test.ts
git commit -m "Add isTauri guard for desktop-context detection"
```

#### Task 2A.2: Add semverGt utility

**Files:** `src/utils/semverGt.ts`, `src/utils/semverGt.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/utils/semverGt.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { semverGt } from './semverGt';

describe('semverGt', () => {
  it('returns true when major > major', () => {
    expect(semverGt('2.0.0', '1.9.9')).toBe(true);
  });
  it('returns true when minor > minor', () => {
    expect(semverGt('1.2.0', '1.1.9')).toBe(true);
  });
  it('returns true when patch > patch', () => {
    expect(semverGt('1.0.2', '1.0.1')).toBe(true);
  });
  it('returns false when versions are equal', () => {
    expect(semverGt('1.2.3', '1.2.3')).toBe(false);
  });
  it('returns false when remote is lower', () => {
    expect(semverGt('1.2.3', '1.2.4')).toBe(false);
  });
  it('strips a leading "v" prefix from either argument', () => {
    expect(semverGt('v1.2.3', '1.2.2')).toBe(true);
    expect(semverGt('1.2.3', 'v1.2.2')).toBe(true);
  });
  it('treats malformed input as non-greater (safe default)', () => {
    expect(semverGt('garbage', '1.0.0')).toBe(false);
    expect(semverGt('1.0.0', 'garbage')).toBe(false);
  });
});
```

- [ ] **Step 2: Run, confirm fail**

```bash
npx vitest run src/utils/semverGt.test.ts --reporter=dot
```

- [ ] **Step 3: Create `src/utils/semverGt.ts`**

```typescript
/**
 * Returns true iff `remote` is a strictly higher semver than `local`.
 * Tolerates a leading "v" prefix on either side. On malformed input,
 * returns false (safe default — never falsely advertise an update).
 */
export function semverGt(remote: string, local: string): boolean {
  const r = parse(remote);
  const l = parse(local);
  if (!r || !l) return false;
  for (let i = 0; i < 3; i++) {
    if (r[i] > l[i]) return true;
    if (r[i] < l[i]) return false;
  }
  return false;
}

function parse(v: string): [number, number, number] | null {
  const stripped = v.replace(/^v/, '');
  const parts = stripped.split('.').map((p) => Number.parseInt(p, 10));
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
  return [parts[0], parts[1], parts[2]];
}
```

- [ ] **Step 4: Run, confirm pass**

```bash
npx vitest run src/utils/semverGt.test.ts --reporter=dot
```

Expected: 7 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/semverGt.ts src/utils/semverGt.test.ts
git commit -m "Add semverGt utility for desktop update version compare"
```

#### Task 2A.3: Add checkForUpdate logic

**Files:** `src/utils/checkForUpdate.ts`, `src/utils/checkForUpdate.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/utils/checkForUpdate.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkForUpdate } from './checkForUpdate';

describe('checkForUpdate', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the manifest when remote version is higher than local', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        version: '1.2.0',
        downloadUrl: 'https://example.com/dmg',
        notes: '신기능',
        releasedAt: '2026-04-22',
      }))
    );
    const result = await checkForUpdate('1.1.0');
    expect(result).not.toBeNull();
    expect(result?.version).toBe('1.2.0');
  });

  it('returns null when remote version equals local', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        version: '1.1.0',
        downloadUrl: 'https://example.com/dmg',
        notes: 'same',
        releasedAt: '2026-04-22',
      }))
    );
    expect(await checkForUpdate('1.1.0')).toBeNull();
  });

  it('returns null when remote version is lower than local', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        version: '1.0.0',
        downloadUrl: 'https://example.com/dmg',
        notes: 'old',
        releasedAt: '2026-01-01',
      }))
    );
    expect(await checkForUpdate('1.1.0')).toBeNull();
  });

  it('returns null on network error (silent fail, offline-friendly)', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network'));
    expect(await checkForUpdate('1.0.0')).toBeNull();
  });

  it('returns null on non-2xx response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('not found', { status: 404 }));
    expect(await checkForUpdate('1.0.0')).toBeNull();
  });

  it('returns null on malformed JSON', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('not-json'));
    expect(await checkForUpdate('1.0.0')).toBeNull();
  });
});
```

- [ ] **Step 2: Run, confirm fail**

```bash
npx vitest run src/utils/checkForUpdate.test.ts --reporter=dot
```

- [ ] **Step 3: Create `src/utils/checkForUpdate.ts`**

```typescript
import { semverGt } from './semverGt';

export interface UpdateManifest {
  version: string;
  downloadUrl: string;
  notes: string;
  releasedAt: string;
}

const MANIFEST_URL = 'https://zip.1kko.com/desktop-latest.json';

/**
 * Fetches the desktop update manifest and returns it iff a newer version is available.
 * Returns null on any error (offline, malformed JSON, lower-or-equal remote version)
 * to keep the launch flow resilient.
 */
export async function checkForUpdate(localVersion: string): Promise<UpdateManifest | null> {
  try {
    const r = await fetch(MANIFEST_URL, { cache: 'no-cache' });
    if (!r.ok) return null;
    const manifest = (await r.json()) as UpdateManifest;
    if (!manifest?.version) return null;
    return semverGt(manifest.version, localVersion) ? manifest : null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run, confirm pass**

```bash
npx vitest run src/utils/checkForUpdate.test.ts --reporter=dot
```

Expected: 6 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/checkForUpdate.ts src/utils/checkForUpdate.test.ts
git commit -m "Add checkForUpdate — fetches static manifest, returns higher-version only"
```

#### Task 2A.4: Add desktop-update setting to useSettings

**Files:** `src/hooks/useSettings.ts`

- [ ] **Step 1: Read the existing useSettings to understand the shape**

```bash
sed -n '1,80p' src/hooks/useSettings.ts
```

Note the existing field shape (likely `normalizationForm`, possibly `theme`). Follow the same pattern.

- [ ] **Step 2: Add `checkDesktopUpdates` field with default true**

In `src/hooks/useSettings.ts`, add to the Settings interface:

```typescript
  /**
   * If true (default), the desktop app pings desktop-latest.json on launch
   * to surface a new-version toast. Web context ignores this setting entirely.
   */
  checkDesktopUpdates: boolean;
```

In the default settings object, add:

```typescript
  checkDesktopUpdates: true,
```

In the setter exposed by the hook (likely a `setSettings` partial-update function), no change needed if it accepts arbitrary partial updates.

- [ ] **Step 3: Add a test if the existing settings file has tests**

```bash
ls src/hooks/useSettings.test.ts 2>/dev/null && echo "tests exist" || echo "no tests"
```

If tests exist, add one verifying the new field defaults to true. If not, skip — adding a test infra here is YAGNI for a single boolean.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useSettings.ts src/hooks/useSettings.test.ts 2>/dev/null
git commit -m "Add checkDesktopUpdates setting (default true)"
```

#### Task 2A.5: DesktopUpdateToast component

**Files:** `src/components/DesktopUpdateToast.tsx`, `src/components/DesktopUpdateToast.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/DesktopUpdateToast.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { DesktopUpdateToast } from './DesktopUpdateToast';

const sample = {
  version: '1.2.0',
  downloadUrl: 'https://example.com/dmg',
  notes: '드래그 정렬 기능 추가',
  releasedAt: '2026-04-22',
};

describe('DesktopUpdateToast', () => {
  it('returns null when manifest is null', () => {
    const { container } = render(
      <DesktopUpdateToast manifest={null} onDismiss={vi.fn()} onDownload={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders the version and notes when manifest is present', () => {
    render(<DesktopUpdateToast manifest={sample} onDismiss={vi.fn()} onDownload={vi.fn()} />);
    expect(screen.getByText(/새 버전 1\.2\.0 사용 가능/)).toBeInTheDocument();
    expect(screen.getByText('드래그 정렬 기능 추가')).toBeInTheDocument();
  });

  it('calls onDownload when the download button is clicked', () => {
    const onDownload = vi.fn();
    render(<DesktopUpdateToast manifest={sample} onDismiss={vi.fn()} onDownload={onDownload} />);
    fireEvent.click(screen.getByRole('button', { name: '다운로드' }));
    expect(onDownload).toHaveBeenCalledTimes(1);
  });

  it('calls onDismiss when the close button is clicked', () => {
    const onDismiss = vi.fn();
    render(<DesktopUpdateToast manifest={sample} onDismiss={onDismiss} onDownload={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '닫기' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('uses role="status" + aria-live="polite" for screen readers', () => {
    render(<DesktopUpdateToast manifest={sample} onDismiss={vi.fn()} onDownload={vi.fn()} />);
    const toast = screen.getByRole('status');
    expect(toast).toHaveAttribute('aria-live', 'polite');
  });
});
```

- [ ] **Step 2: Run, confirm fail**

```bash
npx vitest run src/components/DesktopUpdateToast.test.tsx --reporter=dot
```

- [ ] **Step 3: Create `src/components/DesktopUpdateToast.tsx`**

```typescript
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { UpdateManifest } from '@/utils/checkForUpdate';

interface DesktopUpdateToastProps {
  manifest: UpdateManifest | null;
  onDownload: () => void;
  onDismiss: () => void;
}

export function DesktopUpdateToast({ manifest, onDownload, onDismiss }: DesktopUpdateToastProps) {
  if (!manifest) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-lg border bg-popover text-popover-foreground shadow-lg px-4 py-3 max-w-[90vw] motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4"
    >
      <div className="flex flex-col">
        <span className="text-sm font-medium">새 버전 {manifest.version} 사용 가능</span>
        <span className="text-xs text-muted-foreground">{manifest.notes}</span>
      </div>
      <Button type="button" size="sm" onClick={onDownload}>
        다운로드
      </Button>
      <button
        type="button"
        aria-label="닫기"
        onClick={onDismiss}
        className="ml-1 rounded p-1 text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Run, confirm pass**

```bash
npx vitest run src/components/DesktopUpdateToast.test.tsx --reporter=dot
```

Expected: 5 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/DesktopUpdateToast.tsx src/components/DesktopUpdateToast.test.tsx
git commit -m "Add DesktopUpdateToast component"
```

#### Task 2A.6: Wire DesktopUpdateToast + checkForUpdate + file-opened in App.tsx

**Files:** `src/App.tsx`

- [ ] **Step 1: Read App.tsx to find the right insertion points**

```bash
sed -n '1,80p' src/App.tsx
```

You'll see imports, the App function, the `useFileProcessor` destructure, and the JSX return.

- [ ] **Step 2: Add imports near the top**

```typescript
import { useEffect, useState } from 'react';
import { isTauri } from '@/utils/tauri';
import { checkForUpdate, type UpdateManifest } from '@/utils/checkForUpdate';
import { DesktopUpdateToast } from '@/components/DesktopUpdateToast';
```

If `useState` and `useEffect` are already imported elsewhere, just merge.

- [ ] **Step 3: Add desktop-update state inside the App function**

Just after the existing `useFileProcessor()` destructure:

```typescript
  const [desktopUpdate, setDesktopUpdate] = useState<UpdateManifest | null>(null);

  useEffect(() => {
    if (!isTauri()) return;
    if (!settings.checkDesktopUpdates) return;
    const handle = setTimeout(() => {
      const localVersion = (import.meta.env.VITE_APP_VERSION as string | undefined) ?? '0.0.0';
      void checkForUpdate(localVersion).then(setDesktopUpdate);
    }, 1500);
    return () => clearTimeout(handle);
  }, [settings.checkDesktopUpdates]);
```

`settings` here is whatever variable name the existing `useSettings()` exposes — adapt to match.

- [ ] **Step 4: Add the file-opened listener inside the App function**

Right after the previous useEffect:

```typescript
  useEffect(() => {
    if (!isTauri()) return;

    const handleColdOpen = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      if (typeof detail === 'string') void openFromPath(detail);
    };
    window.addEventListener('tauri-file-opened', handleColdOpen);

    let unlisten: (() => void) | null = null;
    void import('@tauri-apps/api/event').then(({ listen }) =>
      listen<string>('file-opened', ({ payload }) => {
        if (typeof payload === 'string') void openFromPath(payload);
      }).then((u) => { unlisten = u; })
    );

    async function openFromPath(path: string) {
      const { readFile } = await import('@tauri-apps/plugin-fs');
      const bytes = await readFile(path);
      const name = path.split('/').pop() ?? 'file.zip';
      const file = new File([bytes], name, { type: 'application/zip' });
      await addFiles([file]);
    }

    return () => {
      window.removeEventListener('tauri-file-opened', handleColdOpen);
      unlisten?.();
    };
  }, [addFiles]);
```

`addFiles` here matches the destructured name from `useFileProcessor()`. Adapt as needed.

The `@tauri-apps/plugin-fs` import is dynamic (inside `openFromPath`) so the web bundle never loads it.

- [ ] **Step 5: Mount DesktopUpdateToast in JSX**

Find the root JSX wrapper and, near where other top-level toasts/modals live, add:

```tsx
<DesktopUpdateToast
  manifest={desktopUpdate}
  onDownload={async () => {
    if (desktopUpdate) {
      const { open } = await import('@tauri-apps/plugin-shell');
      await open(desktopUpdate.downloadUrl);
    }
  }}
  onDismiss={() => setDesktopUpdate(null)}
/>
```

- [ ] **Step 6: Verify Vite dynamic-import behavior — the new deps must NOT bloat the web bundle**

```bash
npm run build 2>&1 | grep -E "index-.*\.js"
```

The main bundle should NOT have grown by more than ~1 KB gz (the static `isTauri` + `checkForUpdate` + `DesktopUpdateToast` code). The Tauri-specific imports are dynamic, so they should produce separate small chunks (visible in the build output).

If the main bundle jumped by >5 KB, something static is being pulled — investigate.

- [ ] **Step 7: Run the full test suite**

```bash
npx vitest run --reporter=dot
```

Expected: previous 209 + 2 (tauri) + 7 (semverGt) + 6 (checkForUpdate) + 5 (DesktopUpdateToast) = 229 PASS.

- [ ] **Step 8: Lint**

```bash
npm run lint
```

- [ ] **Step 9: Hide Header banner + Footer when running inside Tauri**

Per the spec's "Desktop Chrome (Hide Web-Specific UI)" section: when `isTauri()` returns true, hide the in-app title banner (`<Header />`) and the footer (`<Footer />` or whatever the footer component is). Desktop users get OS title bar + dock icon + system theme; the SPA chrome is redundant and steals vertical space.

In `src/App.tsx`, find the `<Header />` and footer renders. Wrap each:

```tsx
{!isTauri() && <Header />}
...
{!isTauri() && <Footer />}
```

(Adjust `Footer` import name to whatever the codebase uses — could be inline JSX inside App.tsx if there's no separate component.)

If the footer is rendered inline (not a separate component), wrap that whole inline JSX block in the same conditional.

Run `npx vitest run --reporter=dot` after — existing App-level tests (if any) should still pass; the conditional just gates rendering.

- [ ] **Step 10: Commit**

```bash
git add src/App.tsx
git commit -m "Wire DesktopUpdateToast + checkForUpdate + file-opened in App; hide chrome in Tauri"
```

#### Task 2A.7: Add VITE_APP_VERSION at build time

**Files:** `vite.config.ts`

- [ ] **Step 1: Inject the version from package.json**

In `vite.config.ts`, find the `defineConfig(({ mode }) => { ... })` block. Inside it, before the `return { ... }`, add:

```typescript
import pkg from './package.json' assert { type: 'json' };
```

(if the import isn't already at the top of the file)

Then in the returned config, add a `define` field:

```typescript
    define: {
      'import.meta.env.VITE_APP_VERSION': JSON.stringify(pkg.version),
    },
```

- [ ] **Step 2: Verify it works**

Add a temporary `console.log(import.meta.env.VITE_APP_VERSION)` in `src/main.tsx`, run `npm run dev`, check the browser console. Should print the version string. Remove the log.

- [ ] **Step 3: Commit + push + open PR**

```bash
git add vite.config.ts
git commit -m "Inject VITE_APP_VERSION from package.json at build time"
git push -u origin feat/tauri-spa-integrations
gh pr create --title "SPA-side desktop integrations: update toast, file-opened listener" --body "$(cat <<'EOF'
## Summary
- New \`isTauri()\` guard so all desktop logic is no-op in web context
- New \`checkForUpdate\` fetches \`zip.1kko.com/desktop-latest.json\` on launch (1.5s delay)
- New \`DesktopUpdateToast\` component for the new-version notification
- File-opened listener handles both cold-start (window event from Rust eval) and re-open (Tauri event)
- New \`checkDesktopUpdates\` setting (default true)
- Web bundle delta: <1 KB gz (Tauri imports are dynamic — separate chunks)

## Test plan
- [x] 20 new unit tests covering isTauri, semverGt, checkForUpdate, DesktopUpdateToast
- [x] Full suite 229/229 pass
- [x] Web bundle delta verified <1 KB gz
- [ ] Manual: \`tauri dev\` from app/, drop a file, verify it works (no regression)
- [ ] Manual: with a higher version in desktop-latest.json, toast appears on launch
EOF
)"
```

### Track 2B — Release pipeline + website (worktree: `../ikkonezip-d2b`)

#### Task 2B.1: Add the initial desktop-latest.json placeholder

**Files:** `public/desktop-latest.json`

- [ ] **Step 1: Create the file**

```bash
cd /Users/ikko/repo/ikkonezip-d2b
mkdir -p public
cat > public/desktop-latest.json <<'EOF'
{
  "version": "0.0.0",
  "downloadUrl": "https://github.com/1kko/ikkonezip/releases",
  "notes": "데스크톱 앱 첫 릴리스 준비 중",
  "releasedAt": "2026-04-22"
}
EOF
```

Version "0.0.0" guarantees that any released version will be considered "newer" — but more importantly, it means the launch ping always finds a valid manifest (no 404 → silent skip). After the first real release, CI overwrites this.

- [ ] **Step 2: Commit**

```bash
git add public/desktop-latest.json
git commit -m "Add initial desktop-latest.json placeholder"
```

#### Task 2B.2: GitHub Actions workflow for desktop release

**Files:** `.github/workflows/desktop-release.yml`

- [ ] **Step 1: Create the workflow**

```yaml
name: Desktop Release

on:
  push:
    tags:
      - 'v*-desktop'

jobs:
  build:
    name: Build universal DMG
    runs-on: macos-14
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - name: Install Rust
        uses: dtolnay/rust-toolchain@stable
        with:
          targets: aarch64-apple-darwin,x86_64-apple-darwin

      - name: Cache Cargo registry + target
        uses: actions/cache@v4
        with:
          path: |
            ~/.cargo/registry
            ~/.cargo/git
            app/src-tauri/target
          key: ${{ runner.os }}-cargo-${{ hashFiles('app/src-tauri/Cargo.lock') }}

      - name: Install web deps and build SPA
        run: |
          npm ci
          npm run build

      - name: Install Tauri CLI
        run: |
          cd app
          npm ci

      - name: Build universal DMG
        run: |
          cd app
          npx tauri build --target universal-apple-darwin

      - name: Locate DMG
        id: dmg
        run: |
          DMG=$(find app/src-tauri/target/universal-apple-darwin/release/bundle/dmg -name "*.dmg" | head -1)
          echo "path=$DMG" >> "$GITHUB_OUTPUT"
          echo "name=$(basename "$DMG")" >> "$GITHUB_OUTPUT"

      - name: Extract version from tag
        id: version
        run: |
          TAG="${GITHUB_REF##*/}"
          VERSION="${TAG%-desktop}"
          VERSION="${VERSION#v}"
          echo "version=$VERSION" >> "$GITHUB_OUTPUT"
          echo "tag=$TAG" >> "$GITHUB_OUTPUT"

      - name: Create GitHub Release with DMG
        uses: softprops/action-gh-release@v2
        with:
          tag_name: ${{ steps.version.outputs.tag }}
          name: Desktop ${{ steps.version.outputs.version }}
          generate_release_notes: true
          files: ${{ steps.dmg.outputs.path }}

      - name: Update desktop-latest.json
        run: |
          DOWNLOAD_URL="https://github.com/${{ github.repository }}/releases/download/${{ steps.version.outputs.tag }}/${{ steps.dmg.outputs.name }}"
          NOTES=$(gh release view "${{ steps.version.outputs.tag }}" --json body --jq .body | head -c 280)
          cat > public/desktop-latest.json <<JSON
          {
            "version": "${{ steps.version.outputs.version }}",
            "downloadUrl": "$DOWNLOAD_URL",
            "notes": ${NOTES_JSON},
            "releasedAt": "$(date -u +%Y-%m-%d)"
          }
          JSON
        env:
          GH_TOKEN: ${{ github.token }}

      - name: Commit and push desktop-latest.json to main
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git checkout main
          git pull origin main
          git add public/desktop-latest.json
          git commit -m "Update desktop-latest.json for ${{ steps.version.outputs.tag }}"
          git push origin main
```

A note on the `NOTES` variable above — bash doesn't have a clean way to JSON-escape arbitrary strings. The simplest approach is to set `NOTES_JSON` via `jq` or to keep `notes` as a static short string. Replace the Update-step body with this safer version:

```yaml
      - name: Update desktop-latest.json
        run: |
          DOWNLOAD_URL="https://github.com/${{ github.repository }}/releases/download/${{ steps.version.outputs.tag }}/${{ steps.dmg.outputs.name }}"
          NOTES=$(gh release view "${{ steps.version.outputs.tag }}" --json body --jq '.body | .[0:280]')
          jq -n \
            --arg version "${{ steps.version.outputs.version }}" \
            --arg url "$DOWNLOAD_URL" \
            --arg notes "$NOTES" \
            --arg releasedAt "$(date -u +%Y-%m-%d)" \
            '{version: $version, downloadUrl: $url, notes: $notes, releasedAt: $releasedAt}' \
            > public/desktop-latest.json
        env:
          GH_TOKEN: ${{ github.token }}
```

`jq -n` constructs JSON safely with proper escaping.

- [ ] **Step 2: Validate the YAML locally**

```bash
yamllint .github/workflows/desktop-release.yml || echo "yamllint not installed; skipping"
gh workflow list 2>/dev/null # confirms gh CLI sees the file
```

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/desktop-release.yml
git commit -m "Add desktop-release workflow: build universal DMG, attach to release, refresh manifest"
```

#### Task 2B.3: Korean Gatekeeper instructions page

**Files:** `public/desktop-install.html`

- [ ] **Step 1: Create a standalone HTML page (not part of the SPA)**

```html
<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>이코네Zip 데스크톱 앱 설치</title>
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 640px; margin: 2rem auto; padding: 1rem; line-height: 1.6; color: #1a1a1a; }
  h1 { font-size: 1.75rem; margin-bottom: 0.25rem; }
  .lede { color: #666; margin-bottom: 2rem; }
  .step { background: #f6f6f6; padding: 1rem 1.25rem; border-radius: 8px; margin: 1rem 0; }
  .step-num { display: inline-block; background: #7c3aed; color: white; width: 1.5rem; height: 1.5rem; line-height: 1.5rem; text-align: center; border-radius: 50%; margin-right: 0.5rem; font-weight: bold; }
  .download-button { display: inline-block; background: #7c3aed; color: white; padding: 0.75rem 1.5rem; border-radius: 8px; text-decoration: none; font-weight: 500; margin: 0.5rem 0; }
  .download-button:hover { background: #6d28d9; }
  details { margin-top: 2rem; background: #fafafa; padding: 1rem; border-radius: 8px; }
  summary { cursor: pointer; font-weight: 500; }
  code { background: #eaeaea; padding: 0.1rem 0.3rem; border-radius: 3px; font-size: 0.9em; }
  @media (prefers-color-scheme: dark) {
    body { background: #0f0f23; color: #e6e6e6; }
    .step { background: #1a1a2e; }
    details { background: #1a1a2e; }
    code { background: #2a2a3e; }
  }
</style>
</head>
<body>

<h1>이코네Zip 데스크톱 앱</h1>
<p class="lede">맥에서 한글 파일명을 정규화하고 ZIP으로 압축하는 도구. 오프라인 지원, 추적 없음.</p>

<a class="download-button" href="https://github.com/1kko/ikkonezip/releases/latest" id="dl-link">
  최신 버전 다운로드 (DMG)
</a>

<h2>설치 방법</h2>

<div class="step">
  <span class="step-num">1</span><strong>DMG 파일 다운로드</strong>
  <p>위의 다운로드 버튼을 누르고 GitHub Releases 페이지에서 <code>.dmg</code> 파일을 받으세요.</p>
</div>

<div class="step">
  <span class="step-num">2</span><strong>DMG 열고 Applications 폴더로 드래그</strong>
  <p>다운로드 받은 DMG 파일을 더블클릭한 뒤, 이코네Zip 아이콘을 Applications 폴더로 끌어다 놓으세요.</p>
</div>

<div class="step">
  <span class="step-num">3</span><strong>처음 실행 시: 우클릭 → 열기</strong>
  <p>Applications 폴더의 이코네Zip 아이콘을 <strong>우클릭(또는 Control+클릭) → 열기</strong>를 선택하세요. 보안 경고가 뜨면 <strong>"열기"</strong>를 다시 누르세요.</p>
  <p>이후부터는 일반 더블클릭으로 실행됩니다.</p>
</div>

<details>
  <summary>왜 보안 경고가 뜨나요?</summary>
  <p>이 앱은 Apple Developer Program에 등록되어 있지 않습니다. macOS의 Gatekeeper는 Apple이 검증하지 않은 앱에 대해 경고를 표시합니다.</p>
  <p>코드는 <a href="https://github.com/1kko/ikkonezip">GitHub에서 공개</a>되어 있으니 직접 확인하실 수 있습니다. 우려되시면 PWA 버전을 <a href="/">웹사이트에서 바로</a> 사용하셔도 동일한 기능을 제공합니다.</p>
</details>

</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add public/desktop-install.html
git commit -m "Add Korean Gatekeeper install instructions page"
```

#### Task 2B.4: Add download link in the SPA footer

**Files:** `src/components/Footer.tsx` (or whatever file holds the footer)

- [ ] **Step 1: Find the footer component**

```bash
grep -lE "<footer|contentinfo|footer\b" src/components/ 2>/dev/null | head -3
grep -n "트래킹 없음\|footer" src/App.tsx | head -5
```

You'll find the footer either in `App.tsx` directly or in a dedicated `Footer.tsx`.

- [ ] **Step 2: Add a small link near the existing footer items**

Wherever the footer items live, add:

```tsx
<a
  href="/desktop-install.html"
  className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
>
  데스크톱 앱 다운로드
</a>
```

Keep the styling subtle — the desktop app is a nice-to-have, not the primary CTA.

- [ ] **Step 3: Run tests + lint**

```bash
npx vitest run --reporter=dot
npm run lint
```

Expected: all green.

- [ ] **Step 4: Commit + push + open PR**

```bash
git add src/components/Footer.tsx src/App.tsx 2>/dev/null
git commit -m "Add desktop app download link to footer"
git push -u origin feat/tauri-release-pipeline
gh pr create --title "Desktop release pipeline: CI workflow, manifest, install page" --body "$(cat <<'EOF'
## Summary
- \`public/desktop-latest.json\` placeholder so launch pings always succeed
- \`.github/workflows/desktop-release.yml\` builds universal DMG on \`v*-desktop\` tag, attaches to GH release, refreshes the manifest, and pushes the JSON change to main (which deploy.yml then ships)
- \`public/desktop-install.html\` standalone Korean Gatekeeper instructions
- Footer link "데스크톱 앱 다운로드"

## Test plan
- [x] Lint clean
- [x] Test suite untouched
- [ ] Manual: tag a v0.1.0-desktop after merge, watch CI build, verify DMG attached + manifest updated
EOF
)"
```

---

## Stage 3 — First desktop release

After both Stage 2 PRs merge into main:

### Task 3.1: Tag v0.1.0-desktop and watch the workflow

- [ ] **Step 1: Sync local main**

```bash
cd /Users/ikko/repo/ikkonezip
git checkout main && git pull --ff-only
```

- [ ] **Step 2: Tag the release**

```bash
git tag v0.1.0-desktop
git push origin v0.1.0-desktop
```

- [ ] **Step 3: Watch the workflow**

```bash
gh run watch --exit-status
```

The desktop-release workflow takes ~10-15 minutes (Rust compile cold + universal binary).

- [ ] **Step 4: Verify the release**

```bash
gh release view v0.1.0-desktop
```

Expected: DMG asset attached, named like `IkkoneZip_0.1.0_universal.dmg`.

```bash
curl -s https://zip.1kko.com/desktop-latest.json | jq .
```

Expected: version = "0.1.0", downloadUrl points at the GH release asset.

### Task 3.2: Manual end-to-end smoke test

- [ ] **Step 1: Download the DMG**

Open https://zip.1kko.com/desktop-install.html → click download → DMG downloads.

- [ ] **Step 2: Install**

Open DMG → drag icon to Applications → eject DMG.

- [ ] **Step 3: First launch (Gatekeeper dance)**

Right-click the icon in Applications → Open → click "Open" in the warning dialog.

- [ ] **Step 4: Verify offline mode**

Disconnect Wi-Fi. Open the app from the dock. Verify the SPA loads. Drop a file with NFD characters. Click ZIP download. Confirm the ZIP downloads correctly.

- [ ] **Step 5: Verify file association**

Right-click any `.zip` in Finder → "다음으로 열기" → 이코네Zip. The app should open with that file pre-loaded in the file list.

- [ ] **Step 6: Verify update toast (negative case)**

Quit the app. Reconnect Wi-Fi. Open the app. The toast should NOT appear (because remote and local are both v0.1.0).

- [ ] **Step 7: Verify update toast (positive case, optional)**

Manually edit `public/desktop-latest.json` on main, bump the version to "0.1.1", push (deploy will refresh it on the live site). Wait for deploy. Quit and re-open the desktop app. Toast should appear within ~2s of launch.

Then revert the version bump to avoid confusing real users.

If everything passes, the desktop app is shipping.

---

## Spec coverage checklist (self-review)

| Spec acceptance criterion | Plan task |
|---------------------------|-----------|
| DMG download link on website works | Task 2B.4 (footer) + Task 2B.3 (install page) |
| Right-click → Open succeeds on first launch | Task 3.2 Step 3 |
| App works fully offline | Task 3.2 Step 4 |
| Right-click `.zip` → "다음으로 열기" → file appears in list | Task 1 Step 4 (file association config) + Task 3 (Rust handler) + Task 2A.6 (SPA listener) |
| App size < 20 MB | Task 1 Step 5 (manual debug-build size sanity check); Task 3.1 Step 4 (verify in CI artifact) |
| Update toast appears when manifest reports higher version | Task 2A.3 + Task 2A.5 + Task 3.2 Step 7 |
| Settings toggle disables the launch ping | Task 2A.4 + Task 2A.6 (`if (!settings.checkDesktopUpdates) return`) |
| Quit + re-open works without crash | Task 1 Step 5 (manual test); single-instance plugin in Task 3 Step 1 |

| Spec architecture requirement | Plan task |
|--------------------------------|-----------|
| Tauri 2 wrapper at `app/` | Task 1 |
| Embeds `dist/` into .app | Task 1 Step 4 (`frontendDist`) |
| WKWebView runtime | Default Tauri behavior on macOS — no config needed |
| ~12 MB unsigned DMG | Task 1 Step 5 + Task 3.1 Step 4 (verify in CI) |
| File associations for `.zip` | Task 1 Step 4 |
| Static `desktop-latest.json` on our origin | Task 2B.1 + Task 2B.2 |
| `useTauri` guard pattern | Task 2A.1 |
| Settings → 업데이트 자동 확인 toggle (default on) | Task 2A.4 |
| `connect-src 'self' https://zip.1kko.com` CSP | Task 1 Step 4 |
| Distribution via direct GH Releases DMG | Task 2B.2 + Task 2B.3 |

All spec criteria mapped. The desktop app is intentionally a small slice — most "interesting" code is in the SPA, which is shared between web and desktop.

## Risks called out at plan time

- **Tauri 2 CLI breaking changes between versions**: pin `@tauri-apps/cli@^2` (caret allows minor bumps but not major; review release notes before bumping the lockfile in PRs).
- **Universal binary build time on CI**: cold build is ~10 minutes. The cache step on `~/.cargo/registry + target/` should reduce subsequent builds to ~5 minutes.
- **`desktop-latest.json` stuck after a failed CI release**: if the GH release publishes but the manifest update step fails, users on the old version don't see the toast for the new release. Mitigation: the workflow runs the manifest update as a separate step that can be re-run via `gh workflow run desktop-release.yml --ref v0.1.0-desktop` (re-trigger).
- **Korean filename in DMG title**: keep the DMG filename ASCII (`IkkoneZip_<version>_universal.dmg`) per `bundle.macOS.dmg` config; the inside-app product name can stay as 이코네Zip.
