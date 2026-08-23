# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재

`.claude/config/doc-sync-matrix.json` (`rows[]`, 21행) 을 SSOT 로 Read 했다. 이번 변경 file 목록(총 31개, orchestrator payload 기준)을 각 행의 `trigger.globs`/`trigger.match=="semantic"` 의미와 대조했다.

## 변경 파일 요약

- 핵심 로직: `codebase/backend/src/modules/websocket/websocket.service.ts`, `codebase/backend/src/shared/utils/node-output-allowlist.ts` (+ 대응 `.spec.ts` 2건, `interaction.service.spec.ts` 캐너리 1건 추가)
- spec: `spec/5-system/14-external-interaction-api.md`(§R17), `spec/5-system/6-websocket-protocol.md`(§4.4)
- plan: `plan/in-progress/spec-sync-external-interaction-api-gaps.md`, `plan/in-progress/sse-nodeoutput-allowlist.md`(신규)
- 문서: `CHANGELOG.md`
- 리뷰 산출물(이전 라운드): `review/code/2026/08/23/22_51_46/**`(13개), `review/consistency/2026/08/23/22_26_33/**`(8개) — 코드가 아니라 워크플로가 상시 생성하는 리뷰 아티팩트

`codebase/frontend/**` 또는 `codebase/channel-web-chat/**` 아래는 **단 한 파일도** 이번 변경 set 에 없다.

## 매트릭스 매칭 판정

- **new-node / node-schema-change** (`codebase/backend/src/nodes/**`) — 미매칭. 변경은 `modules/websocket/`·`shared/utils/` 아래이고 `nodes/**` 는 건드리지 않음(참조만: `node-handler.interface.ts` 의 `NodeHandlerOutput` 타입을 import 할 뿐 그 파일 자체는 미변경).
- **new-ui-string** (`frontend/src/**/*.tsx`) — 미매칭. frontend TSX 변경 0건.
- **new-widget-chrome-string** (`channel-web-chat/src/**/*.tsx`) — 미매칭. channel-web-chat 소스는 리뷰 산출물 안에서 "grep 으로 확인"만 됐을 뿐 실제로 diff 에 포함된 파일이 없음(discord/telegram/slack 렌더러도 참조만, 미변경).
- **integration-provider-change** — 미매칭. 신규/변경 provider 없음(기존 chat-channel 렌더러가 이미 읽던 필드를 외부 노출 allowlist 에 추가하는 것뿐).
- **new-userguide-section-dir** — 미매칭. `content/docs/` 신규 디렉토리 없음.
- **backend-api-change** (`*.controller.ts`, `dto/**`) — 미매칭. controller/DTO 변경 없음.
- **new-bullmq-queue** — 미매칭.
- **new-warning-code / new-error-code** — 미매칭. `warningRules`, `error-codes.ts` 변경 없음.
- **new-cross-cutting-enum** — 미매칭.
- **new-backend-ui-zod-value** — 미매칭. zod `ui.label/hint/group` 류 변경 없음.
- **new-handler-output-field** (`output.result.*` 신규 키) — 검토했으나 미매칭으로 판정. `payload`/`title`/`rendered`/`nodeType` 는 프레젠테이션 노드 핸들러가 **기존에 이미 채우던** 필드다. 이번 PR 은 handler 가 새 필드를 추가하는 게 아니라, **외부 SSE/webhook 표면으로 통과시킬지**를 결정하는 fail-closed allowlist(`NODE_OUTPUT_ALLOWED_KEYS`)에 그 넷을 추가하는 것 — REST `getStatus` 는 이미 #1205 에서 이 넷을 노출 중이었고 이번 PR 은 SSE/webhook 쪽 강도를 REST 와 맞춘 것뿐이다. "신규 output 키 도입"이 아니라 "기존 키의 외부 노출 표면 확대"라 `data-hydration-surfaces.md` 매트릭스 trigger 의 취지(신규 필드가 여러 frontend hydration 함수에 흩어져 누락되는 것을 막는다)와는 다르다.
- **auth-session-flow-change** (`backend/src/modules/auth/**`) — 미매칭.
- **auth-config-type-enum-change** — 미매칭.
- **expression-language-change** (`packages/expression-engine/**`) — 미매칭.
- **run-debug-flow-change** (실행·디버깅 흐름 변경) — 검토했으나 미매칭으로 판정. `codebase/frontend/src/content/docs/05-run-and-debug/` 는 에디터 내부 실행/디버그 UX(브레이크포인트·로그 뷰어 등)를 다룬다. 이번 변경은 정확히 그 반대를 보장한다 — spec·JSDoc·캐너리 3중으로 "내부 WS(에디터)는 대상이 아니다"를 못박았고(`websocket.service.ts` JSDoc, `spec/5-system/6-websocket-protocol.md` §4.4 신규 단서, `websocket.service.spec.ts` 의 `broadcastToChannel` 원문 보존 캐너리), 오직 **외부** SSE/webhook/chat-channel 소비자에게만 필터가 걸린다. 에디터 UI 의 실행/디버그 경험은 변경이 없으므로 05-run-and-debug 갱신 대상이 아니다.
- **env-runtime-change** — 미매칭.
- **spec-major-change** (`spec/2-*/**`~`spec/5-*/**`, `spec/conventions/**`) — **glob 매칭됨** (`spec/5-system/14-external-interaction-api.md`, `spec/5-system/6-websocket-protocol.md`). 다만 이 행의 target 은 "frontmatter `code:`/`status:`/`pending_plans:` 정합"이며, `14-external-interaction-api.md` 의 diff 자체가 frontmatter `code:` 목록에 `codebase/backend/src/modules/websocket/websocket.service.ts` 를 이미 추가했다(요구사항 충족). 이 행은 spec 내부 정합성 문제라 "유저 가이드"(product-facing docs) 스코프 밖이며, 동일 변경 set 안에서 `/consistency-check --impl-prep`(22_26_33 라운드, BLOCK:NO)이 이미 이 축을 검증했고 지적된 WARNING(JSDoc 3그룹 표 동기화·트래커 4→8키 갱신·동명 필드 disambiguation)은 `review/code/2026/08/23/22_51_46/RESOLUTION.md` 에 기록된 대로 같은 커밋 세트에서 해소됐다. **INFO 로만 기록** — 조치 불요.
- **userguide-gui-flow-section** (`docs/02-nodes/**.mdx`, `docs/06-integrations-and-config/**.mdx`) — 미매칭.
- **spec-defect-found** — 해당 없음(이번 변경은 spec 결함 지적이 아니라 계획된 후속 작업 완료).

