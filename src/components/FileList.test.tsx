import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
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
    const { container } = render(<FileList files={[]} onRemoveFiles={vi.fn()} onRename={vi.fn()} onReorder={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders one row per file', () => {
    const files = [
      makeFile({ id: '1', path: 'a.txt' }),
      makeFile({ id: '2', path: 'b.txt' }),
      makeFile({ id: '3', path: 'c.txt' }),
    ];
    render(<FileList files={files} onRemoveFiles={vi.fn()} onRename={vi.fn()} onReorder={vi.fn()} />);
    expect(screen.getByText('a.txt')).toBeInTheDocument();
    expect(screen.getByText('b.txt')).toBeInTheDocument();
    expect(screen.getByText('c.txt')).toBeInTheDocument();
  });

  it('shows total file count badge', () => {
    const files = [makeFile({ id: '1' }), makeFile({ id: '2' })];
    render(<FileList files={files} onRemoveFiles={vi.fn()} onRename={vi.fn()} onReorder={vi.fn()} />);
    expect(screen.getByText('2개 파일')).toBeInTheDocument();
  });

  it('shows NFD-needed count when any files need normalization', () => {
    const files = [
      makeFile({ id: '1', needsNormalization: true }),
      makeFile({ id: '2', needsNormalization: false }),
    ];
    render(<FileList files={files} onRemoveFiles={vi.fn()} onRename={vi.fn()} onReorder={vi.fn()} />);
    expect(screen.getByText('1개 정규화 필요')).toBeInTheDocument();
  });

  it('select-all toggles all rows', () => {
    const files = [makeFile({ id: '1' }), makeFile({ id: '2' })];
    const onRemoveFiles = vi.fn();
    render(<FileList files={files} onRemoveFiles={onRemoveFiles} onRename={vi.fn()} onReorder={vi.fn()} />);

    const selectAll = screen.getByRole('checkbox', { name: '전체 선택' });
    fireEvent.click(selectAll);

    const removeBtn = screen.getByRole('button', { name: /선택 삭제/ });
    fireEvent.click(removeBtn);

    expect(onRemoveFiles).toHaveBeenCalledWith(expect.arrayContaining(['1', '2']));
  });

  it('remove-selected button is disabled when nothing selected', () => {
    render(<FileList files={[makeFile({ id: '1' })]} onRemoveFiles={vi.fn()} onRename={vi.fn()} onReorder={vi.fn()} />);
    const removeBtn = screen.getByRole('button', { name: /선택 삭제/ });
    expect(removeBtn).toBeDisabled();
  });
});

function makeFiles(n: number): ProcessedFile[] {
  return Array.from({ length: n }, (_, i) => {
    const name = `file-${String(i).padStart(3, '0')}.txt`;
    return {
      id: `id-${i}`,
      file: new File(['x'], name, { type: 'text/plain' }),
      originalName: name,
      normalizedName: name,
      path: name,
      normalizedPath: name,
      needsNormalization: false,
      size: 1,
    };
  });
}

