### 발견사항

---

**[WARNING] `itemButtons`(dynamic) vs `items[].buttons`(static) 네이밍 불일치**
- 위치: `spec/4-nodes/6-presentation-nodes.md` — Config 표 (`itemButtons`), ItemDef 표 (`buttons`)
- 상세: Dynamic 모드의 아이템 버튼은 노드 config 레벨에 `itemButtons`로 정의되고, Static 모드의 아이템 버튼은 `items[].buttons`로 정의된다. 동일한 개념을 다른 이름으로 부르고 있어 구현자가 두 모드의 버튼 처리를 별도 로직으로 오해하거나 누락할 위험이 있다.
- 제안: 네이밍을 통일하거나, 스펙 상단에 두 방식의 대칭성을 명시적으로 기술

---

**[WARNING] 버튼 포트 출력 형식과 Continue 포트 출력 형식 간 필드 불일치**
- 위치: `spec/4-nodes/6-presentation-nodes.md` — "버튼 포트 출력 형식"(L109), "Continue 포트 출력 형식"(L119 이후)
- 상세: 버튼 포트 출력에서 `clickedBy` 필드가 제거되고 `selectedItem`이 추가되었으나, Continue 포트 출력 형식에는 여전히 `clickedBy`가 존재한다. 동일 노드에서 발생하는 두 출력 경로의 스키마가 비대칭적으로 문서화되어 있어 구현 시 혼란을 줄 수 있다.
- 제안: 두 출력 형식에서 공통 필드(`clickedAt`, `clickedBy`, `nodeOutput`)를 명시적으로 기준 스키마로 분리하고, 각 형식은 차이점만 기술

---

**[WARNING] `STATUS_*` 상수 3종 + `formatDuration` 함수 양쪽 파일 중복**
- 위치: `executions/page.tsx:23-50`, `[executionId]/page.tsx:23-50` (기존 reviewers 확인)
- 상세: 이미 여러 리뷰어가 지적했으나 가장 즉각적인 유지보수 위험. 실행 상태 추가 시 반드시 두 파일을 모두 수정해야 하며, 단일 수정으로 보이는 변경이 실제로는 두 곳을 동기화해야 하는 암묵적 계약이 코드베이스에 내재화된다.
- 제안: `src/lib/constants/execution-status.ts`로 즉시 추출. 이는 문서화 문제가 아닌 구조적 문제로 INFO가 아닌 WARNING 이상으로 처리되어야 함

---

**[WARNING] `vi.clearAllMocks()` 후 모듈 레벨 mock 구현 소실 — 테스트 순서 의존성**
- 위치: `execution-detail-page.test.tsx`, `execution-list-page.test.tsx` (beforeEach)
- 상세: `vi.clearAllMocks()`는 mock 함수의 호출 이력뿐 아니라 `mockResolvedValue` 구현까지 제거한다. 현재 테스트가 통과하는 것은 테스트 실행 순서에 우연히 의존하는 것이며, CI 환경에서 순서가 달라지면 비결정적 실패가 발생한다. 유지보수 관점에서 미래 테스트 추가 시 디버깅이 매우 어려운 실패 유형이다.
- 제안: `beforeEach`에서 `workflowsApi.get`, `executionsApi.getByWorkflow` 등 모든 mock을 명시적으로 재설정

---

**[INFO] `adjacentQuery`의 `limit: 100` 제약이 스펙과 코드 양쪽에 문서화 불일치**
- 위치: `spec/2-navigation/6-execution-history.md` §3.6, `[executionId]/page.tsx:118`
- 상세: 스펙 §3.6에서는 "같은 워크플로우의 시간 순서 기준으로 이전/다음 실행으로 이동"이라고만 명시하며 100건 제한을 언급하지 않는다. 구현에서는 `limit: 100`이 하드코딩되어 있어 스펙-구현 간 암묵적 차이가 존재한다. 스펙을 보고 유지보수하는 개발자가 이 제약을 인지하지 못할 위험이 있다.
- 제안: 스펙 §3.6에 현재 구현 방식의 제약(`limit: 100`으로 조회, 100건 초과 시 네비게이션 실패)을 명시하거나, Known Limitations 섹션 추가

---

**[INFO] `NodeResultsTab` 6개 props — 상태 위치 재검토 필요**
- 위치: `[executionId]/page.tsx:295-305`
- 상세: `selectedNodeId`, `selectedNode`, `nodeDetailTab`, `onSelectNode`, `onSetNodeDetailTab`, `nodeExecutions` — 이 중 `selectedNodeId`와 `nodeDetailTab`은 Timeline 탭과 Node Results 탭이 공유하는 상태가 아니라면 컴포넌트 내부로 이동할 수 있다. Props가 많을수록 컴포넌트의 인터페이스를 이해하는 비용이 높아지고 리팩터링 시 영향 범위가 넓어진다.
- 제안: Timeline에서 node 클릭 시 탭 전환을 위한 `onNodeClick` 콜백 하나만 외부로 노출하고, 내부 상태(`selectedNodeId`, `nodeDetailTab`)는 컴포넌트 내부로 이동

---

**[INFO] `spec/2-navigation/6-execution-history.md` §2.3 필터와 화면 구성도 불일치**
- 위치: `spec/2-navigation/6-execution-history.md` §2.1 (화면 구성도), §2.3 (필터 표)
- 상세: 화면 구성도에는 `[All] [Completed] [Failed] [Running] [Cancelled]` 5개 버튼만 표시되어 있으나 §2.3 필터 표에는 `Waiting` (`waiting_for_input`)이 추가되어 있다. 스펙 내 자기 불일치가 존재하며, `requirement/review.md`가 코드에서 누락으로 지적한 바 있다.
- 제안: 화면 구성도에 `[Waiting]` 버튼 추가

---

**[INFO] `_selectedPort` 메타데이터 strip 동작이 spec에 분산 기술**
- 위치: `spec/4-nodes/6-presentation-nodes.md` §1.3 (주석), `spec/5-system/4-execution-engine.md` §2.1
- 상세: `_selectedPort` strip 동작이 presentation 노드 스펙의 인라인 주석과 실행 엔진 스펙 두 곳에 각각 기술되어 있다. 향후 이 동작이 변경될 경우 두 문서를 동기화해야 하는 부담이 생긴다.
- 제안: 실행 엔진 스펙 §2.1을 단일 진실 소스로 하고, presentation 노드 스펙에서는 해당 섹션으로 참조 링크만 추가

---

### 요약

가장 큰 유지보수 부담은 `STATUS_*` 상수와 `formatDuration`의 두 파일 중복으로, 코드베이스에 암묵적인 동기화 계약이 생겨 향후 상태 추가 시 누락 위험이 높다. 스펙 문서에서는 `itemButtons`(dynamic) vs `items[].buttons`(static) 네이밍 비대칭과 §2.1 화면 구성도–§2.3 필터 표의 불일치가 구현자에게 혼란을 줄 수 있다. 테스트 코드에서 `vi.clearAllMocks()` 이후 mock 재설정 누락은 테스트 실행 순서 의존성을 만들어 CI 환경에서 비결정적 실패를 유발하는 조용한 시한폭탄이다. 전반적으로 코드 구조 자체는 명확하나, 공통 유틸리티 미추출과 스펙-구현 간 암묵적 차이가 장기 유지보수 비용을 높이는 주요 요인이다.

### 위험도

**MEDIUM**