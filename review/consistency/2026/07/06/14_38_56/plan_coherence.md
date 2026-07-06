### 발견사항

- **[WARNING]** `notification.new` emit 미구현 항목이 두 plan 에 중복 추적 — PR1 완료 시 자매 plan 갱신 누락 위험
  - target 위치: `spec/data-flow/8-notifications.md` §1 다이어그램·§1 단계표·§2.2·Rationale "WebSocket emit 표기" (WS emit 을 미구현으로 서술), 및 이를 소비하는 `plan/in-progress/spec-sync-data-flow-8-notifications-gaps.md`(PR1 착수 섹션, 2026-07-06 추가분)
  - 관련 plan: `plan/in-progress/spec-sync-websocket-protocol-gaps.md` 미구현 항목 4번째 줄 — `notifications:{userId}` 채널의 `notification.new` emit 경로 (§4.4)
  - 상세: 같은 "`notification.new` emit 미구현" gap 이 두 개의 독립 in-progress plan 문서에 각각 체크박스로 등재되어 있다 (`spec-sync-data-flow-8-notifications-gaps.md` 미구현 항목 4번째 줄 "WebSocket `notification.new` emit" / `spec-sync-websocket-protocol-gaps.md` 미구현 항목 4번째 줄). 금번 착수(PR1)는 `WebsocketService.emitNotificationEvent` 구현 + 4개 호출자 emit 경유를 목표로 명시했으나, 착수 섹션·미구현 항목 체크박스 갱신은 `spec-sync-data-flow-8-notifications-gaps.md` 만 대상으로 하고 있다. PR1 이 실제로 머지되면 `spec-sync-websocket-protocol-gaps.md` 의 동일 항목도 함께 체크되거나 제거돼야 하는데, 현재 착수 계획에는 그 자매 plan 갱신이 언급되지 않았다 — 후속 세션이 두 plan 을 별도로 인지하지 못하면 하나는 "완료"로, 하나는 "미구현"으로 stale 남을 위험이 크다(선례: MEMORY 의 "banner flip 시 본문·표·data-flow 미러 stale" 교훈과 동일 패턴).
  - 제안: PR1 구현 완료(`--impl-done`) 시점에 `spec-sync-websocket-protocol-gaps.md` 의 `notification.new` emit 체크박스도 함께 체크(또는 완료 노트 교차 참조)하도록 두 plan 문서에 상호 참조를 추가. 이번 착수 섹션에 "완료 시 `spec-sync-websocket-protocol-gaps.md` §해당 항목도 동기 갱신" 한 줄을 남겨두는 것을 권장.

- **[INFO]** PR1 의 emit 도입이 §4.6 follow-up(멀티 디바이스 read/dismiss 동기화)의 전제를 일부 충족하나 plan 에 미반영
  - target 위치: `spec/data-flow/8-notifications.md` §4.6 "WebSocket 동기화 (follow-up)" — `notification.read`/`notification.dismissed` 이벤트 신설을 follow-up phase 로 남겨둠
  - 관련 plan: `plan/in-progress/spec-sync-data-flow-8-notifications-gaps.md` PR1 범위 ("`notification.new` WS emit" 만 명시, read/dismissed 이벤트는 범위 외)
  - 상세: PR1 이 `WebsocketService.emitNotificationEvent` 인프라(채널 authorizer, gateway 배선)를 최초로 만드는 것이라면, §4.6 이 예정한 `notification.read`/`notification.dismissed` 후속 이벤트도 같은 인프라를 재사용할 가능성이 높다. 결정을 우회하는 것은 아니지만, PR1 완료 후 §4.6 후속 착수 시 "이미 emit 인프라 있음"을 반영하도록 최소한의 메모가 있으면 후속 작업 스코프 산정에 도움이 된다 — 현재 target/plan 어디에도 이 연결 관계가 명시돼 있지 않다.
  - 제안: 필수는 아니나, PR1 완료 노트에 "emit 인프라(`emitNotificationEvent`, authorizer) 는 §4.6 후속(`notification.read`/`dismissed`)이 재사용 가능"이라는 한 줄을 남기면 추적성이 좋아진다.

### 요약

이번 target(`spec/data-flow/8-notifications.md`)은 실제로는 변경되지 않았고, 실질적인 diff 는 그 spec 을 추적하는 `plan/in-progress/spec-sync-data-flow-8-notifications-gaps.md` 에 developer 착수(PR1/PR2/PR3 분할) 섹션이 추가된 것이다. PR1 의 범위(`notify()` 단일 표면 + WS emit)는 spec 본문의 "미구현(Planned)" 서술 및 WebSocket 프로토콜 spec §4.4 의 권위 있는 이벤트 정의와 정합하며, marketplace_update 를 범위 밖으로 명시한 것도 마켓플레이스 plan 에 알림 관련 의존이 없어 문제 없다. 다만 `notification.new` emit 미구현이라는 동일 gap 이 `spec-sync-websocket-protocol-gaps.md` 에도 독립적으로 등재돼 있어, PR1 완료 시 그 자매 plan 의 동기 갱신이 누락될 위험이 있다(WARNING). 미해결 결정을 일방적으로 우회하는 CRITICAL 급 충돌은 발견되지 않았다.

### 위험도
LOW
