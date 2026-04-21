import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { PwaUpdateToast } from './PwaUpdateToast';

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: vi.fn(),
}));

import { useRegisterSW } from 'virtual:pwa-register/react';

describe('PwaUpdateToast', () => {
  let updateMock: ReturnType<typeof vi.fn>;
  let setNeedRefreshMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    updateMock = vi.fn().mockResolvedValue(undefined);
    setNeedRefreshMock = vi.fn();
  });

  function mockHook(needRefresh: boolean) {
    vi.mocked(useRegisterSW).mockReturnValue({
      needRefresh: [needRefresh, setNeedRefreshMock as unknown as React.Dispatch<React.SetStateAction<boolean>>],
      offlineReady: [false, vi.fn() as unknown as React.Dispatch<React.SetStateAction<boolean>>],
      updateServiceWorker: updateMock as unknown as (reloadPage?: boolean) => Promise<void>,
    });
  }

  it('renders nothing when no update is available', () => {
    mockHook(false);
    const { container } = render(<PwaUpdateToast />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the toast with title, body, and refresh button when an update is available', () => {
    mockHook(true);
    render(<PwaUpdateToast />);
    expect(screen.getByText('새 버전 사용 가능')).toBeInTheDocument();
    expect(screen.getByText('새로고침하면 최신 버전이 적용됩니다')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '새로고침' })).toBeInTheDocument();
  });

  it('calls updateServiceWorker(true) when the refresh button is clicked', () => {
    mockHook(true);
    render(<PwaUpdateToast />);
    fireEvent.click(screen.getByRole('button', { name: '새로고침' }));
    expect(updateMock).toHaveBeenCalledWith(true);
  });

  it('calls setNeedRefresh(false) when the close button is clicked', () => {
    mockHook(true);
    render(<PwaUpdateToast />);
    fireEvent.click(screen.getByRole('button', { name: '닫기' }));
    expect(setNeedRefreshMock).toHaveBeenCalledWith(false);
  });

  it('uses role="status" with aria-live="polite" for screen readers', () => {
    mockHook(true);
    render(<PwaUpdateToast />);
    const toast = screen.getByRole('status');
    expect(toast).toHaveAttribute('aria-live', 'polite');
  });
});
