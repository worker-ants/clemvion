# 보안(Security) 코드 리뷰

## 검토 범위

이번 changeset(65개 파일)의 실질 코드/설정 변경은 다음 4개로 제한된다.

- `codebase/backend/migrations/V110__schedule_workspace_next_run_index.conf` (신규)
- `codebase/backend/migrations/V110__schedule_workspace_next_run_index.sql` (신규 — `schedule` 인덱스 `(next_run_at, is_active)` → `(workspace_id, next_run_at)` 교체)
- `codebase/backend/src/modules/schedules/schedules.service.spec.ts` (단위 테스트 1건 추가, `sort=next_run_at&order=desc` 회귀 방어)
- `codebase/backend/test/schedule-trigger.e2e-spec.ts` (schema 검증 `it` 1개 + 목록 조회 워크스페이스 격리·정렬 검증 `it` 1개 추가)

나머지(`plan/**`, `spec/1-data-model.md`, `spec/data-flow/10-triggers.md`, `review/code/2026/09/04/{23_02_51,23_26_09,23_47_43}/**`, `review/consistency/2026/09/04/{22_34_55,22_43_40}/**`)는 문서·plan·이전 리뷰/consistency-check 라운드 산출물이며 실행 코드가 아니다. 이 changeset은 동일 작업(V110 인덱스 교체)에 대한 **4번째** 보안 리뷰 라운드이고, 앞선 세 라운드(`23_02_51`, `23_26_09`, `23_47_43`)의 `security.md` 도 모두 위험도 NONE으로 결론지었다. 이번 라운드는 그 결론을 저장소를 직접 열람해 독립적으로 재검증했다 — `codebase/backend/src/common/dto/pagination.dto.ts`, `codebase/backend/src/modules/schedules/dto/query-schedule.dto.ts`, `codebase/backend/src/modules/schedules/schedules.service.ts`(전부 diff 밖, 대조용) 를 직접 `Read`했고, `git diff origin/main..HEAD`에 대해 시크릿 패턴(`password|secret|token[:=]|api[_-]?key|BEGIN (RSA|EC|OPENSSH|PRIVATE)|AKIA[0-9A-Z]{16}`)으로 전수 grep했다. 저장소 파일은 수정하지 않았다(`git status --short` 결과 이 세션이 만든 출력 디렉터리 외 변경 없음).

## 발견사항

(Critical/Warning 없음)

- **[INFO]** 인젝션 표면 없음 — 정적 DDL + 기존 화이트리스트/DTO 검증 경로 확인
  - 위치: `codebase/backend/migrations/V110__schedule_workspace_next_run_index.sql:60-65`(`DROP INDEX CONCURRENTLY IF EXISTS idx_schedule_workspace_next_run;` / `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_schedule_workspace_next_run ON schedule (workspace_id, next_run_at);` / `DROP INDEX CONCURRENTLY IF EXISTS idx_schedule_next_run;`)
  - 상세: 마이그레이션은 전부 정적 리터럴 DDL이며 사용자 입력·동적 문자열 결합이 없다. 신규 e2e 테스트(`codebase/backend/test/schedule-trigger.e2e-spec.ts`, `schema:` it 블록)의 `db.query(...)`도 리터럴 SQL만 쓴다. 이 인덱스가 서빙하는 실제 목록 쿼리 경로(`schedules.service.ts` `findAll`/`resolveOrderBy`)를 직접 열람해 대조한 결과, `sort`는 `PaginationQueryDto.sort`의 `@Matches(/^[a-zA-Z][a-zA-Z0-9_]*$/)` + `resolveOrderBy`의 컬럼 화이트리스트(`allowed[sort] || 's.created_at'`)를 거쳐 리터럴 컬럼으로만 치환되고, `order`는 `@IsIn(['asc','desc'])`로 값이 제한된 뒤 `.toUpperCase()`만 적용된다. 신규 `J.` e2e 테스트·단위 테스트가 바로 이 경로를 exercise하지만, 이 검증 로직 자체는 이번 diff가 도입한 것이 아니라 기존 코드다. 인덱스 컬럼 순서 교체는 이 경로의 인젝션 안전성에 영향을 주지 않는다.
