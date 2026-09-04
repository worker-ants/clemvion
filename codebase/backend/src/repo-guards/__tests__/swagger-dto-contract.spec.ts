/**
 * Swagger DTO 선언이 TS 타입과 **같은 말**을 하는지.
 *
 * ## 왜 필요한가 — OpenAPI 가 계약을 숨긴다
 *
 * `@ApiPropertyOptional` 은 `ApiProperty({ required: false })` 의 별칭이다
 * (`@nestjs/swagger` 구현). 그래서 상시 존재하는 `T | null` 응답 필드에 그것을 쓰면
 * 생성된 OpenAPI 가 **두 가지를 동시에 감춘다** — 키가 항상 온다는 것과, 값이 `null` 일 수
 * 있다는 것. 생성기를 쓰는 소비자는 "없을 수도 있지만 null 은 아닌 필드" 로 코드를 짠다.
 *
 * 반대 방향도 있다. `nullable: true` 를 선언해 놓고 TS 타입이 `string` 이면, `null` 을 보낸
 * 클라이언트의 값이 `string` 슬롯에 들어앉는다 — `create-assistant-session.dto.ts` 의
 * `llmConfigId` 가 정확히 그랬다. **자매 DTO(`update-...`)는 같은 필드를 `string | null` 로
 * 맞게 선언하고 있었다.**
 *
 * ## 어떤 게이트도 이 자리를 안 본다
 *
 * `tsc` 는 데코레이터 인자를 타입으로 읽지 않는다. lint 규칙도 없다. e2e 는 실제 응답만
 * 보므로 **문서와 타입이 함께 틀려도 초록**이다. 규약(`spec/5-system/2-api-convention.md`
 * §5.4)이 문장으로만 있고 강제자가 없었다.
 *
 * ## 이 가드가 `.claude/tests/` 가 아니라 여기 있는 이유
 *
 * `harness-checks.yml` 의 `changes.pathspecs` 는 `codebase/backend/**` 를 덮지 않는다 —
 * backend 소스만 고친 PR 에서 그 워크플로가 안 돌아 가드가 발화하지 못한다. 스캔 대상이
 * 있는 곳에서 돌아야 한다: `backend-checks.yml` 이 `codebase/backend/**` 를 덮는다.
 * (형제 가드 `nullable-type-lie-cast.spec.ts` 와 같은 판단.)
 */

import 'reflect-metadata';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { ApiProperty, ApiPropertyOptional, DECORATORS } from '@nestjs/swagger';

import { collectTsFiles } from '../../common/__test-utils__/source-scan';
import {
  withFiles,
  withFixture,
} from '../../common/__test-utils__/temp-fixture';
import {
  findNumericAsNumber,
  findSwaggerContractMismatches,
  type ContractMismatch,
} from './swagger-dto-contract-guard';

const SRC_ROOT = path.resolve(__dirname, '..', '..');

/** 픽스처 한 덩어리를 판정한다. */
function judge(source: string): ContractMismatch[] {
  return withFixture(
    source,
    (file) => findSwaggerContractMismatches([file], path.dirname(file)),
    'probe.dto.ts',
  );
}

const axes = (source: string): string[] =>
  judge(source)
    .map((m) => m.axis)
    .sort();

