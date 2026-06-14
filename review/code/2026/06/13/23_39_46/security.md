### 발견사항

- **[INFO]** `BCRYPT_ROUNDS = 12` 단일 진실 원칙(SoT) 정착 — 긍정적 변경
  - 위치: `codebase/backend/src/common/utils/password.util.ts` L5
  - 상세: 이전에 `auth.service.ts`와 `users.service.ts` 각각에 `const BCRYPT_ROUNDS = 12`가 중복 선언돼 있었으며, 한쪽만 변경할 경우 해시 강도 불일치가 발생할 수 있었다. 이번 리팩터로 `hashPassword()` 한 곳에서만 관리한다.
  - 제안: 현 구조 유지. `BCRYPT_ROUNDS = 12`는 OWASP 2023 권고(≥10)를 충족하며, 적절한 수준이다.

- **[INFO]** `users.service.ts`에 여전히 `import * as bcrypt from 'bcrypt'`가 잔존
  - 위치: `codebase/backend/src/modules/users/users.service.ts` L4
  - 상세: `changePassword()` 메서드에서 `bcrypt.compare(currentPassword, user.passwordHash)`를 직접 호출하기 때문에 import 자체는 필요하다. 그러나 해시 생성(`bcrypt.hash`)은 `hashPassword()`로 위임됐으므로, `bcrypt` 직접 사용 범위가 비교(compare)만으로 좁혀진 것은 의도된 설계다. 보안 결함은 아니다.
  - 제안: 추후 `comparePassword(plain, hash)` 유틸리티를 `password.util.ts`에 추가해 bcrypt 직접 의존을 `users.service.ts`에서도 제거하면 SoT 일관성이 더 높아진다. 현 상태는 허용 가능.

- **[INFO]** `checkEmail` API — 이메일 열거(Enumeration) 가능성
  - 위치: `codebase/backend/src/modules/auth/auth.service.ts` `checkEmail()` 메서드
  - 상세: `{ available: boolean }` 을 직접 반환하는 공개 엔드포인트가 존재하는 경우, 공격자가 이메일 목록의 유효성을 대량으로 확인할 수 있다. `forgotPassword` / `resendVerification`은 동일 응답으로 열거를 방어하고 있으나, `checkEmail`은 설계상 열거를 허용한다.
  - 제안: 이 엔드포인트가 회원가입 폼의 실시간 중복 확인 전용이라면, rate limit이 컨트롤러/미들웨어 레이어에서 적용되는지 확인이 필요하다. 이 변경 범위에는 컨트롤러 코드가 포함되지 않아 현 diff에서 판단 불가이며, 기존 설계 이슈로 분류한다.

- **[INFO]** 테스트 파일에 실제 bcrypt 연산 수행 — 성능 고려
  - 위치: `codebase/backend/src/common/utils/password.util.spec.ts` L49–59
  - 상세: 두 테스트 케이스 모두 `BCRYPT_ROUNDS=12`로 실제 해시를 생성한다. rounds=12는 CPU 집약적이므로 CI 환경에서 테스트 suite 속도에 영향을 줄 수 있다. 보안 결함은 아니나, 일부 프로젝트에서는 테스트 전용 낮은 rounds(예: 1)를 사용하기도 한다.
  - 제안: `hashPassword`의 rounds를 환경 변수로 오버라이드 가능하게 하거나, 테스트에서 mock을 사용하는 것을 검토할 수 있다. 현재 구현은 실제 동작을 검증한다는 측면에서 보안적으로는 올바르다.

- **[INFO]** 문서(MDX) — OAuth 계정에 비밀번호 설정 불가 명시
  - 위치: `codebase/frontend/src/content/docs/07-workspace-and-team/password-and-sessions.mdx` 및 `.en.mdx`
  - 상세: "소셜 로그인 계정의 비밀번호를 직접 설정하는 기능은 현재 제공되지 않아요"라고 명시. 실제로 `users.service.ts::changePassword()`가 `!user.passwordHash`를 `INVALID_PASSWORD`로 차단하므로 문서와 구현이 일치한다. 문서 내용이 구현을 정확히 반영하고 있다.

### 요약

이번 변경은 bcrypt 해시 생성 로직을 `password.util.ts`의 `hashPassword()` 단일 함수로 중앙화하는 리팩터링이다. `BCRYPT_ROUNDS = 12`의 중복 선언을 제거해 값 불일치 위험을 제거했으며, 비밀번호 해시 경로(회원가입·초대 가입·비밀번호 재설정·변경)가 동일 cost factor를 사용하는 것이 코드 수준에서 보장된다. 인증/인가 로직(bcrypt compare, JWT sign/verify, refresh token rotation, 2FA 분기)은 변경 없이 유지됐으며, 하드코딩된 시크릿·인젝션 취약점·민감 정보 노출 등 중대 보안 결함은 발견되지 않았다. `users.service.ts`에 `bcrypt` 직접 import가 잔존하지만 compare 목적으로만 사용되므로 현재 문제는 아니다. 신규 MDX 문서는 구현 동작을 정확히 서술하며, 보안 관점에서 잘못된 안내는 없다.

### 위험도

NONE
