/**
 * True iff the SPA is running on a macOS user agent. Used to gate the
 * "맥용 앱 다운로드" Header button — non-Mac users see the PWA install
 * prompt instead since we don't ship a Windows/Linux native app.
 *
 * Modern Chromium exposes `userAgentData.platform` (preferred) but Safari
 * and Firefox don't, so we fall back to the deprecated `navigator.platform`
 * which still works everywhere for this single use case.
 */
export function isMac(): boolean {
  if (typeof navigator === 'undefined') return false;
  const uaData = (navigator as Navigator & {
    userAgentData?: { platform?: string };
  }).userAgentData;
  if (uaData?.platform) return uaData.platform === 'macOS';
  return /Mac/i.test(navigator.platform);
}
