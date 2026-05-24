# Cross-Spec 일관성 검토 결과

검토 대상: `plan/in-progress/spec-chat-channel-inbound-signing-rename.md`
검토 일시: 2026-05-24
검토자: cross-spec consistency checker

---

## 발견사항

### 1. [WARNING] `spec/conventions/chat-channel-adapter.md §2.3` — `secretTokenRef` 필드 존재가 target 변경과 충돌

- **target 위치**: Plan §1 산출물 표 — `spec/conventions/chat-channel-adapter.md` §2.3 `secretTokenRef?` → `inboundSigningRef?` 변경
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/conventions/chat-channel-adapter.md` §2.3 ChatChannelConfig 코드블록 및 §6 보안 섹션 (현재 파일 라인 141~166, 258~260)
- **상세**: 현재 `chat-channel-adapter.md §2.3` 의 `ChatChannelConfig` 인터페이스에는 `secretTokenRef?: string` 이 있고, §6 보안 섹션에서 "`botTokenRef` / `secretTokenRef` 등 자격증명은 SecretResolver 가 관리" 라고 명시되어 있다. target plan 은 이 필드를 `inboundSigningRef?: string` 으로 rename 한다고 하나, 이와 함께 `SetupResult.issuedSecretToken` 주석 (`Telegram 만 발급` 의미) 및 `setupChannel` 코드 예시 (`§5.1 createTrigger`) 에서 `secretTokenRef` 에 대한 주석과 `TriggersService.setupChatChannel` 참조가 still 존재한다. target plan 의 산출물 목록에 `chat-channel-adapter.md` 의 `§2.4 SetupResult.issuedSecretToken` 주석 갱신이나 `§5.1 createTrigger` 예시 코드의 `secretTokenRef` → `inboundSigningRef` 갱신이 명시되지 않아, 실행 후 동일 파일 내 일부 섹션만 갱신되고 나머지가 구 이름을 유지할 수 있다.
- **제안**: target plan 의 Phase 2 체크리스트에 다음 항목 추가:
  - `chat-channel-adapter.md §2.4 SetupResult` 주석 (`issuedSecretToken` 의 "Telegram 만 발급" 설명 — `secretTokenRef` → `inboundSigningRef` 연동 반영)
  - `chat-channel-adapter.md §5.1` 코드 예시의 `secretTokenRef` → `inboundSigningRef` rename
  - `chat-channel-adapter.md §6 보안` 의 "`secretTokenRef` 등" 표현 → "`inboundSigningRef` 등" rename

---

### 2. [CRITICAL] `spec/5-system/15-chat-channel.md §4.1` — `secretTokenRef` 가 JSON 예시와 CCH-SE-03 요구사항 설명에 고정 명시

- **target 위치**: Plan §1 산출물 표 — `spec/5-system/15-chat-channel.md §4.1 config 예시 갱신`
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/5-system/15-chat-channel.md` §4.1 Trigger.config.chatChannel JSON 예시 (라인 156~181) 및 §3.4 CCH-SE-03 보안 요구사항 (라인 68)
- **상세**: §4.1 JSON 예시에 `"secretTokenRef": "secret://triggers/{triggerId}/webhook-secret"` 가 명시되어 있다. target plan 이 이 예시를 `inboundSigningRef` 로 갱신한다고 밝히고 있어 §4.1 은 처리 대상에 포함된다. 그러나 §3.4 CCH-SE-03 요구사항 본문에는 "ref 형식은 `secret://triggers/{triggerId}/{bot-token,webhook-secret}`" 라고 구체 이름이 inline 기술되어 있다 (라인 68). target plan 의 산출물 목록에는 CCH-SE-03 텍스트 갱신이 별도 항목으로 열거되지 않아, Phase 3 완료 후 §4.1 예시는 갱신되지만 §3.4 CCH-SE-03 본문이 구 이름(`webhook-secret`)을 유지하는 단일 문서 내 불일치가 발생할 수 있다. CCH-SE-03 은 보안 요구사항 ID 이므로 이 모순은 구현 단계에서 `secretTokenRef` 로 잘못 구현될 위험을 낳는다.
- **제안**: target plan Phase 3 체크리스트에 `spec/5-system/15-chat-channel.md §3.4 CCH-SE-03` 텍스트의 `webhook-secret` 참조 → `inbound-signing` 갱신 항목을 명시적으로 추가한다.

---

### 3. [WARNING] `spec/conventions/secret-store.md §1` 예시 표와 변경 후 SoT 기술 정합성

