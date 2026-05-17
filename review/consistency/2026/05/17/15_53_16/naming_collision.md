# 신규 식별자 충돌 검토 — naming_collision

> 대상 draft: `plan/in-progress/spec-draft-notification-dismiss.md`
> 검토 일시: 2026-05-17
> 검토 모드: spec draft (--spec)

---

## 발견사항

### 발견사항 1

- **[CRITICAL]** `DELETE /notifications/:id` — HTTP 메서드·의미 충돌 (hard delete vs soft delete)
  - target 신규 식별자: `DELETE /notifications/:id` (단건 dismiss — `dismissed_at=now()` soft delete)
  - 기존 사용처: `spec/2-navigation/1-workflow-list.md §3`의 삭제 패턴, `plan/in-progress/20260516-full-review/SUMMARY.md` INFO 절 "DELETE /workspaces/:id 204 대신 200" 등 프로젝트 전반의 `DELETE` 메서드 관례 — 이 프로젝트에서 `DELETE` 는 **hard delete** 를 의미하는 HTTP 규약으로 사용되어 왔다. 직접적 선례: `DELETE /api/workflows/:id` (워크플로우 삭제), `DELETE /notifications` 가 존재하지 않더라도 `DELETE` 동사 자체가 "데이터를 영구 제거"로 해석되는 강한 의미를 가진다.
  - 상세: target 은 `DELETE /notifications/:id` 를 "soft delete (dismissed_at 갱신)" 로 정의한다. 그러나 HTTP 의미론과 이 코드베이스의 기존 패턴에서 `DELETE` 는 영구 삭제(hard delete)를 뜻한다. 같은 경로·메서드가 서로 다른 의미(hard delete vs soft delete)로 해석될 수 있어, 개발자·클라이언트 양측 모두 혼선을 유발한다. 특히 코드 리뷰에서 W-48("PATCH /notifications/:id/read — spec §12.1 상태 토글 패턴 위반")이 이미 제기된 문맥에서, dismiss 도 `PATCH` 계열로 통일하지 않으면 알림 엔드포인트 내에서 HTTP 동사의 일관성이 깨진다.
  - 제안: (a) `PATCH /notifications/:id` + body `{ dismissed: true }` 로 변경하여 read(`isRead`) 와 dismiss(`dismissed_at`) 를 같은 PATCH 패턴으로 통일. 또는 (b) `POST /notifications/:id/dismiss` / `POST /notifications/dismiss-all` 명시적 액션 경로 사용. 어느 방안이든 `DELETE` 동사 사용을 피하고 기존 spec의 상태 토글 패턴(W-48 제안)과 일관성 유지 권장.

---

### 발견사항 2

- **[CRITICAL]** `DELETE /notifications` — 기존 `POST /notifications/mark-all-read` 와 비대칭 동사 충돌
  - target 신규 식별자: `DELETE /notifications` (일괄 dismiss)
  - 기존 사용처: target 자체 §1-C 에 명시된 `POST /notifications/mark-all-read` (일괄 읽음 처리). 기존 상태 다이어그램의 `PATCH /notifications/read-all` 도 동일 리소스의 bulk 액션. 코드베이스의 `notifications.controller.ts` (W-48에서 참조됨).
  - 상세: 알림 리소스에 대한 일괄 액션이 두 가지 서로 다른 HTTP 동사로 노출된다 — `POST /notifications/mark-all-read` (읽음) vs `DELETE /notifications` (dismiss). `DELETE /notifications` 는 인자 없이 특정 컬렉션 전체를 DELETE 한다는 의미로 읽히므로, API 소비자가 "모든 알림 hard delete" 로 오해할 위험이 크다. spec §4.3 에서 "목록·카운트는 `dismissed_at IS NULL` 필터를 적용한다" 고 명시하지만 endpoint 자체의 이름만 보면 destructive action 으로 인식된다. 또한 bulk dismiss 의 응답 형식 `{ data: { affected: number } }` 는 래퍼 규약을 따르지만, `DELETE` 메서드에 body 가 포함되는 형식은 일부 HTTP 클라이언트·게이트웨이에서 지원되지 않을 수 있다.
  - 제안: `POST /notifications/dismiss-all` 로 통일하면 `POST /notifications/mark-all-read` 와 대칭을 이루고 의미도 명확해진다. 또는 `PATCH /notifications` + body `{ dismissed: true }` 도 가능.

---

### 발견사항 3

