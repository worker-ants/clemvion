# 데이터베이스(Database) Review

## 범위 확인

이번 diff(70개 파일)에는 실행되는 SQL 마이그레이션 파일이나 ORM/쿼리/트랜잭션/커넥션 관련 애플리케이션 코드가 전혀 포함되지 않는다. `codebase/` 아래에서 변경된 파일은 `codebase/backend/migrations/README.md` 단 하나(문서, +39/-3)이며, 그 외 전부는 `spec/**`, `plan/**`, `review/**` 아래의 spec 문서·plan 트래커·이전 리뷰 라운드(`09_27_04`, `09_42_13`, `10_20_57`, `10_30_38`, consistency 4라운드) 산출물이다.

- `codebase/backend/migrations/README.md` §5 — `CREATE INDEX CONCURRENTLY` 인덱스 교체 시 "DROP-먼저" 3-statement 패턴을 컨벤션으로 성문화. 재실행 시 `IF NOT EXISTS`가 이름만 보고 `indisvalid`를 보지 않아 인덱스 0개로 귀결되는 문제에 대한 처방.
- `spec/conventions/migrations.md` — 위 README §5로의 포인터 한 줄.
- `spec/data-flow/8-notifications.md` — V056 인덱스 순서에 대한 소급 각주(⚠️), V056 자신은 append-only라 미수정.
- `spec/conventions/review-citations.md`, `spec/conventions/spec-impl-evidence.md` — DB 무관 규약 문서.
- 나머지 `review/code/**`, `review/consistency/**` 다수 — 이전 라운드 산출물(메타), 이번 라운드의 리뷰 대상이지 DB 코드가 아님.

## 검증

- `git diff --stat origin/main -- codebase/` 로 재확인: `codebase/` 변경은 `migrations/README.md` 1개 파일뿐(신규 SQL 파일 없음).
- 이 changeset에 포함된 이전 database reviewer 라운드 3회(`09_27_04/database.md`, `09_42_13/database.md`, `10_20_57/database.md`)가 각각 독립적으로 실물 마이그레이션 파일 `V056__notification_active_partial_index.sql`(CREATE+DROP, 진짜 교체, DROP-먼저 없음 → 재실행 시 인덱스 0개), `V106__schedule_trigger_id_index.sql`(단일 CREATE, 짝 DROP 없음 → invalid가 영구 고착), `V110__schedule_workspace_next_run_index.sql`(DROP→CREATE→DROP, 신설 규약의 line-level 선례)을 대조해 README §5 서술과 일치함을 확인해 두었다. 이번 라운드에서 다시 열어 반증하려 했으나 새로 발견되는 불일치는 없다.
- 8개 관점(인덱스/N+1/트랜잭션/마이그레이션 안전성/스키마 설계/커넥션 관리/SQL 인젝션/대량 데이터) 중 실제 코드 변경이 있는 것은 "마이그레이션 안전성" 하나뿐이고, 그 변경은 컨벤션 **문서**이지 실행되는 마이그레이션 SQL이 아니다. 문서가 서술하는 기술적 내용(`CONCURRENTLY` 실패 시 `indisvalid=false`로 이름 점유, `IF NOT EXISTS`/`IF EXISTS`가 유효성을 안 봄, Flyway가 실패한 마이그레이션만 재실행)은 PostgreSQL/Flyway 알려진 동작과 정합적이며 이전 라운드들이 이미 이 정합성을 실물 대조로 검증했다.

저장소 트리에는 아무것도 쓰지 않았다(read-only 검증만 수행, `git status --short` 확인 결과 이 세션 산출물 디렉터리 외 변경 없음).

## 발견사항

없음. 실행되는 DB 코드(마이그레이션 SQL, 쿼리, 트랜잭션, 커넥션 설정)에 대한 변경이 없으므로 인덱스·N+1·트랜잭션·마이그레이션 안전성(lock/데이터 손실)·스키마 설계·커넥션 관리·SQL 인젝션·대량 데이터/페이지네이션 어느 관점에서도 지적할 대상이 없다.

## 요약

이번 변경은 애플리케이션 DB 코드나 SQL 마이그레이션 파일이 아니라, `CREATE INDEX CONCURRENTLY` 기반 인덱스 교체의 재실행 안전성에 관한 운영 컨벤션 문서(`migrations/README.md` §5 "DROP-먼저" 3-statement 패턴 신설 + `spec/conventions/migrations.md`·`spec/data-flow/8-notifications.md` 포인터/각주)와 그 배경을 정리한 plan/review 산출물이다. 실물 마이그레이션 파일(V056/V106/V110) 대조는 이 changeset에 포함된 이전 세 차례 database reviewer 라운드가 이미 수행했고 서술과 일치함을 확인했으며, 이번 라운드에서 재확인해도 새로운 불일치나 기술적 오류는 없다. 실행되는 DB 코드 변경이 전혀 없으므로 위험은 없다.

## 위험도
NONE
