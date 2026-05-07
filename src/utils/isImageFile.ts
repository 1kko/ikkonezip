// SVG note: rendering SVG via <img src={blobUrl}> blocks <script> execution
// per HTML spec (image-element loading). User-uploaded SVGs are safe to thumbnail.
export const IMAGE_EXTENSIONS = new Set([
  'jpg',
  'jpeg',
  'png',
  'gif',
  'webp',
  'bmp',
  'svg',
]);

export function isImageFile(file: File): boolean {
  if (file.type.startsWith('image/')) return true;
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  return IMAGE_EXTENSIONS.has(ext);
}
