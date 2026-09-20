# Database Review — rotate lost-update

## 발견사항

- **[INFO]** `pessimistic_write` 대기 상한(lock/statement timeout)이 없다
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` `rotate()` — `this.dataSource.transaction(...)` 블록 내 `repo.findOne({ where: { id: entity.id, workspaceId }, lock: { mode: 'pessimistic_write' } })`
  - 상세: 같은 모듈의 재인증 콜백(`integration-oauth.service.ts` CONC H-3, `dataSource.transaction` + `pessimistic_write`)과 동일한 설계다. 임계 구간에 외부 호출이 없고 대기는 다른 rotate 의 "재읽기+머지+UPDATE" 만큼(밀리초)이라 실무 위험은 낮다. `plan/in-progress/rotate-lost-update.md` INFO 2 에 의도적 유예로 명시돼 있고, 직전 리뷰 세션(`review/code/2026/09/20/17_35_12/database.md` 상당 INFO 5)에서도 같은 결론이었다.
  - 제안: 현재 조치 불요. rotate 호출 빈도가 높아지거나 사용자가 반복 클릭 가능한 표면으로 바뀌면 `lock_timeout` 재검토.

- **[INFO]** 저장 후 재조회(`repo.findOne({ where: { id: entity.id } })`, rotate 트랜잭션 블록 마지막)에 `workspaceId` 필터가 없다
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` `rotate()` 트랜잭션 콜백 하단 — `const row = affected ? await repo.findOne({ where: { id: entity.id } }) : null;`
  - 상세: `id` 는 PK 단독 조회라 실질적 테넌트 격리 위험은 없다(같은 트랜잭션 안에서 방금 `workspaceId` 로 스코핑된 행을 락으로 잡은 뒤 그 PK 로 재조회하는 것뿐). 변경 전 코드도 동일 패턴이었다.
  - 제안: 조치 불요.

- **[INFO]** `authType` 은 락 안에서 재검증하지 않는다 (락 전 1회만 `oauth2` 여부 확인)
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:1130` (`if (entity.authType === 'oauth2') { throw ... }`) vs 트랜잭션 블록
  - 상세: 저장소 전수 검토 결과 어떤 경로도 기존 행의 `authType` 을 변경하지 않는다(생성 시 1회 설정 후 불변) — 따라서 TOCTOU 표면이 아니다. `authType` 을 변경하는 기능이 신설되면 재검토 필요.
  - 제안: 조치 불요, 향후 서비스 전환 기능 도입 시 재확인.

## 궁정 관찰 (요약 근거)

- **트랜잭션·락**: `rotate()` 는 외부 호출(연결 테스트, 실제 접속·수 초)을 트랜잭션 **밖**에서 끝낸 뒤, `dataSource.transaction` + `pessimistic_write` 로 행을 **다시 읽어** 그 위에 머지·검증·부분 `update` 한다. 같은 모듈 선례(`integration-oauth.service.ts` CONC H-3)와 형태가 같고, advisory lock 재도입도 아니다(4-integration.md Rationale 이 기각한 사유 — "lock 보유 중 HTTP 요청을 트랜잭션에 묶는다" — 가 적용되지 않는다: 여기서는 HTTP/연결 테스트가 트랜잭션 밖이다). 이번 세션 대상 diff는 이전 리뷰(`17_35_12`)가 지적한 락 전/후 권한재검사·머지검증 로직 중복(WARNING 3/4/5)을 `assertCanRotate`/`mergeAndValidateCredentials` private 헬퍼로 통일했고, DB 질의 순서·조건은 변경 없이 그대로다(재확인 완료).
- **N+1**: 단일 행에 대한 처리로 반복문 내 개별 쿼리 없음. 트랜잭션 내 왕복은 재읽기(lock) → update → 재조회 3회로 고정, 지배 비용(연결 테스트 수 초)에 비해 무시 가능.
- **마이그레이션 안전성**: 스키마 변경 없음(`@VersionColumn` 도입은 명시적으로 기각 — `plan/complete/spec-draft-rotate-conflict.md` §Rationale). 컬럼 추가·인덱스 변경 전무.
- **스키마 설계**: 변경 없음.
- **커넥션 관리**: `dataSource.transaction()` 은 TypeORM 표준 획득/커밋-또는-롤백/해제 경로를 그대로 쓴다. 신규 e2e(`integration-rotate-concurrency.e2e-spec.ts`)는 이전 리뷰가 지적한 `BEGIN`~`COMMIT` try/finally 미보호(WARNING 6)를 이번 diff에서 수정했다 — 지금은 `try { ... } finally { await locker.query('ROLLBACK').catch(...); await pending?.catch(...); }` 로 감싸 assertion 실패 시에도 `locker` 커넥션이 행 락을 영구히 쥐지 않고, 대기 중이던 두 번째 rotate 요청(`pending`)도 드레인된다. `beforeAll`/`afterAll` 도 `locker.end()`/`db.end()` 로 커넥션을 정리한다.
- **SQL 인젝션**: 신규 e2e 의 원시 SQL(`SELECT ... FOR UPDATE`, `UPDATE ... WHERE id = $1`)은 전부 `$1`/`$2` 파라미터 바인딩이고, 서비스 코드는 TypeORM QueryBuilder/Repository API(객체 리터럴 조건)만 사용 — 인젝션 벡터 없음.
- **대량 데이터**: `rotate` 는 PK(`id`) + 인덱스된 `workspaceId` 단일 행 조회이며 페이지네이션 대상이 아니다. 대용량 테이블 스캔 없음.
- **인덱스**: `Integration` 엔티티는 `id` PK(자동 인덱스) 조회이고, 락 안 재읽기도 `id`(+`workspaceId` 부가 필터)로 PK 를 그대로 탄다. 신규 인덱스 요구 없음.

## 요약

이 세션에서 검토한 diff 는 직전 리뷰(`review/code/2026/09/20/17_35_12`)에서 database 관점 LOW 로 판정된 rotate() lost-update 수정에 대한 **후속 수정(refactor·테스트 보강·e2e try/finally·CHANGELOG)** 이며, 트랜잭션 경계·락 모드·쿼리 조건 등 데이터베이스 동작 자체는 바뀌지 않았다(권한재검사·머지검증 로직만 헬퍼로 통일). 신규 e2e 의 커넥션/트랜잭션 정리(try/finally)가 추가돼 오히려 커넥션 관리가 개선됐다. Critical/Warning 급 DB 결함 없음 — 남은 항목은 모두 기존에 문서화·유예된 트레이드오프(락 대기 상한 부재, authType 불변 전제)에 대한 INFO 수준 재확인이다.

## 위험도

LOW
