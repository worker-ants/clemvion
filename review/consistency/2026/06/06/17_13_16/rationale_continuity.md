# Rationale 연속성 검토 결과

검토 대상: `spec/5-system/14-external-interaction-api.md`
검토 모드: --impl-prep (구현 착수 전 검토)
검토 일시: 2026-06-06

---

## 발견사항

- **[INFO]** EIA 자체 Rationale 은 풍부하고 일관됨 — 기각 대안 명시
  - target 위치: `## Rationale` R1~R12 전체
  - 과거 결정 출처: 해당 없음 (EIA spec 자체 내부 일관성)
  - 상세: EIA 문서는 자체 R1(두 채널 분리), R2(notification 응답 인터랙션 미채택), R3(SSE 채택), R4(per_execution 기본), R5(외부 WS 보류), R6(자동 비활성화 금지), R7(seq 공유), R8(idempotency 캐시 제외 정책), R9(위치), R10(단일 sink 확장), R11(prefix 분리), R12(HMAC 표기 분리)를 모두 명시적 근거와 기각 대안과 함께 서술하고 있다. 정합성 자체는 견고하다.
  - 제안: 없음.

- **[INFO]** `execution-engine.md §4.4` Rationale — 단일 sink 정책과의 정합
  - target 위치: `## Rationale R10` (§825~951)
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md §4.4` — "이벤트 발행 sink — `WebsocketService` 단일 sink 정책" + "향후 외부 sink 추가 시 재검토" 선언
  - 상세: EIA R10 은 이 재검토를 명시적으로 인용하고 "엔진 레벨 단일 sink 유지 + 외부 facade 레이어" 결정을 내리며 기각된 대안(NotificationDispatcher 를 엔진 내부에서 직접 호출)도 명시한다. 과거 결정과 완전히 정합한다. 단, `execution-engine.md §4.4` 의 "향후 외부 sink 추가 시 재검토" 문장이 이제 이 EIA R10 에 의해 정식 완결됐음을 execution-engine spec 에 back-reference 가 명시되어 있는지 확인이 필요하다 (execution-engine spec 내 §4.4 에 이미 EIA §R10 cross-link가 있음 — 정합 확인됨).
  - 제안: 없음. 이미 execution-engine.md §4.4 마지막 문단에 EIA §R10 링크가 존재한다.

- **[INFO]** `12-webhook.md` Rationale — inline auth 폐지 결정과 EIA 신규 config 필드의 관계
  - target 위치: `§7.1 Trigger 엔티티 확장` config JSONB 주석 (line 598~617)
  - 과거 결정 출처: `spec/5-system/12-webhook.md §Rationale "inline auth path 폐지 — AuthConfig 단일 진입"`
  - 상세: EIA §7.1 의 `config` JSONB 확장 주석이 "인증은 `trigger.auth_config_id` 단일 진입, 옛 inline auth 필드는 폐지됐고 V066 cleanup migration 으로 제거된다" 를 명시하며 12-webhook Rationale 을 SoT 로 참조한다. 기각된 inline auth 재도입 없음 — 정합.
  - 제안: 없음.

- **[INFO]** `0-overview.md` Rationale — 실행 엔진 Redis 큐 + 분산 워커 풀 결정과 SSE 단일 인스턴스 현황의 관계
  - target 위치: `§10 구현 파일 구조` + `§R10` (line 944~946, sse-adapter.service.ts 설명)
  - 과거 결정 출처: `spec/0-overview.md §Rationale "실행 엔진: Redis 큐 + 분산 워커 풀 (§2.4)"` — 멀티 인스턴스·수평 확장 요구
  - 상세: EIA spec 은 SSE 어댑터가 현재 "in-process(in-memory) 직접 구독 — 다중 인스턴스에서 외부 SSE 클라이언트가 임의 인스턴스에 접속 시 이벤트를 받지 못할 수 있음" 이라고 명시하고 이를 `Planned (미구현)` 으로 표기한다. 이는 0-overview Rationale 의 "수평 확장" 원칙과 잠재적 긴장이 있으나, spec 자체에 명시적으로 `미구현 한계를 인식한 채 v1 single-instance 로 시작하고 Redis pub/sub 분산화를 follow-up` 으로 명기하여 — 결정을 번복하는 것이 아니라 단계적 구현 계획으로 처리했다. 이는 WARNING 수준의 번복이 아닌 INFO 수준의 알림이다.
  - 제안: SSE 분산화 Planned 항목의 plan 파일이 존재하는지, 혹은 `plan/in-progress/` 에 추적 항목이 있는지 확인 권장. 실제 구현 착수 시 Redis pub/sub 도입 결정을 별도 Rationale 항으로 추가할 것.

- **[INFO]** `spec/2-navigation/2-trigger-list.md` Rationale R-4 — `isActive` PATCH body 단일 경로와 EIA trigger 관리 endpoint 의 관계
  - target 위치: `§3.1 EIA-NX-06` + `§3.1 EIA-NX-07` — notification health 및 trigger 비활성화 금지 정책
  - 과거 결정 출처: `spec/2-navigation/2-trigger-list.md §Rationale R-4` — `PATCH /api/triggers/:id { isActive }` 단일 경로, `/toggle` 미채택
  - 상세: EIA §R6 이 "notification 실패 시 trigger 자동 비활성화 금지" 를 명시하고 12-webhook WH-MG-04 ("활성/비활성 토글은 사용자 명시 토글 한정") 와 정합한다. EIA 는 notification failure 시 `notificationHealth=degraded` 만 기록하고 trigger 자체를 건드리지 않아 2-trigger-list R-4 의 "PATCH body 단일 경로" 결정과 충돌하지 않는다.
  - 제안: 없음.

---

## 요약

`spec/5-system/14-external-interaction-api.md` 는 관련 spec 들(`0-overview`, `1-data-model`, `4-execution-engine`, `12-webhook`, `2-navigation/2-trigger-list`)의 기존 Rationale 에서 기각된 대안(inline auth 부활, NotificationDispatcher 의 엔진 직접 호출, per-node task queue, 외부 WebSocket 신설, notification 응답으로 인터랙션 수신)을 재도입하지 않으며, 합의된 설계 원칙(단일 sink 정책, AuthConfig 단일 진입, forward-only 정책, HMAC 표기 분리)을 준수한다. EIA 자체 Rationale 도 R1~R12 전 항목에서 기각 대안을 명시하고 있다. SSE 어댑터의 single-instance 한계는 `Planned (미구현)` 으로 명시되어 0-overview의 수평 확장 원칙과의 긴장을 인식하고 있으나, 이는 의도적 단계 결정으로 새 Rationale 없이 원칙을 번복하는 것이 아니다. Rationale 연속성 관점에서 Critical 또는 Warning 수준의 위반 사항은 발견되지 않았다.

---

## 위험도

NONE
