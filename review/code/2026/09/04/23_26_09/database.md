# 데이터베이스(Database) 코드 리뷰

## 검토 범위

이 changeset 의 핵심 DB 변경은 신규 마이그레이션 `V110__schedule_workspace_next_run_index.{sql,conf}`
(schedule 인덱스를 `(next_run_at, is_active) WHERE is_active` → `(workspace_id, next_run_at)` 로 교체)
와, 그 대상 쿼리를 검증하는 `codebase/backend/test/schedule-trigger.e2e-spec.ts` 신규 e2e 2건
(schema 존재/컬럼순서 확인 + `GET /api/schedules` 격리·정렬 확인)이다. `spec/1-data-model.md`,
`spec/data-flow/10-triggers.md`, 두 `plan/in-progress/*.md` 는 같은 결정의 문서 미러이고, 나머지
`review/**` 파일 다수는 **직전 라운드(`23_02_51`)의 리뷰 산출물이 그대로 diff 에 포함**된 것이다
(이 저장소 관례상 리뷰 산출물도 커밋됨). 그 직전 라운드의 database 리뷰(`review/code/2026/09/04/23_02_51/database.md`)는
이미 이 마이그레이션을 LOW 로 평가했고, `RESOLUTION.md` 는 그 라운드의 WARNING 4건(전부 database
카테고리 자체가 아니라 side_effect·documentation·testing 소관)을 전부 조치했다고 기록한다.
이번 라운드는 그 **조치 결과가 실제로 반영됐는지**를 직접 소스에서 재검증하는 데 집중했다.

## 발견사항

- **[INFO]** `CREATE INDEX CONCURRENTLY` 재실행 안전성 — 직전 라운드가 지적한 W1 이 실제로
  DROP-먼저 패턴으로 고쳐졌음을 소스에서 확인
  - 위치: `codebase/backend/migrations/V110__schedule_workspace_next_run_index.sql` (`DROP INDEX CONCURRENTLY IF EXISTS idx_schedule_workspace_next_run;` → `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_schedule_workspace_next_run ...` → `DROP INDEX CONCURRENTLY IF EXISTS idx_schedule_next_run;`)
  - 상세: `IF NOT EXISTS` 는 이름 존재만 보고 `indisvalid` 를 보지 않으므로, `CREATE INDEX CONCURRENTLY` 가 중간 실패로 invalid 인덱스를 남긴 채 재실행되면 CREATE 는 스킵되고 뒤이은 옛 인덱스 DROP 만 정상 수행돼 "쓸 수 있는 인덱스 0개"(seq scan 회귀)로 귀결한다. 실제 파일을 열어 확인한 결과 `DROP` → `CREATE` → `DROP` 순서가 정확히 적용돼 있다: 첫 실행에서 선두 DROP 은 대상이 없어 no-op, 실패 후 재실행에서만 invalid 잔재를 치우고 재생성한다. `RESOLUTION.md` 가 주장한 재현 실험(UNIQUE+중복 데이터로 결정적 실패 유도 → 종전 순서는 "인덱스 0개", 새 순서는 정상 복구)의 기전과도 일치한다. 선례 `V056`/`V106` 은 직접 대조 결과 이 DROP-먼저 줄이 **없다** — 즉 V110 은 선례보다 한 걸음 더 견고하지만, 두 선례는 여전히 같은 잠재 위험을 안고 있다.
  - 제안: 없음(이번 PR 은 이미 조치됨). 선례 두 건에 대한 소급 수정은 append-only 원칙상 불가하므로, `migrations/README.md` §5 또는 `spec/conventions/migrations.md` 에 "CONCURRENTLY 교체는 신규 인덱스명에 대해 CREATE 앞에 동일 이름 DROP 을 둔다" 는 패턴을 성문화하는 편이 낫다 — 이는 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 developer/DBA 후속 항목으로 등재돼 있음을 확인했다.

- **[INFO]** 재실행 안전 패턴이 `migrations/README.md` §5 "`executeInTransaction=false` 파일은
  CREATE INDEX CONCURRENTLY 정확히 한 개" 컨벤션을 위반하지 않음
  - 위치: `codebase/backend/migrations/README.md:125-139`, `V110__schedule_workspace_next_run_index.sql`
  - 상세: V110 은 `CREATE INDEX CONCURRENTLY` 1개 + `DROP INDEX CONCURRENTLY` 2개를 담는다. README §5 조문을 직접 읽어 확인한 결과 이 컨벤션은 "CREATE 를 정확히 한 개" 로만 제한하고 DROP 개수는 제한하지 않는다 — 이유(롤백 단위·checksum 추적 단순화·transactional statement 와 CONCURRENTLY 혼용 금지) 어느 것도 DROP 복수 개를 문제 삼지 않는다. `V056` 선례(CREATE 1 + DROP 1)와 형태·이유 모두 정합.
  - 제안: 없음 — 확인용 기재.

