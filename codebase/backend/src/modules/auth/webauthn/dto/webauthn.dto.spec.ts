import { Controller, Patch, Post } from '@nestjs/common';
import { ApiBody } from '@nestjs/swagger';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';

import {
  buildSwaggerDocument,
  propertyOf,
} from '../../../../shared/testing/swagger-probe';
import { WebAuthnRegisterVerifyDto, WebAuthnRenameDto } from './webauthn.dto';

// 변형 선택자 16(U+FE0F). 화면에 보이지 않아 리터럴로 적으면 테스트의 핵심 입력이 사라진 것처럼 보인다.
const VS16 = '\uFE0F';
// 코드 포인트 100개: 글자 99개 + 변형 선택자. class-validator MaxLength 는 앞 글자와 묶어 99로 센다.
const LONGEST_DEVICE_NAME = `${'a'.repeat(99)}${VS16}`;
// 코드 포인트 101개: 글자 100개 + 변형 선택자. MaxLength 는 100으로 세서 통과시킨다.
const TOO_LONG_DEVICE_NAME = `${'a'.repeat(100)}${VS16}`;

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
    ['100 code points with a variation selector', LONGEST_DEVICE_NAME],
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
      TOO_LONG_DEVICE_NAME,
      ['maxCodePoints'],
    ],
    ['101 plain characters', 'a'.repeat(101), ['maxCodePoints', 'maxLength']],
    // 길이는 앞뒤 공백을 지우기 전의 값으로 센다. 서비스는 지운 값(100개)을 저장하지만 DTO 가 먼저 거부한다.
    [
      '100 characters and a trailing space',
      `${'a'.repeat(100)} `,
      ['maxCodePoints', 'maxLength'],
    ],
  ])('rejects %s', async (_label, deviceName, expected) => {
    expect(await deviceNameConstraints(dto, deviceName)).toEqual(expected);
  });
});

// 공백 문자는 `String.prototype.trim()` 이 지우는 문자다. 서비스가 저장할 때 지우는 문자와 같다.
const BLANK_DEVICE_NAMES: [string, string][] = [
  ['spaces', '   '],
  ['a tab and a line feed', '\t\n'],
  ['a no-break space', ' '],
  ['an ideographic space', '　'],
  ['a line separator', ' '],
  ['a byte order mark', '﻿'],
];

describe('WebAuthnRegisterVerifyDto deviceName', () => {
  it('may be omitted', async () => {
    expect(
      await deviceNameConstraints(WebAuthnRegisterVerifyDto, undefined),
    ).toEqual([]);
  });

  // 표시 이름이 선택 필드라서 이름을 주지 않은 요청과 같게 보고 서비스가 NULL 로 저장한다.
  it.each([['an empty string', ''], ...BLANK_DEVICE_NAMES])(
    'accepts %s',
    async (_label, deviceName) => {
      expect(
        await deviceNameConstraints(WebAuthnRegisterVerifyDto, deviceName),
      ).toEqual([]);
    },
  );
});

// 등록 검증은 표시 이름을 빼도 되므로 빈 이름 · 공백 문자로만 된 이름 거부는 이름 변경에만 있다.
describe('WebAuthnRenameDto deviceName', () => {
  it('rejects an empty string', async () => {
    expect(await deviceNameConstraints(WebAuthnRenameDto, '')).toEqual([
      'isNotBlank',
      'minLength',
    ]);
  });

  it.each(BLANK_DEVICE_NAMES)(
    'rejects a name made only of %s',
    async (_label, deviceName) => {
      expect(
        await deviceNameConstraints(WebAuthnRenameDto, deviceName),
      ).toEqual(['isNotBlank']);
    },
  );

  it.each([
    ['surrounding spaces', '  My Mac  '],
    // `trim()` 이 지우지 않으므로 공백 문자로 보지 않는다.
    ['only a zero-width space', '​'],
  ])('accepts a name with %s', async (_label, deviceName) => {
    expect(await deviceNameConstraints(WebAuthnRenameDto, deviceName)).toEqual(
      [],
    );
  });

  it.each([
    ['missing', undefined],
    ['null', null],
  ])('rejects a %s name', async (_label, deviceName) => {
    expect(
      await deviceNameConstraints(WebAuthnRenameDto, deviceName),
    ).toContain('isString');
  });
});

// 필드 데코레이터를 PostgresVarchar 로 합성한 뒤에도 문서에 길이 한도가 남는지 본다.
describe('deviceName OpenAPI schema', () => {
  @Controller('probe')
  class ProbeController {
    @Post('register')
    @ApiBody({ type: WebAuthnRegisterVerifyDto })
    register(): void {}

    @Patch('rename')
    @ApiBody({ type: WebAuthnRenameDto })
    rename(): void {}
  }

  let doc: Awaited<ReturnType<typeof buildSwaggerDocument>>;

  beforeAll(async () => {
    doc = await buildSwaggerDocument({ controllers: [ProbeController] });
  });

  it.each(['WebAuthnRegisterVerifyDto', 'WebAuthnRenameDto'])(
    '%s advertises maxLength 100',
    (dtoName) => {
      expect(propertyOf(doc, dtoName, 'deviceName').maxLength).toBe(100);
    },
  );
});
