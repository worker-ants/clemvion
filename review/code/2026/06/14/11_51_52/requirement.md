# 요구사항(Requirement) 리뷰 결과

**대상**: refactor-04-a1-typed-errors — ExecutionError typed error 체계 + 누출 차단 ack 정책
**Spec 참조**: `spec/5-system/4-execution-engine.md §7.5.2`, `spec/5-system/6-websocket-protocol.md §4.2`

---

## 발견사항

### [INFO] endConversation errorCode 로컬라이제이션 테스트 커버리지 없음
- **위치**: `/codebase/frontend/src/lib/websocket/__tests__/use-execution-interaction-commands.test.ts` — I-12 섹션(`clickButton errorCode localization` describe)
- **상세**: 변경된 테스트 파일은 `clickButton`의 localization path를 I-12로 커버하지만 `endConversation`에 대한 동등한 테스트가 없다. 구현(`use-execution-interaction-commands.ts` L267)은 `endConversation`에도 `localizeAckError(t, error, errorCode)`를 올바르게 적용했다. 기능 버그가 아니라 테스트 격차.
- **제안**: `endConversation errorCode localization` 케이스를 I-12 describe 블록에 추가. 기능적 영향 없으나 §7.5.2 "4종 continuation 핸들러" 항목의 테스트 완전성 개선.

### [INFO] `ExecutionTimeLimitError` — ack 경로 도달 가능성 시나리오 미테스트
- **위치**: `codebase/backend/src/modules/websocket/websocket.gateway.spec.ts`
- **상세**: spec §7.5.2와 코드 주석(L179–186)은 `ExecutionTimeLimitError`가 continuation ack 동기 경로에 "도달하지 않는다"는 설계 경계를 선언하고 있다. 그러나 도달할 경우 `buildContinuationErrorAck`의 plain Error 분기가 generic fallback + `EXECUTION_INTERNAL_ERROR`로 축약함을 검증하는 테스트는 없다. 현재 구조가 맞게 동작하므로 INFO이지만, 설계 경계의 테스트 증거를 남기면 향후 회귀 방지에 도움.
- **제안**: 옵션. gateway.spec.ts에 `ExecutionTimeLimitError`가 throw될 때 generic fallback + `EXECUTION_INTERNAL_ERROR`로 ack되는지 검증 케이스 추가.

### [INFO] `InvalidExecutionStateError.code` 리터럴 vs `RetryLastTurnError`·`MessageTooLongError`의 `ErrorCode` enum 값 — 패턴 혼재
- **위치**: `codebase/backend/src/modules/execution-engine/workflow-errors.ts` L91
- **상세**: spec §7.5.2는 `INVALID_EXECUTION_STATE`를 "prefix 없는 시스템 레벨 코드"로 명시적으로 허용한다. 기능 영향 없음. 단, `MessageTooLongError`가 `ErrorCode.EXECUTION_MESSAGE_TOO_LONG`을 사용하는 것과 비교해 패턴이 혼재한다.
- **제안**: 현재 상태 유지 가능. 향후 `InvalidExecutionStateError`를 `ErrorCode` enum에 등재하는 경우 일관성을 맞출 수 있다.

---

## 기능 완전성 평가

### ExecutionError 추상 기반 (`workflow-errors.ts`)
- `{ code, message, serverDetail? }` 세 필드 계약이 `abstract class ExecutionError`에 정확히 구현됨.
- `InvalidExecutionStateError`·`RetryLastTurnError`가 `ExecutionError`로 흡수되며 기존 `.detail` 필드는 `serverDetail` 별칭으로 하위 호환 유지(`@deprecated` 표시).
- `MessageTooLongError`가 spec §7.5.2 및 WS Protocol §4.2 표에 명시된 `EXECUTION_MESSAGE_TOO_LONG` 코드와 고정 client-safe 메시지("Message exceeds the maximum allowed length.")로 구현됨.
- `actualLength` 미전달 시 `serverDetail`이 `max=<n>` 형식으로 설정되는 선택적 생성자 패턴이 테스트로 검증됨.

