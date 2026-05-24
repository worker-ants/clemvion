---
worktree: trigger-create-multi-provider-ui-plan-677f12
started: 2026-05-24
owner: developer
status: in-progress
---

# Plan — 트리거 생성 multi-provider 화 (Slack / Discord GUI 진입점 신설)

## 배경

[`spec/4-nodes/7-trigger/providers/_overview.md §1`](../../spec/4-nodes/7-trigger/providers/_overview.md) 가 telegram / slack / discord 세 provider 를 **모두 v1 supported** 로 정의하고, backend adapter 도 PR #300/#303 으로 셋 다 registry 에 등록되어 있다 ([`codebase/backend/src/modules/chat-channel/chat-channel.module.ts:48-52`](../../codebase/backend/src/modules/chat-channel/chat-channel.module.ts)). 그러나 트리거 생성 진입 경로는 사실상 telegram 만 열려 있다:

| 레이어 | 현 상태 | 갭 |
|---|---|---|
| Spec | telegram / slack / discord 모두 v1 supported | — |
| Backend adapter (`chat-channel/providers/{telegram,slack,discord}/`) | 셋 다 구현·등록 | — |
| **Backend DTO `chat-channel-config.dto.ts:27`** | `CHAT_CHANNEL_PROVIDERS = ['telegram'] as const` | **slack / discord 입력 시 400 VALIDATION_ERROR** |
| **Backend DTO `inboundSigning` 입력 금지** (`chat-channel-config.dto.ts:144-155`) | telegram 의 server-issued 전제 | slack signing secret / discord ed25519 public key 는 provider-issued (사용자 manual 입력) → 입력 경로 없음 |
| Detail drawer **read** 모드 provider 라벨 | telegram / slack / discord 모두 표시 가능 (`trigger-detail-drawer.tsx:1141-1144`) | — |
| **트리거 생성 모달 (`triggers/page.tsx:362-398`)** | `provider: "telegram"` 하드코딩, `botToken` 한 가지만 입력 | provider dropdown 부재 + slack/discord 의 provider-issued inbound-signing 입력 UI 부재 |
| i18n `addChatChannelToggle` | "Chat Channel 연결 (Telegram 봇)" / "Connect a Chat Channel (Telegram bot)" | telegram-specific 문구 — 일반화 필요 |
| User guide `06-integrations-and-config/{slack,discord}.{mdx,en.mdx}` | 존재함 (PR #300 흐름에서 작성) | 트리거 생성 흐름이 "API 호출" 가정인 경우 GUI 단계로 격상 필요 |
| e2e | telegram setup→inbound→teardown 만 | slack / discord round-trip e2e 누락 |

결과: 사용자가 GUI 로 Slack / Discord 트리거를 만들 수 없음. backend adapter 가 동작 가능한 상태인데 진입점 자체가 막힌 형태.

## 책임 구분 — 본 plan 이 메우는 갭

본 plan 은 **implementation 중심** — 새 spec 결정 신설 없음. `_overview.md` / `15-chat-channel.md` / `providers/slack.md` / `providers/discord.md` / `conventions/chat-channel-adapter.md` 모두 이미 신규 작업을 정의 완료 ([R-S-1](../../spec/4-nodes/7-trigger/providers/slack.md#r-s-1-inboundsigningref-단일-슬롯-공유--provider-별-의미발급-주체는-backend-분기-2026-05-24-갱신-2026-05-24) · [R-CC-13](../../spec/5-system/15-chat-channel.md#r-cc-13-discord-v1--cch-mp-01------interactions-webhook-only--2026-05-24)). 본 plan 의 모든 변경은 그 spec 약속의 구현.

**예외 — 1회성 spec drift 정정 (Commit 0)**: consistency-check (`review/consistency/2026/05/24/18_21_47/SUMMARY.md`) 가 PR #300 이후 stale 인 spec 문구 2건을 BLOCK 으로 검출했다. 본 plan 의 GUI 가 3 provider 모두 사용 가능하게 만드는 시점에 두 spec 의 "v1 telegram 만" / "slack·discord impl pending" 문구를 정합 갱신하지 않으면 spec-impl divergence 가 영구화된다. 사용자 결정 (2026-05-24) 으로 본 PR 안에서 spec 정정을 함께 포함. 새 결정 신설은 없음 — `_overview.md §1` 의 supported 선언에 다른 두 spec 을 정합 갱신할 뿐. 정정 대상:

- `spec/2-navigation/2-trigger-list.md §2.3.1` provider 행 비고: "v1 은 `telegram` 만" → "v1 은 `telegram` / `slack` / `discord`" + `inboundSigning` PATCH 차단 정책 cross-link
- `spec/2-navigation/2-trigger-list.md §3` PATCH 설명: `config.chatChannel.inboundSigning` v1 PATCH 차단 문구 추가
- `spec/5-system/15-chat-channel.md §3.1 CCH-AD-01`: "v1 spec-defined: slack, discord — impl pending" → "v1 supported: telegram / slack / discord"

## 선행 PR

- #281 (`docs(spec): chat-channel — 4 P1 결정`) — telegram 4 P1 결정. 머지 완료.
- #283 (`feat(triggers): Chat Channel UI 통합`) — telegram GUI. 머지 완료.
- #300 (`feat(chat-channel): slack + discord providers (v1 supported)`) — adapter 등록 + inbound-signing naming 통합. 머지 완료.
- #303 (`refactor(test): chat-channel e2e fixture 헬퍼 추출`) — e2e fixture 헬퍼. 머지 완료.

## SoT 참조

- [Spec Providers Catalog §1 supported](../../spec/4-nodes/7-trigger/providers/_overview.md#1-supported-providers-v1)
- [Spec Chat Channel §4.1 config.chatChannel 스키마](../../spec/5-system/15-chat-channel.md#41-triggerconfigchatchannel)
- [Spec Chat Channel §5.5 Inbound HTTP Contract](../../spec/5-system/15-chat-channel.md#55-inbound-http-contract) (slack / discord 응답 예외 포함)
- [Spec Slack §3.1 setupChannel + §6 Signing Secret + R-S-1 (inboundSigning provider-issued)](../../spec/4-nodes/7-trigger/providers/slack.md)
- [Spec Discord §3.1 setupChannel + §6 Application Public Key + R-D-3 (Webhook only)](../../spec/4-nodes/7-trigger/providers/discord.md)
- [Convention Chat Channel Adapter §2.3 ChatChannelConfig](../../spec/conventions/chat-channel-adapter.md#23-chatchannelconfig)
- [Spec Trigger List §2.3.1 필드 권한 매트릭스 — provider read-only after creation](../../spec/2-navigation/2-trigger-list.md#231-필드-권한-매트릭스)
- [`PROJECT.md` §변경 시 동반 갱신 매트릭스 — 신규 통합/제공자 변경](../../PROJECT.md)

## 작업 분할 (commit 단위)

### Commit 0 — spec drift 정정 (PR #300 후속) + plan boundary 보강

| 항목 | 파일 | 상세 |
|---|---|---|
| `2-trigger-list.md §2.3.1` provider 행 비고 갱신 | `spec/2-navigation/2-trigger-list.md:99` | "v1 은 `telegram` 만" → "v1 은 `telegram` / `slack` / `discord`". 변경은 사실 갱신 (PR #300 정합) 으로 새 결정 신설 아님 |
| `2-trigger-list.md §3` PATCH 설명에 inboundSigning 차단 cross-link | 같은 파일 §3 PATCH 노트 | `config.chatChannel.botTokenRef` 차단 문구 옆에 `config.chatChannel.inboundSigning` v1 PATCH 차단 명시 (slack signing secret / discord public key rotation API 는 v1 미정의 — 별 spec 대기). Rationale 단락에 R-CC-10 의 적용 범위 ("외부 provider 등록 token 한정") + slack/discord inboundSigning 은 provider-issued/server-stored 자원으로 향후 PATCH 허용 가능성 별 spec 결정 명시 |
| `15-chat-channel.md §3.1 CCH-AD-01` 갱신 | `spec/5-system/15-chat-channel.md:35` | "v1 supported: telegram / v1 spec-defined: slack, discord — impl pending" → "v1 supported: telegram / slack / discord — providers/_overview.md §1 단일 진실" |
| Rationale 갱신 노트 | 두 spec 의 `## Rationale` 끝 또는 본문 내 timestamp 주석 | "2026-05-24: PR #300 (slack/discord adapter 등록 + e2e) 정합 갱신. 새 결정 신설 아님 — `_overview.md §1` 의 supported 선언이 SoT, 본 spec 들은 정합 cross-link." |

**Boundary 정당화**: 본 commit 의 spec 변경은 새 결정·기각된 대안 재도입·convention 위반 어디에도 해당하지 않는 **사실 갱신 (current-state catch-up)** 이다. project-planner 위임 의무는 "spec 신규 정의 또는 대규모 개정" 에 적용 — 본 경우는 stale 문구 3건의 정합 갱신으로, 본 plan PR 안에 묶는 게 시점 동기화 측면에서 우월하다 (사용자 결정 2026-05-24).

### Commit 1 — backend DTO/service: provider enum 확장 + provider-issued inbound-signing 입력 허용

| 항목 | 파일 | 상세 |
|---|---|---|
| `CHAT_CHANNEL_PROVIDERS` 확장 | `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts` | `['telegram'] as const` → `['telegram', 'slack', 'discord'] as const`. `provider` 필드의 `@IsIn` 가 자동으로 셋 다 허용. swagger `enum` / `example` 도 동시 갱신 (description 의 "v1 은 telegram 만 지원" 문구 제거) |
| 신규 DTO 필드 `inboundSigningPlaintext?: string` | 같은 DTO | [`spec/conventions/secret-store.md §5.5`](../../spec/conventions/secret-store.md) 의 SoT naming 채택. 입력 전용 — service 가 `SecretResolver.store` 로 옮긴 후 config 에 흘리지 않음. swagger `@ApiPropertyOptional` description: "provider-issued (Slack signing secret / Discord public key) plaintext 입력. telegram 은 server-issued 라 본 필드 미사용 — 입력 시 400. 응답에 strip" |
| 기존 `inboundSigning` 입력 가드 처리 | 같은 DTO line 144-155 | 두 옵션 중 (a) 채택: (a) **완전 제거** — `inboundSigning` 필드를 DTO 에서 삭제 (외부 입력 금지 SoT 가 `inboundSigningPlaintext` 신규 필드 + `inboundSigningRef` 가드로 충분). (b) legacy `@IsEmpty` 유지 — 보수적이지만 두 필드명이 공존해 혼란. **(a) 권장** — secret-store §5.5 의 단일 진실 정합 |
| Slack signing secret 형식 검증 | service 또는 별 validator | hex 32 chars (Slack 발급 표준 — `^[a-f0-9]{32}$`). 실패 시 400 `VALIDATION_ERROR` (`details.field='inboundSigningPlaintext'`) |
| Discord public key 형식 검증 | 동상 | ed25519 public key = hex 64 chars (32 bytes). 실패 시 동일 400 |
| Telegram 의 `inboundSigningPlaintext` 입력 검증 | service 또는 DTO | telegram + 본 필드 입력 → 400 `VALIDATION_ERROR` (`details.field='inboundSigningPlaintext'`, `message='Telegram inboundSigning is server-issued; do not send plaintext'`). silent strip 회피 — 사용자 의도 보호 |
| Slack/Discord 의 `inboundSigningPlaintext` 누락 검증 | service | provider != telegram + 본 필드 누락 → 400 `VALIDATION_ERROR` (`details.field='inboundSigningPlaintext'`, `message='Slack signing secret / Discord public key required'`) |
| `triggers.service.ts` createTrigger 흐름 보강 | `codebase/backend/src/modules/triggers/triggers.service.ts:560-650` 인근 | provider 별: telegram → 기존 흐름 (setupChannel 의 `issuedInboundSigning` 으로 ref 저장). slack/discord → 사용자 입력 `inboundSigningPlaintext` 를 `SecretResolver.store(inboundSigningRef, plaintext)` 로 저장 + setupChannel 호출. plaintext 는 절대 `trigger.config` 에 흘리지 않음 (secret-store §5.5 SS-SE-01 invariant) |
| `BOT_TOKEN_INVALID` 에러 throw 신설 점검 | service | spec `15-chat-channel.md §5.4` 의 에러 표 명시. backend src 에 실제 throw 코드 미구현 (사전 grep 0건). slack/discord 의 `auth.test` / `GET /applications/@me` 가 401/403 반환 시 본 코드로 변환 — Commit 1 에서 신설 |
| `rotateBotToken` 흐름 영향 점검 | 같은 service | rotate 는 inbound-signing 을 재생성하지 않는 case (slack/discord) 대응. 현행 (`if result.issuedInboundSigning`) 으로도 정상 fall-through 되는지 확인 — slack/discord 의 `setupChannel` 은 `issuedInboundSigning` 을 비우므로 기존 ref 유지가 자연. 회귀 없음을 unit 테스트로 보장 |
| Swagger / OpenAPI 갱신 | DTO 의 `@ApiProperty` description | provider enum 확장 + `inboundSigningPlaintext` description 명시 ("telegram=서버 자동 발급(미입력) / slack=Slack 발급 signing secret 입력 / discord=Discord 발급 ed25519 public key 입력") |
| 테스트 | `chat-channel-config.dto.spec.ts` (있으면) + `triggers.service.spec.ts` + integration | (a) provider=slack + inboundSigningPlaintext=valid → 200. (b) provider=slack + 누락 → 400. (c) provider=telegram + inboundSigningPlaintext 입력 → 400. (d) provider=discord + 잘못된 hex 형식 → 400. (e) rotate 후 slack ref 유지 회귀. (f) inboundSigningPlaintext 가 `trigger.config` 에 흘러가지 않음 보장 |

### Commit 2 — frontend 트리거 생성 모달 multi-provider 화

| 항목 | 파일 | 상세 |
|---|---|---|
| Provider dropdown 추가 | `codebase/frontend/src/app/(main)/triggers/page.tsx:362-398` (Chat Channel 섹션) | `formChatChannelProvider` state 신설 (default `"telegram"`). `<select>` 또는 native dropdown — `telegram` / `slack` / `discord` 3 옵션. i18n 라벨은 기존 `providerTelegram` / `providerSlack` / `providerDiscord` 재사용 (`dict/{ko,en}/triggers.ts:186-188`) |
| 토글 라벨 일반화 | 같은 파일 | `addChatChannelToggle` 사용 자리에 telegram 표기 의존 없음 — i18n 키 자체가 바뀜 (commit 3) |
| Provider별 secret 입력 분기 | 같은 파일 | telegram: 기존 `botToken` textarea 만. slack: `botToken` + `inboundSigningPlaintext` (label "Signing Secret"). discord: `botToken` + `inboundSigningPlaintext` (label "Application Public Key"). 입력 필드 4개를 conditional render. `formChatChannelInboundSigningPlaintext` state 신설 |
| `createMutation` payload 확장 | 같은 파일 line 200-207 | `config.chatChannel = { provider, botToken, ...(provider !== 'telegram' ? { inboundSigningPlaintext } : {}), uiMapping: {...} }`. provider 별 다른 secret 필드명 신설은 spec [R-S-1](../../spec/4-nodes/7-trigger/providers/slack.md#r-s-1-inboundsigningref-단일-슬롯-공유--provider-별-의미발급-주체는-backend-분기-2026-05-24-갱신-2026-05-24) 의 "단일 슬롯 공유" 결정에 따라 **모두 `inboundSigningPlaintext` 단일 필드** 로 통일 (DTO 필드명은 [`spec/conventions/secret-store.md §5.5`](../../spec/conventions/secret-store.md) SoT) |
| 형식 도움말 (help) 텍스트 | 같은 파일 | provider 별 다른 형식 안내. telegram: BotFather 형식 (기존). slack: hex 32 chars + Slack 앱 → "Basic Information → Signing Secret" 안내. discord: hex 64 chars + Discord Developer Portal → "General Information → Public Key" 안내. 외부 portal 경로 안내 — 더 자세한 흐름은 user-guide cross-link |
| 폼 검증 | 같은 파일 `handleCreate` | provider != telegram 이고 `inboundSigning` 빈 값이면 client-side `toast.error("inboundSigning required")` 후 차단 — backend 400 에 의존하지 않는 사전 검증 (UX 친절도) |
| 에러 mapping | createMutation onError | backend 의 `BOT_TOKEN_INVALID` / `VALIDATION_ERROR (field=inboundSigning)` / `CHAT_CHANNEL_SETUP_FAILED` 를 toast 메시지로 분기 표시 (i18n) |

**의식적 boundary**: detail drawer 의 **edit** 모드는 본 plan 범위 밖. drawer 의 chat-channel 카드는 v1 단계에서 `uiMapping` / `rateLimit` / `languageHints` 만 편집 가능 ([Spec Trigger List §2.3.1](../../spec/2-navigation/2-trigger-list.md#231-필드-권한-매트릭스)). `botToken` 은 rotate API, `inboundSigning` 은 single-path 가 정의되지 않은 상태 — slack/discord 의 inbound-signing rotate API 가 필요하다면 별 spec 작업 (본 plan 범위 밖).

### Commit 3 — i18n dict 일반화 + provider별 키 신설 (KO/EN 동시)

| 항목 | 파일 | 상세 |
|---|---|---|
| `addChatChannelToggle` 일반화 | `codebase/frontend/src/lib/i18n/dict/{ko,en}/triggers.ts:241/250` | KO: "Chat Channel 연결 (Telegram 봇)" → "Chat Channel 연결 (외부 챗봇)". EN: "Connect a Chat Channel (Telegram bot)" → "Connect a Chat Channel (external chatbot)" |
| `addChatChannelHelp` 일반화 | 같은 파일 | "setWebhook" 명시 제거 → "선택한 provider 의 setup 절차가 자동 실행돼요" 류 |
| Provider 드롭다운 라벨 | 같은 파일 | 기존 `triggers.chatChannel.provider` 키 (`dict/ko/triggers.ts:185`) 재사용 — 신규 키 신설 X (naming-collision-checker I-12 권고). `trigger-detail-drawer.tsx:1141` 의 `providerLabel()` 함수와 키 이름 혼동 회피 |
| 신규 키: `inboundSigningLabelSlack` / `inboundSigningLabelDiscord` | 같은 파일 | provider 별 분리 키 채택 (naming-collision-checker I-10 결정). slack: "Signing Secret" / "Signing Secret". discord: "Application Public Key" / "Application Public Key". interpolation 단일 키 안은 라벨 자체가 다르므로 부적합 |
| 신규 키: `inboundSigningPlaceholderSlack` / `inboundSigningPlaceholderDiscord` | 같은 파일 | slack placeholder (hex 32 예시), discord placeholder (hex 64 예시) |
| 신규 키: `inboundSigningFormatHelpSlack` / `inboundSigningFormatHelpDiscord` | 같은 파일 | slack: "Slack 앱 → Basic Information → Signing Secret 에서 복사". discord: "Discord Developer Portal → Applications → General Information → Public Key 에서 복사" |
| 신규 키: `inboundSigningRequiredErrorSlack` / `inboundSigningRequiredErrorDiscord` | 같은 파일 | slack: "Signing Secret 이 필요해요". discord: "Application Public Key 가 필요해요" |
| Parity 가드 | `i18n` 테스트 | KO/EN 동시 추가로 parity 깨지지 않게. `cd codebase/frontend && npm test -- i18n` |

### Commit 4 — user guide 동반 갱신 + ImplAnchor

| 항목 | 파일 | 상세 |
|---|---|---|
| Slack 가이드 GUI 흐름 격상 | `codebase/frontend/src/content/docs/06-integrations-and-config/slack.{mdx,en.mdx}` | "Trigger 생성" 절을 API 호출 가정에서 GUI 단계 안내로 격상. 1) /triggers → "웹훅 트리거 추가" 2) Chat Channel 토글 ON 3) Provider 드롭다운 = Slack 4) Bot Token + Signing Secret 입력 5) 생성. 외부 Slack 앱 manifest 의 Request URL 설정 (R-S-2) 은 trigger 생성 후 endpoint URL 복사 → manifest 입력 순서로 |
| Discord 가이드 GUI 흐름 격상 | `codebase/frontend/src/content/docs/06-integrations-and-config/discord.{mdx,en.mdx}` | 동일 패턴. Bot Token + Application Public Key + Interactions Endpoint URL (사용자가 Developer Portal 에 입력) |
| Triggers 가이드 cross-link | `codebase/frontend/src/content/docs/02-nodes/triggers.{mdx,en.mdx}` | "Chat Channel 연결" 절에 provider 3종 cross-link (telegram / slack / discord 가이드 페이지) + 본 절에 `<ImplAnchor kind="ui-entry">` 도 추가 (convention-compliance-checker I-6: `triggers-coverage.test.ts` 가드 의무) |
| `<ImplAnchor kind="ui-entry">` | slack/discord 가이드의 GUI 흐름 절 + `triggers.mdx` provider 절 | `file="src/app/(main)/triggers/page.tsx"` + `symbol="createMutation"` 등. SoT: [`spec/conventions/user-guide-evidence.md`](../../spec/conventions/user-guide-evidence.md). reverse-coverage 가드 (`impl-anchor-existence` / `integrations-coverage` / `triggers-coverage`) 통과 |
| Discord callout 한계 안내 | `06-integrations-and-config/discord.{mdx,en.mdx}` | R-CC-13 (Discord v1 의 CCH-MP-01 부분 유예) 의 구체적 한계 명시: "(b) Modal 'Reply' 버튼 기반 입력만 가능, 일반 DM 텍스트 미수신" — rationale-continuity-checker I-4 권고 |
| KO/EN parity | 동상 | 4 파일 동시 갱신. `cd codebase/frontend && npm test -- i18n docs` |

### Commit 5 — e2e 3 provider round-trip

| 항목 | 파일 | 상세 |
|---|---|---|
| Telegram e2e 회귀 | 기존 e2e 파일 (`chat-channel-*.e2e-spec.ts`) | 회귀 없음 보장. fixture 헬퍼는 PR #303 으로 추출되어 재사용 |
| Slack e2e | 신규 파일 | (1) POST /api/triggers (provider=slack, botToken, inboundSigningPlaintext=signingSecret) → 200 + setupChannel 의 `auth.test` mock 응답 (2) POST /api/hooks/:path (X-Slack-Signature 헤더 포함) → 202 (3) POST /api/hooks/:path (URL Verification `type:url_verification`) → 200 + `{ challenge }` (spec §5.5) (4) signature mismatch → 401 (5) DELETE /api/triggers/:id → 204 |
| Discord e2e | 신규 파일 | (1) POST /api/triggers (provider=discord, botToken, inboundSigningPlaintext=publicKey) → 200 + `GET /applications/@me` + slash command bulk overwrite mock (2) POST /api/hooks/:path (ed25519 signed body, 일반 interaction) → 202 (3) POST /api/hooks/:path (PING `type:1`) → **200 + `{ type: 1 }`** (cross-spec I-2: spec §5.5 단일 응답) (4) signature mismatch → 401 (5) DELETE /api/triggers/:id → 204 |
| 모든 외부 API mock | e2e fixture | slack/discord client 의 외부 HTTP 호출 nock/msw mock. `chat-channel-e2e-hardening` plan 패턴 재사용 |

## 선행 의무

본 plan 의 commit 1 (backend) 착수 직전 **`/consistency-check --impl-prep`** 의무 호출.

**Scope**:
- `spec/5-system/15-chat-channel.md`
- `spec/2-navigation/2-trigger-list.md`
- `spec/4-nodes/7-trigger/providers/_overview.md`
- `spec/4-nodes/7-trigger/providers/slack.md`
- `spec/4-nodes/7-trigger/providers/discord.md`
- `spec/conventions/chat-channel-adapter.md`

Critical 발견 시 차단. Warning 은 plan Rationale 또는 commit 메시지에 노트.

## 의식적 boundary

- **새 spec 결정 신설 없음** — Commit 0 의 spec 정정은 PR #300 이후 사실 갱신 (stale 문구 3건의 정합 catch-up) 으로 새 결정·기각된 대안 재도입 어디에도 해당하지 않음. `_overview.md §1` 의 "supported" 정의 (spec 본문 + adapter 구현체 + registry 등록 + e2e 테스트 모두 완료) 의 마지막 piece (e2e) 까지 본 plan 으로 메움 — 결과적으로 `_overview.md` 의 status 행은 무변경.
- **Adapter 구현 변경 없음** — `telegram.adapter.ts` / `slack.adapter.ts` / `discord.adapter.ts` 등 provider adapter 코드는 PR #300 까지로 완성. 본 plan 은 DTO / service / UI / i18n / 가이드 / e2e 만.
- **Detail drawer edit 모드 확장 없음** — drawer 의 chat-channel 카드는 v1 단계 그대로 (`uiMapping` / `rateLimit` / `languageHints` 만 편집 가능). slack/discord 의 `inboundSigning` rotate UI 는 별 spec 필요 → 본 plan 범위 밖.
- **`inboundSigning` PATCH 정책의 Rationale 명시** — slack/discord 의 `inboundSigning` 은 provider-issued / server-stored 자원으로 [R-CC-10](../../spec/5-system/15-chat-channel.md#r-cc-10-bot-token-변경-single-path-rotate-api-only-2026-05-23) 의 외부 provider 등록 token (single-path 적용 근거) 과 자원 성격이 다르다. v1 단계에서는 보수적으로 PATCH 차단 (Commit 0 의 §3 PATCH 노트) — slack signing secret rotation API / discord public key rotation API 가 v1 미정의이고, 회전 UX 가 별 spec 결정 사안. 향후 rotation API 도입 시 R-CC-10 의 단일 진실 패턴을 따를지 별 결정 (Spec drift 정정 commit 의 Rationale 노트 + rationale-continuity-checker W-4 권고).
- **`chat-channel-dispatcher-split` plan 진입 결정** — [Spec R8](../../spec/5-system/15-chat-channel.md#r8-notificationdispatcher-분리--provider-증가-시점에-재검토-2026-05-22) 의 trigger 조건 ("Chat Channel provider 가 2개 이상으로 늘어남") 이 본 plan 완료 시점에 **사용자 GUI 관점에서 실질 충족** (backend 적으로는 PR #300 시점 충족). 본 plan 완료 commit 안에서 `chat-channel-dispatcher-split.md` frontmatter `status: backlog → ready` 로 갱신 + trigger 조건 항목을 "GUI 관점 충족 (PR trigger-create-multi-provider-ui)" 으로 cross-link (plan-coherence W-7 권고). 실제 분리 리팩토링 작업 자체는 별 plan 진입 (사용자 결정 사안).
- **V2 plan 들과 직교** (`chat-channel-discord-gateway` / `chat-channel-slack-socket-mode` / `chat-channel-form-native-modal` / `chat-channel-visual-ssr-png` / `chat-channel-secret-store-infra`). 본 plan 의 변경은 v2 trigger 조건 또는 인프라 결정에 영향 없음.
- **Telegram-specific `secretTokenRef` legacy 가드 정리는 본 plan 범위 밖** — naming 통합 (PR #300 흐름 `spec-chat-channel-inbound-signing-rename`) 으로 이미 완료된 상태 가정.
- **`plan/in-progress/trigger-list-chat-channel-ui.md` stale 정리는 본 plan 범위 밖** — PR #283 머지 완료지만 본 plan 의 본질적 작업과 무관. 별 grooming PR 또는 사용자 수동 정리 (plan-coherence W-8 권고는 참고 사항).

## 리스크 / 완화

| 리스크 | 완화 |
|---|---|
| backend DTO 의 `inboundSigning` 입력 가드 풀기 시 telegram 회귀 (server-issued 만 가정한 코드 경로가 외부 입력을 받아 보안 약화) | provider 별 분기를 service 단에서 명확히. telegram 은 `inboundSigning` 입력 silent strip 또는 400 (기존 정책 그대로). 결정 (a)/(b) 는 commit 1 의 첫 task 로 확정. unit 테스트로 두 경로 모두 보장 |
| Slack signing secret / Discord public key 의 형식 검증 정확도 | spec 의 알고리즘 정의 (`X-Slack-Signature: v0=HMAC-SHA256(...)` / `crypto.verify('ed25519', ...)`) 와 실제 발급 형식 매칭 — slack: hex 32 chars / discord: hex 64 chars. 양쪽 모두 documented spec. 형식 위반은 setupChannel 호출 전 400 으로 차단 (외부 API 낭비 방지) |
| Slack/Discord 의 setupChannel 이 외부 portal 의존 (R-S-2 / R-D-2) — GUI 흐름이 외부 단계까지 안내해야 함 | user-guide 가이드에 외부 단계 명시 + 트리거 생성 후 endpoint URL 복사 → portal 입력 순서 안내. GUI 자체는 외부 단계 강제 안 함 (현실 워크플로우 — 사용자가 portal 미설정 시 inbound 단계에서만 동작 안 함) |
| Discord 의 v1 한계 ([R-CC-13](../../spec/5-system/15-chat-channel.md#r-cc-13-discord-v1--cch-mp-01------interactions-webhook-only--2026-05-24)) — 자유 텍스트 DM 미수신 | user-guide 의 Discord 페이지 callout 으로 명시 ("v1 은 slash command + modal 입력만, 자유 텍스트 reply 는 v2 Gateway 도입 후"). 본 plan 의 GUI 는 한계를 반영하지 않음 (provider 선택 후 사용자가 의식적으로 결정) |
| KO/EN i18n parity | dict 변경은 한 commit 으로 묶음. `i18n` 테스트 가드로 자동 검출 |
| User guide reverse-coverage 가드 (`integrations-coverage` / `impl-anchor-existence`) | commit 4 의 `<ImplAnchor>` 작성 의무. 가이드 작성은 `user-guide-writer` sub-agent 위임 권장 |
| backend e2e 의 외부 API mock 누락 | `chat-channel-e2e-hardening` plan (complete) 의 fixture 헬퍼 (PR #303) 재사용. slack/discord client 의 모든 외부 HTTP 호출을 mock 화 |
| `CHAT_CHANNEL_PROVIDERS` 확장이 frontend 의 다른 chat-channel 코드와 정합 | frontend 의 chat-channel 관련 코드 (`trigger-detail-drawer.tsx` / `chat-channel-card.tsx` 등) 는 이미 provider 3종 라벨링 — DTO 확장만으로 정합. grep 으로 `'telegram'` 하드코딩 잔존 확인 (commit 2 의 첫 task) |

## 완료 기준

- 트리거 생성 모달에서 telegram / slack / discord 3 provider 모두 선택 가능 + provider별 secret 입력 흐름 동작
- backend `POST /api/triggers` 가 3 provider 모두 200 / 형식 위반은 400 / setup 실패는 적절한 에러 코드
- slack / discord e2e round-trip 통과 (생성 / inbound 인증 / PING handshake / URL Verification / 삭제)
- user-guide 의 slack/discord 페이지 GUI 흐름 절 + `triggers.mdx` provider 절 + 3 곳 모두 `<ImplAnchor>` 작성, reverse-coverage 가드 (`impl-anchor-existence` / `integrations-coverage` / `triggers-coverage`) 통과
- KO/EN i18n parity 가드 통과
- **spec frontmatter 승격** ([`spec/conventions/spec-impl-evidence.md §3`](../../spec/conventions/spec-impl-evidence.md)) — `spec/5-system/15-chat-channel.md` frontmatter `status: spec-only → partial` 또는 `implemented` (e2e 까지 완료되면 `implemented`) + `code:` 글로브에 frontend `triggers/page.tsx` + backend `chat-channel-config.dto.ts` + e2e 경로 추가 + `pending_plans:` 갱신. `providers/{slack,discord}.md` frontmatter 도 동일 점검. `spec-frontmatter`, `spec-code-paths`, `spec-pending-plan-existence` 테스트 통과
- **dispatcher-split plan frontmatter 갱신** — `plan/in-progress/chat-channel-dispatcher-split.md` 의 trigger 조건 항목을 "GUI 관점 충족 (본 plan 머지 시점)" 으로 cross-link. `status: backlog → ready` (실제 진입은 사용자 결정 사안)
- 모든 체크박스 `[x]` + 미해결 follow-up 0 → `plan/complete/` 로 `git mv` (마지막 작업 PR 안의 별 commit)
- detail drawer read 모드의 slack / discord 라벨 회귀 없음
- consistency-check (`review/consistency/2026/05/24/18_21_47/SUMMARY.md`) 의 모든 Critical 3건 + WARNING 8건 + INFO 13건 의 처리 결과를 `review/code/<...>/RESOLUTION.md` 의 §조치 항목에 cross-reference

## 후속 plan (본 plan 범위 밖, 분리 trigger)

- **`chat-channel-dispatcher-split`** — 본 plan 완료로 provider ≥ 2 trigger 조건 GUI 관점 충족. 진입 검토.
- **Slack / Discord 의 `inboundSigning` rotate API + UI** — v1 단계에서는 single-path rotate 가 `botToken` 한정. slack signing secret / discord public key 회전이 운영 요구로 떠오르면 별 spec 신설 후 별 impl plan.
- **`spec-coverage` 의 `code:` frontmatter 갱신** — 본 plan 머지 후 [`spec/4-nodes/7-trigger/providers/_overview.md`](../../spec/4-nodes/7-trigger/providers/_overview.md) / `slack.md` / `discord.md` 의 frontmatter `code:` 글로브에 trigger create 모달 경로 추가 검토 (SoT: [`spec/conventions/spec-impl-evidence.md`](../../spec/conventions/spec-impl-evidence.md)).
