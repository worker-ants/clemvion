# Rationale 연속성 검토 결과

검토 모드: spec draft (--spec)
대상 문서: `plan/in-progress/chat-channel-template-render-outbound.md`

---

## 발견사항

### [WARNING] CCH-AD-06 구독 source 표현 — `websocketService.executionEvents$` vs NotificationDispatcher EventEmitter 혼용

- **target 위치**: 결정 1 근거 2번째 bullet (`websocketService.executionEvents$ Subject 안에 이미 node.completed 가 흐름`) + 결정 1의 `EiaNodeCompletedEvent` type 정의 주석 (`WS Subject 의 execution.node.completed 이벤트를 ... 구독`) + CCH-AD-06 요구사항 본문 (`in-process WS Subject`)

- **과거 결정 출처**:
  - `spec/5-system/15-chat-channel.md §3.2` — "어댑터의 outbound subscription 은 **NotificationDispatcher 가 노출하는 in-process EventEmitter** 의 listener 로 attach"
  - `spec/5-system/15-chat-channel.md R8 (2026-05-24)` — 실제 코드는 `WebsocketService.executionEvents$` RxJS Subject 를 Fan-out source 로 사용하며 `ChatChannelDispatcher` 가 이를 직접 구독함을 catch-up 으로 명시
  - `spec/5-system/14-external-interaction-api.md R10` — chat-channel 어댑터의 구독 메커니즘을 "NotificationDispatcher 가 after-commit hook 위에 노출하는 in-process EventEmitter" 로 기술

- **상세**: R8 (2026-05-24) 는 실제 구현 구조를 catch-up 하면서 Fan-out source 가 `WebsocketService.executionEvents$` RxJS Subject 임을 명시했다. 이는 R10 의 "NotificationDispatcher 의 in-process EventEmitter" 기술과 표면상 다른 표현이다 — R8 은 이 두 표현이 같은 것을 가리키지 않음을 암묵적으로 보여준다. 중요한 사실은 `execution.node.completed` 가 EIA §6.1 outbound notification 화이트리스트 5종에 속하지 않으므로 NotificationDispatcher 의 EventEmitter 경로에는 흐르지 않고, `WebsocketService.executionEvents$` Subject 에만 흐른다. target 의 CCH-AD-06 이 `websocketService.executionEvents$` 를 구독하는 설계 선택은 기술적으로 옳다. 그러나 결정 1 근거에서 "NotificationDispatcher 와 동일 in-process facade 계층" 이라 설명하면서 바로 뒤에 `websocketService.executionEvents$` Subject 를 언급하면, 두 경로가 같은 것인 양 혼용된 인상을 준다. R10 의 공식 기술(어댑터는 NotificationDispatcher EventEmitter 를 구독)과 R8 의 실제 구현 catch-up(`WebsocketService.executionEvents$` 직접 구독) 사이에 미해소된 표현 불일치가 남아 있는 상태에서 target 이 새 요구사항을 추가하고 있어, 구현자가 어느 경로를 써야 하는지 모호해질 수 있다.

- **제안**:
  1. target 의 결정 1 근거를 "ChatChannelDispatcher 는 이미 `WebsocketService.executionEvents$` Subject 를 구독하고 있으므로 (15-chat-channel.md R8 catch-up) 동일 Subject 에서 `node.completed` filter 를 추가하면 충분하다" 식으로 R8 을 명시 인용해 단일 경로를 명확히 한다.
  2. 또는 CCH-AD-06 요구사항 본문에서 "in-process WS Subject (`WebsocketService.executionEvents$` — R8 참조)" 처럼 근거를 직접 링크한다.
  3. spec 갱신 시 R10 과 R8 의 표현 불일치 자체를 해소하는 후속 spec PR 도 권장 (본 plan scope 는 아님).

---

### [WARNING] CCH-AD-06 — EIA-RL-04 (TX commit 후 발송) 보장 여부 미기술

