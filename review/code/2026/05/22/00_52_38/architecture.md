# 아키텍처(Architecture) 리뷰

검토 대상: Chat Channel Telegram 통합 — spec 및 plan 변경 (35개 파일)
검토 일자: 2026-05-22

---

## 발견사항

### [INFO] 전체 아키텍처 — EIA Consumer 격리 패턴
- 위치: `spec/5-system/15-chat-channel.md §1`, `spec/conventions/chat-channel-adapter.md §1`
- 상세: Chat Channel 을 "새 트리거 유형 추가"가 아닌 "Webhook 트리거의 `config.chatChannel` 갈래"로 배치한 결정은 확장성 관점에서 올바른 선택이다. 트리거 유형 카탈로그(Manual / Webhook / Schedule)를 건드리지 않고 기존 Webhook 진입점(`POST /api/hooks/:endpointPath`)의 분기만 추가한다. 신규 레이어를 최소 표면으로 도입한 점은 아키텍처 부채를 최소화하는 방향이다.

---

### [WARNING] CCH-AD-05 — NotificationDispatcher 의 두 역할 (fan-out + EventEmitter 노출) 이 단일 책임 경계를 긴장시킴
- 위치: `spec/5-system/15-chat-channel.md §3.1~§3.2`, `spec/5-system/14-external-interaction-api.md §R10 추가 단락`
- 상세: 현행 설계에서 `NotificationDispatcher` 는 세 가지 출력 갈래를 동시에 책임진다: (a) 외부 HTTP POST (notification webhook), (b) Redis pub/sub 발행 (SSE 어댑터용), (c) in-process EventEmitter emit (Chat Channel 어댑터용). 처음 두 갈래는 기존 설계의 결과이지만, (c)를 추가하면서 `NotificationDispatcher` 가 "외부 채널에 통지하는 single sink" 역할을 넘어 "in-process listener bus"의 역할도 겸하게 된다. 이는 단일 책임 원칙(SRP) 관점에서 책임이 혼합되는 시작점이다. 향후 네 번째 어댑터(Slack, 카카오 등)가 추가될 때마다 `NotificationDispatcher` 의 fan-out 분기가 늘어나는 구조가 된다.
- 제안: 단기적으로는 허용 가능한 설계이나, provider 가 2개 이상이 되면 `ChannelDispatcher` (EventEmitter를 전담하는 in-process bus) 를 `NotificationDispatcher` 와 분리하는 리팩토링을 검토할 것. `spec/5-system/15-chat-channel.md §11 후속 plan` 에 "provider 2개 추가 시 ChannelDispatcher 분리" 를 기술해두는 것을 권장.

---

### [WARNING] CCH-AD-06 + EIA-AU-08 — in-process bypass 가 인터페이스 역전(DIP) 보다 구현 직접 호출에 의존
- 위치: `spec/5-system/15-chat-channel.md §3.1 (다이어그램)`, `spec/5-system/14-external-interaction-api.md §3.3 EIA-AU-08`, `spec/conventions/chat-channel-adapter.md §1 (6함수 계약)`
- 상세: Chat Channel 어댑터가 `InteractionService.interact()` 를 "in-process 직접 호출"하는 설계는 어댑터 레이어가 비즈니스 서비스 레이어의 구체 클래스에 직접 의존함을 의미한다. 의존성 역전 원칙(DIP)에서는 상위 레이어(어댑터)가 하위 레이어(서비스)의 추상에만 의존해야 한다. `InteractionService` 인터페이스가 별도로 추출되어 있지 않으면 어댑터와 서비스 사이에 강한 결합이 생긴다. 또한 `InteractionRequestContext.scope: 'in_process_trusted'` 라는 플래그가 service 내부에서 인증 Guard 를 우회하는 방식은 Guard 계층이 컨텍스트 내부 값에 의존하게 되어 보안 경계가 흐려지는 안티패턴에 가깝다.
- 제안: `InteractionService` 를 인터페이스(또는 추상 클래스)로 추출하고 어댑터가 그 추상에 의존하도록 구성. `InteractionRequestContext.scope` 대신 `trustedCaller?: true` 처럼 목적이 명확한 필드를 사용하거나, 전용 메서드 `interactFromTrustedCaller(executionId, command)` 를 서비스에 노출해 bypass 경로를 타입 수준에서 명확히 분리하는 것을 권장.

---

