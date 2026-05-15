### 발견사항

- **[WARNING]** `run-results-drawer.tsx`: UI가 탭 기반에서 채팅/히스토리 스타일로 전면 재설계됨
  - 위치: 전체 파일 (500줄 순증가)
  - 상세: Form 노드 인터랙션 지원은 `DynamicFormUI`와 `HistoryEntry`의 form 분기만으로 충분함. 그러나 `TableContent`, `CarouselContent`, `ChartContent`, `TemplateContent`, `PdfContent` 렌더러 재구현, `NodeTypeIcon` 신규 컴포넌트, 탭→히스토리 구조 전환, 자동 스크롤 등은 Form 기능 범위를 초과하는 UI 전체 리팩토링임
  - 제안: Form 노드 대기 상태 표시에 필요한 최소한의 변경(Form 입력 UI 추가, `waiting_for_input` 상태 표시)으로 분리하고, 나머지 UI 개선은 별도 작업으로 진행

- **[WARNING]** `use-execution-events.ts`: `handleNodeCompleted` + `PRESENTATION_TYPES` 로직 추가가 Form 기능이 아닌 UI 리팩토링에 종속됨
  - 위치: `handleNodeCompleted` 함수, polling 내 `addNodeResult` 호출 블록
  - 상세: `addNodeResult` 호출과 `PRESENTATION_TYPES` 집합은 새 채팅 UI가 히스토리를 수집해야 하기 때문에 추가된 것으로, Form 노드 차단 실행 기능 자체에는 불필요함. Form 기능만 구현한다면 `handleWaitingForInput`과 polling의 `waiting_for_input` 분기만 필요
  - 제안: UI 리팩토링과 Form 기능을 커밋 단위로 분리

- **[INFO]** `execution-store.ts`: `addNodeResult`의 중복 방지 로직이 범위 외 버그픽스
  - 위치: `addNodeResult` 함수
  - 상세: 기존에는 단순 append였으나 동일 `nodeId`를 upsert 처리로 변경. 기능 개선이나 Form 인터랙션과 직접적 연관 없음
  - 제안: 동작상 문제가 없으므로 유지 가능하나, 범위 외 변경임을 인식할 것

- **[INFO]** `use-execution-events.ts`: 기능 설명 주석 2개 삭제
  - 위치: `cancelled` 상태 처리 주석, 폴링 시작 설명 주석
  - 상세: `// Note: "cancelled" maps to "failed"...` 및 `// First poll runs right away...` 주석이 이유 없이 제거됨. 이 주석들은 비직관적 동작을 설명하는 유용한 내용이었음
  - 제안: 삭제된 주석 중 `cancelled → failed` 설명은 복원 권장

---

### 요약

변경의 핵심 목적인 **Form 노드 차단 실행 + 사용자 입력 대기** 기능(백엔드 `pendingContinuations` 패턴, WS `execution.submit_form` 핸들러, 스토어 `waiting_for_input` 상태, 훅의 `handleWaitingForInput`)은 범위에 부합한다. 그러나 `run-results-drawer.tsx`에서 탭→히스토리 전면 재설계와 5개의 새 프레젠테이션 렌더러 추가, 그리고 이를 지원하기 위한 `use-execution-events.ts`의 `PRESENTATION_TYPES` 수집 로직은 Form 기능 요청 범위를 실질적으로 초과하는 UI 리팩토링이다. 기능적 결함은 아니지만, 의도된 작업 이상의 변경이 함께 포함되어 리뷰 및 롤백 복잡도를 높인다.

### 위험도
**LOW**