import { Controller, Post } from '@nestjs/common';
import { ApiBody, ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';

import {
  buildSwaggerDocument,
  propertyOf,
  schemaOf,
} from '../../shared/testing/swagger-probe';
import {
  HasNoNulCharacter,
  MaxCodePoints,
  PostgresVarchar,
  codePointLength,
  hasAtMostCodePoints,
  hasNoNulCharacter,
} from './postgres-text';

// 변형 선택자 16(U+FE0F). 화면에 보이지 않아 리터럴로 적으면 테스트의 핵심 입력이 사라진 것처럼 보인다.
const VS16 = '\uFE0F';

class Probe {
  @IsOptional()
  @HasNoNulCharacter()
  @MaxCodePoints(3)
  name?: unknown;

  @IsOptional()
  @HasNoNulCharacter({ each: true })
  tags?: unknown;
}

async function constraintsOf(
  body: Record<string, unknown>,
): Promise<Record<string, string[]>> {
  const errors = await validate(plainToInstance(Probe, body));
  return Object.fromEntries(
    errors.map((e) => [e.property, Object.keys(e.constraints ?? {}).sort()]),
  );
}

describe('hasNoNulCharacter', () => {
  it.each([
    ['an empty string', ''],
    ['a plain string', 'YubiKey'],
    ['a string with other control characters', 'a\tb\u0001c'],
  ])('accepts %s', (_label, value) => {
    expect(hasNoNulCharacter(value)).toBe(true);
  });

  it.each([
    ['a NUL in the middle', 'a\u0000b'],
    ['only a NUL', '\u0000'],
    ['a leading NUL', '\u0000usb'],
    ['a non-string', 1],
    ['null', null],
  ])('rejects %s', (_label, value) => {
    expect(hasNoNulCharacter(value)).toBe(false);
  });
});

describe('codePointLength', () => {
  it.each([
    ['ASCII', 'abc', 3],
    ['a surrogate pair as one code point', '😀', 1],
    ['a variation selector as its own code point', `\u2764${VS16}`, 2],
    ['Hangul syllables', '보안 키', 4],
  ])('counts %s', (_label, value, expected) => {
    expect(codePointLength(value)).toBe(expected);
  });
});

describe('hasAtMostCodePoints', () => {
  it('accepts a string with exactly max code points', () => {
    expect(hasAtMostCodePoints('ab😀', 3)).toBe(true);
  });

  it('rejects a string with more than max code points', () => {
    expect(hasAtMostCodePoints('abcd', 3)).toBe(false);
  });

  it('rejects a non-string', () => {
    expect(hasAtMostCodePoints(['a'], 3)).toBe(false);
  });

  // class-validator 의 MaxLength 와 갈리는 자리다. MaxLength 는 앞 글자와 변형 선택자를 한 글자로 센다.
  it('counts a variation selector that MaxLength folds into the previous character', async () => {
    class MaxLengthProbe {
      @MaxLength(3)
      name!: string;
    }
    const value = `abc${VS16}`;
    const errors = await validate(
      plainToInstance(MaxLengthProbe, { name: value }),
    );
    expect(errors).toHaveLength(0);
    expect(hasAtMostCodePoints(value, 3)).toBe(false);
  });
});

describe('HasNoNulCharacter · MaxCodePoints decorators', () => {
  it('pass a valid string', async () => {
    expect(await constraintsOf({ name: 'ab😀', tags: ['usb'] })).toEqual({});
  });

  it('report each failing constraint by name', async () => {
    expect(await constraintsOf({ name: 'ab\u0000c' })).toEqual({
      name: ['hasNoNulCharacter', 'maxCodePoints'],
    });
  });

  it('check every item with each: true', async () => {
    expect(await constraintsOf({ tags: ['usb', 'a\u0000b'] })).toEqual({
      tags: ['hasNoNulCharacter'],
    });
  });

  it('name the limit in the MaxCodePoints message', async () => {
    const [error] = await validate(plainToInstance(Probe, { name: 'abcd' }));
    expect(error.constraints?.maxCodePoints).toBe(
      'name must have at most 3 Unicode code points',
    );
  });
});

describe('PostgresVarchar', () => {
  class VarcharProbe {
    @IsString()
    @PostgresVarchar(3)
    name!: string;
  }

  async function constraintsOfName(name: unknown): Promise<string[]> {
    const [error] = await validate(plainToInstance(VarcharProbe, { name }));
    return Object.keys(error?.constraints ?? {}).sort();
  }

  it('passes a string within max code points', async () => {
    expect(await constraintsOfName('ab😀')).toEqual([]);
  });

  it('reports maxLength and maxCodePoints for a plain string over max', async () => {
    expect(await constraintsOfName('abcd')).toEqual([
      'maxCodePoints',
      'maxLength',
    ]);
  });

  // MaxLength 는 변형 선택자를 앞 글자와 묶어 세서 통과시키고 MaxCodePoints 만 거부한다.
  it('rejects a value that only MaxCodePoints catches', async () => {
    expect(await constraintsOfName(`abc${VS16}`)).toEqual(['maxCodePoints']);
  });

  it('rejects a NUL character', async () => {
    expect(await constraintsOfName('a\u0000b')).toEqual(['hasNoNulCharacter']);
  });
});

// Nest Swagger CLI 플러그인은 소스에서 `MaxLength` 이름을 찾아 스키마의 maxLength 를 만든다. 합성 안에 넣은
// MaxLength 는 그 눈에 보이지 않으므로 PostgresVarchar 가 ApiProperty 로 직접 건다. 그 값이 사라지면 여기서 잡는다.
describe('PostgresVarchar OpenAPI schema', () => {
  class DocumentedVarcharProbe {
    @ApiProperty({ description: 'display name', required: false })
    @IsOptional()
    @IsString()
    @PostgresVarchar(3)
    name?: string;

    @IsString()
    @PostgresVarchar(7)
    plainName!: string;
  }

  @Controller('probe')
  class ProbeController {
    @Post()
    @ApiBody({ type: DocumentedVarcharProbe })
    create(): void {}
  }

  let doc: Awaited<ReturnType<typeof buildSwaggerDocument>>;

  beforeAll(async () => {
    doc = await buildSwaggerDocument({ controllers: [ProbeController] });
  });

  it('advertises maxLength and keeps the description of the field ApiProperty', () => {
    const name = propertyOf(doc, 'DocumentedVarcharProbe', 'name');
    expect(name.maxLength).toBe(3);
    expect(name.description).toBe('display name');
  });

  it('keeps the field optional', () => {
    expect(schemaOf(doc, 'DocumentedVarcharProbe').required).not.toContain(
      'name',
    );
  });

  it('advertises maxLength for a field without its own ApiProperty', () => {
    expect(
      propertyOf(doc, 'DocumentedVarcharProbe', 'plainName').maxLength,
    ).toBe(7);
  });
});
