# Cross-Spec 일관성 검토 결과

**검토 대상**: `plan/in-progress/spec-slack-discord-chat-channel.md` (Slack / Discord Chat Channel Provider 신설 plan)
**검토 기준 spec**: `spec/conventions/chat-channel-adapter.md`, `spec/5-system/15-chat-channel.md`, `spec/4-nodes/7-trigger/providers/_overview.md`, `spec/conventions/secret-store.md`, `spec/1-data-model.md`, `spec/0-overview.md`
**검토 날짜**: 2026-05-24

---

## 발견사항

### [WARNING] Form 다단계 시퀀스 규약 vs Slack/Discord Modal native UI — 컨벤션 직접 충돌 가능성

- **target 위치**: Plan §Phase 2 §5.3 (Slack Form), §Phase 3 §5.3 (Discord Form), §4 D-1
- **충돌 대상**: `spec/conventions/chat-channel-adapter.md §4 Form 다단계 시퀀스 규약`, 동 파일 `§Rationale R4`
- **상세**:
  Plan §Phase 2 §5.3 에서 Slack Form 을 "**modal (`views.open` + `view_submission`) 단일 step UI**" 로 기술하고 "(Telegram 의 다단계 텍스트 시퀀스와 다른 native 표현. Convention §4 의 다단계 시퀀스는 '어댑터가 동일하게 구현' 규약이지만 Slack 의 modal 은 1회 submission 으로 완성 가능 — Rationale 에 정당화 필요)" 라고 스스로 충돌을 인식하고 있다. Discord 도 동일하게 §Phase 3 §5.3 에서 modal native 표현을 검토한다.

  `chat-channel-adapter.md §4` 는 "본 시퀀스는 **모든 어댑터가 동일하게 구현**한다" 고 컨벤션 차원에서 강제하며, `Rationale R4` 는 "v1 은 다단계 텍스트 시퀀스로 통일 — 컨벤션 차원 강제. native UI 분기는 v2 옵션" 으로 modal 을 명시적으로 v2 로 기각한 이력이 있다.

  Plan §D-1 에서 잠정 채택 (C) = "Phase 2/3 draft 에서는 (A) 컨벤션 준수 path 로 작성" 이므로 실제 spec draft 가 (A) 방향으로 작성되면 컨벤션과 충돌이 없다. 그러나 plan 본문에 modal을 §5.3 의 주요 설명으로 먼저 서술하고 컨벤션 준수를 괄호 안 경고로 처리한 구조는, 향후 실제 spec 작성자가 혼동할 여지가 있다.
- **제안**: spec draft (slack.md / discord.md) 작성 시 §5.3 은 반드시 다단계 텍스트 시퀀스로 서술하고, modal native UI 는 `## Rationale` 의 "v2 옵션으로 기각된 대안" 으로만 기재. 컨벤션 §4 변경 없이 v1 에서는 (A) 가 유일한 선택임을 plan 본문에 명확히 기재 권장.

---

### [WARNING] `_overview.md` §1 표 신규 상태 컬럼 `spec-only` — 기존 상태값과 비일관

- **target 위치**: Plan §Phase 4 첫 번째 bullet, §Phase 4 두 번째 bullet
- **충돌 대상**: `spec/4-nodes/7-trigger/providers/_overview.md §1 Supported providers (v1)` 표, 동 파일 §2 신규 provider 추가 절차
- **상세**:
  현행 `_overview.md §1` 표의 상태 컬럼 값은 `"supported (v1)"` 단일 값만 존재한다. Plan 은 Slack / Discord 를 표에 추가할 때 상태를 `"spec-only"` 로 부여할 계획이다 (§Phase 4: "상태 = **`spec-only`** — 본 plan 은 spec 만 신설하므로").

  그러나 `_overview.md §2 신규 provider 추가 절차` step 1 은 "§1 표에 새 행 추가 (`<name> | <link> | supported`)" 라고 상태값을 `supported` 로 명시한다. 현행 절차 설명이 구현 완료를 전제로 작성되어 있어, plan 이 도입하려는 `spec-only` 상태를 수용하는 절차가 spec 에 없다.

  또한 plan §Phase 4 두 번째 bullet 에서 "필요 시 `spec-only` / `supported` 두 상태 도입 + Rationale" 을 검토 항목으로 나열하지만, 이 상태 도입 결정이 `_overview.md` 와 `_overview.md §2 절차` 양쪽을 동시에 갱신해야 한다는 동기화 의무가 plan 에 명시되어 있지 않다.
- **제안**: `_overview.md §2` 의 step 1 설명을 spec 신설 시 `spec-only`, 구현 완료 후 `supported` 로 상태를 분리 기재하도록 갱신. 상태 enum 도입 시 Rationale 도 함께 추가. plan §Phase 4 에 이 두 변경점을 명시적 체크박스로 분리 기재 권장.

