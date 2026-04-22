import { describe, it, expect, afterEach } from 'vitest';
import { isTauri } from './tauri';

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

describe('isTauri', () => {
  afterEach(() => {
    delete window.__TAURI_INTERNALS__;
  });

  it('returns false in a normal web context', () => {
    expect(isTauri()).toBe(false);
  });

  it('returns true when window.__TAURI_INTERNALS__ is defined', () => {
    window.__TAURI_INTERNALS__ = {};
    expect(isTauri()).toBe(true);
  });
});
