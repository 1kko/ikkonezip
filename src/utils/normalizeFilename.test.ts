import { describe, it, expect } from 'vitest';
import { normalizeFilename, needsNormalization } from './normalizeFilename';

describe('normalizeFilename', () => {
  it('converts NFD Korean to NFC', () => {
    // "가" in NFD (ㄱ + ㅏ decomposed)
    const nfd = '\u1100\u1161'; // 가 (NFD)
    const nfc = '\uAC00';       // 가 (NFC)
    expect(normalizeFilename(nfd)).toBe(nfc);
  });

  it('leaves NFC Korean unchanged', () => {
    const nfc = '한글파일.txt';
    expect(normalizeFilename(nfc)).toBe(nfc);
  });

  it('leaves ASCII filenames unchanged', () => {
    expect(normalizeFilename('hello.txt')).toBe('hello.txt');
  });

  it('normalizes full path with Korean folder names', () => {
    const nfdPath = '\u1100\u1161\u1102\u1161\u1103\u1161/\u1105\u1161\u1106\u1161.txt';
    const result = normalizeFilename(nfdPath);
    expect(result).toBe(result.normalize('NFC'));
  });

  it('handles empty string', () => {
    expect(normalizeFilename('')).toBe('');
  });

  it('handles mixed Korean and ASCII', () => {
    const nfd = 'project_\u1100\u1161.zip';
    const result = normalizeFilename(nfd);
    expect(result).toBe(result.normalize('NFC'));
  });

  it('handles filenames with special characters', () => {
    const name = 'file (1) [copy].txt';
    expect(normalizeFilename(name)).toBe(name);
  });
});

describe('needsNormalization', () => {
  it('returns true for NFD Korean', () => {
    const nfd = '\u1100\u1161.txt'; // 가 (NFD)
    expect(needsNormalization(nfd)).toBe(true);
  });

  it('returns false for NFC Korean', () => {
    expect(needsNormalization('한글.txt')).toBe(false);
  });

  it('returns false for ASCII-only', () => {
    expect(needsNormalization('hello.txt')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(needsNormalization('')).toBe(false);
  });

  it('detects NFD in nested path', () => {
    const nfdPath = 'folder/\u1100\u1161\u1102\u1161\u1103\u1161/file.txt';
    expect(needsNormalization(nfdPath)).toBe(true);
  });
});
