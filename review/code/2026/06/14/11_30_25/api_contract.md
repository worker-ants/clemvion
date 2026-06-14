# API 계약(API Contract) 리뷰

## 발견사항

### [INFO] WebSocket continuation ack 응답 스키마 변경 — 하위 호환성 분석

- 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts` `buildContinuationErrorAck`
- 상세: 기존 실패 ack 는 `{ success: false, error: string, errorCode?: string }` 에서 `errorCode` 가 `InvalidExecutionStateError` 경우에만 포함되었다. 이번 변경 후 모든 실패 ack 에 `errorCode` 필드가 추가된다 (`ExecutionError` 계열은 typed code, plain 에러는 `EXECUTION_INTERNAL_ERROR`). `errorCode` 필드는 기존에도 optional 이었고 신규로 항상 포함되는 것이므로, 기존 클라이언트가 `errorCode` 를 무시하면 호환된다. 단, 기존에 `error` 필드에 내부 메시지를 직접 활용하던 클라이언트가 있다면 breaking change 가 된다.
- 상세(breaking 여부 판단): 테스트 변경(`websocket.gateway.spec.ts` L446-460)에서 기존 assertion `expect(result.data.error).toBe('No pending continuation')` 가 `expect(result.data.error).toBe('Form submission failed')` 로 교체되었다. 이는 plain Error 의 내부 message 가 더 이상 `error` 필드에 전달되지 않고 고정 fallback 으로 대체됨을 의미한다. 이전 동작에 의존하는 클라이언트(프론트엔드 외부 WS 클라이언트)가 있다면 관찰 가능한 계약 변경이다.
- 제안: 프론트엔드(`use-execution-interaction-commands.ts`)는 동시에 `errorCode` 기반 localization 으로 전환되어 `error` 필드 직접 의존을 제거하므로 내부 클라이언트는 정합하다. 외부 WS 클라이언트(채널 웹챗 SDK 등)가 있다면 변경 노출 여부 확인 권장.

### [INFO] 에러 응답 형식 — 두 가지 에러 구조 혼재

- 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts`, `codebase/backend/src/nodes/core/error-codes.ts`
- 상세: continuation ack 에러는 평면(flat) 구조 `{ success: false, error: string, errorCode?: string }` 를 사용하는 반면, retry_last_turn ack 의 에러는 중첩(nested) 구조 `{ error: { code, message } }` 를 사용한다(spec 4.2, error-codes.ts 주석 참조). 이 두 가지 에러 형식이 같은 WebSocket 채널에서 공존한다. 이번 변경은 이 비일관성을 해소하지 않고 평면 구조를 유지한다.
- 제안: 현재 변경 범위에서는 허용 가능하며 spec 7.5.2 가 이 구분을 명시적으로 인정하고 있다. 장기적으로 WS 에러 응답 형식을 단일화하는 것이 클라이언트 파싱 로직 복잡도를 줄인다.

### [INFO] 신규 에러 코드의 EIA(REST) 진입점 미정의

- 위치: `codebase/backend/src/nodes/core/error-codes.ts` (EXECUTION_INTERNAL_ERROR, EXECUTION_MESSAGE_TOO_LONG)
- 상세: 두 신규 에러 코드는 WS continuation ack 전용으로 정의되어 있다. EIA(REST) 진입점이 동일한 입력 유효성 검증 경로를 통한다면 어떤 HTTP 상태 코드와 에러 형식으로 반환할지 정의되지 않았다. consistency-check SUMMARY I2 항목과 동일 사안.
- 제안: EIA REST 경로가 `continueAiConversation` 과 동일 검증 경로를 통한다면 `MessageTooLongError` 를 HTTP 422 (Unprocessable Entity) 또는 400 으로 매핑하는 exception filter 가 필요하다. 결정 및 spec 반영 대기 상태이므로 INFO 등록.

### [INFO] 요청 검증 — MessageTooLongError 는 publisher 측 동기 검증으로 적절히 수행됨

- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` L4283
- 상세: `continueAiConversation` 에서 `message.length > MAX_MESSAGE_LENGTH` 조건으로 동기 검증 후 typed error throw 는 적절한 위치와 방식이다. client 에 실제 길이 수치가 노출되지 않고 `serverDetail` 에만 기록된다.
- 제안: 없음. 현재 구현이 spec 7.5.2 계약을 정확히 준수한다.

### [INFO] 인증/인가 — 이번 변경 미영향

- 위치: 해당 파일 전체
- 상세: 이번 변경은 에러 표면(surface) 계약만 수정하며, 엔드포인트의 인증/인가 로직, JWT 검증, IDOR guard 는 변경되지 않았다.
- 제안: 없음.

## 요약

이번 변경은 WebSocket continuation ack 의 에러 응답 계약을 "내부 메시지 누출 차단" 방향으로 강화한다. 핵심 API 계약 변경은 두 가지다: (1) plain Error 의 경우 기존에 `error` 필드에 원본 `error.message` 가 전달되던 것이 고정 fallback 문자열로 대체되고 `errorCode=EXECUTION_INTERNAL_ERROR` 가 추가된다, (2) `MessageTooLongError` 라는 신규 typed error 가 `EXECUTION_MESSAGE_TOO_LONG` 코드와 함께 ack 에 포함된다. 하위 호환성 관점에서 `errorCode` 필드 추가는 additive 이므로 문제없으나, `error` 필드 값이 내부 메시지에서 고정 fallback 으로 변경되는 것은 이전 동작에 의존하는 클라이언트에게 observable breaking change 이다. 프론트엔드 클라이언트는 동시에 `errorCode` 기반 localization 으로 전환되어 정합하며, 신규 에러 코드 2개의 EIA REST 매핑이 미정의 상태임은 INFO 수준 사안으로 후속 결정 대기가 적절하다.

## 위험도

LOW
