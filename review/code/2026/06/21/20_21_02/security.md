# 보안(Security) 리뷰 결과

## 발견사항

### [INFO] resend 엔드포인트 rate-limit 누락 — 이메일 플러드 벡터
- 위치: `codebase/backend/src/modules/users/users.controller.ts` — `@Post('me/email-change/resend')`
- 상세: `requestEmailChange` 에는 `@Throttle({ default: { ttl: 60_000, limit: 5 } })` 가 적용되어 있으나 `resendEmailChange` 에는 throttle 데코레이터가 없다. 인증 세션을 보유한 사용자가 반복 호출로 동일 수신 주소에 이메일을 대량 발송할 수 있다. 이전 리뷰(RESOLUTION INFO#1)에서 "5/min 이미 적용됨"으로 스킵되었으나, 실제 diff 에서 resend 엔드포인트에 `@Throttle` 데코레이터가 보이지 않는다. 재확인 필요.
- 제안: `@Post('me/email-change/resend')` 에 `@Throttle({ default: { ttl: 60_000, limit: 3 } })` 수준의 제한 추가.

### [INFO] EmailChangeVerifyDto 토큰 MaxLength — 이미 조치됨
- 위치: `codebase/backend/src/modules/users/dto/email-change-verify.dto.ts`
- 상세: 본 diff 에서 `@MaxLength(128)` 이 추가됨(RESOLUTION INFO#2). SHA-256 hex(64자) 기준 `uuidv4()` 36자 → 해시 64자이므로 128 상한은 충분하다. 조치 완료.
- 제안: 추가 조치 불필요.

### [INFO] 토큰 소스 — UUID v4 는 암호적으로 안전하나 의도가 불명확
- 위치: `codebase/backend/src/modules/auth/auth.service.ts` — `requestEmailChange` L832, `resendEmailChange` L960: `const rawToken = uuidv4()`
- 상세: Node.js `uuid` 패키지의 `v4()` 는 내부적으로 `crypto.randomFillSync` 를 사용해 128-bit 엔트로피를 제공하므로 보안 결함은 없다. 다만 식별자 생성 목적의 API 를 보안 토큰 생성에 사용하는 것은 코드 의도를 불명확하게 만든다. 기존 `email_verify_token`, `password_reset_token` 도 동일 패턴이므로 일관성은 유지된다.
- 제안: 기존 코드베이스 패턴 일관성을 위해 현 방식 유지 수용 가능. 향후 신규 토큰 패턴 도입 시 `crypto.randomBytes(32).toString('hex')` 사용 고려.

### [INFO] 이메일 정규화 불일치 — trim/lower 불균일
- 위치: `codebase/backend/src/modules/auth/auth.service.ts` `requestEmailChange` 내 동일 여부 확인 로직 vs `emailTakenByOther` vs `update` 저장값
- 상세: 현재 이메일 동일 여부 확인에서 `newEmail.trim().toLowerCase()` 를 쓰지만 `emailTakenByOther` 는 `LOWER(u.email) = LOWER(:email)` (trim 없음)으로 비교하고, `update` 에 저장되는 값은 `newEmail` (DTO 에서 받은 원본)이다. DTO 에 `@IsEmail()` 이 있어 대부분의 공백이 필터링되지만, 이론상 선행/후행 공백 포함 이메일이 DB 에 저장될 수 있다. 실질 위험은 낮으나 일관성 결함이다.
- 제안: DTO 에 `@Transform(({ value }) => value?.trim().toLowerCase())` 추가 또는 서비스 진입 시점에 `newEmail = newEmail.trim().toLowerCase()` 명시적 정규화.

### [INFO] HTML 이메일 — verifyUrl href 미이스케이프
- 위치: `codebase/backend/src/modules/mail/mail.service.ts` — `buildEmailChangeVerificationHtml` L318, L322: `href="${verifyUrl}"`, `${verifyUrl}`
- 상세: `safeName` 은 `this.escapeHtml(name)` 처리되지만 `verifyUrl` 은 이스케이프 없이 `<a href>` 에 직접 삽입된다. `verifyUrl` 은 `${this.frontendUrl}/profile/change-email/verify?token=${encodeURIComponent(token)}` 로 구성되어, `token` 은 `uuidv4()` 출력(`encodeURIComponent` 적용)이고 `this.frontendUrl` 은 서버 환경 변수다. 사용자 입력이 URL 에 포함되지 않으므로 실질적 href 인젝션 위험은 없다. `buildEmailChangedNoticeHtml` 의 `resetUrl` 도 동일 패턴이나 마찬가지로 서버 측 상수에서 유래한다.
- 제안: 현재 구현으로 충분. 심층 방어를 원한다면 `safeVerifyUrl = encodeURI(verifyUrl)` 또는 URL 시작 allowlist 확인 추가 가능하나 즉각 수정 우선도 낮음.

### [INFO] 평문 텍스트 이메일 — name 미이스케이프 (헤더 인젝션 이론적 가능성)
- 위치: `codebase/backend/src/modules/mail/mail.service.ts` — `buildEmailChangeVerificationText` L337, `buildEmailChangedNoticeText` L408
- 상세: 텍스트 파트에서 `name` 이 이스케이프 없이 삽입된다. 텍스트 이메일에는 HTML 렌더링이 없어 XSS 위험은 없으나, `name` 에 CRLF(`\r\n`) 가 포함되면 이론상 이메일 헤더 인젝션이 가능하다. 그러나 `name` 은 DB 에 저장된 기존 값이며 가입 시 검증을 이미 통과한 값이므로 실질 위험은 극히 낮다. 또한 `MailerService` (Nodemailer 기반)가 헤더를 별도로 구성하므로 본문에 CRLF 가 있어도 헤더 인젝션으로 이어지기 어렵다.
- 제안: 가입 시 `name` 필드에 제어 문자 금지(`@Matches(/^[^\r\n\0]*$/)`) 및 최대 길이 검증이 적용되어 있는지 확인. 적용되어 있다면 조치 불필요.

### [INFO] verifyEmailChange — 로그 메시지에 oldEmail 포함
- 위치: `codebase/backend/src/modules/auth/auth.service.ts` L940-941
- 상세: `this.logger.warn('sendEmailChangedNotice to ${oldEmail} failed ...')` 에서 실제 이메일 주소가 로그에 출력된다. 운영 모니터링 목적으로 적절하나, 로그 집계 시스템이 접근 제어 없이 노출된다면 PII(개인식별정보)가 담긴 로그가 될 수 있다. Rationale 1.1.B-6 에서 "raw 이메일은 audit details 에 미저장" 원칙이 있으나 이 원칙이 로그에도 동일하게 적용되는지 불명확하다. 이메일을 `oldEmail.replace(/.+@/, '***@')` 마스킹하거나 해시 축약 형식으로 대체하는 것이 PII 관점에서 더 안전하다.
- 제안: `oldEmail` 전체 노출 대신 마스킹(예: `oldEmail.split('@').map((p, i) => i === 0 ? '***' : p).join('@')`) 적용 고려. INFO 등급 — 현 로그 시스템의 PII 접근 정책에 따라 판단.

### [INFO] verify 엔드포인트 rate-limit 미적용
- 위치: `codebase/backend/src/modules/users/users.controller.ts` — `@Post('me/email-change/verify')`
- 상세: JWT 인증 필수라 익명 브루트포스는 차단된다. 토큰이 `uuidv4()` → SHA-256 (256-bit 보안)이므로 브루트포스 성공 확률은 무시 가능하다. 인증 세션 1개당 올바른 토큰이 단 1개 존재하므로 반복 시도 실익이 없다.
- 제안: 실질 위험 없으므로 즉각 조치 불필요. 심층 방어를 원한다면 `@Throttle({ default: { ttl: 60_000, limit: 10 } })` 추가 가능.

### [INFO] 감사 로그 — 이메일 변경 이전/이후 값 미저장 (의도적)
- 위치: `codebase/backend/src/modules/users/users.controller.ts` L250-257 (`verifyEmailChange` 감사 로그 기록)
- 상세: 감사 로그 `record` 호출에 `details` 필드가 없어 변경 전후 이메일이 기록되지 않는다. Rationale 1.1.B-6 ("raw 이메일은 details 에 미저장") 의 의도적 설계다. 사후 포렌식 시 "어떤 이메일로 변경했는지" 추적이 불가능하나, 이는 설계 트레이드오프로 수용된 것이다.
- 제안: 현행 설계 유지. 규정 준수 요건에 따라 이메일 해시(SHA-256) 정도의 감사 흔적이 필요한지 spec 레벨에서 재검토 가능.

### [INFO] SQL 인젝션 — 파라미터 바인딩 확인
- 위치: `codebase/backend/src/modules/users/users.service.ts` — `emailTakenByOther`
- 상세: TypeORM `createQueryBuilder` 에서 `:email`, `:id` named parameter 를 사용해 SQL 인젝션이 방지된다. 이상 없음.
- 제안: 추가 조치 불필요.

### [INFO] 하드코딩된 시크릿 없음 확인
- 위치: 변경된 모든 파일 전체
- 상세: API 키, 비밀번호, 토큰, 인증서 등 하드코딩된 시크릿이 없다. `EMAIL_CHANGE_TTL_MS = 60 * 60 * 1000` 은 만료 시간 상수로 시크릿이 아니다. DB 연결·SMTP 설정은 ConfigService(환경 변수)에서 조회한다.
- 제안: 이상 없음.

---

## 요약

이번 변경(이메일 변경 프로세스 request → verify → resend → cancel 전체 구현)은 핵심 보안 설계를 올바르게 구현하고 있다. 구체적으로: 원본 토큰은 메일로만 전달하고 DB 에는 SHA-256 해시를 저장하는 at-rest 보호, 토큰이 사용자 세션에 바인딩되어 누출 링크 단독으로는 무용한 설계, 이메일 교체 후 전 세션 일괄 revoke, 재인증(비밀번호/TOTP) 강제, race condition 최종 가드로 DB UNIQUE 제약 활용 모두 견고하다. SQL 인젝션 방어(TypeORM 파라미터 바인딩), XSS 방어(HTML 이메일 내 사용자 이름 `escapeHtml` 처리), 하드코딩된 시크릿 부재도 확인됐다. 주요 잔여 사항은 `resend` 엔드포인트의 rate-limit 미적용(이메일 스팸 벡터)으로, 해당 엔드포인트의 `@Throttle` 적용 여부를 재확인할 필요가 있다. 그 외 이메일 정규화 불일치, 로그 내 이메일 PII 노출, `verifyUrl` href 미이스케이프는 모두 실질 위험이 낮은 INFO 등급이다. CRITICAL·WARNING 수준 보안 취약점은 발견되지 않았다.

## 위험도

LOW

STATUS=success ISSUES=10 PATH=/Volumes/project/private/clemvion/.claude/worktrees/spec-email-change-0fcba4/review/code/2026/06/21/20_21_02/security.md RESET_HINT=
