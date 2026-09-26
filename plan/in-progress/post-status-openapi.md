---
title: 성공 응답 코드를 OpenAPI 광고와 맞춘다 — POST 액션 14곳 201→200 · 초대 취소 광고 204→200 · 정적 가드
status: in-progress
owner: developer
worktree: post-status-openapi
spec_impact: none
started: 2026-09-26
---

# 성공 응답 코드 ↔ OpenAPI 광고 정합

트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md` 항목 «POST 라우트가 OpenAPI 로 200 을 광고하면서 실제로는
201 을 낸다» 를 닫는다. 트래커가 적은 두 자리(`leave` · `transfer-ownership`)는 모집단의 일부였다 — 전수 스캔이 먼저라는 트래커
지시대로 컨트롤러 전체를 AST 로 셌다.

## 실측 (2026-09-26, `src/modules` 의 `*.controller.ts` 핸들러 223개)

판정: 실제 = `@HttpCode(n)` 이 있으면 n, 없으면 Nest 기본값(POST 201 · 그 외 200). 광고 = 성공(2xx) 응답 데코레이터의 상태 집합
(`ApiOk*` 200 · `ApiCreated*` 201 · `ApiAccepted*` 202 · `ApiNoContent*` 204 · `ApiResponse({ status: 2xx })`). 광고가 있는데
실제를 포함하지 않으면 불일치.

- **불일치 15곳** — 전부 수정 대상이다.
  - POST + 200 광고 + `@HttpCode` 없음 → 실제 201 (14곳):
    - `auth-configs` `regenerate`
    - `integrations` `previewTest` · `oauthBegin` · `testConnection` · `rotate` · `reauthorize` · `requestScopes`
    - `knowledge-base` `search`
    - `schedules` `previewExpression`
    - `workflow-assistant` `sendMessage` (SSE)
    - `workflows` `saveCanvas`
    - `workspaces` `leave` · `transferOwnership` · `acceptInvitation`
  - DELETE + 204 광고 → 실제 `200 { data: { ok: true } }` (1곳): `workspaces` `revokeInvitation`.
- **광고 없음 15곳** — 이 PR 범위 밖(아래 «남기는 것»).

### `sendMessage` 는 오탐이 아니다 — 한 번 오판했다

처음엔 `@Res()` 핸들러라 «상태를 스스로 정한다» 고 보고 제외했다. Nest 소스(`@nestjs/core/router/router-execution-context.js`)를
읽으니 **핸들러 호출 전에 `responseController.setStatus(res, httpStatusCode)` 를 무조건 부른다** — `@Res()` 여부와 무관하다.
`sendMessage` 는 `res.status()` 를 부르지 않고 헤더만 설정한 뒤 `flushHeaders()` 하므로, SSE 스트림이 **201 로 나간다**. 가드는
`@Res()` 를 면제하지 않는다.

## 방향 — 광고에 맞춘다(200)

- **규약**: `spec/conventions/swagger.md` §2-4 는 200 = 조회/수정, 201 = Created. 위 14곳은 자원을 만들지 않는 **액션**이다
  (`spec/5-system/2-api-convention.md` 의 «POST = 리소스 생성, 액션 실행» 중 후자).
- **관례**: POST 93개 중 `@HttpCode(200)` 이 42개이고 그 42개가 **전부** 200 을 광고한다(같은 파일의 `resend` 가 예).
- **spec 본문**: `spec/5-system/11-mcp-client.md` 는 `preview-test` 를 «HTTP 200 OK», `spec/2-navigation/4-integration.md` 는
  `POST /api/integrations/:id/test` 의 `pending_install` 응답을 «`200 + { success:false }`» 로 적는다 — 지금 코드가 spec 과 다르다.
- **클라이언트**: `frontend` · `channel-web-chat` · `packages` 에 201 을 정확히 비교하는 자리 0건(`=== 201` 등 grep). assistant SSE
  클라이언트(`frontend/src/lib/api/assistant.ts`)는 `response.ok` 로 판정한다.
- **`revokeInvitation`**: 런타임은 그대로 두고 **광고를 200 으로** 고친다(같은 파일 DELETE 형제들처럼 `ApiOkWrappedResponse(OkResultDto)`).
  이 컨트롤러를 204 로 바꿀지는 planner 트래커 항목 «`workspaces.controller.ts` 만 삭제 성공에 204 대신 `200 {ok:true}` 를 쓴다» 의
  결정이다 — 이 PR 이 선점하지 않는다. 그 결정이 204 로 나면 런타임과 광고를 함께 바꾸면 되고, 가드가 짝을 강제한다.

## 요구

1. **정적 가드** `src/repo-guards/__tests__/http-status-advertised{-guard.ts,.spec.ts}` — 광고된 성공 코드가 실제 성공 코드를
   포함해야 한다. 베이스라인 0(동결 목록 없음). `@ApiExcludeEndpoint()` 는 OpenAPI 에 실리지 않으므로 묻지 않는다. 분류되지 않은
   `Api*Response` 데코레이터가 나오면 실패한다(새 2xx 래퍼가 조용히 판정 밖으로 새지 않게). 대조군 fixture 로 각 분기를 가른다.
2. **14곳에 `@HttpCode(HttpStatus.OK)`**.
3. **`revokeInvitation` 광고 → `ApiOkWrappedResponse(OkResultDto)`**.
4. **e2e**: `workspace-path-guard.e2e-spec.ts` 의 이양 성공 `201` → `200`. `[200, 201]` 로 둘 다 받던 대상 호출은 `200` 으로 조인다
   (불일치를 가리던 자리).
5. **CHANGELOG** 두 항목 — (1) 제품 동작: 14개 엔드포인트의 성공 코드 201→200 + OpenAPI 광고 정정 1곳, (3) 가드 신설.
6. **트래커**: 이 항목 닫기 + «광고 없음 15곳» 신규 등재.

## 남기는 것

- **성공 응답을 광고하지 않는 핸들러 15곳**(2026-09-26 실측) — `@ApiExcludeEndpoint` 테스트 훅 2(의도) · OAuth 리다이렉트 2
  (`auth` `beginOauth` · `oauthCallback`) · SSE 1(`interaction-stream` `stream`) · `webauthn` 2 · `triggers` 2
  (`rotateNotificationSecret` · `revokePerTriggerToken`) · `workflow-assistant` 세션 CRUD 6. 가드는 «광고가 있으면 맞아야 한다» 만
  본다 — «광고가 있어야 한다» 로 조이는 것은 별 항목으로 트래커에 등재한다.

## 체크리스트

- [ ] `--impl-prep`
- [ ] 가드 + fixture (RED 확인)
- [ ] `@HttpCode` 14곳 · 초대 취소 광고
- [ ] e2e 기대값
- [ ] 뮤턴트
- [ ] CHANGELOG
- [ ] TEST WORKFLOW (lint · unit · build · e2e)
- [ ] `/ai-review`
- [ ] `--impl-done`
- [ ] 트래커 항목 닫기 · 신규 등재
