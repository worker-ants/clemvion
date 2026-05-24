import * as bcrypt from 'bcrypt';

import { User } from './user.entity';

/**
 * `@BeforeInsert` / `@BeforeUpdate` hook 의 직접 호출 단위 검증.
 * TypeORM lifecycle 를 거치지 않고 메서드만 검증해 entity 가 invalid hash 를
 * 거부함을 확인. ai-review PR #301 security W1 후속 hardening.
 */
describe('User entity — password_hash format guard (@BeforeInsert/@BeforeUpdate)', () => {
  function makeUser(passwordHash: unknown): User {
    const u = new User();
    u.passwordHash = passwordHash as string;
    return u;
  }

  it('allows null / undefined passwordHash (OAuth-only user — spec §"비밀번호 저장" nullable)', () => {
    const u1 = makeUser(null);
    expect(() => u1.validatePasswordHashFormat()).not.toThrow();
    const u2 = makeUser(undefined);
    expect(() => u2.validatePasswordHashFormat()).not.toThrow();
  });

  it('allows genuine bcrypt hash', () => {
    const hash = bcrypt.hashSync('test-password', 1);
    const u = makeUser(hash);
    expect(() => u.validatePasswordHashFormat()).not.toThrow();
  });

  it('throws on plain text ("x" — historical e2e bug)', () => {
    const u = makeUser('x');
    expect(() => u.validatePasswordHashFormat()).toThrow(
      /Invalid password_hash format/i,
    );
  });

  it('throws on arbitrary string / empty string', () => {
    expect(() => makeUser('plain-text').validatePasswordHashFormat()).toThrow(
      /Invalid password_hash format/i,
    );
    expect(() => makeUser('').validatePasswordHashFormat()).toThrow(
      /Invalid password_hash format/i,
    );
  });

  it('throws on non-string types', () => {
    expect(() => makeUser(123).validatePasswordHashFormat()).toThrow();
    expect(() => makeUser({}).validatePasswordHashFormat()).toThrow();
  });

  it('error message does NOT leak the actual hash value (log safety)', () => {
    const secret = 'super-secret-but-invalid-hash';
    try {
      makeUser(secret).validatePasswordHashFormat();
      throw new Error('expected throw');
    } catch (err) {
      const msg = (err as Error).message;
      expect(msg).not.toContain(secret);
    }
  });
});
