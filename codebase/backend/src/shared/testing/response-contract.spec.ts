import { describe, it, expect, beforeAll } from '@jest/globals';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import {
  assertMatchesContract,
  contractForDto,
  findContractViolations,
  formatViolations,
  type ContractViolation,
  type DtoContract,
} from './response-contract';

/** 중첩 대조용 — 최상위 `ProbeDto` 가 `$ref` 로 가리킨다. */
class NestedDto {
  /** required + non-nullable */
  @ApiProperty()
  nid: string;

  /** 키 생략형 */
  @ApiPropertyOptional()
  hint?: string;
}

/**
 * `spec/5-system/2-api-convention.md` §5.4 의 선언 형태를 한 DTO 에 모아 둔 픽스처.
 *
 * **네 축이 한 클래스에 다 있어야** 각 규칙을 독립적으로 물 수 있다 — 축이 빠지면 그
 * 규칙의 캐너리가 다른 축의 통과에 묻힌다. 중첩·배열 축도 같은 이유로 여기 있다.
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

  /** 중첩 `$ref` — 여기로 내려가지 않으면 엔티티 패스스루 과다 노출을 못 잡는다 */
  @ApiPropertyOptional({ type: () => NestedDto, nullable: true })
  child?: NestedDto | null;

  /** 중첩 배열 — 원소마다 내려간다 */
  @ApiPropertyOptional({ type: () => NestedDto, isArray: true })
  children?: NestedDto[];
}

/** 순환 참조 — 내려가기가 무한히 돌지 않는지 본다. */
class CycleDto {
  @ApiProperty()
  id: string;

  @ApiPropertyOptional({ type: () => CycleDto, nullable: true })
  self?: CycleDto | null;
}

const VALID = {
  id: 'x',
  label: null,
  note: 'n',
  legacy: null,
  child: { nid: 'c', hint: 'h' },
  children: [{ nid: 'a' }, { nid: 'b', hint: 'h' }],
} satisfies Record<string, unknown>;

const kinds = (v: readonly ContractViolation[]) =>
  v.map((x) => `${x.property}:${x.kind}`);

