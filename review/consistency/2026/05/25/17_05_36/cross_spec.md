# Cross-Spec 일관성 검토 결과

대상 draft: `plan/in-progress/spec-draft-chat-channel-template-render-outbound.md`
검토 시각: 2026-05-25
모드: spec draft 검토 (--spec)

---

## 발견사항

### [WARNING] `ChatChannelInternalEvent` 구독 소스 기술 — EIA R10 / CCH-AD-05 와의 미세 불일치

- **target 위치**: draft "결정 1" — "`WebsocketService.executionEvents$` Subject 를 단일 구독 (이미 R8 catch-up 으로 결정된 경로 — `15-chat-channel.md R8`) 하면서 presentation 노드 한정 sub-filter 로 `execution.node.completed` 도 픽업"
- **충돌 대상**: `spec/5-system/15-chat-channel.md §R8` (line 548) + `spec/conventions/chat-channel-adapter.md §1.1 / §3` + `spec/5-system/14-external-interaction-api.md §R10`
- **상세**: 기존 spec 의 구독 아키텍처는 두 레이어로 분리되어 있다. `WebsocketService.executionEvents$` Subject 는 내부 RxJS Subject 이며, ChatChannelDispatcher 는 이것을 직접 구독하는 것이 아니라 NotificationDispatcher 가 노출하는 **after-commit EventEmitter** 에 in-process listener 로 attach 하는 것이 공식 구독 경로다 (EIA §R10 / CCH-AD-05 / 15-chat-channel §3.2). R8 catch-up 의 "Fan-out source = `WebsocketService.executionEvents$` RxJS Subject" 는 코드 구조 기술로, 어댑터의 진입점은 해당 Subject 를 wrapping 한 facade (NotificationDispatcher EventEmitter) 다. draft 가 "ChatChannelDispatcher 가 `WebsocketService.executionEvents$` Subject 를 단일 구독" 이라고 직접 기술하면 facade 레이어를 생략하는 것처럼 읽혀 EIA R10 의 "엔진 단일 sink + 외부 facade" 원칙 기술과 충돌한다. `execution.node.completed` 가 `executionEvents$` Subject 에 실제로 emit 되는지(현재 spec 상 EIA outbound 5종 이외 이벤트의 Subject 흐름 여부)도 별도 확인이 필요하다.
- **제안**: draft §B CCH-AD-07 및 §C EIA §R10 보강 문장을 수정해 "NotificationDispatcher 가 노출하는 in-process EventEmitter listener 에 `execution.node.completed` 이벤트를 추가 구독한다" 또는 "실행 엔진이 `execution.node.completed` 를 `WebsocketService.emitToExecution` 을 통해 emit 하면 ChatChannelDispatcher 가 sub-filter 로 픽업한다" 중 정확한 구현 경로를 명시해야 한다. `execution.node.completed` 이벤트가 현재 엔진에서 실제로 emit 되는 이벤트인지 (EIA §5 SSE 디버깅 이벤트로만 정의됨) 먼저 확인 후 spec 에 반영 의무.

---

### [WARNING] `ChatChannelAdapter` 인터페이스 확장 없이 7번째 함수 추가 — 기존 interface 정의와 암묵적 불일치

- **target 위치**: draft "결정 1" — `renderPresentationNode` (신설) 행을 §1.1 표에 7번째 함수로 추가
- **충돌 대상**: `spec/conventions/chat-channel-adapter.md §1` (interface `ChatChannelAdapter` typescript block)
- **상세**: `spec/conventions/chat-channel-adapter.md §1` 의 `interface ChatChannelAdapter` 는 6개 함수 시그니처를 열거한다. draft 는 §1.1 의 표 (함수 책임 표) 만 7행으로 늘리고, `interface ChatChannelAdapter` TypeScript 블록 자체에 `renderPresentationNode` 를 추가하지 않는다. 표와 interface 가 불일치하면 모든 provider 어댑터 구현체가 따라야 할 계약이 표와 interface 사이에 drift 가 발생한다. 또한 `§7 변경 관리` 는 인터페이스 변경 시 `spec/5-system/15-chat-channel.md` + `spec/4-nodes/7-trigger/providers/<name>.md` 동시 갱신 의무를 규정하는데, draft 가 providers/telegram.md 갱신을 "§3.3 영향 평가" 에서만 언급하고 spec 갱신안 본문에 포함하지 않은 점도 불완전하다.
- **제안**: `chat-channel-adapter.md §1` 의 interface block 에 `renderPresentationNode` 함수 시그니처 (`event: ChatChannelInternalEvent, config: ChatChannelConfig`): `Promise<ChannelMessage[]>`) 를 명시적으로 추가하는 갱신안을 draft §A 에 포함해야 한다. `spec/4-nodes/7-trigger/providers/telegram.md` (및 slack, discord) 의 동반 갱신도 spec 갱신안 §A 또는 별도 항목으로 명시적으로 포함해야 한다.

