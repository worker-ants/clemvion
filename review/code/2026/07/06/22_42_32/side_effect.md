# 부작용(Side Effect) Review

## 리뷰 대상
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
- `codebase/backend/src/modules/execution-engine/queues/background-execution.processor.ts` (docstring만 갱신)
- `codebase/backend/src/modules/notifications/entities/notification.entity.ts` (`select: false` 추가)
- `codebase/backend/src/modules/notifications/notifications.service.spec.ts` (unit 3건 추가)
- `codebase/backend/src/modules/notifications/notifications.service.ts` (JSDoc만 갱신)
- `plan/in-progress/*.md`, `review/code/2026/07/06/21_23_13/**` — 문서/이전 리뷰 산출물 (코드 부작용 관점 대상 아님)

## 발견사항

- **[INFO]** `finalizeResumedExecutionOutcome`(재개 세그먼트 종결)에 신규 side effect(알림 발사) 추가 — 의도된 수정이며 안전
  - 위치: `execution-engine.service.ts:2507` (`await this.dispatchExecutionFailedNotification(savedExecution, errMessage);`)
  - 상세: 이 함수는 기존에 `Execution` row 저장 + WS 이벤트 emit(`EXECUTION_FAILED`)만 하던 종결 핸들러였는데, 이번 변경으로 알림 dispatch 라는 새 부작용이 추가됐다. `dispatchExecutionFailedNotification` 자체는 내부에 `try/catch`가 있어 예외를 삼키는 best-effort 설계이므로(4472행 `try { ... } catch`), 알림 발사 실패가 `finalizeResumedExecutionOutcome`을 통해 상위(재개 종결 로직)로 전파되어 Execution 상태 마킹을 되돌리는 일은 없다. 이는 커밋 메시지가 명시한 의도(버그 A 수정)와 정확히 일치하며, 부작용의 범위(누구에게 어떤 알림이 언제 발사되는지)도 기존 top-level 경로(4438행)와 동일한 헬퍼를 재사용해 이중 구현으로 인한 분기 위험이 없다.
  - 제안: 없음 — 의도된 수정, 안전하게 구현됨.

- **[INFO]** DI 순환 그래프 우회를 위한 `ModuleRef` 지연 해석 도입 — 새 인스턴스 필드(`resolvedNotificationsService`) 추가, side effect 범위는 제한적
  - 위치: `execution-engine.service.ts:685-712` (`getNotificationsService()`, `resolvedNotificationsService` 필드, 생성자 `moduleRef?: ModuleRef` 추가)
  - 상세: 생성자 시그니처에 `@Optional() private readonly moduleRef?: ModuleRef` 파라미터가 추가됐다. NestJS DI 는 위치 기반이 아니라 타입 기반 주입이므로, 기존 호출자(TestingModule 4곳 등)가 인자 순서로 수동 인스턴스화하지 않는 한(NestJS 표준 DI 컨테이너를 쓰는 한) 하위 호환 문제는 없다. `resolvedNotificationsService`는 인스턴스 스코프 캐시이며 전역 상태가 아니다 — 서비스가 Nest DI 컨테이너에서 싱글턴이므로 사실상 프로세스 생명주기 동안 1회 해석 후 캐시되는 정상적인 lazy-singleton 패턴이다. `moduleRef.get(..., { strict: false })`는 부모 모듈 트리 전체를 탐색하는 non-strict 조회로, 동일 타입의 provider 가 여러 모듈에 등록돼 있으면 어느 인스턴스가 반환될지 모듈 등록 순서에 의존할 수 있으나, `NotificationsService`는 단일 `NotificationsModule` 에서만 provide 되는 것으로 보여 실질적 모호성은 낮다.
  - 제안: 없음. 다만 `NotificationsModule`이 향후 다중 인스턴스(e.g. 워크스페이스별 provider)로 확장될 경우 `strict: false` 의 모호성 위험을 재검토할 가치가 있음(현재는 해당 없음).

