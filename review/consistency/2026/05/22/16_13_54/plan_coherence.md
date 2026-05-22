# Plan 정합성 검토 결과

검토 모드: spec draft (--spec)
Target: `plan/in-progress/ai-presentation-tools.md`
검토 시각: 2026-05-22

---

## 발견사항

### [WARNING] `ai-agent-tool-connection-rewrite.md` 의 미해결 `tool_*` 접두사 결정과 `render_*` 신설의 인접 위험

- **target 위치**: `plan/in-progress/ai-presentation-tools.md` §2 결정사항 2번 ("Tool family 이름: `render_*` prefix. 기존 4 prefix (`cond_/kb_/mcp_/tool_`) 와 동일 분류 패턴"), §4.1 Spec 작성 → `spec/4-nodes/3-ai/1-ai-agent.md` §4 Tool Area 아래 `render_*` 가족 신설
- **관련 plan**: `plan/in-progress/ai-agent-tool-connection-rewrite.md` §1 디자인 결정 — 도구 이름 규칙: `tool_*` 접두사 부활 또는 변경 (미결), §3 Spec 작성 → `spec/4-nodes/3-ai/1-ai-agent.md` §4 Tool Area 재작성
- **상세**: `ai-agent-tool-connection-rewrite.md` 는 `spec/4-nodes/3-ai/1-ai-agent.md` §4 Tool Area 를 "재작성 예정" 박스 제거 + 새 도구 연결 모델 명세 대상으로 명시하고, 일반 도구 접두사가 `tool_*` 로 복원될지 다른 이름이 될지를 **미결 결정 사항** 으로 남겨두고 있다. target plan 은 동일 §4 섹션에 `render_*` 신규 가족을 추가하며 이를 "기존 4 prefix 와 동일 분류 패턴" 으로 기술한다. 두 plan 이 동일 §4 를 편집 대상으로 삼고 있고, `ai-agent-tool-connection-rewrite.md` 가 `tool_*` 슬롯 부재를 전제로 설계된 반면 target 은 `tool_*` 슬롯이 아직 비어 있음을 "직교"의 근거로 삼는다. 충돌 자체는 의도적 분리 설계로 해결되어 있지만, `tool_*` 접두사 결정이 내려지면 target 의 5-prefix 분류 기술 ("기존 4 prefix 와 동일 분류 패턴") 이 6-prefix 로 갱신 필요하다.
- **제안**: target plan §2 결정사항 2번의 "기존 4 prefix" 표현을 유지하되, `ai-agent-tool-connection-rewrite.md` 가 완료되어 `tool_*` 접두사가 확정되면 target 의 해당 기술을 후속 갱신해야 한다는 cross-ref 주석을 plan §5 또는 §4.1 에 추가할 것을 권장한다.

---

### [WARNING] `node-output-redesign/ai-agent.md` P0 단일턴 에러 처리와 target 의 동일 파일 편집 경합 위험

- **target 위치**: `plan/in-progress/ai-presentation-tools.md` §4.1 → `spec/4-nodes/3-ai/1-ai-agent.md` §6.1 / §6.2 실행 로직 갱신, §10 에러 코드 `PRESENTATION_RENDER_SCHEMA_INVALID` 신설(또는 보류)
- **관련 plan**: `plan/in-progress/node-output-redesign/ai-agent.md` §종합 개선안 P0 항목 — `spec/4-nodes/3-ai/1-ai-agent.md` §6 (single-turn `llmService.chat` try/catch 추가) 및 §10 에러 코드 표 갱신 (`LLM_CALL_FAILED` 코드 활성화). README P0 에서 "별도 plan + worktree 필요" 라고 명시.
- **상세**: `node-output-redesign` 의 P0 항목은 `spec/4-nodes/3-ai/1-ai-agent.md` §6.1 (single-turn) 실행 로직과 §10 에러 코드 표를 변경 대상으로 삼는다. target plan 도 동일 §6.1 / §6.2 / §10 을 갱신 예정이다. 두 plan 이 동시에 활성화되면 동일 섹션의 병렬 편집이 발생한다. 단, `node-output-redesign` P0 는 아직 독립 worktree 를 생성하지 않은 상태(README 에 "별도 plan + worktree 필요"만 기재)이므로 현재 즉각 충돌은 아니지만, 착수 타이밍이 겹칠 경우 merge 분쟁이 생긴다.
- **제안**: target plan 착수 전에 `node-output-redesign/ai-agent.md` P0 항목의 착수 상태를 확인하고, 동시 착수 시 target 의 §6.1 / §10 편집 범위와 P0 의 범위를 조율하거나 직렬화한다. target 의 §4.3 백엔드 구현 전에 P0 가 먼저 완료되면 spec §10 에 target 이 추가할 `PRESENTATION_RENDER_SCHEMA_INVALID` 와 P0 가 활성화할 `LLM_CALL_FAILED` 의 공존이 자연스럽게 해결된다.

