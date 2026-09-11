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

  /**
   * **[A] `details[]` 원소는 `field`·`message`·`code` 세 키를 싣는다.**
   *
   * `2-api-convention.md` §5.3 이 *「`details` 항목이 `field` 를 실으면 `code` 도 싣는다 —
   * 형태 무관」* 을 규약화했다(`94e19be8d`). 이 두 자리는 **배열 갈래**인데 `code` 를 빠뜨리고
   * 있었다 — 규약 표의 배열 행 shape (`{ field, message, code }`) 이 예시로 읽힌 결과다.
   *
   * **위 세 테스트는 `.toThrow(BadRequestException)` 뿐이라 이 축을 못 본다** — 무엇이
   * 던졌는지도, 페이로드가 어떤 모양인지도 단언하지 않는다. 그래서 `code` 를 배선해도
   * 뮤테이션이 생존했다. 여기서 `toEqual` 로 원소 전체를 고정한다.
   *
   * fixture 는 **두 분기를 가른다**: `'P@ss1'` 은 3종을 갖췄으나 8자 미만이라 길이 분기만,
   * `'alllowercase'` 는 8자 이상이나 1종이라 종류 분기만 발동한다.
   */
  it.each([
    ['길이 분기', 'P@ss1', 'Minimum 8 characters required'],
    ['종류 분기', 'alllowercase', 'Requires 3+ character types'],
  ])(
    '[A] %s — details 원소가 field·message·code 를 싣는다',
    (_label, pw, message) => {
      let thrown: unknown = null;
      try {
        validatePasswordStrength(pw);
      } catch (err) {
        thrown = (err as BadRequestException).getResponse();
      }
      expect(thrown).toMatchObject({ code: 'VALIDATION_ERROR' });
      expect((thrown as { details?: unknown[] }).details).toEqual([
        { field: 'password', message, code: 'INVALID_FIELD' },
      ]);
    },
  );

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
