---
worktree: spec-slack-discord-chat-channel-bb4d35
started: 2026-05-24
owner: planner
---

# Spec — Slack / Discord Chat Channel Providers 신설

Telegram chat channel provider 와 동일한 패턴으로 **Slack** 과 **Discord** 두 provider 의 spec 을 신설한다. 본 plan 은 **spec 단계만** 책임지며, 구현(`codebase/**`) 은 후속 plan (§6) 로 분리된다.

---

## 0. 배경

- Telegram chat channel provider 가 [`spec/4-nodes/7-trigger/providers/telegram.md`](../../spec/4-nodes/7-trigger/providers/telegram.md) + [`codebase/backend/src/modules/chat-channel/providers/telegram/**`](../../codebase/backend/src/modules/chat-channel/providers/telegram/) 로 완전 구현되어 있다.
- 공통 어댑터 계약 [`spec/conventions/chat-channel-adapter.md`](../../spec/conventions/chat-channel-adapter.md) 의 6함수 인터페이스 (`setupChannel` / `teardownChannel` / `parseUpdate` / `renderNode` / `sendMessage` / `ackInteraction`) 와 `ChatChannelConfig` / `ChannelUpdate` / `ChannelMessage` 데이터 타입은 이미 provider-agnostic 으로 설계되어 있어 **Slack / Discord 추가 시 컨벤션 본문 변경이 (원칙적으로) 불필요**하다.
- Provider catalog [`spec/4-nodes/7-trigger/providers/_overview.md`](../../spec/4-nodes/7-trigger/providers/_overview.md) §2 의 "planned providers" 에 slack / discord 가 이미 후보로 명시되어 있다.
- 사용자 결정 (Auto mode 2026-05-24):
  1. **둘 다 spec 부터 → 그 후 구현 순차** (Slack → Discord).
  2. **Telegram 과 동일 풀셋** — 5종 매핑 (AI Multi Turn / Button Presentation / Form / Carousel·Chart·Table 이미지 / Typing) 모두 새 provider 에서도 커버.

## 1. 산출물 목록

| 산출물 | 종류 | 비고 |
|---|---|---|
| `spec/4-nodes/7-trigger/providers/slack.md` | 신규 | Telegram spec 과 동일 7섹션 구조 + Rationale |
| `spec/4-nodes/7-trigger/providers/discord.md` | 신규 | 동상 |
| `spec/4-nodes/7-trigger/providers/_overview.md` | 갱신 | §1 supported 표에 두 행 추가 + §2 planned 에서 제거 |
| `spec/conventions/chat-channel-adapter.md` | 검토 후 최소 갱신 (또는 무변경) | 6함수 인터페이스에 provider-specific 누수가 있는지 점검. 변경 최소화 원칙 |
| `spec/conventions/secret-store.md` | 검토 후 최소 갱신 (또는 무변경) | §1 예시 표에 Slack signing secret · Discord public key ref 행 추가 가능성 |
| `spec/5-system/15-chat-channel.md` | 검토 후 최소 갱신 (또는 무변경) | §3.1 시퀀스 다이어그램 등 Telegram 1종 가정이 있는지 점검 |
| `plan/in-progress/chat-channel-slack-impl.md` | 신규 (스켈레톤) | §6 |
| `plan/in-progress/chat-channel-discord-impl.md` | 신규 (스켈레톤) | §6 |

## 2. 영역 권한 / 제약

- `spec/**`, `plan/**` Write 가능.
- `codebase/**` **Read only** — 본 plan 에서는 절대 수정하지 않는다 (구현은 후속 developer plan).
- `spec/` 쓰기 직전 `/consistency-check --spec` 의무 (§5 / Phase 4).

## 3. Phase

### Phase 0 — 영향 spec / 컨벤션 / in-progress plan 전수 read ✅

읽은 문서:

- [x] `spec/4-nodes/7-trigger/providers/telegram.md` — template
- [x] `spec/conventions/chat-channel-adapter.md` — 6함수 인터페이스 SoT
- [x] `spec/4-nodes/7-trigger/providers/_overview.md` — catalog
- [x] `spec/5-system/15-chat-channel.md` — 시스템 spec
- [x] `spec/conventions/secret-store.md` — secret URI scheme
- [x] `spec/4-nodes/7-trigger/0-common.md` — trigger 공통 규약
- [x] `spec/4-nodes/6-presentation/4-form.md` (§1·§1.5) — form field/validation/file 스키마
- [x] `plan/complete/chat-channel-impl.md` — template plan 로 활용
- [x] `plan/in-progress/*chat-channel*` 목록 — 동시 작업 충돌 점검

