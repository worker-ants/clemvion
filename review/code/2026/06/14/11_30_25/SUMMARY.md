# Code Review 통합 보고서

**대상**: refactor-04-a1 — client-safe typed error 계층 도입 (ExecutionError 추상 기반 + continuation ack 보안 게이트)
**리뷰 일시**: 2026-06-14 11:30:25
**리뷰어**: security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, api_contract, user_guide_sync (10명)

---

## 전체 위험도

**LOW** — Critical 발견 없음. WARNING 3건(SPEC-DRIFT 1 + 사용자 가시 i18n 누락 1 + JSDoc 누락 1). 보안 게이트 구현 및 typed error 계층 설계 전반이 견고하며 즉각 차단 이유 없음.

---

## Critical 발견사항

해당 없음.

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| W-1 | SPEC-DRIFT | [SPEC-DRIFT] `spec/5-system/4-execution-engine.md §7.5.2` 가 main 워크트리 spec 에 부재 — worktree spec 에만 반영됨. PR 머지 시 자동 해소. 코드 수정 대상 아님. | `spec/5-system/4-execution-engine.md` (main 워크트리) | 코드 유지. spec §7.5.2 는 worktree 에 존재하며 본 PR 에 포함됨 — 머지로 자연 해결. |
| W-2 | i18n/UX | 신규 ErrorCode 2건(`EXECUTION_INTERNAL_ERROR`, `EXECUTION_MESSAGE_TOO_LONG`) 추가 시 `frontend/src/lib/i18n/backend-labels.ts` `ERROR_KO` 테이블 미갱신. frontend 가 errorCode → ERROR_KO 경로를 사용할 경우 한국어 미번역 영문 코드 노출 가능. (완화: WS continuation ack 에는 이미 고정 문자열이 실리므로 실질 노출 경로 제한적) | `codebase/frontend/src/lib/i18n/backend-labels.ts` (미갱신) | PR 본문에 두 코드의 ko 노출 경로 명시. frontend 가 ERROR_KO 조회 경로를 쓴다면 같은 PR 또는 직후 plan 에서 ko 문자열 추가. |
| W-3 | 문서화 | `buildContinuationErrorAck` 의 `fallbackMessage` 파라미터에 `@param` JSDoc 미기재 — 파라미터가 plain(non-typed) Error 에만 사용됨이 시그니처만으로 불명확. | `codebase/backend/src/modules/websocket/websocket.gateway.ts` — `buildContinuationErrorAck` | `@param fallbackMessage plain(non-typed) Error 에만 사용되는 client-side 고정 메시지` 한 줄 추가. |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| I-1 | 보안 | `serverDetail` 이 public readonly 필드이나 직렬화 방지 메커니즘 없음 — 현재 누출 경로 없으나 미래 확장 시 위험. | `workflow-errors.ts` — `ExecutionError.serverDetail` | `toJSON()` 오버라이드 또는 `@internal` JSDoc 추가 권장 (예방적). |
| I-2 | 보안 | `fallbackMessage` 파라미터가 타입 시스템으로 "고정 client-safe 문자열"을 강제하지 않음 — 현재 4종 호출부 모두 고정 문자열 사용, 실제 위험 없음. | `websocket.gateway.ts` — `buildContinuationErrorAck` | JSDoc 계약 명시 또는 string literal union 제한 고려. |
| I-3 | 아키텍처 | `ExecutionTimeLimitError` 가 `ExecutionError` 계층 밖(`extends Error`)에 남아 있어 continuation ack 에서 generic fallback으로 처리됨. 의도된 설계인지 명시 필요. | `workflow-errors.ts` — `ExecutionTimeLimitError` | continuation 경계 도달 여부 문서화 또는 spec §7.5.2 에 범위 제한 명시. 도달한다면 `ExecutionError` 흡수 검토. |
| I-4 | 아키텍처 | `ErrorCode` enum 에 WS continuation ack 전용 코드가 노드 핸들러 계층 파일(`error-codes.ts`)에 혼재. 관심사 혼재 — 현 구조에서 실용적 타협. | `codebase/backend/src/nodes/core/error-codes.ts` | 중장기적으로 `execution-engine/execution-error-codes.ts` 분리 또는 공용 패키지 이동 검토. |
| I-5 | 요구사항/API | `EXECUTION_MESSAGE_TOO_LONG` 의 EIA(REST) 진입점 에러 처리 미정의 — HTTP status/body 변환 정책 부재. (여러 reviewer 동일 관찰) | `execution-engine.service.ts`, `spec §14(EIA)` | EIA 경로 `MessageTooLongError` → HTTP 422/400 exception filter 추가 또는 spec §14 에 에러 표 추가. 후속 plan 항목화. |
| I-6 | 부작용 | `InvalidExecutionStateError.detail` / `RetryLastTurnError.detail` 이 `readonly` 필드에서 getter 로 교체되어 `JSON.stringify`, spread(`{...err}`) 시 `detail` 이 열거 불가(non-enumerable)로 누락될 수 있음. | `workflow-errors.ts` — 두 클래스의 `detail` getter | 로그/직렬화 경로에서 `err.detail` 사용 중이라면 `err.serverDetail` 또는 명시적 접근으로 전환. |
| I-7 | 부작용 | `buildContinuationErrorAck` 가 plain Error `error` 필드를 고정 fallback 으로 대체하는 behavioral change — 채널 웹챗 SDK 등 타 클라이언트 소비자가 `error` 필드를 직접 표시하는 경로 있으면 영향. | `websocket.gateway.ts`, `channel-web-chat` | 채널 웹챗 위젯 및 EIA REST 경로의 `error` 필드 소비 여부 확인. |
| I-8 | 유지보수 | `@deprecated` getter(`detail`)의 제거 시점 계획 미명시. | `workflow-errors.ts` — `detail` getter | JSDoc 에 `@deprecated since refactor-04-a1 — use {@link serverDetail}; remove after callers migrated` 추가. |
| I-9 | 유지보수 | `emitWithAck` 콜백 에러 처리 단행(`toast.error(localizeAckError(...))`)이 5개 `useCallback` 에 반복. | `use-execution-interaction-commands.ts` | `const onAckError = ...` 공통 변수 추출로 중복 제거 검토. |
| I-10 | 테스트 | `RetryLastTurnError.notRetryable` / `tooEarly` factory 메서드 테스트 미커버 — `detail` → `serverDetail` 마이그레이션이 세 factory 에 모두 영향하므로 회귀 위험. | `workflow-errors.spec.ts` | `notRetryable`, `tooEarly` factory 에 대해 message·code·serverDetail 검증 케이스 추가. |
| I-11 | 테스트 | `handleSubmitMessage` plain Error 누출 차단 케이스 미포함 — `handleSubmitForm` 에는 있으나 `handleSubmitMessage` 에는 없음. | `websocket.gateway.spec.ts` | `handleSubmitMessage` plain Error 누출 차단 케이스 추가 또는 `buildContinuationErrorAck` 격리 describe 로 통합 커버. |
| I-12 | 테스트 | `clickButton`/`clickContinue`/`endConversation` localization 경로 테스트 미커버 — `submitForm`/`sendMessage` 만 커버됨. | `use-execution-interaction-commands.test.ts` | `clickButton` 또는 `endConversation` 에 errorCode → i18n 매핑 케이스 최소 1개 추가. |
| I-13 | 테스트 | 동일 케이스 내 `continueAiConversation` 두 번 호출 — 현재 멱등하나 구조적으로 취약. | `execution-engine.service.spec.ts` | 두 assertion 을 별도 `it` 블록으로 분리하거나 에러를 변수 캡처 후 다중 assert. |
| I-14 | 아키텍처/FE | `useT()` 반환 `t` 함수 참조 안정성 미확인 — stable reference 아니면 4종 `useCallback` 불필요한 재생성 가능. | `use-execution-interaction-commands.ts` | `useT` 내부 구현에서 `t` 가 안정화됐는지 확인. |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 전 발견사항 INFO — 보안 게이트 설계 적절, 실제 취약점 없음 |
| architecture | LOW | `ExecutionTimeLimitError` 계층 밖 잔류, `ErrorCode` 관심사 혼재 (모두 INFO) |
| requirement | LOW | SPEC-DRIFT 1건(main spec 부재, 머지로 해소), INFO 3건 |
| scope | NONE | 모든 파일 범위 내, 이탈 없음 |
| side_effect | LOW | `detail` getter 열거 불가 변경, `error` 필드 behavioral change (INFO) |
| maintainability | NONE | deprecated getter 제거 시점 미명시, 콜백 반복 등 경미한 INFO |
| testing | LOW | factory 미커버, 핸들러 케이스 누락, localization 검증 부재 (INFO) |
| documentation | LOW | `fallbackMessage` `@param` 누락 (WARNING W-3), 전반 문서화 품질 우수 |
| api_contract | LOW | `error` 필드 behavioral change, EIA REST 미정의, WS 에러 형식 혼재 (INFO) |
| user_guide_sync | WARNING | ERROR_KO 한국어 매핑 2건 누락 (WARNING W-2) |

