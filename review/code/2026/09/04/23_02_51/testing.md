# 테스트(Testing) 리뷰

## 범위

실질적 테스트 대상은 3개 파일이다.

- `codebase/backend/migrations/V110__schedule_workspace_next_run_index.conf` (신규)
- `codebase/backend/migrations/V110__schedule_workspace_next_run_index.sql` (신규 DDL)
- `codebase/backend/test/schedule-trigger.e2e-spec.ts` (스키마 검증 e2e 테스트 추가)

나머지(`plan/**`, `review/consistency/**`, `spec/**`)는 문서·리뷰 산출물이라 테스트 관점 분석 대상이 아니며, 확인 결과 테스트 코드·테스트 대상 코드를 포함하지 않는다.

## 발견사항

- **[WARNING]** 이 마이그레이션이 최적화하는 바로 그 쿼리(`GET /api/schedules`, Q1)가 e2e 로 전혀 실행되지 않는다
  - 위치: `codebase/backend/test/schedule-trigger.e2e-spec.ts` (describe 블록 전체, `it('A. …')` ~ `it('I. …')`) / 대조: `codebase/backend/src/modules/schedules/schedules.controller.ts:52-67` (`@Get() findAll`)
  - 상세: V110 의 동기가 된 실측 쿼리는 plan 문서(`plan/in-progress/spec-draft-schedule-index.md` §1 "Q1 목록")가 명시하듯 `schedules.service.ts:80-105` 의 `WHERE workspace_id = ? ORDER BY next_run_at DESC LIMIT 20` — 즉 `GET /api/schedules` (`SchedulesController.findAll`) 다. 그런데 이 e2e 스펙 파일은 `POST /api/schedules/preview`·`POST /api/schedules`·`PATCH`·`DELETE`·`POST run-now`·(다른 컨트롤러의) `GET /api/triggers?type=schedule` 는 부르지만 **`GET /api/schedules` 자체는 한 번도 호출하지 않는다** — 저장소 전체(`grep -rn "api/schedules" codebase/backend/test`)에서도 GET 목록 호출이 없다. `schedules.service.spec.ts` 의 `describe('findAll sort/order')` 유닛 테스트가 쿼리 빌더 로직(정렬 화이트리스트·`triggerId` 필터)을 mock 으로 검증하지만, 컨트롤러 라우팅·실제 DB 왕복·workspace 격리까지 통합 검증하는 e2e 테스트는 없다. 인덱스 존재 자체는 신규 schema 테스트가 검증하지만, "그 인덱스로 서빙되는 엔드포인트가 실제로 올바른 결과를 낸다"는 별개 명제이고 미검증 상태다.
  - 제안: `it('J. GET /api/schedules — workspace 스코프 + next_run_at 정렬')` 류를 추가해 2개 이상 schedule 을 만든 뒤 목록이 workspace 로 격리되고 기본 정렬을 지키는지 확인. 이번 PR 이 그 정확한 경로를 최적화 대상으로 삼은 만큼 같은 PR 에서 닫는 편이 자연스럽다(기존에도 없었던 갭이라 이 PR 이 만든 회귀는 아님).

- **[INFO]** SQL 주석의 "재실행 안전" 주장이 테스트되지 않는다
  - 위치: `codebase/backend/migrations/V110__schedule_workspace_next_run_index.sql:33` (`IF NOT EXISTS / IF EXISTS 로 CONCURRENTLY 실패 후 부분 상태에서도 재실행 안전.`)
  - 상세: `CREATE INDEX CONCURRENTLY` 가 중간에 실패해 `idx_schedule_workspace_next_run` 이 `indisvalid=false` 인 채 남는 상황을 시뮬레이션해 재실행이 실제로 정리되는지 확인하는 테스트는 없다. DBA 수동 복구 시나리오라 자동화 비용 대비 실익이 낮아 defer 해도 무방하지만, 주석이 검증 가능한 주장을 하고 있다는 점은 기록해 둔다.
  - 제안: 우선순위 낮음. 필요 시 별도 스크립트로 `CREATE INDEX CONCURRENTLY` 를 강제 중단시켜 invalid 인덱스를 만든 뒤 마이그레이션 재실행이 성공하는지 확인하는 절차를 `plan/` 부록에 문서화만 해 둬도 충분.

