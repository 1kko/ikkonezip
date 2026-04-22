import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useTheme } from './useTheme';

const tauriWindowMock = vi.hoisted(() => ({
  themeMock: vi.fn() as Mock,
  onThemeChangedMock: vi.fn() as Mock,
  unlistenMock: vi.fn() as Mock,
}));

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    theme: tauriWindowMock.themeMock,
    onThemeChanged: tauriWindowMock.onThemeChangedMock,
  }),
}));

const STORAGE_KEY = 'ikkonezip-theme';

function createMockStorage(): Storage {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
    get length() { return Object.keys(store).length; },
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
  };
}

function mockMatchMedia(matches: boolean) {
  const listeners: Array<(e: { matches: boolean }) => void> = [];
  const mql = {
    matches,
    addEventListener: vi.fn((_: string, handler: (e: { matches: boolean }) => void) => listeners.push(handler)),
    removeEventListener: vi.fn((_: string, handler: (e: { matches: boolean }) => void) => {
      const idx = listeners.indexOf(handler);
      if (idx >= 0) listeners.splice(idx, 1);
    }),
    _triggerChange(newMatches: boolean) {
      mql.matches = newMatches;
      listeners.forEach(fn => fn({ matches: newMatches }));
    },
  };
  window.matchMedia = vi.fn().mockReturnValue(mql);
  return mql;
}

describe('useTheme', () => {
  let mockStorage: Storage;

  beforeEach(() => {
    mockStorage = createMockStorage();
    vi.stubGlobal('localStorage', mockStorage);
    document.documentElement.classList.remove('dark');
    mockMatchMedia(false); // default: light system theme
  });

  describe('initial state', () => {
    it('defaults to system theme', () => {
      const { result } = renderHook(() => useTheme());
      expect(result.current.theme).toBe('system');
    });

    it('loads stored theme from localStorage', () => {
      mockStorage.setItem(STORAGE_KEY, 'dark');
      const { result } = renderHook(() => useTheme());
      expect(result.current.theme).toBe('dark');
    });
  });

  describe('setTheme', () => {
    it('sets dark theme', () => {
      const { result } = renderHook(() => useTheme());

      act(() => {
        result.current.setTheme('dark');
      });

      expect(result.current.theme).toBe('dark');
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    it('sets light theme', () => {
      const { result } = renderHook(() => useTheme());

      act(() => {
        result.current.setTheme('dark');
      });
      act(() => {
        result.current.setTheme('light');
      });

      expect(result.current.theme).toBe('light');
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });

    it('persists theme to localStorage', () => {
      const { result } = renderHook(() => useTheme());

      act(() => {
        result.current.setTheme('dark');
      });

      expect(mockStorage.getItem(STORAGE_KEY)).toBe('dark');
    });

    it('sets system theme (uses system preference)', () => {
      mockMatchMedia(true); // system = dark
      const { result } = renderHook(() => useTheme());

      act(() => {
        result.current.setTheme('system');
      });

      expect(result.current.theme).toBe('system');
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });
  });

  describe('dark mode class', () => {
    it('applies dark class when dark theme with system dark', () => {
      mockMatchMedia(true);
      const { result } = renderHook(() => useTheme());

      act(() => {
        result.current.setTheme('system');
      });

      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    it('removes dark class for light theme', () => {
      document.documentElement.classList.add('dark');
      const { result } = renderHook(() => useTheme());

      act(() => {
        result.current.setTheme('light');
      });

      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });
  });

  describe('system theme change listener', () => {
    it('reacts to system theme change when theme is system', () => {
      const mql = mockMatchMedia(false); // start with light
      const { result } = renderHook(() => useTheme());

      // Ensure theme is 'system'
      expect(result.current.theme).toBe('system');

      // Simulate system switching to dark
      act(() => {
        mql._triggerChange(true);
      });

      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    it('does not react to system theme change when theme is not system', () => {
      const mql = mockMatchMedia(false);
      const { result } = renderHook(() => useTheme());

      // Set theme to 'light' explicitly
      act(() => {
        result.current.setTheme('light');
      });

      // Simulate system switching to dark — should be ignored
      act(() => {
        mql._triggerChange(true);
      });

      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });
  });

  describe('Tauri theme override', () => {
    let themeChangedHandler: ((evt: { payload: 'light' | 'dark' }) => void) | null = null;

    beforeEach(() => {
      themeChangedHandler = null;
      tauriWindowMock.themeMock.mockReset().mockResolvedValue('dark');
      tauriWindowMock.unlistenMock.mockReset();
      tauriWindowMock.onThemeChangedMock.mockReset().mockImplementation(async (handler: typeof themeChangedHandler) => {
        themeChangedHandler = handler;
        return tauriWindowMock.unlistenMock;
      });
      (window as unknown as { __TAURI_INTERNALS__: object }).__TAURI_INTERNALS__ = {};
    });

    afterEach(() => {
      delete (window as unknown as { __TAURI_INTERNALS__?: object }).__TAURI_INTERNALS__;
    });

    it('applies dark class from Tauri theme API when system theme is in use', async () => {
      mockMatchMedia(false); // matchMedia (incorrectly) says light
      renderHook(() => useTheme());
      await waitFor(() => {
        expect(document.documentElement.classList.contains('dark')).toBe(true);
      });
    });

    it('reacts to Tauri onThemeChanged events', async () => {
      mockMatchMedia(false);
      renderHook(() => useTheme());
      await waitFor(() => {
        expect(themeChangedHandler).not.toBeNull();
      });
      act(() => {
        themeChangedHandler?.({ payload: 'light' });
      });
      expect(document.documentElement.classList.contains('dark')).toBe(false);
      act(() => {
        themeChangedHandler?.({ payload: 'dark' });
      });
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    it('does NOT subscribe to Tauri events when user pref is explicit (not system)', async () => {
      mockStorage.setItem(STORAGE_KEY, 'light');
      renderHook(() => useTheme());
      // Give any pending promises a tick to resolve
      await new Promise((r) => setTimeout(r, 10));
      expect(tauriWindowMock.themeMock).not.toHaveBeenCalled();
      expect(tauriWindowMock.onThemeChangedMock).not.toHaveBeenCalled();
    });

    it('cleans up Tauri subscription on unmount (no listener leak)', async () => {
      const { unmount } = renderHook(() => useTheme());
      await waitFor(() => {
        expect(tauriWindowMock.onThemeChangedMock).toHaveBeenCalled();
      });
      unmount();
      await waitFor(() => {
        expect(tauriWindowMock.unlistenMock).toHaveBeenCalled();
      });
    });

    it('immediately unsubscribes if unmount happens before onThemeChanged resolves', async () => {
      // Make onThemeChanged hang until we manually resolve it.
      let resolveSubscribe: ((u: () => void) => void) | undefined;
      tauriWindowMock.onThemeChangedMock.mockReset().mockImplementation(
        () => new Promise<() => void>((resolve) => { resolveSubscribe = resolve; })
      );

      const { unmount } = renderHook(() => useTheme());
      // Wait until the dynamic import is requested
      await waitFor(() => {
        expect(tauriWindowMock.onThemeChangedMock).toHaveBeenCalled();
      });
      // Unmount BEFORE the subscribe promise resolves
      unmount();
      // Now resolve — the hook should immediately invoke the unlisten because mounted=false
      resolveSubscribe!(tauriWindowMock.unlistenMock);
      await waitFor(() => {
        expect(tauriWindowMock.unlistenMock).toHaveBeenCalled();
      });
    });
  });
});
