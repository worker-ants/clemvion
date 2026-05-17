# 신규 식별자 충돌 검토

검토 모드: 구현 착수 전 검토 (--impl-prep, scope=spec/data-flow/)
Target: `spec/data-flow/` 폴더 전체 (0-overview · 1-audit · 2-auth · 3-execution · 4-file-storage · 5-integration · 6-knowledge-base · 10-triggers · 11-workflow · 12-workspace + 8-notifications 참조)

---

## 발견사항

- **[WARNING]** `spec/data-flow/` 도메인 인덱스에서 `notifications.md` 파일 번호(8)와 참조 불일치 위험
  - target 신규 식별자: `spec/data-flow/8-notifications.md` (파일명), `./8-notifications.md` (링크)
  - 기존 사용처: `spec/data-flow/0-overview.md` §2 도메인 인덱스 표 — 링크 `[notifications.md](./8-notifications.md)`. `spec/1-data-model.md §2.19 Notification.dismissed_at` 설명란 및 §3 인덱스 표에서 `data-flow/8-notifications.md §4` 앵커 링크를 이미 두 곳에서 참조.
  - 상세: 현재 `spec/data-flow/0-overview.md`의 도메인 인덱스는 파일명을 `notifications.md` 로 표기하나 링크 href 는 `./8-notifications.md` 로 prefix 가 다르다. 이미 `spec/1-data-model.md` 가 동일 파일의 `§4` 섹션을 참조하고 있으므로, 실제 파일이 `8-notifications.md` 가 아닌 `notifications.md` 로 생성되면 링크가 모두 404 가 된다. 또한 `spec/3-execution.md`의 `외부 의존` 표와 `spec/5-integration.md`의 시퀀스 다이어그램도 `NotificationsService` 를 호출처로 표기하고 있어, 서비스명 자체는 코드베이스에 이미 존재한다.
  - 제안: 파일 생성 시 이름을 `8-notifications.md`(prefix 포함)로 통일하거나, 도메인 인덱스의 링크 표기를 `notifications.md`(no-prefix)로 통일한다. 현행 패턴은 `0-overview.md`, `1-audit.md` 등 모두 숫자 prefix 형식이므로 `8-notifications.md`가 컨벤션에 부합한다.

- **[WARNING]** `integration_action_required` — Notification.type Enum 신규 값이 DB CHECK 제약에 아직 미반영
  - target 신규 식별자: `integration_action_required` (Notification.type Enum 값, `spec/1-data-model.md §2.19`)
  - 기존 사용처: `backend/migrations/V001__initial_schema.sql:338` — 초기 스키마의 CHECK 제약이 `execution_failed / background_failed / schedule_failed / integration_expired / marketplace_update / team_invite` 만 열거. `plan/in-progress/20260516-full-review/RESOLUTION.md C-9` 에서 V052 마이그레이션으로 제약 추가가 처리 완료된 것으로 기록되어 있으나, 본 검토 대상 target (spec/data-flow/) 의 구현 착수 시점에서 해당 마이그레이션이 실제로 코드베이스에 반영됐는지 확인이 필요하다.
  - 상세: spec에서는 `integration_action_required` 가 2026-05-16 A-1 결정으로 정식 도입됐으나, 코드 리뷰(C-9)가 이를 CHECK 제약 누락으로 식별했고 V052 마이그레이션을 통해 해소됐다고 RESOLUTION.md 에 기록되어 있다. `spec/data-flow/8-notifications.md` 구현 시 이 값을 INSERT 하는 경로가 추가될 경우, V052 가 적용되지 않은 환경에서는 check_violation 이 발생한다.
  - 제안: 구현 착수 전 `backend/migrations/V052__notification_type_integration_action_required.sql` 파일이 실제로 존재하는지 확인한다. 미존재 시 해당 마이그레이션 추가가 구현의 선행 조건이다.

- **[WARNING]** `hasRecentByResource` — NotificationsService 신규 공개 메서드와 기존 mock 테스트 충돌
  - target 신규 식별자: `NotificationsService.hasRecentByResource` (메서드명, `notifications.service.ts:117-138`)
  - 기존 사용처: `plan/in-progress/20260516-full-review/SUMMARY.md W-75` — 기존 mock 에 `hasRecentByResource: jest.fn()` 가 누락되어 있다고 명시. 같은 SUMMARY W-63 에서 이 메서드의 hot path 인덱스 누락(`CREATE INDEX CONCURRENTLY idx_notification_workspace_type_resource`) 도 함께 지적됨.
  - 상세: `spec/data-flow/8-notifications.md` 를 기반으로 구현되는 notifications 흐름이 `hasRecentByResource` 를 호출하는 경로를 사용하면, 기존 mock이 이 메서드를 포함하지 않아 테스트가 런타임 오류를 낸다. W-63 에서 V053 마이그레이션으로 인덱스를 추가했다고 기록되어 있으나 W-75 의 mock 보강은 의사결정 보류 상태로 남아있다.
  - 제안: 구현 착수 전 `NotificationsService` 를 mock 하는 모든 테스트 파일에 `hasRecentByResource: jest.fn()` 을 추가한다. `W-63` V053 인덱스 마이그레이션도 함께 확인한다.