- **[INFO]** 인덱스 선택 근거가 `EXPLAIN (ANALYZE, BUFFERS)` 실측(200,000행/5,000행, 5회 반복
  median)으로 뒷받침되고, "정렬 컬럼을 선두에 두면 오히려 2.2배 느려진다"는 반직관적 결과까지
  계획(Index Scan Backward, 버려진 행 39,797개)으로 근거를 남김
  - 위치: `codebase/backend/migrations/V110__schedule_workspace_next_run_index.sql:14-27`, `plan/in-progress/spec-draft-schedule-index.md` §1
  - 상세: 후보 (a) 없음/(b) `(next_run_at)`/(c) `(workspace_id, next_run_at)`/(d) `(workspace_id)` 단독을 실측 비교했고, 채택한 (c) 가 목표 쿼리(`WHERE workspace_id = ? ORDER BY next_run_at DESC LIMIT 20`)를 5.99ms→0.30ms(20배), 기본 정렬(`created_at`)도 6.89ms→1.08ms(6.4배)로 개선함을 확인. `schedule` 에 `workspace_id` 인덱스가 아예 없어 목록 조회가 매번 전 테이블(Parallel Seq Scan)을 훑고 있었다는 부수 발견도 코드(`schedules.service.ts:80-105`)와 대조해 술어가 정확히 일치함을 확인했다.
  - 제안: 없음.

- **[INFO]** spec 미러 정합 — `spec/1-data-model.md` §3 표 + `## Rationale` + `spec/data-flow/10-triggers.md`
  §2.1 세 자리가 모두 이번 diff 안에서 함께 갱신돼 있음을 직접 대조로 확인 (직전 라운드 documentation W2/W3 조치 확인)
  - 위치: `spec/1-data-model.md:914-915`(§3 표, `Schedule (workspace_id, next_run_at)` + `Schedule (trigger_id)` 신규 행), `spec/1-data-model.md:947-960`(`## Rationale` "Schedule 인덱스 ... (2026-09-04)" 신규 항목), `spec/data-flow/10-triggers.md:175`
  - 상세: `1-data-model.md` §3 은 인덱스 컬럼을 `(workspace_id, next_run_at)` 로, `10-triggers.md:175` 는 같은 인덱스를 UPDATE 서술 행에서 동일하게 미러한다. 빠져 있던 `Schedule (trigger_id)`(V106 이 실제로 만들었으나 표에 행이 없던 것) 도 이번에 함께 메워져 표-실물 drift 가 하나 더 닫혔다. `## Rationale` 에는 (a)/(b)/(c)/(d) 네 후보 실측 비교표와 기각 사유가 spec 문서 자신의 관행(예: `WorkflowVersion.snapshot`, `install_token` 항목)과 같은 형식으로 들어가 있다 — 직전 라운드가 지적한 "근거가 plan draft 에만 있다" 는 W3 이 해소됐다.
  - 제안: 없음.

- **[INFO]** e2e 가 "인덱스 존재" 와 "그 인덱스로 서빙되는 쿼리의 정합성"을 분리해 양쪽 다 검증
  (직전 라운드 testing W4 조치 확인)
  - 위치: `codebase/backend/test/schedule-trigger.e2e-spec.ts` (schema 테스트 `L64-84` 부근, `J.` 목록 테스트)
  - 상세: schema 테스트는 `pg_index`/`pg_class` 를 직접 질의해 신규 인덱스의 `indisvalid=true`·컬럼 순서(`(workspace_id, next_run_at)`)·non-partial 여부, 그리고 옛 인덱스(`idx_schedule_next_run`)의 부재를 **양방향**으로 고정한다(한쪽만 보면 교체의 절반이 안 닫힌 채 통과할 수 있다는 지적이 정확). `J.` 테스트는 실제 최적화 대상 API(`GET /api/schedules?sort=next_run_at&order=asc|desc`)를 호출해 (1) 정렬이 실제로 적용되는지(오름/내림 양방향, 서로 다른 `nextRunAt` 값 ≥2 를 먼저 확보해 관측 공허화를 막음), (2) `workspace_id` 격리가 실제로 걸리는지(다른 워크스페이스 헤더로 조회 시 안 보임)를 검증한다. 인덱스 컬럼 순서 변경으로 격리·정렬이 같은 인덱스에 얹힌 이번 변경 성격과 정확히 맞는 테스트 설계다.
  - 제안: 없음.

