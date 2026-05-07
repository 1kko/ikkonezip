import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { ImagePreviewModal } from './ImagePreviewModal';
import type { ProcessedFile } from '@/hooks/useFileProcessor';

function makeImage(name: string, id: string): ProcessedFile {
  return {
    id,
    file: new File(['x'], name, { type: 'image/jpeg' }),
    originalName: name,
    normalizedName: name,
    path: name,
    normalizedPath: name,
    needsNormalization: false,
    size: 100,
  };
}

describe('ImagePreviewModal', () => {
  beforeEach(() => {
    URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders nothing when index is null', () => {
    render(
      <ImagePreviewModal
        files={[makeImage('a.jpg', '1')]}
        index={null}
        onIndexChange={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows the current image filename and counter', () => {
    render(
      <ImagePreviewModal
        files={[makeImage('a.jpg', '1'), makeImage('b.jpg', '2')]}
        index={0}
        onIndexChange={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByText('a.jpg')).toBeInTheDocument();
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
  });

  it('calls onIndexChange when next button clicked', () => {
    const onIndexChange = vi.fn();
    render(
      <ImagePreviewModal
        files={[makeImage('a.jpg', '1'), makeImage('b.jpg', '2')]}
        index={0}
        onIndexChange={onIndexChange}
        onClose={vi.fn()}
      />
    );
    fireEvent.click(screen.getByLabelText('다음 이미지'));
    expect(onIndexChange).toHaveBeenCalledWith(1);
  });

  it('calls onIndexChange when prev button clicked', () => {
    const onIndexChange = vi.fn();
    render(
      <ImagePreviewModal
        files={[makeImage('a.jpg', '1'), makeImage('b.jpg', '2')]}
        index={1}
        onIndexChange={onIndexChange}
        onClose={vi.fn()}
      />
    );
    fireEvent.click(screen.getByLabelText('이전 이미지'));
    expect(onIndexChange).toHaveBeenCalledWith(0);
  });

  it('disables prev at index 0 and next at last index', () => {
    const files = [makeImage('a.jpg', '1'), makeImage('b.jpg', '2')];
    const { rerender } = render(
      <ImagePreviewModal files={files} index={0} onIndexChange={vi.fn()} onClose={vi.fn()} />
    );
    expect(screen.getByLabelText('이전 이미지')).toBeDisabled();
    expect(screen.getByLabelText('다음 이미지')).not.toBeDisabled();

    rerender(
      <ImagePreviewModal files={files} index={1} onIndexChange={vi.fn()} onClose={vi.fn()} />
    );
    expect(screen.getByLabelText('이전 이미지')).not.toBeDisabled();
    expect(screen.getByLabelText('다음 이미지')).toBeDisabled();
  });

  it('navigates with ArrowRight key', () => {
    const onIndexChange = vi.fn();
    render(
      <ImagePreviewModal
        files={[makeImage('a.jpg', '1'), makeImage('b.jpg', '2')]}
        index={0}
        onIndexChange={onIndexChange}
        onClose={vi.fn()}
      />
    );
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(onIndexChange).toHaveBeenCalledWith(1);
  });

  it('navigates with ArrowLeft key', () => {
    const onIndexChange = vi.fn();
    render(
      <ImagePreviewModal
        files={[makeImage('a.jpg', '1'), makeImage('b.jpg', '2')]}
        index={1}
        onIndexChange={onIndexChange}
        onClose={vi.fn()}
      />
    );
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(onIndexChange).toHaveBeenCalledWith(0);
  });

  it('ignores ArrowRight at the last index', () => {
    const onIndexChange = vi.fn();
    render(
      <ImagePreviewModal
        files={[makeImage('a.jpg', '1'), makeImage('b.jpg', '2')]}
        index={1}
        onIndexChange={onIndexChange}
        onClose={vi.fn()}
      />
    );
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(onIndexChange).not.toHaveBeenCalled();
  });

  it('ignores ArrowLeft at index 0', () => {
    const onIndexChange = vi.fn();
    render(
      <ImagePreviewModal
        files={[makeImage('a.jpg', '1'), makeImage('b.jpg', '2')]}
        index={0}
        onIndexChange={onIndexChange}
        onClose={vi.fn()}
      />
    );
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(onIndexChange).not.toHaveBeenCalled();
  });

  it('does not handle arrow keys when closed', () => {
    const onIndexChange = vi.fn();
    render(
      <ImagePreviewModal
        files={[makeImage('a.jpg', '1'), makeImage('b.jpg', '2')]}
        index={null}
        onIndexChange={onIndexChange}
        onClose={vi.fn()}
      />
    );
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(onIndexChange).not.toHaveBeenCalled();
  });

  it('ignores arrow keys with modifier pressed', () => {
    const onIndexChange = vi.fn();
    render(
      <ImagePreviewModal
        files={[makeImage('a.jpg', '1'), makeImage('b.jpg', '2')]}
        index={0}
        onIndexChange={onIndexChange}
        onClose={vi.fn()}
      />
    );
    fireEvent.keyDown(window, { key: 'ArrowRight', metaKey: true });
    expect(onIndexChange).not.toHaveBeenCalled();
  });
});
