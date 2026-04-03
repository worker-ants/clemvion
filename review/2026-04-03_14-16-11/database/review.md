### 발견사항

- **[WARNING]** Form 노드 재개(resume) 시 트랜잭션 부재
  - 위치: `execution-engine.service.ts` — `waitForFormSubmission()` 메서드 (nodeExec 상태 갱신 ~ 실행 상태 RUNNING 전환 구간)
  - 상세: `nodeExec.status = COMPLETED` 저장과 `updateExecutionStatus(RUNNING)` 이 두 번의 별도 `save()` 호출로 처리됨. 두 쓰기 사이에 서버가 재시작되면 node_execution은 COMPLETED이나 execution은 WAITING_FOR_INPUT 상태로 불일치가 발생할 수 있음.
  - 제안: `EntityManager.transaction()` 또는 QueryRunner를 사용해 두 업데이트를 단일 트랜잭션으로 묶을 것.

- **[INFO]** `resumeFromForm` 이벤트는 DB를 직접 조작하지 않음
  - 위치: `websocket.service.ts`, `use-execution-events.ts`
  - 상세: 금번 변경은 새 이벤트 타입 `EXECUTION_RESUMED` 추가와 프론트엔드 상태 처리로만 구성되어 있음. DB 스키마/쿼리 변경 없음.

---

### 요약

이번 변경의 핵심은 `EXECUTION_RESUMED` WebSocket 이벤트 추가와 프론트엔드 상태 분기 처리로, 스키마 변경·인덱스·마이그레이션·SQL 인젝션·커넥션 관리 측면에서는 영향 없음. 다만 Form 재개 흐름에서 `nodeExec` 완료 처리와 `execution` 상태를 RUNNING으로 전환하는 두 DB 쓰기가 트랜잭션 없이 순차 실행되는 기존 구조적 문제가 노출되어 있으며, 서버 장애 시 실행/노드 실행 레코드 간 상태 불일치로 이어질 수 있음.

### 위험도
LOW