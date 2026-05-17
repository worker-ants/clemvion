# Cross-Spec 일관성 검토 결과

검토 대상: `plan/in-progress/spec-draft-notification-dismiss.md`
검토 기준: `spec/**` 교차 일관성 (데이터 모델·API 계약·상태 전이·계층 책임)

---

### 발견사항

- **[WARNING]** `DELETE` HTTP 메서드를 soft-delete semantics 로 사용 — REST 계약 모호성
  - target 위치: draft 변경안 #1 §4.2 Endpoint 표, §1-C 상태 전이 다이어그램
  - 충돌 대상: `spec/5-system/2-api-convention.md` (API 규약 — 본 payload 에 미포함이나 기존 프로젝트 관례의 참고점)
  - 상세: draft 는 `DELETE /notifications/:id` 와 `DELETE /notifications` 를 **soft delete** (`dismissed_at=now()`) 로 정의한다. 그러나 HTTP DELETE semantics 상 `200`/`204` 응답과 soft delete 내부 구현은 혼용 가능하나, 동일 리소스에 대해 "hard delete" 를 의미하는 DELETE 와 "dismiss(숨김)" 를 의미하는 DELETE 가 공존하면 향후 실제 row 삭제(hard delete 배치, 관리자 delete) 를 추가할 때 endpoint 충돌이 발생한다. 또한 일괄 dismiss 응답이 `200 OK { data: { affected: number } }` 로 정의되어 있어, 기존 DELETE 관례(성공 시 `204 No Content`)와 응답 코드가 불일치한다. 단건은 204, 일괄은 200 으로 응답 코드가 서로 다른 구조도 일관성 문제가 된다.
  - 제안: `PATCH /notifications/:id/dismiss` / `PATCH /notifications/dismiss-all` 패턴을 검토하거나, DELETE endpoint 를 채택하되 상태 전이 다이어그램·API 규약 문서에 "soft delete only" 임을 명시한다. 일괄 dismiss 응답도 `204`(`{ affected }` 생략) 또는 `200`(`{ data: { affected } }`)으로 단건과 통일한다.

- **[WARNING]** 상태 전이 다이어그램 내 endpoint 정정 — 기존 spec 과의 out-of-band 정정
  - target 위치: draft 변경안 #1 §1-C, 상태 전이 다이어그램 footnote
  - 충돌 대상: 현재 `spec/data-flow/8-notifications.md §3` (본 payload 에 미포함 — 직접 확인 필요)
  - 상세: draft 는 기존 상태 전이 다이어그램의 `PATCH /notifications/read-all` 을 `POST /notifications/mark-all-read` 로 "정정" 한다. 그러나 이 정정이 실제 구현(`@Post('mark-all-read')`)에 맞춘 것이라면, 기존 `spec/data-flow/8-notifications.md` 에 이미 잘못된 endpoint 가 박혀 있을 가능성이 있다. 만약 기존 spec 이 `PATCH /notifications/read-all` 을 여전히 canonical 로 기술하고 있다면, draft 의 정정과 기존 spec 이 동시에 존재해 어느 쪽이 진실인지 모호해진다. 본 payload 의 관련 spec 본문이 포함되지 않아 기존 상태 전이 다이어그램의 정확한 표기를 직접 대조할 수 없었다.
  - 제안: `spec/data-flow/8-notifications.md §3` 을 직접 열어 현재 endpoint 표기를 확인하고, 이미 잘못 기술된 경우 draft 의 정정이 올바른지 검증한다. 정정 사실은 Rationale 섹션에 기록한다.

- **[WARNING]** `spec/1-data-model.md §3` 인덱스 변경 — 기존 `notification` 인덱스 partial 전환
  - target 위치: draft 변경안 #2-B, `spec/1-data-model.md §3` 인덱스 표 갱신
  - 충돌 대상: `spec/1-data-model.md §3` (payload 포함, line 1325): `| Notification | (user_id, is_read, created_at DESC) | 사용자별 미읽은 알림 조회 |`
  - 상세: 기존 인덱스 정의는 partial 조건 없는 full index 다. draft 는 이를 `WHERE dismissed_at IS NULL` partial index 로 전환한다. 이 변경은 `dismissed_at` 컬럼 추가(동일 migration) 이후에야 가능하다. 두 DDL 변경(컬럼 추가 + 인덱스 DROP/CREATE CONCURRENTLY) 이 단일 migration 에 묶이면 `CREATE INDEX CONCURRENTLY` 는 트랜잭션 블록 안에서 실행 불가 (`executeInTransaction=false` 필요)라는 Flyway 제약이 존재한다. 기존 `spec/0-overview.md §2.8` 의 Flyway 규칙은 이 edge case 를 명시하지 않는다.
  - 제안: migration 을 두 단계로 분리하는 것을 권장: (1) `dismissed_at` 컬럼 추가 migration, (2) partial index 전환 migration (`executeInTransaction=false`). draft 의 "단일 migration 권장" 표현을 "분리 migration 권장" 으로 수정하거나, Flyway `executeInTransaction=false` 주석을 migration SQL 에 명시한다.

