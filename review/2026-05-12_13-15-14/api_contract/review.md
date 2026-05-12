### 발견사항

---

**[CRITICAL] `accept()` 에러 HTTP 상태 코드 breaking change**
- 위치: `workspace-invitations.service.ts` — `accept()` 메서드
- 상세: 기존 클라이언트가 처리하던 상태 코드가 변경됨.
  - 이미 수락·만료된 초대: `409 Conflict` → `410 Gone`
  - 이메일 불일치: `403 Forbidden` → `400 Bad Request`
  기존 클라이언트가 `409`/`403`을 분기 처리하고 있다면 즉시 오동작.
- 제안: 버전 네고시에이션 없이 상태 코드를 바꾸는 것은 breaking change다. 마이그레이션 계획이 없다면 새 에러 코드(`invitation_already_used`, `invitation_email_mismatch`)를 기존 상태 코드 안에 담는 방향을 우선 검토할 것.

---

**[CRITICAL] 에러 코드 네이밍 스타일 불일치**
- 위치: `workspace-invitations.service.ts` 전체
- 상세: 기존 코드는 `SCREAMING_SNAKE_CASE`(`ADMIN_REQUIRED`, `INVITATION_ALREADY_ACCEPTED`, `WORKSPACE_NOT_FOUND`)를 사용하고, 이번 변경은 `snake_case`(`invitation_not_found`, `invitation_email_mismatch`, `invitation_already_used`)를 사용한다. 한 서비스 내에 두 스타일이 혼재하여 클라이언트가 에러 코드를 파싱할 때 예측 불가능한 케이스 분기를 초래한다. `revoke()`의 `INVITATION_NOT_FOUND`와 새 `getMetaByToken()`의 `invitation_not_found`는 동일 개념에 대해 서로 다른 코드를 반환한다.
- 제안: 전체 서비스에서 한 가지 스타일로 통일. `accept()` 계열은 이미 클라이언트가 있을 수 있으므로 신규 스타일로 전환 시 Changelog 명시 필수.

---

**[WARNING] `POST /workspaces/:id/invitations` — upsert인데 201 반환**
- 위치: `workspaces.controller.ts` `createInvitation()`, `workspace-invitations.service.ts` `invite()`
- 상세: 기존 대기 중 초대가 있으면 행을 업데이트하고 반환하는데, 컨트롤러 데코레이터에 `@HttpCode`가 없으므로 기본 `201 Created`가 응답된다. 업데이트 케이스에서 `201`을 받은 클라이언트는 새 리소스가 생성된 것으로 잘못 해석할 수 있다.
- 제안: 업서트 응답은 `200 OK`로 통일하거나(`@HttpCode(200)`), create/update를 구분하는 별도 엔드포인트를 두거나, 응답 바디에 `created: boolean` 필드를 추가할 것.

---

**[WARNING] `GET /invitations/:token` — 율 제한 없음**
- 위치: `invitations.controller.ts`
- 상세: 인증이 없는 공개 엔드포인트인데 `@Throttle()` 데코레이터가 없다. 유효한 토큰인지 아닌지를 빠르게 반복 요청으로 탐색(token enumeration)할 수 있고, 유효한 토큰에 대해 워크스페이스 이름·초대자 이름·이메일이 노출된다.
- 제안: `@Throttle({ default: { ttl: 60_000, limit: 20 } })` 정도로 제한 추가. 존재하지 않는 토큰과 유효한 토큰의 응답 시간이 다르면 timing attack 가능성도 있으므로 일관된 응답 시간 유지 고려.

---

