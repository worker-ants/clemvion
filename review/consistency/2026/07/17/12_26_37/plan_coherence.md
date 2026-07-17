# Plan 정합성 검토 — rag-tool-row-distinct-ui.md Phase 2 (--impl-prep)

> 검토 대상: `plan/in-progress/rag-tool-row-distinct-ui.md` Phase 2 (구현 착수 직전)
> 기준 spec 커밋: `e9c1b1122` (conversation-thread.md `rag` source 신설, 2회차 consistency-check BLOCK:NO 통과)
> 비교 대상: `plan/in-progress/**` 전체

## 방법론 참고 (prompt_file 결함)

`_prompts/plan_coherence.md` 가 담은 "Target 문서"·"진행 중 plan 문서 모음" 덤프는 `spec/conventions/` 전체(오디오
`audit-actions.md` → `cafe24-api-catalog/**` 222개 field-level 파일 순회)와 `plan/in-progress/` 알파벳 순 앞쪽 5개
(`ai-agent-tool-connection-rewrite.md` ~ `chat-channel-visual-ssr-png.md`) 만 담고 있었고, 파일 크기 상한(2242줄)에
막혀 본 검토가 실제로 필요로 하는 `spec/conventions/conversation-thread.md`·`plan/in-progress/rag-quality-improvement.md`·
`plan/in-progress/rag-tool-row-distinct-ui.md` 자신 등은 전혀 포함되지 못했다 (`ls plan/in-progress/` 알파벳순으로
`rag-*` 는 훨씬 뒤). 이 dump 로는 지시받은 4개 점검을 수행할 수 없어, worktree 의 실제 `spec/`·`plan/`·`codebase/`
파일을 직접 Read/Grep 해 아래 분석을 진행했다. (오케스트레이터에게: target 선정 로직이 "관련 파일" 이 아니라 디렉토리
알파벳 순 전체 덤프 + 사이즈 캡으로 동작하는 것으로 보이며, 관련성 낮은 대용량 트리(`cafe24-api-catalog/`)가 있으면
정작 필요한 문서가 잘려나갈 수 있다.)

## 발견사항

- **[WARNING]** e9c1b1122 커밋 이동으로 다른 in-progress plan 의 상대링크가 끊어짐
  - target 위치: 커밋 `e9c1b1122` 커밋 메시지 "plan 위생: #959 의 plan 을 spec_impact 채워 `plan/complete/` 로 이동"
    (`ai-node-failed-conversation-preview.md` 를 `plan/in-progress/` → `plan/complete/` 로 git mv)
  - 관련 plan: `plan/in-progress/node-output-redesign/ai-agent.md:213` 의
    `[ai-node-failed-conversation-preview.md](../ai-node-failed-conversation-preview.md)` 링크
  - 상세: 이 상대경로는 `plan/in-progress/ai-node-failed-conversation-preview.md` 로 해석되는데, 실제 파일은
    `plan/complete/ai-node-failed-conversation-preview.md` 로 이미 이동됐다(확인: `find plan -iname
    "ai-node-failed-conversation-preview.md"` → `plan/complete/` 만 존재). `rag-tool-row-distinct-ui.md` 자신은
    이 파일을 직접 참조하지 않아 Phase 2 구현 자체에 영향은 없지만, 같은 커밋의 "plan 위생" 조치가 다른 in-progress
    plan(`node-output-redesign/ai-agent.md`, AI 에이전트 single-turn error CRITICAL 항목의 cross-ref)의 링크를
    깨뜨린 채 남겼다 — 검토 관점 3(후속 항목 누락)에 해당.
  - 제안: `node-output-redesign/ai-agent.md:213` 의 링크를 `../complete/ai-node-failed-conversation-preview.md` 로
    정정 (별도 소규모 fix, 본 rag-tool-row plan 의 스코프는 아니나 같은 세션에서 손쉽게 처리 가능).

- **[WARNING]** Phase 3 테스트 목록에 CT-S18 이 요구하는 `result-timeline.test.tsx` 누락
  - target 위치: `plan/in-progress/rag-tool-row-distinct-ui.md` Phase 3 — "CT-S18 / CT-S19
    (`conversation-utils.test.ts` + `result-detail.test.tsx`)"
  - 관련 spec: `e9c1b1122` 커밋의 `conversation-thread.md` §9.10 CT-S18 행 — 검증 컬럼이
    `conversation-utils.test.ts` + `result-detail.test.tsx` + **`result-timeline.test.tsx`** 세 파일을 명시
  - 상세: CT-S18 시나리오 (e) 는 "conversation Preview 와 실행 트리 timeline **양 surface 동시 노출**" 을
    요구하고, 이는 Phase 2 item 6("`result-timeline.tsx` — Inv-5 동시 적용 의무 이행")과 정확히 짝을 이룬다.
    그런데 Phase 3 의 테스트 파일 열거에는 `result-timeline.test.tsx` 가 빠져 있어, 구현자가 Phase 3 를 문자
    그대로 따르면 timeline 표면의 CT-S18 회귀 커버리지가 비게 될 위험이 있다.
  - 제안: Phase 3 항목을 spec CT-S18 행과 동일하게 "`conversation-utils.test.ts` + `result-detail.test.tsx` +
    `result-timeline.test.tsx`" 로 정정.