---

### [WARNING] Secret Store 예시 표 — `slack-signing-secret` / `discord-public-key` 의 `name` 규칙 검토

- **target 위치**: Plan §Phase 4 세 번째 bullet (secret-store.md 갱신 검토)
- **충돌 대상**: `spec/conventions/secret-store.md §1 URI Scheme`, 동 §7 변경 관리
- **상세**:
  Plan 은 다음 두 ref 를 secret-store.md §1 예시 표에 추가할 것을 검토한다:
  - `secret://triggers/{triggerId}/slack-signing-secret`
  - `secret://triggers/{triggerId}/discord-public-key`

  `secret-store.md §1` 의 `name` 규칙은 "lower-case kebab-case" 이고, 기존 예시 (`bot-token`, `webhook-secret`, `notification-signing`) 는 모두 역할 기술어 (기능명) 형태다. `slack-signing-secret` 는 provider 명 (`slack`) 을 prefix 로 포함하고, `discord-public-key` 도 마찬가지다.

  기존 ref 는 provider-agnostic 네이밍 (`bot-token` 은 telegram 전용이지만 이름에 provider 를 포함하지 않음) 을 채택한다. Slack signing secret 은 Slack 전용, Discord public key 는 Discord 전용인데 provider 명을 ref name 에 포함하는 것은 기존 네이밍 스타일과 비일관이다.

  한편, `ChatChannelConfig.secretTokenRef` 는 `spec/conventions/chat-channel-adapter.md §2.3` 에서 "Telegram: setupChannel 시 어댑터가 randomBytes 로 발급 → ... **다른 provider 는 unused** (HMAC 지원 시 webhook.md HMAC 경로)" 로 명시되어 있다. Slack 의 HMAC-SHA256 signing secret 은 이 unused 필드와는 다른 별도 self, Discord 의 ed25519 public key 도 마찬가지다 — provider-specific secret 이므로 ref name 에 provider prefix 가 필요할 수 있다는 근거는 있다. 그러나 기존 `bot-token` 이 이미 telegram-specific 이면서 provider prefix 없이 사용되는 점과의 불일치는 남는다.
- **제안**: spec-store.md §1 예시 표 추가 시 provider-agnostic 네이밍 (`signing-secret`, `public-key`) 과 provider-specific 네이밍 중 하나를 Rationale 로 명시하고 일관성 확보. 혹은 `secretTokenRef` 필드를 Slack/Discord signing secret / public key 에도 재사용하면서 `webhook-secret` 네이밍 패턴을 유지하는 방안 검토. 어느 방향이든 `secret-store.md §7 변경 관리` 의 "새 secret type 추가 시 §1 예시 표에 새 name 행 추가" 절차를 준수해야 함.

---

### [WARNING] Slack `ackInteraction` — 3초 ack 의무와 컨벤션 `ackInteraction` noop 허용 기술의 충돌 가능성

- **target 위치**: Plan §Phase 2 §3 (Slack `ackInteraction`), §Phase 2 §5.2, §Phase 2 §6
- **충돌 대상**: `spec/conventions/chat-channel-adapter.md §1.1 6함수 책임`, `§Rationale R2`
- **상세**:
  Plan §Phase 2 §3 에서 "**`ackInteraction` (interactivity 3초 ack)**" 를 `setupChannel` / `teardownChannel` / `parseUpdate` / `sendMessage` / `ackInteraction` 의 6함수 매핑 중 하나로 포함하고, §5.2 와 §6 에서 "3초 ack 의무 (interactivity → response_url 또는 즉시 3xx)" 로 기술한다.

  컨벤션 §1.1 은 `ackInteraction` 을 "provider 에 따라 noop 가능 — 함수 자체는 의무지만 구현체는 비어 있을 수 있음" 으로 정의하고, Rationale R2 는 텔레그램의 `answerCallbackQuery` 를 예시로 든다. Slack 의 3초 ack 는 interactivity endpoint (button tap, view submission) 에 대한 HTTP 응답 자체이므로, 이를 `ackInteraction` 으로 모델링할 경우 `sendMessage` (외부 API 호출) 와 `ackInteraction` (HTTP 응답 ack) 의 책임 경계가 컨벤션 §1.1 의 "외부 API 호출" 설명과 어긋날 수 있다.

  Slack interactivity 의 3초 ack 는 `POST /api/hooks/:endpointPath` 의 HTTP response 자체이므로, `ackInteraction` 함수 안에서 외부 API 를 호출하는 것이 아니라 response body 를 직접 작성하는 side-effect 다. 이는 텔레그램의 `answerCallbackQuery` (별도 HTTP 호출) 와 구조가 다르다 — 컨벤션의 "외부 API 호출 (provider 의존)" 설명이 이 케이스를 포함하는지 모호하다.
