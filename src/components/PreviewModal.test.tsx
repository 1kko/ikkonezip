import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PreviewModal } from './PreviewModal';
import type { ProcessedFile } from '@/hooks/useFileProcessor';

function makeFile(overrides: Partial<ProcessedFile> = {}): ProcessedFile {
  return {
    id: overrides.id ?? `file-${Math.random()}`,
    file: new File(['x'], overrides.originalName ?? 'a.txt'),
    originalName: overrides.originalName ?? 'a.txt',
    normalizedName: overrides.normalizedName ?? 'a.txt',
    path: overrides.path ?? 'a.txt',
    normalizedPath: overrides.normalizedPath ?? 'a.txt',
    needsNormalization: overrides.needsNormalization ?? false,
    size: overrides.size ?? 100,
  };
}

describe('PreviewModal', () => {
  it('renders nothing when open is false', () => {
    render(
      <PreviewModal
        open={false}
        files={[makeFile({ needsNormalization: true })]}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.queryByText(/미리보기/)).not.toBeInTheDocument();
  });

  it('shows rename diffs for files needing normalization', () => {
    const files = [
      makeFile({ id: '1', path: '\u1100\u1161.txt', normalizedPath: '\uAC00.txt', needsNormalization: true }),
      makeFile({ id: '2', path: 'normal.txt', normalizedPath: 'normal.txt', needsNormalization: false }),
    ];
    render(<PreviewModal open={true} files={files} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText('\u1100\u1161.txt')).toBeInTheDocument();
    expect(screen.getByText('\uAC00.txt')).toBeInTheDocument();
  });

  it('only lists files needing normalization (filters unchanged)', () => {
    const files = [
      makeFile({ id: '1', path: 'unchanged.txt', needsNormalization: false }),
      makeFile({ id: '2', path: 'will-change.txt', normalizedPath: 'will-change-normalized.txt', needsNormalization: true }),
    ];
    render(<PreviewModal open={true} files={files} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.queryByText('unchanged.txt')).not.toBeInTheDocument();
    expect(screen.getByText('will-change.txt')).toBeInTheDocument();
  });

  it('calls onConfirm when confirm button clicked', () => {
    const onConfirm = vi.fn();
    render(
      <PreviewModal
        open={true}
        files={[makeFile({ needsNormalization: true })]}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /다운로드 진행/ }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when cancel button clicked', () => {
    const onCancel = vi.fn();
    render(
      <PreviewModal
        open={true}
        files={[makeFile({ needsNormalization: true })]}
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /취소/ }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
