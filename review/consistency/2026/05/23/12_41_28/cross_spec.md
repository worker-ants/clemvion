# Cross-Spec 일관성 검토 결과

대상 plan: `plan/in-progress/spec-telegram-chat-channel-ui-polish.md`
검토 시각: 2026-05-23
검토 모드: --spec (spec draft 검토)

---

## 발견사항

### [CRITICAL] 결정 3 — `visualNode` enum 변경이 `conventions/chat-channel-adapter.md` §2.3 과 직접 충돌

- **target 위치**: 결정 3 본문 — "기존 `text_only` 와 `photo` 의 2-enum 명세를 폐기하고 위 3-enum 으로 교체 — `text_only` → `text` 로 rename"
- **충돌 대상**: `spec/conventions/chat-channel-adapter.md` §2.3 `ChatChannelConfig` 타입 정의 (현재 `visualNode?: "photo" | "text_only"`)
- **상세**: 현재 `conventions/chat-channel-adapter.md` §2.3 의 `uiMapping.visualNode` 타입은 `"photo" | "text_only"` 2-enum 으로 정의되어 있다. Plan 결정 3 은 이를 `"text" | "photo" | "auto"` 3-enum 으로 변경하고 `text_only` → `text` rename 을 추가한다. 동시에 `spec/5-system/15-chat-channel.md` §4.1 의 config JSONB 예시도 현재 `"visualNode": "photo"` 로 기술되어 있으며 `text_only` 값이 별도 처리되고 있다. 두 spec 파일이 같은 enum 을 각자 정의하는 구조이므로, 한 파일만 갱신하고 다른 파일을 누락하면 어댑터 구현이 어느 SoT 를 따라야 하는지 불분명해진다. Plan 은 두 파일 동시 갱신을 명시하고 있으나("영향 spec 파일" 표에 두 파일 모두 기재), 실제 갱신 작업이 원자적으로 이루어지지 않으면 일시적 모순 상태가 발생한다. 또한 `spec/4-nodes/7-trigger/providers/telegram.md` §5.4 의 nodeType 별 v1/v2 매트릭스 표도 `text_only` 라는 용어를 암묵적으로 사용하는 기술이 남아 있어 rename 이후 동기화가 필요하다.
- **제안**: 결정 3 의 변경을 단일 PR 에서 다음 세 파일을 원자적으로 갱신하도록 명시적으로 규정할 것: `spec/conventions/chat-channel-adapter.md` §2.3, `spec/5-system/15-chat-channel.md` §4.1 + §3.3 CCH-MP-04, `spec/4-nodes/7-trigger/providers/telegram.md` §5.4. plan 본문의 "영향 spec 파일" 표에 세 파일이 모두 포함되어 있는지 확인 및 명시 필요. (현재 plan 은 telegram.md 를 "§5.4 cross-link" 수준으로만 기재 — 직접 enum 값 갱신이 아니라 오해 소지 있음.)

---

### [CRITICAL] 결정 4 — 비활성 트리거 200 OK 응답이 `spec/5-system/12-webhook.md` WH-EP-07 과 직접 모순

- **target 위치**: 결정 4 케이스 매트릭스 — "비활성 trigger | 200 | `{ ok: true }` | silent skip"
- **충돌 대상**: `spec/5-system/12-webhook.md` §3.1 WH-EP-07 — "비활성 트리거로의 요청은 `410 Gone` 응답 반환"
- **상세**: WH-EP-07 은 비활성 트리거에 대한 inbound 요청의 응답을 `410 Gone` 으로 명시한다. 결정 4 의 케이스 매트릭스는 `chatChannel` 이 설정된 트리거에 대해 "비활성 trigger" 를 `200 { ok: true }` silent skip 으로 처리한다고 기술한다. 이는 같은 Webhook 트리거 엔드포인트(`POST /api/hooks/:endpointPath`) 에 대한 두 개의 상충되는 HTTP 응답 정의다. 텔레그램 Bot API 의 재시도 폭주 방지 때문에 `chatChannel` 트리거가 비활성일 때도 200 으로 응답해야 하는 합리적 이유가 있지만, 그것이 기존 WH-EP-07 을 암묵적으로 override 하는 형태로 기술되어 있어 두 요구사항이 충돌 상태다. 일반 webhook 과 chat channel webhook 의 동작이 달라지는 것이 의도적이라면 WH-EP-07 에 chatChannel 예외 조항을 명시해야 한다.
- **제안**: `spec/5-system/12-webhook.md` WH-EP-07 을 다음과 같이 갱신하거나 주석을 추가할 것: "비활성 트리거로의 요청은 `410 Gone` 응답 반환. 단, `config.chatChannel` 이 설정된 트리거는 예외 — chat platform 의 retry 정책 보호를 위해 `200 OK + { ok: true }` 반환 (결정 상세는 [Spec Chat Channel §5.5](./15-chat-channel.md#55-inbound-http-contract))." 또는 결정 4 의 Rationale 에서 WH-EP-07 override 를 명시하고 `12-webhook.md` 동시 갱신을 "영향 spec 파일" 표에 추가할 것.

