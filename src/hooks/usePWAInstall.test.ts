import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePWAInstall } from './usePWAInstall';

function mockMatchMedia(standalone: boolean) {
  window.matchMedia = vi.fn().mockReturnValue({
    matches: standalone,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
}

describe('usePWAInstall', () => {
  beforeEach(() => {
    mockMatchMedia(false);
  });

  describe('initial state', () => {
    it('starts with canInstall false when no prompt event', () => {
      const { result } = renderHook(() => usePWAInstall());
      expect(result.current.canInstall).toBe(false);
    });

    it('starts with isInstalled false in browser mode', () => {
      const { result } = renderHook(() => usePWAInstall());
      expect(result.current.isInstalled).toBe(false);
    });

    it('detects already installed (standalone mode)', () => {
      mockMatchMedia(true);
      const { result } = renderHook(() => usePWAInstall());
      expect(result.current.isInstalled).toBe(true);
      expect(result.current.canInstall).toBe(false);
    });
  });

  describe('beforeinstallprompt event', () => {
    it('sets canInstall to true when event fires', () => {
      const { result } = renderHook(() => usePWAInstall());

      act(() => {
        const event = new Event('beforeinstallprompt');
        Object.assign(event, {
          prompt: vi.fn().mockResolvedValue(undefined),
          userChoice: Promise.resolve({ outcome: 'dismissed' }),
        });
        window.dispatchEvent(event);
      });

      expect(result.current.canInstall).toBe(true);
    });
  });

  describe('install', () => {
    it('returns false when no prompt available', async () => {
      const { result } = renderHook(() => usePWAInstall());

      let installResult: boolean | undefined;
      await act(async () => {
        installResult = await result.current.install();
      });

      expect(installResult).toBe(false);
    });

    it('calls prompt and returns true on acceptance', async () => {
      const mockPrompt = vi.fn().mockResolvedValue(undefined);
      const { result } = renderHook(() => usePWAInstall());

      act(() => {
        const event = new Event('beforeinstallprompt');
        Object.assign(event, {
          prompt: mockPrompt,
          userChoice: Promise.resolve({ outcome: 'accepted' }),
        });
        window.dispatchEvent(event);
      });

      let installResult: boolean | undefined;
      await act(async () => {
        installResult = await result.current.install();
      });

      expect(mockPrompt).toHaveBeenCalled();
      expect(installResult).toBe(true);
    });

    it('returns false on dismissal', async () => {
      const { result } = renderHook(() => usePWAInstall());

      act(() => {
        const event = new Event('beforeinstallprompt');
        Object.assign(event, {
          prompt: vi.fn().mockResolvedValue(undefined),
          userChoice: Promise.resolve({ outcome: 'dismissed' }),
        });
        window.dispatchEvent(event);
      });

      let installResult: boolean | undefined;
      await act(async () => {
        installResult = await result.current.install();
      });

      expect(installResult).toBe(false);
    });
  });

  describe('appinstalled event', () => {
    it('sets isInstalled to true', () => {
      const { result } = renderHook(() => usePWAInstall());

      act(() => {
        window.dispatchEvent(new Event('appinstalled'));
      });

      expect(result.current.isInstalled).toBe(true);
      expect(result.current.canInstall).toBe(false);
    });
  });
});
