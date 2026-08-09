# 문서화(Documentation) Review

## 발견사항

- **[INFO]** "Pure enforcement predicates" 주석이 실제 배선과 살짝 어긋난다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts:36-37` (`isGateCEnforced` 위 주석), `:131-132` (`describe("Gate C enforcement logic"...)` 위 주석)
  - 상세: 주석은 "Pure enforcement predicates — unit-tested below so the gate is **provably live**" 라고 적어, 마치 `isGateCEnforced`/`hasValidSpecImpact` 가 실제 게이트 로직이라는 인상을 준다. 그러나 실제 enforcement 루프(`:71-79` 의 `enforced` 필터, `:98-126` 의 세 `it`)는 이 두 함수를 **호출하지 않고** 같은 판정을 인라인으로 중복 구현한다. 따라서 `isGateCEnforced`/`hasValidSpecImpact` 를 수정해도(예: cutoff 비교식 변경, `NONE_VALUES` 어휘 추가) 하단 synthetic 테스트는 여전히 GREEN 이지만 실제 게이트 동작은 바뀌지 않을 수 있다 — "provably live" 라는 표현이 보장하는 것보다 실제 결합도가 약하다.
  - 참고: 이 정확한 갭은 이전 라운드 `review/code/2026/08/10/03_47_21/requirement.md` 에서 이미 지적됐고 "조치 불요(이번 PR 스코프 아님). 향후 정리 시 enforcement 루프가 `hasValidSpecImpact` 를 직접 호출하도록 통합 고려" 로 처분됐다. 새로운 결함은 아니며 기능 변경을 요구하지 않는다.
  - 제안: (선택) 주석에 "predicates 는 현재 enforcement 루프와 별도 구현이며 동일 로직을 각자 유지해야 한다" 는 한 줄만 덧붙이면, 향후 둘 중 하나만 고치는 조용한 drift 를 리뷰어가 더 빨리 잡을 수 있다. 강제 아님.

- **[INFO]** 일부 내보낸 타입/인터페이스에 독스트링 없음
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts` — `export interface PlanMdFile` (함수명 기준), `export interface NonTerminalPlan`, `export interface FrontmatterViolation`, `export type FrontmatterViolationKind`
  - 상세: 같은 파일의 다른 export(`isLifecyclePlan`/`walkPlanMarkdown`/`parseFrontmatterSafe`/`TERMINAL_PLAN_STATUSES`/`checkPlanFrontmatter` 등)는 근거·실측·경계까지 담은 상세 JSDoc 을 갖추고 있는데, 이 네 타입만 문서화 밀도가 상대적으로 낮다. 다만 필드/값 이름 자체가 (`worktree-missing`, `owner-missing` 등) 충분히 자기설명적이라 실질적 이해 장애는 없다.
  - 제안: 파일 전체 문서화 수준에 맞추려면 한 줄 요약(`/** 라이프사이클 frontmatter 위반 한 건. */` 등)만 추가해도 충분. 급하지 않음.

- **[INFO]** README/CHANGELOG 갱신 불요 확인
  - 위치: 저장소 루트 `CHANGELOG.md`
  - 상세: 이번 변경은 `codebase/frontend/src/lib/docs/__tests__/` 내부 문서 가드(빌드 타임 테스트)의 내부 리팩터링·신설이며, 최근 `CHANGELOG.md` 항목은 전부 사용자 대면 백엔드 기능/보안 수정(#1103·#1108 등)이다. 유사한 이전 `fix(harness)` 계열 커밋들도 CHANGELOG 를 건드리지 않았다 — 선례와 일관되게 이번에도 CHANGELOG 항목 불요로 판단.

## 정합성 확인 (문제 없음, 참고용)

- `plan-scan.ts` 모듈 헤더가 주장하는 "네 벌 중 plan 계열 둘만 통합, Gate C 의 `collectCompletePlans` 는 독립 구현으로 잔존" 은 `git diff origin/main...HEAD -- spec-plan-completion.test.ts` 로 실측 확인됨 — 실제로 `spec-plan-completion.test.ts` 도 이번 PR 에서 `collectCompletePlanMarkdown` 재사용으로 전환됐으나(구주석과 신주석이 이 사실을 정확히 반영), 후속 통합 항목은 `plan/in-progress/docs-guard-walker-dedup.md` 에 실재 등재돼 있음(확인).
- `TERMINAL_PLAN_STATUSES` 독스트링이 인용하는 `#1108`·`#1117`, `WORKTREE_PLACEHOLDER` 독스트링이 인용하는 `3da85dc3b`(#576) 커밋 모두 `git log` 로 실존 확인됨.
- `.claude/docs/plan-lifecycle.md §4`/§5(Gate C), `spec/conventions/spec-impl-evidence.md`, `PROJECT.md` 세 곳이 이번 PR 로 도입된 `plan-scan.ts` API(`TERMINAL_PLAN_STATUSES`, `collectLivePlanMarkdown`/`collectCompletePlanMarkdown`, `checkPlanFrontmatter`)를 정확히 참조하며 서로 어긋나지 않음(교차 확인).
- 두 파일의 함수/블록 대부분이 "왜" 를 설명하는 상세 JSDoc·인라인 주석을 갖추고 있고, 그 안의 실측 주장(예: `matter()` 캐시 오염 재현, ISO 날짜 라운드트립 필요성, mutation 으로 발각된 죽은 분기)은 모두 코드 동작과 일치.

## 요약

두 파일 모두 이미 다회 리뷰 라운드를 거친 상태로, 모듈/함수 단위 독스트링이 근거·실측·범위까지 명시하는 매우 높은 수준을 유지하고 있으며 SoT 문서(`plan-lifecycle.md`, `spec-impl-evidence.md`, `PROJECT.md`)와의 교차 참조도 실측 검증 결과 전부 정확하다. 남은 항목은 "provably live" 주석이 실제 배선(예측 함수 vs 인라인 중복 로직)보다 강하게 읽힐 수 있다는 점과 일부 내부 타입의 독스트링 밀도가 낮다는 두 가지 INFO 수준 지적뿐이며, 전자는 이미 이전 라운드에서 스코프 외로 처분된 사안이다. README/CHANGELOG 갱신은 이 변경의 성격(내부 문서 가드 리팩터링)상 불요로 판단된다.

## 위험도

LOW
