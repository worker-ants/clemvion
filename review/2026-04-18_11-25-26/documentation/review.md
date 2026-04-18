## 발견사항

### `mail.service.ts`

- **[WARNING]** `sendPasswordResetEmail` 공개 메서드에 JSDoc 없음
  - 위치: `mail.service.ts` - `sendPasswordResetEmail` 메서드 선언부
  - 상세: `sendWorkspaceInvitationEmail`은 JSDoc이 있으나 동일 수준의 공개 메서드인 `sendPasswordResetEmail`에는 없어 문서화 일관성이 깨짐
  - 제안:
    ```ts
    /**
     * Send a password reset email. The link expires in 30 minutes.
     * Mail failures are thrown so callers can decide whether to swallow them.
     */
    async sendPasswordResetEmail(...)
    ```

- **[INFO]** 주석 처리된 코드 블록이 `sendVerificationEmail` 내에 잔존
  - 위치: `mail.service.ts` 약 36–40행 (전체 파일 컨텍스트 기준)
  - 상세: `if (this.transport === MAIL_TRANSPORT_CONSOLE)` 블록이 주석 처리된 채로 남아 있어 `sendPasswordResetEmail`과의 동작 불일치 의문을 유발함. 이번 변경에서 새 메서드는 동일 패턴을 주석 없이 구현했으므로 기존 코드도 정리가 필요함
  - 제안: 해당 주석 블록 제거 (이미 바로 아래 `logger.debug`로 대체되어 있음)

### `auth.service.ts`

- **[INFO]** catch 블록 주석 내 `MailService logs the error internally` 문구의 외부 참조 불명확
  - 위치: `auth.service.ts` - `forgotPassword` catch 블록
  - 상세: 주석 자체는 WHY를 잘 설명하나, `mail.service.ts`에서 실제로 로그를 남기는지 독자가 교차 확인해야 함. 현재 구현에서는 사실이므로 문제없으나, 미래 리팩토링 시 주석이 stale 될 위험 있음
  - 제안: `MailService throws after logging` 방식으로 계약 관계를 더 명확히 표현하거나 현행 유지

- **[INFO]** `forgotPassword` 메서드에 Swagger `@ApiOperation`/`@ApiResponse` 데코레이터가 컨트롤러에 있다면 갱신 필요 가능성
  - 위치: `auth.controller.ts` (리뷰 범위 외)
  - 상세: 이번 변경으로 `forgotPassword`가 실제 이메일 발송을 수행하게 됨. 기존 Swagger 설명이 "미구현" 또는 "로그 출력"을 언급하고 있다면 업데이트 필요
  - 제안: 컨트롤러의 해당 엔드포인트 데코레이터 확인 후 필요시 수정

### `auth.service.spec.ts` / `mail.service.spec.ts`

- **[INFO]** 테스트 설명(it-string)은 충분히 명확하나, `mail.service.spec.ts`의 `sendPasswordResetEmail` describe 블록 내 테스트들이 `sendVerificationEmail`과 구조·명칭 패턴을 그대로 따라 일관성이 좋음 — 별도 조치 불필요

---

## 요약

이번 변경은 `forgotPassword` TODO를 실제 구현으로 완성한 것으로, 핵심 로직·보안 설계(이메일 열거 방지)·테스트 모두 양호하다. 문서화 관점에서 주요 갭은 `sendPasswordResetEmail` 공개 메서드의 JSDoc 누락(형제 메서드인 `sendWorkspaceInvitationEmail`과의 불일치)과 `sendVerificationEmail` 내 잔존 주석 블록 두 가지이며, 그 외는 정보성 수준이다.

## 위험도

**LOW**