# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** - HTML 이메일 XSS 취약점, README 미갱신, console transport 동작 모호성 등 복수의 중요 이슈 존재

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Documentation | README.md가 NestJS 기본 보일러플레이트 그대로 — 프로젝트 실제 내용 미반영 (CLAUDE.md 지침 위반) | `README.md` 전체 | spec 참고하여 프로젝트 개요, 환경변수 목록(MAIL_*, JWT_*, DB_* 등), 실행 방법으로 교체 |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | `name` 파라미터가 HTML 이스케이프 없이 이메일 본문에 직접 삽입 — XSS 취약점 | `mail.service.ts` `buildVerificationHtml()` `${name}` | `escapeHtml()` 헬퍼 구현 후 `${this.escapeHtml(name)}` 적용 |
| 2 | Security | `token`이 URL에 `encodeURIComponent` 없이 삽입 — URL Injection 가능성 | `mail.service.ts:18` | `encodeURIComponent(token)` 적용 |
| 3 | Side Effect / Architecture | `console` transport 모드에서도 `sendMail()` 계속 호출 — 의도 불명확, 개발 환경 early return 없음 | `mail.service.ts:23-38` | `if (transport === 'console') { this.logger.log(...); return; }` 패턴으로 명시적 early return |
| 4 | Side Effect | `frontendUrl`이 undefined일 때 `"undefined/auth/verify-email?token=..."` URL이 조용히 생성되어 인증 링크 파손 | `mail.service.ts:18-19` | 서버 시작 시 또는 메서드 상단에서 값 유효성 검증 후 throw |
| 5 | Security / Testing | 개발 모드에서 인증 토큰 전체가 Logger에 평문 노출 | `mail.service.ts:24` | `logger.debug()`로 레벨 낮추거나 토큰 일부만 마스킹 출력 |
| 6 | Testing | `name` HTML 미이스케이프에 대한 테스트 부재 — 실제 XSS 취약점이 테스트로 검증되지 않음 | `mail.service.spec.ts` | 특수문자 name으로 호출 시 HTML에 raw script 태그가 없음을 assert |
| 7 | Testing | `MailModule` transport 분기 로직(`console` vs SMTP)에 대한 테스트 없음 | `mail.module.ts` | `mail.module.spec.ts` 추가하여 각 분기 통합 테스트 |
| 8 | Maintainability | `'console'` 매직 스트링이 4개 파일(`mail.config.ts`, `mail.module.ts`, `mail.service.ts`, `mail.service.spec.ts`)에 분산 하드코딩 | 4개 파일 전반 | `MAIL_TRANSPORT` 상수 또는 enum으로 중앙화 |
| 9 | Maintainability | `mail.module.ts`에서 `defaults.from` 설정이 console/SMTP 분기에 중복 | `mail.module.ts` console/SMTP 분기 내 `defaults` | `const defaults = { from: ... }` 공통 추출 후 재사용 |
| 10 | Maintainability | 테스트에서 `service['logger']`로 private 멤버 직접 접근 — 리팩토링 내성 저하 | `mail.service.spec.ts:61` | Logger를 DI 주입하거나 `jest.spyOn(Logger.prototype, 'log')`로 대체 |
| 11 | Documentation | 신규 환경변수 7개(`MAIL_TRANSPORT`, `MAIL_HOST`, `MAIL_PORT`, `MAIL_SECURE`, `MAIL_USER`, `MAIL_PASS`, `MAIL_FROM`) 문서화 누락 | `mail.config.ts` 전체 | README 또는 `.env.example`에 변수 목록 및 transport별 필수/선택 여부 명세 |
| 12 | Requirement | SMTP 사용 시 `host`, `user`, `pass`가 빈 문자열 기본값 — 설정 누락을 조기에 감지 불가 | `mail.config.ts:6,8,9` | transport가 `smtp`일 때 필수값 검증 추가 또는 Joi/class-validator validation schema 적용 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | `MAIL_PORT` 파싱 실패 시 `NaN` 전달 — 비숫자 환경변수 입력 방어 미흡 | `mail.config.ts:7` | `parseInt(...) \|\| 587` 또는 범위 검증 추가 |
| 2 | Architecture | transport 분기 책임이 `MailModule`(설정)과 `MailService`(런타임) 양쪽에 이중화 | `mail.service.ts:10-12`, `mail.module.ts:9-42` | transport 분기 책임을 MailModule 설정 시점으로 일원화, MailService는 ConfigService 의존 최소화 |
| 3 | Architecture | `MailModule`이 글로벌 `ConfigModule`을 재import | `mail.module.ts:8` | `AppModule`에서 `isGlobal: true`라면 제거 가능 |
| 4 | Testing | `mail.config.ts` 환경변수 파싱 로직 단위 테스트 부재 (`parseInt`, boolean 변환) | `mail.config.ts` | `mailConfig()` factory 함수 단위 테스트 추가 (정상값, 미설정, 잘못된 값) |
| 5 | Testing | console transport 분기에서 `sendMail`도 호출되는지 테스트에 assertion 없음 | `mail.service.spec.ts` console 테스트 | `expect(mailerService.sendMail).toHaveBeenCalledTimes(1)` 추가 |
| 6 | Testing | HTML body에서 `<a href>` 링크 포함 여부 등 핵심 HTML 구조 검증 없음 | `mail.service.spec.ts` | `sendMail` 호출 인자에서 `html` 필드 추출 후 href 값 assert |
| 7 | Testing | Mock `ConfigService.get` 반환 타입이 `Record<string, string>` 고정 — number/boolean 키 확장 시 오탐 가능 | `mail.service.spec.ts:23-31` | `Record<string, unknown>`으로 변경 |
| 8 | Performance | `configService.get()` 매 호출마다 반복 조회 | `mail.service.ts:20,22` | 생성자에서 `private readonly frontendUrl`, `private readonly transport`로 한 번만 읽기 |
| 9 | Performance | `buildVerificationText()`의 `Array.join()` 패턴 — 불필요한 중간 배열 할당 | `mail.service.ts:60-69` | 템플릿 리터럴로 교체 |
| 10 | Documentation | `sendVerificationEmail` 공개 메서드 JSDoc 누락 | `mail.service.ts:14` | `@param`, `@throws` 포함 JSDoc 추가 |
| 11 | Dependency | `package.json` 미포함으로 `@nestjs-modules/mailer` 버전 고정 여부 및 `nodemailer` peer dep 설치 여부 확인 불가 | `package.json` | 리뷰 후 버전 명시적 고정 및 `nodemailer` 별도 설치 여부 확인 |
| 12 | Requirement | 이메일 본문에 "24시간 유효" 명시되나 토큰 만료 로직이 MailService에 없고 테스트도 없음 | `mail.service.ts`, `mail.service.spec.ts` | 만료 처리 위치 명확화 및 해당 위치에 테스트 추가 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| Security | MEDIUM | HTML 이메일 XSS(name 미이스케이프), token URL 미인코딩, 개발 로그 토큰 평문 노출 |
| Documentation | MEDIUM | README boilerplate 미갱신(CRITICAL), 환경변수 7개 문서화 누락 |
| Requirement | MEDIUM | README CRITICAL 미갱신, frontendUrl undefined 시 잘못된 링크 발송 |
| Maintainability | MEDIUM | 'console' 매직 스트링 4파일 분산, module defaults 중복, private 멤버 직접 접근 |
| Testing | MEDIUM | XSS 취약점 테스트 미검증, MailModule 분기 테스트 없음 |
| Side Effect | LOW | console transport early return 없음, frontendUrl undefined 조용한 실패 |
| Architecture | LOW | transport 책임 이중화, console 모드 동작 모호성 |
| Dependency | LOW | package.json 미포함으로 버전 확인 불가 |
| Scope | LOW | console transport 흐름 불명확 외 이슈 없음 |
| Performance | NONE | 미세한 비효율(configService 반복 조회, Array.join) — 실질 영향 없음 |
| Concurrency | NONE | 공유 상태 없음, async/await 올바름 |

