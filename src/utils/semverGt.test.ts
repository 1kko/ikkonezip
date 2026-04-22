import { describe, it, expect } from 'vitest';
import { semverGt } from './semverGt';

describe('semverGt', () => {
  it('returns true when major > major', () => {
    expect(semverGt('2.0.0', '1.9.9')).toBe(true);
  });
  it('returns true when minor > minor', () => {
    expect(semverGt('1.2.0', '1.1.9')).toBe(true);
  });
  it('returns true when patch > patch', () => {
    expect(semverGt('1.0.2', '1.0.1')).toBe(true);
  });
  it('returns false when versions are equal', () => {
    expect(semverGt('1.2.3', '1.2.3')).toBe(false);
  });
  it('returns false when remote is lower', () => {
    expect(semverGt('1.2.3', '1.2.4')).toBe(false);
  });
  it('strips a leading "v" prefix from either argument', () => {
    expect(semverGt('v1.2.3', '1.2.2')).toBe(true);
    expect(semverGt('1.2.3', 'v1.2.2')).toBe(true);
  });
  it('treats malformed input as non-greater (safe default)', () => {
    expect(semverGt('garbage', '1.0.0')).toBe(false);
    expect(semverGt('1.0.0', 'garbage')).toBe(false);
  });
});
