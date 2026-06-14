# Cross-Spec 일관성 검토 — spec/5-system/4-execution-engine.md (§7.5.2 신설)

검토 대상: 워크트리 HEAD commit `39ed7d31` 의 변경분
- `spec/5-system/4-execution-engine.md` §7.5.2 신설 + §Rationale 4개 결정점
- `spec/5-system/6-websocket-protocol.md` §4.2 ack 에러 코드 표 2행 추가

---

## 발견사항

### [WARNING] 신규 WS ack 에러 코드 2개가 3-error-handling.md §1.5 공용 카탈로그에 미등재
- **target 위치**: `spec/5-system/4-execution-engine.md` §7.5.2 / `spec/5-system/6-websocket-protocol.md` §4.2 ack 에러 코드 표
- **충돌 대상**: `spec/5-system/3-error-handling.md §1.5 WS commands 에러 코드 (도메인 spec 참조)` — §1.5 는 "공용 카탈로그 가시성을 위한 등재 목적"이라고 명시
- **상세**: target 이 신설한 `EXECUTION_INTERNAL_ERROR` 와 `EXECUTION_MESSAGE_TOO_LONG` 은 WS ack 전용 코드로 `6-websocket-protocol.md §4.2` 에 정의됐다. 그런데 동일 목적("공용 카탈로그 가시성")을 위해 존재하는 `3-error-handling.md §1.5` 표에는 두 코드가 추가되지 않았다. 기존 `INVALID_EXECUTION_STATE` / `RESUME_*` / `SERVER_SHUTTING_DOWN` 은 §1.5 에 모두 등재돼 있어, 신규 코드만 누락된 상태가 됐다. 이는 작동 불가 모순이 아니라 카탈로그 불완전(동기화 미완)이므로 WARNING 등급.
- **제안**: `spec/5-system/3-error-handling.md §1.5` 표에 두 행을 추가한다.
  - `EXECUTION_MESSAGE_TOO_LONG` — `submit_message` 메시지 최대 길이 초과, publisher 측 동기 검증(typed `ExecutionError`). SoT: WS Protocol §4.2 / 실행 엔진 §7.5.2
  - `EXECUTION_INTERNAL_ERROR` — continuation 처리 중 typed `ExecutionError` 외 내부 에러 generic fallback. ack `error` 는 고정 generic 문자열(내부 message 미전달). SoT: WS Protocol §4.2 / 실행 엔진 §7.5.2

---

### [INFO] conventions/error-codes.md 에 신규 코드 언급 없음
- **target 위치**: `spec/5-system/4-execution-engine.md` §7.5.2 — "신규 client-safe 코드는 … 중앙 `ErrorCode` enum 의 기존 `EXECUTION_*` 네임스페이스를 확장한다 (예: `EXECUTION_INTERNAL_ERROR`, `EXECUTION_MESSAGE_TOO_LONG`)"
- **충돌 대상**: `spec/conventions/error-codes.md` §1 의미 기반 명명 원칙 + §5 Rename 이력
- **상세**: target 이 `conventions/error-codes.md` 를 "안정성 정책 SoT" 로 명시 참조하면서도, 신규 코드 2개가 conventions 문서에 등재되지 않았다. 두 코드는 의미 기반 이름을 가지므로 §3 예외 대상은 아니나, 도입 배경이 conventions 에 기록되지 않았다. 심각한 충돌보다는 문서화 gap 이므로 INFO.
- **제안**: 최소 조치는 의미 기반 원칙(§1) 준수가 명확하므로 별도 등재 없이도 허용된다. 원할 경우 §5 형식으로 "신규 코드 도입 배경" 메모 추가.

---

### [INFO] EXECUTION_MESSAGE_TOO_LONG 의 EIA REST 진입점 매핑이 미정의
- **target 위치**: `spec/5-system/6-websocket-protocol.md` §4.2 ack 에러 코드 표 — `EXECUTION_MESSAGE_TOO_LONG` 은 `submit_message` WS 명령 한정으로 정의됨
- **충돌 대상**: `spec/5-system/14-external-interaction-api.md §5` 에러 코드 표 (`400 VALIDATION_FAILED`, `409 STATE_MISMATCH`, `404 EXECUTION_NOT_FOUND`, `410 EXECUTION_TERMINATED`)
- **상세**: EIA-IN-02 는 "EIA `submit_message` … WebSocket §4.2 의 동일명 명령과 의미 동일" 로 명시한다. 동일 publisher 로직을 공유하므로 EIA REST 경로에서도 동일 검증이 발동될 수 있으나, EIA §5 에러 코드 표에 해당 케이스(메시지 길이 초과)의 HTTP 상태 코드와 코드 문자열 매핑이 없다. 기능 오동작 모순은 아니나 EIA 소비자 관점에서 spec 침묵 영역이다.
- **제안**: `spec/5-system/14-external-interaction-api.md §5` 에러 코드 표에 `submit_message` 메시지 길이 초과 행 추가(`400 VALIDATION_FAILED` 또는 `422 EXECUTION_MESSAGE_TOO_LONG` — HTTP 매핑은 EIA 설계 결정 필요), 또는 target(`6-websocket-protocol.md §4.2`)에 "WS 진입점 전용 — EIA REST 경로에서의 동등 코드는 EIA §5 결정 대기" 주석 추가.

---

## 요약

target 변경(`spec/5-system/4-execution-engine.md §7.5.2` 신설 + `spec/5-system/6-websocket-protocol.md §4.2` 갱신)은 상태 머신·API 계약·RBAC·계층 책임 측면에서 기존 spec 과 직접 모순이 없다. 발견된 사항은 모두 **카탈로그 동기화 누락** 성격이다 — 신규 WS ack 코드 2개(`EXECUTION_INTERNAL_ERROR`, `EXECUTION_MESSAGE_TOO_LONG`)가 `3-error-handling.md §1.5` 공용 카탈로그에 등재되지 않았고(`§1.5` 가 이 역할을 명시적으로 선언하고 있다), EIA REST `submit_message` 경로에서 동일 검증이 발동될 때의 에러 표현이 EIA spec 에 미정의 상태다. 두 이슈 모두 기능 오동작이 아닌 문서 gap 이므로 CRITICAL/HIGH 위험 없이 WARNING 1건 + INFO 2건으로 구성된다.

## 위험도

LOW
