# Cross-Spec 일관성 검토 결과

검토 대상: `plan/in-progress/chat-channel-template-render-outbound.md`
검토 일시: 2026-05-25
검토 모드: spec draft (--spec)

---

## 발견사항

### [CRITICAL] CCH-AD-06 요구사항 ID 충돌 — 기존 정의와 의미 완전 상이

- **target 위치**: Spec 갱신안 B §3.1 `CCH-AD-06` 신설
- **충돌 대상**: `spec/5-system/15-chat-channel.md §3.1` 의 현행 CCH-AD-06
- **상세**: target 문서는 CCH-AD-06 을 "chat-channel 어댑터가 `execution.node.completed` in-process WS Subject 의 presentation 노드 완료 이벤트를 추가 listener 로 attach 하는 요구사항"으로 신설한다고 기술한다. 그러나 `spec/5-system/15-chat-channel.md §3.1`에는 CCH-AD-06 이 이미 존재하며, 그 내용은 "인터랙션 응답 도착 시 어댑터가 `InteractionService.interact()` 를 in-process 직접 호출한다 (HTTP 표면 우회, EIA-AU-08 근거)"로 정의되어 있다. 두 정의는 동일 ID 를 가지면서 전혀 다른 의무를 기술한다. 어느 하나가 채택되면 기존 CCH-AD-06 이 새 정의로 덮어써지거나, 기존 요구사항이 유실된다.
- **제안**: target 의 신규 요구사항에는 CCH-AD-07 (또는 다른 미사용 번호) 를 부여한다. 기존 CCH-AD-06 (InteractionService.interact 직접 호출) 은 현행 그대로 유지해야 한다.

---

### [CRITICAL] `EiaEvent` union 에 `execution.node.completed` 추가 — Convention §1.2 의 정의 범위 초과

- **target 위치**: Spec 갱신안 A §1.2 `EiaNodeCompletedEvent` 신설
- **충돌 대상**: `spec/conventions/chat-channel-adapter.md §1.2` EiaEvent union 정의
- **상세**: 현행 `spec/conventions/chat-channel-adapter.md §1.2` 는 EiaEvent 를 "EIA §6 outbound notification payload 의 5종 union — 별 신규 타입 정의 없이 EIA spec 의 payload shape 를 재사용 (drift 회피)"라고 명시한다. target 문서는 이 union 에 `execution.node.completed` (chat-channel-internal) 를 6번째 타입으로 추가할 것을 제안한다. 그런데 현행 컨벤션 §1.2 의 서문 자체가 "EIA §6 의 5종"이 EiaEvent 의 범위임을 단정하고 있으므로, chat-channel-internal 이벤트를 같은 union 에 추가하면 컨벤션의 "EIA spec 재사용 / drift 회피" 원칙을 깨게 된다. 또한 `renderNode(event: EiaEvent)` 함수 시그니처도 내부 이벤트를 처리하도록 변경되는데, Convention §1.1 표는 `renderNode` 를 "EIA payload → ChannelMessage[]" 단일 책임으로 정의하고 있어 내부 이벤트 처리 책임이 추가되면 계층 책임 정의가 달라진다.
- **제안**: 두 가지 중 하나를 선택해야 한다. (A) `EiaEvent` union 에 추가하지 않고, `execution.node.completed` in-process 이벤트를 처리하는 별도 listener 인터페이스(예: `NodeCompletedEvent`) 를 컨벤션에 신설하고 `renderNode` 와 분리된 독립 함수로 정의한다. (B) `EiaEvent` union 확장을 채택하되 §1.2 의 서문("EIA §6 의 5종 union") 과 "EIA spec 재사용" 원칙 설명을 함께 갱신하고, 내부 이벤트임을 명확히 구분한다.

---

### [CRITICAL] `renderNode` 함수 시그니처 계층 책임 충돌 — pure + side-effect free 계약 위반 잠재

- **target 위치**: Spec 갱신안 A §3 매핑 표 `execution.node.completed` 신규 행
- **충돌 대상**: `spec/conventions/chat-channel-adapter.md §1.1` `renderNode` 책임 정의
- **상세**: Convention §1.1 표는 `renderNode` 를 "none" side-effect, "pure" 멱등성으로 정의한다. target 의 갱신안은 `execution.node.completed` 를 `renderNode` 에서 처리하도록 매핑 표에 추가한다. 이 자체는 pure 함수로 구현 가능하지만, CCH-AD-05 의 "NotificationDispatcher 의 after-commit EventEmitter" 경로와 달리, target 이 제안하는 `execution.node.completed` 구독 출처는 `websocketService.executionEvents$` RxJS Subject (현행 spec/5-system/15-chat-channel.md R8 §546-548 이 명시한 fan-out 원천)이다. Convention §1.2 의 EiaEvent 는 "NotificationDispatcher 가 after-commit EventEmitter 로 fan-out 하는 이벤트" 를 입력으로 전제하는데, `websocketService.executionEvents$` Subject 는 동일 origin 이지만 다른 subscriber 경로다. 두 이벤트 소스가 Convention 의 동일 `renderNode` 진입점으로 합류하는 경우, 어느 경로에서 오는지 구분 불가 — 타입 union 으로 분리하더라도 호출 계층의 단일성이 모호해진다.
- **제안**: `execution.node.completed` 를 `renderNode` 와 같은 in-process 계층에서 처리하되, 별도 listener 메서드(예: `renderPresentationNode(event: NodeCompletedEvent)`) 로 분리해 Convention §1.1 표에 7번째 함수로 등재하거나, 기존 `renderNode` 시그니처를 내부 이벤트를 수용하도록 공식 확장하는 두 경로 중 명시적 결정이 필요하다.

