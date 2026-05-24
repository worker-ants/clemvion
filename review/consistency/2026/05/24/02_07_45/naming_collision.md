# 신규 식별자 충돌 검토 결과

검토 대상: `plan/in-progress/spec-slack-discord-chat-channel.md`  
검토 일시: 2026-05-24  
검토 범위: spec/, plan/in-progress/, conventions/

---

## 발견사항

### 1. 요구사항 ID 충돌

발견 없음. target plan 은 새 요구사항 ID 를 별도로 부여하지 않는다. 기존 `CCH-*` / `EIA-*` / `SS-*` 식별자를 참조만 하고 새 series 를 도입하지 않는다.

---

### 2. 엔티티/타입명 충돌

**[INFO]** `signingSecretRef` / `publicKeyRef` 필드 추가 — 기존 필드 이름과 무충돌 확인

- target 신규 식별자: `ChatChannelConfig.signingSecretRef` (Slack), `ChatChannelConfig.publicKeyRef` (Discord)
- 기존 사용처: `spec/conventions/chat-channel-adapter.md §2.3` 에 기존 optional 필드 `secretTokenRef?` (Telegram 전용) 존재
- 상세: `secretTokenRef` (Telegram server-issued), `signingSecretRef` (Slack provider-issued), `publicKeyRef` (Discord ed25519 public key) 세 필드 모두 의미가 서로 다르며 spec 본문(`chat-channel-adapter.md` 2026-05-24 changelog) 에 이미 추가 완료됨. 이름 충돌 없음.
- 제안: 현 상태 유지.

**[INFO]** `botIdentity` 확장 — `teamId` 필드 추가 (Slack 전용)

- target 신규 식별자: `botIdentity.teamId` (Slack `setupChannel` 응답)
- 기존 사용처: `spec/conventions/chat-channel-adapter.md §2.4 SetupResult` 의 `identity?: Record<string, unknown>` — open type 이므로 충돌 없음. Telegram 은 `botId` / `username` 만 캐시.
- 상세: `Record<string, unknown>` 으로 열려 있으므로 Slack 이 `teamId` 를 추가해도 기존 Telegram 경로에 영향 없음.
- 제안: 현 상태 유지.

---

### 3. API Endpoint 충돌