---

## 발견 없는 에이전트

- **scope**: 모든 변경 파일이 범위 내. 요청 외 변경 없음.
- **security**: Critical/WARNING 없음. 현재 코드에서 실제 취약점 없음.
- **maintainability**: WARNING/Critical 없음.

---

## 권장 조치사항

1. **(W-2) ERROR_KO 한국어 매핑 추가** — `codebase/frontend/src/lib/i18n/backend-labels.ts` `ERROR_KO` 테이블에 `EXECUTION_INTERNAL_ERROR` / `EXECUTION_MESSAGE_TOO_LONG` 한국어 문자열 추가. frontend 가 해당 경로를 사용하지 않는다면 PR 본문에 "ko 미노출" 근거 명시로 대체 가능.
2. **(W-3) `fallbackMessage` `@param` JSDoc 추가** — `buildContinuationErrorAck` 메서드에 `@param fallbackMessage plain(non-typed) Error 에만 사용` 한 줄 추가.
3. **(W-1) SPEC-DRIFT 확인** — PR 머지로 자동 해소. 별도 코드 조치 불필요.
4. **(I-3) `ExecutionTimeLimitError` 경계 명문화** — spec §7.5.2 또는 코드 주석에 "continuation ack 경로 제외" 명시.
5. **(I-10) `RetryLastTurnError` factory 테스트 보완** — `notRetryable`, `tooEarly` factory message·code·serverDetail 검증 케이스 추가.
6. **(I-11) `handleSubmitMessage` plain Error 누출 차단 테스트 추가** — `handleSubmitForm` 과 동일 수준 커버 확보.
7. **(I-12) `clickButton`/`endConversation` localization 테스트 최소 1건 추가**.
8. **(I-8) deprecated getter 제거 시점 JSDoc 명시**.
9. **(I-7) 채널 웹챗 SDK `error` 필드 소비 경로 확인** — 영향 있으면 localize 처리 추가.
10. **(I-5) EIA REST 에러 처리 후속 plan** — `MessageTooLongError` → HTTP 422/400 매핑 후속 작업 plan 항목화.

---

## 라우터 결정

라우터 사용 (`routing_status=done`).

- **실행** (10명): `security`, `architecture`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`, `api_contract`, `user_guide_sync`
- **강제 포함(router_safety)** (7명): `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing`
- **제외** (4명):

| 제외된 reviewer | 이유 |
|-----------------|------|
| performance | typed error 도입 / ack 빌더 재작성 — 성능 변경 없음 |
| dependency | 신규 외부 의존성 없음 |
| database | DB 스키마·쿼리 변경 없음 |
| concurrency | 동시성 패턴 변경 없음 |
