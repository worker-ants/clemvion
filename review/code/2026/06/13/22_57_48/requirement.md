# 요구사항(Requirement) Review — refactor 04 후속 (A-1 세션회전 · B-1 ipAddress · B-2 SRP · C DRY/e2e)

## 발견사항

- **[INFO]** spec 과 코드가 동기 갱신됨 — SPEC-DRIFT 아님
  - 위치: `spec/5-system/1-auth.md` §2.3(L276)·§4.3(L401)·Rationale 2.3.C(L581-598), `spec/data-flow/1-audit.md` §1.1(L59-87)·§1.2(L106), `spec/2-navigation/9-user-profile.md` §2.2(L109)·API표(L303)
  - 상세: 본 변경에 대응하는 spec 본문이 이미 모두 갱신돼 있다. 옵션 B(전 family revoke + 현재 디바이스 재발급), `{ accessToken }` 응답 계약, refresh 쿠키 회전, user.* 5개 행 `ipAddress` 동반, `session_revoked`(bulk, `familyId=null`) 의미 확장이 코드와 line-level 로 일치한다. spec draft(`plan/in-progress/spec-draft-pwchange-revoke-user-ip.md`)가 실제 spec 에 반영 완료된 상태.
  - 제안: 조치 불요.

- **[INFO]** 비밀번호 변경 핸들러의 동작 순서 — 부분 성공 엣지 케이스
  - 위치: `codebase/backend/src/modules/users/users.controller.ts` `changePassword` (diff L138-190)
  - 상세: 순서는 `usersService.changePassword`(비밀번호 교체 커밋) → `rotateSessionAfterPasswordChange`(revoke+재발급) → `setRefreshTokenCookie` → `auditLogsService.record`. 비밀번호 교체가 이미 커밋된 뒤 rotate 가 throw(`UNAUTHENTICATED` — 사용자가 그 순간 사라진 극단 케이스)하면 감사 기록이 남지 않고 요청은 실패한다. spec Rationale 2.3.C 가 "revoke/재발급 실패가 비밀번호 변경 주 동작을 깨지 않도록 best-effort" 를 권고하나, 현재 구현은 rotate 실패를 호출자로 전파한다. 다만 audit `record` 자체는 내부적으로 예외를 삼키므로(감사 best-effort 는 충족) 주 동작에 영향 없음. rotate 실패 시나리오는 사용자 self 요청에서 거의 발생 불가하고, 발생 시 "비밀번호는 바뀌었으나 새 세션 미발급" 상태는 재로그인으로 회복 가능 — 수용 가능한 트레이드오프.
  - 제안: 현행 유지 가능. spec 의 best-effort 문구를 엄밀히 따르려면 rotate 를 try/catch 로 감싸 실패해도 200 을 반환하는 선택지가 있으나, 그러면 클라이언트가 새 accessToken 을 못 받아 in-memory token 이 stale 해지므로 오히려 현재 fail-loud 가 합리적. 조치 불요.

- **[INFO]** `revokeAllFamilies` 의 `affected: 0` → 감사 미기록 분기
  - 위치: `codebase/backend/src/modules/auth/sessions.service.ts` `revokeAllFamilies` (diff L477-504)
  - 상세: revoke 된 row 가 0건이면 `session_revoked` 를 기록하지 않는다. 비밀번호 변경 시점에 활성 family 가 0개인 경우(이론상 현재 세션의 refresh 가 이미 만료/revoke)는 정상이며, e2e 는 `>= 1` 로 검증해 이 경계를 침범하지 않는다. spec §4.3·data-flow §1.2 의 "1건 기록" 은 "revoke 가 1건 이상이면" 전제이므로 일치. 테스트(no-op 케이스)로도 커버됨.
  - 제안: 조치 불요.

- **[INFO]** `forwardRef` 순환 의존 해소 — 정상
  - 위치: `auth.module.ts`(L213-221) / `users.module.ts`(L1224-1228) / `users.controller.ts` 생성자 `@Inject(forwardRef(() => AuthService))`
  - 상세: AuthModule↔UsersModule 양방향 `forwardRef` + UsersController 의 `@Inject(forwardRef())` 가 짝을 이루고, AuthModule 이 `AuthService` 를 `exports` 한다(확인됨). NestJS 순환 주입 규약 충족.
  - 제안: 조치 불요.

## 시그니처/계약 검증 결과 (모두 일치)

- `generateTokens(user, rememberMe=false, familyId?, ctx?, manager?)` — `rotateSessionAfterPasswordChange` 의 `generateTokens(user, false, undefined, ctx)` 호출이 표준 7일(`rememberMe=false`) 재발급으로 Rationale 2.3.C 와 일치.
- `setRefreshTokenCookie(res, token, { cookieDomain })` — rememberMe 미지정 시 7일 기본(`DEFAULT_MAX_AGE_MS = 7d`), spec 의 "remember-me 미승계" 일치.
- `auditLogsService.record({..., ipAddress?: string})` — `extractClientIp(req) ?? undefined` 변환이 DTO(`ipAddress?: string`)와 타입 일치, `if (entry.ipAddress)` 로 falsy(빈/undefined) 시 생략 — data-flow §1.1 "추출 불가 시 생략" 일치.
- `record` 는 try/catch 로 예외를 삼킴 — 감사 best-effort(주 동작 비파괴) 충족.
- `AuthContext { ip?, userAgent? }` — controller `authContextFromRequest` 반환·service 파라미터 타입 일치.
- DRY: `auth.controller.ts`·`webauthn.controller.ts` 의 중복 `authContextFromRequest` 가 `utils/auth-context.ts` 단일 함수로 통합, 양측 import 정상.
- 응답 계약: `PasswordChangeResultDto { accessToken }`, controller `{ data: { accessToken } }` 반환, FE `setAccessToken(res.data.data.accessToken)` 호출 — backend↔frontend 계약 일치. 잔존 `{ success: true }` 참조 없음(grep 확인).
- e2e helper `registerAndLogin` 이 `userId`·`accessToken` 반환 — e2e 검증(audit ip_address·session_revoked bulk·활성 refresh 1건) 유효.

## 요약
A-1(비밀번호 변경 시 전 family revoke + 현재 디바이스 재발급)·B-1(user.* 감사 ipAddress 동반)·B-2(changePassword 도메인 로직 service 이전)·C(authContextFromRequest DRY + e2e)의 구현이 기능적으로 완전하고, 관련 spec 본문(`auth §2.3`·`Rationale 2.3.C`·`data-flow §1.1/§1.2`·`user-profile`)과 line-level 로 일치한다. spec 은 코드와 동기 갱신돼 있어 SPEC-DRIFT 가 아니다. 시그니처·에러코드·기본값·검증 규칙·상태 전이가 모두 정합하며, TODO/FIXME·미구현 경로·반환값 누락 없음. 엣지 케이스(rotate 부분 실패·revoke 0건·OAuth-only)는 spec 의도대로 처리되거나 수용 가능한 트레이드오프로 문서화돼 있다. CRITICAL/WARNING 없음.

## 위험도
NONE
