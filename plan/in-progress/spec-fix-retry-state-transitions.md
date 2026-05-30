---
worktree: multiturn-error-preserve-0d94b0
started: 2026-05-30
owner: project-planner
---
# Spec Fix Draft — retry 재진입 관련 spec 4건 (WARNING #6/#7/#8/#9)

> **상태 (2026-05-30): `/consistency-check --spec` BLOCK: YES** — 본 draft 의 제안
> 변경은 그대로 적용할 수 없다. Critical 1 + WARNING 6건 (아래 `## Consistency-check
> 결과`). 에러 코드 taxonomy·전이 레벨(Execution vs NodeExecution)·config 재평가 vs
> rawConfig snapshot 정책은 **project-planner 의 spec 설계 결정**이 선행돼야 한다.
> 코드는 이미 구현·테스트 완료(spec 준수 동작) 이며 본 draft 는 spec **문서 동기화**
> 목적이다. 적용 후 본 plan 의 `## 제안 변경` 섹션은 제거한다 (단일 진실 원칙).

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
원본 nodeInput 을 영속하지 않으므로 (`_retryState` 는 turn 직전 `_resumeState` snapshot 에서
파생되어 실패 turn 의 nodeInput 을 포함하지 않음 — node-output §4.2.1 보존 예외)
`$input.*` 는 미해소(documented limitation). 재평가 실패 시 raw config 로 안전 fallback.
`rawConfig` echo 는 항상 raw 값을 유지한다 (CONVENTIONS Principle 7 — config echo)."

> **⚠ Consistency WARNING #2**: config 재평가가 `rawConfig` frozen snapshot(replay
> reproducibility) 정책과 의미 충돌 소지. project-planner 는 §5.5 표현식 해석 단계 /
> §6.1 rawConfig snapshot 정책과 대조해 재진입 시 config 공급 경로를 명기할 것.

---

## Consistency-check 결과 (2026-05-30, BLOCK: YES — `review/consistency/2026/05/30/12_59_42/SUMMARY.md`)

project-planner 가 spec 반영 전 선결해야 할 설계 결정:

- **[Critical] #7 AI_AGENT_TURN_FAILED taxonomy**: 본 코드는 `classifyLlmError` 의 분류 불가 fallback 으로 `AI_AGENT_TURN_FAILED`(non-retryable)를 **이미 throw** (execution-engine.service.ts; W12 이전부터 존재한 동작). 그러나 spec §10 / node-output §3.2 미등재이고 `LLM_CALL_FAILED` 와 역할 중복. 결정 필요: (a) `LLM_CALL_FAILED` non-retryable sub-case 로 통합, (b) `LLM_` prefix 로 rename(예: `LLM_UNKNOWN`) 후 등재, (c) `node-output §3` 에 "fallback code" 범주 신설. 어느 안이든 `LLM_CALL_FAILED` 와의 경계를 §10 에 명문화. **(b)/(c) 는 코드 변경 동반.**
- **[Warning] #6 전이 레벨**: 코드는 retry 성공 종결 시 Execution.status 를 FAILED→RUNNING→COMPLETED 로 전이(state-machine W5 opt-in)하고, 동시에 새 NodeExecution row 를 spawn 한다. checker 는 §1.1 표에 단순히 `failed→running` 행만 추가하면 "Execution entity 전이 vs NodeExecution row spawn" 혼동을 일으킨다고 지적. → §1.1 행 추가 시 "retry_last_turn 전용, allowRetryReentry opt-in" 비고 + §1.2 에 "기존 row 미전이, 새 row pending→running spawn" 비고를 함께 명기. (§Rationale 의 `WFI→running→failed` 2단계 기각 결정과 별개 경로임도 명시.)
- **[Warning] #2 config 재평가 vs rawConfig snapshot**: 위 #9 인용 블록 참조.
- **[Warning] naming**: `allowRetryReentry`(state-machine opts) ↔ `retryReentry`(finalizeAiNode opts) 동의어 관계를 전이 표 비고에 부기.

## 다음 단계

- [ ] (project-planner) #7 error-code taxonomy 결정 — 필요 시 `classifyLlmError` 코드 동반 수정 (developer 위임)
- [ ] (project-planner) #6 전이를 Execution-entity 레벨로 §1.1 + §1.2 비고로 정확히 기술
- [ ] (project-planner) #8 cancel-during-replay → `spec/5-system/6-websocket-protocol.md §4.2` retry 행 비고 (구현 세부 `Promise.race` 는 Rationale 로), `cancelledBy` 분류 명시
- [ ] (project-planner) #9 config 재평가 정책 → `spec/4-nodes/3-ai/1-ai-agent.md §7.9` 단일 확정 + §5.5 cross-ref, rawConfig snapshot 정책과 정합
- [ ] spec 반영 후 `/consistency-check --spec` 재실행 → BLOCK: NO 확인
- [ ] spec 반영 후 본 plan 의 `## 제안 변경` 섹션 제거 (단일 진실 원칙)

관련 파일:
- `spec/5-system/4-execution-engine.md` §1.1 (상태 전이 표), §1.2, §5.5/§6.1 (config/rawConfig)
- `spec/4-nodes/3-ai/1-ai-agent.md` §10 (error code 표), §7.9 (retry 행위)
- `spec/5-system/6-websocket-protocol.md` §4.2 (cancel-during-replay, config 재평가)
- `spec/conventions/node-output.md` §3.2 (error code), §4.2.1 (_retryState 보존 예외)
