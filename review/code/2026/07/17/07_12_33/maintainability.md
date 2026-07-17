# 유지보수성(Maintainability) 리뷰

대상: `result-detail.tsx` / `output-shape.ts` / `conversation-inspector.tsx` / `use-execution-events.ts` 및 부속 테스트·픽스처(`conversation-scenarios.ts`, `result-detail.test.tsx`, `use-execution-events.test.ts`). AI 노드 오류 종결 대화의 렌더 도달성(Inv-8) 복구 PR.

## 발견사항

- **[WARNING]** `endReason` 화이트리스트가 파일 내 기존 패턴(`ReadonlySet` + guard test)을 따르지 않고 OR-체인으로 남아있음
  - 위치: `codebase/frontend/src/components/editor/run-results/output-shape.ts:159-166` (`looksLikeConversationEnd`)
  - 상세: 바로 위에 정의된 `MULTI_TURN_INTERACTION_TYPES`(L133 부근)는 `ReadonlySet<string>` 상수로 선언되고 `lib/__tests__/interaction-type-exhaustiveness.test.ts` 라는 AST guard 테스트로 drift(값 누락)를 기계적으로 차단한다. 반면 이번에 확장된 `endReason` 화이트리스트는 여전히 `=== "a" || === "b" || ...` 6항 체인이고 어떤 guard 도 없다. 이번 PR 자체가 바로 이 whitelist 의 `error`/`condition` 누락으로 발생한 회귀를 고치는 작업이므로, 같은 파일에 이미 존재하는 재발 방지 패턴을 재사용하지 않은 것은 아쉬운 지점 — 다음에 backend `ai-turn-executor.ts` 의 enum 이 값을 하나 더 추가하면 동일한 종류의 drift 가 조용히 재발할 수 있다.
  - 제안: `const CONVERSATION_END_REASONS: ReadonlySet<string> = new Set([...])` 로 추출하고 `CONVERSATION_END_REASONS.has(endReason)` 로 교체. 여유가 되면 `interaction-type-exhaustiveness.test.ts` 와 유사한 backend enum 대조 guard 테스트도 후속으로 검토.

- **[WARNING]** fixture 모듈 헤더 주석이 새로 추가된 시나리오 범위를 반영하지 않음(stale)
  - 위치: `codebase/frontend/src/components/editor/run-results/__tests__/fixtures/conversation-scenarios.ts:126-138` (파일 최상단 모듈 JSDoc)
  - 상세: "본 모듈은 §9.10 표의 **CT-S1 ~ CT-S7** 시나리오 입력을 단일 export 로 제공한다" 라고 스코프를 명시하는데, 이번 diff 로 `ctS15`~`ctS17` 이 같은 모듈에 추가되면서 이 문장이 더 이상 정확하지 않다. 프로젝트가 "PR review 단계에서 spec 표 갱신과 fixture 추가가 짝지어 들어왔는지 확인" 을 이 파일 자체의 관례로 명시하고 있는데, 그 관례를 정작 이 파일의 자기서술 갱신에는 적용하지 못한 상황.
  - 제안: 헤더를 "CT-S1 ~ CT-S7, CT-S15 ~ CT-S17" 또는 "§9.10 표의 각 CT-S\* 시나리오" 처럼 범위에 종속되지 않는 문구로 갱신.

- **[INFO]** 동일한 rationale 문장이 최소 6개 파일에 걸쳐 거의 그대로 반복
  - 위치: `output-shape.ts:153-158`, `result-detail.tsx:1046-1050`·`1100-1104`, `conversation-inspector.tsx:864-868`, `use-execution-events.ts:837-840`, `__tests__/fixtures/conversation-scenarios.ts:261-266`, `use-execution-events.test.ts:1994-1996` 등
  - 상세: "엔진은 실패 시에도 `nodeExec.outputData` 를 영속하고 … §7.9 … Inv-8" 문구가 표현만 조금씩 다른 채 프로덕션 코드 3곳 + 테스트/픽스처 2~3곳에서 반복된다. 프로젝트가 spec 참조 주석을 관례로 삼는 것은 확인되지만(동의), 이 정도로 상세한 근거 서술을 여러 파일에 복사하면 향후 이 규칙이 바뀔 때(예: engine 이 outputData 영속 방식을 바꾸면) 동기화해야 할 지점이 6곳으로 늘어난다. `result-detail.tsx` 안에서도 L1046-1050 과 L1100-1104 두 블록이 30여 줄 간격으로 같은 취지를 두 번 설명한다.
  - 제안: 상세 근거는 spec `conversation-thread.md §8.5`(이미 Rationale 절로 신설됨) 한 곳에 두고, 코드 쪽 주석은 "§9.9 Inv-8 — 근거는 conversation-thread.md §8.5" 정도의 1줄 포인터로 축약. 특히 `result-detail.tsx` 의 두 블록은 하나로 합치거나 두 번째를 짧게 줄여도 충분.