---

### [WARNING] 결정 2 — `hasBotToken` boolean 파생 필드가 데이터 모델 및 API convention spec 에 정의 없음

- **target 위치**: 결정 2 — "UI 는 ref 의 존재 여부를 별 boolean 필드 `chatChannel.hasBotToken: true` 로 알 수 있음"
- **충돌 대상**: `spec/1-data-model.md` §2.8 Trigger, `spec/5-system/15-chat-channel.md` §4.1, `spec/5-system/2-api-convention.md` (API 응답 파생 필드 패턴)
- **상세**: `hasBotToken` 는 `GET /api/triggers/:id` 응답에 포함될 새로운 파생(derived) 필드다. 현재 `spec/1-data-model.md` §2.8 Trigger 테이블 정의에도, `spec/5-system/15-chat-channel.md` §4.1 `config.chatChannel` 구조에도 이 필드가 없다. API 응답 전용 derived 필드 패턴은 기존 spec 에도 존재하며(`Integration.autoRefresh`, `Execution.dryRun`) 해당 필드들은 모두 명시적으로 "응답 DTO 전용 derived 필드" 로 데이터 모델 spec 에 별도 기재되어 있다. `hasBotToken` 는 그런 기재 없이 plan 본문에만 언급되어 있어 developer 가 구현 착수 시 spec 에서 찾을 수 없다.
- **제안**: `spec/5-system/15-chat-channel.md` §4.1 (또는 §5.4 Bot Token Rotation API 와 인접한 새 §5.4.1) 에 "응답 DTO 전용 derived 필드: `chatChannel.hasBotToken: boolean` — `botTokenRef` 가 secret store 에 존재하면 true, 없으면 false. `GET /api/triggers/:id` 응답에만 노출, DB 컬럼 아님" 형태로 명시 필요. "영향 spec 파일" 표에 해당 추가도 반영할 것.

---

### [WARNING] 결정 2 — `PATCH body 의 chatChannel.botTokenRef 변경 차단` 정책이 기존 PATCH 문서와 불일치

- **target 위치**: 결정 2 — "PATCH body 의 `config.chatChannel.botTokenRef` 변경은 차단 (400 `VALIDATION_ERROR`, `details.field='botTokenRef'`)"
- **충돌 대상**: `spec/2-navigation/2-trigger-list.md` §3 API 설명 — "PATCH /api/triggers/:id 본문: `config` (Deep merge — `config.authType` / `config.hmacHeader` 등 서브 키 단위 부분 갱신)"
- **상세**: 현재 `2-trigger-list.md` §3 의 PATCH 설명은 `config` 의 서브 키를 Deep merge 로 부분 갱신한다고 기술하지만, `chatChannel` 서브 필드에 대한 어떤 제약도 명시하지 않는다. 결정 2 는 `config.chatChannel.botTokenRef` 는 PATCH 로 변경 불가라고 정의한다. 이 정책이 어디에 기재되는지 불명확하다. 결정 1 에서 `2-trigger-list.md` §2.3.1 필드 권한 매트릭스에 `botToken` row 를 추가하면서 "결정 2 의 single-path 정책 인용" 이라고 하지만, 정책 본문이 어느 spec 에 canonical 하게 기재될지 명시되지 않았다.
- **제안**: `spec/5-system/15-chat-channel.md` §5.4 에 "PATCH /api/triggers/:id 를 통한 `config.chatChannel.botTokenRef` 직접 갱신 금지. 위반 시 400 `VALIDATION_ERROR` (`details.field='botTokenRef'`). 토큰 변경은 항상 `POST /api/triggers/:id/chat-channel/rotate-bot-token` 경로" 를 명시적으로 기재하고, `2-trigger-list.md` §3 의 PATCH 설명에 chatChannel 서브 필드 제약을 cross-link 로 추가할 것.

---

### [WARNING] 결정 3 — `auto` enum 의 v1 carousel 처리가 `spec/4-nodes/7-trigger/providers/telegram.md` §5.4 와 잠재 충돌

