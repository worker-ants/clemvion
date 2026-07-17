# Cross-Spec 일관성 검토 결과 — `plan/in-progress/rag-tool-row-distinct-ui.md`

## 검토 대상

`rag` frontend 합성 7번째 `ConversationTurnSource` 신설안 (Slice A+B). Phase 1 은
`spec/conventions/conversation-thread.md` 를 개정한다.

교차 확인한 spec: `spec/conventions/conversation-thread.md`(전문, §1·§8·§9),
`spec/5-system/6-websocket-protocol.md`(§4.4, §4.4.5, §4.4.6, Rationale),
`spec/7-channel-web-chat/1-widget-app.md`(§2),
`spec/4-nodes/3-ai/0-common.md`(§6·§7·§10·§11.4),
`spec/4-nodes/3-ai/1-ai-agent.md`(§8, meta 표),
`spec/3-workflow-editor/3-execution.md`(§10.6.1),
`spec/2-navigation/14-execution-history.md`,
`spec/5-system/17-agent-memory.md`,
`spec/5-system/10-graph-rag.md`(§4.3, `ragSources` 스키마).

---

## 발견사항

### [CRITICAL] `meta.turnDebug` 를 conversation Preview 탭의 1차 소스로 승격 — 기존 "1차 소스 = conversationThread" 원칙 및 turnDebug 의 기존 역할과 정면 충돌

- **target 위치**: Phase 1 항목 5 ("§9.3 데이터 소스 표 — `rag` 행의 1차 소스 = `meta.turnDebug[].ragSources` (live·history 동일)"), 위치 섹션("행은 같은 `turnIndex` 의 첫 assistant turn 앞에 삽입"), Rationale 초안의 "`turnDebug` 를 소스로 택한 이유".
- **충돌 대상**:
  - `spec/conventions/conversation-thread.md` §8.1 D4: *"**conversation Preview 의 1차 소스를 `conversationThread` snapshot 으로 두고** emit messages 는 LLM debug 패널 전용으로 격리한다."*
  - `spec/conventions/conversation-thread.md` §9.3 데이터 소스 표: 현재 4행 중 "conversation Preview 탭" 행의 1차 소스는 `conversationThread.turns` snapshot 뿐이고, `meta.turnDebug`/emit messages 는 별도 행("LLM Usage / Request / Response 탭 (debug)")에만 등장한다.
  - `spec/5-system/6-websocket-protocol.md` §4.4 (line 716): *"대화 UI (conversation Preview 탭, conversation timeline) 는 emit messages 가 아닌 `waiting_for_input.conversationThread.turns` snapshot (§4.4.5) 을 1차 소스로 사용한다."* — 조건부가 아니라 일반 규칙으로 서술.
  - `spec/4-nodes/3-ai/1-ai-agent.md` L732: *"`meta.durationMs` / 토큰 / `turnDebug` ... 진행 중 누적치를 노출해 **References / LLM Usage 탭이 동작**"* — turnDebug 의 존재 목적을 명시적으로 References/LLM Usage(디버그류) 탭으로 한정.
  - `spec/3-workflow-editor/3-execution.md` §10.6.1 표: `References` 탭이 이미 "턴별 사용된 KB 청크(RAG references) 표시"를 전담하며 Preview 와 별도 탭으로 존재.
