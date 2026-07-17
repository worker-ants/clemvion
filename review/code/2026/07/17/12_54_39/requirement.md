# 요구사항(Requirement) Review — `rag` 행 신설 (RAG/도구 행 시각 구분)

## 발견사항

### [CRITICAL] 라이브(`waiting_for_input`) 세션의 conversation Preview 탭에서 🔎 `rag` 행이 전혀 렌더되지 않음 — plan/spec 이 명시적으로 약속한 "live·history 양쪽" parity 미달성

- 위치: `codebase/frontend/src/components/editor/run-results/result-detail.tsx:1094-1111` (특히 1097 라인), 대조: `:1118-1132` (history 분기), `:1135-1138` (`selectedMessage` 파생)
- 상세:
  - `result-detail.tsx` 는 `effectiveConversationMessages = mergeRagRetrievalItems(baseConversationMessages, aiMetadata?.turnDebug ?? [])` 를 계산하지만 (:1077-1092), **`conversationPreview` 의 live 분기(`isWaitingConversation` true)** 는 이 병합 결과가 아니라 raw `conversationMessages` 를 그대로 `ConversationInspector` 에 넘긴다:
    ```tsx
    const conversationPreview = isWaitingConversation ? (
      <ConversationInspector
        ...
        conversationMessages={conversationMessages}   // 병합 안 된 raw store 배열
        isLive={true}
        ...
    ```
    반면 바로 아래 history 분기(:1120)는 `conversationMessages={effectiveConversationMessages}` (병합됨) 를 쓴다 — **live/history 비대칭**.
  - `ConversationInspector`/`SummaryView` 는 순수 pass-through 다 (`SummaryView` 의 `const items = conversationMessages;`, `conversation-inspector.tsx:913`) — 자체적으로 rag 를 병합하지 않는다. 따라서 라이브로 `waiting_for_input` 상태인 AI Agent 노드의 conversation Preview 타임라인에는 **`meta.turnDebug[].ragSources` 가 있어도 🔎 행이 절대 나타나지 않는다.**
  - `mergeRagRetrievalItems` 사용처를 repo 전수 검색한 결과 호출부는 `result-detail.tsx:1089`(위 버그로 인해 실질적으로 live 경로에 적용되지 않음)와 `result-timeline.tsx:160` 두 곳뿐이다. `result-timeline.tsx` 는 `isLiveNode` 여부와 무관하게 항상 `mergeRagRetrievalItems` 를 태우므로(좌측 실행 트리 timeline), **좌측 timeline 은 live 에도 🔎 행이 뜨지만 우측 Preview 탭은 뜨지 않는** 표면 간 불일치가 실측된다.
  - 부수 버그(같은 원인) — **인덱스 불일치**: `SummaryView` 의 클릭 핸들러는 `onSelectItem(i)` 를 호출하며 `i` 는 (live 의 경우) **병합 전** `conversationMessages` 배열의 인덱스다 (`conversation-inspector.tsx:956-970`). 그런데 `result-detail.tsx:1135-1138` 의 `selectedMessage` 는 `effectiveConversationMessages[selectedConversationItemIndex]` — **병합 후** 배열에서 그 인덱스를 조회한다. 같은 live 대화 안에서 어느 한 turn 이라도 `ragSources` 가 있으면 그 이후 turn 을 클릭했을 때 `selectedMessage`(References/LLM Usage/Request/Response 탭이 소비, `:392-399`, `:347-390`)가 **엉뚱한 turn** 을 가리키게 된다.
  - 이 실패 모드는 `result-timeline.tsx` 자신의 주석(:154-159)이 정확히 예견하고 방지 조치를 취한 바로 그 것이다 — *"양 surface 가 `selectedConversationItemIndex` 를 공유하므로, 한쪽만 주입하면 인덱스가 어긋나 선택이 다른 항목을 가리킨다"*. `result-timeline.tsx` 는 이를 지켰지만 `result-detail.tsx` 의 live 분기는 지키지 못했다.
  - **spec/plan 과의 괴리**: `plan/in-progress/rag-tool-row-distinct-ui.md` 의 "옛 행 vs 본 작업" 비교표가 "live 동작: ❌ history 전용 → ✅ **live·history 양쪽**" 을 본 작업의 핵심 개선점으로 명시하고, `spec/5-system/6-websocket-protocol.md` §4.4 신규 문구는 *"진행 중 누적치를 노출해 References / LLM Usage 탭이 **대기 중에도 동작**"* 이라 turnDebug 소비의 live 동작을 전제로 서술한다. `spec/conventions/conversation-thread.md` §9.10 CT-S18(e) 도 "conversation Preview **와** 실행 트리 timeline 양 surface 동시 노출"을 회귀 차단 요건으로 못박는다. 구현은 이 셋 모두를 만족하지 못한다 — spec 이 권위이고 코드가 어긋난 케이스(코드 fix 대상)다.
  - **테스트 커버리지 갭**: `conversation-inspector.test.tsx` / `result-timeline.test.tsx` 어디에도 `"rag"` 문자열이 등장하지 않는다(grep 확인). `result-detail.test.tsx` 의 유일한 live+turnDebug 테스트("renders chip + References tab during in-flight (waiting_for_input) multi-turn", :684-715)는 📚 chip 과 References 탭 버튼 존재만 검증하고 🔎 행 자체는 assert 하지 않는다. CT-S18 관련 index-shift 테스트 2건(`selectedConversationItemIndex={5}`/`{2}`)은 모두 `defaultProps.isWaitingConversation: false`(history 경로)만 검증한다 — 이번 버그를 잡아낼 테스트가 존재하지 않는다.
