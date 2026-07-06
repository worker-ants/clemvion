### 발견사항

- **[WARNING]** `integration_action_required` 중복 방지 메커니즘 서술이 `4-integration.md §11.2` 와 상충
  - target 위치: `spec/data-flow/8-notifications.md` §1.1 `integration_action_required` 행, §4.4, §Rationale "중복 방지에 dismissed row 포함"
  - 충돌 대상: `spec/2-navigation/4-integration.md` §11.2 `integration_action_required` 절 — "**중복 방지**: `(integration_id, status_reason)` 으로 유니크 판정 — 같은 사유로 같은 통합에 대해 최대 1회. 사용자가 재연결해 `connected` 로 회복하면 dedup 키 리셋."
  - 상세: target 은 실제 구현(`IntegrationActionRequiredNotifier.notify`, 코드 확인 완료)이 `hasRecentByResource(workspaceId, type, resourceId, title, withinMs=24h)` 롤링 24시간 윈도우 dedup 이라고 정확히 기술한다. 반면 `4-integration.md §11.2` 는 "`(integration_id, status_reason)` 영구 UNIQUE + 재연결 시 리셋"이라는, 코드와 다른 메커니즘을 여전히 서술 중이다. 두 문서가 같은 기능의 중복 방지 규칙을 다르게 설명하면 독자가 어느 쪽이 SoT 인지 혼동한다(코드 확인 결과 target 이 정확).
  - 제안: `4-integration.md §11.2` 의 "중복 방지" 문구를 target(§4.4, hasRecentByResource 24h rolling window, dismissed row 포함)에 맞춰 갱신하거나, target 에 "본 24h 윈도우 서술이 §11.2 의 구 서술을 대체하는 canonical 정의"라는 명시적 우선순위 각주를 추가한다.

- **[WARNING]** `Notification.type` Enum 목록 미갱신 — `alert_<rule.type>` 3종 누락
  - target 위치: `spec/data-flow/8-notifications.md` §1.1 `alert_<rule.type>` 행 ("V070 마이그레이션으로 해소됨: `alert_failure_rate`/`alert_duration`/`alert_llm_cost` 3개 값이 화이트리스트에 추가됨")
  - 충돌 대상: `spec/1-data-model.md` §2.19 Notification — `type` 필드 설명이 `execution_failed / background_failed / schedule_failed / integration_expired / integration_action_required / marketplace_update / team_invite` 7개만 열거하고 `alert_*` 3종이 없다.
  - 상세: `codebase/backend/migrations/V070__notification_type_alert_breach.sql` 을 확인한 결과 실제 DB CHECK 제약은 10개 값(`alert_failure_rate`/`alert_duration`/`alert_llm_cost` 포함)이다. target 문서는 이를 정확히 반영하지만, data-model.md §2.19 는 여전히 V052 시점(7개)에 머물러 있어 데이터 모델 SoT 가 실제 스키마·target 문서와 불일치한다.
  - 제안: `spec/1-data-model.md §2.19` 의 `type` Enum 열거에 `alert_<rule.type>` (동적 패턴, 구체값 3종) 을 추가한다. project-planner 가 target 승인 시 함께 갱신 권장.

### 요약

target 문서(`spec/data-flow/8-notifications.md`)는 실제 코드(알림 dedup 로직, V070 마이그레이션 등)를 정확히 반영하고 있으며, `spec/5-system/6-websocket-protocol.md §4.4`, `spec/2-navigation/9-user-profile.md §5.1/§6.2`, `spec/2-navigation/_layout.md §3.1`, `spec/data-flow/9-observability.md` 등 대부분의 인접 spec 과 API 계약·상태 전이·딥링크 매핑·채널 정책 면에서 잘 정합된다. 다만 두 지점에서 target 이 정확해진 반면 함께 갱신되지 않은 다른 영역 문서가 남아 잠재적 혼동을 야기한다 — (1) `4-integration.md §11.2` 의 `integration_action_required` 중복 방지 서술이 구 메커니즘("영구 UNIQUE + 재연결 리셋")을 그대로 유지해 target 의 정확한 24h rolling window 서술과 부딪히고, (2) `1-data-model.md §2.19` 의 `Notification.type` Enum 열거가 V070(alert_* 3종 추가)을 반영하지 못해 실제 DB 제약·target 문서보다 뒤처져 있다. 둘 다 즉각적인 기능 장애를 유발하지는 않지만(코드가 실제로는 target 서술대로 동작), spec 간 명시적 모순이므로 후속 문서에서 동기화가 필요하다.

### 위험도
MEDIUM
