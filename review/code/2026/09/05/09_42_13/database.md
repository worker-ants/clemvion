# 데이터베이스(Database) 리뷰

## 범위 확인

이번 diff(21개 파일)는 실제 애플리케이션 코드나 SQL 마이그레이션 파일을 포함하지 않는다. 전부
문서/plan/리뷰 산출물이다:

- `codebase/backend/migrations/README.md` — 마이그레이션 작성 컨벤션 (§5 에 "인덱스 교체는
  DROP-먼저" 패턴 추가)
- `spec/conventions/migrations.md` — README §5 로의 포인터 한 줄 추가
- `spec/conventions/review-citations.md` — 신설(리뷰 인용 규약, DB 무관)
- `plan/complete/spec-draft-migration-rerun-and-citations.md` — 신설 planner draft
- `plan/in-progress/spec-draft-nullable-notation-followups.md` — 체크박스 반영
- `review/code/**`, `review/consistency/**` — 이전 라운드 산출물(리뷰 대상 아님, 메타)

즉 실행되는 SQL·ORM 쿼리·트랜잭션 코드·커넥션 설정은 **변경되지 않았다**. 다만 변경 내용
자체가 "`CREATE INDEX CONCURRENTLY` 재실행 안전성" 이라는 DB 마이그레이션 주제이므로, 문서가
주장하는 기술적 내용의 정확성을 실제 마이그레이션 파일과 대조 검증했다.

## 검증

- README §5 신설 표가 인용하는 `V056`(CREATE+DROP, 진짜 교체)·`V106`(CREATE 만, DROP 없음)의
  실제 SQL 을 열어 대조: 두 파일 모두 표의 서술과 **일치**한다.
  - `V056__notification_active_partial_index.sql`: `CREATE INDEX CONCURRENTLY ...` +
    `DROP INDEX CONCURRENTLY IF EXISTS idx_notification_user_read_created;`
  - `V106__schedule_trigger_id_index.sql`: `CREATE INDEX CONCURRENTLY ...` 만 있고 대응
    `DROP INDEX CONCURRENTLY` 없음(주석 속 수동 롤백 문구만 존재).
- 선례로 든 `V110__schedule_workspace_next_run_index.sql` 을 직접 읽어, 문서가 규약화한
  "DROP(새 이름, invalid 잔재 정리) → CREATE → DROP(옛 이름)" 3문장 순서와 실제 파일 내용이
  **일치**함을 확인했다. `DROP INDEX CONCURRENTLY IF EXISTS idx_schedule_workspace_next_run;` →
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS ...` → `DROP INDEX CONCURRENTLY IF EXISTS
  idx_schedule_next_run;` 순서로 실제 배치되어 있다.
- 순서의 원자성 논리(1단계 CREATE 실패 시 옛 인덱스가 아직 안 지워진 상태로 남는다 → "0개"
  상태로 가지 않는다)는 SQL 순서상 타당하다. `IF NOT EXISTS` 가 이름만 보고 `indisvalid` 를
  보지 않는다는 PostgreSQL 동작 설명도 정확하다.
- Flyway 의 mixed(transactional/non-transactional 혼합) 판정 관련 서술은 실측 근거
  (`plan/complete/spec-draft-migration-rerun-and-citations.md` §1.2)와 함께 기록되어 있고,
  README 본문 서술과 모순되지 않는다.

## 발견사항

없음. 이번 diff 로 인해 새로 실행되는 DB 코드가 없고, 추가된 마이그레이션 안전성 문서 내용은
실제 마이그레이션 파일(V056/V106/V110) 대조로 사실관계가 정확함을 확인했다. 인덱스/N+1/트랜잭션/
마이그레이션 락/스키마 설계/커넥션 관리/SQL 인젝션/대량 데이터 페이지네이션 어느 관점에서도
지적할 코드 변경이 없다.

## 요약

이번 변경은 DB 마이그레이션 컨벤션 문서(README.md §5)와 그에 대응하는 plan/spec 추적 문서만
건드리며, 실제 SQL 마이그레이션 파일이나 애플리케이션 DB 코드는 포함하지 않는다. 문서가 서술하는
"인덱스 교체 시 DROP-먼저" 재실행 안전 패턴은 기존 마이그레이션 파일(V056, V106, V110)과 대조한
결과 기술적으로 정확하며, 논리적 결함도 발견되지 않았다.

## 위험도

NONE
