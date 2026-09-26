---
title: 성공 응답을 광고하지 않는 라우트 11곳 — 응답 DTO · 광고 · 가드를 «하나 이상 광고» 로
status: in-progress
owner: developer
worktree: success-advert
spec_impact:
  - spec/conventions/swagger.md
started: 2026-09-26
---

# 성공 응답 광고가 없는 라우트

트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md` 항목 «성공 응답을 광고하지 않는 라우트 핸들러가 15곳 있다 —
가드는 «광고가 있으면 맞아야 한다» 만 본다» 를 닫는다. 같은 항목에 걸린 `http-status-advertised-guard.ts` docstring 수치 오기(#1403
`/ai-review` 2R W2 — 수렴 예외)도 함께 고친다.

## 실측 (2026-09-26, `src/modules` 핸들러 223개 — `post-status-openapi` 의 AST 전수 스크립트를 다시 돌렸다)

성공(2xx) 응답 데코레이터가 하나도 없는 핸들러 **15곳**(등재 때와 같다):

| 자리 | 수 | 실제 응답 | 처방 |
| --- | --- | --- | --- |
| `executions` `_test/*` 훅 | 2 | 202 | 없음 — `@ApiExcludeEndpoint()`(OpenAPI 밖, 의도) |
| `auth` `oauth/:provider` · `oauth/:provider/callback` | 2 | `res.redirect` 302 | 없음 — **이미 `@ApiFoundResponse`(302)를 광고한다.** 전수가 2xx 만 셌을 뿐 |
| `webauthn` `availability` | 1 | `200 { data: { enabled } }` | 응답 DTO `WebAuthnAvailabilityDto` + `ApiOkWrappedResponse` |
| `webauthn` `DELETE credentials/:id` | 1 | 204 | `@ApiNoContentResponse` |
| `interaction-stream` `:executionId/stream` | 1 | SSE 200(`@Res()` — Nest 가 핸들러 전에 싣는다) | `@ApiOkResponse`(이미 `@ApiProduces('text/event-stream')`) |
| `triggers` `notification/rotate-secret` · `interaction/revoke-token` | 2 | `200 { data: { secret, rotatedAt } }` · `{ data: { token } }` | 응답 DTO 둘 + `ApiOkWrappedResponse` |
| `workflow-assistant` 세션 `list` · `latest` · `findOne` · `create` · `update` · `remove` | 6 | 엔티티를 그대로 반환(`remove` 204) | 응답 DTO(세션 · 세션 상세 · 메시지 + 중첩 셋) + 래퍼. `latest` 는 없으면 `null` — 새 래퍼 `ApiOkWrappedNullableResponse` |

→ 채울 곳 **11**, 처방 없음 4(제외 2 · 이미 302 광고 2).

## 방향

- **가드를 조인다** — `http-status-advertised` 에 «라우트(`@ApiExcludeEndpoint()` 제외)는 성공 응답을 **하나 이상** 광고한다» 를 더한다.
  리다이렉트로 끝나는 라우트는 3xx(`@ApiFoundResponse` 등)가 성공 광고다 — 리다이렉트만 광고한 라우트는 2xx 짝 대조를 하지 않는다
  (지금도 그렇다 — 광고 2xx 집합이 비면 대조하지 않는다). 베이스라인 0.
- **응답 DTO 는 실제 응답을 적는다** — 엔티티를 그대로 반환하는 workflow-assistant 는 반환 모양을 바꾸지 않고 DTO 가 그 모양을
  적는다(컬럼 전부 · 관계 없음). 맞는지는 e2e 가 `assertMatchesContract(res.body.data, await contractForDto(Dto))` 로 본다 —
  «스키마에 선언되지 않은 키가 응답에 있다» 축까지(api-convention §5.4 «검증 층»).
- **도구 호출의 `arguments` · `result` 는 열린 객체** — 도구마다 인자 스키마가 달라 키 집합이 런타임에 정해진다(`swagger.md` §1-4
  «열린/동적 map»). 나머지(계획 · 사용량 · 계획 단계)는 닫힌 DTO.
- **spec** — `swagger.md` §2-4 의 «성공 응답을 하나도 광고하지 않는 핸들러는 대조하지 않는다» 와 Rationale 의 ««광고가 있어야 한다» 는
  이 규칙이 아니다(별 결정)» 를 이 결정으로 바꾸고, §5-2 래퍼 표에 `ApiOkWrappedNullableResponse` 한 줄. planner draft → `--spec`.

## 요구 (순서대로)

1. spec draft → `--spec` → 반영(planner 커밋) → `--impl-prep`.
2. 래퍼 `ApiOkWrappedNullableResponse` + 단위 테스트.
3. 응답 DTO · 광고 11곳.
4. 가드 «하나 이상 광고» + 대조군 + docstring 정정 — RED 확인(11).
5. e2e 계약 대조(workflow-assistant 세션 · triggers 둘 · webauthn availability).
6. CHANGELOG — (1) OpenAPI 가 11개 엔드포인트의 성공 응답 스키마를 광고한다 · (3) 가드 강화.
7. 트래커 항목 닫기.

## 체크리스트

- [ ] spec draft `--spec` · 반영
- [ ] `--impl-prep`
- [ ] 래퍼 · DTO · 광고 11곳
- [ ] 가드 강화(RED 확인) · docstring 정정
- [ ] e2e 계약 대조
- [ ] 뮤턴트
- [ ] CHANGELOG
- [ ] TEST WORKFLOW (lint · unit · build · e2e)
- [ ] `/ai-review`
- [ ] `--impl-done`
- [ ] 트래커 항목 닫기
