import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FileListRow } from './FileListRow';
import type { ProcessedFile } from '@/hooks/useFileProcessor';
import { DndContext } from '@dnd-kit/core';
import { SortableContext } from '@dnd-kit/sortable';
import type { ReactNode } from 'react';

function renderWithDnd(ui: ReactNode, id: string) {
  return render(
    <DndContext>
      <SortableContext items={[id]}>
        {ui}
      </SortableContext>
    </DndContext>
  );
}

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
    renderWithDnd(<FileListRow file={file} selected={false} onToggleSelect={vi.fn()} onRename={vi.fn()} />, file.id);
    expect(screen.getByText('hello.txt')).toBeInTheDocument();
  });

  it('shows NFD badge when needsNormalization is true', () => {
    const file = makeFile({ needsNormalization: true });
    renderWithDnd(<FileListRow file={file} selected={false} onToggleSelect={vi.fn()} onRename={vi.fn()} />, file.id);
    expect(screen.getByText('NFD')).toBeInTheDocument();
  });

  it('does not show NFD badge when needsNormalization is false', () => {
    const file = makeFile({ needsNormalization: false });
    renderWithDnd(<FileListRow file={file} selected={false} onToggleSelect={vi.fn()} onRename={vi.fn()} />, file.id);
    expect(screen.queryByText('NFD')).not.toBeInTheDocument();
  });

  it('shows formatted file size', () => {
    const file = makeFile({ size: 1024 });
    renderWithDnd(<FileListRow file={file} selected={false} onToggleSelect={vi.fn()} onRename={vi.fn()} />, file.id);
    expect(screen.getByText('1 KB')).toBeInTheDocument();
  });

  it('calls onToggleSelect with file id when row clicked', () => {
    const onToggle = vi.fn();
    const file = makeFile({ id: 'abc' });
    const { container } = renderWithDnd(<FileListRow file={file} selected={false} onToggleSelect={onToggle} onRename={vi.fn()} />, file.id);
    const row = container.querySelector('div[title="a.txt"]');
    if (row) fireEvent.click(row);
    expect(onToggle).toHaveBeenCalledWith('abc');
  });

  it('checkbox reflects selected prop', () => {
    const file = makeFile();
    const { rerender } = renderWithDnd(<FileListRow file={file} selected={false} onToggleSelect={vi.fn()} onRename={vi.fn()} />, file.id);
    expect(screen.getByRole('checkbox')).not.toBeChecked();

    rerender(
      <DndContext>
        <SortableContext items={[file.id]}>
          <FileListRow file={file} selected={true} onToggleSelect={vi.fn()} onRename={vi.fn()} />
        </SortableContext>
      </DndContext>
    );
    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  it('renders the drag handle with the Korean aria-label', () => {
    const file = makeFile();
    renderWithDnd(<FileListRow file={file} selected={false} onToggleSelect={vi.fn()} onRename={vi.fn()} />, file.id);
    expect(screen.getByRole('button', { name: '파일 순서 변경 핸들' })).toBeInTheDocument();
  });

  it('clicking the drag handle does NOT toggle row selection', () => {
    const onToggleSelect = vi.fn();
    const file = makeFile();
    renderWithDnd(
      <FileListRow file={file} selected={false} onToggleSelect={onToggleSelect} onRename={vi.fn()} />,
      file.id
    );
    fireEvent.click(screen.getByRole('button', { name: '파일 순서 변경 핸들' }));
    expect(onToggleSelect).not.toHaveBeenCalled();
  });
});
