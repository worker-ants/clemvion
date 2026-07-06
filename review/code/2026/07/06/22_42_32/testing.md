# 테스트(Testing) Review

## 발견사항

- **[WARNING]** `getNotificationsService()` 의 신규 지연-해석/캐싱 로직이 유닛 테스트로 전혀 커버되지 않음
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:97-110` (`getNotificationsService`), 대응 spec `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:620-730`
  - 상세: 기존 `dispatchExecutionFailedNotification` 유닛 테스트(`callDispatch` 헬퍼, spec.ts:623-637)는 `service.notificationsService` private 필드를 직접 mutate 해 주입 없이 값을 밀어넣는다 — 이는 버그 B 수정 이전의 생성자 직접-주입 경로만 재현하며, 이번에 추가된 `getNotificationsService()`(ModuleRef fallback + `resolvedNotificationsService` 캐시 + `try/catch`)는 호출조차 되지 않는다. 구체적으로 커버되지 않는 분기:
    1. `this.notificationsService` undefined 이고 `this.moduleRef` 도 undefined → `svc = undefined`, 캐시에 `null` 저장.
    2. `this.moduleRef.get(NotificationsService, { strict: false })` 가 정상적으로 인스턴스를 반환하는 성공 경로.
    3. `moduleRef.get` 이 예외를 던지는 경우 (`try { } catch { svc = undefined }`) — 순환 그래프 초기화 타이밍에 따라 실제로 발생 가능한 케이스인데 방어 코드만 있고 검증 테스트 없음.
    4. 캐시 재사용 경로 — 최초 호출 후 `resolvedNotificationsService` 가 `null`/인스턴스로 고정된 뒤 두 번째 호출이 `moduleRef.get` 을 재호출하지 않는지(성능/멱등성 보장) 검증 부재.
  - 이 메서드는 이번 커밋이 수정한 "버그 B"(순환 DI 그래프로 인한 undefined 주입)의 핵심 수정 지점이므로, 회귀 방지 관점에서 가장 직접적으로 테스트돼야 할 대상인데 오히려 whitebox 우회로 인해 실질적으로는 e2e 한 곳(`execution-failed-notification.e2e-spec.ts`)의 간접 검증에만 의존한다.
  - 제안: `moduleRef` 를 `{ get: jest.fn() }` mock 으로 명시 주입하는 `TestingModule` 셋업(또는 `Object.defineProperty`/직접 필드 주입)을 추가해 위 4개 분기를 화이트박스로 각각 커버. 최소한 "moduleRef.get 이 throw 하면 undefined 로 안전 처리" 케이스와 "캐시 후 재호출 안 함" 케이스는 유닛 테스트로 고정해 향후 리팩터링 시 회귀를 즉시 잡을 수 있게 할 것.

- **[WARNING]** `finalizeResumedExecutionOutcome` FAILED 분기의 신규 `dispatchExecutionFailedNotification` 호출이 유닛 레벨에서 미검증
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2503-2507`, spec 참조 지점 `execution-engine.service.spec.ts:1633-1640`(`finalizeSpy`), `:13742-13743`(`finalizeOutcomeSpy`)
  - 상세: 기존 spec 은 `finalizeResumedExecutionOutcome` 자체를 `jest.spyOn(...).mockResolvedValue(undefined)` 로 완전히 스텁하고 "호출됐는지"만 검증한다 — 이번 diff 로 그 메서드 **내부**에 추가된 `dispatchExecutionFailedNotification` 호출은 이 mock 때문에 원천적으로 실행되지 않아, "버그 A"(재개 세그먼트 종결 시 dispatch 누락)의 회귀를 유닛 테스트가 절대 잡아낼 수 없는 구조다. 커밋 메시지 스스로도 "그동안 unit 화이트박스(mock)만 있어 은폐됨" 이라 명시하는데, 이번 수정 후에도 동일한 은폐 패턴(메서드 자체를 mock)이 남아 있어 향후 동일 유형의 회귀(예: 이 dispatch 호출이 실수로 삭제됨)를 unit 테스트가 다시 놓칠 위험이 크다.
  - 제안: `finalizeResumedExecutionOutcome` 을 직접 호출하는 별도 `describe` 블록을 추가해 (a) FAILED 분기에서 `dispatchExecutionFailedNotification` spy 가 저장된 execution·에러 메시지로 호출되는지, (b) CANCELLED 분기에서는 호출되지 않는지 명시적으로 검증. e2e 만으로는 커버리지가 "실행 경로 존재 확인"에 그치고 "이 라인이 삭제되면 실패하는 회귀 고정"에는 약하다.

