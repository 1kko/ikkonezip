import { semverGt } from './semverGt';
import { isTauri } from './tauri';
import { detectPlatform } from './platform';
import type { DesktopDownloads } from '@/hooks/useDesktopRelease';

export interface UpdateManifest {
  version: string;
  /** Per-platform download URL — populated for whichever OS the host is running. */
  downloadUrl: string;
  notes: string;
  releasedAt: string;
}

interface RawManifest {
  version?: string;
  downloadUrl?: string;
  downloads?: Partial<DesktopDownloads>;
  notes?: string;
  releasedAt?: string;
}

const MANIFEST_URL = 'https://zip.1kko.com/desktop-latest.json';

// Tauri WebView origin (tauri://localhost) is cross-origin to zip.1kko.com,
// and the manifest endpoint serves no Access-Control-Allow-Origin header,
// so the browser-style `fetch` rejects the response. Routing through the
// Tauri HTTP plugin sends the request from the Rust side instead, which
// is not subject to CORS. Capability scope (capabilities/default.json)
// confines the plugin to https://zip.1kko.com/* only.
async function fetchManifest(url: string): Promise<Response> {
  if (isTauri()) {
    const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http');
    return tauriFetch(url, { cache: 'no-cache' });
  }
  return fetch(url, { cache: 'no-cache' });
}

function pickPlatformDownload(raw: RawManifest): string {
  // The Tauri WebView is a browser, not Node — there is no `process.platform`.
  // detectPlatform() reads userAgentData/navigator.platform, which works in
  // both web and Tauri contexts and avoids sending Windows/Linux users to
  // the macOS DMG when only the multi-platform `downloads` map is populated.
  const platform = detectPlatform();
  if (platform && raw.downloads?.[platform]) return raw.downloads[platform] ?? '';
  // Fall back to the legacy single-URL field, then any populated platform link.
  return (
    raw.downloadUrl ??
    raw.downloads?.macos ??
    raw.downloads?.windows ??
    raw.downloads?.linux ??
    ''
  );
}

/**
 * Fetches the desktop update manifest and returns it iff a newer version is available.
 * Returns null on any error (offline, malformed JSON, lower-or-equal remote version)
 * to keep the launch flow resilient.
 */
export async function checkForUpdate(localVersion: string): Promise<UpdateManifest | null> {
  try {
    const r = await fetchManifest(MANIFEST_URL);
    if (!r.ok) return null;
    const raw = (await r.json()) as RawManifest;
    if (!raw?.version) return null;
    if (!semverGt(raw.version, localVersion)) return null;
    const downloadUrl = pickPlatformDownload(raw);
    if (!downloadUrl) return null;
    return {
      version: raw.version,
      downloadUrl,
      notes: raw.notes ?? '',
      releasedAt: raw.releasedAt ?? '',
    };
  } catch (err) {
    // Surface the failure to whatever console the host exposes — the launch
    // flow stays resilient (returns null) but a future "no update toast"
    // bug becomes diagnosable instead of silent.
    console.warn('[checkForUpdate] manifest fetch failed:', err);
    return null;
  }
}
