# Testing Review — audit-user-actions

## 발견사항

### [INFO] `AuditLogsService.record` swallow 계약 — 테스트에서 미검증
- 위치: `/codebase/backend/src/modules/audit-logs/audit-logs.service.ts` L72-97
- 상세: `record` 는 내부 try/catch 로 DB 실패를 swallow 한다는 계약이 JSDoc에 명시되어 있으며 구현도 확인됨. 그러나 각 controller spec(auth, webauthn, users)에서 `auditLogsService.record` 는 `jest.fn()` 단순 mock 이라 실제 swallow 동작은 단위 테스트 레이어에서 전혀 커버되지 않는다. 컨트롤러가 `await this.auditLogsService.record(...)` 를 호출한 후 예외가 전파되지 않음을 보장하는 테스트 케이스(즉 record 가 reject 해도 controller 메서드가 정상 반환하는지)가 없다.
- 제안: 각 controller spec 에 `auditLogsService.record.mockRejectedValue(new Error('db error'))` 케이스를 추가해 record 실패 시 주 흐름(changePassword, verify2fa, disable2fa, webauthnRegisterVerify, webauthnDelete)이 정상 응답을 반환함을 검증한다. 단 record 의 swallow 는 서비스 레이어에서 처리되므로 AuditLogsService 자체 단위 테스트로 분리해도 된다 — 현재 AuditLogsService.spec.ts 에 이 케이스가 있는지도 확인 권장.

### [INFO] `auth.controller.spec.ts` — `it` 블록 내 `bcrypt.hash` 직접 호출 (rounds=4)
- 위치: `/codebase/backend/src/modules/auth/auth.controller.spec.ts` L250, L268 (disable2fa 관련 두 테스트)
- 상세: `bcrypt.hash('OldP@ssw0rd1', 4)` 를 각 `it` 블록 내에서 직접 호출한다. rounds=4 라 실용적으로 느리지 않으나 동일 해시 연산이 두 개 `it` 에서 중복 수행된다. `users.controller.spec.ts` 도 `changePassword` describe 내 여러 `it` 에서 동일 패턴이 반복된다.
- 제안: `beforeAll` 또는 describe 스코프 상단 변수로 해시를 한 번만 계산한다. 필수 수정은 아니나 테스트 실행 시간 단축에 기여한다.

### [INFO] `webauthn.controller.spec.ts` — 테스트 scope 가 audit 전용으로 한정, 기존 WebAuthn 동작 테스트 부재
- 위치: `/codebase/backend/src/modules/auth/webauthn/webauthn.controller.spec.ts` (신규 파일)
- 상세: 파일명이 `webauthn.controller.spec.ts` 이고 `describe('WebAuthnController (audit)')` 로 한정되어 있다. webauthn 등록 옵션 생성(`webauthnRegisterStart`), 로그인(`webauthnAuthenticateStart`/`Verify`), 복구 코드 재발급 등 기존 WebAuthn 엔드포인트 동작 테스트가 이 파일에 없다. audit 추가로 인한 회귀 여부도 이 파일만으로는 확인 불가.
- 제안: 기존 WebAuthn 엔드포인트가 다른 spec 파일에서 커버되는지 확인한다. 커버하는 파일이 없다면 `webauthn.controller.spec.ts` 를 audit 전용으로 유지하되 파일명 또는 describe 명에 명확히 표기하고, 별도 spec 파일로 기존 엔드포인트 커버리지를 추가한다.

### [INFO] `users.controller.spec.ts` — "password change fails" 와 "should reject when current password does not match" 테스트 중복 셋업
- 위치: `/codebase/backend/src/modules/users/users.controller.spec.ts` L224-254
- 상세: 새로 추가된 "should not record an audit log when password change fails" 테스트(L224)와 기존 "should reject when current password does not match" 테스트(L240)는 동일한 fixture(`bcrypt.hash('OldP@ssw0rd1', 4)`, `WrongPass1!` 입력)를 중복 셋업하며 검증 목적만 다르다. 테스트 격리는 유지되나 가독성이 떨어진다.
- 제안: 두 테스트를 하나로 합치거나 `beforeEach`/`beforeAll` 에서 fixture 를 공유한다.

### [INFO] e2e 레이어 — 실제 DB INSERT 검증 부재 (기존 deferred 확인)
- 위치: `review/code/2026/06/13/09_28_06/RESOLUTION.md` INFO 17
- 상세: RESOLUTION.md 에 "e2e WebAuthn 감사 로그 실제 DB INSERT 검증 부재" 가 deferred 로 기록되어 있으며 본 PR 범위 밖으로 처리되었다. unit/spec 테스트가 mock 기반이라 DB 실제 기록, `workspaceId` 컬럼 non-nullable 제약 충족, action 값 DB 저장 포맷 등은 e2e 또는 integration 테스트 없이는 검증되지 않는다.
- 제안: 향후 integration 테스트에서 `auditLogRepository.findOne({ action: 'user.password_changed' })` 로 실제 INSERT 를 검증하는 케이스를 추가한다. 현 deferred 처리는 범위상 적절하나 별도 티켓에 명시적으로 등록 권장.

### [INFO] `webauthn.controller.spec.ts` — `webauthnRegisterVerify` 의 `dto.deviceName` 전달 여부 검증 없음
- 위치: `/codebase/backend/src/modules/auth/webauthn/webauthn.controller.spec.ts` L518-542 (첫 번째 등록 테스트)
- 상세: 첫 번째 등록 테스트는 `deviceName: 'Yubikey'` 를 dto 에 포함하지만 `webauthnService.verifyRegistration` 호출 인자에 `deviceName` 이 전달되는지 `expect(...).toHaveBeenCalledWith(...)` 로 검증하지 않는다. 두 번째 테스트(L545)는 `deviceName` 없이 호출한다. verifyRegistration 의 세 번째 인자(`dto.deviceName`)가 실제로 넘어가는지는 audit 기록 어설션만으로는 커버되지 않는다.
- 제안: `expect(webauthnService.verifyRegistration).toHaveBeenCalledWith(payload.sub, expect.anything(), 'Yubikey')` 같이 인자 검증을 추가해 deviceName 전달을 명시적으로 보장한다.

## 요약

테스트 구성은 전반적으로 양호하다. 변경된 세 controller(UsersController, AuthController, WebAuthnController) 모두 성공 경로와 주요 실패 경로(잘못된 비밀번호, 잘못된 TOTP 코드, 서비스 throw)에 대한 audit 미기록 검증 케이스가 추가되어 있으며, RESOLUTION.md 에 따라 이전 ai-review Warning 2건(WebAuthn 실패 경로, verify2fa 실패 경로)이 이번 PR 에서 fix 처리되었다. `webauthn.service.spec.ts` 의 `deleteCredential` 반환값 검증도 서비스 계약 변경에 맞게 업데이트되었다. 남은 갭은 (1) audit 기록 실패 시 주 흐름이 깨지지 않음을 보장하는 swallow-resilience 테스트 미존재, (2) e2e/integration 레이어에서 실제 DB INSERT 미검증(기존 deferred), (3) WebAuthn 컨트롤러의 기존 엔드포인트 동작 커버리지 부재, (4) 테스트 내 bcrypt.hash 중복 호출이며 모두 INFO 수준이다.

## 위험도

LOW

STATUS: SUCCESS