- **상세**: `turnDebug`(및 그 안의 `ragSources`)는 spec 전체에서 일관되게 **"에디터/콘솔의 디버그류 탭"**(Response / Request / LLM Usage / References) 전용 데이터로 정의돼 있다 — `conversationThread` 와는 다른 layer 다. 반면 conversation Preview 탭(SummaryView)은 §8.1 D4·§9.3·§4.4 세 곳에서 반복적으로 "1차 소스 = `conversationThread` snapshot" 으로 명문화돼 있고, 그 이유(§8.1 D4)는 정확히 "raw/디버그류 payload 를 Preview 에 섞으면 사용자 오인 + strip 부담이 발생한다"는 것이다. draft 는 **바로 이 Preview 탭 타임라인 안에** (`ai_assistant` 버블 앞) `meta.turnDebug[].ragSources` 를 1차 소스로 삼는 새 행을 삽입하려 한다 — spec 이 분리해 둔 두 데이터 도메인(conversationThread vs turnDebug/emit)을 다시 섞는 시도다.
  - draft 는 `system_error` 선례(§8.3, frontend-합성 6번째 source)를 근거로 들지만, 두 사례는 구조가 다르다. `system_error` 는 `output.error` 로부터 합성되며, §9.3 표는 이를 "동일 thread 의 서로 다른 매체"(store `conversationMessages` ↔ 이력 재구성 `output.result.messages`+`output.interaction`)로 명시해 **"1차 소스 = conversationThread" 원칙을 유지한 채로**의 예외임을 분명히 한다. `turnDebug` 는 conversationThread 와 무관한 별도 데이터 구조(`NodeExecution.output_data.meta`)이며, 그 존재 이유 자체가 References/LLM Usage 같은 디버그 탭이다 — "같은 thread 를 다른 매체로 표현"이 아니라 **완전히 다른 도메인 데이터**를 Preview 로 승격하는 것이다.
  - Rationale 초안의 "Inv-5 정신(양 surface 동일 결과)에 정합" 인용도 오용이다. `Inv-5`(§9.9)는 `groupToolCallItems` 가 SummaryView 와 ResultTimeline 양쪽에서 **동일 그룹 결과**를 내야 한다는 불변량이며, live/history 데이터 소스 대칭 일반론이 아니다. live/history 동일 절대시각 요구는 §9.12 마지막 문장("라이브와 영속 양쪽이 동일 절대 시각을 보여야 한다")이 SoT — 이는 `turnDebug` 를 conversation Preview 1차 소스로 채택해도 되는 근거가 아니라 단지 turnDebug 필드 자체가 live/history 모두 존재한다는 사실 서술이다.
- **제안**: 아래 중 하나로 재설계·명시적 결정 필요 (project-planner 승인 필요):
  1. `rag` 행을 `conversationThread`-native 경로로 재설계 — 예를 들어 backend 가 (사용자 결정 1 "데이터 출처 불변"을 깨지 않는 선에서) `turnDebug[].ragSources` 를 `system_error` 와 동일한 패턴으로 **conversationThread 와 동일한 매체(예: 해당 턴의 `ai_assistant` turn `data` 필드 또는 NodeExecution 출력의 다른 부분)에서 파생**되도록 소스를 재정의하거나,
  2. `meta.turnDebug` 를 conversation Preview 의 예외 소스로 정식 승격하려면 §8.1 D4·§9.3·`6-websocket-protocol.md` §4.4 세 곳의 "1차 소스 = conversationThread" 서술을 **모두** 개정하고, 그 개정이 원래 D4 의 우려(디버그 payload 혼입)를 어떻게 회피하는지 별도 Rationale 로 논증해야 한다 (단순히 "References/LLM Usage 탭이 이미 쓰는 데이터"라는 서술은 오히려 그 데이터가 디버그 탭 전용이라는 기존 구분을 강화할 뿐 반박하지 못한다).
  3. `rag` 행을 Preview 탭이 아니라 References 탭 인접의 **별도 인라인 요약**으로 재정의해 "1차 소스 = conversationThread" 원칙 자체를 건드리지 않는 방법도 검토 대상.

  어느 방향이든 Phase 1 착수 전 `/consistency-check --spec` 재통과 및 이 CRITICAL 항목의 명시적 해소가 필요.

### [WARNING] `nodeOutput.meta.turnDebug` 가 `execution.waiting_for_input` 라이브 wire 필드로 `6-websocket-protocol.md` 에 문서화돼 있지 않음

- **target 위치**: "live/history 대칭 실측" 절 — `ai-turn-orchestrator.service.ts:485` 코드 인용으로 live 소스를 주장.
- **충돌 대상**: `spec/5-system/6-websocket-protocol.md` §4.4 / §4.4.5. `ai_conversation` interactionType 의 wire 필드로 문서화된 것은 `conversationConfig`(+`conversationThread` 선택 동봉, §4.4.5)뿐이며, `nodeOutput.meta.turnDebug` 가 `waiting_for_input` payload 에 실린다는 서술이 없다.
- **상세**: draft 의 "live/history 대칭" 근거는 코드 실측(`ai-turn-orchestrator.service.ts`)일 뿐 spec 텍스트 근거가 없다. `conversation-thread.md` §9.3 새 행이 `meta.turnDebug` 를 참조하려면, 그 필드가 실제로 어느 wire 이벤트의 어느 위치(`nodeOutput.meta.turnDebug`)에 실리는지가 `6-websocket-protocol.md` §4.4 에도 명시돼야 다른 소비자(예: EIA/위젯 파서)가 이 필드의 존재/부재를 예측 가능하다. 현재 Phase 1 개정 목록(1~8)에 `6-websocket-protocol.md` 개정 항목이 없다.
- **제안**: Phase 1 에 `6-websocket-protocol.md` §4.4 개정 항목 추가 — `waiting_for_input`(ai_conversation) payload 의 `nodeOutput.meta.turnDebug` 필드를 공식 문서화하거나, 최소한 conversation-thread.md §9.3 새 행에서 이 필드의 wire 출처를 `6-websocket-protocol.md` 의 어느 절에 대응하는지 명시.

