import { useState, useCallback } from 'react';

const STORAGE_KEY = 'ikkonezip-settings';

export interface Settings {
  compressionLevel: 0 | 5 | 9;
  excludeSystemFiles: boolean;
  compressSingle: boolean;
}

const DEFAULT_SETTINGS: Settings = {
  compressionLevel: 5,
  excludeSystemFiles: true,
  compressSingle: true,
};

function loadSettings(): Settings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
      };
    }
  } catch {
    // Ignore parse errors
  }
  return DEFAULT_SETTINGS;
}

function saveSettings(settings: Partial<Settings>): void {
  try {
    const current = loadSettings();
    const updated = { ...current, ...settings };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage errors
  }
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(loadSettings);

  const updateSetting = useCallback(<K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings(prev => {
      const updated = { ...prev, [key]: value };
      saveSettings({ [key]: value });
      return updated;
    });
  }, []);

  return {
    settings,
    updateSetting,
  };
}
