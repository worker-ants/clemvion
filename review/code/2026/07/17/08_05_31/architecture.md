# 아키텍처(Architecture) Review — fix 델타 (aee4f75e9..HEAD)

대상: 직전 리뷰(`review/code/2026/07/17/07_12_33/`)의 architecture WARNING("인라인 재파싱 dead code 잔존") fix — `conversation-inspector.tsx` 의 `items` `useMemo` 인라인 재파싱 블록 전면 삭제 + `output-shape.ts` 의 `CONVERSATION_END_REASONS` ReadonlySet 전환 + 관련 테스트/fixture/spec 정정.

중점 검토: (a) 삭제가 안전했는지 — `result-detail.tsx` 2개 호출처가 항상 정규 변환 결과를 주입하는지, (b) `useMemo` 제거가 리렌더 특성에 영향 없는지, (c) `CONVERSATION_END_REASONS` ReadonlySet 전환이 파일 기존 패턴과 정합한지, (d) 삭제로 dangling 참조/주석이 남지 않았는지.

## 발견사항

- **[WARNING]** producer(인라인 재파싱)는 삭제됐지만 그 데이터 shape(`type: "rag"`)의 consumer(렌더 분기)가 동일 파일에 그대로 남아 새로 orphan 코드가 됐다 — 이번 fix 가 고치려던 것과 동일 계열의 문제가 다른 지점에서 재현
  - 위치:
    - `codebase/frontend/src/components/editor/run-results/conversation-inspector.tsx:366-368` (`SelectedItemDetail` 의 `if ((item.type as string) === "rag") return <RagDetail item={item} />;`)
    - `codebase/frontend/src/components/editor/run-results/conversation-inspector.tsx:564-584` (`RagDetail` 함수 전체)
    - `codebase/frontend/src/components/editor/run-results/conversation-inspector.tsx:927` (`const isRag = (item.type as string) === "rag";`) 및 그 사용처 `:1161-1163`(`ragSourceCount`), `:1183`, `:1186-1188`(bubble 배경/여백 클래스 분기), `:1197-1198`(아이콘/라벨), `:1220-1221`(`<RagBubbleSummary content={item.content} />`)
    - `codebase/frontend/src/components/editor/run-results/conversation-inspector.tsx:1273-1298` (`RagBubbleSummary` 함수 전체)
  - 상세: 삭제된 인라인 재파싱 블록이 유일하게 `type: "rag"` 인 `ConversationItem` 을 생성하던 곳이었다(`role === "system" && isRagContextContent(m.content)` 분기). `ConversationItem["type"]` 유니온(`codebase/frontend/src/lib/stores/execution-store.ts:108-114`)에는 애초에 `"rag"` 가 선언돼 있지 않다 — `RAG_CONTEXT_MARKER`/`isRagContextContent` 를 지운 이번 delta 이전에도 `"rag"` 는 `as ConversationItem["type"]` 강제 캐스트로 타입 시스템을 우회해 주입되던 값이었다. 저장소 전체를 검색(`grep -rn 'type: "rag"'`)해도 프로덕션·테스트 어디에도 `"rag"` 타입 아이템을 생성하는 코드가 더 이상 없다 — 이번 delta 가 producer 를 지우면서 유일한 생성 지점이 사라졌기 때문이다. 그 결과 위에 열거한 render 분기·전용 함수 2개(`RagDetail`, `RagBubbleSummary`)는 **100% 도달 불가능**해졌는데도 물리적으로 남아 있다.
    이는 정확히 직전 리뷰가 지적하고 이번 delta 가 고쳤다고 주장하는 문제("guard 우회만으로는 조건 완화 시 회귀 재발 · dead code 가 계약과 물리적 코드를 어긋나게 함")와 **같은 아키텍처 결함 클래스**다 — 다만 이번엔 producer 쪽이 아니라 그 producer 가 만들던 데이터 shape 의 consumer 쪽에서 재발했다. `(item.type as string) === "rag"` 라는 강제 캐스트는 TS 판별 유니온의 narrowing 보호를 우회하는 코드 냄새이며, 컴파일러·`eslint`는 이 분기가 죽었다는 것을 알 방법이 없어(`tsc`/`eslint clean` 통과와 무관하게) 이번 fix 의 회귀 테스트·정적 검사 어디에도 걸리지 않았다.
    RESOLUTION.md 는 "orphan 심볼 5개(`useMemo`/`tryParseJson`/`stripInlineMarkers`/`RAG_CONTEXT_MARKER`/`isRagContextContent`) 정리"라고 명시했고 side_effect 리뷰(#9)는 "RAG 행 소실"을 3가지 근거로 의도된 변경이라 확정했지만, 두 문서 모두 **렌더링 측 orphan**(`RagDetail`/`RagBubbleSummary`/`isRag` 분기)은 스코프에 넣지 않았다 — producer 삭제가 "완결된 정리"였다고 결론짓기엔 이르다.
  - 왜 문제인가: (1) §9.11 "다중 정의 금지"/"변환 함수 3개" 계약이 이번 delta 로 producer 단에서는 회복됐지만, 렌더 단에는 죽은 4번째 shape 을 위한 전용 컴포넌트·분기가 여전히 소스에 남아 코드와 계약이 다시 불일치한다. (2) 향후 누군가 `ConversationItem["type"]` 에 실수로 `"rag"` 를 정식 추가하거나(또는 다른 코드가 같은 문자열을 재사용) 유사 캐스트를 다시 쓰면, 이번에 "정리"했다고 믿었던 렌더 로직이 아무 경고 없이 되살아난다 — 데드 코드가 "고쳐지지 않은 채 잠들어있는 시한폭탄"이라는 직전 리뷰의 지적이 그대로 적용된다. (3) 유지보수자가 `conversation-inspector.tsx` 를 읽을 때 "RAG 는 여전히 렌더 가능한 케이스"로 오인하기 쉽다 — 코드 구조가 실제 데이터 흐름보다 넓은 표면을 암시한다(응집도 저하).
  - 제안: `RagDetail`, `RagBubbleSummary`, `isRag`(및 그 5개 사용처), `SelectedItemDetail` 의 `"rag"` 분기를 함께 삭제할 것. RAG 청크 노출이 References 탭(`turnRefIndex`)으로 이미 대체됐다는 SUMMARY.md 의 판단(side_effect #9)을 그대로 렌더 측까지 완결한다. 삭제 시 `ConversationItem["type"]` 유니온에 애초에 없던 값이므로 타입 레벨 파급은 없다 — 순수 삭제.

- **[INFO]** `items` 계산부 바로 위 기존 주석(수정 안 됨)이 새 주석과 내용상 모순되며 다음 유지보수자를 혼란시킬 수 있음
  - 위치: `codebase/frontend/src/components/editor/run-results/conversation-inspector.tsx:855-857`
  - 상세: `// Full conversation thread ... Post-Stage-5 ai_agent writes messages at output.result.messages; legacy runs kept them at output.messages. resolveResultField handles both paths.` 라는 3줄 주석은 이번 delta 의 diff에서 context line(변경 없음)으로 남아있다. 이 문장은 삭제된 인라인 재파싱 시절 — `items` 가 `resolveResultField<unknown[]>(output, "messages")` 로 두 경로를 직접 처리하던 — 을 설명하던 것인데, 지금은 `items = conversationMessages`(바로 5줄 아래, `:868`)로 축소되어 `resolveResultField` 는 `items` 계산에 전혀 관여하지 않는다(같은 함수 안에서 `resolveResultField` 는 `turnCount`/`endReason` 표시용으로만 남음, `:883-884`). 새로 작성된 바로 아래 주석 블록(`:858-867`, "대화 items 의 단일 소스는 호출자다... 예전에는 여기서 자체 인라인 재파싱했으나...")이 정확히 반대되는 사실을 설명하고 있어, 두 주석 블록이 나란히 붙어 서로 모순되는 서술로 읽힌다.
  - 제안: `:855-857` 의 3줄을 삭제하거나 "이 `resolveResultField` 언급은 아래 `turnCount`/`endReason` 표시부(`:883-884`)에 대한 것이며 `items` 계산과는 무관하다"로 재작성해 인접 주석과의 모순을 해소할 것. 기능적 영향은 없는 순수 문서 정합성 문제.

- **[INFO]** (a) 항목 검증 — 두 호출처가 항상 정규 변환 결과를 주입함을 코드로 확인, 안전
  - 위치: `codebase/frontend/src/components/editor/run-results/result-detail.tsx:1082-1098`(`isLive=true`, `conversationMessages={conversationMessages}` — store 사본), `:1105-1119`(`isLive=false`, `conversationMessages={effectiveConversationMessages}` — `historyMessages = parseHistoryMessages(result.outputData)` 또는 store 사본)
  - 상세: `grep -rn "<ConversationInspector" codebase/frontend/src` 로 프로덕션 호출처가 이 2곳뿐임을 확인했다. `effectiveConversationMessages` 는 `isWaitingConversation || hasLiveSystemError ? conversationMessages : historyMessages` 이며, 두 분기 모두 canonical 변환 함수(`parseHistoryMessages`) 또는 store ingestion(`messagesToConversationItems` 경유, live) 산출물이다 — `[]` 를 직접 넘기는 경로가 존재하지 않는다. `parseHistoryMessages` 가 `[]` 를 반환하는 유일한 조건(`messagesSource` 부재)은 삭제된 인라인 경로도 동일 데이터를 못 읽어 결과적으로 동일하게 빈 배열로 귀결되던 상황과 구조적으로 동치임을 `conversation-utils.ts:627-743` 로 확인했다 — 삭제가 실질적 커버리지 손실을 만들지 않는다.
  - 제안: 없음(확인 목적).

- **[INFO]** (b) 항목 검증 — `useMemo` 제거는 참조 안정성·재계산 특성에 아무 영향 없음
  - 위치: `codebase/frontend/src/components/editor/run-results/conversation-inspector.tsx:868`(`const items = conversationMessages;`), `:910`(`groupToolCallItems(items)` 가 이미 render 함수 본문 IIFE 안에서 매 렌더 재계산되던 코드 — `items` memo 여부와 무관)
  - 상세: 옛 `useMemo(() => {...}, [isLive, conversationMessages, output])` 는 가드가 항상 히트하는 현재 콜그래프에서 매번 인자로 받은 `conversationMessages` 참조를 그대로 반환했다. `const items = conversationMessages` 는 동일 참조를 훅 오버헤드 없이 매 렌더 동일하게 노출하므로 하위 호출(`groupToolCallItems(items)`, `items.map(...)`)의 참조 안정성·재계산 빈도에 차이가 없다. `groupToolCallItems` 호출 자체도 원래부터 `useMemo` 밖(렌더 본문 IIFE)에 있어 이번 변경으로 새로 발생한 비용도 없다.
  - 제안: 없음(확인 목적) — 오히려 불필요한 훅 제거로 코드가 단순해진 타당한 리팩터.

- **[INFO]** (c) 항목 검증 — `CONVERSATION_END_REASONS` ReadonlySet 전환은 파일 기존 패턴과 정합
  - 위치: `codebase/frontend/src/components/editor/run-results/output-shape.ts:106-109`(기존 `MULTI_TURN_INTERACTION_TYPES: ReadonlySet<string> = new Set([...])`), `:121-128`(신규 `CONVERSATION_END_REASONS`), `:172-175`(`CONVERSATION_END_REASONS.has(endReason)` 사용)
  - 상세: 선언 스타일(`ReadonlySet<string> = new Set([...])`), JSDoc 구조(backend enum 정합 근거 명시), 사용 패턴(`.has()`)이 같은 파일의 기존 `MULTI_TURN_INTERACTION_TYPES` 와 1:1 대응한다. 직전 리뷰의 architecture INFO("OR-체인이 파일 기존 ReadonlySet 패턴 미준수")를 정확히 겨냥해 해소했다.
  - 제안: 없음.

## 요약

이번 fix 델타는 직전 리뷰가 지적한 producer 측 dead code(`items` `useMemo` 인라인 재파싱)를 정확히 삭제하고 `CONVERSATION_END_REASONS` 를 파일 기존 `ReadonlySet` 패턴에 맞춰 정합화한 점에서 방향이 옳다 — `result-detail.tsx` 의 두 호출처가 항상 canonical 변환 함수 산출물만 주입함을 코드로 확인했고, `useMemo` 제거도 참조 안정성·재계산 특성에 부작용이 없는 안전한 단순화다. 다만 이번 delta 는 정확히 같은 계열의 문제를 producer 반대편(consumer)에 새로 남겼다 — 삭제된 인라인 재파싱이 유일하게 생성하던 `type: "rag"` `ConversationItem` 을 그린다는 이유로 존재하던 `RagDetail`/`RagBubbleSummary` 함수와 `isRag` 렌더 분기가 producer 소멸 후에도 그대로 남아 이제 100% 도달 불가능한 dead code 가 됐다. `(item.type as string) === "rag"` 캐스트가 타입 시스템의 narrowing 보호를 우회해왔기 때문에 `tsc`/`eslint` 어느 쪽도 이 상태를 잡아내지 못했고, RESOLUTION.md/SUMMARY.md 가 선언한 "orphan 심볼 정리 완료"·"RAG 행 소실은 의도된 변경으로 확정"이라는 결론은 producer 측만 검증했을 뿐 렌더 측 잔존을 놓쳤다. 부수적으로 `items` 계산 바로 위에 남아있는 옛 주석(`:855-857`)이 새 주석과 내용상 모순돼 문서 정합성이 떨어진다.

## 위험도

LOW — 기능 파손·회귀는 없다(새로 발견한 dead code 는 이미 도달 불가능했으며 테스트·타입체크를 통과한다). 다만 "dead code 제거"를 완료로 선언한 이번 fix 가 같은 파일 안에 또 다른 dead code(더 큰 규모 — 함수 2개 + 분기 6곳)를 새로 남겼다는 점에서, 직전 리뷰의 근본 우려("guard/삭제만으로 완전한 정리가 보장되지 않음")가 그대로 재현된 사례로 WARNING 처리했다.
