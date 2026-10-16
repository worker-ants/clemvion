import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';

import { WebAuthnRegisterVerifyDto, WebAuthnRenameDto } from './webauthn.dto';

// 전역 CustomValidationPipe 와 같은 옵션이다.
const VALIDATE_OPTIONS = { whitelist: true, forbidNonWhitelisted: true };

async function deviceNameConstraints(
  dto: typeof WebAuthnRegisterVerifyDto | typeof WebAuthnRenameDto,
  deviceName: unknown,
): Promise<string[]> {
  const instance =
    dto === WebAuthnRegisterVerifyDto
      ? plainToInstance(WebAuthnRegisterVerifyDto, {
          optionsToken: 'opts.tok',
          response: {},
          deviceName,
        })
      : plainToInstance(WebAuthnRenameDto, { deviceName });
  const errors = await validate(instance, VALIDATE_OPTIONS);
  return errors
    .filter((e) => e.property === 'deviceName')
    .flatMap((e) => Object.keys(e.constraints ?? {}))
    .sort();
}

// 표시 이름은 varchar(100) 컬럼에 들어간다. PostgreSQL 은 NUL 문자를 저장하지 못하고 길이를 코드
// 포인트로 센다. 실제 DB 에서 500 이 나던 것은 e2e(webauthn-2fa.e2e-spec.ts 케이스 K · L)가 본다.
describe.each([
  ['WebAuthnRegisterVerifyDto', WebAuthnRegisterVerifyDto],
  ['WebAuthnRenameDto', WebAuthnRenameDto],
] as const)('%s deviceName', (_name, dto) => {
  it.each([
    ['a plain name', 'YubiKey 5C'],
    ['100 code points with a variation selector', `${'a'.repeat(99)}️`],
    ['100 emoji as surrogate pairs', '😀'.repeat(100)],
  ])('accepts %s', async (_label, deviceName) => {
    expect(await deviceNameConstraints(dto, deviceName)).toEqual([]);
  });

  it.each([
    ['a NUL in the middle', 'a\u0000b', ['hasNoNulCharacter']],
    ['only a NUL', '\u0000', ['hasNoNulCharacter']],
    // MaxLength 는 앞 글자와 변형 선택자를 한 글자로 세서 이 값을 통과시킨다.
    [
      '101 code points that MaxLength counts as 100',
      `${'a'.repeat(100)}️`,
      ['maxCodePoints'],
    ],
    ['101 plain characters', 'a'.repeat(101), ['maxCodePoints', 'maxLength']],
  ])('rejects %s', async (_label, deviceName, expected) => {
    expect(await deviceNameConstraints(dto, deviceName)).toEqual(expected);
  });
});

describe('WebAuthnRegisterVerifyDto deviceName', () => {
  it('may be omitted', async () => {
    expect(
      await deviceNameConstraints(WebAuthnRegisterVerifyDto, undefined),
    ).toEqual([]);
  });
});
