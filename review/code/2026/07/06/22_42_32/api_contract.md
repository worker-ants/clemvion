# API 계약(API Contract) 리뷰

## 대상 커밋
`656fc7cce1ef8480a38f97744966e2a1d85491db` — execution_failed 알림 미발사 버그 2건 수정(rehydration 종결 dispatch 누락, notificationsService @Optional undefined) + 리뷰(SUMMARY 21_23_13) 반영(#1 select:false, #2 unit 테스트, #4/#5/#16 문서 보강).

변경 파일:
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (ModuleRef 지연 해석, rehydration 종결 dispatch 추가)
- `codebase/backend/src/modules/execution-engine/queues/background-execution.processor.ts` (JSDoc만)
- `codebase/backend/src/modules/notifications/entities/notification.entity.ts` (`backgroundRunId` 컬럼에 `select: false` 추가)
- `codebase/backend/src/modules/notifications/notifications.service.spec.ts` (unit 테스트 추가)
- `codebase/backend/src/modules/notifications/notifications.service.ts` (JSDoc만)
- `plan/in-progress/*.md`, `review/code/2026/07/06/21_23_13/*` — 트래커/이전 리뷰 산출물, API 표면과 무관

이 중 새 REST 엔드포인트 추가·URL 변경·요청/응답 DTO 스키마 변경은 없다. 컨트롤러(`notifications.controller.ts`, `background-runs.controller.ts`) 자체는 diff 대상이 아니다.

## 발견사항

- **[INFO]** `notification.backgroundRunId` 컬럼에 `select: false` 추가 — 하위 호환성 문제 없음
  - 위치: `codebase/backend/src/modules/notifications/entities/notification.entity.ts:268-274`
  - 상세: `NotificationDto`(`notification-response.dto.ts`)에는 애초에 `backgroundRunId` 필드가 선언되어 있지 않아, 이번 변경 이전에도 정상 직렬화 경로(DTO 매핑)에서는 노출되지 않았다. 다만 선존 리뷰(SUMMARY 21_23_13 #1)가 지적한 "raw 엔티티를 그대로 반환하는 핸들러가 있으면 실제로는 노출될 수 있다"는 방어적 우려에 대해 `select: false`로 TypeORM 기본 SELECT 자체에서 배제해 계층 방어를 강화한 것으로, API 응답 스키마에 어떠한 축소/변경도 일으키지 않는다(원래도 노출 안 되는 필드를 더 확실히 안 되게 만든 것). Breaking change 아님.
  - 제안: 없음. 현재 방식이 적절하다.

- **[INFO]** `select: false` 컬럼 사용 시 일반 `find()`/`findOne()` 경로의 사이드이펙트 확인
  - 위치: `codebase/backend/src/modules/notifications/notifications.service.ts` (`findByBackgroundRun`), `background-runs.service.ts:404`
  - 상세: TypeORM에서 `select: false`인 컬럼은 `repository.find`/`findOne`은 물론 `QueryBuilder`의 기본 select 목록에서도 제외된다. `findByBackgroundRun`은 WHERE 절에만 `backgroundRunId`를 사용하고 반환 필드로 재노출하지 않으므로 (커밋 메시지·주석에서 명시) 정상 동작한다. `notify`/`createMany`가 `repo.save()`로 엔티티를 저장할 때는 `select: false`가 저장(INSERT/UPDATE)에는 영향이 없고 오직 후속 SELECT/리턴 값 직렬화에만 영향을 준다 — 이 부분도 코드·테스트(`notifications.service.spec.ts` 신규 3건)로 뒷받침된다. 계약상 문제 없음.
  - 제안: 없음.

- **[INFO]** 알림 발사 위치 추가는 순수 서버 내부 부수효과이며 클라이언트 대면 API 표면 변경 아님
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (`finalizeResumedExecutionOutcome` FAILED 분기에 `dispatchExecutionFailedNotification` 호출 추가)
  - 상세: 이 변경은 실행 엔진의 재개(rehydration) 종결 경로에서 이전까지 누락됐던 `execution_failed` 알림 발사를 추가한다. REST/WS 응답 스키마 변경이 아니라 "발생해야 했으나 발생하지 않던 사이드이펙트(알림 row 적재 + WS emit)"를 정상화하는 버그 수정이다. 알림을 소비하는 클라이언트(WS `notification.new`, `GET /notifications`) 입장에서는 이전보다 알림이 더 많이(정상적으로) 오게 되는 변화이나, 이는 명세(spec/data-flow/8-notifications.md §1.1)가 원래 요구하던 동작이므로 하위 호환성 파괴가 아니라 결함 시정이다.
  - 제안: 없음. 다만 이 변경으로 알림 발생 빈도가 늘어나는 만큼(이전엔 조용히 사라지던 실패 실행들이 이제 알림을 유발), 대량 알림 급증(예: 재개 실패가 몰리는 배포 직후) 가능성은 side_effect/performance 리뷰 영역이며 API 계약 자체와는 무관.

- **[INFO]** `getNotificationsService()` (ModuleRef strict:false 런타임 지연 해석) 도입은 내부 DI 배선 수정, 공개 계약과 무관
  - 위치: `execution-engine.service.ts:100-113`
  - 상세: 생성자 `@Optional NotificationsService`가 forwardRef 순환 그래프에서 인스턴스화 순서 때문에 undefined로 남던 버그를 ModuleRef 지연 해석으로 우회한다. 순수 서버 내부 배선이며 API 요청/응답 경로에 노출되지 않는다.
  - 제안: 없음.

## 요약
이번 커밋은 알림 발사 누락 버그 2건(rehydration 종결 dispatch 미배선, DI 순환 그래프로 인한 NotificationsService undefined)에 대한 수정과, 선행 리뷰(SUMMARY 21_23_13)가 제기한 워닝 5건(REST 미노출 강제, unit 테스트 보강, 문서화)에 대한 후속 조치로 구성된다. 새로운 REST 엔드포인트·URL 변경·요청/응답 스키마 변경·페이지네이션·인증/인가 관련 코드는 전혀 없다. `backgroundRunId`에 `select: false`를 추가한 것은 이미 DTO에 노출되지 않던 필드를 엔티티 레이어에서 한 번 더 방어적으로 차단한 것으로, 기존 API 응답 형식에 변화를 주지 않으며 하위 호환성 문제도 없다. 알림 발사 위치 추가(dispatch 배선)는 클라이언트가 소비하는 알림 스트림의 "정상화"이지 계약 변경이 아니다. 전체적으로 API 계약 관점에서 위험 요소는 발견되지 않았다.

## 위험도
NONE
