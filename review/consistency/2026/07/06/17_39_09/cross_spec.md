### 발견사항

없음 — target 문서(`spec/data-flow/8-notifications.md`)와 다른 영역 spec 간의 직접적 충돌을 발견하지 못했다.

검증한 교차 지점과 결과:

1. **데이터 모델**: target §1.1/§2 의 `notification.type` 값 목록(`execution_failed` / `background_failed` / `schedule_failed` / `integration_expired` / `integration_action_required` / `marketplace_update` / `team_invite` / `alert_<rule.type>` 3종)은 `spec/1-data-model.md` §2.19 Notification 엔티티 정의, `codebase/backend/migrations/V052__notification_type_integration_action_required.sql`, `V070__notification_type_alert_breach.sql` 의 CHECK 화이트리스트(10개)와 정확히 일치. `dismissed_at` 컬럼·인덱스 서술도 data-model §2.19 및 인덱스 표(875~876행)와 동일.
2. **API 계약**: target §4.2 의 `POST /notifications/:id/dismiss`, `POST /notifications/dismiss-all` 엔드포인트·응답 shape(`DismissNotificationResponseDto`, `DismissAllNotificationsResponseDto`)이 `spec/2-navigation/9-user-profile.md` §6.2 알림 API 표 및 `spec/2-navigation/_layout.md` §3.1 팝오버 서술과 정합. `mark-all-read`/`unread-count` 등 기존 엔드포인트와도 충돌 없음.
3. **상태 전이**: target §3~§4 의 `is_read`/`dismissed_at` 2차원 상태 모델이 `1-data-model.md` §2.19 필드 설명, `2-navigation/_layout.md` 의 배지 카운트 조건(`is_read=false AND dismissed_at IS NULL`)과 동일 서술.
4. **알림 발사 source 정책**: `integration_expired`(passive) vs `integration_action_required`(active) 분리 원칙이 `2-navigation/4-integration.md` §11.2, `data-flow/5-integration.md`, `4-nodes/1-logic/12-background.md`(`background_failed`), `5-system/4-execution-engine.md`(`background_failed`), `data-flow/9-observability.md`(`alert_<type>`) 전 지점에서 일관되게 상호 참조되며 모순 없음.
5. **WebSocket 계약**: target §2.2/§5, Rationale "WebSocket emit 표기" 의 `notification.new` + `notifications:<userId>` 채널·미구현(Planned) 표기가 `5-system/6-websocket-protocol.md` §4.4, §3.3(M-6 authorizer), §Rationale(958~959행 stale-marking 목록)과 완전히 일치. fail-closed authorizer 선제 배치 근거도 상호 정합.
6. **권한/RBAC**: dismiss/read 는 "본인 알림만" 스코프로, 워크스페이스 role 기반 RBAC 와 별도 축이라 기존 RBAC 매트릭스(`2-navigation/9-user-profile.md` §4.2)와 충돌 여지 없음.
7. **문서 상태 정합**: target 문서 전반이 "구현 현황 주의" 배너로 to-be(Planned) 항목(단일 `notify()` 표면, 이메일 발송, WS emit)을 명시적으로 분리 표기하고 있어, 다른 영역이 이 항목들을 이미 구현된 것처럼 서술하는 곳도 없음(grep 결과 전부 "미구현 (Planned)" 또는 상호 참조 형태로 일관).

### 요약

target 문서는 데이터 모델(enum·컬럼·인덱스), API 엔드포인트, 상태 머신, WebSocket 프로토콜, RBAC, 관련 도메인(Integration/Background/Alerts)의 알림 발사 정책 전 영역에서 다른 spec 파일들과 상호 참조가 정확하고 값이 일치한다. to-be 항목은 "미구현 (Planned)" 표기로 일관되게 격리되어 있어 실제 구현 완료 서술과 혼동을 일으키지 않는다. Cross-spec 관점에서 채택을 막을 요소가 없다.

### 위험도
NONE