- **[INFO]** `spec/1-data-model.md §2.19` Notification 필드 표 — `dismissed_at` 미포함 상태
  - target 위치: draft 변경안 #2-A, `spec/1-data-model.md §2.19`
  - 충돌 대상: `spec/1-data-model.md §2.19` (payload 포함, line 1234~1249): 현재 Notification 필드 표에 `dismissed_at` 없음
  - 상세: draft 가 §2.19 에 `dismissed_at` row 를 추가하는 것이 목표이고, 이는 의도된 변경이다. 현재 spec 과의 "충돌" 이 아니라 추가 사항이므로 INFO 수준이다. 다만 필드 추가 후 `spec/data-flow/8-notifications.md` 에도 동일 필드 정의가 기재되는 경우(§2.1 Postgres 표), 두 위치의 정의 범위·표현이 서로 다를 수 있어 동기화가 필요하다.
  - 제안: `spec/1-data-model.md §2.19` 추가와 `spec/data-flow/8-notifications.md §2.1` 변경이 서로 다른 상세 수준임을 인지하고, 두 위치의 정의가 서로 모순 없이 상호 보완적임을 확인한다.

- **[INFO]** `GET /notifications/unread-count` 의미 변화 — 문서 갱신 누락 가능성
  - target 위치: draft 변경안 #1 §4.3
  - 충돌 대상: `spec/data-flow/8-notifications.md` 또는 navigation spec 의 알림 뱃지 카운트 정의 (payload 에 미포함)
  - 상세: draft 는 `GET /notifications/unread-count` 가 항상 `dismissed_at IS NULL` 필터를 적용한다고 명시한다. 이는 "미읽음 카운트" 의 기존 의미(단순 `is_read=false` 개수)를 "활성(미닫힘) + 미읽음 개수"로 바꾼다. 이 변화가 알림 벨 배지 카운트를 표시하는 navigation spec(`spec/2-navigation/_layout.md §3.1`) 또는 다른 API 명세에서 카운트 정의가 이미 고정되어 있다면 불일치가 발생할 수 있다.
  - 제안: `spec/2-navigation/_layout.md §3.1` 의 벨 배지 설명, 그리고 `spec/data-flow/8-notifications.md` 의 unread-count endpoint 정의를 함께 갱신해 "dismissed 제외" 를 명시한다.

- **[INFO]** WebSocket 이벤트 갭 — 의도적 미포함이나 명시적 기록 필요
  - target 위치: draft "WebSocket 프로토콜 변경하지 않는다" 선언 + §4 미포함
  - 충돌 대상: `spec/5-system/6-websocket-protocol.md §4.4` 알림 이벤트 (payload 에 미포함)
  - 상세: draft 는 `notification.dismissed` WebSocket emit 을 이번 phase 에서 제외하고 follow-up 으로 분리한다. 이 결정 자체는 합리적이나, WebSocket spec 에 "dismissed 이벤트가 follow-up 으로 예정됨"이라는 메모가 없으면 다른 개발자가 WebSocket spec 만 보고 dismiss 동기화를 구현하려 할 때 혼란이 생길 수 있다.
  - 제안: `spec/5-system/6-websocket-protocol.md §4.4` 알림 이벤트 섹션에 "dismiss 동기화(`notification.dismissed` 이벤트)는 follow-up phase 에서 추가 예정" 주석을 추가하는 것을 고려한다. 우선순위는 낮으나 향후 컨텍스트 유지에 도움이 된다.

---

### 요약

Cross-Spec 일관성 관점에서 이번 draft 는 전반적으로 잘 설계되었다. 가장 주의가 필요한 사항은 두 가지다. (1) `DELETE` HTTP 메서드를 soft-delete semantics 로 사용하는 것은 REST 관례상 모호함을 낳고, 단건(204)과 일괄(200)의 응답 코드 불일치를 만든다 — endpoint 이름이나 응답 코드 정책을 명시적으로 결정해야 한다. (2) partial index 전환을 단일 migration 으로 묶는 경우 Flyway 의 `executeInTransaction=false` 제약을 반드시 고려해야 하며, migration 분리를 권장한다. 나머지 발견사항(`PATCH` → `POST` 정정의 검증, unread-count 의미 변화, WebSocket 갭 메모)은 INFO 수준으로 기존 spec 과의 직접 모순은 없고 동기화 권장 사항이다. Critical 등급 발견사항은 없으므로 단건/일괄 응답 코드 정책과 migration 구조를 확인한 뒤 spec 반영 절차를 진행할 수 있다.

---

### 위험도

MEDIUM
