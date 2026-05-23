# 요구사항(Requirement) Review

대상 커밋: `d607c9ec39f77256673ed8d66e4acb18ffd24903`  
리뷰 완료 시각: 2026-05-23

---

## 발견사항

### [CRITICAL] spec 에 존재하지 않는 섹션 참조 — §6.2 step 2.c.bypass / §12.5 / Inv-7 / CT-S12/13/14

- **위치**: 변경된 모든 파일의 인라인 주석, commit message (`Spec: spec/4-nodes/3-ai/1-ai-agent.md §6.1.d.ii / §6.2 step 2.c.bypass / §12.5`), `ai-agent.handler.spec.ts` describe 블록 주석, `execution-store.test.ts` describe 주석, `assistant-presentations-block.test.tsx` describe 주석.
- **상세**: `spec/4-nodes/3-ai/1-ai-agent.md` 는 `§12.5` 섹션이 없다 (마지막 섹션은 `§12.4`). `§6.2` 내에 `step 2.c.bypass` 라는 명시 항목이 존재하지 않는다 — §6.2 step 2.c 는 form_submitted 처리만 정의하며, bypass(일반 채팅 메시지로 form 을 우회하는 경로) 분기는 spec 본문에 정의돼 있지 않다. `spec/conventions/conversation-thread.md` 에는 `Inv-7` 이 없다 (Inv-1 ~ Inv-6 까지만 존재, 2026-05-23 갱신 기준). `CT-S12`, `CT-S13`, `CT-S14` 도 해당 spec 의 §9.10 표에 없다 (CT-S11 까지만 있음). 코드와 테스트가 존재하지 않는 spec 섹션을 인용하는 것은 SDD 원칙 위반이며, 구현이 spec 보다 앞서 있음을 나타낸다.
- **제안**: `project-planner` 에 위임하여 (a) `spec/4-nodes/3-ai/1-ai-agent.md §6.2` 에 `step 2.c.bypass` 항목 신설 — form 활성 중 `execution.submit_message` 수신 시의 cancelled tool_result fallback 행위 정의; (b) `§12.5` 또는 `§12.4` 하위 subsection 으로 inline form 단일 진실 결정 근거 추가; (c) `spec/conventions/conversation-thread.md §9.9` 에 `Inv-7` (ai_form_render resume 시 waitingNodeId / waitingInteractionType / isWaitingAiResponse 보존 불변량) 신설; (d) `§9.10` 에 CT-S12/S13/S14 시나리오 행 추가.

---

### [CRITICAL] `presentation_user` thread push 누락 — form_submitted 케이스의 spec §6.2 step 2.c 위반

- **위치**: `ai-agent.handler.spec.ts` 신규 테스트 케이스 "source: 'form_submitted' + pendingFormToolCall set → tool_result splice + presentation_user thread push + pendingFormToolCall 클리어" (라인 347).
- **상세**: 테스트 설명에 `presentation_user thread push` 가 명시돼 있으나, 실제 테스트 본문에서 `presentation_user` push 를 검증하는 assertion 이 없다. spec §6.2 step 2.c (`spec/4-nodes/3-ai/1-ai-agent.md` line 360) 는 "form 제출 시 thread 에 `presentation_user` source 로 push + `data.via: 'ai_render'` sentinel" 을 명시하지만, 테스트는 tool_result content 와 pendingFormToolCall 클리어만 확인하고 ConversationThread push 동작은 무시한다. 구현 측 `ai-agent.handler.ts` 의 form_submitted 분기에서 실제로 `presentation_user` push 가 일어나는지 여부도 테스트로 증명되지 않는다.
- **제안**: `form_submitted` 케이스 테스트에 `this.pushAiThreadTurn(…, 'presentation_user', …)` 및 `data.via: 'ai_render'` 에 대한 assertion 추가. 또는 handler 내 pushAiThreadTurn 호출 여부를 spy 로 검증.

---

### [WARNING] form_submitted 케이스에서 spec 요구 `data.via: 'ai_render'` sentinel 검증 부재

