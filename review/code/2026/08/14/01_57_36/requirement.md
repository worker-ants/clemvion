# 요구사항(Requirement) 리뷰

## 발견사항

없음 — CRITICAL/WARNING 없음.

- **[INFO]** `updateReturningRows` 신규 헬퍼(`codebase/backend/src/common/utils/update-returning-rows.ts`)가 TypeORM 0.3.31 + pg 의 `UPDATE`/`DELETE … RETURNING` `[rows, rowCount]` 튜플 shape 을 정확히 흡수한다. 로직(`Array.isArray(result[0])` 로 튜플/행배열 판별)을 직접 추적했고, docstring 이 주장하는 실측 shape 표(튜플 length 2 vs INSERT 의 행 배열 length 1)와 코드 분기가 일치한다. 엣지 케이스(`undefined`/`null`/객체 → throw, 빈 튜플 `[[],0]` → `[]`, 비-튜플 행 배열 직접 → 그대로)도 `update-returning-rows.spec.ts` 로 개별 커버되고 로컬에서 실행해 41 passed 확인했다.
  - 위치: `codebase/backend/src/common/utils/update-returning-rows.ts:55-76`
- **[INFO]** 8곳(execution-engine 2 · knowledge-base 5 · auth-oauth 1)의 소비 지점 전수가 실제로 헬퍼를 거치는지 정적 카운트(`countCalls`)로 직접 재현했다 — `execution-engine.service.ts` 는 `updateReturningRows` 2회 + `assertRowArray` 1회(SELECT 전용 `lockNonTerminalExecutionRow`), `executions.service.ts` 는 `assertRowArray` 1회, `knowledge-base.service.ts` 는 `updateReturningRows` 5회로, 두 구조적 회귀 가드(`assert-row-array.spec.ts`/`update-returning-rows.spec.ts`)의 `EXPECTED`/`toEqual` 고정값과 정확히 일치함을 별도 node 스크립트로 재확인했다.
  - 위치: `codebase/backend/src/common/utils/assert-row-array.spec.ts:64-94`, `codebase/backend/src/common/utils/update-returning-rows.spec.ts` (`EXPECTED` 배열)
- **[INFO]** `auth-oauth.service.ts` 의 2차 결함(raw 행 snake_case `remember_me` vs entity 매핑 `rememberMe`)도 같은 함수 안에서 실제로 고쳐졌다 — `AuthOAuthStateRow`(snake_case 전용 타입)로 단언을 바꾸고 `record.remember_me === true` 로 읽는다. `auth-oauth.service.spec.ts`(튜플 shape `[[{...,remember_me:true}],1]` mock)와 신규 e2e(`auth-oauth-callback.e2e-spec.ts`, 실 Postgres 드라이버 위에서 `remember_me=true→30일`/`false→7일` 양방향 대조군)가 이 회귀를 판별력 있게 고정한다.
  - 위치: `codebase/backend/src/modules/auth/auth-oauth.service.ts:150-183`, `codebase/backend/test/auth-oauth-callback.e2e-spec.ts`
- **[INFO] spec fidelity 확인** — `spec/data-flow/2-auth.md:128` (OAuth 시퀀스)은 이미 "row 없으면 400 OAUTH_STATE_MISMATCH, row.provider ≠ :provider 도 거부" 를 명시하고 있다. 수정 전 코드는 튜플 오인으로 이 spec 서술을 실제로 위반(모든 정상 콜백이 오분류로 실패)하고 있었고, 이번 수정은 코드를 spec 서술에 **다시 맞추는** 방향이다 — spec 자체는 변경되지 않았고 변경할 필요도 없다(코드가 spec 을 따라가는 정상적 버그 수정).
- **[INFO] spec_impact 프로세스** — `plan/in-progress/update-returning-tuple-shape.md` frontmatter 의 `spec_impact`(5개 spec 문서)는 이 PR 자체가 그 문서들을 건드린다는 뜻이 아니라, "고쳐진 결함이 그 문서들의 과거 서술(예: `node-cancellation.md` §2.4 의 mutation coverage 주장, `4-execution-engine.md` §1.1 의 admission 보장)을 소급으로 무효화하니 project-planner 가 caveat 을 넣어야 한다" 는 위임이다. `developer` 는 `spec/` 쓰기 권한이 없어 이번 PR 로는 반영하지 못했고, 이를 `spec-update-node-cancellation-shutdown-classification.md` 의 "추가 위임 (2026-08-14 #12)" 절에 5건 표로 정확히 등재해 두었다 — 실제로 두 대상 spec 문서(`node-cancellation.md`, `4-execution-engine.md`)의 `pending_plans:` frontmatter 에는 아직 `update-returning-tuple-shape.md` 가 등재돼 있지 않음을 확인했으나, 이는 코드 결함이 아니라 명시적으로 다음 planner 턴으로 미뤄진 정상 절차다(CLAUDE.md 역할 분리 규약과 일치).
  - 위치: `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` (`## 추가 위임 (2026-08-14 #12)`)

## 검증 절차

- `npx jest src/common/utils/assert-row-array.spec.ts src/common/utils/update-returning-rows.spec.ts src/common/__test-utils__/source-scan.spec.ts src/modules/auth/auth-oauth.service.spec.ts` → 4 suites / 41 tests passed
- `npx jest src/modules/execution-engine/execution-engine.service.spec.ts src/modules/knowledge-base/knowledge-base.service.spec.ts` → 2 suites / 505 tests passed
- `npx eslint` 대상 4개 핵심 파일 `--max-warnings 0` → 클린
- 구조적 가드가 고정한 카운트(3/1, 5, 2·5·1)를 각각 별도 node 스크립트로 재계산해 spec 파일의 하드코딩된 기대값과 대조 — 전부 일치
- `updateReturningRows` 신규 호출부(execution-engine 2·knowledge-base 5)에 모두 문맥 있는 `detail` 문자열이 실려 있음을 grep 으로 개별 확인 — 직전 리뷰 라운드(`22_45_24` maintainability WARNING)가 지적한 "5곳 detail 누락" 이 실제로 해소돼 있음

## 요약

이 diff 는 TypeORM이 `UPDATE`/`DELETE … RETURNING` 에 `[rows, rowCount]` 튜플을 돌려주는데 8개 소비 지점이 행 배열로 오인해 소셜 로그인 상시 실패·admission cap 무력화·KB CAS 락 미작동·"로그인 유지" 침묵 무시를 일으킨 결함을 고친다. 공용 헬퍼 `updateReturningRows` + 정적 구조 가드(주석 스트리핑 포함 `countCalls`) + 실측 shape 유닛/e2e 테스트로 회귀를 다층 방어하며, 코드를 직접 추적·재실행해 확인한 결과 헬퍼 로직·소비 지점 전수·구조 가드 기대값·spec 서술과의 정합이 모두 일치했다. 이 PR 은 이미 9라운드 이상의 자체 리뷰(`review/code/2026/08/13/*`)를 거치며 발견된 CRITICAL/WARNING 을 그때그때 조치했고, 남은 후속 항목(spec 소급 caveat 5건, 3-파일 하드코딩 가드 한계 등)은 코드가 아니라 `project-planner` 위임 또는 관측 계획으로 정확히 문서화돼 있어 이번 diff 범위 안에서 새로 지적할 요구사항 결함을 찾지 못했다.

## 위험도

NONE
