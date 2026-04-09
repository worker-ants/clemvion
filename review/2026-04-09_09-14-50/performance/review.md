### 발견사항

---

**[WARNING] POLL_INTERVAL_WAITING_MS 5배 증가 (10000ms → 2000ms)**
- 위치: `use-execution-events.ts` — `POLL_INTERVAL_WAITING_MS` 상수
- 상세: 사용자 입력 대기 상태(form/button/conversation)에서 polling 주기가 10초에서 2초로 단축됨. `waiting_for_input`은 사용자가 명시적으로 행동하기 전까지 실행 상태가 바뀌지 않으므로, 빈번한 polling은 서버 부하만 증가시킴. 장시간 대기 시 불필요한 API 호출이 5배 발생.
- 제안: 사용자 입력 대기 상태는 WebSocket 이벤트로 완료를 감지하거나, 별도 polling 주기를 유지 (최소 5~10초). 단순히 주기를 동일하게 맞추는 것은 대기 상태의 특성을 무시한 변경.

---

**[WARNING] `adjacentQuery` — 100건 전체 페치 후 클라이언트 탐색**
- 위치: `[executionId]/page.tsx` — `adjacentQuery` queryFn
- 상세: prev/next ID 2개를 구하기 위해 `limit: 100`으로 전체 실행 목록과 각 실행의 `nodeExecutions` 배열까지 포함한 대용량 페이로드를 매번 수신. `findIndex`는 O(n)이고 100건 초과 시 탐색 실패. 필요한 데이터 대비 전송량이 과도함.
- 제안: 백엔드에 `GET /executions/:id/adjacent` 엔드포인트 추가 또는 실행 단순 목록(id만 포함) 전용 API 분리. 단기적으로는 `fields=id` 등 필드 제한 파라미터로 페이로드 축소.

---

**[WARNING] 실행 목록 행 렌더링 시 `nodeExecutions` 다중 순회**
- 위치: `executions/page.tsx` — 행 렌더링 내부 (기존 코드, 이번 변경에서 미개선)
- 상세: 각 execution 행마다 `nodeExecutions`를 최소 2~3회 filter/length 연산. 페이지당 20행 × 노드 수 = O(rows × nodes) 불필요한 중복 순회. 기존 리뷰에서 지적됐으나 미조치 상태로 이번 변경에 포함됨.
- 제안: 단일 `reduce`로 `completedCount`, `failedCount` 동시 집계:
  ```ts
  const { completedCount, failedCount } = (execution.nodeExecutions ?? []).reduce(
    (acc, ne) => {
      if (ne.status === "completed") acc.completedCount++;
      else if (ne.status === "failed") acc.failedCount++;
      return acc;
    },
    { completedCount: 0, failedCount: 0 },
  );
  ```

---

**[INFO] `carousel.handler.ts` — `allButtons` 및 `buttonItemMap` 이중 루프**
- 위치: `carousel.handler.ts` — `execute()` 메서드 후반부
- 상세: items 배열을 map으로 순회 후, 다시 items를 for 루프로 순회하며 `buttonItemMap`과 `allButtons`를 구성. 아이템 수 × 버튼 수 만큼 두 번 순회. 캐러셀 특성상 아이템 수가 적어 실질 영향은 낮지만, map 내부에서 동시에 집계 가능.
- 제안: items.map 콜백 내부에서 buttonItemMap과 allButtons를 함께 구성하여 단일 패스로 처리.

---

**[INFO] `custom-node.tsx` — `hasAnyLink` 다중 `.some()` 호출**
- 위치: `custom-node.tsx` — `hasAnyLink` 계산
- 상세: globalButtons, itemButtons, static items.buttons 세 가지에 대해 각각 `.some()` 호출이 순차 실행되나 early-exit 없이 모두 평가됨. 노드당 버튼 수가 적어 실질 영향은 무시할 수준.
- 제안: 단일 함수로 통합하여 첫 match 시 즉시 반환.

---

**[INFO] `conversation-inspector.tsx` — 동적 `Wrapper` 태그 타입**
- 위치: `conversation-inspector.tsx` — `SummaryView` items 렌더링
- 상세: `const Wrapper = isClickable ? "button" : "div"` 패턴에서 `isClickable`이 런타임에 변경될 경우 React가 기존 DOM 노드를 unmount/remount하며 재생성. 현재는 `onSelectItem` prop이 컴포넌트 생애 중 변경되지 않아 실질 영향 없음. 단, `isClickable` 재계산이 map 콜백 내부에서 아이템 수만큼 반복됨.
- 제안: `const isClickable = !!onSelectItem`을 map 바깥으로 이동하여 한 번만 계산.

---

**[INFO] `unwrap<T>` 함수 — 런타임 타입 검사 오버헤드**
- 위치: `executions.ts` — `unwrap` 헬퍼
- 상세: `typeof data.data === "object" && !Array.isArray(data.data)` 검사가 API 호출마다 실행됨. 호출 빈도가 낮아 무시할 수준이나, API 응답 구조가 안정적이라면 조건 분기 없이 타입을 확정하는 것이 더 명확함.
- 제안: API 레이어에서 응답 구조를 확정하여 런타임 분기 제거.

---

### 요약

가장 주목할 성능 이슈는 **`POLL_INTERVAL_WAITING_MS`의 10초 → 2초 단축**으로, 사용자 입력 대기 중 서버 API 호출이 5배 증가하는 불필요한 부하를 유발한다. 대기 상태는 사용자 액션 없이 상태가 변경되지 않으므로 짧은 polling 주기의 실익이 없다. 두 번째로는 `adjacentQuery`의 최대 100건 bulk fetch가 prev/next 2개 ID를 위해 과도한 페이로드를 전송하는 구조적 문제로, 데이터 증가 시 성능 저하와 기능 오작동(100건 초과 시)을 동반한다. 나머지 이슈들(다중 filter 순회, 이중 루프)은 현재 데이터 규모에서 체감 영향이 낮지만, polling 주기 문제는 즉시 검토가 필요하다.

### 위험도

**MEDIUM**