### 발견사항

---

**[WARNING]** 노드 기본 탭 선택 우선순위가 스펙과 반대
- 위치: `[executionId]/page.tsx:348-351` — 노드 버튼 클릭 핸들러
- 상세: 스펙 §3.3은 "outputData가 있으면 Preview, 에러면 Error, 그 외 Output" 순서를 정의하지만, 구현은 `ne.error ? "error" : ne.outputData ? "preview" : "output"` — 에러를 먼저 확인. 부분 실행 후 실패한 노드(outputData와 error 모두 존재)에서 스펙은 Preview를 기본값으로 요구하지만 구현은 Error 탭을 표시.
- 제안:
  ```ts
  setNodeDetailTab(
    ne.outputData ? "preview" : ne.error ? "error" : "output"
  );
  ```

---

**[WARNING]** 스펙 §2.1 다이어그램의 Trigger 열이 구현에 없음
- 위치: `executions/page.tsx` — 테이블 컬럼 정의
- 상세: 스펙 §2.1 화면 구성 다이어그램은 `Status | Started At | Duration | Trigger` 4열을 보여주지만, §2.4 테이블 스펙은 `Status | Started At | Duration | Nodes`로 정의. 구현은 §2.4를 따르며 Trigger 열은 없음. 스펙 내 불일치이므로 의도 확인 필요. Trigger 열이 필요하다면 누락, 불필요하다면 §2.1 다이어그램 수정 필요.
- 제안: `spec/2-navigation/6-execution-history.md` §2.1 다이어그램을 §2.4 테이블 정의와 일치하도록 수정

---

**[WARNING]** 실행 상세 Finished 시간 표시 형식이 스펙 불일치
- 위치: `[executionId]/page.tsx:241` — `formatDate(execution.finishedAt, "datetime")`
- 상세: 스펙 §3.2는 "종료 시간: `HH:mm:ss` (같은 날이면 시간만) 또는 `—` (미완료)"를 요구. 구현은 항상 전체 datetime 형식으로 표시(`2024-01-15 14:02:33`). 같은 날 실행의 경우 Started/Finished 모두 날짜를 표시해 중복 정보 노출.
- 제안: `formatDate` 유틸에 same-day 조건을 추가하거나, Started At과 비교하여 같은 날이면 시간만 표시

---

**[INFO]** Nodes 열의 `totalCount`가 skipped 노드 제외
- 위치: `[executionId]/page.tsx:116-122` — `completedCount`, `failedCount`, `totalCount`
- 상세: `sortedNodeExecutions`는 `status !== "skipped"` 필터 후 카운트하므로, 요약 카드의 `N/총계 completed`에서 skipped 노드가 전체 수에서 제외됨. 목록 페이지도 동일하게 `nodeExecutions?.length`를 전체 수로 사용(skipped 포함). 두 페이지 간 숫자 불일치 가능성 있음.
- 제안: 스펙이 "전체 수"를 skipped 제외 기준으로 하는지 명확히 정의 후 통일. 현재 명세가 모호한 상태.

---

**[INFO]** 실행 목록 API 호출 시 `page` 리셋이 정렬 변경에도 적용되지만 스펙 미명시
- 위치: `executions/page.tsx:131-139` — `handleSort`
- 상세: 정렬 변경 시 `setPage(1)` 호출. 스펙 §2.6은 "필터 변경 시 1페이지로 리셋"만 명시하고 정렬 변경 시 리셋 여부는 미정의. 현재 구현은 정렬 변경 시에도 1페이지로 이동하는데, 이는 사용자 경험상 자연스럽지만 스펙 명세 누락.

---

**[INFO]** `waiting_for_input` 상태 노드가 노드 목록에 표시됨
- 위치: `[executionId]/page.tsx:107-113` — `sortedNodeExecutions` 필터
- 상세: 필터가 `status !== "skipped"`만 제외. `waiting_for_input` 노드는 목록에 포함되어 표시. 스펙 §3.3은 "Skipped 상태의 노드는 목록에서 제외한다"고만 명시하므로 구현은 올바르나, `waiting_for_input` 노드 클릭 시 `NodeStatusIcon`은 `PauseCircle`을 표시하며 error/outputData 모두 없어 Output 탭이 기본 선택됨. 스펙에서 이 상태 노드의 상세 뷰 동작이 미정의.

---

### 요약

핵심 기능(목록 조회, 필터, 정렬, 페이지네이션, 상세 뷰, prev/next 네비게이션, 에러 상태 처리)은 전반적으로 스펙을 충족한다. 가장 명확한 요구사항 불일치는 **노드 기본 탭 선택 우선순위**로, 스펙은 `outputData 있으면 Preview 우선`을 요구하지만 구현은 `error 우선`으로 반전되어 있어 부분 실패 노드에서 사용자 경험이 스펙과 다르게 동작한다. **Finished 시간 포맷**도 스펙의 same-day 조건을 구현하지 않아 미충족 상태다. **스펙 §2.1 다이어그램의 Trigger 열**은 §2.4 실제 테이블 정의와 불일치하는 내부 모순으로, 의도 확인 후 스펙 또는 구현 수정이 필요하다.

### 위험도

**MEDIUM**