import { describe, it, expect } from 'vitest';
import { decodeZipEntryFilename } from './decodeFilename';

const utf8 = new TextEncoder();

function bytes(...vals: number[]): Uint8Array {
  return new Uint8Array(vals);
}

describe('decodeZipEntryFilename', () => {
  it('returns fallback for empty raw bytes', () => {
    expect(decodeZipEntryFilename(new Uint8Array(), false, 'fallback')).toBe('fallback');
  });

  it('decodes pure ASCII identically regardless of utf8Flag', () => {
    const ascii = utf8.encode('hello.txt');
    expect(decodeZipEntryFilename(ascii, false, 'fb')).toBe('hello.txt');
    expect(decodeZipEntryFilename(ascii, true, 'fb')).toBe('hello.txt');
  });

  it('decodes UTF-8 NFC bytes when bit11 is set', () => {
    const nfc = utf8.encode('한글.txt');
    expect(decodeZipEntryFilename(nfc, true, 'fb')).toBe('한글.txt');
  });

  it('decodes UTF-8 NFD bytes when bit11 is OFF (macOS Finder pattern)', () => {
    // 스 = U+1109 + U+1173 in NFD
    const nfdString = '스크린샷.png'.normalize('NFD');
    const nfdBytes = utf8.encode(nfdString);
    // Sanity: at least one jamo is present, so bytes start with E1 8x
    expect(nfdBytes[0]).toBe(0xe1);
    const decoded = decodeZipEntryFilename(nfdBytes, false, 'fb');
    expect(decoded).toBe(nfdString);
    // Caller will normalize to NFC; we round-trip cleanly here.
    expect(decoded.normalize('NFC')).toBe('스크린샷.png');
  });

  it('decodes CP949/EUC-KR bytes when bit11 is OFF (Korean Windows tools)', () => {
    // 한 = C7 D1, 글 = B1 DB in CP949 (EUC-KR)
    const cp949 = bytes(0xc7, 0xd1, 0xb1, 0xdb, 0x2e, 0x74, 0x78, 0x74); // "한글.txt"
    expect(decodeZipEntryFilename(cp949, false, 'fb')).toBe('한글.txt');
  });

  it('recovers when bit11 is set but bytes are actually CP949 (liar flag)', () => {
    const cp949 = bytes(0xc7, 0xd1, 0xb1, 0xdb); // "한글" in CP949
    expect(decodeZipEntryFilename(cp949, true, 'fb')).toBe('한글');
  });

  it('prefers UTF-8 when bytes are valid UTF-8 (NFD bytes are not valid CP949 starters)', () => {
    // NFD jamo bytes start with 0xE1 — could be confused for CP949 lead byte,
    // but strict UTF-8 succeeds first so we should pick UTF-8.
    const nfd = utf8.encode('가'.normalize('NFD'));
    const decoded = decodeZipEntryFilename(nfd, false, 'fb');
    expect(decoded.normalize('NFC')).toBe('가');
  });

  it('returns fallback when bytes are neither valid UTF-8 nor CP949', () => {
    // 0xFE is invalid as a UTF-8 lead byte and as a CP949 trailing byte
    // when paired with a non-CP949 lead. 0xFF 0xFE is unambiguously bad.
    const garbage = bytes(0xff, 0xfe, 0xff);
    expect(decodeZipEntryFilename(garbage, false, 'CP437-FALLBACK')).toBe('CP437-FALLBACK');
  });

  it('handles paths with subfolders containing Korean', () => {
    const nfd = utf8.encode('폴더/파일.txt'.normalize('NFD'));
    const decoded = decodeZipEntryFilename(nfd, false, 'fb');
    expect(decoded.normalize('NFC')).toBe('폴더/파일.txt');
  });
});
