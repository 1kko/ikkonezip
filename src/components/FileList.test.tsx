import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FileList } from './FileList';
import type { ProcessedFile } from '@/hooks/useFileProcessor';

function makeFile(overrides: Partial<ProcessedFile> = {}): ProcessedFile {
  return {
    id: overrides.id ?? `file-${Math.random()}`,
    file: new File(['x'], overrides.originalName ?? 'a.txt'),
    originalName: overrides.originalName ?? 'a.txt',
    normalizedName: overrides.normalizedName ?? overrides.path ?? 'a.txt',
    path: overrides.path ?? 'a.txt',
    normalizedPath: overrides.normalizedPath ?? 'a.txt',
    needsNormalization: overrides.needsNormalization ?? false,
    size: overrides.size ?? 100,
  };
}

describe('FileList', () => {
  it('renders nothing when files array is empty', () => {
    const { container } = render(<FileList files={[]} onRemoveFiles={vi.fn()} onRename={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders one row per file', () => {
    const files = [
      makeFile({ id: '1', path: 'a.txt' }),
      makeFile({ id: '2', path: 'b.txt' }),
      makeFile({ id: '3', path: 'c.txt' }),
    ];
    render(<FileList files={files} onRemoveFiles={vi.fn()} onRename={vi.fn()} />);
    expect(screen.getByText('a.txt')).toBeInTheDocument();
    expect(screen.getByText('b.txt')).toBeInTheDocument();
    expect(screen.getByText('c.txt')).toBeInTheDocument();
  });

  it('shows total file count badge', () => {
    const files = [makeFile({ id: '1' }), makeFile({ id: '2' })];
    render(<FileList files={files} onRemoveFiles={vi.fn()} onRename={vi.fn()} />);
    expect(screen.getByText('2개 파일')).toBeInTheDocument();
  });

  it('shows NFD-needed count when any files need normalization', () => {
    const files = [
      makeFile({ id: '1', needsNormalization: true }),
      makeFile({ id: '2', needsNormalization: false }),
    ];
    render(<FileList files={files} onRemoveFiles={vi.fn()} onRename={vi.fn()} />);
    expect(screen.getByText('1개 정규화 필요')).toBeInTheDocument();
  });

  it('select-all toggles all rows', () => {
    const files = [makeFile({ id: '1' }), makeFile({ id: '2' })];
    const onRemoveFiles = vi.fn();
    render(<FileList files={files} onRemoveFiles={onRemoveFiles} onRename={vi.fn()} />);

    const selectAll = screen.getByRole('checkbox', { name: '전체 선택' });
    fireEvent.click(selectAll);

    const removeBtn = screen.getByRole('button', { name: /선택 삭제/ });
    fireEvent.click(removeBtn);

    expect(onRemoveFiles).toHaveBeenCalledWith(expect.arrayContaining(['1', '2']));
  });

  it('remove-selected button is disabled when nothing selected', () => {
    render(<FileList files={[makeFile({ id: '1' })]} onRemoveFiles={vi.fn()} onRename={vi.fn()} />);
    const removeBtn = screen.getByRole('button', { name: /선택 삭제/ });
    expect(removeBtn).toBeDisabled();
  });
});