- **위치**: `ai-agent.handler.ts` 변경 분 (form_submitted 경로, 기존 코드 유지 구간) + `ai-agent.handler.spec.ts` form_submitted 테스트.
- **상세**: spec §6.2 step 2.c (line 360) 는 `presentation_user` turn 에 `data.via: 'ai_render'` sentinel 이 포함되어야 한다고 명시한다 ("그래프 form 노드 출처의 `data.via` 미설정과 구분"). form_submitted 분기는 기존 코드(이번 PR 이전)를 유지하므로 직접 변경은 없으나, 새 테스트에서도 이 sentinel 이 검증되지 않는다. 신규 `source` 분기 추가가 기존 sentinel push 경로를 의도치 않게 우회했을 가능성이 있다.
- **제안**: form_submitted 케이스 테스트에 `data.via === 'ai_render'` 검증 추가. `presentation_user` push 를 spy 로 캡처해 sentinel 포함 여부를 단언.

---

### [WARNING] bypass 케이스에서 form_submitted 처리 없이 `submit_form` 명령 수신 시 동작 미정의

- **위치**: `execution-engine.service.ts` 변경 분 (line 2079, `'form_submitted'` dispatch) + `ai-agent.handler.ts` bypass 분기.
- **상세**: spec §6.2 step 2.a (line 358) 는 "`submit_form` 은 `_resumeState.pendingFormToolCall` 이 set 된 경우에만 유효 — 매칭하는 `toolCallId` 가 없으면 reject" 라고 명시한다. 현재 구현에서 엔진이 `'form_submitted'` source 로 dispatch 하지만 handler 안의 `pendingFormToolCall` 가 이미 클리어된 경우(race condition / double-submit) `else` fallback 분기(plain ai_user 경로)로 떨어진다. spec 은 `reject` 를 요구하나 handler 는 silent fallback 으로 처리한다. 이 경우의 명시적 에러 처리나 `reject` 경로가 테스트로 보호되지 않는다.
- **제안**: double-submit / race 시나리오에서 엔진 수준의 `pendingFormToolCall` 유효성 검증(toolCallId matching) 이 handler 호출 이전에 이루어지는지 확인하거나, handler 의 fallback 동작이 spec 의 `reject` 요건을 충족하도록 에러 반환 또는 early-return 추가.

---

### [WARNING] `resumeFromAiRenderForm` store action 이 spec §9.7.1 표에 부재

- **위치**: `execution-store.test.ts` 신규 테스트 + `page.tsx` / `run-results-drawer.tsx` 의 `resumeFromAiRenderForm` 사용.
- **상세**: spec §9.7.1 (conversation-thread.md line 473) 의 "Lifecycle 액션 → reset 정책 표"에는 `resumeFromForm` / `resumeFromButtons` / `resumeFromConversation` 세 가지만 나열된다. `resumeFromAiRenderForm` 은 이 표에 없다. 이 action 의 reset 정책 — 특히 입력 affordance reset 이 적용되지 않는다는 결정(waitingNodeId / waitingInteractionType 보존) — 이 spec 에 문서화돼 있지 않다. 코드는 `pendingFormToolCall` 만 null patch 하고 나머지를 보존한다고 주석에 적지만, spec 의 단일 진실(§9.7.1)과 괴리가 있다.
- **제안**: `project-planner` 에 위임하여 spec §9.7.1 표에 `resumeFromAiRenderForm` 행과 reset 정책(입력 affordance: 부분 적용 — `waitingConversationConfig.pendingFormToolCall` null patch 만, 나머지 affordance 보존 / conversation snapshot: 미적용) 추가.

---

### [WARNING] `execution.submit_form` 명령 수신 경로와 `submit_message` 경로의 source 결정이 엔진 상수로 하드코딩

- **위치**: `execution-engine.service.ts` 변경 (line ~2055 `'ai_message'`, line ~2079 `'form_submitted'`).
- **상세**: spec §6.2 step 2.a 는 클라이언트가 `execution.submit_message` 또는 `execution.submit_form` 명령으로 진입한다고 정의한다. 현재 구현은 엔진이 action 타입을 보고 직접 `'ai_message'` / `'form_submitted'` 문자열을 하드코딩해 handler 에 전달한다. 새로운 타입 `ResumableMessageSource` 가 추가됐으나 이것이 spec 에 명시된 type 이 아니라는 점에서, 향후 action 타입이 추가될 경우 확장성 의문이 있다. 위험도는 낮으나 spec 에 `ResumableMessageSource` 타입 자체가 정의돼 있지 않다.
- **제안**: `ResumableMessageSource` 타입 정의를 spec 에 추가(project-planner 위임) 또는 코드 주석에 "spec 미정의 내부 타입" 임을 명시.

---

### [INFO] `§6.1.d.ii` 의 "활성 form 의 UI 표면 = assistant turn 의 presentations[*].form 인라인" 은 spec 본문에 명시 없음