### [WARNING] References 탭과 신규 🔎 행의 데이터 중복 — 동일 소스의 두 독립 렌더 경로 정합성 미보장

- **target 위치**: 스코프 절 "제외: References 탭·📚 chip 의 기존 동작 (참조만)".
- **충돌 대상**: `spec/3-workflow-editor/3-execution.md` §10.6.1 References 탭 행, `spec/4-nodes/3-ai/1-ai-agent.md` L732.
- **상세**: draft 는 References 탭을 "변경 없음, 참조만"으로 명시해 (b) 관점에서는 SoT 경계를 올바르게 존중한다. 그러나 실질적으로는 **같은 데이터(`meta.turnDebug[].ragSources`)를 소비하는 두 번째 독립 렌더 경로**(`injectRagItems`)가 신설된다. References 탭과 신규 🔎 행이 서로 다른 변환 함수·다른 turnIndex 매칭 로직을 쓰면(References 는 "노드 레벨 또는 assistant 메시지 선택 시 해당 턴" 단위, 신규 행은 "같은 turnIndex 의 첫 assistant turn 앞") 두 표시가 어긋날 위험(예: References 탭엔 chunk 가 있는데 Preview 행엔 없음, 또는 그 반대)이 있다. `injectRagItems` 와 References 탭 데이터 소스 함수 간의 동등성(같은 turnIndex → 같은 `sources[]`)이 spec 에 명문화돼 있지 않다.
- **제안**: §9.11 변환 함수 contract 개정 시 `injectRagItems` 가 References 탭이 쓰는 turnIndex 매칭 로직과 동일한 결과를 내야 한다는 불변량을 명시(예: 신규 `Inv-9` 또는 CT-S18 확장)하거나, 최소한 References 탭의 데이터 소스 함수를 재사용하도록 구현 지침에 명시.

### [INFO] §9.12 (요소별 발생 시각·소요시간 표시, "강제") 표에 `rag` 행 누락 — `RagSource` 스키마에 timestamp 필드 없음

- **target 위치**: Phase 1 목록(1~8)에 §9.12 개정 항목 없음.
- **충돌 대상**: `spec/conventions/conversation-thread.md` §9.12 ("디버깅 surface 는 멀티턴 AI 노드의 **모든 conversation 요소**에 대해 발생 시각을 노출") — 현재 표는 `user`/`assistant`/`tool`/`presentation`/`system`·`system_error` 5행뿐. `spec/5-system/10-graph-rag.md` §4.3 의 `ragSources[]` 스키마(`chunkId`·`documentId`·`documentName`·`content`·`score`·`origin`)에는 timestamp 필드가 없다.
- **상세**: `rag` 가 conversation 타임라인의 새 요소 타입이 되면 §9.12 의 "강제" 규약상 발생 시각 표시가 필요한데, 근거 데이터(`RagSource`)에는 시각 필드가 없다. 부모 assistant turn 의 `llmCalls[0].startedAt` 을 대리로 쓸 수 있으나(“LLM 호출 직전” 이라는 draft 자체 서술과 정합) 이 매핑이 spec 에 명시돼 있지 않다.
- **제안**: Phase 1 목록에 §9.12 행 추가("`rag` | 부모 assistant turn 의 `llmCalls[0].startedAt` (동일 turnIndex) | — (즉시 주입, 소요시간 표시 안 함)" 등) 하여 §9.12 강제 규약과의 정합을 명문화.

### [INFO — 충돌 없음, 확인됨] (b) References 탭·§10.6.1 탭 정책 SoT 경계는 준수됨

`spec/3-workflow-editor/3-execution.md` §10.6.1 은 draft 가 수정하지 않으며, References 탭 row 자체도 draft scope 에서 명시적으로 제외돼 있다. 실제 tab 구성·조건·기본탭 로직에 대한 텍스트 변경은 없다 — 다만 위 WARNING(References 탭과의 데이터 중복)에서 지적한 실질적 결합은 별개로 존재.