## 보조 확인 — 실제 유저 가이드 MDX 에 이 allowlist 가 문서화돼 있는지

`nodeOutput`/`getStatus`/`waiting_for_input`/webhook payload 필드를 언급하는 `codebase/frontend/src/content/docs/**` 를 grep 했다. `02-nodes/presentation.mdx`(`.en.mdx`) 가 `nodeOutput: { type: "carousel", ..., rendered: "<html>…" }` 예시를 갖고 있으나, 이는 **워크플로 내부**(버튼 클릭 시 다음 노드로 흐르는 트리거 페이로드) 예시이지 SSE/webhook 외부 응답 스키마 문서가 아니다. `06-integrations-and-config/web-chat-sdk.mdx` 는 External Interaction API 를 "직접 호출" 한다고만 언급할 뿐 `nodeOutput` 필드 목록을 나열하지 않는다. 즉 이번 allowlist 확장(4키 추가)을 반영해야 할 필드-레벨 유저 가이드 페이지가 존재하지 않는다 — 갱신 누락이 아니라 애초에 그 스키마를 문서화하는 대상이 없다.

## 발견사항

- **[INFO]** `spec/5-system/14-external-interaction-api.md`, `spec/5-system/6-websocket-protocol.md` 가 `doc-sync-matrix.json` 의 `spec-major-change` 행 glob(`spec/5-*/**`)에 매칭되지만, 이 행의 target(frontmatter 정합)은 이미 diff 안에서 충족돼 있고(`code:` 리스트 갱신) 별도 consistency-check 라운드(`22_26_33`, BLOCK:NO)가 이미 검증·해소를 완료했다. 유저 가이드(product-facing docs) 스코프의 조치는 불요.
  - 변경 파일: `spec/5-system/14-external-interaction-api.md`, `spec/5-system/6-websocket-protocol.md`
  - 매트릭스 항목: `spec-major-change` — targets: "frontmatter code: / status: / pending_plans: 정합 갱신 · status: implemented 이면 code: 글로브 ≥1 매치 보장"
  - 누락된 동반 갱신: 없음(이미 충족)
  - 상세: SSOT 매칭 원칙에 따라 기록만 남김. 이 항목은 consistency-checker 영역과 겹치며 이번 리뷰(user-guide-sync)의 실질적 조치 대상은 아님.
  - 제안: 조치 불요.

CRITICAL/WARNING 급 발견사항 없음.

## 요약

매트릭스 21행 중 `spec-major-change` 1행만 glob 으로 매칭됐고(spec/5-system/** 문서 변경), 그 target(frontmatter 정합)은 diff 자체에서 이미 충족되고 별도 consistency-check 라운드로 해소가 확인돼 조치가 불필요하다. 이번 변경은 `codebase/backend/src/modules/websocket/`·`shared/utils/` 의 백엔드 전용 보안 하드닝(SSE/webhook fanout `nodeOutput` allowlist 를 REST 와 같은 강도로 확대)이며, `codebase/frontend/**`·`codebase/channel-web-chat/**` 를 전혀 건드리지 않는다 — 새 노드·노드 스키마 변경·신규 UI 문자열·통합 provider 변경·신규 문서 섹션·auth/세션 흐름 변경·표현식 언어 변경·신규 warning/error 코드 어느 것도 없고, "실행·디버깅 흐름 변경" 후보로 고려했던 부분도 spec·코드·테스트 3중으로 "내부 WS(에디터)는 영향 없음"이 명시돼 있어 `05-run-and-debug/` 갱신 대상이 아니다. `nodeOutput` 필드를 나열하는 유저 가이드 MDX 자체가 존재하지 않아(확인됨) 애초에 갱신 누락이 성립할 표면이 없다. 유저 가이드 동반 갱신 관점에서 실질 누락 없음.

## 위험도
NONE