describe('response-contract — 실제 응답 vs DTO 선언 (§5.4)', () => {
  let contract: DtoContract;

  beforeAll(async () => {
    contract = await contractForDto(ProbeDto);
  });

  /**
   * 아래 캐너리가 전부 통과해도, 스키마가 **비어 있으면** 아무것도 검사하지 않은 것이다.
   * `expect(violations).toEqual([])` 형태의 단언은 그 두 상태를 구분하지 못한다.
   */
  it('[전제] 스키마가 여섯 축을 실제로 담고 있다', () => {
    const props = Object.keys(
      (contract.schema.properties ?? {}) as Record<string, unknown>,
    );
    expect(props.sort()).toEqual([
      'child',
      'children',
      'id',
      'label',
      'legacy',
      'note',
    ]);
    // required 는 @ApiProperty 만, @ApiPropertyOptional 은 빠진다
    expect((contract.schema.required ?? []).sort()).toEqual(['id', 'label']);
  });

  it('[전제] 중첩 DTO 스키마가 `schemas` 로 해소된다', () => {
    expect(Object.keys(contract.schemas)).toContain('NestedDto');
    expect((contract.schemas.NestedDto.required ?? []).sort()).toEqual(['nid']);
  });

  it('[전제] 계약이 DTO 이름을 스스로 안다', () => {
    expect(contract.name).toBe('ProbeDto');
  });

  it('선언과 맞는 응답은 위반이 없다', () => {
    expect(findContractViolations(VALID, contract)).toEqual([]);
  });

  describe('[대조군] 각 규칙이 실제로 무는가', () => {
    it('required 키가 빠지면 missing', () => {
      const { id: _drop, ...rest } = VALID;
      expect(kinds(findContractViolations(rest, contract))).toEqual([
        'id:missing',
      ]);
    });

    it('required 키가 undefined 여도 missing — 키 존재만으로는 부족하다', () => {
      expect(
        kinds(findContractViolations({ ...VALID, id: undefined }, contract)),
      ).toEqual(['id:missing']);
    });

    it('nullable 아닌 required 가 null 이면 null 위반', () => {
      expect(
        kinds(findContractViolations({ ...VALID, id: null }, contract)),
      ).toEqual(['id:null']);
    });

    it('nullable 인 required 는 null 이어도 통과 — 이게 §5.4 의 기본형', () => {
      expect(
        findContractViolations({ ...VALID, label: null }, contract),
      ).toEqual([]);
    });

    it('키 생략형은 없어도 통과', () => {
      const { note: _drop, ...rest } = VALID;
      expect(findContractViolations(rest, contract)).toEqual([]);
    });

    it('키 생략형이 null 로 오면 위반 — §5.4 가 그 조합을 금지한다', () => {
      expect(
        kinds(findContractViolations({ ...VALID, note: null }, contract)),
      ).toEqual(['note:null']);
    });

    it('키 생략형 + nullable 은 null 이어도 통과', () => {
      expect(
        findContractViolations({ ...VALID, legacy: null }, contract),
      ).toEqual([]);
    });

    it('선언에 없는 키가 오면 undeclared — 반대 방향 위반', () => {
      expect(
        kinds(findContractViolations({ ...VALID, ghost: 1 }, contract)),
      ).toEqual(['ghost:undeclared']);
    });

    it('allowUndeclared 로 면제할 수 있다', () => {
      expect(
        findContractViolations({ ...VALID, ghost: 1 }, contract, {
          allowUndeclared: ['ghost'],
        }),
      ).toEqual([]);
    });

    it('여러 위반이 한 번에 다 나온다 — 첫 건에서 멈추지 않는다', () => {
      const { id: _drop, ...rest } = VALID;
      expect(
        kinds(
          findContractViolations({ ...rest, note: null, ghost: 1 }, contract),
        ).sort(),
      ).toEqual(['ghost:undeclared', 'id:missing', 'note:null']);
    });

    /**
     * 정렬을 테스트 쪽에서 다시 하면 `.sort()` 를 통째로 지워도 통과한다 — 그래서 여기서만
     * **재정렬 없이** 비교한다. 발견 순서는 `id`(스키마 프로퍼티 순서) → `aaa`(payload 키
     * 순서)라서 알파벳순과 어긋나고, 그 어긋남이 이 단언을 판별력 있게 만든다.
     */
    it('위반은 property 알파벳순으로 나온다', () => {
      const { id: _drop, ...rest } = VALID;
      expect(
        findContractViolations({ ...rest, aaa: 1 }, contract).map(
          (v) => v.property,
        ),
      ).toEqual(['aaa', 'id']);
    });
  });

  describe('중첩 DTO 로 내려간다', () => {
    it('중첩 객체의 미선언 키를 경로와 함께 잡는다 — 엔티티 패스스루가 여기서 걸린다', () => {
      expect(
        kinds(
          findContractViolations(
            { ...VALID, child: { nid: 'c', passwordHash: 'secret' } },
            contract,
          ),
        ),
      ).toEqual(['child.passwordHash:undeclared']);
    });

    it('중첩 객체의 required 누락도 잡는다', () => {
      expect(
        kinds(
          findContractViolations({ ...VALID, child: { hint: 'h' } }, contract),
        ),
      ).toEqual(['child.nid:missing']);
    });

    it('중첩이 nullable 이면 null 은 통과하고 내려가지 않는다', () => {
      expect(
        findContractViolations({ ...VALID, child: null }, contract),
      ).toEqual([]);
    });

    it('배열은 원소마다 내려가고 인덱스가 경로에 찍힌다', () => {
      expect(
        kinds(
          findContractViolations(
            {
              ...VALID,
              children: [{ nid: 'a' }, { nid: 'b', leak: 1 }, {}],
            },
            contract,
          ),
        ),
      ).toEqual(['children[1].leak:undeclared', 'children[2].nid:missing']);
    });

    it('allowUndeclared 는 중첩 경로로 적는다', () => {
      expect(
        findContractViolations(
          { ...VALID, child: { nid: 'c', extra: 1 } },
          contract,
          { allowUndeclared: ['child.extra'] },
        ),
      ).toEqual([]);
    });

    it('순환 참조에서 무한히 내려가지 않는다', async () => {
      const cycle = await contractForDto(CycleDto);
      expect(
        findContractViolations(
          { id: 'a', self: { id: 'b', self: { id: 'c' } } },
          cycle,
        ),
      ).toEqual([]);
    });
  });

  describe('payload 가 객체가 아닌 경우', () => {
    it.each([
      ['null', null],
      ['원시값', 'str'],
      ['undefined', undefined],
      ['배열', [{ id: 'x' }]],
    ])('%s → invalid-payload 로 보고한다', (_label, payload) => {
      const v = findContractViolations(payload, contract);
      expect(v).toHaveLength(1);
      expect(v[0].property).toBe('(payload)');
      // 필드 누락(`missing`)과 다른 종류여야 한다 — kind 만 보는 소비자가 둘을 섞지 않게.
      expect(v[0].kind).toBe('invalid-payload');
    });

    it('배열은 원시값과 구분되게 보고한다', () => {
      expect(findContractViolations([], contract)[0].detail).toContain('array');
    });
  });

  describe('assertMatchesContract', () => {
    it('맞으면 던지지 않는다', () => {
      expect(() => assertMatchesContract(VALID, contract)).not.toThrow();
    });

    it('어긋나면 DTO 이름·건수·필드명을 담아 던진다 — 이름은 계약에서 나온다', () => {
      const { id: _drop, ...rest } = VALID;
      expect(() => assertMatchesContract(rest, contract)).toThrow(
        /ProbeDto.*1건[\s\S]*id \[missing\]/,
      );
    });
  });

  it('formatViolations 가 위반 수와 필드명을 담는다', () => {
    const { id: _drop, ...rest } = VALID;
    const msg = formatViolations(
      contract.name,
      findContractViolations(rest, contract),
    );
    expect(msg).toContain('ProbeDto');
    expect(msg).toContain('(1건)');
    expect(msg).toContain('id');
  });
});
