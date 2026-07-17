# Rationale 연속성 검토 결과 (2회차)

대상: `plan/in-progress/rag-tool-row-distinct-ui.md` (1회차 CRITICAL 해소분 포함)
대조 대상 Rationale: `spec/conventions/conversation-thread.md` §8.1(D4)·§8.3·§8.4·§8.5·§9.3·§9.5·§9.9·§9.11·§9.12, `spec/5-system/6-websocket-protocol.md` §4.4(L506·L716), `spec/5-system/9-rag-search.md` §4.1

## 발견사항

- **[WARNING]** D4 완화 범위가 `meta.turnDebug` 전체로 넓게 표현돼 `llmCalls` raw payload 보호까지 흔들 위험
  - target 위치: Phase 1 항목 7 ("`meta.turnDebug` 를 **보조 관찰성 레인**(turn 을 대체하지 않는 별개 레인)으로 명문화") 및 §해소 방향 블록 ("명문화: 보조 관찰성 레인 = `meta.turnDebug`")
  - 과거 결정 출처: `spec/conventions/conversation-thread.md` §8.1 D4 (L322, "conversation Preview 의 1차 소스를 `conversationThread` snapshot 으로 두고 emit messages 는 ... 격리") + `spec/5-system/6-websocket-protocol.md` L506 ("`llmCalls[].requestPayload`/`responsePayload` 는 raw 디버그 payload ... 에디터의 디버깅 타임라인(Response/Request/LLM Usage 탭) 같은 개발자·에디터 surface 전용" — 외부 fanout strip 별도 Rationale "`ai_message.llmCalls[]` 외부 수신자 strip" 존재)
  - 상세: `meta.turnDebug`(`TurnDebugEntry`)는 `{ turnIndex, llmCalls?, totalDurationMs?, toolCalls?, ragSources?, ragDiagnostics?, mcpDiagnostics? }` 의 superset 이다([`1-ai-agent.md` L1106](../../../../spec/4-nodes/3-ai/1-ai-agent.md)). 이 중 `ragSources` 만 마커·prefix 없는 구조화 인용 데이터이고, 형제 필드 `llmCalls`(원본 request/response payload — 시스템 프롬프트·대화 이력·tool 정의 포함 가능)는 WS 프로토콜 spec 이 별도 Rationale 로 "에디터 debug 탭 전용 + 외부 fanout strip" 을 명문화한, D4 가 막으려던 것과 정확히 같은 종류의 raw 노출 위험군이다. target 의 §8.6 Rationale 초안 자체는 `turnDebug[].ragSources` 로 정확히 스코프해 논증하지만("`turnDebug[].ragSources` 는 ... 마커도 prefix 도 없다"), Phase 1 항목 7 의 실제 **spec 편집 지시문**은 이 스코프를 반영하지 않고 `meta.turnDebug` 전체를 "보조 관찰성 레인"으로 명문화하라고 되어 있다. 이 지시문 그대로 §8.1 D4 를 개정하면, 향후 누군가 "D4 가 `meta.turnDebug` 를 이미 보조 레인으로 허용했다"는 근거로 `llmCalls` raw payload 를 Preview 인접 표면에 노출하는 PR 을 정당화할 수 있는 문언적 여지가 생긴다 — D4 가 원래 막으려던 위험(raw payload 사용자 오인 + strip 부담)이 다른 필드 경로로 재도입될 수 있는 latent 문언 리스크다.
  - 제안: Phase 1 항목 7·§9.3 표 갱신·§8.1 D4 개정 문구에서 "보조 관찰성 레인" 의 대상을 `meta.turnDebug` 전체가 아니라 **이미 Preview-safe 로 확립된 구체 하위 필드**(`ragSources` — 본 작업, `toolCalls[].startedAt`/`finishedAt` — 기존 §9.12) 로 명시 열거하고, `llmCalls`(raw request/response)는 여전히 §9.4/WebSocket §4.4 의 "debug 탭 전용 + 외부 strip" 경계에 남는다는 문장을 §8.1 D4 개정문에 명시적으로 부기할 것을 권고.

