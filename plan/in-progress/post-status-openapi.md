---
title: 성공 응답 코드를 OpenAPI 광고와 맞춘다 — POST 액션 14곳 201→200 · 초대 취소 광고 204→200 · 정적 가드
status: in-progress
owner: developer
worktree: post-status-openapi
spec_impact:
  - spec/conventions/swagger.md
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

- **규약**: `spec/conventions/swagger.md` §2-4 는 200 = 조회/수정, 201 = Created. 위 14곳은 **액션**이다
  (`spec/5-system/2-api-convention.md` 의 «POST = 리소스 생성, 액션 실행» 중 후자). 두 자리는 행이 생기지만 판정을 바꾸지 않는다
  (`--impl-prep` WARNING 2 · 3):
  - `oauthBegin` — cafe24 Private · MakeShop 분기가 `pending_install` 통합 행을 만든다. 그러나 한 핸들러가 분기별 응답
    (`authUrl` · pending 안내)을 내는 OAuth **시작** 액션이고, `swagger.md` §2-5 래퍼 표가 이 분기 응답을 «200 OK» 예시로
    적는다(`ApiOkWrappedOneOfResponse`). 생성은 설치 흐름의 부수효과다.
  - `acceptInvitation` — 멤버십 행이 생긴다. 그러나 1차 자원은 **초대**(토큰을 소비하는 액션)이고 응답은 새 멤버십이 아니라
    합류한 **기존** 워크스페이스다. 초대 **생성**(`POST /:id/invitations`)은 201 이다.
- **관례**: `src/modules` 의 POST 91개 중 `@HttpCode(200)` 이 42개이고, 그중 광고가 있는 40개가 **전부** 200 을 광고한다
  (나머지 2개는 광고 없음 · 같은 파일의 `resend` 가 예). ~~POST 93개 중 42개가 전부 200 을 광고한다~~ — 첫 집계는 가드 대조군
  fixture 를 함께 세었고(POST 2개), 광고 없는 2개를 «전부» 에 넣었다.
- **spec 본문**: `spec/5-system/11-mcp-client.md` 는 `preview-test` 를 «HTTP 200 OK», `spec/2-navigation/4-integration.md` 는
  `POST /api/integrations/:id/test` 의 `pending_install` 응답을 «`200 + { success:false }`» 로 적는다 — 지금 코드가 spec 과 다르다.
- **클라이언트**: `frontend` · `channel-web-chat` · `packages` 에 201 을 정확히 비교하는 자리 0건(`=== 201` 등 grep). assistant SSE
  클라이언트(`frontend/src/lib/api/assistant.ts`)는 `response.ok` 로 판정한다.
- **`revokeInvitation`**: 런타임은 그대로 두고 **광고를 200 으로** 고친다(같은 파일 DELETE 형제들처럼 `ApiOkWrappedResponse(OkResultDto)`).
  이 컨트롤러를 204 로 바꿀지는 planner 트래커 항목 «`workspaces.controller.ts` 만 삭제 성공에 204 대신 `200 {ok:true}` 를 쓴다» 의
  결정이다 — 이 PR 이 선점하지 않는다. 그 결정이 204 로 나면 런타임과 광고를 함께 바꾸면 되고, 가드가 짝을 강제한다.

## `--impl-prep` 경고 처리 (`review/consistency/2026/09/26/09_10_09` BLOCK: NO · Critical 0 · Warning 5)

| # | 지적 | 처분 |
| --- | --- | --- |
| W1 | 신설 가드가 `swagger.md` · `api-convention.md` 의 `code:` 에 없다(세 checker 공통) | planner draft `plan/in-progress/spec-draft-swagger-http-status-guard.md` — `swagger.md` 에만 등재 + §2-4 규칙 문단 · §5-4 체크리스트 · Rationale. `api-convention.md` 는 기각(draft Rationale). `--spec` 후 반영 |
| W2 | `oauthBegin` 은 일부 분기에서 행을 만든다 — «14곳 전부 자원 미생성» 전칭이 틀렸다 | 위 «방향» 의 근거 문장을 좁혔다(§2-5 래퍼 표가 이 분기 응답을 200 으로 적는다) |
| W3 | `acceptInvitation` 은 멤버십 행을 만든다 — 판단 근거 미기록 | 위 «방향» 에 기록(1차 자원=초대, 응답=기존 워크스페이스) |
| W4 | §2-4 · api-convention §6 표에 «자원을 만들지 않는 POST» 칸이 없다 | 트래커 등재(착수는 이 PR 불요 — checker 제안 그대로) |
| W5 | 초대 취소가 planner 항목 «삭제 성공에 204 대신 200» 의 위반 라우트 목록에 없다(2→3) | 그 항목의 실측 문구를 세 라우트로 갱신 |
| INFO4 | 트래커 «신규 repo-guard 가 spec `code:` 에 미등재» 의 모집단이 하나 늘어난다 | 그 항목에 «`http-status-advertised` 는 `swagger.md` 에 등재» 한 줄 |

## 요구

1. **정적 가드** `src/repo-guards/__tests__/http-status-advertised{-guard.ts,.spec.ts}` — 광고된 성공 코드가 실제 성공 코드를
   포함해야 한다. 베이스라인 0(동결 목록 없음). `@ApiExcludeEndpoint()` 는 OpenAPI 에 실리지 않으므로 묻지 않는다. 분류되지 않은
   `Api*Response` 데코레이터가 나오면 실패한다(새 2xx 래퍼가 조용히 판정 밖으로 새지 않게). 대조군 fixture 로 각 분기를 가른다.