- **제안**: slack.md §3 에서 `ackInteraction` 의 구체 동작을 "HTTP response 직접 반환 vs response_url POST" 로 명시하고, 컨벤션 §1.1 의 설명이 이 케이스를 포함하는지 Rationale 에 기재. 모호성이 크면 컨벤션 §1.1 주석에 "HTTP response ack 도 포함" 한 줄 추가 권장.

---

### [WARNING] Discord v1 Interactions-webhook-only — `ChannelUpdate.command.kind: "text_message"` 미지원 함의

- **target 위치**: Plan §Phase 3 §4 (`MESSAGE_CREATE` Gateway 사용 시 v1 skip), §4 D-3
- **충돌 대상**: `spec/conventions/chat-channel-adapter.md §2.1 ChannelUpdate` command kinds, `spec/5-system/15-chat-channel.md §3.2 CCH-CV-02, CCH-CV-03`
- **상세**:
  Plan §Phase 3 §4 에서 "AI Multi Turn 의 사용자 reply 는 **modal 또는 component 기반 입력** 으로 제한 (자유 텍스트 채팅 미지원)" 이라고 명시한다. 즉 Discord v1 어댑터는 일반 DM 메시지 (`MESSAGE_CREATE`) 를 수신하지 못하므로, `ChannelUpdate.command.kind === "text_message"` 를 생성할 경로가 없다.

  그러나 `chat-channel-adapter.md §2.1` 의 `ChannelUpdate.command` union 은 `text_message` 를 명시적으로 정의하고 있으며, `15-chat-channel.md §3.2 CCH-CV-02` 는 "첫 메시지 또는 `/start` 명령 도착 시 새 execution 시작" 을 필수 요구사항으로 정의한다. Discord v1 에서는 slash command 로 시작이 가능하므로 CCH-CV-02 는 충족할 수 있으나, CCH-CV-03 의 "(a) `waiting_for_input` → forwarding" 케이스에서 사용자 자유 텍스트 답변 불가라는 UX 제약이 생긴다.

  이는 `CCH-MP-01` (AI Multi Turn → 텍스트 메시지 변환) 의 "채널 텍스트 메시지 1건 이상으로 변환" 과, Discord v1 에서 사용자가 자유 텍스트로 답변할 수 없다는 구조적 불일치를 만든다. AI Multi Turn 노드는 사용자의 `text_message` 답변을 기대하는데, Discord v1 은 그 경로가 없다.
- **제안**: discord.md §5.1 AI Multi Turn 절에서 v1 의 자유 텍스트 미지원 제약을 명시하고, 대안 (slash command + TEXT_INPUT modal 로 답변 수집) 을 Rationale 에 기재. `CCH-MP-01` 의 "AI Multi Turn" 이 Discord v1 에서 어떻게 동작하는지 (modal 기반 입력 또는 미지원 명시) 를 spec draft 에 포함시켜야 함. 향후 Gateway v2 plan (`chat-channel-discord-gateway`) 이 이 제약을 해소함을 Rationale 에 명시.

---

### [INFO] `CCH-AD-01` 의 "v1: `telegram`" 기술 — Slack/Discord 추가 후 동기화 필요

- **target 위치**: Plan §Phase 4 첫 번째 bullet (`_overview.md` 갱신)
- **충돌 대상**: `spec/5-system/15-chat-channel.md §3.1 CCH-AD-01`
- **상세**:
  `15-chat-channel.md §3.1 CCH-AD-01` 은 "provider 필드로 어댑터 선택 (v1: `telegram`)" 으로 정의되어 있다. Slack / Discord 추가 시 이 괄호 기술이 구식이 된다.
- **제안**: slack.md / discord.md spec 신설 및 `_overview.md` 갱신 시 `15-chat-channel.md §3.1 CCH-AD-01` 의 "(v1: `telegram`)" 표현을 "(지원: `telegram`, `slack`, `discord`)" 또는 "_overview.md 카탈로그 참조" 로 갱신하는 항목을 Phase 4 체크박스에 추가 권장.

---

### [INFO] `spec/1-data-model.md §2.21.1 SecretStore` 용도 목록 — Slack/Discord secret ref 동기화 필요

- **target 위치**: Plan §Phase 4 세 번째 bullet (secret-store.md 갱신)
- **충돌 대상**: `spec/1-data-model.md §2.21.1 SecretStore` 용도 목록
- **상세**:
  `spec/1-data-model.md §2.21.1` 의 "용도" 항목은 현재 텔레그램 (`bot-token`, `bot-token.v2`, `webhook-secret`) 과 EIA (`notification-signing`, `notification-signing.v2`) ref 만 나열한다. Slack signing secret / Discord public key 가 secret store 에 추가되면 이 목록도 동기화 필요하다.
