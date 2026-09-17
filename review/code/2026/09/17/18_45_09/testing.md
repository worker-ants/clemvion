# 테스트(Testing) 리뷰 — 트리거 삭제 자원 정리 (DRT-2)

## 총평

이번 변경은 트리거 행을 없애는 네 경로(트리거 · 스케줄 · 워크플로 · 워크스페이스 삭제)와 그 삭제와
겹치는 다섯 개 쓰기 보상 자리(RP-1~RP-5)의 순서·실패 정책을 한 곳(`trigger-resource-release.ts`)으로
모으고, 그 순서를 지키는지를 **이벤트 배열 순서 단언**(`toEqual([...])`)으로 고정한 방식이 일관되게
적용돼 있다. 대조군(이웃 트리거 비밀 생존, 성공 경로에서 보상 미실행, 403 이면 외부 자원 미접촉)이
모든 새 테스트에 짝지어져 있고, `plan/in-progress/trigger-deletion-release.md` 의 뮤턴트 표(M1~M15)가
예측 RED·실측 RED·단언 실패(컴파일 실패로 인한 거짓 RED 아님)를 미리 선언하고 실측을 남긴 것도
`feedback_mutation_validity_and_discriminating_input.md`/`feedback_design_rationale_must_be_mutation_tested.md`
교훈을 잘 따른 사례다. `getJobScheduler` 판정 API 를 실측으로 반증하고 판정 로직을 스케줄러 zset
소속으로 바꾼 경위(plan "내가 틀린 측정" 절)도 회고가 정직하다.

아래는 그럼에도 남아 있는 커버리지 갭 두 가지(WARNING 1건, INFO 2건)다. 전부 정확성 결함이 아니라
**테스트 위치·판별력의 폭**에 관한 지적이다.

## 발견사항

