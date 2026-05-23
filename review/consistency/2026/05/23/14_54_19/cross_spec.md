# Cross-Spec 일관성 검토 결과

**대상**: `spec/5-system/15-chat-channel.md`
**모드**: 구현 착수 전 검토 (`--impl-prep`)
**검토일**: 2026-05-23

---

## 발견사항

### [INFO] `Trigger.config` 설명 내 `chatChannel` cross-link 참조 형식 비대칭

- **target 위치**: `spec/5-system/15-chat-channel.md §4.2` — "본 spec 과 spec/1-data-model.md 가 한 PR 에 묶임"
- **충돌 대상**: `spec/1-data-model.md §2.8` Trigger 표의 `config` 컬럼 설명
- **상세**: `spec/1-data-model.md §2.8` 의 `config` JSONB 설명에는 이미 `chatChannel` 서브 필드에 대한 cross-link 가 `[Spec Chat Channel §4.1](./5-system/15-chat-channel.md#41-triggerconfigchatchannel)` 형태로 삽입되어 있고, `hasBotToken` derived 필드도 `[Spec Chat Channel §5.4.2](./5-system/15-chat-channel.md#542-응답-dto-derived-필드--hasbottoken)` 으로 교차 참조된다. 단일-진실 원칙 관점에서는 두 문서가 동일 Trigger 엔티티를 두 곳에서 기술하는 게 아니라 data-model 이 필드 목록 SoT, 15-chat-channel 이 동작 SoT 로 명확히 분리되어 있어 실제 충돌은 없다. 다만 §4.2 의 "본 spec 과 spec/1-data-model.md 가 한 PR 에 묶임" 문구가 이미 병합된 PR 의 메모처럼 읽혀 구현자가 "아직 data-model 이 미갱신인가" 혼동할 수 있음.
- **제안**: §4.2 의 해당 문구를 "Trigger 테이블 정의는 [Spec 데이터 모델 §2.8](../1-data-model.md#28-trigger) 과 동기화 완료" 로 교체해 현재 상태를 명확히 표현.

---

### [INFO] `SecretStore` 용도 목록 — `spec/1-data-model.md §2.21.1` vs `spec/conventions/secret-store.md §1`

- **target 위치**: `spec/5-system/15-chat-channel.md §4.1` / `§3.4 CCH-SE-03`
- **충돌 대상**: `spec/1-data-model.md §2.21.1` 용도 목록, `spec/conventions/secret-store.md §1` URI 예시
- **상세**: 세 파일 모두 동일한 ref 목록 5개 (`bot-token`, `bot-token.v2`, `webhook-secret`, `notification-signing`, `notification-signing.v2`) 를 기술한다. 내용 자체는 일치하나 목록이 세 곳에 중복되어 있어 신규 ref 추가 시 누락 위험이 있다. 현재 시점에서는 모순 없음.
- **제안**: `spec/conventions/secret-store.md §1` 의 표를 단일 진실 SoT 로 지정하고, `spec/1-data-model.md §2.21.1` 용도 목록은 `(SoT → secret-store.md §1 참조)` 한 줄 cross-link 로 경량화를 검토. target 문서에서는 별도 변경 불필요.

---

### [INFO] `WH-EP-07` 예외 조항 기술 위치 비대칭

- **target 위치**: `spec/5-system/15-chat-channel.md §5.5` (Inbound HTTP Contract, 비활성 트리거 행)
- **충돌 대상**: `spec/5-system/12-webhook.md §3.1 WH-EP-07`
- **상세**: `12-webhook.md WH-EP-07` 이 이미 `config.chatChannel` 설정 트리거에 대해 `202 Accepted + { ignored: true }` 를 명시하고 `[Spec Chat Channel §5.5]` cross-link 를 삽입하고 있어 두 문서가 정합하게 교차 참조한다. 동일 규칙을 두 spec 이 모두 기술하는 패턴이나, 한쪽이 SoT 이고 다른 쪽이 cross-link 참조이므로 "충돌" 이 아닌 "정상 분산 기술". 현재 기술 방향(webhook.md 가 원칙, chat-channel.md 가 상세 계약) 은 올바르다.
- **제안**: 현행 유지. 다만 구현자에게 "WH-EP-07 이 예외 정의, §5.5 가 케이스 매트릭스 SoT" 임을 명확히 주석으로 표현하는 것도 고려할 수 있음 (강제는 아님).

---

### [INFO] `NotificationDispatcher` 명칭 vs `ChatChannelDispatcher` 혼용

- **target 위치**: `spec/5-system/15-chat-channel.md §3.2`, `§7` (구현 파일 구조 `chat-channel.dispatcher.ts`), `§Rationale R8`
- **충돌 대상**: `spec/5-system/14-external-interaction-api.md §R10` (단일 sink 정책)
- **상세**: target 본문에서는 `NotificationDispatcher` 와 `ChatChannelDispatcher` 두 이름이 혼용된다. §3.2·§R4 는 `NotificationDispatcher` 의 in-process EventEmitter 에 attach 한다고 기술하고, 구현 파일 구조(§7) 는 `chat-channel.dispatcher.ts` 를 별도 파일로 나열하며, R8 은 v1 에서는 `ChatChannelDispatcher` 가 `WebsocketService.executionEvents$` 를 subscribe 한다고 기술한다. 이 세 설명이 동일 컴포넌트의 v1 구조를 다른 이름으로 지칭하고 있어 구현자가 클래스 이름을 무엇으로 써야 하는지 혼동 가능.
- **제안**: §7 구현 파일 구조의 `chat-channel.dispatcher.ts` 주석에 "= v1 의 ChatChannelDispatcher. NotificationDispatcher 의 EventEmitter 를 subscribe 하는 fan-out 전담 컴포넌트" 를 한 줄 추가해 이름과 역할을 일치시킴.

