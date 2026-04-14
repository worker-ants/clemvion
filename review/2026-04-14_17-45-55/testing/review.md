### 발견사항

---

**[WARNING]** `execution-detail-waiting.test.tsx`의 `useExecutionInteractionCommands` 모킹 누락
- 위치: `execution-detail-waiting.test.tsx` 전체
- 상세: `ExecutionDetailPage`는 내부적으로 `useExecutionInteractionCommands`를 호출하는데, 이 훅은 `ws-client`를 통해 `getWsClient()`를 호출합니다. 테스트에서 `ws-client`는 모킹했지만 훅 자체는 모킹하지 않아 실제 훅 구현이 실행됩니다. 현재는 `ws-client` 모킹이 체이닝되어 동작하지만, 훅이 변경되면 테스트가 암묵적으로 깨질 수 있습니다.
- 제안: `vi.mock("@/lib/websocket/use-execution-interaction-commands", ...)` 추가하거나, 현재 간접 모킹 방식이 의도적임을 주석으로 명시

---

**[WARNING]** `NodeResultsTab`의 렌더링 중 상태 업데이트 패턴 테스트 부재
- 위치: `page.tsx:352-358` (derived-state 패턴)
- 상세: 렌더링 중 `setLastAutoSelectedWaiting`, `setSelectedNodeId`, `setNodeDetailTab`를 직접 호출하는 비표준 패턴은 React의 Strict Mode에서 이중 렌더링 및 무한 루프를 유발할 수 있습니다. `execution-detail-waiting.test.tsx`는 이 자동 선택 흐름을 테스트하지만, **동일 `waitingNodeId`로 재렌더 시 상태가 변경되지 않는지** (불필요한 재선택 방지 로직)를 검증하는 테스트가 없습니다.
- 제안: 다음 케이스 추가
```ts
it("does not re-auto-select when waitingNodeId is unchanged on re-render", ...)
```

---

**[WARNING]** `result-detail.test.tsx`에서 `onSendMessage` prop 제거에 따른 회귀 검증 부재
- 위치: `result-detail.test.tsx:47` (prop 제거)
- 상세: `onSendMessage`가 `ResultDetailProps`에서 제거되었고 내부적으로 `useExecutionInteractionCommands`가 직접 처리하게 변경되었습니다. 그러나 `result-detail.test.tsx`에는 **대화 메시지 전송 시나리오 테스트가 전혀 없습니다**. 변경 전엔 `onSendMessage` prop 테스트로 커버되었을 코드 경로가 현재는 아무 테스트도 없습니다.
- 제안: 다음 테스트 추가
```ts
it("emits submit_message via ws when conversation message is sent", ...)
```

---

**[WARNING]** `use-execution-interaction-commands.test.ts`에서 `sendMessage` turnIndex 계산 검증 미흡
- 위치: `use-execution-interaction-commands.test.ts:53-68`
- 상세: `sendMessage` 테스트에서 `turnIndex: 1` (빈 메시지 배열 기준)만 확인합니다. 이미 user 메시지가 존재할 때 `turnIndex`가 올바르게 증가(2, 3...)하는지 검증하는 케이스가 없습니다.
- 제안:
```ts
it("sendMessage increments turnIndex for subsequent user messages", () => {
  // sendMessage twice and verify second has turnIndex: 2
})
```

---

**[INFO]** `execution-detail-waiting.test.tsx`에서 대화 종료(`endConversation`) 케이스 미포함
- 위치: `execution-detail-waiting.test.tsx` - ai_conversation 테스트 블록
- 상세: `submit_message` 전송은 테스트되지만, "End Conversation" 버튼 클릭 시 `execution.end_conversation` 이벤트가 발생하는지 검증하는 테스트가 없습니다.
- 제안:
```ts
it("emits end_conversation when end conversation button is clicked", ...)
```

---

**[INFO]** `executionQuery`의 `refetchInterval` 로직 테스트 부재
- 위치: `page.tsx:100-107`
- 상세: `status`가 `completed`/`failed`/`cancelled`일 때 polling이 중단되는 로직은 핵심 동작이지만 테스트되지 않습니다.
- 제안: `status` 별로 `refetchInterval` 반환값을 검증하는 단위 테스트 추가 (함수를 별도로 추출하면 테스트 용이성 향상)

---

**[INFO]** store `reset()` 호출 후 `useExecutionEvents` 재구독 순서 검증 없음
- 위치: `page.tsx:79-84`
- 상세: `executionId`가 바뀔 때 `reset()` → `useExecutionEvents()` 순서로 동작해야 이전 waiting 상태가 새 실행에 오염되지 않는데, 이 실행 순서를 검증하는 테스트가 없습니다.
- 제안: `execution-detail-waiting.test.tsx`에 다른 `executionId`로 재렌더 시나리오 추가

---

### 요약

전반적으로 `useExecutionInteractionCommands` 훅 자체에 대한 단위 테스트(`use-execution-interaction-commands.test.ts`)가 충실하게 작성되어 있고, `execution-detail-waiting.test.tsx`도 3가지 상호작용 유형(form/buttons/conversation)의 핵심 흐름을 통합 테스트로 커버하고 있습니다. 그러나 `ResultDetail`에서 `onSendMessage` prop이 제거되면서 해당 코드 경로의 테스트 커버리지가 공백으로 남은 점, 렌더링 중 상태 업데이트를 사용하는 비표준 패턴에 대한 경계 케이스 검증 부재, `sendMessage`의 `turnIndex` 누적 계산 검증 미흡이 주요 개선 사항입니다. `endConversation` 통합 테스트와 `refetchInterval` 단위 테스트 추가도 권장됩니다.

### 위험도

**MEDIUM**