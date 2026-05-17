# Cross-Spec 일관성 검토 결과

> 검토 대상: `spec/data-flow/` (구현 착수 전 --impl-prep)
> 검토 시각: 2026-05-17

---

## 발견사항

### 1.

- **[CRITICAL]** `spec/data-flow/8-notifications.md` 가 `integration_action_required` 타입을 "향후 신설 검토 대상"으로 표기하고 있으나, 이미 확정된 spec 에서 기존 타입으로 등록되어 있음
  - target 위치: `spec/data-flow/8-notifications.md §1.1` Type 별 source·트리거 표 (`integration_expired` 행 내 주석)
  - 충돌 대상:
    - `spec/1-data-model.md §2.19 Notification.type` — `integration_action_required` 를 **확정 Enum 값**으로 등재 (bold 표기, A-1 결정 명시)
    - `spec/2-navigation/4-integration.md §11.2` — `integration_action_required` 의 발사 조건·메시지·수신자·채널을 **정식 spec** 으로 완전 정의 (A-1 신설, 2026-05-16)
    - `spec/data-flow/5-integration.md §4 외부 의존` — Notifications cross-ref 에 `integration_expired` 만 기재; `integration_action_required` 누락
  - 상세: `8-notifications.md §1.1` 의 `integration_expired` 행 주석은 "향후 `error` 도메인 알림 필요 시 `integration_action_required` 타입 신설 검토" 라고 쓰여 있어 미결 상태처럼 보인다. 그러나 `1-data-model.md` 와 `4-integration.md` 는 이미 2026-05-16 A-1 결정으로 `integration_action_required` 를 **확정**했고, 발사 source (`Cafe24ApiClient.markAuthFailed` / `recordNetworkFailure`), 중복 방지 키 (`integration_id, status_reason`), 채널 정책까지 명세가 완성되어 있다. `8-notifications.md §1.1` 만 이 결정을 반영하지 못하고 있어 구현자가 type 표를 읽으면 `integration_action_required` 를 신설 필요 타입으로 오인한다. 또한 `5-integration.md §4` 외부 의존 표도 `integration_expired` 만 언급해 동일 정보 누락.
  - 제안:
    - `spec/data-flow/8-notifications.md §1.1` 표에 `integration_action_required` 행 추가 (source: `Cafe24ApiClient.markAuthFailed` / `recordNetworkFailure`, 발사 조건: `error(auth_failed)` / `error(insufficient_scope)` / `error(network)` 전이 시, 2026-05-16 A-1 결정 참조).
    - 기존 `integration_expired` 행의 "신설 검토" 문구를 "A-1 결정으로 `integration_action_required` 타입 신설 완료 — §1.1 별도 행 참조" 로 정정.
    - `spec/data-flow/5-integration.md §4` 외부 의존 표 Notifications 행에 `integration_action_required` 추가.

---

### 2.

- **[CRITICAL]** WebSocket 이벤트 이름이 `8-notifications.md` 와 `6-websocket-protocol.md` 간 불일치 (`:` vs `.` 구분자)
  - target 위치: `spec/data-flow/8-notifications.md` — 코드 진입점 주석 (`notification:new`), Mermaid 다이어그램 (`emit 'notification:new'`), Schema 매핑 표 (`notification:new` emit)
  - 충돌 대상: `spec/5-system/6-websocket-protocol.md §4.4` — 알림 이벤트 표에 **`notification.new`** (점 구분자) 로 정의
  - 상세: 두 spec 이 동일 이벤트를 각각 `notification:new` (콜론)와 `notification.new` (점)으로 표기하고 있다. 구현 시 Socket.io 이벤트 리스너 등록 이름이 어느 쪽인지 판단 기준이 없다. 또한 `8-notifications.md §4.6` 후속 이벤트 제안도 `notification.read`, `notification.dismissed` (점 구분자) 로 쓰여, 같은 문서 내에서 `notification:new` (콜론) 와 혼재한다.
  - 제안:
    - 코드베이스(`backend/src/modules/websocket/websocket.service.ts` 등)의 실제 구현이 진실이므로 코드를 먼저 확인해 통일 기준을 정한다.
    - 정한 기준으로 `6-websocket-protocol.md §4.4` 와 `8-notifications.md` 의 이벤트 이름을 한 쪽으로 일치시킨다.
    - `8-notifications.md §4.6` 의 후속 이벤트 제안도 동일 구분자 관례로 통일.

---

### 3.

- **[CRITICAL]** WebSocket 구독 채널명이 `8-notifications.md` 와 `6-websocket-protocol.md` 간 불일치
  - target 위치: `spec/data-flow/8-notifications.md` — Mermaid 다이어그램 및 Schema 매핑 표 (`user:<userId>` room)
  - 충돌 대상: `spec/5-system/6-websocket-protocol.md §4.4` — 채널 `notifications:{userId}` 로 정의
  - 상세: `8-notifications.md` 는 알림을 `user:<userId>` room 에 emit 한다고 하고, `6-websocket-protocol.md §4.4` 는 채널을 `notifications:{userId}` 로 정의한다. 두 채널은 완전히 다른 소켓 room 이름이다. 구현자가 두 spec 을 동시에 참조하면 서버의 emit 대상 room 과 클라이언트의 subscribe 채널이 어긋나 알림이 전달되지 않는다.
  - 제안: 코드베이스 실제 구현을 확인해 진실 채널명을 결정한 후, `8-notifications.md` 와 `6-websocket-protocol.md §4.4` 를 동일 채널명으로 일치시킨다.

