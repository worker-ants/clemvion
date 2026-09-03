// `resolveTriggerParameters` 직접 호출부 허용목록 가드 — 스캔·판정 순수 로직.
//
// 소비처는 형제 파일 `masked-reject-callers.spec.ts`. 배경·근거는 그 파일 헤더에 있다.
// 파서 순수 로직과 소비 spec 을 분리하는 규약은 형제 가드
// `eslint-unicorn-peer-guard.ts` · frontend `typescript-toolchain-guard.ts` 와 동일하다.

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as ts from 'typescript';
import { collectTsFiles } from '../../common/__test-utils__/source-scan';

/** base 함수 — 마커 거부를 **하지 않는다**. */
export const BASE_FN = 'resolveTriggerParameters';

/**
 * base 함수를 직접 import 해도 되는 파일(저장소 루트 기준 상대 경로).
 *
 * - **wrapper 자신** — 감싸는 쪽이라 당연히 부른다.
 * - **webhook · schedule** — 외부 시스템이 저작하는 페이로드라 마커 리터럴이 정상 값일 수
 *   있다(EIA §R17 범위 캐비엇). 의도적으로 거부 대상이 아니다.
 * - **base 모듈 자신**과 그 테스트.
 *
 * > **Manual 실행 경로는 여기 없다.** 그쪽은
 * > `resolveTriggerParametersRejectingMasked` 를 써야 한다.
 */
export const ALLOWED_DIRECT_CALLERS: readonly string[] = [
  // wrapper 자신 — 감싸는 쪽이라 당연히 부른다.
  'codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts',
  // (wrapper 의 spec 은 wrapper 만 import 하므로 여기 없다 — 죽은 항목 캐너리가 잡아 뺐다.)
  // base 모듈 자신 — **선언**부다. AST 는 `export function resolveTriggerParameters` 의
  // 이름도 식별자로 보므로(정규식 판정에는 없던 유일한 동작 변화) 여기 등재한다.
  // "선언은 사용이 아니다" 를 파서로 가르는 대신 목록 한 줄로 두는 편이 읽기 쉽다.
  'codebase/backend/src/modules/execution-engine/utils/resolve-trigger-parameters.ts',
  // base 모듈의 자기 테스트.
  'codebase/backend/src/modules/execution-engine/utils/resolve-trigger-parameters.spec.ts',
  // 스키마 로더 테스트 — 로더가 만든 스키마를 base 로 검증한다(Manual 경로 아님).
  'codebase/backend/src/modules/execution-engine/utils/load-trigger-parameter-schema.spec.ts',
  // 외부 시스템이 저작하는 페이로드 — 마커 리터럴이 정상 값일 수 있다(EIA §R17).
  'codebase/backend/src/modules/hooks/hooks.service.ts',
  'codebase/backend/src/modules/schedules/schedule-runner.service.ts',
  // 이 가드 자신과 형제 spec 은 **여기 없다** — 이름을 상수·픽스처 *문자열*로 들고 있을
  // 뿐이라 파서가 식별자로 보지 않는다. 초판(정규식)은 JSDoc 안의 import 예시까지 잡아 두
  // 파일을 여기 얹었는데, 그건 오판을 허용목록으로 은폐한 것이었다(`02_04_38` W1).
  // AST 전환으로 그 오판의 원인 자체가 사라졌다 — 주석·문자열은 애초에 식별자가 아니다.
];

/** `src/` 하위 `.ts` 전수 (node_modules·dist 제외). */
export function listSourceFiles(rootDir: string): string[] {
  // `includeSpec` — 테스트 코드가 base 함수를 직접 부르는 것도 잡아야 한다.
  // 그래서 위 허용목록에 `*.spec.ts` 항목이 실제로 들어 있다.
  return collectTsFiles(rootDir, { includeSpec: true });
}

