# 동시성(Concurrency) 코드 리뷰

## 발견사항

- **[INFO]** `updateExecutionStatus` else 분기가 매 상태 전이마다 전용 DB 트랜잭션을 여는 것으로 바뀌어, 커넥션 풀 점유 시간이 늘어난다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8691` (`let persisted = false;`) ~ `:8727` (`});`) — `public async updateExecutionStatus` else 분기
  - 상세: 종전엔 `this.executionRepository.query(...)` 단발 auto-commit UPDATE 1회 왕복이었는데, 이번 변경으로 `await this.dataSource.transaction(async (manager) => { ... manager.query(...) ... })` 로 감싸 BEGIN+UPDATE+COMMIT 3왕복이 되고, 커넥션 풀에서 커넥션을 트랜잭션 전체 구간 동안 점유한다. 이 else 분기는 `updateExecutionStatus` 호출부 11곳 중 `linkedNodeExec` 없이 호출되는 대다수(RUNNING/COMPLETED/FAILED/CANCELLED 최상위 종결 포함, 예: 652/2309/2409/2485/2574/3569/4307/4432/4755/4893/5014 라인)가 타는 hot path다. 동시 실행이 많을 때 커넥션 풀 압박이 커질 수 있다.
  - 제안: 의도된 트레이드오프(가드 throw 시 실제 롤백을 보장하기 위함, 형제 `linkedNodeExec`/`tryLockActiveExecutionAndSaveNodeExec` 분기와 형태 일치)로 보이므로 수정 필수는 아니다. 다만 커넥션 풀 크기가 작은 환경에서 이 hot path 의 처리량을 실측해 두는 것을 권한다.

- **[INFO]** `updateExecutionStatus` 가 내부에서 `this.dataSource.transaction()` 을 여는데, 이미 열린 트랜잭션 안에서 호출되면 자기-교착(self-deadlock) 위험이 있다 — 현재는 해당 호출부 없음, 향후 회귀 방지용 가드/문서화 권장
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8566` (`public async updateExecutionStatus`) 함수 시그니처/JSDoc
  - 상세: TypeORM 의 `dataSource.transaction()` 은 항상 새 QueryRunner/커넥션으로 별도 트랜잭션을 연다 — 이미 열려 있는 트랜잭션에 합류(nest)하지 않는다. 만약 향후 어떤 호출자가 자신의 `dataSource.transaction()`/`manager.transaction()` 콜백 **안에서** `updateExecutionStatus(execution, ...)` (linkedNodeExec 없이, else 분기)를 `await` 하면, 두 트랜잭션이 같은 `execution` row 에 쓰기를 시도할 때 안쪽 트랜잭션의 UPDATE 가 바깥 트랜잭션의 미커밋 row 잠금을 기다려 블록되고, 바깥 트랜잭션은 그 `await` 가 끝나기를 기다리므로 서로 영원히 대기하는 교착이 생길 수 있다. 현재 코드베이스의 `updateExecutionStatus` 호출부 11곳(652, 2309, 2409, 2485, 2574, 3569, 4307, 4432, 4755, 4893, 5014)과 `dataSource.transaction`/`manager.transaction` 을 여는 다른 5곳(1024, 1158, 2974, 3342, 8448)을 모두 대조했고, 어느 트랜잭션 콜백 안에서도 `updateExecutionStatus` 를 호출하지 않음을 확인했다 — 지금 당장 트리거되는 결함은 아니다. 다만 이 저장소는 트랜잭션 관련 동시성 결함(중첩·부분 커밋)이 여러 라운드에 걸쳐 반복 발견된 이력이 있어(예: exec-intake PR2b advisory lock, exec-park PR3 crash re-drive), 함수 JSDoc 에 "이미 열린 트랜잭션 안에서 호출 금지" 를 명시해 두면 향후 회귀를 막는 값싼 보험이 된다.
  - 제안: `updateExecutionStatus` JSDoc 에 "호출자는 자신의 트랜잭션 콜백 밖에서(top-level) 호출해야 한다" 라는 한 줄 경고를 추가하는 정도로 충분하다.

## 요약

이번 변경은 `18_19_33` 라운드에서 지적된 concurrency INFO 9(가드 UPDATE 가 트랜잭션 밖 단발이라 shape-위반 throw 가 이미 커밋된 UPDATE 를 되돌리지 못하던 문제)를 정확히 고친다 — else 분기의 raw UPDATE 를 `this.dataSource.transaction()` 으로 감싸 throw 가 실제로 롤백을 유발하도록 만들었고, 이는 이미 같은 함수의 `linkedNodeExec` 분기·형제 종결 헬퍼들이 쓰던 패턴과 형태가 일치한다. 새로 추가된 두 테스트는 (a) 트랜잭션이 실제로 열렸는지, (b) UPDATE 가 그 트랜잭션 manager 를 경유하는지를 롤백 케이스와 정상 케이스 양쪽에서 각각 고정해, 롤백 테스트가 "throw 경로만 우연히 트랜잭션을 탄" 공허한 통과가 되지 않도록 짝을 이룬다 — mutation 검증 관점에서 견고하다. 현재 호출 그래프를 전수 대조한 결과 이 새 트랜잭션이 기존 트랜잭션 안에서 중첩 호출되는 경로는 없어 자기-교착 위험은 이론상 잠재적일 뿐 실측되지 않았고, 락 순서상 데드락(순환 대기) 후보도 없다. 남은 관측은 hot path 의 커넥션 풀 점유 증가(왕복 3배)와, 향후 호출부가 늘어날 때의 중첩-트랜잭션 회귀 방지용 문서화 정도로 둘 다 INFO 수준이다.

## 위험도

LOW
