# 아키텍처(Architecture) Review

## 발견사항

- **[INFO]** 딥링크(resource_type/resource_id)와 attribution(background_run_id)의 관심사 분리는 SRP 에 부합
  - 위치: `codebase/backend/migrations/V107__notification_background_run_id.sql`, `codebase/backend/src/modules/execution-engine/queues/background-execution.processor.ts:166-217`, `codebase/backend/src/modules/notifications/entities/notification.entity.ts:43-49`
  - 상세: 기존에는 `resource_type`/`resource_id` 하나의 필드 쌍이 "팝오버 딥링크 라우팅 키"와 "per-run attribution 조회 키"라는 두 개의 서로 다른 소비자(프론트 `href.ts`, `background-runs.service`)의 요구를 동시에 만족시켜야 했다. 이는 단일 필드가 두 개의 변경 이유(딥링크 계약 변경 / attribution 조회 방식 변경)를 갖는 SRP 위반 상태였다. 본 변경은 이를 `resource_type/resource_id`(딥링크 전용) vs `background_run_id`(attribution 전용) 컬럼으로 분리해, `execution_failed`/`schedule_failed`/`background_failed` 세 실패 타입이 동일한 딥링크 스키마(`resource_type='workflow'`)로 수렴하도록 만들었다(`execution-engine.service.ts:4460`, `schedule-runner.service.ts:234`, `background-execution.processor.ts:184` 모두 동일 패턴 확인). 결과적으로 다형적 소비자 간 결합이 느슨해지고 응집도가 개선됨.
  - 제안: 없음 — 방향성 타당.

- **[INFO]** `NotificationsService.findByResource` → `findByBackgroundRun` 개명은 인터페이스를 구체 유스케이스에 맞춰 좁힌 것으로, ISP 관점에서 긍정적이나 범용 조회 API 소실을 동반
  - 위치: `codebase/backend/src/modules/notifications/notifications.service.ts:42-57`
  - 상세: 기존 `findByResource(resourceType, resourceId)`는 임의 리소스 조합에 대한 범용 조회를 제공했다. 이번 변경으로 `background_run_id` 전용 메서드로 좁혀졌는데, 이는 현재 유일한 호출자(`BackgroundRunsService`)의 필요에는 정확히 맞고 불필요한 매개변수(resourceType 문자열 상수)를 제거해 오용 가능성(잘못된 문자열 전달)을 줄인다는 점에서 합리적이다. 다만 향후 다른 모듈이 "리소스 기준 알림 조회"가 필요해지면 유사 메서드를 재도입해야 하는 확장성 트레이드오프가 있다.
  - 제안: 현재 스코프에서는 문제 없음. 향후 세 번째 소비자가 등장하면 그 시점에 다시 범용화 여부를 판단(YAGNI 원칙에 부합하는 선택이므로 지금 일반화할 필요는 없음).

- **[INFO]** `NotificationsService`가 Repository 접근을 단일 소유(single ownership)하는 레이어 경계가 명확히 유지됨
  - 위치: `codebase/backend/src/modules/executions/executions.module.ts:501-505`, `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts:395-479`
  - 상세: `BackgroundRunsService`(executions 도메인)가 `Notification` 엔티티에 대한 `TypeOrmModule.forFeature`를 직접 등록하지 않고, `NotificationsModule`을 import 해 `NotificationsService.findByBackgroundRun()`에 위임하는 구조를 유지했다. 이는 모듈 경계(도메인 간 데이터 접근은 서비스 계층을 통해서만)를 지키는 좋은 패턴이며, 주석에도 "단일 ownership 유지"라는 의도가 명시되어 있어 향후 유지보수자가 우회 경로(직접 Repository 등록)를 만들 유혹을 줄인다.
  - 제안: 없음.

