import { BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import {
  BCRYPT_ROUNDS,
  comparePassword,
  hashPassword,
  validatePasswordStrength,
} from './password.util';

describe('validatePasswordStrength', () => {
  it('accepts a password that meets length and 3-type requirements', () => {
    expect(() => validatePasswordStrength('P@ssw0rd!')).not.toThrow();
  });

  it('rejects passwords shorter than 8 characters', () => {
    expect(() => validatePasswordStrength('P@ss1')).toThrow(
      BadRequestException,
    );
  });

  it('rejects passwords with fewer than 3 character types', () => {
    expect(() => validatePasswordStrength('alllowercase')).toThrow(
      BadRequestException,
    );
    expect(() => validatePasswordStrength('ALLUPPERCASE')).toThrow(
      BadRequestException,
    );
    expect(() => validatePasswordStrength('lower12345678')).toThrow(
      BadRequestException,
    );
  });

  it('accepts 3 of 4 character types', () => {
    // lower + upper + digit
    expect(() => validatePasswordStrength('Passw0rd1')).not.toThrow();
    // lower + digit + special
    expect(() => validatePasswordStrength('passw0rd!')).not.toThrow();
  });
});

describe('hashPassword', () => {
  it('produces a bcrypt hash that verifies against the plaintext', async () => {
    const hash = await hashPassword('P@ssw0rd!');
    expect(hash).not.toBe('P@ssw0rd!');
    expect(await bcrypt.compare('P@ssw0rd!', hash)).toBe(true);
  });

  it('uses the shared BCRYPT_ROUNDS cost factor', async () => {
    const hash = await hashPassword('P@ssw0rd!');
    // bcrypt encodes the cost as the second `$`-delimited field, e.g. $2b$12$...
    expect(hash.split('$')[2]).toBe(String(BCRYPT_ROUNDS));
  });
});

describe('comparePassword', () => {
  it('returns true when the plaintext matches the hash', async () => {
    const hash = await hashPassword('P@ssw0rd!');
    expect(await comparePassword('P@ssw0rd!', hash)).toBe(true);
  });

  it('returns false when the plaintext does not match the hash', async () => {
    const hash = await hashPassword('P@ssw0rd!');
    expect(await comparePassword('wrong-password', hash)).toBe(false);
  });
});
