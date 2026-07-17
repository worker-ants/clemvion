# 부작용(Side Effect) Review — 🔎 `rag` 행 신설

## 발견사항

- **[CRITICAL]** `ResultDetail` 의 live(`isWaitingConversation`) 분기가 `mergeRagRetrievalItems` 를 건너뛰어 `selectedConversationItemIndex` 공유 상태가 두 개의 다른 배열(원본 vs RAG-병합)을 오가며 깨진다
  - 위치: `codebase/frontend/src/components/editor/run-results/result-detail.tsx:1089-1099` (vs `:1118-1132`), `conversation-inspector.tsx:222-225`, `run-results-drawer.tsx:418-459`, `result-timeline.tsx:148-163`
  - 상세:
    - `result-detail.tsx` 는 `effectiveConversationMessages = mergeRagRetrievalItems(baseConversationMessages, aiMetadata?.turnDebug ?? [])` 를 계산해 (a) `selectedMessage` 조회(`:1135-1138`), (b) `NodeDetailTabs.conversationMessages`(`:1232`), (c) `isConversationHistory` 분기의 `<ConversationInspector conversationMessages={effectiveConversationMessages} …>`(`:1120`) 세 곳에 쓴다.
    - 그런데 `isWaitingConversation` 분기(live, `:1097`)는 **병합 이전의 raw prop** `conversationMessages`(컴포넌트 최상위 prop, store 원본, `:888`, `:1097`)를 그대로 `<ConversationInspector>` 에 넘긴다: `conversationMessages={conversationMessages}` — `effectiveConversationMessages` 가 아니다.
    - `ConversationInspector` 는 받은 `conversationMessages` prop 하나로 렌더와 선택 조회를 모두 처리한다: `SummaryView` 는 `items = conversationMessages`(그 prop) 위에서 클릭 index 를 만들어 `onSelectMessage(idx)` 를 호출하고, 스스로도 `selectedItem = conversationMessages[selectedItemIndex]`(`conversation-inspector.tsx:222-225`) 로 상세 뷰를 결정한다 — `selectedItem` 이 truthy 면 타임라인 대신 `SelectedItemDetail` 을 렌더해버린다.
    - 반면 `selectedConversationItemIndex` 자체는 `execution-store.ts` 의 **전역 공유 상태**이고(`selectConversationItem`, `run-results-drawer.tsx:118-119`), 같은 드로어 안에서 `ResultTimeline` 도 **동일 인덱스**를 공유해 소비한다(`run-results-drawer.tsx:420-424` vs `:449`). `ResultTimeline` 은 live/history 무관하게 **항상** `mergeRagRetrievalItems` 를 적용한 `items` 로 인덱스를 계산한다(`result-timeline.tsx:148-163`) — 그 파일 자체 주석이 정확히 이 위험을 예견한다: "양 surface 가 `selectedConversationItemIndex` 를 공유하므로, 한쪽만 주입하면 인덱스가 어긋나 선택이 다른 항목을 가리킨다" (`result-timeline.tsx:154-159`).
    - 즉 라이브(`waiting_for_input`) 멀티턴 대화에서, **이전에 완결된 턴 중 하나라도 `ragSources.length > 0`** 이면(References 탭이 대기 중에도 동작하도록 설계된 바로 그 경로 — spec 5-system/6-websocket-protocol.md §4.4 diff, 대응 테스트 `result-detail.test.tsx:684-715` 가 실측) 다음 두 방향 모두 깨진다:
      1. `ResultTimeline`(병합 배열, rag 행 포함)에서 항목을 클릭 → `selectedConversationItemIndex` 는 **병합-공간** 인덱스로 세팅됨 → `ResultDetail` 의 live `ConversationInspector` 는 **raw**(rag 행 없는, 더 짧은) 배열로 그 인덱스를 조회 → 다른 항목이 선택되거나(`undefined` 면 `SummaryView` 로 조용히 폴백해 사용자의 클릭이 무시된 것처럼 보임) 엉뚱한 `SelectedItemDetail` 이 열린다.
      2. 반대로 라이브 `ConversationInspector` 내부(raw 배열)에서 항목을 클릭 → `selectedConversationItemIndex` 는 **raw-공간** 인덱스로 세팅됨 → `ResultDetail` 자신의 `selectedMessage = effectiveConversationMessages[idx]`(병합 배열, `:1135-1138`) 가 엉뚱한 항목을 골라 References/Request/Response/LLM Usage 탭(`NodeDetailTabs`)에 **다른 턴의 데이터**를 보여준다. `ResultTimeline` 의 하이라이트도 동일하게 어긋난다.
    - 부수 증상: 위와 별개로, live Preview 탭 자체가 `conversationMessages`(raw) 를 그리므로 🔎 `rag` 행이 **아예 나타나지 않는다** — 이 PR 의 목표(양 surface 동시 적용, §9.6)와 `result-timeline.tsx` 의 자체 주석이 명시한 "양쪽 모두" 요건에 위배된다. websocket 핸들러(`use-execution-events.ts`) 어디에도 `type: "rag"` 합성 로직이 없어(grep 결과 rag 관련 없음, "ragChunks" 필드 1건은 무관한 로그 필드) store 원본 배열이 다른 경로로 rag 행을 얻지도 않는다.
    - 테스트 커버리지 확인: 라이브 분기를 exercised 하는 유일한 rag 관련 테스트 `result-detail.test.tsx:684-715` ("renders chip + References tab during in-flight …")는 턴이 1개뿐이고 클릭/선택을 검증하지 않아, 📚 chip/References 탭(별도 소스인 `turnRefIndex` 로 동작 — 이건 `turnIndex` 값 기반이라 이 버그의 영향을 받지 않음)만 통과 확인할 뿐 이 인덱스 역전은 잡아내지 못한다. 실제로 재현하려면 (a) 2턴 이상 멀티턴 live 대화, (b) 앞선 턴에 `ragSources` 존재, (c) `ResultTimeline` 또는 live `ConversationInspector` 어느 한쪽에서 클릭·선택, 세 조건이 함께 필요하다.
  - 제안: `result-detail.tsx:1097` 의 `conversationMessages={conversationMessages}` 를 `conversationMessages={effectiveConversationMessages}` 로 교체 — `baseConversationMessages` 계산에서 `isWaitingConversation` 이면 이미 `conversationMessages`(raw)를 골라 넣으므로, `effectiveConversationMessages` 는 live 분기에서도 정확히 "raw + rag 병합" 결과가 된다(별도 분기 불필요, 단순 prop 교체로 충분). 회귀 테스트로 (b)+(c) 조합 — 라이브 2턴 이상 + 이전 턴 rag + 클릭 후 References/Request 탭 turnIndex 일치 — 를 `result-detail.test.tsx` 에 추가 권장.