- **target 위치**: 결정 1 근거, §Spec 갱신안 A §3 매핑 표 `execution.node.completed` 행, CCH-AD-06 요구사항

- **과거 결정 출처**:
  - `spec/5-system/14-external-interaction-api.md EIA-RL-04` — "Notification 발송과 SSE emit 은 트랜잭션 commit 이후 시점에서만 수행" (필수)
  - `spec/5-system/14-external-interaction-api.md R10` — "외부 HTTP notification 와 어댑터의 채널 emit 은 같은 after-commit hook 에서 fan-out 되어 EIA-RL-04 (TX commit 후 발송) 정합"
  - `spec/5-system/15-chat-channel.md §3.2` — "어댑터가 엔진 내부 코드를 호출하지 않음 — facade 원칙 유지"

- **상세**: 기존 CCH-AD-05 (5종 이벤트) 는 NotificationDispatcher 의 after-commit hook 경유이므로 EIA-RL-04 가 자연스럽게 보장된다. 그런데 target 이 제안하는 CCH-AD-06 (`execution.node.completed` 구독) 은 `WebsocketService.executionEvents$` Subject 를 직접 구독하는 경로다. `WebsocketService.emitToExecution` 이 엔진 §4.4 단일 sink 이고, 이 emit 이 TX commit 후에 발생하는지는 `WebsocketService` 구현에 달려 있다. target 문서에는 이 경로에서 EIA-RL-04 가 유지됨을 명시하지 않았다. Rationale 에서 합의된 "TX commit 후 발송" invariant 가 새 구독 경로에서도 보장된다는 기술이 없다.

- **제안**: CCH-AD-06 요구사항 또는 결정 1 근거에 "WebsocketService 의 `executionEvents$` emit 은 엔진 §4.4 단일 sink 로서 TX commit 후에만 호출됨 — EIA-RL-04 정합" 문장을 추가한다. 이미 사실이라면 명시만으로 충분하고, 불확실하다면 spec 갱신 전 실행 엔진 §4.4 코드 경로 확인 후 기술.

---

### [WARNING] 결정 2 채택 — EIA §6.5 line 536 약속이 "이미 존재"임에도 기존 spec 에 CCH-AD-05 / CCH-MP-01 이 이를 반영하지 않은 누락 경위 미기술

- **target 위치**: 결정 2 근거 첫 번째 bullet ("EIA spec §6.5 가 이미 presentations? PresentationPayload[] 필드 약속 — chat-channel 이 무시하는 게 spec 위반")

- **과거 결정 출처**:
  - `spec/5-system/15-chat-channel.md CCH-MP-01` (현행) — "AI Multi Turn 의 execution.ai_message → 채널 텍스트 메시지 1건 이상으로 변환" — presentations[] 처리 없음
  - `spec/conventions/chat-channel-adapter.md §3 매핑 표` — execution.ai_message 행 출력이 text 1건만 정의

- **상세**: target 은 기존 CCH-MP-01 이 EIA §6.5 line 536 의 `presentations?` 약속을 명시하지 않은 것을 "명백한 회귀" (spec 위반) 로 진단했다. 이는 과거 결정이 번복되는 게 아니라 spec gap 을 채우는 올바른 방향이다. 그러나 CCH-MP-01 이 작성될 때 EIA §6.5 line 536 약속이 이미 존재했는지, 아니면 나중에 EIA 가 먼저 갱신되고 CCH-MP-01 이 미따라간 것인지에 대한 경위 기술이 없다. 이 경위가 불분명하면 "EIA 가 약속한 것을 chat-channel 이 무시" 라는 표현이 CCH-MP-01 작성자의 의도적 설계 선택처럼 오해될 수 있다. Rationale 연속성 관점에서 "의도적 미반영이 아니라 gap" 임을 확인하는 배경 기술이 필요하다.

- **제안**: 결정 2 근거에 "CCH-MP-01 최초 작성 시점(또는 EIA §6.5 line 536 최초 도입 시점)과 본 gap 발생 경위" 한 줄을 추가한다. 예: "CCH-MP-01 이 작성될 때 EIA §6.5 의 presentations 약속이 선행·동시 도입되었으나 chat-channel spec 연동이 누락된 것으로, 의도적 기각 아님."

