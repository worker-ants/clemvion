# 요구사항(Requirement) Review

## 발견사항

- **[INFO]** 버그 A 수정(재개 세그먼트 dispatch 누락) — 코드·spec 일치 확인
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2451-2508` (`finalizeResumedExecutionOutcome`), `spec/data-flow/8-notifications.md:71`
  - 상세: `finalizeResumedExecutionOutcome` 의 FAILED 분기(CANCELLED 분기 아님)에만 `dispatchExecutionFailedNotification` 호출이 추가됐다. 이는 `runExecution` catch 의 초기 세그먼트 배선과 대칭이며, spec §1.1 의 `execution_failed` 행이 규정한 "`execution.status='failed'`인 top-level 실행" 조건과 정확히 일치한다(CANCELLED 는 별개 상태이므로 dispatch 제외가 옳음). `dispatchExecutionFailedNotification` 자체도 `!parentExecutionId` 가드, workflow 미존재/recipients 빈 배열 시 조기 return, try/catch 로 알림 실패가 실행 흐름에 전파되지 않도록 격리 — 모든 분기에서 안전하게 반환(void)한다.
  - 제안: 없음.

- **[INFO]** 버그 B 수정(ModuleRef 지연 해석) — 기존 패턴과의 정합성 확인
  - 위치: `execution-engine.service.ts:91-111` (`getNotificationsService`), `codebase/backend/src/modules/notifications/notifications.service.ts:15-42` (`getWebsocket` — 선례 패턴)
  - 상세: `getNotificationsService` 는 생성자 `@Optional` 주입 실패 시 `ModuleRef(strict:false)` 로 지연 해석 후 캐시하는데, 캐시 sentinel 로 `undefined`(미해석) vs `null`(해석 시도했으나 부재)을 구분해 반복 `moduleRef.get` 호출을 피한다. `try/catch` 로 `moduleRef.get` 실패(모듈 미등록 테스트 환경 등)를 흡수해 항상 `NotificationsService | undefined` 를 반환 — 호출부 가드(`if (!notificationsService) return;`)와 일관된 계약. `NotificationsService.getWebsocket()` 의 기존 지연 해석 패턴과 목적은 같으나, `NotificationsService` 는 여전히 `@Optional`(완전 부재 가능)이라 `try/catch`+`null` 캐시로 좀 더 방어적인 것이 합리적 차이.
  - 제안: 없음.

- **[INFO]** `select: false` 추가가 REST 미노출 의도를 실제로 강제하는지 확인
  - 위치: `codebase/backend/src/modules/notifications/entities/notification.entity.ts:266-272`, `notifications.controller.ts` (raw entity 직접 반환 확인), `background-runs.service.ts:395-413` (`fetchNotifications` 매퍼가 `row.backgroundRunId` 를 참조하지 않음)
  - 상세: `NotificationsController.findAll`/`markAsRead` 등은 DTO 매핑 없이 `NotificationsService` 가 반환한 raw `Notification` 엔티티(또는 `PaginatedResponseDto<Notification>`)를 그대로 반환한다 — 직렬화 필터 계층이 없다는 이전 리뷰(SUMMARY 21_23_13 WARNING #1)의 지적이 사실임을 확인. 이번 커밋에서 추가한 `select: false` 는 TypeORM 기본 `find`/`findOne`/QueryBuilder `getMany` 가 `background_run_id` 컬럼을 SELECT 목록에서 제외하므로, 결과 엔티티에 해당 필드가 아예 채워지지 않아 JSON 직렬화 시에도 노출되지 않는다 — "REST 미노출" 서술이 실제로 강제됨. `findByBackgroundRun` 의 `where: { backgroundRunId }` 조건 필터링은 `select: false` 와 무관하게 정상 동작(TypeORM 은 select 제외 컬럼도 WHERE 절 등가/범위 조건에는 사용 가능)하며, `background-runs.service.fetchNotifications` 매퍼도 `row.backgroundRunId` 를 아예 참조하지 않아(`id/type/title/message/channel/createdAt`) `select: false` 로 인한 회귀가 없다.
  - 제안: 없음 — 의도-구현 괴리(이전 WARNING #1)가 이번 커밋으로 실질 해소됨.

- **[INFO]** e2e 라 SQL 은 ORM 계층(`select: false`)을 우회하므로 어서션 유효성 유지
  - 위치: `codebase/backend/test/execution-failed-notification.e2e-spec.ts:149-180` (`pollNotifications` — `SELECT ... background_run_id FROM notification` raw SQL)
  - 상세: `select: false` 는 TypeORM 엔티티 매핑 계층의 제약이지 DB 컬럼 자체의 접근 제한이 아니므로, e2e 의 `pg.Client` raw SQL 조회는 영향받지 않는다 — 어서션(`background_run_id` not null 등)이 여전히 유효.
  - 제안: 없음.

- **[INFO]** notifications.service.spec.ts 신규 unit 3건 — 실제 서비스 로직과 일치
  - 위치: `codebase/backend/src/modules/notifications/notifications.service.spec.ts:293-421`, `notifications.service.ts:270-297`(`notify`), `:307-340`(`createMany`)
  - 상세: `notify`/`createMany` 모두 `if (entry.backgroundRunId) row.backgroundRunId = entry.backgroundRunId;` 형태의 조건부 대입이며, 미제공 시 `row.backgroundRunId` 는 `undefined` 로 남는다. 신규 테스트(`savedRows[1].backgroundRunId` → `toBeUndefined()`)가 이 동작을 정확히 검증. `findByBackgroundRun` 의 `where`/`order` 어서션도 실제 구현과 일치.
  - 제안: 없음.

- **[INFO]** spec-update draft 큐잉 상태 — 기존 SPEC-DRIFT 트래커의 범위 안
  - 위치: `spec/data-flow/8-notifications.md:89` (여전히 `findByResource` 서술), `spec/1-data-model.md §2.19` (Notification 필드표에 `background_run_id` 행 부재), `plan/in-progress/spec-update-notifications-background-run-id.md` (flip 5건 큐잉 중)
  - 상세: `NotificationsService.findByResource` → `findByBackgroundRun` 개명, `Notification` 엔티티 `background_run_id` 컬럼 신설이 spec 본문에 아직 반영되지 않았으나, 이는 이미 별도 `spec-update-notifications-background-run-id.md` 플랜으로 planner 위임된 기지(既知) drift 이며 본 커밋이 신규로 유발한 것이 아니다. 본 커밋이 추가한 `select: false` 자체는 data-model spec 이 통상 ORM annotation 수준까지 서술하지 않으므로 별도 flip 항목 불필요.
  - 제안: 코드 변경 불필요. 기존 spec-update draft 가 planner 에 의해 처리되면 자동 해소.

## 요약

이 커밋은 e2e 테스트로 실측 적발된 두 개의 선존 결함(재개 세그먼트 dispatch 누락, `@Optional` NotificationsService 순환 인스턴스화로 인한 undefined)을 정확한 근인 진단과 함께 수정했다. `finalizeResumedExecutionOutcome` FAILED 분기의 dispatch 추가는 초기 세그먼트(`runExecution` catch)와 대칭이며 spec §1.1 의 `execution_failed` 규정(top-level, `!parentExecutionId`, resource_type='workflow')과 line-level 로 일치한다. `getNotificationsService()` 의 ModuleRef 지연 해석은 `NotificationsService.getWebsocket()` 의 기존 검증된 패턴을 재사용하면서 `@Optional` 특성에 맞게 더 방어적으로(try/catch + null 캐시) 구현됐다. 이전 리뷰(SUMMARY 21_23_13) WARNING #1(REST 미노출 의도-구현 괴리)은 `select: false` 추가로 실질적으로 해소됐고, 이 변경이 `findByBackgroundRun`(WHERE 절 필터링)이나 `background-runs.service` 매퍼(해당 필드 미참조)에 회귀를 유발하지 않음을 코드 레벨에서 확인했다. WARNING #2(unit 테스트 갭)도 `notify`/`createMany`/`findByBackgroundRun` 3건 추가로 실제 구현 로직과 정확히 일치하는 어서션을 갖췄다. 잔여 spec 본문 미반영(§2.1 `findByResource` 서술, §2.19 필드표)은 이미 별도 플랜으로 planner 위임돼 있는 기지 drift 이며 이번 커밋의 신규 결함이 아니다. TODO/FIXME 잔존 없음, 모든 경로 반환값·에러 시나리오 정의 명확. CRITICAL 급 이슈 없음.

## 위험도
NONE
