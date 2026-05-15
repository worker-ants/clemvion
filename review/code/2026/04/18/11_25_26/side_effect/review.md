## 발견사항

---

**[WARNING]** `resetUrl`이 HTML href 속성에 이스케이프 없이 삽입됨
- 위치: `mail.service.ts` — `buildPasswordResetHtml`, `href="${resetUrl}"`
- 상세: `token`은 `encodeURIComponent`로 처리되지만, `this.frontendUrl`은 HTML 이스케이프 없이 직접 보간됩니다. `frontendUrl` 설정값에 `"`가 포함될 경우 href 속성이 깨질 수 있습니다. `sendVerificationEmail`·`sendWorkspaceInvitationEmail`에서도 동일한 패턴이 존재하는 기존 이슈입니다.
- 제안: `resetUrl` 전체를 `this.escapeHtml(resetUrl)` 처리 후 href에 삽입하거나, `frontendUrl` 설정 로드 시 유효성 검증 추가

---

**[WARNING]** 토큰이 DEBUG 레벨 로그에 노출됨
- 위치: `mail.service.ts` — `this.logger.debug(\`[DEV] Password reset email for ${email}: ${resetUrl}\`)`
- 상세: `resetUrl`에 `token`이 포함되어 있어 DEBUG 로그가 활성화된 환경(스테이징 등)에서 토큰이 로그 시스템에 기록됩니다. `sendVerificationEmail`에도 동일 패턴이 있는 기존 이슈이지만, 비밀번호 재설정 토큰은 이메일 인증 토큰보다 민감도가 높습니다.
- 제안: DEBUG 로그에는 토큰 대신 `email`만 출력하고 토큰은 제외 (`[DEV] Password reset email queued for ${email}`)

---

**[INFO]** 메일 발송 실패 시 DB에 토큰이 잔류
- 위치: `auth.service.ts` — `forgotPassword` 메서드
- 상세: `usersService.update`로 DB에 토큰을 저장한 후 메일 발송이 실패하면, 사용자에게 전달되지 않은 토큰이 30분간 DB에 남습니다. 재시도 요청 시 새 토큰으로 덮어쓰이므로 보안상 문제는 없지만 의도적 설계임을 인지해야 합니다.
- 제안: 현재 설계가 anti-enumeration 패턴상 올바름. 변경 불필요.

---

**[INFO]** `buildPasswordResetText`에서 `name`이 이스케이프되지 않음
- 위치: `mail.service.ts` — `buildPasswordResetText`
- 상세: HTML 버전은 `this.escapeHtml(name)`을 사용하지만, 텍스트 버전은 `name`을 그대로 사용합니다. 평문 이메일에서는 XSS 위험이 없으므로 기능상 문제는 없으나 일관성이 결여됩니다.
- 제안: 코드 일관성을 위해 텍스트 버전도 escapeHtml 적용 고려 (필수 아님)

---

**[INFO]** 테스트에서 메일 실패 시 DB 업데이트 호출 여부를 검증하지 않음
- 위치: `auth.service.spec.ts` — `'should return the same message even if mail dispatch fails'`
- 상세: 메일 실패 시나리오 테스트가 응답 메시지와 메일 호출만 확인하고, `usersService.update`가 여전히 호출되었는지 검증하지 않습니다. 구현이 변경되어 토큰 저장을 건너뛰어도 이 테스트는 통과합니다.
- 제안: `expect(usersService.update).toHaveBeenCalled()` 단언 추가

---

## 요약

이번 변경은 TODO로 남아 있던 비밀번호 재설정 이메일 발송을 실제로 구현한 것으로, anti-enumeration 패턴(항상 동일 응답 반환, 메일 실패 무시)을 올바르게 준수하고 있습니다. 기존 `sendVerificationEmail`과 구조적으로 일관되며, XSS 방어(`escapeHtml`)와 URL 인코딩도 적용되어 있습니다. 주요 부작용 위험은 `frontendUrl`의 HTML 이스케이프 누락(기존 패턴과 동일한 이슈)과 DEBUG 로그에 토큰이 포함되는 점이며, 나머지는 테스트 커버리지 보완 수준의 경미한 사항입니다.

## 위험도

**LOW**