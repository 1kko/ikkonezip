import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSettings } from './useSettings';

const STORAGE_KEY = 'ikkonezip-settings';

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

describe('useSettings', () => {
  let mockStorage: Storage;

  beforeEach(() => {
    mockStorage = createMockStorage();
    vi.stubGlobal('localStorage', mockStorage);
  });

  describe('default settings', () => {
    it('returns default compression level', () => {
      const { result } = renderHook(() => useSettings());
      expect(result.current.settings.compressionLevel).toBe(5);
    });

    it('returns default excludeSystemFiles', () => {
      const { result } = renderHook(() => useSettings());
      expect(result.current.settings.excludeSystemFiles).toBe(true);
    });

    it('returns default compressSingle', () => {
      const { result } = renderHook(() => useSettings());
      expect(result.current.settings.compressSingle).toBe(true);
    });

    it('returns default normalizationForm of NFC', () => {
      const { result } = renderHook(() => useSettings());
      expect(result.current.settings.normalizationForm).toBe('NFC');
    });

    it('returns default checkDesktopUpdates of true', () => {
      const { result } = renderHook(() => useSettings());
      expect(result.current.settings.checkDesktopUpdates).toBe(true);
    });
  });

  describe('loading from localStorage', () => {
    it('loads saved settings on mount', () => {
      mockStorage.setItem(STORAGE_KEY, JSON.stringify({ compressionLevel: 9 }));
      const { result } = renderHook(() => useSettings());
      expect(result.current.settings.compressionLevel).toBe(9);
    });

    it('merges partial saved settings with defaults', () => {
      mockStorage.setItem(STORAGE_KEY, JSON.stringify({ compressionLevel: 0 }));
      const { result } = renderHook(() => useSettings());
      expect(result.current.settings.compressionLevel).toBe(0);
      expect(result.current.settings.excludeSystemFiles).toBe(true);
      expect(result.current.settings.compressSingle).toBe(true);
    });

    it('handles corrupted localStorage gracefully', () => {
      mockStorage.setItem(STORAGE_KEY, 'not-valid-json');
      const { result } = renderHook(() => useSettings());
      expect(result.current.settings.compressionLevel).toBe(5);
    });
  });

  describe('updateSetting', () => {
    it('updates compressionLevel', () => {
      const { result } = renderHook(() => useSettings());

      act(() => {
        result.current.updateSetting('compressionLevel', 9);
      });

      expect(result.current.settings.compressionLevel).toBe(9);
    });

    it('updates excludeSystemFiles', () => {
      const { result } = renderHook(() => useSettings());

      act(() => {
        result.current.updateSetting('excludeSystemFiles', false);
      });

      expect(result.current.settings.excludeSystemFiles).toBe(false);
    });

    it('updates compressSingle', () => {
      const { result } = renderHook(() => useSettings());

      act(() => {
        result.current.updateSetting('compressSingle', false);
      });

      expect(result.current.settings.compressSingle).toBe(false);
    });

    it('persists settings to localStorage', () => {
      const { result } = renderHook(() => useSettings());

      act(() => {
        result.current.updateSetting('compressionLevel', 0);
      });

      const stored = JSON.parse(mockStorage.getItem(STORAGE_KEY)!);
      expect(stored.compressionLevel).toBe(0);
    });

    it('preserves other settings when updating one', () => {
      const { result } = renderHook(() => useSettings());

      act(() => {
        result.current.updateSetting('compressionLevel', 9);
      });
      act(() => {
        result.current.updateSetting('excludeSystemFiles', false);
      });

      expect(result.current.settings.compressionLevel).toBe(9);
      expect(result.current.settings.excludeSystemFiles).toBe(false);
    });

    it('updates normalizationForm', () => {
      const { result } = renderHook(() => useSettings());

      act(() => {
        result.current.updateSetting('normalizationForm', 'NFD');
      });

      expect(result.current.settings.normalizationForm).toBe('NFD');
    });

    it('persists normalizationForm to localStorage', () => {
      const { result } = renderHook(() => useSettings());

      act(() => {
        result.current.updateSetting('normalizationForm', 'NFD');
      });

      const stored = JSON.parse(mockStorage.getItem(STORAGE_KEY)!);
      expect(stored.normalizationForm).toBe('NFD');
    });
  });
});
