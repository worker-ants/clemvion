# Plan 정합성 검토 결과

검토 모드: `--impl-prep`
검토 범위: `spec/conventions/conversation-thread.md`, `spec/conventions/node-output.md`, `spec/4-nodes/3-ai/1-ai-agent.md`
검토 시각: 2026-05-23

---

## 발견사항

### 1. **[CRITICAL]** `multiturn-error-preserve` plan 의 spec 변경이 현 worktree 에 아직 반영되지 않은 채 `--impl-prep` 가 호출됨

- **target 위치**: `spec/conventions/conversation-thread.md` §1.1, §1.2, §8.3, §9.1, §9.2, §9.6, §9.7, §9.9, §9.10
- **관련 plan**: `plan/in-progress/multiturn-error-preserve.md` (worktree: `multiturn-error-preserve`) §B / §C — `system_error` source 신설, `data?` 행 비고에 system_error payload shape 인라인 정의, §9.1 매핑표 `system_error` 행, §9.7 store reset 정책, Inv-6, CT-S9/S10/S11
- **상세**: `git diff HEAD main -- spec/conventions/conversation-thread.md` 결과, **main 에는 `system_error` 관련 내용이 이미 존재**하지만 현재 worktree(multiturn-error-preserve) 의 conversation-thread.md 에는 `system_error` 행이 §1.1 에서 제거된 상태이고, §1.2 의 `data?` 행에서도 system_error payload shape 인라인 정의가 없다. 또한 §8.3 Rationale 블록 전체와 §9.1 매핑표의 `system_error` 행, §9.6 그룹 정책의 system_error 언급, §9.7 store 변환 계약 표의 `node.failed` / `node.completed` 두 행, Inv-6 정의, CT-S9/S10/S11 시나리오가 모두 현 worktree 에는 없다. `1-ai-agent.md` 의 §7 서두·§7.4·§7.9 에서의 `_retryState` 비교표·JSON 예시·에러 코드 표의 `LLM_RATE_LIMITED` sub-case / retryable 열도 마찬가지로 현 worktree 에 이미 반영된 상태이다 (main 과 동일함을 확인). 즉 plan 이 정의하는 spec 갱신의 **일부는 main 에 반영되고, 일부(conversation-thread.md)는 본 worktree 의 작업 기반(베이스라인)에서 누락**된 상태로 impl-prep 가 요청됐다.
- **제안**: 구현 착수 전 `spec/conventions/conversation-thread.md` 가 plan 의 §B 기술사항(system_error source 전체 + §9 변경)을 완전히 반영하고 있는지 확인 필요. 현재 worktree 파일이 main 보다 구버전이라면 먼저 main 을 rebase/merge 해서 conversation-thread.md 를 최신 상태로 맞춰야 한다. `_retryState` / `node-output.md` / `1-ai-agent.md` 는 이미 반영 완료 상태이므로 문제 없음.

---

### 2. **[WARNING]** `ai-presentation-tools` plan 의 미완료 spec 항목 2건이 target 파일과 중복 편집 구역을 가짐