---

### [WARNING] `spec/4-nodes/_product-overview.md` 번호 시프트 불안정 — 두 plan 이 §6.1 AI Agent 행을 동시에 갱신할 수 있음

- **target 위치**: `plan/in-progress/ai-presentation-tools.md` §4.1 → `spec/4-nodes/_product-overview.md` §6.1 AI Agent 요구사항 표에 ND-AG-26 추가
- **관련 plan**: `plan/in-progress/spec-overview-followups-2026-05-18.md` §1 (worktree `spec-overview-followups-bundle`) — `spec/4-nodes/_product-overview.md` §4.8~§4.12 번호 시프트 (Filter 섹션 신설로 인한 §§ 번호 재편) 작업이 PR 생성 대기 중 (`- [ ] PR + merge`)
- **상세**: `spec-overview-followups-2026-05-18.md` §1 은 `spec/4-nodes/_product-overview.md` 에 Filter §4.8 섹션을 신설하고 뒤 섹션 번호를 시프트하는 spec-only PR 을 "일괄 처리 완료, PR 미머지" 상태로 남겨두고 있다 (`- [ ] PR + merge`). target plan 도 동일 파일의 §6.1 AI Agent 표에 ND-AG-26 행을 추가한다. 두 PR 이 같은 파일을 병렬로 수정하면 merge 충돌이 발생한다.
- **제안**: `spec-overview-followups-2026-05-18.md` §1 의 PR 이 먼저 merge 된 후에 target 의 `spec/4-nodes/_product-overview.md` 편집을 진행한다. 또는 target worktree 에서 §1 의 Filter 섹션 시프트를 먼저 rebase 적용한 뒤 ND-AG-26 를 추가한다.

---

### [INFO] `spec/conventions/conversation-thread.md` §1.2 `data?` 필드 확장 — 단일 진실 유지 여부 결정 필요

- **target 위치**: `plan/in-progress/ai-presentation-tools.md` §2 결정사항 10번 ("ConversationTurn 확장: 기존 `data?` 자유 필드에 `presentations: PresentationPayload[]` 추가"), §4.1 → `spec/conventions/conversation-thread.md` §1.2 `data?` 설명에 `presentations` 필드 한 줄 cross-ref (선택 사항)
- **관련 plan**: 없음. 단, `spec/conventions/conversation-thread.md` §1.2 의 `data?` 필드는 현재 "`output.interaction.data` snapshot" 으로 엄격 정의되어 있고, `ai_assistant` source turn 에 `presentations[]` 를 추가하는 것은 기존 정의를 벗어나는 새 시멘틱이다.
- **상세**: `ConversationTurn.data?` 는 현재 `output.interaction.data` snapshot 전용으로 정의되어 있다. target 이 이 필드에 `presentations: PresentationPayload[]` 를 추가하면 `data?` 의 shape 이 `interaction.type` 별 단일 정의 (`node-output §4.5`) 를 벗어나 `ai_assistant` source 한정 presentations 배열을 포함하는 복합 구조가 된다. 이는 spec §1.2 의 "drift 회피 위해 본 표에 재열거하지 않음" 원칙과 충돌할 수 있다. target plan 은 이를 "선택 — 단일 진실 유지 시 ai-agent 본문에만 두는 것도 가능"으로 명시하고 있어 내부 인식은 있다.
- **제안**: spec 작성 시 `data?` 를 확장하는 방식보다는 `ai_assistant` 턴의 새 top-level 필드 (`presentations?`) 로 분리하는 방안을 검토한다. `data?` 를 확장한다면 conversation-thread.md §1.2 의 `data?` 정의 자체를 개정하고 "source 별 shape" 표를 §1.4 에 추가해야 단일 진실이 유지된다.

