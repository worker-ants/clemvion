# 보안(Security) 리뷰 결과

## 발견사항

### [INFO] resend 엔드포인트에 rate-limit 없음 — 이메일 플러드 벡터
- 위치: `codebase/backend/src/modules/users/users.controller.ts` — `@Post('me/email-change/resend')`
- 상세: `requestEmailChange` 엔드포인트는 `@Throttle({ default: { ttl: 60_000, limit: 5 } })` 가 적용돼 있으나, `resendEmailChange` 에는 throttle 데코레이터가 없다. 인증된 세션을 가진 공격자가 반복 요청으로 메일 서버에 스팸을 발생시킬 수 있다(동일 수신자 주소로 반복 발송).
- 제안: `@Post('me/email-change/resend')` 에도 `@Throttle({ default: { ttl: 60_000, limit: 3 } })` 수준의 제한을 추가한다.

### [INFO] 토큰 소스 — UUID v4 는 CSPRNG 이나 전용 토큰 생성기와 명명 혼동 가능
- 위치: `codebase/backend/src/modules/auth/auth.service.ts` — `requestEmailChange` L142, `resendEmailChange` L247: `const rawToken = uuidv4()`
- 상세: `uuidv4()` 는 내부적으로 crypto 의 안전한 난수를 사용하므로 128-bit 엔트로피를 제공하며, SHA-256 해시를 통해 DB 에 저장하는 기존 패턴(`email_verify_token`, `password_reset_token`)과 동일하다. 보안 결함은 아니지만, `uuidv4` 는 식별자 생성 목적의 함수이므로 `randomBytes(32).toString('hex')` 같은 명시적 보안 토큰 API를 사용하면 코드의 의도가 더 명확해진다.
- 제안: 기존 패턴이 이미 다른 토큰(email_verify_token 등)에서도 `uuidv4` 를 사용하고 있어 일관성 유지를 위해 현 방식 유지는 수용 가능하다. 향후 신규 토큰 패턴 도입 시 `crypto.randomBytes` 사용을 고려한다.

### [INFO] 이메일 주소 정규화 범위 — 대소문자 외 공백 trim 불일치
- 위치: `codebase/backend/src/modules/auth/auth.service.ts` — `requestEmailChange` L128: `newEmail.trim().toLowerCase()` vs DB 중복 검사 `emailTakenByOther`
- 상세: `requestEmailChange` 의 현재 이메일 동일 여부 확인 시에는 `newEmail.trim().toLowerCase()` 를 사용하지만, `usersService.emailTakenByOther` 는 `LOWER(u.email) = LOWER(:email)` 로 trim 없이 비교하고, 이후 `update` 에 저장되는 값은 `newEmail` (trim 전)이다. DTO 에서 `@IsEmail()` 을 사용하므로 대부분의 공백이 걸러지지만, 이론상 선행/후행 공백 포함 이메일이 DB 에 저장될 수 있어 이메일 일관성이 깨진다.
- 제안: 서비스 진입 시점에 `newEmail = newEmail.trim().toLowerCase()` 정규화를 명시적으로 적용하거나, DTO 에 `@Transform(({ value }) => value?.trim().toLowerCase())` 를 추가한다.

### [INFO] 구 이메일 통지 실패 시 로그 억제 — 보안 이벤트 소실 위험
- 위치: `codebase/backend/src/modules/auth/auth.service.ts` — `verifyEmailChange` L229: `catch { /* MailService 가 자체 로깅 */ }`
- 상세: "best-effort" 설계 의도는 명확하고 코드 주석도 적절하다. 다만 MailService 내부 catch 에서 `error.stack` 을 이미 로깅하므로 이 catch 는 빈 블록 형태로 남는다. `sendEmailChangedNotice` 실패 시 이메일 변경이 이미 완료된 상태이므로 공격자가 구 이메일 주소 통지를 방해하더라도(SMTP 오류 유발 등) 계정이 영구적으로 변경된다. 이는 설계상 의도된 트레이드오프이나, 실패 통지를 별도 이벤트(예: 모니터링 알림)로 surfacing 하지 않으면 보안 이상 감지가 지연될 수 있다.
- 제안: 현재 구현은 spec 설계를 올바르게 따르고 있다. 가능하면 통지 실패를 별도 메트릭이나 경보로 집계해 이상 패턴 감지를 강화하는 것을 권장한다.

