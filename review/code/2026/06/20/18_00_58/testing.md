### 발견사항

---

- **[WARNING]** `sessions.service.spec.ts` 의 `revokeFamily` 테스트가 5번째 인자(`currentRefreshToken`) 없이 호출됨
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-auth-reverify-unify/codebase/backend/src/modules/auth/sessions.service.spec.ts` L141, L165, L172, L179, L193, L207
  - 상세: 실제 `revokeFamily` 시그니처는 `(userId, familyId, auth, ctx, currentRefreshToken: string | null)` 로 5개 인자를 갖는다. 기존 테스트는 4개 인자만 전달하므로 `currentRefreshToken` 이 `undefined` 로 평가된다. `revokeFamily` 내부에서 `if (currentRefreshToken)` 조건은 `undefined` 에 대해 false 처리되어 self-revoke 방지 분기(L146-156 of sessions.service.ts)가 아예 실행되지 않는다. TypeScript 컴파일은 통과하지만(`undefined` ≡ `null | string` 의 타입 오류는 tsconfig strict null 설정에 따라 다름), 의도와 다른 테스트 경로가 고정된다.
  - 제안: `revokeFamily` 호출부 전체에 5번째 인자를 명시한다. `null` 로 전달하면 "현재 세션 정보 없는" 시나리오, 특정 hash 값 전달 시 self-revoke 시나리오를 구분하여 테스트할 수 있다.

---

- **[WARNING]** `revokeFamily` 의 self-revoke 방지 분기(`CANNOT_REVOKE_CURRENT_SESSION`, L146-156)에 대한 테스트가 없음
  - 위치: `sessions.service.spec.ts` — `revokeFamily` describe 블록 내
  - 상세: 현재 세션과 동일한 familyId 를 revoke 시도하면 `BadRequestException(CANNOT_REVOKE_CURRENT_SESSION)` 이 던져지는 분기는 코드 상 존재하지만 어떤 테스트에서도 실행되지 않는다. 위의 인자 누락 문제로 분기 자체가 never 경로가 되어 있다.
  - 제안: 다음 두 케이스를 추가한다. (1) `currentRefreshToken` 에 `familyId` 와 일치하는 현재 토큰을 제공 → `BadRequestException` expect. (2) `currentRefreshToken` 이 다른 family 의 토큰 → 정상 revoke 진행.

---

- **[INFO]** `sessions.service.spec.ts` 의 `revokeFamily` 테스트가 `bcrypt.compare` 를 직접 사용하여 실제 bcrypt hash 를 만듦 (L133)
  - 위치: `sessions.service.spec.ts` L9, L133
  - 상세: 변경된 `sessions.service.ts` 는 `bcrypt.compare` 대신 `comparePassword` 헬퍼를 사용한다. 테스트는 여전히 `import * as bcrypt` + `bcrypt.hash(...)` 로 hash 를 생성하므로, `comparePassword` 가 내부적으로 동일 bcrypt 를 쓰는 한 동작은 맞다. 그러나 테스트의 `import * as bcrypt` 는 변경사항(bcrypt 의존 제거 목적)의 정신과 다소 충돌한다. 사실상 기능적 문제는 없으며, `hashPassword` 헬퍼를 이용하면 더 일관성이 있다.
  - 제안: (선택) `bcrypt.hash(...)` 대신 `hashPassword(...)` (from `password.util`) 를 사용하도록 교체하면 테스트 코드도 단일진실 경로를 따르게 된다.

---

- **[INFO]** `webauthn.controller.spec.ts` 의 `webauthnRegenerateRecovery` 테스트에서 `webauthnService.regenerateRecoveryCodes` 성공 케이스가 실제 반환 배열 값만 검증하고 인자 전달(`user.sub`)을 검증하지 않음
  - 위치: `webauthn.controller.spec.ts` L663-671
  - 상세: `expect(res).toEqual({ data: { webauthnRecoveryCodes: ['x', 'y'] } })` 는 결과를 확인하지만, `webauthnService.regenerateRecoveryCodes` 가 올바른 userId(`'user-uuid'`)로 호출되었는지 `toHaveBeenCalledWith` 검증이 없다. 기능적으로 가장 중요한 보안 위임 경로(어떤 userId 에 대해 코드를 재발급하는가)가 테스트에서 암묵적으로 처리된다.
  - 제안: `expect(webauthnService.regenerateRecoveryCodes).toHaveBeenCalledWith('user-uuid')` 를 성공 케이스에 추가한다.

---

- **[INFO]** `revokeOtherFamilies` 의 `loginHistory.record` 호출 검증이 없음 (revoked > 0 시)
  - 위치: `sessions.service.spec.ts` L212-256
  - 상세: `revokeOtherFamilies` 는 `revoked > 0` 일 때 `loginHistory.record` 를 호출한다. 현재 테스트의 성공 케이스(`affected: 3`)에서 `loginHistory.record` 호출 여부·인자를 검증하지 않는다. `revokeAllFamilies` 는 해당 검증이 있다.
  - 제안: `revokeOtherFamilies` 성공 케이스에 `expect(loginHistory.record).toHaveBeenCalledWith(expect.objectContaining({ event: 'session_revoked', familyId: null }))` 를 추가한다.

---

### 요약

핵심 변경(sessions.service `bcrypt.compare` → `comparePassword`, webauthn.controller `verifyPasswordForUser` 위임)은 동작-보존 리팩터로 기존 테스트가 계속 유효하며, `webauthnRegenerateRecovery` 신설 테스트는 위임 흐름·실패 분기 모두 명확히 커버한다. 다만 `sessions.service.spec.ts` 의 `revokeFamily` 테스트군 전체가 5번째 인자(`currentRefreshToken`)를 전달하지 않아 self-revoke 방지 분기가 테스트에서 dead code 상태이다—이는 이번 변경이 추가한 코드가 아니라 기존 코드의 커버리지 갭이지만, 리뷰 대상 범위 내 파일에 존재하므로 WARNING 으로 기록한다. `password.util` 과 `auth.service.verifyPasswordForUser` 는 독립 테스트가 충분히 존재한다.

### 위험도

LOW
