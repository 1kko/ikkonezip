import { describe, it, expect, afterEach, vi } from 'vitest';
import { isMac, detectPlatform } from './platform';

describe('detectPlatform', () => {
  const originalPlatform = Object.getOwnPropertyDescriptor(navigator, 'platform');

  afterEach(() => {
    if (originalPlatform) {
      Object.defineProperty(navigator, 'platform', originalPlatform);
    }
    delete (navigator as Navigator & { userAgentData?: unknown }).userAgentData;
  });

  it('detects macos / windows / linux from navigator.platform', () => {
    Object.defineProperty(navigator, 'platform', { value: 'MacIntel', configurable: true });
    expect(detectPlatform()).toBe('macos');
    Object.defineProperty(navigator, 'platform', { value: 'Win32', configurable: true });
    expect(detectPlatform()).toBe('windows');
    Object.defineProperty(navigator, 'platform', { value: 'Linux x86_64', configurable: true });
    expect(detectPlatform()).toBe('linux');
  });

  it('prefers userAgentData.platform when available (Chromium) for each OS', () => {
    Object.defineProperty(navigator, 'platform', { value: 'Win32', configurable: true });
    (navigator as Navigator & { userAgentData?: { platform: string } }).userAgentData = {
      platform: 'macOS',
    };
    expect(detectPlatform()).toBe('macos');

    (navigator as Navigator & { userAgentData?: { platform: string } }).userAgentData = {
      platform: 'Windows',
    };
    expect(detectPlatform()).toBe('windows');

    (navigator as Navigator & { userAgentData?: { platform: string } }).userAgentData = {
      platform: 'Linux',
    };
    expect(detectPlatform()).toBe('linux');
  });

  it('returns null for unknown platform strings', () => {
    Object.defineProperty(navigator, 'platform', { value: 'iPhone', configurable: true });
    expect(detectPlatform()).toBeNull();
  });

  it('returns null when navigator is undefined (SSR safety guard)', () => {
    vi.stubGlobal('navigator', undefined);
    try {
      expect(detectPlatform()).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('isMac', () => {
  const originalPlatform = Object.getOwnPropertyDescriptor(navigator, 'platform');

  afterEach(() => {
    if (originalPlatform) {
      Object.defineProperty(navigator, 'platform', originalPlatform);
    }
    delete (navigator as Navigator & { userAgentData?: unknown }).userAgentData;
  });

  it('returns true when navigator.platform contains "Mac"', () => {
    Object.defineProperty(navigator, 'platform', { value: 'MacIntel', configurable: true });
    expect(isMac()).toBe(true);
  });

  it('returns false on Windows platform', () => {
    Object.defineProperty(navigator, 'platform', { value: 'Win32', configurable: true });
    expect(isMac()).toBe(false);
  });

  it('returns false on Linux platform', () => {
    Object.defineProperty(navigator, 'platform', { value: 'Linux x86_64', configurable: true });
    expect(isMac()).toBe(false);
  });

  it('prefers userAgentData.platform when available (Chromium)', () => {
    Object.defineProperty(navigator, 'platform', { value: 'Win32', configurable: true });
    (navigator as Navigator & { userAgentData?: { platform: string } }).userAgentData = {
      platform: 'macOS',
    };
    expect(isMac()).toBe(true);
  });

  it('returns false when userAgentData.platform is non-Mac', () => {
    Object.defineProperty(navigator, 'platform', { value: 'MacIntel', configurable: true });
    (navigator as Navigator & { userAgentData?: { platform: string } }).userAgentData = {
      platform: 'Windows',
    };
    expect(isMac()).toBe(false);
  });

  it('returns false when navigator is undefined (SSR safety guard)', () => {
    vi.stubGlobal('navigator', undefined);
    try {
      expect(isMac()).toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
