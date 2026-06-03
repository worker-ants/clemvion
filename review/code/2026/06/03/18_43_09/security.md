# 보안(Security) 리뷰

## 발견사항

### [CRITICAL] emailVerifyToken 평문 DB 저장 — passwordResetToken 과 불일치

- **위치**: `/codebase/backend/src/modules/auth/auth.service.ts` 라인 74, 81, 619–628, 796
- **상세**: `passwordResetToken` 은 `hashToken()` (SHA-256)으로 해시 후 DB에 저장하지만, `emailVerifyToken` 은 UUID 원문 그대로 저장된다. `findUserByVerifyToken`이 `where: { emailVerifyToken: token }` 으로 직접 비교하는 구조.  
  - DB 유출(SQL dump, backup 탈취) 시 이메일 인증 토큰이 바로 노출되어 미인증 계정을 즉시 인증해 로그인 세션을 획득할 수 있다.  
  - 신규 `resendVerification` 에서도 동일 패턴을 그대로 재사용하므로 위험이 확대된다 (라인 622–628).
- **제안**:
  1. 저장 시 `hashToken(emailVerifyToken)` 으로 SHA-256 해시 후 저장.
  2. `findUserByVerifyToken`에서 `where: { emailVerifyToken: this.hashToken(token) }` 으로 조회.
  3. 이메일에는 원문 UUID를 그대로 링크로 포함 (변경 불필요).

---

### [WARNING] POST /auth/check-email — 레이트 리밋 없음 (이메일 열거 가능)

- **위치**: `/codebase/backend/src/modules/auth/auth.controller.ts` 라인 441–453
- **상세**: `check-email` 엔드포인트에 `@Throttle` 데코레이터가 없다. 전역 기본값은 100 req/60s (IP 기준)으로 지나치게 관대하다.  
  - 등록된 이메일 주소를 `available: false` 응답으로 빠르게 열거할 수 있다. 공격자는 분당 최대 100개 이메일을 확인 가능하다.  
  - 비교: `forgot-password` 는 5 req/60s, `resend-verification` 은 5 req/60s 로 제한되어 있으나 `check-email` 만 보호가 약하다.
- **제안**:
  ```typescript
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('check-email')
  ```
  `forgot-password` 와 동일한 5 req/min 수준으로 강화 권고.

---

### [WARNING] register-form onBlur check-email — 클라이언트 쿨다운 없음

- **위치**: `/codebase/frontend/src/components/auth/register-form.tsx` 라인 220–235 (`checkEmailAvailability`)
- **상세**: 이메일 입력 필드에서 blur 이벤트마다 `authApi.checkEmail()` 을 호출하는데, 쿨다운이나 debounce 가 없다. 사용자가 이메일 필드를 반복 클릭/탭 하거나, 자동화 도구가 빠르게 blur 이벤트를 발생시키면 서버 레이트 리밋 적중 전까지 반복 요청을 보낼 수 있다. 이는 위 WARNING(레이트 리밋 미설정)과 결합하면 열거 편의성을 높인다.
- **제안**: blur 핸들러에 300–500ms debounce 추가 또는 이전 호출이 진행 중(`"checking"` 상태)이면 재호출 차단.

---

### [WARNING] verify-email 페이지 — ?email 쿼리 파라미터를 API에 그대로 전달

- **위치**: `/codebase/frontend/src/app/(auth)/verify-email/verify-email-content.tsx` 라인 28, 80
- **상세**: `email` 값은 URL 쿼리 파라미터(`searchParams.get("email")`)에서 읽어 검증 없이 `authApi.resendVerification(email)` 로 전달된다. 백엔드의 DTO(`@IsEmail()`)가 최종 검증을 수행하므로 임의 문자열 주입은 400으로 거부되지만, 클라이언트 측에서 이메일 형식 사전 검증이 없어 불필요한 API 호출이 발생하며 SSRF-lite 류 인자 조작의 여지가 있다.  
  - 악의적 링크 `…/verify-email?email=<crafted>` 로 사용자를 유인해 제3자 이메일 주소로 인증 메일을 재발송시키는 "재발송 남용" 공격도 가능 (서버 레이트 리밋으로 완화되나 5 req/min × N IP는 무시할 수 없다).
