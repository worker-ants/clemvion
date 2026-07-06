# Performance Review — execution_failed 실제 미발사 2건 수정 (e2e 적발) + 리뷰 반영

대상 커밋: `656fc7cce1ef8480a38f97744966e2a1d85491db`

## 발견사항

- **[INFO]** `getNotificationsService()` 의 ModuleRef 지연 해석 캐싱은 안전하고 효율적
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:692-711` (`resolvedNotificationsService` 필드 + `getNotificationsService()`)
  - 상세: `ExecutionEngineService` 는 REQUEST 스코프가 아닌 기본(싱글턴) 프로바이더이므로, `moduleRef.get(NotificationsService, { strict:false })` 호출은 프로세스 생애 동안 최초 1회만 발생하고 이후 모든 호출은 캐시된 `resolvedNotificationsService`(성공 시 인스턴스, 실패 시 `null`)를 반환한다. 매 실행 실패마다 반복 조회되는 구조가 아니므로 오버헤드 없음. `NotificationsService.getWebsocket()` 의 기존 패턴과 동일해 일관성도 좋음.
  - 제안: 없음 (양호).

- **[INFO]** 재개(rehydration) 종결 경로에 추가된 `dispatchExecutionFailedNotification` 호출은 실패 시 1회성 부가 쿼리이며 핫패스 아님
  - 위치: `execution-engine.service.ts:2507` (`finalizeResumedExecutionOutcome`), `execution-engine.service.ts:4465-4503` (`dispatchExecutionFailedNotification` 본체)
  - 상세: 이 함수는 `execution.parentExecutionId` 가 없는 top-level 실행이 **실패로 종결될 때만** 실행되며, 내부적으로 `workflowRepository.findOne` 1건 + `notificationsService.createMany` (최대 2 recipient) 1건의 배치 INSERT 만 수행한다. 반복문 안에서 호출되는 구조가 아니고, 실패 이벤트당 정확히 1회 호출되므로 N+1 패턴이 아니다. try/catch 로 감싸 알림 실패가 실행 종결에 영향을 주지 않도록 한 것도 적절.
  - 제안: 없음 (양호).

- **[INFO]** `Notification.backgroundRunId` 에 `select: false` 추가는 조회 성능/정합성에 부작용 없음
  - 위치: `codebase/backend/src/modules/notifications/entities/notification.entity.ts:264-271`, `notifications.service.ts:53-58` (`findByBackgroundRun`), `background-runs.service.ts:395-413` (`fetchNotifications`)
  - 상세: TypeORM 의 `select: false` 는 SELECT 프로젝션에서만 컬럼을 제외하며 `WHERE` 절 평가에는 영향을 주지 않으므로, `findByBackgroundRun` 의 `where: { backgroundRunId }` 쿼리는 계속 partial index(`idx_notification_background_run_id`, migration V107)를 활용해 동일하게 동작한다. 소비측(`fetchNotifications`)도 `backgroundRunId` 를 응답 매핑에 쓰지 않으므로 회귀 없음. 오히려 목록/카운트 등 자주 호출되는 기본 SELECT 에서 불필요한 컬럼 하나를 제외해 미세하게 페이로드가 줄어드는 방향.
  - 제안: 없음 (양호). 향후 이런 내부 전용 컬럼이 늘어나면(SUMMARY WARNING #7 참고) `select: false` 남발보다 별도 서브테이블/JSONB 검토가 나을 수 있음 — 성능 관점 이슈는 아니고 장기 유지보수 관점.

- **[INFO]** 신규 unit 테스트(`notifications.service.spec.ts`) 는 순수 mock 기반으로 실행 비용 영향 없음
  - 위치: `codebase/backend/src/modules/notifications/notifications.service.spec.ts:293-480`
  - 상세: `findByBackgroundRun`/`notify`/`createMany` 의 `backgroundRunId` 처리 검증 3건 추가. Repository mock 만 사용해 무거운 연산·실제 DB 접근 없음.
  - 제안: 없음.

## 요약
이번 커밋은 두 개의 기능 결함(재개 세그먼트 실패 시 알림 미발사, `@Optional NotificationsService` 순환 그래프 undefined) 수정과 리뷰 후속 반영(entity `select: false`, 테스트 보강, 문서화)으로 구성되며, 신규 코드 경로는 모두 실패 이벤트당 1회 호출되는 best-effort 알림 발사이고 반복문 내 DB/API 호출, N+1, 불필요한 대량 메모리 할당, 캐시 무효화 이슈가 없다. `ModuleRef` 지연 해석은 인스턴스 단위로 정확히 캐시되어 반복 조회 비용이 없으며, `select: false` 추가도 WHERE 절 인덱스 활용에 영향을 주지 않아 조회 성능이 유지된다. 전체적으로 성능 관점에서 도입되는 새로운 리스크는 없다.

## 위험도
NONE