- **[WARNING]** `ChatChannelBinderService.setupChatChannel` 에 새로 추가된 두 보상 분기가 그 클래스
  자신의 spec 파일에는 테스트가 없다 — 오직 `TriggersService` 통합 경로로만 검증된다
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts:292`(성공 경로 뒤
    `else` — "그 사이 트리거가 삭제됐다"), `chat-channel-binder.service.ts:337`(`wroteDegraded`
    체크), `chat-channel-binder.service.ts:369`(신규 추출 `teardownChannelConfig`)
  - 상세: `chat-channel-binder.service.spec.ts` 는 `teardownChatChannel` 하나만 다루고
    (`describe('ChatChannelBinderService.teardownChatChannel', ...)`, `it` 4건),
    `setupChatChannel` 은 이 파일에 테스트가 전혀 없다(이 PR 이전부터도 없었다 — 기존 갭). 이번
    PR 이 그 미검증 함수 안에 새 분기 둘(성공 경로의 `undoAbsentTriggerWrite` 호출, degraded
    fallback 의 같은 호출)을 추가했는데, 이 로직을 실제로 검증하는 테스트는
    `triggers.service.spec.ts` 의 "binder 성공 — 쓰기가 skip 되면…"/"binder degraded — 쓰기가
    skip 되면…"/"binder — 쓰기가 성공하면 되돌리지 않는다"(RP-4/RP-5, `TriggersService.spec.ts`
    3722행 부근 `describe`) 뿐이다. 이 테스트들은 `TriggerResourceReleaserService`·
    `ChatChannelBinderService` 를 실제 DI 로 조립한 통합에 가까운 단위 테스트라 동작 자체는
    커버되지만, `chat-channel-binder.service.ts` 를 단독으로 고치는 개발자가 그 클래스의
    spec 파일만 보고 회귀를 확인하려 하면 이 두 분기를 놓친다 — 실패 신호가 다른 파일(더 복잡한
    `TriggersService` 락 재읽기 스위트)에서만 뜬다.
  - 제안: `chat-channel-binder.service.spec.ts` 에 `setupChatChannel` 전용 `describe` 를 추가해
    (a) 성공 경로에서 락 안 재기록이 `false` 를 돌려주면 `teardown → deleteByPrefix` 순서로
    보상하는지, (b) degraded fallback 도 같은 보상을 하는지, (c) 쓰기가 성공하면 보상하지 않는지를
    그 클래스의 mock 만으로(비밀 삭제기·teardown mock) 직접 단언한다. `triggers.service.spec.ts`
    쪽 테스트는 "TriggersService 가 그 결과를 올바르게 소비하는가"로 역할을 좁혀도 된다.

- **[INFO]** `TriggerResourceReleaserService.releaseExternalMany` 의 혼합 트리거 타입 부분 실패
  상호작용이 테스트되지 않음
  - 위치: `codebase/backend/src/modules/triggers/trigger-resource-releaser.service.ts:128`
    (`releaseExternalMany` — schedule job 해제 루프가 끝난 뒤에야 모든 트리거의
    teardown/unregister 루프가 시작된다)
  - 상세: `trigger-resource-releaser.service.spec.ts` 의 "schedule job 해제가 실패하면 던진다"
    테스트는 트리거가 `schedule` 타입 **하나뿐**인 부모로만 실행한다. 부모 아래에 `schedule` 타입과
    `webhook` 타입이 섞여 있고 `schedule` job 해제가 실패하는 경우, 구현상 뒤의 `for (const trigger
    of triggers)` 루프(모든 트리거의 teardown+unregister) 자체가 통째로 실행되지 않는다 — 이는
    "외부 해제 실패 시 삭제 전체를 멈춘다"는 의도된 fail-fast 설계와 일치하지만, 그 사실(웹훅
    트리거의 teardown 도 함께 건너뛴다)을 직접 확인하는 테스트가 없다. 현재 테스트만으로는 이
    동작이 의도인지 부수 효과인지 다음 리더가 코드를 다시 읽어야 한다.
  - 제안: 혼합 타입(`schedule` + `webhook`) 부모에서 schedule 해제가 실패하는 케이스를 추가하고
    `listenerRegistry.unregister`/`binder.teardownChatChannel` 이 웹훅 트리거에 대해서도 호출되지
    않았음을 단언한다(현재 단일 스케줄 케이스에서 `unregister` not called 만 확인 중).

- **[INFO]** `WorkspacesService.assertWorkspaceDeletable` 의 이중 검사(잠금 없는 사전 검사 →
  잠금 있는 재검사) 사이 역할 변경 경쟁 창은 설계 docstring 에는 명시됐지만 그 경쟁을 재현하는
  회귀 테스트가 없음
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:544`(docstring "두 번
    부른다: … 둘 사이에 역할이 바뀌면 안쪽이 거부하고 외부 해제만 먼저 끝난 상태가 남는다")
  - 상세: `workspaces.service.spec.ts` 새 테스트는 `memberRepo.findOne` 을 `opts.lock` 유무로
    분기해 이벤트 순서(`check:unlocked` → `releaseExternal` → `check:locked` → …)는 고정했지만,
    두 호출이 **다른 결과**(예: 첫 호출은 owner, 두 번째 호출은 role 이 이미 admin 으로 바뀜)를
    반환하는 케이스는 없다. 이 창이 "정리 대상은 best-effort 외부 자원뿐"이라 의도적으로 열어둔
    것이라는 설계 판단 자체는 문서화돼 있으나(design rationale), 그 판단이 실제로 맞는지 —
    즉 안쪽 재검사가 실제로 거부하고 트랜잭션 내부(행 삭제·비밀 정리)는 진행되지 않는지 —
    확인하는 테스트가 없어 향후 회귀(예: 안쪽 재검사를 캐시된 첫 결과로 대체하는 최적화)를 잡지
    못한다.
  - 제안: `memberRepo.findOne.mockResolvedValueOnce({role:'owner'}).mockResolvedValueOnce({role:'admin'})`
    형태로 역할이 검사 사이에 바뀌는 케이스를 추가해, 외부 해제(`releaseExternalForParent`)는
    실행되지만 트랜잭션 내부(`lockAndList`·`workspace.remove`)와 `releaseSecretsAfterCommit` 은
    실행되지 않는지 단언한다.

## 확인한 강점 (참고)

- 이벤트 배열을 단일 배열에 모아 **순서**를 단언하는 패턴(`schedules.service.spec.ts`
  `triggerLockEvents`, `triggers.service.spec.ts` `events`, `workflows.service.spec.ts`/
  `workspaces.service.spec.ts` `removeEvents`/`deleteEvents`)이 새 코드 전체에 일관되게
  적용됐고, "따로 담으면 순서를 단언할 수 없다"는 이유가 각 파일에 명시돼 있다 —
  `feedback_mutation_coverage_multiarm_operators.md` 교훈이 반영됐다.
- `trigger-resource-release.spec.ts` 의 "하나가 실패해도 던지지 않고 남기며, 나머지를 계속
  지운다" 테스트는 실패 트리거 뒤에도 다음 트리거가 처리되는지(`events[2]` 까지)를 확인해
  "첫 실패에서 멈춘다"는 은닉 회귀를 잡는다.
- `WorkflowsService`/`WorkspacesService` 의 "정리 협력자를 못 찾으면 아무것도 지우지 않고
  던진다" 테스트가 `.rejects.toThrow(/TRIGGER_RESOURCE_RELEASER/)` 로 **무엇이 던졌는지**를
  구체적으로 확인해, "다른 이유로 던져도 GREEN" 이 되는 공허한 통과를 막는다
  (`feedback_vacuous_test_three_shapes.md` 7번째 형태 대응).
- e2e (`trigger-deletion-releases-resources.e2e-spec.ts`) 는 모든 케이스에 **이웃 트리거 비밀
  생존** 대조군을 짝지어, "넓게 지우는" 결함(워크스페이스 전체·접두 전체 삭제)이 위양성으로
  통과하는 것을 막는다. `secretCount` 를 심기 직후 먼저 단언해 "0 이 vacuous 하지 않다"는 것도
  스스로 증명한다.
- `getJobScheduler` API 오판을 실측(`pattern: null`/`next: null` 껍데기 반환)으로 발견하고
  판정 로직을 `getJobSchedulers` 목록 소속으로 교체한 경위가 plan 에 정직하게 남아 있다 —
  `feedback_measured_claim_proxy_and_timing.md` 의 "뮤턴트 RED 수는 형태의 함수" 교훈과 같은
  계열의 자기 반증.
- "삭제와 겹친 비밀 쓰기 — 보상 합성" e2e 는 HTTP 로 끊을 수 없는 인터리빙(A 가 S 보다 늦는
  창)을 실제 Postgres 재진입으로 고정하면서, 보상 **전** 상태(`count()` === 1)를 먼저 단언해
  판별 입력 자체를 증명한다 — `feedback_failed_repro_is_not_absence.md`/
  `feedback_mutation_validity_and_discriminating_input.md` 교훈을 정확히 실천했다.

## 요약

새로 도입된 자원 정리 정책(`trigger-resource-release.ts`)과 그 배선(`TriggerResourceReleaserService`,
네 삭제 경로, 다섯 쓰기 보상 자리)은 순서·실패 정책 단위로 촘촘히 테스트돼 있고, 뮤턴트 표로
판별력까지 실측 검증했다. 남은 갭은 정확성 결함이 아니라 (1) `ChatChannelBinderService` 자신의
spec 파일이 새 분기를 놓치는 테스트 위치 문제(WARNING), (2) 혼합 트리거 타입 부분 실패·역할
변경 경쟁창처럼 조합이 넓어지는 자리의 미세한 커버리지 공백(INFO 2건)이다. 전체적으로 회귀
방지력이 높은 테스트 스위트다.

## 위험도

LOW
