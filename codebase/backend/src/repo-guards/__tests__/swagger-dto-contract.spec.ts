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

import * as fs from 'node:fs';
import * as path from 'node:path';

import { collectTsFiles } from '../../common/__test-utils__/source-scan';
import { withFixture } from '../../common/__test-utils__/temp-fixture';
import {
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
});
