# 신규 식별자 충돌 검토 결과

검토 모드: `--impl-done` (구현 완료 후 검토)
대상 diff: `spec/5-system/3-error-handling.md`, `spec/5-system/4-execution-engine.md`, `spec/5-system/6-websocket-protocol.md` (vs origin/main)

---

## 발견사항

### 1. WARNING — `EXECUTION_INTERNAL_ERROR` 와 `INTERNAL_ERROR` (WsErrorCode) 의 scope 혼동 가능성

- **target 신규 식별자**: `EXECUTION_INTERNAL_ERROR` — `ErrorCode` enum 에 추가 예정인 WS continuation ack 전용 코드. `spec/5-system/3-error-handling.md §1.5` 와 `spec/5-system/4-execution-engine.md §7.5.2` 에 등재.
- **기존 사용처**: `INTERNAL_ERROR` — `/Volumes/project/private/clemvion/codebase/backend/src/modules/websocket/ws-error-codes.ts` line 19 의 `WsErrorCode` enum, `websocket.gateway.ts` line 822·850, `spec/5-system/3-error-handling.md §1.1` (HTTP 5xx 기본 코드), `spec/5-system/6-websocket-protocol.md §5 WsErrorCode 표`.
- **상세**: `WsErrorCode.INTERNAL_ERROR` 는 transport-레벨 실패(enqueue 실패·`retry_last_turn` nested `error.code`)용이고, 신규 `EXECUTION_INTERNAL_ERROR` 는 continuation 4종 핸들러 평면 ack `errorCode` 필드 전용이다. 두 코드는 의미·레이어가 다르고 발행 경로도 다르나 이름이 유사해 혼동 여지가 있다. target 의 `spec/5-system/6-websocket-protocol.md §5` 표에 `INTERNAL_ERROR` 행에 "EXECUTION_INTERNAL_ERROR 와 별개 scope" 주석이 이미 추가돼 완화되고 있다.
- **제안**: 현행 방향(스펙 주석으로 scope 분리 명시)은 적절하다. 구현 시 `buildContinuationErrorAck` 가 `WsErrorCode.INTERNAL_ERROR` 와 명시적으로 다른 문자열 `'EXECUTION_INTERNAL_ERROR'` 를 사용하고 `ws-error-codes.ts` 주석에 양자 분리를 명시하면 충분하다.

---

### 2. INFO — `ExecutionError` 추상 기반 클래스명과 기존 `CodeExecutionError` 의 접두어 유사

- **target 신규 식별자**: `ExecutionError` — spec §7.5.2 가 도입하는 추상 기반 클래스 (`{ code, message, serverDetail? }`). `InvalidExecutionStateError`·`RetryLastTurnError`·`ExecutionTimeLimitError` 가 점진적으로 흡수될 예정.
- **기존 사용처**: `CodeExecutionError` — `/Volumes/project/private/clemvion/codebase/backend/src/nodes/data/code/code.handler.ts` line 129 의 `interface CodeExecutionError extends Error`. isolated-vm 런타임 분류 내부 인터페이스, 클라이언트 미노출.
- **상세**: 레이어(내부 분류 vs client-boundary 추상 기반)와 파일 위치가 달라 직접 충돌은 없다. IDE 자동완성에서 접두어 유사로 혼동될 수 있는 수준의 WARNING 미만 정보성 항목이다.
- **제안**: 신규 `ExecutionError` 클래스 파일을 `execution-engine/error/` 하위에 두고 `CodeExecutionError` 는 `code.handler.ts` 내부로 격리 유지하면 충분하다. 이름 변경 불필요.

---

### 3. INFO — 신규 `§7.5.2` 앵커 — 기존 번호 충돌 없음

- **target 신규 식별자**: `spec/5-system/4-execution-engine.md` 의 `### 7.5.2` 섹션 및 앵커 `#752-continuation-ack-에러-표면--typed-executionerror-와-내부-메시지-누출-차단`.
- **기존 사용처**: origin/main 기준 `4-execution-engine.md` 에는 `7.5.1` 까지만 존재. 다른 spec 파일에서 `§7.5.2` 를 참조하는 기존 링크 없음.
- **상세**: 충돌 없음. 신규 앵커를 참조하는 링크(`3-error-handling.md §1.5`, `6-websocket-protocol.md §4.2`)가 동일 diff 내에서 함께 추가돼 정합한다.
- **제안**: 이상 없음.

---

### 4. INFO — `EXECUTION_MESSAGE_TOO_LONG` 및 `MessageTooLongError` — 기존 사용처 없음

- **target 신규 식별자**: `EXECUTION_MESSAGE_TOO_LONG` (에러 코드), `MessageTooLongError` (typed ExecutionError 구현체).
- **기존 사용처**: 코드베이스(`codebase/`) 및 전체 spec(`spec/`) 에서 해당 문자열의 기존 사용 없음 — 완전 신규 도입.
- **상세**: 충돌 없음. `EXECUTION_*` 네임스페이스에 일관하게 배치된다.
- **제안**: 이상 없음.

---

## 요약

이번 diff 가 도입하는 신규 식별자(`EXECUTION_INTERNAL_ERROR`, `EXECUTION_MESSAGE_TOO_LONG`, `ExecutionError` 추상 기반, `§7.5.2` 앵커, `MessageTooLongError`)는 모두 진성 충돌(동일 식별자·다른 의미)이 없다. `EXECUTION_INTERNAL_ERROR` 가 기존 `WsErrorCode.INTERNAL_ERROR` 와 이름이 유사해 scope 혼동 가능성이 있으나, target spec 이 이미 `6-websocket-protocol.md §5` 표에 "별개 scope" 주석을 추가해 완화하고 있어 WARNING 수준으로 관리 가능하다. `ExecutionError` 추상 클래스명과 기존 `CodeExecutionError` 내부 인터페이스는 레이어와 파일이 달라 실질적 충돌 없다. 전체적으로 식별자 충돌 위험은 낮다.

## 위험도

LOW
