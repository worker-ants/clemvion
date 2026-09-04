# 보안(Security) 코드 리뷰

## 검토 범위

이번 changeset(37개 파일)의 실질 코드/설정 변경은 다음 5개뿐이다.

- `codebase/backend/migrations/V110__schedule_workspace_next_run_index.conf` (신규)
- `codebase/backend/migrations/V110__schedule_workspace_next_run_index.sql` (신규 — `schedule` 인덱스 `(next_run_at, is_active)` → `(workspace_id, next_run_at)` 교체)
- `codebase/backend/test/schedule-trigger.e2e-spec.ts` (schema 검증 `it` 1개 + 목록 조회 워크스페이스 격리·정렬 검증 `it` 1개 추가)
- `plan/in-progress/spec-draft-nullable-notation-followups.md`, `plan/in-progress/spec-draft-schedule-index.md` (planner 문서)
- `spec/1-data-model.md`, `spec/data-flow/10-triggers.md` (spec 표 정정 + Rationale 추가)

나머지(파일 6~35)는 직전 라운드(`23_02_51`)의 코드 리뷰 산출물과 `22_34_55`/`22_43_40` consistency-check 산출물이 이 PR 에 커밋으로 포함된 것으로, 보안 관점에서 신규 실행 코드가 아니다. 다만 시크릿 유출 여부는 이 문서들도 포함해 grep 으로 전수 확인했다.

신규 API 엔드포인트·인증/인가 로직 변경·사용자 입력 처리 코드는 이번 diff 에 없다. 마이그레이션 SQL 파일과 `codebase/backend/src/modules/schedules/{schedules.controller,schedules.service}.ts`(diff 밖, 대조용으로만 열람)를 직접 `Read` 로 확인했고, 저장소를 뮤테이션하지 않았다(`git status --short` 로 확인 — 이 세션이 만든 `review/code/2026/09/04/23_26_09/` 출력 외 변경 없음).

## 발견사항

(Critical/Warning 없음)

- **[INFO]** 인젝션 표면 없음 — 확인
  - 위치: `codebase/backend/migrations/V110__schedule_workspace_next_run_index.sql:53-58` (`DROP INDEX CONCURRENTLY IF EXISTS idx_schedule_workspace_next_run;` / `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_schedule_workspace_next_run ON schedule (workspace_id, next_run_at);` / `DROP INDEX CONCURRENTLY IF EXISTS idx_schedule_next_run;`)
  - 상세: 전부 정적 리터럴 DDL — 사용자 입력이나 동적 문자열 결합이 없다. 신규 e2e 테스트(`schedule-trigger.e2e-spec.ts:64-83`)의 `db.query(...)`도 리터럴 SQL만 사용한다. 이 마이그레이션이 서빙하는 실제 쿼리 경로(`schedules.service.ts:80-105`, diff 밖 대조 확인)는 TypeORM `QueryBuilder`의 파라미터 바인딩(`:workspaceId`, `:search`, `:triggerId`)을 그대로 쓰고 있어 이번 인덱스 교체가 그 경로의 인젝션 안전성에 영향을 주지 않는다.

- **[INFO]** 하드코딩 시크릿 없음 — `POSTGRES_PASSWORD=probe` 는 로컬 일회용 더미 값
  - 위치: `plan/in-progress/spec-draft-schedule-index.md:191` (`docker run -d --name idxprobe -e POSTGRES_PASSWORD=probe -e POSTGRES_DB=probe ...`)
  - 상세: 직접 파일을 열어 확인 — 실측 재현을 위해 로컬에서 잠깐 띄우는 일회용 Postgres 컨테이너의 예시 명령이며 운영 자격증명이 아니다. 실행 가능한 코드/설정(`.sql`/`.conf`/`.ts`)에는 포함되지 않는다. 이번 changeset 전체(신규 review/consistency 산출물 포함)를 `password|secret|token|api[_-]key|credential|-----BEGIN` 로 grep 했고, 위 항목과 정상적인 `Authorization: Bearer ${token}`(e2e 테스트의 런타임 발급 JWT 변수) 외에는 매치가 없다.

