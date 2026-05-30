---
worktree: multiturn-error-preserve-0d94b0
started: 2026-05-30
owner: resolution-applier
---
# Spec Fix Draft — retry_last_turn user-doc sync + backend-labels KO mapping

## 원본 발견사항

### SUMMARY#W14: user-guide MDX 동반 갱신 누락
`retry_last_turn` 신규 실행 흐름 — `05-run-and-debug/` MDX (에러 코드 카탈로그 + 멀티턴 AI 재시도 흐름) 동반 갱신 누락.

파일: `run-results.en.mdx`, `run-results.mdx`, `error-handling.en.mdx`, `error-handling.mdx`

누락된 에러 코드: `LLM_CALL_FAILED` (retryable 동작 설명), `RETRY_STATE_NOT_FOUND`, `NODE_NOT_RETRYABLE`, `RETRY_TOO_EARLY`
누락된 절: 멀티턴 AI 재시도 흐름 설명 (retryable error → `execution.retry_last_turn` WS 명령 → 재실행)

### SUMMARY#W15: backend-labels.ts KO 매핑 미등재
신규 에러 코드 3종(`RETRY_STATE_NOT_FOUND`, `NODE_NOT_RETRYABLE`, `RETRY_TOO_EARLY`) — `backend-labels.ts` 한국어 매핑 미등재, PR 본문 사용자 가시 노출 명시 누락.

파일: `codebase/frontend/src/lib/i18n/backend-labels.ts`

## 제안 변경

### W14 — MDX 에러 코드 카탈로그 + 멀티턴 재시도 절

`error-handling.en.mdx` / `error-handling.mdx` 에 추가할 내용:

#### 에러 코드 카탈로그 항목

```
RETRY_STATE_NOT_FOUND — Retry state not found or expired.
  발생: retry_last_turn 요청 시 _retryState 가 부재하거나 TTL(기본 60분) 초과, 또는 이미 소비됨.
  대응: 시간 내에 재시도하거나 사용자가 새 메시지를 입력해 대화를 재시작.

NODE_NOT_RETRYABLE — This node cannot be retried.
  발생: 노드가 retryable error 로 종결되지 않았거나 _retryState 미설정.
  대응: 재시도 불가 — 사용자에게 오류 안내.

RETRY_TOO_EARLY — Retry requested before the retry-after window elapsed.
  발생: retryAfterSec 카운트다운이 끝나기 전에 retry_last_turn 호출.
  대응: retryAfterSec 이후 재시도.
```

`run-results.en.mdx` / `run-results.mdx` 에 추가할 절:

```
## AI 멀티턴 재시도 (retry_last_turn)

AI Agent 노드가 retryable error (예: LLM 과부하 429) 로 종결될 때 _retryState 가
보존됩니다. 클라이언트는 `execution.retry_last_turn` WS 명령으로 마지막 사용자
메시지를 재실행할 수 있습니다 (TTL 60분 내).

ack 성공: { success: true, resumed: true }
ack 실패: { success: false, error: { code, message } }
  - RETRY_STATE_NOT_FOUND: 만료 또는 이미 소비됨
  - NODE_NOT_RETRYABLE: 해당 노드 재시도 불가
  - RETRY_TOO_EARLY: 재시도 대기 시간 미경과
```

### W15 — backend-labels.ts KO 매핑

`codebase/frontend/src/lib/i18n/backend-labels.ts` 에 추가:

```typescript
RETRY_STATE_NOT_FOUND: '재시도 상태를 찾을 수 없거나 만료되었습니다.',
NODE_NOT_RETRYABLE: '이 노드는 재시도할 수 없습니다.',
RETRY_TOO_EARLY: '재시도 대기 시간이 아직 경과하지 않았습니다.',
```

## 구현 방법

이 항목들은 user-facing docs 변경이므로 project-planner 가 스펙 절 초안 검토 후
developer 가 MDX + i18n 파일 구현. `consistency-check --spec` 선행 불필요 (doc-sync 전용).
