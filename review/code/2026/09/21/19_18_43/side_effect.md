# 부작용(Side Effect) 리뷰 — WebAuthn credential 동시 삭제 중복 감사 수정 (아홉 번째/마지막 자리 + 라운드 3 후속)

## 발견사항

- **[INFO]** `deleteCredential` 의 관측 가능한 동작 변경 — 동시 요청 중 진 쪽이 이제 `NotFoundException`(404)을 던진다
  - 위치: `codebase/backend/src/modules/auth/webauthn/webauthn.service.ts` `deleteCredential()` (신규 `const { affected } = await this.credentialRepo.delete({ id: credentialUuid, userId }); if (affected === 0) { this.throwCredentialNotFound(); }` 블록)
  - 상세: 종전엔 `credentialRepo.delete({ id: credentialUuid })` 의 반환값(`affected`)을 버렸기 때문에, 무락(unlocked) `findOne` 을 둘 다 통과한 동시 DELETE 두 건이 겹치면 **둘 다** 204 로 응답하고 호출자 `WebAuthnController.webauthnDelete()`(`codebase/backend/src/modules/auth/webauthn/webauthn.controller.ts:331-350`)가 `user.2fa_disabled` 감사를 두 번 기록했다. 이번 변경으로 진 쪽 클라이언트는 (조용한 이중 204 대신) 기존에 이미 존재하던 것과 동일한 에러 코드 `WEBAUTHN_CREDENTIAL_NOT_FOUND` 로 404 를 받는다. 컨트롤러 코드를 직접 확인한 결과 `auditLogsService.record(...)` 호출은 `await this.webauthnService.deleteCredential(...)` 이 성공적으로 resolve 된 **이후에만** 도달하므로, 서비스가 던지면 감사 기록도 함께 스킵되는 것이 의도대로 맞다 — `webauthn.controller.spec.ts` 의 "does not record an audit log when deleteCredential throws" 케이스로 이미 커버돼 있음을 확인했다. 이 코드는 소유권 불일치 시에도 이미 404 를 반환해 왔으므로(사전 존재 경로), 이번 변경은 기존 API 계약에 새 상태 코드를 추가하는 것이 아니라 기존 404 트리거 조건을 하나(동시 삭제 레이스) 넓히는 것이다. 이번 라운드에서 새로 도입된 것은 아니며(라운드 1 `concurrency.md`/`side_effect.md`, `database.md` 에서 이미 동일하게 확인·기록됨), 재확인 결과 동일하다.
  - 제안: 없음 — 의도된 수정이며 기존 컨트롤러 테스트·감사 기록 경로로 뒷받침됨.

- **[INFO]** DELETE 조건절에 `userId` 추가는 방어 심화이며 정상 흐름에서는 도달 불가능한 강화
  - 위치: `codebase/backend/src/modules/auth/webauthn/webauthn.service.ts` `deleteCredential()` 의 `findOne({ where: { id: credentialUuid } })` 및 뒤이은 `credentialRepo.delete({ id: credentialUuid, userId })`
  - 상세: `findOne` 뒤 `credential.userId !== userId` JS 비교로 이미 소유권을 걸러내고 있어, 뒤이은 `delete()` 의 `userId` 조건은 정상 흐름에서는 도달 불가능한 defense-in-depth(형제 PR 들의 워크스페이스 스코프 패턴과 동일)다. 새로운 부작용 없음 — 조건이 좁아져 오삭제 가능성이 줄어드는 방향.
  - 제안: 없음.

- **[INFO]** `throwCredentialNotFound()` private 헬퍼 신규 추출 — 클래스 외부에 노출되는 시그니처·인터페이스 변경 없음
  - 위치: `codebase/backend/src/modules/auth/webauthn/webauthn.service.ts` `private throwCredentialNotFound(): never { ... }` (신규 메서드), 호출부 `renameCredential()` 2곳 + `deleteCredential()` 2곳
  - 상세: `private` 메서드이므로 클래스 외부 호출자에는 영향이 없다. 던지는 예외 타입(`NotFoundException`)·코드(`WEBAUTHN_CREDENTIAL_NOT_FOUND`)·메시지 모두 리팩터 이전 인라인 리터럴과 동일해 호출자 관점의 동작 변화는 없다. `verifyAuthentication()` 의 `UnauthorizedException`(401) 자리는 의도적으로 이 헬퍼 대상에서 제외됐다(JSDoc 에 명시).
  - 제안: 없음.

- **[INFO]** `deleteCredential`/`renameCredential` 공개 시그니처(파라미터·반환 타입) 자체는 변경 없음 — 유일한 호출자 확인
  - 위치: `codebase/backend/src/modules/auth/webauthn/webauthn.controller.ts` (`webauthnDelete`, `webauthnRename`)
  - 상세: 저장소 전체에서 `deleteCredential` 호출부를 확인한 결과 컨트롤러 1곳뿐이며, 그 호출부는 이미 최초 조회·소유권 실패에서 던지는 것과 동일한 `WEBAUTHN_CREDENTIAL_NOT_FOUND` 404 를 전제로 하고 있어 새 예외 경로 추가가 호출자 코드 변경을 요구하지 않는다.
  - 제안: 없음.

