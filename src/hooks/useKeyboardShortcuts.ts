import { useEffect } from 'react';

export type ShortcutMap = Record<string, (event: KeyboardEvent) => void>;

/**
 * Global keyboard shortcut hook. Keys use a normalized format:
 *   "mod+o"        → Cmd+O on macOS or Ctrl+O elsewhere
 *   "mod+shift+o"  → adds Shift modifier
 *   "enter"        → plain Enter, no modifiers
 *   "escape"       → plain Escape
 *
 * Shortcuts do NOT fire when the user is typing in an editable element
 * (input, textarea, or contenteditable).
 */
export function useKeyboardShortcuts(shortcuts: ShortcutMap): void {
  useEffect(() => {
    function handler(event: KeyboardEvent) {
      if (isEditableTarget(event.target)) return;
      // Modal/dialog owns the keyboard while open. Without this, global
      // Escape fires alongside Radix's own handler and clears the file list
      // every time a user dismisses a preview modal.
      if (document.querySelector('[role="dialog"][data-state="open"]')) return;

      const combo = comboFromEvent(event);
      const action = shortcuts[combo];
      if (action) {
        event.preventDefault();
        action(event);
      }
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [shortcuts]);
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return true;
  if (target.isContentEditable) return true;
  return false;
}

function comboFromEvent(event: KeyboardEvent): string {
  const parts: string[] = [];
  if (event.metaKey || event.ctrlKey) parts.push('mod');
  if (event.shiftKey) parts.push('shift');
  if (event.altKey) parts.push('alt');
  parts.push(event.key.toLowerCase());
  return parts.join('+');
}