---

### [WARNING] `execution.node.completed` 이벤트가 EIA §5 SSE-only 디버깅 이벤트와 혼동 가능 — 표면 명확화 필요

- **target 위치**: draft 전반 — `ChatChannelInternalEvent` type 의 `type: "execution.node.completed"` 사용
- **충돌 대상**: `spec/5-system/14-external-interaction-api.md §5` (SSE 디버깅 이벤트 정의), `spec/5-system/6-websocket-protocol.md` (WS 이벤트 목록)
- **상세**: draft 의 진단 섹션에서 "`execution.node.completed` 는 SSE 디버깅 이벤트로만 정의 (EIA §5)" 라고 스스로 기술하고 있다. draft 가 신설하는 `ChatChannelInternalEvent.type = "execution.node.completed"` 는 외부 SSE 표면에 이미 동명 이벤트가 존재하는 상황에서 내부 타입에 동일 문자열 키를 사용한다. 이는 (a) 코드 리뷰어와 구현자가 두 이벤트를 혼동할 위험, (b) 향후 ChatChannelDispatcher 가 SSE 이벤트 스트림에서 filter 로직을 작성할 때 표면 교차 위험을 만든다. 두 이벤트의 페이로드가 동일하다는 보장도 spec 에 없다.
- **제안**: `ChatChannelInternalEvent` 의 이벤트 타입 문자열을 `"channel.node.presentation_completed"` 등 chat-channel-internal 전용 네이밍으로 바꾸거나, 기존 EIA SSE 이벤트와 동일 문자열을 쓰는 이유와 페이로드 동일성을 spec 에 명시적으로 기술해야 한다. 두 표면의 payload 가 동일하다면 해당 사실을 `ChatChannelInternalEvent` 타입 정의 주석에 "SoT: EIA §5 의 `execution.node.completed` 와 동일 shape" 으로 명시한다.

---

### [INFO] `EiaAiMessageEvent` 의 `presentations?` 추가가 기존 `EiaEvent` union 의 EIA §6.5 주석과 drift 가능

- **target 위치**: draft §A §1.2 — `EiaAiMessageEvent` 에 `presentations?: PresentationPayload[]` 필드 추가
- **충돌 대상**: `spec/conventions/chat-channel-adapter.md §1.2` (line 89) — `execution.ai_message` variant 정의
- **상세**: 기존 `§1.2` 의 `EiaEvent` union 의 `execution.ai_message` variant 에는 `presentations` 필드가 없다. draft 는 이를 추가하겠다고 기술하나, EIA §6.5 (line 536) 에 이미 `presentations?: PresentationPayload[]` 가 명시된 상태다. 즉 drift 는 "chat-channel-adapter.md §1.2 만 누락"된 형태이며, EIA spec 자체는 이미 정의하고 있다. draft 의 분석과 결정이 정확하다. 다만 `chat-channel-adapter.md §1.2` 도입 문장 ("EIA §6 outbound notification payload 의 5종 union") 에 `presentations` 가 옵션 필드임을 명시하지 않으면 "5종 union 의 필드 개수가 늘었나" 라는 오해가 생길 수 있다.
- **제안**: draft §A §1.2 보강 시 "§1.2 도입 문장은 그대로" 방침은 유지하되, `execution.ai_message` variant 의 인라인 주석에 `presentations` 가 AI Agent §7.10 에서 정의된 옵션 필드임을 명시하는 것이 기존 `EiaEvent` 설명 ("drift 회피 원칙") 과 일관된다.

---

### [INFO] `CCH-AD-05` 와 `CCH-AD-07` 의 구독 경로 이원화 — 계층 책임 경계 문서화 미흡