- **[WARNING]** `Notification` 엔티티에 컨텍스트별 전용 컬럼(`backgroundRunId`)이 누적되는 추세 — 범용 엔티티의 점진적 오염 가능성
  - 위치: `codebase/backend/src/modules/notifications/entities/notification.entity.ts:43-49`
  - 상세: `Notification`은 여러 알림 타입(`execution_failed`, `schedule_failed`, `background_failed`, `team_invite` 등)을 하나의 테이블/엔티티로 표현하는 범용 구조다. 이번 변경으로 `background_failed` 전용 attribution 컬럼(`background_run_id`)이 엔티티에 직접 추가됐다. 현재는 1개뿐이라 문제되지 않지만, 향후 다른 알림 타입에도 유사한 "타입 전용 attribution 키"가 필요해지면 (예: `schedule_run_id`, `integration_sync_id` 등) 같은 패턴으로 컬럼이 계속 늘어나는 risk가 있다 — 이는 고전적인 "God entity" / 다형 테이블에 컬럼을 계속 추가하는 안티패턴의 초기 신호일 수 있다. 현재 설계 자체는 실용적 절충(JSONB `metadata` 컬럼 도입보다 타입 안전한 고정 컬럼)이라 즉각 문제는 아니나, 확장성 관점에서 미리 인지해둘 가치가 있다.
  - 제안: 지금 당장 리팩터링은 불필요. 다만 향후 두 번째 "타입 전용 attribution 키"가 필요해지는 시점에는 `metadata: jsonb` 같은 범용 확장 컬럼 또는 알림 타입별 서브테이블(discriminated) 패턴으로의 전환을 검토할 트리거로 이번 사례를 기록해두면 좋음 (plan/spec Rationale 에 이미 "option b 기각" 근거가 남아 있어 유사 판단 재현에는 도움이 됨).

- **[INFO]** DTO 계층에서 내부 전용 컬럼(`background_run_id`)을 REST 응답에 노출하지 않는 결정이 레이어 책임 분리에 부합
  - 위치: `codebase/backend/src/modules/notifications/dto/responses/notification-response.dto.ts:14-21, 656-674`, `codebase/backend/src/modules/notifications/entities/notification.entity.ts:733-739`
  - 상세: `NotificationDto`는 `backgroundRunId`를 노출하지 않고, `background-runs.service.ts`의 `BackgroundRunNotificationDto`가 별도로 attribution 정보를 감싸도록 유지된다. 이는 "범용 알림 REST 계약"과 "Background 모니터링 전용 API 계약"이라는 서로 다른 프레젠테이션 니즈를 적절히 분리한 것으로, 프레젠테이션 레이어가 엔티티 내부 컬럼을 그대로 유출하지 않는 좋은 경계 유지 사례.
  - 제안: 없음.

- **[INFO]** 순환 의존/역방향 의존 신규 도입 없음
  - 위치: `codebase/backend/src/modules/executions/executions.module.ts`, `codebase/backend/src/modules/notifications/notifications.service.ts`
  - 상세: 이번 변경은 기존 `executions → notifications` 단방향 의존 구조를 그대로 유지한다(`NotificationsModule` import, `forwardRef` 신규 도입 없음). `BackgroundExecutionProcessor`도 기존과 동일하게 `NotificationsService`에 의존할 뿐 새로운 역참조를 만들지 않는다.
  - 제안: 없음.

## 요약

이번 변경은 "딥링크 라우팅 키"와 "per-run attribution 키"라는 서로 다른 두 관심사가 `notification.resource_type/resource_id` 단일 필드 쌍에 뒤섞여 있던 선존 결함을 별도 컬럼(`background_run_id`)으로 분리해 해소한 리팩터링으로, SRP·레이어 경계·모듈 소유권(Repository 단일 접근) 관점에서 명확히 개선된 구조다. `execution_failed`/`schedule_failed`/`background_failed` 세 실패 알림 타입이 동일한 딥링크 스키마(`resource_type='workflow'`)로 수렴해 다형적 일관성도 높아졌다. 유일한 장기적 우려는 `Notification` 엔티티에 타입 전용 attribution 컬럼이 이번처럼 하나씩 추가되는 패턴이 반복될 경우 범용 엔티티가 점진적으로 비대해질 수 있다는 점인데, 현재는 1개뿐이고 대안(옵션 b) 기각 근거도 문서화되어 있어 즉각적인 문제는 아니다. 전체적으로 SOLID·결합도/응집도·모듈 경계 측면에서 건전한 변경이다.

## 위험도

LOW