확인된 점:
- 6함수 인터페이스는 provider-agnostic — Slack / Discord 추가에 변경 불필요.
- `ChannelUpdate.command` kinds (`start` / `cancel` / `text_message` / `button_callback` / `file_upload` / `contact_share`) 가 Slack / Discord 의 자연 명령에 충분히 매핑됨.
- `ChatChannelConfig.secretTokenRef` 는 "provider 별 unused" 로 정의 — Slack signing secret · Discord public key 도 이 필드 또는 동일 패턴의 추가 ref 로 표현 가능.
- Secret URI scheme `secret://triggers/{id}/<name>` 는 새 `name` (`slack-signing-secret`, `discord-public-key`) 만 §1 예시 표에 추가하면 됨 — scheme 자체 변경 없음.
- 동시 작업 plan 5건 (`chat-channel-dispatcher-split` / `chat-channel-secret-store-infra` / `chat-channel-visual-ssr-png` / `spec-telegram-chat-channel-ui-polish` / `trigger-list-chat-channel-ui`) 모두 **다른 worktree** + **다른 영역** (dispatcher 리팩토링 / secret 인프라 / 시각 SSR / Telegram-specific UI polish / trigger list UI) — 본 plan (`providers/slack.md` · `providers/discord.md` 신설) 과 파일/라인 단위 충돌 없음. consistency-check `plan_coherence` 에서 명시적 분리 근거로 본 절 인용.

### Phase 1 — 본 plan 작성 (in_progress)

- [x] `plan/in-progress/spec-slack-discord-chat-channel.md` frontmatter + §0~§7 작성

### Phase 2 — Slack provider spec draft

목표: `spec/4-nodes/7-trigger/providers/slack.md` 신설. Telegram spec 의 7섹션 구조를 그대로 따르되 **Slack 의 native primitives** 로 매핑.

- [ ] §Overview — `provider: "slack"` 의 정체성, 사용 시나리오 (Slack bot DM · slash command · interactive message)
- [ ] §3 Web API 호출 매핑 — `setupChannel` (Events API subscription + `auth.test`) / `teardownChannel` (revoke) / `parseUpdate` (Events API + interactivity payload) / `sendMessage` 변형 (text / Block Kit buttons / modal trigger / file upload / typing) / `ackInteraction` (interactivity 3초 ack)
- [ ] §4 명령 매핑 (`parseUpdate`)
  - slash commands (`/start` 동등은 봇 app mention 또는 `/<command-prefix> start` — Slack 의 slash command 가 workspace-wide 고유 prefix 1개라 trigger 별 prefix 불가능 → mention 기반)
  - `app_mention` / `message.im` events
  - `block_actions` (button tap, select menu)
  - `view_submission` (modal submit)
  - `file_shared` event
  - DM 외 채널 (`channel` / `group` / `mpim`) → `null` 반환 + 호출자가 `groupChatRefusal` 안내
  - 다른 봇 / 자기 자신 메시지 (`bot_id` 존재 / `user === botUserId`) → `null`
- [ ] §5 인터랙션 노드 UI 매핑 (5종)
  - 5.1 AI Multi Turn → `chat.postMessage` (mrkdwn) + chunked 3500 char (Slack soft limit)
  - 5.2 Button Presentation → Block Kit `actions` block 의 `button` element. `style: primary|danger`. `block_actions` payload → `click_button`. 3초 ack 의무 (interactivity → response_url 또는 즉시 3xx)
  - 5.3 Form → **modal (`views.open` + `view_submission`)** 단일 step UI (Telegram 의 다단계 텍스트 시퀀스와 다른 native 표현. Convention §4 의 다단계 시퀀스는 "어댑터가 동일하게 구현" 규약이지만 Slack 의 modal 은 1회 submission 으로 완성 가능 — Rationale 에 정당화 필요. 만약 컨벤션과 충돌하면 v1 은 다단계 텍스트 시퀀스로 통일하고 modal 은 v2 옵션으로 분리 — **consistency-check 가 결정** ⚠️)
  - 5.4 Carousel / Chart / Table → Block Kit `image` block 또는 `files.uploadV2` + thread reply. v1 = text/monospace + image block 의 image_url fallback. v2 = SSR PNG (Telegram §5.4 와 동일 v2 plan `chat-channel-visual-ssr-png` 공유)
  - 5.5 Typing → **Slack native 미지원** → no-op + Rationale 명시 (대안: ephemeral "..." 메시지는 노이즈)