### [INFO] HTML 이메일 템플릿 — verifyUrl XSS 미이스케이프
- 위치: `codebase/backend/src/modules/mail/mail.service.ts` — `buildEmailChangeVerificationHtml` L395: `<a href="${verifyUrl}"` 및 L399: `${verifyUrl}`
- 상세: `name` 은 `this.escapeHtml(name)` 처리되지만 `verifyUrl` 은 이스케이프 없이 직접 HTML 에 삽입된다. `verifyUrl` 은 `${this.frontendUrl}/profile/change-email/verify?token=${encodeURIComponent(token)}` 로 구성되는데, `token` 은 `uuidv4()` 출력이라 위험 문자가 없고 `encodeURIComponent` 도 적용되어 있다. `this.frontendUrl` 은 환경 변수에서 유래하는 서버 측 값이므로 사용자 입력이 아니다. 따라서 현재 코드에서 실질적 XSS 위험은 없으나, 방어 깊이 측면에서 `verifyUrl` 에도 href 인젝션 방어(URL allowlist 또는 `encodeURI` 래핑)를 추가하면 더 견고해진다.
- 제안: 실질 위험이 낮으므로 즉각 수정 불필요. `buildEmailChangedNoticeHtml` 의 `resetUrl` 역시 동일한 패턴이다. `frontendUrl` 이 신뢰 서버 설정이고 경로가 하드코딩된 상수라면 현 구현으로 충분하다.

### [INFO] 평문 텍스트 이메일 본문 — 이름 미이스케이프
- 위치: `codebase/backend/src/modules/mail/mail.service.ts` — `buildEmailChangeVerificationText` L413: `` `안녕하세요, ${name}님!` `` 및 `buildEmailChangedNoticeText` L484, `buildEmailChangedNoticeText` L485: `${newEmail}`
- 상세: 일반 텍스트(text) 이메일 파트에서 `name`, `newEmail` 이 이스케이프 없이 삽입된다. 텍스트 이메일은 HTML 렌더링이 없어 XSS 위험은 없지만, 이름에 개행 문자가 포함되면 이메일 헤더 인젝션 위험이 이론적으로 존재한다. 다만 이름은 이미 DB에 저장된 값이고 가입 시 검증을 통과한 값이므로 실질 위험은 매우 낮다.
- 제안: 허용 범위이나, 이름 필드에 대한 입력 검증(최대 길이, 제어 문자 금지)이 가입 로직에 존재하는지 확인한다.

### [INFO] verify 엔드포인트에 rate-limit 미적용
- 위치: `codebase/backend/src/modules/users/users.controller.ts` — `@Post('me/email-change/verify')`
- 상세: `verify` 엔드포인트는 JWT 인증 필수이므로 익명 브루트포스는 불가능하다. 그러나 탈취된 세션을 가진 공격자가 토큰을 반복 시도할 수 있다. 토큰이 `uuidv4()` 의 SHA-256 이므로 브루트포스 가능성은 사실상 없으나, 인증된 사용자 세션 자체가 이미 1개의 올바른 토큰만 존재하므로 rate-limit 없이도 실질 위험은 낮다.
- 제안: 낮은 위험으로 즉각 수정 불필요. 심층 방어를 위해 `@Throttle({ default: { ttl: 60_000, limit: 10 } })` 추가 가능.

### [INFO] EmailChangeVerifyDto — 토큰 최대 길이 미지정
- 위치: `codebase/backend/src/modules/users/dto/email-change-verify.dto.ts` — `token` 필드: `@IsString() @MinLength(1)` 만 지정
- 상세: 최소 길이(1)만 지정하고 최대 길이가 없다. 악의적 요청이 매우 긴 문자열을 전송하면 DB 쿼리 처리 전에 `hashToken`(SHA-256) 연산에 큰 문자열이 입력된다. `uuidv4()` 출력은 36자이므로 합리적인 상한 검증이 가능하다.
- 제안: `@MaxLength(128)` 또는 `@MaxLength(512)` 를 추가해 의도치 않은 대용량 입력을 거부한다.

---

## 요약

이 변경 세트는 이메일 변경 프로세스의 핵심 보안 설계(SHA-256 토큰 at-rest 저장, 사용자-토큰 바인딩 검증, 인증 후 전 세션 revoke, 재인증 강제, race condition 방지를 위한 DB UNIQUE 제약 최종 가드)를 올바르게 구현하고 있다. SQL 인젝션 취약점은 없으며(TypeORM 파라미터 바인딩 사용), 하드코딩된 시크릿은 없고, HTML 이메일의 사용자 이름은 `escapeHtml` 처리되어 있다. 주요 관찰 사항은 `resend` 엔드포인트의 rate-limit 누락(이메일 발송 남용 가능)과 `EmailChangeVerifyDto` 의 토큰 최대 길이 미지정으로, 두 사항 모두 INFO 등급이다. Critical 또는 Warning 수준의 취약점은 발견되지 않았다.

## 위험도

LOW

STATUS: SUCCESS
