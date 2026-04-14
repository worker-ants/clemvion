### 발견사항

---

**[WARNING]** `waiting_for_input` 상태 필터 버튼 누락
- 위치: `page.tsx` - `FILTER_BUTTONS` 배열
- 상세: `STATUS_LABEL`에는 `waiting_for_input`이 정의되어 있으나, `FILTER_BUTTONS`에는 해당 상태 필터가 없음. 실행 목록에서 이 상태의 실행만 필터링하는 것이 불가능.
- 제안: `{ label: "Waiting", value: "waiting_for_input" }` 항목 추가

---

**[WARNING]** prev/next 네비게이션 최대 100건으로 제한
- 위치: `[executionId]/page.tsx:128` - `adjacentQuery`
- 상세: `limit: 100`으로 조회하여 인접 실행을 찾는 방식은, 실행 이력이 100건을 초과하면 범위 밖 실행에 대해 prev/next가 항상 `null`로 반환됨. 예: 101번째 이전 실행은 탐색 불가.
- 제안: 현재 executionId 기준 cursor 방식 API 또는 별도 `/executions/:id/adjacent` 엔드포인트 사용 권장

---

**[WARNING]** adjacentQuery에서 실행 미발견 시 처리 누락
- 위치: `[executionId]/page.tsx:137-143`
- 상세: `currentIndex === -1`이면 (현재 executionId가 목록에 없으면) `prev`/`next` 모두 `null`이 아닌 엉뚱한 항목을 반환할 수 있음. `items[currentIndex + 1]`은 `items[-1 + 1]` = `items[0]`이 됨.
- 제안:
  ```ts
  if (currentIndex === -1) return { prev: null, next: null };
  ```

---

**[WARNING]** 실행 상세 페이지 에러 상태(query error) 처리 없음
- 위치: `[executionId]/page.tsx` - `executionQuery`
- 상세: API 호출 실패(`executionQuery.isError`) 시 사용자에게 아무 피드백 없이 "Execution not found." 메시지가 노출됨. 네트워크 에러와 데이터 미존재를 구분하지 않음.
- 제안: `executionQuery.isError` 체크 후 별도 에러 UI 표시

---

**[INFO]** 노드 타임라인 정렬 기준의 잠재적 불안정성
- 위치: `[executionId]/page.tsx:155-160` - `sortedNodeExecutions`
- 상세: `startedAt`이 동일한 노드가 여러 개일 경우 정렬 순서가 불안정(unstable). 병렬 실행 노드가 있는 워크플로우에서 매 렌더마다 순서가 달라질 수 있음.
- 제안: 동일 `startedAt`이면 `nodeId`로 2차 정렬 추가

---

**[INFO]** 테스트에서 `vi.clearAllMocks()` 후 mock 재설정 없이 `beforeEach` 사용
- 위치: `execution-list-page.test.tsx:77-79` - `beforeEach`
- 상세: `executionsApi.getByWorkflow`가 모듈 레벨 `vi.mock`으로 고정 구현되어 있어, `clearAllMocks()` 이후 mock 함수 호출 이력은 초기화되나 구현은 유지됨. 그러나 `execution-detail-page.test.tsx`에서는 `mockGetById` 재설정이 `beforeEach`에서 수행되어 일관성이 없음.
- 제안: 패턴 통일 또는 주석으로 의도 명시

---

**[INFO]** 페이지네이션 버튼: 총 페이지 수가 많을 때 UI 깨짐 가능성
- 위치: `page.tsx` - 페이지네이션 렌더링
- 상세: `Array.from({ length: totalPages })`로 모든 페이지 번호를 버튼으로 렌더링하므로, 총 페이지 수가 많을 경우(예: 50페이지) UI가 깨지거나 스크롤이 발생함.
- 제안: 현재 페이지 기준 ±2 범위 + 처음/끝 버튼 방식의 페이지네이션 적용

---

### 요약

전반적으로 실행 내역 조회, 상세 보기, 노드 결과 탐색 등 핵심 기능은 정상 구현되어 있으며 UI 구성도 스펙을 잘 반영하고 있다. 다만 `waiting_for_input` 상태 필터 누락, prev/next 네비게이션의 100건 제한으로 인한 오작동 가능성, `currentIndex === -1` 엣지 케이스에서의 잘못된 인접 항목 반환이 실제 사용자 경험에 영향을 줄 수 있는 요구사항 미충족 항목이다. API 에러 상태 미처리는 에러 상황에서의 피드백 부재로 이어진다.

### 위험도

**MEDIUM**