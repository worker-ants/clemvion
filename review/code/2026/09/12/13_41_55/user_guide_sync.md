# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재
- SSOT: `.claude/config/doc-sync-matrix.json` (`rows[]` 21행) Read 완료.
- 보조: `PROJECT.md` §변경 유형 → 갱신 위치 매핑 표 + §자주 누락되는 항목 Read 완료.
- 변경 파일 목록: `git diff --name-only origin/main...HEAD` 로 실측(26개 파일). `codebase/**` 16개, `plan/**` 1개, `review/consistency/**` 9개(리뷰 산출물 — 매트릭스 무관).

## 매칭된 trigger

| 변경 파일 | 매칭 trigger (matrix id) |
|---|---|
| `codebase/backend/src/modules/triggers/triggers.controller.ts` | `backend-api-change` (`*.controller.ts` glob) |
| `codebase/backend/src/modules/chat-channel/providers/{slack,discord,telegram}/*.adapter.ts` | `integration-provider-change` (semantic — provider 동작 변경) |
| `codebase/frontend/src/lib/i18n/backend-labels.ts` | `new-warning-code`/`node-schema-change` 계열이 요구하는 co-update 대상 자체 (여기선 **이미 이 changeset 안에서 갱신됨** — 아래 "정상 확인" 참고) |

`codebase/backend/src/nodes/**` (new-node/node-schema-change), `*.tsx`(new-ui-string), `content/docs/<NN>-*/`(new-userguide-section-dir), `auth/**`, `expression-engine/**`, `nodes/core/error-codes.ts`(new-error-code) 는 이번 changeset 에 없음 — 해당 trigger 는 매칭 안 됨.

## 발견사항

- **[WARNING] Slack·Discord provider 문서가 이번 PR 이 실현한 400/502 분류를 반영하지 않음 — Telegram 형제 절과 비대칭**
  - 변경 파일: `codebase/backend/src/modules/chat-channel/providers/slack/slack.adapter.ts`(`SLACK_CREDENTIAL_REJECTED_ERRORS` 5값 신설 + `credentialRejectedError` 부착), `codebase/backend/src/modules/chat-channel/providers/discord/discord.adapter.ts`(`verify_key` 불일치 판정을 message 접두 → `code` 로 교체), `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts`(그 밖 실패를 `BadGatewayException`(502)으로 승격), `codebase/backend/src/modules/triggers/triggers.controller.ts`(`@ApiBadGatewayResponse` 추가)
  - 매트릭스 항목: `backend-api-change` — "(b) API 노출 변경이 사용자 안내에 영향 → 관련 user-guide 페이지" / `integration-provider-change` — "`codebase/frontend/src/content/docs/06-integrations-and-config/<provider>.{mdx,en.mdx}` + dict 키"
  - 누락된 동반 갱신:
    - `codebase/frontend/src/content/docs/06-integrations-and-config/slack.mdx` §5.5 "Bot Token · Signing Secret 변경" (line 134-147)
    - `codebase/frontend/src/content/docs/06-integrations-and-config/slack.en.mdx` §5.5 (line 134 부근)
    - `codebase/frontend/src/content/docs/06-integrations-and-config/discord.mdx` §6.5 "Bot Token · Public Key 변경" (line 120-132)
    - `codebase/frontend/src/content/docs/06-integrations-and-config/discord.en.mdx` §6.5 (line 109 부근)
  - 상세: 이 PR 이전에는 Slack `auth.test` 의 `invalid_auth`(자격 증명 거부)와 Discord `verify_key` 불일치가 **둘 다** `translateSetupChannelError` 의 401/403 message-regex 에 안 걸려 실제로는 `CHAT_CHANNEL_SETUP_FAILED` 로 떨어졌다(설계 plan `(e)` — "`BadGatewayException` 사용례가 저장소에 0건" 확인 결과, 이전엔 두 분기 모두 `BadRequestException`(400)이었고 `code` 값만 갈렸다). 이번 PR 이 처음으로 (1) Slack/Discord 를 **원인 기반**(`credentialRejectedError`)으로 정확히 400 `BOT_TOKEN_INVALID` 로 분류하고 (2) 그 밖의 실패를 **실재하는 502** `CHAT_CHANNEL_SETUP_FAILED` 로 승격시켰다 — adapter 코드 주석 자체가 "Slack 에서는 한 번도 걸리지 않았다(2026-09-12 실측)"·"이 PR 의 실질 동기" 라고 명시한다. 즉 사용자가 rotate-bot-token 을 호출했을 때 받는 실제 응답이 이번 PR 로 바뀐다.
    `codebase/frontend/src/content/docs/06-integrations-and-config/telegram.mdx`(§6)·`telegram.en.mdx`(§6) 는 이미 "에러: 400 `BOT_TOKEN_INVALID`, 404 `TRIGGER_NOT_FOUND`, 502 `CHAT_CHANNEL_SETUP_FAILED` 등" 을 서술하고 있어(사전 spec PR `#1323` 이 문서화했던 aspirational 서술이 이번 PR 로 처음 사실이 됨 — 정합) 갱신이 필요 없다. 그러나 **같은 성격의 Slack/Discord 페이지 §5.5/§6.5 는 rotate-bot-token 이 반환할 수 있는 에러 코드를 아예 나열하지 않는다** — PATCH(설정 변경) 경로의 400 `VALIDATION_ERROR` 만 언급하고, rotate(POST) 경로의 400/502 분기는 4개 파일(ko/en × slack/discord) 모두에 없다. `git diff --name-only origin/main...HEAD` 로 확인한 결과 이번 changeset 은 `content/docs/**` 를 전혀 건드리지 않았다.
  - 제안: Telegram §6 패턴을 그대로 미러링 — Slack §5.5, Discord §6.5 끝에 "에러: 400 `BOT_TOKEN_INVALID`(자격 증명 거부: Slack `invalid_auth`/`not_authed`/`account_inactive`/`token_revoked`/`token_expired`, Discord `verify_key` 불일치), 502 `CHAT_CHANNEL_SETUP_FAILED`(그 밖) 등" 한 줄을 ko/en 4파일에 동일 PR 안에서 추가.