- **[INFO]** 인가(워크스페이스 격리) — 신규 코드에 우회 없음, 신규 e2e 가 오히려 이를 적극 검증
  - 위치: `codebase/backend/test/schedule-trigger.e2e-spec.ts:320-378` (`it('J. 목록 조회 — 워크스페이스 격리 + next_run_at 정렬 (V110 대상 쿼리)'`)
  - 상세: 이번 인덱스 교체는 `WHERE workspace_id = ?` 술어의 컬럼 순서만 바꿀 뿐 그 술어 자체나 `SchedulesController`(대조 확인: `@WorkspaceId()` 데코레이터가 모든 라우트에 적용됨, `schedules.controller.ts:52-229`)의 인가 로직을 바꾸지 않는다. 신규 `J.` 테스트는 다른 워크스페이스(`createTeamWorkspace` 로 생성한 `otherWs`)의 `X-Workspace-Id` 로 조회했을 때 원 워크스페이스의 schedule id 가 하나도 섞이지 않음(`mine.has(row.id)).toBe(false)`)을 명시적으로 단언한다 — 인덱스 선두 컬럼이 `workspace_id` 로 바뀌는 변경이 격리 조건 자체를 흔들지 않는다는 것을 실증하는 방향으로 유리하게 작용한다.

- **[INFO]** 이전 라운드(`23_02_51`)가 지적한 재실행 시 invalid 인덱스 위험(W1) — 이번 diff 에서 실제로 완화됨을 직접 확인
  - 위치: `codebase/backend/migrations/V110__schedule_workspace_next_run_index.sql:53` (`DROP INDEX CONCURRENTLY IF EXISTS idx_schedule_workspace_next_run;` — CREATE **앞**)
  - 상세: 이는 CIA(기밀성/무결성) 침해가 아니라 가용성/성능 회귀에 가까운 성격이라 보안 카테고리의 발견사항으로 등급을 매기지는 않지만(직전 라운드의 security.md 도 동일 판단으로 NONE), 참고로 확인한 결과 `CREATE INDEX CONCURRENTLY IF NOT EXISTS` **앞에** 같은 이름의 `DROP INDEX CONCURRENTLY IF EXISTS` 를 추가해, 이전 라운드에서 재현까지 확인된 "재실행 시 쓸 수 있는 인덱스 0개" 시나리오가 닫혀 있다. 신규 schema 테스트(`indisvalid` 단언)도 이를 회귀 방지로 고정한다.

## 요약

이번 changeset 의 실질 코드 변경은 Postgres 인덱스 교체 마이그레이션(V110, 정적 DDL)과 이를 검증하는 e2e 테스트 1개(schema 확인) + 1개(목록 조회 워크스페이스 격리·정렬 확인) 추가뿐이며, 신규 API·인증/인가 로직·사용자 입력 처리 경로는 없다. SQL 인젝션 표면이 없고(전부 리터럴 DDL + 기존 TypeORM 파라미터 바인딩 경로 재사용), 하드코딩된 실 자격증명도 없으며(발견된 `POSTGRES_PASSWORD=probe`는 로컬 일회용 더미), 워크스페이스 인가 경계는 변경되지 않았을 뿐 아니라 신규 e2e 가 그 경계를 명시적으로 검증한다. 직전 라운드가 지적했던 CONCURRENTLY 재실행 시 invalid 인덱스 잔존 위험(가용성/성능 성격, 보안 카테고리 범위 밖)도 이번 diff 에서 DROP-먼저 순서로 실제로 완화돼 있음을 직접 확인했다. 보안 관점에서 이번 PR 을 막을 사유는 없다.

## 위험도

NONE
