### 발견사항

- **[CRITICAL]** `GET /oauth/install/cafe24` 경로 즉시 410 처리 — 기존 Cafe24 Private 앱 등록자 전체 차단
  - 위치: `integrations.controller.ts` — `cafe24InstallLegacy()` 핸들러
  - 상세: Cafe24 Developers에 구 App URL(`/oauth/install/cafe24`)을 이미 등록한 운영 앱은 "테스트 실행" 시 즉시 410 Gone을 받는다. 마이그레이션 경로(기존 등록자 안내·유예 기간)가 코드 내에 없고, plan에 "후속 PR"로 미룬 상태다. 배포 직후 운영 고객에게 무음 장애가 발생한다.
  - 제안: 배포 전 기존 `pending_install` 행 전체에 대해 `installToken`을 역산한 신규 URL로 재등록 안내를 보내거나, 유예 기간(예: 30일) 동안 410 대신 301/302로 신규 경로를 안내하는 redirect를 제공해야 한다. 410 전환 시점을 별도 PR로 분리하는 것이 안전하다.

- **[WARNING]** `IntegrationDto.meta` 필드가 `@ApiProperty` (required) 로 추가 — Swagger codegen 클라이언트 파괴
  - 위치: `integration-response.dto.ts` — `meta: { appType: 'public' | 'private' | null }`
  - 상세: 기존 DTO에 없던 non-optional 필드가 추가되었다. REST 클라이언트 자체는 추가 필드를 무시하므로 런타임 파괴는 없으나, OpenAPI Swagger Codegen으로 생성된 타입을 사용하는 외부 통합(또는 내부 typing strict 검사)은 스키마 버전 불일치로 깨진다. `@ApiPropertyOptional`로 선언하거나 API 버전 범프가 필요하다.
  - 제안: 신규 필드는 `@ApiPropertyOptional`로 선언하고 프론트엔드에서 `integration.meta?.appType`으로 optional chaining 처리를 유지한다. 실제로 프론트엔드 코드에서 이미 `?.appType`을 사용하고 있어 런타임 호환은 되어 있다.

- **[WARNING]** `handleInstall` 에러 응답 HTTP 상태 코드 변경 — 토큰 미존재 시 403→404
  - 위치: `integration-oauth.service.ts` — `handleInstall()`, `integrations.controller.ts` — catch block
  - 상세: 구 구현은 "매칭 통합 없음" 케이스에 `ForbiddenException(403)`을 반환했다. 신규 구현은 `CAFE24_INSTALL_INVALID_TOKEN`에 `NotFoundException(404)`를 반환한다. 컨트롤러의 catch block은 `e.status`를 기준으로 `403`인 경우만 특수 처리한다 — 404는 이 분기를 타지 않아 에러 렌더링 경로가 달라질 수 있다. 또한 기존 e2e 테스트가 403 기대값으로 작성되어 있으며 plan에 전환 항목(`[ ]`)이 미완 상태다.
  - 제안: 컨트롤러 catch block을 404도 처리하도록 확장하거나, catch 로직을 status 기반에서 `code` 기반으로 전환한다. 미완 e2e 전환 항목을 본 PR에 포함시키거나 즉시 후속 처리해야 한다.

- **[WARNING]** `lastError` Swagger 스키마 변경 — `additionalProperties` 제거
  - 위치: `integration-response.dto.ts` — `lastError` 필드
  - 상세: 기존 `additionalProperties: true`에서 `{ code, message, at }` 고정 스키마로 변경됐다. 기존 응답에 `code`/`message`/`at` 외 필드가 포함된 경우(예: provider별 추가 진단 필드) OpenAPI strict 모드 클라이언트에서 검증 실패가 발생할 수 있다. 런타임 영향은 없지만 스키마 계약 위반이다.
  - 제안: 기존 `lastError` 기록이 `{ code, message, at }` 외 필드를 포함할 수 있는지 DB에서 확인 후, 포함 가능하면 `additionalProperties: true`를 유지하거나 마이그레이션을 병행한다.

- **[INFO]** `OAuthBeginResult.appUrl` 값 형식 변경 — install_token path segment 포함
  - 위치: `integration-oauth.service.ts` — `return { appUrl: \`…/cafe24/${installToken}\` }`
  - 상세: `POST /integrations/oauth/begin` 응답의 `appUrl` 값이 `/oauth/install/cafe24`에서 `/oauth/install/cafe24/<64자 hex>`로 바뀐다. 이 URL을 사용자에게 표시하거나 저장하는 모든 클라이언트는 새 형식을 인지해야 한다. 프론트엔드는 동일 PR에서 업데이트되어 있어 조율 완료.
  - 제안: 외부 클라이언트가 이 URL을 파싱하거나 변환한다면 path 구조 변경을 명시적으로 문서화해야 한다.

- **[INFO]** 새 에러 코드 3종 추가 — 문서화 필요
  - 위치: `integration-oauth.service.ts`, `integrations.controller.ts`
  - 상세: `CAFE24_INSTALL_INVALID_TOKEN(404)`, `CAFE24_INSTALL_LEGACY_PATH(410)`, `CAFE24_PRIVATE_APP_ALREADY_CONNECTED(409)` 세 에러 코드가 추가됐다. Swagger `@ApiResponse` 데코레이터에 이 에러 응답이 문서화되어 있지 않다.
  - 제안: `@ApiResponse({ status: 404, description: 'CAFE24_INSTALL_INVALID_TOKEN' })` 등 에러 응답 데코레이터를 컨트롤러에 추가한다.

---

### 요약

이번 변경의 핵심 API 계약 리스크는 **기존 Cafe24 Private 앱 등록자에 대한 하위 호환성 파괴**다. `/oauth/install/cafe24` 경로를 즉시 410으로 전환하면 구 URL을 등록한 운영 앱이 배포 즉시 장애를 겪으며, 이에 대한 마이그레이션 경로가 plan에 미완 항목(`[ ]`)으로만 남아 있다. 나머지 변경들(meta 필드 추가, lastError 스키마 정제, 새 에러 코드)은 additive하거나 codegen 수준의 호환성 이슈이며 런타임 파괴 위험은 낮다. 컨트롤러 catch block의 403 하드코딩이 신규 404 에러를 누락할 수 있는 점도 즉시 수정이 필요하다.

### 위험도

**HIGH**