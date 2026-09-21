# Database 리뷰 — webauthn-dup-delete

## 발견사항

- **[INFO]** `DELETE` 조건절에 `userId` 추가는 인덱스 관점에서 문제 없음
  - 위치: `codebase/backend/src/modules/auth/webauthn/webauthn.service.ts:549-552`
  - 상세: 종전 `delete({ id: credentialUuid })` 를 `delete({ id: credentialUuid, userId })` 로 바꿔 `WHERE id = $1 AND "userId" = $2` 가 된다. `id` 가 PK(UNIQUE)이므로 플래너는 PK 인덱스로 단일 행을 찾은 뒤 `userId` 를 추가 필터로 검사한다 — 별도 복합 인덱스 없이도 성능 저하가 없다. 소유권 조건을 애플리케이션 레이어의 사전 `findOne` + JS 비교에만 의존하던 것에서 SQL 조건절 자체로 옮겨 TOCTOU 창을 줄인 것도 타당하다.
  - 제안: 없음 (현행 유지 권장).

- **[INFO]** 원자적 조건부 `DELETE` + `affected` 명시 비교로 이중 삭제/이중 감사를 SELECT-FOR-UPDATE 없이 닫음
  - 위치: `codebase/backend/src/modules/auth/webauthn/webauthn.service.ts:549-558`
  - 상세: `findOne`(라인 523-525)은 무락 조회이므로 동시 삭제 두 건이 모두 여기까지 도달할 수 있다. 하지만 뒤이은 `DELETE ... WHERE id=$1 AND "userId"=$2` 는 단일 원자적 SQL 문이라 두 트랜잭션 중 하나만 실제로 행을 지우고 다른 하나는 `affected: 0` 을 받는다 — 별도 트랜잭션/명시적 락 없이 DB 엔진의 행 단위 원자성만으로 경합을 닫는 설계다. 판정을 `affected === 0` **명시 비교**로 한 것도 적절하다 — 일부 드라이버가 `affected` 를 `undefined`/`null` 로 보고할 수 있는데, 이를 `!affected` 로 판정하면 정상 삭제(드라이버 미보고)까지 404 로 뒤집는 회귀가 생긴다. 단위 테스트(`webauthn.service.spec.ts` `it.each([[undefined],[null]])`)와 e2e(`SELECT ... FOR UPDATE` 로 실제 겹침을 만든 뒤 `[204,404]` + 감사 1건 단언)가 이 불변식을 모두 대조군까지 포함해 검증하고 있어 신뢰도가 높다.
  - 제안: 없음.