- **[INFO]** 신규 e2e (`execution-failed-notification.e2e-spec.ts`) 는 실제로 두 버그를 잡아낸 실증적 가치가 크고, mock 을 쓰지 않는 blackbox 방식이 적절
  - 위치: `codebase/backend/test/execution-failed-notification.e2e-spec.ts:186-286`
  - 상세: Test1(top-level 실패), Test2(background 본문 실패 격리)는 실 BullMQ+Postgres 인프라에서 `execution_failed`/`background_failed` 발사 여부를 raw SQL 로 직접 검증하며, dedup(owner==executor), 딥링크 계약(resource_type/resource_id≠executionId), channel='both' 등 엣지 케이스를 함께 커버한다. `pollNotifications`/`pollExecutionStatus` 폴링 헬퍼로 비동기 타이밍 이슈도 적절히 흡수. Mock 사용 없이 실제 알림 발사 여부를 검증하므로 이번 커밋이 고친 두 결함 유형(진짜 미발사)에 대해서는 유닛 테스트보다 신뢰도가 높다.
  - 제안: 없음. 다만 이 e2e 가 "일반 실행이 대부분 rehydration 경로로 종결"된다는 커밋 설명에 의존해 버그 A 를 우연히 커버한 것이라면(의도적으로 재개 경로를 강제하는 조건 분기가 코드/테스트에 명시되지 않음), 향후 실행 경로 분기 로직이 바뀌어 실행이 rehydration 을 안 타게 되면 이 e2e 는 "우연히" 통과하되 재개 경로의 dispatch 누락은 다시 은폐될 수 있다 — WARNING 2 의 유닛 테스트 보강으로 경로 독립적인 회귀 고정이 필요한 이유.