발견 없음. target 은 새 API endpoint 를 정의하지 않는다. 기존 [Spec Chat Channel §5.5 Inbound HTTP Contract](../../../spec/5-system/15-chat-channel.md#55-inbound-http-contract) 의 `POST /api/hooks/:endpointPath` 단일 진입점을 그대로 공유하며 provider 분기는 어댑터 계층이 담당한다. Bot token rotation API (`POST /api/triggers/:id/chat-channel/rotate-bot-token`) 도 기존 엔드포인트를 공유.

---

### 4. 이벤트/메시지명 충돌

발견 없음. target 이 새로 정의하는 Slack / Discord provider 의 내부 이벤트 이름 (`block_actions`, `view_submission`, `event_callback`, `MODAL_SUBMIT`, `MESSAGE_COMPONENT` 등) 은 외부 플랫폼 고유 이름이며, 시스템 내부 WebSocket / SSE / BullMQ 이벤트 이름과 직교한다. 시스템 내부 이벤트 (`execution.ai_message`, `execution.waiting_for_input` 등) 에 대한 변경은 없다.

---

### 5. 환경변수·설정키 충돌

**[INFO]** secret ref 이름 2종 신규 도입 — 기존 `name` 네임스페이스와 무충돌 확인

- target 신규 식별자:
  - `secret://triggers/{triggerId}/slack-signing-secret`
  - `secret://triggers/{triggerId}/discord-public-key`
- 기존 사용처: `spec/conventions/secret-store.md §1` 예시 표:
  - `bot-token`, `bot-token.v2`, `webhook-secret`, `notification-signing`, `notification-signing.v2`
- 상세: `slack-signing-secret` 과 `discord-public-key` 는 기존 5종 `name` 값과 겹치지 않음. `secret-store.md` changelog (2026-05-24) 에 이미 두 ref 가 예시 표에 추가 완료됨. URI scheme 자체 변경 없음.
- 제안: 현 상태 유지.

**[INFO]** 환경변수 신규 도입 없음

target 은 새 ENV var 를 정의하지 않는다. Slack / Discord 자격증명은 모두 `secret://` URI + `ENCRYPTION_KEY` 마스터키 재사용 경로를 따른다.

---

### 6. 파일 경로 충돌

**[INFO]** 신규 spec 파일 경로 — 컨벤션 준수, 기존 파일과 비충돌 확인

- target 신규 파일:
  - `spec/4-nodes/7-trigger/providers/slack.md`
  - `spec/4-nodes/7-trigger/providers/discord.md`
- 기존 파일 구조: 동일 디렉토리에 `telegram.md`, `_overview.md` 존재
- 상세: 파일명 `slack.md` / `discord.md` 는 기존 파일과 겹치지 않으며, provider 식별자 컨벤션 (lower-case, kebab-case, 브랜드명) 을 준수한다 (`_overview.md §3 provider 식별자 컨벤션` 확인). 두 파일 모두 이미 실제 생성됨 (`ls` 확인).
- 제안: 현 상태 유지.

**[INFO]** `_overview.md` 내 상태 컬럼 신설 — 기존 카탈로그 패턴과 정합

- target 이 도입하는 `§2 Spec-defined / impl-pending` 섹션은 `spec/conventions/cafe24-api-catalog/_overview.md` 의 `status` enum 패턴과 동일 구조. `spec-only` frontmatter 컨벤션 (`spec-impl-evidence.md` §2) 과도 의미 정렬됨.
- 충돌 없음. `_overview.md` 에 이미 반영 완료.

---

### 7. i18n 키 prefix 충돌 — 구체 검토

**[WARNING]** plan 본문에 언급된 `triggers.chatChannel.slack.*` / `triggers.chatChannel.discord.*` i18n 키 prefix 는 미정의 상태

- target plan §Phase 5 의 `naming-collision-checker` 점검 항목으로 `triggers.chatChannel.slack.*` / `triggers.chatChannel.discord.*` 를 명시
- 기존 사용처: `codebase/frontend/src/lib/i18n/dict/ko/triggers.ts` 의 `chatChannel` 오브젝트에는 provider-neutral 키들 (`section`, `botToken`, `providerTelegram`, 등) 이 정의됨. Slack / Discord 전용 키는 아직 없음.
- 상세: target plan 은 spec 단계만 책임지며 i18n 키 도입은 후속 impl plan (`chat-channel-slack-impl` / `chat-channel-discord-impl`) 이 담당한다. 따라서 현 시점에서 충돌은 없지만, impl plan 작성 시 `providerTelegram` 과 동일 패턴으로 `providerSlack` / `providerDiscord` 키를 추가하면 된다. 단, 이 키들이 아직 정의되지 않았으므로 spec 문서 내 i18n 키 prefix 언급이 미래 작업 범위임을 명확히 할 필요가 있다.
- 제안: INFO 수준. 현 spec plan 에서 i18n 키 prefix 를 언급하는 것은 impl plan 에 대한 가이드 용도이므로 충돌 없음. impl plan 진입 시 `providerSlack` / `providerDiscord` 키를 `triggers.chatChannel.*` 하위에 추가하면 됨.

---

### 8. provider 식별자 — 코드베이스 선점 사용 확인

**[INFO]** `"slack"` provider 식별자는 test code 에서 이미 예상 사용 중 — spec 신설과 정합

- target 신규 식별자: `provider: "slack"`, `provider: "discord"`
- 기존 사용처:
  - `codebase/backend/src/modules/chat-channel/chat-channel-inbound-authenticator.spec.ts:94` — `provider: 'slack'` 로 비-Telegram provider 를 mock 테스트
  - `codebase/backend/src/modules/chat-channel/channel-adapter.registry.spec.ts:56,73` — `'slack'` 을 registry 에 미등록 / 등록 케이스로 사용
- 상세: 코드베이스 테스트 파일이 이미 `"slack"` 을 provider 식별자로 사용하고 있어 spec 에서 `provider: "slack"` 을 정의하는 것과 의미가 일치한다. 충돌이 아니라 spec 이 코드보다 늦게 형식화되는 정상 패턴.
- 제안: 현 상태 유지. spec 이 구체 어댑터 구현의 ground truth 가 됨.

---

## 요약

target (`spec-slack-discord-chat-channel` plan) 이 도입하는 신규 식별자 — `provider: "slack"` / `provider: "discord"`, secret ref `slack-signing-secret` / `discord-public-key`, `ChatChannelConfig` 의 `signingSecretRef` / `publicKeyRef` optional 필드, spec 파일 `slack.md` / `discord.md` — 는 기존 spec·conventions·codebase 의 어떤 식별자와도 의미 충돌 없이 정합한다. 코드베이스 test code 에서 `"slack"` 이 이미 non-Telegram provider mock 으로 선점되어 있지만 이는 spec 과 동일 의도이므로 충돌이 아니다. i18n 키 prefix (`triggers.chatChannel.slack.*` / `triggers.chatChannel.discord.*`) 는 impl plan 에서 도입할 미래 작업이며 현재 미정의 상태이므로 spec 단계에서는 충돌 없음. secret store URI scheme 자체 변경 없이 `name` 토큰만 2종 추가되어 기존 5종 name 과 전혀 겹치지 않는다. 파일 경로도 기존 컨벤션 (`lower-case`, `kebab-case`, 브랜드명) 을 준수하고 기존 파일과 비충돌한다.

---

## 위험도

NONE

---

STATUS: OK
