# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** `updateExecutionStatus` else 분기의 guarded UPDATE 가 무-트랜잭션 단발 쿼리에서 `dataSource.transaction()` 래핑으로 바뀌어, 상태 전이마다 커넥션 풀에서 별도 커넥션을 체크아웃하고 BEGIN/COMMIT 왕복이 추가된다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8691-8727` (`let persisted = false; await this.dataSource.transaction(async (manager) => { ... });`)
  - 상세: 이 함수는 RUNNING/COMPLETED/FAILED/CANCELLED 등 거의 모든 실행 상태 전이의 단일 choke point 다. 종전엔 `this.executionRepository.query(...)` 로 단발 autocommit 쿼리 1회였는데, 이제 매 호출이 명시적 트랜잭션(커넥션 체크아웃 + BEGIN + UPDATE + COMMIT)을 연다. 코드 주석(8684~8690줄)에 롤백 보장을 위한 의도적 트레이드오프로 명시돼 있고, 짝 전이 분기(`linkedNodeExec` 분기, 8626줄)가 이미 같은 패턴을 쓰고 있어 형태가 일관된다. 다만 이 else 분기는 짝 전이 분기보다 호출 빈도가 훨씬 높은 hot path 라, 고부하 상황에서 커넥션 풀 압력이 늘어나는 실질적인 리소스 사용 side effect 다.
  - 확인한 것: 파일 내 다른 5곳의 `dataSource.transaction(` 블록(1024, 1158, 3342, 8448행)과 `updateExecutionStatus`/`tryLockActiveExecutionAndSaveNodeExec` 의 프로덕션 호출부 전체(`form-interaction.service.ts`, `button-interaction.service.ts`, `retry-turn.service.ts`, `ai-turn-orchestrator.service.ts`)를 열어 봤다 — 이미 열려 있는 트랜잭션 콜백 **안에서** 이 함수를 동기 중첩 호출하는 지점은 없었다(모두 순차 `await` — 이전 트랜잭션이 커밋된 뒤 다음 트랜잭션을 연다). 따라서 self-deadlock/중첩 트랜잭션류의 CRITICAL 은 아니다.
  - 제안: 별도 조치 불요. 다만 이 함수가 고빈도 호출 경로라는 점을 감안해, 부하 테스트/모니터링에서 커넥션 풀 사용률(예: `pg_stat_activity` 나 TypeORM pool 메트릭)을 관찰 대상에 포함해 두면 좋다 — 코드 자체의 결함은 아니고 사전 인지용 메모다.

- **[INFO]** `updateExecutionStatus` 함수 시그니처(`execution, newStatus, linkedNodeExec?, opts?): Promise<boolean>`) 는 변경되지 않았다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8566-8571`
  - 상세: 내부 구현만 트랜잭션 래핑으로 바뀌었을 뿐, 파라미터·반환 타입·던지는 예외 종류(shape 위반 시 throw) 모두 이전과 동일하다. 호출자(4개 프로덕션 파일)는 코드 변경 없이 그대로 동작한다.
  - 제안: 없음 — 확인 목적의 기록.

- **[INFO]** 테스트 mock `mockTxManagerQuery` 의 시그니처가 `(sql: unknown)` → `(sql: unknown, ...rest: unknown[])` 로 확장되고, `UPDATE execution` SQL 을 `mockExecutionRepo.query` 로 위임하는 분기가 추가됐다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:275, 289-291`
  - 상세: 이 mock 은 `beforeEach` 안에서 매 테스트마다 재생성되므로(251·274행) 테스트 간 전역 상태 누수는 없다. `FOR UPDATE` 검사가 `/UPDATE execution/` 검사보다 먼저 오는 순서라 `SELECT ... FOR UPDATE` 쿼리가 새 분기로 오분류될 위험도 없다(프로덕션 코드에서 `manager.query()` 로 나가는 raw SQL 은 이 두 종류(8379행 SELECT FOR UPDATE, 8694행 UPDATE execution)뿐임을 직접 확인). 새로 추가된 두 테스트(4806, 4836행 부근)도 `mockTxManagerQuery.mockClear()` 로 각자 격리돼 있다.
  - 제안: 없음 — 확인 목적의 기록. 부작용 관점에서 문제 없음.

- **[INFO]** plan 문서 2건(`backend-lint-gate-broken-on-main.md`, `update-returning-tuple-shape.md`) 변경은 체크박스 갱신·서술 반영뿐이며 코드·환경·파일시스템 부작용과 무관
  - 위치: `plan/in-progress/backend-lint-gate-broken-on-main.md`, `plan/in-progress/update-returning-tuple-shape.md`
  - 상세: 두 plan 이 같은 항목(`updateExecutionStatus` 트랜잭션화)을 각자 추적하던 것을 완료 처리하며 상호 참조를 남겼다. 코드 변경과 무관.
  - 제안: 없음.

## 요약

이번 변경의 핵심은 `updateExecutionStatus` else 분기의 guarded UPDATE 를 `dataSource.transaction()` 으로 감싸, shape 위반 throw 시 이미 실행된 UPDATE 가 함께 롤백되도록 한 것이다. 전역 변수·환경 변수·파일시스템·네트워크 호출·공개 API 시그니처 어느 것도 건드리지 않았고, 함수 반환 계약(`Promise<boolean>`, throw 시 예외 전파)도 그대로다. 유일하게 실질적인 부작용은 "매 상태 전이마다 명시적 DB 트랜잭션을 여는" 리소스 사용 패턴 변화인데, 이는 문서화된 의도적 트레이드오프이고 다른 5곳의 트랜잭션 블록·모든 프로덕션 호출부를 대조해 본 결과 중첩 트랜잭션/self-deadlock 같은 숨은 위험은 발견되지 않았다. 테스트 mock 변경도 `beforeEach` 로 격리돼 있어 크로스-테스트 오염 우려가 없다. 리포지토리에는 리뷰 산출물 디렉터리 외에 어떠한 뮤테이션도 남기지 않았다(`git status --short` 로 확인).

## 위험도

LOW