---

### 4.

- **[WARNING]** `spec/1-data-model.md §2.1 User` 엔티티에 `notification_preferences` 컬럼 누락
  - target 위치: `spec/data-flow/8-notifications.md §1` (Source → Sink 다이어그램, V010 참조), `§2.1` Schema 매핑 표, `§5` 외부 의존, `§ Rationale`
  - 충돌 대상: `spec/1-data-model.md §2.1 User` — `notification_preferences` 컬럼 미기재. `2-navigation/4-integration.md §11.3` 에도 `notifyIntegrationExpiryByEmail` 토글이 user 프로필 설정에 있다고 기술됨.
  - 상세: `8-notifications.md` 는 `user.notification_preferences JSONB (V010)` 을 read 경로로 명시하고, 이 필드가 존재·작동한다고 전제한다. 그러나 `1-data-model.md §2.1` 의 User 엔티티 표에는 해당 컬럼이 없다. 구현자가 data-model 을 기준으로 User 엔티티를 정의하면 `notification_preferences` 가 빠지고, notifications 서비스가 SELECT 시 컬럼 부재로 런타임 오류가 발생한다.
  - 제안: `spec/1-data-model.md §2.1 User` 표에 `notification_preferences | JSONB | 알림 채널별 사용자 설정 (V010, 누락 키는 default true 해석)` 행을 추가한다.

---

### 5.

- **[WARNING]** `spec/data-flow/5-integration.md` 의 OAuth 만료 스캐너 다이어그램이 `integration_action_required` 알림 발사를 누락하고 있음
  - target 위치: `spec/data-flow/5-integration.md §1.4` OAuth 만료 스캐너 Mermaid 다이어그램 및 §4 외부 의존 표
  - 충돌 대상: `spec/2-navigation/4-integration.md §11.2` — `integration_action_required` 발사 정책 (source: `Cafe24ApiClient.markAuthFailed` / `recordNetworkFailure`)
  - 상세: `5-integration.md §1.4` 의 Mermaid 다이어그램에서 `connected-expiry` job 이 `invalid_grant` 케이스를 `status='error', status_reason='auth_failed'` 로 전이하는 경로는 표현되어 있으나, 이 전이에서 `NotificationsService` 로의 `integration_action_required` 알림 발사 호출이 누락되어 있다. 같은 다이어그램에서 `integration_expired` 는 `Scan->>Noti: notify integration_expired` 로 명시한다. `network` 전이 경로도 동일하게 알림 발사 호출이 없다. 또한 §4 외부 의존 표의 Notifications 행에는 `integration_expired` 만 기재.
  - 제안:
    - `5-integration.md §1.4` 다이어그램에서 `error(auth_failed)` / `error(network)` 전이 분기에 `Scan->>Noti: notify integration_action_required` 화살표 추가.
    - §4 외부 의존 표 Notifications 행 설명을 `integration_expired` + `integration_action_required` 로 확장.

---

### 6.

- **[INFO]** `spec/data-flow/8-notifications.md §1.1` `integration_expired` 행의 채널 토글 키 이름이 `4-integration.md` 와 표기 방식이 다름
  - target 위치: `spec/data-flow/8-notifications.md §1.1` — `user.notification_preferences.integrationExpiryEmail`
  - 충돌 대상: `spec/2-navigation/4-integration.md §11.3` — `notifyIntegrationExpiryByEmail` (동일 키를 다른 속성명 형태로 언급)
  - 상세: 두 spec 이 같은 토글을 `integrationExpiryEmail` 과 `notifyIntegrationExpiryByEmail` 로 달리 표기한다. JSONB 키의 실제 이름이 하나여야 하므로 어느 쪽이 코드 기준인지 확인 필요.
  - 제안: 코드베이스(`user.entity.ts` 또는 migration) 의 실제 키를 확인해 두 spec 표기를 일치시킨다. `1-data-model.md §2.1` 에 컬럼이 추가(상기 #4 제안)될 때 키 이름도 함께 명시한다.

---

## 요약

`spec/data-flow/` 전반은 다른 영역 spec 과 큰 틀에서 일관성을 유지하고 있으나, 두 개의 CRITICAL 이슈가 구현 착수 전에 반드시 해소되어야 한다. 첫째, `8-notifications.md §1.1` 이 `integration_action_required` 타입을 "신설 검토 대상"으로 표기해 2026-05-16 A-1 결정(이미 `1-data-model.md` 와 `4-integration.md` 에 반영)과 직접 모순된다 — 구현자가 type 표를 그대로 따르면 해당 알림 발사 로직을 누락한다. 둘째, WebSocket 이벤트 이름(`notification:new` vs `notification.new`)과 채널명(`user:<userId>` vs `notifications:{userId}`)이 `8-notifications.md` 와 `6-websocket-protocol.md` 간 어긋나 소켓 통신 자체가 작동하지 않을 수 있다. 추가로 `1-data-model.md §2.1 User` 에 `notification_preferences` 컬럼 누락(WARNING)과 `5-integration.md` 다이어그램의 `integration_action_required` 알림 발사 경로 누락(WARNING)이 있으며, 채널 토글 키 이름 표기 불일치(INFO) 도 동기화가 필요하다.

## 위험도

HIGH
