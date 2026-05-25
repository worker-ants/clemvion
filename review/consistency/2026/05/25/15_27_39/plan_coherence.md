# Plan 정합성 검토 — spec/4-nodes/6-presentation/0-common.md

검토 모드: `--impl-prep`  
검토 일시: 2026-05-25  
Target: `spec/4-nodes/6-presentation/0-common.md`  
검토자 worktree: `telegram-carousel-button-click-5b52c1` (branch `claude/telegram-carousel-button-click-5b52c1`)

---

## 발견사항

### [WARNING] `spec-drift-ws-button-config.md` — 미해결 결정 2건이 target spec 과 직접 맞닿음

- **target 위치**: `spec/4-nodes/6-presentation/0-common.md §3 (Blocking Mode 실행 흐름)`, `§6.1 (Carousel 버튼 대기 중 항목)`, `§4 출력 포맷`
- **관련 plan**: `plan/in-progress/spec-drift-ws-button-config.md` — "해결 방향 (project-planner 결정 필요)" 섹션의 C2·C3
- **상세**:
  - **C2 (timeout 정책 모순)**: `spec/5-system/6-websocket-protocol.md §4.4` 예시에 `buttonConfig: { timeout: 300, timeoutAction: "cancel" }` 가 여전히 잔존. target spec `§3·§6.1` 은 "버튼 클릭 시까지 무제한 대기 (외부 cancel/종료 외에는 타임아웃 없음)" 로 규정. 두 spec 이 상충한 채 미결. WS spec 쪽 삭제 (안 A) vs Presentation 공통 규약에 타임아웃 정책 공식 도입 (안 B) 중 어느 쪽도 선택되지 않은 상태에서 target spec §3 을 구현하면 WS spec 과 명시적 모순이 발생한다.
  - **C3 (nodeOutput.type 판별자 모순)**: `spec/5-system/6-websocket-protocol.md §4.4` 예시에 `buttonConfig.nodeOutput: { "type": "carousel", ... }` 잔존. target spec `§4` Principle 1.1.4 "노드 판별용 `type:` 래퍼는 사용하지 않는다" 와 직접 모순. 이 역시 미결.
  - 두 결정 모두 `spec-drift-ws-button-config.md` 에서 "project-planner 결정 필요" 로 명시돼 있고 `worktree: pending-assignment` — 아직 어떤 worktree 도 착수하지 않음.
- **제안**: 구현 착수 전 `project-planner` 가 `spec-drift-ws-button-config.md` C2·C3 를 결정해야 한다. 권고 방향은 이미 plan 에 "(A)가 자연스러움" 으로 기재돼 있으므로, planner turn 에서 WS spec `§4.4` 예시에서 `timeout`/`timeoutAction`/`nodeOutput.type` 을 제거하는 소규모 spec 수정 PR 을 먼저 진행한 뒤 구현 착수 순서가 안전하다.

---

### [WARNING] `multiturn-error-preserve.md` — 동일 영역 인접 spec 갱신이 아직 구현되지 않음 (선행 조건 부분 미해소)

- **target 위치**: `spec/4-nodes/6-presentation/0-common.md §10.9 (Form submission wire format)`, `§10.6 (Blocking vs Display-only render_form 흐름)`
- **관련 plan**: `plan/in-progress/multiturn-error-preserve.md` — 영향 spec 표 중 `spec/5-system/6-websocket-protocol.md §4.2` (`execution.retry_last_turn` 신설), `spec/conventions/conversation-thread.md §9.7` (store reset 정책 `CLEAR_INPUT_AFFORDANCE` 분리), `spec/conventions/node-output.md Principle 4.2` (`_retryState` 보존)
- **상세**:
  - target spec `§10.9` 의 `waitForAiConversation` dispatch 4 케이스 (`ai_end_conversation / ai_message / form_submitted / button_click`) 명시 매칭은 이미 main 에 반영됨. 이 부분은 정합.
  - 그러나 `multiturn-error-preserve.md` 가 정의하는 `execution.retry_last_turn` 명령 + `_retryState` 보존 + `system_error` ConversationTurn source 는 아직 구현되지 않은 상태. target spec 의 `§10.6 render_form` 흐름과 `§10.9 §3 button_click invariant` 설명은 이 plan 이 완료된 이후의 상태를 일부 기술하고 있다 (`_resumeState` / `pendingFormToolCall` 관련 cross-ref 가 `§10.6`, `§10.9` 에 포함).
  - `multiturn-error-preserve.md` 의 worktree 는 `multiturn-error-preserve` (symbolic — 실제 git worktree 목록에 없음, PR 미생성). 구현 착수 전이지만 spec 변경 범위가 target spec 의 인접 spec (`WS §4.2`, `conversation-thread §9.7`) 에 걸쳐 있어 구현 시 충돌 가능.
  - `spec-drift-ws-button-config.md` 의 `spec/5-system/6-websocket-protocol.md` 수정과 `multiturn-error-preserve.md` 의 동일 파일 `§4.1 / §4.2 / §4.6` 수정이 겹치는 점도 plan 자체에서 "머지 순서에 따라 conflict 가능" 으로 명시함.
