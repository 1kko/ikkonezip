import { useState, useEffect } from 'react';

export type DesktopPlatform = 'macos' | 'windows' | 'linux';

export interface DesktopDownloads {
  macos: string;
  windows: string;
  linux: string;
}

export interface DesktopRelease {
  version: string;
  downloads: DesktopDownloads;
  notes?: string;
  releasedAt?: string;
}

const MANIFEST_URL = '/desktop-latest.json';

interface RawManifest extends Partial<DesktopRelease> {
  /** Legacy single-platform field — kept readable so old manifests still surface a macOS link. */
  downloadUrl?: string;
}

function normalize(raw: RawManifest | null): DesktopRelease | null {
  if (!raw || !raw.version || raw.version === '0.0.0') return null;
  const downloads: DesktopDownloads = {
    macos: raw.downloads?.macos ?? raw.downloadUrl ?? '',
    windows: raw.downloads?.windows ?? '',
    linux: raw.downloads?.linux ?? '',
  };
  // Reject the manifest entirely if no platform has a usable URL.
  if (!downloads.macos && !downloads.windows && !downloads.linux) return null;
  return {
    version: raw.version,
    downloads,
    notes: raw.notes,
    releasedAt: raw.releasedAt,
  };
}

/**
 * Fetches the desktop release manifest on mount and returns a normalized
 * { version, downloads: { macos, windows, linux }, … }. Returns null while
 * loading, on network/parse error, when the manifest is the placeholder
 * "0.0.0", or when no platform has a download URL.
 *
 * Cancellation-safe: if the component unmounts before the fetch resolves,
 * setState is skipped via a cancelled flag.
 */
export function useDesktopRelease(): DesktopRelease | null {
  const [release, setRelease] = useState<DesktopRelease | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(MANIFEST_URL, { cache: 'no-cache' })
      .then((r) => (r.ok ? (r.json() as Promise<RawManifest>) : null))
      .then((m) => {
        if (cancelled) return;
        const normalized = normalize(m);
        if (normalized) setRelease(normalized);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return release;
}
