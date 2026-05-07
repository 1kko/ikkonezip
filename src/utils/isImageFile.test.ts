import { describe, it, expect } from 'vitest';
import { isImageFile, IMAGE_EXTENSIONS } from './isImageFile';

describe('isImageFile', () => {
  it('returns true when MIME type starts with image/', () => {
    const f = new File(['x'], 'noext', { type: 'image/png' });
    expect(isImageFile(f)).toBe(true);
  });

  it('returns true when MIME is missing but extension is an image type', () => {
    for (const ext of IMAGE_EXTENSIONS) {
      const f = new File(['x'], `photo.${ext}`, { type: '' });
      expect(isImageFile(f), ext).toBe(true);
    }
  });

  it('matches uppercase extensions', () => {
    const f = new File(['x'], 'PIC.JPG', { type: '' });
    expect(isImageFile(f)).toBe(true);
  });

  it('returns false for non-image files', () => {
    const f = new File(['x'], 'doc.pdf', { type: 'application/pdf' });
    expect(isImageFile(f)).toBe(false);
  });

  it('returns false when name has no extension and MIME is missing', () => {
    const f = new File(['x'], 'README', { type: '' });
    expect(isImageFile(f)).toBe(false);
  });
});
