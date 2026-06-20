# Security Review — refactor-c3-auth-bcrypt-service

## 발견사항

### [INFO] 레이어 이관 결과: 암호화 연산의 집중도 향상
- 위치: `codebase/backend/src/modules/auth/auth.service.ts` — `verifyPasswordForUser` (신설), `codebase/backend/src/common/utils/password.util.ts`
- 상세: 컨트롤러에서 직접 수행하던 `bcrypt.compare` 가 `AuthService.verifyPasswordForUser` → `comparePassword` 헬퍼로 이관됨. bcrypt rounds 상수(`BCRYPT_ROUNDS = 12`)는 단일 파일(`password.util.ts`)에서 관리되며, 모든 해시/비교 경로가 동일 진입점을 통과한다. cost factor 12는 OWASP 권장 최솟값(≥10)을 충족하는 적절한 수준이다.
- 제안: 현행 유지.

### [INFO] 에러 응답의 분기: `PASSWORD_REQUIRED` vs `PASSWORD_INVALID` 구분
- 위치: `auth.service.ts` 라인 2413–2424
- 상세: `!user` 와 `!passwordHash` 를 동일 코드(`PASSWORD_REQUIRED`)로 처리한다. 이는 "사용자 존재 여부" 를 노출하지 않는 관점에서 긍정적이나, 반면 OAuth 전용 계정(비밀번호 미설정)이 2FA 비활성 시도 시 사용자에게 원인 불명의 401을 받는 시나리오가 존재한다. 악용 가능성(사용자 enum) 은 없으나 UX 상 진단이 어려울 수 있다.
- 제안: 보안 영향 없음. 필요 시 authenticated 경로임을 감안해 `!passwordHash` 를 별도 처리 (`PASSWORD_NOT_SET` 등) 할 수 있으나 현행도 acceptable.

### [INFO] 로그인 이력 미기록: `verifyPasswordForUser` 실패 이벤트
- 위치: `auth.service.ts` — `verifyPasswordForUser`
- 상세: 2FA 비활성 시 비밀번호 검증 실패(`PASSWORD_INVALID`)는 현재 `loginHistory.record` 를 호출하지 않는다. 반면 `/auth/login` 의 비밀번호 실패는 `login_failed` 이벤트와 `incrementLoginAttempts` 를 동반한다. 즉, 공격자가 2FA 비활성 엔드포인트(`POST /auth/2fa/disable`)를 통해 비밀번호를 무제한 시도(brute force)해도 계정 잠금이 작동하지 않는다. 이 엔드포인트는 `JwtAuthGuard` 로 보호되어 있어 유효한 access token 이 필요하지만, access token이 탈취된 상황이거나 장기 세션 악용 시나리오에서 위험 요소가 된다.
- 제안: `verifyPasswordForUser` 실패 시 `incrementLoginAttempts` / `loginHistory.record(login_failed)` 를 호출하거나, 해당 메서드에 별도 실패 카운터를 두는 것을 검토할 것. 또는 엔드포인트 수준에서 `@Throttle` rate limit 을 별도 설정하는 방법도 있다.

---

## 요약

이번 변경은 `AuthController.disable2fa` 에서 raw `bcrypt` 호출을 제거하고 `AuthService.verifyPasswordForUser` 로 위임하는 레이어 정렬 리팩터링이다. 하드코딩된 시크릿·SQL/커맨드 인젝션·인증 우회·암호화 알고리즘 약화 등 OWASP Top 10 해당 취약점은 발견되지 않았다. bcrypt cost factor(12)·토큰 SHA-256 해시 저장·httpOnly 쿠키·Origin allowlist CSRF 방어·refresh 토큰 재사용 탐지 등 기존 보안 통제는 모두 보존된다. 유일한 주목할 사항은 `POST /auth/2fa/disable` 의 비밀번호 실패가 로그인 실패 카운터·이력에 반영되지 않아 인증된 공격자가 제한 없이 비밀번호를 시도할 수 있다는 점이나, 해당 경로는 유효한 JWT가 있어야 접근 가능하므로 현실 위험도는 낮다.

## 위험도

LOW
