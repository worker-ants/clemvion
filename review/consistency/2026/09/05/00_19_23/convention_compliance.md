# 정식 규약 준수 검토

## 검토 대상

- `spec/1-data-model.md` §3 인덱스 전략(Schedule 행 2건) + Rationale 신규 서브섹션 "Schedule 인덱스 `(next_run_at, is_active)` → `(workspace_id, next_run_at)` (2026-09-04)"
- `spec/data-flow/10-triggers.md` §2.1 Schema 매핑(`schedule` 발사 후 UPDATE 행)
- 뒷받침 구현: `codebase/backend/migrations/V110__schedule_workspace_next_run_index.{sql,conf}`, `schedules.service.spec.ts`, `test/schedule-trigger.e2e-spec.ts`
- 적용 정식 규약: `spec/conventions/migrations.md` + `codebase/backend/migrations/README.md`(migrations.md §참고가 지목하는 실제 작성 가이드 SoT). 그 외 `spec/conventions/*`(swagger·error-codes·redis-keys 등) 는 이 델타(신규 API 표면·에러 코드·큐 없음)와 무관해 해당 없음으로 판단.

## 발견사항

- **[INFO]** 새 재실행-안전 DROP 패턴이 컨벤션 문서에는 아직 미반영
  - target 위치: `codebase/backend/migrations/V110__schedule_workspace_next_run_index.sql` 상단 주석 "## `IF NOT EXISTS` 만으로는 재실행이 안전하지 않다" 및 `DROP INDEX CONCURRENTLY IF EXISTS idx_schedule_workspace_next_run;` (CREATE 앞 선행 DROP)
  - 위반 규약: `codebase/backend/migrations/README.md` §5 "executeInTransaction=false 파일은 한 statement 만" — 문면상 "`CREATE INDEX CONCURRENTLY` 를 정확히 한 개만" 요구이며 DROP 개수는 제한하지 않으므로 **직접 위반은 아님**. 다만 이 파일이 도입한 "실패 후 재실행 시 invalid 잔재를 치우는 선행 DROP" 패턴은 선례 V056/V106 에는 없던 것으로, `migrations.md`/README 어디에도 아직 규칙화되어 있지 않다.
  - 상세: SQL 파일 자체가 "선례 V056/V106 은 이 줄이 없다 — 같은 위험이 남아 있으므로 규약 차원의 처리는 후속으로 등재했다" 라고 명시하여 이 갭을 스스로 인지·기록했다. 실제로 `plan/in-progress/spec-draft-nullable-notation-followups.md` (line ~397) 에 후속 항목으로 등재되어 있음을 확인했다 — 고아 상태가 아니다.
  - 제안: 별도 조치 불필요. 후속 plan 항목이 실행되어 `migrations.md`/README §5 가 이 패턴을 정식화할 때, 기존 CONCURRENTLY 마이그레이션(V022/V023/V026/V056/V106 등)에도 소급 적용할지 여부만 그 턴에서 결정하면 됨.

## 준수 확인 (위반 없음 — 근거만 기록)

- **명명 규약**: 마이그레이션 파일명 `V110__schedule_workspace_next_run_index.{sql,conf}` — `V<번호>__<snake_case_descriptor>` 형식 준수, `.conf`/`.sql` base name 일치. `origin/main` 기준 max V 는 109(V109__workspace_personal_owner_unique) 이므로 V110 은 **gap 없는 +1**, 중복 없음 (`migrations.md` §1·§2·§6.1 준수).
- **인덱스 명명**: `idx_schedule_workspace_next_run` — 기존 관례(`idx_schedule_next_run`, `idx_notification_user_read_created_active`, `idx_execution_trigger_started`, `idx_integration_workspace_service_mall` 등, `idx_<table>_<col...>`) 와 동일 패턴.
- **비-트랜잭션 모드**: `.conf` 에 `executeInTransaction=false` 명시, `CREATE INDEX CONCURRENTLY` 는 파일당 정확히 1개(README §5), transactional statement(`ALTER TABLE` 등)와 미혼합. CREATE→DROP 순서(신규 먼저, 구 인덱스 나중)도 README §5 예시·V056 선례와 일치.
- **Append-only**: 기존 V번호 파일을 수정하지 않고 신규 V110 으로 인덱스 교체 — `migrations.md` §3 준수 (구 인덱스는 DROP 대상일 뿐 과거 V002 파일 자체는 불변).
- **`spec/1-data-model.md` §3 표 형식**: 신규 Schedule 행 2건 모두 기존 열 구조(`테이블 | 인덱스 | 목적`)와 각주 스타일(부분/CONCURRENTLY 여부·V번호 인용)을 그대로 따름. 예: `CONCURRENTLY, V110` 표기는 `CONCURRENTLY, V095`/`V048`/`V047` 등 기존 행과 동일 포맷.
- **Rationale 서브섹션**: 제목 형식 `### <제목> (YYYY-MM-DD)` 이 같은 문서의 기존 서브섹션("### `alert_rule` 을 §2.25 로 등재 (2026-08-31)")과 동일. 문서 구조(Overview/본문/Rationale) 자체는 이번 diff 로 변경되지 않음.
- **API 응답 포맷**: e2e 테스트(`schedule-trigger.e2e-spec.ts` 신규 케이스 J)가 `GET /api/schedules` 응답을 `res.body.data` 를 **배열 그 자체**로 취급 — `spec/5-system/2-api-convention.md` §5.2 의 페이징 목록 규약(`data` 는 배열, `pagination` 은 top-level 형제)과 일치. "비-페이징 고정 컬렉션" 형태(`{ data: { items } }`)와 혼동하지 않음.
- **쿼리 파라미터 명명**: 신규 테스트가 쓰는 `sort=next_run_at`(snake_case, DB 컬럼명 그대로) 은 `schedules.service.ts` 의 기존 `resolveOrderBy` 화이트리스트(`sort='created_at'` 기본값 등)가 이미 써 온 값 — 이번 PR 이 새로 도입한 명명이 아니라 기존 accepted-value 를 재사용.
- **spec-impl-evidence 프론트매터**: `spec/1-data-model.md` 의 `code:` 프론트매터가 이미 `codebase/backend/migrations/V*.sql` 와일드카드를 포함해 V110 을 별도 등재 없이 커버.

## 요약

이번 델타(스케줄 인덱스 `(next_run_at, is_active)` → `(workspace_id, next_run_at)` 교체)는 `spec/conventions/migrations.md` 및 그 SoT 인 `codebase/backend/migrations/README.md` 의 명명·버전·비-트랜잭션·append-only 규칙을 모두 준수하며, `spec/1-data-model.md`·`spec/data-flow/10-triggers.md` 의 표 형식·Rationale 서브섹션 형식도 기존 관례를 그대로 따른다. 뒷받침 e2e/unit 테스트의 API 응답 형태·쿼리 파라미터 명명도 `spec/5-system/2-api-convention.md` 및 기존 서비스 구현과 일치한다. 유일하게 짚을 점은 이 마이그레이션이 도입한 "실패 후 재실행 안전용 선행 DROP" 패턴이 아직 컨벤션 문서에 정식화되지 않았다는 것인데, 이는 규약 위반이 아니고(README §5 문면은 DROP 개수를 제한하지 않음) SQL 주석과 plan 트래커에 이미 후속 과제로 명시적으로 등재되어 있어 실질 리스크가 없다. CRITICAL/WARNING 급 발견은 없다.

## 위험도

NONE
