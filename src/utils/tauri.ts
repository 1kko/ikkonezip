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
