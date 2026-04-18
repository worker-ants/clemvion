## API Contract 코드 리뷰

### 발견사항

- **[INFO]** `forgotPassword` 공개 API 응답 계약 변경 없음
  - 위치: `auth.service.ts:285–300`
  - 상세: `POST /auth/forgot-password`의 응답 형식(`{ message: string }`)과 HTTP 상태코드는 변경 없음. TODO였던 이메일 발송 로직을 채운 순수 내부 구현 변경.
  - 제안: 해당 없음.

- **[WARNING]** 메일 실패 시 DB에 유효 토큰이 남아 사용자 접근 불가
  - 위치: `auth.service.ts:285–299`
  - 상세: `usersService.update`로 토큰이 DB에 먼저 저장된 후 메일 발송을 시도한다. 메일 실패 시 에러를 삼켜 API는 성공을 반환하지만, 사용자는 토큰을 받지 못한 채 DB에만 유효 토큰이 존재한다. 이후 재요청 시 덮어쓰이므로 실질적 문제는 없으나, 운영상 추적이 어렵다.
  - 제안: MailService가 이미 내부에서 에러를 로깅하고 있으므로 현재 구조는 허용 가능하나, 메일 발송 실패 메트릭을 별도로 수집하는 것을 권장.

- **[WARNING]** 서비스 레벨에 `forgotPassword` 요청 제한(Rate Limiting) 없음
  - 위치: `auth.service.ts:269`
  - 상세: 공격자가 유효한 이메일 주소를 알고 있다면 반복 요청으로 해당 사용자에게 대량의 비밀번호 재설정 이메일을 발송할 수 있다. IP 기반 또는 이메일 기반 rate limiting이 컨트롤러/미들웨어에 적용되어 있어야 한다.
  - 제안: NestJS `@Throttle` 데코레이터 또는 API 게이트웨이 수준에서 이 엔드포인트에 대한 요청 제한 적용 여부 확인 필요.

- **[INFO]** 테스트: 메일 실패 케이스에서 토큰 저장 순서 미검증
  - 위치: `auth.service.spec.ts:358–366`
  - 상세: `should return the same message even if mail dispatch fails` 테스트가 메일 발송 실패 시에도 `usersService.update`(토큰 저장)가 먼저 호출됐는지 검증하지 않는다. 실행 순서에 대한 계약을 명시적으로 검증하지 않음.
  - 제안: `expect(usersService.update).toHaveBeenCalled()` 검증 추가.

- **[INFO]** `buildPasswordResetText`에서 `name` 이스케이프 누락 (일관성)
  - 위치: `mail.service.ts:226`
  - 상세: HTML 버전은 `escapeHtml(name)`을 사용하지만 plain text 버전은 `name`을 그대로 삽입한다. 이메일 본문에서의 직접적 보안 위협은 낮으나, 코드 일관성 문제. 테스트에서도 HTML 이스케이프만 검증한다.
  - 제안: 일관성을 위해 text 버전에도 특수문자 처리 또는 주석으로 plain text 의도임을 명시.

---

### 요약

이번 변경은 `forgotPassword` 플로우의 TODO 이메일 발송 로직을 실제 구현으로 채운 것으로, 공개 API 응답 계약(`{ message: string }`, HTTP 200)에는 변경이 없다. 이메일 열거 공격 방지를 위한 에러 삼킴 처리와 XSS 방지를 위한 HTML 이스케이프가 올바르게 구현되어 있으며, 계층 분리(MailService가 throw, AuthService가 catch)도 적절하다. 다만 서비스 레벨의 rate limiting 부재가 잠재적 이메일 스팸 벡터가 될 수 있으므로 컨트롤러/미들웨어 레벨에서의 적용 여부를 반드시 확인해야 한다.

### 위험도

**LOW**