# 유지보수성(Maintainability) 리뷰

## 발견사항

### [INFO] 매직 넘버: 1h 만료 시간이 두 곳에 중복 하드코딩
- 위치: `codebase/backend/src/modules/auth/auth.service.ts` — `requestEmailChange` L146, `resendEmailChange` L250
- 상세: `60 * 60 * 1000` (3_600_000 ms, 1시간)가 두 메서드에 각각 인라인으로 작성되어 있다. 주석 `// 1h` 가 있어 의미는 알 수 있지만, 수치 자체는 named constant 없이 반복된다. 비밀번호 재설정·이메일 검증 등 기존 토큰들이 별도 ENV 변수나 상수로 분리되어 있는지 여부와 무관하게, 이 숫자는 이 changeset 안에서만 2회 중복된다.
- 제안: `private readonly EMAIL_CHANGE_TTL_MS = 60 * 60 * 1000;` 상수를 클래스 레벨에 정의하거나, 기존 코드베이스 패턴에 따라 ConfigService 또는 shared constant 파일로 추출. INFO 등급인 이유는 주석으로 의미가 충분히 표현되고 두 곳뿐이기 때문.

---

### [INFO] `cancelEmailChange`가 `clearPendingEmailChange` 단순 위임 — 불필요한 간접 계층
- 위치: `codebase/backend/src/modules/auth/auth.service.ts` L260-262
- 상세: `cancelEmailChange(userId)` 는 `clearPendingEmailChange(userId)` 를 한 줄로 호출하는 것 외에 아무 로직이 없다. public API와 private 구현 분리 의도는 이해되지만, 현재 구조에서 `clearPendingEmailChange` 는 `verifyEmailChange` 내부(에러 경로 롤백)에서도 직접 호출된다. 두 단계의 목적이 실제로 다르면 주석으로 역할 경계를 명시하거나, 동일하다면 `cancelEmailChange` 에서 직접 업데이트 로직을 인라인해 계층을 하나 줄이는 편이 읽기 쉽다.
- 제안: 현 구조 유지 가능하나, `clearPendingEmailChange` JSDoc에 "내부 에러 롤백 경로와 외부 cancel 엔드포인트 양쪽이 공유하는 helper" 임을 한 줄 명시 권장.

---

### [INFO] `verifyEmailChange` 의 조건 검사 블록이 6개 조건을 단일 if 에 병합 — 가독성 소폭 저하
- 위치: `codebase/backend/src/modules/auth/auth.service.ts` L168-180
- 상세:
  ```
  if (
    !user ||
    !user.pendingEmail ||
    !user.emailChangeToken ||
    user.emailChangeToken !== this.hashToken(token) ||
    !user.emailChangeExpiresAt ||
    user.emailChangeExpiresAt.getTime() < Date.now()
  )
  ```
  6개 조건이 하나의 `if` 에 병합되어 있다. 에러 응답이 단일(`VALIDATION_ERROR`)이므로 합쳐서 던지는 설계 의도는 명확하다. 단 `user` null-guard 와 나머지 토큰 검증을 묶으면 `user` 가 null 일 때 `.pendingEmail` 참조가 short-circuit 으로 안전하게 처리된다는 점을 독자가 즉시 추론해야 한다. 현 규모에서 큰 문제는 아니지만, `user` null 체크를 앞서 별도 가드로 분리하면 가독성이 개선된다.
- 제안: INFO 수준. 분리 예:
  ```ts
  if (!user) throw new UnauthorizedException({ code: 'UNAUTHENTICATED' });
  const tokenValid = user.emailChangeToken && user.emailChangeToken === this.hashToken(token);
  const notExpired = user.emailChangeExpiresAt && user.emailChangeExpiresAt.getTime() >= Date.now();
  if (!user.pendingEmail || !tokenValid || !notExpired) { ... }
  ```

---

### [INFO] `isUniqueEmailViolation` — 타입 단언 방식이 기존 코드베이스 패턴과 상이할 수 있음
- 위치: `codebase/backend/src/modules/auth/auth.service.ts` L272-276
- 상세: `err as { code?: string; driverError?: { code?: string } }` 인라인 단언이 사용된다. 기존 코드베이스의 다른 부분에서 같은 PostgreSQL 고유 키 위반을 어떻게 처리하는지 확인하지 못했지만, 만약 동일한 패턴이 다른 서비스에도 반복된다면 shared util 로 추출할 후보가 된다. 현재는 이 파일에서 한 번만 쓰이므로 수용 가능한 수준.
- 제안: 기존 코드베이스에 `isUniqueConstraintError` 류 util 이 없다면 shared util 추출 검토. 있다면 재사용.

