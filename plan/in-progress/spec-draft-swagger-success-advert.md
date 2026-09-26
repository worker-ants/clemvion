---
title: swagger.md §2-4 — 라우트는 성공 응답을 하나 이상 광고한다 · §5-2 `ApiOkWrappedNullableResponse`
status: in-progress
owner: project-planner
worktree: success-advert
spec_impact:
  - spec/conventions/swagger.md
started: 2026-09-26
---

# spec draft — 성공 응답 광고의 존재

구현 plan `plan/in-progress/success-advert.md` 이 가드 `http-status-advertised` 를 «광고가 있으면 맞아야 한다» 에서 «라우트는 성공
응답을 하나 이상 광고한다» 로 조이고, `data` 가 `null` 일 수 있는 응답을 위한 래퍼를 더한다. `spec/conventions/swagger.md` 가 두
규칙의 자리다.

**왜 지금 조이는가**: 이 규칙을 세운 `post-status-openapi` 는 «광고가 있어야 한다» 를 «광고를 채운 뒤의 별 결정» 으로 미뤘다(§2-4
Rationale — 트래커 등재). 그 광고를 이 PR 이 채운다 — 2026-09-26 실측 성공 광고 없는 핸들러 15곳 중 11곳을 채우고, 나머지 넷은
OpenAPI 밖(`@ApiExcludeEndpoint()` 2)이거나 이미 302 를 광고한다(OAuth 리다이렉트 2). 광고가 없으면 생성된 OpenAPI 에 그 라우트의 성공
응답 스키마가 없어 클라이언트 생성기가 반환 타입을 알 수 없다.

**정하지 않는 것**: 리다이렉트 라우트의 광고 형식(`@ApiFoundResponse` 외 3xx) · SSE 이벤트 본문의 스키마화 — 둘 다 이 규칙은 «성공
응답을 광고했는가» 만 묻는다.

## 변경 (1) — §2-4 규칙 문단의 마지막 문장

`저장소 가드 `http-status-advertised` 가 강제한다.` 뒤의 «성공 응답을 하나도 광고하지 않는 핸들러와 `@ApiExcludeEndpoint()` 핸들러는
대조하지 않는다.» 를 아래로 바꾼다.

```markdown
**라우트는 성공 응답을 하나 이상 광고한다** — 2xx 응답 데코레이터, 응답을 `res.redirect` 로 끝내는 라우트는 3xx(`@ApiFoundResponse`
등). 리다이렉트만 광고한 라우트는 위 짝을 대조하지 않는다(실제 코드는 핸들러의 `res.redirect` 가 정한다). `@ApiExcludeEndpoint()`
핸들러는 OpenAPI 밖이라 묻지 않는다.
```

## 변경 (2) — §5-2 공용 래퍼 표

`ApiOkWrappedResponse(Dto)` 행 바로 아래에 넣는다.

```markdown
| `ApiOkWrappedNullableResponse(Dto)` | 단일 객체 또는 `null` 200 OK (예: 없으면 `null` 인 «최근 항목» 조회) | `{ data: <Dto> \| null }` |
```

## 변경 (3) — §5-4 체크리스트 성공 코드 항목

`… 짝을 이루는지 ([§2-4](#2-4-상태-코드-응답-규칙))` 끝에 덧붙인다.

```markdown
 — 성공 응답을 하나도 광고하지 않는 라우트는 없어야 한다(리다이렉트 라우트는 3xx)
```

## 변경 (4) — `## Rationale` 의 §2-4 절, 불릿 ««광고가 있어야 한다» 는 이 규칙이 아니다»

불릿 전체를 아래로 바꾼다.

```markdown
- **«광고가 있어야 한다» 는 광고를 채운 뒤 조였다.** 처음엔 성공 응답을 광고하지 않는 핸들러(같은 날 15곳)를 대조할 것이 없다며
  건너뛰었다 — 광고를 채우는 일이 먼저였다. 뒤이은 PR(`plan/complete/success-advert.md`)이 11곳을 채웠고(응답 DTO 가 없던
  workflow-assistant 세션 6곳 포함), 남은 넷은 OpenAPI 밖(`@ApiExcludeEndpoint()` 2)이거나 이미 302 를 광고하고 있었다(OAuth
  리다이렉트 2 — 전수가 2xx 만 셌다). 그래서 3xx 도 성공 광고로 친다. 새 라우트가 광고 없이 들어오는 순간 가드가 실패한다.
```

## Rationale (이 draft 의)

- **3xx 를 성공 광고로 치는 이유**: `res.redirect` 로 끝나는 라우트의 성공은 리다이렉트다. 2xx 만 성공으로 치면 OAuth 두 라우트에
  거짓 200 광고를 붙여야 한다.
- **§5-2 에 래퍼를 더하는 이유**: `data` 가 `null` 일 수 있는 응답을 기존 래퍼로 광고하면 `data` 가 항상 객체라고 적힌다 — §5-4 는
  wire 의 `null` 을 `nullable` 로 선언하라고 한다(api-convention §5.4). 컨트롤러마다 인라인 스키마를 쓰면 §5-2 가 막으려는 반복이 된다.
- **기각한 대안 — `sessions/latest` 가 없을 때 404**(이 draft 를 쓰며 검토했다): 응답 모양을 바꾸는 계약 변경이고, frontend 는 `null`
  을 «세션 없음» 으로 쓰고 있다. 광고가 실제를 따른다.
