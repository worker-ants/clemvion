### 발견사항

- **[WARNING]** `forgotPassword`에서 DB 업데이트 실패 시 이메일 열거 방지 보장이 깨짐
  - 위치: `auth.service.ts` — `forgotPassword` 메서드 내 `await this.usersService.update(...)` 호출
  - 상세: `usersService.update`가 예외를 던지면 해당 예외가 그대로 전파되어 컨트롤러가 500 응답을 반환함. 사용자가 존재하는 경우에만 DB 에러가 발생하므로, 외부에서 이메일 존재 여부를 추론할 수 있는 side-channel이 생김. `sendMail` 실패는 catch로 삼키면서 정작 더 가능성 높은 DB 오류는 노출되는 구조적 불일치.
  - 제안: `usersService.update` 호출도 try-catch로 감싸거나, `if (user)` 블록 전체를 try-catch로 래핑하여 어떤 내부 오류가 발생해도 동일 응답을 반환하도록 처리.

- **[WARNING]** `passwordResetToken`이 평문으로 DB에 저장됨
  - 위치: `auth.service.ts` — `forgotPassword`, `findUserByResetToken`
  - 상세: refresh token은 `hashToken`(SHA-256)으로 해시 후 저장하는 반면, 비밀번호 재설정 토큰은 raw UUID를 그대로 저장하고 조회함. DB 유출 시 모든 유효 기간 내 리셋 토큰이 즉시 악용 가능. 만료 시간이 30분으로 짧지만 아키텍처 일관성과 심층 방어 원칙에 어긋남.
  - 제안: 기존 `hashToken` 유틸을 재사용하여 토큰을 해시 후 저장하고, `findUserByResetToken`에서도 해시값으로 조회.

- **[WARNING]** `usersService.update` 실패 시 재설정 토큰 미저장 케이스에 대한 테스트 누락
  - 위치: `auth.service.spec.ts` — `forgotPassword` describe 블록
  - 상세: DB 업데이트 실패 시나리오(`usersService.update.mockRejectedValueOnce`)가 테스트되지 않음. 현재 구현에서 이 케이스는 500을 반환하므로, 이 동작이 의도된 것인지 검증 불가.
  - 제안: `usersService.update`가 실패할 때의 동작을 명시적으로 테스트 추가.

- **[INFO]** `buildPasswordResetText`에서 `name`이 이스케이프되지 않음
  - 위치: `mail.service.ts` — `buildPasswordResetText`
  - 상세: plain text 이메일이므로 HTML 이스케이프는 불필요하나, `buildVerificationText`와 동일하게 원시 값을 사용하는 것은 일관된 패턴임. 문제 없음.

- **[INFO]** `forgotPassword` 연속 호출 시 이전 토큰 무효화 동작에 대한 문서/테스트 없음
  - 위치: `auth.service.ts` — `forgotPassword`
  - 상세: 동일 이메일로 여러 번 호출하면 이전 재설정 링크가 무효화됨. 이는 일반적으로 올바른 동작이나, 명시적 테스트나 주석이 없어 의도성이 불분명.
  - 제안: 동작을 명확히 하는 테스트 케이스 또는 주석 추가.

---

### 요약

비밀번호 재설정 이메일 발송 기능의 핵심 구현(토큰 생성, DB 저장, 이메일 발송, XSS/URL 인코딩 보호, 이메일 열거 방지)은 전반적으로 올바르게 구현되어 있으며 테스트 커버리지도 충분하다. 다만 `forgotPassword`에서 이메일 열거 방지 보장이 `sendMail` 실패에만 적용되고 `usersService.update` 실패 시에는 적용되지 않는 구조적 불일치가 있으며, 비밀번호 재설정 토큰이 refresh token과 달리 평문으로 저장되는 아키텍처 불일치가 존재한다. 두 항목 모두 요구사항인 보안 강화와 이메일 열거 방지에 직접 관련된 사항으로 조치가 필요하다.

### 위험도

**MEDIUM**