---

### [INFO] 결정 1 기각 대안 (B) — conversationThread 역추론 기각 사유가 기존 Rationale 에 없음 (신규 기각이므로 문서화 보완 권장)

- **target 위치**: 결정 1 기각 대안 (B) "chat-channel 이 waiting_for_input 의 conversationThread 안에 누적된 presentation 노드 turn 으로부터 역추론"

- **과거 결정 출처**: 해당 없음 — 이전 Rationale 에 이 대안의 채택·기각 기록 없음.

- **상세**: (B) 는 완전히 신규 검토 대안이며, Rationale 에 과거 기록이 없어 연속성 충돌은 아니다. 단, 기각 사유가 "복잡 + 순서 모호 + Template 본문이 thread 에 들어가지 않는 케이스 존재" 로 간략하게만 기술되어 있다. 향후 비슷한 시도가 재현될 때를 대비해 기각 사유를 target 의 결정 Rationale 에 좀 더 구체적으로 남기면 좋다.

- **제안**: target 문서 또는 향후 spec 의 Rationale 절에 "비-blocking presentation 본문은 conversationThread 에 영속화되지 않으므로 역추론 자체가 불가능한 케이스가 존재" 를 명시. 현 표현으로도 허용 수준이나 보강 시 미래 reviewer 편의 향상.

---

### [INFO] CCH-MP-01 갱신 — presentations[] 발송 순서 ("text → presentations[0] → presentations[1] → ...") 신규 정의, 기존 순서 원칙과 충돌 없음 확인 필요

- **target 위치**: §Spec 갱신안 A §3 매핑 표 `execution.ai_message` 갱신 행 — "발송 순서: text → presentations[0] → presentations[1] → ..."

- **과거 결정 출처**: 해당 순서 정책을 명시한 기존 Rationale 없음 (신규 정의).

- **상세**: 신규 정의이므로 기존 결정과 직접 충돌하지는 않는다. 그러나 발송 순서가 엄격히 보장되어야 하는지 (순차 await) 또는 best-effort 인지가 명시되지 않았다. CCH-NF-02 (200ms 이내 처리) 와의 관계도 미기술. presentations[] 가 많을 때 순차 발송이 200ms 시한을 초과할 가능성이 있다.

- **제안**: 발송 순서 정책에 "순차 await (각 sendMessage 성공 후 다음 발송)" 또는 "best-effort 병렬 (순서 힌트 only)" 를 명시. CCH-NF-02 와의 관계 (presentations 추가 발송은 CCH-NF-02 의 200ms 측정 범위 포함/제외) 도 한 줄 보강 권장.

---

## 요약

target 문서는 전반적으로 기존 Rationale 의 핵심 원칙들 — EIA §6.1 outbound 화이트리스트 5종 불변, EIA §R10 단일 sink + 외부 facade 원칙, EIA §6.5 의 presentations 약속 이행 — 을 충실히 따르고 있으며, 기각된 대안들도 재도입하지 않는다. 다만 결정 1 이 `websocketService.executionEvents$` Subject 를 구독 source 로 사용하면서 "NotificationDispatcher 와 동일 facade 계층" 이라 설명하는 부분에서 R10 의 공식 표현(NotificationDispatcher EventEmitter)과 R8 의 실제 구현 catch-up(WS Subject 직접 구독) 사이에 해소되지 않은 표현 불일치를 그대로 계승했고, 새 구독 경로에서 EIA-RL-04 (TX commit 후 발송) 보장 여부를 명시하지 않은 점이 WARNING 수준의 보완 필요 사항이다. 두 건 모두 설계 의도 자체를 번복하는 것이 아니라 기술 명세의 정밀도 문제이므로 구현 착수 전 명시 보강으로 해소 가능하다.

## 위험도

MEDIUM