- **[INFO]** `DELETE` 이후 `countCredentials` + `usersService.update` 는 트랜잭션 밖의 별도 두 쿼리 — 기존부터 있던 TOCTOU 창(이번 diff 로 신규 도입되지 않음)
  - 위치: `codebase/backend/src/modules/auth/webauthn/webauthn.service.ts:560-564`
  - 상세: 삭제가 확정된 뒤 `remaining = await countCredentials(userId)` 를 별도 쿼리로 다시 읽고, `remaining === 0` 이면 `usersService.update` 로 복구 코드를 NULL 화한다. 두 쿼리 사이에 같은 사용자가 새 credential 을 등록하면(레이스), COUNT 시점과 UPDATE 커밋 시점 사이의 순서에 따라 이론상 `remaining` 판정이 최신 상태를 반영하지 못할 여지가 있다. 다만 이 패턴(count 후 조건부 update, 비-트랜잭션)은 이번 PR 이전부터 동일하게 존재했고 이번 diff 가 바꾼 부분은 오직 `delete()` 호출 자체(조건절 + `affected` 판정)이므로, 이번 변경이 새로 만든 결함은 아니다. 형제 PR(#1369~#1375)들의 스코프 결정과 동일하게 이번 PR 범위 밖으로 보인다.
  - 제안: 필요하다면 별도 항목으로 `remaining` 재확인까지 하나의 트랜잭션/락으로 묶는 개선을 트래커에 등재 검토(이번 PR 블로킹 사유 아님).

- **[INFO]** e2e 테스트의 커넥션 관리·트랜잭션 사용은 적절
  - 위치: `codebase/backend/test/webauthn-credential-delete-concurrency.e2e-spec.ts:37-50`, `76-105`
  - 상세: 락을 쥐는 `locker` 커넥션과 검증용 `db` 커넥션을 분리해 `afterAll` 에서 각각 `end()` 로 해제한다. 본문에서는 `BEGIN` → `SELECT ... FOR UPDATE` → 두 요청 동시 발사 → 공허성 가드 → `COMMIT` 을 `try/finally` 로 감싸 실패 시에도 `ROLLBACK`(에러는 `.catch(() => undefined)` 로 흡수)과 `pending` promise 정리를 보장한다. 다만 정상 경로에서는 `COMMIT` 이 이미 실행된 뒤 `finally` 블록이 다시 `ROLLBACK` 을 호출한다 — PostgreSQL 은 "트랜잭션 없음" 경고만 내고 에러는 아니며 `.catch()` 로 흡수되므로 기능적 결함은 아니다(사소한 코드 스타일 관찰).
  - 제안: 없음(선택적으로 `COMMIT` 성공 시 `finally` 의 불필요한 `ROLLBACK` 을 건너뛰도록 플래그를 둘 수 있으나 필수 아님).

- **[INFO]** SQL 인젝션 관점 — 파라미터화 준수
  - 위치: `codebase/backend/test/webauthn-credential-delete-concurrency.e2e-spec.ts:56-62`, `110-116`; `codebase/backend/src/modules/auth/webauthn/webauthn.service.ts:549-552`
  - 상세: e2e 테스트의 raw SQL(`INSERT`, `SELECT ... FOR UPDATE`, 감사 로그 조회)이 모두 `$1`/`$2`/`$3` 플레이스홀더 + 파라미터 배열을 사용한다. 서비스 코드의 `credentialRepo.delete({ id, userId })` 도 TypeORM 이 파라미터 바인딩으로 변환한다. 문자열 접합 방식의 쿼리는 없다.
  - 제안: 없음.

## 해당 없음 항목

- **마이그레이션 안전성 / 스키마 설계**: 이번 변경은 스키마(컬럼·인덱스·제약조건) 변경을 포함하지 않는다. `user_id` 컬럼은 기존 `webauthn_credential` 테이블에 이미 존재(e2e INSERT 문에서 확인).
- **N+1 쿼리**: 반복문 내 개별 쿼리 패턴 없음. `deleteCredential` 은 순차 단일 쿼리(조회 → DELETE → COUNT → 조건부 UPDATE) 구조를 유지한다.
- **대량 데이터/페이지네이션**: 사용자별 WebAuthn credential 수는 소규모로 한정되는 도메인이라 대용량 스캔·페이지네이션 이슈가 없다.
- **커넥션 풀(서비스 코드)**: TypeORM `Repository` 는 기존 주입 방식 그대로이며 이번 diff 로 커넥션 획득/해제 로직이 바뀌지 않았다.

## 요약

핵심 변경은 `WebAuthnService.deleteCredential()` 의 `credentialRepo.delete()` 가 버리던 `affected` 값을 판정에 사용하고, 조건절에 `userId` 를 추가해 동시 삭제 경합을 별도 락이나 트랜잭션 없이 DB 의 원자적 조건부 DELETE 만으로 닫은 것이다. 인덱스·SQL 인젝션·마이그레이션·스키마 관점에서 새로 도입된 위험은 없고, `affected === 0` 명시 비교(드라이버 미보고 `undefined`/`null` 을 성공으로 취급)와 소유권을 SQL 조건절로 옮긴 점 모두 데이터 정합성 측면에서 개선이다. e2e 테스트는 `SELECT ... FOR UPDATE` 로 실제 행 락 경합을 재현하고 감사 로그 건수·커넥션 해제까지 검증해 신뢰도가 높다. 유일한 잔여 관찰은 `DELETE` 이후 `countCredentials`+`usersService.update` 가 여전히 트랜잭션 밖의 별도 두 쿼리라는 점인데, 이는 이번 diff 가 새로 만든 문제가 아니라 형제 PR 들과 동일하게 기존부터 있던 설계이며 이번 PR 범위 밖으로 판단된다.

## 위험도

LOW
