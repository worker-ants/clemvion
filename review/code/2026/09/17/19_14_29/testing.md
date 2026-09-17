# 테스트(Testing) 리뷰 — 트리거 삭제 자원 정리 (DRT-2, 2라운드)

검증을 위해 저장소 파일을 수정하지 않았다. 확인을 위해 다음 명령만 읽기 전용으로 실행했다(모두 GREEN,
잔여 변경 없음 — `git status --short` 로 확인):

```
npx jest --silent -t "no-op 금지"
npx jest --silent trigger-resource-release trigger-resource-releaser schedules.service \
  workflows.service.spec workspaces.service.spec triggers.service.spec triggers.web-chat
```
(367/367 통과, 1 skipped — 무관한 스위트)

## 총평

1라운드(`review/code/2026/09/17/18_45_09/testing.md`)가 WARNING 1건(binder 자기 스펙 위치)·INFO 2건
(혼합 트리거 타입 부분 실패·워크스페이스 이중 검사 역할 변경 경쟁)을 지적했다. `RESOLUTION.md`·
`097e583e1` 을 diff 로 직접 대조한 결과:

- INFO(혼합 타입) — `trigger-resource-releaser.service.spec.ts` "schedule job 하나가 실패하면
  나머지도 시도하고…" 테스트가 `schedule` 4개 + `webhook` 1개(`w1`)를 섞어 두고
  `expect(events.some((e) => e.startsWith('teardown:'))).toBe(false)` 로 실패 시 webhook
  teardown 도 통째로 건너뜀을 확인한다. **해소됨.**
- INFO(역할 변경 경쟁) — `workspaces.service.spec.ts` "선검사 뒤 역할이 바뀌어 재검사가 거부하면…"
  테스트가 `memberRepo.findOne.mockResolvedValueOnce({role:'owner'}).mockResolvedValueOnce({role:'admin'})`
  로 정확히 그 창을 재현하고, `releaseExternalForParent` 는 호출됐지만
  `releaseSecretsAfterCommit` 은 호출되지 않았음·error 로그 내용까지 단언한다. **해소됨.**
