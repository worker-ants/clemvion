---
worktree: TBD
started: 2026-05-19
owner: TBD
---

# 2FA WebAuthn — Follow-up 작업 묶음

> 작성일: 2026-05-19
> 선행 plan: `plan/complete/2fa-webauthn.md` (PR merge 완료 후 이동 예정)

본 plan 은 2fa-webauthn 본 PR (TOTP + WebAuthn 도입) 의 scope 밖이지만, 같은 영역에서
후속 처리가 필요한 항목들을 별도 plan 으로 추적한다. 각 항목은 독립적으로 별 PR 로
처리 가능하며, 이 plan 은 항목별로 worktree 를 새로 만들어 진행한다.

## 작업 항목

### 1. `requiresTotp` deprecated 필드 제거

- [ ] 2 마이너 버전 경과 확인
- [ ] `methods` 만 보는 신규 프론트엔드가 동일 배포에 포함되어 있는지 확인
- [ ] `LoginChallengeDto.requiresTotp` 제거, `auth.service.ts login()` 에서 미발급
- [ ] 클라이언트(`lib/api/auth.ts`) 의 deprecated 필드 분기 제거
- [ ] spec/5-system/1-auth.md §1.4.2 의 deprecate 안내 삭제

관련: `spec/5-system/1-auth.md §1.4.2` (제거 조건 두 항목)

### 2. 백엔드 WebAuthn e2e (`webauthn-2fa.e2e-spec.ts`)

- [ ] SoftWebAuthnDevice helper — Ed25519 키 쌍 생성 + attestation/assertion 합성, base64url 직렬화
- [ ] 시나리오: 등록 → 인증 → counter 갱신 → counter 역행 시 401 + credential 삭제 + 세션 revoke → 복구 코드 fallback → 마지막 credential 삭제 시 recovery NULL
- [ ] `requireUserVerification: true` 정책에 맞춘 flag 합성

본 PR 의 webauthn.service.spec.ts 가 라이브러리 mock 으로 24 케이스 회귀 잠금 중이라 e2e 는 별 PR 로 분리.

### 3. mobile Safari 실기기 수동 검증

- [ ] iPhone Safari (Passkey, conditional UI), Android Chrome 정상 동작 확인
- [ ] 가능 시 BrowserStack 자동화 통합

### 4. WebAuthn-only 계정의 비밀번호 재설정 흐름

- [ ] 현재 `passwordResetToken` 흐름이 WebAuthn-only 사용자에게도 동작하는지 검증
- [ ] 비밀번호 미설정 사용자가 reset 시도 시 UX 결정
- [ ] 필요 시 spec/5-system/1-auth.md 보완

### 5. 기존 컨트롤러 응답 wrap 일관성 정리

- [ ] `auth.controller.ts forgotPassword()` — `return { data: ... }` wrap 적용 + 호출 e2e 검증
- [ ] `auth.controller.ts checkEmail()` — 동일
- [ ] Swagger 선언과 실제 응답 일치 확인

본 PR scope 외 기존 코드 버그 (ai-review C-3/C-4).

### 6. Session/LoginHistory DTO 이중 중첩 해소

- [ ] `SessionListDto.data` → `items` 개명
- [ ] `LoginHistoryPageDto.data` → `items` 개명
- [ ] 프론트엔드 호출처 갱신
- [ ] e2e/spec 검증

### 7. WebAuthn verify 트랜잭션 + pessimistic lock 강화

- [ ] `WebAuthnService.verifyAuthentication` 을 `dataSource.transaction` 으로 wrap
- [ ] credential 조회에 `lock: { mode: 'pessimistic_write' }` 적용
- [ ] counter 갱신 + LoginHistory 기록을 트랜잭션 내부에 배치 (race condition 완화)

관련: 본 PR `webauthn.service.ts:265-275` 의 race condition 코멘트.

### 8. AuthModule 분리 (WebAuthnModule 서브모듈)

- [ ] `codebase/backend/src/modules/auth/webauthn/` 으로 entity·service·controller·DTO·tests 이동
- [ ] `AuthModule` 이 `WebAuthnModule` 을 import 하는 형태로 경계 분리
- [ ] 단방향 의존성 유지 (`AuthService` ↔ `WebAuthnService` 양방향 호출 제거 검토)

### 9. `LoginChallengeDto` union 분리

- [ ] `AccessTokenResponseDto` / `TwoFactorChallengeResponseDto` 분리
- [ ] Swagger `oneOf` 로 응답 스키마 표기
- [ ] 클라이언트 타입 가드 패턴 정리

### 10. V058 마이그레이션 NOT VALID 2-step 분리 — **의도적 미실행 + 컨벤션 보강으로 종결**

- [x] V058 사후 분리는 의미 없음을 확인 — 이미 production 적용 (락 이미 잡혔다 풀림). DROP→NOT VALID ADD→VALIDATE 3-step 우회는 단일 statement 보다 총 락 윈도우가 *더 길어짐*. (spec §1.4.G)
- [x] `spec/5-system/1-auth.md` Rationale 1.4.G 추가 — 단일 statement 채택 조건·미래 분기 기준
- [x] `codebase/backend/migrations/README.md §1` 에 "예외 인정 조건" 절 추가 (append-only + 신규 enum + DBA review)
- [ ] (열린 follow-up) `login_history` 1M row 도달 모니터링 — 도달 시 다음 CHECK 변경부터 NOT VALID 2-step 의무화

## 수용 기준

- 각 항목은 독립 PR 로 merge
- 항목 완료 시 본 plan 의 해당 체크박스 [x] 처리, 모두 완료되면 `plan/complete/` 로 git mv

## 의존성·리스크

- 항목 1 (`requiresTotp` 제거) 는 호환성 영향이 가장 큼 — 신규 프론트엔드 배포 확인이 전제
- 항목 7 (트랜잭션 wrap) 은 다른 서비스의 트랜잭션 패턴과 동기화 필요
- 항목 5/6 은 다른 API 사용처에 영향 — Swagger 스키마 변경 클라이언트 호환성 확인 필수
