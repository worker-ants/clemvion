# Rationale 연속성 검토 — `rag-tool-row-distinct-ui`

대상: `plan/in-progress/rag-tool-row-distinct-ui.md` (draft, 착수 전)
비교 대상: `spec/conventions/conversation-thread.md` `## 8. Rationale`(§8.1~§8.5) · `## 7. v2 로드맵` · `## 9` 렌더 규칙, `spec/5-system/9-rag-search.md` §4.1, PR #959 코드 리뷰 기록(`review/code/2026/07/17/07_12_33/`, `08_05_31/`)

> 참고: prompt 에 첨부된 "관련 Rationale 발췌" 는 조립 과정에서 크기 상한으로 잘려 `conventions/conversation-thread.md` 자신의 `## Rationale`(정작 본 검토의 핵심 비교 대상)을 포함하지 못했다. 해당 spec 파일을 직접 Read 해 검증했다.

## 발견사항

- **[WARNING]** `rag` 행 재도입이 #959 리뷰가 명시한 "References 탭 = 단일 진실" 결정과 병존 관계를 스스로 검증하지 않음
  - target 위치: "배경 > PR #959 에서 제거한 옛 `rag` 행과의 관계" (약 48~61행), "Rationale 초안" (145행)
  - 과거 결정 출처: `review/code/2026/07/17/08_05_31/SUMMARY.md` §"RAG 판단(side_effect Warning #3 반영해 정정)" 근거 2 — *"대체 표면이 SoT — KB 청크는 References 탭(`meta.turnDebug[].ragSources` → `turnRefIndex`)이 turn 별로 노출하며, **이것이 현재 규약상 단일 진실이다**"*. (spec `## Rationale` 은 아니고 code review 기록이라 엄밀히는 spec Rationale 위반은 아니지만, 오케스트레이터가 직접 지정한 비교 대상이므로 결정 연속성 관점에서 검토.)
  - 상세: target 의 "복원이 아니라 신설" 주장은 **데이터 출처·생성 경로** 측면에서는 실측으로 검증됨(아래 참고) — 옛 `role:'system'` 마커 경로는 부활시키지 않고 `meta.turnDebug[].ragSources` 를 그대로 쓴다. 다만 **표시 표면(surface) 측면**에서는 References 탭 옆에 **두 번째 표시처(🔎 Preview 행)** 를 신설하는 것이어서, "References 탭이 현재 규약상 단일 진실" 이라는 #959 정정본의 문구와 표면적으로 긴장 관계에 있다. target 의 §8.6 Rationale 초안이 "행(시간축) vs chip(출처 귀속)" 역할 분리로 이 긴장을 정당화하려 시도하지만, #959 리뷰가 명시한 "단일 진실" 문구 자체를 인용·반박하지 않고 넘어간다.
  - 실측 검증(참고, 결론: (a)는 성립): `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts:485` 부근의 `meta: buildConversationMetaFromResumeState(resumeState)` 와 `ai-conversation-helpers.ts` 의 `buildConversationMetaFromResumeState` 가 `turnDebug: state.turnDebugHistory` 를 반환함을 확인 — live 경로 존재 주장은 사실. `spec/5-system/9-rag-search.md:295`도 "멀티턴에서 어느 응답이 어느 청크를 사용했는지... `meta.turnDebug[].ragSources`" 로 turn 단위 분리 데이터가 References 탭 용으로 이미 존재함을 확인. 즉 (a)의 "정당한 범위 분리"라는 결론 자체는 지지되나, "References=단일 진실" 선언과의 명시적 조율은 비어 있다.
  - 제안: §8.6 Rationale 초안(또는 spec 본문 §9.3)에 "#959 는 References 탭을 RAG 표시의 단일 진실로 선언했으나, 본 결정은 그 선언을 '상세 조회' 범위로 좁히고 '시간축 이벤트' 라는 새 관점을 추가한 것" 이라는 문장을 명시적으로 넣어 두 기록이 서로를 가리키게 한다.