- **[INFO]** 타입 이동(`output-shape.ts` → `lib/conversation/rag-types.ts`) 은 재-export 로 기존 소비처가 안전
  - 위치: `codebase/frontend/src/components/editor/run-results/output-shape.ts:314-323`, `codebase/frontend/src/lib/conversation/rag-types.ts` (신규)
  - 상세: `RagSource`/`RagDiagnostics`/`TurnRagDelta` 를 `rag-types.ts` 로 옮기고 `output-shape.ts` 가 `export type { … }` 로 재-export. 실측 결과 `conversation-inspector.tsx:21`·`result-detail.tsx:25-27` 는 여전히 `./output-shape` 에서 import하고, `execution-store.ts:88`·`conversation-utils.ts:2` 는 새 경로 `@/lib/conversation/rag-types` 에서 직접 import — 둘 다 컴파일 타임에만 존재하는 type-only export/import 라 런타임 부작용 없음, 기존 소비처 깨짐 없음. 의도된 lib→components 레이어 역전 회피 리팩터로 판단.

- **[INFO]** `ConversationTurnSource`/`ConversationItem.type` 7값 확장은 파악된 판별 지점 4곳 모두에서 방어됨 — 다른 switch 파급 없음
  - 위치: `conversation-utils.ts:210` (`threadTurnsToConversationItems` switch, `rag` no-op case 추가), `conversation-inspector.tsx` (`SelectedItemDetail` if-체인 + `SummaryView` `isRagRetrieval` 분기), `conversation-timeline-item.tsx` (`item.type === "rag"` 분기 추가), `execution-store.ts:112-114`.
  - 상세: `item.type`/`turn.source` 로 분기하는 파일을 저장소 전체에서 재확인한 결과 위 4개 파일이 전부이며 모두 갱신됨. `execution-store.ts` 자체 로직(`.type === "user"|"tool"` 등 비-exhaustive 조건문, 예: `:479,870,905,951`)은 새 값 추가로 영향받지 않는 형태. `interaction-type-exhaustiveness.test.ts` 도 `SOURCE_ENUM_VALUES` 에 `"rag"` 추가로 exhaustive 배열 커버 확인. 위반 없음.

