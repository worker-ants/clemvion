# 신규 식별자 충돌 검토 결과

검토 모드: --impl-done (scope=spec/5-system/1-auth.md, diff-base=origin/main)

---

## 발견사항

- **[INFO]** `verifyPasswordForUser` — 메서드명 신규 도입, 충돌 없음
  - target 신규 식별자: `AuthService.verifyPasswordForUser(userId: string, plainPassword: string): Promise<void>`
  - 기존 사용처: `spec/5-system/1-auth.md` 및 `spec/data-flow/2-auth.md` 에 해당 메서드명 미존재. 코드베이스 내에서도 이전까지 동명 메서드 없음.
  - 상세: 동일 모듈(`auth.service.ts`) 안에는 기존에 `comparePassword` 헬퍼(공통 유틸, `codebase/backend/src/common/utils/password.util.ts:22`) 와 login 경로의 인라인 bcrypt 비교가 있었다. 신규 메서드는 이 헬퍼를 재사용하며 이름 중복·의미 충돌 없다.
  - 제안: 변경 없음. 필요 시 `spec/data-flow/2-auth.md §1.2` 에 메서드 참조를 추가하면 추적성이 높아진다.

- **[INFO]** `PASSWORD_REQUIRED` / `PASSWORD_INVALID` 에러 코드 — 기존 사용처와 동일 의미 재사용
  - target 신규 식별자: `verifyPasswordForUser` 내에서 `code: 'PASSWORD_REQUIRED'`, `code: 'PASSWORD_INVALID'` 발생
  - 기존 사용처:
    - `codebase/backend/src/modules/auth/webauthn/webauthn.controller.ts:376,383` — `webauthnRegenerateRecovery` 에서 동일 코드·동일 메시지로 이미 사용 중
    - `codebase/backend/src/modules/auth/sessions.service.ts:249` — `PASSWORD_INVALID` 를 세션 revoke 재인증 경로에서 사용 중
  - 상세: 세 사용처 모두 "비밀번호 재확인 실패" 의 동일 의미 → 이번 변경은 `disable2fa` 경로를 서비스로 이관하면서 동일 코드·메시지를 보존한 것이므로 의미 충돌이 없다. 단, `webauthn.controller.ts` 와 `sessions.service.ts` 는 아직 raw `bcrypt.compare` 로 직접 검증하고 있어 `verifyPasswordForUser` 로 통합하지 않은 상태다 — 이는 이번 리팩터 범위 외 사항이므로 충돌이 아니라 잔여 비일관성이다.
  - 제안: 필요 시 후속 리팩터에서 `webauthn.controller.ts:369-386` 과 `sessions.service.ts:244-252` 도 `authService.verifyPasswordForUser` 를 호출하도록 통합하면 비밀번호 재확인 로직이 단일 진실로 수렴한다. 현 단계에서는 충돌 아님.

- **[INFO]** `BCRYPT_ROUNDS` 상수 — 기존 상수 재사용, 신규 도입 아님
  - target 신규 식별자: 테스트(`auth.service.spec.ts`)에서 `BCRYPT_ROUNDS` 임포트·사용
  - 기존 사용처: `codebase/backend/src/common/utils/password.util.ts:8` 에 이미 선언·내보내기 중. 동일 테스트 파일 내 기존 테스트들도 이미 사용 중.
  - 상세: 신규 충돌 없음.
  - 제안: 변경 없음.

---

## 요약

이번 변경(refactor 02 C-3)이 도입하는 식별자는 `AuthService.verifyPasswordForUser` 하나이며, 코드베이스와 spec 어디에도 동명·유사 의미의 기존 메서드가 없어 식별자 충돌이 발생하지 않는다. 에러 코드 `PASSWORD_REQUIRED`/`PASSWORD_INVALID` 는 기존 인접 경로(`webauthn.controller.ts`, `sessions.service.ts`)에서 동일 의미로 이미 사용 중이므로 의미 충돌이 아닌 의도적 코드 재사용이다. 단, 해당 두 경로는 여전히 raw bcrypt 비교를 직접 수행하고 있어 `verifyPasswordForUser` 로 통합되지 않은 잔여 비일관성이 남아 있지만, 이는 이번 리팩터 범위를 초과하는 사항이다.

---

## 위험도

NONE
