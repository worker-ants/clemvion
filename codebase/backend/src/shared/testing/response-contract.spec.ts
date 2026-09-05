import { describe, it, expect, beforeAll } from '@jest/globals';
import {
  ApiExtraModels,
  ApiProperty,
  ApiPropertyOptional,
  getSchemaPath,
} from '@nestjs/swagger';

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

/** 자기참조 — 스키마가 자기를 가리켜도 내부가 검사돼야 한다. */
class CycleDto {
  @ApiProperty()
  id: string;

  @ApiPropertyOptional({ type: () => CycleDto, nullable: true })
  self?: CycleDto | null;
}

class VariantADto {
  @ApiProperty()
  aOnly: string;
}

class VariantBDto {
  @ApiProperty()
  bOnly: string;
}

/** 판별자 없는 `oneOf` — 저장소가 `ExecutionStatusDto.context` 에서 쓰는 형태. */
@ApiExtraModels(VariantADto, VariantBDto)
class UnionDto {
  @ApiProperty()
  id: string;

  @ApiProperty({
    oneOf: [
      { $ref: getSchemaPath(VariantADto) },
      { $ref: getSchemaPath(VariantBDto) },
    ],
    nullable: true,
  })
  context: VariantADto | VariantBDto | null;
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

    it('allowMissing 으로 required 누락을 면제할 수 있다', () => {
      const { id: _drop, ...withoutId } = VALID;
      // 면제 없이는 위반이다 — 이 줄이 없으면 아래 단언이 "원래 통과하는 입력" 을
      // 확인하는 vacuous 캐너리가 된다.
      expect(kinds(findContractViolations(withoutId, contract))).toEqual([
        'id:missing',
      ]);
      expect(
        findContractViolations(withoutId, contract, { allowMissing: ['id'] }),
      ).toEqual([]);
    });

    it('allowMissing 은 이름이 정확히 맞을 때만 면제한다', () => {
      const { id: _drop, ...withoutId } = VALID;
      expect(
        kinds(
          findContractViolations(withoutId, contract, {
            allowMissing: ['ID', 'id2', 'note'],
          }),
        ),
      ).toEqual(['id:missing']);
    });

    it('allowMissing 은 중첩 경로로 적는다 — 얕은 이름과는 매칭되지 않는다', () => {
      // `child.nid` 는 중첩 required 다. 얕은 `nid` 로는 면제되면 안 된다.
      const brokenChild = { ...VALID, child: {} };
      expect(kinds(findContractViolations(brokenChild, contract))).toEqual([
        'child.nid:missing',
      ]);
      expect(
        kinds(
          findContractViolations(brokenChild, contract, {
            allowMissing: ['nid'],
          }),
        ),
      ).toEqual(['child.nid:missing']);
      expect(
        findContractViolations(brokenChild, contract, {
          allowMissing: ['child.nid'],
        }),
      ).toEqual([]);
    });

    it('allowMissing 은 undeclared 를 면제하지 않는다 — 두 축은 갈려 있다', () => {
      expect(
        kinds(
          findContractViolations({ ...VALID, ghost: 1 }, contract, {
            allowMissing: ['ghost'],
          }),
        ),
      ).toEqual(['ghost:undeclared']);
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

    /**
     * 종전 이 자리의 테스트는 **완전히 유효한** payload 만 대조해서, 자기참조 아래를
     * 아무것도 검사하지 않아도 통과했다 — vacuous 캐너리였다
     * (`review/code/2026/09/05/14_39_31` C1). 이제 위반을 실제로 주입한다.
     */
    it('자기참조 스키마의 첫 단계 내부가 검사된다', async () => {
      const cycle = await contractForDto(CycleDto);
      expect(
        kinds(findContractViolations({ id: 'a', self: { leak: 1 } }, cycle)),
      ).toEqual(['self.id:missing', 'self.leak:undeclared']);
    });

    it('자기참조는 깊이 제한 없이 내려간다 — 두 단계 아래도 잡는다', async () => {
      const cycle = await contractForDto(CycleDto);
      expect(
        kinds(
          findContractViolations(
            { id: 'a', self: { id: 'b', self: { leak: 2 } } },
            cycle,
          ),
        ),
      ).toEqual(['self.self.id:missing', 'self.self.leak:undeclared']);
    });

    it('유효한 자기참조 payload 는 통과한다', async () => {
      const cycle = await contractForDto(CycleDto);
      expect(
        findContractViolations(
          { id: 'a', self: { id: 'b', self: { id: 'c' } } },
          cycle,
        ),
      ).toEqual([]);
    });

    /**
     * 진짜 무한 재귀 위험은 스키마가 아니라 **값 그래프**의 순환이다. HTTP 응답은 파싱된
     * JSON 이라 이런 형태가 될 수 없지만, 가드가 실제로 그것을 막는지 여기서 확인한다.
     */
    it('자기를 가리키는 payload 객체에서도 끝난다', async () => {
      const cycle = await contractForDto(CycleDto);
      const looping: Record<string, unknown> = { id: 'a' };
      looping.self = looping;
      expect(findContractViolations(looping, cycle)).toEqual([]);
    });
  });