---

### [INFO] `MailService` HTML 빌더 메서드들이 유사 구조를 반복
- 위치: `codebase/backend/src/modules/mail/mail.service.ts` — `buildEmailChangeVerificationHtml`, `buildEmailChangedNoticeHtml`
- 상세: 두 메서드는 HTML 템플릿의 외부 table 구조(`<!DOCTYPE html>…<table width="480">…</table>`)가 동일하고 내부 본문만 다르다. 기존 `buildPasswordResetHtml` 이 있는지 확인하지 못했으나, 같은 패턴이 3회 이상 중복되면 공통 wrapper 함수나 템플릿 엔진 추상화가 필요해진다. 현재 2회 중복이라 INFO 수준.
- 제안: 단기: 현 구조 유지 허용. 중기: `buildHtmlWrapper(body: string): string` 같은 헬퍼를 추출해 외부 table 구조를 단일화.

---

### [INFO] `VerifyEmailChangePage` — `useRef(false)` 패턴의 명시적 주석이 있으나, 의존성 배열에 `token` 포함이 의도와 모순될 수 있음
- 위치: `codebase/frontend/src/app/(main)/profile/change-email/verify/page.tsx` L198-215
- 상세: `ran.current` ref 가드는 strict mode 이중 실행 방지를 위한 것이다. 그런데 `useEffect` 의존성 배열에 `token` 이 포함되어 있어, URL 쿼리가 변경되면(같은 페이지 마운트 유지) effect 가 재실행되고 `ran.current` 가 이미 `true` 라 API 가 호출되지 않는다. 즉 URL 토큰이 교체된 경우 두 번째 토큰이 무시된다. 실제 사용 패턴(링크 클릭 → 페이지 진입 → 토큰 소비 → 리다이렉트)에서는 문제가 없지만, 의도를 주석 없이 독자가 추론해야 한다.
- 제안: `ran.current` 가드 옆에 "토큰이 1회성이므로 동일 mount 내 URL 변경 시 재시도 방지 의도" 주석을 보강하거나, 의존성 배열을 `[]` 로 바꿔 명시적으로 마운트-once 임을 표현(이 경우 exhaustive-deps lint 억제 주석 필요).

---

### [INFO] API URL 경로 비대칭: `change-password` vs `email-change`
- 위치: `codebase/backend/src/modules/users/users.controller.ts` (신규 엔드포인트), `codebase/frontend/src/lib/api/users.ts`
- 상세: 기존 경로는 `me/change-password` (동사-목적어 순), 신규 경로는 `me/email-change/*` (명사-동사 순)이다. 기능 동작에는 영향이 없으며 consistency-check 에서도 INFO 로 기록된 사항이다. URL 변경은 breaking change 이므로 현 시점 수정 여부는 제품 결정 사항이나 유지보수성 관점에서 향후 API 추가 시 혼재가 심화될 수 있음을 기록한다.
- 제안: 현 PR 에서 변경 불필요. 향후 profile API 설계 시 컨벤션 확정.

---

### [INFO] `users.controller.spec.ts` — `mockRes` 타입 단언 중복
- 위치: `codebase/backend/src/modules/users/users.controller.spec.ts` L711, L752-753, L780-781
- 상세: `(mockRes as unknown as { cookie: jest.Mock }).cookie` 형태의 이중 단언이 테스트 내에서 3회 반복된다. 테스트 코드이지만 반복을 줄이면 가독성이 개선된다.
- 제안: `const mockCookie = (mockRes as unknown as { cookie: jest.Mock }).cookie;` 를 `beforeEach` 또는 테스트 파일 상단에 한 번 추출해 사용.

---

## 요약

이번 변경은 이메일 변경 흐름 전체(backend migration, entity, service, controller, DTO, mail, frontend page, i18n, 테스트)를 망라하며, 전반적으로 기존 코드베이스의 패턴(email_verify_token 3-필드 패턴, rotateSessionAfterPasswordChange 와 동일한 세션 revoke-재발급 2-step, hashToken/generateTokens 재사용)을 일관되게 따르고 있다. 네이밍은 명확하고 함수 단위 책임 분리도 적절하다. 발견된 항목은 모두 INFO 등급으로, CRITICAL 또는 WARNING 수준의 유지보수성 결함은 없다. 개선 여지로는 1시간 만료 시간의 named constant 추출, HTML 빌더 중복 패턴 단일화, verify 효과 내 의존성 배열 의도 명시가 있으나 현 규모와 맥락에서는 수용 가능하다.

## 위험도

LOW

STATUS: SUCCESS