- **[INFO]** §9.11 committed 함수 시그니처와 Phase 1/Phase 2 plan 서술의 표기 불일치 (비차단)
  - target 위치: `plan/in-progress/rag-tool-row-distinct-ui.md` Phase 1 §A 항목 6, Phase 2 항목 1 —
    둘 다 `mergeRagRetrievalItems(items, turnDebug)` 로 서술
  - 관련 spec: `e9c1b1122` 커밋된 `conversation-thread.md` §9.11 변환 contract 표는
    `mergeRagRetrievalItems(items, ragDeltas)` — "(items, `meta.turnDebug[]` 의 `TurnRagDelta[]`)" 로 확정
  - 상세: `TurnRagDelta` 는 이미 codebase 에 존재하는 export 타입이다
    (`codebase/frontend/src/components/editor/run-results/output-shape.ts:330`, `plan/complete/c1-dev-followups-1b.md`
    가 기록한 `TurnDebugEntry` → `TurnRagDelta` rename 의 결과물)이므로 실질적으로 같은 데이터(=turnDebug 배열
    항목)를 정확한 타입명으로 부른 것뿐이라 기능 충돌은 아니다. 다만 plan 의 두 곳(Phase 1·Phase 2)이 아직 옛
    파라미터명 `turnDebug` 를 쓰고 있어, 구현자가 plan 문구만 보고 시그니처를 결정하면 committed spec(SoT)과
    미묘하게 어긋난 이름으로 작성할 수 있다.
  - 제안: 구현 시 plan 문구가 아니라 committed spec(`conversation-thread.md §9.11`)의
    `mergeRagRetrievalItems(items, ragDeltas: TurnRagDelta[])` 시그니처를 그대로 따를 것. 여유가 있다면 plan
    문구도 동기화.