  describe('판별자 없는 oneOf/anyOf', () => {
    let union: DtoContract;

    beforeAll(async () => {
      union = await contractForDto(UnionDto);
    });

    it('[전제] 두 변형이 모두 schemas 로 해소된다', () => {
      expect(Object.keys(union.schemas).sort()).toEqual(
        expect.arrayContaining(['UnionDto', 'VariantADto', 'VariantBDto']),
      );
    });

    it('어느 한 변형에 있는 키는 통과한다', () => {
      expect(
        findContractViolations({ id: 'x', context: { aOnly: 'a' } }, union),
      ).toEqual([]);
      expect(
        findContractViolations({ id: 'x', context: { bOnly: 'b' } }, union),
      ).toEqual([]);
    });

    it('어느 변형에도 없는 키는 undeclared — 패스스루 과다 노출이 여기서 걸린다', () => {
      expect(
        kinds(
          findContractViolations(
            { id: 'x', context: { aOnly: 'a', passwordHash: 'secret' } },
            union,
          ),
        ),
      ).toEqual(['context.passwordHash:undeclared']);
    });

    it('required 는 강제하지 않는다 — 어느 변형인지 알 수 없기 때문', () => {
      expect(findContractViolations({ id: 'x', context: {} }, union)).toEqual(
        [],
      );
    });

    /**
     * union 경로에도 면제가 있다. 이 캐너리가 없으면 `visitUnion` 의 `allowUndeclared`
     * 분기를 통째로 지워도 스펙이 전부 통과한다 — 실측으로 확인했다
     * (`review/code/2026/09/05/15_12_02` INFO#1).
     */
    it('allowUndeclared 는 union 아래에서도 먹는다', () => {
      const payload = { id: 'x', context: { aOnly: 'a', wrapper: 1 } };
      expect(kinds(findContractViolations(payload, union))).toEqual([
        'context.wrapper:undeclared',
      ]);
      expect(
        findContractViolations(payload, union, {
          allowUndeclared: ['context.wrapper'],
        }),
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

/**
 * `contractForDto` 메모이제이션 — 설계 근거("호출마다 Nest 모듈을 부트스트랩하므로
 * 캐시한다", "실패는 캐시에 남기지 않는다")를 실제로 고정한다. 종전에는 근거만 있고
 * 검증이 없었다 (`review/code/2026/09/05/18_23_02` W4).
 */
describe('contractForDto 메모이제이션', () => {
  class MemoProbeDto {
    @ApiProperty()
    id: string;
  }

  it('같은 DTO 는 같은 promise 를 돌려준다 — 두 번 부트스트랩하지 않는다', () => {
    const a = contractForDto(MemoProbeDto);
    const b = contractForDto(MemoProbeDto);
    expect(a).toBe(b);
    return a.then((c) => expect(c.name).toBe('MemoProbeDto'));
  });

  it('해소된 뒤에도 같은 계약을 돌려준다', async () => {
    const first = await contractForDto(MemoProbeDto);
    const second = await contractForDto(MemoProbeDto);
    expect(second).toBe(first);
  });

  /**
   * **실패는 캐시에 남기지 않는다** — JSDoc 이 내세우는 계약인데 종전 테스트 2건은 전부
   * 성공 경로만 봐서, `catch` 의 `contractCache.delete` 를 지워도 GREEN 이었다
   * (`review/code/2026/09/05/20_45_37` W4).
   *
   * 실패는 **클래스가 아닌 값**으로 만든다 — 프로브 컨트롤러가 어떤 DTO 도 참조하지 않아
   * `schemaOf` 가 던진다. (빈 클래스는 스키마가 생겨서 **안 던진다** — 실측으로 확인했다.)
   */
  it('실패한 promise 는 캐시에 남지 않는다 — 다시 부르면 새로 시도한다', async () => {
    const notADto = {} as never;

    const firstAttempt = contractForDto(notADto);
    await expect(firstAttempt).rejects.toThrow();

    const secondAttempt = contractForDto(notADto);
    // 캐시에 남았다면 **같은** promise 를 돌려받는다 — 그러면 원인이 사라져도 낫지 않는다.
    expect(secondAttempt).not.toBe(firstAttempt);
    await expect(secondAttempt).rejects.toThrow();
  });
});
