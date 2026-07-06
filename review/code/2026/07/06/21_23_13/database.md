# 데이터베이스(Database) 코드 리뷰

## 리뷰 대상
- `codebase/backend/migrations/V107__notification_background_run_id.sql` (신규)
- `codebase/backend/src/modules/notifications/entities/notification.entity.ts`
- `codebase/backend/src/modules/notifications/notifications.service.ts` (`findByResource` → `findByBackgroundRun`, `notify`/`createMany` 에 `backgroundRunId` 전달)
- `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts`
- `codebase/backend/src/modules/execution-engine/queues/background-execution.processor.ts`
- 관련 unit/e2e spec, DTO, module 파일

## 발견사항

- **[INFO]** 마이그레이션 안전성 판단은 타당함
  - 위치: `codebase/backend/migrations/V107__notification_background_run_id.sql:63-71`
  - 상세: 신규 `background_run_id UUID NULL` 컬럼은 DEFAULT 절이 없으므로 Postgres 11+ 에서 `ADD COLUMN` 은 메타데이터만 변경(테이블 전체 rewrite 없음) — 짧은 `ACCESS EXCLUSIVE` lock 이지만 순간적. 뒤이은 `CREATE INDEX ... WHERE background_run_id IS NOT NULL` 도 신규 컬럼이 전부 NULL 이라 대상 row 가 0건이므로 즉시 완료된다. 같은 트랜잭션에 `ADD COLUMN` + `CREATE INDEX` 를 동봉해도 실질적인 무중단 배포 리스크는 낮다는 마이그레이션 주석의 근거는 실제로 타당하며, `V053`/`V056` 이 `CONCURRENTLY` 를 쓴 이유(이미 데이터가 채워진 기존 컬럼의 index 재구성)와 정확히 대비된다.
  - 제안: 없음 (참고용). 다만 `notification` 테이블 row 수가 매우 크고 장시간 실행 중인 트랜잭션이 동시에 해당 테이블에 `SELECT`/`INSERT` lock 을 오래 들고 있는 경우, `ADD COLUMN` 이 `ACCESS EXCLUSIVE` 를 얻기 위해 대기열에서 후속 쿼리를 막는 lock queue 현상(락 대기열 stacking)이 이론상 가능하다. 트래픽이 많은 프로덕션 배포 시점에는 `lock_timeout` 설정 확인을 권장.

- **[INFO]** DOWN 마이그레이션 스크립트는 주석으로만 존재 (실행 파일 아님)
  - 위치: `codebase/backend/migrations/V107__notification_background_run_id.sql:61`
  - 상세: `-- DOWN: DROP INDEX IF EXISTS ...; ALTER TABLE ... DROP COLUMN IF EXISTS ...` 가 주석으로 문서화되어 있으나, 프로젝트의 마이그레이션 프레임워크(Flyway 계열로 추정)가 별도 `.undo.sql` 파일 컨벤션을 쓰는지 확인 필요. 다른 마이그레이션 파일(`V056`)이 `.conf` 파일로 `executeInTransaction=false` 를 지정하는 패턴을 쓰는 것과 비교하면, 본 프로젝트는 공식 롤백 자동화보다 주석 기반 수동 절차를 채택한 것으로 보임 — 기존 컨벤션과 일관되므로 문제 없음.
  - 제안: 없음.

- **[INFO]** 스키마 설계 — attribution 과 딥링크 목적 분리는 정규화 관점에서 합리적
  - 위치: `notification.entity.ts:733-738`, migration V107 주석
  - 상세: 기존에 `resource_type`/`resource_id` 하나의 컬럼 쌍이 "딥링크 라우팅"과 "per-run attribution 조회" 두 가지 다른 의미론적 역할을 겸용하면서 발생한 충돌(딥링크는 workflow id 요구, attribution 은 backgroundRunId 요구)을 새 전용 컬럼(`background_run_id`)으로 분리한 설계다. 두 역할을 억지로 하나의 범용 컬럼에 오버로드하는 것보다 명확하고, 인덱스도 목적에 맞게 partial 로 최소 크기 유지 — 스키마 설계 관점에서 적절한 개선.
  - 제안: 없음.

- **[INFO]** 인덱스 커버리지 — `findByBackgroundRun` 쿼리 경로 확인
  - 위치: `notifications.service.ts` `findByBackgroundRun(backgroundRunId)` → `where: { backgroundRunId }, order: { createdAt: 'ASC' }`
  - 상세: 신규 partial index `idx_notification_background_run_id ON notification (background_run_id) WHERE background_run_id IS NOT NULL` 가 이 조회의 등가 조건(`background_run_id = ?`)을 정확히 커버한다. 다만 `ORDER BY createdAt ASC` 는 인덱스에 포함되지 않아 정렬은 별도 `Sort` 노드로 처리된다 — 다만 per-run 알림 건수는 소수(수신자 admin 목록 크기, 통상 십 수 건 이하)로 예상되어 인덱스 조건으로 필터링 후 인메모리 정렬 비용은 무시할 수준. `idx_notification_workspace_type_resource (workspace_id, type, resource_id, created_at DESC)` 처럼 정렬 컬럼까지 포함하는 복합 인덱스 패턴이 이미 존재하지만, `background_run_id` 조회는 카디널리티가 매우 높고(1 background run = 소수 alert) row 수 자체가 적어 정렬 컬럼 포함이 실익이 크지 않음.
  - 제안: 현재로선 불필요. 다만 향후 이 API 가 대량 admin 조직·대형 알림 팬아웃 시나리오로 확장된다면 `(background_run_id, created_at)` 복합 인덱스로 승격을 고려.