- 제안: `result-detail.tsx:1097` 의 `conversationMessages={conversationMessages}` 를 `conversationMessages={effectiveConversationMessages}` 로 교체 (live 분기에서 `baseConversationMessages === conversationMessages` 이므로 안전한 1-line fix). 그 후 CT-S18(e) 를 실제로 검증하는 live 케이스 단위 테스트 추가 — 예: "renders chip + References tab during in-flight" 테스트에 🔎 행 존재 assertion 을 추가하거나, `makeAiResultBothTurnsWithRag()` 류 픽스처에 `isWaitingConversation` 변형 테스트를 신설.

### [WARNING] `[SPEC-DRIFT]` `interaction-type-registry.md` §2 가 존재하지 않는 함수명 `RagRetrievalDetail` 을 참조

- 위치: `spec/conventions/interaction-type-registry.md` §2.1 표 `rag` 행 — *"우측 인스펙터는 SummaryView 의 `RagRetrievalRow` / SelectedItemDetail 의 `RagRetrievalDetail` (conversation-inspector.tsx)"*. 대조: `codebase/frontend/src/components/editor/run-results/conversation-inspector.tsx:373-380` (`SelectedItemDetail` 의 `item.type === "rag"` 분기)
- 상세: 실제 구현은 별도 `RagRetrievalDetail` 함수를 만들지 않고 `SelectedItemDetail` 안에서 기존 `RagRetrievalRow` 를 그대로 재사용한다:
  ```tsx
  if (item.type === "rag") {
    // §9.1 — 선택 시에도 같은 정보를 보여준다. 별도 detail 뷰를 두지 않는 이유: ...
    return (
      <div className="p-3">
        <RagRetrievalRow item={item} />
      </div>
    );
  }
  ```
  코드 주석이 "별도 detail 뷰를 두지 않는 이유"를 명시적으로 설명하고 있어(행 자체가 이미 충분한 정보를 담고, 청크 본문은 References 탭이 SoT — Inv-9 중복 정의 회피), 이는 실수가 아니라 구현 중 내린 의도적 단순화로 보인다. 이 케이스는 코드가 옳고 spec(정확히는 registry 표의 함수명 서술)이 구현보다 앞서 작성된 설계 의도를 그대로 남겨 stale 해진 경우다. `SOURCE_REGISTRY_SITES` AST 가드(`interaction-type-exhaustiveness.test.ts`) 는 `conversation-utils.ts` 한 파일만 grep 하므로 이 불일치를 잡지 못한다.
- 제안: 코드는 유지. `spec/conventions/interaction-type-registry.md` §2.1 `rag` 행의 "SelectedItemDetail 의 `RagRetrievalDetail`" 문구를 "SelectedItemDetail 이 `RagRetrievalRow` 를 재사용(별도 detail 컴포넌트 없음)"으로 정정 (project-planner 위임).

### [INFO] i18n 신규 키 `ragChunks` 들여쓰기 불일치 (기능 무관, cosmetic)

- 위치: `codebase/frontend/src/lib/i18n/dict/en/editor.ts:245`, `codebase/frontend/src/lib/i18n/dict/ko/editor.ts:243`
- 상세: 주변 키들은 4-space indent(`    cardSystemNote: ...`)인데 신규 `ragChunks` 만 2-space(`  ragChunks: ...`)로 삽입됐다. 문법적으로는 무해하고 `tsc`/기존 테스트에 영향 없음(직접 확인).
- 제안: `eslint --fix` (CLI prettier 아님 — 프로젝트 관례) 로 들여쓰기 정정.

## 점검 관점별 요약