- **target 위치**: `spec/conventions/conversation-thread.md` §1.2 / `spec/conventions/node-output.md` §4.5
- **관련 plan**: `plan/in-progress/ai-presentation-tools.md` (worktree: `ai-presentation-tools-9b7c5c`) §4.1 미완료 항목
  - `[ ] spec/conventions/conversation-thread.md §1.2 갱신` — `ConversationTurn` 표에 top-level `presentations?` 행 추가, data? 행의 잘못 박힌 cross-ref 제거 (#10, #14)
  - `[ ] spec/conventions/node-output.md §4.5 갱신` — `form_submitted` shape 에 `data.via?: 'ai_render'` sentinel 추가 (#17)
- **상세**: 현재 worktree 의 두 target 파일을 확인한 결과, `conversation-thread.md` §1.2 에는 이미 `presentations?` 행이 존재하고 `node-output.md` §4.5 에는 `via?: 'ai_render'` sentinel 이 이미 포함되어 있다. 따라서 ai-presentation-tools plan 의 미완료 체크박스 2건이 **실제로는 main(및 현 worktree)에 이미 반영된 상태**다. ai-presentation-tools plan 의 체크박스가 갱신(checked)되지 않아 중복 작업 위험이 표시되지만, 현 worktree 에서는 실질적 충돌이 없다.
- **제안**: `ai-presentation-tools.md` plan 의 해당 체크박스 두 항목을 `[x]` 로 갱신하여 plan 상태를 현실과 일치시켜야 한다. 이로써 후속 작업자가 이미 완료된 항목을 중복 작업하는 경합을 예방할 수 있다.

---

### 3. **[WARNING]** `ai-agent-tool-connection-rewrite` plan 의 미해결 결정이 `1-ai-agent.md §6.1 dispatcher` 와 잠재 간섭

- **target 위치**: `spec/4-nodes/3-ai/1-ai-agent.md` §6.1 step 3a 분류 순서 (`cond_* → kb_* → mcp_* → render_* → tool_*`)
- **관련 plan**: `plan/in-progress/ai-agent-tool-connection-rewrite.md` §1 "디자인 결정" — 도구 등록 모델 / 도구 시그니처 위치 / 실행 컨텍스트 모두 TBD
- **상세**: `multiturn-error-preserve` plan 의 비범위(out of scope)에 `ai-agent-tool-connection-rewrite` 와의 `_resumeState` schema 의존이 명시되어 있다. 현재 target spec 에서 §6.1 의 dispatcher 분류 순서는 5-prefix (`cond/kb/mcp/render/tool`) 로 정의되어 있으며, `tool_*` 슬롯은 "재작성 예정 — 비활성" 으로 표기되어 있다. `ai-agent-tool-connection-rewrite` plan 이 활성화될 때 `_retryState` 의 `pendingFormToolCall` shape 또는 dispatcher 분류 순서가 변경될 수 있으며, `multiturn-error-preserve` 의 `_retryState` 는 `_resumeState` 의 동일 구조를 snapshot 하므로 schema 비호환이 발생할 수 있다.
- **제안**: `multiturn-error-preserve` plan 의 `의존성·리스크` 절에 이미 명시되어 있으나, `ai-agent-tool-connection-rewrite` plan 에도 "`_resumeState` schema 변경 시 `_retryState` 호환성 재검토" 를 명시적으로 추가 기재하여 후속 작업자가 누락하지 않도록 한다.

---

### 4. **[INFO]** `spec-drift-ws-button-config` plan 과 동일 파일 (`spec/5-system/6-websocket-protocol.md`) 편집 구역 잠재 겹침

- **target 위치**: target 파일 범위(`conversation-thread.md`, `node-output.md`, `1-ai-agent.md`)에 직접 해당하지 않으나, `multiturn-error-preserve` plan 이 `spec/5-system/6-websocket-protocol.md §4.1 / §4.2 / §4.6` 을 갱신한다고 명시함
- **관련 plan**: `plan/in-progress/multiturn-error-preserve.md` §의존성·리스크 — "`spec-drift-ws-button-config.md`: 동일 파일 §4.4 수정 중, 머지 순서 conflict 가능"
- **상세**: plan 자체에 이미 인지된 의존성이므로 별도 action 없이 추적 메모로 기록.
- **제안**: 구현 PR 생성 전 `spec-drift-ws-button-config` plan 의 머지 여부를 확인하고, 미머지 시 rebase 순서를 조율한다.

---

## 요약

target 3개 파일(`conversation-thread.md`, `node-output.md`, `1-ai-agent.md`)은 `multiturn-error-preserve` plan 이 기술하는 spec 변경 사항의 **일부만 반영된 상태**다. `node-output.md` (Principle 0/3.2.1/3.2.2/4.2.1)와 `1-ai-agent.md` (§7 preamble, §7.4, §7.9, §10 에러 코드표)는 이미 plan 의 요구를 충족하고 있으나, `conversation-thread.md` 는 현재 worktree 에서 `system_error` source 및 관련 §9 변경이 없는 구버전 상태다. 이 불완전 반영 상태에서 구현에 착수하면 구현이 spec 의 의도(conversation thread system_error turn, Inv-6, CT-S9/10/11)를 충족하는지 검증할 기준이 없다. `ai-presentation-tools` plan 의 spec 체크박스 2건은 실제로는 완료된 상태이나 plan 이 미갱신 상태라 중복 작업 경보가 남아있다. 전반적인 plan-spec 정합성의 위험도는 conversation-thread.md 의 구현 기준 공백으로 인해 MEDIUM 수준이다.

---

## 위험도

MEDIUM

---

STATUS: SUCCESS
