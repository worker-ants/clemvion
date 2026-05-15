## Architecture Code Review

### 발견사항

**[WARNING] README.md가 프로젝트 실제 내용을 반영하지 않음**
- 위치: `/Volumes/project/private/idea-workflow/backend/README.md` 전체
- 상세: NestJS 기본 boilerplate README 그대로 유지. 실제 프로젝트(no-code workflow builder)의 환경변수 설정, 모듈 구조, 실행 전제조건 등이 전혀 기술되어 있지 않음
- 제안: `CLAUDE.md` 지침에 따라 프로젝트 실제 상태 기준으로 README 갱신 필요

---

**[WARNING] MailService가 console transport일 때도 실제 메일 전송을 시도함**
- 위치: `mail.service.ts:22-33`
- 상세: `transport === 'console'` 분기에서 로그만 출력하고 `sendMail()`은 그대로 호출됨. `jsonTransport` 설정으로 실제 전송은 안 되지만, 의도가 "개발 환경에서는 메일 안 보냄"이라면 early return이 명시적으로 맞음. 현재는 동작은 맞지만 의도가 불명확하고, console 모드에서 MailerService 실패 시 예외가 발생하는 문제도 있음
- 제안:
```typescript
if (transport === 'console') {
  this.logger.log(`[DEV] Verification email for ${email}: ${verifyUrl}`);
  return; // 개발 환경에서는 실제 전송 생략
}
```

---

**[WARNING] MailService가 ConfigService에 직접 의존 — 의존성 역전 원칙(DIP) 위반 소지**
- 위치: `mail.service.ts:10-12`, `mail.module.ts:9-42`
- 상세: MailService가 transport 타입 분기 로직을 직접 갖고 있음. transport 선택 책임이 MailModule(설정 시점)과 MailService(런타임 시점) 양쪽에 분산됨. MailModule에서 이미 transport를 분기해 MailerModule을 구성하는데, MailService에서 다시 `mail.transport` 를 읽는 것은 책임이 이중화됨
- 제안: transport 분기 책임을 MailModule 설정 시점으로 일원화. MailService는 메일 발송 로직에만 집중하도록 ConfigService 의존 제거 고려 (또는 `app.frontendUrl`만 읽는 별도 주입값으로 분리)

---

**[INFO] HTML 템플릿이 서비스 코드 내 인라인으로 존재**
- 위치: `mail.service.ts:43-71`
- 상세: 현재는 이메일 종류가 하나뿐이라 허용 범위이나, 이메일 종류가 늘어나면 서비스 파일이 비대해짐. 추후 확장성 저하 우려
- 제안: 즉각 조치 불필요. 이메일 종류가 2개 이상이 될 때 템플릿 파일 분리 또는 Handlebars 템플릿 도입 검토

---

**[INFO] MailModule이 글로벌 ConfigModule을 재import**
- 위치: `mail.module.ts:8`
- 상세: AppModule에서 `ConfigModule.forRoot({ isGlobal: true })`로 등록했다면 하위 모듈에서 재import 불필요. 다만 명시성을 위해 남겨두는 경우도 있으므로 프로젝트 컨벤션에 따름
- 제안: `app.module.ts`의 ConfigModule 설정 확인 후 isGlobal이면 제거 가능

---

**[INFO] 테스트에서 private 필드 직접 접근**
- 위치: `mail.service.spec.ts:61`
- 상세: `service['logger']`로 private 필드 접근. TypeScript 캡슐화 우회
- 제안: Logger를 DI로 주입하거나, 테스트용 logger spy를 `jest.spyOn(Logger.prototype, 'log')`로 설정하는 방식 고려

---

### 요약

전반적인 모듈 설계는 NestJS 컨벤션(MailModule/MailService 분리, ConfigService 주입, forRootAsync 팩토리 패턴)을 잘 따르고 있으며 단순하고 명확한 구조다. 주요 아키텍처 우려는 **transport 분기 로직이 MailModule(설정)과 MailService(런타임) 양쪽에 이중으로 존재**하는 책임 분산 문제이며, console 모드에서 early return 없이 `sendMail()`을 호출하는 동작 모호성이 잠재적 버그로 이어질 수 있다. README는 boilerplate 상태로 CLAUDE.md 지침 위반이므로 갱신이 필요하다.

### 위험도

**LOW**