### buildContinuationErrorAck 재작성 (`websocket.gateway.ts`)
- `instanceof ExecutionError` 분기: `error.message`(고정 client-safe) + `error.code` → ack 반영, `serverDetail` 존재 시 `logger.warn`만.
- `plain Error / unknown` 분기: 호출부 지정 `fallbackMessage` + `EXECUTION_INTERNAL_ERROR` → ack 반영, 원본 `message`/stack은 `logger.warn`만.
- 4종 continuation 핸들러(`submit_form`, `click_button`, `submit_message`, `end_conversation`) 모두 `buildContinuationErrorAck` 경유 확인됨.
- spec §7.5.2 표(typed/plain 두 행)와 구현이 line-level로 일치.

### 프론트엔드 localization
- `EXECUTION_INTERACTION_ERROR_CODE_TO_I18N` 맵이 `INVALID_EXECUTION_STATE`·`EXECUTION_MESSAGE_TOO_LONG`·`EXECUTION_INTERNAL_ERROR` 3개 코드를 커버.
- `Object.prototype.hasOwnProperty` 가드로 prototype 오염 방지 확인.
- 5종 명령(submitForm, clickButton, clickContinue, sendMessage, endConversation) 모두 `localizeAckError(t, error, errorCode)` 적용 완료.
- `interactionError.{invalidState, messageTooLong, internalError}` KO/EN dict 쌍 추가됨.

### Spec fidelity (line-level 대조)

| 구현 요소 | Spec 위치 | 일치 여부 |
|---|---|---|
| `ExecutionError { code, message, serverDetail? }` | §7.5.2 "ExecutionError 추상 기반" | 일치 |
| typed ack: `{ error: message, errorCode: code }` | §7.5.2 표 1행 | 일치 |
| plain ack: 고정 generic + `EXECUTION_INTERNAL_ERROR` | §7.5.2 표 2행 | 일치 |
| `serverDetail` → 서버 로그 전용 | §7.5.2 "서버 로그 전용" | 일치 |
| `EXECUTION_MESSAGE_TOO_LONG` max=10000자 | WS §4.2 표 "최대 길이(10000자)" | 일치 (`MAX_MESSAGE_LENGTH = 10_000`) |
| `MessageTooLongError` 고정 메시지 | §7.5.2 "고정 client-safe 영문 문자열" | 일치 |
| frontend `code → i18n key` 맵 | §7.5.2 "frontend가 code→i18n key로 localize" | 일치 |
| 미매핑 code → backend 영문 `error` fallback | §7.5.2 "미매핑 code는 generic fallback" | 일치 |
| `ExecutionTimeLimitError` — `ExecutionError` 계층 밖 유지 | §7.5.2 "dispatch loop sentinel, ack 경로 미도달" | 일치 (의도적 설계) |

---

## 엣지 케이스

- `MessageTooLongError(maxLength, undefined)`: `serverDetail = 'max=10000'` — 테스트로 검증됨.
- `getExecutionInteractionErrorI18nKey(null/undefined/"")`: `null` 반환 — 테스트로 검증됨.
- `getExecutionInteractionErrorI18nKey("toString")` prototype 오염 방지 — 테스트로 검증됨.
- `unknown` (non-Error) throw: `String(error)`로 서버 로그 기록 — 코드에 반영됨.
- 매핑 없는 errorCode: backend 영문 `error` 문자열 fallback — 테스트로 검증됨.

---

## TODO/FIXME

변경 파일 내 TODO/FIXME/HACK/XXX 주석 없음. `@deprecated` 표시는 의도적 마이그레이션 안내이며 미완성 작업이 아님.

---

## 요약

이 변경은 `ExecutionError` 추상 기반 도입, `buildContinuationErrorAck` 재작성(typed/plain 이중 분기 + 보안 게이트), `MessageTooLongError` 신규 typed 에러 추가, frontend localization 파이프라인 구축의 4가지 핵심 요소를 완전히 구현했다. spec §7.5.2 및 WS Protocol §4.2의 typed/plain 분기 계약, client-safe 고정 메시지·serverDetail 분리 정책, 보안 게이트(내부 message 미전달)가 코드 수준에서 line-level로 spec과 일치한다. `InvalidExecutionStateError`·`RetryLastTurnError`의 `ExecutionError` 흡수와 `.detail` 별칭 하위 호환도 적절히 처리됐다. 발견된 사항은 모두 INFO 수준이며 기능적 결함이나 spec 불일치는 없다.

---

## 위험도

NONE