- **[WARNING]** `cafe24-token-refresh` BullMQ 큐 — 신규 큐 이름이 `spec/data-flow/0-overview.md §4` 카탈로그에 미등재
  - target 신규 식별자: `cafe24-token-refresh` (BullMQ 큐 이름, `spec/data-flow/5-integration.md §2.2`)
  - 기존 사용처: `spec/data-flow/0-overview.md §4` BullMQ 큐 카탈로그 표 — `background-execution / document-embedding / graph-extraction / schedule-execution / alerts-evaluator / integration-expiry` 6개만 등재. `cafe24-token-refresh` 는 목록에 없다.
  - 상세: `spec/data-flow/5-integration.md §2.2` 는 2026-05-16 신규로 `cafe24-token-refresh` 큐를 도입했다고 명시하고 있으나, 공통 BullMQ 큐 카탈로그(`0-overview.md §4`)에는 반영되지 않았다. 구현 시 이 큐를 사용하는 코드가 추가될 때 카탈로그와 실제가 불일치 상태가 된다.
  - 제안: `spec/data-flow/0-overview.md §4` 표에 `cafe24-token-refresh` 큐를 등재하고 (`Cafe24Module` 소속, Producer: `Cafe24ApiClient` proactive + `cafe24-background-refresh` job, Consumer: `Cafe24TokenRefreshProcessor`) 규약을 충족시킨다.

- **[WARNING]** `spec/conventions/cafe24-api-catalog/notification.md` — Cafe24 Notification 리소스 카탈로그 파일과 `spec/data-flow/8-notifications.md` 의 명칭 충돌 위험
  - target 신규 식별자: `spec/data-flow/8-notifications.md` (신규 데이터흐름 spec 파일)
  - 기존 사용처: `spec/conventions/cafe24-api-catalog/notification.md` — Cafe24 Admin API 의 Notification(알림) 리소스 카탈로그 파일. `spec/conventions/cafe24-api-catalog/_overview.md §1` 디렉토리 구조에 명시됨.
  - 상세: 두 파일 모두 `notification`(s) 를 이름에 포함하고 있어 git grep, 에디터 파일 탐색, 리뷰어의 컨텍스트 참조 시 혼동을 일으킬 수 있다. `spec/conventions/` 의 것은 Cafe24 외부 API 리소스 카탈로그이고, `spec/data-flow/` 의 것은 내부 `notification` 테이블 흐름 spec 이다. 경로가 달라 실제 파일 충돌은 없으나 오독 위험이 있다.
  - 제안: `spec/data-flow/8-notifications.md` 의 상단 관련 문서 섹션에 "Cafe24 Notification API 리소스 카탈로그(`spec/conventions/cafe24-api-catalog/notification.md`)와 본 문서는 별개다" 라는 명확한 구분 주석을 추가한다. `spec/conventions/cafe24-api-catalog/application.md` 의 선례("naming collision 회피 참고" 주석)를 따른다.

- **[INFO]** `spec/data-flow/` 폴더 자체 — 기존 `spec/0-overview.md §8 문서 맵`에 진입 문서 미등재
  - target 신규 식별자: `spec/data-flow/` (신규 spec 폴더 경로)
  - 기존 사용처: `spec/0-overview.md §8 문서 맵` — `spec/data-flow/` 는 `0-overview.md` 내 문서 맵 표에 이미 등재됨(`데이터 흐름 | spec/data-flow/ | 0-overview.md + 도메인별 흐름·schema 매핑`). 충돌은 없음.
  - 상세: 특이사항 없음. 파일 경로 컨벤션(`N-name.md` 숫자 prefix, 카테고리별 폴더 구조)을 준수한다. `1-audit.md` ~ `12-workspace.md` 의 넘버링이 1~12 사이이고 간격이 있어 (`7-llm-usage`, `8-notifications`, `9-observability`) 추가 도메인을 위한 공간이 확보되어 있다.
  - 제안: 이상 없음. 현재 구조 유지.

- **[INFO]** `dismissed_at` — Notification 엔티티 신규 컬럼 참조가 data-flow spec 전반에 분산
  - target 신규 식별자: `dismissed_at` (Notification 테이블 컬럼, `spec/1-data-model.md §2.19`)
  - 기존 사용처: `spec/1-data-model.md §2.19` (컬럼 정의), §3 인덱스 표 (`(user_id, is_read, created_at DESC) WHERE dismissed_at IS NULL` partial index). `spec/data-flow/8-notifications.md §4` 앵커를 통해 dismiss 흐름을 위임하는 역방향 참조가 두 곳 존재.
  - 상세: `dismissed_at` 은 신규 컬럼이며 관련 partial index 도 신규다. data-flow spec 이 이 컬럼의 dismiss 흐름 SoT 가 되므로 `8-notifications.md §4` 구현 시 이 인덱스 정의를 반드시 함께 기술해야 한다. 이름 자체의 충돌은 없다.
  - 제안: `8-notifications.md §4` 에 dismiss 흐름(PATCH API 경로, DB UPDATE, 인덱스 활용)을 명시적으로 기술한다.

---

## 요약

`spec/data-flow/` 는 기존 코드베이스 및 spec 체계와 전반적으로 정합하며, 도메인별 식별자(테이블명, 서비스명, 큐명, 엔티티명)는 `spec/1-data-model.md` 및 기존 시스템 spec 과 의미 충돌 없이 재인용하고 있다. 다만 네 가지 주의 사항이 확인된다. (1) `cafe24-token-refresh` BullMQ 큐가 공통 큐 카탈로그에 미등재되어 있어 구현 시 카탈로그 불일치가 생긴다. (2) `integration_action_required` Notification type 이 DB CHECK 제약에 반영되었는지 V052 마이그레이션 존재 여부를 착수 전 확인해야 한다. (3) `NotificationsService.hasRecentByResource` 관련 mock 보강이 미완 상태이며 구현 시 테스트 오류를 유발할 수 있다. (4) `spec/data-flow/8-notifications.md` 와 `spec/conventions/cafe24-api-catalog/notification.md` 가 유사 이름으로 공존해 독자 혼동 위험이 있다. 파일 경로 컨벤션 위반이나 기존 식별자와의 의미 충돌은 발견되지 않았다.

---

## 위험도

MEDIUM
