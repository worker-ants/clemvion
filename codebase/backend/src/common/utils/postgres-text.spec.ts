import { IsOptional, MaxLength, validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';

import {
  HasNoNulCharacter,
  MaxCodePoints,
  codePointLength,
  hasAtMostCodePoints,
  hasNoNulCharacter,
} from './postgres-text';

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
    ['a variation selector as its own code point', '❤️', 2],
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
    const value = 'abc️';
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
