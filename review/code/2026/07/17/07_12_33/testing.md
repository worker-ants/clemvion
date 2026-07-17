# 테스트(Testing) 리뷰

대상 커밋: `aee4f75e9` (fix(run-results): AI 대화 노드 오류 종결 시 대화 이력 도달성 복구, Inv-8)

커밋 메시지가 명시하는 4개 결함(R1~R4)을 기준으로 대응 테스트를 개별 확인했다.

| # | 결함 | 소재 파일 | 직접 테스트 |
|---|---|---|---|
| R1 | `node.failed` 가 backend `output` 을 버리고 `outputData: null` 하드코딩 | `use-execution-events.ts` | 있음 (CT-S15, `use-execution-events.test.ts`) |
| R2 | 렌더 게이트가 `status === 'completed'` 요구 | `result-detail.tsx` | 있음 (CT-S15/16/17, `result-detail.test.tsx`) |
| R3 | `isConversationOutput` endReason 화이트리스트에 `'condition'`/`'error'` 누락 | `output-shape.ts` | **부분적 — 갭 있음** (아래 발견사항 1) |
| R4 | `ConversationInspector` `isLive=false` 시 4번째 인라인 재파싱 경로가 전달받은 items 를 버림 | `conversation-inspector.tsx` | **간접만 — 격리 단위 테스트 없음** (아래 발견사항 2) |

## 발견사항

- **[WARNING]** R3(`endReason` 화이트리스트 확장)의 회귀 테스트가 갱신되지 않았고, 신규 값 `'condition'` 은 어디에서도 실행되지 않는다.
  - 위치: `codebase/frontend/src/components/editor/run-results/__tests__/output-shape.test.ts:574-590` (테스트 미변경) / `codebase/frontend/src/components/editor/run-results/output-shape.ts:651-659` (변경분)
  - 상세: `output-shape.ts` 는 이번 커밋에서 `looksLikeConversationEnd` 판정에 `endReason === "condition"` 과 `endReason === "error"` 두 값을 새로 추가했다. 그런데 같은 파일을 위한 기존 단위 테스트 `it("accepts every unified endReason as a conversation terminal", ...)` 는 `const endReasons = ["completed", "user_ended", "max_turns", "max_retries"] as const;` 로 여전히 옛 4개 값만 열거하며, 이번 diff 에서 이 테스트 파일은 전혀 손대지 않았다(`git show --stat aee4f75e9` 확인, `output-shape.test.ts` 미포함). 테스트 이름이 "every unified endReason" 을 자처하는데 실제로는 소스의 화이트리스트와 어긋난 채 통과하는 **거짓 exhaustive 테스트**가 됐다.
  - `'error'` 값은 `conversation-scenarios.ts` 의 `makeErroredConversationOutput()` 이 항상 `endReason: "error"` 로 고정하고 있어 `result-detail.test.tsx` 의 CT-S15/16/17 을 통해 **간접적으로만** 회귀 차단된다(이 값이 화이트리스트에서 빠지면 세 테스트 모두 "미리보기" 탭 자체가 사라져 실패한다 — 직접 확인함). 반면 `'condition'` 값은 diff 전체에서 어떤 fixture 도 사용하지 않아 **완전 무테스트** 상태다 — R3 가 되돌려지거나 실수로 `'condition'` 만 다시 제거돼도 어떤 테스트도 잡지 못한다.
  - plan (`plan/in-progress/ai-node-failed-conversation-preview.md` Phase 3) 의 테스트 목록에도 R3 전용 항목이 없어(R1 회귀·CT-S15/16/17·기존 http_request 회귀·fixture 추가만 명시) 구조적으로 누락된 것으로 보인다.
  - 제안: `output-shape.test.ts:575` 의 `endReasons` 배열에 `"condition"`, `"error"` 를 추가(순수 함수 대상 테스트라 비용이 거의 없다). 필요하면 `it.each` 로 분리해 실패 시 어떤 값이 깨졌는지 바로 드러나게 한다.

