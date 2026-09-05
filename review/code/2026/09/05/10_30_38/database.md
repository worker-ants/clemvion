# Database Review

## 범위 확인

이번 changeset(63개 파일)에는 실행되는 SQL 마이그레이션 파일, ORM/쿼리 코드, 커넥션 설정,
트랜잭션 코드가 **전혀 포함되지 않는다**. 전부 문서/spec/plan/리뷰 산출물이다:

- `codebase/backend/migrations/README.md` — `CREATE INDEX CONCURRENTLY` 재실행 안전성에 관한
  마이그레이션 작성 컨벤션 보강(§5, "인덱스 교체는 DROP-먼저" 3-statement 패턴 신설)
- `spec/conventions/migrations.md` — 위 README §5 로의 포인터 4줄 추가
- `spec/conventions/spec-impl-evidence.md` — `code:` 필드 예외 조항 추가 (DB 무관)
- `spec/conventions/review-citations.md` — 리뷰 세션 인용 규약 신설 (DB 무관)
- `spec/data-flow/8-notifications.md` — V056 인덱스 교체 순서에 대한 각주(⚠️) 추가, DROP-먼저
  규약 신설을 소급 안내(append-only 인 V056 본문은 건드리지 않음)
- `plan/complete/spec-draft-migration-rerun-and-citations.md`,
  `plan/in-progress/spec-draft-nullable-notation-followups.md` — 위 결정의 배경/plan 추적
- `review/code/**`(`09_27_04`, `09_42_13`, `10_20_57` 세 라운드), `review/consistency/**`(네
  라운드) — 이 changeset 안에 포함된 이전 라운드 산출물. 전부 이 changeset 이 지금 심의 중인
  동일한 README.md §5 변경을 대상으로 이미 3회 독립적으로 database 리뷰(`09_27_04`, `09_42_13`,
  `10_20_57`)를 수행했고 세 라운드 모두 위험도 **NONE** 으로 수렴했다 — 리뷰 대상 코드 자체가
  아니라 메타 산출물.

신규 SQL 마이그레이션 파일은 이 changeset 에 없다.

## 검증 (기술적 정확성 — 직접 대조)

문서가 서술하는 DB 안전성 내용을 저장소의 실제 마이그레이션 파일과 직접 대조했다
(`git status --short` 로 확인 — 저장소 파일 수정 없음, read-only 검증만 수행):

- **V056** (`codebase/backend/migrations/V056__notification_active_partial_index.sql`):
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS ...` → `DROP INDEX CONCURRENTLY IF EXISTS
  idx_notification_user_read_created;` 2-statement, 0)단계(신규 이름 선-DROP) 없음. README §5
  표의 서술("진짜 교체, 0) 없음 → 재실행 시 인덱스 0개")과 **일치**.
- **V106** (`codebase/backend/migrations/V106__schedule_trigger_id_index.sql`):
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_schedule_trigger_id ON schedule (trigger_id);`
  단일 statement, 짝이 되는 `DROP` 없음(신규 추가, 주석 속 수동 롤백 문구만 존재). README §5
  표의 서술과 **일치**.
