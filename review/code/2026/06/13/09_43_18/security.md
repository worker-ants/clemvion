# 보안(Security) Review

## 발견사항

### [INFO] 비밀번호 변경 후 기존 refresh token 일괄 revoke 미수행
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/audit-user-actions-5a037b/codebase/backend/src/modules/users/users.controller.ts` — `changePassword` 메서드 (lines 156–171)
- 상세: 비밀번호 변경 성공 후 기존 refresh token 을 일괄 revoke 하지 않는다. 공격자가 이미 refresh token 을 탈취한 상태라면 비밀번호가 변경된 이후에도 해당 토큰으로 새 access token 을 계속 발급받을 수 있다. 이는 계정 탈취(Account Takeover) 복구 시나리오에서 치명적인 보안 갭이다. 이번 변경으로 `user.password_changed` 감사 이벤트 기록이 추가됐으나, 세션 무효화 없이 기록만 남기면 탈취 후 대응이 어렵다.
- 제안: `changePassword` 성공 시 `SessionsService.revokeAll(userId)` (또는 동등한 refresh token 전체 폐기) 호출을 추가한다. spec 에 세션 revoke 정책이 미정의라면 별도 설계 결정으로 분리하되, 이 갭을 보안 요구사항으로 명시적으로 등록한다.

---

### [INFO] `user.*` 감사 이벤트에 클라이언트 IP 미포함 — 포렌식 가치 저하
- 위치: `users.controller.ts:changePassword`, `auth.controller.ts:verify2fa/disable2fa`, `webauthn.controller.ts:webauthnRegisterVerify/webauthnDelete`
- 상세: `auth_config.*` 계열 감사 이벤트는 `ipAddress` 를 포함하는 것으로 보이나, 이번에 추가된 `user.*` 이벤트(비밀번호 변경, 2FA 활성화/비활성화)에는 IP 정보가 없다. 비밀번호 변경과 2FA 조작은 고위험 계정 보안 이벤트이며, IP 없이는 의심스러운 지리적 위치에서의 조작 탐지가 불가능하다. 현재 메서드들이 `@Request() req` 를 받지 않아 `extractClientIp(req)` 호출이 불가한 구조적 이유가 있으나, 보안상 갭이다.
- 제안: 각 해당 controller 메서드 시그니처에 `@Req() req: Request` 파라미터를 추가하고 `extractClientIp(req)` 로 IP 를 추출해 `details.ipAddress` 에 포함한다. 향후 작업으로 분리 가능하나 보안 요구사항으로 등록 권장.

---

### [INFO] WebAuthn optionsToken 이 access JWT 와 동일 `JWT_SECRET` 공유
- 위치: `codebase/backend/src/modules/auth/webauthn/webauthn.service.ts` (기존 설계, 이번 변경 비직접 관련)
- 상세: WebAuthn 등록 옵션 토큰(`optionsToken`)이 `JWT_SECRET` 을 공유하고 `kind` 클레임으로만 구분된다. 동일 시크릿 공유는 `kind` 클레임 검증 버그 발생 시 토큰 타입 혼용 공격 가능성을 내포한다. defense-in-depth 측면에서 전용 secret 분리가 권장된다.
- 제안: WebAuthn optionsToken 전용 `WEBAUTHN_OPTIONS_SECRET` env 변수 도입을 후속 작업으로 검토한다. 이번 PR 범위 밖.

---

### [INFO] WebAuthn 복구 코드 해시가 솔트 없는 SHA-256
- 위치: `codebase/backend/src/modules/auth/webauthn/webauthn.service.ts` (기존 설계, 이번 변경 비직접 관련)
- 상세: WebAuthn 복구 코드를 SHA-256(솔트 없음)으로 저장한다. 복구 코드는 랜덤 엔트로피가 충분하다면 레인보우 테이블 공격 실효성이 낮으나, OWASP 권고 및 TOTP 복구 코드 해시 방식(bcrypt 사용)과 일관성이 없다. DB 유출 시 hash 역산 시도 방어 수준이 bcrypt/argon2id 대비 낮다.
- 제안: argon2id 또는 bcrypt 로 전환을 후속 설계로 검토. 이번 PR 범위 밖.

---

### [INFO] `AuditLogsService.record` 실패 시 swallow — 감사 공백 감지 불가
- 위치: `users.controller.ts`, `auth.controller.ts`, `webauthn.controller.ts` — `auditLogsService.record(...)` 호출 전반
- 상세: `AuditLogsService.record` 는 내부적으로 예외를 삼키고 주 동작을 보호하는 설계(spec §1.2)다. 이는 UX 연속성을 위한 의도된 결정이나, 감사 기록 실패가 무음으로 지나갈 경우 보안 감사(audit trail) 의 완결성(completeness)을 보장하지 못한다. 공격자가 감사 서비스 오작동을 유발해 의도적으로 감사 공백을 만드는 시나리오에서 탐지가 불가능해진다.
- 제안: `record` 실패 시 에러 로그 외 메트릭(카운터) 노출 또는 알림을 추가한다. 이미 deferred 항목으로 등록됨. 감사 완결성이 컴플라이언스 요구사항(SOC2 등)인 경우 우선순위 상향 필요.

---

## 요약

이번 변경은 `user.password_changed`·`user.2fa_enabled`·`user.2fa_disabled` 세 감사 액션을 인증 세션 JWT의 `workspaceId` 에 귀속해 controller 경계에서 올바르게 기록한다. 하드코딩된 시크릿, SQL 인젝션, XSS, 커맨드 인젝션, 인증 우회, OWASP Top 10 신규 취약점은 발견되지 않았다. 인증/인가 흐름은 기존 `JwtAuthGuard` + `CurrentUser` 데코레이터를 준수하며, 감사 기록은 비즈니스 로직 성공 후에만 수행되어 실패 경로에서 오탐 기록이 발생하지 않는다. 보안 관점의 주요 미비사항은 (1) 비밀번호 변경 후 세션 revoke 부재(계정 탈취 복구 시나리오), (2) 고위험 이벤트에 IP 미포함(포렌식 저하), (3) WebAuthn 관련 기존 설계상 defense-in-depth 갭(optionsToken secret 공유, 복구 코드 SHA-256)이며, 모두 기존 설계 결정 또는 범위 외 후속 작업으로 분류된다. Critical 및 Warning 수준 신규 취약점은 없다.

## 위험도

LOW

STATUS: SUCCESS
