---
worktree: multiturn-error-preserve-0d94b0
started: 2026-05-30
owner: resolution-applier
---
# Spec Fix Draft — retry_last_turn WS ack fields + _retryState shape

## 원본 발견사항

### SUMMARY#W1: `success` field in WS ack not in spec §4.2
WS ack 페이로드에 spec 에 없는 `success` 필드 포함 — `spec/5-system/6-websocket-protocol.md §4.2` 와 field-level 불일치.

현재 gateway 가 반환하는 실제 shape:
```json
{
  "success": true,
  "executionId": "...",
  "nodeExecutionId": "...",
  "resumed": true
}
```
또는 실패 시:
```json
{
  "success": false,
  "executionId": "...",
  "nodeExecutionId": "...",
  "resumed": false,
  "error": { "code": "RETRY_STATE_NOT_FOUND", "message": "..." }
}
```

`success` 필드가 §4.2 에 미등재. 단, 동일 파일의 다른 continuation 명령 ack 도 `success` 필드를 포함하므로 기존 convention 과는 일치함.

### SUMMARY#W2: `lastUserMessage`/`lastUserMessageSource` not in _retryState spec
`_retryState` shape 에 `lastUserMessage` / `lastUserMessageSource` 두 필드가 spec 에 정의되지 않음.

위치: `ai-agent.handler.ts buildRetryState`; `spec/conventions/node-output.md §4.2.1`, `spec/4-nodes/3-ai/1-ai-agent.md §7.9`

현재 구현이 두 필드를 JSONB 에 영속하며 `applyRetryLastTurn` 이 이를 읽어 마지막 사용자 메시지를 replay 함. Spec 에 명시적 정의가 없어 구현과 spec 사이에 갭 존재.

## 제안 변경

### W1 — spec/5-system/6-websocket-protocol.md §4.2

`execution.retry_last_turn` ack 절에 다음을 추가:

```markdown
#### ack 페이로드 (성공)

| 필드 | 타입 | 설명 |
|------|------|------|
| `success` | `boolean` | 항상 `true` (continuation 명령 공통 필드) |
| `executionId` | `string (UUID)` | 대상 실행 ID |
| `nodeExecutionId` | `string (UUID)` | 실패한 NodeExecution ID (요청 바디의 값) |
| `resumed` | `boolean` | 항상 `true` (worker handoff 성공) |

#### ack 페이로드 (실패)

| 필드 | 타입 | 설명 |
|------|------|------|
| `success` | `boolean` | 항상 `false` |
| `executionId` | `string (UUID)` | 대상 실행 ID |
| `nodeExecutionId` | `string (UUID)` | 실패한 NodeExecution ID |
| `resumed` | `boolean` | 항상 `false` |
| `error.code` | `string` | `RETRY_STATE_NOT_FOUND` / `NODE_NOT_RETRYABLE` / `RETRY_TOO_EARLY` / `INVALID_EXECUTION_STATE` / `UNAUTHENTICATED` / `NOT_FOUND` / `INTERNAL_ERROR` |
| `error.message` | `string` | 사용자 노출 안전 고정 문자열 |
```

### W2 — spec/4-nodes/3-ai/1-ai-agent.md §7.9 + spec/conventions/node-output.md §4.2.1

`_retryState` shape 정의에 두 필드 추가:

```markdown
| 필드 | 타입 | 설명 |
|------|------|------|
| `lastUserMessage` | `string \| undefined` | 실패한 turn 의 사용자 메시지 원문 (최대 500자). retry 재진입 시 replay 에 사용. |
| `lastUserMessageSource` | `'ai_message' \| 'form_submitted'` | 메시지 출처. `form_submitted` 이면 JSON 으로 파싱해 form data 로 replay. |
```

비고: `lastUserMessage` 는 `truncateForErrorDetails(500)` 로 cap 됨 (PII 최소화).
`lastUserMessage` 가 없는 경우 (`undefined`) — 옛 `_retryState` 호환을 위해 허용하며, 재진입 시 replay 없이 wait loop 에 직접 진입.