- **위치**: commit message, 모든 파일의 `// spec §6.1.d.ii` 주석.
- **상세**: spec §6.1.d.ii (line 340) 는 `render_form` 의 multi-turn blocking 흐름 진입을 정의하나, "활성 form 의 UI 표면이 assistant turn timeline 인라인이어야 한다" 는 UI 표현 규칙은 해당 섹션에 명시돼 있지 않다. 기존 spec 은 `output.interaction` 가 form preview 를 운반한다고만 설명한다. 프론트엔드 구현의 핵심 변경 근거인 "별도 surface stack 폐기 → timeline 인라인 단일화" 가 spec 에 등재되지 않았다.
- **제안**: `project-planner` 에 위임하여 spec §6.1.d.ii 또는 §12.5 (신설)에 UI surface 단일 진실(assistant turn 의 `presentations[*].form` 인라인, 별도 overlay stack 금지)을 명시.

---

### [INFO] `하위 호환` 테스트에서 `options 미전달 + pendingFormToolCall set` 시나리오 누락

- **위치**: `ai-agent.handler.spec.ts` "options 미전달 (구 호출자) + pendingFormToolCall 없음 → 정상 ai_user 경로 (하위 호환)" 테스트.
- **상세**: 테스트는 `pendingFormToolCall` 이 없는 상태에서 `options` 미전달 시 기존 경로로 가는지만 검증한다. 그러나 하위 호환에서 더 위험한 시나리오는 `options` 를 미전달하면서 `pendingFormToolCall` 이 set 된 경우이다 — 이 경우 기존 코드의 휴리스틱이 어떻게 동작하는지(form_submitted 로 fallback? ai_message bypass 로 분기?) 테스트가 없다. `options` 미전달 시 `source` 가 `'ai_message'` 로 기본값 처리되어 bypass 분기가 트리거될 수 있다.
- **제안**: `options` 미전달 + `pendingFormToolCall` set 시나리오 테스트 추가. 기대 동작을 spec 과 맞춰 명확히 정의.

---

### [INFO] `ct-S13` 테스트에서 form 제출 후 실제 API 콜 흐름 미검증

- **위치**: `assistant-presentations-block.test.tsx` CT-S13 첫 번째 테스트 케이스.
- **상세**: 테스트는 `DynamicFormUI` 가 렌더되는지만 검증한다. `onSubmitForm` 이 form 제출 시 실제로 호출되는지, form submit 이 `commands.submitForm` + `resumeFromAiRenderForm` 를 순서대로 호출하는지는 단위 테스트 범위 밖이다. CT-S12(제출 후 timeline persist)는 별도 테스트로 커버됐다고 commit message 에 명시되나 이 파일에는 없다.
- **제안**: `onSubmitForm` 콜백 호출 여부 검증 케이스 추가. CT-S12 충족 테스트 파일을 spec §9.10 표에 명시.

---

## 요약

이번 변경은 render_form 활성 form 의 UI 표면을 assistant turn timeline 인라인으로 단일화하고 form bypass(폼 활성 중 일반 채팅 우회) 분기를 신설하는 목적에 부합하는 구현을 포함하고 있다. 백엔드의 `ResumableMessageSource` 타입 도입, `processMultiTurnMessage` 시그니처 확장, `ai_message` / `form_submitted` source 분기 신설은 기능적으로 올바른 방향이다. 프론트엔드의 `pendingFormToolCallId` prop drill, `resumeFromAiRenderForm` store action, `AssistantPresentationsBlock` 의 active vs submitted 분기 처리도 의도한 기능을 구현한다. 그러나 코드와 테스트 전반에서 참조하는 spec 섹션(`§6.2 step 2.c.bypass`, `§12.5`, `Inv-7`, `CT-S12/S13/S14`)이 실제 spec 에 존재하지 않아 SDD 원칙이 역전된 상태다 — spec 이 구현을 앞서야 하는데 구현이 spec 을 앞서고 있다. 또한 form_submitted 케이스의 `presentation_user` thread push + `data.via: 'ai_render'` sentinel 이 테스트로 증명되지 않아 spec §6.2 step 2.c 의 핵심 요건이 회귀 위험에 노출돼 있다.

## 위험도

**HIGH** — spec 미등재 기능 분기가 다수이고 form_submitted 의 핵심 spec 요건(presentation_user push + sentinel)이 테스트로 보호되지 않는다.

---

STATUS: SUCCESS
