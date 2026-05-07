import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { DesktopUpdateToast } from './DesktopUpdateToast';

const sample = {
  version: '1.2.0',
  downloadUrl: 'https://example.com/dmg',
  notes: '드래그 정렬 기능 추가',
  releasedAt: '2026-04-22',
};

describe('DesktopUpdateToast', () => {
  it('returns null when manifest is null', () => {
    const { container } = render(
      <DesktopUpdateToast manifest={null} onDismiss={vi.fn()} onDownload={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders the version when manifest is present', () => {
    render(<DesktopUpdateToast manifest={sample} onDismiss={vi.fn()} onDownload={vi.fn()} />);
    expect(screen.getByText(/새 버전 1\.2\.0 사용 가능/)).toBeInTheDocument();
    // notes는 의도적으로 표시하지 않음 — 릴리즈 body의 raw markdown이 그대로
    // 흘러드는 걸 막고 토스트를 한 줄짜리 "새 버전 X 사용 가능"으로 유지.
    expect(screen.queryByText('드래그 정렬 기능 추가')).not.toBeInTheDocument();
  });

  it('calls onDownload when the download button is clicked', () => {
    const onDownload = vi.fn();
    render(<DesktopUpdateToast manifest={sample} onDismiss={vi.fn()} onDownload={onDownload} />);
    fireEvent.click(screen.getByRole('button', { name: '다운로드' }));
    expect(onDownload).toHaveBeenCalledTimes(1);
  });

  it('calls onDismiss when the close button is clicked', () => {
    const onDismiss = vi.fn();
    render(<DesktopUpdateToast manifest={sample} onDismiss={onDismiss} onDownload={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '닫기' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('uses role="status" + aria-live="polite" for screen readers', () => {
    render(<DesktopUpdateToast manifest={sample} onDismiss={vi.fn()} onDownload={vi.fn()} />);
    const toast = screen.getByRole('status');
    expect(toast).toHaveAttribute('aria-live', 'polite');
  });

  it('shows the loading label and disables both buttons while isDownloading', () => {
    render(
      <DesktopUpdateToast
        manifest={sample}
        onDismiss={vi.fn()}
        onDownload={vi.fn()}
        isDownloading
      />
    );
    const dl = screen.getByRole('button', { name: /다운로드 중/ });
    expect(dl).toBeDisabled();
    expect(screen.getByRole('button', { name: '닫기' })).toBeDisabled();
  });
});