### [WARNING] `parseUpdate` 의 순수 함수(pure) 계약과 `groupChatRefusal` "안내 발송" 기술의 책임 모호성
- 위치: `spec/conventions/chat-channel-adapter.md §1.1`, `spec/4-nodes/7-trigger/providers/telegram.md §4`
- 상세: `chat-channel-adapter.md §1.1` 은 `parseUpdate` 를 "DB 미접근, 외부 API 미호출, 순수 함수" 로 명시한다. 그런데 `telegram.md §4` 의 명령 매핑 표는 group chat 도착 시 "`null` 반환 + `languageHints.groupChatRefusal` 안내 발송" 이라고 기술한다. "안내 발송" 이 `sendMessage` 외부 API 호출을 의미한다면 `parseUpdate` 의 순수 함수 계약과 직접 충돌한다. 이는 레이어 책임 분리(presentation/business/data 의 각 레이어가 자신의 부작용만 담당) 관점에서 인터페이스 계약 위반이다.
- 제안: `telegram.md §4` 를 "null 반환 — 호출자가 `languageHints.groupChatRefusal` 을 `sendMessage` 로 발송하는 책임" 으로 명확화. 또는 `parseUpdate` 의 반환 타입에 `refusalMessage?: ChannelMessage` 필드를 추가해 caller 가 처리하도록 계약을 확장. 어느 쪽이든 `parseUpdate` 가 직접 외부 API를 호출하지 않음을 보장해야 한다.

---

### [WARNING] `ChannelConversation` 조회/생성 책임 — `HooksController` 와 `ChatChannelAdapter` 사이 레이어 경계 불명확
- 위치: `spec/5-system/12-webhook.md §7 처리 흐름 (step 7.d)`
- 상세: `12-webhook.md` 의 개정된 처리 흐름(step 7.d)에서 `ChannelConversationService.lookup(triggerId, update.conversationKey)` 를 HooksController 가 직접 호출한다. HooksController 는 HTTP 진입점으로 프레젠테이션 레이어에 해당하며, 대화 컨텍스트 조회는 비즈니스 레이어의 책임이다. 분기 로직(활성 execution 여부에 따라 `InteractionService.interact()` vs `ExecutionEngineService.execute()` 선택)이 컨트롤러 단에 노출되면 비즈니스 로직이 프레젠테이션 레이어로 누출된다.
- 제안: 이 분기 로직을 `ChatChannelService` (또는 `ChatChannelDispatchService`) 같은 별도 서비스로 추출. `HooksController` 는 `chatChannelService.handleUpdate(triggerId, rawBody, config)` 한 호출만 하고, 내부적으로 ChannelConversation 조회 → 분기 → interact/execute 를 처리하도록 레이어 책임을 분리.

---

### [INFO] `ChatChannelAdapter` 인터페이스 — 개방-폐쇄 원칙(OCP) 준수 설계
- 위치: `spec/conventions/chat-channel-adapter.md §1 ChatChannelAdapter interface`, `§5 Adapter Registry`
- 상세: 6함수 인터페이스(`setupChannel`, `teardownChannel`, `parseUpdate`, `renderNode`, `sendMessage`, `ackInteraction`) 를 명시한 것은 OCP 관점에서 바람직하다. 새 provider(Slack, 카카오 등) 추가 시 기존 코드를 수정하지 않고 인터페이스를 구현하는 새 어댑터 클래스만 추가하면 된다. `ChannelAdapterRegistry` 를 통한 provider lookup 패턴도 strategy 패턴의 올바른 적용이다. `ackInteraction` 을 noop 구현 가능으로 허용한 것은 리스코프 치환 원칙(LSP)의 유연한 적용이다.

---

### [INFO] `spec/5-system/2-api-convention.md` RPC-style 예외 추가 — 규약 확장 방식 적절
- 위치: `spec/5-system/2-api-convention.md §2.2 (신규 예외 행)`
- 상세: `POST /api/triggers/:id/chat-channel/rotate-bot-token` 의 depth 4 경로에 대해 API 규약 자체에 "RPC-style sub-channel action 예외" 를 명시한 것은 규약을 암묵적으로 위반하지 않고 확장하는 올바른 방식이다. 단, 이 예외 행이 EIA 의 `rotate-secret`, `revoke-token` 도 소급 포함하는 형태이므로 기존 endpoint 들이 규약의 사후 정당화를 받는 구조다. 규약이 구현보다 뒤따른다는 점은 관리 관점에서 주의할 필요가 있다.

---

### [INFO] 모듈 경계 — `spec/conventions/chat-channel-adapter.md` 의 `spec/conventions/` 위치 적합성
- 위치: `spec/conventions/chat-channel-adapter.md`, consistency review Round 1 C-1 (convention_compliance.md)
- 상세: `chat-channel-adapter.md` 가 `spec/conventions/` 에 위치하는 것은 "범-시스템 적용 인터페이스 계약" 기준을 충족한다. `node-output.md` / `conversation-thread.md` 처럼 구현자가 지켜야 하는 공통 계약이기 때문이다. provider 별 구체 명세는 `spec/4-nodes/7-trigger/providers/<name>.md` 로 분리되어 있어 모듈 경계가 명확하다.

---

### [INFO] `spec/4-nodes/7-trigger/providers/_overview.md` 조기 도입 — 확장성 설계 적절
- 위치: `spec/4-nodes/7-trigger/providers/_overview.md §Rationale`
- 상세: v1 에서 provider 가 `telegram` 1개뿐임에도 `_overview.md` 카탈로그 인덱스를 도입한 것은 확장성 관점에서 올바른 선택이다. 두 번째 provider 추가 시 인덱스 도입을 별 작업으로 미루면 누락 위험이 있으며, 카탈로그 패턴의 단일 진실 분리도 `cafe24-api-catalog/_overview.md` 선례와 일관된다.

