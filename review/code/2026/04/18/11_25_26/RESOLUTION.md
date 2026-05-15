# 코드 리뷰 조치 내용 (2026-04-18_11-25-26)

## 대상 변경

UI에는 존재하나 실제로 동작하지 않던 **비밀번호 재설정 이메일 발송 기능**을 구현하는 변경. 기존 `MailService` 를 재사용하여 `forgotPassword()` 의 TODO 를 해소.

- 변경 파일:
  - `backend/src/modules/auth/auth.service.ts`
  - `backend/src/modules/auth/auth.controller.ts`
  - `backend/src/modules/auth/auth.service.spec.ts`
  - `backend/src/modules/mail/mail.service.ts`
  - `backend/src/modules/mail/mail.service.spec.ts`

## 전체 위험도 변화

MEDIUM → 이번 PR 범위에서 처리 가능한 Warning 8건 모두 조치. 이번 PR 스코프 밖의 기존 코드 이슈는 "후속 과제"로 정리.

---

## 해결 완료 (Warning)

### #1 `passwordResetToken` 평문 DB 저장 (보안/아키텍처) — 해결

**조치:** `forgotPassword()` 에서 `this.hashToken(resetToken)` 값을 DB 에 저장하고 raw 토큰은 메일로만 발송. `findUserByResetToken()` 도 동일 해시로 조회하도록 수정. RefreshToken 과 동일한 SHA-256 해시 유틸 재사용.

- `auth.service.ts:285` — 저장 시 `passwordResetToken: this.hashToken(resetToken)`
- `auth.service.ts:415-420` — `findUserByResetToken()` 이 `this.hashToken(token)` 으로 조회
- 기존 `hashToken()` (`auth.service.ts:405`) 재사용 (DRY)

### #2 DEBUG 로그에 리셋/인증 토큰 URL 노출 (보안) — 해결

**조치:** `MAIL_TRANSPORT_CONSOLE` 환경에서만 raw URL 을 `logger.debug` 로 출력. 운영 환경(`smtp` 등)에서는 토큰을 포함한 전체 URL 을 로깅하지 않음.

- `mail.service.ts` — `sendVerificationEmail`, `sendPasswordResetEmail` 모두 `if (this.transport === MAIL_TRANSPORT_CONSOLE)` 가드 적용
- `[DEV]` 접두사 제거 (`logger.debug` 레벨 자체가 개발용이므로 중복 표기)

### #3 DB 업데이트 실패 시 안티-열거 보호 미적용 (보안) — 해결

**조치:** `forgotPassword()` 전체(`findByEmail` ~ 메일 발송)를 `try/catch` 로 감싸 DB 오류/메일 오류를 구분 없이 삼키도록 수정. 모든 실패 경로에서 동일 응답을 반환하여 이메일 열거를 방어.

- `auth.service.ts:280-300`

### #7 Rate Limiting 부재 (보안/API) — 해결

**조치:** `POST /auth/forgot-password` 에 `@Throttle({ default: { ttl: 60_000, limit: 5 } })` 적용. IP 당 분당 5회로 제한하여 대량 발송을 차단. 전역 throttler(100/min) 보다 엄격.

- `auth.controller.ts:18, 359`

### #8 DB 업데이트 실패 경로 테스트 누락 (테스트) — 해결

**조치:** `'should return the same message even if the DB update fails'` 테스트 추가. `usersService.update.mockRejectedValueOnce` 로 오류를 주입하고, 응답 메시지가 성공 케이스와 동일한지 + 메일 발송이 호출되지 않는지 검증.

- `auth.service.spec.ts` `describe('forgotPassword', ...)` 내

### #9 만료 시간 정밀 검증 부재 (테스트) — 해결

**조치:** `passwordResetExpiresAt` 가 현재 시각 + 29~30분 범위 내에 있는지 명시적으로 검증. `expect.any(Date)` 보다 강화된 단언.

- `auth.service.spec.ts` `'should persist a hashed token and mail the raw token to the user'` 테스트

### #12 주석 코드 잔존 (유지보수성) — 해결

