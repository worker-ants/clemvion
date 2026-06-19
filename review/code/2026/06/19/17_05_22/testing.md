# Testing Review — W-6 fail-closed workspace isolation

## 발견사항

### [INFO] executeSync / executeAsync 에 cross-workspace 불일치 테스트 부재
- 위치: `execution-engine.service.spec.ts` — `describe('executeSync')` / `describe('executeAsync')` 블록
- 상세: 두 public API 에 대해 `parentWorkspaceId` **부재(absent)** 케이스(`fail-closed`)는 새로 추가됐으나, `parentWorkspaceId` 가 존재하되 target workflow 의 `workspaceId` 와 **불일치(mismatch)** 인 케이스는 테스트가 없다. `executeInline` 에는 `ws-attacker` 픽스처로 불일치 경로가 명시적으로 커버되어 있다(`WORKFLOW_FORBIDDEN_WORKSPACE` 어서션 l.851~871). `assertSameWorkspace` 내부의 두 번째 분기(`targetWorkspaceId !== callerWorkspaceId`)가 `executeSync` / `executeAsync` 경로에서 검증되지 않아 회귀 안전망이 얇다.
- 제안: `describe('executeSync')` / `describe('executeAsync')` 각 블록에 아래 형태의 테스트 추가.
  ```ts
  it('throws WORKFLOW_FORBIDDEN_WORKSPACE when parentWorkspaceId mismatches target (W-6)', async () => {
    // mockWorkflowRepo.findOneBy 는 기본 ws-1 반환; 호출자는 다른 workspace 를 전달.
    await expect(
      service.executeSync(workflowId, {}, { timeoutMs: 0, parentWorkspaceId: 'ws-other' }),
    ).rejects.toThrow(/WORKFLOW_FORBIDDEN_WORKSPACE/);
  });
  ```

### [INFO] withWorkspace 헬퍼 중복 정의 — 두 describe 블록에 각각 선언
- 위치: `describe('executeInline — Sub-Workflow parent linking')` 내 l.973 + `describe('executeInline — _callStack push/pop')` 블록은 같은 패턴을 `context.variables = { ...context.variables, __workspaceId: 'ws-1' }` 인라인으로 반복
- 상세: `executeInline — Sub-Workflow parent linking` describe 에는 `withWorkspace` 헬퍼가 추출돼 있는 반면, 하단 `_callStack push/pop` describe 4개 테스트는 인라인으로 직접 `context.variables` 를 변조한다. 구현 변경 시 두 곳을 일관되게 갱신해야 하는 이중 유지보수 지점이 된다.
- 제안: `_callStack push/pop` describe 에도 `withWorkspace` 헬퍼를 주입하거나, 상위 스코프(describe 밖)에 하나의 헬퍼로 올려 두 블록이 공유하도록 리팩터.

### [INFO] executeSync — throws when workflow does not exist 케이스가 parentWorkspaceId 없이 호출됨
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/assert-workspace-6215be/codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` l.1793~1797
- 상세: `mockWorkflowRepo.findOneBy` 가 `null` 을 먼저 반환하므로 `WorkflowNotFoundError` 가 `assertSameWorkspace` 이전에 throw 된다. fail-closed 전환 후에도 현재 코드 순서(workflow lookup 후 assertSameWorkspace)에서는 문제없다. 그러나 향후 검증 순서가 바뀌면 이 테스트가 `WORKFLOW_FORBIDDEN_WORKSPACE` 로 잘못 깨질 수 있다. 현재 동작 자체는 올바르므로 Critical 이 아니며 단순 관찰.

### [INFO] executeAsync — throws when workflow does not exist 케이스도 동일 패턴
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/assert-workspace-6215be/codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` l.1920~1926
- 상세: 위 executeSync 동일 패턴. 코드 순서 의존이지만 현재 동작은 올바름.

## 요약

W-6 fail-closed 전환에 대한 테스트 커버리지는 전반적으로 충실하다. `executeInline` 경로는 (1) 호출자 workspace 부재, (2) 다른 workspace(`ws-attacker`), (3) 동일 workspace 통과 세 케이스를 모두 커버하며, `executeSync` / `executeAsync` 도 부재(fail-closed) 케이스가 새로 추가됐다. 다만 `executeSync` / `executeAsync` 의 workspace **불일치** 경로(값이 존재하지만 target 과 다른 경우)는 테스트가 없어 `assertSameWorkspace` 두 번째 분기가 해당 API 에서 검증되지 않는 커버리지 갭이 남는다. `withWorkspace` 헬퍼 중복 선언도 유지보수 부담이지만 기능 정확성에는 영향을 주지 않는다. 기존 테스트들은 `mockWorkflow.workspaceId: 'ws-1'` 기본값 추가로 올바르게 수정됐고, 회귀를 일으키지 않는다.

## 위험도

LOW
