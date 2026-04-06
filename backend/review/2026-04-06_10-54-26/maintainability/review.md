## 유지보수성 코드 리뷰

### 발견사항

---

**파일 1: README.md**

- **[WARNING]** 프로젝트와 무관한 NestJS 기본 README 내용
  - 위치: 전체 파일
  - 상세: `CLAUDE.md`에 따르면 README는 "프로젝트의 제품 설명과 실행 방법"을 기술해야 하며, "spec을 참고하여 다시 정리"해야 함. 현재 내용은 NestJS 스타터 템플릿 그대로이며, 이 프로젝트(idea-workflow)에 맞는 설명, 환경변수, 아키텍처 안내 등이 없음.
  - 제안: 프로젝트 고유의 내용(환경 설정, API 엔드포인트, 메일 설정 방법 등)으로 교체

---

**파일 2: mail.config.ts**

- **[WARNING]** 매직 스트링 `'console'` 분산 사용
  - 위치: `transport: process.env.MAIL_TRANSPORT || 'console'`
  - 상세: `'console'`이라는 transport 타입 문자열이 `mail.config.ts`, `mail.module.ts`, `mail.service.ts`, `mail.service.spec.ts` 총 4곳에 하드코딩되어 있음. 값이 변경되면 모두 수정해야 함.
  - 제안: 상수 파일 또는 enum으로 추출
  ```ts
  // mail.constants.ts
  export const MAIL_TRANSPORT = { CONSOLE: 'console', SMTP: 'smtp' } as const;
  ```

- **[INFO]** 빈 문자열 기본값은 유효하지 않은 설정
  - 위치: `host: process.env.MAIL_HOST || ''`, `user: process.env.MAIL_USER || ''`, `pass: process.env.MAIL_PASS || ''`
  - 상세: SMTP transport 사용 시 이 값들이 빈 문자열이면 런타임에 인증 오류 발생. 개발 환경 기본값과 프로덕션 필수값이 구분되지 않음.
  - 제안: transport가 `smtp`인 경우 필수값 검증 추가 고려

---

**파일 3: mail.module.ts**

- **[WARNING]** 중복된 `defaults.from` 설정
  - 위치: `console` 분기와 SMTP 분기 각각의 `defaults: { from: ... }`
  - 상세: 두 분기 모두 동일한 `defaults.from` 설정을 반복함. DRY 원칙 위반.
  - 제안:
  ```ts
  const defaults = { from: configService.get<string>('mail.from') };
  
  if (transport === 'console') {
    return { transport: { jsonTransport: true }, defaults };
  }
  return { transport: { ... }, defaults };
  ```

- **[INFO]** `'console'` 매직 스트링 (위 파일 2와 동일 이슈)
  - 위치: `if (transport === 'console')`

---

**파일 4: mail.service.spec.ts**

- **[WARNING]** `service['logger']`로 private 접근
  - 위치: `jest.spyOn(service['logger'], 'log')`
  - 상세: 브래킷 표기법으로 private 멤버에 접근하는 것은 TypeScript의 접근 제어를 우회하며, 내부 구현 세부사항에 의존하는 취약한 테스트임. 리팩토링 시 테스트 깨짐.
  - 제안: `Logger`를 DI로 주입하거나, `Logger` 클래스를 mock provider로 등록하여 테스트

- **[INFO]** `eslint-disable` 주석 범위 과대
  - 위치: 파일 상단 `/* eslint-disable @typescript-eslint/unbound-method */`
  - 상세: 파일 전체에 eslint 규칙 비활성화. 실제 필요한 위치만 비활성화하는 것이 바람직함.
  - 제안: `// eslint-disable-next-line` 으로 특정 라인에만 적용

- **[INFO]** `'console'` 매직 스트링 (위 파일 2와 동일 이슈)
  - 위치: 테스트 내 config mock

---

**파일 5: mail.service.ts**

- **[WARNING]** console transport 시 메일 전송이 계속 시도됨
  - 위치: `sendVerificationEmail` 내 transport 분기 처리
  - 상세: `transport === 'console'`일 때 로그를 찍고 **그대로 실제 메일 전송도 시도**함. 개발 환경에서 `jsonTransport`로 전송되긴 하지만, 의도가 불명확하고 혼란스러움. 실제로는 console 로그 + `jsonTransport` 전송이 동시에 일어나는 구조.
  - 제안: console 분기를 명확히 early return하거나, 의도를 주석으로 명시

- **[INFO]** 인라인 HTML 템플릿의 유지보수성
  - 위치: `buildVerificationHtml` 메서드 (50줄 이상의 HTML 문자열)
  - 상세: 현재 구조는 단일 이메일 템플릿이므로 허용 가능하나, 이메일 종류가 늘어나면 관리가 어려워짐. 향후 Handlebars 등 템플릿 엔진 도입 고려.
  - 제안: 단기적으로는 현 구조 유지, 장기적으로는 `@nestjs-modules/mailer`의 template 기능 활용

- **[INFO]** `'console'` 매직 스트링 (위 파일 2와 동일 이슈)
  - 위치: `if (transport === 'console')`

---

### 요약

메일 모듈 구현 자체는 NestJS 패턴을 잘 따르고 있으며 에러 핸들링, 로깅, 테스트 구성이 전반적으로 양호함. 다만 `'console'`이라는 transport 타입 문자열이 4개 파일에 걸쳐 하드코딩되어 있어 중앙화가 필요하며, `mail.module.ts`의 중복 `defaults` 설정과 `mail.service.ts`의 console/smtp 분기 처리 의도 불명확성은 수정이 필요함. 테스트에서 private 멤버에 직접 접근하는 패턴은 리팩토링 내성을 낮추므로 개선이 권장됨. README는 프로젝트 고유 내용으로 교체되어야 함.

### 위험도

**MEDIUM**