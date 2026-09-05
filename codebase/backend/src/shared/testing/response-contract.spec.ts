import { describe, it, expect, beforeAll } from '@jest/globals';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import {
  assertMatchesDtoSchema,
  findContractViolations,
  formatViolations,
  schemaForDto,
  type ContractViolation,
} from './response-contract';
import { type SwaggerSchemaObject } from './swagger-probe';

/**
 * `spec/5-system/2-api-convention.md` §5.4 의 세 선언 형태를 한 DTO 에 모아 둔 픽스처.
 *
 * **네 축이 한 클래스에 다 있어야** 각 규칙을 독립적으로 물 수 있다 — 축이 빠지면 그
 * 규칙의 캐너리가 다른 축의 통과에 묻힌다.
 */
class ProbeDto {
  /** required + non-nullable — 키가 있고 값이 null 이 아니어야 한다 */
  @ApiProperty()
  id: string;

  /** required + nullable — 키는 있어야 하고 값은 null 이어도 된다 */
  @ApiProperty({ nullable: true })
  label: string | null;

  /** 키 생략형 — 없어도 되지만 있으면 null 이 아니어야 한다 (§5.4) */
  @ApiPropertyOptional()
  note?: string;

  /** 키 생략형 + nullable — 요청 DTO 의 tri-state 형태. 응답에선 드물지만 표현은 가능하다 */
  @ApiPropertyOptional({ nullable: true })
  legacy?: string | null;
}

const VALID = {
  id: 'x',
  label: null,
  note: 'n',
  legacy: null,
} satisfies Record<string, unknown>;

describe('response-contract — 실제 응답 vs DTO 선언 (§5.4)', () => {
  let schema: SwaggerSchemaObject;

  beforeAll(async () => {
    schema = await schemaForDto(ProbeDto);
  });

  /**
   * 아래 캐너리가 전부 통과해도, 스키마가 **비어 있으면** 아무것도 검사하지 않은 것이다.
   * `expect(violations).toEqual([])` 형태의 단언은 그 두 상태를 구분하지 못한다.
   */
  it('[전제] 스키마가 네 축을 실제로 담고 있다', () => {
    const props = Object.keys(
      (schema.properties ?? {}) as Record<string, unknown>,
    );
    expect(props.sort()).toEqual(['id', 'label', 'legacy', 'note']);
    // required 는 @ApiProperty 만, @ApiPropertyOptional 은 빠진다
    expect((schema.required ?? []).sort()).toEqual(['id', 'label']);
    const nullable = Object.entries(
      (schema.properties ?? {}) as Record<string, { nullable?: boolean }>,
    )
      .filter(([, v]) => v.nullable === true)
      .map(([k]) => k);
    expect(nullable.sort()).toEqual(['label', 'legacy']);
  });

  it('선언과 맞는 응답은 위반이 없다', () => {
    expect(findContractViolations(VALID, schema)).toEqual([]);
  });

  describe('[대조군] 각 규칙이 실제로 무는가', () => {
    const kinds = (v: ContractViolation[]) =>
      v.map((x) => `${x.property}:${x.kind}`);

    it('required 키가 빠지면 missing', () => {
      const { id: _drop, ...rest } = VALID;
      expect(kinds(findContractViolations(rest, schema))).toEqual([
        'id:missing',
      ]);
    });

    it('required 키가 undefined 여도 missing — 키 존재만으로는 부족하다', () => {
      expect(
        kinds(findContractViolations({ ...VALID, id: undefined }, schema)),
      ).toEqual(['id:missing']);
    });

    it('nullable 아닌 required 가 null 이면 null 위반', () => {
      expect(
        kinds(findContractViolations({ ...VALID, id: null }, schema)),
      ).toEqual(['id:null']);
    });

    it('nullable 인 required 는 null 이어도 통과 — 이게 §5.4 의 기본형', () => {
      expect(findContractViolations({ ...VALID, label: null }, schema)).toEqual(
        [],
      );
    });

    it('키 생략형은 없어도 통과', () => {
      const { note: _drop, ...rest } = VALID;
      expect(findContractViolations(rest, schema)).toEqual([]);
    });

    it('키 생략형이 null 로 오면 위반 — §5.4 가 그 조합을 금지한다', () => {
      expect(
        kinds(findContractViolations({ ...VALID, note: null }, schema)),
      ).toEqual(['note:null']);
    });

    it('키 생략형 + nullable 은 null 이어도 통과', () => {
      expect(
        findContractViolations({ ...VALID, legacy: null }, schema),
      ).toEqual([]);
    });

    it('선언에 없는 키가 오면 undeclared — 반대 방향 위반', () => {
      expect(
        kinds(findContractViolations({ ...VALID, ghost: 1 }, schema)),
      ).toEqual(['ghost:undeclared']);
    });

    it('allowUndeclared 로 면제할 수 있다', () => {
      expect(
        findContractViolations({ ...VALID, ghost: 1 }, schema, {
          allowUndeclared: ['ghost'],
        }),
      ).toEqual([]);
    });

    it('여러 위반이 한 번에 다 나온다 — 첫 건에서 멈추지 않는다', () => {
      const { id: _drop, ...rest } = VALID;
      expect(
        kinds(
          findContractViolations({ ...rest, note: null, ghost: 1 }, schema),
        ).sort(),
      ).toEqual(['ghost:undeclared', 'id:missing', 'note:null']);
    });
  });

  describe('payload 가 객체가 아닌 경우', () => {
    it.each([
      ['null', null],
      ['배열 아닌 원시값', 'str'],
      ['undefined', undefined],
    ])('%s → 그 사실을 위반으로 보고한다', (_label, payload) => {
      const v = findContractViolations(payload, schema);
      expect(v).toHaveLength(1);
      expect(v[0].property).toBe('(payload)');
    });
  });

  describe('assertMatchesDtoSchema', () => {
    it('맞으면 던지지 않는다', () => {
      expect(() =>
        assertMatchesDtoSchema(VALID, schema, 'ProbeDto'),
      ).not.toThrow();
    });

    it('어긋나면 DTO 이름·건수·필드명을 담아 던진다', () => {
      const { id: _drop, ...rest } = VALID;
      expect(() => assertMatchesDtoSchema(rest, schema, 'ProbeDto')).toThrow(
        /ProbeDto.*1건[\s\S]*id \[missing\]/,
      );
    });
  });

  it('formatViolations 가 위반 수와 필드명을 담는다', () => {
    const { id: _drop, ...rest } = VALID;
    const msg = formatViolations(
      'ProbeDto',
      findContractViolations(rest, schema),
    );
    expect(msg).toContain('ProbeDto');
    expect(msg).toContain('(1건)');
    expect(msg).toContain('id');
  });
});