- **[INFO]** `isConversationHistory` 개명은 개선이나 여전히 완전히 정확한 이름은 아님
  - 위치: `codebase/frontend/src/components/editor/run-results/result-detail.tsx:1051`, `1099`
  - 상세: `isCompletedConversation`(→ `status === 'completed'` 요구)에서 `isConversationHistory`(→ `isConversationOutput(result.outputData)` 만으로 판정)로의 개명은 "completed 만 커버한다"는 오해를 없애는 유효한 개선이고, 코드베이스 전체에서 옛 이름의 잔존 참조도 없음을 확인했다(clean rename). 다만 이 플래그는 `hasLiveSystemError === true` 인 live 오류 종결 케이스에서도 true 로 평가되어, JSX 상 같은 분기(`isConversationHistory ? <ConversationInspector conversationMessages={effectiveConversationMessages} .../> : null`, L1099-1119)가 실제로는 live store 데이터(`conversationMessages`)를 렌더할 수도 있다. "History" 라는 이름이 "항상 `parseHistoryMessages` 결과를 보여준다"는 인상을 줄 수 있어, 정확히는 "outputData 가 대화 shape 을 가진 상태(정상/오류 종결 불문, live/이력 불문)" 를 뜻하는 이름 — 예: `hasEndedConversationOutput` — 이 더 오해 소지가 적다. blocking 사안은 아님.
  - 제안: 현재 이름 유지 시 정의부 주석(L1046-1050)에 "live 오류 종결 시에도 true — §9.3 우선순위는 별도 변수(`hasLiveSystemError`)로 처리" 한 줄만 추가해도 오해를 줄일 수 있음.

- **[INFO]** `handleNodeCompleted`/`handleNodeFailed` 의 "errorPayload 추출 + system_error APPEND" 블록 중복이 이번 diff 로 대칭화되며 더 뚜렷해짐
  - 위치: `codebase/frontend/src/lib/websocket/use-execution-events.ts:767-811`(`handleNodeCompleted` 내 `addNodeResult` + errorPayload 블록) vs `:860-903`(`handleNodeFailed` 의 동일 구조)
  - 상세: 두 핸들러는 `addNodeResult({...})` 호출 필드 구성과, 그 뒤에 이어지는 `extractNodeErrorPayload` → `isMultiTurnAiContext` 체크 → `retryable`/`retryAfterSec` 추출 → `addConversationMessage(makeSystemErrorItem({...}))` 흐름이 인자 하나(`extractNodeErrorPayload(payload.error, undefined)` vs `extractNodeErrorPayload(undefined, payload.output)`)만 다르고 15줄 가까이 동일하다. 이번 diff 자체는 이 중복을 새로 만든 것은 아니고(기존 구조), `outputData: payload.output ?? null` 로 두 핸들러의 필드 채우기 패턴까지 완전히 대칭시킨 결과 — 오히려 두 핸들러를 하나의 헬퍼로 합칠 여지가 더 뚜렷해졌다.
  - 제안: `appendSystemErrorIfMultiTurn(nodeType, nodeId, nodeLabel, nodeExecutionId, timestamp, errorSource)` 류의 공통 헬퍼로 추출해 두 핸들러 모두에서 호출. 이번 PR 범위에서 필수는 아니나 후속 정리 후보로 표시할 가치가 있음.

