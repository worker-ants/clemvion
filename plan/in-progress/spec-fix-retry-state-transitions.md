---
worktree: multiturn-error-preserve-0d94b0
started: 2026-05-30
owner: project-planner
---
# Spec Fix Draft — retry 재진입 관련 spec 4건 (WARNING #6/#7/#8/#9)

> **상태 (2026-05-30): 1차 BLOCK: YES → 설계 결정 확정 후 spec 반영 완료.**
> 초기 `/consistency-check --spec` 는 Critical 1 + WARNING 6 으로 BLOCK. project-planner
> 가 아래 `## 결정 및 적용` 대로 설계를 확정해 spec 본문에 반영했고 재검증 예정.
> 코드는 이미 spec 준수 동작으로 구현·테스트됨 — 단 #7 taxonomy 확정에 따라
> `classifyLlmError` fallback 코드만 developer 가 정렬(아래 참조).

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

## 결정 및 적용 (2026-05-30, project-planner)

초기 consistency-check BLOCK(Critical 1 + WARNING 6, `review/consistency/2026/05/30/12_59_42/SUMMARY.md`) 의 설계 쟁점을 다음과 같이 확정하고 spec 본문에 반영했다.

### #7 — error-code taxonomy → **(a) `LLM_CALL_FAILED` non-retryable sub-case 로 통합**
별도 `AI_*` fallback 코드를 신설하지 않고 §10 의 LLM 단일 taxonomy 를 유지한다. 분류 불가 throw(status·explicit code·network 신호 모두 없음)는 `LLM_CALL_FAILED`(non-retryable)로 매핑.
- **적용**: `spec/4-nodes/3-ai/1-ai-agent.md §10` 에 `LLM_CALL_FAILED | 분류 불가 fallback | false` 행 추가 + "분류는 HTTP status 기반" 비고(classifyLlmError 매핑 명시).
- **코드 동반 (developer)**: `classifyLlmError` 의 fallback `AI_AGENT_TURN_FAILED` → `LLM_CALL_FAILED`(retryable=false) 로 정렬, 단위 테스트 갱신. `AI_AGENT_TURN_FAILED` 문자열 제거.

### #6 — `failed → running` 은 **Execution entity 레벨 전이** + 새 NodeExecution row spawn
- **적용**: `§1.1` 다이어그램·전이 표에 `failed → running` (retry_last_turn 전용, `allowRetryReentry` opt-in) 추가 + Execution-entity 전이임을 명시하는 비고. `§1.2` 에 "기존 failed row 미전이, 동일 nodeId 새 row 를 running 으로 spawn, 그래서 nodeExecutionId 로 식별" 비고. `§Rationale` 에 R2(`waiting_for_retry` 기각) 및 WFI 재개 흐름과 별개 경로임 명시.

### #8 — cancel-during-replay → `cancelled` 마감
- **적용**: `spec/5-system/6-websocket-protocol.md §4.2` 의 `_retryState` 소비 계약에 "replay 중 cancel → 진행 turn 조기 종료 + `execution.cancelled` (완료/실패 미발사), 일반 사용자 취소와 동일 분류" 비고. 구현 세부(`Promise.race`)는 spec 본문 미포함(결합 회피).

### #9 — config 재평가 정책 (rawConfig snapshot 과 정합)
- **적용**: `spec/4-nodes/3-ai/1-ai-agent.md §7.9` 재시도 진입 블록에 "재진입 시 best-effort expression 재평가, `$input.*` 미해소(documented limitation), 실패 시 raw fallback, `output.config` echo 는 raw 유지" 명시 + `[실행 엔진 §5.5]` cross-ref. `§Rationale` 에 재평가 값은 실행에만 쓰고 echo·replay reproducibility 는 raw snapshot 유지로 직교성 보존함을 명시 — WARNING #2(snapshot 충돌 우려) 해소.

### naming
- `allowRetryReentry`(state-machine) ↔ `retryReentry`(finalizeAiNode opts) 동의어는 코드 계층 차이로, spec 표에는 `allowRetryReentry` 단일 표기 사용.

## 다음 단계

- [x] (project-planner) #6/#7/#8/#9 spec 본문 반영
- [x] (developer) `classifyLlmError` fallback `AI_AGENT_TURN_FAILED` → `LLM_CALL_FAILED` 정렬 + 테스트 (commit 219d54fb)
- [x] `/consistency-check --spec` 재실행 → **BLOCK: NO** 확인 (`review/consistency/2026/05/30/13_34_40/SUMMARY.md`, LOW)
- [x] `retry-handler-followup.md` 의 spec-sync 항목(#6~#9) closed 표기 — 본 spec PR 에 반영 완료
- [ ] (후속 — 별 작업) consistency INFO: information-extractor/text-classifier §5.3 fallback sub-case 비고, execution-engine §Rationale → ai-agent §7.9 역방향 cross-ref, `AI_RETRY_STATE_TTL_MINUTES` ENV 카탈로그 등재 검토

관련 파일:
- `spec/5-system/4-execution-engine.md` §1.1 (상태 전이 표), §1.2, §5.5/§6.1 (config/rawConfig)
- `spec/4-nodes/3-ai/1-ai-agent.md` §10 (error code 표), §7.9 (retry 행위)
- `spec/5-system/6-websocket-protocol.md` §4.2 (cancel-during-replay, config 재평가)
- `spec/conventions/node-output.md` §3.2 (error code), §4.2.1 (_retryState 보존 예외)
