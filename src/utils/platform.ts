import type { DesktopPlatform } from '@/hooks/useDesktopRelease';

/**
 * Detects the user-agent's OS family. Used to highlight the matching
 * native installer in the Header download row. Returns null when the
 * platform isn't one we ship a desktop build for.
 *
 * Modern Chromium exposes `userAgentData.platform` (preferred) but Safari
 * and Firefox don't, so we fall back to the deprecated `navigator.platform`
 * which still works everywhere for this single use case.
 */
export function detectPlatform(): DesktopPlatform | null {
  if (typeof navigator === 'undefined') return null;
  const uaData = (navigator as Navigator & {
    userAgentData?: { platform?: string };
  }).userAgentData;
  const raw = uaData?.platform ?? navigator.platform ?? '';
  const lower = raw.toLowerCase();
  if (uaData?.platform) {
    if (raw === 'macOS') return 'macos';
    if (raw === 'Windows') return 'windows';
    if (raw === 'Linux') return 'linux';
  }
  if (/mac/.test(lower)) return 'macos';
  if (/win/.test(lower)) return 'windows';
  if (/linux/.test(lower)) return 'linux';
  return null;
}

/** Back-compat for callers that just need the macOS check. */
export function isMac(): boolean {
  return detectPlatform() === 'macos';
}
