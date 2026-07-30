# Database Review — retry_last_turn 2차 claim 재검토 (JSDoc/테스트 추가 이후)

## 발견사항

- **[INFO]** 원자 claim discard 이후 RUNNING NodeExecution row 가 영구 orphan 으로 잔류할 수 있는 백스톱 갭 (이미 추적 중, 신규 아님)
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:520-531` (`claimSpawnedRetryRow` JSDoc "알려진 백스톱 갭" 문단)
  - 상세: `claimSpawnedRetryRow` 의 claim 실패(affected≠1)는 원인을 구분하지 않고 항상 ack-and-discard 한다. 저자의 실측대로 `retryLastTurn` 이 항상 `_retryState` 를 seed 하므로 "한 번도 seed 안 된 진짜 corruption" 은 구조적으로 발생하지 않아야 하지만, 만에 하나 발생하면 그 spawn NodeExecution row 는 RUNNING 상태로 영구 남는다 — `failOrphanRunningNodeExecutions` 는 `recoverStuckExecutions` 의 stale RUNNING **Execution** 재구동 경로에서만 호출되는데, discard 후 Execution 은 이미 `failed`(terminal)라 그 백스톱의 대상이 아니기 때문이다. 이런 orphan row 가 쌓이면 진행률/타임라인 집계 쿼리(스키마 설계·대량 데이터 관점 모두 해당)를 왜곡할 수 있다. 이미 `plan/in-progress/retry-turn-terminal-guard.md` #15 로 P2 등재돼 있고, discard 선택 자체는 "살아있는 작업을 죽이지 않는다"는 더 중요한 안전 속성을 지키기 위한 의도된 트레이드오프로 타당하다.
  - 제안: 즉시 조치 불요(이미 추적·우선순위 지정됨). 후속으로 "부모 Execution 이 terminal 인데 자식 NodeExecution 이 RUNNING" 조합을 주기 스캔해 정리하는 별도 backstop 이나 모니터링 지표 추가를 고려.

- **[INFO]** `applyRetryLastTurn` 의 execution/node not-found 두 분기는 여전히 무가드 full-entity `save()` 사용 (이전 라운드 지적, 변경 없음)
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:377-388`(execution not found), `:389-399`(node not found)
  - 상세: 같은 파일의 `Execution` 종결 경로(`finalizeGuarded`)는 "정본 재조회 + 조건부 UPDATE" 가드로 이미 전환됐으나, 이 두 `NodeExecution` FAILED 마킹 분기는 여전히 조건 없는 `save(spawnedRow)` 로 커밋한다. 실제 위험은 낮다 — 원자 claim(`claimSpawnedRetryRow`)이 이미 이 row 를 배타적으로 선점했으므로 동일 retry 배달 경로끼리는 충돌하지 않는다. 다른 종결 경로(예: 사용자 Stop 에 의한 취소 처리)가 동일 시점에 같은 RUNNING row 를 건드리는 극단적 동시성 케이스에서만 이론상 lost-update 여지가 남는다.
  - 제안: 즉시 조치 불요. 후속 정리 시 `id + status='running'` 조건부 UPDATE(= `claimSpawnedRetryRow` 와 동일 패턴)로 통일하면 이 잔여 갭도 닫힌다.