---

### [WARNING] CCH-MP-01 보강 — Convention §3 매핑 표의 `execution.ai_message` 행 갱신 동기화 필요

- **target 위치**: Spec 갱신안 B §3.3 `CCH-MP-01 (갱신)` 및 Spec 갱신안 A §3 매핑 표 `execution.ai_message` 갱신 행
- **충돌 대상**: `spec/conventions/chat-channel-adapter.md §3` 매핑 표 현행 `execution.ai_message` 행 및 `§1.2` EiaAiMessageEvent 타입
- **상세**: target 문서는 `spec/conventions/chat-channel-adapter.md §1.2` 의 `EiaAiMessageEvent` 에 `presentations?: PresentationPayload[]` 필드를 추가하고, §3 매핑 표의 `execution.ai_message` 행에 presentations 처리를 추가하는 갱신안을 제시한다. 현행 `chat-channel-adapter.md §1.2` 의 `execution.ai_message` 타입 정의에는 해당 필드가 없고, §3 매핑 표의 해당 행도 `text` 1건만 정의한다. 이는 EIA §6.5 line 536 이 이미 `presentations?` 필드를 약속하고 있으나 Convention 에 반영되지 않은 gap 이다. target 이 갱신안을 채택할 경우 Convention 과 `spec/5-system/15-chat-channel.md §3.3 CCH-MP-01` 두 문서가 동시에 갱신되어야 하며, 하나라도 누락되면 두 spec 간 drift 가 발생한다.
- **제안**: target 의 갱신 방향은 정당하다. spec 반영 시 `chat-channel-adapter.md §1.2` (EiaAiMessageEvent 타입) + `§3` 매핑 표 + `spec/5-system/15-chat-channel.md §3.3 CCH-MP-01` 세 위치를 단일 PR 에서 함께 갱신해야 한다. Changelog 항목도 두 문서 각각에 추가가 필요하다.

---

### [WARNING] `execution.node.completed` fan-out 경로 — CCH-AD-05 와의 구독 소스 불일치

- **target 위치**: Spec 갱신안 B §3.1 CCH-AD-07 (신규 번호 기준) 및 결정 1 근거
- **충돌 대상**: `spec/5-system/15-chat-channel.md §3.2 + R8`, `spec/5-system/14-external-interaction-api.md §R10`
- **상세**: 현행 R8 (§548) 과 EIA R10 은 fan-out 의 원천을 "NotificationDispatcher 의 after-commit EventEmitter (in-process)" 로 명시하고, 이것이 CCH-AD-05 가 구독하는 경로임을 확정한다. target 이 제안하는 `execution.node.completed` 구독 경로는 `websocketService.executionEvents$ Subject` (R8 §548 에서 "Fan-out source = `WebsocketService.executionEvents$` RxJS Subject" 로 명시) 다. EIA §R10 은 이 Subject 를 "WebsocketService 단일 sink" 의 출발점으로 정의하며, 외부 facade 가 이 Subject 를 직접 구독하는 것이 R10 위반인지에 대한 명시적 선언이 없다. target 문서는 "R10 정책 위반 아님"이라고 주장하지만, 현행 R10 본문은 "엔진 외부 facade 단일 위치" 원칙을 다루며, `websocketService.executionEvents$` 가 아닌 "NotificationDispatcher 의 after-commit EventEmitter"를 chat-channel 어댑터의 구독 지점으로 명시한다. 두 경로(after-commit EventEmitter vs. executionEvents$ Subject)의 동일성이 spec 에서 명확히 기술되지 않으면, R10 의 "단일 sink" 원칙 위반 여부가 해석에 따라 달라진다.
- **제안**: target 의 CCH-AD-07 (신규 번호) 신설 시, `execution.node.completed` 이벤트를 구독하는 정확한 소스를 명시하고, EIA R10 이 이를 허용하는지 여부를 R10 본문에 한 줄 보강하거나, `spec/5-system/15-chat-channel.md R8` 에 "node.completed 이벤트는 동일 Subject 에서 presentation 노드 한정 filter 로 구독" 한 줄을 추가해야 한다.

---

### [WARNING] `CCH-MP-06` — 새 요구사항 번호 충돌 가능성 확인 필요