- **[WARNING]** §8.1 D4 "conversation Preview 의 1차 소스 = conversationThread snapshot" 원칙이 `rag` 도입 후에도 서술상 갱신되지 않음
  - target 위치: "Phase 1" 5번 항목(§9.3 데이터 소스 표 갱신), "위치" 절(96~98행)
  - 과거 결정 출처: `spec/conventions/conversation-thread.md` §8.1 "emit messages 를 conversation Preview 에서 격리한 이유" — *"conversation Preview 의 1차 소스를 `conversationThread` snapshot 으로 두고 emit messages 는... 전용으로 격리한다"* (§9.3 D4로 문서 내에서 재인용됨). §9.3 표 헤더 자체도 "1차 소스" 라는 단수 표현을 쓴다.
  - 상세: `meta.turnDebug` 는 conversationThread snapshot 도 emit messages 도 아닌 **제3의 소스**이며, spec 자체가 이를 `ai-agent.md §8` 표제 "디버그 데이터 (`meta.turnDebug`)" 로 분류하고 WS §4.4 는 `llmCalls` 를 "개발자·에디터 surface 전용" 으로 명시한다. 다만 완전한 신규 위반은 아니다 — 이미 두 개의 선례가 존재한다: (1) `system_error` 가 `output.error` 를 소스로 쓰는 non-thread-snapshot 예외(§8.3), (2) `turnDebug[].toolCalls`/`startedAt` 이 이미 Preview 의 tool row 상태·시각 배지 "권위 출처" 로 쓰이고 있음(§9.9 Inv-1 인접 서술, §9.12 표). 따라서 `rag` 의 turnDebug 사용은 완전히 새로운 카테고리 위반이 아니라 **기존 두 예외의 자연스러운 연장**으로 볼 수 있다. 그러나 target 의 Phase 1 계획은 §9.3 **표에 행을 추가**하는 것만 명시할 뿐, §8.1 D4 본문(1차 소스를 conversationThread snapshot **으로 둔다** 는 단수·절대 서술)을 함께 개정하는 항목이 없다 — "결정의 무근거 번복" 은 아니지만(사용자 결정 있음), 상위 원칙 서술과 하위 표의 불일치가 남는다.
  - 제안: Phase 1 목록에 "§8.1 D4 본문에 'source-scoped 1차 소스(§9.3 표가 최종 SoT)' 로 표현 수정" 항목을 추가해, 원칙 서술 자체가 3-source 현실(thread snapshot / output.error / turnDebug)을 반영하도록 갱신.

