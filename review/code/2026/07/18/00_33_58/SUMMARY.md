# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — 실제 코드 변경은 `eslint-layering-guard.test.ts` 1개 파일뿐이며 프로덕션 레이어 가드 자체(빌드타임 lint 차단)는 정상 동작한다. 다만 이번 fix 가 목표한 "메시지 뒤바뀜 회귀 고정"이 정적(static) import 진입점에 대해서는 실측 mutation 으로 미탐지가 확인돼(requirement·testing 두 리뷰어가 각각 실행 재현), RESOLUTION.md 가 "FIXED" 로 종결한 WARNING#1 의 의도가 부분적으로만 충족됨. forced 화이트리스트(documentation, maintainability, requirement, scope, security, side_effect, testing) 전원 및 추가 실행된 architecture 모두 결과 확보됨 — 라우터 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing / Requirement | 신규 "문구 회귀 고정" 테스트에서 static(`no-restricted-imports`) 진입점의 `distinctPhrase`(`"@/components/** 를 import 할 수 없습니다"`)가 `STATIC_IMPORT_MSG`뿐 아니라 `DYNAMIC_IMPORT_MSG`/`REQUIRE_MSG` 모두의 공통 부분 문자열이라 static↔dynamic/static↔require 메시지 상수 뒤바뀜을 탐지하지 못함. 실측: `eslint.config.mjs` 의 `message: STATIC_IMPORT_MSG` → `message: DYNAMIC_IMPORT_MSG` 로 mutation 후 재실행 시 51/51 전부 통과(회귀 미탐지, 재현 후 원복 확인). RESOLUTION.md 가 주장하는 "재현 검증 3종"(①LAYERS_LABEL join 변조 ②require↔dynamic 뒤바꿈 ③spec 링크 제거)에도 이 조합은 포함돼 있지 않아, WARNING#1 처분 당시부터 검증되지 않은 gap. 실제 레이어 가드 차단 자체는 정상(정적 import 는 여전히 error) — 회귀 테스트 검증력 공백일 뿐 | `codebase/frontend/src/lib/__tests__/eslint-layering-guard.test.ts:119-135`, 원인 상수: `codebase/frontend/eslint.config.mjs:29-31` | static 케이스의 distinctPhrase 를 세 상수 중 static 에만 있는 고유 문구로 교체하거나, `not.toContain("동적 import() 로도")`/`not.toContain("require() 로도")` 부정 단언을 추가해 세 상수를 상호 배타적으로 식별 |
| 2 | Documentation | 파일 최상단 모듈 JSDoc 이 여전히 `src/lib/**` 단독 스코프만 기술 — `LOWER_LAYERS` 가 `src/types/**` 까지 확장된 지 이미 한 커밋(`00b3b05a4`) 지났고 이 파일 자체에 `src/types` 전용 describe 블록까지 있는데도, 모듈 설명은 "Guard: `src/lib/**` 는 ...", "`src/lib` 에 현재 위반이 0건" 등 옛 단일 스코프 문구 그대로. 이번 라운드가 fail-open 메시지에서 정확히 고친 것과 같은 종류의 staleness 가 몇 줄 위에 미수정으로 남음 | `codebase/frontend/src/lib/__tests__/eslint-layering-guard.test.ts:7-18` | 모듈 JSDoc 의 `src/lib/**` 언급을 "레이어 가드(`src/lib/**`·`src/types/**`)" 또는 `LOWER_LAYERS` 참조로 일반화 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Requirement | spec §4.1 "이 테스트가 고정하는 것" 목록이 이번에 추가된 두 보장 항목(메시지 콘텐츠 검증, 근접 오탐/lib-types 케이스)을 명시적으로 나열하지 않음(모순은 아닌 개괄 서술 gap) | `spec/conventions/frontend-layering.md` §4.1 | 여유 있을 때 §4.1 에 "메시지 콘텐츠" 항목 추가 |
| 2 | Architecture | 블록 탐색 predicate(`GUARD_BLOCK_KEY`)가 "레이어 가드는 단일 블록"이라는 암묵 가정에 의존 — 현재 구조에선 정확히 동작하나 향후 계층별 블록 분리 시 조용히 일부 블록을 누락할 수 있음(기존부터 있던 특성, 이번 diff 는 오히려 리터럴→config 파생 전환으로 drift 위험을 낮춤) | `eslint-layering-guard.test.ts:26,36-38` | 향후 블록 분리 리팩터 체크리스트에 "탐색 로직도 전 블록 순회로 변경" 명시 |
| 3 | Maintainability | rule-id 필터 predicate(`ruleId === "no-restricted-imports" || ruleId === "no-restricted-syntax"`) 중복이 `layeringErrors`/`errorsAt` 두 헬퍼에 그대로 남음(이전 리뷰에서 "조치 불필요"로 처분된 사항, 회귀 아님) | `eslint-layering-guard.test.ts:108-110`, `:239-241` | 급하지 않음. 상수화(`LAYERING_RULE_IDS as const`) 여지는 유효 |
| 4 | Maintainability | `GUARD_BLOCK_KEY`/`CONFIG_LOWER_LAYERS`/`EXPECTED_LOWER_LAYERS` 3개 유사 명명 상수 병존, 관계 파악에 약간의 인지 부하. `GUARD_BLOCK_KEY` 트레일링 주석(`// "src/lib/**"`)이 배열 순서 가정에 의존 | `eslint-layering-guard.test.ts:5, 26, 230` | 트레일링 주석을 "무엇을 가리키는지"로 바꾸거나 세 상수 관계를 한 줄 요약 주석으로 추가 |
| 5 | Scope | WARNING#2 조치(에러 메시지 텍스트 갱신)가 블록 탐색 키(`GUARD_BLOCK_KEY`) 파생 전환까지 겸사겸사 동반 — 요청 범위보다 약간 넓지만 동일 근본 원인에 대한 근거 있는 부수 변경이라 문제 삼을 수준 아님 | `eslint-layering-guard.test.ts` | 조치 불필요 |
| 6 | Scope / Side Effect | diff 21개 파일 중 20개는 이전 코드리뷰(`review/code/2026/07/17/23_49_51/**`)·컨시스턴시체크(`review/consistency/2026/07/18/00_22_41/**`) 산출물 — CLAUDE.md 저장 위치 규약 및 기존 커밋 관례에 부합, 실행 코드 아님. 상태 파일(`_retry_state.json`,`meta.json`) 내부에 이 worktree 의 절대경로가 다수 기록돼 worktree 삭제 시 댕글링되나 하네스 전반의 기존 패턴 | `review/code/2026/07/17/23_49_51/**`, `review/consistency/2026/07/18/00_22_41/**` | 조치 불필요 — 참고용 기록 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 시크릿·인증·인젝션 등 해당 사항 없음 |
| architecture | NONE | 구조적 결함/순환 의존 없음, 블록 탐색 암묵 가정 1건 INFO |
| requirement | MEDIUM | static 진입점 메시지 뒤바뀜 미탐지(WARNING), spec §4.1 목록 gap(INFO) |
| scope | NONE | 코드 변경 1파일로 범위 적절, 리뷰 산출물 20파일은 관례 부합 |
| side_effect | NONE | 전역 오염/파일시스템/네트워크 부작용 없음 |
| maintainability | LOW | rule-id predicate 중복·유사명명 상수 병존(둘 다 기존 INFO 수준) |
| testing | LOW | static 진입점 회귀 미탐지 실측 확인(WARNING), 근접/lib-types 케이스는 유효 |
| documentation | LOW | 모듈 JSDoc staleness(WARNING), 나머지 문서 판단은 실측 재확인 통과 |

