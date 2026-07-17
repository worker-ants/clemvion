# Cross-Spec 일관성 검토 결과 (2회차) — `plan/in-progress/rag-tool-row-distinct-ui.md`

## 검토 대상 및 배경

1회차([`review/consistency/2026/07/17/11_32_25/cross_spec.md`](../11_32_25/cross_spec.md))에서 낸 CRITICAL — `meta.turnDebug` 를 conversation Preview 1차 소스로 승격하는 것이 `spec/conventions/conversation-thread.md` §8.1 D4·§9.3, `spec/5-system/6-websocket-protocol.md` §4.4 의 "Preview 1차 소스 = `conversationThread` snapshot" 경계와 충돌한다는 지적 — 에 대한 target 2회차 대응(실측 반증 + "기존 관행 정식화" 해소안)을 검증했다.

실측 반증(`result-detail.tsx:1026-1032`/`:1093`/`:1116`, `conversation-inspector.tsx:1206`)과 코드·spec 근거를 모두 직접 확인했다. 아래는 그 검증 결과다.

---

## 발견사항

### [해소 확인] 1회차 CRITICAL — `meta.turnDebug` Preview 소스화는 실제로 기존 drift 이며, target 의 "범위 명확화" 해소가 근거를 충족한다

- **target 위치**: "⚠ 1회차 consistency-check BLOCK" 절 전체, Phase 1 §A 항목 6·7 (`conversation-thread.md` §9.3·§8.1 D4), §B 항목 12·13 (`6-websocket-protocol.md` §4.4), §C 항목 14 (`9-rag-search.md` §4.1).
- **검증 (a) 실측 반증 사실 확인**:
  - `result-detail.tsx:1026-1032` — `turnRefIndex = new Map(aiMetadata?.turnDebug.map((t) => [t.turnIndex, t.ragSources]) ?? [])`. 직접 코드로 확인, target 인용과 정확히 일치.
  - `:1093`(live)·`:1116`(history) — 둘 다 `ConversationInspector` 에 `turnRefIndex` prop 전달, 확인.
  - `conversation-inspector.tsx:1199-1213` — `SummaryView` 의 assistant chat bubble 렌더 블록 안에서 `turnRefIndex?.get(item.turnIndex)` 로 조회해 `<ReferencesChip … compact />` 렌더. `SummaryView` 는 conversation Preview 탭의 타임라인 컴포넌트(§9.6 "적용 surface" 정의)가 맞다 — 1회차 반증은 사실이다.
  - **추가로 발견한 강화 증거**: `spec/5-system/9-rag-search.md` §4.1(line 295-296)이 **이미** "발견성을 위해 Preview 탭의 assistant 메시지 하단에 사용 문서명 chip 을 1줄로 표시"·"동일 항목이 turn 단위로 분리되어 `meta.turnDebug[].ragSources` … 에도 노출된다" 고 명문화하고 있다 — 즉 이 chip 은 코드에만 있는 게 아니라 **사전에 이미 spec 화**돼 있었다. 다만 `conversation-thread.md` 는 `9-rag-search.md` 를 한 번도 참조하지 않고(`grep` 확인, 0건) 그 역방향도 0건이다 — 두 spec 문서가 완전히 단절된 채 서로 다른 이야기를 하고 있었다. target 이 이 chip 을 "**기존, 미문서화**"라고 표현한 것은 부정확하다 — `conversation-thread.md` 관점에서는 미문서화가 맞지만 `9-rag-search.md` 관점에서는 이미 문서화돼 있다. 이 정정은 target 의 결론(기존 drift, 신규 위반 아님)을 **약화시키지 않고 오히려 강화**한다 — 코드 실측뿐 아니라 spec 텍스트로도 선행 근거가 있었다는 뜻이기 때문.
