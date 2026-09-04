# 데이터베이스(Database) 코드 리뷰

## 발견사항

- **[INFO]** `CREATE INDEX CONCURRENTLY IF NOT EXISTS` 재시도 시 "invalid" 인덱스가 조용히 남을 수 있음
  - 위치: `codebase/backend/migrations/V110__schedule_workspace_next_run_index.sql:35-38`
  - 상세: 헤더 주석(L29-33)은 "IF NOT EXISTS / IF EXISTS 로 CONCURRENTLY 실패 후 부분 상태에서도 재실행 안전" 이라고 적는다. 그러나 PostgreSQL 의 `CREATE INDEX CONCURRENTLY` 가 스캔 도중 실패하면(락 타임아웃·배포 중단 등) 카탈로그에 이름은 남지만 `indisvalid=false` 인 "invalid" 인덱스가 생긴다. 그 상태에서 마이그레이션을 재실행하면 `IF NOT EXISTS` 가 **이름이 이미 존재한다는 이유로 재생성을 건너뛰고 에러 없이 종료**한다 — Flyway 는 이를 "성공"으로 기록하지만 실제로는 인덱스가 영구적으로 invalid 인 채(쓰기 유지비용만 지불하고 조회에는 쓰이지 않음) 남는다. 신규 e2e 테스트(`schedule-trigger.e2e-spec.ts` L64-82)가 `indisvalid=true` 를 단언해 CI 의 정상 1회 실행에서는 이 상태를 잡아내지만, 운영 배포 중 인터럽트→재시도 시나리오까지 커버하지는 못한다.
  - 제안: 이번 PR 을 막을 사유는 아니다 — 동일 패턴이 `V056`(`idx_notification_user_read_created_active`)·`V106` 에서 이미 선례로 쓰였고 새로 도입된 리스크가 아니다. 다만 `codebase/backend/migrations/README.md` §5 또는 `spec/conventions/migrations.md` 에 "CONCURRENTLY 실패 후 재실행 전 `SELECT indisvalid FROM pg_index ...` 로 invalid 여부를 먼저 확인하고, invalid 면 `DROP INDEX CONCURRENTLY` 로 정리한 뒤 재실행" 이라는 운영 런북 한 줄을 남기면 이 저장소 전체의 CONCURRENTLY 패턴(V022/V030/V034/V047/V048/V056/V072/V086/V095/V106/V109/V110 등)에 공통으로 도움이 된다. 이번 PR 범위 밖의 repo-wide 후속으로 적합.

