import { isValidUuid } from './uuid';

describe('isValidUuid', () => {
  it('accepts canonical lowercase UUIDs (v1–v5)', () => {
    expect(isValidUuid('11111111-1111-1111-8111-111111111111')).toBe(true); // v1
    expect(isValidUuid('11111111-1111-4111-8111-111111111111')).toBe(true); // v4
    expect(isValidUuid('8f3c6b1a-0d2e-4a7e-9c1d-2f0e5a8b1234')).toBe(true);
  });

  it('accepts uppercase (case-insensitive)', () => {
    expect(isValidUuid('AAAAAAAA-1111-4111-8111-AAAAAAAAAAAA')).toBe(true);
  });

  it('rejects empty / non-string-shaped input', () => {
    expect(isValidUuid('')).toBe(false);
    expect(isValidUuid('not-a-uuid')).toBe(false);
    expect(isValidUuid('doc-abc')).toBe(false);
  });

  it('rejects wrong version / variant nibble', () => {
    // version nibble 0 (must be 1–5)
    expect(isValidUuid('11111111-1111-0111-8111-111111111111')).toBe(false);
    // version nibble 6 (out of 1–5)
    expect(isValidUuid('11111111-1111-6111-8111-111111111111')).toBe(false);
    // variant nibble 7 (must be 8/9/a/b)
    expect(isValidUuid('11111111-1111-4111-7111-111111111111')).toBe(false);
  });

  it('rejects malformed structure (length / separators / non-hex)', () => {
    expect(isValidUuid('11111111-1111-4111-8111-11111111111')).toBe(false); // short
    expect(isValidUuid('11111111-1111-4111-8111-1111111111111')).toBe(false); // long
    expect(isValidUuid('111111111111141118111111111111111111')).toBe(false); // no dashes
    expect(isValidUuid('gggggggg-1111-4111-8111-111111111111')).toBe(false); // non-hex
    expect(isValidUuid(' 11111111-1111-4111-8111-111111111111')).toBe(false); // leading space
  });
});