- **검증 (b) "범위 명확화 vs 번복" 논증 성립 여부**: `conversation-thread.md:322` 의 D4 원문("**conversation Preview 의 1차 소스를 `conversationThread` snapshot 으로 두고** emit messages 는 LLM debug 패널 … 전용으로 격리")을 직접 확인했다. 사유 문장은 명확히 "emit messages 는 … `[from <nodeLabel>]` prefix 가 박혀 있고 … 사용자 오인 + raw payload 의 strip 부담" 을 D4 의 근본 우려로 특정한다. `turnDebug[].ragSources` 스키마(`9-rag-search.md:277-289`: `documentId`/`documentName`/`chunkId`/`content`/`score`)에는 marker·prefix 가 없다 — target 의 "D4 위험 요인이 구조적으로 부재" 논증은 스키마 검증상 성립한다. 단, `meta.turnDebug` 전체가 아니라 **`ragSources` 서브필드에 한정된** 논증이라는 점이 중요 — `turnDebug[].llmCalls[].requestPayload/responsePayload` 는 여전히 raw debug payload 다(`6-websocket-protocol.md:498-499`, `:506` strip 근거와 동일). target Phase 2 항목 1·3(`mergeRagInjectionItems`, `RagInjectionRow`)이 `ragSources` 만 소비하고 `llmCalls` 를 렌더에 노출하지 않는 한 이 구분은 유지된다 — Phase 1 spec 문구에도 "`turnDebug[].ragSources`" 로 스코프를 좁혀 명시했으므로 (item 6) 정합하다.
- **검증 (c) 세 문서 동시 개정 충분성**: `6-websocket-protocol.md:716` 원문("대화 UI … 는 emit messages 가 아닌 `waiting_for_input.conversationThread.turns` snapshot … 을 1차 소스로 사용한다")을 직접 확인 — target item 13 이 정확히 이 문장을 대상으로 한다. `conversation-thread.md` §8.1 D4(item 7)·§9.3(item 6) 두 곳도 Phase 1 §A 에 포함. `9-rag-search.md` §4.1(item 14)도 §C 에 포함. **1회차가 "충돌 대상"으로 지목한 4곳 중 3곳**(D4, §9.3, WS §4.4)은 Phase 1 에 포함됐다. 나머지 1곳은 아래 WARNING 참조.
- **검증 (d) 1회차 WARNING 2건 해소 여부**:
  - WARNING 1 (§4.4 wire 미문서화): 실제로 `6-websocket-protocol.md` 전체를 검색한 결과 `nodeOutput.meta` 문자열이 **한 번도 등장하지 않는다** — `waiting_for_input` payload 필드 표(§4.4, line 430-437)에도 `formConfig`/`buttonConfig`/`conversationConfig` 만 있고 `nodeOutput.meta` 자체가 없다. 코드(`ai-turn-orchestrator.service.ts:467-486`)는 `nodeOutput.meta = buildConversationMetaFromResumeState(resumeState)` 를 emit 하며 그 helper(`ai-conversation-helpers.ts:97`)가 `turnDebug: state.turnDebugHistory` 를 반환 — target 의 실측 인용이 정확하고, WARNING 1 이 지적한 gap 도 실재한다. target item 12(§4.4 개정 — `nodeOutput.meta.turnDebug` 공식 문서화)가 이를 정확히 겨냥한다. **해소됨** (Phase 1 완료 시).
  - WARNING 2 (References 탭 vs 🔎 행 데이터 중복): `result-detail.tsx` 를 확인한 결과 `turnRefIndex`(chip 용, line 1026-1032)와 `ReferencesTabContent`(References 탭, line 679-763)가 **모두 동일한 `aiMetadata.turnDebug`**(line 194 주석: "Preview chip 과 References 탭이 동일 객체 공유")에서 파생된다 — 현재는 별개 함수(`turnRefIndex` Map 빌드 vs `ReferencesTabContent` 의 `.filter()`)지만 base 데이터가 같아 값은 항상 일치한다. target item 8(Inv-9)이 이 불변량을 명문화하고 "구현은 `turnRefIndex` 와 동일 소스 함수 재사용" 을 요구 — 신규 🔎 행도 같은 `aiMetadata.turnDebug` 를 소비하도록 설계돼 있어 3-way(📚 chip / 🔎 행 / References 탭) 정합이 구조적으로 보장된다. **해소됨**.
