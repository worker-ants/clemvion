# Testing Review — audit-user-actions

## 발견사항

### **[INFO]** 핵심 감사 경로 테스트 커버리지 양호

- 위치: `auth.controller.spec.ts`, `users.controller.spec.ts`, `webauthn.controller.spec.ts`
- 상세: 변경된 세 컨트롤러(`AuthController`, `UsersController`, `WebAuthnController`) 모두에 대해 audit log 기록 여부를 검증하는 유닛 테스트가 추가되었다. 성공 경로(audit 기록)와 실패 경로(audit 미기록)가 모두 다뤄졌다.
- 제안: 현 상태 유지.

---

### **[INFO]** `webauthn.service.spec.ts` — `deleteCredential` 반환값 회귀 잠금

- 위치: `webauthn.service.spec.ts` line 886~901 (diff 기준)
- 상세: 서비스 시그니처가 `Promise<void>` → `Promise<{ remaining: number }>`로 변경됐고, 기존 테스트 2건 모두 반환값 검증(`expect(result).toEqual({ remaining: ... })`)을 추가해 회귀를 잠금했다. 변경 전 테스트가 void 반환을 묵시적으로 허용하던 구조도 명확히 수정됐다.
- 제안: 현 상태 유지.

---

### **[WARNING]** `WebAuthnController` 테스트에서 `webauthnDelete` 실패 경로(서비스 throw) audit 미기록 케이스 부재

- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/audit-user-actions-5a037b/codebase/backend/src/modules/auth/webauthn/webauthn.controller.spec.ts`
- 상세: `webauthnDelete`는 `webauthnService.deleteCredential`이 예외를 던질 경우 audit log `record`가 호출되지 않아야 한다. 현재 `auth.controller.spec.ts`의 `disable2fa` 테스트와 `users.controller.spec.ts`의 `changePassword` 테스트에는 "실패 시 audit 미기록" 케이스가 존재하나, `webauthn.controller.spec.ts`에는 해당 케이스가 없다. `deleteCredential`이 `NotFoundException`을 throw하는 경우 audit이 기록되지 않음을 보장하는 테스트가 없다.
- 제안: 아래 테스트 케이스 추가:
  ```ts
  it('does not record audit when deleteCredential throws', async () => {
    webauthnService.deleteCredential.mockRejectedValue(new NotFoundException());
    await expect(controller.webauthnDelete(payload, 'cred-uuid')).rejects.toThrow();
    expect(auditLogsService.record).not.toHaveBeenCalled();
  });
  ```

---

### **[WARNING]** `webauthnRegisterVerify` 실패 경로(서비스 throw) audit 미기록 케이스 부재

- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/audit-user-actions-5a037b/codebase/backend/src/modules/auth/webauthn/webauthn.controller.spec.ts`
- 상세: `webauthnRegisterVerify`에서 `webauthnService.verifyRegistration`이 `BadRequestException`을 throw할 경우 audit log가 기록되지 않아야 한다. 이를 검증하는 테스트가 없다.
- 제안: 아래 테스트 케이스 추가:
  ```ts
  it('does not record audit when verifyRegistration fails', async () => {
    webauthnService.verifyRegistration.mockRejectedValue(new BadRequestException());
    await expect(controller.webauthnRegisterVerify(payload, { ... } as never)).rejects.toThrow();
    expect(auditLogsService.record).not.toHaveBeenCalled();
  });
  ```

---

### **[INFO]** `auth.controller.spec.ts` — `bcrypt.hash` async in `beforeEach` 외부에서 사용

- 위치: `auth.controller.spec.ts` line 506, 527 (diff 기준)
- 상세: `it` 콜백에서 `await bcrypt.hash(...)` 를 직접 사용한다. `bcrypt`의 해시 라운드가 4로 설정되어 테스트 속도 영향은 최소화되어 있다. `users.controller.spec.ts`도 동일한 패턴을 사용하며 일관성은 있다. 다만 해시를 `beforeEach`에서 미리 계산해두면 각 `it` 내 async 비용을 줄일 수 있다.
- 제안: 성능 영향이 작아 필수는 아니나, 긴 테스트 스위트라면 공유 `beforeAll`로 분리 가능.

---

### **[INFO]** `UsersController` 테스트에서 `AuditLogsService` mock이 `jest.clearAllMocks()` 없이 `beforeEach`에서 재생성됨

- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/audit-user-actions-5a037b/codebase/backend/src/modules/users/users.controller.spec.ts`
- 상세: `UsersController` 테스트는 NestJS `Test.createTestingModule`을 `beforeEach`에서 매 테스트마다 재생성하므로 `auditLogsService` mock이 자동으로 초기화된다. 반면 `AuthController`와 `WebAuthnController` 테스트는 `beforeEach`에서 `jest.clearAllMocks()`를 명시적으로 호출한다. 결과는 동일하나 패턴이 혼재한다.
- 제안: 일관성을 위해 `UsersController` 테스트에도 `beforeEach` 내 `jest.clearAllMocks()` 추가 고려. 현 상태도 동작상 문제 없음.

---

### **[WARNING]** `verify2fa` 실패 경로(verifyAndEnable throw) audit 미기록 테스트 부재

- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/audit-user-actions-5a037b/codebase/backend/src/modules/auth/auth.controller.spec.ts`
- 상세: `auth.controller.spec.ts`의 `2FA audit logging` describe 블록에는 `disable2fa` 실패 케이스("does not record an audit log when disable2fa password is wrong")는 있으나, `verify2fa`에서 `totpService.verifyAndEnable`이 throw하는 경우 audit이 기록되지 않음을 검증하는 케이스가 없다. 구현 코드(`auth.controller.ts`)를 보면 `verifyAndEnable`이 throw하면 그 후의 `auditLogsService.record` 호출에 도달하지 않는다. 이는 예상되는 동작이나, 테스트로 명시되어 있지 않다.
- 제안: 아래 테스트 케이스 추가:
  ```ts
  it('does not record audit when verify2fa fails', async () => {
    totpService.verifyAndEnable.mockRejectedValue(new UnauthorizedException());
    await expect(controller.verify2fa(payload, { code: 'bad' })).rejects.toThrow();
    expect(auditLogsService.record).not.toHaveBeenCalled();
  });
  ```

---

### **[INFO]** e2e 테스트에서 WebAuthn 감사 로그 실제 DB 기록 검증 부재 (범위 밖이나 언급)

- 위치: 해당 e2e 파일 미포함 (변경 범위 외)
- 상세: 유닛 테스트는 mock으로 `auditLogsService.record` 호출 여부만 검증한다. `AuditLogsService.record` 내부의 실제 DB INSERT와 swallow 동작은 통합/e2e 수준에서만 검증 가능하다. 이 PR의 변경 범위가 controller 경계이므로 e2e 보완은 별도 작업이 될 수 있으나, 기존 e2e 테스트(`webauthn-2fa.e2e-spec.ts` 등)에 audit log 실기록 검증이 없다면 통합 갭이 존재한다.
- 제안: 별도 작업으로 e2e에 `SELECT audit_log WHERE action='user.2fa_enabled'` 등 DB 검증 추가 고려.

---

### **[INFO]** `audit-action.const.ts` 자체 유닛 테스트 없음 (const 파일이므로 필수 아님)

- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/audit-user-actions-5a037b/codebase/backend/src/modules/audit-logs/audit-action.const.ts`
- 상세: 상수 파일에 테스트가 없는 것은 일반적이며, 컴파일 타임 타입 강제(`AuditAction` union)로 런타임 보호가 이루어지고 있다. 신규 액션 3개(`USER_PASSWORD_CHANGED`, `USER_2FA_ENABLED`, `USER_2FA_DISABLED`)의 string 값은 컨트롤러 테스트에서 `AUDIT_ACTIONS` 참조를 통해 간접 검증된다.
- 제안: 현 상태 유지.

---

## 요약

이번 변경에서 핵심 감사 액션 3종(`user.password_changed`, `user.2fa_enabled`, `user.2fa_disabled`)에 대해 모든 관련 컨트롤러(`UsersController`, `AuthController`, `WebAuthnController`)의 성공 경로 audit 기록과 실패 경로 audit 미기록이 유닛 테스트로 체계적으로 커버되었다. `webauthn.service.ts`의 시그니처 변경도 기존 테스트를 갱신해 회귀를 잠금했다. 다만 `WebAuthnController`의 `webauthnDelete`와 `webauthnRegisterVerify`에서 서비스가 throw하는 경우 audit 미기록을 보장하는 테스트가 누락되어 있고, `verify2fa` 실패 경로 테스트도 없다. 이 세 케이스는 구현 동작 자체는 올바르나 테스트로 명시되지 않아 향후 리팩터링에서 silent regression이 생길 수 있다. 전반적인 테스트 품질은 양호하며, 테스트 격리·가독성·mock 적절성 모두 문제 없다.

## 위험도

LOW
