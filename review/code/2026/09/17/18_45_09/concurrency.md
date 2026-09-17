# 동시성(Concurrency) 코드 리뷰

대상: 트리거 행을 없애는 네 경로(트리거·스케줄·워크플로·워크스페이스 삭제)의 자원 정리 구현
(`trigger-resource-release.ts`, `trigger-resource-releaser.service.ts`, `workflows.service.ts`,
`workspaces.service.ts`, `schedules.service.ts`, `triggers.service.ts`, `chat-channel-binder.service.ts`
및 대응 스펙/e2e).

## 발견사항

- **[CRITICAL]** 워크플로/워크스페이스 삭제의 배치 외부 자원 해제가 **원자적이지 않다** — 여러
  schedule 트리거 중 하나만 실패해도 이미 해제된 앞선 job 은 되돌릴 수 없는데 삭제 자체는
  전부 취소된다
  - 위치: `codebase/backend/src/modules/triggers/trigger-resource-releaser.service.ts:137-139`
    (`releaseExternalMany` 의 `for (const schedule of schedules) { await this.scheduleRunner.removeJob(schedule.id); }`).
    호출부: `codebase/backend/src/modules/workflows/workflows.service.ts:267-268`
    (`releaser.releaseExternalForParent({ workflowId: id })`),
    `codebase/backend/src/modules/workspaces/workspaces.service.ts:512-513`
    (`releaser.releaseExternalForParent({ workspaceId })`).
  - 상세: `releaseExternalMany` 는 부모(워크플로/워크스페이스) 밑에 schedule 타입 트리거가
    **여러 개** 있으면 그만큼의 `scheduleRunner.removeJob(schedule.id)` 를 순차 `for` 루프로
    부른다. 이 함수의 JSDoc(46-49행)은 "schedule job 해제가 실패하면 **던진다** — 삭제를
    멈춘다(종전 `TriggersService.remove()` 와 같다)"고 적었는데, 이 문구는 **트리거 하나**를
    다루던 `TriggersService.remove()` 의 의미론을 그대로 옮긴 것이다. `TriggersService.remove()`
    는 애초에 schedule 이 최대 1개라 "던지면 멈춘다" 가 "아무것도 안 지워졌다" 와 동치였지만,
    이 배치 루프에서는 다르다: N 개의 schedule 중 k 번째(k>1)에서 `removeJob` 이 실패하면
    1..k-1 번째는 **이미 Redis 에서 제거된 뒤**이고, 그 실패는 이 함수와 호출부
    (`WorkflowsService.remove`/`WorkspacesService.deleteWorkspace`) 어디에서도 잡히지 않아
    그대로 위로 던져진다. 이 시점엔 아직 트랜잭션도 시작 전(267/512행이 269/514행보다 앞선다)
    이므로 워크플로·워크스페이스·트리거·스케줄 행은 **하나도 지워지지 않는다**. 결과:
    호출자는 삭제 요청이 실패(500)했다고 보는데, 그 워크플로에 속한 다른 스케줄 1..k-1 은
    행이 멀쩡히 남아 있으면서 BullMQ job scheduler 만 사라져 **다시는 실행되지 않는다** — 이
    PR 이 없애려는 정확히 그 결함 클래스("Schedule not found" 무한 skip 이 아니라 이번엔
    "아예 tick 을 안 받음")를 삭제 실패 경로에서 새로 만든다. 이 상태는 사용자에게 보이지
    않고(삭제가 실패했다는 것만 보임), 이후 재시도 삭제가 성공하면 우연히 가려지지만
    재시도하지 않으면 영구히 남는다.
    `trigger-resource-releaser.service.spec.ts` 의 "schedule job 해제가 실패하면 던진다" 테스트
    (`schedules: [{ id: 'sched-1' }]`, 스케줄 1개)는 이 배치-부분실패 시나리오를 포착하지
    못한다 — 스케줄이 2개 이상일 때 1번은 성공·2번은 실패하는 케이스가 스펙에 없다.
  - 제안: `Promise.allSettled` 로 전체 스케줄에 대해 해제를 **동시 시도**한 뒤 실패가 하나라도
    있으면 "그 실패 목록"과 함께 던지거나(부분 성공은 감수하되 무엇이 남았는지는 남김), 혹은
    반대로 실패를 삼키고 error 로그로만 남겨 삭제를 계속 진행(스케줄 정리는 `SchedulesService.remove()`
    처럼 best-effort 로 취급)하는 쪽으로 정책을 명시적으로 선택해야 한다. 지금처럼 "일부는
    이미 저지르고 전체는 취소" 인 상태가 가장 나쁘다. 최소한 스케줄이 2개 이상인 워크플로/
    워크스페이스에서 중간 실패가 나는 뮤테이션 테스트를 추가해 이 갭을 드러내야 한다.