---

## 발견 없는 에이전트

- **Database** — 데이터베이스 접근 코드 없음, 해당 없음
- **API Contract** — 외부 노출 엔드포인트 변경 없음, 해당 없음

---

## 권장 조치사항

1. **[즉시] XSS 취약점 수정** — `buildVerificationHtml()`에서 `name` HTML 이스케이프 처리 + 관련 테스트 추가
2. **[즉시] token URL 인코딩** — `encodeURIComponent(token)` 적용
3. **[즉시] README 갱신** — CLAUDE.md 지침에 따라 프로젝트 실제 내용(환경변수, 모듈 구조, 실행 방법)으로 교체
4. **[높음] console transport early return** — `if (transport === 'console') { log; return; }` 패턴 적용으로 의도 명확화
5. **[높음] frontendUrl 유효성 검증** — undefined 시 명시적 오류 발생하도록 처리
6. **[중간] 'console' 매직 스트링 상수화** — `MAIL_TRANSPORT` 상수/enum 추출하여 4개 파일에서 재사용
7. **[중간] MailModule 테스트 추가** — transport 분기 로직 통합 테스트 (`mail.module.spec.ts`)
8. **[중간] private 멤버 접근 방식 개선** — 테스트에서 `service['logger']` 대신 Logger DI 또는 prototype spy 사용
9. **[낮음] 환경변수 문서화** — `.env.example` 또는 README에 MAIL_* 변수 명세 추가
10. **[낮음] MAIL_PORT NaN 방어** — `parseInt(...) || 587` 또는 범위 검증 추가