# Rationale 연속성 검토 결과

검토 대상: `spec/5-system/` (refactor-04-a1-typed-errors-156e87 worktree)
검토 모드: 구현 완료 후 검토 (--impl-done, scope=spec/5-system/, diff-base=origin/main)

---

## 발견사항

이번 diff 에서 target 이 기존 Rationale 에서 명시적으로 기각된 대안을 재도입하거나 합의된 원칙을 위반하는 사례는 발견되지 않았다.

---

### 점검 관점 1: 기각된 대안의 재도입

**[INFO]** `EXEC_*` prefix 신설 기각과 `EXECUTION_*` 네임스페이스 확장 선택 — Rationale 정합

- target 위치: `spec/5-system/4-execution-engine.md §7.5.2` 본문 + `## Rationale "Continuation ack client-safe typed error"` 항목 1
- 과거 결정 출처: `spec/conventions/error-codes.md §1·§2` — 명명 안정성·의미 기반 명명. 기존 `EXECUTION_*` 패턴(`EXECUTION_TIME_LIMIT_EXCEEDED`, `EXECUTION_TIMEOUT` 등).
- 상세: 신규 `EXEC_*` prefix 는 기존 `EXECUTION_*` 과 이중 표기라는 명시적 이유로 기각됐다. `error-codes.md` 의 도메인 prefix 안정성 원칙과 정합한다. 기각 이유가 Rationale 에 명기돼 있다.
- 제안: 이상 없음.

**[INFO]** backend i18n 레이어 신설 기각 — 선행 명시 결정 없으나 기존 선례와 정합

- target 위치: `spec/5-system/4-execution-engine.md §7.5.2` 본문 및 Rationale 항목 2
- 과거 결정 출처: 기존 `integration-error-codes` 패턴 — frontend 가 `code → i18n key` 맵으로 처리하는 것이 기정 선례.
- 상세: backend i18n 레이어 신설은 인프라 부재·비용으로 기각됐으며, 이는 기존 선례(`integration-error-codes`)의 일반화다. 기각 이유가 명시됐고 기존 패턴을 번복하지 않는다.
- 제안: 이상 없음.

**[INFO]** 전수 `ExecutionError` 전환 기각 — 경계(boundary)만 적용 결정

- target 위치: `spec/5-system/4-execution-engine.md §7.5.2` 본문 및 Rationale 항목 3
- 과거 결정 출처: 기존 Rationale 에 전수 전환 관련 선행 결정 없음(신규 결정 범위).
- 상세: 전수 전환(~15곳)은 대형·저가치·회귀 위험으로 기각됐으며 경계 한정 적용을 선택했다. 기각 이유가 명시됐다.
- 제안: 이상 없음.

---

### 점검 관점 2: 합의된 원칙 위반

**[INFO]** `WebsocketService` 단일 sink 정책 — 영향 없음

- target 위치: 신규 `spec/5-system/4-execution-engine.md §7.5.2` 는 WS ack 빌더의 에러 변환 정책이다.
- 과거 결정 출처: `spec/5-system/4-execution-engine.md §Rationale "이벤트 발행 sink — WebsocketService 단일 sink"`.
- 상세: §7.5.2 는 sink 추상화(IExecutionEventEmitter 등)를 도입하지 않는다. WebsocketService 경유 단일 emit 원칙을 변경하지 않는다.
- 제안: 이상 없음.

**[INFO]** always-enqueue 원칙("항상 BullMQ enqueue") — 영향 없음

- target 위치: `spec/5-system/4-execution-engine.md §7.5.2`.
- 과거 결정 출처: `spec/5-system/4-execution-engine.md §Rationale "Durable Continuation & Graceful Shutdown — Sticky fast-path 제거"` 및 `spec/5-system/6-websocket-protocol.md §Rationale "resumed 의미 재정의"`.
- 상세: §7.5.2 의 typed/plain Error 분기는 ack payload 필드 값 결정에 국한되며, publish 경로(항상 BullMQ enqueue)를 변경하지 않는다. 동기 ack 는 여전히 enqueue 수락 신호다.
- 제안: 이상 없음.

**[INFO]** `INVALID_EXECUTION_STATE` / WS-vs-REST 코드 분리 원칙 — 유지됨

- target 위치: `spec/5-system/4-execution-engine.md §7.5.1·§7.5.2` 및 `spec/5-system/6-websocket-protocol.md §4.2` 신규 행.
- 과거 결정 출처: `spec/5-system/4-execution-engine.md §Rationale "2. INVALID_EXECUTION_STATE — WS/REST 이름 분리 유지"`.
- 상세: 신규 `EXECUTION_INTERNAL_ERROR`·`EXECUTION_MESSAGE_TOO_LONG` 은 `ErrorCode` enum(WS continuation 평면 ack 경로)에 추가되고, `WsErrorCode` 의 transport 레벨 `INTERNAL_ERROR` 와 별개 scope 로 명시됐다. WS와 REST 코드 분리 원칙을 침해하지 않는다.
- 제안: 이상 없음.

**[INFO]** 동기/비동기 직교 분류 invariant — 준수됨

