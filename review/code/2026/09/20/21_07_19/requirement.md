# 요구사항(Requirement) 리뷰 — 동시 DELETE 두 건이 감사 행을 중복 남기던 결함

## 발견사항

- **[WARNING]** `lockParentAndListTriggerIds` 를 잠금 없는 선조회로 통과한 뒤 부모 부재를 확인해 404로
  단락하는 패턴이 워크플로·워크스페이스 두 경로에는 이번 PR로 적용됐지만, **같은 형태의 결함이 트리거
  자신의 삭제 경로(`TriggersService.remove()`)에도 그대로 남아 있을 가능성이 높다** — 이 PR의 설계
  근거(plan §"선례 — 트리거는 이미 «두 번째 요청은 404» 다", `spec_impact: none` 의 근거)가 이 전제에
  의존한다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:1060-1086` (`remove()`)
  - 상세: `remove()` 는 잠금 없는 `findById`(1061) 로 존재를 확인한 뒤, 트랜잭션 안에서
    `acquireTriggerConfigLock`(1082, advisory lock — `pg_advisory_xact_lock(hashtext('trigger-config:<id>'))`,
    행 자체를 잠그지 않음)을 잡고 곧바로 `m.remove(trigger)`(1085)를 부른다. 이 사이에 **행이 아직
    존재하는지 재확인하는 코드가 없다.** 이 PR이 스스로 실측·문서화한 사실("`manager.remove()`는
    이미 없는 PK 를 지우려 해도 0행이지만 던지지 않는다" — CHANGELOG.md, plan §A)이 그대로 적용되면,
    동시 트리거 DELETE 두 건도 워크플로/워크스페이스와 같은 구조로 (1) 둘 다 204, (2)
    `trigger.deleted` 감사 행 2건이 남을 것으로 예상된다. `triggers.service.spec.ts` 에는 이 경합을
    커버하는 테스트가 없고(동시성 관련 테스트는 lost-update(`config` 재작성) 케이스뿐, DELETE 동시성
    케이스 없음), `codebase/backend/test/` 에도 트리거 자신의 삭제 동시성 e2e가 없다.
  - 이 PR 자체의 코드는 정확하다(워크플로·워크스페이스 두 경로는 line-level로 확인함, 아래 요약
    참고) — 다만 "트리거는 이미 스펙대로 동작한다"는 전제가 실측 없이 채택된 채 이 PR의 근거·문서
    (CHANGELOG "새 정책이 아니라 기존 정책에 맞추는 것", plan `spec_impact: none`)에 반복 인용됐다.
    그 전제가 거짓이면 `spec/2-navigation/2-trigger-list.md §4.4`("두 번째는 404")가 트리거 자신의
    삭제 경로에서 이미 위반되고 있는 것이고, 이번 PR은 그 위반을 발견하고도 스코프 밖으로 넘긴 게
    아니라 **존재를 모른 채** 넘긴 것이 된다.
  - 제안: 이 PR을 막을 사유는 아니다(diff에 없는 파일의 별도 결함 가능성 지적). 다만 후속으로
    `workflow-delete-concurrency.e2e-spec.ts` 와 같은 기법(행 락 직접 획득 + 동시 DELETE)으로
    `TriggersService.remove()` 의 동시 삭제를 실측해, 실제로 404/204 하나씩 나오는지 · `trigger.deleted`
    감사 행이 1건인지 확인할 것을 권한다. 만약 재현되면 별도 plan 항목으로 등재(같은 근본 원인 —
    advisory lock 은 행 잠금이 아니고 `manager.remove()`가 0행에도 던지지 않음).

- **[INFO]** 위 정황과 별개로, 이번 diff가 다루는 두 경로(워크플로·워크스페이스)의 구현 자체는
  spec·plan 서술과 line-level로 일치함을 직접 확인했다:
  - `WorkflowsService.remove()`(`codebase/backend/src/modules/workflows/workflows.service.ts:263-312`)의
    404 코드/메시지(`RESOURCE_NOT_FOUND` / `'Workflow not found'`)는 기존 `findById()`
    (`:166-176`)가 쓰는 것과 동일해 신규 분기가 기존 계약을 그대로 재사용함을 확인.
  - `WorkspacesService.deleteWorkspace()`(`codebase/backend/src/modules/workspaces/workspaces.service.ts:496-561`)의
    `absent` 단락이 `assertWorkspaceDeletable`(`:579-609`, 판정 순서 "멤버십(권한) → 존재 → 타입")보다
    먼저 검사됨을 확인 — plan이 정정한 근거("재검사가 멤버십을 존재보다 먼저 봐 403이 났다")가 실제
    코드 순서와 일치.
  - `TriggerResourceReleaserService.lockParentAndListTriggerIds()`
    (`codebase/backend/src/modules/triggers/trigger-resource-releaser.service.ts:81-109`)는 잠근 행
    (`parentRow`)을 실제로 반환에 반영하고(`parentPresence: parentRow ? 'present' : 'absent'`), 추가
    조회 없이 버려지던 값을 재사용한다는 주석·CHANGELOG 서술과 정확히 일치.
  - `lockParentAndListTriggerIds` 호출부는 저장소 전체에서 워크플로·워크스페이스 두 곳뿐임을
    grep으로 확인(`grep -rl lockParentAndListTriggerIds codebase/backend/src`) — 반환 타입 변경에
    따른 blast radius 누락 없음.
  - `spec/2-navigation/2-trigger-list.md §4.4`("동시 삭제: 두 번째는 `404 RESOURCE_NOT_FOUND`")가
    이 PR이 워크플로 경로에 채택한 에러 코드와 정확히 일치. 워크스페이스는 기존에 이미 쓰이던
    `WORKSPACE_NOT_FOUND` 를 재사용 — 트리거와 코드 문자열이 다른 것은 이 PR이 만든 불일치가 아니라
    기존 리소스별 명명 관례(사전 리뷰 라운드 INFO#5로 이미 확인됨).
  - `spec/2-navigation/1-workflow-list.md` §2.6은 트리거 §4.4와 대칭되는 "동시 삭제 시 두 번째
    404" 서술을 갖지 않는다 — spec이 침묵하는 영역이라 CRITICAL이 아니라 INFO. 이미 두 차례 리뷰
    라운드(20_06_26 INFO#2, 20_43_03 INFO#7)가 같은 갭을 확인했고 비차단 처리됐다.

- **[INFO]** TODO/FIXME/HACK/XXX 주석 없음 (변경된 6개 소스 파일 전수 grep 확인).

- **[INFO]** 반환값 완전성: `lockParentAndListTriggerIds`는 `workflowId`/`workspaceId` 두 분기 모두
  `LockedParentTriggers`를 반환(누락 경로 없음). `remove()`/`deleteWorkspace()`는 성공 시 `void`,
  실패 시 전부 예외로 종료 — 반환 누락 경로 없음.

- **[INFO]** 엣지 케이스: `managerWithEvents([], null)` / `managerWithEvents([])` 두 fixture로
  "부모 부재 + 트리거 0개"와 "부모 존재 + 트리거 0개"를 명시적으로 분리해 truthiness 오판 가능성을
  테스트로 닫음(`trigger-resource-releaser.service.spec.ts:317-346`, 위 판별력 실측이 CHANGELOG/plan에
  기록됨). 두 신규 e2e(`workflow-delete-concurrency.e2e-spec.ts`, `workspace-delete-concurrency.e2e-spec.ts`)
  모두 "락을 놓기 전 아직 안 끝났음"을 확인하는 공허성 가드를 포함해 겹침 미보장으로 인한 vacuous
  pass를 방지.

## 요약

diff에 포함된 두 삭제 경로(워크플로·워크스페이스)의 구현은 spec(`2-trigger-list.md §4.4`)·plan
서술과 line-level로 정확히 일치하며, 반환 타입 변경의 호출부 전수 갱신·엣지 케이스 테스트(부재 vs
0개 분리)·에러 코드 재사용까지 꼼꼼하다. TODO/FIXME 없음, 모든 경로에서 적절한 값을 반환한다. 다만
이 PR의 근거로 반복 인용되는 "트리거 자신의 삭제는 이미 §4.4대로 동작한다"는 전제는 실측되지 않았고,
`TriggersService.remove()`가 워크플로/워크스페이스 수정 전과 구조적으로 동일한 결함(advisory lock ≠
행 잠금, `manager.remove()`가 0행에도 던지지 않음)을 가진 것으로 보여 그 전제가 거짓일 가능성이
있다 — 이는 이 PR의 코드 결함이 아니라 후속 검증이 필요한 별도 표면이다.

## 위험도
LOW