describe('FileList — search/filter at ≥50 files', () => {
  it('does NOT render the search input when files.length < 50', () => {
    render(
      <FileList
        files={makeFiles(49)}
        onRemoveFiles={vi.fn()}
        onRename={vi.fn()}
        onReorder={vi.fn()}
      />
    );
    expect(screen.queryByPlaceholderText('파일 이름 검색…')).not.toBeInTheDocument();
  });

  it('renders the search input when files.length >= 50', () => {
    render(
      <FileList
        files={makeFiles(50)}
        onRemoveFiles={vi.fn()}
        onRename={vi.fn()}
        onReorder={vi.fn()}
      />
    );
    expect(screen.getByPlaceholderText('파일 이름 검색…')).toBeInTheDocument();
  });

  it('filters rows in real time by case-insensitive substring match on normalizedName', () => {
    render(
      <FileList
        files={makeFiles(50)}
        onRemoveFiles={vi.fn()}
        onRename={vi.fn()}
        onReorder={vi.fn()}
      />
    );
    const input = screen.getByPlaceholderText('파일 이름 검색…');
    fireEvent.change(input, { target: { value: '042' } });

    expect(screen.getByText('file-042.txt')).toBeInTheDocument();
    expect(screen.queryByText('file-001.txt')).not.toBeInTheDocument();
  });

  it('shows a "검색 활성" badge when the search input has a value', () => {
    render(
      <FileList
        files={makeFiles(50)}
        onRemoveFiles={vi.fn()}
        onRename={vi.fn()}
        onReorder={vi.fn()}
      />
    );
    fireEvent.change(screen.getByPlaceholderText('파일 이름 검색…'), {
      target: { value: 'foo' },
    });
    expect(screen.getByText(/검색 활성/)).toBeInTheDocument();
  });

  it('"전체 선택" toggles only the visible (filtered) rows', () => {
    const onRemove = vi.fn();
    render(
      <FileList
        files={makeFiles(50)}
        onRemoveFiles={onRemove}
        onRename={vi.fn()}
        onReorder={vi.fn()}
      />
    );

    fireEvent.change(screen.getByPlaceholderText('파일 이름 검색…'), {
      target: { value: '042' },
    });

    const selectAllCheckbox = screen.getByRole('checkbox', { name: '전체 선택' });
    fireEvent.click(selectAllCheckbox);

    fireEvent.click(screen.getByRole('button', { name: /선택 삭제/ }));
    expect(onRemove).toHaveBeenCalledWith(['id-42']);
  });
});

describe('FileList — two-pane folder mode', () => {
  function folderFile(id: string, path: string): ProcessedFile {
    const name = path.split('/').pop()!;
    return {
      id,
      file: new File(['x'], name, { type: 'text/plain' }),
      originalName: name,
      normalizedName: name,
      path,
      normalizedPath: path,
      needsNormalization: false,
      size: 100,
    };
  }

  it('shows the folder sidebar when files live inside a folder', () => {
    render(
      <FileList
        files={[
          folderFile('1', 'root/a.txt'),
          folderFile('2', 'root/b.txt'),
          folderFile('3', 'loose.txt'),
        ]}
        onRemoveFiles={vi.fn()}
        onRename={vi.fn()}
        onReorder={vi.fn()}
        onRenameFolder={vi.fn()}
        onRemoveFolder={vi.fn()}
      />
    );
    expect(screen.getByRole('navigation', { name: '폴더 구조' })).toBeInTheDocument();
    // Root entry appears in both the sidebar and the breadcrumb.
    expect(screen.getAllByText('루트').length).toBeGreaterThanOrEqual(1);
    // "root" appears in both the sidebar and the right-pane subfolder row.
    expect(screen.getAllByText('root').length).toBeGreaterThanOrEqual(2);
  });

  it('defaults to the root view showing subfolder rows and loose files', () => {
    render(
      <FileList
        files={[folderFile('1', 'root/a.txt'), folderFile('2', 'loose.txt')]}
        onRemoveFiles={vi.fn()}
        onRename={vi.fn()}
        onReorder={vi.fn()}
        onRenameFolder={vi.fn()}
        onRemoveFolder={vi.fn()}
      />
    );
    // Loose file is visible at the root level.
    expect(screen.getByText('loose.txt')).toBeInTheDocument();
    // "root" subfolder row exists; "a.txt" inside it is not drilled-in yet.
    expect(screen.queryByText('a.txt')).not.toBeInTheDocument();
  });

  it('drills into a subfolder when its row is clicked and shows its files', () => {
    render(
      <FileList
        files={[folderFile('1', 'root/a.txt'), folderFile('2', 'root/b.txt')]}
        onRemoveFiles={vi.fn()}
        onRename={vi.fn()}
        onReorder={vi.fn()}
        onRenameFolder={vi.fn()}
        onRemoveFolder={vi.fn()}
      />
    );
    // Find the "root" subfolder row (button). The sidebar also has a "root"
    // button; we want the one in the right pane, which has a title attribute.
    const rightPaneRootRows = screen
      .getAllByRole('button')
      .filter((b) => b.getAttribute('title') === 'root' && b.textContent?.includes('root'));
    expect(rightPaneRootRows.length).toBeGreaterThan(0);
    fireEvent.click(rightPaneRootRows[0]);
    expect(screen.getByText('a.txt')).toBeInTheDocument();
    expect(screen.getByText('b.txt')).toBeInTheDocument();
  });

  it('calls onRemoveFolder when the breadcrumb delete button is used', () => {
    const onRemoveFolder = vi.fn();
    render(
      <FileList
        files={[folderFile('1', 'root/a.txt')]}
        onRemoveFiles={vi.fn()}
        onRename={vi.fn()}
        onReorder={vi.fn()}
        onRenameFolder={vi.fn()}
        onRemoveFolder={onRemoveFolder}
      />
    );
    // Drill into "root" via the sidebar to surface the breadcrumb delete.
    fireEvent.click(screen.getByRole('button', { name: /^root$/ }));
    fireEvent.click(screen.getByRole('button', { name: '폴더 삭제' }));
    expect(onRemoveFolder).toHaveBeenCalledWith('root');
  });

  it('sidebar click navigates and updates the breadcrumb', () => {
    render(
      <FileList
        files={[folderFile('1', 'root/sub/a.txt')]}
        onRemoveFiles={vi.fn()}
        onRename={vi.fn()}
        onReorder={vi.fn()}
        onRenameFolder={vi.fn()}
        onRemoveFolder={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /^root$/ }));
    // Breadcrumb (not sidebar) now has "루트 > root".
    expect(screen.getAllByText('root').length).toBeGreaterThanOrEqual(2);
  });
});

