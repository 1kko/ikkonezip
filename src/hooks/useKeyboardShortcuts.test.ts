import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useKeyboardShortcuts, type ShortcutMap } from './useKeyboardShortcuts';

describe('useKeyboardShortcuts', () => {
  let actions: ShortcutMap;
  let downloadHandler: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    downloadHandler = vi.fn();
    actions = {
      'mod+o': vi.fn(),
      'mod+shift+o': vi.fn(),
      'enter': downloadHandler,
      'escape': vi.fn(),
    };
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  function fireKey(key: string, opts: KeyboardEventInit = {}) {
    window.dispatchEvent(new KeyboardEvent('keydown', { key, ...opts }));
  }

  it('fires the registered handler on plain key (Enter)', () => {
    renderHook(() => useKeyboardShortcuts(actions));
    fireKey('Enter');
    expect(actions['enter']).toHaveBeenCalledTimes(1);
  });

  it('fires the registered handler on Cmd+O (mod = metaKey)', () => {
    renderHook(() => useKeyboardShortcuts(actions));
    fireKey('o', { metaKey: true });
    expect(actions['mod+o']).toHaveBeenCalledTimes(1);
  });

  it('fires the registered handler on Ctrl+O (mod = ctrlKey)', () => {
    renderHook(() => useKeyboardShortcuts(actions));
    fireKey('o', { ctrlKey: true });
    expect(actions['mod+o']).toHaveBeenCalledTimes(1);
  });

  it('distinguishes mod+o and mod+shift+o', () => {
    renderHook(() => useKeyboardShortcuts(actions));
    fireKey('o', { metaKey: true, shiftKey: true });
    expect(actions['mod+shift+o']).toHaveBeenCalledTimes(1);
    expect(actions['mod+o']).not.toHaveBeenCalled();
  });

  it('does not fire when focus is in an <input>', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    renderHook(() => useKeyboardShortcuts(actions));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(downloadHandler).not.toHaveBeenCalled();
  });

  it('does not fire when focus is in a <textarea>', () => {
    const ta = document.createElement('textarea');
    document.body.appendChild(ta);
    ta.focus();

    renderHook(() => useKeyboardShortcuts(actions));
    ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(downloadHandler).not.toHaveBeenCalled();
  });

  it('does not fire when focus is in a contenteditable element', () => {
    const div = document.createElement('div');
    div.setAttribute('contenteditable', 'true');
    document.body.appendChild(div);
    div.focus();

    renderHook(() => useKeyboardShortcuts(actions));
    div.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(downloadHandler).not.toHaveBeenCalled();
  });

  it('removes listener on unmount', () => {
    const { unmount } = renderHook(() => useKeyboardShortcuts(actions));
    unmount();
    fireKey('Enter');
    expect(downloadHandler).not.toHaveBeenCalled();
  });
});