- **[INFO]** 하드코딩 시크릿 없음 — 로컬 일회용 더미 값 1건만 존재
  - 위치: `plan/complete/spec-draft-schedule-index.md:191` 부근 (`docker run -d --name idxprobe -e POSTGRES_PASSWORD=probe -e POSTGRES_DB=probe ...`)
  - 상세: 실측 재현 절차 문서에 있는 로컬 일회용 Postgres 컨테이너 예시 명령이며 운영 자격증명이 아니다. 실행 가능한 코드/설정(`.sql`/`.conf`/`.ts`)에는 포함되지 않는다. `git diff origin/main..HEAD` 전체(신규 review/consistency 산출물 포함)를 시크릿 패턴으로 재확인했고, 위 항목과 정상적인 `Authorization: Bearer ${token}`(e2e 테스트의 런타임 발급 JWT 변수) 외에는 매치가 없다.
- **[INFO]** 인가(워크스페이스 격리) — 신규 코드에 우회 없음, 신규 e2e가 오히려 명시적으로 검증
  - 위치: `codebase/backend/test/schedule-trigger.e2e-spec.ts`의 `it('J. 목록 조회 — 워크스페이스 격리 + next_run_at 정렬 (V110 대상 쿼리)', ...)`
  - 상세: 인덱스 선두 컬럼이 `workspace_id`로 바뀌는 변경은 `WHERE workspace_id = ?` 술어 자체나 컨트롤러 인가 로직을 바꾸지 않는다. 신규 `J.` 테스트는 `otherWs`(별도 워크스페이스)의 `X-Workspace-Id` 헤더로 조회했을 때 응답이 빈 목록(`isolated.body.data`가 `toEqual([])`)임을 직접 단언한다 — 직전 라운드(`23_47_43`)가 "루프 바디가 한 번도 안 돈다"는 vacuous 단언 결함을 이미 고친 강한 형태다. 격리 경계가 유지됨을 실증한다.
- **[INFO]** `CONCURRENTLY` 재실행 시 invalid 인덱스 잔존 위험 — 이번 diff에서 완화되어 있음을 재확인, 보안(CIA) 카테고리 밖(가용성/성능 성격)
  - 위치: `codebase/backend/migrations/V110__schedule_workspace_next_run_index.sql:60`(`DROP INDEX CONCURRENTLY IF EXISTS idx_schedule_workspace_next_run;` — CREATE **앞**)
  - 상세: 앞선 라운드(`23_02_51`)가 발견·재현까지 마친 "재실행 시 쓸 수 있는 인덱스 0개" 시나리오는 CREATE 앞에 같은 이름의 DROP을 두어 닫혀 있고, 신규 schema 테스트가 `indisvalid=true`를 단언해 회귀를 고정한다. 이는 기밀성·무결성 침해가 아니라 "의도한 성능 개선을 조용히 못 받는" 가용성/성능 성격이라 보안 카테고리 등급을 매기지 않는다 — 앞선 세 라운드의 `security.md`도 동일 판단이다(`side_effect.md`가 WARNING으로 이미 별도 등급을 매겼다).

## 요약

이번 changeset의 실질 코드 변경은 Postgres 인덱스 교체 마이그레이션(V110, 정적 DDL)과 이를 검증하는 단위/e2e 테스트뿐이며, 신규 API 엔드포인트·인증/인가 로직 변경·사용자 입력 처리 경로는 없다. SQL 인젝션 표면이 없고(전부 리터럴 DDL + 기존 화이트리스트/DTO 검증 경로 재사용, 직접 소스 대조로 확인), 하드코딩된 실 자격증명도 없으며(발견된 `POSTGRES_PASSWORD=probe`는 로컬 일회용 더미), 워크스페이스 인가 경계는 변경되지 않았을 뿐 아니라 신규 e2e가 그 경계를 명시적 단언으로 검증한다. 앞선 세 라운드가 이미 NONE으로 결론지은 것을 독립적으로 재검증했고 동일한 결론에 도달했다. 보안 관점에서 이번 PR을 막을 사유는 없다.

## 위험도

NONE
