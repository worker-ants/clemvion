### 발견사항

**[WARNING] `InvitationMetaDto.expiresAt` 타입과 실제 반환값 불일치**
- 위치: `workspace-response.dto.ts` L17, `workspace-invitations.service.ts` `InvitationMeta` interface
- 상세: `InvitationMetaDto.expiresAt`는 `string`으로 선언되어 있으나 `InvitationMeta` interface의 `expiresAt`는 `Date` 타입이다. `InvitationsController.getMeta()`는 서비스 결과를 직렬화 없이 그대로 반환(`return { data: meta }`)하므로 Swagger 스펙(`format: 'date-time'`)과 실제 런타임 타입이 일치하지 않는다.
- 제안: `InvitationMeta.expiresAt`를 `string`으로 정렬하거나, 컨트롤러에서 `.toISOString()`으로 명시적 직렬화

---

**[WARNING] 쓰로틀 적용 엔드포인트에 `@ApiTooManyRequestsResponse` 누락**
- 위치: `workspaces.controller.ts` — `POST :id/invitations`, `POST :id/invitations/:invitationId/resend`
- 상세: 두 엔드포인트 모두 `@Throttle`이 적용되어 있으나 `429 Too Many Requests` 응답에 대한 Swagger 선언이 없어 API 소비자가 이 동작을 알 수 없다.
- 제안: `@ApiTooManyRequestsResponse({ description: '요청 빈도 초과 (분당 10건)' })` 추가

---

**[WARNING] 공개 `register()` 메서드에 JSDoc 부재**
- 위치: `auth.service.ts` L42-L90
- 상세: `register()`는 `invitationToken` 유무에 따라 반환 타입이 `{ message }` 또는 `{ message, accessToken, refreshToken }`으로 완전히 분기되는 비자명(non-obvious) 동작을 하지만, 공개 메서드 자체에 이를 설명하는 JSDoc이 없다. `registerWithInvitation` 내부 메서드에는 상세 JSDoc이 있어 대조적이다.
- 제안: `register()` 시그니처 위에 분기 동작, 반환 유니온 의미, ctx 기본값 이유를 기술하는 JSDoc 추가

---

**[WARNING] 에러 코드 케이스 비일관성 — API 문서 미반영**
- 위치: `workspace-invitations.service.ts` 전반
- 상세: `revoke()` / `resend()` 내부는 `INVITATION_NOT_FOUND`, `INVITATION_ALREADY_ACCEPTED`(SCREAMING_SNAKE) 를 사용하는 반면, `accept()` / `getMetaByToken()` / `consumeForRegistration()` 은 `invitation_not_found`, `invitation_already_used`(snake_case)를 사용한다. Swagger 엔드포인트 설명 어디에도 오류 코드 목록이 없어 클라이언트가 에러 핸들링 코드를 파악하기 어렵다.
- 제안: 에러 코드를 snake_case로 통일하고, `@ApiBadRequestResponse` / `@ApiGoneResponse` description에 `(code: invitation_email_mismatch)` 형식으로 에러 코드를 명시

---

**[INFO] `invitations.controller.ts` 클래스 JSDoc이 영어, API 설명은 한국어 — 언어 혼재**
- 위치: `invitations.controller.ts` L13-L19
- 상세: 클래스 레벨 JSDoc(`Public-facing endpoint that lets the sign-up page...`)은 영어이나 `@ApiOperation` description과 프로젝트 전반 API 설명은 한국어다. 신규 기여자 기준이 불명확해진다.
- 제안: 클래스 JSDoc을 한국어로 통일 또는 프로젝트 차원의 언어 가이드 확립

---

**[INFO] `RegisterResultDto.message` 필드에 `@ApiProperty` description 누락**
- 위치: `auth-response.dto.ts` L46-L47
- 상세: `message` 필드는 `@ApiProperty()` 선언만 있고 description이 없어 Swagger UI에서 빈 칸으로 노출된다. 같은 파일의 `AuthMessageDto.message`도 동일하나 신규 DTO에서도 반복됐다.
- 제안: `@ApiProperty({ description: '처리 결과 메시지. 일반 가입: 이메일 인증 안내, 초대 토큰 가입: 가입 성공 메시지.' })`

---

**[INFO] 초대 이메일 URL 변경이 CHANGELOG 또는 스펙에 미반영**
- 위치: `mail.service.ts` — `/invitations/accept?token=...` → `/invitations/${token}`
- 상세: URL 구조가 변경되어 기발송된 이메일의 링크가 무효화되는 파괴적 변경(breaking change)이다. 코드 내 주석이나 spec 문서에 "이전 링크는 무효" 설명이 없다.
- 제안: `sendWorkspaceInvitationEmail` JSDoc에 "이 URL 구조는 v X.Y에서 변경됨" 또는 spec 마이그레이션 노트 추가

---

**[INFO] `@ApiProperty({ required: false })` vs `@ApiPropertyOptional` 스타일 불일치**
- 위치: `auth-response.dto.ts` L51
- 상세: `RegisterResultDto.accessToken`은 `@ApiProperty({ required: false, ... })`를 사용하나 같은 변경의 `register.dto.ts`에서는 `@ApiPropertyOptional`을 사용한다. 기능 차이는 없으나 스타일이 일관되지 않다.
- 제안: `@ApiPropertyOptional({ description: '...' })`로 교체

---

### 요약

전반적으로 이번 변경은 문서화 품질이 상당히 높다. `registerWithInvitation`, `resolveTokenWorkspaceContext`, `consumeForRegistration` 등 핵심 비즈니스 로직에 spec 섹션 번호까지 참조하는 상세 JSDoc이 있고, Swagger 엔드포인트 설명도 분기 동작을 충실히 기술했다. 다만 (1) `InvitationMetaDto.expiresAt` 타입 불일치는 런타임 스키마 오류를 유발할 수 있고, (2) 쓰로틀 응답 코드 미문서화와 에러 코드 케이스 비일관성은 클라이언트 SDK 생성 및 에러 핸들링 코드 작성 시 혼선을 초래할 수 있어 수정을 권장한다.

### 위험도

**LOW** — 기능 동작에 영향을 주는 문서화 버그는 `expiresAt` 타입 불일치 하나이며, 나머지는 Swagger UI 품질 및 유지보수성 이슈다.