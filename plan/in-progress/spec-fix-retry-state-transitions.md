---
worktree: multiturn-error-preserve
started: 2026-05-30
owner: resolution-applier
---
# Spec Fix Draft — retry 재진입 관련 spec 4건 (WARNING #6/#7/#8/#9)

## 원본 발견사항

### SUMMARY#6 (요구사항 / Spec)
spec §1.1 상태 전이 표에 `failed → running` 전이 미등재 — 코드 구현과 spec 표 불일치.
위치: `spec/5-system/4-execution-engine.md` §1.1, `state-machine.ts`

### SUMMARY#7 (요구사항 / Spec)
`classifyLlmError` fallback 코드 `AI_AGENT_TURN_FAILED` 가 spec `4-nodes/3-ai/1-ai-agent.md` §10 에 미등재.
위치: `execution-engine.service.ts` `classifyLlmError`

### SUMMARY#8 (요구사항 / Spec)
cancel-during-replay(W9) 행위가 spec §1.1 / §4.2 에 미명시.
위치: `execution-engine.service.ts` replay cancel race 구현

### SUMMARY#9 (요구사항 / Spec)
retry 재진입 시 config expression 재평가 정책이 spec §1.3 / §5.5 에 미명시.
위치: `execution-engine.service.ts` `resolveRetryNodeConfig`

---

## 제안 변경

### #6 — spec/5-system/4-execution-engine.md §1.1 상태 전이 표 보완

다음 행을 `failed → running` 전이 설명 없는 현재 표에 추가:

```
| FAILED | RUNNING | allowRetryReentry=true, retry_last_turn 전용 |
```

비고: 이 전이는 일반 경로에서는 발생하지 않으며 `execution.retry_last_turn` WS 명령의
`applyRetryLastTurn` → `finalizeAiNode(opts: { retryReentry: true })` 경로에서만 허용된다.
`state-machine.ts` 의 `allowRetryReentry` opt-in 으로 하드닝됨.

### #7 — spec/4-nodes/3-ai/1-ai-agent.md §10 error code 표 보완

`AI_AGENT_TURN_FAILED` 를 fallback 코드로 추가:

```
| AI_AGENT_TURN_FAILED | 그 외 — 분류 불가 LLM 오류 | non-retryable |
```

또는 기존 `LLM_CALL_FAILED non-retryable` 행에 통합:
"기타 분류 불가 에러는 `AI_AGENT_TURN_FAILED` fallback 으로 매핑 (retryable=false)"

### #8 — cancel-during-replay 행위 명문화

spec §1.1 또는 §4.2 에 다음 행위를 추가:
"retry 재진입(`retry_last_turn`) 중 cancel 신호가 도달하면 진행 중인 replay turn 을
`Promise.race(turn, cancelSignal)` 로 조기 종료하고 Execution 을 CANCELLED 로 마감한다.
이 경우 `execution.cancelled` 이벤트가 발사되며 `execution.failed` 는 발사되지 않는다."

### #9 — retry config expression 재평가 정책 명문화

spec §1.3 또는 §5.5 (또는 `spec/4-nodes/3-ai/1-ai-agent.md` §7.9) 에 다음을 추가:
"`retry_last_turn` 재진입 시 노드 config 의 `{{ expression }}` 을 best-effort 로 재평가한다.
`$node`, `$var`, `$thread`, `$execution`, `$now` 는 rehydrated context 에서 정상 해소된다.
원본 nodeInput 을 영속하지 않으므로 (`_retryState` 최소화 정책 — node-output §4.2.1)
`$input.*` 는 미해소(documented limitation). 재평가 실패 시 raw config 로 안전 fallback.
`rawConfig` echo 는 spec config-echo 정책상 항상 raw 값을 유지한다 (spec §config-echo)."

---

## 다음 단계

`project-planner` 가 위 제안 변경을 spec 본문에 반영 후 `/consistency-check --spec` 실행.
완료 후 `resolution-applier` 재호출(같은 session_dir) — idempotency 로 코드 항목은 skip,
spec draft 적용 확인만 수행.

관련 파일:
- `spec/5-system/4-execution-engine.md` §1.1 (상태 전이 표)
- `spec/4-nodes/3-ai/1-ai-agent.md` §10 (error code 표), §7.9 (retry 행위)
- `spec/5-system/6-websocket-protocol.md` §4.2 (cancel-during-replay, config 재평가)