- **[INFO]** JSONB 원자 claim/consume 의 실 Postgres 통합 검증은 여전히 부재 — 이번 커밋의 신규 유닛 테스트는 SQL 형태 회귀만 강화
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:538-552`(`claimSpawnedRetryRow`), `:202-236`(`retryLastTurn` atomic consume), `codebase/backend/src/modules/execution-engine/retry-turn.service.spec.ts:409-437`((b3) SET/WHERE SQL 형태 회귀 테스트)
  - 상세: `jsonb_exists(...)` + JSONB `-` 연산자 + `status = :running` 3중 조건의 단일-문 조건부 UPDATE 는 설계상 건전한 CAS(compare-and-swap) 패턴이다. 이번 세션에서 추가된 spec.ts 신규 테스트(claim 성공+in-memory `_retryState` 부재 방어 분기, `NODE_STARTED` payload 회귀)는 `createQueryBuilder` mock 으로 `affected` 값을 직접 하드코딩해 애플리케이션 분기 로직을 잠그지만, 실제 Postgres 가 이 3중 조건 조합과 동시 UPDATE 경합을 정확한 CAS 시맨틱으로 평가하는지는 mock 계층에서 원천적으로 검증 불가능하다. 이 갭은 `plan/in-progress/retry-turn-terminal-guard.md` 코드 표 #3/#15(P2)로 이미 추적 중이라 신규 발견은 아니다.
  - 제안: 별도 조치 불요(이미 추적 중). 후속 e2e/통합 스위트에서 실 Postgres 대상 동시 claim 경합 시나리오 1건 추가를 권장.

- **[INFO]** Raw SQL 문자열 보간(`RETRY_STATE_KEY`) — SQL 인젝션 벡터 아님 (재확인)
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:42`(상수 선언), `:213`/`:220`(`retryLastTurn` consume), `:544`/`:549`(`claimSpawnedRetryRow`)
  - 상세: `output_data - '${RETRY_STATE_KEY}'`, `jsonb_exists(input_data, '${RETRY_STATE_KEY}')` 처럼 raw SQL 문자열에 템플릿 리터럴로 값을 꽂는 형태라 정적 스캐너가 SQL 인젝션으로 오탐할 수 있다. 그러나 `RETRY_STATE_KEY` 는 모듈 top-level `const`(`'_retryState'`)로 요청 바디·DB 데이터 등 어떤 외부/가변 입력에서도 유래하지 않는 컴파일타임 고정 문자열이다. 실제 가변 값(`id`, `running`, `newFinishedAt`, `newDurationMs`)은 전부 `:id`/`:running`/`setParameter` 바인드 파라미터로 정상 파라미터화돼 있다(`retry-turn.service.ts:638-641` COALESCE 브랜치 포함).
  - 제안: 조치 불요.

## 요약

이번 세션은 프로덕션 코드(`retry-turn.service.ts`, 직전 커밋 `7a05c6ec8` 은 JSDoc 만 변경 — 로직은 `414550a1d` 이후 무변경)와 신규 유닛 테스트 2건이 추가된 `retry-turn.service.spec.ts` 를 데이터베이스 관점에서 재검토했다. 핵심 동시성 방어는 두 겹의 원자 조건부 UPDATE(CAS) — `retryLastTurn` 의 `_retryState` 소비(트랜잭션으로 감싼 consume+spawn, `:202-236`)와 `applyRetryLastTurn` 의 2차 claim(`claimSpawnedRetryRow`, `:538-552`) — 로 구성된다. 두 CAS 모두 PK(`id`) 단건 대상이라 인덱스 문제가 없고, execution/node 조회는 `Promise.all` 로 병렬화돼 N+1 이 없으며, 가변 값은 전부 파라미터화돼 SQL 인젝션 벡터가 없다. LLM 호출을 감싸는 장기 트랜잭션을 의도적으로 피하고 원자 SQL 문 자체로 CAS 를 구현해 커넥션 보유 시간을 최소화한 설계는 올바른 패턴이며, 이번 변경 범위에 스키마 변경(마이그레이션)은 전혀 없다. 커넥션은 NestJS DI 로 관리되고 `transaction()`/QueryBuilder 경유 호출이 예외 시에도 정상 롤백·반환되므로 누수 소지가 없다. 남은 항목은 전부 INFO 수준이며 모두 이전 라운드(`review/code/2026/07/30/11_41_20`)에서 이미 식별돼 프로젝트 plan 에 추적 중이거나 이번에 재확인만 한 것으로, 신규 Critical/Warning 급 결함은 없다 — (1) claim discard 이후 이론상 RUNNING orphan NodeExecution row 가 영구 잔류할 수 있는 백스톱 갭(저자가 실측·문서화, plan #15 P2), (2) execution/node not-found 시 잔존하는 무가드 full-entity `save()`(원자 claim 이 이미 배타 선점해 실제 위험 낮음), (3) JSONB CAS 의 실 Postgres 통합 테스트 부재(이번 커밋의 신규 유닛 테스트는 SQL 형태 회귀 커버리지만 강화). 이번 세션에서 추가된 두 테스트(claim 성공+in-memory 상태 불일치 방어 분기, NODE_STARTED payload 회귀)는 기존 원자 claim 보호를 무너뜨리지 않고 오히려 회귀 방지선을 강화한다.

## 위험도

LOW
