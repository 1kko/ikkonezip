/**
 * Decodes a ZIP entry's raw filename bytes using a heuristic that handles
 * the common Korean-filename failure modes:
 *
 * 1. macOS Finder writes UTF-8 NFD bytes but does not set the UTF-8 flag
 *    (general purpose bit 11) — strict spec readers misread as CP437.
 * 2. Korean Windows tools (알집, 반디집, older 탐색기) write CP949 bytes
 *    with bit 11 unset.
 * 3. A few writers set bit 11 but emit non-UTF-8 bytes (liar flag).
 *
 * Detection order: ASCII → trust bit 11 → fall back to strict UTF-8 →
 * strict CP949 → caller-provided fallback (whatever zip.js produced).
 */

const utf8Strict = new TextDecoder('utf-8', { fatal: true });
const utf8Lenient = new TextDecoder('utf-8');
const eucKrStrict = new TextDecoder('euc-kr', { fatal: true });

function isAscii(bytes: Uint8Array): boolean {
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] >= 0x80) return false;
  }
  return true;
}

export function decodeZipEntryFilename(
  rawFilename: Uint8Array,
  utf8Flag: boolean,
  fallback: string,
): string {
  if (rawFilename.length === 0) return fallback;

  if (isAscii(rawFilename)) {
    return utf8Lenient.decode(rawFilename);
  }

  if (utf8Flag) {
    try {
      return utf8Strict.decode(rawFilename);
    } catch {
      // Liar flag: bit 11 set but bytes aren't valid UTF-8. Fall through.
    }
  }

  try {
    return utf8Strict.decode(rawFilename);
  } catch {
    // Not UTF-8.
  }

  try {
    return eucKrStrict.decode(rawFilename);
  } catch {
    // Not EUC-KR/CP949 either.
  }

  return fallback;
}
