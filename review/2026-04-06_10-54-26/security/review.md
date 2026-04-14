## 보안 코드 리뷰 결과

---

### 발견사항

**[WARNING] HTML 이메일의 XSS 취약점 가능성 — `name` 파라미터 미처리**
- 위치: `mail.service.ts` — `buildVerificationHtml()`, 내 `${name}` 보간
- 상세: `name` 값은 DB에서 읽어오지만, 사용자가 등록 시 입력한 문자열입니다. `<script>`, `<img onerror=...>` 등의 HTML 특수문자가 이스케이프 없이 직접 HTML 템플릿에 삽입되므로, 이메일 클라이언트가 HTML을 렌더링할 때 XSS 위험이 존재합니다.
- 제안: `name`을 HTML 이메일에 삽입하기 전 HTML 엔티티로 이스케이프하세요.
  ```ts
  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }
  // 사용: ${this.escapeHtml(name)}
  ```

---

**[WARNING] `verifyUrl` URL 검증 누락 — Open Redirect / URL Injection**
- 위치: `mail.service.ts` — `sendVerificationEmail()` L18
- 상세: `frontendUrl`이 환경변수에서 주입되므로 직접 제어하지만, 만약 `token` 값에 URL 파라미터 조작 문자(`&`, `=`, 개행 등)가 포함될 경우 헤더 인젝션이나 파라미터 오염이 발생할 수 있습니다. 이메일 본문에서 클릭 시 의도하지 않은 URL로 이동할 수 있습니다.
- 제안: token은 생성 시점에 `crypto.randomBytes`로 URL-safe한 값을 보장하고, 여기서도 `encodeURIComponent(token)`을 적용하세요.
  ```ts
  const verifyUrl = `${frontendUrl}/auth/verify-email?token=${encodeURIComponent(token)}`;
  ```

---

**[WARNING] 개발 모드에서 인증 토큰이 로그에 평문 노출**
- 위치: `mail.service.ts` — L24
- 상세: `transport === 'console'`일 때 `verifyUrl` 전체 (토큰 포함)를 Logger로 출력합니다. 개발 환경에서는 허용될 수 있으나, 로그 집계 시스템(ELK, Datadog 등)을 사용할 경우 인증 토큰이 외부로 유출될 수 있습니다.
- 제안: 토큰은 앞 8자만 마스킹하여 출력하거나, 로그 레벨을 `debug`로 낮추고 운영 환경에서는 억제되도록 구성하세요.
  ```ts
  this.logger.debug(`[DEV] Verification email for ${email}: ${verifyUrl}`);
  ```

---

**[INFO] `MAIL_PORT` 환경변수 미검증 — NaN 주입 가능성**
- 위치: `mail.config.ts` — L6
- 상세: `parseInt(process.env.MAIL_PORT || '587', 10)`은 비-숫자 문자열이 입력되면 `NaN`을 반환하며, 이는 Nodemailer 설정 시 예기치 않은 동작을 유발할 수 있습니다.
- 제안: 포트 값 유효성 검증을 추가하세요.
  ```ts
  port: (() => {
    const p = parseInt(process.env.MAIL_PORT || '587', 10);
    return Number.isFinite(p) && p > 0 && p < 65536 ? p : 587;
  })(),
  ```

---

**[INFO] README.md에 CircleCI 토큰 패턴 포함**
- 위치: `README.md` — L6
- 상세: `token=abc123def456`는 NestJS 공식 스타터 README의 예시 값이지만, 실제 토큰과 구분이 어렵습니다. 비밀 스캐너(GitGuardian, truffleHog 등)가 오탐할 수 있고, 팀원이 실제 토큰으로 오인할 수 있습니다.
- 제안: README를 프로젝트 실제 내용으로 교체하거나, 이 라인을 제거하세요 (이미 `CLAUDE.md`에 README 업데이트 지침이 있음).

---

### 요약

전반적으로 환경변수 기반 설정 분리, try-catch 에러 처리, dev/prod 전송 분기 등 기본적인 보안 관행이 지켜져 있습니다. 그러나 HTML 이메일 본문에서 사용자 입력(`name`)을 이스케이프 없이 삽입하는 XSS 취약점과, 인증 토큰이 로그에 평문으로 노출되는 문제가 주요 개선 대상입니다. token을 URL에 삽입할 때 `encodeURIComponent`를 적용하지 않은 점도 수정이 필요합니다.

---

### 위험도

**MEDIUM**