- **제안**: target spec 의 `§10.9` / `§10.6` 은 현재 상태 그대로 구현 착수 가능하다 (이미 main 의 확정된 SoT). 단, `multiturn-error-preserve.md` 가 착수되면 `spec/5-system/6-websocket-protocol.md §4.2` 변경이 target spec 의 `§10.9 4-layer SSOT` cross-ref 에 영향을 줄 수 있으므로, 해당 plan 착수 시 `0-common.md §10.9` cross-ref 링크를 검토·갱신하는 항목을 `multiturn-error-preserve.md` 의 "영향 spec" 표에 추가하는 것을 권고.

---

### [INFO] `ai-agent-tool-connection-rewrite.md` — 미해결 설계 결정 5건, target spec 에 직접 영향 없으나 잠재 후속 갱신 필요

- **target 위치**: `spec/4-nodes/6-presentation/0-common.md §10.1 도구 카탈로그`, `§10.2 도구 카탈로그` (dispatcher 분류 순서 표)
- **관련 plan**: `plan/in-progress/ai-agent-tool-connection-rewrite.md` — §1 디자인 결정 5건 (도구 등록 모델 / 시그니처 위치 / 실행 컨텍스트 / 결과 라우팅 / ND-AG-21 우선순위) 모두 TBD
- **상세**:
  - target spec `§10` 은 `render_*` 도구 가족만 다루며 `tool_*` 일반 도구와는 직교. plan 자체에 "도구 이름 충돌 없음 (`tool_*` 와 `render_*` prefix 다름)" 이 명시돼 있어 target spec 에 직접적 모순은 없음.
  - 단 plan 에서 "`tool_*` 모델 확정 시 `spec/4-nodes/3-ai/1-ai-agent.md §6.1 step 3a` dispatcher 분류 순서 표를 갱신해야 한다" 는 cross-ref 가 있음. target spec `§10.1` 의 도구 카탈로그 표는 `render_*` 5종으로 완결이나, AI Agent dispatcher 순서 표 (`cond_* → kb_* → mcp_* → render_* → tool_*`) 에서 `render_*` 위치가 확정돼 있어 `tool_*` 재설계가 해당 순서를 바꾸면 target spec cross-ref 가 stale 해질 수 있다.
  - 본 결정은 5건 모두 TBD — 구현 착수 전이므로 즉각적 충돌은 없음.
- **제안**: `ai-agent-tool-connection-rewrite.md` 가 §3 Spec 작성 단계에 진입할 때, target spec `§10` 의 dispatcher 표 cross-ref 를 재검토 목록에 포함시킬 것. plan `§3` 의 "(EIA cross-ref)" 항목과 함께 `0-common.md §10` 도 후속 갱신 체크리스트에 추가 권고.

---

### [INFO] `spec-drift-ws-button-config.md` — W3 (buttonConfig 레이어 기술 혼용) 도 target spec 인접, 추적 보강 권고

