import { describe, it, expect } from '@jest/globals';
import * as path from 'node:path';

import { collectTsFiles } from '../../common/__test-utils__/source-scan';
import { scanUuidParams } from './param-uuid-pipe-guard';

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
 * | 축 | 무엇을 지키나 | 빠지면 | 출처 |
 * |---|---|---|---|
 * | `@Param('id', ParseUUIDPipe)` | 런타임 400 차단 | 500 마스킹 | **저장소 실측 관례** |
 * | `@ApiParam({ format: 'uuid' })` | 생성된 OpenAPI 의 형식 광고 | 문서가 계약보다 느슨 | `swagger.md §5-4` |
 *
 * 처음엔 파이프 축만 세려 했는데 `--impl-prep` convention_compliance WARNING 이
 * *"같은 조항의 절반만 겨냥한다"* 고 지적했다. 실측하니 문서 축 미충족이 **3건**이었다 —
 * 파이프 축(1건)만 닫았으면 나머지 둘이 남았을 것이다.
 *
 * > **출처 칸을 나눈 이유 (`20_01_18` requirement·documentation 공통 SPEC-DRIFT).**
 * > 처음엔 두 축 다 *"`swagger.md §5-4` 가 요구한다"* 고 적었는데, 그 문서에
 * > `ParseUUIDPipe` 는 **0건**이고 §5-4 체크리스트는 `@ApiParam({format:'uuid'})` 한 줄뿐이다.
 * > 런타임 축은 spec 조항이 아니라 **실측 관례를 가드로 승격한 것**이다 — 그렇게 적는다.
 * > (§5-4 를 넓히는 것은 planner 소관이라 별 건으로 등재했다.)
 *
 * ## 베이스라인은 0이다 — 동결 목록을 두지 않는다
 *
 * 실측 시점(2026-09-12) 위반 3건을 **전부 처리해** 0으로 만들었다 — 둘은 고쳤고 하나는
 * 구조로 면제했다: `rotateBotToken`(두 축 추가) · `switchWorkspace`(문서 축 — `format` 키만
 * 없었다) · `simulateExecutionRunRedeliveryForTest`(**코드를 고치지 않았다** —
 * `@ApiExcludeEndpoint()` 라 OpenAPI 에 실리지 않으므로 판정 함수가 그 데코레이터를 보고
 * 문서 축을 묻지 않는다). 셋을 "전부 고쳤다" 로 뭉뚱그리면 셋째의 처리 방식이 가려진다
 * (`20_53_01` documentation INFO). 목록이 없으면 위반이 생기는 순간 실패하고, 통과시키려면 이 단언 자체를 지워야 해
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
    // **판정과 같은 순회가 센 값**이라 조건이 갈릴 여지가 없다 — 이 보장은 구조적이고,
    // 뮤테이션으로는 확인되지 않는다(`scanned` 를 상수로 고정하면 floor 는 통과한다. 예측
    // GREEN·실측 GREEN). floor 가 잡는 것은 *"아무것도 안 셌다"* 이지 *"거짓말하는 카운터"*
    // 가 아니다 — 후자를 막는 것은 두 값이 같은 루프에서 나온다는 사실이다.
    expect(scanUuidParams(files, SRC_ROOT).scanned).toBeGreaterThan(100);
  });

  it("id-형 경로 파라미터는 ParseUUIDPipe 와 @ApiParam({format:'uuid'}) 를 모두 갖는다", () => {
    // **실패 메시지를 값에 싣는다.** jest 의 `expect` 는 두 번째 인자를 받지 않으므로
    // (vitest 와 다르다), 무엇을 고쳐야 하는지는 비교 대상 자체가 말하게 한다.
    const violations = scanUuidParams(files, SRC_ROOT).violations.map(
      (v) =>
        `${v.file} ${v.method}() @Param('${v.param}') — 빠짐: ${v.missing.join(' · ')}`,
    );
    expect(violations).toEqual([]);
  });

  describe('[대조군] 판정 함수가 실제로 가른다', () => {
    const FIXTURE_DIR = path.join(__dirname, 'fixtures', 'param-uuid-pipe');
    const fixtures = collectTsFiles(FIXTURE_DIR);
    const found = scanUuidParams(fixtures, FIXTURE_DIR).violations;
    const key = (v: (typeof found)[number]): string =>
      `${v.method}:${v.missing.join('+')}`;

    it('세 형태의 위반을 각각 다른 사유로 잡는다', () => {
      expect(found.map(key).sort()).toEqual([
        "bare:ParseUUIDPipe+@ApiParam format:'uuid'",
        'excludedPipeless:ParseUUIDPipe',
        'pipeless:ParseUUIDPipe',
        "undocumented:@ApiParam format:'uuid'",
      ]);
    });

    it('두 축을 갖춘 자리·비-id 이름·인자 없는 @Param 은 안 잡는다', () => {
      const clean = ['ok', 'instantiated', 'nonIdShaped', 'whole'];
      expect(found.filter((v) => clean.includes(v.method))).toEqual([]);
    });

    it('@ApiExcludeEndpoint 핸들러는 문서 축을 면제받는다', () => {
      // fixture 의 `excluded` 는 파이프가 있고 `@ApiParam` 이 없다 — 면제가 작동하면 0건.
      expect(found.filter((v) => v.method === 'excluded')).toEqual([]);
    });

    it('그 면제가 런타임 축까지 끄지는 않는다 (반대 방향 캐너리)', () => {
      // 위 케이스만으로는 "문서 축만 끄는가 / 판정 전체를 끄는가" 를 가를 수 없다 —
      // 둘 다 0건이 나온다. `excludedPipeless` 는 파이프가 없으므로 **파이프 축만** 남아야
      // 하고, 면제가 넓어지면 이 단언이 빈 배열을 받아 RED 다.
      expect(
        found
          .filter((v) => v.method === 'excludedPipeless')
          .map((v) => v.missing),
      ).toEqual([['ParseUUIDPipe']]);
    });

    it('AST 로 읽는다 — 주석·문자열 속 `@Param` 은 안 센다', () => {
      // fixture 하단의 decoy 두 개가 세어졌다면 `decoy*` 이름이 위에 나타난다.
      expect(
        found.map((v) => v.method).filter((m) => m.startsWith('decoy')),
      ).toEqual([]);
    });
  });
});
