# 데이터베이스(Database) 리뷰 — WebAuthn credential 동시 삭제 감사 중복 수정 (아홉 번째/마지막 자리)

## 발견사항

- **[INFO]** DELETE 문 자체는 단일 원자적 DML + 기존 인덱스로 충분 — 추가 인덱스 불필요
  - 위치: `codebase/backend/src/modules/auth/webauthn/webauthn.service.ts:561-567` (`deleteCredential`)
  - 상세: `credentialRepo.delete({ id: credentialUuid, userId })` 는 `DELETE FROM webauthn_credential WHERE id = $1 AND user_id = $2` 한 문장으로 컴파일된다. `id` 는 PK(`PrimaryGeneratedColumn('uuid')`)라 PK 인덱스로 대상 행을 즉시 찾고, `user_id` 조건은 그 행을 이미 찾은 뒤 값 비교만 하므로 별도 인덱스가 필요하지 않다(`webauthn-credential.entity.ts:20` 의 `idx_webauthn_credential_user` 는 `listCredentials`/`countCredentials`/`generateAuthenticationOptionsForUser` 등 `WHERE user_id = ?` 전용 조회에 쓰이는 기존 인덱스로, 이번 변경과 무관하게 이미 존재). 단일 DML 문의 row-level 잠금만으로 동시 DELETE 두 건 중 하나만 성공하도록 보장하는 설계는 별도 `SELECT ... FOR UPDATE`/트랜잭션 없이도 이 레이스(같은 credential 이중 삭제)에는 충분하다.
  - 제안: 없음.

- **[INFO]** `affected` 명시 비교(`=== 0`)는 node-postgres/TypeORM 드라이버 특성에 정확히 부합
  - 위치: `codebase/backend/src/modules/auth/webauthn/webauthn.service.ts:565-567`
  - 상세: `DeleteResult.affected` 는 드라이버가 rowCount 를 보고하지 않으면 `undefined` 일 수 있다. `!affected` 로 판정했다면 정상 삭제(예: 드라이버가 미보고)까지 404 로 뒤집는 회귀가 생긴다 — `affected === 0` 명시 비교로 그 경로를 분리한 것은 DB 드라이버 반환값 처리 관점에서 올바르다. `webauthn.service.spec.ts:550-561` 의 `undefined`/`null` 대조군 테스트가 이 구분을 회귀 잠금한다.
  - 제안: 없음.

- **[INFO]** SQL 인젝션 위험 없음 — 전 구간 파라미터화
  - 위치: `codebase/backend/src/modules/auth/webauthn/webauthn.service.ts` (`deleteCredential`), `codebase/backend/test/webauthn-credential-delete-concurrency.e2e-spec.ts` 전체
  - 상세: 서비스 코드는 TypeORM repository API(`delete({...})`, `count({...})`)만 사용해 리터럴 SQL 조립이 없다. e2e 테스트의 raw SQL(`db.query(...)`, `locker.query(...)`)도 전부 `$1`/`$2`/`ANY($1::uuid[])` 파라미터 바인딩이며 문자열 결합으로 값이 들어가는 곳이 없다.
  - 제안: 없음.

- **[INFO]** 커넥션 관리는 프레임워크 위임 — 수동 획득/해제 없음
  - 위치: `codebase/backend/src/modules/auth/webauthn/webauthn.service.ts:533-575`
  - 상세: `deleteCredential` 은 NestJS `@InjectRepository` 로 주입된 `Repository<WebAuthnCredential>` 만 사용하고 `dataSource.transaction()`/수동 커넥션 체크아웃을 열지 않는다(이 서비스의 `verifyAuthentication` 처럼 트랜잭션이 필요한 경로는 이미 `dataSource.transaction()` 을 쓰고 있어 패턴 자체는 파일 내 존재). 커넥션 풀 반환은 TypeORM/드라이버가 처리하므로 이번 변경으로 인한 누수 위험은 없다.
  - 제안: 없음.