---

### [INFO] `spec/4-nodes/3-ai/_product-overview.md` §3.2 ND-AG-26 추가 시 마지막 ND-AG 번호 확인

- **target 위치**: `plan/in-progress/ai-presentation-tools.md` §4.1 → `spec/4-nodes/3-ai/_product-overview.md` §3.2 ND-AG-26 추가
- **관련 plan**: 없음
- **상세**: 현재 `spec/4-nodes/3-ai/_product-overview.md` 의 마지막 ND-AG 번호는 ND-AG-25다 (`spec/4-nodes/_product-overview.md` 에서도 동일하게 ND-AG-25 가 최종). ND-AG-26 신설은 순번이 연속적이므로 문제없다.
- **제안**: 추가 전 두 파일(`spec/4-nodes/3-ai/_product-overview.md` 와 `spec/4-nodes/_product-overview.md`)의 마지막 ND-AG 번호를 재확인하여 25 이후 번호가 새로 추가되지 않았는지 점검한다.

---

### [INFO] `node-output-redesign/README.md` Phase E 에 ai-agent P0 완료 후속 항목 미등록

- **target 위치**: `plan/in-progress/ai-presentation-tools.md` §4.3 백엔드 구현 — `ai-agent.handler.ts` dispatcher 분류 로직에 `render_*` prefix 분류 추가 (`renderToolProvider.matches()`)
- **관련 plan**: `plan/in-progress/node-output-redesign/README.md` Phase E — P0 ai-agent error builder 완료 후 §6.1 single-turn 실행 로직이 정리될 예정
- **상세**: target 의 구현이 `ai-agent.handler.ts` dispatcher 에 새 분류 로직을 추가하므로, `node-output-redesign` P0 완료 이후의 handler 상태를 기준으로 target 이 구현될 때 dispatcher 분기 흐름이 충돌 없이 합산되는지 확인이 필요하다. 현재 P0 에 대한 별도 worktree 가 없으므로 즉각 충돌은 아니다.
- **제안**: target 착수 전에 `node-output-redesign` P0 의 완료 여부를 확인하고, P0 완료 시 handler 의 변경 내용을 target spec 의 §6.1 기술에 반영한다.

---

## 요약

`plan/in-progress/ai-presentation-tools.md` 는 `spec/4-nodes/3-ai/1-ai-agent.md`, `spec/4-nodes/6-presentation/0-common.md`, `spec/4-nodes/_product-overview.md`, `spec/4-nodes/3-ai/_product-overview.md`, `spec/conventions/conversation-thread.md` 를 수정 대상으로 한다. 현재 활성 worktree(`ai-presentation-tools-9b7c5c`)와 동일 파일을 편집 중인 다른 worktree 는 발견되지 않았다(기존 `ai-agent-turn-fail-finalize-a22724`, `spec-conversation-ui-contract` 는 모두 PR 머지 완료). 다만 세 가지 WARNING 이 존재한다: (1) `ai-agent-tool-connection-rewrite.md` 가 `spec/4-nodes/3-ai/1-ai-agent.md` §4 를 편집 대상으로 공유하며 `tool_*` 접두사 결정이 미결인 채 target 과 인접 영역을 다루고 있다. (2) `node-output-redesign/ai-agent.md` P0 가 동일 파일의 §6.1 / §10 을 편집 예정이므로 착수 직렬화 검토가 필요하다. (3) `spec-overview-followups-2026-05-18.md` §1 의 PR 미머지로 `spec/4-nodes/_product-overview.md` 편집이 동시에 일어날 수 있다. CRITICAL 등급 충돌(미해결 결정 우회 또는 동시 worktree 경합)은 발견되지 않았다.

## 위험도

MEDIUM
