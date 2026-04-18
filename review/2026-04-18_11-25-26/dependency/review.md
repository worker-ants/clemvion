### 발견사항

- **[INFO]** 신규 외부 의존성 없음
  - 위치: 전체 변경사항
  - 상세: 4개 파일 모두 기존 의존성(`@nestjs-modules/mailer`, `@nestjs/config`, Node.js 내장 모듈)만 사용. `package.json` 변경 없음.
  - 제안: 해당 없음

- **[INFO]** Mock 인터페이스 일치
  - 위치: `auth.service.spec.ts:103`
  - 상세: `MailService` mock에 `sendPasswordResetEmail`이 정확히 추가되어 실제 구현 시그니처 `(email, name, token) => Promise<void>`와 일치함. 테스트 격리가 올바르게 유지됨.
  - 제안: 해당 없음

- **[WARNING]** `AuthService` ↔ `MailService` 간 에러 전파 계약 비대칭
  - 위치: `auth.service.ts:290–298` vs `auth.service.ts:57–63`
  - 상세: `register()`에서 `sendVerificationEmail` 실패 시 예외가 그대로 전파되지만, `forgotPassword()`에서 `sendPasswordResetEmail` 실패는 catch로 삼킴. 의도적 설계(이메일 열거 방지)이나, 두 의존 경로의 에러 계약이 달라 향후 `MailService` 교체/확장 시 혼란을 줄 수 있음.
  - 제안: catch 블록 주석에 이 비대칭이 의도적임을 명시하거나(이미 일부 작성됨), `AuthModule` 레벨에서 이 계약 차이를 문서화

- **[INFO]** `MailService` 내부 에러 로깅 후 재throw → `AuthService`에서 catch 흐름
  - 위치: `mail.service.ts:185–191`, `auth.service.ts:290–298`
  - 상세: `MailService.sendPasswordResetEmail`은 에러 로깅 후 rethrow하고, `AuthService.forgotPassword`는 이를 catch하여 swallow함. 2단계 처리 덕분에 에러가 로그에는 남음 — 주석 설명과 일치하며 운영 가시성 유지됨.
  - 제안: 해당 없음

- **[INFO]** `buildPasswordResetText`에서 `name` 미이스케이프 (평문 텍스트 용도)
  - 위치: `mail.service.ts:229`
  - 상세: `buildVerificationText`와 동일하게 평문용 메서드는 HTML 이스케이프를 적용하지 않음. 현재 plain text 이메일 용도로는 문제없으나, 이 메서드가 다른 의존 컨텍스트에서 재사용될 경우 XSS 위험 존재.
  - 제안: 현재 용도에서는 허용되나, 재사용 가능성이 있다면 escape 추가 고려

---

### 요약

이번 변경은 기존에 `TODO`로 남겨진 `forgotPassword` 이메일 전송 기능을 실제로 구현한 것으로, 신규 외부 의존성이 전혀 없고 `@nestjs-modules/mailer` 등 기존 의존성을 올바르게 활용하고 있습니다. 내부 모듈 간 의존 관계(`AuthService → MailService`)도 적절히 반영되었으며, 테스트 mock도 실제 인터페이스와 일치합니다. 주요 주의사항은 `register()`와 `forgotPassword()` 간의 에러 전파 계약 비대칭으로, 의도적이긴 하나 유지보수 시 혼란을 줄 수 있습니다.

### 위험도

**LOW**