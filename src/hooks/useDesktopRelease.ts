import { useState, useEffect } from 'react';

export interface DesktopRelease {
  version: string;
  downloadUrl: string;
  notes?: string;
  releasedAt?: string;
}

const MANIFEST_URL = '/desktop-latest.json';

/**
 * Fetches the desktop release manifest on mount and returns it. Returns
 * null while loading, on network/parse error, or when the manifest is the
 * placeholder version "0.0.0" (no real release shipped yet).
 *
 * Cancellation-safe: if the component unmounts before the fetch resolves,
 * setState is skipped via a cancelled flag.
 */
export function useDesktopRelease(): DesktopRelease | null {
  const [release, setRelease] = useState<DesktopRelease | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(MANIFEST_URL, { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : null))
      .then((m: DesktopRelease | null) => {
        if (cancelled || !m || !m.downloadUrl || m.version === '0.0.0') return;
        setRelease(m);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return release;
}
