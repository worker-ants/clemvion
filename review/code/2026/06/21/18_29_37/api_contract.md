# API 계약(API Contract) 리뷰

## 발견사항

### [INFO] 이메일 변경 엔드포인트 4개의 URL 설계 — POST 일관성

- 위치: `users.controller.ts` — `POST me/email-change/request`, `POST me/email-change/verify`, `POST me/email-change/resend`, `POST me/email-change/cancel`
- 상세: 모든 엔드포인트가 `POST`를 사용한다. `cancel`은 상태 제거 작업이므로 `DELETE /users/me/email-change`가 더 RESTful하고, `resend`는 `POST /users/me/email-change/resend`가 아니라 단순 재발송이므로 허용 가능. 현행 설계는 action-oriented URL 패턴으로 일관성이 있고, 기존 비밀번호 변경 패턴(`POST /users/me/change-password`)과 유사하다. 단, 프로젝트 전반에서 `DELETE`를 쓰는 취소 패턴이 있다면 불일치가 생긴다.
- 제안: 현행 `POST` 일관성 유지는 수용 가능. 단, 프로젝트 URL 규약 문서에 action-based POST 패턴이 명시되어 있다면 무시해도 됨. 명시되어 있지 않다면 `DELETE /users/me/email-change` (cancel)와 `POST /users/me/email-change/resend` 로 분리를 고려.

---

### [INFO] `POST me/email-change/resend` 빈 바디 명시

- 위치: `codebase/frontend/src/lib/api/users.ts` — `resendEmailChange`, `cancelEmailChange`
- 상세: 프론트엔드에서 `resendEmailChange`와 `cancelEmailChange`를 `apiClient.post(..., {})` 로 빈 오브젝트를 body로 전송한다. 컨트롤러 쪽은 `@Body()` 파라미터가 없으므로 실제로 바디를 무시한다. 기능상 문제는 없으나, 빈 오브젝트 대신 `undefined` 또는 `null`을 전달하는 것이 더 의도를 명확히 한다.
- 제안: `apiClient.post(..., undefined)` 또는 `apiClient.post(...)` 로 변경하거나 현행 `{}` 유지 중 선택. 기능 영향 없음.

---

### [INFO] `verifyEmailChange` — `@ApiUnauthorizedResponse` 설명 중복

- 위치: `users.controller.ts` 라인 895 (`@ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })`)
- 상세: `@ApiUnauthorizedResponse`가 "인증 실패 또는 토큰 만료"를 나타내는데, 토큰 만료는 `@ApiBadRequestResponse`(400)에도 설명되어 있다. Swagger 문서에서 두 응답 코드가 동일 케이스를 가리킬 수 있어 클라이언트 혼란을 줄 수 있다. 실제로 만료된 이메일 변경 토큰은 서비스에서 `BadRequestException`(400)을 던지므로 401 Swagger 설명에서 "토큰 만료"는 삭제해야 한다.
- 제안: `@ApiUnauthorizedResponse({ description: '인증 실패 (JWT 없음·만료)' })` 로 수정. 이메일 변경 토큰 만료는 이미 400에 정확히 기술됨.

---

### [INFO] `requestEmailChange` — `REAUTH_NOT_AVAILABLE` (403) Swagger 미명시

- 위치: `users.controller.ts` — `requestEmailChange` 엔드포인트 데코레이터
- 상세: API 설명 문자열에는 "OAuth 전용 계정은 403(`REAUTH_NOT_AVAILABLE`)"이 텍스트로 언급되어 있지만, `@ApiForbiddenResponse()` 데코레이터가 없다. Swagger 응답 코드 목록에 403이 누락된다.
- 제안: `@ApiForbiddenResponse({ description: 'OAuth-only 계정 — 재인증 수단 없음 (REAUTH_NOT_AVAILABLE)' })` 데코레이터 추가.

---

### [INFO] `UserProfileDto.pendingEmail` — 응답 스키마 additive 변경, 하위 호환

