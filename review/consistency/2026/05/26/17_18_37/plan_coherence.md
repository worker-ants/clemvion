# Plan 정합성 검토 결과

> 검토 모드: 구현 착수 전 검토 (`--impl-prep`, scope=`spec/4-nodes/3-ai/`)
> 검토 일시: 2026-05-26
> Target: `spec/4-nodes/3-ai/` (0-common.md, 1-ai-agent.md 전체 내용)

---

## 발견사항

### - **[INFO]** `multiturn-error-preserve.md` 의 spec 변경 분량이 이미 target 에 반영되어 있음
  - target 위치: `spec/4-nodes/3-ai/0-common.md §5`, `spec/4-nodes/3-ai/1-ai-agent.md §7.4·§7.9·§10·§7 서두`
  - 관련 plan: `plan/in-progress/multiturn-error-preserve.md` (worktree: `multiturn-error-preserve`)
  - 상세: `multiturn-error-preserve.md` 의 "영향 spec" 표에 열거된 `spec/4-nodes/3-ai/` 변경 내용 — `_retryState` top-level 필드 비고, `§7.4` `_resumeState` / `_retryState` 생명주기 비교 표, `§7.9` JSON 예시에 `retryable: true` / `retryAfterSec: 30` / `_retryState` 추가, `§10` 에러 코드 표에 `LLM_RATE_LIMIT` sub-case 분리 + `retryable` 분류 열, `0-common.md §5` 의 `details.retryable` / `retryAfterSec` 필수 주석 — 모두 이미 target spec 에 존재함. plan 의 spec phase 가 선행 완료된 것으로 보임.
  - 제안: plan 문서의 spec 변경 항목 앞 체크박스를 `[x]` 로 갱신하거나, plan 의 현재 진행 상태(codebase 구현 turn) 를 명시하여 spec phase 완료 여부를 추적 가능하게 유지.

### - **[INFO]** `retry-handler-followup.md` 가 동일 `multiturn-error-preserve` worktree 를 공유하며 동일 spec 영역을 참조
  - target 위치: `spec/4-nodes/3-ai/1-ai-agent.md §7.9`, `spec/5-system/6-websocket-protocol.md §4.2`
  - 관련 plan: `plan/in-progress/retry-handler-followup.md` (worktree: `multiturn-error-preserve`)
  - 상세: `retry-handler-followup.md` 는 `multiturn-error-preserve.md` 의 Phase D follow-up 으로, `spec/4-nodes/3-ai/1-ai-agent.md §7.9` 의 `_retryState` 소비 원자성 / Continuation Bus 경유 등을 spec 에 추가로 명시하는 작업이 남아 있음. target 의 `§7.9` 본문에는 현재 해당 명세가 없어 (`INVALID_EXECUTION_STATE` 사전 검증, `SELECT FOR UPDATE` 원자성 요건 등 미포함), retry-handler-followup 의 예정 변경이 아직 반영되지 않은 상태. 구현 착수 전 이 spec gap 이 문제가 되는지 확인 필요.
  - 제안: 구현 시 `ai-agent.handler.ts` 의 retry 진입 경로가 spec `§7.9` 에 비해 더 상세한 요건(원자성, 사전 검증)을 갖는다면, `retry-handler-followup.md` 의 spec 변경을 선 처리 후 구현 착수 권장. 단, 현재 spec 이 이미 `_retryState` 의 기본 의미는 정의하고 있으므로 구현 착수 자체는 가능하며, 원자성 보강은 별 PR 범위.

### - **[INFO]** `ai-agent-tool-connection-rewrite.md` 의 미해결 결정과 target 의 일부 선행 반영 주목
  - target 위치: `spec/4-nodes/3-ai/1-ai-agent.md §6.1 step 3a` (dispatcher 분류 순서 `cond_* → kb_* → mcp_* → render_* → tool_*`)
  - 관련 plan: `plan/in-progress/ai-agent-tool-connection-rewrite.md` §1 결정 사항 (도구 등록 모델 TBD)
  - 상세: `ai-agent-tool-connection-rewrite.md` 는 §Tool Area 연동 · `toolNodeIds` 재설계의 디자인 결정이 미해결(TBD)인 채로 진행 중. target 의 `1-ai-agent.md §6.1 step 3a` 에는 현재 dispatcher 순서 `cond_* → kb_* → mcp_* → render_* → tool_*` 가 정의되어 있고, `tool_*` 재설계 완료 시 이 순서가 갱신되어야 함이 plan 에 명시됨. target 은 이 미해결 결정 영역(tool_* 구체 모델)과 충돌하는 결정을 일방적으로 추가하지 않고 있으므로 현재 CRITICAL 충돌 없음. 단, 구현 시 `tool_*` 경로를 활성화하면 직접 충돌 발생.
  - 제안: 구현 착수 범위에서 `tool_*` provider 재활성화 항목이 포함되지 않으면 별도 조치 불필요.