### [INFO — 충돌 없음, 확인됨] (d) 위젯 미도달 — 구조적으로 보장됨 (단, 유비 논거는 약간 부정확)

`spec/7-channel-web-chat/1-widget-app.md` §2 "메시지 리스트" 행은 1차 소스를 `waiting_for_input.conversationThread.turns` snapshot 으로, turn `source` 는 **backend 5값 도메인**만 매핑 대상으로 명시한다(`presentation_user`·`ai_user`→user, `ai_assistant`·`ai_tool`·`system`→assistant). `meta.turnDebug` 는 위젯의 데이터 출처 표 어디에도 등장하지 않는다. 또한 `rag` 합성 함수(`injectRagItems`)는 에디터 전용 프론트 코드(`conversation-utils.ts`, `conversation-inspector.tsx`, `result-detail.tsx`)에만 배선되며 `codebase/channel-web-chat` 은 이 모듈을 참조하지 않으므로, 위젯이 `rag` 행을 렌더할 코드 경로 자체가 없다 — draft 의 결론(위젯 미도달)은 타당하다.

다만 draft 가 인용한 "§9 서두 스코프 예외 blockquote 가 `system_error` 에 대해 쓴 논리"와는 근거가 미세하게 다르다: `system_error` 의 미도달 근거는 "그 값이 wire 의 `turns[].source` 도메인에 애초 존재하지 않는다"(backend enum 5값 고정)이고, `rag` 의 미도달 근거는 "wire 도메인에 없다"는 점은 동일하나 추가로 "위젯 코드가애초 `injectRagItems` 를 호출하지 않는다"는 코드베이스 분리에도 의존한다. 결론은 같지만 인용된 blockquote 문구("위젯 wire 에 애초 도달하지 않는다")를 문자 그대로 재사용하려면 이 차이를 Rationale 에 한 줄 부연하는 편이 정확하다. 참고로 `meta.turnDebug` 자체(원본 데이터)가 EIA 공개 표면(`getStatus`/SSE 의 "nodeOutput 전체")으로 흘러갈 가능성은 `spec/5-system/14-external-interaction-api.md` R17 의 "**`nodeOutput` 일반 키 allowlist (미구현·잔여)**" 로 이미 별도 문서화된 기존 하드닝 갭이며, 이는 본 draft 가 야기한 문제가 아니다.

### [INFO — 충돌 없음, 확인됨] (a) `0-common.md` §10/§11.4, `17-agent-memory.md`

- §10(contextScope 자동 주입)·§11.4(systemPrompt ordering)는 LLM 호출 파이프라인 자체를 다루며, draft 는 이 파이프라인을 전혀 수정하지 않는다(순수 프론트 렌더 계층) — 충돌 없음.
- `17-agent-memory.md` 는 `memoryStrategy=persistent` 의 세션 간 영속 회수/추출(`agent_memory` 테이블)을 다루는 완전히 별개 메커니즘이며 `ragSources`(KB 검색 결과)와 무관 — 충돌 없음.

---

## 요약

draft 의 핵심 설계 결정("데이터 출처 = `turnDebug[].ragSources`", 사용자 결정 1)이 `conversation-thread.md` §8.1 D4·§9.3, `6-websocket-protocol.md` §4.4 가 반복적으로 명문화한 "conversation Preview 탭의 1차 소스는 `conversationThread` snapshot이며 debug/turnDebug 계열은 별도 탭 전용" 이라는 아키텍처 경계와 정면으로 충돌한다(가장 중요한 CRITICAL 발견). `system_error` 선례를 근거로 들지만 두 사례는 데이터 provenance 가 구조적으로 다르며(동일 thread 의 다른 매체 vs 완전히 다른 디버그 도메인), draft 의 Rationale 초안은 이 차이를 해소하지 못한다. 반면 (b) References 탭 SoT 경계 존중, (d) 위젯 wire 미도달, (a) `contextScope`/`agent-memory` 무관성은 모두 검증됐고 실질적 충돌이 없다. 부수적으로 §9.12(요소별 시각 표시)와 `6-websocket-protocol.md`(nodeOutput.meta.turnDebug 필드 문서화)에 대한 Phase 1 개정 누락도 발견됐다. Phase 1 착수(spec 개정) 전에 최소한 CRITICAL 항목의 데이터 소스 재설계 또는 명시적 예외 승격 논증이 필요하다.

## 위험도

CRITICAL