- **target 위치**: Plan §1 산출물 표 — `spec/conventions/secret-store.md §1 예시 표`
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/conventions/secret-store.md` §1 URI Scheme 예시 표 (라인 28~36) 및 §5.1 createTrigger 코드 예시 (라인 174~198)
- **상세**: 현재 `secret-store.md §1` 예시 표에는 `secret://triggers/{triggerId}/webhook-secret` 행만 있고 `slack-signing-secret`, `discord-public-key` 는 존재하지 않는다. target plan 은 3종 → `inbound-signing` 1행 통합을 기술하지만, 실제 현재 파일에는 Slack/Discord 관련 행이 없다. 이는 target plan 의 전제 ("3행 삭제 후 1행 추가") 가 현재 파일 상태와 맞지 않음을 의미한다 — 실제로는 1행(`webhook-secret`)을 삭제하고 1행(`inbound-signing`)을 추가하는 것으로 충분하다. 또한 §5.1 코드 예시의 `secretTokenRef` 참조는 §2.4 / §2.3 과 같은 이슈다.
- **제안**: target plan Phase 1 체크리스트의 "3행 삭제" 기술을 현재 파일 실제 상태 ("1행(`webhook-secret`) 삭제")로 수정한다. 또한 `secret-store.md §5.1` 코드 예시의 `secretTokenRef` 를 `inboundSigningRef` 로 업데이트하는 항목을 추가한다.

---

### 4. [CRITICAL] `spec/1-data-model.md §2.21.1` SecretStore 용도 목록이 이미 `inbound-signing` 기반으로 기술되어 있음 — target plan 과 충돌 없지만 target plan 의 "3종 통합" 기술이 현실과 불일치

- **target 위치**: Plan §1 산출물 표 — `spec/1-data-model.md §2.21.1 용도 목록 — 3종 통합`
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/1-data-model.md §2.21.1` 라인 1175~1181
- **상세**: 현재 `spec/1-data-model.md §2.21.1` 용도 목록을 확인하면, 이미 `secret://triggers/{id}/inbound-signing` 행이 있고 `webhook-secret` / `slack-signing-secret` / `discord-public-key` 행이 없다. 즉, 데이터 모델 spec 은 이미 target plan 의 목표 상태에 도달해 있다. target plan 이 이 파일을 "변경 필요" 산출물로 포함하는 것은 현재 상태와 충돌하지는 않지만, 실제로 "이미 갱신 완료" 상태에서 다시 갱신을 시도하면 의도치 않은 중복 편집이나 기존 기술과의 미묘한 드리프트가 발생할 수 있다.
- **제안**: Phase 3 착수 전 `spec/1-data-model.md §2.21.1` 현재 상태를 먼저 확인하고, 이미 `inbound-signing` 기반이라면 해당 항목은 skip 처리한다. target plan 의 체크리스트에 "현재 상태 확인 선행" 단계를 추가하는 것을 권장.

---

### 5. [WARNING] `spec/4-nodes/7-trigger/providers/telegram.md §3.1` — `setupChannel` 예시의 `secretToken` 변수명과 §6 `secretTokenRef` 표현

