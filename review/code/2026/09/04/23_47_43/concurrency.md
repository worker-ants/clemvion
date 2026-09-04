# 동시성(Concurrency) 코드 리뷰

## 검토 범위

실질 코드 변경은 다음 4개로 좁혀진다 (나머지 11개 파일은 plan/spec 문서, 이전 리뷰 라운드(`23_02_51`, `23_26_09`)와
consistency-check(`22_34_55`, `22_43_40`) 산출물이라 동시성 관점의 신규 점검 대상이 아니다):

- `codebase/backend/migrations/V110__schedule_workspace_next_run_index.sql` (신규)
- `codebase/backend/migrations/V110__schedule_workspace_next_run_index.conf` (신규, `executeInTransaction=false`)
- `codebase/backend/src/modules/schedules/schedules.service.spec.ts` (신규 unit test 1건)
- `codebase/backend/test/schedule-trigger.e2e-spec.ts` (신규 e2e test 2건: schema 검증 + `J.` 목록 조회)

애플리케이션 레벨의 락·스레드·async 로직(예: `schedules.service.ts`, `schedule-runner.service.ts`) 자체는 이번 diff 에
포함되지 않았다. 유일한 동시성 표면은 PostgreSQL `CREATE/DROP INDEX CONCURRENTLY` DDL 시퀀스다.

## 발견사항

- **[INFO]** `CREATE/DROP INDEX CONCURRENTLY` 3-statement 시퀀스의 원자성 결여는 이미 이번 changeset 안에서 정정되어 있음 (확인용 기재)
  - 위치: `codebase/backend/migrations/V110__schedule_workspace_next_run_index.sql` (`DROP INDEX CONCURRENTLY IF EXISTS idx_schedule_workspace_next_run;` → `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_schedule_workspace_next_run ...` → `DROP INDEX CONCURRENTLY IF EXISTS idx_schedule_next_run;`, 세 statement)
  - 상세: `executeInTransaction=false` 이므로 세 DDL 은 각각 독립 트랜잭션으로 실행되고, 배포 중단 등으로 특정 statement 에서 멈추면 그 시점 상태가 그대로 커밋된 채 남는다(비원자적 복합 연산). 헤더 주석(파일 내 `## IF NOT EXISTS 만으로는 재실행이 안전하지 않다` 절)이 이 창을 정확히 서술한다 — CREATE 가 중간 실패하면 `indisvalid=false` 인 invalid 인덱스가 이름을 점유하고, `IF NOT EXISTS` 는 이름 존재 여부만 보고 유효성은 안 보므로 그대로 재실행하면 뒤이은 DROP 이 옛 인덱스를 지워 "쓸 수 있는 인덱스 0개" 로 귀결될 수 있었다. 이번 diff 는 CREATE 앞에 같은 이름의 `DROP INDEX CONCURRENTLY IF EXISTS` 를 둬 첫 실행엔 no-op, 실패 후 재실행에서는 invalid 잔재를 청소하도록 만들었다(정상 첫 실행 → 실패 재현 → 정상 복구를 실제로 재현해 확인한 이력이 `review/code/2026/09/04/23_02_51/RESOLUTION.md` W1 에 있다). 남는 비대칭(정상 성공 후 Flyway 흐름 밖에서 수동 재실행하면 이미 유효한 인덱스를 재빌드해 그 구간만 seq scan 으로 회귀)도 주석·plan(`spec-draft-nullable-notation-followups.md` W3 절)에 명시돼 있고, Flyway 정상 흐름에서는 발생하지 않는 경로다.
  - 독립 확인: 세 statement 중 **마지막 DROP(옛 인덱스)** 이 중간 실패하는 경로는 기존 문서가 명시적으로 다루지 않지만, 결과적으로 새 인덱스는 이미 valid 상태로 남아 서빙을 계속하고 옛 인덱스만 "invalid" 로 남는다(PostgreSQL 공식 문서상 `DROP INDEX CONCURRENTLY` 중단 시의 표준 동작) — 이는 CREATE 실패 케이스보다 훨씬 덜 심각하고(성능 회귀 없음, 쓰기 오버헤드만 잔존), Flyway 가 실패로 기록해 재실행을 요구하면 0) 단계가 여전히 유효한 새 인덱스 이름을 타깃으로 삼지 않으므로(옛 인덱스 이름을 다시 시도) 자연히 정리된다. 별도 조치 불요, 참고로만 기재.
  - 제안: 조치 불요(이미 이번 diff 에서 해결됨). 다음에 유사 3-statement CONCURRENTLY 교체 패턴을 쓸 때 "마지막 DROP 실패" 케이스도 헤더 주석의 트레이드오프 표에 한 줄 추가하면 완전성이 올라간다.