- **[WARNING]** `spec/conventions/cafe24-api-catalog/notification.md` 와 알림 도메인 `notification` 명칭 혼동
  - target 신규 식별자: 직접 파일을 신규 생성하지 않지만, `spec/data-flow/8-notifications.md` 의 §4 도입으로 "notification" 도메인 내 "dismiss" 개념이 확장됨.
  - 기존 사용처: `spec/conventions/cafe24-api-catalog/notification.md` — 이 파일은 **Cafe24 Admin API** 의 "Notification" 리소스(카카오 알림·문자 등 외부 알림 발송 API)를 다루는 카탈로그. Coverage Matrix 에서 `notification` resource 가 Supported 12개로 등재되어 있다.
  - 상세: 두 `notification` 는 전혀 다른 도메인이다 — (a) 플랫폼 내부 알림 (`Notification` 엔티티, `spec/data-flow/8-notifications.md`) vs (b) Cafe24 외부 발송 알림 (`spec/conventions/cafe24-api-catalog/notification.md`). 파일 경로·네이밍이 다르므로 직접 충돌은 없지만, 개발자가 "notification dismiss" 를 검색하거나 "notification spec" 를 탐색할 때 두 문서가 혼재하여 혼동을 유발할 수 있다. target spec 이 `notification.dismissed` WebSocket 이벤트를 follow-up 으로 예고하고 있어, 향후 이벤트 이름이 Cafe24 notification 이벤트명과 혼동될 가능성도 있다.
  - 제안: 단기 조치 불필요(파일 경로 자체는 충돌 없음). 다만 향후 WebSocket 이벤트 이름 정의 시 내부 알림 이벤트를 `user_notification.dismissed` 등 prefix 로 구분하여 Cafe24 notification 카탈로그와 명칭 공간을 분리하는 것을 권장.

---

### 발견사항 4

- **[WARNING]** 상태 다이어그램에서 `PATCH /notifications/read-all` → `POST /notifications/mark-all-read` 정정이 spec 의 단일 진실을 이중으로 만들 위험
  - target 신규 식별자: 기존 §3 상태 다이어그램의 `PATCH /notifications/read-all` 을 `POST /notifications/mark-all-read` 로 정정.
  - 기존 사용처: `spec/data-flow/8-notifications.md §3` 의 기존 mermaid 다이어그램에 `PATCH /notifications/read-all` 이 기재되어 있음. target draft 는 이를 정정한다고 명시하지만, 정정의 근거 문서(controller 실제 구현)가 spec 본문에 반영되기 전까지 두 표현이 공존한다.
  - 상세: target 이 spec 에 반영된 후에는 `POST /notifications/mark-all-read` 로 통일되지만, 만약 다른 spec 파일이 `PATCH /notifications/read-all` 을 참조하고 있다면 그 참조도 함께 갱신되어야 한다. `plan/in-progress/20260516-full-review/SUMMARY.md` W-48 에서 `PATCH /notifications/:id/read` 를 별도 이슈로 다루고 있어, 읽음 처리 endpoint 정책이 완전히 확정되지 않은 상태에서 dismiss spec 이 일부 정정을 포함하면 전체 알림 API 의 동사 일관성이 불명확해진다.
  - 제안: target spec 을 spec 파일에 반영하기 전에, W-48 의 알림 API 동사 일관성 이슈(PATCH vs POST 패턴)를 먼저 확정하거나, 또는 본 draft 의 dismiss endpoint 명명 방식을 그 결정과 함께 정의할 것을 권장. 최소한 수정 대상 파일 목록에 `PATCH /notifications/read-all` 이 다른 spec 파일에서 참조되는지 전수 검색 후 일괄 갱신을 명시할 것.

---

### 발견사항 5

- **[WARNING]** `active` — 새로 도입되는 상태 레이블이 기존 `is_active` 패턴과 명칭 공간 혼동
  - target 신규 식별자: `active` (dismissed_at IS NULL 인 알림의 상태 레이블, §4.1 차원 표에서 "active" / "dismissed" 로 표기)
  - 기존 사용처: `spec/1-data-model.md §2.4 Workflow.is_active`, `spec/1-data-model.md §2.8 Trigger.is_active`, `spec/1-data-model.md §2.9 Schedule.is_active` 등 여러 엔티티의 활성 상태 컬럼. 기존 시스템에서 "active/inactive" 는 리소스의 활성화 여부를 의미한다.
  - 상세: target 의 §4.1 표에서 `dismissed_at IS NULL` 상태를 "active" 로 칭하고 있다. 이 용어는 기존 `is_active` (workflow/trigger/schedule 의 비활성화 여부) 와 같은 어휘를 사용하지만 의미가 다르다 — 기존 `is_active=false` 는 사용자가 비활성화한 것이고, `dismissed_at IS NOT NULL` 은 사용자가 알림을 닫은 것이다. spec 문서 내 검색 시 "active" 키워드가 두 의미로 혼재할 수 있다.
  - 제안: target 내부 서술에서 "active" 대신 "visible" 또는 "undismissed" 로 표현하면 `is_active` 계열과 명칭 공간이 분리된다. DB 컬럼 이름 `dismissed_at` 은 그대로 유지하되, 문서의 상태 레이블만 교체. 예: "(unread, visible) / (read, visible) / (unread, dismissed) / (read, dismissed)".