### - **[INFO]** `node-output-redesign/ai-agent.md` Phase E (P0) 항목 — `buildErrorOutput` + `port:'error'` 구현이 선행 완료되었는지 불명확
  - target 위치: `spec/4-nodes/3-ai/1-ai-agent.md §7.3·§7.9·§10`
  - 관련 plan: `plan/in-progress/node-output-redesign/ai-agent.md` Phase E P0 — "ai-agent `buildErrorOutput` + `port:'error'` 추가"
  - 상세: `node-output-redesign` README Phase E P0 에 "ai-agent 가 `llmService.chat` throw 시 spec §7.3 / §7.9 에러 라우팅을 미준수 — 별도 plan 필요"로 표기됨. 그러나 target spec 에는 이미 `§7.3` / `§7.9` 에러 구조가 상세히 정의되어 있고 `_retryState` 까지 포함됨. spec 은 완전히 정의됐으나 codebase 구현 갭이 남아 있을 수 있음. target spec 을 기준으로 구현할 경우 이미 정의된 spec 을 따르면 되므로 spec 차원의 충돌은 없음.
  - 제안: 구현 착수 전 `ai-agent.handler.ts` 에 실제로 `buildErrorOutput` + `port:'error'` 가 구현됐는지 코드 확인 후 node-output-redesign 의 P0 체크박스 갱신 권장.

---

## Stale 으로 skip 한 worktree (의무 — 0건이어도 명시)

worktree 충돌 후보 분석:

1. **`multiturn-error-preserve` worktree** — `plan/in-progress/multiturn-error-preserve.md` + `plan/in-progress/retry-handler-followup.md` 가 동일 worktree 를 지정. git worktree list 확인 결과 이 worktree 디렉토리가 로컬에 존재하지 않음 (`.claude/worktrees/` 하위에 `multiselect-widget-f72348` 만 존재). branch `multiturn-error-preserve` 도 로컬/원격 모두 확인되지 않음. worktree 가 실제로 생성되지 않은 상태이므로 §5 worktree 충돌 후보에서 제외.

**Stale skip 목록**: 0건 (worktree 충돌 후보 자체가 없음 — `multiturn-error-preserve` worktree 는 아직 생성되지 않은 상태).

현재 worktree(`multiselect-widget-f72348`)는 `git merge-base --is-ancestor` 검사에서 `claude/multiselect-widget-f72348` branch 가 `origin/main` 의 ancestor 로 판정됨 (같은 HEAD commit `31c08ab4` 공유). 이 worktree 는 현재 작업 중인 일관성 검토 산출물 worktree 로, 검토 scope(`spec/4-nodes/3-ai/`) 파일을 수정하지 않음.

---

## 요약

`spec/4-nodes/3-ai/` 는 전반적으로 진행 중 plan 들과 정합된 상태다. 가장 중요한 관련 plan `multiturn-error-preserve.md` 의 spec 변경 내용은 이미 target 에 반영되어 있어 중복 작업 우려가 없다. `ai-agent-tool-connection-rewrite.md` 의 미결 결정(tool_* 등록 모델)은 target 이 독립적으로 결정을 내리지 않고 비활성 박스로 유지하고 있어 충돌이 없다. `retry-handler-followup.md` 의 원자성·사전 검증 spec 보강은 아직 target 에 미반영이나 구현 착수를 차단하는 CRITICAL 선행 조건이 아니다. CRITICAL 충돌 없음, active worktree 경합 없음. worktree 충돌 후보 0건 (multiturn-error-preserve worktree 미생성).

---

## 위험도

**LOW**

STATUS: OK