- **[INFO]** 커넥션 관리 — 신규 DB 질의는 파일 공유 `db` 클라이언트를 재사용하며 별도 누수 없음
  - 위치: `codebase/backend/test/schedule-trigger.e2e-spec.ts` (`beforeAll`/`afterAll`, `db.query` 호출부)
  - 상세: `beforeAll` 에서 `createDbClient` 로 만든 단일 `pg.Client` 를 `afterAll` 의 `db.end()` 로 정리하는 파일 전체 관례를 신규 테스트도 그대로 따른다. `it` 단위로 별도 커넥션을 열고 닫는 패턴이 아니라 커넥션 풀/클라이언트 고갈 위험 없음.
  - 제안: 없음.

- **[INFO]** SQL 인젝션 관점 — 신규 코드에 문자열 결합 쿼리 없음
  - 위치: `codebase/backend/test/schedule-trigger.e2e-spec.ts` (`db.query(...)` 전부 파라미터 바인딩 또는 리터럴), `V110__schedule_workspace_next_run_index.sql` (정적 DDL, 사용자 입력 없음)
  - 상세: 신규 e2e 가 실행하는 `GET /api/schedules?sort=...&order=...` 는 서비스 레이어(`schedules.service.ts:115-124`, 이번 diff 로 변경되지 않은 기존 코드)에서 `sort` 를 화이트리스트 맵으로, `order` 는 TypeORM `QueryBuilder.orderBy` 의 `'ASC'|'DESC'` 인자로 넘겨 문자열 결합이 없다. 이번 diff 가 새로 만든 위험은 없다.
  - 제안: 없음(참고: `order` 값 자체가 DTO 레벨에서 `IsIn(['asc','desc'])` 등으로 사전 검증되는지는 이 diff 범위 밖이라 확인하지 않았다 — injection 벡터는 아니고 TypeORM 이 `ASC`/`DESC` 외 값에 런타임 오류를 던지는 방식으로 방어한다).

- **[INFO]** 대량 데이터/페이지네이션 — 목표 쿼리는 이미 `LIMIT`+`OFFSET` 페이지네이션을 쓰고 있고,
  이번 인덱스가 그 진입 경로를 준다. N+1 은 관찰되지 않음
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts:96-107`(`findAll`, 이번 diff 로 변경되지 않음), `plan/in-progress/spec-draft-schedule-index.md` §1 (전수 열거 13개 호출부 중 인덱스 관여 가능한 2개만 추림)
  - 상세: `findAll` 은 단일 쿼리로 `LEFT JOIN` + `WHERE workspace_id` + `ORDER BY` + `LIMIT/OFFSET` 을 한 번에 실행하며 반복문 내 개별 쿼리 패턴이 없다. plan 문서 §1 이 코드에서 `next_run_at`/`workspace_id` 를 술어로 쓰는 자리를 전수 열거해 나머지 11개 호출부는 PK/FK 인덱스로 커버됨을 확인한 절차도 타당하다.
  - 제안: 없음.

## 요약

이번 changeset 의 실체는 `schedule` 목록 조회가 어떤 인덱스도 못 쓰고 매번 전 테이블 Parallel Seq
Scan 을 하고 있었다는 사실을 `EXPLAIN (ANALYZE, BUFFERS)` 로 직접 실측하고, 쓰이지 않던 부분
인덱스를 실제 접근 패턴(`WHERE workspace_id = ? ORDER BY next_run_at`)에 맞는 `(workspace_id,
next_run_at)` 로 교체하는 Flyway 마이그레이션(V110)이다. `CREATE/DROP INDEX CONCURRENTLY` +
`executeInTransaction=false` 조합으로 무중단 배포 요건을 충족하고, 직전 라운드가 지적한 재실행
안전성 결함(invalid 인덱스가 재실행 시 조용히 두 인덱스 모두 사라지는 시나리오)은 CREATE 앞에
동일 이름 DROP 을 추가해 실제로 고쳐졌음을 소스에서 직접 확인했다 — 선례 `V056`/`V106` 보다 한
단계 더 견고하다. spec 미러(`1-data-model.md` §3+Rationale, `data-flow/10-triggers.md` §2.1)와
plan 문서가 모두 이 결정으로 갱신돼 정합하고, 신규 e2e 는 인덱스 존재·컬럼순서·구 인덱스 부재를
양방향으로, 그리고 그 인덱스가 서빙하는 실제 API(격리+정렬)를 별도로 검증해 "인덱스가 있다"와
"그 인덱스로 쿼리가 옳게 동작한다"는 두 명제를 모두 닫는다. SQL 인젝션·N+1·트랜잭션·커넥션
관리 관점에서 새로 도입된 결함은 없다. 유일하게 남는 잔여는 이 PR 의 결함이 아니라 저장소 전체에
걸친 기존 패턴(V056/V106)의 연장인 "CONCURRENTLY 실패 후 재시도 시 invalid 인덱스가 남을 수
있다"는 운영 리스크의 **규약 차원 성문화**뿐이며, 이는 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md`
에 developer/DBA 후속 항목으로 정확히 등재돼 있어 이 PR 을 막을 사유가 아니다.

## 위험도
LOW
