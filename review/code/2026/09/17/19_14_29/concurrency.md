# 동시성(Concurrency) 코드 리뷰

대상: 트리거 행을 없애는 네 경로(트리거·스케줄·워크플로·워크스페이스 삭제)의 자원 정리 —
1라운드 리뷰(`review/code/2026/09/17/18_45_09/concurrency.md`, HIGH·CRITICAL 1·WARNING 2)의
RESOLUTION(`097e583e1`, `a11889086`) 반영 뒤 상태를 처음부터 다시 확인했다. 검증을 위해
저장소 파일을 수정하지 않았다(`Read`/`Grep`/`Bash` 읽기 전용 대조만). `git status --short` 잔여 변경 없음.

## 발견사항

- **[WARNING]** `releaseExternalForParent`(락 없는 스냅샷)와 `lockParentAndListTriggerIds`(잠금된
  열거) 사이의 시차 — 그 사이 부모 밑에 생긴 트리거의 외부 자원(BullMQ job scheduler·provider
  등록·listener 등록)이 영구히 정리되지 않을 수 있다. **1라운드 WARNING과 동일 결함, 코드는
  변경되지 않았다** — RESOLUTION#3 이 "문서화"로만 처분했고 실측으로도 그대로다.
  - 위치: `codebase/backend/src/modules/triggers/trigger-resource-releaser.service.ts:55-66`
    (`releaseExternalForParent` — `this.triggerRepository.find({ where: parent })` 에 락 없음)
    vs `:68-90`(`lockParentAndListTriggerIds` — 부모 행을 `pessimistic_write` 로 잠근 뒤 재열거).
    호출부: `codebase/backend/src/modules/workflows/workflows.service.ts:268`,
    `codebase/backend/src/modules/workspaces/workspaces.service.ts:513`.
  - 상세: 워크플로/워크스페이스 삭제 요청 A 가 `releaseExternalForParent` 로 현재 트리거 집합의
    외부 자원을 해제하는 동안(트리거가 많거나 chat-channel teardown 이 있으면 이 구간은 결코
    짧지 않다) 요청 B 가 같은 부모에 새 트리거(예: 새 schedule)를 만들면, A 가 그 뒤 트랜잭션에서
    부모를 잠그고 다시 여는 시점엔 B 의 트리거가 **포함**된다 → CASCADE 로 삭제되고 커밋 뒤
    `releaseSecretsAfterCommit` 으로 비밀도 지워지지만, B 의 트리거가 등록한 **외부 자원**(스냅샷
    이전엔 존재하지 않았다)은 A 의 `releaseExternalMany` 호출 어디에도 포함되지 않아 한 번도
    해제되지 않는다. schedule 이면 BullMQ job scheduler 가 Redis 에 좀비로 남는다 — 이 PR 이
    닫으려는 정확히 그 결함 클래스가 부모 삭제 경로의 좁은 창을 통해 재발한다.
  - 처분 확인: `trigger-resource-releaser.service.ts:58-61` JSDoc 이 이 창을 "남는 창(spec §4.3)"
    으로 명시하고, `releaseExternalForParent` 를 커밋 뒤로 옮기면 schedule 행이 CASCADE 로
    먼저 사라져 job id 를 못 찾는다는 반대급부까지 적어 뒀다. `plan/in-progress/trigger-deletion-release.md:164`
    체크리스트에 "sweeper 재판단 항목 신설(외부 해제 스냅샷 뒤 생긴 트리거)"이 종결 시 트래커로
    옮길 항목으로 등재돼 있다(현재 미체크 `[ ]` — 실제 트래커 등재는 아직 안 됨). 즉 **코드
    수정 없이 문서화 + 백로그 등재**로 처분된 상태이고, 이는 위험을 없애는 게 아니라 위험의
    존재를 인정하고 다음 사람이 잃어버리지 않게 적어 둔 것이다. 그 자체로는 정당한 트레이드오프
    (스냅샷을 커밋 뒤로 옮기면 다른 방식의 결함이 재발한다는 근거가 있다)이지만, 실제 race
    window 는 이번 라운드에도 열려 있다는 사실은 그대로 보고해야 한다고 판단했다.
  - 제안: 이번 PR 스코프에서 추가 조치는 불필요(1라운드에서 이미 같은 결론). 다만 plan 체크리스트
    §164 의 "sweeper 재판단 항목 신설"이 실제로 새 트래커 문서에 반영됐는지 종결 전에 한 번 더
    확인할 것 — 지금 상태로 plan 이 `complete/` 로 이동하면 이 시나리오가 근거만 남고 추적
    소유자가 없어질 위험이 있다(`feedback_unmeasured_premise_and_test_coupling.md` 의 "살아있는
    Critical/Warning 은 라운드를 더 돌아도 안 사라진다"와 같은 축).

## 검증한 항목 (1라운드 CRITICAL·WARNING — 코드로 해소됨)

- **[해소 확인] 스케줄 job 배치 해제의 비원자성 (1라운드 CRITICAL#1)** — 이제 전체 스케줄에
  대해 `removeJob` 을 **전부 시도**하고, 실패가 하나라도 있으면 이미 해제한 **활성** job 만
  다시 등록한 뒤 던진다.
  - 위치: `codebase/backend/src/modules/triggers/trigger-resource-releaser.service.ts:162-195`
    (`removeScheduleJobsOrRestore`).
  - 확인 내용: `for (const schedule of schedules)` 루프가 `try/catch` 로 개별 실패를 모으고
    (던지지 않고 계속) → 실패가 없으면 조기 반환 → 실패가 있으면 `removed.filter(s => s.isActive)`
    만 `registerJob` 으로 복구 시도(비활성이었던 스케줄은 복구하지 않아 "꺼 둔 스케줄이 켜지는"
    부작용이 없다) → 복구 자체가 실패해도 error 로그만 남기고 마지막에 원래 실패로 던진다.
    이제 부모 삭제가 실패해도 이미 Redis 에서 지워진 활성 job 은 되돌아오므로 "삭제도 실패했는데
    스케줄은 조용히 죽는" 상태가 생기지 않는다. `WorkflowsService.remove`/`WorkspacesService.deleteWorkspace`
    양쪽 모두 `releaseExternalForParent` 가 트랜잭션 **시작 전**에 호출되므로(`workflows.service.ts:268`,
    `workspaces.service.ts:513`), 이 예외가 던져지면 트랜잭션이 아예 열리지 않아 부모/트리거/스케줄
    행은 하나도 지워지지 않는다 — "일부는 이미 저지르고 전체는 취소"라는 1라운드 지적이 닫혔다.
  - 테스트: `trigger-resource-releaser.service.spec.ts:140-176`(스케줄 4개 중 2번째만 실패 →
    나머지 3개도 시도 → 활성인 1·4번만 재등록, 비활성 3번은 재등록 안 함을 이벤트 순서로 단언)
    · `:178-203`(재등록마저 실패해도 원래 실패로 던지고 error 로그에 남김) — 판별 fixture(활성
    2개+비활성 1개+실패 대상 1개)가 부분 실패·선택적 복구 두 축을 모두 가른다. Vacuous 아님
    (`events` 배열 전체를 순서까지 단언).

- **[해소 확인] `deleteWorkspace` ↔ `transferOwnership` 잠금 순서 반대로 인한 교착 가능성
  (1라운드 WARNING#3)** — `assertWorkspaceDeletable` 이 이제 `transferOwnership` 과 같은
  **워크스페이스 → 멤버십** 순서로 락을 건다.
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:563-597`
    (`assertWorkspaceDeletable` — `wsRepo.findOne(...lock)` 이 570행, `memRepo.findOne(...lock)`
    이 574행으로 워크스페이스가 먼저) vs `:687-726`(`transferOwnership` — workspace lock 687행,
    membership lock 704/723행).
  - 확인 내용: 두 트랜잭션 모두 Workspace 행을 먼저 잠그고 WorkspaceMember 행을 나중에 잠그는
    동일 순서를 갖게 됐다 — A(`deleteWorkspace`)와 B(`transferOwnership`)가 같은 워크스페이스에
    동시 진입해도 순환 대기(Workspace→Member vs Member→Workspace)가 성립하지 않아 `40P01`
    교착 경로가 닫혔다.
  - 테스트: `workspaces.service.spec.ts:714-729`(`workspaceRepo.findOne`/`memberRepo.findOne`
    양쪽에 `lock` 옵션이 실제로 전달됐을 때만 이벤트를 기록해 `['workspace', 'member']` 순서를
    직접 단언 — mock 이 항상 이벤트를 쌓는 게 아니라 "락 있는 호출만" 걸러내므로 무관한 호출로
    오염되지 않는다).

- **[확인] 선검사(잠금 없음) → 외부 해제 → 재검사(잠금) 사이 역할 변경 시 처리(1라운드
  WARNING#2·#4)** — 되돌릴 수 없는 외부 해제가 이미 끝났다는 사실을 트랜잭션 실패 시
  error 로그로 명시적으로 남기도록 바뀌었다(가시화, 근본 해결은 설계상 불가능한 창이라는
  1라운드 결론과 일치).
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:537-546`.
  - 테스트: `workspaces.service.spec.ts:731-760`(`memberRepo.findOne` 을 선검사=owner,
    재검사=admin 으로 다르게 mock 해 역할 변경을 재현 — `OWNER_REQUIRED` 로 던지는 것과
    `releaseExternalForParent` 는 호출됐지만 `releaseSecretsAfterCommit` 은 호출되지 않은 것,
    error 로그 문구까지 함께 단언).

- **[확인] 삭제와 겹친 쓰기 보상 순서(teardown → 비밀 삭제)의 실제 Postgres 재진입** —
  `trigger-deletion-releases-resources.e2e-spec.ts:410-472` 가 "부모 삭제(CASCADE) → 커밋 뒤
  정리 → (그 사이) 늦은 비밀 쓰기 → 락 안 재기록 `false` → 보상"의 정확한 순서를 실제 DB 쿼리로
  고정한다. 보상 전 `count()===1`(판별 입력) → 보상 후 `count()===0`(증명) 을 모두 단언해
  "애초에 아무것도 안 써서 0" 이 되는 vacuous 통과를 배제한다.

## 요약

1라운드가 지적한 **CRITICAL 1건**(스케줄 job 배치 해제의 비원자성)과 **WARNING**(`deleteWorkspace`
↔ `transferOwnership` 락 순서 반대로 인한 교착 가능성)은 이번 라운드 코드(`097e583e1`)에서 실제로
고쳐졌고, 각각 판별력 있는 단위/e2e 테스트로 뒷받침된다 — 직접 소스를 읽고 순서·조건·복구 정책을
확인했다. 남은 것은 **1라운드에서도 WARNING 으로 남았던 "외부 해제 스냅샷 vs 잠금된 열거 사이의
시차"** 하나뿐이며, 이번 라운드에서도 코드는 바뀌지 않았고 JSDoc·plan 체크리스트로 위험을
문서화·추적하는 선에서 처분됐다 — 근거(비밀 삭제를 커밋 뒤로 옮기면 CASCADE 로 schedule 행이
먼저 사라진다)는 타당하지만, 실제 race window 자체는 여전히 열려 있으므로 그 사실은 그대로
보고한다. `deleteWorkspace` ↔ `transferOwnership` 외의 기존 워크스페이스 메서드(`leaveWorkspace`
등)는 이번 diff 의 변경 범위 밖이라 별도로 재검토하지 않았다.

## 위험도

MEDIUM
