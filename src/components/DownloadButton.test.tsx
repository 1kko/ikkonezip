import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { DownloadButton } from './DownloadButton';

function renderButton(overrides: Partial<Parameters<typeof DownloadButton>[0]> = {}) {
  const props = {
    fileCount: 2,
    isProcessing: false,
    folderName: null,
    progress: null,
    onDownloadZip: vi.fn().mockResolvedValue(undefined),
    onDownloadSingle: vi.fn(),
    ...overrides,
  };
  render(<DownloadButton {...props} />);
  return props;
}

function pressEnter() {
  fireEvent.keyDown(window, { key: 'Enter' });
}

describe('DownloadButton Enter shortcut', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('downloads the ZIP with the filename, password and options chosen on screen', () => {
    const props = renderButton();

    fireEvent.change(screen.getByLabelText(/파일명$/), { target: { value: '프로젝트.zip' } });
    fireEvent.change(screen.getByLabelText(/암호/), { target: { value: 'secret' } });
    fireEvent.click(screen.getByRole('button', { name: '최대' }));
    fireEvent.click(screen.getByLabelText(/파일명 앞에 날짜 붙이기/));
    pressEnter();

    expect(props.onDownloadZip).toHaveBeenCalledWith(
      '프로젝트.zip',
      expect.objectContaining({ password: 'secret', compressionLevel: 9 }),
      false,
    );
  });

  it('downloads the single file as-is when that mode is selected', () => {
    const props = renderButton({ fileCount: 1 });

    fireEvent.click(screen.getByRole('button', { name: /파일 그대로/ }));
    pressEnter();

    expect(props.onDownloadSingle).toHaveBeenCalledWith(false);
    expect(props.onDownloadZip).not.toHaveBeenCalled();
  });

  it('does nothing while processing', () => {
    const props = renderButton({ isProcessing: true });

    pressEnter();

    expect(props.onDownloadZip).not.toHaveBeenCalled();
  });

  it('does nothing when there are no files', () => {
    const props = renderButton({ fileCount: 0 });

    pressEnter();

    expect(props.onDownloadZip).not.toHaveBeenCalled();
    expect(props.onDownloadSingle).not.toHaveBeenCalled();
  });
});
