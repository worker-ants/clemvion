# Database 리뷰 — webauthn-dup-delete (2026-09-21 18:31:57)

## 발견사항

- **[INFO]** `DELETE` 조건절에 `userId` 추가는 인덱스 관점에서 문제 없음 — 기존 판정과 동일하게 유지
  - 위치: `codebase/backend/src/modules/auth/webauthn/webauthn.service.ts:561-564`, `codebase/backend/src/modules/auth/webauthn/entities/webauthn-credential.entity.ts:17-22`
  - 상세: `credentialRepo.delete({ id: credentialUuid, userId })` 는 `WHERE id = $1 AND "user_id" = $2` 로 컴파일된다. `id` 는 `@PrimaryGeneratedColumn('uuid')`(PK/UNIQUE)이므로 플래너는 PK 인덱스로 단일 행을 특정한 뒤 `user_id` 를 추가 필터로 검사한다 — `user_id` 에는 별도로 `idx_webauthn_credential_user` 인덱스가 이미 있지만 이 쿼리 경로에서는 PK 인덱스만으로 충분해 복합 인덱스 없이도 성능 저하가 없다. 소유권 검증을 애플리케이션 레이어의 사전 `findOne`+JS 비교에만 의존하던 것에서 SQL 조건절 자체로 옮긴 것도 TOCTOU 창을 줄이는 타당한 강화다.
  - 제안: 없음(현행 유지 권장).

- **[INFO]** 원자적 조건부 `DELETE` + `affected` 명시 비교(`affected === 0`)로 동일 credential 이중 삭제/이중 감사를 락 없이 닫음 — 실측·단위테스트·e2e 로 뒷받침됨
  - 위치: `codebase/backend/src/modules/auth/webauthn/webauthn.service.ts:538-567`
  - 상세: `findOne`(538-540)은 무락 조회라 동시 DELETE 두 건이 모두 그 지점을 통과할 수 있다. 그러나 뒤이은 `DELETE ... WHERE id=$1 AND user_id=$2` 는 단일 원자적 SQL 문이므로 두 요청 중 하나만 실제로 행을 지우고 나머지는 `affected: 0` 을 받는다 — 별도 트랜잭션/명시적 락 없이 DB 엔진의 행 단위 원자성만으로 경합이 닫힌다. `affected === 0` 을 **명시 비교**로 판정한 것도 적절하다 — 일부 드라이버가 `affected` 를 `undefined`/`null` 로 보고할 수 있는데 이를 `!affected` 로 판정하면 정상 삭제(드라이버 미보고)까지 404 로 뒤집는 회귀가 생긴다. 이 대조군은 `webauthn.service.spec.ts` `it.each([[undefined],[null]])` 로, 실제 겹침은 `webauthn-credential-delete-concurrency.e2e-spec.ts` 의 `SELECT ... FOR UPDATE` 행 락 시나리오(`[204,404]` + 감사 1건 단언)로 검증돼 신뢰도가 높다.
  - 제안: 없음.

