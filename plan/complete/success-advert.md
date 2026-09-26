---
title: 성공 응답을 광고하지 않는 라우트 11곳 — 응답 DTO · 광고 · 가드를 «하나 이상 광고» 로
status: complete
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

## 검토 경고 처리

| 출처 | 지적 | 처분 |
| --- | --- | --- |
| `--spec` `13_07_11` W1~W3 · INFO | Rationale 의 완료 plan 경로 선인용 · 리다이렉트 예외와 SSE `@Res()` 불면제의 구분 · 절 번호 표기 | draft 반영(draft `## Rationale` 끝 «`--spec` 경고 처리») |
| `--impl-prep` `13_17_19` W1 | `4-ai-assistant.md` §6 API 표에 `GET sessions/latest` 가 없다 — 이 PR 전부터의 spec 갭 | 트래커 등재(planner) |
| `--impl-prep` `13_17_19` W2 | `revoke-token` 을 trigger-list 는 «회전이 아니라 폐기», EIA §7.3 · AU-07 은 «rotation» 으로 적는다 | 트래커 등재(planner). 새 응답 DTO 설명은 메커니즘(무효화 + 새 발급)대로 적었다 |
| `--impl-prep` `13_17_19` W3 | 도구 호출 `arguments` · `result` 를 여는 근거가 §1-4 가 기각한 «번거롭다» 와 구별되지 않는다 | DTO 주석에 §1-4 «SoT 이중화 회피» 예외를 근거로 — 인자 형태의 정본은 `tools/tool-definitions.ts`, 엔티티 · frontend 타입도 열린 모양 |
| `--impl-prep` `13_17_19` W4 | `swagger.md` Rationale 불릿이 구현 전인데 완료형 | 같은 PR 의 구현 커밋 뒤 참이 된다 — `--impl-done` 에서 재확인 |
| `--impl-prep` `13_17_19` W5 · INFO8 | DTO 이름 — 모듈 접두 · 도메인 접두 | workflow-assistant 는 `Assistant` 접두(`AssistantSessionDto` 등), triggers 는 같은 모듈 선례 `ChatChannelRotateBotTokenDto` 를 따라 `NotificationRotateSecretDto` · `InteractionRevokeTokenDto` |

## 요구 (순서대로)

1. spec draft → `--spec` → 반영(planner 커밋) → `--impl-prep`.
2. 래퍼 `ApiOkWrappedNullableResponse` + 단위 테스트.
3. 응답 DTO · 광고 11곳.
4. 가드 «하나 이상 광고» + 대조군 + docstring 정정 — RED 확인(11).
5. e2e 계약 대조(workflow-assistant 세션 · triggers 둘 · webauthn availability).
6. CHANGELOG — (1) OpenAPI 가 11개 엔드포인트의 성공 응답 스키마를 광고한다 · (3) 가드 강화.
7. 트래커 항목 닫기.

## 체크리스트

