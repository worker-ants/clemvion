# Database 리뷰 — integration-dup-delete (11_32_06)

## 발견사항

- **[INFO]** 원자적 `DELETE` 커밋과 감사 로그 기록·`broadcastCredentialChange` 가 단일 DB 트랜잭션으로 묶여 있지 않다
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:799`(`delete`)~`817`(`broadcastCredentialChange`)
  - 상세: `delete({ id, workspaceId })` 가 `affected: 1` 로 즉시 커밋된 뒤, 트랜잭션 경계 없이 `auditLogsService.record(...)` 와 `broadcastCredentialChange(id)` 가 순차 호출된다. 둘 중 하나가 예외를 던지면 리소스는 이미 삭제됐지만 감사 행이 없거나 캐시 무효화가 누락된 채로 500 이 반환될 수 있다. 다만 실측 결과 이는 이번 diff 가 새로 만든 패턴이 아니다 — 같은 결함 클래스를 고친 형제 경로(`triggers.service.ts`, `schedules.service.ts`, `workflows.service.ts`)도 "삭제 확정 → 커밋 후 감사/후처리" 순서를 동일하게 따르며, 이 PR 의 `remove(entity)` → `delete(criteria)` 전환은 이 비원자성 자체에는 영향을 주지 않았다.
  - 제안: 조치 불요(형제 4경로와 일관된 기존 설계). "삭제+감사 원자성" 을 다루는 별도 트래커가 생기면 4경로를 함께 검토할 것.

- **[INFO]** 사용처 검사(`queryUsageNodes`)와 원자적 `DELETE` 사이의 TOCTOU 잔존
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:774`(`queryUsageNodes`)~`799`(`delete`)
  - 상세: `usages.length > 0` 검사(무락)를 통과한 직후, 다른 요청이 같은 integration 을 워크플로 노드에 새로 연결하면 "사용 중인데 삭제된" 상태가 이론상 가능하다. 이번 diff 는 이 구간의 순서·락 유무를 바꾸지 않았고(종전 `remove(entity)` 코드에도 동일 무락 구간 존재), `plan/in-progress/integration-dup-delete.md` "이 PR 이 하지 않는 것" 섹션에 별개 사안으로 명시적 스코프 아웃 및 트래커 등재가 되어 있음을 확인했다.
  - 제안: 조치 불요(의도된 스코프 경계, 신규 회귀 아님).

