## 발견사항

### 1. **[WARNING]** `GET /integrations` 응답 구조 불일치
- **위치**: `integrations.controller.ts` `findAll()` / `frontend/src/lib/api/integrations.ts` `list()`
- **상세**: 프론트엔드 클라이언트는 `{ data: IntegrationDto[], pagination: {...} }` 형식을 기대하지만, 컨트롤러는 `integrationsService.findAll()`의 반환값을 그대로 전달합니다. `PaginationQueryDto`에서 `ListIntegrationsQueryDto`로 변경되었으나 서비스 레이어가 동일한 페이지네이션 응답 래퍼를 반환하는지 diff에서 확인 불가합니다.
- **제안**: `IntegrationsService.findAll()`가 `{ data, pagination }` 래퍼를 반드시 반환하는지 확인하고, 응답 형식을 DTO로 명시적으로 타입화하세요.

---

### 2. **[WARNING]** `POST /integrations/preview-test` 인증 누락 의심
- **위치**: `integrations.controller.ts:53` `previewTest()`
- **상세**: `@Public()` 데코레이터도 없고 `@WorkspaceId()` / `@CurrentUser()` 데코레이터도 없습니다. 글로벌 AuthGuard가 적용되어 있다면 인증은 되지만, 워크스페이스 컨텍스트 없이 임의 자격증명을 테스트할 수 있는 엔드포인트가 열려 있습니다. SSRF 또는 내부 서비스 탐색에 악용될 수 있습니다.
- **제안**: 최소한 `@CurrentUser()`를 추가하여 인증된 사용자만 호출 가능하도록 제한하거나, 요청 횟수 제한(rate limiting)을 적용하세요.

---

### 3. **[WARNING]** `GET /integrations/oauth/callback/:provider` 라우트 충돌 위험
- **위치**: `integrations.controller.ts:62` — `GET /integrations/oauth/callback/:provider`  
  vs. `integrations.controller.ts:106` — `GET /integrations/:id`
- **상세**: NestJS는 라우트를 선언 순서대로 매칭합니다. `oauth/callback/:provider`는 `:id` 보다 위에 선언되어 있어 현재는 안전하지만, `GET /integrations/services`(정적 경로)도 동일 패턴입니다. `services` 경로가 `:id` 보다 앞에 있지 않으면 UUID 파이프 오류가 발생할 수 있습니다.
- **제안**: 모든 정적 경로(`services`, `oauth/...`, `preview-test`)가 파라미터 경로(`:id`) 이전에 선언되어 있는지 명시적으로 확인하세요. NestJS에서는 선언 순서가 곧 매칭 우선순위입니다.

---

### 4. **[WARNING]** OAuth callback HTML 응답에서 `postMessage` origin 고정 사용
- **위치**: `integrations.controller.ts:277` `renderCallbackHtml()`
- **상세**: `window.opener.postMessage(payload, window.location.origin)`는 콜백 페이지의 origin을 기준으로 합니다. OAuth 콜백 URI가 백엔드 도메인(`APP_URL`)이고 프론트엔드가 다른 도메인이라면, postMessage가 opener(프론트엔드)에 전달되지 않습니다.
- **제안**: `APP_URL`/`FRONTEND_URL` 환경변수를 기반으로 허용된 origin을 명시하거나, opener origin을 state 파라미터에 포함시켜 검증 후 사용하세요.

---

### 5. **[WARNING]** `ActivityQueryDto`의 숫자 파라미터 타입 검증 미흡
- **위치**: `dto/integration.dto.ts` `ActivityQueryDto` / `integrations.controller.ts:120`
- **상세**: `limit`과 `days`를 `string`으로 받아 컨트롤러에서 `Number()`로 변환합니다. `@IsNumberString()` 또는 `@Type(() => Number)` + `@IsInt()` + `@Min()` 검증이 없어 `limit=-1`, `days=999999`와 같은 입력이 통과됩니다.
- **제안**: `@IsInt() @Min(1) @Max(100) @Type(() => Number) limit?: number` 형태로 DTO에서 변환과 검증을 함께 처리하세요. 컨트롤러의 `Number.isFinite` 폴백은 제거할 수 있습니다.