- 위치: `codebase/backend/src/modules/users/dto/responses/user-response.dto.ts`
- 상세: 기존 `UserProfileDto`에 `pendingEmail?: string | null` 필드가 추가된다. 이는 additive 변경으로 기존 클라이언트가 해당 필드를 무시할 경우 하위 호환성이 유지된다. 프론트엔드 `UserProfile` 인터페이스도 `pendingEmail?: string | null`로 정의하여 대응한다. 하위 호환성 파괴 없음.
- 제안: 해당 없음.

---

### [INFO] `MessageResponseDto` — 재사용 범위 제한적, 위치 적절성

- 위치: `codebase/backend/src/modules/users/dto/responses/user-response.dto.ts`
- 상세: `MessageResponseDto`를 `user-response.dto.ts`에 선언했다. 이메일 변경 외의 다른 작업에서도 동일 패턴(단순 메시지 응답)이 필요해질 경우 `common/dto/` 또는 `common/responses/`로 이동이 더 적절할 수 있다. 현재는 이메일 변경 3개 엔드포인트에만 사용되므로 위치상 문제 없음.
- 제안: 추후 재사용 케이스 발생 시 `common/` 이동 고려. 현재 위치 수용 가능.

---

### [INFO] `totpCode` 검증 길이 — TOTP 6자리 고정이나 8자리까지 허용

- 위치: `codebase/backend/src/modules/users/dto/email-change-request.dto.ts` — `@Length(6, 8)`
- 상세: TOTP 표준(RFC 6238)은 6자리이나 일부 구현은 8자리를 지원한다. `@Length(6, 8)`은 기존 비밀번호 변경·세션 종료 DTO의 재인증 패턴과 일관성이 있는지 확인 필요. 기존 `RevokeSessionDto`의 `totpCode` 검증 범위와 일치하면 문제 없음.
- 제안: 기존 `RevokeSessionDto`의 `totpCode` 검증 범위와 동일한지 확인. 불일치 시 통일.

---

### [INFO] 이메일 변경 확인 링크 — URL 파라미터로 토큰 전달, 프론트 verify 흐름

- 위치: `codebase/frontend/src/app/(main)/profile/change-email/verify/page.tsx` — `usersApi.verifyEmailChange(token)`
- 상세: 프론트엔드 verify 페이지는 URL 쿼리 파라미터(`?token=`)에서 토큰을 추출해 `POST /users/me/email-change/verify`의 바디(`{ token }`)로 전달한다. 이 패턴은 기존 이메일 인증 흐름과 일관성이 있고, 인증된 본인 세션에서만 처리되므로 보안 상 문제없다. GET 방식이 아닌 POST body 전달은 적절하다.
- 제안: 해당 없음.

---

## 요약

이 변경은 이메일 변경 흐름(`POST /users/me/email-change/request|verify|resend|cancel`)을 신규 추가하는 것으로, API 계약 관점에서 전반적으로 잘 설계되어 있다. 기존 `UserProfileDto`에 `pendingEmail` 필드 추가는 additive하여 하위 호환성이 보장된다. DTO 검증(`EmailChangeRequestDto`, `EmailChangeVerifyDto`)이 충분하고 Swagger 문서화도 대체로 갖춰져 있다. 에러 응답 코드(400/401/409)도 서비스 로직과 일치한다. 다만 `requestEmailChange`의 403(`REAUTH_NOT_AVAILABLE`) 응답이 Swagger 데코레이터에 누락되어 있고, `verifyEmailChange`의 `@ApiUnauthorizedResponse` 설명에서 이메일 변경 토큰 만료를 언급하는 부분이 400과 중복·혼동을 줄 수 있다. 이 두 사항은 Swagger 문서 품질 문제이며 기능 동작에는 영향을 주지 않는다. 그 외 발견사항은 모두 스타일·관습 수준의 INFO이다.

## 위험도

LOW

STATUS=success ISSUES=6 PATH=/Volumes/project/private/clemvion/.claude/worktrees/spec-email-change-0fcba4/review/code/2026/06/21/18_29_37/api_contract.md RESET_HINT=
