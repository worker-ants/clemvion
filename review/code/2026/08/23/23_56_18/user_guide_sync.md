# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재

`.claude/config/doc-sync-matrix.json` (`rows[]`, 21행) 을 SSOT 로 Read 했다. 이번 변경 file 목록(payload 기준 56개)을 각 행의 `trigger.globs`/`trigger.match=="semantic"` 의미와 대조했다.

## 변경 파일 요약

56개 변경 파일 전량을 확인했다. 실질 소스 변경은 전부 backend 이며, 나머지는 spec/plan/review 산출물이다.

- 핵심 로직(backend, TS): `codebase/backend/src/modules/websocket/websocket.service.ts`(+`.spec.ts`), `codebase/backend/src/shared/utils/node-output-allowlist.ts`(+`.spec.ts`), `codebase/backend/src/modules/external-interaction/interaction.service.spec.ts`(REST 캐너리 1건 추가)
- spec: `spec/5-system/14-external-interaction-api.md`(§R17), `spec/5-system/6-websocket-protocol.md`(§4.4) — 내부 wire 프로토콜 명세, `codebase/frontend/src/content/docs/**` product-facing docs 아님
- plan: `plan/complete/sse-nodeoutput-allowlist.md`, `plan/in-progress/spec-draft-eia-62-waiting-payload.md`, `plan/in-progress/spec-sync-external-interaction-api-gaps.md` — 자기반증형 소정정(취소선+정정) 갱신
- 문서: `CHANGELOG.md` — "SSE·fanout 은 여전히 deny-list(잔여)" 문구를 취소선 처리하고 정정 블록 추가
- 리뷰/consistency 산출물(이 워크플로가 상시 생성): `review/code/2026/08/23/22_51_46/**`, `review/code/2026/08/23/23_16_40/**`, `review/consistency/2026/08/23/22_26_33/**`, `review/consistency/2026/08/23/23_29_27/**` — 코드 변경이 아니라 직전 라운드들의 리뷰 아티팩트

`codebase/frontend/**` 또는 `codebase/channel-web-chat/**` 아래는 **단 한 파일도** 이번 변경 set 에 없음을 grep(`codebase/frontend`)으로 재확인했다 — 매트릭스 21행 중 frontend 산출물을 target 으로 갖는 모든 행(new-node, node-schema-change, new-ui-string, integration-provider-change, new-userguide-section-dir, new-warning-code, new-backend-ui-zod-value, auth-config-type-enum-change, expression-language-change, run-debug-flow-change, userguide-gui-flow-section 등)은 trigger 파일 부재로 원천적으로 미매칭이다.

## 매트릭스 매칭 판정

- **new-node / node-schema-change** (`codebase/backend/src/nodes/**`) — 미매칭. 변경은 `modules/websocket/`·`shared/utils/`·`modules/external-interaction/` 아래이고 `nodes/**` 는 미변경(`node-handler.interface.ts` 의 `NodeHandlerOutput` 타입을 import 만 함).
- **new-ui-string / new-widget-chrome-string** — 미매칭. frontend TSX·channel-web-chat TSX 변경 0건(discord/telegram/slack 렌더러·`eia-events.ts` 는 리뷰 산출물 안에서 grep 참조만 됐을 뿐 diff 대상 아님).
- **integration-provider-change** — 미매칭. 신규/변경 provider 없음.
- **new-userguide-section-dir / userguide-gui-flow-section** — 미매칭. `content/docs/` 변경 없음.
- **backend-api-change** (`*.controller.ts`, `dto/**`) — 미매칭.
- **new-warning-code / new-error-code** — 미매칭. `warningRules`, `error-codes.ts` 변경 없음.
- **new-backend-ui-zod-value / new-cross-cutting-enum** — 미매칭.
- **new-handler-output-field** — 재검토했으나 이전 라운드 판정 유지: `payload`/`title`/`rendered`/`nodeType` 는 handler 가 새로 채우는 output 키가 아니라, 기존에 이미 채우던 값을 REST/SSE 외부 표면으로 통과시킬지 결정하는 allowlist 조정이다. `data-hydration-surfaces.md` trigger 취지(신규 output 필드가 여러 frontend hydration 함수에 흩어져 누락)와 다르다.
- **auth-session-flow-change / auth-config-type-enum-change** — 미매칭.
- **expression-language-change** — 미매칭.
- **run-debug-flow-change** — 미매칭. `websocket.service.ts` JSDoc + `spec/5-system/6-websocket-protocol.md` §4.4 신규 단서("`waiting_for_input` 의 `nodeOutput` 키 집합은 공유하지 않는다") + 캐너리(`broadcastToChannel` 원문 보존 단언) 3중으로 "내부 WS(에디터)는 대상 아님"을 못박고 있어 에디터 실행/디버그 UX 는 영향 없음.
- **env-runtime-change** — 미매칭.
- **spec-major-change** (`spec/2-*/**`~`spec/5-*/**`, `spec/conventions/**`) — **glob 매칭됨** (`spec/5-system/14-external-interaction-api.md`, `spec/5-system/6-websocket-protocol.md`). target 은 frontmatter `code:`/`status:`/`pending_plans:` 정합이며, 이는 유저 가이드(product-facing docs) 스코프가 아니라 spec 내부 정합성이다. 동일 변경 set 안에서 `/consistency-check --impl-prep` 두 라운드(`22_26_33`, `23_29_27`, 둘 다 산출물 diff 에 포함)가 이미 이 축을 검증했고, 이번 라운드 diff 자체가 취소선+정정 관례로 SSE 행을 반영했다. **INFO 로만 기록** — 조치 불요.
- **spec-defect-found** — 해당 없음.

