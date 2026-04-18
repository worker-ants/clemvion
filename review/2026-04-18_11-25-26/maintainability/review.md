### 발견사항

---

**[WARNING] `mail.service.ts` — `send*Email` 메서드 코드 중복**
- 위치: `sendVerificationEmail`, `sendPasswordResetEmail`, `sendWorkspaceInvitationEmail`
- 상세: 세 메서드가 debug 로그 → try/catch → `sendMail` 호출 → 성공 로그 → 에러 로그 후 re-throw 구조를 동일하게 반복하고 있음. 향후 이메일 유형 추가 시 누락 위험이 있음.
- 제안: 공통 dispatch 헬퍼 추출

```typescript
private async dispatch(to: string, options: SendMailOptions): Promise<void> {
  try {
    await this.mailerService.sendMail({ to, ...options });
    this.logger.log(`Email sent to ${to}: ${options.subject}`);
  } catch (error) {
    this.logger.error(`Failed to send email to ${to}`, error instanceof Error ? error.stack : String(error));
    throw error;
  }
}
```

---

**[WARNING] `mail.service.ts` — HTML 템플릿 구조 중복**
- 위치: `buildVerificationHtml`, `buildPasswordResetHtml`, `buildInvitationHtml`
- 상세: 외곽 테이블 레이아웃과 헤더(`<h1>Idea Workflow</h1>`) 구조가 세 곳에 동일하게 반복됨. 브랜드명, 스타일, 레이아웃 변경 시 세 곳을 모두 수정해야 함.
- 제안: `buildEmailWrapper(content: string): string` 공통 래퍼 추출

---

**[WARNING] `mail.service.ts` — 주석 처리된 코드 잔존 (기존 코드)**
- 위치: `sendVerificationEmail` 내 주석 블록 (이번 변경 외 기존 코드)
- 상세: `MAIL_TRANSPORT_CONSOLE` 분기 처리 코드가 주석으로 남아 있음. 이번 `sendPasswordResetEmail`은 동일 패턴을 주석 없이 작성하여 두 메서드 간 일관성이 깨짐.
- 제안: 주석 처리된 코드 제거 또는 일관되게 복원

---

**[WARNING] `auth.service.spec.ts` — 취약한 mock 호출 인수 추출**
- 위치: `forgotPassword` > `should send reset email...` 테스트, L340-345
- 상세: `usersService.update.mock.calls[0] ?? []` 로 첫 번째 호출을 가져오는데, `update`가 이미 다른 테스트에서 호출된 경우나 향후 내부 구현이 변경되어 순서가 바뀌면 silently 잘못된 값을 참조할 수 있음. `?? []` 폴백 후 `updateArgs[1]`이 `undefined`가 되어도 명시적 실패 없이 통과할 위험이 있음.
- 제안:

```typescript
expect(usersService.update).toHaveBeenCalledTimes(1);
const [, updatePayload] = usersService.update.mock.calls[0];
const savedToken = (updatePayload as { passwordResetToken: string }).passwordResetToken;
```

---

**[INFO] `mail.service.ts` — `[DEV]` 접두사를 가진 debug 로그**
- 위치: `sendPasswordResetEmail` L5, 기존 `sendVerificationEmail`도 동일
- 상세: `logger.debug`는 이미 개발 환경에서만 출력되므로 `[DEV]` 접두사가 중복된 표시임. 일관성은 있으나 불필요한 노이즈.
- 제안: `this.logger.debug(\`Password reset URL for ${email}: ${resetUrl}\`)` 로 단순화

---

**[INFO] `mail.service.spec.ts` — 테스트 구조 중복**
- 위치: `sendVerificationEmail` describe, `sendPasswordResetEmail` describe
- 상세: XSS 방어, URL 인코딩, 전송 실패, console transport 케이스가 거의 동일한 구조로 반복됨. 허용 가능한 수준이나, 향후 이메일 유형이 늘어날수록 유지비용이 증가함.
- 제안: 공통 케이스를 `testEmailMethod(sendFn, urlPath, subject)` 형태의 shared behavior 헬퍼로 추출 고려

---

### 요약

이번 변경은 `TODO` 상태였던 비밀번호 재설정 이메일 발송을 완성하며, 보안 요구사항(이메일 열거 방지를 위한 에러 삼킴)과 XSS/URL 인코딩 방어가 올바르게 구현되었고 테스트 커버리지도 충분합니다. 다만 `mail.service.ts`는 세 개의 `send*Email` 메서드와 HTML 빌더 함수가 거의 동일한 구조를 반복하고 있어, 추가 이메일 유형이 생길수록 유지보수 비용이 선형 증가합니다. 공통 dispatch 헬퍼와 HTML 래퍼 추출로 이 문제를 선제적으로 해결하는 것을 권장합니다. `auth.service.spec.ts`의 mock 호출 추출 방식도 순서 의존성 제거를 위해 보강이 필요합니다.

### 위험도

**LOW**