- **target 위치**: `spec/4-nodes/6-presentation/0-common.md §3 (Blocking Mode 실행 흐름 step 5)` — WS 이벤트 `execution.waiting_for_input` payload 의 `buttonConfig`
- **관련 plan**: `plan/in-progress/spec-drift-ws-button-config.md` — "관련 후속" 절 W3 (`buttonConfig` 레이어 기술 혼용 — `config.buttonConfig` vs WS payload top-level)
- **상세**: C2·C3 와 함께 W3 도 같은 plan 에 추적되고 있으나 별도 결정 항목으로 분류되지 않음. target spec `§3 step 5` 에서 `buttonConfig` 를 WS payload top-level 에 두는 것이 SoT 인데, 구현 시 `config.buttonConfig` 와의 혼용이 발생할 여지가 있다.
- **제안**: plan `spec-drift-ws-button-config.md` 에 W3 를 별도 작업 항목으로 분리하거나, C2/C3 결정과 함께 묶어 처리할 때 W3 도 반드시 포함하도록 plan 에 명시 갱신 권고.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 검토 결과:

현재 활성 git worktree 4개 (`chat-channel-error-notify-6d37ec`, `chat-channel-runtime-fix-ed7061`, `undici-autoselectfamily-b938d3`, `telegram-carousel-button-click-5b52c1`) 중 target spec 파일(`spec/4-nodes/6-presentation/0-common.md`)을 수정하는 worktree는 없음. `chat-channel-error-notify-6d37ec` 와 `chat-channel-runtime-fix-ed7061` 는 `spec/conventions/chat-channel-adapter.md` 및 `codebase/backend/src/modules/chat-channel/**` 만 수정 — 대상 외.

| worktree | branch | stale 판정 |
|---|---|---|
| `chat-channel-error-notify-6d37ec` | `claude/chat-channel-error-notify-6d37ec` | Step 2: PR MERGED — **stale** |
| `chat-channel-runtime-fix-ed7061` | `claude/chat-channel-runtime-fix-ed7061` | Step 2: PR MERGED — **stale** |
| `undici-autoselectfamily-b938d3` | `claude/undici-autoselectfamily-b938d3` | Step 2: PR MERGED — **stale** |

위 3개 worktree 는 모두 PR MERGED (squash merge 케이스 — Step 1 ancestor 검사에서 ACTIVE 로 나왔으나 Step 2 GitHub PR state 검사에서 stale 확인). 해당 worktree 가 활성으로 남아있을 이유가 없으므로 `./cleanup-worktree-all.sh --yes --force` 실행 권장.

target spec 파일 직접 수정 worktree 충돌: **0건**

---

## 요약

`spec/4-nodes/6-presentation/0-common.md` 에 대한 `--impl-prep` 검토에서 구현 차단 수준의 정합성 문제는 없다. 다만 `plan/in-progress/spec-drift-ws-button-config.md` 에서 "project-planner 결정 필요"로 명시한 2건 (C2: WS spec `§4.4` 의 `timeout`/`timeoutAction` 잔존 vs 무제한 대기 정책, C3: `nodeOutput.type` 판별자 vs Principle 1.1.4) 이 target spec 과 인접하며 아직 미결이다. 이 두 건이 해소되지 않으면 WS spec 과 Presentation 공통 규약이 공식적으로 모순된 채 구현이 진행되는 상황이 지속된다. `multiturn-error-preserve.md` 의 인접 spec 갱신 범위 (`WS §4.2` / `conversation-thread §9.7`) 와의 이후 충돌 가능성도 WARNING 수준으로 추적 필요하다. worktree 충돌 후보 3건은 모두 PR MERGED stale 로 skip 하였으며, target spec 파일을 동시 수정하는 active worktree 는 없다.

---

## 위험도

**MEDIUM**

- CRITICAL 없음: 현재 target spec 내용은 main 에 확정된 SoT 이고 active worktree 충돌 없음.
- WARNING 2건: spec-drift-ws-button-config.md 의 미결 결정 2건이 구현 전 해소 권고 수준 (차단은 아니나 WS spec 과의 공식 모순이 지속됨), multiturn-error-preserve.md 의 인접 spec 갱신 후 cross-ref 갱신 필요.
- stale worktree 3건 skip.

STATUS: OK