## 보조 확인 — 이번 라운드 추가분이 유저 가이드 표면에 새로 닿는지

이번 라운드(직전 `23_16_40` 리뷰 이후)의 실질 증분은 (1) `interaction.service.spec.ts` 에 REST `getStatus` 4키 통과 캐너리 추가, (2) `CHANGELOG.md`/`plan/in-progress/spec-draft-eia-62-waiting-payload.md` 의 자기반증형 소정정(취소선+정정), (3) `plan/complete/**` 이동, (4) 두 라운드분 review/consistency 산출물이다. 넷 다 `codebase/frontend/**`·`codebase/channel-web-chat/**` 를 건드리지 않으므로 직전 라운드(`23_16_40/user_guide_sync.md`) 판정에서 결론이 달라질 근거가 없다. `nodeOutput` 필드를 나열하는 유저 가이드 MDX 페이지 자체가 존재하지 않는다는 사실도 재확인 대상에서 변동 없음(직전 라운드에서 grep 으로 확인 완료, 이번 라운드는 그 grep 대상 파일들을 건드리지 않음).

## 발견사항

- **[INFO]** `spec/5-system/14-external-interaction-api.md`, `spec/5-system/6-websocket-protocol.md` 가 `doc-sync-matrix.json` 의 `spec-major-change` 행 glob(`spec/5-*/**`)에 매칭되지만, target(frontmatter 정합)은 이미 diff 안에서 충족돼 있고 두 차례의 consistency-check 라운드(`22_26_33`, `23_29_27`, 둘 다 BLOCK:NO)가 이미 검증·해소를 완료했다.
  - 변경 파일: `spec/5-system/14-external-interaction-api.md`, `spec/5-system/6-websocket-protocol.md`
  - 매트릭스 항목: `spec-major-change` — targets: "frontmatter code: / status: / pending_plans: 정합 갱신 · status: implemented 이면 code: 글로브 ≥1 매치 보장"
  - 누락된 동반 갱신: 없음(이미 충족)
  - 상세: SSOT 매칭 원칙에 따라 기록만 남김. 이 항목은 consistency-checker 영역과 겹치며 이번 리뷰(user-guide-sync)의 실질적 조치 대상은 아님.
  - 제안: 조치 불요.

CRITICAL/WARNING 급 발견사항 없음.

## 요약

이번 변경 set(56개 파일)은 backend `codebase/backend/src/modules/websocket/`·`shared/utils/`·`modules/external-interaction/` 의 보안 하드닝(SSE/webhook fanout `nodeOutput` allowlist 를 REST 와 같은 강도로 확대) + 그에 수반된 test 캐너리 + spec/plan 자기반증형 소정정 + 두 라운드분 review/consistency 산출물로 구성되며, `codebase/frontend/**`·`codebase/channel-web-chat/**` 를 단 한 파일도 건드리지 않는다. 매트릭스 21행 중 `spec-major-change` 1행만 glob 매칭됐고 그 target(spec frontmatter 정합)은 이미 diff 자체 + 두 차례 consistency-check 로 충족이 확인돼 조치 불필요(INFO 1건). 새 노드·노드 스키마 변경·신규 UI 문자열·통합 provider 변경·신규 문서 섹션·auth/세션 흐름 변경·표현식 언어 변경·신규 warning/error 코드 중 매칭되는 trigger 없음. 직전 라운드(`review/code/2026/08/23/23_16_40/user_guide_sync.md`) 판정과 결론 동일 — 유저 가이드 동반 갱신 관점에서 실질 누락 없음.

## 위험도
NONE
