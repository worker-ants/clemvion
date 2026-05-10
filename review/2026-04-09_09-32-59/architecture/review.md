### 발견사항

---

**[WARNING] API 응답 정규화 로직이 프레젠테이션 레이어에 분산됨**
- 위치: `[executionId]/page.tsx:105-124`, `executions/page.tsx:152-156`
- 상세: `(data as any).data ?? data` 패턴이 각 `queryFn` 내부에 반복 등장. API 클라이언트(axios interceptor 또는 `executionsApi`/`workflowsApi` 레이어)가 응답 언래핑 책임을 져야 함에도 UI 컴포넌트가 직접 처리하고 있음. 레이어 책임 역전(Layered Architecture 위반)이며, `eslint-disable` 주석과 타입 캐스팅 방식도 `unknown → specific type` vs `any` 두 가지가 혼재하여 일관성 없음.
- 제안: axios interceptor 또는 `createApiClient` 레벨에서 `response.data.data ?? response.data` 정규화를 단일 처리. API 클라이언트가 항상 정규화된 데이터를 반환하도록 계층 책임 정리.

---

**[WARNING] 도메인 상수/유틸이 공유 레이어 없이 UI 컴포넌트에 중복 정의됨**
- 위치: `executions/page.tsx:23-65`, `[executionId]/page.tsx:23-65`
- 상세: `STATUS_ICON`, `STATUS_BADGE_VARIANT`, `STATUS_LABEL`, `formatDuration`이 두 페이지 파일에 각각 복사되어 있음. 이는 도메인 지식(실행 상태 표현)이 프레젠테이션 레이어에 직접 내장된 구조로, 상태값 추가/변경 시 두 파일을 동시에 수정해야 하는 암묵적 결합이 발생함. Single Responsibility 관점에서 상태 표현 로직이 페이지 컴포넌트의 책임 범위를 벗어남.
- 제안: `src/lib/constants/execution-status.ts` 또는 `src/features/executions/utils.ts`로 분리. Feature 단위 구조(`features/executions/`) 도입을 고려할 경우, 관련 타입·상수·API 훅을 함께 응집하는 것이 장기적으로 더 유지 가능한 구조.

---

**[WARNING] `adjacentQuery` — 페이지네이션 API를 prev/next 탐색 목적으로 오용**
- 위치: `[executionId]/page.tsx:115-133`
- 상세: `limit: 100` 목록 조회 후 클라이언트에서 `findIndex`로 인접 항목을 탐색하는 구조는 아키텍처적으로 두 가지 문제를 내포함: (1) 비즈니스 로직(인접 실행 탐색)이 API 계약 설계가 아닌 클라이언트 브라우저에 위임됨, (2) 100건 초과 시 기능 장애가 발생하지만 이 한계가 API 스펙이나 타입에 명시되지 않음. 해당 로직은 백엔드가 책임져야 할 도메인 규칙임.
- 제안: 백엔드에 `GET /api/executions/:id/adjacent` 또는 cursor 기반 쿼리 파라미터(`before=:id&limit=1`, `after=:id&limit=1`)를 추가. spec `5-api-convention.md` 에 해당 엔드포인트 추가. 단기 해결책으로는 최소한 `ADJACENT_QUERY_LIMIT = 100` 상수화 + 타입 단위 문서화로 한계를 명시.

---

**[WARNING] `NodeResultsTab` 컴포넌트의 과도한 prop drilling — 상태 소유권 불명확**
- 위치: `[executionId]/page.tsx:295-305`
- 상세: `nodeExecutions`, `selectedNodeId`, `selectedNode`, `nodeDetailTab`, `onSelectNode`, `onSetNodeDetailTab` 6개 prop이 주입됨. 이 중 `selectedNodeId`, `nodeDetailTab`은 컴포넌트 내부에서 관리할 수 있는 상태임에도 부모로 끌어올려진 구조. Timeline에서의 노드 클릭 연동이 필요하다면 "Timeline에서 선택한 nodeId"만 외부 상태로 관리하고 나머지(세부 탭 등)는 내부화하는 것이 더 낮은 결합도를 유지함. 현재 구조는 `NodeResultsTab`의 내부 관심사가 부모 컴포넌트에 노출되어 있어 Open-Closed 원칙에 어긋남.
- 제안: `selectedNodeId`만 외부 prop으로 받고, `nodeDetailTab` 및 탭 변경 핸들러는 컴포넌트 내부로 이동. Timeline 연동 시 `onNodeSelect(nodeId: string)` 단일 콜백만 노출.

---

**[INFO] 실행 목록·상세 페이지 간 데이터 페칭 패턴이 별도 훅으로 추상화되지 않음**
- 위치: `executions/page.tsx`, `[executionId]/page.tsx` (queryFn 정의부)
- 상세: `useQuery`와 `queryFn` 로직이 페이지 컴포넌트 파일에 인라인으로 정의되어 있음. 서버 상태 관리 패턴(React Query)을 사용하고 있으나, 커스텀 훅(`useExecution`, `useExecutionList`)으로 분리되지 않아 페이지 컴포넌트가 API 호출 방식·응답 정규화·에러 처리 등 비프레젠테이션 로직을 포함하고 있음. 동일 데이터를 다른 컴포넌트에서 재사용할 때 중복이 발생할 구조.
- 제안: `src/hooks/use-execution.ts`, `src/hooks/use-executions.ts` 등으로 서버 상태 훅을 분리. 응답 정규화·타입 변환·에러 처리를 훅 내부로 이동.

---

**[INFO] Spec 변경(`14-execution-history.md`)에 정의된 `waiting_for_input` 필터가 구현에서 누락됨**
- 위치: `spec/2-navigation/14-execution-history.md §2.3`, `executions/page.tsx:101-107`
- 상세: Spec은 `Waiting` 필터(`waiting_for_input`)를 필터 버튼 목록에 포함하고 있으나, 구현에서는 해당 항목이 없음. Spec → 구현 동기화 체계가 없어 스펙 변경이 구현에 반영되지 않는 아키텍처적 프로세스 문제. Spec이 단일 진실 공급원(Single Source of Truth) 역할을 하고 있지 않음.
- 제안: 단기적으로 `FILTER_BUTTONS` 배열에 `{ label: "Waiting", value: "waiting_for_input" }` 추가. 중장기적으로 상태 목록을 공유 상수로 정의하고 필터 버튼을 이로부터 자동 생성하는 방식 고려.

---

### 요약

전반적으로 Next.js App Router 기반의 페이지 구조와 React Query를 통한 서버 상태 관리는 현대적이고 적절한 선택이다. 그러나 핵심적인 아키텍처 문제는 **레이어 책임 경계의 불명확함**에 있다: API 응답 정규화 로직이 API 클라이언트 레이어가 아닌 UI 컴포넌트에 분산되어 있고, 도메인 상수·유틸이 공유 레이어 없이 페이지 파일에 중복 정의되어 있으며, 인접 실행 탐색이라는 도메인 로직이 백엔드 API 설계 대신 클라이언트 휴리스틱(limit 100)으로 구현되어 있다. 이 세 가지는 서로 연결된 문제로, API 클라이언트 추상화 레이어와 Feature 단위 모듈 경계(상수/훅/타입 응집)를 도입하면 함께 해소될 수 있다. `NodeResultsTab`의 과도한 prop은 상태 소유권 설계를 재검토해야 한다는 신호이며, Spec의 `waiting_for_input` 필터 누락은 스펙-구현 동기화 체계의 부재를 나타낸다.

### 위험도

**MEDIUM**