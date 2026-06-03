# Rationale 연속성 검토 결과

검토 범위: `spec/4-nodes/3-ai/` (0-common.md / 1-ai-agent.md / 2-text-classifier.md / 3-information-extractor.md)
검토 모드: `--impl-done`, `diff-base=origin/main`
검토 일시: 2026-06-03

---

## 발견사항

### 1.

**[INFO]** `memoryStrategy` 를 `contextScope` enum 확장이 아닌 별도 필드로 둔 결정 — 명시적 기각 이력 존재, target 은 이를 준수하며 정합

- target 위치: `spec/4-nodes/3-ai/1-ai-agent.md §1 config 표`, `공통 §10`
- 과거 결정 출처: `spec/4-nodes/3-ai/1-ai-agent.md §12.9` Rationale
- 상세: §12.9 는 `contextScope` enum 에 `auto` 값을 추가하는 안을 명시적으로 기각하고 `memoryStrategy` 를 별도 1급 필드로 채택했다. target 의 §1 config 표와 공통 §10 은 이 결정을 그대로 따르고 있으며 위반 없음. 정합 확인 차원 INFO.
- 제안: 이상 없음.

---

### 2.

**[INFO]** `conversationHistory` + `historyCount` 폐기 결정 — target 에서 재도입 흔적 없음

- target 위치: `spec/4-nodes/3-ai/1-ai-agent.md §1 config 표`
- 과거 결정 출처: `spec/4-nodes/3-ai/1-ai-agent.md §12.2` Rationale ("handler 코드가 한 번도 읽지 않는 deadweight, `contextScope`/`contextScopeN` 으로 완전 대체")
- 상세: target 의 §1 config 표에 폐기된 `conversationHistory`/`historyCount` 필드가 재등장하지 않는다. §12.2 의 폐기 결정이 준수되고 있음.
- 제안: 이상 없음.

---

### 3.

**[INFO]** `tool_*` / `toolNodeIds` / `toolOverrides` 비활성 결정 — target 이 일관되게 준수하나, §4 본문이 폐기된 내용을 참조 형태로 잔존

- target 위치: `spec/4-nodes/3-ai/1-ai-agent.md §4 Tool Area 연동`, §1 의 `⚠ 재작성 예정` 주석
- 과거 결정 출처: `spec/4-nodes/3-ai/1-ai-agent.md §1 config 표 주석` ("toolNodeIds / toolOverrides 필드, §Tool Area 연동 … 모두 config 스키마에서 제거됐다")
- 상세: §1 에는 해당 필드 제거·비활성이 명시되어 있고, §4 의 Tool Area 절에도 `⚠ 재작성 예정 (현재 제거됨)` 경고가 붙어 있다. §4 본문(도구 이름 규칙 표, ToolOverride 구조 표 등)이 폐기된 설계를 계속 기술하고 있는 것은 이력 보존 목적이지 재도입 의도가 아니며 Rationale 에도 "스키마에서 제거됐다"고 명시되어 있다. `tool_call_not_implemented` 는 "미구현(Planned)"으로 표기돼 있어 현재 도입 아님.
- 제안: §4 절 상단 경고 문구가 충분히 강조되고 있어 현 상태로 혼동 가능성은 낮으나, 장기적으로 섹션 전체를 stub 수준으로 축약하면 새로운 기여자의 혼동을 줄일 수 있다.

---

### 4.

**[INFO]** KB 검색을 LLM 능동 호출 시에만 실행 (prefill 금지) — target 준수

- target 위치: `spec/4-nodes/3-ai/1-ai-agent.md §6.1 단계 1.b`, `공통 §2`
- 과거 결정 출처: `spec/4-nodes/3-ai/0-common.md §2` ("KB 검색은 LLM 의 능동 호출 시에만 실행되며 prefill 하지 않는다")
- 상세: target 의 §6.1 1.b 와 §6.2 2.d 모두 "능동 호출 시에만 실행, prefill 하지 않음"을 일관되게 유지. 기존 원칙 준수.
- 제안: 이상 없음.

---

### 5.

**[WARNING]** `conversation-thread §7 v2 로드맵` 의 "token-aware cap" + "DB 컬럼 신설" 유보 결정을 target 이 부분 번복 — 번복 근거는 §12.10 에 기술되어 있으나 `0-common.md §10` / `2-text-classifier.md §8` 에는 해당 번복 근거의 cross-reference 가 없음