- **[INFO]** (범위 밖, 기존 갭 — 이번 diff 도입 아님) `delete → countCredentials → recovery-code NULL 화` 세 문장은 여전히 비트랜잭션
  - 위치: `codebase/backend/src/modules/auth/webauthn/webauthn.service.ts:561-573` (`deleteCredential`, 특히 변경되지 않은 569-572행)
  - 상세: 이번 fix 는 "같은 credential 을 겨냥한 동시 DELETE"(`affected` 경쟁)만 DB 레벨 원자성으로 닫는다. 그 뒤의 `countCredentials` 조회와 `usersService.update(... webauthnRecoveryCodes: null)` 는 별도 statement 로, 세 문장 전체를 감싸는 트랜잭션이나 행 락은 없다. 서로 **다른** credential 을 동시에 지우는 경로에 대해서는 이번 세션이 순서 논증(각 요청의 DELETE 가 즉시 커밋되고 그 뒤에야 자신의 `count` 가 돎 → 나중에 커밋하는 쪽은 항상 0 을 봄)과 e2e 캐너리(`webauthn-credential-delete-concurrency.e2e-spec.ts` 두 번째 `it`)로 "둘 다 오판" 시나리오가 발생할 수 없음을 실측 반증했다(`review/code/2026/09/21/18_03_54/RESOLUTION.md` WARNING #4). 다만 이 반증은 **레이스가 없음**을 보인 것이지 **원자성**을 준 것은 아니다 — delete 성공 후 프로세스가 크래시하거나 뒤이은 `usersService.update` 가 실패하면 credential 은 0개인데 `webauthn_recovery_codes` 는 NULL 화되지 않은 채 남는 부분 실패(durability) 창은 여전히 열려 있다. 이는 이번 PR 이 도입한 결함이 아니라 기존부터 있던 인접 갭이며, `concurrency.md`(18_03_54) WARNING 으로 이미 별도 추적 중이다 — 재지적 목적이 아니라 DB 관점에서 "완전히 닫혔다"고 오독되지 않도록 명시.
  - 제안: 크래시/부분 실패 창까지 닫으려면 `verifyAuthentication()` 이 쓰는 `dataSource.transaction()` + `pessimistic_write` 패턴을 `deleteCredential` 전체(delete→count→NULL화)에 적용하는 후속 작업을 고려. 이미 트래커에 등재된 항목이면 중복 생성 불필요.

- **[정보 없음]** 마이그레이션·스키마 변경, N+1, 대량 데이터/페이지네이션: 해당 diff 범위에 없음
  - 상세: 이번 변경 세트에 `*.migration.ts`/DDL 파일이 없고 `webauthn_credential` 테이블 구조·인덱스·제약조건도 그대로다. 반복문 내 개별 쿼리(N+1) 패턴도 없다(단건 credential 대상 단일 DELETE). `listCredentials`/`countCredentials` 등 목록성 쿼리는 이번 diff 로 바뀌지 않았고, 사용자당 credential 개수가 소량(수 개 수준)이라 대량 데이터 페이지네이션 이슈도 해당 없음.

- CHANGELOG.md·plan 문서·`review/code/2026/09/21/{18_03_54,18_31_57,18_58_48}/**`·`review/consistency/**` 등 나머지 파일들은 이전 리뷰 라운드 산출물/문서로, DB 관련 실행 코드 변경을 포함하지 않는다.

## 요약

이번 변경의 핵심은 `WebAuthnService.deleteCredential()` 에서 그동안 버려지던 `credentialRepo.delete()` 의 `affected` 반환값을 판정에 쓰고 DELETE 조건절에 `userId` 를 추가한 것으로, 이미 원자적인 단일 DML 문의 DB 레벨 보장에 정확히 올라탄 수정이다. PK 인덱스로 충분해 추가 인덱스가 필요 없고, `affected === 0` 명시 비교는 드라이버의 `undefined`/`null` 미보고 케이스를 오판하지 않도록 정확히 처리됐으며, SQL 인젝션·커넥션 관리·N+1·마이그레이션·대량 데이터 관점 모두 문제가 없다. 유일하게 짚을 지점은 `deleteCredential` 후반부(`countCredentials` + 복구 코드 NULL 화)가 여전히 별도 statement 로 남아 있어 완전한 원자성(특히 부분 실패/크래시 창)까지는 보장하지 않는다는 것인데, 이는 이번 diff 가 도입한 것이 아니라 기존부터 있던 갭이고 다른 리뷰 라운드에서 이미 측정·추적 중이므로 이번 PR 을 막을 사유는 아니다.

## 위험도

LOW
