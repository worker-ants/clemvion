# 신규 식별자 충돌 검토 — Chat Channel 어댑터 + Telegram 첫 구현

검토 대상: `plan/in-progress/spec-draft-chat-channel.md`
검토 일시: 2026-05-21

---

## 발견사항

### 1. 요구사항 ID 충돌

**[INFO] CCH-* prefix — 기존 사용 없음, 신설 안전**

- target 신규 식별자: `CCH-AD-01~06`, `CCH-CV-01~05`, `CCH-MP-01~05`, `CCH-SE-01~04`, `CCH-NF-01~03`
- 기존 사용처: `spec/` 전체 grep 결과 `CCH-` prefix 는 어디에도 존재하지 않음
- 상세: 충돌 없음. EIA(`EIA-*`), WH(`WH-*`) prefix 와 namespace 완전 분리됨.

**[INFO] WH-MG-08 / WH-MG-09 — 기존 번호 공간 직후, 충돌 없음**

- target 신규 식별자: `WH-MG-08`, `WH-MG-09`
- 기존 사용처: `/spec/5-system/12-webhook.md` §3.4 — 현재 `WH-MG-07` 이 마지막 행
- 상세: 순차 부여 정책과 일치. 충돌 없음.

---

### 2. 엔티티/타입명 충돌

**[WARNING] `InteractionService.dispatchCommand` — 기존 `InteractionService` 가 다른 public API 를 이미 노출**

- target 신규 식별자: `InteractionService.dispatchCommand(executionId, command)` (§3.5 Identity/보안 본문)
- 기존 사용처: `codebase/backend/src/modules/external-interaction/interaction.service.ts` — 현재 public 메서드는 `interact()`, `cancel()`, `refreshToken()`, `getStatus()`. `dispatchCommand` 는 미존재.
- 상세: target draft 는 Chat Channel 어댑터가 `InteractionService.dispatchCommand` 를 in-process 호출한다고 서술하지만, 이 메서드는 현재 미구현된 이름이다. 기존 `InteractionService.interact()` 와 동일 역할로 보이나, 메서드 이름이 다르다. 구현 시 (a) `dispatchCommand` 를 신규 추가하거나 (b) 기존 `interact()` 를 재사용해야 하는데, target spec 은 이 결정을 모호하게 남긴다.
- 제안: target draft §3.5 를 `InteractionService.interact(executionId, command)` 또는 별도 facade 메서드명으로 구체화. 신규 메서드를 추가한다면 `spec/conventions/chat-channel-adapter.md` 에 in-process facade 의 정확한 signature 를 명시.

**[INFO] `ChannelUpdate`, `ChannelMessage`, `ChannelButton`, `KeyboardHint`, `SetupResult`, `SendResult`, `ChatChannelConfig`, `ChannelAdapterRegistry` — 기존 사용 없음**

- target 신규 식별자: `spec/conventions/chat-channel-adapter.md` 에 정의 예정
- 기존 사용처: `spec/` 및 `codebase/` 전체 grep 결과 해당 이름 없음
- 상세: 충돌 없음.

**[INFO] `EiaEvent` 타입명 — spec 에는 미정의, 구현에서 혼동 가능**

- target 신규 식별자: `renderNode(event: EiaEvent, ...)` 의 `EiaEvent`
- 기존 사용처: 코드베이스에 `EiaEvent` 타입 없음; EIA spec 에도 명시된 이름 아님
- 상세: EIA spec 은 이벤트를 `execution.waiting_for_input` 등 string type 과 payload shape 로 다루며 단일 union type 명을 정의하지 않음. `EiaEvent` 가 충돌은 아니나 구현 시 이름이 달라질 수 있어 spec 정합성 위험.
- 제안: `spec/conventions/chat-channel-adapter.md` 에 `EiaEvent` 의 union 타입을 명시적으로 정의하거나, EIA spec §6 payload 의 기존 shape 에서 도출하는 방식을 주석으로 설명.

---

### 3. API Endpoint 충돌

**[WARNING] `POST /api/triggers/:id/chat-channel/rotate-token` — 기존 trigger sub-route 패턴과 naming 불일치**

