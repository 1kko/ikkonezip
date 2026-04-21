import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FileListRow } from './FileListRow';
import type { ProcessedFile } from '@/hooks/useFileProcessor';

function makeFile(overrides: Partial<ProcessedFile> = {}): ProcessedFile {
  return {
    id: overrides.id ?? 'test-1',
    file: new File(['x'], overrides.originalName ?? 'a.txt'),
    originalName: overrides.originalName ?? 'a.txt',
    normalizedName: overrides.normalizedName ?? 'a.txt',
    path: overrides.path ?? 'a.txt',
    normalizedPath: overrides.normalizedPath ?? 'a.txt',
    needsNormalization: overrides.needsNormalization ?? false,
    size: overrides.size ?? 1024,
  };
}

describe('FileListRow', () => {
  it('renders the filename', () => {
    render(<FileListRow file={makeFile({ path: 'hello.txt' })} selected={false} onToggleSelect={vi.fn()} />);
    expect(screen.getByText('hello.txt')).toBeInTheDocument();
  });

  it('shows NFD badge when needsNormalization is true', () => {
    render(<FileListRow file={makeFile({ needsNormalization: true })} selected={false} onToggleSelect={vi.fn()} />);
    expect(screen.getByText('NFD')).toBeInTheDocument();
  });

  it('does not show NFD badge when needsNormalization is false', () => {
    render(<FileListRow file={makeFile({ needsNormalization: false })} selected={false} onToggleSelect={vi.fn()} />);
    expect(screen.queryByText('NFD')).not.toBeInTheDocument();
  });

  it('shows formatted file size', () => {
    render(<FileListRow file={makeFile({ size: 1024 })} selected={false} onToggleSelect={vi.fn()} />);
    expect(screen.getByText('1 KB')).toBeInTheDocument();
  });

  it('calls onToggleSelect with file id when row clicked', () => {
    const onToggle = vi.fn();
    render(<FileListRow file={makeFile({ id: 'abc' })} selected={false} onToggleSelect={onToggle} />);
    fireEvent.click(screen.getByText('a.txt'));
    expect(onToggle).toHaveBeenCalledWith('abc');
  });

  it('checkbox reflects selected prop', () => {
    const { rerender } = render(<FileListRow file={makeFile()} selected={false} onToggleSelect={vi.fn()} />);
    expect(screen.getByRole('checkbox')).not.toBeChecked();

    rerender(<FileListRow file={makeFile()} selected={true} onToggleSelect={vi.fn()} />);
    expect(screen.getByRole('checkbox')).toBeChecked();
  });
});