---

### [INFO] `parseUpdate` null 반환 시 안내 메시지 발송 책임 — target vs convention 미세 불일치

- **target 위치**: `spec/5-system/15-chat-channel.md §3.3 CCH-CV-05` — "group/supergroup/channel update 는 어댑터가 거부 (`languageHints.groupChatRefusal` 안내 후 무시)"
- **충돌 대상**: `spec/conventions/chat-channel-adapter.md §1.1` parseUpdate 행 — "`null` 의 의미는 '어댑터가 해석 불가/무시' 단일 의미. 호출자(`HooksService`) 가 raw body 에서 provider-specific 메타를 확인해 안내 메시지 발송 여부를 결정한다 (어댑터는 side-effect free 유지). 안내 발송 책임 = 호출자"
- **상세**: CCH-CV-05 는 "어댑터가 거부 ... 안내" 라고 기술하여 어댑터가 안내를 발송하는 것처럼 읽히나, convention 의 parseUpdate 명세는 side-effect free + 안내 발송 책임이 호출자(HooksService) 에 있음을 명확히 한다. `providers/telegram.md §4` 도 "호출자(`HooksService`) 가 `chat.type !== 'private'` 분기에서 `languageHints.groupChatRefusal` 안내 `sendMessage` 별 호출" 로 규정해 convention 과 일치한다. CCH-CV-05 의 "어댑터가 거부" 문구가 모호해 구현자가 어댑터 안에 `sendMessage` 를 직접 넣는 오류를 범할 수 있다.
- **제안**: CCH-CV-05 를 "group/supergroup/channel update 도착 시 `parseUpdate` 가 `null` 반환 → `HooksService` 가 `languageHints.groupChatRefusal` 안내를 `sendMessage` 로 발송 후 무시" 로 재기술. convention 과 telegram.md 와 일치하게 됨.

---

### [INFO] `CCH-AD-04` 처리 흐름 설명과 §3.1 시퀀스 다이어그램의 순서 미세 불일치

- **target 위치**: `spec/5-system/15-chat-channel.md §3.1` CCH-AD-04 (`parseUpdate 50ms + 트리거 조회 + 202 Accepted 반환 의 순서`), 시퀀스 다이어그램
- **충돌 대상**: 동 문서 내 일관성 문제 (내부 불일치)
- **상세**: CCH-AD-04 는 "parseUpdate 50ms + 트리거 조회 + 202 Accepted 반환 의 순서" 로 기술하나, 일반적 webhook 처리는 "트리거 조회 먼저 → 인증·검증 → parseUpdate" 순서로 작동하고, §3.1 시퀀스 다이어그램도 `HooksController.handle()` → `config.chatChannel ? yes` → `TelegramAdapter.parseUpdate(raw)` 로 그려져 있어 트리거 조회(및 config 확인)이 parseUpdate 보다 앞에 있음을 내포한다. "트리거 조회 + parseUpdate + 202 Accepted 반환" 의 순서 기술이 의도와 다를 수 있음.
- **제안**: CCH-AD-04 의 순서 기술을 "트리거 조회 → `config.chatChannel` 분기 확인 → `parseUpdate(raw)` (50ms CCH-NF-01) → `202 Accepted` 반환" 으로 시퀀스 다이어그램과 일치하도록 수정.

---

### [INFO] `§5.5` 비활성 트리거 응답 테이블의 `WH-EP-07 의 예외` 주석과 `R-CC-12` 일부 불일치

- **target 위치**: `spec/5-system/15-chat-channel.md §5.5` 비활성 trigger 케이스 행 — "`WH-EP-07 의 예외`"
- **충돌 대상**: 동 문서 `R-CC-12` Rationale
- **상세**: §5.5 케이스 매트릭스에서 "비활성 trigger (chatChannel 경로)" 케이스는 `WH-EP-07 의 예외` 라고 설명하는데, R-CC-12 (c) 는 "chatChannel 미사용 webhook 트리거는 여전히 410 Gone" 을 WH-EP-07 의 일반 정책 유지로 설명한다. 즉 §5.5 의 `예외` 표현은 정확하지만 "예외가 언제 적용되는지" 에 대한 scope 설명이 §5.5 케이스 행에만 있고, 독자가 WH-EP-07 본문을 읽지 않으면 예외의 조건을 이해하기 어렵다. 실질적 모순은 없으나 가독성 문제.
- **제안**: 케이스 행 비고 컬럼에 "일반 webhook 경로는 여전히 410" 문구를 한 줄 추가해 대비를 명확히.

---

## 요약

`spec/5-system/15-chat-channel.md` 는 `spec/1-data-model.md`, `spec/5-system/12-webhook.md`, `spec/5-system/14-external-interaction-api.md`, `spec/conventions/chat-channel-adapter.md`, `spec/4-nodes/7-trigger/providers/telegram.md`, `spec/conventions/secret-store.md`, `spec/2-navigation/2-trigger-list.md` 와 데이터 모델·API 계약·요구사항 ID·상태 전이·권한 모델·계층 책임 6개 관점에서 전반적으로 정합하게 작성되어 있다. `CRITICAL` 및 `WARNING` 등급의 직접 모순은 발견되지 않는다. 모든 발견사항은 `INFO` 수준으로, (1) `CCH-CV-05` 의 안내 발송 책임 주체 모호성(어댑터 vs HooksService)이 가장 실질적인 구현 혼동 위험이며 convention 과 telegram.md 를 참조해 즉시 수정 가능하고, (2) `ChatChannelDispatcher` / `NotificationDispatcher` 명칭 혼용은 §7 주석 보완으로 해소 가능하며, 나머지는 문구 명확화 수준이다.

---

## 위험도

LOW
