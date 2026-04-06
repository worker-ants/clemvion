## Testing Code Review

### 발견사항

**[INFO]** README.md는 NestJS 기본 템플릿 그대로임 — 프로젝트 실제 내용 미반영
- 위치: README.md 전체
- 상세: 테스트 명령어(`npm run test`)는 있으나, 실제 프로젝트의 환경변수(`MAIL_*`), 의존성, 설정 방법이 없어 개발자가 테스트 환경을 구축하기 어려움
- 제안: 테스트 관점과는 직접 관련 없으나, CLAUDE.md 지침에 따라 스펙 기반으로 README 업데이트 필요

---

**[WARNING]** `MailModule` 자체에 대한 테스트 없음
- 위치: `mail.module.ts`
- 상세: `useFactory` 내 분기 로직(`transport === 'console'` vs SMTP)이 테스트되지 않음. 잘못된 설정값이 런타임에 MailerModule 초기화 실패를 일으킬 수 있음
- 제안: Module 통합 테스트 또는 `useFactory` 함수 단위 추출 후 테스트 추가:
  ```typescript
  // mail.module.spec.ts
  it('should configure jsonTransport when transport is console', async () => { ... })
  it('should configure SMTP transport when transport is smtp', async () => { ... })
  ```

---

**[WARNING]** `buildVerificationHtml` / `buildVerificationText` private 메서드 커버리지 간접 확인만 됨
- 위치: `mail.service.spec.ts` → `sendVerificationEmail` 테스트
- 상세: HTML에 `name`, `verifyUrl`이 포함되는지는 확인하지만, HTML 구조의 핵심 요소(버튼 링크 `<a href>`, 텍스트 fallback URL 등)는 검증하지 않음. XSS 취약 가능성 있는 `name` 파라미터의 특수문자 처리도 미검증
- 제안:
  ```typescript
  it('should include verify link in html anchor tag', async () => {
    await service.sendVerificationEmail('a@b.com', 'User', 'tok');
    const html = mailerService.sendMail.mock.calls[0][0].html;
    expect(html).toContain(`href="${verifyUrl}"`);
  });

  it('should handle special characters in name safely', async () => {
    await service.sendVerificationEmail('a@b.com', '<script>alert(1)</script>', 'tok');
    const html = mailerService.sendMail.mock.calls[0][0].html;
    expect(html).not.toContain('<script>alert(1)</script>');
  });
  ```

---

**[WARNING]** `name` 파라미터가 HTML에 이스케이프 없이 삽입됨 (테스트 미검증 + 실제 취약점)
- 위치: `mail.service.ts:47` — `${name}님!`
- 상세: `name`이 DB에서 오는 사용자 입력이라면 `<script>` 등이 HTML에 그대로 삽입됨. 현재 테스트에서 이 케이스를 검증하지 않아 취약점이 드러나지 않음
- 제안: HTML 이스케이프 함수 적용 및 테스트 추가 필수

---

**[INFO]** `sendVerificationEmail` - `console` transport일 때 `sendMail`도 호출되는지 테스트 없음
- 위치: `mail.service.spec.ts` → `'should log dev URL when transport is console'`
- 상세: console transport 분기에서 `logger.log` 호출은 검증하지만, 이후 `sendMail`이 여전히 호출되는지(현재 코드는 호출함)는 assertion 없음
- 제안:
  ```typescript
  expect(mailerService.sendMail).toHaveBeenCalledTimes(1);
  ```

---

**[INFO]** `mail.config.ts` 테스트 없음
- 위치: `mail.config.ts`
- 상세: `registerAs` factory 함수의 환경변수 파싱 로직(`parseInt`, boolean 변환)에 대한 단위 테스트 부재. 특히 `MAIL_PORT`에 숫자가 아닌 값이 들어올 경우 `NaN` 반환
- 제안:
  ```typescript
  it('should parse MAIL_PORT as integer', () => {
    process.env.MAIL_PORT = '465';
    const config = mailConfig();
    expect(config.port).toBe(465);
  });
  it('should default port to 587 when MAIL_PORT is unset', () => { ... });
  ```

---

**[INFO]** Mock의 `ConfigService.get` 반환 타입이 `string`으로 고정
- 위치: `mail.service.spec.ts:23-31`
- 상세: `Record<string, string>`으로 타입이 고정되어 있어, `mail.port`(number), `mail.secure`(boolean) 같은 키를 조회하는 경우를 실제와 다르게 모킹할 가능성 있음. 현재 `MailService`는 해당 키를 직접 사용하지 않아 문제없으나, 향후 변경 시 오탐 유발 가능
- 제안: `Record<string, unknown>`으로 변경

---

### 요약

`MailService`의 핵심 시나리오(SMTP 성공, SMTP 실패, console transport 로깅)는 잘 커버되어 있으며 테스트 격리와 가독성도 양호합니다. 그러나 `name` 파라미터의 HTML 미이스케이프 문제가 테스트에서 검증되지 않아 XSS 취약점이 실제 코드에 존재하고 있으며, `MailModule`의 transport 분기 로직과 `mail.config.ts`의 환경변수 파싱에 대한 테스트가 부재합니다. HTML 이스케이프 처리 및 관련 테스트 추가가 가장 시급합니다.

### 위험도

**MEDIUM** — XSS 취약 가능성(name 미이스케이프)이 테스트로 발견되지 않는 상태이므로, 실제 보안 이슈로 이어질 수 있음