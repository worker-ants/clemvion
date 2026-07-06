# 동시성(Concurrency) Review

## 발견사항

- **[INFO]** `getNotificationsService()` 캐시는 스레드 세이프 문제 없음 (Node.js 단일 스레드 + 동기 경로)
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:692-712`
  - 상세: `resolvedNotificationsService` 캐시 필드는 `undefined`(미해석) / `null`(해석 시도했으나 실패) / 인스턴스(성공) 3-state 를 갖는다. `getNotificationsService()` 내부는 `this.moduleRef?.get(...)` 동기 호출만 포함하고 `await` 지점이 없으므로, Node 이벤트 루프 특성상 이 메서드 실행 도중에 다른 요청이 끼어들어 read-modify-write 를 인터리빙할 수 없다 — 즉 "먼저 읽고 나중에 쓰는" 두 단계가 원자적으로 실행된다. `ExecutionEngineService` 는 Nest 기본 싱글턴이라 여러 동시 실행(concurrent execution)이 이 캐시를 공유하지만, 캐시된 값이 무엇이든(해석 성공/실패 모두) 이후 호출에서 동일하게 재사용되는 것이 의도된 동작이라 경쟁 조건에 해당하지 않는다. 최초 몇 번의 동시 호출이 각각 독립적으로 `moduleRef.get()` 을 중복 실행할 수는 있으나(캐시 미스 시 몇 차례 중복 조회), `moduleRef.get` 은 부작용 없는 조회이므로 문제 없음.
  - 제안: 없음.

- **[INFO]** 동일 패턴 선례(`NotificationsService.getWebsocket`)와 일관
  - 위치: `codebase/backend/src/modules/notifications/notifications.service.ts:15-42`
  - 상세: 이번 변경이 도입한 "필드로 캐시 + `moduleRef.get(..., {strict:false})` 지연 해석" 패턴은 기존 `NotificationsService.getWebsocket()` 이 `WebsocketService` 순환 의존을 해소하기 위해 이미 쓰던 것과 동일하다. 그 기존 코드에도 락이 없고 문제로 지적된 적이 없으므로, 신규 코드가 동일한 동시성 안전성 가정(싱글턴 동기 캐시, Node 단일 스레드) 위에 있다는 점이 확인된다.
  - 제안: 없음.

- **[INFO]** `dispatchExecutionFailedNotification` 두 호출 경로(초기 세그먼트 `runExecution` catch / 재개 세그먼트 `finalizeResumedExecutionOutcome`)는 상호 배타적 — 이중 발사(double-dispatch) 경쟁 없음
  - 위치: `execution-engine.service.ts:2507`(재개 종결), `execution-engine.service.ts:4438`(초기 세그먼트 catch)
  - 상세: 하나의 execution 은 초기 세그먼트에서 실패하거나(→`runExecution` catch 경로) 재개(rehydration) 세그먼트로 진입해 실패하거나(→`finalizeResumedExecutionOutcome`) 둘 중 정확히 하나의 종결 경로만 거친다. 이번 diff 는 후자에 dispatch 호출을 추가했을 뿐 두 경로가 동일 execution 에 대해 동시에 실행되도록 만들지 않으므로, 알림 중복 발사 가능성은 도입되지 않았다.
  - 제안: 없음.

- **[INFO]** `dispatchExecutionFailedNotification` 내부는 `await` 순차 호출 + try/catch best-effort — 원자성 문제 없음
  - 위치: `execution-engine.service.ts:4465-4505`
  - 상세: `workflowRepository.findOne` → recipients 계산 → `notificationsService.createMany(...)` 순으로 순차 await 되며, 실패 시 catch 에서 로그만 남기고 삼킨다(“best-effort”로 문서화됨). 이 함수가 실행 종결 처리(`executionRepository.save` + `emitExecution`) 이후에 호출되므로, 알림 발사 실패가 실행 상태 커밋에 영향을 주지 않는 구조는 유지된다. `createMany` 자체는 배치 INSERT + per-row WS emit 이며 이번 diff 로 그 내부 동시성 특성은 변경되지 않았다.
  - 제안: 없음.

- **[INFO]** `select: false` 컬럼 추가는 동시성과 무관, 순수 read-projection 변경
  - 위치: `codebase/backend/src/modules/notifications/entities/notification.entity.ts:266-274`
  - 상세: `backgroundRunId` 컬럼에 `select: false` 를 추가한 것은 기본 SELECT 프로젝션에서 컬럼을 배제하는 TypeORM 메타데이터 설정으로, 트랜잭션/락/동시 쓰기 경로에 영향을 주지 않는다. `findByBackgroundRun` 은 WHERE 절만 사용하므로 `select:false` 와 무관하게 동작한다는 주석도 코드와 일치.
  - 제안: 없음.

## 요약

이번 변경은 (1) `ExecutionEngineService` 의 순환 의존 인스턴스화 순서 문제로 `@Optional NotificationsService` 가 상시 `undefined` 였던 버그를 `ModuleRef` 지연 해석 + 단일 필드 캐시로 수정하고, (2) 재개(rehydration) 세그먼트 종결 경로에 누락돼 있던 `execution_failed` 알림 dispatch 호출을 추가하는 것이 핵심이다. 두 수정 모두 Node.js 단일 스레드 이벤트 루프에서 동기 read-modify-write(캐시 필드) 또는 상호 배타적인 두 종결 경로(초기/재개 세그먼트)만 다루므로 새로운 경쟁 조건·데드락·비동기 오용 위험을 도입하지 않는다. 캐싱 패턴은 같은 클래스군(`NotificationsService.getWebsocket`)의 기존 선례와 동일해 설계 일관성도 있다. `await` 체인은 순차적이며 실패는 best-effort try/catch 로 격리돼 실행 상태 커밋에 영향을 주지 않는다. 동시성 관점에서 지적할 CRITICAL/WARNING 사항은 없다.

## 위험도

NONE
