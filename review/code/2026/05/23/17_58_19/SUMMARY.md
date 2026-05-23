# Code Review 통합 보고서

**대상 PR**: render_form submit 흐름 — silent failure + dispatch fragility 종합 수정
**리뷰 일시**: 2026-05-23 17:58:19
**실행된 reviewer**: security, requirement, scope, side_effect, maintainability, testing, documentation, api_contract (8명)
**skip된 reviewer**: performance, architecture, dependency, database, concurrency, user_guide_sync (6명)

---

## 전체 위험도

**MEDIUM** — 기능 회귀 없음. spec-impl 책임 위치 불일치(Critical 1), 테스트 커버리지 공백, 무한 루프 방어 보강이 잔존.

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Requirement | spec §10.9 가 sentinel wrap 책임을 `continueExecution` 에 부여하지만 구현은 `'continue'` listener 에서 wrap — spec-impl 책임 위치 불일치 | `execution-engine.service.ts` `continueExecution()` vs `'continue'` listener | **구현을 spec 에 맞춤** — `continueExecution` 에서 wrap 하도록 변경, listener 는 그대로 payload forward |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Requirement | `'button_click'` dispatch 케이스가 `waitForAiConversation` 에 없음 — spec §10.9 4-케이스 표와 불일치 | execution-engine.service.ts | spec 명확화 또는 코드 case 추가 — **AI conversation 대기 중 button_click 미도달 (자연스러운 invariant) 임을 spec 에 명시 권장**. 별 plan 으로 분리. |
| 2 | Requirement | `formData ?? {}` fallback spec §10.9 미명시 | execution-engine.service.ts | spec 보강 — project-planner 위임 |
| 3 | Requirement | plan "ack 실패 시 두 작업 모두 롤백" vs 실제 "spinner 만 해제, optimistic 유지" 불일치 | plan 문서 | plan 갱신 |
| 4 | Side Effect | `submitForm` stale `turnIndex` 가능성 (연속 제출 시) | use-execution-interaction-commands.ts | `addConversationMessage` reducer 내부 산정 권장 |
| 5 | Side Effect | sentinel 없는 폴백 분기 warn log 누락 | execution-engine.service.ts unwrap | warn log 추가 |
| 6 | Side Effect | unknown action.type loop 재진입 — `maxTurns` cap 의존, skip 전용 counter 없음 | execution-engine.service.ts | unknown skip 최대 횟수 cap 추가 |
| 7 | Maintainability | sentinel 언래핑 이중 타입 단언 | execution-engine.service.ts | `FormSubmittedSentinel` type guard 추출 |
| 8 | Maintainability | `pendingContinuations` Map 타입 단언 테스트 3곳 중복 | execution-engine.service.spec.ts | `getPendings(svc)` 헬퍼 |
| 9 | Maintainability | `submitForm` `getState()` 구조 분해 패턴 불일치 with `sendMessage` | use-execution-interaction-commands.ts | 의도적 차이면 주석 |
| 10 | Maintainability | `turnIndex` 필터 `sendMessage`(user only) vs `submitForm`(user||presentation) 비대칭 | use-execution-interaction-commands.ts | `isUserInitiatedTurn()` 헬퍼 |
| 11 | Testing | `waitForAiConversation` `form_submitted` dispatch 단위 테스트 없음 | execution-engine.service.spec.ts | inject + handleAiMessageTurn 인자 검증 |
| 12 | Testing | unknown action.type warn+reenter 단위 테스트 없음 | execution-engine.service.spec.ts | logger.warn 호출 검증 케이스 |
| 13 | Testing | Form node sentinel unwrap back-compat fallback 테스트 없음 (dead code 가능) | execution-engine.service.ts L1756~1761 | 테스트 추가 또는 dead code 제거 |
| 14 | Testing | `continueExecution → listener → resolvePending` 통합 케이스 없음 | execution-engine.service.spec.ts | 통합 검증 |
| 15 | Documentation | spec §10.9 본문 + §Rationale SSOT 4-layer 목록 중복 | spec/4-nodes/6-presentation/0-common.md | §Rationale 의 목록 제거 + §10.9 cross-ref |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 처리 |
|---|----------|----------|------|
| 1 | Security | unknown action.type warn log 에 raw 값 — Log Injection 잠재 | `.slice(0, 64)` 길이 제한 |
| 2 | Security | toast.error 서버 메시지 원문 노출 — 기존 패턴 계승 | INFO 수준 |
| 3 | Security | optimistic store 에 민감 폼 필드 잔류 | 별 작업 plan |
| 4 | Requirement | plan 체크리스트 미갱신 | 본 PR close 단계 갱신 |
| 5 | Requirement | `ai-agent.handler.ts` pendingFormToolCall fallback 변경 diff 미포함 (warn log만 추가하면 충분) | 본 PR 에서 후속 commit 으로 처리 가능 |
| 6 | Scope | `submitted` unwrap 위치 Plan 명시 부족 | INFO |
| 7 | Testing | `submitForm` 중복 호출 시 `once` listener 등록 검증 없음 | 케이스 추가 |
| 8 | Testing | `presentation` 혼합 시 turnIndex 검증 없음 | 케이스 추가 |
| 9 | Testing | `Unknown error` fallback toast 미검증 | 케이스 추가 |
| 10 | Documentation | `submitForm` JSDoc 사이드이펙트 미반영 | 보강 |
| 11 | Documentation | spec anchor `#109-form-submission-...` 렌더러 호환성 | 확인 |
| 12 | API Contract | WS ack 이벤트명 `execution.form_submitted` vs `.ack` 패턴 불일치 (기존 비일관성, 본 PR 무관) | INFO |
| 13 | API Contract | WS spec `execution.submit_form` payload shape 명문화 | project-planner 위임 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | 4 INFO (Log Injection / toast 원문 / store 잔류 / formData undefined) |
| requirement | MEDIUM | **C1 (spec-impl 위치 불일치)** + W1~W3 (button_click 누락 / formData fallback / plan 롤백 기술) |
| scope | NONE | 범위 정합 |
| side_effect | MEDIUM | stale turnIndex / fallback warn 누락 / unknown loop cap |
| maintainability | LOW | type guard 추출 / 헬퍼 DRY / 비대칭 필터 |
| testing | MEDIUM | dispatch / unknown / back-compat / 통합 4가지 단위 테스트 누락 |
| documentation | LOW | SSOT 목록 중복 / plan / JSDoc |
| api_contract | NONE | 외부 wire 하위 호환 유지 |