- **target 위치**: Plan §1 산출물 표 — `spec/4-nodes/7-trigger/providers/telegram.md §3.1 setupChannel 의 secretToken 변수 → inboundSigning 갱신, §6 보안 의 secretTokenRef 표현 → inboundSigningRef`
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/4-nodes/7-trigger/providers/telegram.md` §3.1 (라인 48~57: `"secret_token": "{randomly_generated}"` 주석, `config.chatChannel.secretToken 에 저장` 기술), §6 (라인 156~163)
- **상세**: telegram.md §3.1 의 주석에는 `config.chatChannel.secretToken 에 저장` 이라는 한국어 설명이 있다. target plan 은 이를 `inboundSigning` / `inboundSigningRef` 로 갱신하려 한다. 다만, Telegram 의 `setWebhook.secret_token` 파라미터 이름 자체(Telegram Bot API 공식 필드명 `secret_token`)는 변경 대상이 아니므로, 갱신 시 API 파라미터 이름(`secret_token`)과 우리 config 필드명(`inboundSigningRef`)의 매핑 관계를 명확히 구분해서 기술해야 한다. target plan 의 "secretToken 변수" 표현이 Telegram API 파라미터 이름인지 우리 config 필드인지 모호하게 기술되어 있어 편집 시 혼동 위험이 있다.
- **제안**: telegram.md 갱신 시 `secret_token` (Telegram Bot API 고유 파라미터명, 변경 없음) 과 `config.chatChannel.inboundSigningRef` (우리 config 필드, 이번에 rename) 를 명확히 구분하여 기술한다. Rationale R1 본문 갱신 시에도 두 개념의 분리를 유지.

---

### 6. [INFO] `spec/4-nodes/7-trigger/providers/slack.md` 및 `discord.md` 파일이 아직 존재하지 않음

- **target 위치**: Plan §1 산출물 표 — `spec/4-nodes/7-trigger/providers/slack.md §6`, `spec/4-nodes/7-trigger/providers/discord.md §6`
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/4-nodes/7-trigger/providers/` 디렉토리 (현재 `_overview.md` 와 `telegram.md` 만 존재)
- **상세**: target plan 은 Slack/Discord provider spec 파일들이 이미 존재한다고 전제하고 특정 섹션(`§6`)을 갱신하는 것으로 기술하고 있다. 그러나 현재 `spec/4-nodes/7-trigger/providers/` 디렉토리에는 `_overview.md` 와 `telegram.md` 만 존재하고 `slack.md`, `discord.md` 가 없다. target plan 이 속한 상위 작업 컨텍스트 (`plan/complete/spec-slack-discord-chat-channel.md`) 에서 이 파일들이 신설됐을 수 있으나, 현재 파일시스템 기준으로 대상 파일이 부재한 상태다.
- **제안**: target plan 착수 전 `slack.md`, `discord.md` 파일의 존재를 확인한다. 해당 파일이 없다면 갱신이 아닌 신설 방식으로 접근하거나, 선행 plan 의 완료 여부를 확인한다.

---

### 7. [INFO] Rationale 연속성 — 기존 `R1` (Telegram §3.1 Rationale) 이 `secretTokenRef` 개념을 전제로 기술

- **target 위치**: Plan §1 산출물 표 — `spec/4-nodes/7-trigger/providers/telegram.md §6 Rationale R1 본문 갱신`
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/4-nodes/7-trigger/providers/telegram.md` Rationale R1 (라인 188~195)
- **상세**: telegram.md 의 Rationale R1 은 `setWebhook secret_token 검증을 1차 인증으로 채택한 근거` 를 기술하고 있다. 내용상 `secretTokenRef` 라는 명칭을 직접 언급하지는 않으나, "텔레그램이 공식 지원하는 webhook 인증" 맥락은 Telegram 고유 메커니즘에 관한 것이다. target plan 이 `inboundSigningRef` 로 통합하면서 이 Rationale 에 "provider 별 의미 주석" (Telegram: server-issued shared secret, Slack: HMAC key, Discord: ed25519 public key)을 추가할 경우, Telegram provider spec 안에 다른 provider(Slack/Discord) 에 대한 의미 설명이 포함되어 책임 경계가 흐려질 수 있다. 다른 provider 의 의미 기술은 각 provider spec 파일에 두는 것이 더 적합하다.
- **제안**: `inbound-signing` 의 provider 별 의미 주석 위치를 검토: telegram.md Rationale 에는 Telegram 관련 의미만 기술하고, Slack/Discord 의 의미는 각 provider spec 에 두도록 경계를 명확히 한다. 공통 의미 표는 `chat-channel-adapter.md §2.3` 또는 `secret-store.md §1` 의 single source of truth 자리에 두는 것을 권장.

---

## 요약

target plan (`spec-chat-channel-inbound-signing-rename`) 은 전반적으로 단순한 naming 통합 작업으로, 기능·상태 전이·RBAC 모델에 대한 신규 개념이 없어 구조적 충돌 위험은 낮다. 그러나 변경 대상 spec 파일 수가 7개이고, 동일 파일 내에서 `secretTokenRef` 가 JSON 예시·요구사항 텍스트·코드 예시 등 여러 위치에 산재해 있어, target plan 의 산출물 목록이 모든 갱신 지점을 완전히 열거하지 않은 것이 CRITICAL 1건·WARNING 3건의 원인이다. 특히 `spec/5-system/15-chat-channel.md §3.4 CCH-SE-03` 요구사항 텍스트 내 `webhook-secret` 고정 기술과 `spec/conventions/chat-channel-adapter.md §6 보안` / `§5.1 코드 예시` 의 갱신 누락은 구현 단계에서 구 이름으로 잘못 구현되는 직접 위험을 낳는다. Slack/Discord provider spec 파일 부재 여부 확인도 선행 필요하다.

---

## 위험도

MEDIUM
