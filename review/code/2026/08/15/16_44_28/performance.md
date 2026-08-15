# Performance Review — `finalizeStalledExhausted` 트랜잭션화

## 리뷰 대상

- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `finalizeStalledExhausted`(3345-3419)의 Execution/NodeExecution 두 조건부 UPDATE 를 `dataSource.transaction()` 단일 트랜잭션으로 원자화 (자매 `cancelParkedExecution`(1023-1089)·`markWebChatIdleTimeout` 과 동형)
- `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` — 대응 회귀 테스트(mock 전용, DB I/O 없음)
- 그 외 `CHANGELOG.md`, `plan/**`, `review/**` 는 문서 변경으로 실행 경로에 영향 없음 — 성능 관점 해당 없음

## 발견사항

- **[INFO]** 트랜잭션 래핑으로 인한 왕복(round-trip) 증가 — 무시 가능한 규모
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:3357` (`await this.dataSource.transaction(async (manager) => {`)
  - 상세: 변경 전에는 두 UPDATE 가 각각 독립 autocommit 문장이라 DB 왕복이 문장당 1회(성공 경로 총 2회)였다. 변경 후에는 `dataSource.transaction()` 이 전용 커넥션을 풀에서 획득해 `BEGIN` → UPDATE → UPDATE → `COMMIT` 을 보낸다(성공 경로 총 4회 왕복 + 커넥션 획득/반환). 다만 이 함수는 BullMQ stalled 재배달 소진(워커 크래시) 시에만 발동하는 **콜드 경로**이고, 초당 반복 호출 가능성이 없는 이벤트라 왕복 2회 증가는 실질적 영향이 없다. 이미 같은 트레이드오프를 받아들인 자매 두 함수(`cancelParkedExecution`, `markWebChatIdleTimeout`)와 동일한 패턴이므로 신규 결정이 아니라 기존에 검증된 트레이드오프의 확장이다.
  - 제안: 조치 불필요. 정확성(부분 커밋 방지)이 이 수준의 왕복 증가보다 명백히 우선한다.

- **[INFO]** 트랜잭션으로 인해 `Execution` row 락 보유 시간이 소폭 연장됨
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:3357-3405` (트랜잭션 콜백 전체)
  - 상세: 변경 전에는 `Execution` UPDATE 가 커밋되는 즉시 그 row 의 락이 해제됐다. 변경 후에는 같은 트랜잭션 안에서 `NodeExecution` cascade UPDATE 까지 실행한 뒤 커밋해야 `Execution` row 락이 풀린다. 대상이 단일 `executionId` 로 좁고, 두 번째 UPDATE 도 단순 조건부 point UPDATE 라 지연은 밀리초 단위로 예상되며, 이미 원자적이던 두 자매 함수와 동일한 락 보유 패턴이라 신규 리스크가 아니다.
  - 제안: 조치 불필요. 다만 `finalizeStalledExhausted` 와 `recoverStuckExecutions`(부팅 backstop, JSDoc 이 명시하는 이론적 race)가 같은 `executionId` 를 동시에 건드릴 수 있다는 점은 이미 문서화돼 있으므로, 그 race 조사 시 락 보유 시간 변화도 함께 고려하면 된다(별도 조치 아님, 참고용).

- **[INFO]** 알고리즘 복잡도·N+1·메모리·캐싱·블로킹 I/O·자료구조·지연로딩 — 변경 없음
  - 상세: 두 UPDATE 모두 단일 `executionId` 대상 O(1) point UPDATE 이며 반복문·배치 루프가 없다. 새로 생성되는 객체는 트랜잭션 콜백 클로저와 `let` 스코프 변수(`stalledDurationMs`, `finalized`) 정도로 무시 가능한 수준이다. 트랜잭션 내부에서 `manager.createQueryBuilder()` 만 사용(리포지토리 직접 접근 차단)해 트랜잭션 밖 잔여 I/O가 없다. 커밋 이후 부수효과(`finalizeRehydrationCleanup`, `emitExecution`)는 여전히 트랜잭션 밖 best-effort 로 순서가 유지돼 트랜잭션 시간을 늘리지 않는다. 테스트 파일 변경은 전부 mock 기반이라 실제 DB I/O·대량 데이터 처리와 무관하다.
  - 제안: 해당 없음.

## 요약

이번 변경은 `finalizeStalledExhausted` 의 두 조건부 UPDATE(Execution → NodeExecution)를 `dataSource.transaction()` 으로 원자화한 것으로, 이미 동일 파일에서 검증된 자매 함수 패턴(`cancelParkedExecution`, `markWebChatIdleTimeout`)을 그대로 재사용한다. 성능 관점에서는 새로운 알고리즘 복잡도 증가, N+1, 불필요한 메모리 할당, 캐싱 필요성, 블로킹 I/O, 부적절한 자료구조, 과도한 선행 로딩 중 어느 것도 발견되지 않았다. 유일한 관찰은 명시적 `BEGIN/COMMIT` 도입으로 인한 DB 왕복 2회 증가와 `Execution` row 락 보유 시간의 소폭 연장인데, 둘 다 (1) 콜드 경로(워커 크래시로 인한 stalled 재배달 소진)에서만 발동하고 (2) 단일 row 대상 point UPDATE 라 절대 지연폭이 작으며 (3) 이미 받아들여진 자매 함수의 트레이드오프와 동일하다. 정확성(부분 커밋으로 인한 자식 NodeExecution 영구 RUNNING 잔류 방지) 대비 비용이 명백히 낮아 순수한 개선으로 판단한다.

## 위험도

NONE
