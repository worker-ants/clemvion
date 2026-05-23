# Rationale 연속성 검토 결과

검토 대상: `plan/in-progress/ai-presentation-form-inline.md`
검토 모드: spec draft 검토 (--spec)
검토일: 2026-05-23

---

## 발견사항

### 1. [INFO] `resumeFromForm` 분리 — 기각 대안이 과거 Rationale 에 기록되지 않은 상태에서 번복

- **target 위치**: `plan §2.3` 및 `§3` "기각된 대안" 표 2번째 행
- **과거 결정 출처**: `spec/4-nodes/3-ai/1-ai-agent.md §6.2 step 2.c`, §7.4, §12.4 (phase 2c 커밋 `cc47b439`)
- **상세**: 기존 spec §6.2 는 `resumeFromForm` 단일 action 이 `pendingFormToolCall` 클리어를 포함해 ai_form_render 제출 흐름을 처리하도록 설계됐다. target plan §2.3 은 "신규 action `resumeFromAiRenderForm`" 을 도입해 기존 `resumeFromForm` 을 `interactionType: 'form'` (그래프 form 노드) 전용으로 유지하고, ai_form_render 는 별도 action 으로 분리한다. 과거 spec 은 이 분리를 명시적으로 기각하거나 채택한 Rationale 항이 없다 — 즉 기존 Rationale 에서 "거부된 대안" 이 아니므로 CRITICAL 은 아니지만, 새 결정에 대한 Rationale 이 plan §3 에 간략히 서술될 뿐 spec §12 에 정식 항목으로 반영될 예정임을 §4.1 에서 명시하고 있어 계획 자체는 정합하다. 단, spec 갱신 전까지 §6.2 와 §7.4 의 `resumeFromForm` 단일 흐름 서술이 신규 action 분리 방향과 충돌 상태로 남는다.
- **제안**: §4.1 spec 갱신 시 `spec/4-nodes/3-ai/1-ai-agent.md §12.5` 에 "ai_form_render 제출 action 분리 (`resumeFromAiRenderForm`) 이유" 를 반드시 명시. 중간 단계에서 spec §6.2 의 step 2 설명이 구 단일 action 을 가리키고 있음을 인지하고 동시 갱신 보장 필요.

---

### 2. [WARNING] `output.result.presentations[]` echo 에 active state 박기 — 기각 대안과 유사한 패턴 제안 부재 확인

- **target 위치**: `plan §3` "기각된 대안" 표 3번째 행
- **과거 결정 출처**: `spec/4-nodes/3-ai/1-ai-agent.md §7.10` 및 §10 (Principle 1.1 직교성의 예외 정책)
- **상세**: target plan §3 이 "output.result.presentations[] echo 에 active state 박기" 를 기각하면서 "runtime state (어떤 toolCallId 가 pending) 는 backend `_resumeState` 에 보관 + WS 로 운반 — payload echo 에 박지 않는다 (Principle 1.1 직교성)" 라고 기각 이유를 제시했다. 이는 기존 spec §7.10 "단일 진실 정책 — execution history page 복원 echo" (두 위치 echo 는 Principle 1.1 직교성의 **예외**이며 의도된 것) 와 방향은 일치한다. 그러나 plan §2.2 의 채택 안 ("isActiveFormCall(toolCallId) predicate 로 분기 — `waitingConversationConfig.pendingFormToolCall.toolCallId === toolCallId` 체크") 은 사실상 WS payload 안의 `pendingFormToolCall.toolCallId` 를 런타임 state 로 사용하는 구조다. 이는 기각 이유 "(Principle 1.1 직교성) runtime state 는 `_resumeState` 에만" 과 외형상 유사하지만 실제로는 WS emit 으로 클라이언트에 정상 운반된 `conversationConfig.pendingFormToolCall` 을 사용하는 것이라 직교성 위반은 아니다. 단, 기각 이유 서술이 "echo payload 에 active 상태 박기" vs "WS 로 운반된 toolCallId 를 클라이언트 predicate 로 사용" 의 차이를 명확히 설명하지 않아, 향후 독자가 기각 이유와 채택 방향이 모순처럼 읽힐 수 있다.
- **제안**: plan §3 의 기각 이유 서술을 "payload echo (NodeExecution output) 에 active state 를 박지 않는다. 클라이언트 predicate 는 WS emit 경로의 `conversationConfig.pendingFormToolCall.toolCallId` — 이는 `_resumeState` → WS transport 정상 경로이며 Principle 1.1 의 echo 예외가 아님" 으로 보강한다. spec §12.5 Rationale 에도 동일 구분을 명시한다.

