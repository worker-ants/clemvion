import { describe, it, expect } from '@jest/globals';
import * as path from 'node:path';

import { collectTsFiles } from '../../common/__test-utils__/source-scan';
import {
  countIdShapedParams,
  findUuidParamViolations,
} from './param-uuid-pipe-guard';

/**
 * 컨트롤러의 **id-형 경로 파라미터**가 UUID 계약 두 축을 다 갖췄는지 조인다.
 *
 * ## 왜 이 가드인가 — 한 자리가 4개월간 조용히 달랐다
 *
 * `rotateBotToken` 만 `@Param('id')` 였다. 비-UUID 가 들어오면 그 값이 `findById` 까지 흘러
 * Postgres 가 SQLSTATE **22P02** 로 거부하는데, `GlobalExceptionFilter` 는 `HttpException` ·
 * http-error-like · unique-violation(23505) 세 갈래만 분기하므로 **500 INTERNAL_ERROR 로
 * 마스킹**된다 — 클라이언트 입력 오류가 서버 장애로 보인다. `common/utils/uuid.ts` 와
 * `common/utils/workspace-context.util.ts` 가 같은 사슬을 이미 적어 두었지만, **그 사슬을 아는
 * 것과 모든 자리에 적용되는 것은 다른 문제**였다.
 *
 * 컴파일도 테스트도 이 결함을 못 본다: `triggers.controller.spec.ts` 는
 * `new TriggersController(...)` 직접 생성이라 **파이프가 아예 실행되지 않는다**. 즉 이 저장소가
 * 질 수 있는 책임은 *"선언이 있는가"* 이고, 그것은 정적으로 셀 수 있다.
 *
 * ## 두 축을 함께 센다 — 절반만 닫으면 나머지 절반이 조용하다
 *
 * `spec/conventions/swagger.md` §5-4 의 한 조항이 두 가지를 요구한다:
 *
 * | 축 | 무엇을 지키나 | 빠지면 |
 * |---|---|---|
 * | `@Param('id', ParseUUIDPipe)` | 런타임 400 차단 | 500 마스킹 |
 * | `@ApiParam({ format: 'uuid' })` | 생성된 OpenAPI 의 형식 광고 | 문서가 계약보다 느슨 |
 *
 * 처음엔 파이프 축만 세려 했는데 `--impl-prep` convention_compliance WARNING 이
 * *"같은 조항의 절반만 겨냥한다"* 고 지적했다. 실측하니 문서 축 미충족이 **3건**이었다 —
 * 파이프 축(1건)만 닫았으면 나머지 둘이 남았을 것이다.
 *
 * ## 베이스라인은 0이다 — 동결 목록을 두지 않는다
 *
 * 실측 시점(2026-09-12) 위반 3건을 **전부 고쳐서** 0으로 만들었다:
 * `rotateBotToken`(두 축) · `switchWorkspace`(문서 축 — `format` 키만 없었다) ·
 * `simulateExecutionRunRedeliveryForTest`(문서 축). 셋째는 `@ApiExcludeEndpoint()` 라
 * OpenAPI 에 실리지 않으므로 **목록이 아니라 구조로** 면제한다 — 판정 함수가 그 데코레이터를
 * 직접 본다. 목록이 없으면 위반이 생기는 순간 실패하고, 통과시키려면 이 단언 자체를 지워야 해
 * diff 에 남는다.
 */
describe('경로 UUID 파라미터 계약 가드', () => {
  const SRC_ROOT = path.resolve(__dirname, '..', '..');
  // **`src` 전체가 아니라 `modules` 만 본다.** 실측: `*.controller.ts` 35개가 전부
  // `modules/` 아래에 있고, 이 파일의 대조군 fixture 는 `repo-guards/` 아래에 있다.
  const SCAN_ROOT = path.join(SRC_ROOT, 'modules');
  const files = collectTsFiles(SCAN_ROOT);

  it('스캔 대상이 비어 있지 않다 (vacuous 방지)', () => {
    // 경로가 어긋나 0건을 스캔하면 아래 단언이 **아무것도 검사하지 않고** 통과한다.
    const controllers = files.filter((f) => f.endsWith('.controller.ts'));
    expect(controllers.length).toBeGreaterThan(30);
    // 파일은 있는데 파라미터를 하나도 못 읽는 경우(파서 오작동)도 같은 공허함이다.
    expect(countIdShapedParams(files)).toBeGreaterThan(100);
  });

  it("id-형 경로 파라미터는 ParseUUIDPipe 와 @ApiParam({format:'uuid'}) 를 모두 갖는다", () => {
    // **실패 메시지를 값에 싣는다.** jest 의 `expect` 는 두 번째 인자를 받지 않으므로
    // (vitest 와 다르다), 무엇을 고쳐야 하는지는 비교 대상 자체가 말하게 한다.
    const violations = findUuidParamViolations(files, SRC_ROOT).map(
      (v) =>
        `${v.file} ${v.method}() @Param('${v.param}') — 빠짐: ${v.missing.join(' · ')}`,
    );
    expect(violations).toEqual([]);
  });

  describe('[대조군] 판정 함수가 실제로 가른다', () => {
    const FIXTURE_DIR = path.join(__dirname, 'fixtures', 'param-uuid-pipe');
    const fixtures = collectTsFiles(FIXTURE_DIR);
    const found = findUuidParamViolations(fixtures, FIXTURE_DIR);
    const key = (v: (typeof found)[number]): string =>
      `${v.method}:${v.missing.join('+')}`;

    it('세 형태의 위반을 각각 다른 사유로 잡는다', () => {
      expect(found.map(key).sort()).toEqual([
        "bare:ParseUUIDPipe+@ApiParam format:'uuid'",
        'pipeless:ParseUUIDPipe',
        "undocumented:@ApiParam format:'uuid'",
      ]);
    });

    it('두 축을 갖춘 자리·비-id 이름·인자 없는 @Param 은 안 잡는다', () => {
      const clean = ['ok', 'instantiated', 'nonIdShaped', 'whole'];
      expect(found.filter((v) => clean.includes(v.method))).toEqual([]);
    });

    it('@ApiExcludeEndpoint 핸들러는 문서 축을 면제받는다 (런타임 축은 아니다)', () => {
      // fixture 의 `excluded` 는 파이프가 있고 `@ApiParam` 이 없다 — 면제가 작동하면 0건.
      expect(found.filter((v) => v.method === 'excluded')).toEqual([]);
    });

    it('AST 로 읽는다 — 주석·문자열 속 `@Param` 은 안 센다', () => {
      // fixture 하단의 decoy 두 개가 세어졌다면 `decoy*` 이름이 위에 나타난다.
      expect(
        found.map((v) => v.method).filter((m) => m.startsWith('decoy')),
      ).toEqual([]);
    });
  });
});
