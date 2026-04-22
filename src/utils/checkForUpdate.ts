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