---

### [INFO] `spec/1-data-model.md` Trigger 엔티티 확장 — 수평 확장 패턴의 일관성
- 위치: `spec/1-data-model.md §2.8 Trigger (5개 신규 컬럼)`
- 상세: `chat_channel_health`, `chat_channel_last_error`, `chat_channel_setup_at`, `chat_channel_token_v2`, `chat_channel_rotated_at` 5개 컬럼이 `notification_health` / `notification_secret_v2` / `notification_rotated_at` 의 패턴을 그대로 따른다. 이 수평 확장 방식은 기존 EIA 패턴과 일관성이 있다. 다만 health enum 이 독립 컬럼으로 중복 관리되는 구조는 향후 `chat_channel_health` 와 `notification_health` 에 enum 값을 추가할 때 두 곳을 동시에 갱신해야 하는 부담이 있다. 공용 DB enum 타입 도입 여부를 I13 후속 검토로 명시한 것은 적절한 defer 결정이다.

---

### [INFO] `telegram.md §5.4 보안` 섹션 번호 중복 — 문서 구조 결함 (구현 착수 전 수정 필요)
- 위치: `spec/4-nodes/7-trigger/providers/telegram.md §5.4 (두 번 등장)`
- 상세: consistency check Round 3 (`cross_spec.md` of `23_49_16`) 에서 이미 식별된 내용이다. `## 5.4 Carousel / Chart / Table` 과 `## 5.4 보안` 이 동일 번호로 존재해 Markdown 앵커가 모호해지며, `spec/5-system/15-chat-channel.md §5.1` 의 참조 링크 `#54-보안` 이 잘못된 섹션으로 연결될 위험이 있다. 아키텍처적 문제가 아닌 문서 구조 결함이나, spec 이 구현 SoT 이므로 구현 착수 전에 수정되어야 한다.
- 제안: `## 5.4 보안` 을 `## 6. 보안` 또는 `## 5.5 보안` 으로 수정. `15-chat-channel.md §5.1` 의 앵커도 함께 갱신.

---

### [INFO] `CCH-SE-03` bot token 평문 보관 vs spec 원칙 불일치 — 임시 stub 추적 필요
- 위치: `plan/in-progress/chat-channel-impl.md §3.4` (consistency Round 3 `plan_coherence.md` 참조)
- 상세: `CCH-SE-03` 은 bot token config JSONB 평문 금지를 명시하지만, `chat-channel-impl.md §3.4` 에서 v1 구현은 `botToken` 평문 보관을 선택(notification.signing.secret stub 과 동일 방식)하기로 결정했다. spec 과 구현 사이에 일시적 불일치가 발생한다. `spec-update-chat-channel-bot-token-stub.md` 라는 후속 plan 파일이 아직 생성되지 않았다.
- 제안: 해당 follow-up plan 파일을 chat-channel-impl PR 완료 전에 생성하거나 PR 체크리스트에 명시. 그렇지 않으면 보안 원칙 위반 상태가 spec 추적 없이 방치될 위험이 있다.

---

## 요약

이번 변경의 핵심 아키텍처 결정은 (1) Chat Channel 을 새 트리거 유형 대신 Webhook 트리거의 갈래로 배치한 것, (2) `ChatChannelAdapter` 인터페이스를 통한 strategy 패턴 기반 provider 격리, (3) EIA-AU-08 (in-process trusted caller 예외) 를 통한 네트워크 round-trip 우회다. 전체 방향은 기존 EIA 아키텍처를 존중하면서 새 레이어를 최소 표면으로 도입하는 점에서 올바르다. 그러나 세 가지 구조적 취약점이 존재한다. 첫째, `NotificationDispatcher` 에 세 번째 fan-out 갈래(in-process EventEmitter)가 추가되면서 단일 책임 경계가 긴장되고 있으며, provider 증가 시 이 긴장이 심화될 수 있다. 둘째, `InteractionService.interact()` 를 어댑터가 직접 호출하는 패턴은 레이어 의존 방향이 역전되고 인증 Guard bypass 가 컨텍스트 플래그로 제어되는 구조로, DIP 및 보안 경계 명확성 측면에서 개선이 필요하다. 셋째, 대화 분기 로직이 `HooksController` 단에 노출되어 비즈니스 로직이 프레젠테이션 레이어로 누출되고 있다. `parseUpdate` 의 순수 함수 계약과 `groupChatRefusal` 발송 책임 불명확도 인터페이스 계약의 일관성을 해친다. 이 네 가지 WARNING 은 구현 착수 전 spec 수준에서 해소하거나, 구현 단계에서 아키텍처 결정으로 명확히 선택해 plan 에 기록할 것을 권장한다.

---

## 위험도

MEDIUM

---

STATUS: SUCCESS