- **target 위치**: 결정 3 — "`auto`: 노드 종류별 휴리스틱 — `carousel` 의 카드에 `imageUrl` 이 있으면 photo 단위 분기"
- **충돌 대상**: `spec/4-nodes/7-trigger/providers/telegram.md` §5.4 — carousel v1 렌더: "각 카드 = (a) `imageUrl` 있으면 `sendPhoto`, (b) 없으면 `sendMessage`"
- **상세**: `telegram.md` §5.4 의 carousel v1 처리는 이미 카드 단위로 `imageUrl` 유무에 따라 `sendPhoto` / `sendMessage` 를 분기한다. 결정 3 의 `auto` 모드 설명("carousel 의 카드에 `imageUrl` 이 있으면 photo 단위 분기")은 이와 동일한 동작처럼 보이지만, `visualNode = "photo"` 와 `visualNode = "auto"` 가 carousel 에 대해 동일하게 동작하는지 다르게 동작하는지 불명확하다. 특히 v1 에서 `photo` 를 선택하면 "fallback to text + warning 로그" 라고 했는데, `auto` 의 carousel은 이미 `sendPhoto` 를 하고 있으므로 `photo` 와 `auto` 가 carousel 에서 다른 결과를 낳는 상황이 생긴다. 또한 결정 3 의 "chart / table → 항상 text (v1, v2 에서도 text 가 더 가독)" 는 `telegram.md` §5.4 의 v2 에서 "chart → satori SVG PNG `sendPhoto`", "table → 표 PNG `sendPhoto`" 라는 내용과 충돌할 수 있다 — 결정 3 이 v2 에서도 chart/table 을 text 로 유지한다는 뜻이라면 별 plan `chat-channel-visual-ssr-png` 의 scope 와 충돌한다.
- **제안**: 결정 3 에 carousel / chart / table 각각에 대해 `text` / `photo` / `auto` 세 enum 값의 v1/v2 동작을 완전한 3×N 매트릭스로 명시할 것. 특히 `auto` + carousel (v1) = 기존 §5.4 동작 그대로임을 명확화. chart / table 에 대한 `auto` v2 처리 방침도 별 plan 과의 scope 경계를 명시할 것.

---

### [WARNING] 결정 1 — `chatChannelHealth` / `chatChannelLastError` 등 필드명이 데이터 모델 컬럼명과 미일치

- **target 위치**: 결정 1 §2.3.1 필드 권한 매트릭스 — "`chatChannelHealth` / `chatChannelLastError` / `chatChannelSetupAt` / `chatChannelRotatedAt` (read-only, 시스템 계산)"
- **충돌 대상**: `spec/1-data-model.md` §2.8 Trigger 테이블 — `chat_channel_health`, `chat_channel_last_error`, `chat_channel_setup_at`, `chat_channel_rotated_at` (snake_case)
- **상세**: plan 의 결정 1 은 UI 매트릭스에서 camelCase 형식(`chatChannelHealth`)으로 필드를 기재하는데, 이것이 DB 컬럼명(snake_case)인지 API 응답 DTO 필드명(camelCase)인지 불명확하다. 기존 spec 들은 "DB 컬럼: snake_case, API 응답: camelCase" 원칙을 따르고 있으므로 UI 매트릭스는 API 응답 기준(camelCase)으로 이해하면 되지만, 동일 매트릭스의 다른 row(`botTokenRef`)와 혼재되어 혼동 가능성이 있다. `2-trigger-list.md` §2.3.1 의 기존 매트릭스는 `endpointPath`, `hmacHeader`, `isActive` 등 camelCase 로 일관되므로 이 자체는 큰 문제가 아니나, `chatChannelLastError` vs DB 의 `chat_channel_last_error` 이름이 매트릭스 내 다른 필드보다 이름이 더 길어 `chatChannelLastError` / `chatChannelSetupAt` / `chatChannelRotatedAt` 를 API 응답에서 어떻게 노출할지(`lastError`, `setupAt`, `rotatedAt` prefix 단축 고려 여부) 명시가 없다.
- **제안**: `2-trigger-list.md` §2.3.1 에 추가되는 chatChannel 필드 row 의 필드명을 API 응답 DTO 기준 camelCase 임을 명확히 하고, `spec/5-system/15-chat-channel.md` 의 신설 §5.5 Inbound HTTP Contract 또는 기존 §4.1 에 `GET /api/triggers/:id` 응답 상의 chatChannel 파생 필드 이름을 canonical 하게 정의할 것.

---

### [INFO] 결정 4 — 404 응답 케이스가 WH-RS-02 와는 일치하나 chatChannel 전용 예외임을 명시 필요