- **[INFO]** `RagSource` 스키마 SoT cross-ref 가 committed spec 내부에서 자기모순 (plan 영향은 낮음)
  - target 위치: `e9c1b1122` 커밋된 `conversation-thread.md` §1.2.2 — "`RagSource` 스키마의 단일 진실은
    [Spec Graph RAG §4.3](../5-system/10-graph-rag.md)"
  - 관련 spec: `spec/5-system/10-graph-rag.md` §4.3 자신은 "`ragSources[]` 항목 스키마... 의 단일 SoT 는
    [RAG 검색 §4.1](./9-rag-search.md#41-ragsources-run-results-ui-에서-인용-청크-표시) 이다" 라고 명시해
    SoT 를 `9-rag-search.md §4.1` 에 위임한다.
  - 상세: 같은 커밋이 `9-rag-search.md §4.1` ↔ `conversation-thread.md` 양방향 링크를 신설한 근거가 "상호
    참조 0건이 이번 drift 의 근본 원인" 이었는데, 정작 새로 쓴 §1.2.2 는 SoT 를 (§4.1 이 아닌) §4.3 으로
    잘못 지목해 또 다른 미세 drift 를 만들었다. `RagSource` 필드 집합(`chunkId`/`documentId`/`documentName`/
    `content`/`score`/`origin`) 자체는 두 문서에서 동일하므로 Phase 2 구현(§1.2.2 필드 정의 사용)에는 실질
    영향이 없다.
  - 제안: spec 쪽 정정 사안(§1.2.2 의 링크를 `10-graph-rag.md §4.3` → `9-rag-search.md §4.1` 로 교체)이라
    project-planner 트랙. 본 plan Phase 2 구현은 영향받지 않으므로 차단 사유 아님 — cross-spec 검토가 별도로
    다룰 수도 있어 정보 공유 목적으로만 기록.

## 점검 관점별 확인 결과 (문제 없음 — 근거 포함)

**(a) e9c1b1122 vs Phase 2 정합** — 위 INFO 2건을 제외하면 Phase 1(§A~§D 19개 항목)이 실제 커밋 diff 와 1:1
대응한다 (§1.1.2/§1.2.2 신설, §9.1/§9.2/§9.3/§9.6/§9.9(Inv-9)/§9.10(CT-S18~20)/§9.11/§9.12/§8.1/§8.6 전부 확인,
6-websocket-protocol.md §4.4 필드 문서화, 9-rag-search.md §4.1 양방향 링크, 1-ai-agent.md L732 갱신 — 모두 diff 로
직접 대조). Phase 2 의 5개 편집 대상 파일(`conversation-utils.ts`/`execution-store.ts`/`conversation-inspector.tsx`/
`result-detail.tsx`/`result-timeline.tsx`)은 committed spec 의 §9.11 contract·§9.1 표·Inv-5/Inv-9 요구와 어긋남 없이
대응한다.

**(b) rag-quality-improvement.md 의 turnDebug/ragSources 스키마 변경 계획 재확인** — 전문을 읽고 grep(`turnDebug`,
`ragSources`, `schema`) 한 결과, 유일한 언급은 §P0 "응답 로깅: ... 기존 `ragSources`/`ragDiagnostics` **재활용**"
뿐이며 스키마 변경 항목은 없다(§6 남은 결정·§7 후속 추적 A~E 어디에도 스키마 변경 없음). 추가로
`plan/in-progress/node-output-redesign/{README,ai-agent,text-classifier,information-extractor}.md` 도 grep 했는데
`turnDebug` 관련 항목은 ① information-extractor 의 `turnDebugHistory` cap 부재(§7-remaining, ai-agent 와 달리
무제한 누적) 추가 요구, ② text-classifier 의 `meta.llmCalls` ↔ `meta.turnDebug[i].llmCalls` 위치 통일 검토뿐이며,
**둘 다 `RagSource`/`ragSources[]` 항목의 필드 shape 자체를 바꾸지 않는다** — cap 정책·wrapper 위치 논의이지
스키마 필드 변경이 아니다. 따라서 본 구현이 "그 위에 얹혀 깨질" 위험은 현재로선 확인되지 않는다.

**(c) 백로그 E(`isConversationOutput` 구조 개선) 후순위 유지 타당성** — `review/code/2026/07/17/07_12_33/architecture.md`
가 지목한 항목(`isConversationOutput` 의 endReason 문자열 화이트리스트 OR-체인, `output-shape.ts:130`)과
`RESOLUTION.md` 가 "별도 과제" 로 이관한 사실을 확인했다. `rag` 행 삽입은 `mergeRagRetrievalItems` 라는 별도
후처리 병합 함수(§9.11, `mergeOrphanToolItems` 계열)로 이미 계산된 `items` 위에 적용되며, `isConversationOutput`
이 판정하는 "이 outputData 가 대화 shape 인가"(터미널 endReason 화이트리스트)와는 관심사가 다르다 — Phase 2 어느
항목도 `isConversationOutput`/`CONVERSATION_END_REASONS` 를 건드리지 않는다. 후순위 유지는 여전히 타당하다.

**(d) Slice B(#7·#1) 유효성 — #959 머지 후 코드 기준 재확인**
- **#7**: `conversation-inspector.tsx:836` `const items = conversationMessages;` 확인 — `isLive` 는 items
  계산에 관여하지 않는다(다른 렌더 분기에만 사용, `:255`/`:269`/`:843`). 테스트
  `__tests__/conversation-inspector.test.tsx:408` 의 제목 "History 모드 (isLive=false) 에서도 tool 메시지가
  표시된다" 는 여전히 남아 있고, 테스트 자체 주석(`:438-443`)도 "호출자가 정규 변환을 마친 items 를 주입" 한다고
  명시해 plan 의 "명칭·주석 정정 필요" 지적과 정확히 일치한다.
- **#1**: `use-execution-events.ts:871` `outputData: payload.output ?? null` 이 `handleNodeFailed` 전체(AI/비AI
  무관)에 적용됨을 확인. 테스트 `__tests__/use-execution-events.test.ts:2072` "non-AI node failure does NOT
  APPEND system_error" 는 `output` 필드를 아예 넘기지 않고 `outputData` 도 assert 하지 않는다. `outputData` 를
  검증하는 유일한 테스트는 `:1998` CT-S15 인데 `nodeType: "ai_agent"` 전용이다. 비AI 노드 + 실제 output 조합의
  `outputData` 전달 테스트는 여전히 부재 — plan 의 갭 서술이 현재 코드 기준으로도 정확하다.

두 항목 모두 #959(`12ceee587`) 머지 후에도 유효한 갭으로 재확인됐다.

## 요약

`e9c1b1122` 로 커밋된 spec 개정과 `rag-tool-row-distinct-ui.md` Phase 2 는 실질적으로 잘 정합돼 있다 — Phase 1 의
19개 개정 항목이 diff 와 1:1 대응하고, Phase 2 의 편집 대상·§9.11 contract·Inv-9/Inv-5 요구도 어긋나지 않는다.
`rag-quality-improvement.md` 와 `node-output-redesign/**` 어디에도 `ragSources`/`turnDebug` 항목의 스키마(필드
shape)를 바꾸는 계획은 없어 (b)의 우려는 근거가 확인되지 않았다. 백로그 E 후순위 유지, Slice B(#7/#1) 갭 서술도
현재 코드로 재확인해 여전히 유효하다. 다만 Phase 3 테스트 목록에서 CT-S18 이 요구하는
`result-timeline.test.tsx` 가 누락됐고, 같은 spec 커밋의 "plan 위생" 조치(`ai-node-failed-conversation-preview.md`
이동)가 무관한 다른 in-progress plan(`node-output-redesign/ai-agent.md`)의 상대링크를 깨뜨린 채 방치돼 있다 —
둘 다 구현을 막는 수준은 아니지만 이번 phase 안에서 정정해두는 편이 안전하다.

## 위험도

LOW