- **[WARNING]** R4(`ConversationInspector` SummaryView 의 4번째 재파싱 경로 차단)를 검증하는 격리 단위 테스트가 없다 — `result-detail.test.tsx` 를 통한 간접 커버리지만 존재한다.
  - 위치: `codebase/frontend/src/components/editor/run-results/conversation-inspector.tsx:617-622` (변경분) / `codebase/frontend/src/components/editor/run-results/__tests__/conversation-inspector.test.tsx` (미변경)
  - 상세: 변경분은 `SummaryView` 의 `items` 계산에서 `isLive=false` 이고 호출자가 넘긴 `conversationMessages.length > 0` 이면 그대로 신뢰하고, 예전처럼 `output.messages` 를 무조건 재파싱하지 않도록 early return 을 추가했다. 이 브랜치를 직접 겨냥하는 테스트는 `conversation-inspector.test.tsx` 에 없다 — 해당 파일은 이번 diff 에서 전혀 수정되지 않았고, 유일하게 `isLive={false}` 를 쓰는 기존 테스트(L405 "History 모드... Critical fix 회귀 방지")는 `conversationMessages={[]}` (빈 배열)를 넘겨 새 브랜치 조건(`length > 0`)을 트리거하지 않는다 — 여전히 옛 재파싱 경로만 검증한다.
  - 실제로는 `result-detail.test.tsx` 의 CT-S15/16/17 이 `ResultDetail → ConversationInspector → SummaryView` 전체 렌더 체인을 통해 이 브랜치를 간접 실행한다(직접 확인: CT-S16 은 `parseHistoryMessages` 가 합성한 `system_error`("Invalid API key.")를 포함한 `effectiveConversationMessages` 를 `ConversationInspector` 에 넘기는데, R4 가 없으면 SummaryView 가 이를 버리고 raw `output.result.messages` (3개 메시지, 에러 텍스트 없음)를 재파싱하므로 `screen.getByText(/Invalid API key/)` 단언이 실패한다). 즉 기능적으로는 안전망이 있으나, `conversation-inspector.tsx` 만 단독으로 리팩터링하는 후속 PR(회귀와 무관한 변경)이 이 브랜치를 깨도 실패 신호가 3계층 위의 무거운 통합 테스트에서 "메시지 텍스트가 안 보인다" 는 형태로만 나타나, 원인 국소화가 느리다.
  - 제안: `conversation-inspector.test.tsx` 에 `isLive={false}` + 비어있지 않은 `conversationMessages`(예: `result.outputData` 의 raw messages 로는 재현 불가능한 `system_error` 항목 포함)를 넘겨, 전달받은 items 가 그대로 렌더되고 재파싱되지 않음을 직접 단언하는 테스트를 추가.

- **[INFO]** CT-S16 fixture 의 `result.error` 문자열이 실제 `outputData.output.error.message` 와 불일치한다 — 테스트 결과에는 무해하지만 데이터 사실성이 떨어진다.
  - 위치: `codebase/frontend/src/components/editor/run-results/__tests__/result-detail.test.tsx:515-522` (`makeFailedAgent`)
  - 상세: `makeFailedAgent(outputData)` 는 세 시나리오(CT-S15/16/17) 모두에 `error: "Request timed out."` 을 고정 사용한다. 그런데 CT-S16 의 `outputData`(`makeErroredConversationOutput(false)`)는 `output.error.message: "Invalid API key."` 를 담고 있다 — 실제 backend 라면 `NodeResult.error` 와 `outputData.output.error.message` 는 같은 오류에서 파생되므로 항상 일치해야 한다. 현재 테스트는 인라인 `system_error`(outputData 파생)만 단언하므로 통과에는 지장 없지만, 향후 `result.error` 를 Preview 영역 어딘가에 직접 노출하는 코드가 추가되면 이 불일치가 조용히 통과해버릴 수 있다.
  - 제안: `makeFailedAgent` 에 두 번째 인자로 에러 메시지를 받거나, fixture 의 `outputData.output.error.message` 에서 파생시켜 `result.error` 를 채운다.