- [ ] §6 보안 — `X-Slack-Signature` HMAC-SHA256 검증 (signing secret). `X-Slack-Request-Timestamp` 의 5분 replay window. group/channel chat 차단. bot 메시지 무시. Inbound HTTP Contract 는 [Spec Chat Channel §5.5](../../spec/5-system/15-chat-channel.md#55-inbound-http-contract) 와 동일 (response_url / interactivity ack 의 3초 시한 추가 명시)
- [ ] §7 비기능 — Slack rate limit (Tier 별, sendMessage `chat.postMessage` Tier 1 = 1/sec/channel). Events API `event_id` 기반 dedup. 5초 timeout + 3회 backoff
- [ ] §Rationale — Slack 특이 결정 (modal 1회 vs 다단계 / typing no-op / mention 기반 시작 / signing secret 검증)

### Phase 3 — Discord provider spec draft

목표: `spec/4-nodes/7-trigger/providers/discord.md` 신설.

- [ ] §Overview — `provider: "discord"` 의 정체성, 사용 시나리오 (Discord bot DM · slash command · components)
- [ ] §3 REST + Interactions Webhook 매핑 — `setupChannel` (slash command bulk overwrite + `GET /applications/@me`) / `teardownChannel` (slash command 삭제) / `parseUpdate` (Interactions webhook payload + Gateway message events — v1 은 **Interactions webhook 단일 경로**, Gateway 는 v2 옵션) / `sendMessage` 변형 / `ackInteraction` (3초 안에 type=5 deferred 또는 type=6 update)
- [ ] §4 명령 매핑 (`parseUpdate`)
  - slash commands → `start` / `cancel` 명령 매핑 (Discord slash command 는 application 단위 — trigger 별 prefix 가능)
  - `MESSAGE_COMPONENT` interaction (button tap / select menu) → `button_callback`
  - `MODAL_SUBMIT` interaction → form submission
  - `APPLICATION_COMMAND` text option → `text_message`
  - `MESSAGE_CREATE` (Gateway 사용 시) — v1 skip
  - DM 외 채널 (`channel.type !== 1`) → `null` + `groupChatRefusal` 안내
  - `member.user.bot === true` → `null`
- [ ] §5 인터랙션 노드 UI 매핑 (5종)
  - 5.1 AI Multi Turn → `POST /channels/{id}/messages` (markdown) + chunked 2000 char (Discord hard limit)
  - 5.2 Button Presentation → Message Components `ACTION_ROW` + `BUTTON`. `style: 1 (Primary) | 4 (Danger)`. 3초 ack 의무
  - 5.3 Form → **Modal (TEXT_INPUT components)** native 표현. 최대 5 components/modal. Slack 과 동일하게 다단계 vs modal 의 결정은 consistency-check 가 ⚠️
  - 5.4 Carousel / Chart / Table → `embeds[]` (최대 10) + `files[]` attachment. v1 text/markdown + image embed. v2 SSR PNG 공유
  - 5.5 Typing → `POST /channels/{id}/typing` (10초 유지) — Telegram `sendChatAction` 와 1:1
- [ ] §6 보안 — `X-Signature-Ed25519` + `X-Signature-Timestamp` ed25519 서명 검증 (application public key). PING (type=1) 응답 처리 의무. group/channel 차단. bot 무시
- [ ] §7 비기능 — Discord global rate limit (50 req/sec) + per-route bucket. interaction.id 기반 dedup
- [ ] §Rationale — Discord 특이 결정 (Interactions webhook only / ed25519 검증 / 2000 char hard limit / modal 5 components 한계 시 다단계 fallback)

### Phase 4 — `_overview.md` 갱신 + 컨벤션 영향도 점검 ✅

- [x] `spec/4-nodes/7-trigger/providers/_overview.md` — `spec-defined / impl-pending` 신 단계(§2) 도입, slack / discord 행 추가. §3 신규 provider 절차를 8섹션 + 3-step lifecycle (Spec 신설 → Impl 착수 → §1 supported 승격) 로 갱신.
- [x] `spec/conventions/secret-store.md` §1 예시 표에 두 행 추가 + `bot-token` 용도 generalize.
- [x] `spec/conventions/chat-channel-adapter.md` §2.3 ChatChannelConfig 에 `signingSecretRef?` (Slack) / `publicKeyRef?` (Discord) optional 필드 + 주석 추가. 6함수 인터페이스 / 기타 데이터 타입 변경 없음.
- [x] `spec/5-system/15-chat-channel.md` §5.5 Inbound HTTP Contract 표에 Slack/Discord 응답 예외 4행 + §5.5.1 정책 신설. §4.1 config 예시에 provider-specific 인증 ref 주석 추가. §3.1 CCH-AD-01 의 provider 목록 갱신. (`spec/conventions/chat-channel-adapter.md §7 변경 관리` 의무 충족 — W-4 해소)
- [x] `spec/1-data-model.md §2.21.1 SecretStore` 용도 목록에 slack/discord ref 두 행 추가 (I-2 해소).
- [x] `secret-store.md` 갱신 범위 = URI scheme 예시 표 확장만 — 인프라 구현 선택 ([`chat-channel-secret-store-infra`](../in-progress/chat-channel-secret-store-infra.md)) 과 독립 (I-9 해소).

### Phase 5 — `/consistency-check --spec` 실행 + 발견 사항 해소 ✅

5개 sub-agent 병렬 호출 완료. 산출: `review/consistency/2026/05/24/02_07_45/`.

- [x] `cross_spec` — WARNING 4 / INFO 3 / CRITICAL 0
- [x] `rationale_continuity` — WARNING 2 / INFO 3 / CRITICAL 0
- [x] `convention_compliance` — **CRITICAL 2** / WARNING 3 / INFO 1
- [x] `plan_coherence` — WARNING 1 / INFO 3 / CRITICAL 0
- [x] `naming_collision` — WARNING 1 / INFO 4 / CRITICAL 0

**1차 결정**: SUMMARY 의 BLOCK: YES (CRITICAL 2건). spec commit 차단 후 §7 결과 절의 해소 작업 수행.

**해소 결과**:

| ID | 검출 | 해소 |
|---|---|---|
| C-1 | `slack.md` / `discord.md` 실제 8섹션 vs `_overview.md` 의 공식 "7섹션" 불일치 | `_overview.md §3` 절차 step 1 의 섹션 목록을 8섹션 (Overview / §3 API 호출 매핑 / §4 명령 매핑 / §5 인터랙션 노드 UI 매핑 / §6 보안 / §7 명령 처리 / §8 비기능 / Rationale) 으로 갱신. Telegram 실제 구조 follow. |
| C-2 | `_overview.md §2` 표가 미생성 impl plan dead link | `_overview.md §2` 표의 link 를 "(Phase 6 에서 신설)" / "Slack impl 완료 후" 텍스트로 교체. living link 는 Phase 6 스켈레톤 생성 후. |
| W-1 | Slack/Discord §5.3 modal 본문 서술이 R4 기각 대안 조건부 재도입 | §5.3 본문은 이미 다단계 시퀀스 1차 + modal 은 Rationale (R-S-6 / R-D-6) 에 v2 옵션만 명시 — 본문 변경 불필요. plan §D-1 에 R4 cross-ref + (A) 확정 채택 명시. |
| W-2 | Discord v1 CCH-MP-01 부분 유예 Rationale 부재 | `discord.md §5.1` 을 Outbound (완전 충족) / Inbound (부분 유예) 두 절로 normative 분리 + `15-chat-channel.md` Rationale 에 R-CC-13 신설 ("Discord v1 의 CCH-MP-01 부분 유예 — Interactions Webhook only 의 결과"). |
| W-3 | `_overview.md` step 1 lifecycle 불명확 | §3 절차 3-step (Spec 신설 → Impl 착수 → §1 supported 승격) 으로 명시. |
| W-4 | `chat-channel-adapter.md §2.3` 변경에 대한 `15-chat-channel.md §4.1` 동시 갱신 미확인 | `15-chat-channel.md §4.1` config 예시에 provider-specific 인증 ref 주석 추가 + §4.1 설명에 4종 ref 단일 진실 cross-link. Convention §7 의무 충족. |
| W-5 | Slack R-S-7 채택 표지 + HooksService files.info 흐름 normative 미명시 | R-S-7 을 (채택) 마킹 + 5단계 normative 흐름 (parseUpdate pure 반환 → HooksService files.info → mimeType 보강 → form 검증 → EIA submit_form / 실패 재질문) 명시. |
| W-6 | Slack ackInteraction HTTP response 직접 반환 책임 모호 | `slack.md §3` 표의 `ackInteraction` 행에 "Interactivity 응답: 3초 안에 HTTP 200 OK 반환 — 비동기 갱신은 response_url" 이미 명시. 추가 변경 불필요. |
| W-7 | secret ref naming 스타일 비일관 (provider prefix 포함 여부) | `bot-token` 은 provider 공통 자원이라 prefix 없음. `slack-signing-secret` / `discord-public-key` 는 provider-specific 자원이라 prefix 포함 — 의미 차이가 naming 패턴 차이의 근거. `secret-store.md §1` 행과 `1-data-model.md §2.21.1` 의 용도 설명에 provider-specific vs provider-공통 구분 명시. |
| W-8 | dispatcher-split plan trigger 시점 불명확 | §6 후속 plan 절에 명시 추가. |
| I-1 | `CCH-AD-01` 의 v1 provider 목록 구식 | `15-chat-channel.md §3.1 CCH-AD-01` 갱신 — providers/_overview.md §1 SoT cross-link. |
| I-2 | `1-data-model.md §2.21.1` SecretStore 용도 목록 동기화 | slack/discord ref 두 행 추가. |
| I-8 | `_overview.md §3` 번호 중복 | `provider 식별자 컨벤션` 을 §4 로 정정. |
| I-3, I-4, I-5, I-6, I-7, I-9, I-10, I-11 | 정보성 권장 | 향후 impl plan 진입 또는 별 grooming 작업에서 처리 (cleanup-worktree-all.sh 등). |

**2차 결정**: 모든 CRITICAL 해소 + 주요 WARNING 8건 해소 + INFO 일부 해소. 본 plan 의 spec 단계 산출물을 commit 진행 가능.

### Phase 6 — 후속 구현 plan 스켈레톤 + 본 plan 종결

- [x] `plan/in-progress/chat-channel-slack-impl.md` 신설 (스켈레톤 — frontmatter `status: backlog` + 진입 조건 + Phase 0~6 placeholder). Telegram template (`plan/complete/chat-channel-impl.md`) 의 PR-A~E 구조 follow.
- [x] `plan/in-progress/chat-channel-discord-impl.md` 신설 (스켈레톤, `status: backlog`). 진입 조건: Slack impl 완료.
- [x] `_overview.md §2` 의 impl plan link 를 living link 로 정리 (Phase 5b 의 C-2 dead-link 해소 완료).
- [x] 본 plan 의 모든 체크박스 `[x]` → 본 PR 안에서 `git mv plan/in-progress/spec-slack-discord-chat-channel.md plan/complete/` 이동 (별 commit `chore(plan): mark spec-slack-discord-chat-channel complete`).
- [x] commit 메시지: `docs(spec): chat channel — slack / discord providers 신설`

## 4. 위험 / 결정 보류

### D-1. Form 다단계 vs Modal native UI — (A) 채택 (확정)

Slack modal (`views.open`) 과 Discord modal (`MODAL_SUBMIT`) 은 5개 이내 input 을 단일 step 으로 받는 native UI 다. [Convention §4 의 "Form 다단계 시퀀스 규약"](../../spec/conventions/chat-channel-adapter.md#4-form-다단계-시퀀스-규약) 은 **모든 어댑터가 동일하게 다단계 시퀀스로 풀어낸다** 고 컨벤션 차원 강제 ([Convention Rationale R4](../../spec/conventions/chat-channel-adapter.md#rationale)) — modal native 표현은 v1 범위 외.

옵션:
- **(A) 컨벤션 준수 — 다단계 텍스트 시퀀스로 통일** (Telegram 과 같은 UX). modal 은 v2 옵션으로 별 plan.
- **(B) 컨벤션 §4 의 예외 절 추가** — provider 가 native form UI 지원 시 옵션 허용. 컨벤션 본문 갱신 필요.
- **(C) 결정 보류 → consistency-check 가 위반 검출 시 결정**.

**확정 채택**: (A) — `/consistency-check --spec` 결과 (W-1, rationale_continuity / cross-spec) 가 modal v1 도입을 R4 기각 대안의 조건부 재도입으로 판정. spec 본문 §5.3 은 다단계 텍스트 시퀀스로 작성됨 + modal 은 Rationale (R-S-6 / R-D-6) 에 v2 옵션으로만 명시. 컨벤션 변경 없음. modal 도입은 별 plan [`chat-channel-form-native-modal`](../in-progress/chat-channel-form-native-modal.md) (v2 trigger 시 진입).

### D-2. Slack `/start` 동등 명령 — slash command vs mention

Slack slash command 는 workspace 단위 1개 prefix → trigger 별 prefix 불가능. 대안:
- **(A) `@<botname> start` mention 기반** — trigger 별 봇이면 자연.
- **(B) `app_home` 진입 자동 start** — Slack 의 Home tab.
- **(C) DM 첫 메시지 자동 start** (Telegram `/start` 와 동등) — 가장 단순, mention 불필요.

**잠정 채택**: (C) DM 첫 메시지 → 자동 start (Telegram `/start` 의미상 동등). `start` / `cancel` 명시 명령은 mention 기반 보조 (`@bot cancel` 등). 결정 근거는 spec §4 Rationale 에.

### D-3. Discord `MESSAGE_CREATE` Gateway 의존 — v1 skip

Discord Interactions webhook 으로는 slash command / button / modal 만 받음. 일반 DM 메시지 (`MESSAGE_CREATE`) 는 Gateway WebSocket 연결이 필요. v1 은 Interactions webhook 단일 경로 → AI Multi Turn 의 사용자 reply 는 **modal 또는 component 기반 입력** 으로 제한 (자유 텍스트 채팅 미지원).

옵션:
- **(A) v1 Interactions webhook only**: 자유 텍스트 채팅 미지원, 모든 사용자 입력은 button / modal. Discord 의 native bot 운영 패턴 (slash command 우선) 과 정합.
- **(B) v1 Gateway 도입**: Discord WebSocket 연결 1개 / bot — 별도 인프라 (long-lived connection management) 필요. v1 범위 초과.

**잠정 채택**: (A) v1 Interactions webhook only. 자유 채팅은 v2 Gateway plan (`chat-channel-discord-gateway`) 으로 분리. Rationale 에 명시.

## 5. 참조

- [`spec/4-nodes/7-trigger/providers/telegram.md`](../../spec/4-nodes/7-trigger/providers/telegram.md) — template
- [`spec/conventions/chat-channel-adapter.md`](../../spec/conventions/chat-channel-adapter.md) — 6함수 인터페이스 SoT
- [`spec/conventions/secret-store.md`](../../spec/conventions/secret-store.md) — secret URI scheme
- [`spec/5-system/15-chat-channel.md`](../../spec/5-system/15-chat-channel.md) — 시스템 spec
- [`spec/4-nodes/7-trigger/providers/_overview.md`](../../spec/4-nodes/7-trigger/providers/_overview.md) — catalog
- [`plan/complete/chat-channel-impl.md`](../complete/chat-channel-impl.md) — 후속 impl plan 의 phase 구조 template

## 6. 후속 plan

- [`plan/in-progress/chat-channel-slack-impl.md`](./chat-channel-slack-impl.md) (status: backlog) — Slack adapter 구현. 본 plan 의 spec PR merge 후 사용자 결정으로 진입.
- [`plan/in-progress/chat-channel-discord-impl.md`](./chat-channel-discord-impl.md) (status: backlog) — Discord adapter 구현. Slack impl 완료 후 사용자 결정으로 진입 (순차 진행).
- [`plan/in-progress/chat-channel-dispatcher-split.md`](./chat-channel-dispatcher-split.md) (status: backlog) — **trigger 조건**: 본 spec plan 자체는 spec-only 단계이므로 dispatcher-split 의 in-progress 진입을 trigger 하지 않는다. trigger 시점은 **chat-channel-slack-impl 의 Phase 1 (registry 등록) 완료** — 두 번째 provider 가 실제 in-process EventEmitter listener 로 attach 되는 시점. impl plan 의 Phase 1 체크박스 옆에 dispatcher-split trigger 검토 항목 추가 권장 (W-8 해소).
- `plan/in-progress/chat-channel-form-native-modal.md` (v2 후보 — 미생성) — Slack `views.open` / Discord MODAL_SUBMIT 의 native form UI. Convention §4 다단계 시퀀스 규약의 예외 절 추가가 선행 조건. v2 trigger 시 진입.
- `plan/in-progress/chat-channel-discord-gateway.md` (v2 후보 — 미생성) — Discord Gateway WebSocket 도입으로 R-CC-13 의 CCH-MP-01 부분 유예 해소. trigger: 자유 텍스트 채팅이 사용자 요청으로 필수가 되는 시점.

## 7. 결과 (Phase 5 종료 후 갱신)

— Phase 5 종료 후 채움 —