- **[WARNING]** CT-S20 (cross-node 스코프 결측)이 §8.5 "노드 필터 부재는 의도" 원칙과의 관계를 §8.6 Rationale 초안에서 명시적으로 해소하지 않음
  - target 위치: Phase 1 CT 시나리오 표 CT-S20 (target 라인 173), §8.6 Rationale 초안 ("구형 데이터 한계" 단락, target 라인 210) — CT-S20 은 이 단락에서 다뤄지지 않음
  - 과거 결정 출처: `spec/conventions/conversation-thread.md` §8.5 (L358-372), 특히 L368 "**cross-node thread 표시는 의도된 동작 — Inv-8 의 예외가 아니다**: conversation Preview 는 노드별로 필터링하지 않고 thread 전체를 그린다 ... **노드 필터 부재는 누락이 아니라 의도** — 필터를 도입하면 위 세 조항(§3·§9.3·§2.2)을 위반한다."
  - 상세: CT-S20 은 "선택 노드가 발생시키지 않은 turn 앞에는 🔎 행이 붙지 않는다"를 명시적으로 요구한다. 구조적으로는 §8.5 가 금지하는 "thread 항목 자체의 노드별 필터링"과 다르다 — 🔎 행은 thread 항목이 아니라 노드-스코프 `meta.turnDebug` 로부터 파생되는 **별도 오버레이**이며, thread 의 기존 항목(타 노드의 `presentation_user`/`ai_assistant`/`ai_tool` 등)은 하나도 숨겨지지 않는다. 즉 CT-S20 은 §8.5 위반이 아니라고 판단되지만, 문면상 "특정 노드의 turn 앞에서 UI 요소가 사라진다"는 서술은 §8.5 가 명시적으로 경계해 온 패턴과 표면적으로 유사해, 향후 리뷰어/구현자가 §8.5 와 충돌한다고 오인할 여지가 크다. 이 문서(`conversation-thread.md`)는 새 결정이 인접 invariant 와 충돌해 보일 때마다 "~은 의도된 동작 — 예외가 아니다"류의 명시적 해소 단락을 두는 것이 확립된 서술 관행이다(§8.4 "'신규 컬럼 없음' 원칙과의 정합", §8.5 "cross-node thread 표시는 의도된 동작"). target 의 §8.6 초안은 D4(§8.1)와의 충돌은 이 관행을 따라 정면으로 해소했으나, §8.5 와의 잠재적 충돌은 CT 시나리오 표에만 "Rationale WARNING 3" 태그로 남아있을 뿐 §8.6 본문에 상응하는 해소 단락이 없다.
  - 제안: §8.6 Rationale 초안에 "CT-S20 은 §8.5 의 노드 필터 금지 원칙의 예외가 아니다" 단락을 추가 — 🔎 행은 thread 항목의 가시성을 바꾸는 필터가 아니라 노드-스코프 부가 데이터(`meta.turnDebug`)의 **가용성 제약**이며, thread 자체(§3·§9.3·§2.2 가 보장하는 cross-node 전체 노출)는 무변경임을 명시.

- **[INFO]** "📚 chip(기존, 미문서화)" 표현의 사실관계 보정 여지 — 이미 다른 spec 에 문서화돼 있음
  - target 위치: §해소 방향 블록, "명문화: ... 📚 chip(기존, 미문서화) + 🔎 행(신설)" (target 라인 125)
  - 과거 결정 출처: `spec/5-system/9-rag-search.md` §4.1 (L296) — "발견성을 위해 Preview 탭의 assistant 메시지 하단에 사용 문서명 chip 을 1줄로 표시하고 클릭 시 References 탭으로 점프한다"
  - 상세: 📚 chip 의 Preview 노출은 `conversation-thread.md` 관점에서는 미문서화(§9.3/§8.1 D4 가 언급 안 함)이지만, `9-rag-search.md` §4.1 은 이를 이미 명시적으로 규정하고 있다. 즉 이번에 발견된 것은 "spec 밖의 관행"이 아니라 **spec-간(inter-spec) 기존 drift** — `9-rag-search.md` 는 이미 이 동작을 승인했는데 `conversation-thread.md` 의 D4/§9.3 만 그 사실을 반영하지 못했던 것. 이 사실은 오히려 target 의 "정식화(기각이 아닌 범위 명확화)" 논거를 더 강하게 뒷받침한다.
  - 제안: §8.6 Rationale 및 §해소 방향의 "미문서화" 표현을 "`9-rag-search.md` §4.1 에는 문서화돼 있었으나 `conversation-thread.md` D4/§9.3 에 교차반영되지 않았던 기존 spec-간 drift" 로 정정하면 근거가 더 명확해진다.

