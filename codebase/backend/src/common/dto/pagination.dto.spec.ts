import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PaginationQueryDto } from './pagination.dto';

async function validateSort(value: unknown): Promise<string[]> {
  const dto = plainToInstance(PaginationQueryDto, { sort: value });
  const errors = await validate(dto);
  return errors.flatMap((e) =>
    Object.keys(e.constraints ?? {}).map((k) => `${e.property}:${k}`),
  );
}

describe('PaginationQueryDto.sort 검증', () => {
  it('유효한 식별자 패턴은 통과한다', async () => {
    for (const valid of [
      'created_at',
      'updatedAt',
      'name',
      'a',
      'col1',
      'a_b_c_99',
    ]) {
      const errs = await validateSort(valid);
      expect(errs).toEqual([]);
    }
  });

  it('SQL 인젝션 패턴·공백·하이픈·콜론 등은 거부한다', async () => {
    const invalid = [
      "'; DROP TABLE x;",
      '1col',
      'col-1',
      'col 1',
      'col;1',
      'col,1',
      'col.1',
      'CASE WHEN',
      'name; SELECT 1',
    ];
    for (const v of invalid) {
      const errs = await validateSort(v);
      expect(errs.length).toBeGreaterThan(0);
    }
  });

  it('64자 초과 길이는 maxLength 위반으로 거부된다', async () => {
    const tooLong = 'a' + 'b'.repeat(64);
    const errs = await validateSort(tooLong);
    expect(errs.some((e) => e.includes('maxLength'))).toBe(true);
  });

  it('생략(undefined) 은 IsOptional 로 통과하고 기본값 created_at 이 적용된다', async () => {
    const dto = plainToInstance(PaginationQueryDto, {});
    const errs = await validate(dto);
    expect(errs).toEqual([]);
    expect(dto.sort).toBe('created_at');
  });
});
