# Rationale 연속성 검토 결과

검토 대상: `plan/in-progress/spec-draft-notification-dismiss.md`
검토 모드: spec draft (`--spec`)
검토 일시: 2026-05-17

---

### 발견사항

- **[INFO]** `PATCH /notifications/read-all` → `POST /notifications/mark-all-read` 정정 — Rationale 근거 포함되어 있으나 기존 spec 표기 오류임을 명시적으로 선언하지 않음
  - target 위치: 변경안 #1-C §3 상태 전이 다이어그램 주석
  - 과거 결정 출처: `spec/data-flow/8-notifications.md §3` 다이어그램 (`PATCH /notifications/read-all` 표기)
  - 상세: 기존 spec §3 다이어그램은 `PATCH /notifications/read-all` 을 명시하고 있다. target 은 이를 `POST /notifications/mark-all-read` 로 변경하면서 "현 컨트롤러가 `@Post('mark-all-read')` 로 노출" 라는 근거를 주석으로 달았다. 이는 기각·번복이 아닌 기존 spec 의 오기(誤記) 정정이지만, 정정 사실이 주석에만 언급되고 spec 본문의 Rationale 섹션에 별도 항목으로 기록되지 않아 추후 추적이 어렵다. 기존 Rationale 에서 `PATCH` 동사를 채택한 사유가 없어 CRITICAL 은 아니나, spec 오류 수정 이력이 Rationale 에 남지 않으면 나중에 다시 `PATCH` 가 의도된 것인지 오기였는지 판단이 어려워진다.
  - 제안: 변경안 #1-E Rationale 에 "옛 spec §3 의 `PATCH /notifications/read-all` 표기는 실제 구현(`@Post('mark-all-read')`)과 불일치했던 오기. 본 개정으로 정정." 한 줄 추가.

- **[INFO]** `DELETE` HTTP verb 와 soft delete 의 의미 간극 — Rationale 설명 부재
  - target 위치: 변경안 #1-D §4.2 Endpoint 표 (`DELETE /notifications/:id`, `DELETE /notifications`)
  - 과거 결정 출처: `spec/conventions/swagger.md §2-4` (상태 코드 응답 규칙)
  - 상세: target 은 `DELETE /notifications/:id` 와 `DELETE /notifications` 두 endpoint 를 dismiss(soft delete) 로 정의한다. REST 관습에서 `DELETE` 는 자원의 제거를 의미하지만, 여기서는 `dismissed_at` 컬럼 갱신(soft delete)이 실제 동작이다. swagger 규약에 DELETE → 반드시 hard delete 라는 규칙은 없으나, endpoint 명과 실제 동작의 간극에 대한 Rationale 설명이 없다. 이 선택이 향후 다른 도메인의 soft delete endpoint 설계 선례가 될 수 있어 명시가 유익하다. 또한 일괄 dismiss 의 응답이 `200 OK { data: { affected } }` 로 정해진 근거(단건의 `204 No Content` 와 대비되는 이유)가 Rationale 에 없다.
  - 제안: 변경안 #1-E Rationale 에 "`DELETE` verb 선택 이유: 사용자 관점에서 '목록에서 제거' 의 의도와 일치하며, HTTP 의미상 '해당 자원의 표시 상태를 영구 종결' 로 해석한다. row 는 soft delete 로 보존되나 endpoint 명은 사용자 UX 의도를 우선해 `DELETE` 사용. 일괄 dismiss 의 `200 OK { affected }` 응답은 영향 건수를 호출자에게 돌려줄 필요가 있어 `204` 를 택하지 않는다." 를 추가.

- **[INFO]** 기존 `spec/data-flow/8-notifications.md` Rationale 에 dismiss 관련 선행 결정 없음 — 신규 결정으로 공백을 채우는 구조 적합
  - target 위치: 변경안 #1-E (새 Rationale 절 전체)
  - 과거 결정 출처: `spec/data-flow/8-notifications.md ## Rationale` (기존 2개 항목만 존재)
  - 상세: 기존 notifications spec Rationale 에는 `user.notification_preferences JSONB` 와 `Email 실패 warn 만` 두 항목뿐이며, dismiss / soft delete / hard delete 에 관한 기각된 결정이 전혀 없다. target 이 soft delete 와 기각된 3개 대안(`Hard delete`, `is_deleted BOOLEAN`, `notification_dismissals` 별도 테이블)을 명시적으로 작성한 것은 올바른 방향이며, 과거 결정의 재도입이나 합의 원칙 위반에 해당하지 않는다. 단, target Rationale 의 기각 대안 중 `is_deleted BOOLEAN` 에 대해 "시각을 동시에 보존하므로 정보량 우위"만 언급하고 향후 `dismissed_at` 기반 청소 정책의 편의성도 이유로 들 수 있음을 보완하면 완성도가 높아진다 (이미 §4.5 본문에서 다루나 Rationale 에 압축 반영 가능).
  - 제안: 현재 기술로도 충분하나 `is_deleted BOOLEAN` 기각 이유에 "정기 청소(§4.5) 시 N일 경과 조건을 시각 컬럼이 자연스럽게 표현한다" 보강 선택적 추가.

---

### 요약

target 문서(`spec-draft-notification-dismiss.md`)는 기존 spec Rationale 에서 명시적으로 기각된 결정을 재도입하거나 합의된 원칙을 위반하는 부분이 없다. `spec/data-flow/8-notifications.md` 의 기존 Rationale 는 dismiss 관련 결정을 전혀 다루지 않아 선행 기각 결정 자체가 존재하지 않으며, target 이 soft delete, hard delete 기각, 두 대안 테이블 구조 기각을 모두 새 Rationale 로 문서화하는 방식은 적절하다. 소규모 INFO 항목 3건이 발견됐다: (1) `PATCH → POST` 정정이 spec Rationale 에 이력으로 기재되지 않은 점, (2) `DELETE` verb 와 soft delete 의미 간극 및 단건/일괄 응답 코드 차이에 대한 근거가 Rationale 에 없는 점, (3) `is_deleted` 기각 이유의 소폭 보완 가능성. 모두 필수 수정은 아니며 선택적 보강이다.

### 위험도

LOW