- **[INFO]** `system_error` 6값 → `rag` 7값 확장 시 "6" 을 명시한 다른 조항들의 갱신 여부 미언급
  - target 위치: Phase 1 항목 1 (§1.1.2 신설, "backend enum 5값 불변, frontend 6값 → 7값")
  - 과거 결정 출처: `spec/conventions/conversation-thread.md` §5.1 각주(L255, "frontend 은 합성 `system_error` 포함 6값"), §9.5(L454, "`threadTurnsToConversationItems` — ... frontend 6 source 전부 ... switch 에 6 case"), §9 서두(L413, "§9.1 표는 6행이지만")
  - 상세: 이 조항들은 Rationale 이 아니라 사실 서술이라 본 리뷰의 핵심 대상은 아니나, "6" 이 여러 곳에 하드코딩돼 있어 §1.1.2 갱신만으로는 이들이 자동으로 "7" 로 정합되지 않는다. 다른 sub-checker(convention-compliance/plan-coherence) 영역과 겹칠 수 있으나, D4 개정과 함께 진행되는 숫자 정합이므로 누락 시 새 Rationale 문언과 본문 사실 서술이 어긋나는 모양새가 된다.
  - 제안: Phase 1 실행 시 "6값/6 source/6 case/6행" 전체 occurrence 를 sweep 하여 7로 일괄 갱신.

## 요약

핵심 쟁점 — D4 를 "번복"이 아니라 "범위 명확화"로 처리한 target 의 판단은 근거가 있다. `conversation-thread.md` §8.1 D4 의 실제 텍스트는 "emit messages 의 `[from <nodeLabel>]` prefix·`[user-input]` 마커가 그대로 노출되는 것"을 막는 것이 명시적 목적이며, `RagSource`(`documentId`/`documentName`/`chunkId`/`content`(청크 원문 미리보기 200자)/`score`) 는 실측(`spec/5-system/9-rag-search.md` §4.1) 상 마커·prefix 가 없는 구조화 인용 데이터다. 나아가 📚 chip 의 Preview 노출은 이미 `9-rag-search.md` §4.1 이 승인한 기존 spec 문언이었고 `conversation-thread.md` 만 이를 반영 못한 상태였으므로, 이번 "정식화"는 신규 예외 창설이 아니라 기존 spec-간 drift 정리에 가깝다. #959 가 제거한 옛 `rag` 행(마커 기반, 프로덕션 미도달 경로)을 부활시키지 않고 `meta.turnDebug[].ragSources`(현재 실제로 흐르는 데이터)로 데이터 출처를 교체한 것도, §9.11 "다중 정의 금지" 원칙을 지키기 위한 정당한 판단이며 — 이 결정은 애초에 spec `## Rationale` 이 아니라 코드리뷰 산출물(SUMMARY.md)에만 있던 것이라 "spec Rationale 재도입" 문제도 아니다. 다만 두 지점에서 연속성 서술이 아직 불완전하다: (1) D4 완화 대상을 `meta.turnDebug` 전체로 넓게 쓴 지시문이, 형제 필드 `llmCalls`(WS 프로토콜 spec 이 별도로 raw/debug-only 로 못박은 필드)까지 느슨하게 만들 문언적 리스크가 있고, (2) CT-S20(cross-node 스코프 결측)이 §8.5 "노드 필터 부재는 의도" 원칙과 표면적으로 유사해 보이는데도 §8.6 Rationale 초안이 이를 명시적으로 해소하는 단락을 두지 않았다 — 이 문서 자체의 확립된 서술 관행(§8.4·§8.5 의 "~은 의도된 동작, 예외 아님" 패턴)과 어긋난다. 두 건 모두 Phase 1 착수 전 spec 문언을 조금 더 좁혀 쓰면 해소되는 수준이며, 설계 자체를 재검토해야 하는 수준의 결함은 아니다.

## 위험도

MEDIUM
