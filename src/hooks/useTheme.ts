import { useState, useEffect, useCallback } from 'react';
import { isTauri } from '@/utils/tauri';

type Theme = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'ikkonezip-theme';

function getSystemTheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  const effectiveTheme = theme === 'system' ? getSystemTheme() : theme;

  if (effectiveTheme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    return stored || 'system';
  });

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = () => {
      if (theme === 'system') {
        applyTheme('system');
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  // In Tauri's WKWebView, prefers-color-scheme does NOT track macOS appearance,
  // so the matchMedia path above lands on the wrong value. Override using
  // Tauri's own theme API and theme-changed event when running in desktop.
  useEffect(() => {
    if (!isTauri()) return;
    if (theme !== 'system') return;

    let unlisten: (() => void) | null = null;
    let mounted = true;

    void import('@tauri-apps/api/window').then(async ({ getCurrentWindow }) => {
      const win = getCurrentWindow();
      const current = await win.theme();
      if (mounted && current) {
        document.documentElement.classList.toggle('dark', current === 'dark');
      }
      const u = await win.onThemeChanged(({ payload }) => {
        document.documentElement.classList.toggle('dark', payload === 'dark');
      });
      if (mounted) {
        unlisten = u;
      } else {
        u();
      }
    });

    return () => {
      mounted = false;
      unlisten?.();
    };
  }, [theme]);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem(STORAGE_KEY, newTheme);
  }, []);

  return { theme, setTheme };
}
