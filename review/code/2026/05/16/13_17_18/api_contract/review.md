### 발견사항

- **[WARNING]** `cafe24Install` 핸들러: `@ApiOkResponse`가 실제 응답(302 redirect)과 불일치
  - 위치: `backend/src/modules/integrations/third-party-oauth.controller.ts`, `@ApiOkResponse({ description: '302 redirect to Cafe24 authorize URL' })`
  - 상세: Swagger 데코레이터가 `@ApiOkResponse`(HTTP 200)로 선언되어 있으나 실제 성공 경로는 `res.redirect(302, redirectUrl)`로 302를 반환한다. OpenAPI 스펙과 실제 응답 코드가 불일치하여 API 클라이언트가 200을 기대하고 대응 로직을 작성할 경우 혼란이 생긴다.
  - 제안: `@ApiOkResponse` 대신 `@ApiMovedPermanentlyResponse` 또는 `@ApiResponse({ status: 302, description: '...' })`로 교체하거나, Swagger 커스텀 데코레이터를 사용해 실제 응답 코드를 정확히 문서화한다.

- **[INFO]** `oauthCallback` 핸들러: HTTP 200으로 에러 상황을 반환하는 설계는 문서화됐지만 주의 필요
  - 위치: `backend/src/modules/integrations/third-party-oauth.controller.ts`, `oauthCallback` 메서드
  - 상세: 에러(OAUTH_DENIED, OAUTH_STATE_MISMATCH 등) 시에도 HTTP 200 + HTML 페이지를 반환하고 `postMessage`로 에러 코드를 전달하는 설계다. API 문서(`description` 내 마지막 줄)에 이 사실이 명시되어 있고 OAuth pop-up 패턴의 의도적 선택이므로 breaking change는 아니다. 그러나 `@ApiBadRequestResponse` 데코레이터가 선언되어 있음에도 실제로 provider 불일치 시 `res.status(400)` + HTML을 반환하는 경로가 존재해 문서와 구현 사이에 미묘한 불일치가 있다(Swagger는 JSON 400을 암시하나 실제로는 HTML 400).
  - 제안: `@ApiBadRequestResponse` 에 `@ApiProduces('text/html')` 를 함께 명시하거나, 에러 응답도 항상 200으로 통일한다는 방침을 Swagger 설명에 더 명확히 기재한다.

- **[INFO]** `cafe24Install` 에러 핸들러: Accept 헤더에 따라 JSON / HTML 이중 응답 형식 — API 계약 문서화 부재
  - 위치: `backend/src/modules/integrations/third-party-oauth.controller.ts`, `cafe24Install` 메서드 catch 블록
  - 상세: `Accept: text/html` 요청에는 HTML 에러 페이지를, 그 외에는 `{ error: { code, message } }` JSON을 반환한다. 이 이중 응답 형식은 `@ApiProduces`나 `@ApiResponse` 레벨에서 문서화되지 않아, Swagger UI를 보는 API 클라이언트가 HTML 응답을 받을 수 있다는 사실을 알 수 없다.
  - 제안: `@ApiProduces('application/json', 'text/html')`를 핸들러에 추가하고, 에러 응답 설명에도 "브라우저(Accept: text/html) 클라이언트에는 HTML 에러 페이지 반환"을 명시한다.

---

나머지 변경 파일(`backend/src/migrations.spec.ts`, `backend/src/nodes/integration/send-email/send-email.schema.spec.ts`, `backend/src/nodes/logic/if-else/if-else.schema.ts`)은 테스트 코드 포매팅 정리(줄 바꿈 조정) 및 문자열 따옴표 스타일 변경에 그치며 API 계약에 영향을 주지 않는다.

### 요약

이번 변경의 핵심은 `ThirdPartyOAuthController`의 에러 응답을 자체 API 규약(`{ error: { code, message } }` envelope)에 맞게 수정(API H-1)하고, `postMessage` targetOrigin 검증(SEC H-3)을 추가한 것이다. 에러 envelope 통일은 하위 호환성 측면에서 긍정적이나, Swagger 문서와 실제 HTTP 응답 코드 사이의 불일치(`@ApiOkResponse` vs 실제 302 redirect, `@ApiBadRequestResponse` vs 실제 HTML 400)가 두 곳에서 발견된다. 또한 Accept 헤더 기반 이중 응답 포맷이 Swagger에 문서화되지 않아 API 계약 명확성이 낮다. 나머지 파일은 코드 포매팅·스타일 정리로 API 계약과 무관하다.

### 위험도
LOW