- **[WARNING]** cross-node 공유 thread 에서 `rag` 행이 결측되는 비대칭 시나리오가 설계·CT 시나리오에 미포함
  - target 위치: "Phase 2" 4번 항목(`result-detail.tsx` — `aiMetadata.turnDebug` → `injectRagItems` 배선), "CT 시나리오" 표(CT-S18/CT-S19)
  - 과거 결정 출처: `spec/conventions/conversation-thread.md` §3 스코프 규칙 + §3.1/§3.3(Sub-workflow `executeInline`·Loop/ForEach/Map/Parallel 컨테이너가 **parent thread 를 상속·공유**) 및 §8.5 "cross-node thread 표시는 의도된 동작 — Inv-8 의 예외가 아니다" (*"conversation Preview 는 노드별로 필터링하지 않고 thread 전체를 그린다... 노드 필터 부재는 누락이 아니라 의도"*).
  - 상세: `meta.turnDebug` 는 **NodeExecution 스코프**(현재 조회 중인 노드 자신의 `output_data.meta`)인 반면, `conversationThread` 는 §3 에 따라 **execution 스코프**로 여러 AI 노드가 공유할 수 있다(sub-workflow 안 AI Agent, Loop 안 반복되는 AI Agent 등은 실제 v1 지원 시나리오). target 의 `injectRagItems(items, turnDebug)` 시그니처는 단일 `turnDebug` 배열(현재 조회 노드 자신 것)만 받는다. 만약 공유 thread 에 A·B 두 AI 노드가 turn 을 push 했고 A 화면에서 B 의 assistant turn 이 함께 렌더되는 상황(§8.5 가 명시적으로 "의도"라 부르는 그 상황)이면, B 에서 발생한 RAG 주입은 A 화면에서 `injectRagItems` 가 접근 불가능한 B 자신의 `turnDebug` 에만 있어 **🔎 행이 나타나지 않는다** — 이는 §9.12 "결측 내성"(구형 데이터 부재로 인한 정상 생략)과는 다른 성격이다: 데이터가 존재하는데도 현재 뷰의 소스 한계로 못 보이는 경우이며, 정확히 Inv-8/§8.5 가 `system_error` 에 대해 없애려 했던 "데이터는 있는데 도달 경로가 없다" 결함 유형과 같은 패턴이다. CT-S18/CT-S19 는 둘 다 단일 노드·단일 실행 시나리오로, 이 cross-node 케이스를 커버하지 않는다.
  - 제안: (a) Phase 1 §9.3 표 갱신 시 "다중 노드가 공유하는 thread 에서 각 노드의 turnDebug 를 어떻게 합성하는지"(예: 각 conversation turn 의 `nodeId` 로 소유 노드를 식별해 그 노드의 turnDebug 를 함께 조회) 명시. (b) 최소한 v1 스코프 예외로 "cross-node 공유 thread 에서는 현재 조회 중인 노드의 turnDebug 만 반영되며 타 노드분은 생략된다"는 **알려진 제한**을 §8.6 Rationale 또는 §7 v2 로드맵에 명문화 — 그렇지 않으면 향후 회귀로 재발견될 가능성이 높다. (c) 아니라면 CT 시나리오에 cross-node 공유 케이스(sub-workflow 또는 Loop 상속)를 하나 추가해 실제 동작을 확정.

- **[INFO]** `spec/5-system/9-rag-search.md` §4.1 (현재 Preview UI = chip-only 서술) 갱신 계획 누락
  - target 위치: "Phase 1" 절 (100~119행) — `spec/conventions/conversation-thread.md` 만 대상으로 명시
  - 과거 결정 출처: `spec/5-system/9-rag-search.md` §4.1 "run-results UI: ... 발견성을 위해 Preview 탭의 assistant 메시지 하단에 사용 문서명 chip 을 1줄로 표시하고 클릭 시 References 탭으로 점프한다" — 이 문장이 현재 Preview 의 RAG 노출 방식을 "chip 뿐" 으로 서술하는 SoT 원문이다.
  - 상세: `rag` 행이 추가되면 이 서술은 불완전해진다(chip 외에 행도 추가됨). target 상단 "관련 spec (SoT 책임 경계별)" 표는 시각 매핑 SoT 를 `conversation-thread.md` 로 명확히 지정했으므로 이중 SoT 문제는 아니지만, `rag-search.md` 독자가 이 변경을 놓칠 수 있다.
  - 제안: Phase 1 에 `rag-search.md` §4.1 "run-results UI" 문단에 1줄 cross-ref("Preview 행 표시는 `conversation-thread.md` §9.1 참조") 추가 항목을 넣는다.

- **[INFO]** §8.3 선례의 핵심 강제 장치(AST exhaustiveness guard) 계승 여부 미언급
  - target 위치: "Phase 1" 1번 항목 — "§1.1.1(`system_error`)과 **동일 패턴**"
  - 과거 결정 출처: `spec/conventions/conversation-thread.md` §8.3 — *"frontend AST 가드([`interaction-type-exhaustiveness.test.ts`](...))가 모든 처리 분기 위치 등록을 강제한다"*
  - 상세: target 이 `system_error` 와 "동일 패턴" 임을 여러 곳에서 강조하지만(§1.1.2 신설 근거, §Rationale 초안), 그 패턴의 핵심 안전장치인 AST exhaustiveness guard 에 `rag` 를 등록하는 항목이 Phase 1/2/3 어디에도 명시되지 않는다. `ConversationTurnSource` 유니온에 값을 추가하면 TypeScript 가 자동으로 해당 테스트를 실패시킬 가능성이 높아 실무상 큰 위험은 아니나, spec 상 "동일 패턴" 선언과 실제 계획 항목 사이에 작은 공백이 있다.
  - 제안: Phase 3 테스트 목록에 "`interaction-type-exhaustiveness.test.ts` 가 `rag` 를 새 case 로 강제하는지 확인" 항목 추가.

