# 부작용(Side Effect) 리뷰 — WebAuthn credential 동시 삭제 (아홉 번째/마지막 자리) + 열 번째 리뷰 후속 조치

## 대상 요약

`WebAuthnService.deleteCredential()` 이 이미 원자적인 `credentialRepo.delete()` 를 쓰고 있었지만 그
반환값(`affected`)을 버려서, 동시 DELETE 두 건이 둘 다 성공 처리되어 컨트롤러
(`WebAuthnController.webauthnDelete`)가 `user.2fa_disabled` 감사 콜백(`auditLogsService.record`)을
두 번 호출하던 결함을 고친다. 나머지 파일(unit spec, 신규 e2e, CHANGELOG, plan 문서, 이전 리뷰 라운드
(`18_03_54`)의 RESOLUTION/SUMMARY/각 관점 리포트 산출물)은 문서·테스트로, 런타임 부작용 표면이 아니다.

## 발견사항

- **[INFO]** 의도된 콜백 억제 — 진 쪽 요청은 감사 로그 기록 콜백에 도달하지 않는다
  - 위치: `codebase/backend/src/modules/auth/webauthn/webauthn.service.ts:565-567`(`if (affected === 0) { this.throwCredentialNotFound(); }`) 및 호출자
    `codebase/backend/src/modules/auth/webauthn/webauthn.controller.ts` `webauthnDelete`(`await this.webauthnService.deleteCredential(...)` 뒤에 `auditLogsService.record` 호출).
  - 상세: `deleteCredential()` 이 던지면 `await` 체인이 그 지점에서 예외를 전파하므로 컨트롤러의
    `auditLogsService.record(...)` 호출부에 도달하지 않는다. 이는 이 diff 가 의도한 유일한 관측 가능
    부작용 변경이며, 기존 회귀 테스트 `webauthn.controller.spec.ts` `'does not record an audit log when
    deleteCredential throws'`(`auditLogsService.record` 가 호출되지 않았음을 단언)로 이미 보증되어
    있음을 직접 확인했다. `WebAuthnCredential` 엔티티에 `@AfterRemove`/`@AfterDelete`/`EventSubscriber`
    류의 ORM 훅이 없어(grep 확인, 결과 없음), `delete()` 조건절에 `userId` 를 추가한 것이 다른 숨은
    이벤트 발생 경로를 바꾸지도 않는다.
  - 제안: 없음 — 콜백 억제가 정확히 결함을 닫는 지점이며 테스트로 이미 검증됨.

- **[INFO]** 공개 HTTP 인터페이스의 관측 가능한 행동 변화 — 동시 삭제 패자가 204 대신 404 를 받음
  - 위치: `codebase/backend/src/modules/auth/webauthn/webauthn.controller.ts` `webauthnDelete`
    (`@Delete('credentials/:id')`, 시그니처·라우트·DTO 자체는 무변경) / 근본 원인은
    `codebase/backend/src/modules/auth/webauthn/webauthn.service.ts:561-567`.
  - 상세: 라우트·메서드 시그니처·정상 응답 형태(`204 No Content`)·`deleteCredential()` 의 반환 계약
    (`{ remaining: number }`)은 변경되지 않았다. 유일한 외부 관측 변화는 **동시 DELETE 레이스**에서
    패자가 종전 204 대신 404(`WEBAUTHN_CREDENTIAL_NOT_FOUND`)를 받는 것이다. 이는 저장소 내 이미
    확립된 형제 8건(#1369~#1375)과 동일한 패턴이고, 단일 클라이언트(비-레이스) 흐름에는 영향이 없다.
    새 전역 상태·새 엔드포인트·새 환경변수·새 네트워크 호출은 도입되지 않았다.
  - 제안: 없음 — 이미 `api_contract.md`(이전 라운드 산출물) 가 이 지점을 INFO 로 분류했고 동일한 결론.

- **[INFO]** 새 private 메서드 `throwCredentialNotFound()` 추출 — 외부 시그니처 영향 없음
  - 위치: `codebase/backend/src/modules/auth/webauthn/webauthn.service.ts:517-522`.
  - 상세: `private` 이므로 클래스 밖 호출자에는 보이지 않는다. `renameCredential`·`deleteCredential`
    네 곳의 동일 `NotFoundException` 리터럴을 대체했을 뿐 던지는 예외의 `code`/`message`/타입은
    이전과 동일 — 호출자(컨트롤러, 테스트)가 관측하는 에러 계약에 변화 없음.
  - 제안: 없음.

- **[INFO]** 이번 라운드(열 번째)에서 편집된 파일들도 side-effect 표면이 없음
  - 위치: `CHANGELOG.md`(문서 추가/취소선 정정), `webauthn.service.spec.ts`(신규 `describe('동시 삭제')`
    unit 케이스 3건, 모두 mock 기반), `plan/in-progress/*.md`, `review/code/2026/09/21/18_03_54/*`
    (이전 라운드 리뷰 산출물 — 프로젝트 컨벤션상 `review/code/**` 에 저장되는 의도된 산출물이며 예상치
    못한 파일시스템 부작용이 아님).
  - 상세: e2e 스펙(`webauthn-credential-delete-concurrency.e2e-spec.ts`)의 `process.env.E2E_BASE_URL`
    읽기는 형제 e2e 파일들과 동일한 기존 패턴(읽기 전용, 기본값 fallback)이며 이번 diff 가 새로
    도입한 것이 아니다. 이 파일이 발생시키는 실제 HTTP 요청·DB 커넥션은 e2e 테스트 하네스가 의도한
    네트워크 호출이지 프로덕션 코드의 의도치 않은 외부 호출이 아니다.
  - 제안: 없음.

## 요약

이번 diff 의 핵심(그리고 유일한) 의도된 부작용 변화는 `WebAuthnService.deleteCredential()` 이 동시
삭제 레이스의 패자를 조기에 `throwCredentialNotFound()` 로 되돌려, 컨트롤러의 `user.2fa_disabled` 감사
로그 기록 콜백과 `countCredentials`/`usersService.update` 호출까지 함께 건너뛰게 만드는 것이다 — 기존
테스트(`webauthn.controller.spec.ts`)로 이미 검증된 경로이고, ORM 이벤트 훅도 없어 숨은 부수 효과
경로가 없음을 직접 확인했다. 라우트·시그니처·정상 응답 계약은 보존되며, 유일한 외부 관측 변화(레이스
패자의 204→404)는 저장소 내 형제 8건과 동일한 이미 확립된 패턴이다. 전역 변수 도입/수정, 예상치 못한
파일시스템 쓰기, 환경변수 오·남용, 의도치 않은 네트워크 호출은 발견되지 않았다.

## 위험도

NONE
