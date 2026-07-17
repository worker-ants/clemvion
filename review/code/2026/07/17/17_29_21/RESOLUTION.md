# RESOLUTION — review/code/2026/07/17/17_29_21 (종결용 리뷰)

## 이 세션의 성격

선행 세션 `16_33_59` 의 Warning 2건을 fix 한 커밋 `e0e2123d4` 만을 diff 스코프로 재리뷰한 **종결용(termination) 리뷰**다. resolution-applier 의 fix 코드가 "어떤 리뷰어도 보지 않은 코드" 로 남는 것을 막는 것이 목적이었고, 그 목적은 달성됐다 — security·requirement·scope 3명이 위험도 NONE 으로 fix 의 정확성을 실측 확인했다.

## 처분: 전 항목 코드 무변경 수용 (defer)

**Critical 0 / Warning 5. 5건 모두 이번 턴에서 코드를 고치지 않고 수용(defer)한다.**

**Why** — 두 가지 근거가 모두 성립한다:

1. **어느 것도 제품 동작 결함이 아니다.** 가드의 실제 런타임 동작은 실측으로 양방향 검증됐다:
   - 정탐: 정적 import·`import type`·re-export·동적 `import()`(alias/상대경로)·`require()` 전부 error 발생 (실제 `npx eslint` probe).
   - 오탐: `@/components-foo`, `@/component`, `@/lib/components-helper`, `next/navigation`, 정당한 `@/lib/**` import 등 6종 전부 통과 (오탐 0건).
   - baseline 불변: `npx eslint` 0 errors / 12 warnings — 변경 전과 동일.
   - 회귀 테스트 16/16 (clean tree 3회 연속).
   W#1·W#2 는 *테스트의 견고성*, W#3 은 *코드 조직*, W#4·W#5 는 *문서화·스코프 정책* 에 관한 것이며, 출하되는 가드의 동작 자체는 정확하다.

2. **지금 고치면 리뷰 게이트가 무한 회귀한다.** `review_guard` 의 freshness 조건은 "리뷰 세션 경로시각 > 최신 codebase 파일 author date" 다. 지금 W#1~#3 을 고치면 그 fix 커밋이 본 세션(17:29:21)을 postdate 해 게이트가 재무장되고, 다시 종결용 리뷰 세션이 필요해지며, 그 리뷰가 또 findings 를 내면 같은 일이 반복된다. 프로젝트 규약은 이 회귀의 종결 조건을 명시한다 — **"마지막 review 세션 findings 는 코드 무변경으로 일괄 수용해 회귀를 끊는다"**. 본 세션이 그 마지막 세션이다.

## 항목별 처분

| # | 카테고리 | 처분 | 근거 |
|---|----------|------|------|
| 1 | 테스트 — flat config "나중 블록 우선" override 무력화를 테스트가 미탐지 | **defer (후속 티켓)** | 실제 위협모델(glob 오타·규칙 삭제·패턴 완화)은 6종 mutation testing 으로 방어 확인됨. 이 갭은 "누군가 배열 뒤에 동일 `files` 로 `off` override 블록을 의도적으로 추가" 하는 경우에만 성립 — 사고가 아니라 의도적 행위이며, 그 경우 diff 리뷰에서 드러난다. 테스트 견고성 개선 사항이지 가드 결함 아님 |
| 2 | 테스트 — bare `@/components` (서브패스 없음) 회귀 케이스 부재 | **defer (후속 티켓)** | **config 는 bare 형태를 실제로 차단한다**(실제 `npx eslint` 로 확인 — 리뷰어도 동일 확인). 테스트가 그 방어선을 assert 하지 않을 뿐인 커버리지 갭 |
| 3 | 유지보수성 — 정규식이 2개 selector 에 복붙, drift 위험 | **defer (후속 티켓)** | 정당한 지적이나 현재 동작 정확. 상수 추출은 W#1·W#2 테스트 보강과 함께 한 번에 처리하는 것이 커밋 위생상 낫다 |
| 4 | 아키텍처 — 규약이 `spec/conventions/` 에 미문서화 | **defer → project-planner 위임** | `developer` 는 `spec/` **read-only** (CLAUDE.md §Skill 체계). 본 skill 의 쓰기 권한 밖이라 이번 턴에서 처리 불가. 선행 세션 requirement INFO#1 과 동일 이슈 |
| 5 | 아키텍처 — 가드 스코프가 `src/types/**` 미포함 | **defer → project-planner 위임** | 사용자 요청 범위("`src/lib/**` 이 `@/components/**` 를 import 금지")를 넘는 확장이라 임의 적용은 scope creep. 현재 `src/types/**` 위반 0건(실측). W#4 의 spec 문서에서 경계 정책으로 함께 결정하는 것이 옳다 |

INFO 18건은 전부 "조치 불필요" 로 리뷰어가 분류 — 별도 처분 없음. 단 INFO#4(커밋 메시지 "8건" vs 실제 10건 오기)는 이미 커밋된 메시지라 history rewrite 없이는 수정 불가하며, 코드·동작 영향 0 이라 수정하지 않는다.

## TEST 결과 (fix 커밋 `e0e2123d4` 이후, 코드 무변경 상태 그대로)

- lint : 통과 — `npx eslint` 0 errors / 12 warnings (변경 전 baseline 과 동일, 증가 없음)
- unit : 통과 — `eslint-layering-guard.test.ts` 16/16, clean tree 3회 연속 재현
- e2e  : 통과 — `run-test.sh e2e` 363s, backend jest `256 passed` + frontend playwright `51 passed (1.5m)` (로그 `_test_logs/e2e-20260717-171800.log`)

본 세션은 코드를 변경하지 않았으므로 위 결과가 그대로 유효하다.

## 측정 아티팩트 반증 (WARNING 미승격)

side_effect 가 "신규 테스트 1회 실패" 를 보고했으나, 원인은 같은 worktree 에서 다른 리뷰어가 동시에 수행한 mutation testing 의 잔재(`eslint.config.mjs.bak`, `eslint.config.mutated.mjs`, `eslint-layering-guard.mutation-check.test.ts`)였다. 현재 워크트리에 해당 파일은 없고(`git status` clean), `eslint.config.mjs` 는 HEAD 와 일치하며, clean tree 에서 16/16 × 3회 연속 통과로 반증됐다. **공유 worktree 동시 편집의 측정 artifact 이지 코드 결함이 아니다** — 위험도 산정에서 제외.

## 후속 항목

- W#1·W#2·W#3 (테스트 견고성 + 정규식 상수화) → 한 후속 작업으로 묶어 처리 권장.
- W#4·W#5 (spec/conventions 문서화 + `src/types/**` 스코프 정책) → `project-planner` 위임.
- 민감 변경 가드 해당 없음 — DB 마이그레이션·외부 API 계약·인증/결제 변경 없음.
- SPEC-DRIFT 0건.