- **V110** (`codebase/backend/migrations/V110__schedule_workspace_next_run_index.sql`):
  `DROP INDEX CONCURRENTLY IF EXISTS idx_schedule_workspace_next_run;` →
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS ...` →
  `DROP INDEX CONCURRENTLY IF EXISTS idx_schedule_next_run;` 3-statement 순서. 신설
  규약("DROP-먼저")이 성문화하려는 선례와 **line-level 일치**. 파일 헤더 자체에 이미
  "0) 이 없으면 재실행이 위험하다"는 동일 설명(23_02_51 W1 인용)과 "비대칭 하나를
  감수한다"(23_26_09 W3) 서술이 포함돼 있어, README §5 신설분은 이 append-only 파일의
  주석을 사후에 저장소 전역 규약으로 승격한 것에 불과함을 확인.
- 원자성 논리 — 1) CREATE 가 실패해도 2) DROP(옛 인덱스) 전이므로 DB 는 "마이그레이션
  이전" 또는 "완료" 상태 중 하나이지 "쓸 수 있는 인덱스 0개"로 가지 않는다 — 는 PostgreSQL 의
  `CONCURRENTLY` 인덱스 생성 실패 시 `indisvalid=false` 로 이름을 점유한 채 남는 동작,
  `IF NOT EXISTS`/`IF EXISTS` 가 이름만 보고 유효성을 보지 않는 동작과 정합적이다. 기술적으로
  이상 없음.
- Flyway `mixed` 판정(transactional/non-transactional statement 혼재 시 거부, `.conf`
  `executeInTransaction=false` 로도 면제되지 않음) 서술은 이 reviewer 가 직접 재현하지는
  않았으나, PostgreSQL 의 "`CONCURRENTLY` 는 트랜잭션 안에서 실행 불가" 제약 및 Flyway 의
  "실패한 마이그레이션만 재실행" 동작과 모순되지 않고, 실측 근거가
  `plan/complete/spec-draft-migration-rerun-and-citations.md` §1.2 에 기록돼 있다 — 별도
  결정 항목(`mixed=true` 전역 도입 여부)으로 명시적으로 분리 등재되어 있어 이 PR 이 그 가드를
  임의로 완화하지 않는다는 점도 확인.
- `spec/conventions/migrations.md` 신규 4줄과 `spec/data-flow/8-notifications.md` 신규 각주는
  둘 다 원문을 복제하지 않고 README.md §5 로 포인터만 걸어, 향후 패턴이 다시 갈라질 이중 관리
  지점을 만들지 않는다.

## 발견사항

없음 — 실제로 실행되는 DB 코드 변경이 없고, 신설/보강된 마이그레이션 안전성 컨벤션 문서의
기술적 내용은 실제 마이그레이션 파일(V056/V106/V110) 대조로 정확함을 확인했다.
인덱스·N+1·트랜잭션·마이그레이션 락·스키마 설계·커넥션 관리·SQL 인젝션·대량 데이터
페이지네이션 어느 관점에서도 지적할 코드 변경이 없다.

동일 changeset 안에 이미 세 차례(`review/code/2026/09/05/09_27_04`, `09_42_13`, `10_20_57`)의
database reviewer 라운드가 있었고, 세 라운드 모두 이번에 검토한 것과 동일한 README.md §5
변경을 대상으로 위험도 NONE 으로 판정했다(초기 두 라운드가 남긴 "V056·V106 을 같은 위험군으로
뭉뚱그리는 서술" INFO 는 이후 README.md 본문이 표로 분리되며 이미 해소됨). 이번 라운드도
독립적으로 동일한 결론에 도달했다.

## 요약

이번 변경은 애플리케이션 DB 코드나 SQL 마이그레이션 파일 자체가 아니라, `CREATE INDEX
CONCURRENTLY` 기반 인덱스 교체의 재실행 안전성에 관한 운영 컨벤션 문서(README.md §5
"DROP-먼저" 패턴 신설 + `migrations.md`/`8-notifications.md` 포인터)와 그 배경 plan/review
산출물이다. 제시된 3-statement 패턴(DROP 새이름→CREATE→DROP 옛이름)은 PostgreSQL 이 실패한
`CONCURRENTLY` 인덱스를 `indisvalid=false` 상태로 이름 점유한 채 남기는 문제를 정확히
겨냥하며, 기존 선례(V110)와 line-level 일치를 직접 대조로 확인했고 V056(진짜 교체)·V106(신규
추가, 대응 DROP 없음)의 형태 구분도 실물과 일치한다. 실행되는 DB 코드 변경이 전혀 없으므로
인덱스/N+1/트랜잭션/락/커넥션/SQL 인젝션/대량 데이터 관점에서 실질적 위험은 없다.

## 위험도
NONE