- **[WARNING]** `background_run_id` 컬럼에 `select: false` 추가로 인한 REST 미노출 주장이 e2e 로 직접 검증되지 않음
  - 위치: `codebase/backend/src/modules/notifications/entities/notification.entity.ts:48-56`, 리스트 엔드포인트 `codebase/backend/test/notifications-dismiss.e2e-spec.ts`
  - 상세: 이번 수정은 리뷰(SUMMARY 21_23_13 #1)가 지적한 "REST 응답 미노출 의도 vs 실제 직렬화 동작 괴리"를 `select: false` 로 강제 해소했다고 주장하나, `GET /api/notifications`(또는 유사 list) e2e 응답 body 에 실제로 `backgroundRunId`/`background_run_id` 키가 없음을 단언하는 테스트가 없다(`notifications-dismiss.e2e-spec.ts` 확인 결과 관련 assertion 부재). `background-monitoring.e2e-spec.ts` 는 raw SQL 로 `background_run_id` 를 직접 SELECT 해 검증하므로(파라미터 지정 SELECT 는 `select:false` 와 무관하게 항상 값을 반환) 이 테스트는 REST 미노출 주장을 반증도 증명도 하지 않는다.
  - 제안: 알림 list REST 엔드포인트 e2e 에 `expect(res.body.data[...]).not.toHaveProperty('backgroundRunId')` 류의 단언을 추가해, 이번 수정이 실제로 의도한 방어(ClassSerializer 계층 부재 대비)를 하는지 회귀 고정. TypeORM `select: false` 는 `.find()`/`.findOne()` 기본 조회에서는 컬럼을 빼지만, `QueryBuilder` 로 명시적으로 `addSelect` 하는 코드 경로가 생기면 다시 노출될 수 있어 e2e 단언이 없으면 향후 리팩터링에서 조용히 깨질 수 있다.

- **[INFO]** `notifications.service.spec.ts` 신규 3건은 목적에 부합하고 가독성 양호, 다만 `createMany` 케이스의 `backgroundRunId` 부재 시 undefined 단언이 실제 DB 컬럼 nullable 시맨틱과는 미묘하게 다름
  - 위치: `codebase/backend/src/modules/notifications/notifications.service.spec.ts:407-480`
  - 상세: `findByBackgroundRun` where절 검증, `notify`/`createMany` 의 `backgroundRunId` 반영 검증 모두 명확한 이름과 단일 책임의 assertion 으로 읽기 쉽다. 다만 `createMany` 테스트의 `expect(savedRows[1].backgroundRunId).toBeUndefined()` 는 서비스가 필드를 아예 설정하지 않는다는 것만 확인할 뿐, 실제 컬럼은 `nullable: true` 이므로 DB 저장 시 `NULL` 이 되는 것과 애플리케이션 레벨 `undefined` 는 다르다(TypeORM 이 `undefined` 필드는 INSERT 문에서 제외하고 컬럼 DEFAULT/NULL 로 채운다는 전제에 암묵적으로 의존). 이 자체는 기존 컨벤션과 일치해 문제라 보긴 어려우나, mock 기반 테스트라 실제 저장 값이 NULL 이 되는지는 여전히 e2e(`background-monitoring.e2e-spec.ts`)에 위임되어 있다는 점을 참고.
  - 제안: 변경 불필요. 참고 사항으로만 기록.

- **[INFO]** 테스트 격리·독립성은 양호
  - 위치: 전체 diff
  - 상세: `notifications.service.spec.ts` 신규 테스트는 `beforeEach` 로 재생성되는 `repo` mock 을 사용하고 각 `it` 내부에서 `mockImplementation`/`mockResolvedValue` 를 매번 설정해 테스트 간 상태 누수가 없다. `execution-engine.service.spec.ts` 의 `callDispatch` 헬퍼도 주석대로 "service 는 beforeEach 로 매 테스트 재생성되므로 mutation 누수 없음" 이 실제로 성립한다(private 필드 직접 대입이 다음 테스트로 전파되지 않음). e2e 는 `uniqueName`/`uniqueEmail` 헬퍼로 워크스페이스/유저를 매번 새로 만들어 격리.
  - 제안: 없음.

## 요약
이번 커밋은 "unit 화이트박스(mock)가 실제 미발사 결함을 은폐했다"는 정확한 자기 진단에서 출발해 신규 e2e 로 실질적 회귀 방지력을 높인 점은 긍정적이나, 정작 이번에 고친 두 결함의 근본 수정 지점(`getNotificationsService()` 의 ModuleRef 지연 해석/캐싱, `finalizeResumedExecutionOutcome` FAILED 분기의 dispatch 호출)은 여전히 유닛 테스트가 대상 메서드를 통째로 mock/spy 하는 기존 패턴을 유지해 화이트박스 커버리지가 없다 — e2e 단일 계층에만 의존하는 구조라 향후 실행 경로 분기가 바뀌면(예: rehydration 을 안 타는 케이스가 늘면) 동일 유형의 은폐가 재발할 수 있다. `select: false` 도 목적(REST 미노출 강제)을 직접 검증하는 e2e assertion 이 없어 의도와 실증 사이에 여전히 간극이 있다. Critical 은 없으나, 이번 커밋이 목표로 삼은 "실제 미발사 재발 방지"를 유닛 레벨에서도 고정하려면 위 WARNING 항목들의 보강이 필요하다.

## 위험도
MEDIUM
