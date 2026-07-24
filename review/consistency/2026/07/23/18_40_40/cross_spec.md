# Cross-Spec 일관성 검토 — spec/4-nodes/6-presentation

## 검토 방법
target(`spec/4-nodes/6-presentation/{0-common,1-carousel,2-table,...}.md`)이 인용하는 모든 cross-spec 앵커를 실제 워크트리(`/Volumes/project/private/clemvion/.claude/worktrees/resumable-handler-generic-typing-3918dd`)의 해당 spec 파일에서 대조 확인했다:

- `spec/5-system/6-websocket-protocol.md` §4.2 (`execution.submit_form`/`execution.click_button` payload, ack, `INVALID_EXECUTION_STATE`), §4.4 (`conversationConfig.pendingFormToolCall`)
- `spec/5-system/4-execution-engine.md` §7.4 (Continuation Bus 메시지 타입 6종), §7.5.1 (publisher 사전 검증 / 표면 매트릭스)
- `spec/4-nodes/3-ai/1-ai-agent.md` §4.1, §6.1.d.ii, §6.2(2.c/2.c.bypass/2.c.fallback), §7.4, §7.10, §12.4~§12.7
- `spec/conventions/node-output.md` §4.2(폐기 필드 과도기 예외), §4.5(interaction.data payload 규격)
- `spec/conventions/conversation-thread.md` §1.2, §1.4, §1.6, §9.1, §9.9(Inv-5)
- `spec/conventions/interaction-type-registry.md` (`WaitingInteractionType` 4값 / EIA 3값 매핑)
- `spec/1-data-model.md` §2.14 NodeExecution
- 코드 대조: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts::continueExecution`, `codebase/backend/src/modules/execution-engine/button-interaction.service.ts` (legacy `interactionData` vs 구조화 `structuredInteraction` 분리 확인)

`git diff --stat origin/main HEAD -- spec/` 결과가 비어 있어(현재 워킹트리 HEAD가 origin/main 과 spec/ 기준 동일), 본 target 문서는 이미 origin/main 에 병합된 상태의 전수 검토로 수행했다(diff 국소 리뷰가 아닌 cross-ref 전체 대조).

## 발견사항

없음 — CRITICAL/WARNING 급 충돌을 발견하지 못했다.

### 참고 (비차단, 검증 완료 사항 — 발견사항 아님)

- WS §4.2 는 target §10.9 이 도입한 internal continuation bus sentinel(`{type:'form_submitted', formData}`)을 이미 "외부 wire 호환 유지" 각주로 정확히 cross-ref 하고 있고, 실제 `continueExecution()` 코드 주석도 `spec/4-nodes/6-presentation/0-common.md §10.9` 를 명시 인용해 구현·spec·인접 spec(WS) 3자가 완전히 정합했다.
- execution-engine §7.4 의 Continuation Bus 메시지 타입 "6종"(`continue`/`cancel`/`button_click`/`ai_message`/`ai_end_conversation`/`retry_last_turn`) 서술이 target §10.9 의 동일 주장과 정확히 일치 — target 이 "6종 표는 변경 없음, payload 안 sentinel 만 신규" 라고 명시한 범위 제한과도 부합.
- ai-agent.md §6.2 step 2.c.fallback 이 target §10.9 가 요구하는 `pendingFormToolCall` 누락 fallback(§7.4 invariant 예외, plain user 메시지로 push)을 이미 담고 있어 양방향 SoT cross-ref 가 대칭적으로 성립.
- interaction-type-registry.md 의 `WaitingInteractionType`(4값: form/buttons/ai_conversation/ai_form_render) 과 target 의 `meta.interactionType: 'buttons'` 사용이 충돌 없이 정합.
- node-output.md §4.5 의 `interaction.data` payload 표(`button_click`/`button_continue`/`form_submitted`)가 target 0-common.md §4.2 표와 필드 단위로 일치.
- `NodeExecution.interaction_data`(data-model.md §2.14, legacy 단순 shape: `{interactionType, buttonId?, buttonLabel?, clickedAt, clickedBy}`)는 node-output §4.5 의 `output.interaction.data`(구조화 shape, `selectedItem?`/`url?` 포함)보다 필드가 적다. 코드 확인 결과(`button-interaction.service.ts`) 이는 의도된 legacy wire-shape vs 신규 구조화 shape 의 **기존** 분리이며 코드 주석에도 명시돼 있다 — target 문서가 새로 만든 불일치가 아니고, target 도 이 구분을 정확히 전제하고 있어 크로스스펙 충돌로 분류하지 않았다.

## 요약

Presentation 카테고리 spec(0-common/1-carousel/2-table 등, chart/form/template 은 payload 크기 제한으로 본 검토 입력에 전문이 포함되지 않음)이 인용하는 모든 타 영역 spec 앵커 — WebSocket 프로토콜, 실행 엔진(Continuation Bus·§7.5.1 표면 매트릭스), AI Agent(§4.1/§6.x/§7.x/§12.x), Conversation Thread, node-output 컨벤션, interaction-type-registry — 를 실제 해당 spec 파일 및 코드와 대조한 결과 데이터 모델·API 계약·요구사항 ID·상태 전이·권한·계층 책임 어느 관점에서도 직접 모순을 발견하지 못했다. 특히 §10.9(internal continuation bus sentinel)는 presentation·WS·AI Agent·execution-engine 4개 spec 파일과 backend 코드 주석까지 명시적으로 상호 cross-ref 되어 있어 이번 변경이 다른 영역과 사전 조율된 상태로 반영됐음을 확인했다. 유일하게 표면화된 항목(NodeExecution.interaction_data 의 legacy 축약 shape vs output.interaction.data 구조화 shape)은 target 이전부터 존재하던 의도적 분리이며 target 문서 자체가 그 구분을 올바르게 전제하고 있어 충돌로 판정하지 않았다.

## 위험도
NONE
