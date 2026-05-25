# Rationale 연속성 검토 결과

검토 대상: `plan/in-progress/spec-draft-chat-channel-template-render-outbound.md`
검토 일자: 2026-05-25

---

## 발견사항

### [INFO] 결정 1 의 `renderPresentationNode` 신설 — R-CCA-5 의 인터페이스 최소화 원칙과 맥락 정합 확인

- **target 위치**: 결정 1 §1.1 "6함수 → 7함수 표 확장 — `renderPresentationNode` 행 추가"
- **과거 결정 출처**: `spec/conventions/chat-channel-adapter.md` Rationale R2 (6함수 의도), R-CCA-5 (Execution Failed 분류 helper 기각 대안 2)
- **상세**: R-CCA-5 (기각 대안 2) 는 "어댑터 인터페이스에 `renderError(event)` 신설 기각 — R2 의 인터페이스 최소화 원칙 그대로 적용. 새 함수 추가는 모든 provider 어댑터의 contract 변경. 분류 자체가 provider invariant 이므로 함수 분리 이득 없음" 이라고 명시한다. 이 기각 논리는 "분류가 provider invariant 이므로 인터페이스 진입점을 분리할 이유가 없다"는 근거였다. 본 target 이 도입하는 `renderPresentationNode` 는 `ChatChannelAdapter` 인터페이스에 추가되는 8번째 함수라 모든 provider 어댑터가 구현 의무를 가진다.
- **차이점**: R-CCA-5 와 비교하면 (a) `renderPresentationNode` 는 provider-specific 렌더링 로직이 실제로 달라질 수 있고 (b) `ChatChannelInternalEvent` 입력이 `EiaEvent` 와 다른 타입이라 기존 `renderNode` 시그니처에 흡수하기 어렵다는 새 근거가 존재한다. 단, target 문서는 이 구분을 "기각 대안 D (`EiaEvent` union 에 `execution.node.completed` 추가) 기각 사유" 로만 설명하고, "왜 `renderNode` 시그니처 확장(오버로드)이 아닌 새 함수 신설인가"에 대한 Rationale — 즉 R2 의 인터페이스 최소화 원칙과의 양립 근거 — 을 spec 갱신안 안에 명시적으로 담지 않고 있다.
- **제안**: spec 갱신안의 `chat-channel-adapter.md §1.1` 7함수 행 또는 신설 Rationale 항목에 "R2 의 인터페이스 최소화 원칙은 provider-invariant helper 를 인터페이스 바깥으로 빼는 근거였고, `renderPresentationNode` 는 EiaEvent 와 다른 입력 타입(`ChatChannelInternalEvent`) 을 받는 별도 렌더 경로라 동일 원칙 하에 신설이 적합하다"는 한 줄을 추가해 R2 와의 정합 근거를 명문화할 것을 권장한다.

---

### [INFO] 결정 1 의 `WebsocketService.executionEvents$` Subject 구독 방식 — R8 결정과의 맥락

- **target 위치**: 결정 1 "chat-channel dispatcher 는 `WebsocketService.executionEvents$` Subject 를 단일 구독 (이미 R8 catch-up 으로 결정된 경로 — `15-chat-channel.md R8`) 하면서 presentation 노드 한정 sub-filter 로 `execution.node.completed` 도 픽업"
- **과거 결정 출처**: `spec/5-system/15-chat-channel.md` Rationale R8 (Fan-out facade 의 분리, 2026-05-22, 갱신 2026-05-24)
- **상세**: R8 은 "Fan-out source = `WebsocketService.executionEvents$` RxJS Subject" 이며 `ChatChannelDispatcher` 가 이 Subject 를 구독한다고 확인한다. target 의 설계(동일 Subject 에 sub-filter 추가)는 R8 이 수립한 구독 경로를 그대로 활용하는 점에서 원칙 위반이 아니다.
- **주의점**: 다만 `WebsocketService.executionEvents$` 가 `execution.node.completed` 이벤트를 실제로 emit 하는지, 또는 이 Subject 에 흘러오는 이벤트 타입의 범위(현재 5종 화이트리스트인지 아닌지)가 EIA spec 과 코드 사이에서 일치하는지는 본 spec draft 안에서 단언만 하고 있다. EIA §6.1 outbound HTTP webhook 화이트리스트(5종)와 `WebsocketService.executionEvents$` Subject 에 실제로 emit 되는 이벤트 타입의 범위가 동일한지 여부는 spec 문서 안에 근거가 명시되어 있지 않다.
- **제안**: spec 갱신안의 `14-external-interaction-api.md §R10` 보강 문장(이미 계획됨) 안에 "executionEvents$ Subject 에는 EIA §6.1 화이트리스트 5종 외 `execution.node.completed` 이벤트도 emit 된다는 사실 (실행 엔진 emit 범위)"을 명시하거나, 이를 별도 cross-ref 로 지시할 것을 권장한다. 이렇게 해야 미래 검토자가 Subject emit 범위를 코드 없이도 spec 에서 확인할 수 있다.

---

### [INFO] 결정 2 의 `EiaAiMessageEvent` `presentations?` 필드 추가 — `EiaEvent` 5종 union 의미 경계 원칙과의 정합