- **[INFO]** e2e 두 번째 테스트에 신규 추가된 `locker` 트랜잭션 오케스트레이션(`BEGIN`→`FOR UPDATE`(A·B 두 행)→공허성 가드→`COMMIT`)은 정상 경로에서 `COMMIT` 이후 `finally` 가 다시 `ROLLBACK` 을 호출
  - 위치: `codebase/backend/test/webauthn-credential-delete-concurrency.e2e-spec.ts` 두 번째 `it`('서로 다른 credential 두 개를 동시 삭제해도...') 의 `try { ...; await locker.query('COMMIT'); ... } finally { await locker.query('ROLLBACK').catch(() => undefined); ... }` 블록
  - 상세: 정상 경로(단언 통과)에서도 `COMMIT` 실행 후 `finally` 블록이 무조건 `ROLLBACK` 을 다시 호출한다. PostgreSQL 은 트랜잭션이 이미 끝난 상태에서의 `ROLLBACK` 을 에러 없이(경고만) 처리하고, 이 호출은 `.catch(() => undefined)` 로 흡수되므로 기능적 결함이나 신규 부작용은 아니다 — 같은 파일의 첫 번째 `it` 및 형제 8개 e2e-spec 파일에서 이미 쓰인 것과 동일한 관례다(`review/code/2026/09/21/18_03_54/database.md` 에서 이미 지적·해당 없음으로 처리됨). 재확인 결과 이번 라운드(공허성 가드 추가 커밋 `89566e3d5`)가 이 패턴을 새로 도입하거나 악화시키지 않았다.
  - 제안: 없음(선택적 코드 스타일 개선 여지는 있으나 불필요).

- **[INFO]** 파일시스템 부작용 — 이번 diff 로 커밋된 `review/code/**`·`review/consistency/**` 하위 신규 파일은 harness 산출물 저장 관례에 부합, 코드 실행 경로의 부작용 아님
  - 위치: `review/code/2026/09/21/18_03_54/**`, `18_31_57/**`, `18_58_48/**`, `review/consistency/2026/09/21/17_39_06/**` (전부 신규 파일)
  - 상세: 이 파일들은 애플리케이션 코드의 런타임 부작용이 아니라, `/ai-review`·`/consistency-check` 실행 산출물을 `CLAUDE.md` 의 저장 위치 규약(`review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`, `review/consistency/...`)에 따라 커밋한 것이다. 예상치 못한 생성이 아니며 내용도 이전 라운드 리뷰 기록·RESOLUTION 문서로 일관적이다.
  - 제안: 없음.

- **[INFO]** 라운드 3(최신 커밋 `15da527e7`) 은 `webauthn.service.ts` JSDoc 주석 1줄(`verifyAuthentication`(:403) → `verifyAuthentication()`)과 `plan/in-progress/webauthn-dup-delete.md` 서술만 바꾼 순수 문서 정정 — 실행 코드·조건절·예외 타입 변경 없음
  - 위치: `codebase/backend/src/modules/auth/webauthn/webauthn.service.ts` (`throwCredentialNotFound()` JSDoc), `plan/in-progress/webauthn-dup-delete.md`
  - 상세: `git show 15da527e7` 로 직접 확인 — 코드 라인 자체는 주석 문자열 치환 1줄뿐이고, 조건문·호출부·시그니처는 무변화. 부작용 관점에서 영향 없음.
  - 제안: 없음.

## 해당 없음 항목

- **전역 변수**: 신규 전역 변수 도입·기존 전역 상태 변경 없음.
- **환경 변수**: 읽기/쓰기 없음.
- **네트워크 호출**: 외부 서비스 호출 없음(e2e 는 로컬 테스트 DB 커넥션만 사용).
- **이벤트/콜백**: 새 이벤트 발행·콜백 등록/해제 변경 없음. 감사 로그 기록 여부가 달라지는 것은 예외 전파에 따른 기존 제어 흐름의 자연스러운 결과이며 별도 이벤트 배선 변경은 아니다.

## 요약

핵심 변경은 `WebAuthnService.deleteCredential()` 이 `credentialRepo.delete()` 의 `affected` 반환값을 `=== 0` 명시 비교로 판정에 사용하고 DELETE 조건절에 `userId` 를 추가한 것으로, 형제 PR 8건(#1369~#1375)과 동일한 "동시 삭제 중복 부작용 제거" 패턴이다. 전역 상태·환경 변수·파일시스템(코드 실행 경로)·공개 시그니처·네트워크 호출 어느 항목에서도 의도치 않은 부작용은 발견되지 않았다. 유일한 관측 가능 동작 변화는 동시 삭제 레이스의 진 쪽이 (종전의 조용한 이중 성공/이중 감사 대신) 기존에 이미 쓰이던 동일 에러 코드로 404 를 받고 그에 따라 감사 로그가 스킵되는 것인데, 이는 이 PR 의 의도된 목적이며 컨트롤러 단위 테스트로 이미 검증돼 있다. `throwCredentialNotFound()` 헬퍼 추출은 `private` 이라 외부 인터페이스에 영향이 없다. 이번 3라운드 최신 커밋(`15da527e7`)은 순수 문서(JSDoc 한 줄 + plan 서술) 정정이라 부작용 표면 자체에 변화가 없다. 리뷰 중 저장소 파일에 대한 뮤테이션(수정·백업·삭제)은 수행하지 않았으며, `git status --short` 로 확인한 결과 이 세션의 산출물 디렉터리(`review/code/2026/09/21/19_18_43/`) 외에 어떤 변경도 남기지 않았다.

## 위험도

NONE
