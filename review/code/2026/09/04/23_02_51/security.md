# 보안(Security) 코드 리뷰

## 검토 범위

- `codebase/backend/migrations/V110__schedule_workspace_next_run_index.conf` (신규)
- `codebase/backend/migrations/V110__schedule_workspace_next_run_index.sql` (신규 — `schedule` 인덱스 교체)
- `codebase/backend/test/schedule-trigger.e2e-spec.ts` (e2e 스키마 검증 테스트 추가)
- `plan/in-progress/spec-draft-nullable-notation-followups.md`, `plan/in-progress/spec-draft-schedule-index.md` (planner 문서)
- `review/consistency/2026/09/04/22_34_55/**` (consistency-checker 산출물, 문서)
- `spec/1-data-model.md`, `spec/data-flow/10-triggers.md` (spec 표 정정 — 인덱스 컬럼 서술 변경 1줄씩)

전체 changeset 은 DB 인덱스 교체 마이그레이션 + 이를 검증하는 e2e 테스트 + 관련 planning/spec 문서로 구성되며, 신규 API 엔드포인트·인증 로직·사용자 입력 처리 코드는 포함되지 않는다.

### 발견사항

(없음)

검토 관점별로 다음을 확인했으며 해당 사항이 없었다:

- **인젝션**: `V110__schedule_workspace_next_run_index.sql` 은 `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_schedule_workspace_next_run ON schedule (workspace_id, next_run_at);` / `DROP INDEX CONCURRENTLY IF EXISTS idx_schedule_next_run;` 로 전부 정적 리터럴 DDL이며 사용자 입력이나 동적 문자열 결합이 없다. e2e 테스트(`schedule-trigger.e2e-spec.ts` 신규 `it` 블록)의 `db.query(...)` 도 리터럴 SQL만 사용하고, 기존 테스트의 다른 쿼리들은 이미 파라미터 바인딩(`$1`)을 쓰고 있어 패턴 일탈이 없다.
- **하드코딩된 시크릿**: 신규/변경 코드에 API 키·비밀번호·토큰 없음. `spec-draft-schedule-index.md` 부록의 `docker run ... -e POSTGRES_PASSWORD=probe ...` 는 로컬 일회용 실측 재현 컨테이너용 더미 값이며 실제 운영 자격증명이 아니고 실행 가능한 코드/설정 파일에도 포함돼 있지 않다(문서 내 예시 명령).
- **인증/인가**: 이번 변경은 인덱스 컬럼 순서 교체(`(next_run_at, is_active)` → `(workspace_id, next_run_at)`)이며 조회 쿼리의 `WHERE` 조건(`workspace_id = ?`)이나 컨트롤러의 인가 로직 자체를 바꾸지 않는다. 워크스페이스 스코핑 필터는 기존 그대로 유지된다.
- **비-트랜잭션 마이그레이션(`executeInTransaction=false`) 안전성**: `CREATE/DROP INDEX CONCURRENTLY` 는 Postgres 트랜잭션 블록 안에서 실행 불가하므로 Flyway 설정이 맞다. `IF NOT EXISTS`/`IF EXISTS` 로 재실행 안전성을 확보했고, 새 인덱스를 먼저 만들고 옛 인덱스를 나중에 지우는 순서(create-then-drop)라 중간 실패 시에도 조회 경로가 인덱스 없는 상태로 완전히 노출되는 창은 최소화돼 있다. DoS/가용성 관점에서 특기할 문제는 없다.
- **입력 검증**: 변경된 코드 경로에 신규 사용자 입력 처리가 없다.
- **암호화/평문 전송**: 해당 없음(DDL/문서 변경).
- **에러 처리**: 해당 없음 — 신규 에러 경로 없음.
- **의존성 보안**: 신규 패키지/라이브러리 도입 없음.

## 요약

이번 changeset 은 `schedule` 테이블의 미사용 부분 인덱스를 `(workspace_id, next_run_at)` 복합 인덱스로 교체하는 DB 마이그레이션과 이를 검증하는 e2e 테스트, 그리고 관련 spec/plan 문서 갱신으로 구성된다. 마이그레이션 SQL 은 전부 정적 DDL 로 인젝션 표면이 없고, 비-트랜잭션 실행에 필요한 `executeInTransaction=false` 설정과 `IF NOT EXISTS`/`IF EXISTS` 를 통한 재실행 안전성도 갖춰져 있다. 신규 인증/인가 로직, 사용자 입력 처리, 시크릿, 암호화 관련 코드가 전혀 포함되지 않아 보안 관점에서 우려되는 지점을 발견하지 못했다.

## 위험도

NONE
