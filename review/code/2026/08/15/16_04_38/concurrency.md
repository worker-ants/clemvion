### 발견사항

- **[INFO]** 트랜잭션 롤백 자체는 여전히 미검증 (mock 은 원자성의 "전제"만 보증)
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:4912` (테스트 파일 내 주석 — "mock 은 롤백을 흉내내지 못한다" 자체 고지)
  - 상세: `finalizeStalledExhausted` 를 `dataSource.transaction()` 으로 감싸 Execution/NodeExecution 두 UPDATE 를 원자화한 것은 올바른 수정이며, 형제 함수 `cancelParkedExecution`(`execution-engine.service.ts:1028`)·`markWebChatIdleTimeout` 과 동일한 패턴(같은 락 순서: Execution → NodeExecution, 조건부 UPDATE 로 멱등·race-safe)을 그대로 따른다. 다만 신규 테스트(`installStalledTx`, `Execution·NodeExecution 두 UPDATE 가 같은 트랜잭션 manager 를 탄다`)는 `dataSource.transaction` 을 `jest.fn` 으로 대체해 "같은 manager 를 통해 두 호출이 나간다"는 것만 검증하고, 둘째 UPDATE 실패 시 첫째가 실제로 롤백되는지(진짜 원자성)는 검증하지 않는다 — 테스트 작성자도 주석으로 이 한계를 명시했다.
  - 제안: 이는 이 저장소의 기존 관례(형제 함수들도 동일하게 unit 레벨에서만 mock 검증)와 일치하므로 이번 diff 의 회귀는 아니다. 다만 실 DB 를 쓰는 integration/e2e 테스트 1개(둘째 UPDATE 를 강제로 던지게 하고 첫째 UPDATE 가 커밋되지 않았음을 확인)를 추가하면 "PR 이 고쳤다고 주장하는 바로 그 실패 모드"를 실측으로 닫을 수 있다.

### 요약
핵심 변경은 `finalizeStalledExhausted` 의 Execution/NodeExecution 두 조건부 UPDATE 를 `dataSource.transaction()` 단일 트랜잭션으로 묶어, 첫 UPDATE 커밋 후 둘째가 실패하면 자식 NodeExecution 이 영구 RUNNING 으로 잔류하던 원자성 결함(비동기 부분 커밋)을 해소한 것이다. 검증 결과: (1) 락/쓰기 순서가 형제 함수 `cancelParkedExecution`/`markWebChatIdleTimeout` 과 동일(Execution → NodeExecution)해 교차 함수 데드락 위험이 없고, (2) 두 WHERE 절 모두 상태 조건부(`status = RUNNING`) UPDATE 라 동시 재진입(중복 stalled 이벤트, `recoverStuckExecutions` backstop 재claim 등)에 대해 affected=0 no-op 으로 멱등·race-safe 하며, (3) 트랜잭션 콜백 내부에서 `manager.createQueryBuilder()` 만 사용하고(리포지토리 직접 사용 금지가 테스트에서 throw 로 하드닝됨) 커밋 후 부수효과(로그·cleanup·emit)는 트랜잭션 밖에서 best-effort 로 분리돼 있어 await 누락이나 이벤트 루프 블로킹도 없다. 호출부(`ExecutionRunProcessor.onFailed`)는 fire-and-forget + `.catch()` 로 unhandled rejection 도 방지한다. JSDoc 이 명시한 "recoverStuckExecutions 와의 이론적 race" 는 이번 diff 범위 밖의 기존 수용된 사항으로 변경되지 않았다. 새로 도입된 concurrency 결함은 발견되지 않았고, 유일한 지적은 테스트가 실제 롤백을 검증하지 못한다는 INFO 수준 커버리지 갭이다(기존 형제 함수들과 동일한 관례).

### 위험도
LOW