## 발견 없는 에이전트

security, architecture, scope, side_effect — 위 표 참고 (Critical/Warning 급 발견 없음, INFO 수준만 존재하거나 전무).

## 권장 조치사항
1. static 진입점 메시지 회귀 테스트의 `distinctPhrase` 를 세 상수 중 static 에만 고유한 문구로 교체하거나 부정 단언(`not.toContain`)을 추가해 static↔dynamic/require 뒤바뀜을 실제로 탐지하도록 보강 (WARNING #1).
2. 파일 최상단 모듈 JSDoc 을 `src/lib/**`·`src/types/**` 두 계층을 포괄하도록 갱신 (WARNING #2).
3. (선택) spec §4.1 에 "메시지 콘텐츠 검증" 항목 추가해 테스트 스위트와 완전 대응시키기.
4. (선택) `GUARD_BLOCK_KEY`/`CONFIG_LOWER_LAYERS`/`EXPECTED_LOWER_LAYERS` 관계를 요약하는 주석 추가.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, architecture, requirement, scope, side_effect, maintainability, testing, documentation (8명)
  - **제외**: 표 (6명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing — 전원 결과 확보됨

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터 판단상 이번 diff 와 무관 |
  | dependency | 신규/변경 의존성 없음 |
  | database | DB 스키마/쿼리 변경 없음 |
  | concurrency | 동시성/비동기 로직 변경 없음 |
  | api_contract | API 계약 변경 없음 |
  | user_guide_sync | 사용자 가이드 문서 대상 변경 없음 |