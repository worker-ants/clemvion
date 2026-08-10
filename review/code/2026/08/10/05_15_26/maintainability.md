# 유지보수성(Maintainability) Review

대상: `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts`,
`codebase/frontend/src/lib/docs/__tests__/plan-scan.ts`,
`codebase/frontend/src/lib/docs/__tests__/plan-scan.test.ts`

## 발견사항

- **[WARNING]** Gate C 판정 로직(`isGateCEnforced`/`hasMalformedStarted`/`hasValidSpecImpact`/`danglingSpecImpact`/`makeSpecExists`)이 `plan-scan.ts` 로 추출되지 않고 `spec-plan-completion.test.ts`(`*.test.ts`) 안에 production 로직으로 남아 있다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts:57`(`isGateCEnforced`), `:63`(`hasMalformedStarted`), `:68`(`hasValidSpecImpact`), `:96`(`danglingSpecImpact`), `:112`(`makeSpecExists`)
  - 상세: 같은 PR 이미 `checkPlanFrontmatter`/`findNonTerminalCompletedPlans`/`parseFrontmatterSafe`/`rawScalar`/`isIsoDate` 등 정확히 동일한 동기("negative-path fixture 로 위반 분기를 증명해야 한다", "판정 이중화 방지")로 `plan-scan.ts` 라는 non-test 모듈로 로직을 추출해 두었다(파일 자체 헤더 주석이 그 배경을 설명한다). 그런데 `spec-plan-completion.test.ts` 는 같은 근거(뮤테이션 실측으로 순수 함수화 필요성 확인)를 들면서도 정작 자신의 판정 함수들은 `plan-scan.ts` 로 옮기지 않고 테스트 파일 내부에 `export function` 으로 남겨 두었다. 결과적으로 "테스트 밖에서 부를 수 있는 순수 함수는 `plan-scan.ts` 에 둔다" 는 이 PR 이 세운 원칙이 자기 파일에는 적용되지 않아, 향후 다른 스크립트(예: pre-commit hook)가 Gate C 판정을 재사용하려면 `*.test.ts` 파일을 import 해야 하는 비정상적 의존이 생긴다(현재는 아무 곳도 import 하지 않아 실질 피해는 없지만, 관례 위반 자체가 다음 기여자에게 "어디에 로직을 두어야 하는가"에 대한 혼란을 준다).
  - 제안: `startedDate`/`isGateCEnforced`/`hasMalformedStarted`/`hasValidSpecImpact`/`danglingSpecImpact`/`makeSpecExists`(+ `GATE_C_CUTOFF`/`NONE_VALUES`)를 `plan-scan.ts` 로 이동하고, `spec-plan-completion.test.ts` 는 `plan-scan.test.ts` 가 `plan-scan.ts` 를 쓰는 것과 같은 패턴으로 import 해서 쓰도록 정리.

- **[INFO]** `GATE_C_CUTOFF`(`"2026-06-04T00:00:00Z"`) 값이 코드·`plan-lifecycle.md`·`spec-impl-evidence.md` 세 곳에 하드코딩되어 있고, `spec-impl-evidence.md:244` 가 "cutoff 값은 3곳 동시 갱신" 이라고 스스로 명시할 만큼 drift 위험이 인지되어 있다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts:30`
  - 상세: 3곳 동기화가 문서화는 되어 있으나 이를 강제하는 자동 검사(예: 한쪽 값을 읽어 나머지와 비교하는 테스트)는 없다. 셋 중 하나만 바뀌면 조용히 어긋난다.
  - 제안: 필수는 아니지만, 여유가 되면 두 마크다운의 cutoff 날짜를 코드 상수에서 문자열로 뽑아 assert 하는 캐너리 테스트 하나를 추가하면 drift 를 자동으로 잡을 수 있다.

- **[INFO]** `plans.length` 하한 가드에 근거 설명 없는 매직 넘버 `10` 사용.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts:161`
  - 상세: `toBeGreaterThan(10)` 은 "repoRoot 오탐지 → 빈 스캔 → vacuous pass" 를 막는 캐너리라는 목적은 주석에 있으나, 왜 정확히 10 인지(현재 plan 개수 대비 여유값 등)는 설명이 없다.
  - 제안: 상수로 빼거나 "실측 시점 N건, 여유 있게 10 으로 고정" 정도의 한 줄 근거를 덧붙이면 다음 사람이 임계값을 조정할 때 판단 근거가 남는다.

- **[INFO]** 동일 `block` 에 대해 `rawScalar(block, "started")` 가 두 개의 독립 경로(`startedDate` → `isGateCEnforced`, `hasMalformedStarted`)에서 각각 재호출된다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts:47-51`(`startedDate`), `:63-66`(`hasMalformedStarted`)
  - 상세: 기능적으로는 문제없고 정규식 1회 실행 비용도 무시할 만하지만, "단일 진입점"을 강조하는 이 파일의 철학과 미묘하게 어긋난다 — 두 predicate 가 같은 원시값을 각자 다시 추출한다. `parsedPlans.filter` 호출부(line 226)에서도 세 번째로 같은 raw 값을 별도로 다시 뽑는다(`hasMalformedStarted` 내부에서 1회 + 메시지 조립용 `rawScalar` 직접 호출 1회, line 227).
  - 제안: 필수 리팩터는 아니나, `rawScalar(block, "started")` 결과를 한 번만 뽑아 `startedDate`/`hasMalformedStarted` 양쪽에 넘기는 헬퍼로 합치면 "같은 값을 두 곳에서 각자 파생"하는 형태를 줄일 수 있다.

- **[INFO]** 테스트 fixture 작성 보일러플레이트(`fs.mkdirSync(dirname, {recursive:true}); fs.writeFileSync(...)`)가 `plan-scan.test.ts` 는 `write()` 헬퍼로 추출한 반면, 같은 디렉터리의 `spec-links.test.ts` 는 매 `it`/`beforeAll` 마다 인라인으로 반복한다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.test.ts:25-28`
  - 상세: 두 파일이 같은 패턴(임시 디렉터리에 합성 plan/spec 트리 심기)을 각자 다른 방식으로 구현하고 있어, `__tests__` 디렉터리 전반의 공유 fixture 유틸이 아직 없다는 신호다. 이번 PR 범위는 아니라 차단 사유는 아니다.
  - 제안: 여유가 될 때 `write()` 를 `__tests__` 공용 헬퍼 모듈로 승격해 `spec-links.test.ts` 등도 재사용하게 하면 좋다(이번 PR 필수는 아님).

## 요약

세 파일 모두 이미 다회 리뷰·뮤테이션 실측을 거친 성숙한 harness 코드로, 함수 길이·중첩 깊이·순환 복잡도는 전반적으로 낮고 네이밍(`has*`/`is*`/`find*`/`collect*`)도 일관적이며 "왜"를 설명하는 JSDoc/주석이 프로젝트 컨벤션(spec Rationale 문화)과 부합한다. 가장 눈에 띄는 구조적 아쉬움은 `spec-plan-completion.test.ts` 가 같은 PR 이 방금 확립한 "판정 로직은 `plan-scan.ts` 로 추출" 원칙을 자기 자신에는 적용하지 않아, Gate C 전용 predicate 들이 `*.test.ts` 파일 안에 production 로직으로 남아 있다는 점이다(WARNING 1건). 나머지는 매직 넘버/중복 호출/fixture 헬퍼 파편화 수준의 INFO 이며 기능적 결함은 없다.

## 위험도

LOW