- **[INFO]** 신규 schema 테스트가 인증/워크스페이스 부트스트랩(`beforeAll`, 60s 타임아웃)에 결속돼 있다
  - 위치: `codebase/backend/test/schedule-trigger.e2e-spec.ts:64` (`it('schema: schedule 인덱스가 …')`) — 이 describe 의 `beforeAll` (파일 상단)이 `registerAndLogin` + `createTeamWorkspace` + workflow 생성까지 수행
  - 상세: 이 스키마 테스트는 `db` 클라이언트만 쓰고 `token`/`workspaceId`/`workflowId` 를 전혀 참조하지 않는데도, 같은 `describe` 안에 있어 `beforeAll` 의 회원가입·워크스페이스 생성이 실패/타임아웃하면 인덱스 검증 자체가 실행되지 않는다. 다만 이는 이 PR 의 신규 결함이 아니라 `notifications-dismiss.e2e-spec.ts` 의 `schema:` 테스트도 동일한 패턴(공유 `beforeAll` 안에 schema 테스트를 둠)을 따르고 있어 저장소 기존 관례다.
  - 제안: 우선순위 낮음(기존 관례 추종). 마이그레이션 검증만 별도 최상위 `describe`(가벼운 `db.connect()` 만 하는 `beforeAll`)로 분리하면 인증 플레이크와 무관하게 항상 실행되지만, 관례를 깨는 리팩터라 이 PR 단독으로 강제할 사안은 아니다.

- **[INFO]** 인덱스 DROP 확인 쿼리가 `relkind` 를 걸지 않는다
  - 위치: `codebase/backend/test/schedule-trigger.e2e-spec.ts:78-80` (`SELECT 1 FROM pg_class WHERE relname = 'idx_schedule_next_run'`)
  - 상세: `pg_class` 는 테이블·인덱스·시퀀스 등을 모두 담는 카탈로그라, 이론상 같은 이름의 다른 relkind 객체가 있으면 오탐(0건 기대가 어긋남)이 될 수 있다. `idx_schedule_next_run` 이라는 이름 자체가 다른 종류의 객체와 충돌할 가능성은 사실상 없어 실질 리스크는 낮다.
  - 제안: 엄밀함이 필요하면 `AND relkind = 'i'` 추가. 선택 사항.

## 긍정적으로 확인된 점 (발견사항 아님)

- 신규 schema 테스트는 "새 인덱스 존재" 뿐 아니라 "옛 인덱스 부재"까지 **양방향**으로 확인한다(주석에 명시된 의도대로). 저장소의 선례(`notifications-dismiss.e2e-spec.ts` 의 V056 교체 테스트, `background-monitoring.e2e-spec.ts`)는 신규 인덱스 존재만 확인하고 구 인덱스 제거는 검증하지 않는데, 이번 테스트가 그보다 엄격하다.
- `indexdef` 에 대한 컬럼 순서(`\(workspace_id,\s*next_run_at\)/`) 단언은 부수적으로 "컬럼 순서를 실수로 뒤집는" 회귀(정확히 plan 문서가 실측한 2.2배 성능 저하 시나리오)까지 잡아낸다 — 성능 벤치마크를 CI 에 못 넣는 대신 구조적 단언으로 그 축을 어느 정도 방어한다.
- `executeInTransaction=false` (.conf) + `CREATE/DROP INDEX CONCURRENTLY IF [NOT] EXISTS` 조합은 `V105`/`V106`/`V109` 등 기존 저장소 선례와 동일한 패턴이라 신규 리스크가 낮다.
- 기존 회귀 테스트(A~I: preview/생성/PATCH/run-now/delete/trigger 양방향 동기화)는 인덱스 교체와 무관한 API 계약을 검증하므로 이번 변경 후에도 유효하며, 신규 schema 테스트는 데이터를 생성/변경하지 않아 다른 테스트와 격리돼 있다.
- `V106__schedule_trigger_id_index.sql` 이 추가했던 `(trigger_id)` 인덱스가 spec 표에 누락돼 있던 것을 이번 plan(`spec-draft-schedule-index.md` 변경안 B)이 함께 메웠고, `spec/1-data-model.md` diff(파일 15)에도 반영되어 있다 — 테스트 대상은 아니지만 문서 정합성 관점에서 언급.

## 요약

핵심 산출물(V110 마이그레이션 + `.conf`)에 대한 스키마 레벨 e2e 테스트는 추가됐고, 양방향 확인·컬럼 순서 단언 등 기존 저장소 관례보다 엄격하다. 다만 이 마이그레이션의 존재 이유인 `GET /api/schedules` (Q1) 엔드포인트 자체를 실행하는 e2e 테스트가 여전히 없어(유닛 레벨 쿼리 빌더 검증만 존재), "인덱스가 교체됐다"는 사실과 "그 인덱스로 서빙되는 API 가 여전히 올바르게 동작한다"는 사실 사이에 검증 공백이 남는다. 그 외 지적(재실행-안전 미검증, beforeAll 결속, relkind 미필터)은 모두 낮은 우선순위이며 일부는 기존 관례를 그대로 따른 것이라 이 PR 고유의 결함이 아니다. Critical 은 없다.

## 위험도

LOW