- **결론**: 1회차 CRITICAL 은 실제로 **기존(pre-existing) spec-코드 drift** 이며, target 의 "D4 번복이 아닌 범위 명확화" 해소는 (a) 실측 근거가 정확하고 (b) D4 의 원 우려(raw marker 노출)가 `ragSources` 구조화 데이터에 구조적으로 미적용됨을 스키마 레벨에서 검증 가능하며 (c) 관련된 세 문서 중 세 곳을 Phase 1 에서 동시 개정한다는 점에서 **논리적으로 성립**한다. CRITICAL 판정 취소.

### [WARNING] `spec/4-nodes/3-ai/1-ai-agent.md` L731-732 — 1회차 CRITICAL 이 명시 지목한 4번째 "충돌 대상" 이 Phase 1 편집 목록에서 누락

- **target 위치**: Phase 1 편집 목록(§A conversation-thread.md, §B 6-websocket-protocol.md, §C 9-rag-search.md) — `spec/4-nodes/3-ai/1-ai-agent.md` 관련 항목 없음.
- **충돌 대상**: `spec/4-nodes/3-ai/1-ai-agent.md:731-732`:
  - L731: `meta.interactionType` 행 — "1차 소스는 emit messages 가 아닌 `conversationThread` snapshot" (D4 인용, 그대로 두어도 무방 — turn 의 1차 소스 서술이라 범위 명확화 후에도 참).
  - L732: `meta.durationMs / 토큰 / turnDebug` 행 — "진행 중 누적치를 노출해 **References / LLM Usage 탭이 동작**".
- **상세**: 1회차 CRITICAL 의 "충돌 대상" 목록 4번째 항목이 정확히 이 L732 였다(`turnDebug` 의 존재 목적을 References/LLM Usage 로 한정). Phase 1 이 conversation-thread.md·6-websocket-protocol.md·9-rag-search.md 세 곳은 개정하지만 이 네 번째 지점은 그대로 남는다. 개정 후에도 이 줄이 **거짓**이 되는 것은 아니다(`turnDebug` 는 여전히 References/LLM Usage 탭에 쓰인다) — 다만 신규 🔎 Preview 행(및 기존 📚 chip)이라는 세 번째 소비처가 이 목록에서 빠진 채로 남아 향후 이 문서만 읽는 개발자에게는 "turnDebug = 디버그 탭 전용" 이라는 옛 인상을 그대로 준다. 다른 3곳을 명확화하면서 같은 세션에서 발견된 4번째 지점을 남겨두면 재차 drift 재발 소지가 있다(`grep` 확인 결과 이 phrasing 은 spec 전체에서 이 1줄뿐이라 수정 비용은 낮다).
- **제안**: Phase 1 에 `spec/4-nodes/3-ai/1-ai-agent.md` L732 한 줄 추가 편집을 포함 — 예: "진행 중 누적치를 노출해 References / LLM Usage 탭이 동작(+ `ragSources` 서브필드는 Preview 🔎 행·📚 chip 도 소비 — [Conversation Thread §9.3](../../conventions/conversation-thread.md#93-데이터-소스-선택))". 차단 사유는 아니며 Phase 1 완료 전 반영 권고.

### [INFO] `conversation-thread.md` ↔ `9-rag-search.md` 상호 참조 부재 — 이번 drift 의 근본 원인, Phase 1 에서 명시적으로 닫을 필요

