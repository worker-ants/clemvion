# Cross-Spec 일관성 검토 결과

**검토 모드**: `--impl-done` (scope=spec/5-system/1-auth.md, diff-base=origin/main)
**대상 변경**: `sessions.service.ts` bcrypt → `comparePassword`, `webauthn.controller.ts` bcrypt + UsersService 제거 → `authService.verifyPasswordForUser` 위임

---

## 발견사항

### [INFO] 코드 주석이 `data-flow/2-auth.md §1.2` 를 근거로 인용하나 해당 섹션은 로그인 흐름 서술
- **target 위치**: `auth.service.ts` L54 주석 — `"data-flow/2-auth.md §1.2 가 bcrypt 비교를 일관되게 AuthService 에 배치한다(레이어 정렬)"`
- **충돌 대상**: `spec/data-flow/2-auth.md §1.2` — 로그인(Local + 2FA) 시퀀스 다이어그램 섹션
- **상세**: §1.2 는 로그인 플로우의 bcrypt.compare 순서를 기술한 것으로, "AuthService 에 배치" 라는 레이어 정렬 원칙을 명문화하지는 않는다. 주석이 인용하는 SoT 섹션 번호가 실제 내용과 완전히 일치하지 않는다.
- **제안**: 코드 주석 수정 불필요 (구현 동작 자체는 정합). 향후 spec 갱신 시 `data-flow/2-auth.md` 에 `verifyPasswordForUser` 레이어 정렬 결정을 명시하는 것이 권장된다. spec 변경 없이 INFO 수준.

### [INFO] `WebAuthnModule` 이 여전히 `UsersModule` 을 import 하나 `WebAuthnController` 는 `UsersService` 의존 제거
- **target 위치**: `webauthn.controller.ts` diff — `UsersService` 제거 (`-import UsersService`, `-private readonly usersService`)
- **충돌 대상**: `spec/5-system/1-auth.md §Rationale 1.4.H` — WebAuthn 모듈 분리 규약 (`WebAuthnModule → AuthModule` 단방향 의존성 명시)
- **상세**: `WebAuthnController` 에서 `UsersService` 직접 의존이 제거됐지만 `webauthn.module.ts` 는 `UsersModule` import 를 보존하고 있다. `WebAuthnService` 내부에서 `UsersService` 를 여전히 사용하기 때문에 `UsersModule` import 자체는 정당하며 spec Rationale 1.4.H 의 "단방향 의존성" 원칙을 위반하지 않는다. controller 계층에서의 불필요한 직접 의존만 제거된 것으로, 모듈 수준 의존 구조는 변경 없음.
- **제안**: 변경 없이 유지. 정합 확인 완료.

### [INFO] `sessions.service.ts` 내부 재인증 경로는 `comparePassword` 로 통일됐으나 spec 에 명문화 없음
- **target 위치**: `sessions.service.ts` L246 — `comparePassword(auth.password, user.passwordHash!)`
- **충돌 대상**: `spec/5-system/1-auth.md §2.3` 세션 강제 종료 재인증 항목, `spec/data-flow/2-auth.md §1.5`
- **상세**: `sessions.service.ts` 의 비밀번호 비교가 `bcrypt.compare` 직접 호출에서 `comparePassword` 헬퍼로 변경됐다. 이는 `spec/5-system/1-auth.md §1.1` 가 정의하는 "bcrypt (cost factor ≥ 12)" 저장·검증 정책과 완전히 일치하며, 헬퍼는 동일 bcrypt.compare 를 래핑할 뿐이다. spec 이 `comparePassword` 헬퍼 사용을 명시적으로 요구하지는 않으나 위배도 없다.
- **제안**: 변경 없이 유지.

### [INFO] `WebAuthnController.webauthnRegenerateRecovery` 비밀번호 재확인 위임 — spec §5 엔드포인트 표와 동작 일치
- **target 위치**: `webauthn.controller.ts` diff L189 — `await this.authService.verifyPasswordForUser(user.sub, dto.password)`
- **충돌 대상**: `spec/5-system/1-auth.md §5` — `POST /api/auth/2fa/webauthn/recovery-codes/regenerate` 항목: "인증 필수(JWT) + 본문에 `password` 재확인. 기존 미사용 코드 폐기 후 10개 새로 발급"
- **상세**: 변경 전 컨트롤러는 `UsersService.findById` + `bcrypt.compare` 를 직접 수행했고, 변경 후에는 `AuthService.verifyPasswordForUser` 로 위임한다. 에러 코드(`PASSWORD_REQUIRED` / `PASSWORD_INVALID`) 와 HTTP 401 shape 가 그대로 유지되며 spec §5 의 동작 계약을 충족한다. 데이터 모델 §2.1 의 `password_hash` nullable 처리(`USER` 미존재 / OAuth-only = `PASSWORD_REQUIRED`) 도 정합.
- **제안**: 변경 없이 유지.

---

## 요약

이번 변경은 `sessions.service.ts` 와 `webauthn.controller.ts` 두 파일에서 `bcrypt` 직접 호출을 `comparePassword` 헬퍼 (단일 진입점) 로 통일하고, `WebAuthnController` 의 비밀번호 재확인 로직을 `AuthService.verifyPasswordForUser` 로 위임한 레이어 정렬 리팩터링이다. `spec/5-system/1-auth.md` 가 정의하는 인증 정책(bcrypt cost ≥ 12, `PASSWORD_REQUIRED`/`PASSWORD_INVALID` 에러 코드, 401 shape, 세션 재인증 의미론), `spec/1-data-model.md §2.1` User 엔티티의 `password_hash` nullable 처리, `spec/data-flow/2-auth.md` 의 흐름 계약 어느 것과도 충돌하지 않는다. 발견된 사항은 모두 코드 주석의 SoT 인용 정확도 및 spec 명문화 권장(INFO) 수준으로, CRITICAL/WARNING 충돌은 없다.

---

## 위험도

NONE