2. **14곳에 `@HttpCode(HttpStatus.OK)`**.
3. **`revokeInvitation` 광고 → `ApiOkWrappedResponse(OkResultDto)`**.
4. **e2e**: `workspace-path-guard.e2e-spec.ts` 의 이양 성공 `201` → `200`. `[200, 201]` 로 둘 다 받던 대상 호출은 `200` 으로 조인다
   (불일치를 가리던 자리).
5. **CHANGELOG** 두 항목 — (1) 제품 동작: 14개 엔드포인트의 성공 코드 201→200 + OpenAPI 광고 정정 1곳, (3) 가드 신설.
6. **트래커**: 이 항목 닫기 + «광고 없음 15곳» · W4 신규 등재 + W5 · INFO4 갱신.
7. **spec**: W1 draft → `--spec` → `swagger.md` 반영(planner 커밋).

## 남기는 것

- **성공 응답을 광고하지 않는 핸들러 15곳**(2026-09-26 실측) — `@ApiExcludeEndpoint` 테스트 훅 2(의도) · OAuth 리다이렉트 2
  (`auth` `beginOauth` · `oauthCallback`) · SSE 1(`interaction-stream` `stream`) · `webauthn` 2 · `triggers` 2
  (`rotateNotificationSecret` · `revokePerTriggerToken`) · `workflow-assistant` 세션 CRUD 6. 가드는 «광고가 있으면 맞아야 한다» 만
  본다 — «광고가 있어야 한다» 로 조이는 것은 별 항목으로 트래커에 등재한다.

## 체크리스트

- [x] `--impl-prep` — `review/consistency/2026/09/26/09_10_09` BLOCK: NO(Warning 5 — 위 표)
- [x] spec draft `--spec` · 반영 — `review/consistency/2026/09/26/09_22_45` BLOCK: NO(Warning 3 — draft Rationale) · `4b88bcf74`
- [x] 트래커 W4 등재 · W5 · INFO4 갱신
- [x] 가드 + fixture (RED 확인) — 적용 전 위반 **정확히 15곳**(전수 census 와 일치), 나머지 10 케이스 GREEN
- [x] `@HttpCode` 14곳 · 초대 취소 광고 — 적용 후 11/11 · `5e1f6ab36`
- [x] e2e 기대값 — `[200, 201]` 22곳 · 이양 `201` → `200` · workflow-assistant G(SSE 상태 줄) 신설. **첫 e2e 에서 3파일 RED** —
  저장 성공을 `201` 로 기대한 4곳(`background-monitoring` · `execution-failed-notification` · `graph-warning-save` ×2)이 앞선 전수에서
  빠졌다. 원인: 201 기대값 grep 을 `head -30` 으로 잘라 봤다. `\b201\b` 전 줄(138)을 가장 가까운 요청 경로와 짝지어 다시 세어 대상
  라우트의 201 을 코드 0 · 주석 0 으로 만들었다(`83d095532`)
- [x] CHANGELOG
- [x] 뮤턴트 — 15/15 예측대로 KILLED, 매번 예측한 케이스가 사망 목록에 있었다(하네스 `PYTHONDONTWRITEBYTECODE=1` · `--no-cache` · cp 원복)

  | # | 뮤턴트 | 예측 / 실측 | 죽인 케이스 |
  | --- | --- | --- | --- |
  | G1 | 기본값이 POST 도 200 | KILLED / KILLED | 본 판정 · 대조군 둘 |
  | G2 | `@ApiExcludeEndpoint` 면제 제거 | KILLED / KILLED | 대조군 둘 (저장소엔 광고 있는 제외 핸들러가 없다) |
  | G3 | 광고 없는 핸들러도 대조 | KILLED / KILLED | 본 판정 · 대조군 둘 |
  | G4 | 표에 없는 `Api*Response` 를 조용히 넘김 | KILLED / KILLED | **대조군 unresolved 만** |
  | G5 | 못 읽는 `@HttpCode(<식>)` 를 조용히 기본값으로 | KILLED / KILLED | 대조군 셋 |
  | G6 | 래퍼 표 비움 | KILLED / KILLED | 래퍼 표 · floor · unresolved · 대조군 둘 |
  | G7 | swagger 메타데이터 키 오타(표가 빈다) | KILLED / KILLED | swagger 표 외 5 |
  | G8 | `HttpStatus.X` 를 못 읽음 | KILLED / KILLED | floor · unresolved · 대조군 둘 |
  | G9 | `@ApiResponse` status 를 안 읽음 | KILLED / KILLED | unresolved · 대조군 둘 |
  | G10 | 위반 판정 무력화 | KILLED / KILLED | **대조군 위반 목록만** — 저장소 스캔은 초록 |
  | G11 | 성공 범위가 비어 광고가 전부 사라짐 | KILLED / KILLED | **floor**(`checked > 150`) · 대조군 |
  | C1 | 캐너리의 `@HttpCode` 쪽에서 데코레이터 제거 | KILLED / KILLED | 캐너리 200 케이스 |
  | P1 | `sendMessage` 의 `@HttpCode` 제거 | KILLED / KILLED | 본 판정 |
  | P2 | 초대 취소 광고를 204 로 되돌림 | KILLED / KILLED | 본 판정 |
  | P3 | 이양을 `HttpStatus.CREATED` 로 | KILLED / KILLED | 본 판정 |
- [x] TEST WORKFLOW (lint · unit · build · e2e) — 2회차 전부 PASS: unit backend 478 스위트 · e2e 72 스위트 406건(1회차 e2e 3파일 RED → 위 항목)
- [ ] `/ai-review`
- [ ] `--impl-done`
- [ ] 트래커 항목 닫기 · 신규 등재