- target 신규 식별자: `CCH-SE-04` — `POST /api/triggers/:id/chat-channel/rotate-token`
- 기존 사용처:
  - `spec/5-system/14-external-interaction-api.md` §3.1 EIA-NX-12: `POST /api/triggers/:id/notification/rotate-secret`
  - `spec/5-system/14-external-interaction-api.md` §3.3 EIA-AU-07: `POST /api/triggers/:id/interaction/revoke-token`
- 상세: 기존 패턴은 `…/:id/notification/rotate-secret` (동사 `rotate-secret`). target 은 `…/:id/chat-channel/rotate-token` (동사 `rotate-token`). 동일 리소스 타입(token/secret rotation)에 대해 endpoint 동사가 `rotate-secret` vs `rotate-token` 으로 불일치. 기능적 충돌은 아니나 REST 표면 일관성이 깨짐.
- 제안: 기존 notification 패턴과 맞춰 `POST /api/triggers/:id/chat-channel/rotate-token` 을 `POST /api/triggers/:id/chat-channel/rotate-bot-token` 으로 명확화하거나, 또는 기존 `rotate-secret` 과 동일하게 `rotate-secret` 동사를 사용. 단, chatChannel 의 rotation 대상이 bot token 이므로 명확성을 위해 `rotate-bot-token` 이 더 적합.

**[INFO] 나머지 신규 API — 충돌 없음**

신규 API 는 기존 `POST /api/hooks/:endpointPath` 를 재사용하거나, 신규 경로를 추가하지 않는다(in-process facade). 충돌 없음.

---

### 4. 이벤트/메시지명 충돌

**[INFO] EIA 이벤트명 재사용 — 충돌 없음**

- target 신규 식별자: CCH-AD-05 에서 구독하는 이벤트: `execution.waiting_for_input`, `execution.ai_message`, `execution.completed`, `execution.failed`
- 기존 사용처: `spec/5-system/14-external-interaction-api.md` §3.1 EIA-NX-02 에 동일 이벤트 목록 정의됨
- 상세: 신규 이름이 아니라 기존 이벤트를 in-process subscriber 로 구독하는 구조. 충돌 없음.

---

### 5. 환경변수·설정키 충돌

**[WARNING] `config.chatChannel` 필드명 — 기존 `config.notification` / `config.interaction` 패턴과 대칭, 단 데이터 모델 spec 에 미등재**

- target 신규 식별자: `Trigger.config.chatChannel` (JSON 최상위 키)
- 기존 사용처:
  - `spec/5-system/12-webhook.md` §2.2 config 필드 구조: `authType`, `secret`, `bearerToken`, `hmacHeader`, `hmacAlgorithm`, `notification`, `interaction` 만 열거됨. `chatChannel` 은 미등재.
  - `spec/1-data-model.md` §2.8 Trigger 엔티티: `config` JSONB 설명에 "notification / interaction 서브 필드는 EIA §7.1 참조" 만 명시.
- 상세: target draft 의 §6.1 개정 내용이 12-webhook.md §2.2 에 `chatChannel` 행을 추가하도록 지시하므로 최종 spec 에는 반영되겠지만, 현재 `spec/1-data-model.md` §2.8 Trigger 항의 `config` 설명이 `chatChannel` 을 언급하지 않는다. 개정 대상에 1-data-model.md 가 포함되어 있지 않음.
- 제안: target draft §2.4 개정 항목에 `spec/1-data-model.md §2.8` Trigger 의 config 설명 업데이트를 추가. notification / interaction 처럼 "chatChannel 서브 필드는 Spec Chat Channel §3.4 참조" 한 줄 추가 필요.

**[WARNING] `chat_channel_health` 컬럼 — 값 enum(`unknown`/`healthy`/`degraded`)이 `notification_health` 와 동일하나 별도 컬럼 정의**

