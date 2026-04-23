import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useDesktopRelease } from './useDesktopRelease';

describe('useDesktopRelease', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the manifest when fetch succeeds with a real version', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          version: '0.1.1',
          downloadUrl: 'https://zip.1kko.com/desktop/Zip_0.1.1_universal.dmg',
          notes: 'release notes',
          releasedAt: '2026-04-22',
        }),
      ),
    );

    const { result } = renderHook(() => useDesktopRelease());
    await waitFor(() => {
      expect(result.current).not.toBeNull();
    });
    expect(result.current?.version).toBe('0.1.1');
    expect(result.current?.downloadUrl).toBe('https://zip.1kko.com/desktop/Zip_0.1.1_universal.dmg');
  });

  it('returns null when the manifest reports placeholder version 0.0.0', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ version: '0.0.0', downloadUrl: 'https://example.com' })),
    );

    const { result } = renderHook(() => useDesktopRelease());
    await new Promise((r) => setTimeout(r, 10));
    expect(result.current).toBeNull();
  });

  it('returns null when the manifest lacks downloadUrl', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ version: '0.1.1' })),
    );

    const { result } = renderHook(() => useDesktopRelease());
    await new Promise((r) => setTimeout(r, 10));
    expect(result.current).toBeNull();
  });

  it('returns null on non-2xx response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('not found', { status: 404 }));

    const { result } = renderHook(() => useDesktopRelease());
    await new Promise((r) => setTimeout(r, 10));
    expect(result.current).toBeNull();
  });

  it('returns null on network error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));

    const { result } = renderHook(() => useDesktopRelease());
    await new Promise((r) => setTimeout(r, 10));
    expect(result.current).toBeNull();
  });

  it('returns null on malformed JSON', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('not-json'));

    const { result } = renderHook(() => useDesktopRelease());
    await new Promise((r) => setTimeout(r, 10));
    expect(result.current).toBeNull();
  });
});
