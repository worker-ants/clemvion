# 부작용(Side Effect) 리뷰 — webauthn credential 동시 삭제 중복 감사 수정

## 발견사항

- **[INFO]** `deleteCredential` 의 관측 가능한 동작 변경 — 동시 요청 중 진 쪽이 이제 `NotFoundException` 을 던진다
  - 위치: `codebase/backend/src/modules/auth/webauthn/webauthn.service.ts:549`~`558` (`deleteCredential`)
  - 상세: 종전엔 `credentialRepo.delete({ id: credentialUuid })` 의 반환값(`affected`)을 버렸기 때문에, 동시 DELETE 두 건이 겹치면 **둘 다** 204 로 응답하고 컨트롤러(`webauthn.controller.ts:338`)가 `user.2fa_disabled` 감사를 두 번 기록했다. 이번 변경은 `delete({ id, userId })` 의 `affected` 를 판정에 써서 `affected === 0` 이면 던지도록 했다. 결과적으로 지는 쪽 클라이언트는 이제 (종전의 "조용한 204" 대신) 404 `WEBAUTHN_CREDENTIAL_NOT_FOUND` 를 받는다. 이는 이 PR 의 의도된 수정 그 자체이며, 컨트롤러 코드 확인 결과 감사 기록(`auditLogsService.record`)은 `deleteCredential` 이 성공적으로 resolve 된 **이후에만** 실행되므로(`webauthn.controller.ts:331`~`350`), 서비스가 던지면 감사에 도달하지 않는 것이 맞다 — 이미 `webauthn.controller.spec.ts:258` ("does not record an audit log when deleteCredential throws") 로 커버돼 있음을 직접 확인했다. 별도 조치 불요, 참고용 기록.
  - 제안: 없음 — 의도된 수정이며 기존 테스트로 커버됨을 확인.

- **[INFO]** DELETE 조건절에 `userId` 추가는 방어 심화이며 기존 JS 레벨 소유권 검사와 중복
  - 위치: `codebase/backend/src/modules/auth/webauthn/webauthn.service.ts:523`~`526`, `549`~`552`
  - 상세: `findOne({ where: { id: credentialUuid } })` 뒤 `credential.userId !== userId` JS 비교로 이미 소유권을 걸러내고 있어, 뒤이은 `delete({ id, userId })` 의 `userId` 조건은 정상 흐름에서는 도달 불가능한 강화(형제 PR 들의 워크스페이스 스코프 패턴과 동일한 defense-in-depth)다. 새로운 부작용은 없음 — 조건이 좁아져 오히려 오삭제 가능성을 줄이는 방향.
  - 제안: 없음.

- **[INFO]** 신규 e2e 파일이 별도 DB 커넥션 2개(`db`, `locker`) 및 실제 HTTP 요청을 생성
  - 위치: `codebase/backend/test/webauthn-credential-delete-concurrency.e2e-spec.ts` (`beforeAll`/`afterAll`, `fireDelete`)
  - 상세: `locker.query('BEGIN')` → `SELECT ... FOR UPDATE` → `Promise.all([fireDelete(), fireDelete()])` → `COMMIT` 구조로, 단언 실패 시에도 `finally` 블록에서 `ROLLBACK`(실패 시 catch로 무시) 및 `pending` catch 로 커넥션 누수를 방지한다. 락 대기 관측용 `setTimeout(…, 1_500)` 핸들은 clear/unref 되지 않지만, 이는 형제 PR 8건(`auth-config-delete-concurrency.e2e-spec.ts`, `model-config-delete-concurrency.e2e-spec.ts` 등)에서 이미 쓰인 동일 패턴이라 이번 PR 이 새로 도입한 부작용이 아니다. 테스트가 삽입한 `webauthn_credential`/`audit_log` 로우에 대한 명시적 정리(cleanup)도 없으나, 이 역시 형제 concurrency e2e 전부가 공유하는 기존 관례(테스트 인프라가 별도 처리)로 확인됨.
  - 제안: 없음 — 기존 관례와 일치, 이번 PR 이 유발한 회귀 아님.

- **[INFO]** `deleteCredential` 시그니처(파라미터·반환 타입) 자체는 변경 없음, 유일한 다른 호출자(`webauthn.controller.ts:331`)만 확인됨
  - 위치: `codebase/backend/src/modules/auth/webauthn/webauthn.controller.ts:331`
  - 상세: `grep` 으로 서비스 전역에서 `deleteCredential` 호출부를 확인한 결과 컨트롤러 1곳뿐이며, 그 호출부의 에러 처리는 이미 최초 소유권 체크에서 던지는 동일 `WEBAUTHN_CREDENTIAL_NOT_FOUND` 를 전제로 하고 있어 새 예외 경로 추가가 호출자 코드 변경을 요구하지 않는다.
  - 제안: 없음.

## 요약

이번 변경은 `WebAuthnService.deleteCredential` 이 `credentialRepo.delete()` 의 `affected` 반환값을 판정에 사용하도록 하고 DELETE 조건절에 `userId` 를 추가한 것이 핵심이며, 형제 PR 8건(#1369~#1375)과 동일한 "동시 삭제 중복 부작용 제거" 패턴이다. 전역 상태·환경 변수·파일시스템·공개 시그니처·네트워크 호출 어느 항목에서도 의도치 않은 부작용은 발견되지 않았다. 유일한 관측 가능 변화는 동시 삭제 시 지는 쪽이 (종전의 조용한 이중 성공/이중 감사 대신) 기존에 이미 쓰이던 동일 에러 코드로 404 를 받는 것인데, 이는 이 PR 의 의도된 목적이고 컨트롤러 감사 기록 로직·기존 컨트롤러 단위 테스트로 이미 뒷받침됨을 코드 직접 확인으로 검증했다. e2e 신규 테스트의 리소스 정리·타이머 패턴도 8개의 선행 형제 테스트와 동일해 신규 부작용이 아니다. 저장소 파일에 대한 뮤테이션 검증은 수행하지 않았으며(정적 리뷰만으로 충분히 판단 가능했음), `git status --short` 로 확인한 결과 리뷰 중 저장소에 어떤 파일도 쓰지 않았다.

## 위험도

NONE