**조치:** `sendVerificationEmail` 내부 주석처리된 이전 버전 코드 블록 제거. 해시 저장과 함께 로그 가드 로직을 실제로 적용하여 `[DEV]` 접두사도 제거.

- `mail.service.ts`

### #13 `sendPasswordResetEmail` JSDoc 누락 (문서화) — 해결

**조치:** `sendPasswordResetEmail` + `sendVerificationEmail` 두 public 메서드 모두 JSDoc 추가. 링크 유효기간(각각 30분/24시간)과 토큰 URL 로깅 정책을 문서화.

### #14 메일 실패 테스트에서 `usersService.update` 호출 미검증 (테스트) — 해결

**조치:** `'should return the same message even if mail dispatch fails'` 테스트에 `expect(usersService.update).toHaveBeenCalled()` 단언 추가.

---

## 추가로 해결한 INFO 급 이슈

- `buildPasswordResetText` / `buildVerificationText` 의 name 은 평문 컨텍스트(header/body 어느쪽도 이스케이프 대상 아님)이나, DB 를 통한 해시 검증 라운드트립을 검증하는 신규 테스트(`resetPassword (token hashing)` describe)를 추가하여 해시 공격 경로를 실제로 exercise.

---

## 후속 과제 (본 PR 스코프 제외, 별도 이슈로 기록 필요)

다음 항목은 이번 PR 의 변경 범위를 크게 벗어나거나 기존 전반 아키텍처 변경을 요구하므로 별도 작업으로 분리합니다.

| # | 이슈 | 스코프/사유 |
|---|------|-----------|
| #4 TOCTOU 경쟁 조건 | 동시 요청 시 기존 토큰 덮어쓰기 | 대부분의 비밀번호 재설정 플로우에서 "최신 토큰만 유효"는 허용 가능한 동작. 별도 검토 후 변경 여부 결정 |
| #5 `passwordResetToken` 컬럼 인덱스 부재 | DB 마이그레이션 동반 | `emailVerifyToken` 도 동일 이슈. 두 컬럼 인덱스 + 마이그레이션을 묶어서 별도 PR 처리 권장. 현재 해시 저장으로 전환했으므로 충돌 가능성은 라이트. |
| #6 `AuthService` 에서 Repository 직접 접근 | 아키텍처 리팩토링 | `findUserByVerifyToken` / `findUserByResetToken` 둘 다 동일 패턴. `UsersService` 에 메서드 추가하는 작업은 기존 코드 전반을 건드리므로 분리 |
| #10, #11 `mail.service.ts` 코드 중복 | 리팩토링 | `dispatch(to, options)` + `buildEmailWrapper(content)` 추출. 기존 세 메서드 공통화. 별도 리팩토링 PR 로 분리 |
| `emailVerifyToken` 평문 저장 | #1 과 동일 성격의 기존 이슈 | 이번 PR 은 비밀번호 재설정만 다룸. 이메일 인증 토큰도 동일 방식으로 해싱해야 하나, 기존 가입자 데이터 마이그레이션 고려 필요 — 별도 작업 |

---

## 재검증 결과

1. `npm run lint` — 통과 (경고/오류 0)
2. `npm test` — **1301 passed / 1301** (이전 1299 대비 신규 2건 추가)
3. `npm run build` — 통과

## E2E 검증 (수동)

- `backend/.env.MAIL_TRANSPORT=console` 상태에서 `/forgot-password` → 이메일 입력 → 제출
  - 백엔드 로그: `Password reset email sent to ...` + 개발 환경에서만 raw URL 출력
  - DB `user.password_reset_token` 컬럼에 64자 hex (SHA-256) 저장 확인
- 이메일 링크(`/reset-password?token=<raw>`) 에서 새 비밀번호 설정 → 성공
- 동일 토큰 재사용 시 "Invalid or expired reset token" 반환 (토큰은 `resetPassword` 성공 시 null 로 초기화)
- 미가입 이메일로 제출 시 동일 성공 메시지 반환 (이메일 열거 방어)
- 동일 IP 에서 6회째 요청 시 HTTP 429 (`@Throttle` 적용)
