### 발견사항

---

**[HIGH] 초대 토큰이 프로덕션 로그에 무조건 기록됨**
- 위치: `mail.service.ts` → `sendWorkspaceInvitationEmail`
- 상세: 이메일 인증 토큰은 `MAIL_TRANSPORT=console` 일 때만 로그에 기록하지만, 초대 토큰 URL은 transport 설정에 무관하게 `this.logger.debug(...)` 로 항상 출력됩니다. 프로덕션 로그 집계 시스템(CloudWatch, Datadog 등)에 토큰이 수집될 수 있습니다.
  ```typescript
  // 검증 메일: transport 조건부
  if (this.transport === MAIL_TRANSPORT_CONSOLE) {
    this.logger.debug(`Verification email for ${email}: ${verifyUrl}`);
  }
  
  // 초대 메일: 무조건 기록됨 ← 문제
  this.logger.debug(`[DEV] Workspace invitation for ${email}: ${acceptUrl}`);
  ```
- 제안: 검증 메일과 동일하게 `if (this.transport === MAIL_TRANSPORT_CONSOLE)` 조건으로 감쌉니다.

---

**[WARNING] `GET /invitations/:token` 공개 엔드포인트에 rate limiting 없음**
- 위치: `invitations.controller.ts` → `getMeta`
- 상세: 토큰 엔트로피(384비트)가 높아 브루트포스는 비현실적이나, rate limiting이 없으면 유효 토큰이 탈취된 경우 무제한 조회가 가능합니다. 이 엔드포인트는 이메일 주소를 응답에 포함하므로 정보 노출 위험도가 있습니다.
- 제안: `@Throttle({ default: { ttl: 60_000, limit: 30 } })` 등을 추가합니다.

---

**[WARNING] `consumeForRegistration`이 `public`으로 노출됨 — 이메일 검증 없음**
- 위치: `workspace-invitations.service.ts` → `consumeForRegistration`
- 상세: 이 메서드는 이메일 일치 검사를 `AuthService.registerWithInvitation`에 위임합니다. 현재 코드베이스에서는 올바르게 호출되지만, 미래 호출자가 이메일 검증 없이 직접 호출하면 임의의 userId로 멤버십이 생성될 수 있습니다. 메서드가 `public`인 이유는 `AuthService`에서 접근해야 하기 때문이나, 의도치 않은 남용 경로가 열려 있습니다.
- 제안: JSDoc에 전제조건(이메일 검증은 호출자 책임)을 명시하거나, `EntityManager`를 인자로 받는 대신 `AuthService` 전용 내부 인터페이스로 분리하는 것을 검토합니다.

---

**[WARNING] `invitationToken` 최대 길이 검증 누락**
- 위치: `register.dto.ts`
- 상세: `@MinLength(16)`만 있고 `@MaxLength`가 없습니다. 생성 토큰 길이는 64자이므로, 임의 길이의 문자열을 허용합니다. 비밀번호와 달리 초대 토큰 경로에서는 이메일 불일치 시 bcrypt를 호출하지 않으므로 DoS 위험은 낮지만, 입력 경계를 명시하는 것이 좋습니다.
- 제안: `@MaxLength(128)` 추가 (또는 정확히 64자로 고정하려면 `@Length(64)`).

---

**[WARNING] `invitationToken` 최소 길이가 실제 발급 길이와 불일치**
- 위치: `register.dto.ts`
- 상세: 발급 토큰은 항상 64자(`randomBytes(48).toString('base64url')`)인데, DTO는 `@MinLength(16)`을 허용합니다. 64자 미만 토큰은 데이터베이스 조회에서 자연히 거부되지만, 의도치 않게 짧은 값을 서비스 레이어까지 통과시킵니다.
- 제안: `@MinLength(64)` 또는 `@Length(64)`로 변경합니다.

---

**[INFO] 토큰 엔트로피 업그레이드 — 긍정적**
- 위치: `workspace-invitations.service.ts` → `generateToken`
- 상세: 기존 `randomBytes(24).toString('hex')` (192비트) → `randomBytes(48).toString('base64url')` (384비트)로 강화되었습니다. 충분한 엔트로피입니다.

---

**[INFO] 동시 수락 경쟁 조건 처리 — 올바름**
- 위치: `workspace-invitations.service.ts` → `applyAccept`
- 상세: `WHERE id = :id AND accepted_at IS NULL` 조건의 원자적 UPDATE로 두 번째 수락 시도를 안전하게 차단합니다.

---

**[INFO] HTML 이메일의 XSS 처리 — 올바름**
- 위치: `mail.service.ts`
- 상세: `workspaceName`, `invitedByName` 모두 `escapeHtml()`을 통해 처리됩니다. 텍스트 메일에서는 HTML 컨텍스트가 없어 이스케이프가 불필요하고 적용되지 않는 것도 올바릅니다.

---

**[INFO] 초대 가입 트랜잭션 설계 — 올바름**
- 위치: `auth.service.ts` → `registerWithInvitation`
- 상세: 사용자 생성 + 멤버십 부여 + 초대 소비가 하나의 트랜잭션으로 묶여 있습니다. 부분 실패 시 롤백이 보장됩니다.

---

### 요약

전반적으로 토큰 엔트로피 강화, 동시성 안전 처리(원자적 UPDATE), HTML 이스케이프, 트랜잭션 무결성 등 보안 설계가 양호합니다. 가장 즉각적인 조치가 필요한 항목은 **초대 토큰이 프로덕션 로그에 무조건 노출되는 문제**로, 이메일 인증 토큰의 조건부 로깅 패턴을 그대로 적용하면 해결됩니다. 그 외 rate limiting 누락과 입력 길이 검증 미흡은 방어 심층(defense-in-depth) 수준의 개선 사항입니다.

### 위험도

**MEDIUM** (HIGH 항목 1건이 있으나, 운영 환경 로그 접근 권한이 내부 인원으로 제한된다면 실질 위험은 MEDIUM 수준)