- WARNING(binder 자기 스펙) — `RESOLUTION.md` #9 가 "변경 없음"으로 명시적으로 처분했다
  (`chat-channel-binder.service.spec.ts` 머리 주석이 "setupChatChannel 의 정본은
  triggers.service.spec.ts" 라고 이미 결정해 둔 근거 인용). 코드·테스트 상태를 직접 열어 대조한
  결과 그 결정 그대로다 — 재지적하지 않는다. 이 PR 이 "다음에 그 파일을 손댈 때"에 해당한다는
  `documentation.md` 의 별도 지적(로그 접두 정정)과는 다른 축이라 혼동하지 않았다.

이번 라운드에서 새로 추가된 코드(`097e583e1` 의 `removeScheduleJobsOrRestore` — 부모 삭제 시 schedule
job 배치 해제 실패 복구, `a11889086` 의 `getJobSchedulers` 판정 전환)를 diff·전체 파일 양쪽으로
확인했고, 새 CRITICAL#1 처분(전부 시도 → 실패 시 이미 해제한 **활성** job 재등록 → 던짐)에 대해
`trigger-resource-releaser.service.spec.ts` 가 성공/부분실패/복구실패까지 세 층을 개별 테스트하고
있다(아래 확인 항목 참조). 새로 도입된 로직에 대한 커버리지 갭은 발견하지 못했다.

## 발견사항

- **[INFO]** `removeScheduleJobsOrRestore` 의 실패 메시지 조합(`failures` 2건 이상)이 직접
  단언되지 않는다
  - 위치: `codebase/backend/src/modules/triggers/trigger-resource-releaser.service.ts`
    (`removeScheduleJobsOrRestore` 의 `throw new Error(...failures.map(...).join('; ')...)`)
  - 상세: `trigger-resource-releaser.service.spec.ts` 의 배치 실패 테스트들은 모두 **정확히 하나**의
    `removeJob` 실패(`removeJobFailsFor: ['sched-2']`)만 구성한다. `.rejects.toThrow(/schedule=sched-2: redis down/)`
    는 부분 문자열 매치라 실패가 둘 이상이어도 통과하지만, `join('; ')` 으로 여러 실패를 이어붙이는
    코드 경로 자체(구분자·순서)를 행사하는 케이스는 없다. 복구(재등록) 로직은 이미 여러 활성
    스케줄(`sched-1`·`sched-4`)로 두껍게 덮여 있어 위험은 낮다 — 메시지 포맷팅 한 줄이 전부다.
  - 제안: 필수는 아님. `removeJobFailsFor: ['sched-2', 'sched-4']` 같은 케이스를 하나 추가하면
    `join('; ')` 회귀(예: 구분자 제거)까지 잡을 수 있다.

- **[INFO]** `TriggerResourceReleaserService.releaseExternal`(단일 트리거 진입점)이 격리 단위
  테스트에 직접 대상이 없다
  - 위치: `codebase/backend/src/modules/triggers/trigger-resource-releaser.service.ts`
    (`releaseExternal(trigger)` — `releaseExternalMany([trigger])` 한 줄 위임)
    / `trigger-resource-releaser.service.spec.ts` (describe 가 `releaseExternalForParent` ·
    `lockParentAndListTriggerIds` · `undoAbsentWrite` 셋뿐)
  - 상세: `releaseExternal` 은 `TriggersService.remove()` 가 쓰는 진입점인데,
    `trigger-resource-releaser.service.spec.ts` 에는 이 이름으로 직접 부르는 테스트가 없다.
    다만 `TriggersService.remove()` 를 실제 DI(`TriggerResourceReleaserService` 를 mock 하지 않음)로
    조립한 `triggers.service.spec.ts` 의 "remove() — provider teardown → 락·행 삭제 → 비밀 삭제
    순서다" 등이 결과적으로 이 메서드를 통과시켜 동작 자체는 커버된다. 위임이 한 줄이라 위험은
    낮지만, `releaseExternalMany` 쪽 시그니처가 바뀌면(예: 배열 처리 중 일부만 실패해도 계속하는
    방향으로) 단일 트리거 경로의 기대(즉시 던짐)가 조용히 달라질 자리다.
  - 제안: 필수는 아님. `trigger-resource-releaser.service.spec.ts` 에
    `releaseExternal(trigger)` 를 직접 부르는 얇은 테스트 1건을 추가하면 이 위임이 이름째로
    고정된다.

## 확인한 항목 (문제 없음 — 근거만 기록)

- **새 배치 실패/복구 로직 3단 커버리지** — `trigger-resource-releaser.service.spec.ts` 가
  (a) 전부 시도 후 활성 job 만 재등록(`sched-3` 비활성은 재등록되지 않음을 별도 단언),
  (b) 재등록 자체가 실패해도 원 실패로 던지고 복구 실패는 `Logger.error` 로 남김,
  (c) 단일 실패(재등록 없이 즉시 던짐, `listenerRegistry.unregister` 미호출)까지 세 층을
  분리해 단언한다. `make()` 헬퍼의 `removeJobFailsFor`/`registerJobRejects` 옵션이 각 시나리오를
  정밀하게 판별한다.
- **`getJobSchedulers` 전환의 회귀 방지** — `a11889086` 이 고친 판정(`Queue.getJobScheduler` →
  `getJobSchedulers` 목록 소속)이 e2e(`schedulerRegistered` 헬퍼)와 plan 의 "내가 틀린 측정" 절에
  정직하게 기록돼 있고, 그 헬퍼가 e2e 안에서 "삭제 전 `true` → 삭제 후 `false`" 전이를 같은
  판정 함수로 보게 해 판별력을 스스로 증명한다 — 새로 도입된 판정 로직 자체가 검증 대상이라는
  드문 경우인데 잘 처리됐다.
- **테스트 격리** — `schedules.service.spec.ts` 의 `triggerLockEvents`, `workflows.service.spec.ts`/
  `workspaces.service.spec.ts` 의 `removeEvents`/`deleteEvents`, `triggers.service.spec.ts` 의
  `events` 모두 module-scope 배열을 각 `beforeEach`/테스트 시작부에서 `length = 0` 으로 리셋한다.
  `workspaces.service.spec.ts` 의 `triggerReleaser` 는 전역 `jest.clearAllMocks()` 대신
  `Object.values(triggerReleaser).forEach((fn) => fn.mockClear())` 로 좁혀 다른 mock 상태를
  건드리지 않는다 — 의도가 주석에도 명시돼 있다. `workspaceRepo`/`memberRepo` 는 매 테스트
  `Test.createTestingModule` 로 새로 만들어져 구현 세부(`fakeManager.getRepository` 가 같은
  객체를 되돌리는 것) 외엔 테스트 간 상태 누수가 없다.
- **"무엇이 던졌는지"를 보는 no-op 금지 테스트** — `WorkflowsService`/`WorkspacesService` 양쪽의
  "정리 협력자를 못 찾으면 아무것도 지우지 않고 던진다" 테스트를 직접 실행해 GREEN 을 확인했다
  (`TRIGGER_RESOURCE_RELEASER` provider 를 뺀 순정 `Test.createTestingModule` 이 실제 Nest
  `ModuleRef.get` 예외를 던지고, 그 메시지에 심볼 설명이 포함돼 `.rejects.toThrow(/TRIGGER_RESOURCE_RELEASER/)`
  가 vacuous 하지 않음을 확인). `feedback_vacuous_test_three_shapes.md` 7번째 형태(다른 이유로
  던져도 GREEN)를 정확히 막는다.
- **Mock 이 실제 API 형태와 어긋나지 않는다** — `TriggerResourceReleaserService` 유닛 테스트의
  `manager` mock 은 `findOne`/`find` 시그니처를 실제 TypeORM `EntityManager` 형태로 두고, `where`
  절 내용(`workflowId`/`workspaceId`)까지 `toMatchObject` 로 확인한다. `workspaces.service.spec.ts`
  의 `fakeManager.getRepository` 위임은 실제 트랜잭션 콜백이 받는 `manager.getRepository(Entity)`
  형태를 그대로 흉내내 프로덕션 코드 경로와 나란하다.
- **e2e — 대조군 + 판별 입력 자기증명** 유지 — `trigger-deletion-releases-resources.e2e-spec.ts`
  전 케이스가 "지우면 안 되는 이웃 트리거의 비밀 생존"을 짝짓고, 심은 직후 `secretCount` 를 먼저
  단언해 0 이 vacuous 하지 않음을 스스로 증명한다. 두 번째 describe(보상 합성)는 보상 **전** 상태
  (`count() === 1`)를 먼저 확인해 판별 입력 자체를 증명한 뒤 보상 후 0 을 단언한다.
- **회귀 테스트 유효성** — `TriggersService.remove — deleteByPrefix 호출 검증 (SUMMARY#13)` 등
  기존 스위트가 새 아키텍처(`TriggerResourceReleaserService` 실제 DI 배선) 위에서도 그대로 유효한
  형태로 유지되며(교체가 아니라 provider 추가), `DELETE (schedule 타입) → trigger 삭제 전 removeJob`
  테스트는 `scheduleRepo.findOne` → `scheduleRepo.find`(일괄 조회로 바뀐 실제 시그니처)로 정확히
  갱신됐다. `WorkflowsService`/`WorkspacesService` 쪽 "외부 해제 → 트랜잭션 밖 repository.remove
  금지" 단언(`expect(mockRepository.remove).not.toHaveBeenCalled()`)은 옛 코드 경로(트랜잭션 밖에서
  직접 `repository.remove`)로의 회귀를 구조적으로 잡는다.

## 요약

1라운드에서 지적된 INFO 2건(혼합 트리거 타입 부분 실패, 워크스페이스 이중 검사 사이 역할 변경
경쟁창)은 이번 커밋들에서 정확히 그 시나리오를 재현하는 테스트로 해소됐고, WARNING 1건(binder
자기 스펙 위치)은 사유를 남긴 채 의도적으로 유지하기로 한 결정 그대로다. 이번 라운드에서 새로
추가된 schedule job 배치 해제/복구 로직(`097e583e1`)과 판정 API 전환(`a11889086`)은 성공·부분
실패·복구 실패 세 층을 모두 개별 테스트로 덮고, 실행해 GREEN 을 직접 확인했다. 새로 발견한 갭은
아주 좁은 INFO 2건(다중 실패 메시지 조합 미검증, 단일 트리거 진입점의 직접 유닛 테스트 부재)뿐이며
둘 다 통합 경로로 실질적으로 커버되고 있어 차단 사유가 아니다.

## 위험도

LOW