- **[INFO]** `DELETE` 이후 `countCredentials`+`usersService.update` 는 여전히 트랜잭션 밖의 별도 두 쿼리 — 이번 diff 로 신규 도입된 갭이 아니며, "서로 다른 credential 동시 삭제" 케이스는 순서 논증 + e2e 캐너리로 반증됨을 직접 확인
  - 위치: `codebase/backend/src/modules/auth/webauthn/webauthn.service.ts:569-573`
  - 상세: `deleteCredential` 은 `dataSource.transaction(...)` 을 쓰지 않는다(파일 내 338행의 `verifyAuthentication` 만 트랜잭션을 사용하며, `deleteCredential` 은 안 씀 — grep 으로 직접 확인). 따라서 `DELETE`·`countCredentials`·`usersService.update` 는 각각 독립 autocommit 문이다. 이전 라운드(`review/code/2026/09/21/18_03_54`) 의 concurrency 리뷰어가 "서로 **다른** credential 두 개를 동시 삭제하면 두 `countCredentials` 가 서로 상대의 커밋 전 스냅샷을 읽어 둘 다 `remaining===1` 로 오판할 수 있다"(WARNING #4)고 지적했는데, 이번 CHANGELOG/plan(`plan/complete` 예정 `webauthn-dup-delete.md`)이 순서 논증으로 반증했다고 주장한다. 직접 재확인한 결과 논증은 성립한다: 같은 요청 안에서 `DELETE` 커밋(t1 또는 t3)이 `count` 조회(t2 또는 t4)보다 반드시 먼저 일어나고(await 순서), Postgres 커밋은 WAL 상 전순서이므로 나중에 커밋하는 쪽(WLOG R2, t3)의 `count`(t4>t3>t1)는 두 삭제가 모두 이미 커밋된 뒤의 스냅샷을 본다 — 즉 **나중에 커밋하는 쪽은 항상 `remaining===0` 을 관측**하고 최소 한쪽은 NULL 화를 수행한다. 이는 단일 Postgres 프라이머리(읽기 지연이 있는 복제본을 쓰지 않는 구성)라는 전제에서 성립하며, 이 코드베이스는 이 경로에서 읽기 전용 복제본을 쓰지 않으므로 전제가 유효하다. e2e 두 번째 케이스(서로 다른 credential 2개 동시 삭제 → `webauthn_recovery_codes` 가 NULL 로 수렴하는지 DB 직접 조회)가 이 논증을 실제로 캐너리로 고정하고 있어, "둘 다 1 로 오판" 시나리오가 발생하지 않는다는 결론은 근거가 있다.
  - 제안: 논증이 성립하는 전제(단일 트랜잭션/autocommit 문 + 단일 프라이머리)가 향후 바뀌면(예: 이 메서드를 트랜잭션으로 감싸거나 읽기 복제본을 도입하면) 캐너리 e2e 가 RED 로 전환되므로 별도 조치 불요. 다만 근본적인 "삭제+카운트+복구코드 NULL 화" 비원자성 자체는 여전히 남아 있으므로(이번 PR 이 만든 갭이 아니고, 트래커에 이미 등재됨) 재등재 불필요.

- **[INFO]** e2e 테스트의 커넥션 관리·트랜잭션 사용은 두 번째 케이스 추가 후에도 적절
  - 위치: `codebase/backend/test/webauthn-credential-delete-concurrency.e2e-spec.ts:37-50`(연결 수립/해제), `76-105`(첫 번째 케이스 BEGIN/락/COMMIT/ROLLBACK), `140-188`(두 번째 케이스)
  - 상세: 락을 쥐는 `locker` 커넥션과 검증용 `db` 커넥션을 분리해 `afterAll` 에서 각각 `end()` 로 해제한다. 첫 번째 케이스는 `BEGIN → SELECT ... FOR UPDATE → 동시 발사 → 공허성 가드 → COMMIT` 을 `try/finally` 로 감싸 실패 시에도 `ROLLBACK`(`.catch(() => undefined)` 로 흡수)과 `pending` 정리를 보장한다(정상 경로에서 COMMIT 후 finally 가 재차 ROLLBACK 을 호출하는 점은 기존과 동일한 사소한 스타일 관찰이며 PostgreSQL 이 경고만 내고 에러는 아니라 기능적 결함은 아니다). 두 번째 케이스는 서로 다른 행이라 공유 락 지점이 없어 `BEGIN`/`locker` 를 쓰지 않고 `Promise.all` 로 직접 동시 발사하는데, 이는 그 케이스의 목적(공유 자원 경합이 아니라 서로 다른 행에 대한 독립 요청의 최종 상태 수렴을 보는 것)과 일치해 적절한 설계다.
  - 제안: 없음.

- **[INFO]** SQL 인젝션 관점 — 신규 추가된 두 번째 e2e 케이스도 파라미터화 준수
  - 위치: `codebase/backend/test/webauthn-credential-delete-concurrency.e2e-spec.ts:147-151`(INSERT), `159-161`(UPDATE), `163-164`(SELECT)
  - 상세: 신규 INSERT/UPDATE/SELECT 문 모두 `$1`/`$2`/`$3` 플레이스홀더 + 파라미터 배열을 사용한다. 문자열 접합 방식의 동적 SQL 은 없다.
  - 제안: 없음.

## 해당 없음 항목

- **마이그레이션 안전성 / 스키마 설계**: 이번 diff(누적)는 스키마(컬럼·인덱스·제약조건) 변경을 포함하지 않는다. 소스 코드·테스트·CHANGELOG·plan 문서 변경뿐이다.
- **N+1 쿼리**: 반복문 내 개별 쿼리 패턴 없음. `deleteCredential` 은 순차 단일 쿼리(조회 → DELETE → COUNT → 조건부 UPDATE) 구조를 유지한다.
- **대량 데이터/페이지네이션**: 사용자별 WebAuthn credential 수는 소규모로 한정되는 도메인이라 대용량 스캔·페이지네이션 이슈가 없다.
- **커넥션 풀(서비스 코드)**: TypeORM `Repository` 주입 방식 그대로이며 이번 diff 로 커넥션 획득/해제 로직이 바뀌지 않았다.

## 요약

이번 라운드의 실질 프로덕션 DB 변경은 이전 라운드(`review/code/2026/09/21/18_03_54`)에서 이미 LOW 로 판정된 `deleteCredential()` 의 원자적 조건부 `DELETE`+`affected` 명시 비교와 동일하며, 이번에 추가된 것은 `throwCredentialNotFound()` 헬퍼 추출(순수 리팩터, DB 무관), JSDoc 보강, CHANGELOG/plan 문서 갱신, 그리고 "서로 다른 credential 동시 삭제 시 `remaining` 오판" 우려(WARNING #4)를 반박하는 두 번째 e2e 케이스다. 이 두 번째 케이스가 의존하는 순서 논증(autocommit 단일 문 + Postgres 커밋 전순서 → 나중에 커밋하는 쪽이 항상 `remaining===0` 을 봄)을 직접 재확인한 결과 논증은 성립하며, `deleteCredential` 이 실제로 트랜잭션을 쓰지 않음(`dataSource.transaction` 미사용)도 코드로 확인했다. 인덱스·SQL 인젝션·마이그레이션·스키마·커넥션 관리 어느 관점에서도 새로 도입된 위험은 없다. 유일하게 남아 있는 구조적 관찰은 `DELETE` 이후 `countCredentials`+`usersService.update` 가 여전히 비트랜잭션 별도 쿼리라는 점인데, 이는 이번 PR 이 새로 만든 문제가 아니고 이미 트래커(`plan/in-progress/spec-draft-nullable-notation-followups.md`)에 등재된 사전 존재 이슈이며 이번 PR 범위 밖으로 판단된다.

## 위험도

LOW