**[WARNING] 기존 미수락 초대 링크 무효화 (URL 변경)**
- 위치: `mail.service.ts` `sendWorkspaceInvitationEmail()`
- 상세: 이메일 내 초대 링크 URL이 `/invitations/accept?token=...` → `/invitations/${token}`으로 변경됐다. 이 변경 전에 발송된 미수락 초대 이메일의 링크는 프론트엔드가 새 경로를 처리하지 않으면 모두 404/오작동된다.
- 제안: 구 URL(`/invitations/accept?token=:token`)을 프론트엔드에서 새 URL로 301 리디렉트하거나, 배포 전 모든 미수락 초대를 만료시키거나, 두 형식을 모두 처리하는 기간을 두어야 한다.

---

**[WARNING] `sendWorkspaceInvitationEmail` 시그니처 변경 — internal breaking change**
- 위치: `mail.service.ts`
- 상세: `invitedByName: string | null` 파라미터가 `workspaceName`과 `token` 사이에 추가됐다. 이 메서드를 호출하는 다른 코드(이번 변경 범위 외)가 있다면 컴파일 에러 또는 런타임 오류 발생.
- 제안: 이번 diff에서 확인된 호출부는 모두 업데이트됐으나, 전체 코드베이스에 다른 호출부가 없는지 반드시 확인. `invitedByName`을 옵션 마지막 파라미터로 두는 것이 향후 시그니처 변경에 덜 취약하다.

---

**[WARNING] `InvitationMetaDto.expiresAt` — 타입 불일치 (Date vs string)**
- 위치: `workspace-response.dto.ts`, `workspace-invitations.service.ts` `getMetaByToken()`
- 상세: `InvitationMetaDto`의 `expiresAt`은 `string`으로 선언됐지만(`format: 'date-time'`), 서비스는 `expiresAt: invitation.expiresAt`으로 `Date` 객체를 그대로 반환한다. NestJS class-transformer가 직렬화를 처리하지 않으면 `[object Object]`나 ISO string이 아닌 형태로 나갈 수 있다.
- 제안: 서비스 레이어에서 `expiresAt: invitation.expiresAt.toISOString()`으로 명시 변환하거나, class-transformer의 `@Transform()` 데코레이터를 DTO에 추가할 것.

---

**[INFO] `RegisterDto.invitationToken` — `@MaxLength` 없음**
- 위치: `register.dto.ts`
- 상세: `@MinLength(16)`만 있고 `@MaxLength`가 없다. 생성되는 토큰은 64자이므로 이보다 훨씬 긴 입력이 허용된다.
- 제안: `@MaxLength(256)` 정도로 상한 추가.

---

**[INFO] `POST /auth/register` — Refresh Token 쿠키가 Swagger에 문서화되지 않음**
- 위치: `auth.controller.ts`
- 상세: `invitationToken` 가입 흐름에서 Refresh Token이 쿠키로 발급되는데, `@ApiCreatedWrappedResponse(RegisterResultDto)` 에는 이 쿠키 동작이 전혀 기술되지 않는다. 클라이언트가 Swagger만 보고 구현하면 쿠키 수신을 놓친다.
- 제안: `@ApiCookieAuth()` 또는 `@ApiResponse` description에 쿠키 발급 사실 명시.

---

### 요약

이번 변경은 미가입자 초대 토큰 흐름을 추가하는 기능 구현으로, 전반적인 설계는 적절하다. 그러나 **기존 클라이언트에게 영향을 주는 breaking change가 세 곳** 존재한다: `accept()` 엔드포인트의 HTTP 상태 코드 변경(409→410, 403→400), 미수락 초대 이메일 링크 URL 변경, 그리고 동일 서비스 내 에러 코드 스타일 혼재. 또한 공개 토큰 조회 엔드포인트에 율 제한이 없어 토큰 열거 공격에 노출되며, `POST /invitations` upsert 처리 시 `201`을 반환하는 의미론적 오류도 수정이 필요하다. 내부 서비스 메서드(`sendWorkspaceInvitationEmail`) 시그니처 변경은 컴파일 레벨에서 차단되므로 위험도는 낮지만, 배포 전 전체 호출부 확인이 필요하다.

### 위험도

**HIGH**