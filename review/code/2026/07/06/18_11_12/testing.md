### 발견사항

- **[WARNING]** `dispatchExecutionFailedNotification` 의 `@Optional` no-op 경로 미검증
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:247-285` (`dispatchExecutionFailedNotification`), 대응 테스트 `execution-engine.service.spec.ts:620-150`
  - 상세: 생성자에 `@Optional() notificationsService?: NotificationsService` 로 선언해 미주입 시 "dispatch 는 no-op(guard)" 라고 주석에 명시했지만, 신규 3개 테스트 케이스 모두 `callDispatch` 헬퍼로 `service.notificationsService = { createMany }` 를 강제 주입한 뒤 호출한다. `notificationsService` 가 실제로 `undefined`(미주입)인 상태에서 `dispatchExecutionFailedNotification` 이 조용히 리턴하는지 검증하는 테스트가 없다. 이는 프로덕션 외 기존 TestingModule(4곳)이 provider 를 추가하지 않아도 되게 하려는 핵심 설계 근거(guard)인데, 정작 이 guard 분기가 커버되지 않았다.
  - 제안: `notificationsService` 를 주입하지 않은 상태(기본 `beforeEach` 셋업)에서 `dispatchExecutionFailedNotification` 호출 시 예외 없이 조용히 리턴하는 테스트 1건 추가.

- **[WARNING]** `workflowRepository.findOne` 실패/미존재 시 catch 동작 미검증
  - 위치: `execution-engine.service.ts:253-284`
  - 상세: `dispatchExecutionFailedNotification` 은 workflow 를 찾지 못하면(`!workflow`) 조용히 리턴하고, `findOne` 자체가 throw 하면 바깥 `try/catch` 가 삼켜 `this.logger.error` 만 남긴다. 두 경로(“workflow 없음” / “findOne 예외”) 모두 신규 테스트에 없다. best-effort 정책의 핵심 불변식(발사 실패가 실행 종료를 절대 되돌리지 않음)을 검증하는 테스트가 빠져 있어, 향후 리팩터링 중 실수로 `throw` 가 새 나가도 회귀 테스트가 잡지 못한다.
  - 제안: (a) `mockWorkflowRepo.findOne` 이 `null` 반환 시 `createMany` 미호출, (b) `findOne` 이 reject 할 때 `dispatchExecutionFailedNotification` 자체가 reject 하지 않고 로그만 남기는지 두 케이스 추가.

- **[WARNING]** `runExecution` FAILED 분기와 알림 발사의 실제 wiring(통합) 미검증
  - 위치: `execution-engine.service.ts:4403-4409` (호출부), 테스트는 private method 직접 호출만
  - 상세: 신규 테스트는 `dispatchExecutionFailedNotification` 이라는 private 메서드를 타입 캐스팅으로 직접 호출하는 방식(화이트박스)뿐이라, 실제 `runExecution` 이 FAILED 로 종료될 때 이 메서드가 정확히 `savedExecution`/`errMessage` 로 한 번 호출되는지, 그리고 알림 발사가 `finally` 블록/실행 종료 자체를 지연·실패시키지 않는지는 어느 테스트도 커버하지 않는다. 기존의 방대한 `runExecution` 실패 경로 테스트(있다면)에 신규 호출이 삽입됐는지 회귀 확인이 없다.
  - 제안: 최소 1건, 실제 실행 실패 시나리오를 태워 `dispatchExecutionFailedNotification` (또는 `notificationsService.createMany`) 가 호출됨을 스파이로 확인하는 통합형 테스트를 추가하거나, 최소한 이 메서드가 실패해도 `runExecution` 이 정상적으로 FAILED 상태를 반환/기록하는지 확인.

- **[WARNING]** `schedule-runner.service.spec.ts` 신규 케이스가 `notify` 호출 "성공" 경로만 검증, `dispatchScheduleFailedNotification` 자체의 예외 흡수 로직은 간접 검증에 그침
  - 위치: `codebase/backend/src/modules/schedules/schedule-runner.service.spec.ts:265-311`
  - 상세: 두 번째 테스트("알림 발사 실패해도 process 는 원래 engine 에러로 rethrow")는 `workflowRepo.findOne` 을 reject 시켜 `dispatchScheduleFailedNotification` 내부 catch 가 동작하는지 확인하지만, `notificationsService.notify` 자체가 reject 하는 케이스(workflow 조회는 성공하고 `notify()` 호출이 실패하는 경우)는 검증하지 않는다. 두 실패 지점(`findOne` 실패 vs `notify` 실패)은 서로 다른 코드 경로이므로 별도 케이스가 바람직하다.
  - 제안: `workflowRepo.findOne` 은 정상 반환시키고 `notifications.notify` 를 reject 시켜도 `process()` 가 원래 engine 에러로 rethrow 되는 케이스 추가.

- **[WARNING]** `schedule-runner.service.spec.ts` — `workflow.createdBy` 가 없는 경우(guard `!workflow?.createdBy`) 미검증
  - 위치: `schedule-runner.service.ts:930-958` (`dispatchScheduleFailedNotification`)
  - 상세: `if (!workflow?.createdBy) return;` 가드가 있지만, `createdBy` 가 null/undefined 인 workflow 를 반환했을 때 `notificationsService.notify` 가 호출되지 않는지 검증하는 테스트가 없다.
  - 제안: `workflowRepo.findOne` 이 `{ id: 'wf1', name: 'W', createdBy: null }` 를 반환하는 케이스에서 `notify` 미호출 단언 추가.

- **[INFO]** `workspace-invitations.service.spec.ts` — `existingUser.id` 가 있으나 `notificationsService.notify` 호출 시 title/message 내 `inviterName` null 처리(`'관리자'` 기본값) 미검증
  - 위치: `workspace-invitations.service.ts:1181-1206` (`dispatchTeamInviteNotification`), 테스트 `workspace-invitations.service.spec.ts:203-273`
  - 상세: `inviterName ?? '관리자'` 폴백 로직이 있으나, 신규 3개 테스트 모두 `userRepo.findOne` 두 번째 호출에서 `{ id: 'inviter', name: 'Bob' }` 처럼 이름이 있는 inviter 를 반환한다. inviter 조회가 `null` 이거나 `name` 이 없는 경우(예: 탈퇴한 초대자) 알림 메시지가 "관리자님이..." 로 정확히 폴백되는지 확인하는 테스트가 없다. 크리티컬하진 않으나 실제로 존재하는 분기이므로 엣지케이스 누락이다.
  - 제안: `userRepo.findOne` 의 inviter mock 을 `null` 로 하여 message 에 `'관리자님이'` 가 포함되는지 확인하는 테스트 1건 추가(우선순위 낮음).

- **[INFO]** `dispatchExecutionFailedNotification` recipients 필터 — `createdBy`/`executedBy` 둘 다 falsy 인 경우(`recipients.length === 0`) 미검증
  - 위치: `execution-engine.service.ts:258-265`
  - 상세: `workflow.createdBy` 와 `execution.executedBy` 가 모두 없는(예: 시스템 트리거로 실행되어 `executedBy` 가 null, 그리고 workflow 도 `createdBy` 가 없는 극단적 케이스) 상황에서 `recipients.length === 0` 가드로 `createMany` 호출을 skip 하는 분기가 테스트되지 않았다. 실무상 `createdBy` 가 항상 존재할 가능성이 높아 우선순위는 낮지만, 명시적 가드 분기이므로 회귀 안전망으로 추가할 가치가 있다.
  - 제안: 낮은 우선순위 — 필요 시 `workflow.createdBy`/`execution.executedBy` 모두 falsy 인 케이스로 `createMany` 미호출 테스트 추가.

- **[INFO]** Mock 적절성 — `execution-engine.service.spec.ts` 의 `callDispatch` 헬퍼가 `service` 를 `unknown as { notificationsService: unknown }` 로 캐스팅해 private 필드에 직접 대입
  - 위치: `execution-engine.service.spec.ts:66-80`
  - 상세: 화이트박스 방식으로 private 필드·private 메서드에 직접 접근하는 패턴은 이 코드베이스의 기존 관례(다른 곳에서도 유사 캐스팅 패턴 사용)와 일치하고, 주석("beforeEach 로 매 테스트 재생성되므로 mutation 누수 없음")도 격리 근거를 명확히 밝혀 가독성이 양호하다. 다만 이 방식은 생성자 DI 경로(`@Optional`) 자체를 우회하므로, 위 WARNING 항목(미주입 no-op 경로 미검증)과 결합하면 실제 DI 배선이 검증되지 않는 갭으로 이어진다는 점을 참고.

- **[INFO]** 테스트 격리 양호
  - 위치: 전 파일
  - 상세: `beforeEach` 로 모듈 재생성, mock 재설정이 각 describe 블록마다 일관되게 이뤄지고 있으며, 신규 테스트들은 서로 상태를 공유하지 않는다. `notifications.service.spec.ts` 의 `savedRow()` 헬퍼로 fixture 중복을 줄인 것도 가독성에 기여.

- **[INFO]** 회귀 테스트 — 기존 테스트 영향 없음
  - 위치: `execution-engine.service.ts` 의 `resolvedConfig.maxTurns ?? 20` 등 타입 캐스팅 제거 리팩터(라인 294-365 부근)
  - 상세: 순수 코드 정리(불필요한 `as unknown as` 캐스팅 제거)로 동작 변화가 없어 기존 스냅샷/단언에 영향이 없어 보이며, 실제로 해당 라인에 대한 신규/변경 테스트가 diff 에 없는 것은 타당하다. 다만 이 변경이 타입 시스템상 `resolvedConfig`/`s` 의 타입이 실제로 옵셔널 필드를 갖도록 이미 보장돼 있는지(즉 `as unknown as` 제거가 안전한지)는 컴파일러가 보증하므로 별도 런타임 테스트는 불필요.

### 요약

이번 PR3 변경은 3개 알림 발사 소스(`execution_failed`/`schedule_failed`/`team_invite`) 각각에 대해 정상 발사·dedup·비발사 조건·best-effort 예외 흡수를 검증하는 테스트를 성실히 추가했고, PR2 리뷰 라운드에서 지적된 XSS/CRLF/부분실패격리/빈 이메일 경계 등도 이미 촘촘히 커버되어 있어 전반적 테스트 품질은 양호하다. 다만 이번 PR3 신규 코드의 핵심 안전장치인 `@Optional` no-op guard(미주입 시 조용히 스킵)와 `workflowRepository.findOne` 실패/미존재 시의 catch 흡수 로직이 직접 검증되지 않았고, `schedule-runner`/`execution-engine` 양쪽 모두 "발사 로직 자체의 예외"와 "선행 조회(workflow lookup) 실패"가 별개 코드 경로임에도 후자만 테스트되어 전자의 회귀 안전망이 비어 있다. 또한 `dispatchExecutionFailedNotification` 이 `runExecution` 의 실제 실패 흐름에 배선되어 정확히 트리거되는지의 통합 레벨 검증이 없어, 향후 호출부 리팩터링 시 삭제되거나 인자가 어긋나도 유닛 테스트만으로는 포착되지 않을 위험이 있다.

### 위험도
LOW
