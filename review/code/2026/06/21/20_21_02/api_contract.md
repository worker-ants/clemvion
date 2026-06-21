# API 계약(API Contract) 리뷰

## 발견사항

이번 변경셋은 이전 리뷰 세션(`18_29_37`)의 resolution 적용 커밋(71fd0f02)이다. API 계약 관련 변경은 다음 두 항목이다.

### [INFO] INFO#20 해소 확인 — `verifyEmailChange` @ApiUnauthorizedResponse 설명 명확화

- 위치: `codebase/backend/src/modules/users/users.controller.ts` — `verifyEmailChange` 엔드포인트
- 상세: 이전 리뷰에서 지적한 "인증 실패 또는 토큰 만료" 혼동이 "JWT 인증 실패 (access token 만료·미제공)"로 수정되었다. 이메일 변경 토큰 만료는 별도의 `@ApiBadRequestResponse`(400)에 명시되어 있으므로 401과 400의 의미가 명확히 분리되었다. Swagger 문서 소비자가 두 응답 코드를 혼동할 여지가 제거되었다.
- 제안: 해당 없음.

---

### [INFO] INFO#21 해소 확인 — `requestEmailChange` @ApiForbiddenResponse(403) 추가

- 위치: `codebase/backend/src/modules/users/users.controller.ts` — `requestEmailChange` 엔드포인트
- 상세: `@ApiForbiddenResponse({ description: '재인증 수단 없음 — OAuth 전용 계정(REAUTH_NOT_AVAILABLE)' })`가 추가되었다. 서비스 레이어(`SessionsService.reauthenticate`)가 OAuth-only 계정에서 `ForbiddenException`을 던지는 실제 동작과 Swagger 문서가 일치하게 되었다. 이전에는 403이 Swagger 응답 목록에서 누락되어 API 소비자가 해당 에러 케이스를 예측할 수 없었다.
- 제안: 해당 없음.

---

### [INFO] `EmailChangeVerifyDto` @MaxLength(128) 추가 — 요청 검증 강화

- 위치: `codebase/backend/src/modules/users/dto/email-change-verify.dto.ts`
- 상세: 토큰 필드에 `@MaxLength(128)` 제약이 추가되었다. 이전에는 상한이 없어 임의 길이 문자열이 서비스 레이어까지 도달할 수 있었다. SHA-256 hex 토큰(64자)보다 충분한 여유를 두면서 과도하게 긴 입력을 조기 차단한다. 기존 클라이언트는 정상 토큰 길이(64자 이하)를 전송하므로 하위 호환성 파괴 없음.
- 제안: 해당 없음.

---

### [INFO] `auth.service.ts` 서비스 레이어 변경 — API 계약 관점 영향 없음

- 위치: `codebase/backend/src/modules/auth/auth.service.ts`
- 상세: `EMAIL_CHANGE_TTL_MS` 상수 추출, 메일 발송 실패 시 `clearPendingEmailChange` 롤백, `sendEmailChangedNotice` 실패 catch에 `logger.warn` 추가, TOCTOU/forced-logout 주석 명시는 모두 내부 구현 변경이다. 외부 API 응답 형식·HTTP 상태 코드·요청 검증 계약에는 영향을 주지 않는다.
- 제안: 해당 없음.

---

### [INFO] `user.entity.ts` JSDoc 추가 — API 계약 관점 영향 없음

- 위치: `codebase/backend/src/modules/users/entities/user.entity.ts` — `emailChangeExpiresAt`
- 상세: 엔티티 필드 JSDoc 추가는 문서화 개선이며 API 계약에 영향 없다.
- 제안: 해당 없음.

---

### [INFO] 테스트 파일 4종 추가 — API 계약 관점 해당 없음

- 위치: `auth.service.spec.ts`, `sessions.service.spec.ts`, `users.service.spec.ts`, `mail.service.spec.ts`
- 상세: 단위 테스트 추가는 API 계약에 영향을 주지 않는다.
- 제안: 해당 없음.

---

## 요약

이번 변경은 이전 리뷰(18_29_37)의 resolution 커밋(71fd0f02)을 포함하는 후속 검토다. API 계약 관점에서 유효한 변경은 세 가지다. 첫째, `requestEmailChange`에 `@ApiForbiddenResponse`(403)가 추가되어 Swagger 문서가 실제 동작과 일치하게 되었다(INFO#21 해소). 둘째, `verifyEmailChange`의 `@ApiUnauthorizedResponse` 설명이 400과의 중복·혼동을 제거하도록 수정되었다(INFO#20 해소). 셋째, `EmailChangeVerifyDto`에 `@MaxLength(128)` 제약이 추가되어 요청 검증이 강화되었다(INFO#2 해소). 세 변경 모두 additive이거나 설명 개선으로, 기존 API 클라이언트에 breaking change를 일으키지 않는다. 이전 리뷰에서 지적된 API 계약 관련 INFO 항목이 전부 해소되었으며, 신규 발견사항은 없다.

## 위험도

NONE
