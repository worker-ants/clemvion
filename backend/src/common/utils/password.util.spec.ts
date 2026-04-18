import { BadRequestException } from '@nestjs/common';
import { validatePasswordStrength } from './password.util';

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