- **제안**: `handleResend()` 호출 전 프론트엔드에서도 이메일 형식 정규식 검증 수행.

---

### [WARNING] forgot-password 재발송 — 서버 사이드 레이트 리밋만으로 보호

- **위치**: `/codebase/frontend/src/components/auth/forgot-password-form.tsx` 라인 84–95
- **상세**: `handleResend()` 는 쿨다운이 남아 있으면 클라이언트에서 차단하지만, 쿨다운은 컴포넌트 상태(`resendCooldown`)로만 관리된다. 페이지 새로고침 또는 탭 복제 후 즉시 재발송 버튼을 클릭하면 쿨다운 없이 API 를 다시 호출할 수 있다. 서버 레이트 리밋(5 req/60s)이 최후 방어선이나, 이는 예상보다 넉넉한 한도다. 이슈 심각도는 낮지만 UX 거짓 보증 문제이기도 하다.
- **제안**: 서버 레이트 리밋이 적절하면 현 구현 허용 가능. 더 강화하려면 `sessionStorage` 기반 타임스탬프로 쿨다운을 persist 하거나, 서버 레이트 리밋을 더 낮게(예: 3 req/5min) 조정.

---

### [INFO] resendVerification — 오류 swallow 정책 (정상, 확인용)

- **위치**: `/codebase/backend/src/modules/auth/auth.service.ts` 라인 631–636
- **상세**: `catch {}` 블록에서 DB/메일 오류를 무음 처리하여 email enumeration safe 패턴을 구현했다. 이는 의도된 설계이며 보안적으로 올바르다. 단, 내부 서비스 오류(예: 메일 서버 다운)가 운영자에게 silent 될 수 있으므로, 로깅이 실제로 downstream 서비스(`mailService`, `usersService`)에서 수행되는지 확인 권고.
- **제안**: 확인 후 이슈 없으면 허용. `MailService` 및 `UsersService` 내 실패 시 로깅이 있는지 별도 검토 권장.

---

### [INFO] i18n 변경 (statistics.ts, triggers.ts, workflows.ts) — 보안 위험 없음

- **위치**: `/codebase/frontend/src/lib/i18n/dict/ko/statistics.ts`, `triggers.ts`, `workflows.ts`
- **상세**: 순수 문자열 상수 추가. XSS 위험 없음 (React 렌더링은 기본적으로 이스케이프). 보안 관련 내용 없음.

---

### [INFO] evaluator.ts / evaluator.spec.ts — 보안 위험 없음

- **위치**: `/codebase/packages/node-summary/src/evaluator.ts`, `evaluator.spec.ts`
- **상세**: `fallback:` 필터 추가는 config 객체 내부 경로 해석만 수행하며 외부 입력을 eval 하지 않는다. `getPath()`는 키 순회 전용으로 프로토타입 체인 오염(`..__proto__` 등)에 대한 방어가 `typeof cursor === 'object'` 체크로 부분 완화된다.  
  - `path.split('.')` 에서 `__proto__`·`constructor` 세그먼트에 대한 명시적 방어는 없으나, 이 함수가 소비하는 `config`(NodeConfig)는 신뢰할 수 있는 스키마 정의 값이므로 현 위협 모델에서는 INFO 수준.

---

## 요약

이번 변경에서 가장 중대한 보안 결함은 **`emailVerifyToken` 평문 DB 저장**이다. 기존부터 존재한 결함이지만 `resendVerification` 신규 경로가 이 패턴을 재사용함으로써 위험이 확대되었다. 패스워드 리셋 토큰이 SHA-256 해시로 저장되는 것과 달리 이메일 검증 토큰만 원문 저장되어 DB 유출 시 즉시 계정 탈취로 이어질 수 있다. 두 번째로 **`check-email` 엔드포인트의 레이트 리밋 부재**는 등록된 이메일 주소를 대량 열거할 수 있는 경로를 열어 둔다. 그 외 `verify-email` 페이지의 URL 파라미터 미검증, 클라이언트 쿨다운의 세션 미지속 등은 낮은 수준의 보완 이슈다. i18n 변경 및 evaluator 패키지 수정은 보안 위험이 없다.

## 위험도

**HIGH** — emailVerifyToken 평문 저장(CRITICAL) + check-email 이메일 열거(WARNING) 조합.

STATUS=success