- target 신규 식별자: `chat_channel_health VARCHAR(16) NOT NULL DEFAULT 'unknown'`
- 기존 사용처: `spec/5-system/14-external-interaction-api.md` §7.1 — `notification_health VARCHAR(16) NOT NULL DEFAULT 'unknown'` (동일 enum 값)
- 상세: 기능적 충돌은 아니나, 동일한 `unknown|healthy|degraded` enum 을 두 컬럼에서 독립적으로 관리하는 구조. 향후 enum 확장(예: `paused`) 시 양쪽을 동시에 바꿔야 함. DB-level `CREATE TYPE trigger_channel_health AS ENUM(...)` 공용 type 정의를 검토할 여지가 있음.
- 제안: INFO 수준이나, `spec/5-system/15-chat-channel.md` 의 데이터 모델 섹션에 "notification_health 와 동일 enum 값 집합 — 향후 공용 DB 타입 도입 시 통합 검토" 주석 추가 권장.

**[INFO] `chat_channel_token_v2_ref` 컬럼 — `notification_secret_v2` 와 명명 패턴 불일치**

- target 신규 식별자: `chat_channel_token_v2_ref TEXT NULL`
- 기존 사용처: `spec/5-system/14-external-interaction-api.md` §7.1 — `notification_secret_v2 TEXT NULL` (grace 기간 신규 secret)
- 상세: 기존 패턴은 `notification_secret_v2` (접미사: `_v2`). target 은 `chat_channel_token_v2_ref` (접미사: `_v2_ref`). `_ref` suffix 추가 이유가 "secret reference 를 저장" 임을 반영하지만, 두 컬럼이 동일 목적(rotation grace period 값 보관)임에도 명명 규칙이 다름.
- 제안: `notification_secret_v2` 와 맞춰 `chat_channel_token_v2` 로 단순화하거나, 반대로 기존 컬럼도 `_ref` 접미사를 붙이는 방향으로 정책을 명시. 현재 혼용은 혼란을 줄 수 있음.

---

### 6. 파일 경로 충돌

**[INFO] `spec/5-system/15-chat-channel.md` — 번호 15 는 공백, 충돌 없음**

- target 신규 식별자: `spec/5-system/15-chat-channel.md`
- 기존 사용처: `spec/5-system/` 에 현재 1~14까지 존재 (`14-external-interaction-api.md` 가 마지막). 15 는 미사용.
- 상세: 충돌 없음.

**[INFO] `spec/conventions/chat-channel-adapter.md` — conventions 내 기존 패턴과 일치**

- target 신규 식별자: `spec/conventions/chat-channel-adapter.md`
- 기존 사용처: `spec/conventions/` 에 `conversation-thread.md`, `node-output.md`, `swagger.md`, `migrations.md`, `i18n-userguide.md`, `cafe24-api-metadata.md`, `cafe24-restricted-scopes.md` 존재. `chat-channel-adapter.md` 는 미존재.
- 상세: conventions 디렉토리 내 규약 문서 파일 패턴과 일치. 충돌 없음.

**[INFO] `spec/4-nodes/7-trigger/providers/telegram.md` — `providers/` 서브디렉토리 신설**

- target 신규 식별자: `spec/4-nodes/7-trigger/providers/telegram.md`
- 기존 사용처: `spec/4-nodes/7-trigger/` 내 현재 파일은 `0-common.md`, `1-manual-trigger.md`, `_product-overview.md` 뿐. `providers/` 서브디렉토리 없음.
- 상세: 서브디렉토리 신설. `spec/conventions/cafe24-api-catalog/` 의 선례와 동일 패턴. 충돌 없음.

---

## 요약

전체적으로 신규 식별자가 기존 사용처와 동일한 이름으로 다른 의미로 쓰이는 CRITICAL 충돌은 없다. 발견된 항목은 (1) `InteractionService.dispatchCommand` 라는 아직 존재하지 않는 메서드명을 spec 에서 참조하는 모호성 (WARNING), (2) bot token rotation endpoint 동사(`rotate-token`)가 기존 `notification/rotate-secret` 패턴과 불일치하는 표면 inconsistency (WARNING), (3) `spec/1-data-model.md` Trigger 항의 `config` 설명에 `chatChannel` 이 미등재된 누락 (WARNING), (4) `chat_channel_token_v2_ref` 컬럼 명명이 기존 `notification_secret_v2` 패턴과 다른 규칙 불일치 (INFO) 등이다. 모두 기능적 충돌보다는 명명 일관성 문제이며, spec 작성 단계에서 해결 가능한 수준이다.

---

## 위험도

MEDIUM