- **[INFO]** Flyway 자체 동시 실행은 advisory lock 으로 직렬화되어 다중 배포 인스턴스 간 마이그레이션 레이스는 없음
  - 위치: `codebase/backend/migrations/V110__schedule_workspace_next_run_index.conf:4` (`executeInTransaction=false`), `codebase/backend/migrations/README.md` §4 (`FLYWAY_POSTGRESQL_TRANSACTIONAL_LOCK=false`)
  - 상세: 이 저장소는 이미 Dockerfile 에 `FLYWAY_POSTGRESQL_TRANSACTIONAL_LOCK=false` 를 박아 두어, schema-history 추적 락이 session-level advisory lock(`pg_advisory_lock`) 으로 폴백돼 있다 — README 가 명시하듯 이는 "transactional advisory lock 이 잡은 트랜잭션이 끝날 때까지 열려 있어 `CREATE/DROP INDEX CONCURRENTLY` 가 요구하는 '모든 백엔드의 transaction snapshot advance' 를 스스로 막아 무한 hang 하는" 문제를 이미 해결해 둔 것이다. V110 은 이 완화책을 그대로 상속받으며, 새로 도입하는 리스크가 아니다. 동시에 이 session lock 메커니즘 자체가, 두 개 이상의 배포 프로세스가 동시에 `flyway migrate` 를 실행해도 실제 마이그레이션 적용은 한 번에 하나만 진행되도록 직렬화한다 — V110 의 세 DDL 사이에 다른 Flyway 인스턴스가 끼어들어 같은 인덱스 이름을 두고 경쟁하는 시나리오는 없다.
  - 제안: 없음(확인용 기재). 단, PgBouncer transaction-pool 환경에서 마이그레이션을 돌리면 README 가 이미 경고하듯 session lock 이 statement 사이에 유실될 수 있다는 저장소 전체의 전제는 V110 에도 동일하게 적용된다 — 이번 PR 이 새로 만든 조건은 아니다.

- **[INFO]** 신규 e2e 테스트(`J.`)는 워크스페이스 스코프로 격리돼 있어 병렬 e2e 실행 시 다른 테스트 파일과 경쟁하지 않음
  - 위치: `codebase/backend/test/schedule-trigger.e2e-spec.ts` (신규 `it('J. 목록 조회 — 워크스페이스 격리 + next_run_at 정렬 ...')`)
  - 상세: 이 테스트가 생성하는 스케줄은 매번 `uniqueName(...)` 로 유일한 이름을 쓰고, 조회는 `X-Workspace-Id` 헤더로 스코프된 워크스페이스에 한정된다. 격리 검증 파트도 `createTeamWorkspace` 로 별도 신규 워크스페이스를 만들어 비교하므로, 같은 DB 를 공유하는 다른 e2e 스펙 파일이 동시에(또는 이전에) 만든 데이터와 뒤섞여 flaky 해질 여지가 없다. 같은 `describe` 블록 안의 선행 테스트들(A~I)이 같은 workflow/workspace 를 공유하지만 Jest 는 기본적으로 같은 파일 내 `it` 을 순차 실행하므로(`test.concurrent` 미사용) 레이스 조건은 없다.
  - 제안: 없음(확인용 기재).

## 요약

이번 changeset 이 건드리는 유일한 동시성 표면은 `schedule` 테이블 인덱스 교체(`V110`)를 위한 PostgreSQL
`CREATE/DROP INDEX CONCURRENTLY` DDL 시퀀스이며, 애플리케이션 레벨의 락·스레드·async/await·이벤트 루프·커넥션 풀
코드는 이번 diff 에 포함되지 않았다. 직전 리뷰 라운드(`23_02_51`)의 `side_effect` 리뷰어가 지적한 "CREATE 실패 후
재실행 시 invalid 인덱스가 남아 쓸 수 있는 인덱스가 0개가 될 수 있다"는 원자성/재실행 안전성 결함은 이번 diff 가
검토 대상으로 삼는 최종 상태에 이미 CREATE 앞 DROP 으로 반영·수정돼 있고, 그 수정 자체가 실패 상태를 재현해 검증한
이력(`RESOLUTION.md` W1)까지 남겨 근거가 탄탄하다. 남은 비대칭(성공 후 수동 재실행 시 재빌드 구간 seq scan)은
Flyway 정상 흐름에서 발생하지 않는 경로로 문서화돼 있고, 마지막 DROP(옛 인덱스) 단계가 단독으로 중간 실패하는
경로도 새 인덱스가 이미 valid 상태를 유지하므로 CREATE 실패보다 훨씬 완화된 결과로 귀결된다(자연 복구). Flyway
자체의 세션 레벨 advisory lock(README §4, 저장소 전역 완화책)이 다중 배포 인스턴스 간 마이그레이션 실행을 이미
직렬화하고 있어 V110 이 새로 노출하는 레이스도 없다. 신규 e2e 테스트도 워크스페이스 스코프로 격리돼 병렬 실행
안전성에 문제가 없다. 결론적으로 신규 CRITICAL/WARNING 급 동시성 결함은 발견되지 않았다.

## 위험도

NONE