- **[INFO]** `resolvedNotificationsService`가 첫 조회 시 `null`(미해결)을 캐시 — DI 그래프 완전 초기화 이전에 최초 실행이 발생하면 이후 영구히 no-op 될 이론적 위험
  - 위치: `execution-engine.service.ts:699-712`
  - 상세: `getNotificationsService()`는 최초 호출 시 `moduleRef.get()`이 실패(undefined)하면 그 결과(`null`)를 캐시하고, 이후 모든 호출은 `resolvedNotificationsService !== undefined` 분기로 캐시된 `null`을 그대로 반환한다 — 즉 재시도 없이 "영구 no-op"이 된다. 이번 버그 B 수정의 근본 원인이 "생성자 주입 시점에 아직 `NotificationsModule`이 인스턴스화되지 않아 undefined"였던 점을 고려하면, 이론적으로 `ModuleRef.get()` 호출 시점도 애플리케이션 부트스트랩 극초반(예: 첫 execution이 매우 이르게 트리거되는 경우)이라면 동일하게 아직 해석 불가 상태일 수 있고, 그 경우 해당 프로세스 lifetime 전체에서 `execution_failed`/`execution_failed`(재개 경로) 알림이 조용히 계속 no-op 될 수 있다. 실제로는 HTTP 서버가 리슨을 시작하기 전에는 요청이 들어오지 않고 Nest는 `onApplicationBootstrap`/`onModuleInit`이 리스닝 이전에 완료되므로 실무상 위험도는 낮으나, 캐시 로직 자체가 "실패를 영구 고정"하는 형태라는 점은 향후 유사 지연-해석 패턴 확장 시 유의할 부분이다.
  - 제안: 최초 실패 시 `null`을 영구 캐시하지 않고 재시도 허용(`resolvedNotificationsService`를 캐시하지 않거나 TTL/1회성 재시도 부여)하는 방어적 옵션을 고려할 수 있으나, 커밋 메시지에 명시된 "WebsocketService 지연해석과 동일 패턴"이 프로젝트 표준이라면 기존 컨벤션과의 일관성을 우선해 그대로 두어도 무방 (LOW 수준 잠재 이슈).