---

### 발견사항 6

- **[INFO]** `§4` 번호 재할당 — 기존 §4 "외부 의존" 섹션이 §5 로 이동
  - target 신규 식별자: `§4 "Dismiss 흐름 (사용자 액션)"` 신설 (기존 §4 를 §5 로 밀어냄)
  - 기존 사용처: `spec/data-flow/8-notifications.md §4` (현재 "외부 의존" 섹션으로 추정). 다른 spec 파일이 `8-notifications.md#4-...` 앵커를 참조하고 있을 가능성.
  - 상세: target 은 새 §4 삽입과 기존 §4→§5 번호 이동을 명시하고 있다. 만약 다른 spec 파일이 `data-flow/8-notifications.md#4-` 앵커를 직접 링크하고 있다면, 번호 이동 후 해당 링크가 깨진다. `20260516-full-review` 리뷰에서 C-7 / C-14 / C-15 등 앵커 불일치가 여러 건 발견된 선례가 있어, 섹션 번호 이동 시 참조 파일 전수 검색이 중요하다.
  - 제안: spec 반영 시 `grep -r "8-notifications.md#4" spec/` 를 실행해 참조 파일을 확인하고 앵커를 일괄 갱신. 또는 §4 번호 대신 named anchor (`{#dismiss-flow}`)를 사용해 번호 변경에 내성을 갖추는 것을 장기적으로 검토.

---

### 발견사항 7

- **[INFO]** 마이그레이션 번호 `V0NN` — 미확정 플레이스홀더
  - target 신규 식별자: `V0NN` (dismissed_at 컬럼 추가 + partial 인덱스 마이그레이션)
  - 기존 사용처: 현재 가장 높은 마이그레이션 번호는 코퍼스 참조에 `V053` (`backend/migrations/V053__notification_workspace_type_resource_idx.sql`) 으로 확인됨 (`plan/in-progress/20260516-full-review/RESOLUTION.md` W-63 처리 결과).
  - 상세: target 이 `V0NN` 으로 표기한 마이그레이션은 실제 반영 시 `V054` 가 될 것이다. 플레이스홀더 자체는 spec 단계에서 허용 가능하나, developer 단계에서 잘못된 번호로 파일을 생성하면 Flyway 실행 순서가 틀어진다.
  - 제안: spec 본문의 `(V0NN)` 표기에 "(developer 단계에서 `backend/migrations/` 의 현행 최고 번호 +1 로 확정)" 주석이 이미 있어 의도는 명확하다. 추가 조치로 developer 착수 전 `ls backend/migrations/ | sort | tail -1` 로 현행 최고 번호를 확인하는 절차를 plan checklist 에 명시할 것을 권장.

---

## 요약

target draft 가 도입하는 핵심 식별자 중 **CRITICAL** 2건이 발견되었다. `DELETE /notifications/:id` 와 `DELETE /notifications` 는 이 코드베이스에서 `DELETE` HTTP 메서드가 "영구 삭제" 를 의미하는 기존 관례와 충돌하며, soft delete(dismiss)를 `DELETE` 동사로 노출하면 API 소비자와 개발자 모두에게 혼선을 유발한다. 특히 `20260516-full-review` W-48 에서 알림 API 동사 일관성 문제가 이미 제기된 상황이므로, dismiss endpoint 명명을 확정하기 전에 전체 알림 API 동사 정책을 먼저 통일할 것을 강권한다. `dismissed_at` 컬럼 자체, §4 신설, 인덱스 partial 전환은 기존 식별자와 의미 충돌이 없다. WARNING 2건(Cafe24 notification 카탈로그 혼동, 상태 다이어그램 정정 순서)과 INFO 2건(active 레이블, 마이그레이션 번호)은 즉각 차단 수준은 아니나 반영 전 명확화가 권장된다.

---

## 위험도

**HIGH**