describe('Swagger DTO 선언 vs TS 타입', () => {
  const files = collectTsFiles(SRC_ROOT);

  it('[전제] 스캔 대상이 비어 있지 않다 — 비면 아래 단언이 공허하다', () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it('[전제] 스캔 대상에 Api* 데코레이터가 실제로 있다 — 없으면 공허하다', () => {
    const withApi = files.filter((f) =>
      /@ApiProperty(Optional)?\(/.test(fs.readFileSync(f, 'utf8')),
    );
    expect(withApi.length).toBeGreaterThan(20);
  });

  it('OpenAPI 선언과 TS 타입이 어긋난 필드가 없다', () => {
    expect(findSwaggerContractMismatches(files, SRC_ROOT)).toEqual([]);
  });

  describe('[대조군] presence 축 — required vs `?`', () => {
    it('required:false 인데 TS 가 상시 존재면 잡는다', () => {
      expect(
        axes(`class D { @ApiPropertyOptional() finishedAt: string; }`),
      ).toEqual(['presence']);
    });

    it('required 인데 TS 가 optional 이면 잡는다', () => {
      expect(axes(`class D { @ApiProperty() name?: string; }`)).toEqual([
        'presence',
      ]);
    });

    it('둘이 맞으면 안 잡는다 — 양방향', () => {
      expect(axes(`class D { @ApiProperty() name: string; }`)).toEqual([]);
      expect(axes(`class D { @ApiPropertyOptional() name?: string; }`)).toEqual(
        [],
      );
    });

    /**
     * 저장소에 `@ApiProperty({ required: false })` 가 9곳 있고 출력은
     * `@ApiPropertyOptional()` 과 **완전히 같다**. 데코레이터 이름만 보면 그 9곳이 전부
     * 오탐이 된다 — 실제로 처음 센 정규식이 그렇게 틀렸다.
     */
    it('인자의 required 가 데코레이터 이름을 이긴다', () => {
      expect(
        axes(`class D { @ApiProperty({ required: false }) name?: string; }`),
      ).toEqual([]);
      expect(
        axes(
          `class D { @ApiPropertyOptional({ required: true }) name: string; }`,
        ),
      ).toEqual([]);
    });
  });

  describe('[대조군] null 축 — nullable vs `| null`', () => {
    it('TS 가 `| null` 인데 nullable 미선언이면 잡는다', () => {
      expect(
        axes(`class D { @ApiProperty() nextCursor: string | null; }`),
      ).toEqual(['null']);
    });

    it('nullable 선언인데 TS 가 null 불가면 잡는다 — 반대 방향', () => {
      expect(
        axes(
          `class D { @ApiPropertyOptional({ nullable: true }) llmConfigId?: string; }`,
        ),
      ).toEqual(['null']);
    });

    it('둘이 맞으면 안 잡는다', () => {
      expect(
        axes(
          `class D { @ApiProperty({ nullable: true }) nextCursor: string | null; }`,
        ),
      ).toEqual([]);
    });

    /**
     * 정규식이 틀렸던 형태 ①. `[^;=]+?` 가 객체 리터럴 타입 안의 첫 `;` 에서 멈춰
     * `lastError?: { code?: string` 으로 잘렸고, `| null` 이 사라져 **맞는 필드를 틀렸다고**
     * 보고했다. 저장소의 `integration-response.dto.ts` 가 실제로 이 형태다.
     */
    it('객체 리터럴 타입 안의 `;` 에 속지 않는다', () => {
      expect(
        axes(
          `class D { @ApiPropertyOptional({ nullable: true }) lastError?: { code?: string; message?: string } | null; }`,
        ),
      ).toEqual([]);
    });

    /**
     * 중첩된 `null` 은 그 필드가 nullable 이라는 뜻이 아니다. 저장소의
     * `integration-response.dto.ts` `meta` 가 `{ appType: 'public' | 'private' | null }` 로
     * 정확히 이 형태다 — 문자열 `.includes('null')` 이나 `split('|')` 로는 못 가른다.
     */
    it('중첩된 null 은 최상위 null 이 아니다', () => {
      expect(
        axes(`class D { @ApiProperty() meta: { appType: 'public' | null }; }`),
      ).toEqual([]);
    });

    /**
     * 정규식이 틀렸던 형태 ②. `.*?\)` 가 `() =>` 의 `)` 에서 멈춰 뒤쪽 인자를 못 읽었다.
     */
    it('인자 안의 화살표 함수 뒤에 오는 옵션도 읽는다', () => {
      expect(
        axes(
          `class D { @ApiProperty({ type: () => [Other], nullable: true }) items: Other[] | null; }`,
        ),
      ).toEqual([]);
    });
  });

  describe('[대조군] @Transform 예외', () => {
    /**
     * `@Transform` 은 wire 값과 인스턴스 값의 타입을 가른다. 쿼리스트링은 JSON `null` 을
     * 실을 수 없으므로 OpenAPI 가 nullable 을 말하지 않는 것이 옳고, 변환 뒤 값이 `null` 일
     * 수 있으니 TS 가 `| null` 인 것도 옳다 — 두 문서가 **서로 다른 대상**을 기술한다.
     */
    it('null 축을 면제한다', () => {
      expect(
        axes(
          `class D { @ApiPropertyOptional() @Transform(({ value }) => (value === '' ? null : value)) workflowId?: string | null; }`,
        ),
      ).toEqual([]);
    });

    /** presence 는 면제하지 않는다 — `@Transform` 은 키의 존재 여부를 바꾸지 않는다. */
    it('presence 축은 면제하지 않는다', () => {
      expect(
        axes(
          `class D { @ApiPropertyOptional() @Transform(({ value }) => value) name: string; }`,
        ),
      ).toEqual(['presence']);
    });
  });

  it('Api* 데코레이터가 없는 필드는 판정 대상이 아니다', () => {
    expect(axes(`class D { plain?: string | null; }`)).toEqual([]);
  });

  it('한 필드가 두 축 모두 어긋나면 둘 다 보고한다', () => {
    expect(
      axes(`class D { @ApiPropertyOptional() finishedAt: string | null; }`),
    ).toEqual(['null', 'presence']);
  });

  /**
   * ## 실패 위치(`line`/`file`) 자체는 어떤 판정 테스트도 검증하지 않았다 (리뷰 W5)
   *
   * 위 대조군들은 전부 `axes()` 로 `axis` 만 뽑아 비교한다 — 가드가 실제로 offender 를
   * 보고할 때 개발자가 보는 `ContractMismatch.line`/`.file` 이 맞는지는 무방비였다.
   * `judge()` 원본(`ContractMismatch[]`)을 직접 단언해 이 자리를 고정한다.
   *
   * `node.getStart(sf)` 는 데코레이터를 포함한 위치를 돌려준다 — 프로퍼티 이름이 아니라
   * **데코레이터 줄**이 `line` 이 된다(2026-09-04 실측, `ts.PropertyDeclaration.getStart`).
   * 그래서 픽스처는 그 둘이 다른 줄이 되도록 일부러 나눠 썼다 — 같은 줄이면 이 구분을
   * 못 잡는다.
   */
  describe('[대조군] 실패 위치(line/file) 보고', () => {
    it('데코레이터가 있는 줄과 파일명을 정확히 돌려준다', () => {
      const source = [
        '',
        'class D {',
        '  @ApiPropertyOptional()',
        '  finishedAt: string;',
        '}',
        '',
      ].join('\n');
      const mismatches = judge(source);
      expect(mismatches).toHaveLength(1);
      expect(mismatches[0]).toMatchObject({
        file: 'probe.dto.ts',
        line: 3,
        field: 'finishedAt',
        axis: 'presence',
      });
    });
  });
});

/**
 * ## `effectiveRequired` 는 `@nestjs/swagger` 비공개 구현에 하드 커플링돼 있다 (리뷰 W1)
 *
 * `swagger-dto-contract-guard.ts` 의 판정 근거: `ApiPropertyOptional` 은
 * `ApiProperty({ required: false })` 의 **별칭**이다 — 이 라이브러리의 소스(`ApiPropertyOptional`
 * 구현, `dist/decorators/api-property.decorator.js`)를 열어 확인한 사실이지, 공개된 타입 계약이
 * 아니다. 별칭 관계가 바뀌면(예: 다음 메이저가 `required` 를 다른 메타데이터 키로 옮기면)
 * `effectiveRequired` 계산이 조용히 틀린 값을 낸다 — 그런데 가드의 다른 테스트는 전부
 * "가드가 그렇다고 가정한 값" 만 재확인할 뿐, 그 가정 자체를 라이브러리에 물어본 적이 없다.
 *
 * 이 캐너리는 **실제 `@nestjs/swagger` 데코레이터를 호출**해 `Reflect` 메타데이터를 읽는다 —
 * 별칭을 없앨 수는 없다(§5.4 규약과 이 가드 판정의 토대이므로). 대신 그 가정이 깨지는 순간
 * 여기서 먼저 RED 가 된다: 라이브러리를 업그레이드했는데 이 테스트가 실패하면, 원인은
 * `swagger-dto-contract-guard.ts` 가 아니라 `ApiPropertyOptional` 의 별칭 구현이 바뀐 것이다.
 */
describe('[캐너리] @nestjs/swagger 별칭 가정이 살아있는가', () => {
  it('ApiPropertyOptional() 은 실제로 ApiProperty({ required: false }) 와 같은 required 메타데이터를 남긴다', () => {
    class Probe {
      @ApiPropertyOptional()
      viaAlias?: string;

      @ApiProperty({ required: false })
      viaExplicit?: string;
    }

    const read = (key: string) =>
      Reflect.getMetadata(
        DECORATORS.API_MODEL_PROPERTIES,
        Probe.prototype,
        key,
      ) as { required?: boolean } | undefined;

    expect(read('viaAlias')?.required).toBe(false);
    expect(read('viaAlias')?.required).toBe(read('viaExplicit')?.required);
  });
});

/**
 * ## `numeric` 컬럼을 `number` 라고 문서화하는 자리
 *
 * TypeORM 은 `numeric`/`decimal` 을 **문자열**로 준다(정밀도 보존). 엔티티를 그대로
 * 내보내는 응답 DTO 가 그 필드를 `number` 라고 하면 **OpenAPI 가 wire 와 다른 말을 한다.**
 *
 * 위 두 축(presence·null)은 이것을 **구조적으로 못 본다** — 둘 다 원시 타입 차이를 보지
 * 않기 때문이다. 2026-09-04 에 `AlertRuleDto.threshold` 가 정확히 그 사각지대에 있었다.
 */
describe('numeric 컬럼을 number 로 문서화한 응답 DTO', () => {
  it('저장소에 그런 자리가 없다', () => {
    expect(findNumericAsNumber(collectTsFiles(SRC_ROOT))).toEqual([]);
  });

  /**
   * 픽스처가 **중첩 경로**를 쓴다 — 이 술어는 `/entities/` 와 `/dto/responses/` 로 역할을
   * 가르므로, 평평한 tmpdir 파일로는 분류 자체가 성립하지 않아 단언이 공허해진다.
   * (`withFiles` 가 중첩 이름을 지원하도록 만든 이유가 이것이다.)
   */
  describe('[대조군] 술어가 실제로 무는가', () => {
    const ENTITY =
      "export class Probe {\n  @Column({ type: 'numeric', precision: 12, scale: 4 })\n  amount: string;\n}\n";

    it('numeric 컬럼인데 DTO 가 number 면 잡는다', () => {
      withFiles(
        {
          'entities/probe.entity.ts': ENTITY,
          'dto/responses/probe-response.dto.ts':
            'export class ProbeDto {\n  amount: number;\n}\n',
        },
        (paths) => {
          expect(findNumericAsNumber(Object.values(paths))).toEqual([
            { dto: 'ProbeDto', field: 'amount', entity: 'Probe' },
          ]);
        },
      );
    });

    it('DTO 가 string 이면 안 잡는다 — 정상 형태', () => {
      withFiles(
        {
          'entities/probe.entity.ts': ENTITY,
          'dto/responses/probe-response.dto.ts':
            'export class ProbeDto {\n  amount: string;\n}\n',
        },
        (paths) => {
          expect(findNumericAsNumber(Object.values(paths))).toEqual([]);
        },
      );
    });

    it('numeric 이 아닌 컬럼은 DTO 가 number 여도 안 잡는다', () => {
      withFiles(
        {
          'entities/probe.entity.ts':
            "export class Probe {\n  @Column({ type: 'int' })\n  amount: number;\n}\n",
          'dto/responses/probe-response.dto.ts':
            'export class ProbeDto {\n  amount: number;\n}\n',
        },
        (paths) => {
          expect(findNumericAsNumber(Object.values(paths))).toEqual([]);
        },
      );
    });
  });
});
