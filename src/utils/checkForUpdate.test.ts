import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkForUpdate } from './checkForUpdate';

describe('checkForUpdate', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the manifest when remote version is higher than local', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        version: '1.2.0',
        downloadUrl: 'https://example.com/dmg',
        notes: '신기능',
        releasedAt: '2026-04-22',
      }))
    );
    const result = await checkForUpdate('1.1.0');
    expect(result).not.toBeNull();
    expect(result?.version).toBe('1.2.0');
  });

  it('returns null when remote version equals local', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        version: '1.1.0',
        downloadUrl: 'https://example.com/dmg',
        notes: 'same',
        releasedAt: '2026-04-22',
      }))
    );
    expect(await checkForUpdate('1.1.0')).toBeNull();
  });

  it('returns null when remote version is lower than local', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        version: '1.0.0',
        downloadUrl: 'https://example.com/dmg',
        notes: 'old',
        releasedAt: '2026-01-01',
      }))
    );
    expect(await checkForUpdate('1.1.0')).toBeNull();
  });

  it('returns null on network error (silent fail, offline-friendly)', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network'));
    expect(await checkForUpdate('1.0.0')).toBeNull();
  });

  it('returns null on non-2xx response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('not found', { status: 404 }));
    expect(await checkForUpdate('1.0.0')).toBeNull();
  });

  it('returns null on malformed JSON', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('not-json'));
    expect(await checkForUpdate('1.0.0')).toBeNull();
  });

  it('returns null when manifest has no version field', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ downloadUrl: 'https://example.com/dmg' }))
    );
    expect(await checkForUpdate('1.0.0')).toBeNull();
  });

  it('uses the multi-platform downloads object when present', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        version: '1.2.0',
        downloads: {
          macos: 'https://example.com/mac.dmg',
          windows: 'https://example.com/win.exe',
          linux: 'https://example.com/lin.AppImage',
        },
        notes: 'multi',
        releasedAt: '2026-04-23',
      }))
    );
    const result = await checkForUpdate('1.1.0');
    expect(result).not.toBeNull();
    // process.platform in the test runner is some unix flavor; either way
    // the helper must surface SOME populated link rather than empty string.
    expect(result?.downloadUrl).not.toBe('');
  });

  it('returns null when neither downloadUrl nor downloads has a usable link', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        version: '1.2.0',
        downloads: { macos: '', windows: '', linux: '' },
      }))
    );
    expect(await checkForUpdate('1.0.0')).toBeNull();
  });
});
