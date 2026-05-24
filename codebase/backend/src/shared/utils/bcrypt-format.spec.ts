import * as bcrypt from 'bcrypt';

import { isValidBcryptHash } from './bcrypt-format';

describe('isValidBcryptHash', () => {
  it('returns true for genuine bcrypt hashes (round=1, 10, 12)', () => {
    for (const rounds of [1, 10, 12]) {
      const hash = bcrypt.hashSync('test-password', rounds);
      expect(isValidBcryptHash(hash)).toBe(true);
    }
  });

  it('returns true for legacy $2a$ prefix (other bcrypt variants)', () => {
    // bcrypt 라이브러리가 $2b$ 만 생성하지만 history 적으로 $2a$ / $2y$ 도 합법.
    // prefix($2a$10$) = 7 + salt+hash(22+31) = 53 → total 60 chars.
    const fakeButValid =
      '$2a$10$abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXY01';
    expect(fakeButValid.length).toBe(60);
    expect(isValidBcryptHash(fakeButValid)).toBe(true);
  });

  it('returns false for plain text / arbitrary strings', () => {
    expect(isValidBcryptHash('x')).toBe(false);
    expect(isValidBcryptHash('plain-text')).toBe(false);
    expect(isValidBcryptHash('')).toBe(false);
  });

  it('returns false for invalid bcrypt prefix variants', () => {
    // $2x$ / $2z$ 등은 bcrypt 명세 외.
    expect(
      isValidBcryptHash(
        '$2x$10$abcdefghijklmnopqrstuv1234567890abcdefghijklmno0123456',
      ),
    ).toBe(false);
  });

  it('returns false for wrong total length', () => {
    // 59 chars (1 short — salt+hash 가 52자).
    const tooShort =
      '$2a$10$abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWX01';
    expect(tooShort.length).toBe(59);
    expect(isValidBcryptHash(tooShort)).toBe(false);
    // 61 chars (1 long — salt+hash 가 54자).
    const tooLong =
      '$2a$10$abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXY012';
    expect(tooLong.length).toBe(61);
    expect(isValidBcryptHash(tooLong)).toBe(false);
  });

  it('returns false for non-string input (number / object / array)', () => {
    expect(isValidBcryptHash(123 as unknown)).toBe(false);
    expect(isValidBcryptHash({} as unknown)).toBe(false);
    expect(isValidBcryptHash([] as unknown)).toBe(false);
  });

  it('returns false for null / undefined (caller must short-circuit on nullable fields)', () => {
    expect(isValidBcryptHash(null)).toBe(false);
    expect(isValidBcryptHash(undefined)).toBe(false);
  });
});