---

### 6. **[WARNING]** Breaking Change — `POST /integrations` 시그니처 변경
- **위치**: `integrations.controller.ts:131` → `create()`, `integrations.service.ts` `create()`
- **상세**: 기존 `create(workspaceId, userId, body: Record<string, unknown>)`에서 `create(workspaceId, userId, role, body: CreateIntegrationDto)`로 변경되었습니다. `body`가 `Record<string, unknown>`에서 `CreateIntegrationDto`로 강타입화된 것은 개선이지만, 기존 클라이언트가 보내던 임의 필드들이 이제 검증에서 거부될 수 있습니다. 특히 `authType`이 `@MaxLength(20)`으로 제한되었는데, 기존에 더 긴 값이 저장되어 있다면 수정 흐름에서 문제가 생길 수 있습니다.
- **제안**: `CreateIntegrationDto` 변경사항을 API 변경 로그에 문서화하고, 기존 데이터에서 `auth_type` 길이 위반이 없는지 마이그레이션 전에 확인하세요.

---

### 7. **[INFO]** `PATCH /integrations/:id` 업데이트 범위 축소
- **위치**: `integrations.controller.ts` `update()` / `UpdateIntegrationDto`
- **상세**: 기존 `body: Record<string, unknown>`에서 `{ name?: string }`만 허용하는 `UpdateIntegrationDto`로 변경되었습니다. 이전에 `credentials`, `status` 등을 직접 PATCH하던 클라이언트 코드가 있다면 silent 무시됩니다.
- **제안**: 프론트엔드 전체 코드베이스에서 `PATCH /integrations/:id`에 `name` 이외의 필드를 전송하는 곳이 없는지 검색하세요.

---

### 8. **[INFO]** `GET /integrations` 필터 파라미터 `status=expiring` 서버 vs. 클라이언트 계산 불일치
- **위치**: `dto/integration.dto.ts` `INTEGRATION_STATUSES` / `frontend/src/app/(main)/integrations/_shared/status-badge.tsx`
- **상세**: DB의 `status` 컬럼은 `connected | expired | error`만 가지지만, API 필터는 `expiring`을 추가로 허용합니다. `expiring`은 `tokenExpiresAt`으로 동적으로 계산되는 값입니다. 프론트엔드의 `computeStatus()`도 같은 로직으로 클라이언트에서 계산합니다. 서비스 레이어에서 `expiring` 필터를 어떻게 처리하는지(diff 미포함) 확인이 필요합니다.
- **제안**: `expiring` 필터 처리 로직(`tokenExpiresAt <= NOW() + 7d AND status = 'connected'`)을 서비스 레이어에 명시적으로 문서화하세요.

---

### 9. **[INFO]** OAuth token exchange가 stub 구현
- **위치**: `integration-oauth.service.ts:153-163`
- **상세**: `syntheticCredentials`로 실제 provider token exchange 없이 fake 토큰을 생성합니다. 주석에 "Phase C" 작업으로 표시되어 있으나, 이 상태로 프로덕션에 배포되면 실제 OAuth 인증이 동작하지 않고 stub 토큰이 저장됩니다.
- **제안**: stub 구현임을 명확히 하는 feature flag 또는 환경 변수 guard를 추가하고, 프로덕션 배포 전 반드시 실제 token exchange 구현이 완료되어야 함을 README나 TODO에 명시하세요.

---

## 요약

이번 변경은 Integration 도메인의 API 계약을 상당히 확장한 것으로, 대부분의 새 엔드포인트는 일관된 RESTful 설계와 DTO 기반 검증을 갖추고 있습니다. 그러나 `POST /integrations/preview-test`의 워크스페이스 컨텍스트 부재(보안 위험), OAuth postMessage의 cross-origin 처리 미비, `ActivityQueryDto`의 숫자 파라미터 검증 부재, 그리고 OAuth token exchange의 stub 구현이 주요 우려사항입니다. 특히 `POST /integrations` body 타입 강화와 `PATCH /integrations/:id` 업데이트 범위 축소는 잠재적인 breaking change로, 기존 클라이언트와의 호환성 확인이 필요합니다.

## 위험도

**MEDIUM**