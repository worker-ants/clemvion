## 발견사항

### INFO — `INTERNAL_ERROR` (WS §7.1) vs `EXECUTION_INTERNAL_ERROR` (신규 §7.5.2) 혼동 가능성

- **target 신규 식별자**: `EXECUTION_INTERNAL_ERROR` — §7.5.2 및 `6-websocket-protocol.md §4.2` 에 신규 도입
- **기존 사용처**: `spec/5-system/6-websocket-protocol.md` §7.1 에러 코드 표(line 882) + `/Volumes/project/private/clemvion/.claude/worktrees/refactor-04-a1-typed-errors-156e87/codebase/backend/src/modules/websocket/ws-error-codes.ts` line 19 — `INTERNAL_ERROR` 가 WS transport/auth 계층 fallback 코드로 등록되어 `retry_last_turn` 의 nested `error.code` 로 사용 중
- **상세**: 두 코드는 의미가 다르다. `INTERNAL_ERROR`(`WsErrorCode`)는 retry_last_turn 의 enqueue 실패 등 transport 계층 내부 실패이고, `EXECUTION_INTERNAL_ERROR`(신규 `ErrorCode` enum 확장)는 continuation 4종 핸들러의 plain Error fallback이다. 현재 spec §7.5.2·WS §4.2 표에 각각 문서화되어 있으나, §7.1 의 `INTERNAL_ERROR` 행 설명이 "서버/transport 내부 실패(enqueue 실패 등)"로 되어 있어, 독자가 `EXECUTION_INTERNAL_ERROR`와 같은 개념으로 혼동할 여지가 있다. WS §7.1 표는 코드 소속 enum(`WsErrorCode` vs `ErrorCode`)이 다름을 명시하지 않아 표 범위가 모호하다.
- **제안**: WS §7.1 표에 `INTERNAL_ERROR` 행에 "(`WsErrorCode` — retry_last_turn 전용, continuation 4종의 `EXECUTION_INTERNAL_ERROR`와 별개)" 주석을 추가해 두 코드의 scope 분리를 명확히 한다. 의미 충돌은 없으므로 이름 변경 불필요.

---

### INFO — `ExecutionError` 추상 클래스명 신규 도입 — 기존 `CodeExecutionError`와 prefix 유사

- **target 신규 식별자**: `ExecutionError` 추상 기반 클래스 (`spec/5-system/4-execution-engine.md §7.5.2`)
- **기존 사용처**: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-04-a1-typed-errors-156e87/codebase/backend/src/nodes/data/code/code.handler.ts` line 129에 `CodeExecutionError` 인터페이스가 정의됨
- **상세**: `CodeExecutionError`는 Code 노드 핸들러 내부 전용 인터페이스(`interface CodeExecutionError extends Error`)이며 외부에 export되지 않는다. `ExecutionError`는 `workflow-errors.ts`에 신설될 추상 기반 클래스로, 두 이름은 suffix/prefix가 반전된 형태라 혼동 여지가 있으나 실질 충돌은 없다. 두 타입은 완전히 다른 파일에 선언되고 용도도 분리된다.
- **제안**: 실질 충돌 없음. `ExecutionError` 도입 시 코드베이스 내 다른 `*ExecutionError*` 네이밍이 없음을 확인했으므로 그대로 진행 가능.

---

### INFO — `EXECUTION_INTERNAL_ERROR`·`EXECUTION_MESSAGE_TOO_LONG` 가 `3-error-handling.md §1.5` WS 코드 카탈로그에 미등재

- **target 신규 식별자**: `EXECUTION_INTERNAL_ERROR`, `EXECUTION_MESSAGE_TOO_LONG`
- **기존 사용처**: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-04-a1-typed-errors-156e87/spec/5-system/3-error-handling.md` §1.5 WS commands 에러 코드 카탈로그 — 현재 `INVALID_EXECUTION_STATE`, `RESUME_CHECKPOINT_MISSING`, `RESUME_FAILED`, `RESUME_INCOMPATIBLE_STATE`, `SERVER_SHUTTING_DOWN` 만 등재됨
- **상세**: §7.5.2와 WS §4.2 표에는 두 신규 코드가 추가됐으나 `3-error-handling.md §1.5` 에는 아직 반영되지 않았다. `§1.5` 는 WS ack 전용 코드의 공용 가시성 카탈로그 목적이므로 누락 시 에러 핸들링 spec의 단일 진실이 불완전해진다. 기능적 충돌은 없고 문서 누락이다.
- **제안**: `3-error-handling.md §1.5` 에 `EXECUTION_INTERNAL_ERROR` (도메인 SoT: 실행 엔진 §7.5.2)와 `EXECUTION_MESSAGE_TOO_LONG` (도메인 SoT: WS §4.2) 행을 추가한다.

---

## 요약

target(`spec/5-system/4-execution-engine.md §7.5.2`)이 도입하는 신규 식별자 — `EXECUTION_INTERNAL_ERROR`, `EXECUTION_MESSAGE_TOO_LONG`, `ExecutionError` 추상 기반 — 는 기존 식별자와 의미 충돌이 없다. `ErrorCode` enum의 `EXECUTION_*` 네임스페이스 내 확장이며, 기존에 동일한 이름을 가진 공개 식별자는 존재하지 않는다. 단, WS §7.1의 `INTERNAL_ERROR`(`WsErrorCode`)와 신규 `EXECUTION_INTERNAL_ERROR`(`ErrorCode`) 사이의 역할 구분이 현재 문서에서 명시되지 않아 독자 혼동 가능성이 있고, `3-error-handling.md §1.5` WS 코드 카탈로그에 신규 코드 미등재 누락이 있다. 두 항목 모두 INFO 수준 보완 사항이며 블로킹 충돌은 없다.

## 위험도

LOW
