---
worktree: refactor-04-a1-eia-msglen-ba62ae (branch claude/refactor-04-a1-eia-msglen-ba62ae)
started: 2026-06-14
owner: developer
status: in-progress
---

# EIA(REST) MessageTooLongError → HTTP 400 매핑 (refactor 04 A-1 후속 I-5)

출처: A-1 typed-error(PR #598) `/ai-review`(11_51_52) I-5 + `consistency-check`(10_58_32) I2. `execution-engine-typed-errors.md` "후속 (별도 작업)" 항목.

## 문제

A-1 에서 `continueAiConversation` 의 메시지 길이 초과를 typed `MessageTooLongError` 로 전환했다. WS gateway 는 평면 ack `EXECUTION_MESSAGE_TOO_LONG` 로 surface 하지만, **EIA(REST) 진입점**(`interaction.service.dispatchContinuation`)은 `InvalidExecutionStateError` 만 매핑(409 STATE_MISMATCH)하고 그 외는 rethrow → NestJS generic **500**. 메시지 길이 초과는 client 입력 검증 실패인데 500 으로 표면돼 의미가 부정확(누출은 없음 — NestJS 가 generic 처리).

## 결정 (사용자 2026-06-14)

- **HTTP 400 `MESSAGE_TOO_LONG`** 으로 매핑. 기존 EIA empty-message 검증(`badRequest('INVALID_COMMAND')` = 400)·입력 검증 400 관행과 일관. (422 대안 기각 — EIA 입력 검증은 400 계열.)

## 작업

- [x] **spec** `14-external-interaction-api.md §5.1` 에러 표에 `400 MESSAGE_TOO_LONG` 행 추가 (내부 길이 수치 미노출 명시).
- [x] **spec** `4-execution-engine.md §7.5.2` 에 EIA 진입점 매핑 cross-ref note (InvalidExecutionStateError→STATE_MISMATCH 와 동형).
- [x] consistency-check --spec (BLOCK 게이트) — 12_27_28, BLOCK: NO
- [x] **be** `interaction.service.ts dispatchContinuation` 에 `MessageTooLongError` catch → `badRequest('MESSAGE_TOO_LONG', <고정 message>)` (400). 내부 serverDetail 미노출.
- [x] **be test** interaction.service.spec: submit_message 길이 초과 → 400 MESSAGE_TOO_LONG (message 에 수치 미포함).
- [x] **e2e** external-interaction.e2e: submit_message 10000자 초과 → 400 + code MESSAGE_TOO_LONG.
- [x] TEST + REVIEW WORKFLOW.

## 연계

- A-1 본구현: `execution-engine-typed-errors.md` (PR #598 머지). 본 작업이 그 I-5 후속을 해소.