- **target 위치**: 결정 2, §1.2 `execution.ai_message` variant 에 `presentations?: PresentationPayload[]` 추가
- **과거 결정 출처**: `spec/conventions/chat-channel-adapter.md` §1.2 도입 문장 ("EIA §6 outbound notification payload 의 5종 union"), R3 ("EiaEvent 를 별 타입으로 정의하지 않고 EIA spec 위임 — 두 spec 간 type drift 회피")
- **상세**: target 이 수행하는 변경은 기존 `EiaEvent` 5종 union 의 멤버 타입 (`execution.ai_message` variant) 내부 필드를 **확장**하는 것이다. EIA §6.5 가 이미 `presentations?: PresentationPayload[]` 를 명시하고 있고, target 은 이를 "drift 회귀 (의도적 기각 아님) 의 catch-up" 으로 설명한다. R3 의 "EIA spec 위임 — drift 회피" 원칙에 정확히 부합하는 작업이다. union 종류(5종)는 변하지 않고 기존 variant 의 shape 만 EIA §6.5 에 맞게 보완하는 것이므로 `EiaEvent` 의 의미 경계 원칙과 충돌이 없다.
- **제안**: 특별한 수정 불필요. 다만 `§1.2 도입 문장` ("EIA §6 outbound notification payload 의 5종 union") 을 갱신안에서 그대로 유지한다고 target 이 명시한 점은 긍정적이다.

---

### [INFO] 결정 1 기각 대안 (B) — `conversationThread` 역추론 방식이 이전에 묵시적으로 존재했는지

- **target 위치**: 결정 1 기각 대안 (B) "chat-channel 이 `execution.waiting_for_input` 의 conversationThread 안에 누적된 presentation turn 으로부터 역추론"
- **과거 결정 출처**: `spec/conventions/conversation-thread.md` (참조되는 spec, 직접 검토 대상 아님), `spec/4-nodes/6-presentation/0-common.md`
- **상세**: 기각 대안 (B) 는 "비-blocking presentation 본문은 `conversationThread` 에 영속화되지 않으므로 역추론 자체가 불가능" 이라는 사실 판단에 근거한다. 이 사실은 presentation 노드 spec 에 의존하는데, target 문서 안에서 해당 SoT 에 대한 cross-ref 가 없다. 만약 conversation thread spec 의 Rationale 에 "presentation turn 은 thread 에 기록하지 않는다"는 명시적 결정이 있다면 기각 근거가 더 강해지고, 없다면 검증이 필요한 가정이 된다.
- **제안**: spec 갱신안 또는 Rationale 주석에 "`spec/4-nodes/6-presentation/0-common.md` 또는 `conversation-thread.md` 의 어느 결정이 이 사실의 SoT인지" cross-link 한 줄을 추가할 것을 권장한다. 사실 판단의 근거 출처를 명시해야 후속 변경 시 invariant 유지를 검증할 수 있다.

---

### [INFO] 결정 1 의 "EIA-RL-04 정합" 주장 — R10 과의 세부 정합 확인

- **target 위치**: 결정 1 "EIA-RL-04 (TX commit 후 발송) 보장: `WebsocketService.executionEvents$` Subject 는 `WebsocketService.emitToExecution` 이 단일 sink (실행 엔진 §4.4) 이며 모든 emit 은 TX commit 후 호출됨. NotificationDispatcher after-commit hook 와 동일 contract — R10 정합."
- **과거 결정 출처**: `spec/5-system/14-external-interaction-api.md` R10 (2026-05-21): "`WebsocketService.emitToExecution` 한 곳만 호출 (= 단일 sink)" + "NotificationDispatcher 는 별도 outbox/after-commit hook 으로 트리거"
- **상세**: R10 이 설명한 구조에서 EIA-RL-04 (TX commit 후 발송) 보장의 주체는 "NotificationDispatcher 가 after-commit hook 위에 노출하는 in-process EventEmitter" 경로다. 그런데 target 은 직접 `WebsocketService.executionEvents$` Subject 를 구독하겠다고 명시한다. R8 (2026-05-24) 은 "Fan-out source = `WebsocketService.executionEvents$` RxJS Subject" 가 실제 v1 구조임을 확인했고, `ChatChannelDispatcher` 가 이미 이 경로를 사용한다고 명시한다. 따라서 target 의 주장은 R8 에서 확인된 v1 구조와 일치한다. 다만 R10 의 "Chat Channel 어댑터의 구체 구독 메커니즘은 NotificationDispatcher 가 after-commit hook 위에 노출하는 in-process EventEmitter 의 listener 로 attach" 라는 표현과 R8 의 "Fan-out source = `WebsocketService.executionEvents$` RxJS Subject" 사이의 두 표현이 spec 내에서 병존하고 있다. target 은 R8 의 최신 표현(`WebsocketService.executionEvents$`)을 따르므로 실질적으로 더 정확하다.
- **제안**: 충돌 아님. 다만 R10 의 표현("in-process EventEmitter")과 R8 의 표현("RxJS Subject") 이 spec 에서 병존하는 것은 잠재적 혼란 요인이다. target 의 `14-external-interaction-api.md §R10` 보강 문장에서 이 두 표현의 관계를 명확히 해주면 좋다.

---

## 요약

target 문서는 과거 Rationale 에서 명시적으로 기각된 대안을 무근거로 재도입하거나 합의된 invariant 를 직접 위반하는 부분이 없다. 결정 1 의 `ChatChannelInternalEvent` 별도 type 신설과 `EiaEvent` 5종 union 유지는 consistency-check Round 1 에서 지적된 C-2 (`EiaEvent` 의미 경계 붕괴) 를 명확히 해소하며, 이는 `chat-channel-adapter.md` R3 의 "EIA spec 위임 + drift 회피" 원칙과 정합한다. 결정 2 의 `presentations?` catch-up 은 EIA §6.5 에 이미 존재하는 약속의 type 반영이므로 Rationale 연속성 관점의 위반이 아니다. 네 개의 INFO 항목은 모두 Rationale 보완 제안 수준이며, 기각된 대안의 재도입이나 합의된 원칙 직접 위반에 해당하지 않는다. 전체적으로 Rationale 연속성 위험도는 낮다.

---

## 위험도

LOW