- **[INFO]** `groupToolCallItems` 는 `rag` 를 claim 하지 않음 — §9.6 의도대로 격리됨
  - 위치: `conversation-utils.ts:899-928` (`groupToolCallItems`), `mergeRagRetrievalItems:948-978`
  - 상세: `groupToolCallItems` 는 `it.type !== "assistant"` 인 항목은 애초에 parent 후보에서 continue 하고, child 매칭도 `next.type === "tool"` 만 흡수한다. `rag` 항목은 parent 도 child 도 될 수 없어 순회만 지나칠 뿐 `claimedToolIndices`/`childrenByParent` 에 영향을 주지 않는다. 또한 `mergeRagRetrievalItems` 는 턴당 **첫 assistant 앞**에 한 번만 삽입(`inserted` Set 가드)하므로, 같은 턴의 두 번째 이후 assistant(예: tool-call 중간 assistant)의 child 탐색 구간(항상 그 assistant **이후** 인덱스)에는 애초에 끼어들 수 없다 — 실제 도구 child 가 밀려나는 시나리오 없음.

- **[INFO]** React 훅 규칙 — early return 이후 `useMemo` 미사용은 기존 패턴과 정합, 새 위반 아님
  - 위치: `result-detail.tsx:1035-1041` (`if (!result) return …`), `:1077-1092` (`effectiveConversationMessages` 계산)
  - 상세: 변경 전에도 `effectiveConversationMessages`(구 이름, 현 `baseConversationMessages`)와 `historyMessages`(`parseHistoryMessages` 호출)가 이미 early return 이후의 순수 계산으로 존재했다 — 조건부 훅 문제를 피하기 위해 hook 을 쓰지 않는 기존 설계를 그대로 계승. `mergeRagRetrievalItems` 도 매 렌더 재계산(비메모)이지만 순수 함수·O(n) 배열 순회 1회이고, 같은 컴포넌트가 이미 `parseHistoryMessages`(JSON 파싱 포함, 더 무거움)를 동일하게 매 렌더 재계산하고 있어 성능 프로파일상 새로운 부담을 추가하지 않는다. 위반 아님.

- **[INFO]** i18n 키 `ragChunks` — en/ko 양쪽에 동일 키 추가, 값 누락 없음 (사소한 들여쓰기 불일치만 존재)
  - 위치: `codebase/frontend/src/lib/i18n/dict/en/editor.ts:245`, `ko/editor.ts:243`
  - 상세: 두 사전 모두 같은 키(`ragChunks`)를 추가해 런타임에 raw key 노출 같은 부작용은 없다. 다만 두 파일 모두 해당 줄만 2-space 들여쓰기로 형제 키(4-space)와 어긋나 있다 — 기능적 부작용은 아니고 lint/format 관점 사소한 흠(별도 스타일 리뷰어 영역으로 판단, 여기서는 참고 표기만).

## 요약

가장 중요한 발견은 `ResultDetail` 의 live(`isWaitingConversation`) 분기가 신규 `mergeRagRetrievalItems` 병합을 빠뜨려, `ResultTimeline`·`ResultDetail` 이 공유하는 전역 상태 `selectedConversationItemIndex` 가 "병합 배열 인덱스"와 "원본 배열 인덱스"라는 서로 다른 좌표계로 오염되는 CRITICAL 부작용이다 — 이는 `result-timeline.tsx` 자신이 남긴 주석이 정확히 경고한 실패 모드("한쪽만 주입하면 인덱스가 어긋나 선택이 다른 항목을 가리킨다")가 그 형제 파일에서 실제로 발생한 사례다. 실제 영향은 라이브 멀티턴 대화 + 이전 턴 RAG 결과 존재 + 클릭 선택이 겹치는 시나리오에 한정되지만, 이 조합은 References/LLM Usage 탭이 "대기 중에도 동작"하도록 설계된 바로 그 주력 시나리오이고, 관련 테스트는 이 상호작용을 검증하지 않아 CI 로 잡히지 않는다. 그 외 타입 이동(re-export), 7값 exhaustive switch 확장, `groupToolCallItems` 격리, 훅 규칙 준수는 모두 실측 결과 안전하게 처리되어 있다.

## 위험도

CRITICAL
