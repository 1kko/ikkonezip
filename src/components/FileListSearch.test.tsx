import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { FileListSearch } from './FileListSearch';

describe('FileListSearch', () => {
  it('renders an input with the Korean placeholder', () => {
    render(<FileListSearch value="" onChange={() => {}} />);
    expect(screen.getByPlaceholderText('파일 이름 검색…')).toBeInTheDocument();
  });

  it('calls onChange with the typed value', () => {
    const onChange = vi.fn();
    render(<FileListSearch value="" onChange={onChange} />);
    fireEvent.change(screen.getByPlaceholderText('파일 이름 검색…'), {
      target: { value: 'abc' },
    });
    expect(onChange).toHaveBeenCalledWith('abc');
  });

  it('does not show a clear button when value is empty', () => {
    render(<FileListSearch value="" onChange={() => {}} />);
    expect(screen.queryByRole('button', { name: '검색어 지우기' })).not.toBeInTheDocument();
  });

  it('shows a clear button when value is non-empty and clears via that button', () => {
    const onChange = vi.fn();
    render(<FileListSearch value="abc" onChange={onChange} />);
    const clearBtn = screen.getByRole('button', { name: '검색어 지우기' });
    fireEvent.click(clearBtn);
    expect(onChange).toHaveBeenCalledWith('');
  });
});
