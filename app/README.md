# ikkonezip Desktop (Tauri)

This folder contains the Tauri 2 desktop wrapper for the ikkonezip web app.

## Prerequisites

- Rust toolchain (https://rustup.rs)
- Both macOS targets installed:
  ```sh
  rustup target add aarch64-apple-darwin x86_64-apple-darwin
  ```
- For DMG bundling locally:
  ```sh
  brew install create-dmg
  ```

## Develop

From this directory (`app/`):

```sh
npm install              # one-time
npx tauri dev            # opens a window loading http://localhost:5173
```

`tauri dev` starts the SPA dev server (`npm run dev` in repo root) automatically via the `beforeDevCommand` hook.

## Build

```sh
npx tauri build          # universal binary, full release
npx tauri build --debug  # faster, debug symbols, larger DMG
```

DMG output: `src-tauri/target/<target>/release/bundle/dmg/이코네Zip_<version>_<arch>.dmg`

## Architecture

- `src-tauri/tauri.conf.json` — bundle config, window settings, file associations, CSP
- `src-tauri/src/lib.rs` — app entry: file-open argv handler + single-instance plugin
- `src-tauri/src/main.rs` — 3-line delegation to `lib.rs::run()` (Tauri 2 mobile-compat pattern)
- `src-tauri/icons/` — auto-generated from `../../public/pwa-512x512.png` via `npx tauri icon`
- `src-tauri/capabilities/default.json` — Tauri 2 permission grants (shell:allow-open)

The SPA itself lives in `../src/` and is shared with the web build. Tauri loads `../../dist/` (Vite build output) into a WKWebView. There is no Tauri-specific JS code here in Stage 1; that arrives in Stage 2A.

## Distribution

Desktop releases are tagged `v*-desktop` (e.g. `v0.1.0-desktop`) and trigger `.github/workflows/desktop-release.yml` which builds a universal DMG and attaches it to a GitHub Release. Users download via the website's `desktop-install.html` page.

The app is unsigned. First-launch UX requires right-click → Open to bypass Gatekeeper.
