## 유지보수성 코드 리뷰

### 발견사항

---

**[WARNING] `NodeResultsTab` 컴포넌트의 과도한 책임 집중**
- 위치: `page.tsx` — `NodeResultsTab` 함수 (약 200줄)
- 상세: 단일 컴포넌트가 대기 상태 선택 로직, WebSocket 명령 발행, 인터랙션 타입 분기, 노드 목록 렌더링, 상세 패널 렌더링을 모두 담당합니다. `run-results-drawer.tsx`의 `RunResultsDrawer`와 거의 동일한 책임 구조를 갖지만 독립적으로 구현되어 있어 향후 유사 기능 수정 시 두 곳을 함께 수정해야 합니다.
- 제안: `NodeResultsTab`에서 대기 인터랙션 처리 로직(핸들러 + 분기 렌더링)을 별도 컴포넌트(`WaitingInteractionPanel` 등)로 분리하거나, `ResultDetail` 컴포넌트를 재사용하는 방향으로 리팩토링하세요.

---

**[WARNING] `waitingButtonConfig` 타입 캐스팅이 두 곳에서 중복**
- 위치: `page.tsx` L531~L560, `result-detail.tsx` L408~L435
- 상세: `(waitingButtonConfig as Record<string, unknown>).buttons`를 배열 타입으로 캐스팅하는 동일한 코드 블록이 `page.tsx`와 `result-detail.tsx` 두 곳에 복사되어 있습니다. 버튼 스키마 변경 시 두 곳을 모두 수정해야 합니다.
- 제안: `ButtonConfig` 타입 인터페이스를 execution-store 또는 별도 타입 파일에 정의하고 두 컴포넌트가 공유하도록 변경하세요.

---

**[WARNING] 렌더 중 직접 setState 호출 패턴**
- 위치: `page.tsx` L360~L364
- 상세: 렌더 함수 본문에서 `setLastAutoSelectedWaiting`, `setSelectedNodeId`, `setNodeDetailTab`을 직접 호출합니다. 이는 React의 일반적인 패턴(derived state)이라고 주석에 명시되어 있지만, 조건이 없으면 무한 렌더 루프를 유발할 수 있고, 코드를 읽는 사람이 useEffect와 혼동하기 쉽습니다. `run-results-drawer.tsx`에서는 store 액션이 원자적으로 선택을 처리하는 반면, 여기서는 별도 state를 추적하는 방식으로 구현 방식이 불일치합니다.
- 제안: `lastAutoSelectedWaiting` state를 제거하고 `useEffect`를 사용하거나, `waitingNodeId`를 직접 비교해 파생 값으로 처리하세요. `run-results-drawer.tsx`처럼 store 액션에서 선택 처리를 수행하는 방식을 고려하세요.

---

**[WARNING] `useExecutionStore` 셀렉터가 9개 별도 구독으로 분산**
- 위치: `page.tsx` L325~L358
- 상세: `waitingNodeId`, `waitingInteractionType`, `waitingFormConfig`, `waitingButtonConfig`, `waitingConversationConfig`, `conversationMessages`, `isWaitingAiResponse`, `resumeFromForm`, `resumeFromButtons`, `resumeFromConversation` — 10개의 store 값이 각각 별도 셀렉터 호출로 구독됩니다. `run-results-drawer.tsx`도 동일한 패턴을 사용하고 있어 보일러플레이트가 과도합니다.
- 제안: 관련 대기 상태를 묶는 셀렉터(`selectWaitingState`)를 store에 추가하거나 `useShallow`를 사용해 단일 호출로 합치세요.

---

**[INFO] `execution-detail-waiting.test.tsx`에서 mock 순서 의존성**
- 위치: `execution-detail-waiting.test.tsx` L34~L38 (import 전 vi.mock 호출)
- 상세: `vi.mock`이 실제 `import` 구문보다 위에 선언되어 있고, import는 mock 정의 이후에 위치합니다. vitest의 호이스팅으로 동작하지만, 코드를 읽는 사람이 실행 순서를 오해할 수 있습니다. `run-results/__tests__/result-detail.test.tsx`는 파일 상단에 import를 배치하는 일반적인 구조를 따릅니다.
- 제안: 다른 테스트 파일과 동일하게 import를 파일 상단에 배치하고, mock은 그 아래에 선언하는 컨벤션을 유지하세요.

---

**[INFO] `__continue__` 매직 문자열**
- 위치: `use-execution-interaction-commands.ts` L46, `page.tsx` 관련 경로
- 상세: `"__continue__"` 문자열이 하드코딩되어 있습니다. 현재는 한 곳에서만 사용되지만 백엔드 이벤트 이름 변경 시 추적이 어렵습니다.
- 제안: `const CONTINUE_BUTTON_ID = "__continue__"` 상수로 추출하세요.

---

**[INFO] `page.tsx`의 `executionQuery` refetchInterval 조건에 `"waiting_for_input"` 상태 누락**
- 위치: `page.tsx` L100~L105
- 상세: `"completed"`, `"failed"`, `"cancelled"` 상태에서만 폴링을 중단하며 `"waiting_for_input"`은 계속 폴링됩니다. 이는 의도된 동작이지만, 주석이 없어 의도인지 누락인지 불명확합니다.
- 제안: 인라인 주석으로 `waiting_for_input` 상태에서도 폴링이 필요한 이유를 명시하세요.

---

### 요약

이번 변경은 `useExecutionInteractionCommands` 훅으로 WebSocket 명령을 캡슐화해 `result-detail.tsx`와 `run-results-drawer.tsx`의 중복을 줄이고, 실행 상세 페이지에 대기 인터랙션 UI를 통합한 점에서 구조적으로 긍정적입니다. 다만, `NodeResultsTab` 컴포넌트가 `RunResultsDrawer`와 유사한 책임을 독립적으로 구현하면서 두 곳에 동일한 타입 캐스팅 코드가 복제되었고, 대기 상태 셀렉터 보일러플레이트가 누적되는 문제가 발생했습니다. 렌더 중 setState 패턴과 기존 store 기반 자동 선택 패턴 간의 불일치도 향후 디버깅 시 혼란을 줄 수 있습니다. 핵심 기능 동작에는 문제가 없지만, `ButtonConfig` 타입 공유와 `NodeResultsTab` 책임 분리를 통해 중기적인 유지보수 비용을 줄이는 것을 권장합니다.

### 위험도
**LOW**