/**
 * `resolveTriggerParameters` 를 **코드에서 쓰는** 파일인가.
 *
 * ## 왜 "언급" 이 아니라 "사용" 인가
 *
 * 초판은 이름이 등장하기만 하면 잡았는데, 실측하니 **9곳 중 5곳이 주석·설명 문자열**이었다
 * (`manual-trigger.handler.ts` 의 `{@link ...}`, `re-run.dto.ts` 의 swagger description 등).
 * 그런 파일을 허용목록에 넣으면 목록이 실제 위험과 무관해지고, 가드가 지키는 대상이
 * 흐려진다.
 *
 * `resolveTriggerParametersRejectingMasked` 는 **접두가 같다** — 둘을 가르지 못하면 wrapper
 * 만 쓰는 파일이 base 사용으로 오인되고, 그러면 올바른 코드가 RED 를 내 가드 자체가
 * 무시된다.
 *
 * ## 정규식을 버리고 AST 로 갔다 (`03_14_16` security W1)
 *
 * 초판은 named import 만 봤고, 라운드마다 우회 형태를 하나씩 덧대 왔다. `03_14_16` 에서
 * **네 번째** 같은 결함 클래스가 나왔다 — 무수정 프로브 실측:
 *
 * | 형태 | 정규식 판정 |
 * |---|---|
 * | `import { resolveTriggerParameters } from '…'` | 탐지 |
 * | `import { resolveTriggerParameters as fn } from '…'` | 탐지 |
 * | `import * as b` + `b.resolveTriggerParameters(…)` | 탐지 |
 * | `const { resolveTriggerParameters } = require('…')` | 탐지 |
 * | `const { resolveTriggerParameters } = await import('…')` | **미탐지** |
 * | `b['resolveTriggerParameters'](…)` | **미탐지** |
 * | `const { resolveTriggerParameters: fn } = require('…')` | **미탐지** |
 *
 * 이 함수의 옛 주석은 *"판정 대상이 import 문 하나라 문법 표면이 좁다"* 고 단언했다.
 * **그 단언이 네 번 반증됐다** — 표면은 좁지 않다. 형태를 하나씩 덧대는 한 다음 라운드에
 * 다섯 번째가 나온다.
 *
 * 그래서 패치가 아니라 **설계를 뒤집었다.** `typescript` 는 backend 직접 의존성(5.9.3)이고
 * TS 소스에는 **정본 파서**가 있다 — 정규식이 이기는 쪽(문법도 파서도 없는 셸 명령 같은
 * 대상)이 아니다. 판정 기준은 두 줄로 줄었다:
 *
 * 1. **식별자 위치**의 `BASE_FN` — named import·`as` 리네임·구조분해 `propertyName`·멤버
 *    접근·직접 호출이 전부 여기 하나로 모인다. 주석과 문자열은 애초에 식별자가 아니라서
 *    `stripCommentsAndStrings` 라는 보정 장치 자체가 사라졌다(`02_04_38` W1 의 원인도 같이).
 * 2. **element access 의 문자열 인자** — `b['resolveTriggerParameters']` 는 문자열이지만
 *    코드다. 파서가 그 자리를 알려주므로 "코드인 문자열" 만 정확히 고를 수 있다.
 *
 * 접두 겹침(`resolveTriggerParametersRejectingMasked`)도 공짜로 해결된다 — 파서에게 그건
 * **다른 식별자**다. 단어 경계를 손으로 맞출 일이 없어졌다.
 */
export function importsBaseFn(source: string): boolean {
  // 값싼 선별 — 이름이 문자열로조차 없으면 어떤 AST 노드도 가질 수 없다. 파싱을 건너뛴다.
  // blind substring 이라 **과대 포함만** 가능하다(위음성 없음) — 판정은 아래 파서가 한다.
  if (!source.includes(BASE_FN)) return false;

  const sourceFile = ts.createSourceFile(
    'probe.ts',
    source,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ false,
  );

  let found = false;
  const visit = (node: ts.Node): void => {
    if (found) return;
    if (ts.isIdentifier(node) && node.text === BASE_FN) {
      found = true;
      return;
    }
    if (
      ts.isElementAccessExpression(node) &&
      ts.isStringLiteralLike(node.argumentExpression) &&
      node.argumentExpression.text === BASE_FN
    ) {
      found = true;
      return;
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sourceFile, visit);
  return found;
}

/** 허용목록 밖에서 base 를 직접 쓰는 파일들(저장소 루트 상대 경로, 정렬). */
export function findUnexpectedCallers(
  repoRoot: string,
  srcDir: string,
): string[] {
  return listSourceFiles(srcDir)
    .filter((f) => importsBaseFn(fs.readFileSync(f, 'utf8')))
    .map((f) => path.relative(repoRoot, f).split(path.sep).join('/'))
    .filter((rel) => !ALLOWED_DIRECT_CALLERS.includes(rel))
    .sort();
}
