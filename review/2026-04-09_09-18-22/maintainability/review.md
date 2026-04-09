### 발견사항

---

**[WARNING] `STATUS_ICON`, `STATUS_BADGE_VARIANT`, `STATUS_LABEL`, `formatDuration`이 두 파일에 동일하게 복제됨**
- 위치: `executions/page.tsx:22-65`, `[executionId]/page.tsx:22-65`
- 상세: 상태값 추가/변경 시 두 파일을 모두 수정해야 하며 불일치 위험이 높음. 기존 리뷰들(maintainability, documentation, scope)이 동일하게 지적.
- 제안: `src/lib/utils/execution-status.ts`로 추출하여 공유

---

**[WARNING] API 응답 정규화 패턴 (`data.data ?? data`)이 각 queryFn에 분산됨**
- 위치: `[executionId]/page.tsx:105-109, 117-124`, `executions/page.tsx:152-156`
- 상세: `(data as any).data ?? data`와 `(data as unknown as { data?: T }).data ?? data`가 혼재하여 캐스팅 방식도 불일치. API 클라이언트 레이어 추상화 부재를 나타냄.
- 제안: axios interceptor 또는 api 함수 내부에서 응답 unwrapping을 한 번만 처리

---

**[WARNING] `adjacentQuery`의 `limit: 100` 매직 넘버와 암묵적 한계**
- 위치: `[executionId]/page.tsx:118`
- 상세: 100건 초과 실행 시 prev/next 탐색이 silently 실패함. 또한 `currentIndex === -1` 케이스에서 `items[0]`이 반환되는 버그도 존재 (requirement 리뷰 지적).
- 제안: 상수로 추출 + 주석으로 한계 명시, 또는 cursor 기반 API로 교체. 즉시 `if (currentIndex === -1) return { prev: null, next: null }` 가드 추가

---

**[WARNING] `NodeResultsTab` props 과다 (6개)**
- 위치: `[executionId]/page.tsx:295-305`
- 상세: `nodeExecutions`, `selectedNodeId`, `selectedNode`, `nodeDetailTab`, `onSelectNode`, `onSetNodeDetailTab` — 상태와 핸들러가 모두 외부에서 주입되어 컴포넌트 시그니처가 복잡하고 테스트하기 어려움.
- 제안: `selectedNodeId`, `nodeDetailTab` 상태를 `NodeResultsTab` 내부로 이동하고, Timeline 연동에 필요한 콜백만 외부로 노출

---

**[INFO] `detailTabs` 배열이 렌더마다 새로 생성됨**
- 위치: `[executionId]/page.tsx:307-311`
- 상세: `selectedNode?.error` 의존성이 있으나 `useMemo` 없이 함수 본문에 배열 리터럴로 선언됨.
- 제안: `useMemo(() => [...], [selectedNode?.error])`로 감싸기

---

**[INFO] 테스트의 `Failed Execution` describe 블록이 `createWrapper()` 헬퍼를 재사용하지 않음**
- 위치: `execution-detail-page.test.tsx:150-170`
- 상세: 동일 파일 상단의 `createWrapper()` 헬퍼가 있음에도 인라인으로 `QueryClientProvider` + `Suspense`를 직접 구성하여 일관성 부족.
- 제안: `createWrapper()` 헬퍼 재사용

---

**[INFO] `execution-list-page.test.tsx`의 `mockBack`이 선언되었으나 미사용**
- 위치: `execution-list-page.test.tsx:6`
- 상세: 변수가 선언되어 있으나 어떤 assertion에서도 검증되지 않음.
- 제안: `router.back()` 호출을 검증하는 테스트 추가 또는 변수 제거

---

**[INFO] 페이지네이션 버튼을 `totalPages` 전체 수만큼 무제한 렌더링**
- 위치: `executions/page.tsx:241-258`
- 상세: `Array.from({ length: totalPages })`로 버튼을 전부 렌더링. 페이지가 많아지면 UI 깨짐 + 보안 리뷰에서 서버가 비정상적으로 큰 값을 반환하면 DoS-like 문제가 발생할 수 있다고도 지적됨.
- 제안: 슬라이딩 윈도우 방식(현재 페이지 ±2 + 처음/끝) 적용, `Math.min(totalPages, 100)` 상한선 설정

---

### 요약

코드 구조는 전반적으로 명확하고 역할 분리도 잘 되어 있으나, 두 페이지 파일 사이의 **상수·유틸 중복**이 가장 큰 유지보수 부담이다. 상태값이 추가되거나 `formatDuration` 로직이 변경될 때 양쪽을 모두 수정해야 하며 불일치를 발견하기 어렵다. API 응답 정규화 로직의 분산과 캐스팅 방식 불일치는 API 클라이언트 레이어 추상화가 필요함을 나타내고, `adjacentQuery`의 `currentIndex === -1` 미처리는 실제 버그로 즉시 수정이 필요하다. `NodeResultsTab`의 과도한 props는 내부 상태를 부모로 끌어올린 설계 문제로 컴포넌트 재사용성과 테스트 용이성을 저해한다.

### 위험도

**MEDIUM**