- **[INFO]** `Notification.backgroundRunId`에 `select: false` 추가 — 인터페이스(엔티티→쿼리 결과) 변경이나 기존 소비자 영향 범위 확인됨
  - 위치: `notification.entity.ts:265-271` (`@Column({ ..., select: false })`)
  - 상세: TypeORM의 `select: false`는 기본 `find()`/`findOne()` 조회에서 해당 컬럼을 SELECT 절에 포함하지 않도록 강제한다. 이는 REST 미노출을 실제로 보장하는 올바른 수정(이전 SUMMARY WARNING #1 반영)이나, `backgroundRunId`를 직접 참조하는 기존 코드 경로가 있다면 `undefined`를 받을 수 있다. 확인 결과 `findByBackgroundRun`은 WHERE 절만 사용(주석에도 명시: "attribution 조회는 WHERE 절만 쓰므로 미노출과 무관하게 동작")하고, 저장 경로(`notify`/`createMany`)는 INSERT 시점에 명시적으로 필드를 설정하므로 `select: false`의 영향을 받지 않는다. 다른 조회 경로에서 `backgroundRunId`를 읽으려면 `.addSelect('notification.backgroundRunId')` 명시가 필요해지는데, diff 범위에서는 그런 신규/기존 소비자가 발견되지 않았다.
  - 제안: 없음 — 의도된 수정이며 부작용 범위가 잘 통제됨. 다만 향후 `backgroundRunId`를 REST 외 내부 로직(예: 배치 리포트, 관리자 대시보드 쿼리)에서 `find()`로 읽으려는 코드가 추가될 경우 `select: false`로 인해 조용히 `undefined`가 반환되는 함정이 있을 수 있으므로, 그런 신규 조회 코드 작성 시 리마인더(엔티티 주석)가 유용할 것 — 이미 주석에 명시돼 있어 충분.

- **[INFO]** `notifications.service.spec.ts` 신규 unit 3건 — 순수 테스트 추가, 프로덕션 부작용 없음
  - 위치: `notifications.service.spec.ts:293-480`
  - 상세: `findByBackgroundRun`/`notify`/`createMany`의 `backgroundRunId` 처리를 검증하는 신규 테스트만 추가됐다. mock repository 사용, 실제 DB/네트워크 접근 없음. 테스트 전용 파일이므로 side effect 리스크 없음.
  - 제안: 없음.

- **[INFO]** `background-execution.processor.ts`, `notifications.service.ts`의 변경은 JSDoc/주석뿐 — 런타임 동작 변화 없음
  - 위치: `background-execution.processor.ts:41-48`, `notifications.service.ts:262-267, 295-303`
  - 상세: diff 전량이 주석/문서 갱신이며 실행 코드 변경이 없다. 시그니처·전역 상태·부작용에 영향 없음.
  - 제안: 없음.

- **[INFO]** 함수 시그니처 변경 없음 — 공개 API 영향 없음
  - 상세: `dispatchExecutionFailedNotification(execution, message)`, `getNotificationsService()`(신규 private 메서드) 모두 클래스 내부 private 메서드다. 생성자 파라미터 추가(`moduleRef`)는 위에서 다룬 대로 NestJS DI 컨테이너를 통한 타입 기반 주입이라 인자 순서 의존 호출자가 없다면 영향 없음. `NotificationsService.notify`/`createMany`의 시그니처(엔트리 객체 shape) 자체는 이번 diff 에서 변경되지 않음(이전 커밋에서 이미 `backgroundRunId` optional 필드가 존재했을 것으로 추정 — 이번 diff 는 JSDoc만).
  - 제안: 없음.

- **[INFO]** 네트워크 호출/이벤트 발사 변경 — 의도된 범위 내
  - 상세: 이번 변경으로 새로 발사되는 이벤트는 재개 종결 경로의 `execution_failed` 알림(WS emit `notification.new` + best-effort 이메일)뿐이며, 이는 이미 존재하던 top-level 경로와 동일한 종류의 이벤트를 다른 경로에서도 쏘게 만든 것 — 신규 이벤트 타입이나 신규 외부 서비스 호출은 없다.
  - 제안: 없음.

## 요약

이번 변경은 두 개의 선존 결함(재개 세그먼트 종결 시 알림 dispatch 누락, DI 순환 그래프로 인한 `notificationsService` 상시 undefined)을 수정하며, 둘 다 "이미 있어야 했으나 실제로는 발사되지 않던" 부작용을 복원하는 성격이라 신규 위험보다는 실무적으로 올바른 방향이다. 재개 종결 핸들러에 추가된 알림 dispatch 호출은 기존 best-effort try/catch 헬퍼를 재사용해 예외 전파 위험이 없고, `ModuleRef` 지연 해석은 생성자 시그니처에 신규 optional 파라미터를 추가했으나 NestJS 타입 기반 DI 특성상 기존 호출자에 영향이 없다. 유일하게 주목할 잠재 이슈는 `getNotificationsService()`의 캐시가 "최초 실패(null)를 영구 고정"하는 형태라는 점으로, 극단적으로 이른 타이밍에 최초 호출이 발생하면 프로세스 lifetime 동안 조용히 no-op 이 재발할 이론적 가능성이 있으나 실무 발생 가능성은 낮다. `Notification.backgroundRunId`에 `select: false`를 추가한 것은 REST 미노출을 실제로 강제하는 올바른 수정이며, WHERE 절 전용 조회 경로(`findByBackgroundRun`)와 INSERT 경로 모두 영향받지 않음을 확인했다. 전역 변수 도입, 파일시스템 부작용, 환경 변수 접근, 의도치 않은 외부 네트워크 호출은 발견되지 않았다.

## 위험도
LOW
