# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 점검 절차 요약

1. `.claude/config/doc-sync-matrix.json` (rows 20개) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑 본문을 SSOT 로 적재.
2. 변경 파일 목록: prompt 에 포함된 32개 항목 중 `review/**`·`plan/**`·`CHANGELOG.md` 는 리뷰/추적 산출물이라 매트릭스 trigger 대상이 아님. 실제 `codebase/**` 변경분을 `git diff --stat c0f2a885ca18..HEAD -- codebase/` 로 재확인 — 16개 파일(백엔드 8 + docs mdx 8), TSX·i18n dict 변경 0건.
3. 각 변경 파일을 매트릭스 좌측 trigger 에 매칭.

## Trigger 매칭 결과

- **`backend-api-change`** (`*.controller.ts` / `dto/**`) — 매칭됨: `triggers.controller.ts`, `chat-channel-config.dto.ts`, `update-trigger.dto.ts`.
  - target (a) swagger jsdoc — `triggers.controller.ts` 의 `@ApiBadRequestResponse` description 이 3가지 400 사유(비밀 필드 포함/신규 `chatChannel`/`provider` 변경)와 `details.field` 형식 갈림(중첩 vs flat)까지 갱신됨. `ChatChannelUpdateConfigDto` 필드에도 `@ApiPropertyOptional({description, writeOnly:true})` 로 개별 문서화됨. **충족**.
  - target (b) 사용자 안내 페이지 — 아래 docs MDX 갱신으로 **충족** (동일 changeset 안에서 완료).
- **docs MDX 갱신** (사용자 가시 API 변경 반영) — `02-nodes/triggers.{mdx,en.mdx}`, `06-integrations-and-config/{discord,slack,telegram}.{mdx,en.mdx}` 6쌍 모두 이번 changeset 안에서 ko/en **동시** 갱신됨. 새 400 사유(신규 `chatChannel` 최초 설정 제한·`provider` 변경 금지·`botToken`/`inboundSigningPlaintext` PATCH 거부)가 정확한 `details.field` 값과 함께 반영됨. Telegram 은 server-issued signing 이라 signing-secret 절이 없는 것이 의도된 비대칭(§5.4.1.1 telegram carve-out, spec 상 기 결정)과 일치.
  - `discord.mdx`/`discord.en.mdx`, `slack.mdx`/`slack.en.mdx` 신규 `## 6.5`/`## 5.5` 섹션도 ko/en 쌍으로 대칭 추가됨 — i18n sibling parity 위반 없음.
- **`userguide-gui-flow-section`** (`02-nodes/**.mdx`, `06-integrations-and-config/**.mdx` 의 GUI 흐름 절 신규/변경, `<ImplAnchor kind="ui-entry">` 의무) — 신설된 절("Bot Token · Public Key 변경" 류)은 heading/본문에 `GUI` bareword 나 `**...GUI...**` 강조가 없어 `findGuiFlowSections` 판정 기준(≥1항목: heading `GUI` 포함, 또는 본문 bold 안 `GUI`)에 해당하지 않음 — API 응답 규약 설명이지 "메뉴 클릭" 류 GUI walkthrough 가 아니므로 `<ImplAnchor>` 의무 **비적용**. `integrations-coverage.test.ts`/`triggers-coverage.test.ts` 의 검출 대상이 아님.
- **`new-ui-string` (TSX i18n parity)** — 이번 changeset 에 `codebase/frontend/src/**/*.tsx` 변경 0건 (`ChatChannelCard` 는 이미 `botToken` 을 안 보내던 기존 코드로 미변경). 매칭 대상 없음.
- **`new-warning-code` / `new-error-code`** — `codebase/backend/src/nodes/core/error-codes.ts`, warningRules 변경 0건. 이번 400 은 기존 `VALIDATION_ERROR` 코드에 `details.field` 값만 다양화한 것이라 `ERROR_KO`/`WARNING_KO` 신규 매핑 대상 아님.
- **`new-node` / `node-schema-change`** — `codebase/backend/src/nodes/**` 변경 없음(트리거 DTO 는 이 glob 밖). 매칭 대상 없음.
- **`new-userguide-section-dir`** — 신규 `<NN>-<name>/` 디렉토리 생성 없음(기존 `02-nodes/`, `06-integrations-and-config/` 안 파일 수정). 매칭 대상 없음.
- **`expression-language-change`, `run-debug-flow-change`, `auth-session-flow-change`** — 해당 경로/의미 변경 없음.

## 발견사항

없음. 매칭된 유일한 실질 trigger(`backend-api-change`)의 두 target(swagger jsdoc, user-guide MDX) 모두 **같은 changeset 안에서 ko/en 대칭으로 이미 갱신**되어 있다. 커밋 히스토리(`5976587c7 docs(guide): slack/discord 도 PATCH 로 비밀을 못 바꾼다는 걸 사용자에게 알린다 — 리뷰 3라운드`, `464f2ba1a docs(backend): 내부 서사가 공개 OpenAPI 로 새고 있었다 + orphan JSDoc — 리뷰 4라운드`)를 보면 이 PR 은 이미 여러 라운드의 코드 리뷰에서 정확히 이 user-guide-sync 관점(docs 오기·swagger jsdoc 누락)을 지적받고 자체 해소한 상태다 — 재지적 대상이 아님.

## 요약

매트릭스 20개 행 중 코드 변경 파일에 실질 매칭된 것은 `backend-api-change` 1건(controller·DTO)이며, 그 target(swagger jsdoc + 사용자 안내 MDX 6쌍 ko/en)이 모두 같은 changeset 안에서 이미 갱신 완료됨을 `git diff` 로 직접 확인했다. TSX·i18n dict·backend-labels·신규 노드·신규 섹션 디렉토리·표현식 언어 등 나머지 19개 trigger 는 매칭 대상이 없다. 동반 갱신 누락 0건.

## 위험도

NONE
