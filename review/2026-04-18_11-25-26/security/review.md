## 보안 코드 리뷰 결과

---

### 발견사항

---

**[WARNING] 비밀번호 재설정 토큰이 DB에 평문으로 저장됨**
- 위치: `auth.service.ts` — `forgotPassword()` 메서드
- 상세: `resetToken = uuidv4()`를 DB에 그대로 저장합니다. 같은 파일의 리프레시 토큰은 `hashToken(rawRefreshToken)`으로 SHA-256 해시 후 저장하는 반면, 리셋 토큰에는 동일한 패턴이 적용되지 않았습니다. DB가 침해될 경우 유효 기간 내 모든 리셋 토큰을 즉시 계정 탈취에 사용할 수 있습니다.
- 제안: 리프레시 토큰과 동일하게 `this.hashToken(resetToken)`을 DB에 저장하고, `findUserByResetToken`도 입력값을 해시한 뒤 조회하도록 수정하세요.

```typescript
// 수정 전
await this.usersService.update(user.id, {
  passwordResetToken: resetToken,
  ...
});

// 수정 후
const resetTokenHash = this.hashToken(resetToken);
await this.usersService.update(user.id, {
  passwordResetToken: resetTokenHash,
  ...
});
// 이메일엔 원본 resetToken 전달
```

---

**[WARNING] 디버그 로그에 리셋 토큰 포함 URL 노출**
- 위치: `mail.service.ts` — `sendPasswordResetEmail()` 6번째 줄
- 상세: `this.logger.debug(`[DEV] Password reset email for ${email}: ${resetUrl}`)` 는 완전한 리셋 URL(토큰 포함)을 로그에 기록합니다. `[DEV]` 레이블이 붙어 있지만 프로덕션에서도 실행됩니다. 로그 집계 시스템이 적절히 보호되지 않으면 토큰이 노출될 수 있습니다. `sendVerificationEmail`도 동일한 패턴을 가지고 있습니다.
- 제안: 프로덕션 환경에서는 토큰을 포함한 URL 대신 이메일 주소만 로깅하거나, `transport === MAIL_TRANSPORT_CONSOLE` 조건으로 분기하세요.

```typescript
// 수정 예시
if (this.transport === MAIL_TRANSPORT_CONSOLE) {
  this.logger.debug(`[DEV] Password reset email for ${email}: ${resetUrl}`);
} else {
  this.logger.debug(`Password reset email requested for ${email}`);
}
```

---

**[INFO] `forgotPassword`의 타이밍 차이로 인한 이메일 열거 가능성**
- 위치: `auth.service.ts` — `forgotPassword()` 전체
- 상세: 사용자가 존재할 때는 `update()` + `sendPasswordResetEmail()`을 await하고, 존재하지 않을 때는 즉시 반환합니다. 응답 메시지는 동일하지만 응답 시간 차이로 이메일 존재 여부를 추측할 수 있습니다. 현재 구조에서의 실질적 위험도는 낮으나(네트워크 지터가 완충), 고보안 요구사항 환경에서는 의미있는 취약점입니다.
- 제안: 두 경로 모두 동일한 시간이 소요되도록 `user`가 없을 때도 같은 지연을 인위적으로 추가하거나, 큐 기반 비동기 메일 발송으로 전환하세요.

---

**[INFO] HTML 이메일 템플릿에서 `resetUrl`이 HTML 이스케이프 없이 삽입됨**
- 위치: `mail.service.ts` — `buildPasswordResetHtml()` 내 `href` 속성 및 텍스트 노드
- 상세: `safeName`은 `escapeHtml()`로 처리되지만, `resetUrl`은 HTML 이스케이프 없이 `href="${resetUrl}"` 및 `${resetUrl}` 위치에 삽입됩니다. `frontendUrl`이 설정값에서 오고 토큰은 `encodeURIComponent`로 처리되므로 현실적 위험도는 낮으나, 방어적 설계 원칙에 위배됩니다.
- 제안: `href` 삽입 전 `escapeHtml(resetUrl)` 적용으로 심층 방어를 구현하세요.

---

**[INFO] 평문 텍스트 이메일에서 `name` 이스케이프 누락 (일관성 문제)**
- 위치: `mail.service.ts` — `buildPasswordResetText()`, `buildVerificationText()`
- 상세: HTML 버전은 `escapeHtml(name)`을 사용하지만, 평문 텍스트 버전은 `name`을 그대로 사용합니다. 평문에서 XSS 위험은 없으나, 이름에 개행 문자(`\n`)가 포함될 경우 이메일 헤더 인젝션의 잠재적 벡터가 될 수 있습니다 (메일러 라이브러리 처리에 따라 다름).
- 제안: 텍스트 버전에서도 최소한 개행 문자를 제거하는 sanitization을 적용하세요.

---

### 요약

이번 변경은 기존에 `TODO + console.log`로 방치되었던 비밀번호 재설정 메일 발송 기능을 실제로 구현하고, 이메일 열거 방지를 위해 메일 발송 실패를 삼키는 올바른 패턴을 적용했습니다. XSS 방지를 위한 HTML 이스케이프와 토큰 URL 인코딩도 적절히 구현되어 있습니다. 그러나 **가장 중요한 보안 결함은 리셋 토큰이 평문으로 DB에 저장된다는 점**으로, 같은 파일 내 리프레시 토큰 구현(해시 후 저장)과 불일치합니다. DB 침해 시 유효한 리셋 토큰으로 즉시 계정 탈취가 가능하므로 수정이 필요합니다. 추가로 토큰이 포함된 URL이 모든 환경의 디버그 로그에 기록되는 점도 보완이 필요합니다.

---

### 위험도

**MEDIUM**