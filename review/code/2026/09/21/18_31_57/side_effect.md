# 부작용(Side Effect) 리뷰 — WebAuthn credential 동시 삭제 (아홉 번째/마지막 자리) + RESOLUTION 후속 커밋

## 검증 방법

`codebase/backend/src/modules/auth/webauthn/webauthn.service.ts`(현재 파일 전체, 480~580행)와
`webauthn.controller.ts`(300~351행), `entities/webauthn-credential.entity.ts` 를 직접 `Read`/`Grep` 으로
열어 diff 게이트 번호와 실제 소스 줄을 대조했다. `credentialRepo.` 호출부 전체를 grep 해 `.delete()` 가
이 파일에서 유일한 호출 지점임을 확인했다. 저장소 파일은 읽기만 했고 뮤테이션은 가하지 않았다
(`git status --short` 결과 이 세션이 시작한 리뷰 산출물 디렉터리 외 변경 없음).

이번 diff 는 최초 결함 수정 커밋(`49ebd6632`)에 더해, 직전 라운드 리뷰(`review/code/2026/09/21/18_03_54`)의
WARNING 4건에 대한 조치 커밋(`a20455447`·`d3127c8a6`·`69bd6ea84`)과 그 RESOLUTION 기록(`c5da24ac6`)까지
포함한 누적분이다. 아래는 그 전체에 대한 부작용 관점 재검토다.

## 발견사항

- **[INFO]** `deleteCredential` 의 관측 가능한 동작 변경 — 동시 요청 중 진 쪽이 이제 `NotFoundException`(404)을 던지고, 그 결과 컨트롤러의 감사 로그 기록과 서비스의 `countCredentials`/복구 코드 NULL 화가 스킵된다
  - 위치: `codebase/backend/src/modules/auth/webauthn/webauthn.service.ts:561-574` (`deleteCredential`), 호출자 `codebase/backend/src/modules/auth/webauthn/webauthn.controller.ts:331-350` (`webauthnDelete`)
  - 상세: 종전엔 `credentialRepo.delete({ id: credentialUuid })` 의 반환값을 버렸기 때문에 동시 DELETE 두 건이 둘 다 성공(204)으로 끝나 컨트롤러가 `AUDIT_ACTIONS.USER_2FA_DISABLED` 감사를 두 번 기록했다. 이번 변경은 `affected === 0` 이면 즉시 던지도록 해, 그 지점 이후의 `countCredentials()` 호출과 `usersService.update(userId, { webauthnRecoveryCodes: null })` 쓰기, 그리고 컨트롤러의 `auditLogsService.record(...)` 호출까지 모두 진 쪽에서는 실행되지 않는다. 컨트롤러 코드를 직접 읽어 `deleteCredential` 이 reject 되면 그 다음 줄인 `auditLogsService.record` 에 도달하지 않음을 확인했고, 기존 컨트롤러 테스트(`does not record an audit log when deleteCredential throws`)가 이 계약을 이미 고정하고 있다. 이는 이 PR 의 의도된 수정 자체이고 새로 발견된 결함은 아니다.
  - 제안: 없음 — 의도된 수정, 조치 불요.

- **[INFO]** `throwCredentialNotFound()` 신규 private 헬퍼 추출은 순수 리팩터 — 시그니처·예외 형태 불변
  - 위치: `codebase/backend/src/modules/auth/webauthn/webauthn.service.ts:517-522` (신규), 호출부 `:497`·`:500`(`renameCredential`)·`:542`·`:566`(`deleteCredential`)
  - 상세: 네 곳의 인라인 `throw new NotFoundException({ code: 'WEBAUTHN_CREDENTIAL_NOT_FOUND', message: '인증기를 찾을 수 없어요.' })` 를 `private throwCredentialNotFound(): never` 호출로 치환했다. private 메서드라 외부 호출자에 영향이 없고, 예외 객체의 구조(`code`/`message`)는 동일해 `webauthn.service.spec.ts:537` 의 `toMatchObject({ response: { code: 'WEBAUTHN_CREDENTIAL_NOT_FOUND' } })` 처럼 구조적으로 비교하는 테스트도 그대로 통과한다. `renameCredential`·`verifyAuthentication`(401, 별도 예외 타입) 양쪽 다 대상에서 정확히 분리돼 있어 401 자리를 실수로 헬퍼에 편입시키지 않았다.
  - 제안: 없음.

- **[INFO]** DELETE 조건절에 `userId` 추가 — 엔티티 컬럼 매핑 확인, 부작용 없는 방어 강화
  - 위치: `codebase/backend/src/modules/auth/webauthn/webauthn.service.ts:561-564`
  - 상세: `entities/webauthn-credential.entity.ts:20-22` 에서 `userId` 가 `@Column({ name: 'user_id' })` 로 정확히 매핑됨을 확인했다. 종전 `delete({ id: credentialUuid })` 는 소유권 검증을 그 앞의 무락 `findOne` + JS 비교(`:541`)에만 의존했는데, 이번 변경은 그 조건을 SQL WHERE 절에도 추가한다. 정상 흐름에서는 이미 JS 비교를 통과한 뒤라 관측 가능한 차이를 만들지 않고, 실패 시엔 오히려 오삭제 여지를 줄이는 방향이라 부작용이라 부를 변화가 아니다.
  - 제안: 없음.