---

### 3. [WARNING] WS §4.4 `formConfig` 위치 단일화 — 기존 spec 서술과의 충돌이 plan 에서 "spec drift 정리" 로 기술되나 spec SoT 위치가 불명확

- **target 위치**: `plan §2.7`, `§4.1` (spec/5-system/6-websocket-protocol.md §4.4 갱신 항목)
- **과거 결정 출처**: `spec/5-system/6-websocket-protocol.md §4.4` 표 (`formConfig` 행), AI Agent §7.4
- **상세**: 현행 WS spec §4.4 표 (`formConfig` 행) 는 "`interactionType = form` 또는 `ai_form_render` 시 존재" 라고 기술하고 있으며, `conversationConfig.pendingFormToolCall: { toolCallId }` 만 명시하고 `formConfig` 가 `pendingFormToolCall` 안에 nest 된다는 내용은 없다. plan §2.7 은 이를 "spec drift" 로 분류해 spec 을 코드 동작에 맞추겠다고 하는데, 이것이 기존 spec 에서 명시적으로 기각된 결정은 아니지만, WS §4.4 표 자체가 `formConfig` 를 top-level 필드로 명시한 것과 plan 의 "nest 로 단일화" 방향이 충돌한다. spec 을 갱신하기 전까지 §4.4 가 `interactionType=ai_form_render` 시에도 top-level `formConfig` 가 있음을 암시해 독자 혼란을 야기한다.
- **제안**: plan §4.1 의 WS §4.4 갱신 항목에 "이전 spec 의 top-level `formConfig` (`ai_form_render`) 를 명시적으로 폐기하고 `conversationConfig.pendingFormToolCall.formConfig` 로 이동한다" 는 문장을 추가해 번복임을 명시한다. spec §12.5 또는 WS §Rationale 에 "ai_form_render 시 formConfig 위치 변경 근거 (코드 동작 일치 + single-location principle)" 를 기록한다.

---

### 4. [INFO] Form bypass (`pendingFormToolCall` set 상태에서 `submit_message`) — 기존 §6.2 에 정의된 `submit_form` 전용 거부 정책과의 관계 미명시

- **target 위치**: `plan §2.4`, `§2.5`, `§4.3`
- **과거 결정 출처**: `spec/4-nodes/3-ai/1-ai-agent.md §6.2 step 2.a` — "`submit_form` 은 `_resumeState.pendingFormToolCall` 이 set 된 경우에만 유효"; `spec/5-system/6-websocket-protocol.md §4.2` — `execution.submit_message` / `execution.submit_form` 의 분리 contract
- **상세**: 기존 spec 은 `render_form` 이 pending 된 상태에서의 `submit_message` 의 명시적 처리 규칙을 정의하지 않았다 (submit_message 는 일반 채팅 경로로만 설명됨). plan §2.4~5 는 이 경우 backend 가 cancelled tool_result 를 채우고 정상 ai_user turn 으로 진행하는 신규 처리를 도입한다. 이는 기존 spec 의 기각된 대안을 재도입하는 것이 아니라 미정의 케이스를 신규 정의하는 것이므로 Rationale 연속성 위반은 아니다. 그러나 기존 spec §6.2 step 2.a 의 "submit_form 이 set 경우에만 유효" 와 신규 bypass 흐름이 같은 상태에서 양립하는 조건이 spec 에 명시되지 않아, 향후 spec 독자가 "pendingFormToolCall set 상태에서 submit_message 가 오면 어떻게 되나" 를 §6.2 에서 찾을 수 없게 된다.
- **제안**: plan §4.1 의 AI Agent §6.2 갱신 항목에 "step 2.a 에 fallback 경로 추가 — `submit_message` 수신 시 form cancel + normal ai_user turn 흐름" 을 명시하고, §12.5 Rationale 에 "submit_message bypass 채택 vs MessageInput hidden/disabled 기각 이유 (plan §3 참조)" 를 명문화한다.

