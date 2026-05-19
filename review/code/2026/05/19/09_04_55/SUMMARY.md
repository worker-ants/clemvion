# Code Review 통합 보고서

세션: `review/code/2026/05/19/09_04_55`
대상: `origin/main..HEAD` (button-cap-spec-validator PR #203)

> **중요 caveat**: ai-review orchestrator 가 prepare 시점에 `origin/main` ref 가 stale 한 상태였음. 본 PR commit 1개 (`a645933e`) 의 실제 변경은 button-cap 관련만 (`button.types.ts/spec`, `carousel.schema.ts/spec`, `button-list-editor.tsx`, `0-common.md`, `1-carousel.md`, `2-table.md`, `_product-overview.md`, plan, review/consistency). `origin/main` fetch 후 base diff 가 본 PR 외 PR #198/#200/#201 + 추가 commit 들 (auth.ts, login-form.tsx, 2fa-webauthn-followups.md, spec/5-system/1-auth.md, Swagger oneOf 등) 도 diff range 에 포함됨 — reviewer 들이 그 변경에 대해서도 발견을 보고. **본 PR 의 책임 범위 외 발견은 false alarm** 으로 분류.

## 전체 위험도

**LOW** (본 PR 실제 범위 기준) — button cap 5 통일 자체는 의도대로 완성. Critical 4건은 본 PR 외 변경에 대한 reviewer 발견이므로 본 PR 책임 아님.

## Critical 발견사항 — 처리 결과

| # | 항목 | 본 PR 범위 | 처리 |
|---|---|---|---|
| C-1 | `login-form.tsx` / `auth.ts` 인증 로직 수정 | **NO** — 본 PR 의 a645933e commit 에 없음. PR #201 (login challenge union refactor) 영향 | **NOT APPLICABLE** (origin/main diff range artifact) |
| C-2 | `2fa-webauthn-followups.md` §9 역행 | **NO** — 본 PR 외 변경 | NOT APPLICABLE |
| C-3 | `2fa-webauthn-followups.md` §10 역행 | **NO** — 본 PR 외 변경 | NOT APPLICABLE |
| C-4 | `shadow-workflow.spec.ts:1234` maxButtonsValidator 구 cap (10) 하드코딩 | **YES** — 본 PR 의 cap 5 변경이 그 fixture 와 어긋남 | **FIXED** — maxButtonsValidator cap 10 → 5 + 메시지 동기화 + 테스트 fixture (11→6) 갱신 |

## 본 PR 책임 범위 WARNING (전체 16 중 발췌)

| # | 항목 | 본 PR 범위 | 처리 |
|---|---|---|---|
| W-5 | shadow-workflow.spec.ts 갱신 plan 체크리스트 누락 | YES | **FIXED** — plan 작업 항목에 추가 |
| W-12 | button.types.spec.ts 경계 케이스 명확성 | YES | **CONFIRMED FIXED** — 이미 "passes with exactly 5" + "should fail when more than 5" 2 케이스 작성 완료 |
| W-13 | carousel.schema.spec.ts 경계 케이스 | YES | **CONFIRMED FIXED** — "allows exactly 5" + "caps per-item buttons at 5" 2 케이스 작성 완료 |
| W-1~W-4, W-6~W-11, W-14~W-16 | 본 PR 외 변경 (auth.ts / login-form.tsx / 2fa-webauthn-followups.md) | **NO** | NOT APPLICABLE |

## INFO (전체 25 중 본 PR 범위)

| # | 항목 | 처리 |
|---|---|---|
| I-3 | consumer 가 `maxButtons={10}` 명시 전달 가능성 | **CONFIRMED OK** — grep 결과 명시 전달 없음, default 만 사용 |
| I-7 | 동일 (I-3 중복) | OK |
| I-9 | investigation B/D/E 미체크 | **CONFIRMED FIXED** — 이미 본 PR 안에서 scope-out 명시 |
| I-11 | investigation 완료 조건 자기참조 | OK (I-9 와 함께 처리됨) |
| I-13 | maxButtons SSOT 부재 | TRACKED — packages/ 공유 상수 추출 별 follow-up |
| I-15/I-21 | buttonDefSchema 4벌 중복 | TRACKED — 별 follow-up |
| I-17 | frontend-backend 상수 SSOT | TRACKED — packages/ 추출 별 follow-up |
| I-20 | button-list-editor "5개 후 추가 버튼 비활성화" 테스트 | OOS — frontend 컴포넌트 테스트는 별 작업 |
| I-1, I-4~I-6, I-8, I-10, I-12, I-14, I-16, I-18, I-22~I-25 | 본 PR 외 변경 | NOT APPLICABLE |

## 라우터 결정

router 가 9명 선별:

- **실행**: security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, api_contract (9명)
- **제외**: performance, dependency, database, concurrency (4명)

## 후속 추적

- I-13/I-17: packages/ 공유 상수 모듈 추출 — frontend `maxButtons` ↔ backend `MAX_BUTTONS_PER_NODE` SSOT
- I-15/I-21: `buttonDefSchema` 4벌 중복을 `_shared/button.schema.ts` 로 통합
- I-20: button-list-editor 컴포넌트 "5개 후 비활성화" 테스트
- presentation-button-render-investigation 후보 1 (URL 안전성 필터), 3 (1MB output cap), 4 (id 중복), 5 (CSS) — 사용자 재현 시점에 재조사