describe('FileList — add files (Phase 4)', () => {
  function makeFile(name: string): ProcessedFile {
    return {
      id: `id-${name}`,
      file: new File(['x'], name, { type: 'text/plain' }),
      originalName: name,
      normalizedName: name,
      path: name,
      normalizedPath: name,
      needsNormalization: false,
      size: 1,
    };
  }

  it('renders a "파일 추가" button when onAddFiles is provided', () => {
    render(
      <FileList
        files={[makeFile('a.txt')]}
        onRemoveFiles={vi.fn()}
        onRename={vi.fn()}
        onReorder={vi.fn()}
        onAddFiles={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: '파일 추가' })).toBeInTheDocument();
  });

  it('does NOT render "파일 추가" button when onAddFiles is not provided', () => {
    render(
      <FileList
        files={[makeFile('a.txt')]}
        onRemoveFiles={vi.fn()}
        onRename={vi.fn()}
        onReorder={vi.fn()}
      />
    );
    expect(screen.queryByRole('button', { name: '파일 추가' })).not.toBeInTheDocument();
  });

  it('calls onAddFiles with dropped files', async () => {
    const onAddFiles = vi.fn();
    const { container } = render(
      <FileList
        files={[makeFile('a.txt')]}
        onRemoveFiles={vi.fn()}
        onRename={vi.fn()}
        onReorder={vi.fn()}
        onAddFiles={onAddFiles}
      />
    );
    const dropZone = container.querySelector('[data-dropzone="filelist"]');
    expect(dropZone).not.toBeNull();

    const newFile = new File(['new'], 'b.txt', { type: 'text/plain' });
    const dt = {
      files: [newFile] as unknown as FileList,
      items: [] as unknown as DataTransferItemList,
    } as DataTransfer;
    fireEvent.drop(dropZone!, { dataTransfer: dt });
    await new Promise(r => setTimeout(r, 0));
    expect(onAddFiles).toHaveBeenCalledTimes(1);
    expect(onAddFiles.mock.calls[0][0]).toHaveLength(1);
    expect((onAddFiles.mock.calls[0][0] as File[])[0].name).toBe('b.txt');
  });

  it('shows the drag overlay when a file is dragged over', () => {
    const { container } = render(
      <FileList
        files={[makeFile('a.txt')]}
        onRemoveFiles={vi.fn()}
        onRename={vi.fn()}
        onReorder={vi.fn()}
        onAddFiles={vi.fn()}
      />
    );
    const dropZone = container.querySelector('[data-dropzone="filelist"]')!;
    fireEvent.dragOver(dropZone, { dataTransfer: { files: [] as unknown as FileList, items: [] as unknown as DataTransferItemList } });
    expect(screen.getByText('여기에 놓아 추가')).toBeInTheDocument();
    fireEvent.dragLeave(dropZone);
    expect(screen.queryByText('여기에 놓아 추가')).not.toBeInTheDocument();
  });
});