---

## 권장 조치사항

1. **(Critical, 본 PR 내 fix)** C1 — `continueExecution` 에서 sentinel wrap 하도록 구현 변경. spec §10.9 정합. listener 는 raw payload forward 유지.
2. **(WARNING — 본 PR 내 fix)** W5, W7, W11, W12, W13, W14, W15 — 테스트 + 헬퍼 추출 + warn log + SSOT 중복 제거.
3. **(WARNING — spec/별 plan 분리)** W1, W2 — `button_click` AI conversation 무도달 invariant 명문화 / `formData ?? {}` fallback spec — project-planner 위임 권장.
4. **(WARNING — plan 갱신)** W3 — plan 문서 정합화 (PR close 단계).
5. **(WARNING — 본 PR 내 작은 refactor)** W4, W6, W8, W9, W10 — turnIndex 산정 / unknown counter / 테스트 헬퍼 / `submitForm` 패턴 통일.
6. **(INFO — 본 PR 내 작은 보강)** I1, I7, I8, I9, I10 — Log slice / 테스트 케이스 / JSDoc.
7. **(INFO — 별 작업)** I3, I12 — 민감 폼 마스킹 / ack 이벤트명 통일.

---

## 라우터 결정

`routing_status=done` (router 선별):

- **실행**: 8명
- **router_safety 강제 포함**: 7명

| 제외된 reviewer | 이유 |
|-----------------|------|
| performance | I/O / 반복 변경 없음 |
| architecture | 모듈 경계 변경 없음 |
| dependency | package 변경 없음 |
| database | 마이그레이션 변경 없음 |
| concurrency | async / 락 / 큐 변경 없음 |
| user_guide_sync | PROJECT.md 매트릭스 trigger 비해당 |
