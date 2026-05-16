---
worktree: cafe24-request-envelope-fix-a1b2c3
started: 2026-05-16
owner: developer
---

# Cafe24 PUT/POST `request` envelope 누락 버그 수정

## 배경

운영 로그에서 `mcp_b74e1adc__product_update` 호출이 다음 응답으로 실패:

```json
{ "status": 400, "response": { "error": { "code": 400, "message": "Please enter the Request parameter." } } }
```

원인: Cafe24 Admin API 의 모든 쓰기(POST/PUT) endpoint 는 본문을 `{ "shop_no": <n>, "request": { ... } }` 형태로 envelope wrapping 해야 하는데, 현재 `Cafe24Handler.buildRequestParts` (backend/src/nodes/integration/cafe24/cafe24.handler.ts:264-315) 는 `location: 'body'` 인 필드 전부를 한 객체에 flat 하게 합쳐서 전송한다. Cafe24 가 `request` 키를 찾지 못해 400.

영향: `product_*`, `customer_*`, `category_*`, `mileage_grant`, `product_variants_inventory_update`, board 댓글 작성 등 **모든 PUT/POST 쓰기 operation**.

DELETE 는 path-only (body 없음) 라 envelope 영향 없음.

## 계획

> **레이어 선택**: handler/provider 가 아닌 `Cafe24ApiClient` 안에서 envelope 을 적용한다.
> - envelope 은 Cafe24 wire format 의 고유 규약이지 노드/MCP 의 관심사가 아니다 (client 가 이미 URL prefix·leaky bucket·token refresh 같은 Cafe24 고유 책임을 갖는다).
> - `Cafe24Handler.buildRequestParts` (cafe24.handler.ts:264-315) 와 `Cafe24McpToolProvider.execute` (cafe24-mcp-tool-provider.ts:281-310) 두 곳이 같은 splitting 로직을 중복 보유 — 단일 fix 지점이 drift 를 막는다.

1. **테스트 선작성**
   - `cafe24-api.client.spec.ts` — fetchImpl mock 의 호출 인자 `body` 가 JSON-deserialize 했을 때 `{ shop_no?, request: {...rest} }` 형태인지 단언. PUT, POST, body 가 없는 DELETE 각각.
   - `cafe24.handler.spec.ts` — 기존 `'PUT — body fields routed to body, path fields to URL'` 테스트는 client 까지의 인터페이스가 그대로 (flat body 전달) 라 변경 없음. 다만 통합 단언 한 케이스("client 가 받은 body 가 envelope 된 형태로 wire 에 나가는지") 는 client spec 책임.
2. **구현** — `Cafe24ApiClient.executeWithRateLimit` 의 body JSON.stringify 직전에 helper `wrapInCafe24Envelope(body)` 호출:
   - `shop_no` 는 top-level 에 유지
   - 그 외 필드는 `request: { ... }` 안으로
3. **handler / provider 변경 없음** — flat body 를 그대로 전달.
4. **spec 갱신 노트** — `spec/conventions/cafe24-api-metadata.md` 에 envelope 규약 명시 + `spec/4-nodes/4-integration/4-cafe24.md` §4.1 wrapper 책임에 envelope wrapping 추가. 권한 밖이라 `plan/in-progress/spec-update-cafe24-request-envelope.md` 에 제안 노트만 남기고 `project-planner` 위임.

## 점검 사항

- `cafe24-api.client.ts` 의 `executeWithRateLimit` 만 envelope 적용. handler / provider 는 flat body 유지.
- `Cafe24ApiClient.call` 의 외부 시그니처(`Cafe24CallOptions.body: Record<string, unknown>`) 는 그대로 — flat 객체 그대로 받음.
- 동일 envelope 이 token refresh 의 `POST /oauth/token` 에도 적용되면 OAuth 실패 가능성. **token refresh 는 form-urlencoded 라 envelope 무관** (이미 별도 fetch 경로).
