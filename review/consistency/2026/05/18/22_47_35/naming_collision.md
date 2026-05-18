# 신규 식별자 충돌 Check — naming_collision

검토 대상: `spec/data-flow/8-notifications.md`
검토 모드: spec draft 검토 (--spec)

---

### 발견사항

- **[INFO]** `DismissNotificationResponseDto` · `DismissAllNotificationsResponseDto` — 기존 DTO 와 직접 충돌 없음, 형태(shape) 중복 주의
  - target 신규 식별자: `DismissNotificationResponseDto`, `DismissAllNotificationsResponseDto`
  - 기존 사용처: `spec/data-flow/8-notifications.md §4.2` 에 `MarkAllReadResultDto` (`{ affected: number }`) 가 이미 정의됨. target 본문 자체가 "두 DTO 가 동일 shape 이라도 의미가 다르므로 별도 클래스로 분리" 라고 명시함.
  - 상세: DTO 이름 자체는 기존 코드베이스·spec 에 존재하지 않는 신규 식별자이므로 충돌은 없다. 다만 `DismissAllNotificationsResponseDto` 의 shape `{ affected: number }` 가 `MarkAllReadResultDto` 와 동일하다는 점을 target 문서가 인식하고 있으며, 구현 시 혼동 가능성이 있다.
  - 제안: 이미 target 이 분리 방침을 명시하고 있으므로 추가 조치 불필요. 구현 단계에서 `PickType(MarkAllReadResultDto, ...)` 등 재사용 시 DTO 명이 명확히 분리되는지 확인하면 충분.

- **[INFO]** `notification.read` · `notification.dismissed` — follow-up 이벤트 이름 미등록 상태
  - target 신규 식별자: `notification.read`, `notification.dismissed` (§4.6 follow-up 계획 이벤트)
  - 기존 사용처: `spec/5-system/6-websocket-protocol.md §4.4` 에는 현재 `notification.new` 만 정의됨 (`spec/5-system/6-websocket-protocol.md` 라인 557). `notification.read` / `notification.dismissed` 는 프로토콜 권위 문서에 아직 없음.
  - 상세: target §4.6 이 이 이벤트들을 follow-up phase 의 신설 대상으로 제안하며, 다른 WebSocket 이벤트(`execution.started`, `execution.node.completed`, `auth.token_expired` 등)가 점(`.`) 구분 표기를 따른다는 사실도 target 내 Rationale 에서 설명하고 있다. 기존 이벤트와 접두사(`notification.`) 가 충돌하지 않으며, 기존 패턴과 일관된 명명이다. 다만 프로토콜 권위 문서에 해당 이벤트 등록이 완료되어야 진정한 충돌 검증이 가능하다.
  - 제안: follow-up phase 착수 전 `spec/5-system/6-websocket-protocol.md §4.4` 에 `notification.read` · `notification.dismissed` 행을 추가해 프로토콜 권위 문서를 선행 갱신한다. 이를 plan/in-progress/notification-websocket-name-sync.md 에 체크박스로 추적할 것을 권장.

- **[INFO]** Cafe24 카탈로그 `notification.md` resource 와 우리 서비스 알림 도메인의 이름 일치
  - target 신규 식별자: 우리 서비스 도메인 명칭 `Notification`, `notifications:` 채널, `notification.*` 이벤트
  - 기존 사용처: `spec/conventions/cafe24-api-catalog/notification.md` — Cafe24 Admin API 의 "Notification (알림)" resource catalog. `spec/conventions/cafe24-api-catalog/_overview.md` 라인 30, 104.
  - 상세: Cafe24 카탈로그의 `notification` resource 는 Cafe24 쇼핑몰의 알림 설정/발송 API 를 다루며, 우리 서비스의 in-app 알림 도메인(`Notification` 엔티티, `notifications:` WebSocket 채널)과 완전히 다른 의미다. 명칭이 동일한 영어 단어 `notification` 을 공유하지만, spec 컨텍스트(카탈로그 vs. 데이터 모델)가 분리되어 있고, Cafe24 카탈로그의 `application.md` 에서도 이미 자사 `app_type` 과 Cafe24 `Application` resource 의 구분을 주석으로 명시한 사례가 있다 (`codebase/backend/src/nodes/integration/cafe24/metadata/application.md` 서두 주의). Notification resource 도 동일한 구분 주의가 필요하다.
  - 제안: `spec/conventions/cafe24-api-catalog/notification.md` 상단에 `> **주의**: 본 resource 는 Cafe24 쇼핑몰 알림 관리 API 다. 우리 서비스의 in-app Notification 도메인(`spec/1-data-model.md §2.19`, `spec/data-flow/8-notifications.md`)과 **무관** — naming collision 회피 참고.` 형태의 안내 문구 추가 권장.

- **[INFO]** `POST /notifications/:id/dismiss` · `POST /notifications/dismiss-all` — 기존 endpoint 목록과 확인 필요
  - target 신규 식별자: `POST /notifications/:id/dismiss`, `POST /notifications/dismiss-all`
  - 기존 사용처: `spec/2-navigation/9-user-profile.md` 라인 282-284 에는 `GET /api/notifications/unread-count` 와 `POST /api/notifications/mark-all-read` 만 열거. `spec/2-navigation/_layout.md` 라인 97 에는 dismiss-all 이 참조되고 있으며, `spec/data-flow/8-notifications.md` 가 권위 정의처로 명시됨.
  - 상세: target 이 두 endpoint 를 신규 정의하고 있으며, 다른 spec 파일들과 직접 충돌은 없다. `_layout.md` 는 이미 target 을 forward-reference 하고 있어 정합 상태다. `9-user-profile.md` 는 두 dismiss endpoint 를 아직 열거하지 않고 있는데, 해당 파일이 알림 관련 API 목록을 포함하는 경우라면 추후 갱신이 필요할 수 있다.
  - 제안: `spec/2-navigation/9-user-profile.md` 의 알림 API 표에 두 dismiss endpoint 를 추가해 관련 spec 문서 간 API 목록이 일관성을 갖도록 한다 (본 target 검토 범위 외이지만 follow-up 권장).

---

### 요약

`spec/data-flow/8-notifications.md` 가 도입하는 신규 식별자 — `DismissNotificationResponseDto`, `DismissAllNotificationsResponseDto`, `POST /notifications/:id/dismiss`, `POST /notifications/dismiss-all`, `notification.read`, `notification.dismissed`, WebSocket 채널 `notifications:{userId}` — 중 기존 다른 문서에서 다른 의미로 점유된 식별자는 발견되지 않는다. WebSocket 이벤트 표기 정정(`notification:new` → `notification.new`, `user:<userId>` → `notifications:<userId>`) 은 프로토콜 권위 문서(`6-websocket-protocol.md §4.4`) 와 이미 정합되어 있으며, target 자체의 Rationale 에서 충분히 설명된다. 주목할 사항은 두 가지다. (1) follow-up 이벤트 `notification.read` / `notification.dismissed` 가 프로토콜 권위 문서에 아직 등록되어 있지 않아 구현 착수 전 선행 갱신이 필요하다. (2) Cafe24 카탈로그의 `notification` resource 명이 우리 서비스 알림 도메인과 동일 단어를 쓰므로 혼동 방지 주석 추가가 권장된다. 두 사항 모두 기능 차단급이 아닌 문서 보완 수준이다.

### 위험도

LOW
