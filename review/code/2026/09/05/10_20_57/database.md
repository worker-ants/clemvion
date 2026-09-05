# Database Review

## 범위 확인

이번 changeset(56개 파일)에는 **실행되는 SQL 마이그레이션 파일, ORM/쿼리 코드, 커넥션 설정, 트랜잭션 코드**가 전혀 포함되지 않는다. 전부 문서/spec/plan/리뷰 산출물이다:

- `codebase/backend/migrations/README.md` — `CREATE INDEX CONCURRENTLY` 재실행 안전성에 관한 마이그레이션 작성 컨벤션 보강(§5, "인덱스 교체는 DROP-먼저" 3-statement 패턴 신설)
- `spec/conventions/migrations.md` — 위 README §5 로의 포인터 한 줄 추가
- `spec/conventions/review-citations.md` — 리뷰 세션 인용 규약 신설 (DB 무관)
- `spec/conventions/spec-impl-evidence.md` — `code:` 필드 예외 조항 추가 (DB 무관)
- `spec/data-flow/8-notifications.md` — V056 인덱스 교체 순서에 대한 각주(⚠️) 추가, DROP-먼저 규약 신설을 소급 안내
- `plan/complete/spec-draft-migration-rerun-and-citations.md`, `plan/in-progress/spec-draft-nullable-notation-followups.md` — 위 결정의 배경/plan 추적
- `review/code/**`, `review/consistency/**` 다수 — 이전 라운드(`09_27_04`, `09_42_13`, consistency 4라운드) 산출물, 리뷰 대상 아님(메타)

## 검증 (기술적 정확성)

문서가 서술하는 DB 안전성 내용을 저장소의 실제 마이그레이션 파일과 독립적으로 대조했다 (`git status --short` 로 확인 — 저장소 파일 수정 없음, read-only 검증만 수행):

- **V056** (`codebase/backend/migrations/V056__notification_active_partial_index.sql`): `CREATE INDEX CONCURRENTLY IF NOT EXISTS ...` → `DROP INDEX CONCURRENTLY IF EXISTS idx_notification_user_read_created;` 2-statement, 0)단계(신규 이름 선-DROP) 없음. README §5 표의 서술("진짜 교체, 0) 없음 → 재실행 시 인덱스 0개")과 **일치**.
- **V106** (`codebase/backend/migrations/V106__schedule_trigger_id_index.sql`): `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_schedule_trigger_id ON schedule (trigger_id);` 단일 statement, 짝이 되는 `DROP` 없음(신규 추가). README §5 표의 서술과 **일치**.
- **V110** (`codebase/backend/migrations/V110__schedule_workspace_next_run_index.sql`): `DROP INDEX CONCURRENTLY IF EXISTS idx_schedule_workspace_next_run;` → `CREATE INDEX CONCURRENTLY IF NOT EXISTS ...` → `DROP INDEX CONCURRENTLY IF EXISTS idx_schedule_next_run;` 3-statement 순서. 신설 규약("DROP-먼저")이 성문화하려는 선례와 **line-level 일치**.
- 원자성 논리 — 1) CREATE 가 실패해도 2) DROP(옛 인덱스) 전이므로 DB 는 "마이그레이션 이전" 또는 "완료" 상태 중 하나이지 "쓸 수 있는 인덱스 0개"로 가지 않는다 — 는 PostgreSQL 의 `CONCURRENTLY` 인덱스 생성 실패 시 `indisvalid=false` 로 이름을 점유한 채 남는 동작, `IF NOT EXISTS`/`IF EXISTS` 가 이름만 보고 유효성을 보지 않는 동작과 정합적이다. 기술적으로 이상 없음.
- Flyway `mixed` 판정(transactional/non-transactional statement 혼재 거부)과 그로 인해 "`indisvalid` 분기 `DO` 블록" 형태가 봉쇄된다는 서술도 Flyway 의 알려진 동작과 모순되지 않는다(이 reviewer 는 실제 Flyway 실행으로 재현하지는 않았으나, 논리 자체는 일관적이고 별도로 실측 근거가 `plan/complete/spec-draft-migration-rerun-and-citations.md` §1.2 에 기록돼 있다).

## 발견사항

없음 — 실제로 실행되는 DB 코드 변경이 없고, 신설/보강된 마이그레이션 안전성 컨벤션 문서의 기술적 내용은 실제 마이그레이션 파일(V056/V106/V110) 대조로 정확함을 확인했다. 인덱스·N+1·트랜잭션·마이그레이션 락·스키마 설계·커넥션 관리·SQL 인젝션·대량 데이터 페이지네이션 어느 관점에서도 지적할 코드 변경이 없다.

동일 changeset 안에 이미 두 차례(`review/code/2026/09/05/09_27_04`, `09_42_13`)의 database reviewer 라운드가 있었고, 두 라운드 모두 V056/V106 일반화 서술 정밀도에 대한 INFO 만 남겼으며 해당 문구는 이번 최종본(README.md §5 표 분리)에서 이미 해소되어 있다. `plan/complete/` 부록 A/B 가 README/`review-citations.md` 최종본과 어긋난다는 지적은 documentation reviewer 영역(문서 정합성)이며 DB 기술 내용 자체의 정확성 문제는 아니다.

## 요약

이번 변경은 애플리케이션 DB 코드나 SQL 마이그레이션 파일 자체가 아니라, `CREATE INDEX CONCURRENTLY` 기반 인덱스 교체의 재실행 안전성에 관한 운영 컨벤션 문서(README.md §5 "DROP-먼저" 패턴 신설 + `migrations.md`/`8-notifications.md` 포인터)와 그 배경 plan/review 산출물이다. 제시된 3-statement 패턴은 PostgreSQL 의 "실패한 CONCURRENTLY 인덱스가 이름을 점유한 채 invalid 로 남는" 문제를 정확히 겨냥하며, 기존 선례(V110)와 line-level 일치를 직접 대조로 확인했다. 실행되는 DB 코드 변경이 전혀 없으므로 인덱스/N+1/트랜잭션/락/커넥션/SQL 인젝션/대량 데이터 관점에서 실질적 위험은 없다.

## 위험도
NONE