- **target 위치**: draft §B §3.1 CCH-AD-07
- **충돌 대상**: `spec/5-system/15-chat-channel.md §3.1 CCH-AD-05`, `spec/conventions/chat-channel-adapter.md §1.1 renderNode`
- **상세**: CCH-AD-05 는 "NotificationDispatcher 의 after-commit EventEmitter" 경로를 사용하고, CCH-AD-07 은 "`WebsocketService.executionEvents$` Subject" 경로를 사용한다고 draft 가 기술한다. 두 요구사항이 서로 다른 구독 진입점을 사용하면 단일 ChatChannelDispatcher 안에서 두 개의 별도 구독이 공존하게 된다. EIA R10 의 "엔진 외부 facade 단일 위치" 원칙과 R8 의 "Fan-out source = `WebsocketService.executionEvents$` 단일 Subject" 원칙이 어떻게 관계하는지 명확히 기술되지 않으면 구현 시 혼란이 발생한다.
- **제안**: `CCH-AD-07` 의 구현 경로가 CCH-AD-05 와 동일 fan-out source (`WebsocketService.executionEvents$` Subject → ChatChannelDispatcher sub-filter) 인지, 아니면 별도 EventEmitter 구독인지를 spec 에 명시해야 한다. 동일 Subject 에서 filter 로 분기한다면 "CCH-AD-05 의 동일 구독 경로 내 sub-filter 확장" 으로 기술하는 것이 R10 원칙과 정합하다.

---

### [INFO] `providers/telegram.md §7 변경 관리` 갱신 의무 — draft 영향 평가에 언급만 되고 갱신안에 미포함

- **target 위치**: draft "영향 평가" 마지막 항목 — "`spec/4-nodes/7-trigger/providers/telegram.md §5.4` — CCH-MP-06 / CCH-AD-07 cross-ref 추가"
- **충돌 대상**: `spec/conventions/chat-channel-adapter.md §7 변경 관리` — 인터페이스 변경 시 모든 provider spec 동시 갱신 의무
- **상세**: `chat-channel-adapter.md §7` 은 인터페이스 변경 시 `spec/4-nodes/7-trigger/providers/<name>.md` 모두 동시 갱신 의무를 명시한다. draft 는 `renderPresentationNode` (7번째 함수) 신설이라는 인터페이스 변경임에도 `providers/telegram.md` 갱신을 "영향 평가" 에서 한 줄로만 언급하고, spec 갱신안 (§A~§D) 에 포함하지 않는다. Slack / Discord provider spec 에 대한 갱신 의무도 언급이 없다.
- **제안**: spec 갱신안 §A 또는 신설 §E 에 `providers/telegram.md`, `providers/slack.md`, `providers/discord.md` 의 갱신안 (최소 `renderPresentationNode` 구현 의무 추가 + CCH-MP-06 / CCH-AD-07 cross-ref) 을 명시적으로 포함해야 한다.

---

## 요약

Round 1 의 4 CRITICAL (C-1: CCH-AD-06 ID 충돌 → CCH-AD-07 교체, C-2: EiaEvent union 경계 붕괴 → ChatChannelInternalEvent 별도 타입, C-3: renderNode 계층 책임 → renderPresentationNode 신설, C-4: spec-draft prefix 누락) 은 revision 2 에서 모두 해소되어 직접 모순은 존재하지 않는다. 그러나 두 가지 WARNING 이 남는다. 첫째, `ChatChannelInternalEvent` 구독 소스를 "`WebsocketService.executionEvents$` Subject 직접 구독" 으로 기술하는 것이 기존 EIA R10 / CCH-AD-05 의 "NotificationDispatcher after-commit EventEmitter" 경로와 미세하게 충돌하며, `execution.node.completed` 가 현재 엔진에서 실제로 emit 되는지 여부가 확인되지 않았다. 둘째, `interface ChatChannelAdapter` TypeScript block 에 `renderPresentationNode` 가 추가되지 않아 §1.1 표와 interface 가 불일치한다. 이 두 WARNING 은 구현 단계에서 혼란을 유발할 수 있으므로, spec 본문 반영 전 해소를 권고한다. INFO 항목 두 개(EiaAiMessageEvent 주석 명확화, providers spec 동반 갱신)는 필수 차단 요건은 아니지만 spec 일관성 향상을 위해 동반 처리를 권장한다.

---

## 위험도

MEDIUM