---

### 5. [INFO] `source` enum 확장 기각 근거와 기존 Conversation Thread §1.4 원칙의 정합 확인 권고

- **target 위치**: `plan §3` 기각된 대안 4번째 행 ("Active form 을 별도 ConversationTurn source (`ai_form_pending`) 로 분리")
- **과거 결정 출처**: `spec/conventions/conversation-thread.md §1.4` (source 별 변환 규칙), `§9.1` (source 별 시각 매핑)
- **상세**: plan §3 은 `source` enum 확장을 기각하면서 "Conversation Thread §1.1 + UI 5 source 매핑 + WS 마커 매핑 모두 갱신 필요" 를 이유로 든다. 이는 기존 spec 의 source enum 안정성 원칙 (변경 시 3-layer 동시 갱신 부담) 과 정합한다. 기각 방향 자체는 spec 원칙을 존중하므로 위반은 없다. 다만 plan §4.1 의 conversation-thread.md 갱신 항목 (§1.2·§9.1·§9.7·§9.10) 에서 `ai_form_render` waiting 케이스를 §9.7 WS 이벤트 → store 변환 계약 신규 행으로 추가하는 것은 source enum 확장 없이 기존 source 를 재활용하는 방식이므로 기각 근거와 일관된다.
- **제안**: spec §12.5 에서 "source 확장 기각" 이유가 plan §3 의 기각 사유보다 더 상세히 기술되도록, "AI Agent §9.7 신규 행이 source 확장 없이 가능한 이유" 를 함께 명시해 향후 유사 확장 시 참조 선례로 남긴다.

---

## 요약

target plan `ai-presentation-form-inline.md` 는 기존 spec (`spec/4-nodes/3-ai/1-ai-agent.md §12.4`, `spec/4-nodes/6-presentation/0-common.md §Rationale`, `spec/5-system/6-websocket-protocol.md §Rationale`) 의 Rationale 에서 명시적으로 기각된 대안을 재도입하는 패턴은 발견되지 않는다. plan 자체에 "기각된 대안" 표 (§3) 가 체계적으로 서술되어 있고, 신규 결정에 대한 spec §12.5 Rationale 신설을 의무화(§4.1) 하고 있어 번복 결정에 대한 근거 작성 계획도 마련되어 있다. 다만 세 가지 경계 이슈가 있다. (1) `resumeFromAiRenderForm` 신규 action 분리는 기존 spec 의 단일 action 서술과 충돌하는 번복이며, spec 갱신 전까지 §6.2 와 §7.4 가 구 방향을 가리킨다. (2) WS §4.4 의 `formConfig` top-level 표기가 plan 의 "nest 로 단일화" 방향과 일시적으로 충돌하며, 번복임을 plan 에서 명시하지 않았다. (3) Principle 1.1 직교성 기각 이유 서술이 채택 방향과 외형상 유사해 독자 혼란 여지가 있다. 이 세 이슈는 모두 spec §12.5 Rationale 과 plan §3·§4.1 보강으로 해소 가능하며, 현재 plan 의 아키텍처 방향 자체는 기존 합의된 원칙 (Principle 1.1 직교성, source enum 안정성, graceful degradation 원칙) 을 준수한다.

## 위험도

LOW
