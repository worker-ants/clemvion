# Rationale 연속성 검토 결과

검토 대상: `plan/in-progress/spec-draft-chat-channel-template-render-outbound.md`
검토 모드: spec draft (--spec)
검토 일자: 2026-05-25

---

## 발견사항

### [WARNING] 영향 평가 §3 항목에 `renderPresentationNode` 잔류 — 최종 결정과 모순
- **target 위치**: spec-draft 문서 §영향 평가 > "chat-channel 어댑터 구현" 불릿 세 번째 항목 (line 206)
  > "새 함수 `renderPresentationNode` 추가 — Telegram/Slack/Discord adapter 모두 구현 의무"
- **과거 결정 출처**: 동일 draft 내 §결정 1 기각 대안 + Round 2 C-6 해소 기록 (line 175, 230); `spec/conventions/chat-channel-adapter.md` Rationale **R-CCA-5 대안 2 기각** ("6함수 인터페이스 drift, 모든 provider 어댑터 contract 변경")
- **상세**: Round 2 C-6 는 "7함수 추가는 R-CCA-5 대안 2 기각 우회"라 판정하고, §결정 1 에서 `renderNode` 시그니처 union 확장으로 해소(`renderPresentationNode` 신설 폐기)했다. 그런데 §영향 평가에는 이전 revision(round 1 C-3 해소 때 반영한 7함수안)의 잔재로 `renderPresentationNode` 추가 문구가 남아 있다. 최종 결정(6함수 유지)과 직접 모순된다. 구현자가 이 항목을 보고 7번째 함수를 신설하면 R-CCA-5 의 기각 대안을 부활시키게 된다.
- **제안**: "새 함수 `renderPresentationNode` 추가 — Telegram/Slack/Discord adapter 모두 구현 의무" 줄을 삭제하고, "`renderNode` 가 `EiaEvent | ChatChannelInternalEvent` union 입력을 수용하도록 시그니처 갱신 (§1.1 표 보강, §1.3 신설)" 으로 교체.

---

### [INFO] `WebsocketService.executionEvents$` 구독 경로를 "R8 catch-up 결정 경로"로 인용하나 R8 원문과 구독 주체 표현이 미세하게 상이
- **target 위치**: spec-draft §결정 1 본문 (line 59)
  > "`WebsocketService.executionEvents$` Subject 를 단일 구독 (이미 R8 catch-up 으로 결정된 경로 — `15-chat-channel.md R8`) 하면서..."
- **과거 결정 출처**: `spec/5-system/15-chat-channel.md` Rationale **R8** — "fan-out source = `WebsocketService.executionEvents$` RxJS Subject — 모든 후속 listener 의 공통 진입. Listener 3종은 별 모듈에 분리." / R10 — "NotificationDispatcher 후 in-process EventEmitter listener 로 attach"
- **상세**: target 은 "ChatChannelDispatcher 가 `executionEvents$` Subject 를 직접 단일 구독" 한다고 기술했으나, R8 의 확정 구조는 `WebsocketService.executionEvents$` 를 fan-out source 로 하되 `ChatChannelDispatcher` 는 `onModuleInit` 1회 subscription 패턴으로 모듈 레벨 구독을 유지하고 **per-trigger listener registry** 로 라이프사이클을 관리한다고 명시한다. target 의 설명이 R8 의 per-trigger registry 정책을 언급하지 않는다. 이것이 기각이나 번복은 아니지만, 구현자가 registry 없이 단순 단일 구독으로 오해할 수 있다.
- **제안**: §결정 1 본문에 "R8 의 per-trigger `ChannelListenerRegistry` 정책 그대로 적용" 한 문장을 추가해 오해를 방지.

---

### [INFO] EIA §R10 보강 내용이 `WebsocketService.executionEvents$` 직접 구독 vs NotificationDispatcher EventEmitter 구독 경로 구분을 생략
- **target 위치**: spec-draft §C. `14-external-interaction-api.md` §R10 보강안 (line 211-213)
  > "chat-channel 어댑터가 `WebsocketService.executionEvents$` Subject 의 EIA outbound 5종 외 이벤트 (예: `execution.node.completed`) 를 sub-filter 로 추가 구독하는 것은 R10 허용 범위..."
- **과거 결정 출처**: `spec/5-system/14-external-interaction-api.md` Rationale **R10** — "실행 엔진은 여전히 `WebsocketService.emitToExecution` 한 곳만 호출 (= 단일 sink). NotificationDispatcher 는 별도 outbox/after-commit hook 으로 트리거. Chat Channel 어댑터는 NotificationDispatcher 가 after-commit hook 위에 노출하는 in-process EventEmitter 의 listener 로 attach."
- **상세**: R10 의 기존 기술에서 Chat Channel 어댑터의 구독 경로는 `WebsocketService.executionEvents$` 직접 구독이 아니라 "NotificationDispatcher 가 노출하는 in-process EventEmitter" 이다. target 의 보강 문장은 어댑터가 `WebsocketService.executionEvents$` 를 직접 구독한다고 기술해, R10 이 이미 결정한 구독 경로 서술과 다른 어법을 사용한다. R8 의 실제 코드 구조(fan-out source = executionEvents$, 어댑터 = 그 위의 listener)를 고려하면 사실과 다를 수 있으나 기각 수준의 충돌은 아니다. 단 R10 보강 문장의 용어를 R8/R10 원문의 용어("NotificationDispatcher 가 노출하는 in-process EventEmitter" 또는 "executionEvents$ Sub-filter")에 맞춰 통일하면 Rationale 연속성이 강화된다.
- **제안**: R10 보강 문장을 "chat-channel 어댑터가 `WebsocketService.executionEvents$` Subject (R8 fan-out source) 의 EIA outbound 5종 외 이벤트를 in-process sub-filter 로 추가 구독하는 것은 R10 허용 범위 — 단일 sink (`WebsocketService.emitToExecution`) 와 facade 계층 분리 원칙은 그대로 유지됨" 으로 조정.

---

## 요약

target 문서는 전반적으로 기존 Rationale 을 잘 인식하고 있다. R-CCA-5 의 "함수 개수 증가 = 모든 provider 어댑터 contract 변경" 기각 결정, R3 의 "EiaEvent type 명은 EIA §6 outbound 5종을 의미" 원칙, R10 의 "단일 sink + 외부 facade" 원칙, EIA §6.1 outbound 화이트리스트 5종 안정성 원칙 모두를 명시적으로 준수하고 R-CCA-7 이라는 신규 Rationale 도 작성했다. 단 §영향 평가 항목에 round 2 이전의 폐기된 결정(`renderPresentationNode` 신설)의 잔류 문구가 있어, 최종 결정(6함수 유지, `renderNode` union 확장)과 직접 모순된다. 이 항목을 수정하지 않으면 구현자가 R-CCA-5 의 명시 기각 대안을 채택하는 결과로 이어질 수 있어 WARNING 으로 분류한다. 나머지 두 항목은 Rationale 용어 정합을 보완하는 INFO 수준이다.

---

## 위험도

MEDIUM