- target 위치: `spec/4-nodes/3-ai/0-common.md §10` (memoryStrategy 필드 설명), `spec/4-nodes/3-ai/2-text-classifier.md §8 Rationale`, `spec/4-nodes/3-ai/3-information-extractor.md §8 Rationale`
- 과거 결정 출처: `spec/conventions/conversation-thread.md §7 v2 로드맵` ("Token-aware cap: v2", "DB 컬럼 신설: v2"), `spec/4-nodes/3-ai/1-ai-agent.md §12.1 v1/v2 경계표`
- 상세: §12.1 은 "v1: char 기반 cap, 신규 DB 컬럼 없음"을, conversation-thread §7 은 token-aware cap 과 DB 컬럼 신설을 v2 유보로 명시했다. target 의 `memoryStrategy: 'summary_buffer' / 'persistent'` 도입과 `agent_memory` 별도 테이블은 사실상 이 v2 유보 항목들을 v1 에 일부 실현한다. §12.10 이 번복 근거를 충분히 기술하고 있으나(`별도 테이블이라 conversation_thread jsonb 컬럼과 모순 없음`, `부분 실현`), 0-common.md §10 의 memoryStrategy 설명이나 2-text-classifier.md / 3-information-extractor.md §8 Rationale 에는 해당 번복 근거 참조가 누락되어 있다. 두 노드의 §8 Rationale 은 "본 노드 단독 결정 없음 — 공통 규약을 그대로 따른다"로 짧게 기술되어 §12.10 참조가 없다.
- 제안: `2-text-classifier.md §8` 및 `3-information-extractor.md §8` Rationale 에 "memoryStrategy AI Agent 한정 적용 (text_classifier/information_extractor 는 v2) — 번복 근거는 ai-agent §12.10 참조" 한 줄을 추가하면 Rationale 연속성이 완성된다. 또는 `0-common.md §10 memoryStrategy 행` 각주에 §12.10 cross-reference 를 추가.

---

### 6.

**[INFO]** `render_form` 의 별도 stack 표현 폐기 — target 준수, §12.5 에 근거 기록됨

- target 위치: `spec/4-nodes/3-ai/1-ai-agent.md §6.1.d.ii`, §6.2 step 2.c.bypass
- 과거 결정 출처: `spec/4-nodes/3-ai/1-ai-agent.md §12.5` Rationale ("render_form 만 별도 stack 으로 분리되어 있던 옛 표현은 폐기")
- 상세: target 은 assistant turn 의 `presentations[]` payload inline 단일 진실을 일관되게 적용하고 있으며, 별도 stack 패턴이 재도입된 흔적 없음.
- 제안: 이상 없음.

---

### 7.

**[INFO]** `render_form` submit tool_result 의 `rendered: false` 및 `status: 'form_submitted'` 추가 필드 기각 — target 준수

- target 위치: `spec/4-nodes/3-ai/1-ai-agent.md §6.1.d.ii`, §12.6
- 과거 결정 출처: `spec/4-nodes/3-ai/1-ai-agent.md §12.6` "기각된 추가 필드" (`rendered: false`, `status: 'form_submitted'`)
- 상세: target 의 tool_result shape 은 `{ok, type, data, message}` 이며, 기각된 필드가 재도입되지 않았다.
- 제안: 이상 없음.

---

### 8.

**[INFO]** `retry_last_turn` 성공 후 downstream 차단 대안 기각 — target 준수

- target 위치: `spec/4-nodes/3-ai/1-ai-agent.md §7.9 재진입 종결 후 graph 진행` 단락
- 과거 결정 출처: `spec/4-nodes/3-ai/1-ai-agent.md §12.8` "기각된 대안" (downstream 차단 유지, `retry_last_turn_and_resume` 분리)
- 상세: target 은 retry 성공 시 downstream 정상 진행 정책을 명시적으로 기술하고 있으며, 기각된 두 대안이 재도입된 흔적 없음.
- 제안: 이상 없음.

---

### 9.

**[INFO]** `system_error` source 를 별도 store 필드나 `system` source discriminator 로 분리하는 안 기각 — target 준수

- target 위치: `spec/conventions/conversation-thread.md §8.3`
- 과거 결정 출처: `spec/conventions/conversation-thread.md §8.3` Rationale ("별도 store 필드로 분리하는 안은 live conversation thread 의 자연 순서를 잃고 … 기각")
- 상세: target 의 conversation-thread §8.3 은 기각된 두 대안(`system` source discriminator 재사용, 별도 store 필드 분리)을 명시하고 채택 결정을 유지한다.
- 제안: 이상 없음.

