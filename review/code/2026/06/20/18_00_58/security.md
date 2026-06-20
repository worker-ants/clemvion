### 발견사항

- **[INFO]** `comparePassword` 헬퍼 래핑 — bcrypt 노출 감소, 알고리즘 교체 범위 한정
  - 위치: `codebase/backend/src/common/utils/password.util.ts` L22-24, `sessions.service.ts` L246
  - 상세: `bcrypt.compare` 직접 호출을 `comparePassword` 단일 진입점으로 위임. bcrypt rounds(12) SoT 일원화. 알고리즘 교체 시 변경 범위가 `password.util.ts` 한 곳으로 국한되는 긍정적 패턴.
  - 제안: 현재 구현 유지. 추후 Argon2 등 전환 시 이 모듈만 수정하면 된다.

- **[INFO]** `verifyPasswordForUser` 서비스 레이어 위임 — Controller의 raw bcrypt 제거
  - 위치: `webauthn.controller.ts` L1125
  - 상세: 이전 Controller가 직접 `bcrypt.compare`를 호출하던 패턴(레이어 위반)을 `AuthService.verifyPasswordForUser`로 위임. 에러 코드(`PASSWORD_REQUIRED`/`PASSWORD_INVALID`)·401 shape 동일 보존 확인.
  - 제안: 변경 방향 적절. 추가 조치 불필요.

- **[WARNING]** `verifyPasswordForUser` 실패 시 타이밍 사이드채널 잠재 위험
  - 위치: `codebase/backend/src/modules/auth/auth.service.ts` L65-70
  - 상세: `!user || !user.passwordHash` 조건에서 사용자 미존재 시 `comparePassword`를 호출하지 않고 즉시 throw한다. bcrypt.compare는 수백 ms 소요되는 반면 early-exit는 수 ms 내 응답하므로, 응답 시간으로 userId 존재 여부를 추측하는 타이밍 오라클이 될 수 있다. 이 엔드포인트(`POST /auth/2fa/webauthn/recovery-codes/regenerate`)는 JWT 인증 후 호출되므로 공격자가 이미 유효한 JWT를 보유하고 있어야 한다는 점에서 실제 위험도는 제한적이다.
  - 제안: JWT 인증 이후 경로이므로 현재 위험도는 낮음. 단, 완전한 방어를 원하면 미존재/OAuth-only 사용자에 대해서도 dummy bcrypt 비교(`bcrypt.compare(plain, '$2b$12$dummyhash...')`)를 실행한 후 throw하는 패턴 적용 가능.

- **[INFO]** `sessions.service.ts` `verifyReauth` — 다중 인증 경로의 단락 평가 순서
  - 위치: `sessions.service.ts` L299-326
  - 상세: 비밀번호와 TOTP 모두 보유한 사용자는 비밀번호 입력 시 비밀번호만 검증(단락)하고, totpCode만 입력 시 TOTP만 검증한다. 둘 다 미입력 시 `REAUTH_REQUIRED` throw. 이 설계는 의도적(spec §3)이며 보안상 문제 없음. 단, 둘 다 보유한 사용자가 비밀번호를 잘못 입력했을 때 TOTP 경로로 fallback되지 않고 즉시 `PASSWORD_INVALID`를 던지는 동작은 명시적이고 안전하다.
  - 제안: 현재 구현 적절.

- **[INFO]** `resolveCurrentFamilyId` — SHA-256 토큰 해시 조회
  - 위치: `sessions.service.ts` L329-338
  - 상세: refresh token을 SHA-256으로 해시하여 DB 조회. 평문 토큰을 DB에 저장하지 않는 올바른 패턴. `isRevoked: false` 조건 포함.
  - 제안: 현재 구현 적절.

- **[INFO]** 에러 메시지 — 정보 노출 수준 적절
  - 위치: `sessions.service.ts` L139-144, L302-305, L315-318
  - 상세: 타인의 family든 없는 family든 동일하게 404 반환(정보 누출 방지 명시). 비밀번호/TOTP 실패 시 에러 코드는 노출되나 내부 스택 트레이스·사용자 존재 여부는 노출되지 않는다.
  - 제안: 현재 구현 적절.

- **[INFO]** 테스트 파일 — 평문 패스워드 하드코딩
  - 위치: `webauthn.controller.spec.ts` L435, L449
  - 상세: `'OldP@ssw0rd1'`, `'WrongPass!'` 가 테스트 코드에 하드코딩. 테스트 픽스처이므로 프로덕션 시크릿 아님. 실제 자격증명이 아닌 mock이 이 값으로 호출되는지를 검증하는 코드다.
  - 제안: 테스트 목적상 허용 가능. 프로덕션 코드에 반영되지 않음.

- **[INFO]** `webauthnRegenerateRecovery` — rate limiting/brute-force 보호 부재
  - 위치: `webauthn.controller.ts` L1119-1128
  - 상세: plan 파일에 "2FA disable·webauthn regenerate brute-force 보호(별도 보안, behavior-change)" 가 명시적으로 후속 작업으로 분류되어 있다. 현재 변경 범위(refactoring only)에서는 새로 도입되는 취약점이 아님.
  - 제안: 후속 별도 작업에서 rate limiting 구현 필요. 현재 변경에서는 블로킹 이슈 아님.

### 요약

이번 변경은 Controller 레이어의 raw `bcrypt.compare` 직접 호출을 `AuthService.verifyPasswordForUser`로, `SessionsService`의 raw `bcrypt.compare`를 `comparePassword` 유틸 헬퍼로 이관하는 behavior-preserving 리팩터링이다. 암호화 알고리즘(bcrypt 12 rounds) 자체는 변경되지 않았으며, 에러 코드·에러 shape·401 응답은 이전과 동일하게 보존된다. 하드코딩된 시크릿, SQL 인젝션, XSS, 경로 탐색 등 주요 OWASP Top 10 취약점은 이번 diff에서 발견되지 않는다. `verifyPasswordForUser`의 early-exit 타이밍 차이가 이론적 사이드채널이 될 수 있으나, JWT 인증 후 호출 경로임을 감안하면 실제 위험도는 낮다. brute-force 보호 부재는 plan에 후속으로 명시되어 있어 이번 범위 밖임이 명확하다. 전체적으로 보안 관점에서 이번 변경은 적절하며 기존 보안 수준을 저하시키지 않는다.

### 위험도

LOW
