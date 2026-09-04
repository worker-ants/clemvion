# 보안(Security) 코드 리뷰

## 검토 범위

이번 changeset(51개 파일)의 실질 코드/설정 변경은 다음으로 제한된다.

- `codebase/backend/migrations/V110__schedule_workspace_next_run_index.conf` (신규)
- `codebase/backend/migrations/V110__schedule_workspace_next_run_index.sql` (신규 — `schedule` 인덱스 `(next_run_at, is_active)` → `(workspace_id, next_run_at)` 교체)
- `codebase/backend/src/modules/schedules/schedules.service.spec.ts` (단위 테스트 1건 추가, `sort=next_run_at&order=desc` 회귀 방어)
- `codebase/backend/test/schedule-trigger.e2e-spec.ts` (schema 검증 `it` 1개 + 목록 조회 워크스페이스 격리·정렬 검증 `it` 1개, diff 미첨부라 원본 직접 `Read` 로 확인)
- 나머지(`plan/**`, `review/**`, `spec/1-data-model.md`, `spec/data-flow/10-triggers.md`)는 문서/plan/이전 라운드 리뷰 산출물이며 실행 코드가 아니다.

신규 API 엔드포인트, 인증/인가 로직 변경, 사용자 입력 처리 코드는 이번 diff에 없다. `schedules.service.ts`(diff 밖)와 `common/dto/pagination.dto.ts`, `schedules/dto/query-schedule.dto.ts`(모두 diff 밖)를 대조용으로 직접 `Read` 해, 신규 e2e 테스트가 실제로 exercise 하는 `sort`/`order` 파라미터 경로의 안전성을 확인했다. 저장소를 뮤테이션하지 않았다 — `git status --short` 로 확인.

이 changeset은 동일 작업(`V110` 인덱스 교체)에 대한 3번째 리뷰 라운드(`23_02_51` → `23_26_09` → `23_47_43`)이며, 앞선 두 라운드의 보안 리뷰(`review/code/2026/09/04/23_02_51/security.md`, `review/code/2026/09/04/23_26_09/security.md`)도 모두 위험도 NONE으로 결론지었다. 이번 라운드는 그 결론을 독립적으로 재검증했다.

## 발견사항

(Critical/Warning 없음)

- **[INFO]** 인젝션 표면 없음 — 재확인
  - 위치: `codebase/backend/migrations/V110__schedule_workspace_next_run_index.sql:60-65` (`DROP INDEX CONCURRENTLY IF EXISTS idx_schedule_workspace_next_run;` / `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_schedule_workspace_next_run ON schedule (workspace_id, next_run_at);` / `DROP INDEX CONCURRENTLY IF EXISTS idx_schedule_next_run;`)
  - 상세: 전부 정적 리터럴 DDL — 사용자 입력이나 동적 문자열 결합이 없다. 신규 e2e 테스트(`codebase/backend/test/schedule-trigger.e2e-spec.ts:67-72`, `:80-82`)의 `db.query(...)` 도 리터럴/파라미터 바인딩(`$1`)만 사용한다. 이 마이그레이션이 서빙하는 실제 목록 쿼리(`schedules.service.ts` 의 `findAll`, diff 밖)를 직접 열람해 대조한 결과, `sort` 파라미터는 화이트리스트 매핑 함수(`resolveOrderBy`)를 거쳐 고정된 컬럼 리터럴로만 치환되고, `order` 파라미터는 DTO 레벨에서 `@IsIn(['asc','desc'])` 로 값이 제한된다(`common/dto/pagination.dto.ts`). `sort` DTO 필드에는 추가로 `@Matches(/^[a-zA-Z][a-zA-Z0-9_]*$/)` 정규식 게이트가 있다 — 이번 diff가 도입한 것은 아니지만, 신규 e2e `J.` 테스트·단위 테스트가 바로 이 경로를 exercise 하므로 함께 확인했다. 인덱스 교체 자체는 이 경로의 인젝션 안전성에 영향을 주지 않는다.

