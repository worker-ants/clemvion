# 테스트(Testing) 리뷰

## 발견사항

- **[WARNING]** `findNonTerminalCompletedPlans` 의 `status` 가 문자열이 아닐 때 조용히 skip 하는 분기가 fixture 로 검증되지 않음
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:119` (`if (typeof status !== "string") continue;`)
  - 상세: 이 PR 전체가 "위반 0건은 검사가 작동한다는 증거가 아니다 — 한 번도 실행되지 않은 분기가 있었다" 는 교훈에서 출발했고, `plan-scan.test.ts` 는 그 교훈을 대부분(파싱 실패 skip·종료 어휘 통과·`status` 부재 통과·`0-`/`_`/archive 제외·재귀·빈 트리)에 적용했다. 그런데 이 `typeof status !== "string"` 분기 — YAML 이 `status:`(빈 값→`null`), `status: no`(따옴표 없는 불리언 리터럴로 파싱되는 js-yaml 흔한 함정), `status: 2026`(숫자) 처럼 파싱될 때 이 검사를 통째로 건너뛰는 경로 — 는 어떤 fixture 로도 exercise 되지 않는다. `no-status.md` fixture(`fm()`)는 `status` 키 자체가 없는 경우(`undefined`)만 덮고, 이 분기는 "키는 있는데 문자열이 아닌" 경우라 별개 경로다. 지금 상태에서 `typeof status !== "string"` 조건이 반전되거나 삭제돼도 11개 테스트 중 무엇도 RED 로 바뀌지 않는다 — 정확히 이 PR 이 다른 5곳에서 막으려던 것과 같은 형태의 무관측 분기다.
  - 제안: `plan-scan.test.ts` 의 `beforeAll` fixture 에 `status:`(빈 값) 또는 `status: no`/`status: 123` 같은 non-string 값을 가진 `plan/complete/*.md` 를 추가하고, 그 파일이 `findNonTerminalCompletedPlans` 결과에 포함되지 않음(현재 의도된 동작)을 명시적으로 단언하는 테스트를 추가할 것. 최소한 "이 값은 위반으로 잡지 않는다" 는 의도를 코드로 고정해야, 나중에 조건이 깨져도 뮤테이션/리팩터로 조용히 다른 동작이 되는 것을 잡을 수 있다.

- **[INFO]** Gate C(`spec-plan-completion.test.ts`)의 `collectCompletePlans` 가 여전히 별도의 walker 사본으로 남아, `plan-scan.ts` 의 `isLifecyclePlan`/`walkPlanMarkdown` 과 규칙을 손으로 재동기화해야 하는 상태
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts:59-83` (`collectCompletePlans`) vs `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:35-70` (`isLifecyclePlan`/`walkPlanMarkdown`)
  - 상세: 이번 커밋 메시지는 "저장소에 walker 가 네 벌 있었고 서로 규칙이 달랐다" 를 문제로 짚고 `plan-scan.ts` 로 통합했다고 설명하지만, 실제로 통합된 것은 `plan-frontmatter.test.ts`(옛 인라인 로직)와 `spec-links.ts`(`collectLivePlanMarkdown`) 둘뿐이다. `spec-plan-completion.test.ts` 의 `collectCompletePlans` 는 `.md`/`0-`/`_`/`archive` 제외 규칙을 **세 번째로** 손으로 재구현한 채 남아 있고, 이 사본과 `plan-scan.ts` 사이의 일치를 보장하는 공유 테스트나 타입이 없다. `plan-scan.ts` 상단 주석은 "Gate C 와 같은 면제 규칙을 쓴다" 고 서술하지만 이는 코드로 강제되지 않는 서술적 약속이라, 둘 중 하나만 바뀌면 이 PR 이 고치려던 것과 똑같은 조용한 drift 가 재발한다.
  - 제안: (이번 diff 범위 밖일 수 있음) 후속 작업으로 `spec-plan-completion.test.ts` 도 `collectCompletePlanMarkdown`(`plan-scan.ts`)을 쓰도록 바꾸거나, 최소한 두 구현이 같은 입력에 대해 같은 파일 집합을 반환하는지 비교하는 parity 테스트를 추가할 것.

- **[INFO]** `walkPlanMarkdown` 의 `relPath` 정렬(`out.sort(...)`)이 독립적으로 검증되지 않음
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:68` (`out.sort((a, b) => a.relPath.localeCompare(b.relPath));`)
  - 상세: `plan-scan.test.ts` 의 `"reports exactly the three planted violations (no over-reach)"` 테스트(105-111행)는 결과 배열에 `.sort()` 를 다시 적용한 뒤 비교하므로, 구현의 정렬이 깨지거나 제거돼도 이 테스트는 여전히 GREEN 이다. 정렬 순서 자체에 의존하는 소비자(예: 화면 표시·diff 안정성)가 있다면 이 회귀는 잡히지 않는다.
  - 제안: 정렬 순서가 계약의 일부라면, 입력을 일부러 역순으로 만든 뒤 `.sort()` 없이 원본 배열 순서를 단언하는 테스트를 하나 추가할 것. 순서가 계약이 아니라면(현재 소비자들은 `.map` 후 `toContain`/`Set` 비교만 함) 무시해도 무방.

## 요약

이번 라운드는 직전 리뷰의 MEDIUM WARNING(status 모순 검사가 실 저장소 positive-only 라 `wrong.push` 분기가 158 테스트 내내 한 번도 실행되지 않던 vacuous-pass) 을 정확히 겨냥해 해결했다. `plan-scan.ts` 로 탐지 로직을 export 하고, `plan-scan.test.ts` 가 합성 temp-dir 저장소에 위반 3건(`stale.md`/`odd.md`/`nested/deep.md`)을 심어 정확히 그 3건만 잡히는지(over-reach 방지)까지 단언하며, 파싱 실패 skip·종료 어휘 4종 통과·`status` 부재 통과·`archive`/인덱스 제외·재귀·빈 `plan/` 트리까지 11개 테스트로 각 분기를 독립적으로 exercise 한다. 직전 라운드의 INFO 2건(테스트명이 검사 범위보다 좁음, 재귀 walk 미검증)도 함께 해소됐다. 실행 확인 결과 관련 4개 스위트(`plan-scan`/`plan-frontmatter`/`spec-links`/`spec-plan-completion`) 963 테스트 전부 GREEN 이고 죽은 참조·`.only`/`.skip` 잔존도 없다. fixture 는 mock 없이 실제 파일시스템(`os.tmpdir()`)을 쓰고 `beforeAll`/`afterAll` 로 격리·정리돼 테스트 간 의존성이 없다. 다만 이 PR 이 스스로 세운 "무관측 분기 제거" 기준으로 보면 `status` 가 문자열이 아닌 값(빈 값·YAML 불리언 리터럴 등)일 때 조용히 skip 하는 한 분기가 여전히 어떤 fixture 로도 관측되지 않고, "네 벌의 walker" 통합도 Gate C 의 사본 하나를 남긴 채 절반만 이뤄져 향후 재발 소지가 있다 — 둘 다 이번 PR 의 핵심 위험을 재도입하는 수준은 아니고 지엽적인 잔여 갭이다.

## 위험도
LOW