---

### 10.

**[INFO]** `emit messages` 를 conversation Preview 1차 소스로 사용하는 패턴 금지 — target 준수

- target 위치: `spec/conventions/conversation-thread.md §8.1`, §9.4
- 과거 결정 출처: `spec/conventions/conversation-thread.md §8.1` ("emit messages 를 conversation Preview 에서 격리한 이유"), §9.3 D4 / §9.4 D6
- 상세: target 이 `conversationThread` snapshot 을 1차 소스로, emit messages 를 LLM debug 패널 전용으로 격리하는 결정을 일관되게 유지한다.
- 제안: 이상 없음.

---

### 11.

**[WARNING]** `0-common.md §10` 의 `text_classifier` / `information_extractor` contextScope inject v2 유보 기술과 `2-text-classifier.md` / `3-information-extractor.md` config 표 간 불일치 가능성

- target 위치: `spec/4-nodes/3-ai/0-common.md §10` ("v1 은 `ai_agent` 만 push + 자동 주입을 구현하고, `text_classifier` / `information_extractor` 는 … v2 에 push hook + 자동 주입이 함께 추가된다"), `spec/4-nodes/3-ai/2-text-classifier.md §1 config 표`, `spec/4-nodes/3-ai/3-information-extractor.md §1 config 표`
- 과거 결정 출처: `spec/conventions/conversation-thread.md §2.3 적용 범위` ("자동 주입(inject — contextScope 활성화): ai_agent 만"), `spec/4-nodes/3-ai/0-common.md §10`
- 상세: `0-common.md §10` 은 text_classifier / information_extractor 의 contextScope inject 가 v2 범위임을 명확히 기술한다. 그러나 `2-text-classifier.md §1` config 표와 `3-information-extractor.md §1` config 표에는 `contextScope` 관련 필드(`contextScope`, `contextScopeN`, `contextInjectionMode`, `includeToolTurns`, `excludeFromConversationThread`)가 존재하는지 여부가 명시적으로 확인되지 않았다. `2-text-classifier.md` 에는 `includeSystemContext` / `systemContextSections` 만 config 표에 포함되어 있으며 contextScope 관련 필드가 없는 것이 확인된다 — 이는 v2 유보와 일치한다. `3-information-extractor.md` 도 동일하게 확인된다. 즉 위반은 없으나, 두 노드가 `excludeFromConversationThread` 를 config 에 갖고 있는지 여부가 스펙에서 명시적으로 기술되지 않아 확인이 필요하다. `excludeFromConversationThread` 는 conversation-thread §2.4 에서 push 동작 관련이라 inject v2 유보와 별개이며, 현재 두 노드 config 표에 없는 것이 확인된다.
- 제안: 두 노드 config 표에 `excludeFromConversationThread` (opt-out, v1 범위) 필드 추가 여부를 검토. 만약 push 가 이미 출하됐다면 (`pushClassifierTurn` / `pushExtractorTurn` — conversation-thread §2.3) opt-out 필드도 v1 에서 노출해야 한다. 이는 Rationale 위반이 아니라 spec 미완 gap 이다.

---

## 요약

`spec/4-nodes/3-ai/` 전체 검토 결과, 명시적으로 기각·폐기된 대안의 재도입 사례(CRITICAL)는 발견되지 않았다. 합의된 설계 원칙(KB prefill 금지, conversationHistory 폐기, render_form inline 단일 진실, retry downstream 차단 기각 등)도 모두 target 에서 준수되고 있다. 주요 유의사항은 두 가지다. 첫째, `conversation-thread §7 v2 로드맵`이 유보한 token-aware cap / persistent memory 기능을 v1 에 부분 실현하는 번복이 이루어졌고, 그 근거가 `1-ai-agent.md §12.10` 에는 충분히 기술되어 있으나 `2-text-classifier.md` / `3-information-extractor.md §8 Rationale` 에는 cross-reference 가 없다. 둘째, `0-common.md §10` 의 v2 유보 범위와 두 하위 노드의 config 표 사이에서 `excludeFromConversationThread` opt-out 필드 노출 여부가 명시되지 않아 미완 gap이 있다. 두 사항 모두 WARNING 수준이며 현재 설계 원칙 자체를 파괴하지 않는다.

## 위험도

LOW

---

STATUS: SUCCESS
