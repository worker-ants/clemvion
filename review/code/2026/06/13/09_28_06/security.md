### 발견사항

- **[INFO]** 감사 로그 실패 삼킴(swallow) 설계 — 의도된 설계이나 감사 누락 위험 존재
  - 위치: `codebase/backend/src/modules/users/users.controller.ts` L3152-3154 주석, `spec/data-flow/1-audit.md` Overview 섹션
  - 상세: `AuditLogsService.record`는 내부적으로 예외를 삼켜 주 동작(비밀번호 변경, 2FA 활성화/비활성화)을 깨지 않도록 설계됐다. 이는 spec에 명시된 의도된 설계다. 그러나 감사 실패 시 console.warn/Logger.error로만 기록되고 운영자에게 별도 알림이 없어, 침묵 감사 누락이 지속될 수 있다.
  - 제안: 감사 실패 카운터(메트릭)를 노출해 모니터링/알림으로 연결하는 것을 향후 개선 사항으로 고려. 현재 설계 자체는 보안 결함이 아니며 spec 준수.

- **[INFO]** 2FA 비활성화 감사 로그 — "완전 비활성화" 조건 미검증
  - 위치: `codebase/backend/src/modules/auth/webauthn/webauthn.controller.ts` `webauthnDelete` 메서드
  - 상세: `webauthnDelete`는 `remaining` 수에 관계없이 항상 `user.2fa_disabled` 이벤트를 기록한다. `remaining > 0`이면 사용자는 여전히 다른 WebAuthn credential을 보유하므로 "2FA 비활성화"가 아닌 "credential 삭제"가 더 정확한 표현이다. 감사 로그 소비자가 `user.2fa_disabled`를 "2FA 완전 해제"로 해석하면 오진 가능성이 있다.
  - 제안: `details.remainingCredentials` 필드로 맥락을 전달하고 있으므로 현재 설계가 허용 가능하나, 감사 로그 조회 UI/소비자가 이 필드를 올바르게 해석하도록 문서화 강화 권장. 실제 2FA 완전 해제(`remaining === 0`)에만 의미 있는 알림을 연동하는 경우 필터링 로직 필요.

- **[INFO]** 감사 이벤트에 IP 주소 미포함 — user.* 액션
  - 위치: `codebase/backend/src/modules/users/users.controller.ts`, `codebase/backend/src/modules/auth/auth.controller.ts`, `codebase/backend/src/modules/auth/webauthn/webauthn.controller.ts`
  - 상세: `auth_config.*` 계열은 `ipAddress`를 함께 전달하지만, 새로 추가된 `user.password_changed`, `user.2fa_enabled`, `user.2fa_disabled` 이벤트에는 `ipAddress`가 없다. 비밀번호 변경·2FA 변경은 계정 탈취 탐지에 중요한 이벤트로, IP 정보 부재는 사고 조사 시 가시성을 제한한다.
  - 제안: controller에서 `@Req()` 또는 `extractClientIp(req)`로 IP를 추출해 `auditLogsService.record({ ..., ipAddress })`에 포함하는 것을 고려. 현재는 보안 결함은 아니나 감사 로그의 포렌식 가치를 저하시킨다.

- **[INFO]** WebAuthn optionsToken과 access JWT의 공유 signing secret
  - 위치: `codebase/backend/src/modules/auth/webauthn/webauthn.service.ts` `signOptionsToken`/`verifyOptionsToken`
  - 상세: `WebAuthnService`의 optionsToken은 AuthModule에 등록된 `JwtService`(즉 동일 `JWT_SECRET`)를 사용해 서명한다. optionsToken payload에 `kind` 필드로 구분하고 있어 실제 혼용 가능성은 낮다. 그러나 access token과 WebAuthn options token이 동일 secret을 공유하므로 한쪽 secret 노출이 양쪽 모두에 영향을 준다.
  - 제안: WebAuthn optionsToken은 별도 전용 secret을 사용하는 것이 best practice. `kind` 검증으로 현재 위험은 제한적이나 defense-in-depth 관점에서 분리 권장.

- **[INFO]** 복구 코드 해시에 SHA-256 단독 사용 (솔트 없음)
  - 위치: `codebase/backend/src/modules/auth/webauthn/webauthn.service.ts` `hashRecoveryCode` 함수
  - 상세: `createHash('sha256').update(code).digest('hex')`로 솔트 없이 해시한다. 복구 코드는 `randomBytes(9)` 기반 12자 랜덤 문자열로 엔트로피가 충분(~54비트)해 레인보우 테이블 공격에 대한 실질적 위험은 낮다. 그러나 bcrypt/argon2 같은 느린 KDF 대신 빠른 SHA-256을 사용하는 것은, 코드 세트 전체가 DB에서 유출됐을 때 오프라인 brute-force 속도를 높인다.
  - 제안: 복구 코드 엔트로피(~54비트)를 고려하면 현재 위험은 낮지만, TOTP service의 복구 코드 해시 방식과 일관성 확인이 필요하다. 개선 시 argon2id나 bcrypt 사용 고려.

- **[INFO]** 비밀번호 변경 후 기존 세션 무효화 미수행
  - 위치: `codebase/backend/src/modules/users/users.controller.ts` `changePassword` 메서드
  - 상세: `user.password_changed` 감사 이벤트를 올바르게 기록하나, 비밀번호 변경 후 기존 refresh token(다른 기기의 세션)을 일괄 revoke하지 않는다. 공격자가 이미 유효한 refresh token을 보유하고 있다면 비밀번호 변경 후에도 세션을 유지할 수 있다.
  - 제안: 비밀번호 변경 시 `payload.sub`의 모든 활성 refresh token을 revoke하거나, 현재 세션을 제외한 나머지를 revoke하는 로직 추가를 강력히 권장. 이는 계정 탈취 복구 시나리오에서 중요한 보안 조치다.

- **[INFO]** 하드코딩된 시크릿/인라인 문자열 없음
  - 위치: 전체 변경 파일
  - 상세: API 키, 비밀번호, 토큰 등 하드코딩된 시크릿 없음. 테스트 파일의 bcrypt salt rounds가 4로 설정되어 있으나 이는 테스트 속도를 위한 표준적 패턴이다.

### 요약

이번 변경은 `user.password_changed`, `user.2fa_enabled`, `user.2fa_disabled` 세 감사 이벤트를 controller 경계에서 구현하는 것으로, SQL 인젝션·XSS·커맨드 인젝션 등 인젝션 취약점은 없고 하드코딩된 시크릿도 없다. 인증/인가는 기존 `JwtAuthGuard`와 JWT payload의 `workspaceId`·`sub`를 그대로 활용하며 권한 검증 우회 가능성은 없다. 가장 실질적인 보안 개선 여지는 비밀번호 변경 시 기존 세션 revoke 미수행이며, 이는 계정 탈취 복구 흐름에서 위험이 될 수 있다(INFO 등급으로 분류했으나 실제 운영 환경에서 보안 정책 결정이 필요한 사항). 나머지 항목은 설계상 trade-off(감사 실패 삼킴, IP 미포함, SHA-256 복구 코드 해시)이거나 낮은 위험도의 구조적 개선점이다.

### 위험도

LOW