- **target 위치**: Spec 갱신안 B §3.3 `CCH-MP-06` 신설
- **충돌 대상**: `spec/5-system/15-chat-channel.md §3.3` 현행 CCH-MP-* 목록
- **상세**: 현행 `spec/5-system/15-chat-channel.md §3.3` 은 CCH-MP-01 ~ CCH-MP-05 까지 정의한다. target 이 CCH-MP-06 을 신설하는 것은 번호 순서상 충돌은 없으나, CCH-MP-05 가 "Form 필드 type 별 채널 keyboard hint" 로 정의되어 있어 CCH-MP-06 번호 자체는 현재 비어있다. 충돌은 없지만 스펙 반영 전 해당 번호가 다른 in-progress plan 에 의해 이미 예약되었는지 확인이 필요하다.
- **제안**: 다른 in-progress plan 파일들(`plan/in-progress/` 하위)에서 CCH-MP-06 번호를 사전 검색해 중복 예약 여부를 확인한 뒤 채택한다.

---

### [INFO] `chat-channel-adapter.md §7 변경 관리` 조항과의 동기화

- **target 위치**: Spec 갱신안 전반
- **충돌 대상**: `spec/conventions/chat-channel-adapter.md §7 변경 관리`
- **상세**: §7 는 "본 인터페이스 변경은 다음 두 spec 동시 갱신 의무: `spec/5-system/15-chat-channel.md` + `spec/4-nodes/7-trigger/providers/<name>.md` (모든 구체 어댑터 명세)"를 규정한다. target 의 갱신안은 `EiaEvent` union 확장을 포함하므로, Telegram provider spec(`spec/4-nodes/7-trigger/providers/telegram.md`)의 관련 섹션(§5.4 등)에도 비-blocking presentation 발화 정책의 cross-ref 가 추가되어야 한다. target 의 영향 평가(§164)는 "telegram §5.4 — cross-ref 추가 권장"으로 언급하나, §7 조항상 "의무"에 해당하는지 여부가 불명확하다.
- **제안**: `renderNode` 또는 `EiaEvent` union 인터페이스 변경이 수반되는 경우, telegram provider spec 을 "의무" 동반 갱신 대상으로 처리하는 것이 §7 의 취지에 부합한다. 생략하면 §7 위반이 될 수 있으므로 PR 체크리스트에 포함을 권장한다.

---

### [INFO] `spec/4-nodes/6-presentation/0-common.md` 의 비-blocking 모드 정의 cross-ref

- **target 위치**: 결정 1 및 CCH-MP-06 정의 ("비-blocking presentation 노드" 대상 명시)
- **충돌 대상**: `spec/4-nodes/6-presentation/0-common.md` (target 영향 평가 §163 참조)
- **상세**: target 은 "비-blocking presentation 의 chat-channel 발화는 chat-channel spec 의 책임"으로 결론 내리고 presentation 공통 spec 은 변경 없다고 선언한다. 그러나 `spec/4-nodes/6-presentation/0-common.md` 가 "blocking vs non-blocking" 모드를 어떻게 정의하는지, 그리고 `template` / `carousel` / `table` / `chart` 의 비-blocking 완료 시 `node.completed` 가 발사된다는 엔진 invariant 가 해당 spec 에 명시되어 있는지 여부를 확인해야 한다. target 의 CCH-MP-06 은 "buttons 없음 케이스 = 비-blocking" 로 정의하는데, 이 기준이 presentation 공통 spec 의 정의와 일치해야 한다.
- **제안**: presentation 공통 spec 에서 비-blocking 완료 시 `node.completed` 발사 여부를 확인하고, 정의가 명시되지 않았다면 cross-ref 를 추가하는 것을 권장한다.

---

## 요약

target 문서(`chat-channel-template-render-outbound.md`)는 두 개의 회귀를 교정하기 위한 spec 갱신안을 포함하며, 전반적인 방향성(비-blocking presentation 에 대한 in-process listener 추가 + `presentations?` 필드 반영)은 EIA §6.5 의 기존 약속과 부합한다. 그러나 교차 spec 관점에서 세 가지 CRITICAL 충돌이 존재한다. 첫째, target 이 신설 요구사항으로 부여하는 `CCH-AD-06` 번호가 현행 `spec/5-system/15-chat-channel.md` 에서 이미 전혀 다른 의미(InteractionService.interact 직접 호출)로 사용 중이어서, 그대로 반영하면 기존 CCH-AD-06 의 내용이 유실 또는 덮어써진다. 둘째, `EiaEvent` union 에 `execution.node.completed` 를 추가하는 안이 `chat-channel-adapter.md §1.2` 의 "EIA §6 의 5종 union" 원칙과 정면 충돌한다. 셋째, `renderNode` 를 내부 이벤트 처리에 재사용하는 방식이 Convention §1.1 의 pure/side-effect-free 계약 및 계층 책임 정의와 충돌할 소지가 있다. 이 세 CRITICAL 항목은 spec 반영 전 반드시 해소되어야 한다.

---

## 위험도

HIGH
