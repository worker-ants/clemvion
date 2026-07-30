# Database Review — retry_last_turn 2차 claim 삽입 위치 수정

## 발견사항

- **[INFO]** `applyRetryLastTurn` 의 두 not-found 방어 분기가 여전히 무가드 full-entity `save()` 사용
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:364-374`(execution not found), `:376-386`(node not found)
  - 상세: 이번 커밋이 고친 CRITICAL #1(claim 을 손상 판정보다 앞으로 재배치)·CRITICAL #2(`delete spawnedRow.inputData[RETRY_STATE_KEY]` 로 stale 부활 차단)는 정확히 대상 범위를 겨냥해 해소됐다. 다만 claim 성공 이후 execution/node not-found 시 `spawnedRow.status = FAILED` 를 세팅하고 `nodeExecutionRepository.save(spawnedRow)`(조건 없는 full-entity save)로 커밋하는 패턴 자체는 이번 diff 의 수정 대상이 아니며 그대로 남아 있다. 같은 파일에서 `Execution` 엔티티 종결 경로(`finalizeGuarded`, 3~4차 라운드에서 이미 "정본 재조회 + 조건부 UPDATE" 가드로 전환됨)와 대조하면, `NodeExecution` 쪽은 여전히 stale in-memory 값으로 덮어쓰는 구식 패턴이다. 다만 실제 위험은 낮다 — 트리거 조건(참조하는 Execution/Node row 자체가 DB 에 없음)이 사실상 발생하지 않는 edge case 이고, 원자 claim 이 이미 이 row 를 배타적으로 선점했으므로 동일 retry 배달 경로끼리는 충돌하지 않는다. `markNodeCancelled` 류 다른 종결 경로가 동일 시점에 같은 RUNNING NodeExecution row 를 건드리는 극단적 동시성 케이스에서만 이론상 lost-update 여지가 남는다.
  - 제안: 즉시 조치는 불요. 후속 정리 시 `id + status='running'` 조건부 UPDATE(= `claimSpawnedRetryRow` 와 동일 패턴)로 통일하면 이 잔여 gap 도 닫힌다.

- **[INFO]** JSONB 원자 claim/consume SQL 의 실 Postgres 통합 검증 부재 (이미 plan 추적 중, 신규 아님)
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:520-534`(`claimSpawnedRetryRow`), `:204-233`(`retryLastTurn` atomic consume 트랜잭션)
  - 상세: `jsonb_exists(...)` + JSONB `-` 연산자 + `status = :running` 3중 조건의 단일-문 조건부 UPDATE 는 설계상 건전한 CAS(compare-and-swap) 패턴이다. 그러나 유닛 테스트는 `createQueryBuilder` mock 으로 `affected` 값을 직접 하드코딩해 분기를 검증하므로, 실제 Postgres 가 이 3중 조건 조합·동시 UPDATE 경합을 정확한 시맨틱으로 평가하는지는 mock 계층에서 원천적으로 검증 불가능하다. 이 갭은 `plan/in-progress/retry-turn-terminal-guard.md` 코드 표 #3/#15(P2)로 이미 추적되고 있어 신규 발견이 아니다.
  - 제안: 별도 조치 불요(이미 추적 중). 후속 e2e/통합 스위트에서 실 Postgres 대상으로 두 delivery 가 같은 spawned row 를 놓고 경합하는 시나리오 1건을 추가하면 이 갭이 닫힌다.

- **[INFO]** `RETRY_STATE_KEY` 상수의 raw SQL 문자열 보간 — SQL 인젝션 벡터 아님(점검 결과 기록)
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:42`(상수 선언), `:210,217`(`retryLastTurn` 소비), `:526,531`(`claimSpawnedRetryRow`)
  - 상세: `input_data - '${RETRY_STATE_KEY}'`, `jsonb_exists(input_data, '${RETRY_STATE_KEY}')` 처럼 raw SQL 문자열에 템플릿 리터럴로 값을 꽂는 형태라 정적 스캐너가 SQL 인젝션으로 오탐할 수 있다. 그러나 `RETRY_STATE_KEY` 는 모듈 top-level `const`(`'_retryState'`, 이번 커밋에서 4곳 리터럴 중복을 상수로 통합)로, 요청 바디·DB 데이터 등 어떤 외부/가변 입력에서도 유래하지 않는 컴파일타임 고정 문자열이다. 반면 실제 가변 값(`id`, `running`)은 전부 `:id`/`:running` 바인드 파라미터로 정상 파라미터화돼 있다. 인젝션 위험 없음.
  - 제안: 조치 불요.

## 요약

이번 변경(`414550a1d`, `b351731f0` 위에 적층)은 `applyRetryLastTurn` 재진입 가드의 **삽입 위치 결함 2건**을 정밀 타겟팅한 concurrency-correctness 수정이다 — (1) 손상 판정("`_retryState` 부재 → FAILED")이 원자 claim 보다 먼저 실행돼, claim 이 정상적으로 만들어내는 상태(다른 delivery 가 이미 가져가 `_retryState` 만 사라진 살아있는 RUNNING row)를 오판해 덮어쓰던 결함, (2) claim 이 DB `input_data` 에서만 키를 지우고 in-memory `spawnedRow` 는 stale 로 남아, 후속 `save()` 가 TypeORM jsonb diff 로 지워진 키를 부활시키던 결함. 핵심 메커니즘 — `id`(PK) + `status='running'` + `jsonb_exists(...)` 3중 조건의 단일-문 조건부 UPDATE(`claimSpawnedRetryRow`, `retryLastTurn` 의 consume 과 동형) — 는 Postgres 상에서 진짜 원자적 CAS 이며, 별도 트랜잭션 래핑 없이도(LLM 호출을 감싸는 장기 트랜잭션을 의도적으로 회피) 데이터 정합성을 보장하는 올바른 패턴이다. claim 직후 `delete spawnedRow.inputData[RETRY_STATE_KEY]` 한 줄이 이 메서드의 모든 하위 `save()` 호출의 stale-resurrection 위험을 구조적으로 차단한다. 점검 관점별로: 인덱스는 전부 PK(`id`) 단건 조회/UPDATE 라 문제 없고, N+1 은 없으며(`Promise.all` 로 execution/node 조회를 올바르게 병렬화), `retryLastTurn` 의 consume+spawn 은 여전히 단일 트랜잭션으로 원자성이 보장된다. 스키마 변경(마이그레이션)은 없고, `input_data`/`output_data` 컬럼은 이미 `jsonb` 타입이라 `jsonb_exists`/`-` 연산자 사용에 문제 없다. 커넥션은 NestJS 주입 Repository/DataSource 경유로 관리돼 누수 소지가 없다. SQL 인젝션 벡터도 없다(가변 값은 전부 파라미터화, 보간되는 상수는 컴파일타임 고정값). 대량 데이터/페이지네이션 관점은 해당 코드 경로가 전부 단건 PK 조회라 논외다. 남은 항목은 전부 INFO 수준으로, 이미 프로젝트 plan(`retry-turn-terminal-guard.md`)에 추적 중인 실-Postgres 검증 갭과, 이번 diff 범위 밖의 pre-existing 무가드 `NodeExecution` full-entity save 패턴(발생 확률 극히 낮은 edge case)뿐이다. CRITICAL/WARNING 급 신규 결함은 발견되지 않았다.

## 위험도

LOW
