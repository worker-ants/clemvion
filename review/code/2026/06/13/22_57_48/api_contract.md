# API 계약(API Contract) 리뷰

## 발견사항

### [WARNING] `POST /users/me/change-password` 응답 스키마 breaking change — `success` → `accessToken`
- 위치: `codebase/backend/src/modules/users/dto/responses/user-response.dto.ts` (`PasswordChangeResultDto`), `codebase/backend/src/modules/users/users.controller.ts` `changePassword` (`return { data: { accessToken } }`)
- 상세: 응답 본문이 `{ data: { success: true } }` 에서 `{ data: { accessToken: string } }` 로 변경됐다. `success` 필드가 제거된 명백한 breaking change다. 기존 클라이언트가 `res.data.data.success` 를 참조하거나 응답 후 자체 토큰 갱신을 하지 않던 코드는 동작이 달라진다. 변경의 본질(옵션 B 세션 회전)상 새 토큰 반환은 정당하나, 계약 변경 자체는 클라이언트 동기 변경을 요구한다.
- 완화 요인: (1) 동일 PR 에서 유일 클라이언트인 frontend `change-password/page.tsx` 가 `setAccessToken(res.data.data.accessToken)` 으로 함께 갱신됐고 테스트도 동반 수정됨. (2) 내부 1st-party API 이며 외부 공개 SDK 가 아님. (3) Swagger DTO/`description` 이 정확히 갱신됨. 따라서 실질 위험은 낮으나, 응답 스키마의 필드 제거이므로 WARNING 으로 기록.
- 제안: 외부 통합/모바일 등 frontend 외 소비자가 없는지만 확인. 없다면 현 변경으로 충분. (선택) `success` 를 보존해 `{ success: true, accessToken }` 로 두면 비파괴적이나, 옵션 B 의미상 `accessToken` 단일 필드가 더 명확하므로 강제 아님.

### [INFO] 세션 회전 후 refresh 쿠키 회전 — `Set-Cookie` 동반
- 위치: `users.controller.ts` `changePassword` — `setRefreshTokenCookie(res, tokens.refreshToken, { cookieDomain })`
- 상세: 비밀번호 변경 성공 시 전 세션 revoke + 현재 디바이스 재발급으로 `Set-Cookie: refreshToken=` 가 응답에 포함된다. 기존 refresh/login 경로와 동일한 `setRefreshTokenCookie` 유틸·동일 cookieDomain 설정을 재사용해 쿠키 속성 일관성이 유지된다. e2e(`users-change-password.e2e-spec.ts`)가 `Set-Cookie` 및 활성 family 1건을 검증. 계약상 적절.

### [INFO] 에러 응답 형식·HTTP 상태 코드 일관성 유지
- 위치: `users.service.ts` `changePassword`, `users.controller.ts`
- 상세: 도메인 로직을 service 로 이전(B-2)하면서도 에러 계약을 보존: `USER_NOT_FOUND`(404), `INVALID_PASSWORD`(401, OAuth-only/불일치 공통), 강도 위반은 `validatePasswordStrength` 의 `BadRequestException`(400). Swagger 의 `@ApiBadRequestResponse`/`@ApiUnauthorizedResponse`/`@ApiNotFoundResponse` 데코레이터와 일치. code 문자열·상태 코드가 이전과 동일하게 유지되어 에러 계약은 비파괴적.

### [INFO] 2FA/WebAuthn 엔드포인트 — 시그니처에 `@Req()` 추가, 외부 계약 불변
- 위치: `auth.controller.ts` `verify2fa`/`disable2fa`, `webauthn.controller.ts` `webauthnRegisterVerify`/`webauthnDelete`
- 상세: `@Req() req` 매개변수 추가는 컨트롤러 메서드 시그니처 변경일 뿐 HTTP 요청/응답 계약(URL·바디·응답 본문)에는 영향 없다. `ipAddress` 는 감사 로그(audit_log) 내부 기록 필드로만 쓰이며 응답 본문에 노출되지 않는다. RESTful 경로·인증(`@ApiBearerAuth`/`JwtAuthGuard`) 모두 불변. 계약 무영향.

### [INFO] 인증/인가·경로 설계 불변
- 위치: `users.controller.ts` (`@Controller('users')` + `@UseGuards(JwtAuthGuard)`), `webauthn.controller.ts` (`@Controller('auth/2fa/webauthn')`)
- 상세: 가드·경로·네이밍 모두 그대로다. `forwardRef` 기반 `AuthService` 주입(A-1)은 DI 배선 변경으로 외부 계약과 무관. 목록/페이지네이션 신규 엔드포인트 없음.

## 요약
API 계약 관점의 유일한 실질 변경은 `POST /users/me/change-password` 응답 본문이 `{ data: { success: true } }` 에서 `{ data: { accessToken } }` 로 바뀐 점이다. 필드 제거를 동반하는 breaking change지만, 동일 PR 에서 유일 소비자인 frontend 가 `setAccessToken` 으로 함께 갱신되고 테스트(unit/e2e/frontend)가 모두 동반 수정됐으며, Swagger DTO·`description`·에러 계약(상태 코드·code 문자열)이 정확히 유지되어 실질 위험은 낮다. 세션 회전에 따른 `Set-Cookie` refresh 쿠키 회전은 기존 유틸을 재사용해 일관적이다. 2FA/WebAuthn 컨트롤러의 `@Req()` 추가는 내부 시그니처 변경일 뿐 HTTP 계약에 영향이 없다.

## 위험도
LOW
