import { semverGt } from './semverGt';
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

const PROCESS_TO_PLATFORM: Record<string, keyof DesktopDownloads> = {
  darwin: 'macos',
  win32: 'windows',
  linux: 'linux',
};

function pickPlatformDownload(raw: RawManifest): string {
  // Surface the host's process.platform when running inside Tauri (where the
  // node-style global is exposed). The web bundle has no `process`, so this
  // resolves to '' and we fall back to the legacy/multi-platform fields.
  const proc = (globalThis as { process?: { platform?: string } }).process;
  const p = proc?.platform ?? '';
  const platform = PROCESS_TO_PLATFORM[p];
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
    const r = await fetch(MANIFEST_URL, { cache: 'no-cache' });
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
  } catch {
    return null;
  }
}
