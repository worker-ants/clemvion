# 신규 식별자 충돌 검토 결과

검토 대상: `plan/in-progress/spec-draft-notification-dismiss.md`
검토 일시: 2026-05-17
검토 모드: spec draft 검토 (--spec)

---

### 발견사항

- **[INFO]** `notification.dismissed` WebSocket 이벤트명 — 기존 Cafe24 notification 카탈로그 컨텍스트와 명칭 공간 분리 확인 필요
  - target 신규 식별자: `notification.dismissed` (WebSocket SSE 이벤트명, §4.6 follow-up 안)
  - 기존 사용처: `spec/conventions/cafe24-api-catalog/_overview.md` 에 `notification` resource(Cafe24 Admin API)가 존재하고, `spec/conventions/cafe24-api-catalog/notification.md` 파일이 별도로 존재함. 또한 `spec/data-flow/8-notifications.md` 의 기존 WebSocket 이벤트로 `notification.read` 가 §4.4 에 이미 follow-up 대상으로 언급되어 있음.
  - 상세: `notification.dismissed` 는 우리 시스템 내부 WebSocket 이벤트로, Cafe24 Admin API 의 `notification` resource(SMS 수신자 설정, 자동 메일, 수신자 그룹 등)와 이름 공간이 다르다. 두 영역은 서로 다른 레이어(WebSocket 프로토콜 vs Cafe24 API catalog)에 위치해 실질적 충돌은 없다. 그러나 `spec/5-system/6-websocket-protocol.md §4.4` 에 follow-up 으로 신설될 이벤트명으로 `notification.dismissed` 가 기록되는 시점에, 동 파일의 기존 `notification.read` 이벤트명과의 명명 일관성(접두어 `notification.` 패턴)은 유지되므로 충돌은 없다.
  - 제안: follow-up 단계에서 `spec/5-system/6-websocket-protocol.md §4.4` 에 `notification.dismissed` 이벤트를 신설할 때, 기존 `notification.read` 의 payload 구조(형식, 필드명)와 동일한 패턴을 따르도록 spec 에 명시하면 일관성이 강화된다. 현 phase 범위 외이므로 blocking 사항 없음.

- **[INFO]** `DismissAllResultDto` 와 `MarkAllReadResultDto` 의 shape 동일성 — 재사용 여부 명문화 권장
  - target 신규 식별자: `DismissAllResultDto` (`backend/src/modules/notifications/dto/responses/dismiss-all-result.dto.ts`)
  - 기존 사용처: `MarkAllReadResultDto` (기존 `POST /notifications/mark-all-read` 응답 DTO, 코퍼스에서 `notifications.service.ts` 및 컨트롤러에서 사용 중)
  - 상세: draft 는 `DismissAllResultDto` 가 `MarkAllReadResultDto` 와 "동일 shape" 이라 `PickType` / 재사용 가능하다고 명시한다. 두 DTO 는 서로 다른 액션의 응답을 담으며, shape 이 우연히 동일(`{ affected: number }`)하지만 의미적으로는 별개다. 현재 spec 표기만으로는 developer 가 실제 구현 시 기존 DTO 를 재사용할지 신규 DTO 를 생성할지 선택이 모호하다.
  - 제안: spec 에 "구현 시 `DismissAllResultDto extends MarkAllReadResultDto` 또는 공통 `AffectedCountResultDto` 로 통합" 중 어느 방향을 선택할지 명시하면 developer phase 에서 혼선이 없다. 단, 두 이름이 같은 파일에서 충돌하지는 않으므로 실질적 식별자 충돌은 없음.

- **[INFO]** `visible` 어휘 — spec 내부 일관성 확인
  - target 신규 식별자: `visible` (spec 표기 어휘, `dismissed_at IS NULL` 인 상태를 지칭)
  - 기존 사용처: spec 전반에서 `visible` 은 UI 표시 여부(예: "뷰어 모드만 제공", 반응형 레이아웃 등)의 일반 용어로 사용되고 있으나, `Notification` 도메인의 정해진 enum 값이나 DB 컬럼명으로는 사용되지 않는다. `Workflow.is_active`, `Trigger.is_active`, `Schedule.is_active` 등 `active` 어휘와 충돌을 회피하기 위해 draft 자체가 `visible` 로 통일한다고 명시하고 있음.
  - 상세: `visible` 은 DB 컬럼명이나 API 필드명으로 노출되지 않고, 오직 spec 본문의 설명 어휘로만 사용되므로 코드베이스 식별자 충돌은 없다. spec 텍스트 내에서만 일관되게 유지하면 충분.
  - 제안: 현재 draft 의 §4.1 에 이미 "active 어휘 회피 — visible 로 통일" 결정이 명시되어 있으므로 추가 조치 불필요.

---

### 요약

target draft 가 도입하는 신규 식별자(`dismissed_at` 컬럼, `POST /notifications/:id/dismiss`, `POST /notifications/dismiss-all`, `DismissResultDto`, `DismissAllResultDto`, `visible` spec 어휘, `notification.dismissed` 이벤트명)는 기존 코퍼스의 식별자와 실질적으로 충돌하지 않는다. 기존 `POST /notifications/mark-all-read` 와 신규 `POST /notifications/dismiss-all` 는 경로가 명확히 구분되고, 두 endpoint 는 의미적으로도 다른 액션이다. `notification` 명칭은 Cafe24 API catalog resource 명과 동일하지만, 레이어(내부 WebSocket 이벤트 vs Cafe24 Admin API 호출 경로)가 달라 혼선이 없다. `DismissAllResultDto` 와 `MarkAllReadResultDto` 는 shape 이 동일하나 서로 다른 파일에서 서로 다른 이름으로 존재하므로 충돌이 아니라 spec 에서 재사용 방향을 명시하면 해결되는 설계 선택의 문제다. 발견된 3건은 모두 INFO 등급으로, CRITICAL 또는 WARNING 에 해당하는 식별자 충돌은 없다.

### 위험도

NONE