- target 위치: `spec/5-system/4-execution-engine.md §7.5.2` 마지막 callout 및 Rationale "선례 정합" 항목.
- 과거 결정 출처: `spec/5-system/4-execution-engine.md §Rationale "RESUME_* 동기 ack 노출 폐기 — 후행 execution.cancelled 이벤트로 일원화"`.
- 상세: §7.5.2 는 "worker 측 비동기 실패(`RESUME_*`, §7.5.1)는 본 동기 ack 변환 경로 밖이다"라고 명시해 직교 분류 invariant 를 침해하지 않는다. `RESUME_*` 이벤트 빌더에의 동일 원칙 적용은 "후속 점검 항목"으로 defer 됐으나 이는 scope 한정 기술이며 invariant 위반이 아니다.
- 제안: 이상 없음.

---

### 점검 관점 3: 결정의 무근거 번복

없음. 추가된 Rationale 항목들("Continuation ack client-safe typed error — 내부 메시지 누출 차단 (§7.5.2, 2026-06-14 결정)")은 신규 결정이다. 기각된 대안 4점 모두 이유와 함께 명시됐다. 기존 Rationale 결정 중 번복된 항목은 없다.

`spec/5-system/3-error-handling.md` 에 신규 추가된 에러 코드 카탈로그 행(`EXECUTION_MESSAGE_TOO_LONG`, `EXECUTION_INTERNAL_ERROR`)은 기존 카탈로그 원칙(의미 기반 명명, `EXECUTION_*` 네임스페이스)과 부합하며 기존 결정을 번복하지 않는다.

`spec/5-system/6-websocket-protocol.md §4.2` 에 신규 추가된 에러 코드 행과 누출 차단 callout 은 기존 §4.2 의 평면 ack 구조(4개 continuation 명령)·nested ack 구조(`retry_last_turn`) 분리 결정을 변경하지 않는다 — 신규 코드는 기존 평면 `errorCode` 필드로 전달되는 것이 명시돼 있다.

---

### 점검 관점 4: 암묵적 가정 충돌

**[INFO]** `retry_last_turn` 의 nested `error.code` vs 4개 continuation 명령의 평면 `errorCode` 분리 — 유지됨

- target 위치: `spec/5-system/6-websocket-protocol.md §4.2` 신규 에러 코드 행 및 누출 차단 callout.
- 과거 결정 출처: `spec/5-system/6-websocket-protocol.md §7.1·§7.2` — `retry_last_turn` 은 nested `error: { code, message }`, 4개 continuation 명령은 평면 `{ success, error, errorCode? }` 구조.
- 상세: 신규 `EXECUTION_INTERNAL_ERROR`·`EXECUTION_MESSAGE_TOO_LONG` 은 평면 `errorCode` 경로에만 추가됐으며, `retry_last_turn` 의 nested `error.code`(`WsErrorCode`) 와의 scope 분리가 §7.1 표 비고에 명시됐다. 기존 양 구조의 분리 가정이 침해되지 않는다.
- 제안: 이상 없음.

**[INFO]** `ExecutionTimeLimitError` 의 `ExecutionError` 미상속 — 의도된 설계, spec 선례 목록과 경미한 불일치

- target 위치: `spec/5-system/4-execution-engine.md §7.5.2` "선례 정합" 항목 + 코드 `workflow-errors.ts`
- 과거 결정 출처: §8 (타임아웃 정책). 코드 fix 커밋에서 `ExecutionTimeLimitError` 가 `ExecutionError` 미상속임을 JSDoc 으로 명시했다.
- 상세: spec §7.5.2 본문이 `ExecutionTimeLimitError` 를 "선례"로 열거하나, 실제 코드는 `ExecutionError` 비상속 상태다. 단 `ExecutionTimeLimitError` 는 continuation ack 경로에 미도달(worker 측 `execution.failed` 경로)하므로 §7.5.2 의 typed/plain 분기 적용 범위 밖이며, 기능 정합성·보안 게이트에는 영향이 없다.
- 제안: spec §7.5.2 의 "선례" 목록에서 `ExecutionTimeLimitError` 가 아직 `ExecutionError` 기반이 아님을 괄호로 명기하거나("점진 흡수 예정"), 또는 실제로 `ExecutionError` 를 상속시켜 spec 과 코드를 일치시키는 후속 작업을 plan 에 등재하는 것을 권장한다. 기능·보안에는 영향 없는 문서 정합성 사항이다.

---

## 요약

이번 diff(`spec/5-system/4-execution-engine.md`, `spec/5-system/3-error-handling.md`, `spec/5-system/6-websocket-protocol.md`)가 도입한 변경은 신규 §7.5.2 본문(continuation ack typed `ExecutionError` 계약 정의 및 누출 차단 정책)과 대응 Rationale 항목 추가, 에러 코드 카탈로그·WS 프로토콜 표 갱신이 전부다. 신규 결정은 기존 Rationale 에서 명시적으로 기각된 대안(per-node task queue, `_continuationCheckpoint` 컬럼, sticky fast-path, WS/REST 코드 통일 등)을 재도입하지 않으며, 합의된 설계 원칙(단일 sink 정책, always-enqueue 원칙, 동기/비동기 직교 분류, WS/REST 코드 분리, error-codes 명명 안정성)을 모두 준수한다. 기각된 대안 4점 모두 이유가 Rationale 에 명시돼 있어 무근거 번복도 없다. `ExecutionTimeLimitError` 의 `ExecutionError` 미상속이 spec 선례 목록 기술과 경미하게 불일치하나, 해당 클래스가 continuation ack 경로에 미도달해 보안·동작 정합성에는 영향이 없는 문서 정합성 사항이다.

---

## 위험도

NONE
