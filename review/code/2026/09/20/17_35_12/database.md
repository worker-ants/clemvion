# 데이터베이스(Database) 리뷰

리뷰 대상 중 DB 관련 코드는 `codebase/backend/src/modules/integrations/integrations.service.ts` (`rotate()`), 그 unit 테스트, 신규 e2e 테스트(`codebase/backend/test/integration-rotate-concurrency.e2e-spec.ts`) 세 파일이다. 나머지(plan/*.md, review/consistency/**)는 문서 산출물이라 DB 관점 대상이 아니다. 스키마 변경(migration)은 이번 diff에 없다.

## 발견사항

- **[INFO]** `pessimistic_write` 락에 대기 상한(lock timeout)이 없다
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` `rotate()` — `this.dataSource.transaction(async (manager) => { const fresh = await repo.findOne({ where: { id: entity.id, workspaceId }, lock: { mode: 'pessimistic_write' } }); ... })` (약 1146~1151행)
  - 상세: 트랜잭션 안 임계 구간이 「재읽기 → 머지 → 구조 검증(순수 함수) → `update` → 재읽기」뿐이고 외부 I/O(연결 테스트)는 트랜잭션 밖으로 이미 빠져 있어(같은 파일 1120행 `dispatchTest`), 락 보유 시간 자체는 짧다. 다만 `lock_timeout`/`statement_timeout` 등 명시적 대기 상한이 없으므로, 같은 행을 오래 잠그는 다른 경로(현재 코드베이스엔 없음)가 미래에 추가되면 이 경로가 무기한 대기할 수 있다. 코드 주석이 같은 모듈의 기존 선례(`integration-oauth.service.ts` CONC H-3)와 동일한 설계임을 명시하고 있어 신규 회귀는 아니고, 의도적 결정으로 보인다.
  - 제안: 현재로선 조치 불요. 향후 이 테이블에 장시간 트랜잭션을 여는 경로가 추가된다면 그때 `SET LOCAL lock_timeout` 도입을 검토.

- **[INFO]** 두 concurrent rotate 가 서로 다른 필드를 바꾸면 최종 병합 조합은 연결 테스트를 거친 적 없는 조합이 된다
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` `rotate()` 트랜잭션 콜백 내 `const committed = { ...freshBase, ...body.credentials };` (약 1170행) — 연결 테스트(1120행)는 이 `committed` 이전의 `merged`(옛 base 기준)로 수행됨
  - 상세: 연결 테스트는 락 밖에서 요청 시작 시점 스냅샷 위 병합값으로 수행되고, 커밋은 락 안에서 다시 읽은 최신 행 위 병합값으로 이뤄진다. 두 rotate 가 서로 다른 credential 필드를 바꾸는 드문 경우, 최종 저장되는 조합 자체는 어느 요청의 연결 테스트도 실제로 검증한 적 없는 조합일 수 있다. 코드 주석과 `plan/in-progress/rotate-lost-update.md` §B가 이 트레이드오프를 명시적으로 인지하고 "먼저 커밋된 필드가 옛 값으로 되돌아가는" 이전 상태보다 낫다는 근거로 의도적으로 채택했다.
  - 제안: 이미 문서화된 트레이드오프이므로 추가 조치는 불필요. 다만 이 정합성 잔여 리스크는 순수 코드 리뷰로는 재현 테스트가 어려우므로(구조상 서로 다른 필드 조합에 대한 재검증 로직이 없음), 향후 credential 검증 실패가 실제로 재현되면 이 지점을 먼저 의심할 근거로 삼을 것.

- **[INFO]** 저장 뒤 재읽기(`repo.findOne({ where: { id: entity.id } })`, 약 1200행)에는 `workspaceId` 필터가 빠져 있다
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` `rotate()` 트랜잭션 콜백 마지막의 `const row = affected ? await repo.findOne({ where: { id: entity.id } }) : null;`
  - 상세: `id`가 PK라 실질적 위험은 없다(같은 트랜잭션 안에서 이미 `workspaceId` 일치를 확인한 뒤의 재읽기). 변경 전 코드(`this.integrationRepository.findOne({ where: { id: entity.id } })`)도 동일 패턴이었으므로 이번 diff 가 만든 회귀는 아니다.
  - 제안: 조치 불요 — 기록 목적.

## 트랜잭션·락 설계 평가 (핵심 변경)

- **트랜잭션 범위**: `this.dataSource.transaction(async (manager) => {...})`로 「락 안 재읽기 → 권한 재검증 → 병합 → 구조 검증 → `update` → 재읽기」만 묶고, 느린 외부 호출(연결 테스트, 실제 접속 수 초)은 트랜잭션 밖에 둔 것은 적절하다 — DB 커넥션을 외부 I/O 동안 점유하지 않아 커넥션 풀 고갈 위험을 피한다. 같은 모듈의 재인증 콜백(`integration-oauth.service.ts` CONC H-3)과 동형 패턴이라 일관성도 있다.
- **락**: `pessimistic_write`(`SELECT … FOR UPDATE`)로 PK 단일 행만 잠근다. 테이블 잠금이나 광범위 잠금이 아니라 잠금 경합 범위가 최소화되어 있다.
- **예외 시 롤백**: 콜백 안에서 `NotFoundException`/`ForbiddenException`/`BadRequestException`을 던지면 TypeORM `DataSource.transaction()`이 자동으로 롤백 후 재던지므로, 검증 실패 시 부분 커밋이 남지 않는다. unit 테스트(`integrations.service.spec.ts` 신규 `describe('동시 rotate (lost update)')`)가 이 세 분기(값 병합·락+연결테스트 순서·권한 재검증)를 개별 커버한다.
- **부분 `update` 유지**: `save(entity)` 대신 바뀌는 컬럼만 `update`하는 기존 방침을 유지 — `logUsage()`가 같은 락을 잡지 않고 `last_used_at` 등을 원자적으로 갱신하는 것과 공존 가능하다(전체 `save`였다면 그 값을 되돌렸을 것).
- **SQL 인젝션**: 서비스 코드는 TypeORM Repository API(`findOne`/`update`)만 사용해 전부 파라미터화되어 있다. e2e 테스트(`integration-rotate-concurrency.e2e-spec.ts`)의 raw `pg` 쿼리(`SELECT … WHERE id = $1 FOR UPDATE`, `UPDATE … WHERE id = $1`)도 위치 파라미터를 사용해 인젝션 여지가 없다.
- **커넥션 관리**: 서비스 쪽은 NestJS `DataSource` DI(`integration-oauth.service.ts`에 이미 있는 동일 패턴) + `dataSource.transaction()`으로 커넥션 획득/반납이 프레임워크에 위임된다. e2e 테스트는 락 보유용 별도 `pg.Client`(`locker`)를 명시적으로 열고 `afterAll`에서 `locker.end()`/`db.end()`로 정리해 커넥션 누수가 없다.
- **인덱스**: 잠금·조회 모두 `id`(PK, `@PrimaryGeneratedColumn('uuid')`)로 단일 행을 찾으므로 인덱스 문제 없음. `workspaceId` 추가 필터는 이미 PK로 유일 행이 정해진 뒤의 방어적 검증이라 성능에 영향 없다.
- **N+1 / 대량 데이터**: `rotate()`는 단일 행 대상 함수이고 반복문 내 쿼리도 없다. 페이지네이션 대상 쿼리는 이번 변경에 없다.
- **마이그레이션**: 이번 diff에 스키마 변경(신규 컬럼·인덱스·마이그레이션 파일)이 없다. `plan/in-progress/rotate-lost-update.md` Rationale이 `@VersionColumn` 낙관적 잠금 대안을 "마이그레이션 필요"를 이유로 명시적으로 기각하고 기존 컬럼(`row lock`)만으로 해결한 것도 무중단 배포 관점에서 합리적이다.

## 요약

핵심 변경은 `IntegrationsService.rotate()`의 lost-update 결함(외부 연결 테스트가 도는 동안 다른 rotate 가 먼저 커밋한 필드를 옛 스냅샷으로 되돌리던 문제)을, 외부 호출을 트랜잭션 밖에 두고 트랜잭션 안에서 `pessimistic_write` 로 행을 다시 읽어 그 위에 병합하는 방식으로 닫았다. 같은 모듈의 기존 선례(재인증 CONC H-3)와 동형이고, 파라미터화된 쿼리·짧은 락 범위·자동 롤백·부분 `update` 유지 등 DB 관점의 기본기를 모두 지켰다. 신규 e2e 테스트도 실제 행 락을 테스트가 직접 쥐어 겹침을 우연에 맡기지 않고, raw SQL도 파라미터화돼 있으며 커넥션을 명시적으로 정리한다. 스키마 변경이 없어 마이그레이션 리스크도 없다. 남은 것은 모두 이미 문서화된 트레이드오프(락 대기 상한 부재, 서로 다른 필드를 바꾸는 두 rotate 의 미검증 조합)로 Critical/Warning 급 결함은 발견되지 않았다.

## 위험도

LOW
