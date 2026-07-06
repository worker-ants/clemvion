# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** `NotificationsService.findByResource(resourceType, resourceId)` → `findByBackgroundRun(backgroundRunId)` 시그니처 교체 (breaking rename)
  - 위치: `codebase/backend/src/modules/notifications/notifications.service.ts:52` (구 `findByResource`), 호출부 `background-runs.service.ts:398` 부근
  - 상세: 기존 public 메서드 `findByResource`가 완전히 제거되고 `findByBackgroundRun`으로 대체되었다. `grep`으로 저장소 전체를 확인한 결과 잔존 호출부는 없음(`background-runs.service.ts`, 관련 spec 모두 갱신 완료). 다만 이 메서드는 `NotificationsService`의 public API이므로, 워크트리 밖(다른 병렬 브랜치·미머지 PR)에서 동일 메서드를 호출하는 코드가 있었다면 머지 시 컴파일 에러로 드러날 것이다. 현재 브랜치 스냅샷 기준으로는 안전.
  - 제안: 별도 조치 불요 (merge-coordinator 단계에서 동시 진행 브랜치와의 충돌 여부만 참고).

- **[WARNING]** `notification.resource_type`/`resource_id`의 의미 체계 변경 — 기존 저장된 row 는 마이그레이션되지 않음
  - 위치: `codebase/backend/migrations/V107__notification_background_run_id.sql`, `background-execution.processor.ts:195-213`
  - 상세: 배포 이전에 적재된 기존 `background_failed` row 들은 여전히 `resource_type='background_run'` / `resource_id=backgroundRunId` (또는 legacy `execution`/`executionId`) 형태로 DB에 남아 있고, `background_run_id` 컬럼은 NULL이다. 배포 이후 신규 row만 `resource_type='workflow'` + `background_run_id`로 적재된다. 이는 코드 변경의 "부작용"이라기보다 의도된 스키마 마이그레이션의 자연스러운 특성이지만, 다음 두 표면 소비자에 실제 영향이 있다.
    1. `background-runs.service.fetchNotifications`는 신규 컬럼(`background_run_id`)으로만 조회하므로, 배포 이전 실행에 대한 과거 알림은 이 API 응답에서 **누락**된다(주석에도 "옛 알림은 본 API 범위 밖" 명시돼 있어 인지된 트레이드오프).
    2. 배포 이전 알림 팝오버에 남아있는 `background_failed` row (구 `resource_type='background_run'`/`execution`)는 클라이언트 `href.ts`가 unknown `resourceType`을 dead link로 처리하므로 클릭 시 아무 반응 없음(기존에도 404였던 것과 동등하거나 개선).
  - 제안: 의도된 trade-off로 보이나, 배포 노트/Rationale에 "기존 background_failed 알림은 소급 backfill 되지 않는다"는 문구를 명시하면 향후 문의 대응에 도움이 된다 (spec-update draft에 backfill 여부 언급이 없음).

- **[INFO]** `NotificationDto` 공개 REST 응답 계약 변경 — `resourceType`/`resourceId`의 의미가 바뀜 (기존 API 소비자 영향)
  - 위치: `codebase/backend/src/modules/notifications/dto/responses/notification-response.dto.ts`
  - 상세: `background_failed` 타입 알림에 대해 REST 응답의 `resourceType`이 과거 `background_run`/`execution`에서 `workflow`로, `resourceId`가 `backgroundRunId`/`executionId`에서 `workflow.id`로 바뀐다. 이는 이 PR의 핵심 목적(딥링크 버그 수정)이며 프론트 `href.ts`도 이미 `workflow` 라우팅을 기대하고 있어 일관적이다. 다만 이 DTO를 직접 소비하는 외부 API 클라이언트(서드파티 통합 등)가 있다면 `resourceId`로 backgroundRunId를 얻던 기존 동작이 깨진다. `background_run_id`는 REST에 노출되지 않으므로 외부에서 이 값을 얻을 방법이 사라진다.
  - 제안: 공개 API 문서(OpenAPI/CHANGELOG)에 breaking semantic change로 명시할 필요가 있는지 재확인. (내부 전용 API로 판단되면 조치 불요.)

- **[INFO]** `notify()` / `createMany()` 시그니처 확장 — 옵션 필드 추가는 하위 호환
  - 위치: `codebase/backend/src/modules/notifications/notifications.service.ts:271-324` (`backgroundRunId?: string` 파라미터 추가)
  - 상세: 기존 호출자(예: `execution_failed`, `schedule_failed`, `team_invite` 등)는 새 optional 필드를 넘기지 않아도 되므로 하위 호환. `if (entry.backgroundRunId) row.backgroundRunId = ...` 패턴도 기존 `resourceType`/`resourceId` 처리와 동일해 회귀 위험 낮음.
  - 제안: 조치 불요.

