## 발견사항

- **[INFO]** `verifyPasswordForUser` early-exit 타이밍 사이드채널 (기존 잠재 이슈, 본 changeset 외부)
  - 위치: `/codebase/backend/src/modules/auth/auth.service.ts:65-70` (`verifyPasswordForUser`)
  - 상세: `!user || !user.passwordHash` 분기에서 `comparePassword` 를 호출하지 않고 즉시 `UnauthorizedException` 를 던진다. 타이밍 차이로 userId 존재 여부를 이론상 구별할 수 있다. 다만 해당 엔드포인트(webauthn regenerate)는 JWT 인증 후 본인 계정만 조회하므로 userId enumeration 불가능. 실위험 ~0이며 plan 파일에서도 defer 결정됨.
  - 제안: dummy bcrypt.compare 를 삽입해 타이밍을 상수화하는 별도 보안 작업으로 처리 (behavior-change, 본 changeset 범위 밖).

- **[INFO]** `resolveCurrentFamilyId` 에서 취소된(isRevoked=true) 토큰을 필터링하지 않으면 revoked 토큰으로 current 세션 판별을 시도할 수 있음 — 단, 실 코드는 `isRevoked: false` 조건이 있어 문제 없음
  - 위치: `/codebase/backend/src/modules/auth/sessions.service.ts:854`
  - 상세: `resolveCurrentFamilyId` 는 `where: { tokenHash: hash, isRevoked: false }` 로 조회한다. isRevoked 필터가 명시적으로 포함되어 있어 revoke 된 토큰이 현재 세션으로 오인되는 경로는 없다.
  - 제안: 현행 코드 유지. 이슈 없음.

- **[INFO]** 브루트포스 보호 부재 (기존 known gap, 본 changeset 범위 밖)
  - 위치: `webauthnRegenerateRecovery` 엔드포인트 + `verifyReauth` 내 password/TOTP 검증
  - 상세: rate limiting / lockout 없이 패스워드·TOTP를 반복 시도할 수 있다. JWT 인증 뒤에 위치하므로 익명 공격은 불가하나 탈취된 access token 보유 공격자가 무제한 재시도 가능하다. plan 파일에서 "별도 보안 작업"으로 명시 defer됨.
  - 제안: 별도 보안 스프린트에서 rate limiter(NestJS Throttler 등) 적용.

- **[INFO]** `hashRaw` 함수가 테스트 전용 파일에 SHA-256 으로 직접 정의됨 (단순 INFO)
  - 위치: `/codebase/backend/src/modules/auth/sessions.service.spec.ts:168-170`
  - 상세: 테스트 보조 함수로 프로덕션 `createHash('sha256')` 로직을 반영한 것. 서비스 내부 해시 방식이 변경되면 테스트가 묵묵히 깨질 수 있다. 보안상 취약점은 아니며, 헬퍼를 서비스에서 export하거나 공유 테스트 util로 분리하면 변경 범위를 줄일 수 있다.
  - 제안: 필요 시 `resolveCurrentFamilyId` 의 해시 로직을 내부 정적 util 로 추출하고 spec 테스트가 동일 util 을 참조하도록 개선 가능 (cosmetic, 비차단).

## 요약

본 changeset 은 컨트롤러 레이어의 raw `bcrypt` 직접 호출을 `AuthService.verifyPasswordForUser` 로 위임하고, 서비스 레이어 내 `bcrypt.compare` 를 `comparePassword` 헬퍼로 통일하는 리팩터링이다. 하드코딩된 시크릿, 인젝션 취약점, 권한 검증 누락, 평문 전송 등 OWASP Top 10 해당 항목은 발견되지 않았다. 비밀번호는 bcrypt(rounds=12)로 안전하게 검증되며, 세션 self-revoke 차단·404 정보 누출 방지·인증 후 재인증 강제 등 보안 설계가 올바르게 구현되어 있다. 잠재 이슈(타이밍 사이드채널·브루트포스)는 모두 기존 known gap 으로 plan 에 defer 기록되어 있고 현 변경으로 위험이 증가하지 않는다.

## 위험도

LOW
