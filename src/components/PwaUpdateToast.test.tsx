import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
  let cachesKeysMock: ReturnType<typeof vi.fn>;
  let cachesDeleteMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    updateMock = vi.fn().mockResolvedValue(undefined);
    setNeedRefreshMock = vi.fn();
    cachesKeysMock = vi.fn().mockResolvedValue(['workbox-precache-v1', 'google-fonts-cache']);
    cachesDeleteMock = vi.fn().mockResolvedValue(true);
    vi.stubGlobal('caches', { keys: cachesKeysMock, delete: cachesDeleteMock });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
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

  it('sends SKIP_WAITING (reloadPage=false) and purges cache buckets when the refresh button is clicked', async () => {
    mockHook(true);
    render(<PwaUpdateToast />);
    fireEvent.click(screen.getByRole('button', { name: '새로고침' }));
    // reloadPage=false: defer reload to the controllerchange listener so we
    // don't race the SW activation.
    expect(updateMock).toHaveBeenCalledWith(false);
    // Wait one microtask cycle for the async onClick body to flush through
    // updateServiceWorker → purgeCaches.
    await Promise.resolve();
    await Promise.resolve();
    expect(cachesKeysMock).toHaveBeenCalled();
    expect(cachesDeleteMock).toHaveBeenCalledWith('workbox-precache-v1');
    expect(cachesDeleteMock).toHaveBeenCalledWith('google-fonts-cache');
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
