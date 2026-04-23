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

describe('FileList — path column', () => {
  it('shows the folder prefix in the path column for nested files', () => {
    const files = [
      makeFile({ id: '1', path: 'MyFolder/sub/a.txt', normalizedPath: 'MyFolder/sub/a.txt', normalizedName: 'a.txt' }),
      makeFile({ id: '2', path: 'loose.txt', normalizedPath: 'loose.txt', normalizedName: 'loose.txt' }),
    ];
    render(
      <FileList files={files} onRemoveFiles={vi.fn()} onRename={vi.fn()} />
    );
    expect(screen.getByText('MyFolder/sub')).toBeInTheDocument();
    // Loose root-level file shows an em dash placeholder in the path cell.
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});

describe('FileList — sortable header', () => {
  it('sorts by name ascending on first click, descending on second', () => {
    const files = [
      makeFile({ id: '1', path: 'banana.txt', normalizedName: 'banana.txt' }),
      makeFile({ id: '2', path: 'apple.txt', normalizedName: 'apple.txt' }),
      makeFile({ id: '3', path: 'cherry.txt', normalizedName: 'cherry.txt' }),
    ];
    const { container } = render(
      <FileList files={files} onRemoveFiles={vi.fn()} onRename={vi.fn()} />
    );

    const nameHeader = screen.getByRole('button', { name: /이름/ });
    fireEvent.click(nameHeader);

    const readTitles = () =>
      Array.from(container.querySelectorAll('div[title]'))
        .map((el) => el.getAttribute('title'))
        .filter((t): t is string => !!t && ['apple.txt', 'banana.txt', 'cherry.txt'].includes(t));

    expect(readTitles()).toEqual(['apple.txt', 'banana.txt', 'cherry.txt']);

    fireEvent.click(nameHeader);
    expect(readTitles()).toEqual(['cherry.txt', 'banana.txt', 'apple.txt']);
  });

  it('sorts by size when the size header is clicked', () => {
    const files = [
      makeFile({ id: 'a', path: 'a.txt', normalizedName: 'a.txt', size: 300 }),
      makeFile({ id: 'b', path: 'b.txt', normalizedName: 'b.txt', size: 100 }),
      makeFile({ id: 'c', path: 'c.txt', normalizedName: 'c.txt', size: 200 }),
    ];
    const { container } = render(
      <FileList files={files} onRemoveFiles={vi.fn()} onRename={vi.fn()} />
    );
    fireEvent.click(screen.getByRole('button', { name: /크기/ }));
    const titles = Array.from(container.querySelectorAll('div[title]'))
      .map((el) => el.getAttribute('title'))
      .filter((t): t is string => !!t && ['a.txt', 'b.txt', 'c.txt'].includes(t));
    expect(titles).toEqual(['b.txt', 'c.txt', 'a.txt']);
  });

  it('exposes resize separators for the resizable columns', () => {
    render(<FileList files={[makeFile({ id: '1' })]} onRemoveFiles={vi.fn()} onRename={vi.fn()} />);
    expect(screen.getByRole('separator', { name: /이름 컬럼 너비 조절/ })).toBeInTheDocument();
    expect(screen.getByRole('separator', { name: /크기 컬럼 너비 조절/ })).toBeInTheDocument();
    // Last column ("경로") has no trailing handle.
    expect(screen.queryByRole('separator', { name: /경로 컬럼 너비 조절/ })).not.toBeInTheDocument();
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
