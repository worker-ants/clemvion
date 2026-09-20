# 테스트(Testing) 리뷰

## 발견사항

- **[WARNING]** `WorkspacesService.deleteWorkspace` 의 이번 라운드 핵심 수정(동시 삭제 경합 시 403 오응답·거짓 로그를 404 로 단락)이 **실제 Postgres 동시성으로는 검증되지 않는다** — workflow 경로에만 있는 e2e 기법이 workspace 경로엔 없다.
  - 위치: 부재 확인 — `codebase/backend/test/` 에 workspace 삭제 동시성 e2e 파일이 없음(`find codebase/backend/test -iname "*workspace*delete*"` 결과 0건). 대조: `codebase/backend/test/workflow-delete-concurrency.e2e-spec.ts`(workflow 경로만 실 DB 락으로 검증). 관련 코드: `codebase/backend/src/modules/workspaces/workspaces.service.ts:530`~`535`(신규 404 단락), `:536`~`542`(`assertWorkspaceDeletable` 재검사 — 같은 트랜잭션 안에서 워크스페이스 행을 **두 번째** `pessimistic_write` 로 재잠금).
  - 상세: `workspaces.service.spec.ts` 의 신규 단위 테스트(`잠금 뒤 워크스페이스가 사라졌으면(동시 삭제) 404 이고 거짓 로그를 남기지 않는다`, 743~778행)는 `triggerReleaser.lockParentAndListTriggerIds` 포트 자체를 **mock** 해 `parentPresence: 'absent'` 를 직접 주입한다. 이 테스트는 "그 값이 주어졌을 때 코드가 올바른 순서(부재 체크 → 재검사)로 반응하는가"라는 **결정 로직**은 확실히 검증하지만(뮤테이션으로 실측 확인됨 — RESOLUTION.md 기록), 그 값을 실제로 만들어내는 메커니즘 — 즉 (1) 동시 두 트랜잭션이 같은 워크스페이스 행에 `pessimistic_write` 를 걸어 하나가 대기하는지, (2) 먼저 커밋한 트랜잭션이 CASCADE 로 멤버 행까지 지운 뒤 진 쪽의 `findOne` 이 정말 `null` 을 돌려주는지, (3) 재검사의 **두 번째** `pessimistic_write` 재잠금이 같은 트랜잭션·같은 커넥션에서 실제로 self-deadlock 없이 통과하는지 — 은 어디서도 실측되지 않는다. `concurrency` 리뷰어(이전 라운드 `concurrency.md`)도 이 지점을 "self-deadlock 을 유발하지 않으며" 라고 **정적 근거**로만 서술했을 뿐, 실측은 없다. `workflow-delete-concurrency.e2e-spec.ts` 는 정확히 이 형태(`SELECT ... FOR UPDATE` 로 강제 인터리빙 + `Promise.race` 공허성 가드 + 실 DB 감사 행 카운트)를 workflow 경로에만 제공한다 — 이번 라운드가 고친 workspace 경로(직전 라운드에서 architecture·maintainability·database 세 리뷰어가 각각 MEDIUM 근거로 지적한 바로 그 결함)는 같은 형태의 실 DB 동시성 검증이 없다. RESOLUTION.md 의 "뮤테이션 판별력 실측" 항목도 전부 unit 레벨(mock 포트 값 뒤집기)이고, e2e 실행 결과(368/368)는 기존 스위트를 그대로 돈 것이지 workspace 동시성을 겨냥한 신규 케이스가 아니다.
  - 제안: `workflow-delete-concurrency.e2e-spec.ts` 와 같은 기법(별도 커넥션이 대상 워크스페이스 행을 `SELECT ... FOR UPDATE` 로 먼저 쥐고, 두 `DELETE /api/workspaces/:id` 를 동시에 쏜 뒤 COMMIT 으로 함께 풀어준다)으로 `workspace-delete-concurrency.e2e-spec.ts` 를 추가해, 두 요청이 `[204, 404]` 로 갈리고 멤버·초대 행이 정확히 한 번만 정리됨을 실측 고정할 것을 권고한다.

