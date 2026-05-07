import { useState, useEffect } from 'react';
import { isImageFile } from '@/utils/isImageFile';

/**
 * Generates a temporary blob URL for image files. Returns null for non-images
 * or when `file` is null. Automatically revokes the URL on unmount or when the
 * file changes.
 */
export function useThumbnail(file: File | null): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file || !isImageFile(file)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUrl(null);
      return;
    }

    const blobUrl = URL.createObjectURL(file);
    setUrl(blobUrl);

    return () => {
      URL.revokeObjectURL(blobUrl);
    };
  }, [file]);

  return url;
}
