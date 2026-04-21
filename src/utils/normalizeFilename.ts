export type NormalizationForm = 'NFC' | 'NFD';

/**
 * Normalizes a filename to the requested Unicode normalization form.
 *
 * Default 'NFC' fixes the macOS→Windows case (NFD-decomposed Korean filenames
 * appear garbled on Windows). Use 'NFD' for the reverse direction
 * (Windows→macOS) when the destination expects decomposed form.
 */
export function normalizeFilename(
  filename: string,
  targetForm: NormalizationForm = 'NFC'
): string {
  return filename.normalize(targetForm);
}

/**
 * Checks if a filename needs normalization (contains NFD characters).
 */
export function needsNormalization(filename: string): boolean {
  return filename !== filename.normalize('NFC');
}
