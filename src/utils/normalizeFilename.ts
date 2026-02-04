/**
 * Normalizes a filename from NFD (decomposed) to NFC (composed) form.
 *
 * macOS stores filenames in NFD form where Korean characters are decomposed
 * (e.g., "가" becomes "ㄱ" + "ㅏ"), while Windows expects NFC form.
 * This function converts NFD to NFC to prevent garbled Korean filenames.
 */
export function normalizeFilename(filename: string): string {
  return filename.normalize('NFC');
}

/**
 * Checks if a filename needs normalization (contains NFD characters).
 */
export function needsNormalization(filename: string): boolean {
  return filename !== filename.normalize('NFC');
}