- **[INFO]** `background-execution.processor.ts`의 fallback 제거로 인한 동작 변화 (의도된 것, 회귀 아님)
  - 위치: `codebase/backend/src/modules/execution-engine/queues/background-execution.processor.ts:188-213`
  - 상세: 옛 `backgroundRunId` 빈 문자열(legacy NodeExecution) 케이스에서 이전에는 `resourceType='execution'`/`resourceId=executionId`로 fallback 했으나, 이제는 항상 `resourceType='workflow'`/`resourceId=data.workflowId`로 고정된다. `data.workflowId`가 항상 존재한다는 전제(BackgroundExecutionJob 타입 계약)가 깨지면 잘못된 딥링크가 생성될 수 있으나, unit test(`background-execution.processor.spec.ts`)로 이 경로가 커버되어 있어 회귀 위험은 낮다.
  - 제안: 조치 불요. `data.workflowId`가 optional/falsy가 될 수 있는 경로가 있는지만 향후 타입 레벨로 재확인 권장(현재 타입상 필수 필드로 보임).

- **[INFO]** 신규 마이그레이션의 실행 시 부작용 — ADD COLUMN + CREATE INDEX 트랜잭션 처리
  - 위치: `codebase/backend/migrations/V107__notification_background_run_id.sql`
  - 상세: nullable 컬럼 추가 + partial index(대상 row 0건)는 마이그레이션 주석에서 스스로 분석한 대로 메타데이터 락 수준으로 즉시 완료되며, `CONCURRENTLY` 불필요라는 판단이 합리적이다. `notification` 테이블에 대한 쓰기 잠금 시간이 매우 짧을 것으로 예상되어 운영 중 배포 시 부작용(락 경합) 위험은 낮음.
  - 제안: 조치 불요.

- **[INFO]** e2e 테스트가 실제 BullMQ 워커/DB에 의존 (네트워크·프로세스 부작용, 테스트 범위 한정)
  - 위치: `codebase/backend/test/execution-failed-notification.e2e-spec.ts` (신규), `codebase/backend/test/background-monitoring.e2e-spec.ts` (수정)
  - 상세: 실 BullMQ 워커 + Postgres 인프라를 전제로 하는 통합 테스트로, `notify()`가 이메일 디스패치까지 동기 실행하는 경로(`channel='both'`)를 검증한다. 테스트 실행 시 실제 SMTP mock/스텁 인프라에 의존할 것으로 보이나 이 파일 자체에서 메일 발송 관련 mock 여부는 확인되지 않음(다른 e2e 헬퍼에 위임된 것으로 추정). 프로덕션 코드에는 영향 없음, 테스트 인프라 실행 시에만 해당.
  - 제안: 이미 실행 인프라 전제가 명시돼 있어 조치 불요.

## 요약
이번 변경은 `notification` 테이블에 `background_run_id`라는 새 nullable 컬럼을 도입하고, 알림의 "딥링크 라우팅"과 "per-run attribution"이라는 두 책임을 `resource_type/resource_id` vs `background_run_id`로 분리하는 리팩터링이다. 부작용 관점에서 가장 눈에 띄는 지점은 (1) `NotificationsService.findByResource` public 메서드가 `findByBackgroundRun`으로 완전 대체되는 시그니처/API 삭제(현재 저장소 내 잔존 호출자는 없어 안전 확인됨), (2) `NotificationDto`의 `resourceType`/`resourceId` 의미가 `background_failed` 타입에 한해 바뀌는 공개 REST 계약 변경(내부 프론트가 이미 신규 계약을 기대하고 있어 정합), (3) 배포 이전 적재된 과거 `background_failed` row가 신규 `background_run_id` 기반 attribution 조회에서 제외되는 점(의도된 trade-off, backfill 없음)이다. 전역 상태·환경 변수·예상치 못한 파일시스템/네트워크 부작용은 발견되지 않았고, 마이그레이션도 안전성 분석이 코드 내 주석으로 충분히 설명되어 있다. 실질적 리스크는 낮으며, 남은 것은 REST 계약 변경에 대한 외부 소비자 공지 여부와 과거 알림 backfill 미실시에 대한 문서화 정도다.

## 위험도
LOW
