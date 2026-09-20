# 테스트(Testing) 리뷰

## 발견사항

- **[WARNING] `WorkflowsService.remove()` 의 `.catch()` 안 `NotFoundException` 조기 재던짐 가드가 로그 오발행을 막는지 검증하는 테스트가 없다 — 실측(뮤턴트)으로 확인**
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:289`~`301` (특히 293번째 줄
    `if (err instanceof NotFoundException) throw err;`). 관련 테스트:
    `codebase/backend/src/modules/workflows/workflows.service.spec.ts` `it('remove — 잠금 뒤 부모가
    사라졌으면 404 이고 감사·비밀 정리를 남기지 않는다', ...)` (293~301번째 줄 구현, 스펙은 새
    테스트 블록).
  - 상세: 이 줄의 존재 이유(같은 파일 290~292번째 줄 주석)는 "동시 삭제로 `NotFoundException` 이
    발생한 정상적인 404 케이스에서는 `수동 정리가 필요하다` 는 **거짓 경보 로그를 남기지 않는다**"는
    것이다. 이것이 이 PR 이 실제로 바꾼 행동 중 하나인데, 이를 지키는 테스트가 없다. 직접
    뮤테이션으로 확인했다 — `if (err instanceof NotFoundException) throw err;` 한 줄을 삭제하고
    `npx jest src/modules/workflows/workflows.service.spec.ts -t "remove"` 를 돌리니 **9개 테스트
    전부 GREEN** 이었고(85 skipped, 9 passed), 오히려 실제 `Logger.error` 가 `WorkflowsService.remove:
    workflow=wf-uuid-9 의 행 삭제가 실패했다 … 수동 정리가 필요하다: Workflow not found` 라는 **의도된
    반증 대상 그 자체인 거짓 경보**를 콘솔에 남기며 통과했다(원본은 즉시 `cp` 로 복원, `git status
    --short` 로 잔여물 없음 확인). 새로 추가된 테스트(`remove — 잠금 뒤 부모가 사라졌으면 404…`)는
    `Logger.prototype.error` 를 spy 하지 않고 `auditLogs.record`/`releaseSecretsAfterCommit`/
    `manager.remove` 호출 여부만 확인하므로, 이 가드가 없어도 통과한다. 같은 파일의 다른 테스트
    (`remove — 행 삭제가 실패하면 외부 해제가 이미 끝났다는 사실을 남기고 던진다`, 1050번째 줄
    부근)는 `Logger.prototype.error` 를 spy 하지만 그 케이스는 `deadlock detected` 라 애초에
    `NotFoundException` 이 아니므로 이 가드 분기를 지나가지 않는다 — 두 테스트가 서로 다른 분기만
    덮어 가드 자체(참일 때 로그를 **안** 남긴다)는 사각지대로 남는다.
  - 제안: 404 테스트에 `jest.spyOn(Logger.prototype, 'error')` 를 추가해 그 케이스에서 `logger.error`
    가 **호출되지 않았음**(`expect(error).not.toHaveBeenCalled()` 또는 로그 문자열에 `수동 정리가
    필요하다` 가 포함되지 않음)을 단언한다. `WorkspacesService.deleteWorkspace()` 는 같은 가드가
    아예 없어(`.catch` 가 무조건 로그를 남긴다, `workspaces.service.ts` 519번째 줄 부근 주석이 이를
    "잠금 뒤 재검사 거부도 여기로 온다"고 명시) 대칭 여부를 developer 가 의도했는지도 plan 문서에
    한 줄 남겨두는 편이 좋다(현재 `plan/in-progress/dup-delete-audit.md` §B 는 워크스페이스 경로를
    "동작 변화 없음"으로만 적어 이 비대칭을 언급하지 않는다).

- **[INFO] `lockParentAndListTriggerIds` 의 "부모 부재" 판정이 `workspaceId` 변형에서는 직접 테스트되지 않는다**
  - 위치: `codebase/backend/src/modules/triggers/trigger-resource-releaser.service.spec.ts:319`~`343`
    (새 테스트 두 개는 모두 `{ workflowId: 'wf-gone' }` / `{ workflowId: 'wf-empty' }` 만 사용).
  - 상세: `TriggerResourceReleaserService.lockParentAndListTriggerIds` 구현
    (`trigger-resource-releaser.service.ts:89`~`100`)은 `parentRow ? 'present' : 'absent'` 판정을
    `workflowId`/`workspaceId` 두 분기가 공유하므로 위험은 낮지만, `workspaceId` 분기 자체가
    같은 판정 로직을 통과하는지는 명시적으로 커버되지 않는다. `276`~`295`번째 줄의 기존 "워크스페이스"
    테스트는 `parentRow` 기본값(`present`)만 쓰고 `absent` 조합은 검증하지 않는다.
  - 제안: 필수는 아니지만, 두 `TriggerParent` 변형에 대해 표 기반(parametrized) 테스트로
    합치면 향후 분기가 갈라질 때(예: 워크스페이스만 다른 예외 정책이 생길 때) 회귀를 더 빨리 잡는다.

- **[INFO] e2e 동시성 테스트(`workflow-delete-concurrency.e2e-spec.ts`)는 결정론적으로 잘 설계됐다 — 참고용 확인**
  - 위치: `codebase/backend/test/workflow-delete-concurrency.e2e-spec.ts:69`~`97`.
  - 상세: 별도 커넥션으로 `SELECT … FOR UPDATE` 를 먼저 잡아 두 요청의 인터리빙을 우연이 아니라
    강제로 만들고(`70`~`74`번째 줄), 락 해제 전 `Promise.race` 로 "아직 안 끝났음"을 관측하는
    공허성 가드(`81`~`87`번째 줄)까지 있다. plan 문서(`plan/in-progress/dup-delete-audit.md` 체크리스트)에
    `origin/main` 코드로 되돌려 실측한 RED(둘 다 204, 감사 2건) 근거도 남겨, 이 e2e 가 실제로 그
    결함 클래스를 가르는 판별력이 있음을 확인했다는 서술이 있다 — 결함이 아니라 좋은 사례로 기록.

## 요약

이 PR 의 핵심 변경(`lockParentAndListTriggerIds` 가 `string[]` 대신 `{parent, triggerIds}` 를 돌려주고,
`WorkflowsService.remove()` 가 `parent: 'absent'` 를 404 로 승격하는 것)은 단위 테스트(신규 fixture로
"부재+0행"과 "존재+0행"을 명시적으로 구분)와 e2e(실제 DB 락으로 겹침을 강제하고 감사 행 수·응답
코드를 동시에 검증)로 잘 뒷받침돼 있고, plan 문서에 `origin/main` 대비 RED/GREEN 실측까지 기록해 둔
점도 신뢰할 만하다. 다만 직접 뮤테이션으로 검증한 결과, `.catch()` 안 `NotFoundException` 조기
재던짐 가드(거짓 경보 로그 억제)는 관련 테스트가 `Logger` 호출 여부를 단언하지 않아 회귀를 잡지
못한다 — 이 가드를 제거해도 `remove` 관련 9개 테스트가 전부 GREEN 으로 남는 것을 확인했다. 나머지는
경미한 커버리지 확장 여지(워크스페이스 변형에 대한 명시적 absent 테스트 부재) 수준이다.

## 위험도

LOW
