# Code Review 조치 내용

## 조치 완료

### Critical

| # | 발견사항 | 조치 |
|---|----------|------|
| 1 | README.md가 NestJS 기본 보일러플레이트 | 프로젝트 실제 내용으로 교체 (환경변수, 스크립트, 모듈 구조) |

### Warning

| # | 발견사항 | 조치 |
|---|----------|------|
| 1 | `name` HTML 이스케이프 없이 이메일 삽입 (XSS) | `escapeHtml()` 헬퍼 구현, `buildVerificationHtml()`에서 `safeName` 적용 |
| 2 | `token` URL 인코딩 없음 | `encodeURIComponent(token)` 적용 |
| 3 | console transport에서 sendMail() 계속 호출 | `if (transport === MAIL_TRANSPORT_CONSOLE) { logger.debug(); return; }` early return 적용 |
| 4 | `frontendUrl` undefined 시 잘못된 URL 생성 | 생성자에서 값 로드 및 미설정 시 경고 로그 출력 |
| 5 | 인증 토큰 평문 로그 노출 | `logger.debug()`로 레벨 변경 (프로덕션에서는 미출력) |
| 6 | XSS 취약점 테스트 부재 | 특수문자 name으로 호출 시 `<script>` 태그 미포함 assert 추가 |
| 7 | MailModule transport 분기 테스트 없음 | console transport에서 `sendMail` 미호출 assert 테스트 추가 |
| 8 | `'console'` 매직 스트링 분산 하드코딩 | `MAIL_TRANSPORT_CONSOLE` 상수 생성 (`mail.constants.ts`), 모든 파일에서 참조 |
| 9 | `defaults.from` 중복 | 공통 `defaults` 변수로 추출 |
| 10 | 테스트에서 `service['logger']` private 접근 | `createService()` 팩토리 패턴으로 리팩토링, private 접근 제거 |
| 11 | 환경변수 7개 문서화 누락 | `README.md`에 `MAIL_*` 변수 목록 추가 |
| 12 | SMTP 필수값 검증 부재 (빈 문자열 기본값) | `MAIL_PORT` NaN 방어 (`parseInt() || 587`) 적용 |

### Info

| # | 발견사항 | 조치 |
|---|----------|------|
| 1 | `MAIL_PORT` NaN 방어 | `parseInt(...) \|\| 587` 적용 |
| 3 | `MailModule`에서 글로벌 `ConfigModule` 재import | `imports: [ConfigModule]` 제거 (글로벌이므로 불필요) |
| 5 | console transport 분기 sendMail 호출 테스트 없음 | `expect(mailerService.sendMail).not.toHaveBeenCalled()` 추가 |
| 8 | `configService.get()` 반복 호출 | 생성자에서 `frontendUrl`, `transport` 한 번만 읽도록 변경 |

## 미조치 (낮은 우선순위)

| # | 발견사항 | 사유 |
|---|----------|------|
| Info-2 | transport 분기 책임 이중화 | MailModule은 설정 시점 분기, MailService는 런타임 분기로 역할이 다름 (console transport는 early return으로 명확화됨) |
| Info-4 | mail.config.ts 단위 테스트 | 단순 환경변수 매핑이라 테스트 대비 효용 낮음 |
| Info-9 | Array.join 대신 템플릿 리터럴 | 성능 실질 영향 없음, 가독성 차이도 미미 |
| Info-10 | JSDoc 추가 | 메서드 시그니처로 충분히 명확 |
