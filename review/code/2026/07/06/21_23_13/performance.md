### 발견사항

- **[INFO]** partial index 는 쿼리 패턴과 정합
  - 위치: `codebase/backend/migrations/V107__notification_background_run_id.sql:66-68`
  - 상세: `idx_notification_background_run_id ON notification (background_run_id) WHERE background_run_id IS NOT NULL` 파셜 인덱스가 `NotificationsService.findByBackgroundRun()` 의 `WHERE background_run_id = $1` 조회 패턴과 정확히 일치한다. `background_run_id` 가 NULL 인 대다수 row(딥링크 전용 알림)는 인덱스에서 제외되어 인덱스 크기가 작게 유지되고, 대상 row(0건 → 점진 증가) 도 신규 데이터라 마이그레이션 시점 lock 비용도 미미하다. 코멘트에 명시된 대로 CONCURRENTLY 불필요 판단도 타당하다(신규 컬럼 전체 NULL).
  - 제안: 없음. 설계 그대로 적절.

- **[INFO]** N+1 없음 — 단건 호출, 배치 삽입 유지
  - 위치: `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts:395-407`, `codebase/backend/src/modules/notifications/notifications.service.ts:52-58`, `createMany` (약 294-330줄)
  - 상세: `fetchNotifications` → `findByBackgroundRun` 은 반복문 밖에서 1회만 호출되며 반복 패턴이 없다(grep 결과 유일 호출부). `createMany`/`notify` 의 `backgroundRunId` 필드 추가는 기존 row-mapping 루프(`entries.map(...)`) 안에 O(1) 필드 대입 한 줄만 늘렸을 뿐, 별도 쿼리·API 호출을 추가하지 않는다. 기존에 이미 확보된 배치 INSERT(단일 `save(rows)`) 및 이메일 수신자 조회의 `In(userIds)` 배치 패턴(N+1 회피, 62-95줄 부근)도 그대로 유지된다.
  - 제안: 없음.

- **[INFO]** 컬럼 추가로 인한 row 크기/메모리 영향 미미
  - 위치: `codebase/backend/src/modules/notifications/entities/notification.entity.ts:37-39`
  - 상세: `backgroundRunId: string | null` (UUID, nullable) 컬럼 1개 추가는 row 당 16바이트(UUID) + NULL 대다수 케이스이므로 테이블 전체 크기·엔티티 인스턴스 메모리에 미치는 영향은 무시할 수준이다. `NotificationDto`(REST 응답)에는 노출하지 않기로 한 설계도 응답 payload 크기를 불필요하게 늘리지 않아 적절.
  - 제안: 없음.

- **[INFO]** resourceType 고정 문자열 리터럴화로 조건 분기 제거
  - 위치: `codebase/backend/src/modules/execution-engine/queues/background-execution.processor.ts:195-213`
  - 상세: 기존 `hasRunId ? ... : ...` 삼항 분기가 `resourceType: 'workflow'` 상수 대입으로 단순화됐다. 알고리즘적으로 유의미한 차이는 없으나(둘 다 O(1)), 분기 제거로 코드 경로가 하나 줄어 미세하게 단순해졌다. 성능 영향은 없음(정보성).
  - 제안: 없음.

### 요약
이번 변경은 알림의 딥링크(resource_type/resource_id=workflow)와 per-run attribution(신규 `background_run_id` 컬럼)을 분리하는 스키마·조회 경로 리팩터링으로, 신규 컬럼에 조회 패턴과 정확히 일치하는 partial index 를 동봉했고 기존에 확립된 배치 INSERT/이메일 배치 조회(N+1 회피) 패턴을 그대로 유지한다. 반복문 내 DB/API 호출, O(n²) 누적, 불필요한 대규모 메모리 할당, 캐싱 누락 등 우려할 성능 이슈는 발견되지 않았다. 변경 범위가 필드 1개 추가 수준으로 작아 성능 리스크가 매우 낮다.

### 위험도
NONE
