import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { FileListRow } from './FileListRow';
import type { ProcessedFile } from '@/hooks/useFileProcessor';

const GRID = '20px 320px 80px 220px';

function makeFile(overrides: Partial<ProcessedFile> = {}): ProcessedFile {
  return {
    id: overrides.id ?? 'test-1',
    file: new File(['x'], overrides.originalName ?? 'a.txt'),
    originalName: overrides.originalName ?? 'a.txt',
    normalizedName: overrides.normalizedName ?? overrides.path ?? 'a.txt',
    path: overrides.path ?? 'a.txt',
    normalizedPath: overrides.normalizedPath ?? 'a.txt',
    needsNormalization: overrides.needsNormalization ?? false,
    size: overrides.size ?? 1024,
  };
}

describe('FileListRow', () => {
  it('renders the filename', () => {
    const file = makeFile({ path: 'hello.txt' });
    render(<FileListRow file={file} selected={false} onToggleSelect={vi.fn()} onRename={vi.fn()} gridTemplateColumns={GRID} />);
    expect(screen.getByText('hello.txt')).toBeInTheDocument();
  });

  it('shows the NFD dot when needsNormalization is true', () => {
    const file = makeFile({ needsNormalization: true });
    render(<FileListRow file={file} selected={false} onToggleSelect={vi.fn()} onRename={vi.fn()} gridTemplateColumns={GRID} />);
    expect(screen.getByLabelText('NFD (정규화 필요)')).toBeInTheDocument();
  });

  it('does NOT show the NFD dot when needsNormalization is false', () => {
    const file = makeFile({ needsNormalization: false });
    render(<FileListRow file={file} selected={false} onToggleSelect={vi.fn()} onRename={vi.fn()} gridTemplateColumns={GRID} />);
    expect(screen.queryByLabelText('NFD (정규화 필요)')).not.toBeInTheDocument();
  });

  it('shows formatted file size', () => {
    const file = makeFile({ size: 1024 });
    render(<FileListRow file={file} selected={false} onToggleSelect={vi.fn()} onRename={vi.fn()} gridTemplateColumns={GRID} />);
    expect(screen.getByText('1 KB')).toBeInTheDocument();
  });

  it('shows the folder prefix in the path column', () => {
    const file = makeFile({ path: 'root/sub/a.txt', normalizedPath: 'root/sub/a.txt', normalizedName: 'a.txt' });
    render(<FileListRow file={file} selected={false} onToggleSelect={vi.fn()} onRename={vi.fn()} gridTemplateColumns={GRID} />);
    expect(screen.getByText('root/sub')).toBeInTheDocument();
  });

  it('shows an em dash for root-level files', () => {
    const file = makeFile({ path: 'a.txt', normalizedPath: 'a.txt' });
    render(<FileListRow file={file} selected={false} onToggleSelect={vi.fn()} onRename={vi.fn()} gridTemplateColumns={GRID} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('calls onToggleSelect with file id when row clicked', () => {
    const onToggle = vi.fn();
    const file = makeFile({ id: 'abc' });
    const { container } = render(<FileListRow file={file} selected={false} onToggleSelect={onToggle} onRename={vi.fn()} gridTemplateColumns={GRID} />);
    const row = container.querySelector('div[title="a.txt"]');
    if (row) fireEvent.click(row);
    expect(onToggle).toHaveBeenCalledWith('abc');
  });

  it('checkbox reflects selected prop', () => {
    const file = makeFile();
    const { rerender } = render(<FileListRow file={file} selected={false} onToggleSelect={vi.fn()} onRename={vi.fn()} gridTemplateColumns={GRID} />);
    expect(screen.getByRole('checkbox')).not.toBeChecked();

    rerender(<FileListRow file={file} selected={true} onToggleSelect={vi.fn()} onRename={vi.fn()} gridTemplateColumns={GRID} />);
    expect(screen.getByRole('checkbox')).toBeChecked();
  });
});
