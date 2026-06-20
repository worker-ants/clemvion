# Rationale 연속성 검토 결과

검토 모드: `--impl-done`, scope=`spec/5-system/1-auth.md`, diff-base=`origin/main`

---

## 발견사항

- **[INFO]** `comparePassword` 헬퍼 도입 — `data-flow/2-auth.md §1.2` 에서 bcrypt 비교가 AuthService(Svc) 에 배치됨을 시퀀스 다이어그램으로 암묵적으로 정의하고 있음
  - target 위치: `sessions.service.ts` diff (`-import * as bcrypt from 'bcrypt'` → `+import { comparePassword } from '../../common/utils/password.util'`) 및 `sessions.service.ts` 주석 `comparePassword 헬퍼로 검증`
  - 과거 결정 출처: `spec/data-flow/2-auth.md §1.2` 시퀀스 다이어그램 (`Svc->>Svc: bcrypt.compare(password, password_hash)`). SessionsService 의 `verifyReauth` 내부 bcrypt.compare 는 이 다이어그램의 '로그인 경로'와 별개 경로이며 기존 Rationale 에 명시적 금지·허용 언급이 없음
  - 상세: `sessions.service.ts` 의 `verifyReauth` 가 raw `bcrypt.compare` 대신 공통 헬퍼 `comparePassword` 로 교체된 것은 레이어 정렬(비밀번호 비교 로직을 공통 유틸에 응집)을 목적으로 한다. 기존 Rationale 에는 이 교체를 '기각된 대안' 으로 명시한 항목이 없다. 다만 spec `data-flow/2-auth.md §1.2` 다이어그램의 `Svc->>Svc: bcrypt.compare` 표기가 `comparePassword` 위임으로 바뀌는 것이라, 다이어그램이 약간 stale 해지나 구현 의도와 충돌하지는 않는다.
  - 제안: `data-flow/2-auth.md §1.2` 다이어그램의 `bcrypt.compare` 표기를 `comparePassword(password, password_hash)` 로 갱신해 코드와 일치시키면 연속성 보완이 완성됨. Rationale 추가는 불필요.

- **[INFO]** `WebAuthnController.webauthnRegenerateRecovery` — controller 내 raw bcrypt 제거 후 `AuthService.verifyPasswordForUser` 위임
  - target 위치: `webauthn/webauthn.controller.ts` diff (controller 에서 `bcrypt.compare` + `usersService.findById` 직접 수행 → `authService.verifyPasswordForUser` 위임)
  - 과거 결정 출처: `spec/5-system/1-auth.md §1.4.H` (AuthModule → WebAuthnModule 단방향 의존 원칙), `spec/data-flow/2-auth.md §1.2` (bcrypt 비교를 Svc 레이어에 배치하는 사실상의 컨벤션), `auth.service.ts` 코드 주석 ("data-flow/2-auth.md §1.2 가 bcrypt 비교를 일관되게 AuthService 에 배치한다(레이어 정렬)")
  - 상세: 이번 변경은 spec `1-auth.md §1.4.H` 가 명시한 단방향 의존성 원칙(`AuthModule → WebAuthnModule`)과 정합한다. 기존에는 `WebAuthnController` 가 `UsersService.findById` + raw `bcrypt.compare` 를 직접 호출해 비밀번호 검증 로직을 controller 레이어에 두는 원칙 위반 패턴이 있었고, 이번 변경이 이를 AuthService 로 이관해 레이어를 정렬한다. 기각된 대안의 재도입이나 합의된 원칙 위반에 해당하지 않는다.
  - 제안: `spec/5-system/1-auth.md § Rationale` 에 "비밀번호 재확인(re-verify)의 단일 서비스 경로 — `AuthService.verifyPasswordForUser`" 항목을 추가해, WebAuthn 복구 코드 재발급·TOTP 비활성화 등 여러 민감 액션에서 동일 패턴이 쓰임을 문서화하면 연속성이 강화됨.

- **[INFO]** `SessionsService.revokeFamily` 5번째 파라미터 `currentRefreshToken: string | null` 추가 — self-revoke 차단 경로 커버리지 보완
  - target 위치: `sessions.service.ts` / `sessions.service.spec.ts` diff (`revokeFamily` 시그니처에 `currentRefreshToken` 추가, self-revoke 분기 테스트 신설)
  - 과거 결정 출처: `spec/data-flow/2-auth.md §1.5` ("현재 요청의 refreshToken 쿠키와 매칭되는 family 는 self-revoke 차단 (400 `CANNOT_REVOKE_CURRENT_SESSION`)") / `spec/5-system/1-auth.md §2.3` 세션 정책 표
  - 상세: spec 은 이미 self-revoke 차단을 `400 CANNOT_REVOKE_CURRENT_SESSION` 으로 명시하고 있다. 기존 구현은 5번째 인자를 생략(undefined)해 이 분기가 dead-path 였고, 이번 변경이 이를 활성화한다. Rationale 에서 명시적으로 기각된 대안(예: 'self-revoke 허용')이 재도입된 것이 아니라, 이미 합의된 spec 동작을 구현 수준에서 보완한 것이다. 합의된 원칙에 부합한다.
  - 제안: 없음 (spec 이미 정의, 구현이 spec 을 따르는 방향).

---

## 요약

이번 diff 의 세 변경 — (1) `bcrypt` 직접 import 를 공통 `comparePassword` 헬퍼로 교체, (2) `WebAuthnController` 의 raw bcrypt + usersService 직접 참조를 `AuthService.verifyPasswordForUser` 로 일원화, (3) `revokeFamily` 의 currentRefreshToken 파라미터 추가 — 은 각각 `spec/5-system/1-auth.md §1.4.H` (단방향 의존성), `spec/data-flow/2-auth.md §1.2` (bcrypt 비교는 Svc 레이어에 배치), `spec/data-flow/2-auth.md §1.5` (self-revoke 차단 400) 의 기존 합의 원칙과 정합한다. 명시적으로 기각된 대안을 재도입하거나 합의된 invariant 를 위반하는 항목은 발견되지 않았다. `data-flow/2-auth.md §1.2` 다이어그램의 `bcrypt.compare` 표기가 코드와 미묘하게 stale 해지는 점과, `verifyPasswordForUser` 단일 경로 선택 근거를 Rationale 에 명시하지 않은 점이 보완 권고 수준이다.

---

## 위험도

LOW
