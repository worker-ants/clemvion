# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — 보안·범위·유지보수성 관점은 문제 없음(순수 ESLint 설정 추가, 레이어 역전 방지 가드). 다만 testing 리뷰어가 실측으로 확인한 대로 이 가드는 동적 `import()`/`require()` 를 검사하지 못해 우회 가능하고, 그 사실을 지속적으로 검증할 자동 회귀 테스트가 전혀 없어 향후 config 변경/업그레이드로 조용히 무력화될 위험이 있다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing / Requirement | 동적 `import()` 및 CJS `require()` 는 `no-restricted-imports` 규칙의 검사 대상이 아니라 레이어 역전 가드를 완전히 우회한다. testing 리뷰어가 probe 파일로 실측 확인: `await import("@/components/foo")`, `require("@/components/foo")` 둘 다 exit 0 (에러 없음). `src/lib/**` 는 이미 다른 곳에서 동적 import 를 실사용 중이라(`workspace-store.ts` 등) 향후 재발 경로가 구조적으로 열려 있다 (현재 위반은 0건). | `codebase/frontend/eslint.config.mjs:41-61` | `no-restricted-syntax` 에 `ImportExpression`/`CallExpression[callee.name='require']` selector 를 보조 규칙으로 추가하거나, 최소한 config 옆 주석에 이 커버리지 한계를 명시할 것 |
| 2 | Testing | 이 레이어 역전 가드(negative-space rule) 자체에 대한 자동 회귀 테스트가 전혀 없다. `src/lib` 에 현재 위반이 없기 때문에 `npx eslint src/lib` 는 규칙이 실제로 로드·매칭·발동되는지와 무관하게 항상 "0 errors" 로 통과한다. 향후 누군가 `files: ["src/lib/**"]` 를 오타로 좁히거나, `eslint-config-next` 업그레이드로 규칙 병합 동작이 바뀌거나, rule 구조를 잘못 고쳐도 CI lint 는 계속 초록이며 실제 레이어 역전이 재발해야만 발각된다. | `codebase/frontend/eslint.config.mjs` (신규 블록 전체) | vitest 로 ESLint `Linter#verify`(또는 `RuleTester`) 기반 소형 회귀 테스트를 추가해, 이 config 블록의 `no-restricted-imports` 옵션을 fixture import 문(`@/components/foo` 등)에 실행하고 error 발생을 assert. 예: `src/lib/__tests__/eslint-layering-guard.test.ts` |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Requirement | 이 레이어 규약(`src/lib` → `@/components` import 금지)을 명문화한 공식 spec 문서가 `spec/conventions/` 에 없다. 근거는 코드 주석과 `plan/complete/rag-tool-row-distinct-ui.md` 의 후속 백로그 한 줄뿐이다. | `spec/conventions/*` (부재) | 이 가드가 프로젝트 표준으로 자리잡으면 `project-planner` 에 위임해 `spec/conventions/frontend-layering.md`(가칭) 신설 검토 |
| 2 | Maintainability | 신규 규칙 옆 배경 주석이 예시 파일 경로 2개(`src/lib/conversation/rag-types.ts`, `src/components/editor/run-results/conversation-utils.ts`)를 하드코딩해, 해당 파일이 향후 리네임/이동되면 stale 참조가 될 수 있다(규칙 자체 기능에는 영향 없음). | `codebase/frontend/eslint.config.mjs:37-38` | 배경 설명을 spec/conventions 문서로 옮기고 주석에서는 링크만 남기는 방식 고려 (필수 아님, backend 의 기존 인라인 주석 관행과는 일관됨) |
| 3 | Maintainability | 상대경로 매칭 glob 패턴(`**/../components`, `**/../components/**`)이 minimatch 세그먼트 매칭에 익숙하지 않은 독자에게는 즉각 이해되지 않을 수 있다(동작 자체는 2~3단계 깊이 모두 정상 실측 확인됨). | `codebase/frontend/eslint.config.mjs:49-52` | 주석에 "임의 깊이의 `../`, `../../` 등을 모두 포괄" 한 줄 추가 검토 (필수 아님) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 순수 빌드타임 ESLint 설정 변경, 런타임/공격표면 영향 없음. 8개 보안 관점 전부 해당 없음 |
| requirement | LOW | `ignore`/minimatch 매칭 엔진 실측으로 요구사항(alias·상대경로 우회 차단) 정확 구현 확인. 동적 import 커버리지 공백 1건(WARNING 1) |
| scope | NONE | 단일 파일 원자적 diff, 의도 이상의 변경·불필요 리팩토링·무관한 수정 없음 |
| side_effect | LOW | 변경 전/후 `npx eslint .` A/B 비교(0 errors 동일), probe import 로 오탐/과소탐 없음, 타 패키지 누출 없음, autofix 부작용 없음 — 모두 실측 확인 |
| maintainability | NONE | 유지보수성 개선 방향(아키텍처 결정을 CI 가드로 자동화). INFO 3건(주석 staleness, glob 가독성, 동적 import 한계 메모) |
| testing | MEDIUM | 동적 `import()`/`require()` 우회를 실측 확인(WARNING 1) + 이 negative-space 가드에 대한 자동 회귀 테스트 부재(WARNING 2) |

## 발견 없는 에이전트

- security, scope — 실질적 이슈 없음 (security: 보안 관점 전부 N/A, scope: 범위 이탈 징후 없음)

## 권장 조치사항

1. `no-restricted-syntax` 등으로 동적 `import()`/`require()` 우회 경로를 보조 규칙으로 추가 커버하거나, 최소한 config 옆 주석에 현재 커버리지 한계를 명시한다 (WARNING 1).
2. vitest 기반 ESLint `Linter#verify`/`RuleTester` 회귀 테스트를 추가해 이 레이어 역전 가드가 향후 config 변경·의존성 업그레이드로 조용히 무력화되는 것을 CI 가 잡아내도록 한다 (WARNING 2).
3. (선택) 이 layering 규약을 `spec/conventions/` 문서로 승격할지 `project-planner` 와 협의한다.
4. (선택) 배경 주석의 하드코딩된 파일 경로 참조를 spec 문서 링크 방식으로 재검토한다.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing` (6명) — 전원 `agents_forced (router_safety)`: 소스 코드 변경(`codebase/frontend/eslint.config.mjs`)이 있어 router 판단과 무관하게 강제 포함됨
  - **제외**: 표 (8명, router 사유는 각각 `_routing_decision.json` 근거)
  - **강제 포함(router_safety)**: `maintainability, requirement, scope, security, side_effect, testing`

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 런타임 성능 영향 없음 (linting 규칙만) |
  | architecture | 레이어 경계 강제 규칙 추가만, 코드 구조 변경 없음 |
  | documentation | config 파일만 변경, API 문서/JSDoc 변경 없음 |
  | dependency | package.json 등 의존성 파일 변경 없음 |
  | database | DB 마이그레이션/쿼리 변경 없음 |
  | concurrency | async/락/큐 코드 변경 없음 |
  | api_contract | API 라우트/컨트롤러 변경 없음 |
  | user_guide_sync | eslint 설정 파일, doc-sync-matrix trigger 매칭 안 됨 |
