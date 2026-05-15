## Architecture Code Review

### 발견사항

---

**[WARNING] 비밀번호 재설정 토큰이 평문으로 저장됨 — 보안 아키텍처 일관성 위반**
- 위치: `auth.service.ts` → `forgotPassword()` (resetToken 생성 후 `usersService.update` 호출)
- 상세: `RefreshToken`은 SHA-256 해시로 저장하는 반면(`hashToken()`), `passwordResetToken`은 raw UUID를 DB에 직접 저장한다. 두 토큰 모두 "소지자에게 권한을 부여하는 일회성 자격증명"이지만, 보안 계층 처리가 불일치한다. DB 유출 시 30분의 유효 창(window)에서 토큰이 즉시 사용 가능하다.
- 제안: `findUserByResetToken`에서 hashed token으로 조회하도록 수정하고, 저장 시 `createHash('sha256').update(resetToken).digest('hex')`를 적용할 것. `emailVerifyToken`도 동일한 이슈가 있으므로 같이 처리 필요.

---

**[WARNING] `AuthService`가 서비스 레이어를 우회하여 Repository에 직접 접근**
- 위치: `auth.service.ts` → `findUserByResetToken()`, `findUserByVerifyToken()`
- 상세: `refreshTokenRepository.manager.getRepository(User)`를 통해 `UsersService`를 거치지 않고 `User` 엔티티를 직접 조회한다. 이는 서비스 레이어 추상화를 깨뜨리며, `UsersService`의 캡슐화 원칙에 위반된다. 이번 변경과 직접적으로 연관된 `findUserByResetToken`이 이 패턴을 사용한다.
- 제안: `UsersService`에 `findByResetToken(token: string): Promise<User | null>` 및 `findByVerifyToken(token: string): Promise<User | null>` 메서드를 추가하고 `AuthService`는 이를 호출하도록 위임 구조를 복원할 것.

---

**[INFO] `MailService`에 인터페이스 추상화 부재**
- 위치: `auth.service.ts` 생성자 — `MailService` 직접 주입
- 상세: `AuthService`가 구체 클래스인 `MailService`에 직접 의존한다. 현재 테스트에서는 `jest.fn()`으로 목킹되어 문제없지만, DIP(의존성 역전 원칙) 관점에서는 `IMailService` 인터페이스를 통해 의존해야 한다. 새로운 메서드(`sendPasswordResetEmail`)가 추가되면서 이 의존 계약이 암묵적으로 확장된다.
- 제안: `IMailService` 인터페이스를 정의하고 NestJS의 커스텀 토큰(`@Inject(MAIL_SERVICE)`)으로 주입하거나, 최소한 타입 시그니처를 interface로 분리할 것.

---

**[INFO] HTML 이메일 템플릿의 인라인 문자열 하드코딩 — 확장성 제약**
- 위치: `mail.service.ts` → `buildPasswordResetHtml()`, `buildVerificationHtml()`, `buildInvitationHtml()`
- 상세: 세 가지 이메일 유형 모두 동일한 레이아웃 구조(outer table → inner table → content)를 반복한다. 새 이메일 유형이 추가될 때마다 `MailService` 클래스 자체를 수정해야 하므로 OCP 위반이다. 또한 디자이너나 기획자가 템플릿을 수정하려면 TypeScript 코드를 직접 편집해야 한다.
- 제안: `@nestjs-modules/mailer`가 Handlebars/Pug 템플릿을 지원하므로 `.hbs` 파일로 분리하거나, 최소한 공통 레이아웃 래퍼 메서드(`buildEmailLayout(content: string): string`)를 추출하여 중복을 제거할 것.

---

**[INFO] `buildPasswordResetText`에서 `name` 이스케이프 누락 — 기존 패턴과의 불일치**
- 위치: `mail.service.ts` → `buildPasswordResetText()` (L230 부근)
- 상세: HTML 빌더는 `escapeHtml(name)`을 사용하나 텍스트 빌더는 raw `name`을 사용한다. 평문 텍스트에서 XSS 위험은 없지만, 이름에 `\n`이 포함될 경우 메일 본문 구조가 의도치 않게 변경될 수 있다(newline injection). `buildVerificationText`, `buildInvitationText`도 동일 패턴이다.
- 제안: 최소한 `name.replace(/[\r\n]/g, '')` 정도의 newline sanitization을 적용하고, 팀 내 텍스트 이스케이프 정책을 명시적으로 문서화할 것.

---

### 요약

이번 변경은 `forgotPassword`의 TODO를 실제 메일 발송으로 완성하는 기능적으로 올바른 구현이며, 이메일 열거 공격 방지를 위한 에러 스왈로잉 패턴도 명확하게 설계되었다. 테스트 커버리지(mail failure resilience, XSS escaping, URL encoding)도 충실하다. 그러나 아키텍처 관점에서는 두 가지 구조적 문제가 존재한다: `passwordResetToken`이 평문으로 저장되어 `RefreshToken`의 해시 저장 전략과 불일치하며, `AuthService`가 `UsersService` 레이어를 우회하여 리포지토리에 직접 접근하는 패턴이 서비스 캡슐화를 약화시킨다. 이 두 문제는 신규 코드에서 직접 발현되는 사항으로 조기에 정비하는 것이 바람직하다.

### 위험도

**MEDIUM**