- **[INFO]** `hasLiveSystemError` 의 노드 불일치(교차 노드) 케이스가 테스트되지 않는다.
  - 위치: `codebase/frontend/src/components/editor/run-results/result-detail.tsx:1075-1080`
  - 상세: `hasLiveSystemError = conversationMessages.some(m => m.type === "system_error" && m.systemError?.nodeId === result.nodeId)` 는 store 가 비어있는지 여부가 아니라 **해당 노드 자신의** `system_error` 를 보유하는지로 live/history 소스를 가른다. CT-S15/17 은 각각 "정확히 매칭"(nodeId `"n1"`)과 "완전히 빈 배열" 두 극단만 다루고, "store 에 다른 노드의 `system_error` 만 있는" 중간 케이스(교차 노드 비필터링 정책이 live 우선 선택 로직에는 영향을 주지 않아야 함)는 다루지 않는다. plan 문서가 교차 노드 필터링 논쟁을 명시적으로 범위 밖으로 뒀으므로 CRITICAL 은 아니지만, `hasLiveSystemError` 자체는 이번 diff 의 신규 로직이라 경계값 하나를 추가해두면 안전하다.
  - 제안: `conversationMessages` 에 다른 `nodeId` 의 `system_error` 만 있는 케이스를 추가해 `hasLiveSystemError === false` → history 폴백을 확인.

- **[INFO, 확인용 — 문제 아님]** CT-S16 이 "기본 탭 = 미리보기" 를 명시적 탭 상태(`aria-selected` 등) 대신 메시지 텍스트 가시성(`screen.getByText("주문 상태 확인")`)으로 간접 검증하는 방식은 유효하다.
  - 위치: `codebase/frontend/src/components/editor/run-results/result-detail.tsx:326-333` (`{effectiveActiveTab === "preview" && (...)}`)
  - 상세: 탭 콘텐츠는 `effectiveActiveTab === <id>` 조건부로 **마운트 자체가 되지 않는** 구조(CSS `hidden` 이 아님)이므로, 초기 렌더에서 대화 내용이 DOM 에 존재한다는 것은 곧 기본 탭이 Preview 로 선택됐음을 뜻한다. 오배정 탭(예: Error)이 기본이면 해당 텍스트는 애초에 렌더되지 않아 테스트가 정확히 실패한다 — false positive 우려 없음. 별도 수정 불필요, orchestrator 지시에 따라 명시적으로 확인해 기록한다.

## 요약

R1(`use-execution-events.ts` payload 보존)과 R2(`result-detail.tsx` 렌더 게이트)는 각각 전용 테스트(CT-S15 in `use-execution-events.test.ts`, CT-S15/16/17 in `result-detail.test.tsx`)로 잘 뒷받침되며, 특히 CT-S16 은 orchestrator 가 요청한 "본 수정의 실제 델타"(non-retryable 오류 종결의 기본 탭 = 미리보기)를 정확한 fixture(`ctS16NonRetryableFailedConversation`, `retryable: false`)로 겨냥하고, 탭 콘텐츠의 조건부 마운트 구조 덕분에 텍스트 가시성 단언만으로도 탭 선택을 안전하게 검증한다. 반면 R3(`endReason` 화이트리스트에 `'condition'`/`'error'` 추가)와 R4(`ConversationInspector` 4번째 재파싱 경로 차단)는 orchestrator 예상대로 직접 테스트가 없다 — R3 는 기존 "every unified endReason" 단위 테스트가 갱신되지 않아 `'condition'` 값이 완전 무테스트이고 `'error'` 값도 무거운 통합 테스트를 통한 간접 커버리지뿐이며, R4 도 `conversation-inspector.test.tsx` 자체에는 새 브랜치를 겨냥한 테스트가 없이 `result-detail.test.tsx` 를 경유한 간접 검증만 존재한다. 두 갭 모두 소스 수정 자체는 올바르지만, 향후 해당 파일 단독 리팩터링 시 실패 신호가 늦게·불명확하게 나타날 위험이 있다. 픽스처는 `conversation-scenarios.ts` 단일 export 규약을 준수하고, 테스트 코드 자체의 한국어 주석·spec 역참조 밀도는 높은 편이다.

## 위험도

MEDIUM
