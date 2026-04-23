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

  it('returns the manifest when fetch succeeds with a real version (multi-platform schema)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          version: '0.5.0',
          downloads: {
            macos: 'https://zip.1kko.com/desktop/Zip_0.5.0_universal.dmg',
            windows: 'https://zip.1kko.com/desktop/Zip_0.5.0-setup.exe',
            linux: 'https://zip.1kko.com/desktop/Zip_0.5.0_amd64.AppImage',
          },
          notes: 'release notes',
          releasedAt: '2026-04-23',
        }),
      ),
    );

    const { result } = renderHook(() => useDesktopRelease());
    await waitFor(() => {
      expect(result.current).not.toBeNull();
    });
    expect(result.current?.version).toBe('0.5.0');
    expect(result.current?.downloads.macos).toBe('https://zip.1kko.com/desktop/Zip_0.5.0_universal.dmg');
    expect(result.current?.downloads.windows).toBe('https://zip.1kko.com/desktop/Zip_0.5.0-setup.exe');
    expect(result.current?.downloads.linux).toBe('https://zip.1kko.com/desktop/Zip_0.5.0_amd64.AppImage');
  });

  it('falls back to legacy downloadUrl as the macOS link when downloads object is missing', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          version: '0.1.1',
          downloadUrl: 'https://zip.1kko.com/desktop/Zip_0.1.1_universal.dmg',
        }),
      ),
    );
    const { result } = renderHook(() => useDesktopRelease());
    await waitFor(() => expect(result.current).not.toBeNull());
    expect(result.current?.downloads.macos).toBe('https://zip.1kko.com/desktop/Zip_0.1.1_universal.dmg');
    expect(result.current?.downloads.windows).toBe('');
    expect(result.current?.downloads.linux).toBe('');
  });

  it('returns null when the manifest reports placeholder version 0.0.0', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ version: '0.0.0', downloads: { macos: 'https://example.com' } })),
    );

    const { result } = renderHook(() => useDesktopRelease());
    await new Promise((r) => setTimeout(r, 10));
    expect(result.current).toBeNull();
  });

  it('keeps macos="" when only a non-macos platform has a URL', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        version: '0.5.0',
        downloads: { windows: 'https://example.com/win.exe' },
      })),
    );
    const { result } = renderHook(() => useDesktopRelease());
    await waitFor(() => expect(result.current).not.toBeNull());
    expect(result.current?.downloads.macos).toBe('');
    expect(result.current?.downloads.windows).toBe('https://example.com/win.exe');
    expect(result.current?.downloads.linux).toBe('');
  });

  it('does not setState when the component unmounts before fetch resolves', async () => {
    let resolve: (value: Response) => void = () => {};
    vi.spyOn(globalThis, 'fetch').mockReturnValue(
      new Promise<Response>((r) => {
        resolve = r;
      }),
    );
    const { result, unmount } = renderHook(() => useDesktopRelease());
    unmount();
    resolve(
      new Response(JSON.stringify({
        version: '0.5.0',
        downloads: { macos: 'https://example.com/mac.dmg' },
      })),
    );
    await new Promise((r) => setTimeout(r, 10));
    expect(result.current).toBeNull();
  });

  it('returns null when no platform has a download URL', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ version: '0.5.0', downloads: { macos: '', windows: '', linux: '' } })),
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
