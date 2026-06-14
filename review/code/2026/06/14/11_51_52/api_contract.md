# API 계약(API Contract) 리뷰 결과

## 발견사항

### [WARNING] WebSocket continuation ack 응답 형식 변경 — 하위 호환성 영향
- **위치**: `codebase/backend/src/modules/websocket/websocket.gateway.ts` (`buildContinuationErrorAck`)
- **상세**: 이전 구현은 비-typed `Error` 의 `error.message` 를 그대로 `data.error` 에 전달하고 `errorCode` 는 `undefined`(미포함)였다. 변경 후에는 비-typed `Error` 에 대해 고정 fallback 메시지 + `errorCode='EXECUTION_INTERNAL_ERROR'` 를 항상 반환한다. `errorCode` 필드가 이전에 없던 케이스에서 새로 추가되므로, 클라이언트가 `errorCode` 의 **부재**를 비-typed 에러의 판별 조건으로 사용하고 있었다면 동작이 바뀐다. 또한 `data.error` 에 담기는 메시지 문자열이 `error.message` 원문에서 고정 fallback 문자열(`'Form submission failed'`, `'Message submission failed'`)로 교체되므로, 클라이언트가 이 문자열을 파싱하거나 화면에 그대로 노출하던 경우 UX가 변경된다.
- **제안**: 클라이언트 코드(`frontend/`, `channel-web-chat/`)에서 `errorCode` 부재 판별 로직 또는 `error` 문자열 직접 비교 로직이 있는지 확인하고, 있을 경우 동시 배포 또는 클라이언트 측 방어 코드(unknown errorCode 처리) 적용. 변경 사항을 클라이언트 API 문서(또는 WebSocket 이벤트 계약 spec)에 반영할 것.

### [INFO] `InvalidExecutionStateError.detail` 접근자 deprecated 처리 — 하위 호환 별칭 유지
- **위치**: `codebase/backend/src/modules/execution-engine/workflow-errors.ts` L384–387
- **상세**: 기존 `readonly detail?: string` 필드를 `get detail()` getter 별칭으로 교체하고 `@deprecated` JSDoc 을 붙였다. `detail` 을 읽는 호출자는 런타임에 동일 값을 얻으므로 breaking change 없음. 단, `detail` 에 **직접 할당**하는 코드가 있다면 setter 가 없으므로 컴파일 에러가 발생할 수 있다.
- **제안**: 프로젝트 전체에서 `.detail =` 형태의 할당이 있는지 검색 후 확인. 없다면 안전.

### [INFO] `RetryLastTurnError.detail` 동일 패턴 — 동일 분석 적용
- **위치**: `codebase/backend/src/modules/execution-engine/workflow-errors.ts` L408–411
- **상세**: `InvalidExecutionStateError` 와 동일. 읽기 접근은 하위 호환, 쓰기 접근만 주의.
- **제안**: 위와 동일.

### [INFO] `EXECUTION_MESSAGE_TOO_LONG` 에러 코드 신규 추가 — 기존 코드와의 일관성
- **위치**: `codebase/backend/src/modules/execution-engine/workflow-errors.ts` (`MessageTooLongError`)
- **상세**: `EXECUTION_MESSAGE_TOO_LONG` 코드가 `ErrorCode` enum 에 추가되었다. 이는 신규 값 추가로 기존 클라이언트에 breaking change 를 주지 않는다. continuation ack 에 `errorCode='EXECUTION_MESSAGE_TOO_LONG'` 가 surfaced 되는 케이스는 이전에는 존재하지 않았으므로(이전에는 plain Error 로 throw 되어 errorCode 미동봉), 클라이언트가 이 코드를 모르는 경우 unknown errorCode 처리 경로로 진입한다.
- **제안**: 클라이언트에서 unknown errorCode 에 대한 방어 처리(generic UI toast 등)가 구현되어 있는지 확인. `EXECUTION_MESSAGE_TOO_LONG` 에 대한 전용 UI 처리가 필요한 경우 클라이언트 측 별도 작업 필요.

### [INFO] `EXECUTION_INTERNAL_ERROR` 에러 코드 신규 surface — 이전에는 errorCode 없음
- **위치**: `codebase/backend/src/modules/websocket/websocket.gateway.ts` (비-typed Error 분기)
- **상세**: 비-typed Error 발생 시 이전에는 `errorCode` 필드가 ack 에 포함되지 않았다. 변경 후에는 `errorCode='EXECUTION_INTERNAL_ERROR'` 가 항상 포함된다. 클라이언트가 이 필드의 유무로 분기하는 로직이 있다면 영향받는다.
- **제안**: 클라이언트 코드에서 `errorCode === undefined` 조건 사용 여부 확인.

### [INFO] 에러 응답 보안 강화 — client-safe message 분리 정책 일관성
- **위치**: 전체 변경
- **상세**: `MessageTooLongError`, `InvalidExecutionStateError`, `RetryLastTurnError` 모두 `serverDetail` 에 내부 수치/식별자를 격리하고 `message` 는 고정 문자열로 유지한다. `ExecutionTimeLimitError` 는 의도적으로 `ExecutionError` 계층 밖에 남겨 continuation ack 에 직접 surface 되지 않도록 설계 경계를 명시적으로 문서화했다. 에러 응답 형식이 일관된 `{ success: false, error: string, errorCode: string }` 구조로 수렴되어 스키마 일관성이 향상되었다.

---

## 요약

이 변경은 WebSocket continuation ack 의 에러 응답 형식을 보안상 더 안전한 방향으로 개선한다. 기존에 `error.message` 를 그대로 전달하던 비-typed Error 처리를 고정 fallback 문자열 + `EXECUTION_INTERNAL_ERROR` 코드로 교체하고, `MessageTooLongError` 를 typed 에러로 승격하여 `EXECUTION_MESSAGE_TOO_LONG` 코드와 함께 client-safe 고정 메시지로 surface 한다. API 계약 관점에서 하위 호환성에 주의할 점은 두 가지다: (1) 비-typed Error 에 대한 ack 의 `error` 필드 값이 원본 `error.message` 에서 고정 fallback 문자열로 바뀌고, (2) 이전에는 없던 `errorCode` 필드가 비-typed Error 케이스에도 항상 포함되는 것. 클라이언트가 이 필드 값에 의존하는 파싱/분기 로직이 없다면 문제없으나, 클라이언트 코드 확인이 권장된다. `detail` getter 별칭은 읽기 방향 하위 호환이 유지된다.

## 위험도

LOW
