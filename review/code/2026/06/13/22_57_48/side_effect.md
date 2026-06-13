# 부작용(Side Effect) Review

## 발견사항

### [INFO] 공개 API 응답 계약 변경: `POST /users/me/change-password` 의 body 형태가 바뀜
- 위치: `users.controller.ts` `changePassword`, `user-response.dto.ts` `PasswordChangeResultDto`
- 상세: 응답 본문이 `{ data: { success: true } }` → `{ data: { accessToken } }` 로 변경. 추가로 `Set-Cookie`(refresh 쿠키 회전)와 전 세션 revoke 라는 새 부작용이 정상 경로에 도입됨. 이는 의도된 동작(옵션 B, Rationale 2.3.C)이며 OpenAPI 설명·DTO 가 함께 갱신됨.
- 영향 분석: 구 `success` 필드 소비자를 backend/frontend 전역에서 검색했으나 잔존 소비자 없음. frontend(`page.tsx`)는 `res.data.data.accessToken` 으로 정확히 갱신했고 `setAccessToken` 으로 in-memory token 교체. 외부 API 클라이언트가 있다면 breaking 이나, 본 저장소 내부 소비자는 모두 일관.
- 제안: 없음. 계약 변경이 전 소비자에 전파됨.

### [INFO] 함수/메서드 시그니처 변경 — 모든 호출자 갱신 확인됨
- 위치: `auth.controller.ts`(`verify2fa`, `disable2fa`), `webauthn.controller.ts`(`webauthnRegisterVerify`, `webauthnDelete`), `users.controller.ts`(`changePassword`)
- 상세: 컨트롤러 핸들러들이 `@Req() req`(일부 `@Res() res`) 인자를 새로 받음. 이들은 NestJS 라우트 핸들러라 호출자는 프레임워크 라우팅뿐이며, 데코레이터 기반 주입이므로 외부 호출자 영향 없음. 대응 `.spec.ts` 들이 모두 `mockReq`/`mockRes` 를 추가 인자로 전달하도록 갱신됨(파일 1·10·13).
- 제안: 없음.

### [INFO] 신규 메서드 추가 — 순수 추가, 기존 동작 불변
- 위치: `auth.service.ts` `rotateSessionAfterPasswordChange`, `sessions.service.ts` `revokeAllFamilies`, `users.service.ts` `changePassword`
- 상세: 모두 신규 public 메서드 추가이며 기존 메서드 시그니처/동작은 그대로. `generateTokens(user, false, undefined, ctx)` 호출은 기존 패턴(line 148 등)과 일치. `revokeAllFamilies` 의 DB 부작용(`refreshTokenRepository.update`로 전 family revoke)과 `login_history` 기록은 의도된 부작용이며, revoke 0건일 때 이력 미기록 가드도 있음.
- 제안: 없음.

### [INFO] DRY 리팩터링 — `authContextFromRequest` 단일 출처로 이동
- 위치: `utils/auth-context.ts`(신규), `auth.controller.ts`·`webauthn.controller.ts`(중복 정의 제거)
- 상세: 두 컨트롤러에 각각 정의돼 있던 모듈-로컬 함수를 공유 util 로 통합. 동작 동일(`extractClientIp` + `user-agent`). 전역 상태 도입 없음, 순수 함수.
- 제안: 없음.

### [INFO] 환경 변수 읽기 — 신규 의존이나 기존 패턴 재사용
- 위치: `users.controller.ts` 생성자 `this.configService.get('app.cookieDomain')`, `refresh-cookie.ts` `COOKIE_SAMESITE`
- 상세: `UsersController` 가 `ConfigService` 를 새로 주입해 `app.cookieDomain` 을 읽음. 이는 `AuthController`(line 101-102)와 동일한 패턴/키. `setRefreshTokenCookie` 가 내부적으로 `getRefreshCookieSameSite()` 를 통해 `process.env.COOKIE_SAMESITE` 를 읽으나 read-only 이며 기존 auth 경로와 동일. 환경 변수 쓰기 없음. 테스트(`auth-context.spec.ts`)는 `TRUST_CF_CONNECTING_IP` 를 변경하나 `afterEach` 로 원복.
- 제안: 없음.

### [INFO] DI 순환 의존 도입 — `forwardRef` 로 해소
- 위치: `auth.module.ts`, `users.module.ts`
- 상세: `UsersController` 가 `AuthService` 를 주입하면서 `AuthModule ↔ UsersModule` 순환 발생. 양쪽 모두 `forwardRef(() => ...)` 로 처리. 이는 NestJS 표준 해소법이며 런타임 부작용 없음. 다만 순환 의존은 모듈 초기화 순서 취약성을 키우므로 주석으로 의도가 문서화된 점은 적절.
- 제안: 없음. (순환 의존 자체는 아키텍처 관점 리뷰어 영역)

### [INFO] 네트워크/콜백 부작용 변경 없음
- 상세: 외부 서비스 호출·이벤트 발생·전역 변수 수정·예상치 못한 파일시스템 부작용 없음. 신규 e2e 파일(`users-change-password.e2e-spec.ts`)은 DB 쿼리로 부작용을 검증할 뿐 새 부작용을 코드에 도입하지 않음.

## 요약
부작용 관점에서 위험은 낮다. 핵심 변경은 (1) `change-password` 응답 계약 변경(`success` → `accessToken`)과 정상 경로에 추가된 의도적 부작용(전 세션 revoke + refresh 쿠키 회전 + audit ipAddress 기록), (2) 컨트롤러 핸들러 시그니처에 `@Req`/`@Res` 추가, (3) `authContextFromRequest` DRY 통합, (4) `forwardRef` 기반 모듈 순환 해소다. 응답 계약 변경은 backend·frontend 전 소비자에 일관되게 전파됐고 구 `success` 필드 잔존 소비자가 없음을 확인했다. 시그니처 변경은 모두 NestJS 데코레이터 주입이라 프레임워크 외 호출자가 없고 대응 spec 들이 갱신됐다. 환경 변수는 읽기만 하며 기존 패턴(`app.cookieDomain`)을 재사용한다. 전역 변수·네트워크·파일시스템 측 의도치 않은 부작용은 없다.

## 위험도
LOW
