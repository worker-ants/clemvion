# 부작용(Side Effect) 리뷰 결과

## 발견사항

- **[INFO]** `apply-execution-snapshot.ts` 내부에서 `useExecutionStore.getState()` 를 두 번 중복 호출
  - 위치: `apply-execution-snapshot.ts` 라인 1155 — `if (useExecutionStore.getState().conversationMessages.length === 0)`
  - 상세: 함수 진입 시 `const store = useExecutionStore.getState()` 로 스토어를 이미 한 번 캡처했으나, ai_conversation 분기 내부에서 다시 `useExecutionStore.getState()` 를 직접 호출한다. 두 호출 사이에 비동기 작업은 없으므로 실질적인 race 는 없지만, 동일 함수 스코프 내에서 스토어를 두 가지 방법으로 접근하는 비일관성이 남는다. 기존 코드에서도 1021행·1102행에 같은 패턴이 반복되어 있어 이번 추가가 기존 관행을 따른 것임을 확인.
  - 제안: 단순 일관성 개선이 필요하다면 `const { conversationMessages } = useExecutionStore.getState()` 를 해당 분기 진입 시점에 한 번만 읽도록 리팩터링. 단, 현재 코드가 `pauseForConversation` 호출 이후 스토어 상태를 읽는 것이므로 (`pauseForConversation` 이 conversationMessages 를 변경하지 않는 한) 실제 버그는 아님.

- **[INFO]** `setConversationMessages` 를 구조 분해로 미리 캡처했으나 실제 호출 전 스토어 상태 확인은 재조회로 처리
  - 위치: `apply-execution-snapshot.ts` 라인 974, 1155–1160
  - 상세: `setConversationMessages` 는 함수 선언부(라인 974)에서 구조 분해 캡처하고, 실제 조건 체크는 라인 1155 에서 `useExecutionStore.getState()` 를 다시 호출하는 이중 접근 패턴이다. 이는 `pauseForConversation(waitingNode.nodeId, convConfig ?? null)` 호출(라인 1149)이 내부적으로 스토어를 변경할 수 있기 때문에 최신 상태를 읽으려는 의도로 이해되며, 올바른 방어적 패턴이다.
  - 제안: 의도를 주석으로 명시하면 코드 가독성이 향상됨. 예: `// pauseForConversation 이후 최신 스토어 상태를 읽어야 하므로 재조회`.

- **[INFO]** `beforeEach` 에 `conversationMessages: []` 와 `selectedConversationItemIndex: null` 두 필드가 추가됨
  - 위치: `apply-execution-snapshot.test.ts` 라인 61–62
  - 상세: 테스트 픽스처의 `beforeEach` 에 신규 store 필드 두 개가 추가되었다. 이는 테스트 격리를 강화하는 올바른 변경이며 부작용이 아니다. 단, 이 두 필드가 실제 `useExecutionStore` 의 초기 상태(resetStore 함수)와 동기화되어 있는지 확인이 필요하다. 테스트 픽스처와 실제 스토어 초기값이 다르면 누락된 필드에 의해 테스트가 이전 테스트의 상태를 오염시킬 수 있다.
  - 제안: 스토어의 `resetStore` 혹은 initialState 를 직접 import 해 `beforeEach` 에서 사용하는 패턴을 검토. 이 방법이면 스토어에 필드가 추가될 때 테스트 픽스처를 별도로 갱신하지 않아도 됨.

- **[INFO]** `useExecutionStore.setState` 직접 호출을 통한 공유 스토어 상태 수동 주입 (테스트 코드)
  - 위치: `apply-execution-snapshot.test.ts` 라인 129–133, 237–239
  - 상세: 일부 테스트가 `useExecutionStore.setState(...)` 로 스토어에 부분 상태를 직접 주입한다. Zustand 의 `setState` 는 기본적으로 shallow merge 이므로 `beforeEach` 에서 리셋한 나머지 필드는 유지된다. 이것 자체는 의도된 패턴이지만, 향후 스토어에 새로운 필드가 추가될 경우 이 부분 주입 테스트들이 예상치 못한 초기 상태에서 실행될 수 있다.
  - 제안: 부분 주입 후 해당 테스트가 의존하는 필드 외의 상태에 대해서는 단언(assert) 하지 않도록 범위를 명시적으로 좁히거나, 주입 전 `beforeEach` 가 완전한 초기화를 보장함을 주석으로 명시.

- **[INFO]** `pauseForConversation` 이 호출된 뒤에도 `waitingNodeId` 와 `waitingInteractionType` 가 `currentWaiting` 체크로 early return 되지 않는 경로에서 추가 상태를 변경
  - 위치: `apply-execution-snapshot.ts` 라인 1106, 1149, 1155–1160
  - 상세: 라인 1106 에서 `currentWaiting && currentWaiting === waitingNode?.nodeId` 이면 early return 한다. 그러나 `currentWaiting` 이 있지만 다른 nodeId 인 경우 `pauseForConversation` → `setConversationMessages` 순으로 두 개의 store 뮤테이션이 연속 발생한다. 두 호출이 분리되어 있어 첫 번째 뮤테이션 후 컴포넌트가 re-render 하면 두 번째 뮤테이션 전 불완전한 상태를 읽을 수 있다(conversationMessages 비어있는데 waitingInteractionType 만 ai_conversation 인 순간). Zustand 의 동기 setState 특성상 React concurrent mode 가 아니면 실제 문제는 드물지만, `unstable_batchedUpdates` 또는 단일 `setState` 호출로 묶는 방어가 더 견고하다.
  - 제안: `pauseForConversation` 과 `setConversationMessages` 를 단일 스토어 트랜잭션으로 묶거나, `setConversationMessages` 가 내부적으로 조건을 처리하도록 스토어 액션을 확장하는 방안 검토.

## 요약

이번 변경은 `apply-execution-snapshot.ts` 의 `ai_conversation` 분기에 `setConversationMessages` 호출을 추가하여 REST 스냅샷 경로에서도 WS 이벤트 경로와 동등한 hydration 을 보장하는 버그 수정이다. 공개 함수 시그니처(`applyExecutionSnapshot`)는 변경되지 않았고, 새 전역 변수나 파일시스템·환경 변수·네트워크 호출도 없다. `setConversationMessages` 를 store 구조 분해에 추가(`+setConversationMessages`)한 것은 기존 store 액션을 호출하는 것이므로 새로운 부작용이 아니다. 주목할 점은 `pauseForConversation` 과 `setConversationMessages` 두 store 뮤테이션이 분리 호출되어 React 렌더 사이클에서 중간 상태가 노출될 수 있는 이론적 경합이다. 그러나 Zustand 의 동기 setState 특성과 현재 사용 컨텍스트(SSR 미사용, strict concurrent mode 미적용) 를 감안하면 실질적 위험은 낮다. 전반적으로 변경 범위가 명확하고 테스트가 의도한 부작용 방지(덮어쓰기 방지, 빈 messages no-op)를 검증하고 있어 부작용 위험은 낮다.

## 위험도

LOW