- **[WARNING]** `releaseExternalForParent`(락 없는 스냅샷)와 `lockParentAndListTriggerIds`(잠금
  된 열거) 사이의 시간차 — 그 사이 생성된 트리거는 비밀은 지워지지만 외부 자원은 정리되지
  않는다
  - 위치: `codebase/backend/src/modules/triggers/trigger-resource-releaser.service.ts:55-58`
    (`releaseExternalForParent` — `this.triggerRepository.find({ where: parent })` 에 아무 락도
    없음) vs `:60-82`(`lockParentAndListTriggerIds` — 부모 행을 `pessimistic_write` 로 잠근 뒤
    다시 연다). 호출부: `codebase/backend/src/modules/workflows/workflows.service.ts:267-278`,
    `codebase/backend/src/modules/workspaces/workspaces.service.ts:512-530`.
  - 상세: 코드 주석(workflows.service.ts:271-272, workspaces.service.ts:527)은 "잠금 뒤엔 이
    워크플로를 참조하는 트리거 INSERT 가 FK 검사에서 막혀, **비밀을 지울 대상에서 빠지는
    트리거가 없다**"고 정확히 적었다 — 이 보장은 참이고 M9 뮤테이션으로도 확인됐다(plan
    `## 뮤턴트` 표). 하지만 이 보장은 "잠금 시점 이후" 에만 성립한다. `releaseExternalForParent`
    는 그 잠금보다 **먼저** 실행되는, 잠금 없는 읽기다. 두 요청이 겹치는 시나리오:
    1) DELETE 요청 A: `findById` 통과 → `releaseExternalForParent` 가 현재 트리거 집합을 읽어
       외부 해제(schedule job 해제·provider teardown·listener unregister)를 순차로 수행 —
       트리거가 여러 개거나 chat-channel teardown 이 있으면 이 구간은 결코 짧지 않다.
    2) 그 사이 요청 B: 같은 워크플로/워크스페이스에 새 트리거(예: 새 스케줄, 새 webhook)를
       생성 — 이 시점엔 아직 아무 락도 걸려 있지 않으므로 정상적으로 커밋된다.
    3) A 가 트랜잭션을 열고 부모 행을 잠근 뒤(273-275행/528-530행) 트리거를 다시 열거하면
       B 가 만든 새 트리거가 **포함된다**(정확한 열거) → 부모 삭제로 CASCADE 삭제되고,
       커밋 뒤 `releaseSecretsAfterCommit` 이 그 트리거의 비밀도 지운다.
    4) 그러나 그 트리거의 **외부 자원**(B 가 만든 것이 schedule 이면 BullMQ job scheduler,
       chat-channel 이면 provider 등록·listener 등록)은 1) 시점 스냅샷에 없었으므로 **한
       번도 해제되지 않는다**. BullMQ 라면 워크플로가 사라진 뒤에도 job scheduler 가 Redis
       에 남아 (a) 영원히 "Schedule not found" skip 을 반복하거나 (b) 트리거 id 재사용이 없는
       한 아무도 지우지 않는 좀비 엔트리가 된다 — 이 PR 이 트리거 화면 삭제 등에서 고치려는
       바로 그 결함 클래스가, 부모(워크플로/워크스페이스) 삭제 경로에서 좁은 창을 통해
       재발한다.
    이 창은 `lockParentAndListTriggerIds` 내부의 "잠금 전에 열거"(M9) 뮤테이션이 잡는 문제와는
    다른 축이다 — M9 은 "락과 열거의 순서"를 검증하고, 여기 문제는 "외부 해제 스냅샷이 락
    시점보다 먼저 찍힌다"는 **두 단계 사이의 시차** 자체다. e2e/unit 어디에도 "부모 삭제
    도중 그 부모에 새 트리거가 생기는" 케이스가 없다(`trigger-deletion-releases-resources.e2e-spec.ts`
    전수 확인, unit spec 도 동일).
  - 제안: 근본 해법은 "무엇을 해제해야 하는가"의 SoT 를 잠금된 열거 하나로 통일하는 것이다 —
    예를 들어 트랜잭션 안에서 부모를 잠그고 트리거(그리고 필요한 세부 정보: type·chatChannel
    config)를 열거·삭제한 뒤, **커밋 후**에 그 열거 결과를 근거로 외부 해제(schedule job ·
    provider teardown · listener unregister)와 비밀 삭제를 함께 수행하도록 뒤집는다(이미
    비밀은 "커밋 뒤" 로 옮겨진 전례가 있다). 설계를 바꾸지 않는다면 최소한 이 창을 인지하고
    있음을 JSDoc 에 남기고(현재 workspaces.service.ts:547-549 의 "동시 역할 변경" 주석과 같은
    급으로), 재발 감지를 위해 사후 sweeper(트래커에 이미 "사후 정리 재판단" 항목이 있음 — 이
    구체적 시나리오를 그 항목에 명시적으로 추가)로 커버되는지 확인해야 한다.