- **기능 완전성**: `mergeRagRetrievalItems` 자체(순수 함수)와 History-view 렌더링, 좌측 실행 트리 timeline 은 완전히 동작한다. 그러나 **live 세션의 conversation Preview 탭**은 위 CRITICAL 로 인해 기능 미완성 — 사용자가 실제로 가장 자주 마주치는 "대화 진행 중" 화면에서 신규 기능이 보이지 않는다.
- **엣지 케이스**: `mergeRagRetrievalItems` 의 CT-S18/S19/S20 처리(같은 턴 중복 삽입 방지, `ragSources` 빈 배열/부재 시 생략, cross-node 스코프)는 코드·테스트 모두 spec 서술과 정확히 일치. `RagRetrievalRow` 의 `sources.length === 0` 방어도 적절(비록 병합 함수가 이미 필터링해 도달 불가능하지만 방어적으로 안전).
- **TODO/FIXME**: 신규/변경 파일에 TODO/FIXME/HACK/XXX 없음 (grep 확인).
- **의도와 구현 간 괴리**: `RagRetrievalDetail` 명명 건(WARNING) 외에는 함수명·주석과 구현이 대체로 일치. `mergeRagRetrievalItems` 함수 자체의 동작은 spec §8.6/§9.11 서술과 정확히 부합.
- **에러 시나리오**: `ragSources` 결측/빈 배열, cross-node turn 결측 모두 정상적으로 no-op 처리(§9.12 결측 내성 정합). 상기 CRITICAL 은 에러 처리 문제가 아니라 데이터 배선 누락.
- **데이터 유효성**: `RagSource`/`TurnRagDelta` 타입 이동(`output-shape.ts` → `lib/conversation/rag-types.ts`) 은 레이어 역전 회피 목적에 맞고 re-export 로 하위 호환 유지 — 문제 없음.
- **비즈니스 로직**: §8.6 이 요구하는 "🔎 vs 🔧 3중 신호 구분"(아이콘/컨테이너/chip), "§9.6 그룹 분류 대상 외", "📚 chip 병존" 은 모두 구현에 반영됨.
- **반환값**: `mergeRagRetrievalItems` 는 모든 입력 조합(빈 delta, 매칭 assistant 없음, 다중 assistant)에서 명세대로 배열을 반환.
- **spec fidelity**: `conversation-thread.md` §1.1.2/§1.2.2/§9.1/§9.2/§9.3/§9.6/§9.9 Inv-9/§9.11/§9.12, `interaction-type-registry.md` §2, `6-websocket-protocol.md` §4.4, `9-rag-search.md` §4.1 은 순수 함수·타입·History 경로에 한해 line-level 로 부합. `ragSources` 한정 스코프(llmCalls 미접촉)도 `TurnRagDelta` 타입 정의 자체가 llmCalls 필드를 노출하지 않아 구조적으로 보장됨 — 요청 (d) 충족. §9.12 타임스탬프 대리(요청 (c))는 `mergeRagRetrievalItems` 가 `timestamp: item.timestamp`(뒤따르는 assistant 의 timestamp, spec 표상 `= llmCalls[].startedAt`)를 그대로 물려주고 `RagRetrievalRow`/`ConversationTimelineItem` 양쪽이 `formatDate(..., "time-seconds")` 로 렌더 — **누락이 아니라 구현되어 있음**을 코드로 확인(단, 위 CRITICAL 로 인해 live Preview 표면에서는 애초에 행 자체가 안 뜨므로 그 표면에서는 이 로직이 발동하지 못함). 다만 Inv-9(요청 (b))는 **history/실행-트리 표면에서는** `turnRefIndex` 와 `mergeRagRetrievalItems` 가 동일 `aiMetadata.turnDebug`(같은 `useMemo` 소스)를 공유해 성립하지만, **live Preview 표면**에서는 🔎 행 자체가 없어 "같은 turnIndex 에 같은 sources[]" 비교 대상이 아예 존재하지 않는 방식으로 불변량이 공허하게(vacuously) 유지된다 — 이는 불변량 위반이라기보다 위 CRITICAL 의 파생 증상이다.

## 요약

핵심 로직(`mergeRagRetrievalItems`, 타입 이동, i18n, exhaustiveness 가드, History-view 렌더링, 좌측 실행 트리 timeline)은 spec(§1.1.2/§1.2.2/§8.6/§9.1/§9.2/§9.6/§9.9~§9.12)과 정확히 line-level 로 합치하고 CT-S18/S19/S20 단위 테스트도 스펙 서술 그대로 통과한다. 그러나 **conversation Preview 탭의 live(`waiting_for_input`) 분기가 `mergeRagRetrievalItems` 결과를 배선받지 못해**, 대화가 진행 중인 동안(가장 흔한 관찰 시나리오)에는 🔎 `rag` 행이 전혀 표시되지 않으며, 동일 원인으로 `selectedMessage` 파생 시 배열 인덱스가 어긋나 References/LLM 탭이 잘못된 turn 을 가리킬 수 있는 부수 버그도 존재한다. 이는 spec(§4.4 신규 문구 "대기 중에도 동작", CT-S18(e))과 plan 자체가 명시적으로 약속한 "live·history 양쪽 지원"을 충족하지 못하는 것으로, 사용자 원 요청("RAG 및 도구에 대한 행은 구분되는 UI로 표시")의 완전한 충족을 가로막는 CRITICAL 결함이다. 다행히 원인이 `result-detail.tsx` 한 곳(1-line)으로 국소화되어 있어 수정 범위는 작다.

## 위험도

HIGH