- **제안**: secret-store.md §1 예시 표에 새 행 추가 시 `spec/1-data-model.md §2.21.1` 용도 목록도 함께 갱신하는 항목을 plan Phase 4 에 포함.

---

### [INFO] `spec/5-system/15-chat-channel.md §3.1 시퀀스 다이어그램` — "Telegram 예시" 레이블 부재

- **target 위치**: Plan §Phase 4 다섯 번째 bullet (`15-chat-channel.md` review)
- **충돌 대상**: `spec/5-system/15-chat-channel.md §3.1 전체 시퀀스`
- **상세**:
  `15-chat-channel.md §3.1` 의 시퀀스 다이어그램은 제목이 "(Telegram 예시)" 라고 이미 명시되어 있다 ("### 3.1 전체 시퀀스 (Telegram 예시)"). Plan §Phase 4 다섯 번째 bullet 의 "Telegram 1종 가정 표현이 있는지 점검. 필요 시 '텔레그램 예시' 표기 명확화" 는 이미 충족된 상태다.

  단, §4.1 `config.chatChannel.provider` 예시값이 `"telegram"` 으로 고정되어 있는 것은 예시 표기로 보아 충돌이 아니나, 신규 provider 추가 후 "예시" 임을 명확히 할 필요는 있다.
- **제안**: Phase 4 다섯 번째 bullet 의 작업 범위를 "기존 Telegram 예시 표기 재확인 (이미 완료) + §4.1 config 예시의 'telegram' 이 예시임을 주석으로 명시 또는 다른 provider 추가 시 병기" 로 좁혀도 충분.

---

### [INFO] `_overview.md §2` — Slack/Discord 가 "계획된 추가 provider 없음" 문단 이후에 후보로 나열되는 구조

- **target 위치**: `spec/4-nodes/7-trigger/providers/_overview.md §2 Planned providers` (현재 상태)
- **충돌 대상**: Plan §Phase 4 첫 번째 bullet
- **상세**:
  현행 `_overview.md §2` 는 "현재 계획된 추가 provider 는 없다. 사용자 요청이 있을 때 다음 후보를 우선 검토:" 라는 문장 뒤에 slack / discord 를 나열한다. 이 문구는 본 plan 이 실행 중인 현 시점과 어긋나지 않는다 (본 plan 이 계획 확정이므로 §2 텍스트 갱신은 Phase 4 에서 정당). 이는 충돌이 아니라 plan 의 예상 갱신 대상이다.
- **제안**: 이미 plan Phase 4 에서 처리 예정이므로 별도 조치 불필요. 단 Phase 4 체크박스에 §2 의 "현재 계획된 추가 provider 는 없다" 문구도 함께 갱신하는 항목을 명시 권장.

---

## 요약

Cross-Spec 일관성 관점에서 target plan 은 전반적으로 기존 spec 의 주요 계약을 인식하고 있으며, 가장 핵심적인 컨벤션 충돌 (Form 다단계 시퀀스 vs Modal native UI) 을 D-1 에서 직접 식별하고 잠정 해법도 마련했다. 실제 spec draft 를 (A) 컨벤션 준수 방향으로 작성하면 CRITICAL 수준 충돌은 없다. WARNING 수준의 발견사항 4건은 (1) Form modal 충돌 가능성의 draft-level 위험, (2) `_overview.md` 상태 컬럼 절차 불일치, (3) secret-store.md ref naming 스타일 비일관, (4) Discord v1 자유 텍스트 미지원이 CCH-MP-01 / CCH-CV-03 과 만드는 구조적 긴장이다. 이 중 (4) 는 plan §D-3 에서 명시적으로 인식했으나 spec 수준 명세화 방법이 결정되지 않았다는 점에서 spec draft 작성 전 방향 결정이 필요하다. INFO 3건은 동기화 권장 수준이며 작업 누락 방지를 위해 Phase 4 체크박스에 추가 권장한다.

---

## 위험도

**MEDIUM**

Form 컨벤션 충돌은 plan 이 인식하고 (A) 방향 채택을 잠정 결정했으므로 실제 draft 가 그대로 작성되면 해소된다. Discord v1 의 `text_message` 미지원이 AI Multi Turn 노드 계약과 만드는 구조적 긴장은 spec draft 에서 명시적으로 처리하지 않으면 구현 단계에서 불명확한 요구사항으로 남을 수 있어 MEDIUM 위험도로 평가한다.
