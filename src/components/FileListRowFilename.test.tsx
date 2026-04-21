import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FileListRowFilename } from './FileListRowFilename';
import type { ProcessedFile } from '@/hooks/useFileProcessor';

function makeFile(overrides: Partial<ProcessedFile> = {}): ProcessedFile {
  const path = overrides.path ?? 'a.txt';
  const normalizedName = overrides.normalizedName ?? path;
  const normalizedPath = overrides.normalizedPath ?? path;
  return {
    id: overrides.id ?? 'test-1',
    file: new File(['x'], overrides.originalName ?? 'a.txt'),
    originalName: overrides.originalName ?? 'a.txt',
    normalizedName,
    path,
    normalizedPath,
    needsNormalization: overrides.needsNormalization ?? false,
    size: overrides.size ?? 100,
  };
}

describe('FileListRowFilename', () => {
  it('renders the filename as a span by default', () => {
    render(<FileListRowFilename file={makeFile({ path: 'hello.txt' })} onRename={vi.fn()} />);
    expect(screen.getByText('hello.txt')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('switches to input on click', () => {
    render(<FileListRowFilename file={makeFile({ path: 'hello.txt' })} onRename={vi.fn()} />);
    fireEvent.click(screen.getByText('hello.txt'));
    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveValue('hello.txt');
  });

  it('commits on Enter and calls onRename', () => {
    const onRename = vi.fn();
    render(<FileListRowFilename file={makeFile({ id: 'abc', path: 'hello.txt' })} onRename={onRename} />);
    fireEvent.click(screen.getByText('hello.txt'));
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'newname.txt' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onRename).toHaveBeenCalledWith('abc', 'newname.txt');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('cancels on Escape, does not call onRename', () => {
    const onRename = vi.fn();
    render(<FileListRowFilename file={makeFile({ path: 'hello.txt' })} onRename={onRename} />);
    fireEvent.click(screen.getByText('hello.txt'));
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'newname.txt' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onRename).not.toHaveBeenCalled();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByText('hello.txt')).toBeInTheDocument();
  });

  it('commits on blur', () => {
    const onRename = vi.fn();
    render(<FileListRowFilename file={makeFile({ id: 'abc', path: 'hello.txt' })} onRename={onRename} />);
    fireEvent.click(screen.getByText('hello.txt'));
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'blur-commit.txt' } });
    fireEvent.blur(input);
    expect(onRename).toHaveBeenCalledWith('abc', 'blur-commit.txt');
  });

  it('does not commit if value unchanged', () => {
    const onRename = vi.fn();
    render(<FileListRowFilename file={makeFile({ path: 'hello.txt' })} onRename={onRename} />);
    fireEvent.click(screen.getByText('hello.txt'));
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
    expect(onRename).not.toHaveBeenCalled();
  });
});