- [x] spec draft `--spec` · 반영 — `review/consistency/2026/09/26/13_07_11` BLOCK: NO · planner 커밋 `24084fd0e`
- [x] `--impl-prep` — `review/consistency/2026/09/26/13_17_19` BLOCK: NO(Warning 5 — 아래 표)
- [x] 래퍼 · DTO · 광고 11곳 — `b98dfe1da`
- [x] 가드 강화(RED 확인) · docstring 정정 — 적용 전 광고 없음 **정확히 11**(제외 2 · 리다이렉트 2 는 안 잡힘), 적용 후 GREEN
- [x] e2e 계약 대조 — workflow-assistant(생성 · 목록 · 상세 · 수정 · 최근) · revoke-token · 새 `advertised-response-contract.e2e-spec.ts`(webauthn availability · rotate-secret)
- [x] 뮤턴트 — 6/6 예측대로 KILLED, 예측 케이스 전부 사망. 뮤턴트 전에 `@ApiResponse({ status: 302 })` 대조군을 먼저 더했다(`a7202d9eb`) — 그 분기(S3)를 저장소도 대조군도 쓰지 않아 살아남을 자리였고, 실제로 S3 는 그 대조군만 죽인다

  | # | 뮤턴트 | 예측 / 실측 | 죽인 케이스 |
  | --- | --- | --- | --- |
  | S1 | 광고 없음을 보고하지 않음 | KILLED / KILLED | **대조군만** — 저장소 스캔은 이제 초록 |
  | S2 | 이름 표의 3xx 를 성공 광고로 안 침 | KILLED / KILLED | 본 판정(OAuth 리다이렉트 2) · 대조군 |
  | S3 | `@ApiResponse` 의 3xx 를 성공 광고로 안 침 | KILLED / KILLED | **대조군만**(302 대조군) |
  | S4 | `@ApiExcludeEndpoint` 도 묻는다 | KILLED / KILLED | 본 판정(테스트 훅 2) · 대조군 둘 |
  | S5 | nullable 래퍼가 `nullable` 을 잃음 | KILLED / KILLED | 래퍼 단위 테스트 |
  | S6 | `sessions/latest` 광고 제거 | KILLED / KILLED | 본 판정 |

  `/ai-review` 1R 이 분류를 `classifyDecorators` + 헬퍼 `advertise` 로 옮긴 뒤(`bf1fa96fc`) 새 자리로 다시 돌렸다 — **8/8 예측대로
  KILLED**, 예측 케이스 전부 사망. 헬퍼를 공유하게 된 두 분기가 따로 덮이는지 S3 를 둘로 나눴고, 리팩터가 옮긴 `actualKnown` 을
  S7 로 더했다.

  | # | 뮤턴트(리팩터 뒤) | 예측 / 실측 | 죽인 케이스 |
  | --- | --- | --- | --- |
  | S1 | 광고 없음을 보고하지 않음 | KILLED / KILLED | 대조군만 |
  | S2 | 헬퍼 `advertise` 가 3xx 를 성공 광고로 안 침 | KILLED / KILLED | 본 판정 · 대조군 |
  | S3a | `@ApiResponse` 분기만 3xx 를 버림 | KILLED / KILLED | **대조군만**(302 대조군) |
  | S3b | 이름 표 분기만 3xx 를 버림 | KILLED / KILLED | 본 판정(OAuth 리다이렉트 2) · 대조군 |
  | S4 | `@ApiExcludeEndpoint` 도 묻는다 | KILLED / KILLED | 본 판정 · 대조군 둘 |
  | S5 | nullable 래퍼가 `nullable` 을 잃음 | KILLED / KILLED | 래퍼 단위 테스트 |
  | S6 | `sessions/latest` 광고 제거 | KILLED / KILLED | 본 판정 |
  | S7 | 못 읽은 `@HttpCode(<식>)` 를 아는 코드로 침 | KILLED / KILLED | 대조군 둘(위반 여섯 · 맞는 자리) |
- [x] CHANGELOG — 두 항목(스키마 광고 · 가드 강화)
- [x] TEST WORKFLOW (lint · unit · build · e2e) — 전부 PASS(e2e 411건 — 새 계약 대조 포함, 선언되지 않은 키 0)
- [x] `/ai-review` — 1R `review/code/2026/09/26/13_39_09`(Critical 0 · Warning 3 → 조치 `bf1fa96fc`) · 2R 전수 14명
      `review/code/2026/09/26/14_07_11`(Critical 0 · Warning 1 — CHANGELOG 경로 표기, `codebase/**` 밖에서 조치). 정지 규칙 «Critical 0 ·
      Warning 0 · 그 라운드 codebase 수정 0건» 을 2R 에서 충족. 테스트 INFO 세 칸은 트래커 등재
- [x] `--impl-done` — `review/consistency/2026/09/26/14_17_49` BLOCK: NO. scope 는 이 브랜치가 바꾼 코드의 spec 소유 문서 10개
      (`review_guard._spec_linked_changes`). Warning 2 는 이미 트래커에 있는 planner 항목(`sessions/latest` §6 · `revoke-token` 서술) ·
      INFO 둘(§6 역할 서술 · §5-2 각주)을 트래커에 반영 · W4(Rationale 완료형)는 구현 뒤 참이 됐다
- [x] 트래커 항목 닫기 — 종결 노트에 채운 곳 · 가드 · 리뷰 · `--impl-done` 세션