- **target 위치**: Phase 1 §C 항목 14 ("§4.1 갱신 — 현재 'Preview UI = chip-only' 로 서술돼 있어 …").
- **상세**: `grep` 확인 결과 두 문서는 서로를 단 한 번도 참조하지 않는다(`conversation-thread.md` → `9-rag-search`: 0건, 역방향: 0건). 위 CRITICAL 검증에서 확인했듯 이 단절이 애초에 D4/§9.3 이 9-rag-search.md 의 기존 서술과 조율되지 못한 근본 원인이다. item 14 가 "chip-only 서술 drift" 를 언급하지만 실제 필요한 조치는 텍스트 갱신뿐 아니라 **양방향 cross-link 추가**다 — `9-rag-search.md §4.1` 에 `conversation-thread.md §9.3`(신규 `rag` 행)·`Inv-9` 링크를, `conversation-thread.md §9.3` 신규 `rag` 행에 `9-rag-search.md §4.1` 링크를 상호 삽입해야 같은 drift 가 재발하지 않는다.
- **제안**: item 6(§9.3)·item 14(§4.1) 편집 시 상호 `[Spec RAG 검색 §4.1](...)` / `[Conversation Thread §9.3](...)` 링크를 명시적으로 왕복 삽입.

### [INFO] target 문서 헤더의 "관련 spec" 목록에 `9-rag-search.md` 누락

- **target 위치**: 문서 최상단 "> 관련 spec (SoT 책임 경계별)" — `conversation-thread.md`, `3-execution.md §10.6.1` 두 개만 나열.
- **상세**: Phase 1 §C 가 `9-rag-search.md §4.1` 을 직접 개정하는데도 헤더의 "관련 spec" 요약에는 빠져 있다. 실질적 충돌은 아니고 plan 문서 자체의 완결성 이슈.
- **제안**: 문서 헤더 "관련 spec" 목록에 `spec/5-system/9-rag-search.md §4.1` (RAG 출력 메타데이터·References UI) 한 줄 추가.

---

## 요약

1회차 CRITICAL 은 코드(`result-detail.tsx:1026-1032`/`:1093`/`:1116`, `conversation-inspector.tsx:1199-1213`)와 spec(`conversation-thread.md:322` D4 원문, `9-rag-search.md:295-296`) 양쪽을 직접 확인한 결과 **실제로 존재하는 기존(pre-existing) spec-코드·spec-spec drift** 였음을 확인했다. `9-rag-search.md` 가 이미 Preview 탭의 📚 chip 을 `meta.turnDebug[].ragSources` 출처로 문서화하고 있었으나 `conversation-thread.md` 의 D4/§9.3 과 상호 참조되지 않아 두 spec 이 서로 다른 규칙을 말하고 있었던 것이 근본 원인이다. target 의 "D4 번복이 아닌 범위 명확화" 해소안은 (1) D4 의 원 우려(raw `[from <nodeLabel>]`/`[user-input]` marker 노출)가 `ragSources` 의 구조화 스키마에 구조적으로 부재함을 스키마 레벨에서 검증 가능하고, (2) 관련 3개 지점(D4·§9.3·WS §4.4)을 Phase 1 에서 동시 개정하며, (3) 1회차 WARNING 2건(§4.4 wire 미문서화, References 탭 중복)을 각각 item 12·item 8(Inv-9)로 정확히 겨냥해 해소한다는 점에서 논리적으로 성립한다 — CRITICAL 판정을 취소한다. 다만 1회차가 "충돌 대상" 으로 명시 지목했던 4번째 지점(`1-ai-agent.md:732`)이 Phase 1 편집 목록에서 누락됐고, `conversation-thread.md`↔`9-rag-search.md` 상호 참조 부재라는 근본 원인 자체를 명시적으로 닫는 조치(양방향 링크)가 target 계획에 없다 — 둘 다 차단 사유는 아니며 한두 줄 추가로 해소 가능한 완결성 gap 이다.

## 위험도

LOW