- **[INFO]** 하드코딩 시크릿 없음 — 로컬 일회용 더미 값 1건만 존재
  - 위치: `plan/complete/spec-draft-schedule-index.md:191` (`docker run -d --name idxprobe -e POSTGRES_PASSWORD=probe -e POSTGRES_DB=probe ...`)
  - 상세: 실측 재현 절차 문서에 있는 로컬 일회용 Postgres 컨테이너 예시 명령이며 운영 자격증명이 아니다. 실행 가능한 코드/설정(`.sql`/`.conf`/`.ts`)에는 포함되지 않는다. changeset 전체를 `password|secret|api[_-]?key|token\s*[:=]|BEGIN (RSA|EC|OPENSSH|PRIVATE)|AKIA[0-9A-Z]{16}` 패턴으로 재확인했고, 위 항목 외 매치 없음(정상적인 `Authorization: Bearer ${token}` 런타임 JWT 변수 제외).

- **[INFO]** 인가(워크스페이스 격리) — 신규 코드에 우회 없음, 신규 e2e가 오히려 이를 명시적으로 검증
  - 위치: `codebase/backend/test/schedule-trigger.e2e-spec.ts` `it('J. 목록 조회 — 워크스페이스 격리 + next_run_at 정렬 (V110 대상 쿼리)', ...)` (파일 내 함수/블록 J)
  - 상세: 인덱스 선두 컬럼이 `workspace_id` 로 바뀌는 변경은 `WHERE workspace_id = ?` 술어 자체나 컨트롤러 인가 로직을 바꾸지 않는다. 신규 `J.` 테스트는 `otherWs`(별도 워크스페이스)의 `X-Workspace-Id` 헤더로 조회했을 때 원 워크스페이스의 schedule id 가 하나도 섞이지 않음을 명시적으로 단언(`mine.has(row.id)).toBe(false)`)해 격리 경계가 유지됨을 실증한다.

- **[INFO]** 이전 라운드가 지적한 CONCURRENTLY 재실행 시 invalid 인덱스 잔존 위험 — 가용성/성능 성격, 이번 diff에서 완화 유지 확인
  - 위치: `codebase/backend/migrations/V110__schedule_workspace_next_run_index.sql:60` (`DROP INDEX CONCURRENTLY IF EXISTS idx_schedule_workspace_next_run;` — CREATE **앞**)
  - 상세: CIA(기밀성/무결성/가용성) 중 가용성/성능 회귀 성격이라 보안 카테고리 등급은 매기지 않는다(앞선 두 라운드의 security.md 도 동일 판단). CREATE 앞에 같은 이름의 DROP 을 두어 "재실행 시 인덱스 0개" 시나리오가 닫혀 있고, `RESOLUTION.md`(`review/code/2026/09/04/23_02_51/RESOLUTION.md`)에 따르면 이 수정은 실패 상태를 실제로 재현·검증까지 마쳤다. 신규 schema 테스트(`indisvalid=true` 단언)가 회귀를 고정한다.

## 요약

이번 changeset의 실질 코드 변경은 Postgres 인덱스 교체 마이그레이션(V110, 정적 DDL) + 이를 검증하는 단위/e2e 테스트뿐이며, 신규 API·인증/인가 로직·사용자 입력 처리 경로는 없다. SQL 인젝션 표면이 없고(전부 리터럴 DDL + 기존 화이트리스트/DTO 검증 경로 재사용), 하드코딩된 실 자격증명도 없으며(발견된 `POSTGRES_PASSWORD=probe`는 로컬 일회용 더미), 워크스페이스 인가 경계는 변경되지 않았을 뿐 아니라 신규 e2e가 그 경계를 명시적으로 검증한다. 앞선 두 라운드가 이미 NONE으로 결론지은 것과 독립적으로 재확인했고, 동일한 결론에 도달했다. 보안 관점에서 이번 PR을 막을 사유는 없다.

## 위험도

NONE
