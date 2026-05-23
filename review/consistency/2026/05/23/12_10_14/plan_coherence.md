# Plan 정합성 검토 결과

검토 대상: `plan/in-progress/ai-agent-render-button-user-message.md` (worktree: `ai-agent-render-button-user-message-521f33`)
검토 기준: `plan/in-progress/**` 진행 중 작업 전체
검토 모드: 구현 착수 전 (--impl-prep, scope=spec/4-nodes/)

---

## 발견사항

### 1. [WARNING] `spec/4-nodes/6-presentation/0-common.md` 동시 편집 경합

- **target 위치**: target plan §변경 범위 (S) spec — `spec/4-nodes/6-presentation/0-common.md` §1 ButtonDef 표에 `userMessage` 옵션 필드 추가
- **관련 plan**: `plan/in-progress/ai-presentation-tools.md` (worktree: `ai-presentation-tools-9b7c5c`) §4.1 Spec 작성 — `spec/4-nodes/6-presentation/0-common.md` 갱신 ("AI tool 모드" 섹션 신설 + `defaults` overlay 규칙 + `render_form interactive` 차이 + interactionType `ai_form_render` cross-ref)
- **상세**: 두 plan 이 동일 spec 파일(`spec/4-nodes/6-presentation/0-common.md`)을 서로 다른 worktree 에서 동시에 편집한다. `ai-presentation-tools` plan 은 현재 §4.1 의 완료 체크박스(`[x]`) 로 보아 해당 파일에 이미 변경을 가한 상태다. target plan 이 같은 파일의 §1 ButtonDef 표를 직접 수정하면 merge 시 충돌 위험이 있다. ButtonDef 표에 `userMessage` 를 추가하는 작업 자체는 `ai-presentation-tools` 의 scope 밖(presentation 노드 render tool 의 LLM 호출 경로)이므로 의미 충돌은 낮으나, git 충돌은 동일 파일·동일 영역일 경우 피하기 어렵다.
- **제안**: target plan 의 spec 작업을 시작하기 전에 `ai-presentation-tools` worktree(`ai-presentation-tools-9b7c5c`) 의 `spec/4-nodes/6-presentation/0-common.md` 변경이 main 에 merge 됐는지 확인하고, merge 완료 후 현재 worktree 를 rebase/update 한 뒤 진행하거나, 두 plan 담당자 간 편집 순서를 직렬화한다.

### 2. [WARNING] `spec/4-nodes/3-ai/1-ai-agent.md` 동시 편집 경합

- **target 위치**: target plan §변경 범위 (S) spec — `spec/4-nodes/3-ai/1-ai-agent.md` §4.1 또는 §7.10 에 버튼 클릭 시 user-message 합성 규칙 추가
- **관련 plan**: `plan/in-progress/ai-presentation-tools.md` (worktree: `ai-presentation-tools-9b7c5c`) §4.1 — `spec/4-nodes/3-ai/1-ai-agent.md` §1·§4·§6.1·§6.2·§7.4·§7.10·§10·§12 다수 섹션 동시 갱신 (완료 체크박스 `[x]`)
- **상세**: `ai-presentation-tools` plan 은 `spec/4-nodes/3-ai/1-ai-agent.md` 의 광범위한 섹션(§7.10 신설 포함)에 이미 변경을 완료한 것으로 표시돼 있다. target plan 이 동일 파일의 §7.10(또는 §4.1)에 `userMessage` 합성 규칙을 추가하는 경우, 두 변경이 같은 섹션·위치를 건드리면 git 충돌이 발생한다. 특히 target plan 의 메모에 "ButtonDef.userMessage cross-ref" 를 ai-agent spec 에 추가한다고 명시해 §7.10 영역과 교차한다.
- **제안**: `ai-presentation-tools` 변경이 main 에 반영된 후 현재 worktree 를 rebase 한 뒤 target 의 spec 수정 작업을 진행한다. 또는 두 plan 간 편집 영역(§ 단위)을 명확히 협의해 충돌 회피 계획을 세운다.

### 3. [WARNING] `render-tool-provider.ts` 동시 편집 경합

- **target 위치**: target plan §변경 범위 (C) backend — `codebase/backend/src/nodes/ai/ai-agent/tool-providers/render-tool-provider.ts` 의 Button zod schema 에 `userMessage: z.string().optional()` 추가
- **관련 plan**: `plan/in-progress/ai-presentation-tools.md` (worktree: `ai-presentation-tools-9b7c5c`) §4.3 — `render-tool-provider.ts` **신규 생성** (5 render 도구 ToolDef 빌드 + defaults overlay)
- **상세**: `ai-presentation-tools` plan 이 `render-tool-provider.ts` 를 신규 생성하는 작업을 포함하며, target plan 은 그 파일의 Button zod schema 를 수정한다. 파일 자체가 `ai-presentation-tools` worktree 에서 생성 중이라면, target worktree 에는 그 파일이 아직 없어 패치를 올바르게 적용할 수 없다. 또한 두 worktree 가 각자 이 파일을 다른 기준으로 수정하면 merge 충돌이 불가피하다.
- **제안**: `ai-presentation-tools` plan 에서 `render-tool-provider.ts` 가 완성돼 main 에 merge 된 후 target plan 의 backend 작업에 착수한다. 또는 target plan 의 `userMessage` schema 추가를 `ai-presentation-tools` plan scope 에 포함시켜 단일 PR 로 처리한다.

