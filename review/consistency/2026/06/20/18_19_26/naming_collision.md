### 발견사항

충돌이나 명명 혼선에 해당하는 발견사항이 없습니다.

이 변경 세트가 도입하는 신규 식별자를 아래에 정리하고, 각각 기존 사용처 및 충돌 여부를 확인합니다.

---

**[INFO] `comparePassword` — `password.util.ts` 헬퍼, 신규 import 경로**

- target 신규 식별자: `import { comparePassword } from '../../common/utils/password.util'` (sessions.service.ts)
- 기존 사용처: `codebase/backend/src/common/utils/password.util.ts:22` 에 이미 정의됨. `auth.service.ts`, `users.service.ts` 에서도 동일 경로로 import 중.
- 상세: `sessions.service.ts` 가 기존에 `bcrypt.compare` 를 직접 호출하던 자리를 `comparePassword` 헬퍼로 교체했다. 헬퍼 자체는 기존 등록된 함수이며, 동일 이름·동일 의미로 사용하는 것이므로 충돌 없음.
- 제안: 해당 없음.

---

**[INFO] `verifyPasswordForUser` — `AuthService` 신규 public 메서드**

- target 신규 식별자: `authService.verifyPasswordForUser(userId, plainPassword)` (webauthn.controller.ts line 372, auth.service.ts line 59)
- 기존 사용처: `auth.controller.ts:341` 에서 동일 메서드를 동일 의미(`disable2fa` 재인증 경로)로 이미 호출 중. `auth.service.spec.ts:542` 에 단위 테스트 describe 블록 존재.
- 상세: 이번 변경은 `webauthn.controller.ts` 의 `webauthnRegenerateRecovery` 핸들러가 raw `bcrypt.compare`·`UsersService.findById` 를 직접 쓰던 패턴을 `AuthService.verifyPasswordForUser` 위임으로 전환한 것이다. 메서드 자체는 이번 변경세트 이전에 `auth.service.ts` 에 이미 정의(및 `auth.controller.ts` 에서 사용)되어 있었다. 새로 도입된 이름이 아니라 기존 메서드의 사용처 확장이므로 충돌 없음.
- 제안: 해당 없음.

---

**[INFO] `currentRefreshToken: string | null` 파라미터 — `revokeFamily` 5번째 인자**

- target 신규 식별자: `revokeFamily(userId, familyId, auth, ctx, currentRefreshToken)` 시그니처 변경 (sessions.service.ts line 74–80)
- 기존 사용처: `sessions.controller.ts:106` 가 `revokeFamily` 를 호출하는 유일한 운영 호출처이며, 5번째 인자 추가가 이미 반영됨. 테스트 파일들도 `null` 전달로 갱신됨.
- 상세: `currentRefreshToken` 은 self-revoke 차단 분기에서만 사용되는 파라미터이며, 스펙 `spec/data-flow/2-auth.md:201–203` 에서 이미 `CANNOT_REVOKE_CURRENT_SESSION` 동작으로 명시된 바와 일치한다. 명칭이 기존 다른 식별자와 겹치지 않음.
- 제안: 해당 없음.

---

**[INFO] `hashRaw` — 테스트 전용 로컬 함수**

- target 신규 식별자: `function hashRaw(token: string): string` (sessions.service.spec.ts line 17)
- 기존 사용처: 동일 spec 파일 내에서만 사용(`line 228, 252, 287`). 운영 코드·다른 테스트 파일에 `hashRaw` 라는 이름은 존재하지 않음.
- 상세: 테스트 픽스처 헬퍼로, 파일 스코프에 한정된다. 운영 코드의 어떤 identifier 와도 겹치지 않음.
- 제안: 해당 없음.

---

**[INFO] `webauthnRegenerateRecovery` describe 블록 추가**

- target 신규 식별자: `describe('webauthnRegenerateRecovery', ...)` (webauthn.controller.spec.ts line 240)
- 기존 사용처: `webauthn.controller.ts` 의 메서드 이름 `webauthnRegenerateRecovery` 는 기존부터 존재(`line 366`). 테스트 describe 만 신규 추가.
- 상세: 신규 엔드포인트가 아니라 기존 핸들러에 대한 테스트 커버리지 추가이므로 명명 충돌 없음.
- 제안: 해당 없음.

---

**에러 코드 — `PASSWORD_REQUIRED`, `PASSWORD_INVALID`, `REAUTH_REQUIRED`, `CANNOT_REVOKE_CURRENT_SESSION`**

- 이 에러 코드들은 변경 전부터 `auth.service.ts`, `sessions.service.ts` 에 존재하며, 이번 diff 는 삭제(제거된 `webauthn.controller.ts` 의 인라인 코드)하거나 기존 그대로 유지한다. 새로 만들어진 에러 코드 없음.
- `CANNOT_REVOKE_CURRENT_SESSION` 은 `spec/data-flow/2-auth.md:202` 에 명시되어 있으며 구현과 일치.

---

### 요약

이번 변경 세트(`refactor-auth-reverify-unify`)는 기존 `comparePassword` 헬퍼, `verifyPasswordForUser` 메서드, `CANNOT_REVOKE_CURRENT_SESSION` 에러 코드를 *신규 도입하지 않고 사용처를 확장 또는 통합*한 리팩터다. 새로 추가된 `currentRefreshToken` 파라미터와 `hashRaw` 테스트 헬퍼는 기존 식별자 네임스페이스와 겹치지 않는다. 요구사항 ID·엔티티명·API endpoint·이벤트명·환경변수·파일 경로 차원에서 식별자 충돌이 발견되지 않았다.

### 위험도

NONE
