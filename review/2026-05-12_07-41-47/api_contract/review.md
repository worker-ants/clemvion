### 발견사항

- **[WARNING]** `DELETE /users/me/sessions/:familyId` 에 인증 자격증명(password/totpCode)을 요청 바디로 전달
  - 위치: `sessions.controller.ts:revokeSession`, `sessions.ts:revokeSession`
  - 상세: HTTP 명세상 DELETE + 바디는 허용되지만, 일부 CDN·리버스 프록시·HTTP 클라이언트가 DELETE 바디를 무음으로 제거함. 현재 Cloudflare 무료 플랜 환경에서는 Cloudflare가 DELETE 바디를 전달하지만, 장기적으로 취약점이 됨.
  - 제안: `POST /users/me/sessions/:familyId/revoke` 로 변경하거나, 단일 세션 종료도 `revoke-others`처럼 POST 메서드로 통일.

- **[WARNING]** `revokeOtherSessions` — Swagger 데코레이터와 실제 HTTP 상태 코드 불일치
  - 위치: `sessions.controller.ts:142,147`
  - 상세: `@ApiCreatedWrappedResponse`(201 문서화)와 `@HttpCode(HttpStatus.OK)`(200 실제 반환)가 충돌. Swagger 클라이언트 코드 생성 시 201을 기대하다가 200 응답을 파싱 실패로 처리할 수 있음.
  - 제안: `@ApiOkWrappedResponse`로 교체.

- **[WARNING]** `:familyId` 경로 파라미터에 UUID 형식 검증 없음
  - 위치: `sessions.controller.ts:revokeSession` (`@Param('familyId') familyId: string`)
  - 상세: 임의 문자열이 그대로 DB 쿼리에 전달됨. `ParseUUIDPipe` 누락.
  - 제안: `@Param('familyId', new ParseUUIDPipe()) familyId: string` 적용.

- **[WARNING]** `RevokeSessionDto` 모든 필드가 `@IsOptional()` — HTTP 계층 유효성 검증 없음
  - 위치: `revoke-session.dto.ts`
  - 상세: 빈 바디(`{}`)가 DTO 검증을 통과해 서비스 레이어(`verifyReauth`)까지 내려감. HTTP 400이 아닌 비즈니스 로직 경로에서 400이 발생하므로 API 계약 관점에서 책임 위치가 불명확함.
  - 제안: `@ValidateIf(() => false)` 같은 가이드 또는 적어도 Swagger에 "하나 이상 필수" 명시.

- **[INFO]** 커서 기반 페이징에서 `created_at` 단독 사용 — 동일 타임스탬프 충돌 가능
  - 위치: `login-history.service.ts:findForUser`, `sessions.controller.ts:getLoginHistory`
  - 상세: `cursor = data[limit-1].createdAt.toISOString()`을 기준으로 `< cursor` 필터링. 동일 밀리초에 여러 이벤트가 존재할 경우 커서 이후 페이지에서 일부 행이 누락됨.
  - 제안: `nextCursor`를 `${createdAt.toISOString()}_${id}` 복합 커서로 설계하고, 파싱 후 `(created_at, id)` 기준으로 필터링.

- **[INFO]** `login-history` 응답의 `failureReason` 원시 코드 노출
  - 위치: `login-history.dto.ts`, `sessions.controller.ts:getLoginHistory`
  - 상세: `USER_NOT_FOUND`, `INVALID_PASSWORD` 등 내부 코드가 사용자에게 그대로 노출됨. 이 자체는 본인 이력이므로 보안 문제는 없으나, 외부 인터페이스로 확정된 enum으로 문서화되지 않아 향후 코드값 변경이 breaking change가 됨.
  - 제안: `failureReason`을 Swagger에 enum으로 명시하거나, 프론트엔드 i18n key로 매핑 처리.

- **[INFO]** `trust proxy: true` — 모든 프록시를 무조건 신뢰
  - 위치: `main.ts:set('trust proxy', true)`
  - 상세: Cloudflare 전용으로 설계되었으나 Express의 `true` 값은 모든 레이어를 신뢰. Cloudflare IP 대역을 CIDR 목록으로 명시하는 것이 더 엄격하나, `CF-Connecting-IP` 우선 추출 정책(`client-ip.ts`)이 이를 실질적으로 보완하고 있음. `client-ip.ts` 보안 주석도 이를 명시함.
  - 제안: 현재 코드는 허용 가능. 운영 환경에서 Cloudflare IP 대역 필터링을 네트워크 레이어(방화벽/WAF)에서 적용하면 완전한 방어가 됨.

---

### 요약

신규 세션·로그인 이력 API(`/users/me/sessions`, `/users/me/login-history`)는 기존 엔드포인트에 breaking change 없이 추가되었고, JWT 인증·재인증 요구·404 정보 은닉 등 주요 보안 계약은 올바르게 구현되었다. 다만 `DELETE :familyId` 바디 전송의 프록시 호환 위험, Swagger 201/200 불일치, UUID 경로 파라미터 미검증은 실제 클라이언트 통합 시 오동작 또는 혼란을 유발할 수 있어 배포 전 교정이 권장된다. 전체적인 API 계약 완성도는 양호하며 위험도는 낮다.

### 위험도
**LOW**