### 4. [INFO] `ai-presentation-tools` 의 미완료 spec 항목과 target 의 명시적 의존 없음

- **target 위치**: target plan §변경 범위 (S) spec — `spec/4-nodes/6-presentation/0-common.md` §1.1 유효성: "link 타입에 `userMessage` 설정 시 무시"
- **관련 plan**: `plan/in-progress/ai-presentation-tools.md` §4.1 — `spec/conventions/conversation-thread.md`, `spec/5-system/6-websocket-protocol.md`, `spec/5-system/14-external-interaction-api.md`, `spec/conventions/node-output.md` 갱신이 아직 미완료 (`[ ]`)
- **상세**: target plan 은 ButtonDef 에 `userMessage` 필드를 추가하고 frontend 에서 message 합성 로직을 구현하는 것이 핵심이다. `ai-presentation-tools` 의 미완료 spec 항목들(conversation-thread / WS protocol / EIA / node-output)은 target 의 직접 의존 대상이 아니므로 작업 차단 사유는 아니다. 다만, 두 plan 이 모두 `ButtonDef.userMessage` 에 관해 다른 문서를 통해 참조 관계를 형성할 경우 추적이 필요하다.
- **제안**: target plan 완료 후 `ai-presentation-tools` 가 `spec/conventions/node-output.md §4.5` 의 `form_submitted` shape 에 `data.via?: 'ai_render'` sentinel 을 추가할 때, ButtonDef.userMessage 와의 상호작용을 확인하도록 `ai-presentation-tools` plan 에 메모를 추가한다.

### 5. [INFO] `spec-drift-ws-button-config.md` 와 target 간 무관함 확인

- **target 위치**: target plan 전체
- **관련 plan**: `plan/in-progress/spec-drift-ws-button-config.md` (worktree: `pending-assignment`) — WS Protocol `buttonConfig.timeout`·`nodeOutput.type` 불일치 수정
- **상세**: `spec-drift-ws-button-config` 는 WS spec 예시의 `timeout` / `nodeOutput.type` 필드 수정이 목표이고, target plan 은 `ButtonDef.userMessage` 필드 추가와 frontend message 합성 로직이 목표다. 두 plan 은 편집 대상 파일이 겹치지 않으며(WS protocol spec vs Presentation spec + ai-agent spec) 의미 충돌도 없다.
- **제안**: 별도 조치 불필요.

### 6. [INFO] `node-output-redesign` 과 target 간 무관함 확인

- **target 위치**: target plan 전체
- **관련 plan**: `plan/in-progress/node-output-redesign/` 디렉토리 — 28종 노드 output 구조 재설계 (worktree: pending-assignment로 추정)
- **상세**: `node-output-redesign` 은 각 노드의 output 5필드 invariant 정합화를 목표로 하며, target plan 은 ButtonDef 에 `userMessage` optional field 를 추가하고 frontend 합성 로직을 구현한다. 두 작업의 편집 파일 영역이 겹치지 않는다 (ButtonDef 는 config field, output redesign 은 output 섹션). D 결정 phase 가 이미 완료된 상태라 신규 결정과 충돌하지 않는다.
- **제안**: 별도 조치 불필요.

---

## 요약

target plan(`ai-agent-render-button-user-message`)은 현재 진행 중인 `ai-presentation-tools` plan(worktree: `ai-presentation-tools-9b7c5c`)과 세 개의 파일(`spec/4-nodes/6-presentation/0-common.md`, `spec/4-nodes/3-ai/1-ai-agent.md`, `codebase/backend/src/nodes/ai/ai-agent/tool-providers/render-tool-provider.ts`)을 동시에 편집하는 구조적 worktree 경합이 존재한다. `ai-presentation-tools` 의 spec 완료 체크박스(`[x]`)로 미루어 해당 변경은 해당 worktree 에서 이미 작성됐으나 아직 main 에 merge 되지 않은 상태로 추정된다. 미해결 의사결정(TBD 항목) 우회나 의미 충돌은 없으며, `render-tool-provider.ts` 의 경우 파일 자체가 `ai-presentation-tools` worktree 에서 신규 생성 중이므로 target worktree 에 해당 파일이 없을 수 있어 backend 작업 착수 전 merge 선행이 필수다. 나머지 in-progress plan 들(`spec-drift-ws-button-config`, `node-output-redesign`, `2fa-webauthn-followups`, 기타)은 target 과 편집 영역이 겹치지 않아 문제 없다.

---

## 위험도

MEDIUM