- **[INFO]** `SummaryView`/`ResultDetail` 은 이미 매우 큰 함수 — 이번 diff 가 그 위에 분기를 더함
  - 위치: `conversation-inspector.tsx:807-1333`(`SummaryView`, 약 526줄), `result-detail.tsx:878-1248`(`ResultDetail`, 약 370줄)
  - 상세: 두 함수 모두 이미 단일 책임을 크게 벗어난 God-function/God-component 상태다(기존부터 존재하는 구조적 문제, 이번 diff 가 만든 것은 아님). 이번 변경은 `hasLiveSystemError` 판정 로직·`effectiveConversationMessages` 소스 선택·`isConversationResult` 게이트 등 새 지역 변수 여러 개를 `ResultDetail` 본문에 그대로 추가했고, `SummaryView` 의 `items` useMemo 에도 조기 반환 분기를 하나 더 얹었다. 각 변경 자체는 작지만 누적되면서 함수당 지역 변수·분기 수가 계속 늘어나는 추세다.
  - 제안: 당장 리팩터링을 요구하는 수준은 아니나, `hasLiveSystemError` + `effectiveConversationMessages` 계산을 `useConversationPreviewSource(result, conversationMessages)` 같은 커스텀 훅으로 뽑아내면 `ResultDetail` 본문의 인지 부하를 줄이고 단위 테스트도 별도로 붙이기 쉬워진다. 후속 리팩터링 후보로 남겨둘 것을 권고.

- **[INFO]** `items` useMemo 의 새 조기 반환이 배열 길이를 "이미 파싱됨" 신호로 암묵 사용
  - 위치: `codebase/frontend/src/components/editor/run-results/conversation-inspector.tsx:862-871`
  - 상세: `if (conversationMessages.length > 0) return conversationMessages;` 는 "호출자가 이미 정규 변환을 거친 items 를 넘겼다"는 계약을 배열의 **비어있지 않음**으로 판별한다. 주석으로 의도는 설명돼 있으나, 타입 시그니처만 봐서는 "빈 배열 = 아직 파싱 안 됨" 이라는 암묵적 규칙이 드러나지 않는다. 현재 호출부(`result-detail.tsx`)는 항상 `historyMessages`/`conversationMessages` 중 하나를 정확히 계산해 넘기므로 실질적 위험은 낮지만, 향후 다른 호출자가 의도적으로 빈 대화(0개 메시지, 이미 파싱된 상태)를 넘기면 이 분기가 조용히 raw output 재파싱 폴백으로 빠진다.
  - 제안: 필수는 아니나, 이 함수가 향후 새 호출자를 얻을 가능성이 있다면 `conversationMessages` 자체와 별개로 "already parsed" 를 나타내는 명시적 플래그(props) 를 고려. 현재 범위에서는 주석이 있어 심각도는 낮음.

- **[INFO]** fixture 헬퍼의 boolean positional 인자
  - 위치: `codebase/frontend/src/components/editor/run-results/__tests__/fixtures/conversation-scenarios.ts:267`(`makeErroredConversationOutput(retryable: boolean)`) 및 호출부 L280·L303·L309(`makeErroredConversationOutput(true)` / `(false)`)
  - 상세: 단일 boolean 위치 인자로 두 변형을 만드는 전형적인 "boolean trap" 패턴 — 호출부만 보면 `true`/`false` 가 무엇을 뜻하는지 즉시 드러나지 않는다(파일 내 지역 함수라 영향 범위는 이 파일에 한정되어 실질 위험은 낮음).
  - 제안: `makeErroredConversationOutput({ retryable: true })` 형태의 객체 인자로 바꾸면 호출부 가독성이 개선됨. 우선순위는 낮음.

## 요약

이번 변경은 렌더 게이트를 `status` 기반에서 `outputData` 존재 기반으로 옮기는 핵심 로직 자체는 작고 명확하며(`isConversationHistory`, `hasLiveSystemError` 두 불리언과 그에 따른 소스 선택), 변수명 정리(`isCompletedConversation` → `isConversationHistory`)도 코드베이스 전체에서 깨끗하게 반영되어 잔존 참조가 없다. 다만 (1) 이번 버그의 근본 원인이었던 `endReason` 화이트리스트가 같은 파일에 이미 존재하는 `Set` + guard-test 패턴을 재사용하지 않고 여전히 OR-체인으로 남아있어 동일 유형의 drift 재발 가능성이 있고, (2) 배경에서 언급된 대로 spec 참조 주석 관례를 감안하더라도 동일 rationale 문장이 6개 안팎의 파일에 사실상 복사되어 있어 근거가 바뀔 때 동기화 부담이 크며, (3) fixture 헤더 주석이 새 시나리오 범위를 반영하지 못해 stale 상태다. `SummaryView`/`ResultDetail` 의 기존 God-function 경향에 소규모 분기가 계속 누적되는 점도 후속 리팩터링 필요성을 키우고 있다. 이들 모두 즉각적인 버그를 유발하지는 않으며 blocking 수준은 아니다.

## 위험도

LOW