- **[INFO]** 감사 로그 `details`(`serviceType`/`name`)가 삭제 직전이 아닌 `findOne` 조회 시점의 스냅샷
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:765`(`findOne`), `809`~`813`(`details`)
  - 상세: `findOne` 과 `delete` 사이에 다른 요청이 같은 integration 의 `serviceType`/`name` 을 갱신하면 감사 로그에는 삭제 시점이 아닌 조회 시점 값이 남을 수 있다. 영향은 감사 메타데이터에 국한되고 형제 구현들도 동일 패턴이라 이번 PR 고유의 회귀는 아니다.
  - 제안: 조치 불요(관행과 일치, 영향 낮음).

## 점검 관점별 확인 결과 (실측)

1. **인덱스** — `Integration` 은 `id UUID` PK(`V001__initial_schema.sql:177`), `workspace_id` 는 `idx_integration_workspace_service (workspace_id, service_type)` 복합 인덱스가 있다(`V002__indexes.sql:36`). `DELETE ... WHERE id = $1 AND workspace_id = $2` (`integrations.service.ts:799-802`)는 PK 하나로 최대 1행까지 좁혀지므로 `workspace_id` 인덱스 유무와 무관하게 성능 문제 없음. 문제 없음.
2. **N+1** — `remove()` 안에 반복문 내 개별 쿼리 없음. `findOne` → `queryUsageNodes`(단일 조회) → `delete`(단일 문장) 순차 실행. 문제 없음.
3. **트랜잭션** — 단일 `DELETE ... WHERE id = $1 AND workspace_id = $2` 문장 자체는 원자적이라 별도 트랜잭션·락 없이도 "둘 중 하나만 1행 삭제"가 보장된다는 코드 주석(`integrations.service.ts:781-798`)·plan 근거가 실측과 일치한다. `Integration` 엔티티(`codebase/backend/src/modules/integrations/entities/integration.entity.ts`)에 `cascade: true` 관계·`@OneToMany`·`@BeforeRemove`/`@AfterRemove`·`EventSubscriber` 가 전혀 없음을 grep 으로 직접 확인 — `remove(entity)` → `delete(criteria)` 전환이 ORM 레벨 부수효과를 건너뛰지 않는다는 주장이 성립한다. 단, 위 [INFO] 항목대로 "DELETE + 감사 + broadcast" 전체를 하나의 트랜잭션으로 묶지는 않는다(형제 경로와 동일한 기존 설계).
4. **마이그레이션 안전성** — 이번 diff 에 스키마 변경(신규 마이그레이션 파일) 없음. 해당 없음.
5. **스키마 설계** — 테이블 구조 변경 없음. `integration_usage_log`(`V008__integration_usage_log_and_metadata.sql:51`), `integration_oauth_state`/`integration_expiry_alert`(`V009__integration_oauth_and_expiry.sql:16,47`) 가 모두 `integration_id ... REFERENCES integration(id) ON DELETE CASCADE` 로 DB 레벨 FK CASCADE 를 갖고 있음을 마이그레이션 파일에서 직접 확인 — ORM 호출이 `remove()`→`delete()` 로 바뀌어도 두 방식 모두 raw SQL `DELETE` 로 귀결되므로 DB 레벨 CASCADE 동작은 동일하다는 코드 주석 주장이 실측과 일치한다.
6. **커넥션 관리** — 신규 e2e(`codebase/backend/test/integration-delete-concurrency.e2e-spec.ts`)는 앱 커넥션 풀과 별개인 raw `pg.Client` 두 개(`db`, `locker`)를 `beforeAll`에서 `connect()`, `afterAll`에서 `end()`로 명확히 열고 닫는다(L27-50). 락 보유 트랜잭션은 `finally` 블록에서 항상 `ROLLBACK`(실패해도 `.catch`로 흡수)을 시도하고 `pending` 프라미스도 흡수해 미종료 요청이 커넥션을 붙들지 않는다(L104-107). 커넥션 누수 없음.
7. **SQL 인젝션** — 서비스 코드는 TypeORM `repository.delete({ id, workspaceId })` criteria 객체(파라미터 바인딩)만 사용, 문자열 연결 없음. e2e 테스트의 raw SQL(`SELECT id FROM integration WHERE id = $1 FOR UPDATE`, `SELECT COUNT(*)::text ... WHERE resource_id = $1`)도 전부 `$1` 플레이스홀더 사용. 문제 없음.
8. **대량 데이터** — 단일 PK 기반 삭제/조회이며 대용량 스캔·페이지네이션 대상 쿼리 아님. 해당 없음.

## 동시성-DB 상호작용 확인 (근거 재검증)

e2e 테스트는 별도 커넥션(`locker`)이 대상 행을 `SELECT ... FOR UPDATE` 로 잠근 채 두 `DELETE /api/integrations/:id` 요청을 동시에 발사한다. 두 요청 모두 무락 `findOne`·`queryUsageNodes` 를 통과한 뒤 `DELETE` 문에서 행 잠금 대기로 직렬화되고, `locker` 가 `COMMIT` 하면 먼저 대기열에 든 `DELETE` 가 1행을 지우고(`affected: 1`), 나중 것은 READ COMMITTED 재평가 결과 대상 행이 이미 없어 `affected: 0` 을 돌려받는다 — PostgreSQL 기본 격리수준에서 단일 행에 대한 두 `DELETE` 요청 잠금 체인이 하나뿐이라 데드락 가능성도 없다. 이 설계가 별도 advisory lock·행 락 없이도 "둘 중 하나만 삭제" 를 보장한다는 코드·plan 주석의 주장은 타당하며, `affected === 0` 명시 비교(`!affected` 아님)로 드라이버 미보고(`null`/`undefined`) 케이스가 정상 삭제를 404 로 뒤집지 않도록 대조군 테스트(`integrations.service.spec.ts:1097-1109`)까지 갖춘 점도 DB 계약 관점에서 적절하다.

## 검증용 뮤테이션

이번 리뷰에서는 저장소 파일을 뮤테이션하지 않았다 — 읽기 전용 확인(`Read`/`grep`/마이그레이션 파일 열람)만 수행했다. `git status --short` 결과 이 리뷰 세션 자신의 출력 디렉터리(`review/code/2026/09/21/11_32_06/`) 외 변경 없음, 다른 병렬 리뷰어의 잔존 뮤테이션도 관측되지 않았다.

## 요약

`IntegrationsService.remove()` 를 무락 `remove(entity)` 에서 원자적 `delete({ id, workspaceId })` + `affected === 0` 명시 판정으로 바꾼 처방은 DB 관점에서 적절하다. `id` PK 기반 삭제라 인덱스 문제가 없고, 단일 `DELETE` 문장의 원자성만으로 락 없이 동시 삭제 경쟁을 직렬화하는 근거(PostgreSQL 행 잠금)가 실측과 일치하며, `cascade:true`/`@OneToMany`/엔티티 리스너 부재와 DB 레벨 FK CASCADE(V008/V009) 존속을 코드·마이그레이션 양쪽에서 직접 확인해 `remove()`→`delete()` 전환에 따른 부수효과 누락은 없다. 파라미터화된 쿼리만 사용해 SQL 인젝션 우려도 없고, 신규 e2e 는 별도 raw 커넥션을 안전하게 열고 닫는다. 삭제·감사·broadcast 가 단일 트랜잭션으로 묶이지 않은 점과 사용처검사-삭제 사이 TOCTOU 는 남아 있으나, 둘 다 형제 4경로와 동일한 기존 패턴이거나 plan 문서에서 의도적으로 스코프 아웃된 사안이라 이번 diff 가 새로 만든 회귀가 아니다. Critical/Warning 급 DB 이슈는 발견되지 않았다.

## 위험도

LOW
