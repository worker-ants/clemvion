# 데이터베이스(Database) 리뷰

## 발견사항

- **[INFO]** `remove()` 의 선행 `findById` SELECT 와 원자적 `DELETE` 가 순차 실행되어 삭제 요청마다 왕복 쿼리가 1회 추가된다
  - 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts:306`(`findById` 호출), `:323-327`(`delete` + `affected === 0` 판정)
  - 상세: `affected === 0` 판정만으로 이미 "대상 없음"(원래 없던 경우·동시 삭제 레이스에서 진 경우 모두)을 404 `RESOURCE_NOT_FOUND` 로 정확히 가려낼 수 있어, 306행의 `await this.findById(id, workspaceId)` 는 반환값을 쓰지 않고 존재 확인용으로만 남아 기능적으로 겹친다. 다만 이번 diff 는 이를 "aware한 트레이드오프"로 명시했다 — 바로 위 주석(302-305행)이 "대상이 없으면 DELETE 를 시도하지 않는다"는 fail-fast 계약이라 설명하고, 신규 unit 테스트(`auth-configs.service.spec.ts` "대상이 없으면 DELETE 를 시도하지 않는다")가 `repo.delete` 가 호출되지 않음을 단언해 그 계약을 코드로 고정한다. 저빈도 관리자 액션(단건 DELETE)이라 왕복 1회 증가의 실질 영향은 미미하다.
  - 제안: 조치 불요. 정리하고 싶다면 `findById` 를 제거하고 `delete()` 단독의 `affected === 0` 판정으로 단순화 가능하나, 그 경우 "대상 없음 → DELETE 미시도" 계약을 지키는 테스트를 함께 제거/재정의해야 한다.

- **[INFO]** `DELETE` 실행과 `recordAudit` 기록이 단일 트랜잭션으로 묶여 있지 않다
  - 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts:323-334`
  - 상세: 새로 도입된 리스크가 아니라 이 저장소의 기존 계약("감사 기록은 best-effort — audit DB 장애가 본 CRUD 를 실패시키지 않는다")을 그대로 따른 것이며, 형제 PR(#1369~#1373)과 동일한 패턴이다. `DELETE` 성공 후 감사 기록이 실패해도 데이터 정합성(auth_config 자체)에는 영향이 없고, 다만 감사 추적성만 낮아질 수 있는 기존 트레이드오프다.
  - 제안: 현행 계약 유지. 별도 조치 불요.

## 검증한 항목 (문제 없음)

- **동시성/원자성**: 종전 `findOne` → `remove(entity)` 조합은 락이 없어 동시 DELETE 두 건이 모두 `affected` 를 확인하지 않고 감사 로그를 남기는 이중 감사 결함이 있었다(plan 문서 실측: 고치기 전 `[204, 204]` + 감사 2건). 이번 변경은 `DELETE ... WHERE id = $1 AND workspace_id = $2` 단일 원자적 문장으로 전환하고 `affected === 0` 을 **명시 비교**(`auth-configs.service.ts:327`)로 판정한다. 동일 행을 겨냥한 두 개의 단일 `DELETE` 는 Postgres 의 행 잠금으로 직렬화되어 승자만 1행을 지우므로, 별도 advisory lock/row lock 없이도 안전하다. e2e 테스트(`test/auth-config-delete-concurrency.e2e-spec.ts`)가 `SELECT ... FOR UPDATE` 로 실겹침을 만들어 실제로 `[204, 404]` + 감사 1건을 확인한다.
- **`affected: null|undefined` 오판정 방지**: `!affected` 대신 `affected === 0` 명시 비교를 사용해 드라이버 미보고(`null`/`undefined`)를 삭제 실패로 오판하지 않는다. 회귀 테스트(`auth-configs.service.spec.ts` `it.each([[undefined],[null]])`)가 이 분기를 정확히 겨냥하며, 형제 PR(#1371)에서 이 대조군 부재로 `=== 0` → `!affected` 뮤턴트가 살아남았던 사례를 근거로 처음부터 포함시켰다.
- **인덱스**: `auth_config.id` 는 PK(UUID), `workspace_id` 는 `V127__auth_config_workspace_id_index.sql` 로 인덱스가 존재해(실측 확인) `DELETE ... WHERE id = $1 AND workspace_id = $2` 는 PK 조회 1건으로 처리되고 풀스캔 위험이 없다.
- **캐스케이드/ORM 라이프사이클 훅**: `remove(entity)` → `delete(criteria)` 전환이 캐스케이드 동작을 바꾸는지가 핵심 우려인데, diff 주석과 plan 문서가 `AuthConfig` 엔티티에 `cascade: true`·`@OneToMany` 가 없고 저장소 전체에 ORM 라이프사이클 훅/subscriber 가 0건임을 실측했다고 밝힌다. `trigger.auth_config_id` 의 `ON DELETE SET NULL` 은 DB 레벨 FK 제약(`V001__initial_schema.sql:210`)이라 두 삭제 방식 모두 동일하게 발동한다.
- **마이그레이션 안전성**: 이번 diff 에 신규 `.sql` 마이그레이션이 없어 무중단 배포 관점의 lock/데이터 손실 리스크가 없다.
- **SQL 인젝션**: 서비스 코드는 TypeORM `Repository.delete(criteria)`(객체 기반 파라미터 바인딩)만 사용한다. 신규 e2e 테스트의 raw `pg.Client` 쿼리(`SELECT id FROM auth_config WHERE id = $1 FOR UPDATE`, 감사 카운트 쿼리)도 전부 `$1`/`$2` 파라미터화되어 있고 문자열 결합이 없다.
- **N+1**: 반복문 내 개별 쿼리 패턴 없음 — 단건 삭제 경로다.
- **커넥션 관리**: e2e 테스트의 `db`/`locker` 두 `pg.Client` 는 `beforeAll` 에서 `connect()`, `afterAll` 에서 `end()` 로 명시적으로 해제된다(`auth-config-delete-concurrency.e2e-spec.ts`). `locker` 의 `BEGIN`/`SELECT...FOR UPDATE` 트랜잭션은 `try/finally` 로 `ROLLBACK`(정상 경로는 앞서 `COMMIT`)이 보장돼 커넥션이 열린 트랜잭션 상태로 유실되지 않는다.
- **대량 데이터**: 이번 변경은 단건 삭제 경로이고 페이지네이션 대상 쿼리(`findAll`, `getUsage`)에는 변경이 없다.
- **e2e 감사 카운트 쿼리**: 이번 라운드(resolution 커밋 `caa9bae66`)에서 `resource_type = 'auth_config'` 필터가 추가돼(`test/auth-config-delete-concurrency.e2e-spec.ts` 감사 카운트 쿼리) 형제 `integration-delete-concurrency.e2e-spec.ts` 와 스코프가 정렬됐다. `resource_id`(UUID)+`action` 조합만으로도 이미 사실상 유일했으나, 이번 필터 추가로 판별력이 더 명시적이 됐다.
- **테스트 mock 의 `delete` 시뮬레이션**: `auth-configs.service.spec.ts` 의 mock 저장소(`makeAuthConfigRepo`)가 `delete({ id })` 를 `store.delete(id)` 존재 여부로 `affected` 를 계산해 실제 원자적 DELETE 의 의미(대상이 있었는지 여부)를 정확히 모사한다. 반환 타입을 `Promise<DeleteResult>` 로 명시해 `mockResolvedValueOnce` 캐스트가 타입체크를 통과하도록 한 것도 실측 근거(주석)가 있다.

## 요약

핵심 변경은 `AuthConfigsService.remove()` 를 "무락 조회 후 `remove(entity)`" 방식에서 "워크스페이스로 스코프한 단일 원자적 `DELETE` + `affected === 0` 명시 비교" 방식으로 바꿔, 동시 삭제 두 건이 모두 `auth_config.delete` 감사 로그를 남기던 결함을 새 락을 들이지 않고 DB 원자성만으로 해결했다. PK/인덱스 활용, 파라미터화된 쿼리, 캐스케이드/라이프사이클 훅 무영향 확인, `null`/`undefined` vs `0` 오판정 방지가 모두 실측·회귀 테스트로 뒷받침되고 신규 마이그레이션도 없다. 이번 라운드에서 추가된 e2e 감사 카운트 쿼리의 `resource_type` 필터, mock `delete` 시뮬레이션 정교화 등은 데이터베이스 관점에서 기존 결론(LOW)을 흔들지 않는다. 남은 흠은 이제 불필요해진 사전 `findById` SELECT(왕복 1회 추가, 의도적 fail-fast 계약으로 테스트에 고정됨)와 삭제·감사 기록이 트랜잭션으로 묶이지 않은 것(이 저장소의 기존 best-effort 계약)인데, 둘 다 이번 PR 이 새로 만든 리스크가 아니며 조치 불요로 판단된다.

## 위험도

LOW