- **[INFO]** 인덱스 교체 순서·비-트랜잭션 설정·재실행 관례는 정확함 (확인용 기재)
  - 위치: `codebase/backend/migrations/V110__schedule_workspace_next_run_index.sql:35-38`, `V110__schedule_workspace_next_run_index.conf:4`
  - 상세: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_schedule_workspace_next_run` 를 **먼저**, `DROP INDEX CONCURRENTLY IF EXISTS idx_schedule_next_run` 를 **나중**에 실행해 어느 시점에도 `workspace_id` 진입 경로가 끊기지 않는다. `.conf` 의 `executeInTransaction=false` 는 두 CONCURRENTLY 문 모두에 필요하며 정확히 설정돼 있다. `V002__indexes.sql:30` 의 실제 인덱스명(`idx_schedule_next_run`)과 DROP 대상명이 정확히 일치함을 grep 으로 직접 확인했다. `codebase/backend/migrations/README.md` §5 의 "한 파일에 CREATE INDEX CONCURRENTLY 정확히 한 개" 컨벤션도, 이 파일이 CREATE 1개 + DROP 1개(둘 다 non-transactional, 서로 다른 statement 종류)라 위반이 아니며 `V056` 선례와 동일 형태다. 실 결함 아님 — 근거를 남기기 위해 기재.

- **[INFO]** 인덱스 선택 근거가 `EXPLAIN (ANALYZE, BUFFERS)` 실측 + 반복 median 으로 뒷받침됨
  - 위치: `plan/in-progress/spec-draft-schedule-index.md` (Q1 200,000행/5,000행 표), `codebase/backend/migrations/V110__schedule_workspace_next_run_index.sql:14-27`
  - 상세: 후보 (a) 인덱스 없음 / (b) `(next_run_at)` 단일 / (c) `(workspace_id, next_run_at)` / (d) `(workspace_id)` 단일을 실측 비교했고, "정렬 컬럼을 선두에 두면 오히려 2.2배 느려진다"는 직관에 반하는 결과까지 `EXPLAIN` 계획(Index Scan Backward, 버려진 행 수)으로 근거를 남겼다. 최초 단발 실행값(31배)이 반복 구간 끝값이었음을 스스로 지적하고 5회 반복 median(20배)으로 정정한 이력도 문서에 남아 있다 — 수치 근거의 신뢰도가 높다.

- **[INFO]** consistency-check 가 지적한 미러 문서·plan 동기화 WARNING 2건은 이 changeset 안에서 이미 해소됨
  - 위치: `spec/data-flow/10-triggers.md:175`, `plan/in-progress/spec-draft-nullable-notation-followups.md` (L379-397, L434 종결조건 표)
  - 상세: `review/consistency/2026/09/04/22_34_55/SUMMARY.md` 는 (1) `spec/1-data-model.md` 인덱스 정정이 미러 문서 `spec/data-flow/10-triggers.md:175` 에 반영 안 됨, (2) 소스 plan 의 열린 항목이 결론을 반영 못함 을 WARNING 으로 지적했다. 직접 대조한 결과 두 파일 모두 **이번 diff 안에서 이미 갱신**돼 있다 — `10-triggers.md:175` 는 `(workspace_id, next_run_at)` 로, `spec-draft-nullable-notation-followups.md` 항목은 "실측 완료, 답은 (c)" 로 정정되고 트랙도 `developer/DBA`→`developer` 로 조정됐다. DB 관점에서 스키마 서술과 실제 마이그레이션 사이의 drift 위험은 해소된 상태.

## 요약

이 changeset 의 핵심은 Postgres 인덱스 교체 마이그레이션(`V110`)이다. `schedule` 목록 조회(`WHERE workspace_id = ? ORDER BY next_run_at DESC LIMIT 20`)가 어떤 인덱스도 못 쓰고 매번 전 테이블 Parallel Seq Scan 을 하고 있었다는 사실을 `EXPLAIN (ANALYZE, BUFFERS)` 로 직접 실측하고, 쓰이지 않던 부분 인덱스(`(next_run_at, is_active) WHERE is_active`)를 실제 접근 패턴에 맞는 `(workspace_id, next_run_at)` 로 교체한다(200,000행 기준 5.99ms→0.30ms, 20배). 마이그레이션은 `CREATE INDEX CONCURRENTLY` → `DROP INDEX CONCURRENTLY` 순서, `IF NOT EXISTS`/`IF EXISTS`, `.conf` 의 `executeInTransaction=false` 를 모두 이 저장소의 기존 선례(V056)와 동일하게 올바르게 적용해 무중단·재실행 안전성 요건을 충족한다. 인덱스 크기 증가는 +2.6MB 로 무시할 수준이고, 신규 e2e 테스트가 신규 인덱스의 존재·컬럼 순서·비-부분 여부와 구 인덱스의 부재를 양방향으로 검증한다. SQL 인젝션·N+1·트랜잭션·커넥션 관리 관점에서 새로 도입된 문제는 없다. 유일하게 남는 것은 CONCURRENTLY 마이그레이션 일반에 내재한 "실패 후 재시도 시 invalid 인덱스가 조용히 남을 수 있다"는 운영 리스크인데, 이는 이 PR 이 새로 만든 것이 아니라 저장소 전체에 걸친 기존 패턴(V056/V106 등)의 연장이라 이 PR 을 막을 사유는 아니며 INFO 로만 남긴다. consistency-check 가 지적했던 미러 문서·plan 동기화 WARNING 2건도 이 changeset 안에서 이미 해소되어 있음을 직접 대조로 확인했다.

## 위험도
LOW