- **[INFO]** "§9.11 다중 정의 금지" 인용이 정확한 절 번호가 아님 (경미)
  - target 위치: "Rationale 초안" 151행 — *"옛 마커 경로를 되살리는 안은 기각 — 죽은 경로 부활 + §9.11 다중 정의 금지 위반"*
  - 과거 결정 출처: "다중 정의 금지" 문구 자체는 `spec/conventions/conversation-thread.md` **§9.8**(`isAssistantContentBlank` 단일 결정 함수 의무)에 있다. §9.11 은 "3개 변환 path" 등재 계약(§9.11 "신규 변환 path 도입 시 본 contract 표 갱신... 의무")이며, #959 리뷰가 옛 인라인 파서를 부른 명칭도 "§9.11 계약에 없는 **4번째 변환 경로**"(`plan` 48행 자체 인용, `review/code/.../07_12_33/SUMMARY.md` 참고)다.
  - 상세: 논증의 실질(마커 부활은 미등재 변환 경로를 재도입하는 것이므로 §9.11 정신 위반)은 타당하나, 인용 절 번호가 §9.8 의 문구를 §9.11 자리에 붙인 것으로 보여 향후 spec 개정 시 착오 소지가 있다.
  - 제안: Phase 1 §9.11 갱신 시 정확한 근거 절(§9.11 변환 path 등재 계약, 필요시 §9.8 도 함께)을 구분해 인용.

## 요약

target 의 핵심 주장 — "#959 가 지운 것은 죽은 마커 경로이고, 본 작업은 그것을 복원하는 게 아니라 `turnDebug` 를 출처로 신설한다" — 는 실측(live 경로의 `buildConversationMetaFromResumeState`, `rag-search.md` §4.1 의 turn 단위 delta 서술, #959 리뷰 기록)으로 뒷받침되며, `system_error`(§8.3) 선례의 논증 패턴(1:1 시각 매핑, `system`+discriminator 기각 논리 재사용, backend enum 불변)도 정확하게 계승한다 — 이 두 축에서는 Rationale 연속성 위반이 없다. 다만 (1) #959 리뷰가 "References 탭 = RAG 표시의 단일 진실" 이라고 명시적으로 선언한 문구와의 병존을 draft 가 정면으로 인용·조율하지 않았고, (2) §8.1 D4 "1차 소스 = conversationThread snapshot" 원칙이 이제 3-source(thread snapshot / `output.error` / `turnDebug`) 현실을 갖게 됐음에도 그 원칙 서술 자체를 개정하는 계획이 없으며, (3) `turnDebug` 가 NodeExecution(노드) 스코프인 반면 Preview 가 렌더하는 `conversationThread` 는 §3 규정상 execution(다중 노드) 스코프로 공유될 수 있어, sub-workflow/Loop 상속 시나리오에서 `rag` 행이 "데이터는 있으나 도달 못 함" 이라는 — 바로 Inv-8/§8.5 가 `system_error` 를 위해 없애려 했던 것과 같은 유형의 — 결측을 일으킬 가능성이 spec·테스트 계획 어디에도 다뤄지지 않았다. 이들은 모두 명시적 기각 대안의 부활이나 invariant 의 직접 위반은 아니므로 CRITICAL 은 아니지만, spec 개정(Phase 1) 전에 명시적으로 짚고 넘어가지 않으면 향후 "누가 언제 왜 References 탭 밖으로 RAG 표시를 확장했는가" 와 "cross-node 공유 thread 에서 rag 가 왜 가끔 안 보이는가" 를 둘러싼 재조사 비용이 재발할 소지가 크다.

## 위험도
MEDIUM