- **[INFO]** e2e 테스트(`webauthn-credential-delete-concurrency.e2e-spec.ts`)의 공허성 가드 실패 경로는 실제 DB 부작용(credential 삭제 + 감사 로그 기록)을 남길 수 있음 — 신규 결함 아님, 형제 계열과 동일 패턴
  - 위치: `codebase/backend/test/webauthn-credential-delete-concurrency.e2e-spec.ts:76-105` (`try`/`finally` 블록)
  - 상세: `expect(raced).toBe('pending')` 이 실패(테스트가 겹침을 못 만든 경우)하면 예외가 던져지고 `finally` 로 진입해 `locker.query('ROLLBACK')` 으로 `SELECT ... FOR UPDATE` 락을 풀어버린다. 이미 발사돼 대기 중이던 두 실제 HTTP DELETE 요청(`pending`)은 그 뒤 정상적으로 완주해 실제 credential 삭제와 감사 로그 기록이라는 실 DB 부작용을 남긴다 — 테스트 자체는 실패로 끝나지만 그 실패가 만든 부작용은 정리되지 않는다. 다만 이는 이번 PR 만의 문제가 아니라 형제 8개 e2e 파일 전부가 공유하는 동일한 `BEGIN → 락 → 발사 → 공허성 가드 → COMMIT → finally ROLLBACK` 오케스트레이션의 구조적 특성이며, 이미 같은 라운드의 concurrency 리뷰(`review/code/2026/09/21/18_03_54/concurrency.md`)가 INFO 로 동일하게 지적하고 "테스트 위생 수준" 으로 비차단 판정해 두었다. 정상 경로(공허성 가드 통과)에서는 `COMMIT` 이후 `finally` 의 `ROLLBACK` 이 트랜잭션 없음 경고만 내고 에러 없이 넘어가는 점도 확인했다(database.md 의 기존 지적과 일치).
  - 제안: 조치 불요(비차단, 이미 트래킹됨) — 이 계열 전체가 등재된 "동시성 e2e 공용 헬퍼 추출" 전용 PR 에서 실패 시 강제 정리(예: `raced !== 'pending'` 이면 남는 credential 을 즉시 재삭제)를 헬퍼 설계에 포함하는 것을 고려.

- **[INFO]** 두 신규 e2e `it` 모두 삽입한 사용자·credential·audit_log 행을 명시적으로 정리(cleanup)하지 않음
  - 위치: `codebase/backend/test/webauthn-credential-delete-concurrency.e2e-spec.ts` 전체 (`beforeAll`/`afterAll` 은 DB 커넥션만 해제, 삽입 행은 그대로 둠)
  - 상세: 형제 8개 concurrency e2e 파일 전부가 공유하는 기존 관례(테스트 인프라 레벨에서 별도 처리)이며 이번 diff 가 새로 만든 갭이 아니다. 다른 reviewer(testing.md)도 동일하게 확인했다.
  - 제안: 없음 — 재지적 불필요.

- **[INFO]** RESOLUTION 커밋들(`a20455447`·`d3127c8a6`·`69bd6ea84`·`c5da24ac6`)은 `CHANGELOG.md`·JSDoc·헬퍼 추출·신규 e2e 테스트 케이스만 추가하며 프로덕션 로직의 제어 흐름을 바꾸지 않는다
  - 위치: `CHANGELOG.md`(문서만), `webauthn.service.ts:506-522`(헬퍼 추출, 위 항목과 동일), `webauthn.service.ts:530-531`(JSDoc `@throws` 한 줄 추가, 실행 코드 아님), `test/webauthn-credential-delete-concurrency.e2e-spec.ts:120-188`(신규 `it` 블록, 기존 `it` 무변경)
  - 상세: `git show --stat` 기준으로 대조했을 때 이 네 커밋이 건드리는 것은 문서·주석·테스트 신설뿐이고, 첫 커밋(`49ebd6632`)이 도입한 `deleteCredential` 의 판정 로직 자체는 그대로다. 전역 상태·환경 변수·네트워크 호출·이벤트 발행 방식에 대한 추가 변경은 없다.
  - 제안: 없음.

- **[없음]** 전역 변수·환경 변수·네트워크 호출 — 신규/변경 없음
  - 상세: `process.env.E2E_BASE_URL` 은 신규 e2e 파일에서 읽지만 형제 8개 파일 전부가 동일하게 읽는 기존 관용구다(신규 읽기 패턴 아님). 서비스 코드에는 환경 변수 접근이 없다. 외부 서비스 호출도 없음 — 전부 자체 백엔드 HTTP 요청(e2e) 또는 DB 쿼리(TypeORM/`pg`)다.

## 요약

이번 diff(최초 결함 수정 + 4건의 RESOLUTION 후속 커밋)는 `WebAuthnService.deleteCredential()` 이
`credentialRepo.delete()` 의 반환값(`affected`)을 판정에 쓰고 DELETE 조건절에 `userId` 를 추가하도록
좁게 수정한 것이 핵심이며, 후속 커밋들은 CHANGELOG·JSDoc·404 헬퍼 추출·반증용 e2e 케이스 추가로
프로덕션 제어 흐름을 바꾸지 않는다. 전역 상태·환경 변수·공개 시그니처·네트워크 호출 관점에서
의도치 않은 부작용은 발견되지 않았다. 유일한 관측 가능 변화(동시 삭제 시 진 쪽이 404 를 받고
그로 인해 감사 기록·복구 코드 NULL 화가 스킵되는 것)는 이 PR 의 의도된 목적이며 기존 컨트롤러
테스트로 뒷받침됨을 코드 직접 대조로 재확인했다. 신규 e2e 의 공허성 가드 실패 경로가 실 DB
부작용(credential 삭제·감사 기록)을 정리 없이 남길 수 있다는 점은 실재하는 관찰이지만, 이는
형제 8개 e2e 파일 전부가 공유하는 구조적 특성이고 이미 같은 라운드의 concurrency 리뷰가 INFO 로
지적·비차단 판정해 둔 사항이라 재차 격상하지 않는다.

## 위험도

NONE