- **target 위치**: 결정 4 케이스 매트릭스 — "트리거 미존재 (잘못된 endpointPath) | 404 | error envelope"
- **충돌 대상**: `spec/5-system/12-webhook.md` WH-RS-02 — "잘못된 경로의 요청은 `404 Not Found` 반환"
- **상세**: 이 케이스는 기존 WH-RS-02 와 일치한다. 충돌은 아니나, 결정 4 가 chatChannel 전용 Inbound HTTP Contract 를 신설하는 문서(`§5.5`)에서 "404 는 일반 webhook 과 동일하게 유지" 임을 명시하면 독자가 기존 spec 과 연결하기 쉽다. 현재 plan 에는 WH-RS-02 와의 관계를 설명하는 cross-link 가 없다.
- **제안**: 신설 §5.5 의 404 케이스 Rationale 에 "WH-RS-02 와 동일 정책 유지" cross-link 추가.

---

### [INFO] 결정 3 — `text_only` → `text` rename 이 기존 운영 중인 DB 데이터와의 하위호환성 고려 없음

- **target 위치**: 결정 3 — "`text_only` → `text` 로 rename (영문 일관성)"
- **충돌 대상**: `spec/5-system/15-chat-channel.md` §4.1 config JSONB 예시, `spec/conventions/chat-channel-adapter.md` §2.3
- **상세**: 현재 Phase 1/2 (PR #261) 에서 이미 chatChannel 기능이 배포되어 있다면, 기존 운영 DB 의 `Trigger.config.chatChannel.uiMapping.visualNode` 에 `"text_only"` 값이 저장된 row 가 있을 수 있다. plan 은 rename 후 마이그레이션 전략을 언급하지 않는다. 단순 spec 변경이라면 코드에서 읽을 때 `"text_only"` → `"text"` fallback 처리가 필요하고 이것이 developer plan 의 몫인지 명확히 해야 한다.
- **제안**: Rationale 에 "rename 은 spec 레벨 변경. 코드 레벨에서 `text_only` legacy 값 fallback 처리는 후속 developer plan 책임" 을 명시하거나, 아직 `text_only` 값이 운영 DB 에 저장된 적이 없으면 그 사실을 명시해 하위호환 이슈가 없음을 확인할 것.

---

### [INFO] `notificationHealth` 와 `chatChannelHealth` 의 동일 enum 을 plan 이 재확인하나 DB 타입 통합은 여전히 미결

- **target 위치**: 결정 1 §2.3.1 행 추가 — `chatChannelHealth` 배지를 `notificationHealth` 와 같은 영역에 나란히
- **충돌 대상**: `spec/1-data-model.md` §2.8 Trigger 테이블 `chat_channel_health` 컬럼 비고 — "향후 공용 DB 타입 통합 검토"
- **상세**: 이미 기존 spec 에서 "향후 공용 DB 타입 통합 검토 대상" 으로 기재된 미결 사항이다. 본 plan 이 UI 매트릭스에서 두 배지를 나란히 두는 결정을 내리므로, 이 "공용 타입 통합" 검토 시점이 언제가 될지 더 명확한 트리거 조건이 필요하다. 현재로서는 충돌이 아닌 INFO 수준.
- **제안**: 본 plan 범위 밖이지만, 관련 backlog plan 에 이 미결 사항을 tracking 항목으로 추가하거나 `spec/1-data-model.md` §2.8 의 기존 비고를 "공용 DB 타입 통합은 chatChannel UI 완성 후 검토" 정도로 갱신 고려.

---

## 요약

Cross-Spec 일관성 관점에서 target plan 은 2건의 CRITICAL 충돌을 포함한다. 첫째, 결정 3 의 `visualNode` enum 3종 변경은 `spec/conventions/chat-channel-adapter.md` §2.3 의 현행 2-enum 정의와 직접 모순되며, plan 이 두 파일 동시 갱신을 명시하고 있지만 원자성 보장 방식이 불충분하다. 둘째(더 중요), 결정 4 의 비활성 트리거에 대한 `200 OK` silent skip 정책은 `spec/5-system/12-webhook.md` WH-EP-07 의 `410 Gone` 규정과 직접 충돌한다. WH-EP-07 에 `chatChannel` 예외 조항을 명시하거나 12-webhook.md 를 "영향 spec 파일" 표에 추가해야 한다. WARNING 4건은 `hasBotToken` 파생 필드의 미정의, PATCH 차단 정책 미기재, `auto` 모드 v1 carousel 동작 모호성, 필드명 mapping 불명확성이며 developer plan 착수 전에 해소가 권장된다.

---

## 위험도

HIGH
