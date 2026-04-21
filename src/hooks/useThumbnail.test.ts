import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useThumbnail } from './useThumbnail';

describe('useThumbnail', () => {
  let createObjectURL: typeof URL.createObjectURL;
  let revokeObjectURL: typeof URL.revokeObjectURL;

  beforeEach(() => {
    createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
    revokeObjectURL = vi.fn();
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns null for non-image file', () => {
    const file = new File(['x'], 'doc.pdf', { type: 'application/pdf' });
    const { result } = renderHook(() => useThumbnail(file));
    expect(result.current).toBeNull();
  });

  it('returns blob URL for image file by mime type', () => {
    const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' });
    const { result } = renderHook(() => useThumbnail(file));
    expect(result.current).toBe('blob:mock-url');
    expect(createObjectURL).toHaveBeenCalledWith(file);
  });

  it('returns blob URL for image file by extension when mime is missing', () => {
    const file = new File(['x'], 'photo.png', { type: '' });
    const { result } = renderHook(() => useThumbnail(file));
    expect(result.current).toBe('blob:mock-url');
  });

  it('revokes URL on unmount', () => {
    const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' });
    const { unmount } = renderHook(() => useThumbnail(file));
    unmount();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });

  it('revokes old URL when file changes', async () => {
    const file1 = new File(['a'], 'a.jpg', { type: 'image/jpeg' });
    const file2 = new File(['b'], 'b.jpg', { type: 'image/jpeg' });
    const { rerender } = renderHook(({ f }: { f: File }) => useThumbnail(f), {
      initialProps: { f: file1 },
    });
    rerender({ f: file2 });
    await waitFor(() => {
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    });
  });

  it('does not call createObjectURL for non-image', () => {
    const file = new File(['x'], 'doc.pdf', { type: 'application/pdf' });
    renderHook(() => useThumbnail(file));
    expect(createObjectURL).not.toHaveBeenCalled();
  });
});
