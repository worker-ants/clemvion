# Cross-Spec 일관성 검토 결과

## 발견사항

- **[INFO]** WebSocket 표기 정정 — target draft 가 기존 코드베이스 내 `notification:new` / `user:<userId>` 표기를 `notification.new` / `notifications:<userId>` 로 교정한 것은 프로토콜 권위 문서(`spec/5-system/6-websocket-protocol.md §4.4`)와 일치하며, 정정 자체는 올바르다
  - target 위치: `spec/data-flow/8-notifications.md` §1 시퀀스 다이어그램, §2.2 WebSocket 표, 코드 진입점 주석, §4.6 follow-up 언급
  - 충돌 대상: 현재 파일시스템의 `spec/data-flow/8-notifications.md` (커밋 전 상태) — §2.2 표에 여전히 `user:<userId>` room + `notification:new` (콜론) 표기가 존재. `spec/5-system/6-websocket-protocol.md §4.4` 는 `notifications:{userId}` 채널 + `notification.new` (점) 표기가 권위 정의
  - 상세: target draft 는 이 불일치를 해소하는 방향으로 §1·§2.2 를 갱신하므로 충돌을 생성하는 것이 아니라 제거한다. 단, draft 가 파일시스템에 아직 반영되지 않은 상태이므로, 현재 체크인된 `8-notifications.md` 와 WebSocket 프로토콜 spec 사이의 불일치가 일시적으로 잔존한다.
  - 제안: target draft 를 그대로 채택해 PR 을 머지하면 불일치가 해소된다. 별도 spec 수정 불필요.

- **[INFO]** `spec/1-data-model.md §2.19` Notification 엔티티의 dismissed_at 컬럼 — target draft 와 완전히 일치
  - target 위치: §2.1 Postgres 스키마 매핑 (`dismissed_at=NULL` 적재, partial index 기술)
  - 충돌 대상: `spec/1-data-model.md §2.19` Notification 테이블 + §3 인덱스 전략의 Notification 행
  - 상세: data-model 은 `dismissed_at Timestamp?` 컬럼과 `(user_id, is_read, created_at DESC) WHERE dismissed_at IS NULL` partial 인덱스를 정의하고 data-flow/8 target 의 §2.1·§4 내용과 완전히 정합. 충돌 없음.

- **[INFO]** Notification.type Enum 의 `integration_action_required` — target draft 와 data-model 모두 동일 정의
  - target 위치: §1.1 Type 별 source·트리거 표 (`integration_action_required` 타입 신설 검토 언급)
  - 충돌 대상: `spec/1-data-model.md §2.19` Notification.type Enum 정의
  - 상세: data-model 은 `integration_action_required` 를 Enum 정식 멤버로 등록하고, target draft 의 Type 표에는 아직 "신설 검토" 수준으로 기술되어 있어 미묘한 선후 관계 차이가 있다. data-model 이 이미 해당 type 을 확정 기술하므로, target draft 의 "향후 신설 검토" 문구는 갱신이 권장된다.
  - 제안: target draft §1.1 `integration_expired` 행의 "향후 `integration_action_required` 타입 신설 검토" 표현을 "이미 data-model §2.19 에 Enum 멤버로 정식 추가됨" 으로 정정하면 두 문서 간 표현 정합성이 높아진다.

- **[INFO]** `POST /notifications/:id/dismiss` 및 `POST /notifications/dismiss-all` — 다른 API spec 과 충돌 없음
  - target 위치: §4.2 Endpoint 표
  - 충돌 대상: `spec/5-system/2-api-convention.md` (API 규약), `spec/conventions/swagger.md §5`
  - 상세: target 은 POST 액션 endpoint 패턴 채택 이유를 Rationale 에 상세 기술하고 있으며, 기존 `POST /notifications/mark-all-read` 와 대칭이라는 근거도 충분하다. 응답 DTO 패턴은 `spec/conventions/swagger.md §5` `ApiOkWrappedResponse` 규약을 따르고 있어 충돌 없음.

- **[INFO]** `hasRecentByResource` 의 dismissed row 포함 정책 — 다른 spec 영역에서 독립적으로 정의된 내용 없음
  - target 위치: §4.4 및 Rationale "중복 방지에 dismissed row 포함"
  - 충돌 대상: 해당 헬퍼를 언급하는 다른 spec 없음 (현재 코퍼스 내 확인 범위)
  - 상세: `integration_action_required` 의 24h 중복 방지 로직은 data-flow/8 이 단일 권위 정의처로 보이며, 다른 spec 과 충돌하지 않는다.

---

## 요약

target draft (`spec/data-flow/8-notifications.md`) 가 기존 `spec/**` 의 다른 영역과 직접 모순되는 항목은 발견되지 않았다. 주요 변경 내용(WebSocket 이벤트 이름 `notification.new` + 채널 `notifications:{userId}` 로의 표기 통일)은 프로토콜 권위 문서 `spec/5-system/6-websocket-protocol.md §4.4` 와 일치하고, 기존 파일시스템의 `8-notifications.md` 에 남아있던 구 표기(`notification:new` / `user:<userId>`)와의 불일치를 해소하는 올바른 방향이다. `dismissed_at` 컬럼·인덱스·dismiss endpoint 설계는 `spec/1-data-model.md §2.19` 및 `§3` 인덱스 전략과 완전히 정합한다. 유일하게 권장하는 후속 조치는 `integration_action_required` 타입이 data-model 에서 이미 확정되어 있음에도 target draft §1.1 에서 "신설 검토" 로 표현된 부분을 정정하는 것이나, 이는 기능 동작에 영향을 주지 않는 문구 수준의 사안이다.

## 위험도

LOW
