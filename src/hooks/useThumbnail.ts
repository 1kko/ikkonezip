import { useState, useEffect } from 'react';

// SVG note: rendering SVG via <img src={blobUrl}> blocks <script> execution
// per HTML spec (image-element loading). User-uploaded SVGs are safe to thumbnail.
const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg']);

function isImage(file: File): boolean {
  if (file.type.startsWith('image/')) return true;
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  return IMAGE_EXTENSIONS.has(ext);
}

/**
 * Generates a temporary blob URL for image files. Returns null for non-images.
 * Automatically revokes the URL on unmount or when the file changes.
 */
export function useThumbnail(file: File): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!isImage(file)) {
      return;
    }

    const blobUrl = URL.createObjectURL(file);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUrl(blobUrl);

    return () => {
      URL.revokeObjectURL(blobUrl);
    };
  }, [file]);

  return url;
}