## 정상 확인 (오탐 방지용 기록)

- `codebase/frontend/src/lib/i18n/backend-labels.ts` 의 `ERROR_KO.BOT_TOKEN_INVALID` 문구가 "제공자 인증 401/403" → "제공자에게 거부됐어요" 로 이번 PR 안에서 **이미 동반 갱신됨** — transport 기반 서술을 원인 기반으로 정정한 코드 변경과 정합. `ERROR_KO`/`WARNING_KO` 는 KO-only 매핑(영문은 backend 원문이 SoT)이라 i18n parity(양쪽 dict) 문제도 없음.
- `nodes/core/error-codes.ts` 의 `ErrorCode` enum 은 이번 changeset 에서 변경되지 않음 — `new-error-code`/`new-warning-code` trigger 불발.
- `BOT_TOKEN_INVALID`/`CHAT_CHANNEL_SETUP_FAILED` 는 신규 문자열이 아니라 기존 등록 코드의 **HTTP status 재분류**이므로 `codebase/frontend/src/content/docs/02-nodes/triggers.mdx`/`.en.mdx` 의 에러 코드 열거 목록 자체는 갱신 불요(코드 값 목록은 그대로).
- `codebase/backend/src/nodes/**`, `*.tsx`, `content/docs/<NN>-*/` 신규 디렉토리, `auth/**`, `expression-engine/**` 는 이번 changeset 에 없어 해당 trigger 전부 무관.
- `plan/in-progress/impl-setup-error-code.md`, `review/consistency/2026/09/12/12_54_15/**` 는 매트릭스 target 이 아닌 프로세스 산출물 — 무관.

## 요약
매트릭스 21행 중 `backend-api-change`(controller glob)·`integration-provider-change`(semantic) 2행이 매칭됐다. `backend-labels.ts` co-update 는 이미 같은 changeset 안에서 처리돼 정상이나, Slack/Discord provider 의 06-integrations-and-config 유저 가이드 페이지(ko/en 4파일)가 이번 PR 이 처음 실현한 400/502 에러 분류를 반영하지 않아 Telegram 형제 절과 비대칭 상태로 남는 WARNING 1건을 발견했다. CRITICAL(i18n parity·section locale 등록·warning/error ko 매핑 부재)은 0건.

## 위험도
MEDIUM
