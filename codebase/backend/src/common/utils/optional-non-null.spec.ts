import { IsBoolean, IsString, validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';

import { IsOptionalNonNull } from './optional-non-null';

class Probe {
  @IsOptionalNonNull()
  @IsString()
  name?: string;

  @IsOptionalNonNull()
  @IsBoolean()
  isActive?: boolean;
}

const VALIDATE_OPTIONS = { whitelist: true, forbidNonWhitelisted: true };

async function constraintsOf(
  body: Record<string, unknown>,
): Promise<Record<string, string[]>> {
  const errors = await validate(plainToInstance(Probe, body), VALIDATE_OPTIONS);
  return Object.fromEntries(
    errors.map((e) => [e.property, Object.keys(e.constraints ?? {}).sort()]),
  );
}

describe('IsOptionalNonNull', () => {
  it('키를 생략하면 검증을 건너뛴다 — 값 불변', async () => {
    expect(await constraintsOf({})).toStrictEqual({});
  });

  it('null 이면 거부한다 — isDefined 와 타입 검증기가 함께 돈다', async () => {
    expect(await constraintsOf({ name: null, isActive: null })).toStrictEqual({
      name: ['isDefined', 'isString'],
      isActive: ['isBoolean', 'isDefined'],
    });
  });

  it('null 거부 메시지는 «생략하면 유지된다» 를 알려 준다', async () => {
    const [error] = await validate(
      plainToInstance(Probe, { name: null }),
      VALIDATE_OPTIONS,
    );
    expect(error.constraints?.isDefined).toBe(
      'name must not be null — omit the field to keep the current value',
    );
  });

  it('값이 오면 그 값의 검증기만 본다', async () => {
    expect(await constraintsOf({ name: 'ok', isActive: false })).toStrictEqual(
      {},
    );
    expect(await constraintsOf({ name: 1 })).toStrictEqual({
      name: ['isString'],
    });
  });
});