- **[INFO]** N+1 없음 — `createMany` 배치 insert 유지
  - 위치: `notifications.service.ts:307-`, `background-execution.processor.ts` `dispatchFailureNotification`
  - 상세: `recipients.map(...)` 로 엔트리 배열을 만들고 `notificationsService.createMany(...)` 를 단일 호출로 배치 저장한다(내부적으로 `notificationRepository.save(rows)` 한 번). `backgroundRunId` 필드가 추가됐을 뿐 배치 저장 구조 자체는 변경 없음 — N+1 위험 없음.
  - 제안: 없음.

- **[INFO]** 트랜잭션 경계 — 알림 배치 저장과 WS emit/이메일 발송 분리는 기존 패턴 유지
  - 위치: `notifications.service.ts` `createMany`
  - 상세: `save(rows)` 로 배치 삽입 후 각 row 에 대해 WS emit + `dispatchEmails` best-effort 를 수행하는 기존 구조가 이번 변경으로 바뀌지 않았다. `backgroundRunId` 필드 유무가 이 흐름에 조건부 로직을 추가하지 않으므로 트랜잭션/정합성 측면 리스크 추가 없음. (이번 diff 범위 밖이지만 이메일 발송 await 인라인 여부는 `plan/in-progress/notif-hardening-followups.md` 항목 3에서 별도 분석·보류 중으로, 결정 대기 상태임이 확인됨 — 이번 리뷰 대상 코드 변경과는 무관.)
  - 제안: 없음 (항목 3은 별도 트래킹 중).

- **[INFO]** SQL 인젝션 없음
  - 위치: 전체 diff
  - 상세: 신규/변경 쿼리는 모두 TypeORM `Repository.find({ where: {...} })` 형태의 파라미터 바인딩 API 를 사용하며, 문자열 조합으로 쿼리를 구성하는 코드는 없다. e2e 테스트의 raw SQL(`db.query('...WHERE background_run_id = $1', [backgroundRunId])`)도 `$1` positional 파라미터를 사용해 인젝션 위험 없음.
  - 제안: 없음.

- **[INFO]** 커넥션 관리
  - 위치: 전체 diff
  - 상세: 신규 코드에 직접적인 커넥션 획득/해제 로직은 없다 (TypeORM Repository 경유). e2e 테스트의 `pg.Client` 는 `beforeAll`/`afterAll` 에서 connect/end 하는 기존 패턴을 그대로 따름.
  - 제안: 없음.

- **[INFO]** 대량 데이터/페이지네이션
  - 위치: `findByBackgroundRun`
  - 상세: `background_run_id` 는 단일 run 에 종속된 알림 소수 건을 조회하는 목적이라 페이지네이션 부재가 문제되지 않는다 (기존 `findByResource` 도 페이지네이션 없이 동일 패턴이었음 — 변경 없음).
  - 제안: 없음.

## 요약

이번 변경의 핵심은 `notification` 테이블에 nullable `background_run_id UUID` 컬럼과 partial index 를 추가하는 V107 마이그레이션이다. 신규 컬럼이 DEFAULT 없이 추가되고 전체 row 가 NULL 상태이므로 `ADD COLUMN` 은 메타데이터 전용 변경, 뒤따르는 partial index 생성도 대상 row 0건이라 즉시 완료 — 마이그레이션 주석이 주장하는 무중단 안전성 근거는 기존 컨벤션(V053/V056 의 `CONCURRENTLY` 필요 사례)과 대비했을 때 타당하다. 딥링크 라우팅(`resource_type`/`resource_id`)과 per-run attribution(`background_run_id`)을 별도 컬럼으로 분리한 스키마 설계는 기존에 하나의 컬럼 쌍이 두 가지 의미를 겸용하며 발생했던 충돌(딥링크 404)을 해소하는 합리적 개선이며, 신규 index 도 조회 패턴(`background_run_id` 등가 조건)에 정확히 부합한다. `findByResource` → `findByBackgroundRun` 전환은 파라미터화된 TypeORM API 를 그대로 사용해 SQL 인젝션 위험이 없고, N+1·트랜잭션·커넥션 관리 측면에서도 배치 insert(`createMany`) 구조가 그대로 유지되어 새로운 리스크를 도입하지 않는다. 정렬 컬럼(`created_at`)이 인덱스에 포함되지 않은 점은 per-run 알림 건수가 소수라는 특성상 실질적 성능 영향이 없어 문제로 보지 않는다. 전반적으로 데이터베이스 관점에서 CRITICAL/WARNING 급 이슈는 발견되지 않았다.

## 위험도

LOW