- **[INFO]** (직전 라운드 `testing.md` INFO 가 이번 라운드에도 그대로 남음 — 위험 낮아 재차 INFO 로 유지) `TriggerResourceReleaserService.lockParentAndListTriggerIds` 의 `parentPresence` 판정 테스트가 `workflowId` 변형만 커버하고, `workspaceId` 변형에 대해서는 `absent` 케이스가 없다.
  - 위치: `codebase/backend/src/modules/triggers/trigger-resource-releaser.service.spec.ts:300`~`316`("워크스페이스 — 워크스페이스 행을 잠그고 workspaceId 로 연다" — `lockParentAndListTriggerIds` 반환값 자체를 검증하지 않고 `events`/`find` 호출 인자만 확인), `:322`~`346`(신규 `absent`/`present` 테스트 두 개는 모두 `{ workflowId: ... }` 만 사용).
  - 상세: 구현(`trigger-resource-releaser.service.ts:89`~`108`)은 `parentRow ? 'present' : 'absent'` 판정 로직을 두 엔티티 분기(`Workflow`/`Workspace`)가 삼항 연산자 이후 공유하므로 실제 위험은 낮다. 다만 `workspaceId` 변형이 `absent` 값을 실제로 만들어내는지 직접 단언하는 테스트는 여전히 없다 — 이 헬퍼가 `WorkspacesService.deleteWorkspace` 의 신규 404 단락이 의존하는 유일한 데이터 소스라는 점에서, 위 WARNING 이 지적한 e2e 공백과 같은 축의 갭이다.
  - 제안: 필수는 아님 — 두 `TriggerParent` 변형에 대한 표 기반(parametrized) 테스트로 합치는 것을 고려.

## 긍정적으로 확인한 점

- 신규 unit 테스트(workflow/workspace 양쪽 "부재 → 404" 케이스)는 `jest.spyOn(Logger.prototype, 'error')` 를 `try/finally` 로 감싸 격리하고(`mockRestore()` 가 assertion 실패 시에도 실행됨), `Logger.error` 미호출을 직접 단언해 직전 라운드 WARNING(#3 로그 회귀 테스트 부재)을 닫았다 — `workflows.service.spec.ts:1029`~`1059`, `workspaces.service.spec.ts:744`~`777`.
- workspace 신규 테스트는 `memberRepo.findOne`/`workspaceRepo.findOne` 을 **재검사가 통과할 수 있는 값**(owner 역할·유효한 team 워크스페이스)으로 세팅해 두었다 — 이는 우연이 아니라, 새 404 단락이 없다면 재검사가 실제로 통과해 `workspaceRepo.remove` 가 호출되고 `await expect(...).rejects...` 자체가 실패하도록 설계된 것이다(RESOLUTION.md 의 뮤테이션 실측이 이를 확인: 단락 제거 시 RED). 판별력이 있는 fixture.
- `TriggerResourceReleaserService.lockParentAndListTriggerIds` 의 반환 타입 변경(`string[]` → `LockedParentTriggers`)에 맞춰 두 호출부(`workflows.service.spec.ts:90`~`97`, `workspaces.service.spec.ts:46`~`52`)의 mock 리턴값이 함께 갱신되어 있고, `grep` 로 전수 확인한 결과 구버전 반환 형태(`Promise.resolve(['...'])` 단독 배열)로 남은 호출부는 없다 — 회귀 없음.
- `workflow-delete-concurrency.e2e-spec.ts` 는 우연에 기대지 않는 결정적 경쟁 재현(별도 커넥션의 행 락 + `Promise.race` 공허성 가드)이며, plan 문서(`plan/in-progress/dup-delete-audit.md`)에 `origin/main` 되돌리기로 얻은 RED(`[204, 204]`, 감사 2건) 실측까지 남겨 판별력을 스스로 증명했다.
- `managerWithEvents` 헬퍼에 추가된 `parentRow` 파라미터는 기본값(`{ id: 'parent-1' }`)을 유지해 기존 호출부(인자 미전달)를 깨지 않는다 — 회귀 안전.

## 요약

이번 라운드는 직전 라운드(`review/code/2026/09/20/20_06_26`)가 지적한 워크스페이스 경로 비대칭(403 오응답·거짓 로그)과 로그 회귀 테스트 부재를 실제로 닫았고, 그 결정 로직(부재 체크 → 재검사 순서, 로그 억제 가드)은 mutation 실측(cp 백업/원복, `git checkout` 미사용)으로 검증돼 신뢰도가 높다. 다만 이 수정이 의존하는 실제 메커니즘 — 두 개의 동시 트랜잭션이 워크스페이스 행에 대해 `pessimistic_write` 를 걸고 하나가 CASCADE 로 멤버 행까지 지운 뒤 진 쪽이 재검사에서 실제로 그 부재를 관측하는 것 — 은 workflow 경로에만 있는 실 DB 동시성 e2e 로 검증되지 않는다. 워크스페이스 단위 테스트는 그 사실을 mock 으로 주입해 코드의 반응(순서·분기)만 확인할 뿐이라, 직전 라운드에서 세 명의 리뷰어가 반복 지적했던 바로 그 결함 클래스가 실제 Postgres 잠금·CASCADE 상호작용 아래서도 고쳐졌는지는 여전히 미확인 상태다. 그 외 격리·가독성·회귀 안전성은 양호하다.

## 위험도

MEDIUM
