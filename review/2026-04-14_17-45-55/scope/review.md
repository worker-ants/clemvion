### 발견사항

- **[INFO]** `package-lock.json`에 `@emnapi/core`, `@emnapi/runtime` 패키지가 신규 추가됨
  - 위치: `node_modules/@emnapi/core`, `node_modules/@emnapi/runtime`
  - 상세: 이 두 패키지는 기존 `@emnapi/wasi-threads`의 optional peer 의존성으로, 일부 다른 패키지 업데이트 과정에서 lock 파일에 등록된 것으로 보임. 의도한 패키지 변경인지 lock 파일 재생성 부산물인지 불분명함.
  - 제안: `npm install`을 의도적으로 실행했다면 무시. 그렇지 않다면 `package.json`에 실제 변경사항이 없는데 lock 파일이 수정된 이유를 확인할 것.

- **[WARNING]** `NodeResultsTab` 컴포넌트에서 렌더 중 직접 `setState` 호출 패턴 사용
  - 위치: `page.tsx:352-357`
  - 상세: 주석에서 "Derived-state pattern (not an effect)"이라고 설명하고 있으나, 렌더 함수 내에서 `setLastAutoSelectedWaiting`, `setSelectedNodeId`, `setNodeDetailTab`를 직접 호출하는 것은 React 공식 문서에서 권장하지 않는 패턴임. 무한 렌더링 가능성이 있으며 `lastAutoSelectedWaiting !== waitingNodeId` 조건이 방어하고 있지만, concurrent mode에서 예기치 않은 동작을 유발할 수 있음.
  - 제안: `useEffect`를 사용하는 표준 패턴으로 변경. `useEffect(() => { if (waitingNodeId && ...) { ... } }, [waitingNodeId])`

- **[INFO]** `run-results-drawer.tsx`에서 `addConversationMessage`, `setWaitingAiResponse` 구독 제거
  - 위치: `run-results-drawer.tsx:118-124`, `200-214`
  - 상세: 이 로직이 새 `useExecutionInteractionCommands` 훅으로 이동됨. 범위 내의 정합성 있는 변경.
  - 제안: 없음.

- **[INFO]** `result-detail.tsx`의 `onSendMessage` prop 제거가 인터페이스 파괴적 변경(breaking change)
  - 위치: `result-detail.tsx:244`, `result-detail.test.tsx:47`
  - 상세: `ResultDetailProps`에서 `onSendMessage`가 제거되고 내부적으로 `useExecutionInteractionCommands`로 처리됨. 테스트와 호출부(`run-results-drawer.tsx`)가 동시에 수정되어 일관성 유지.
  - 제안: 없음.

- **[INFO]** `execution-detail-waiting.test.tsx`에서 `useExecutionInteractionCommands`를 직접 모킹하지 않고 `ws-client`만 모킹
  - 위치: `execution-detail-waiting.test.tsx:36-39`
  - 상세: 훅 내부 구현에 의존하는 통합 테스트 방식. `ws-client` 변경 시 테스트도 영향받을 수 있으나, 실제 동작 검증이 가능한 장점이 있음.
  - 제안: 현재 접근 방식 유지 가능. 필요 시 훅 자체를 모킹하는 단위 테스트와 병행 가능.

---

### 요약

이번 변경의 핵심 목적은 **WebSocket 인터랙션 커맨드를 `useExecutionInteractionCommands` 훅으로 추출**하고, 이를 `result-detail.tsx`와 신규 실행 상세 페이지(`page.tsx`) 양쪽에서 재사용하는 것입니다. 모든 파일 변경이 이 목적에 정합하게 연결되어 있으며 범위를 크게 벗어난 불필요한 리팩토링은 없습니다. 단, `NodeResultsTab` 내 렌더 중 `setState` 직접 호출은 React 베스트 프랙티스에서 벗어나는 구현이므로 경미한 위험이 존재하며, `package-lock.json`에 의도 여부가 불분명한 신규 패키지가 포함된 점은 확인이 필요합니다.

### 위험도

**LOW**