### 발견사항

- **[INFO]** `getRecentExecutions`의 두 쿼리가 순차 실행됨
  - 위치: `dashboard.service.ts` — `getRecentExecutions`
  - 상세: `getMany()` → `loadParentWorkflowNames()` 순으로 await하지만, 두 번째 쿼리는 첫 번째 결과(parentExecutionId 목록)에 의존하므로 이 순서는 **올바르다**. 병렬화 대상이 아님.
  - 제안: 없음 (의존 관계가 명확하므로 현재 구조가 적절)

- **[INFO]** `getSummary`의 `successCount` / `avgResult`가 순차 실행됨
  - 위치: `dashboard.service.ts` — `getSummary` (변경된 범위 외 참조용)
  - 상세: `runs7dResult/runs7dPrevious`는 `Promise.all`로 병렬 처리되지만, 그 아래의 `successCount`와 `avgResult`는 순차 await. 두 쿼리는 서로 독립적이므로 `Promise.all`로 묶으면 레이턴시를 줄일 수 있다. 정합성 문제는 아님.
  - 제안: `const [successCount, avgResult] = await Promise.all([...successCountQuery, ...avgQuery])` 로 병렬화 가능

- **[INFO]** `stop` — `WAITING_FOR_INPUT` 분기의 TOCTOU(기존 코드)
  - 위치: `executions.service.ts` — `stop`, `WAITING_FOR_INPUT` 분기
  - 상세: `cancelWaitingExecution(id)`(동기) 직후 DB를 재조회하는 시점에 상태가 아직 반영되지 않을 수 있다. 코드 주석에 인지한 것으로 명시되어 있고, 클라이언트는 WebSocket `CANCELLED` 이벤트로 후속 갱신을 받는 구조. 이 변경 diff에서 새로 도입한 패턴이 아님.
  - 제안: 현재 구조(fire-and-forget + WS 후속 알림)가 의도적 설계이므로 수정 필요 없음; 주석이 이미 충분히 설명함

- **[INFO]** `loadParentWorkflowNames` — 순수 읽기 전용, 공유 상태 없음
  - 위치: `load-parent-workflow-names.ts`
  - 상세: 함수 인수(`repo`, `executions`)로만 작동하고 내부 변경 가능한 공유 상태가 없다. 동시에 여러 요청이 호출해도 안전.
  - 제안: 없음

- **[INFO]** WebSocket 테스트의 `setImmediate` 패턴
  - 위치: `websocket.gateway.spec.ts` — `await new Promise((resolve) => setImmediate(resolve))`
  - 상세: fire-and-forget 비동기 호출이 테스트 내에서 완료되도록 이벤트 루프 flush를 기다리는 표준 패턴. 올바른 사용.
  - 제안: 없음

---

### 요약

이번 diff의 핵심 변경사항(공유 유틸리티 `loadParentWorkflowNames` 추출, `getRecentExecutions` triggerSource/Label 보강, `TriggerCell` 컴포넌트 분리)은 모두 **동시성 관점에서 무해하다**. 새로 추가된 코드에는 공유 변경 가능 상태, 락, 경쟁 조건이 없다. 기존 `stop` 메서드의 TOCTOU는 이 변경과 무관하며 이미 원자 UPDATE + WebSocket 후속 알림으로 관리되고 있다. 미세한 성능 개선 포인트(`successCount`와 `avgResult` 병렬화)가 있지만 정합성 문제는 아니다.

### 위험도

**LOW**