- **[WARNING]** `deleteWorkspace`(신규 `assertWorkspaceDeletable`)와 `transferOwnership` 사이
  락 획득 순서가 반대라 데드락 가능성이 있다 (기존 패턴, 이번 diff 로 한 곳에 재확인되며
  노출됨)
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:558-572`
    (`assertWorkspaceDeletable` — `WorkspaceMember` 를 먼저 잠그고(558-561) `Workspace` 를
    나중에 잠근다(569-572)) vs `codebase/backend/src/modules/workspaces/workspaces.service.ts:688-708`
    (`transferOwnership` — `Workspace` 를 먼저 잠그고(688-691) `WorkspaceMember` 를 나중에
    잠근다(705-708)).
  - 상세: 이 diff 는 `deleteWorkspace` 안에 인라인으로 있던 잠금 순서(멤버 → 워크스페이스)를
    그대로 `assertWorkspaceDeletable` 로 추출했을 뿐이라 **순서 자체는 이 PR 이 만든 것이
    아니다**(diff 의 `-` 쪽에서도 같은 순서 확인됨). 다만 이번에 별도 private 메서드로 승격돼
    두 호출부(선검사·잠금 검사)가 같은 순서를 공유하게 됐고, 리뷰 스코프인 이 파일을 건드리는
    김에 지적한다: 같은 워크스페이스에 대해 `deleteWorkspace` 트랜잭션(Member 잠금 → Workspace
    잠금)과 `transferOwnership` 트랜잭션(Workspace 잠금 → Member 잠금)이 동시에 실행되면,
    A 가 Member 를, B 가 Workspace 를 먼저 잠근 뒤 서로 상대가 쥔 락을 기다리는 순환 대기가
    가능하다 — PostgreSQL 데드락 감지기가 둘 중 하나를 `40P01` 로 강제 중단시킨다(데이터
    손상은 없지만 사용자에게는 원인 불명의 500 으로 보인다).
  - 제안: 이번 PR 스코프는 아니지만, `assertWorkspaceDeletable` 을 만지는 김에 잠금 순서를
    `transferOwnership` 과 통일(Workspace 먼저, Member 나중)하거나, 반대로 `transferOwnership`
    을 맞추는 별도 후속 항목으로 트래커에 등재할 것을 권한다. 최소한 이 비대칭이 의도적
    설계가 아니라 우연히 남은 순서라는 점은 plan/코드에 남겨 둘 필요가 있다.

- **[INFO]** 동시 중복 삭제 요청 시 `lockParentAndListTriggerIds` 가 부모 `findOne` 의 `null`
  (이미 삭제됨)을 확인하지 않는다
  - 위치: `codebase/backend/src/modules/triggers/trigger-resource-releaser.service.ts:64-76`.
  - 상세: 같은 워크플로에 대해 두 DELETE 요청이 겹치면(더블 클릭 등), 먼저 커밋한 쪽이 행을
    지운 뒤 나중 요청의 `manager.findOne(Workflow, ..., { lock })` 은 `null` 을 돌려주는데 그
    반환값을 버린다. 이어지는 `manager.find(Trigger, { where: parent })` 는 (이미 CASCADE 로
    지워졌으므로) 빈 배열을 주고, `manager.remove(workflow)`(workflows.service.ts:276, 오래된
    in-memory 엔티티)는 TypeORM 관례상 0행 매치를 조용히 넘긴다 — 예외 없이 두 번째 요청도
    "성공"해 `recordAudit` 로 `workflow.deleted` 감사 로그가 **중복 기록**된다. 데이터 손상은
    아니고(트리거 자원 정리 대상도 이미 없음) 감사 로그 노이즈 수준이며, `workflowRepository.remove`
    한 줄이었던 이전 코드도 같은 성격의 문제를 이미 안고 있었을 가능성이 커 이번 diff 의
    신규 회귀로 보긴 어렵다. 차단 사유는 아니라 INFO 로만 남긴다.
  - 제안: 필요하다면 `lockParentAndListTriggerIds` 가 부모 `findOne` 결과를 돌려주게 하거나
    호출부가 이를 확인해 이미 없는 부모에 대해서는 감사를 남기지 않도록 짧게 정리할 수
    있다. 급하지 않다.

## 요약

이번 변경은 트리거 삭제 네 경로의 자원 정리를 정책 함수(`trigger-resource-release.ts`)로
통일하고, 단일 트리거 삭제 경로(트리거 화면·스케줄 화면)에 대해서는 순서·보상 로직을 뮤테이션
테스트까지 곁들여 꼼꼼히 검증했다. 그러나 **여러 트리거를 한 번에 다루는 새 경로(워크플로·
워크스페이스 삭제)** 에서 두 가지 구조적 갭이 남는다: (1) 스케줄 job 배치 해제가 원자적이지
않아 부분 실패 시 이미 해제된 job 은 되돌릴 수 없는데 삭제 전체는 취소돼 "삭제도 안 됐는데
스케줄은 죽은" 상태를 만들 수 있고, (2) 외부 자원 해제(락 없는 스냅샷)와 비밀 정리 대상 열거
(락으로 보호됨) 사이의 시차 때문에 삭제 도중 새로 생긴 트리거의 외부 자원이 누락될 수 있다.
둘 다 이 PR 이 고치려는 "고아 자원" 결함 클래스를 배치 경로에서 좁게 재도입하는 형태라 반드시
검토가 필요하다. 그 외 `deleteWorkspace`/`transferOwnership` 의 락 순서 비대칭은 기존부터 있던
잠재적 데드락 소지로, 이번 diff 가 만든 것은 아니나 같은 자리를 만지는 김에 함께 정리할 만하다.

## 위험도

HIGH
