# 요구사항(Requirement) 리뷰 — dup-delete-audit

## 발견사항

- **[INFO]** `1-workflow-list.md` 가 트리거 목록 §4.4 와 대칭되는 "동시 삭제 → 두 번째 요청 404" 서술을 갖고 있지 않음
  - 위치: `spec/2-navigation/1-workflow-list.md` §2.6 / §3 `DELETE /api/workflows/:id` 행
  - 상세: 이번 구현은 `2-trigger-list.md` §4.4(`동시 삭제: ... 두 번째는 404 RESOURCE_NOT_FOUND`)의 선례를 워크플로 삭제에 그대로 맞추는 것이고, 에러 코드(`RESOURCE_NOT_FOUND`)·HTTP 상태(404)까지 정확히 일치한다. 다만 `1-workflow-list.md` 는 이 동시성 동작을 명문화한 적이 없다. spec 본문이 침묵하는 영역이라 code-vs-spec 불일치(코드 오류)도, SPEC-DRIFT(빠뜨린 개정)도 아니다 — 일반 에러 규약(`spec/5-system/3-error-handling.md`)으로 이미 커버되고, 이 PR 의 plan 이 `spec_impact: none` 으로 선언한 근거와도 부합한다. 실제로 같은 세션의 `/consistency-check --impl-prep`(`review/consistency/2026/09/20/19_30_57`)이 이 지점을 `plan_coherence` INFO 로 이미 잡아냈고 BLOCK 사유가 아니라고 판정했다.
  - 제안: 조치 불요(차단 아님). 문서 대칭성을 원하면 후속 project-planner 턴에서 `1-workflow-list.md` §2.6 근처에 한 줄 추가 고려.

- **[INFO]** `plan/in-progress/dup-delete-audit.md` 의 체크리스트 마지막 두 항목(`/ai-review`, `/consistency-check --impl-done`, 트래커 항목 해소)이 아직 미완료(`- [ ]`)
  - 위치: `plan/in-progress/dup-delete-audit.md` 체크리스트 하단 3줄
  - 상세: 이는 결함이 아니라 이 리뷰 자체가 그 다음 단계이므로 정상적인 진행 중 상태다. 다만 `--impl-prep` 이 남긴 WARNING #2(같은 헬퍼를 겨냥한 `spec-draft-nullable-notation-followups.md` 트래커 항목과의 교차 참조)가 이번 diff 에 아직 반영되지 않았다 — `spec-draft-nullable-notation-followups.md` 자체는 이번 변경 목록에 없다. plan 이 이 사실을 이미 인지하고 체크리스트 마지막 항목("트래커 항목 해소")으로 남겨둔 상태이므로 지금 시점에는 차단 사유가 아니다.
  - 제안: `plan/complete/` 이동 전에 그 교차 참조 한 줄을 실제로 반영할 것(계획서 자신이 이미 그렇게 적어 두었다).

## 코드 검증 요약 (기능/엣지케이스/에러 시나리오/spec fidelity)

- **핵심 로직 정확성 확인**: `TriggerResourceReleaserService.lockParentAndListTriggerIds`가 잠금이 걸린 `findOne` 결과(`parentRow`)를 더는 버리지 않고 `{ parent: 'present' | 'absent', triggerIds }`로 반환한다(`codebase/backend/src/modules/triggers/trigger-resource-releaser.service.ts` 81~109행). `WorkflowsService.remove()`(`codebase/backend/src/modules/workflows/workflows.service.ts` 263~312행)는 `parent === 'absent'`일 때 트랜잭션 안에서 `NotFoundException({code:'RESOURCE_NOT_FOUND'})`를 던져 롤백시키고, `.catch()`에서 `NotFoundException`만 별도로 재던지며(수동 정리 로그를 남기지 않음) `manager.remove`·`releaseSecretsAfterCommit`·`recordAudit`을 전부 건너뛴다. 코드를 직접 추적한 결과 "동시 삭제 두 건 중 진 쪽은 404, 감사 행은 하나"라는 의도된 동작과 라인 단위로 일치한다.
- **엣지 케이스**: `{ id 있음, trigger 0개 }`(present+빈배열) vs `{ id 없음 }`(absent+빈배열) 두 상태가 `trigger-resource-releaser.service.spec.ts`의 별도 fixture(`managerWithEvents([], null)` vs `managerWithEvents([])`)로 명확히 구분되어 테스트된다 — truthiness 오판(빈 배열=null로 뭉개는 것) 위험을 실제로 차단.
- **워크스페이스 삭제 경로**: `WorkspacesService.deleteWorkspace()`는 `parent==='absent'`를 별도로 보지 않고 새 반환 형태에서 `triggerIds`만 구조분해해 쓰며, 바로 아래 `assertWorkspaceDeletable(... pessimistic_write)` 재검사가 이미 부재 워크스페이스를 `WORKSPACE_NOT_FOUND`로 거부한다(동작 불변, 계약 변경만 반영). 기존 단위 테스트(`WORKSPACE_NOT_FOUND` 커버 3건)가 그대로 유효해 회귀 없음을 확인.
- **e2e 판별력**: `workflow-delete-concurrency.e2e-spec.ts`는 `SELECT ... FOR UPDATE`로 실제 행 락을 쥐어 우연이 아니라 결정적으로 두 DELETE 요청을 겹치게 하고, 락을 놓기 전 "아직 안 끝났음"을 관측하는 공허성 가드까지 포함한다. `[204, 404]` + 감사 1건을 단언 — plan 문서가 기록한 실측(수정 전 `[204, 204]` + 감사 2건)과 함께 판별력이 실증됐다.
- **TODO/FIXME/HACK/XXX**: `git diff origin/main -- codebase/` 전수 검색 결과 없음.
- **반환값 완전성**: `lockParentAndListTriggerIds`의 모든 코드 경로(workflowId/workspaceId × present/absent)가 `LockedParentTriggers` 형태를 반환하며 unreachable/누락 경로 없음.
- **저장소 오염 여부**: 리뷰 중 저장소 파일을 수정하지 않았음 — `git status --short`로 확인, 이번 리뷰 세션 출력 디렉터리(`review/code/2026/09/20/20_06_26/`) 외 변경 없음.

## 요약

`WorkflowsService.remove()`의 동시 중복 DELETE 감사 이중 기록 결함을, 이미 락을 쥔 `lockParentAndListTriggerIds`가 그 결과(부모 행 존재 여부)를 버리지 않고 호출자에게 돌려주는 방식으로 고쳤다. 트리거 삭제(`2-trigger-list.md §4.4`)가 이미 확립한 "동시 삭제 시 두 번째는 404 RESOURCE_NOT_FOUND" 정책을 워크플로 삭제까지 정확히 대칭 확장했고, 워크스페이스 삭제 경로는 기존 재검사(`assertWorkspaceDeletable`)에 판정을 위임해 동작 변화 없이 타입만 맞췄다. 단위 테스트가 present/absent 두 사실을 서로 다른 fixture로 갈라 truthiness 오판을 차단하고, e2e 테스트가 실제 행 락으로 경합을 결정적으로 재현하며 수정 전/후 실측(2건→1건 감사)까지 plan 문서에 남겼다. spec 관련해서는 `spec/2-navigation/2-trigger-list.md §4.4`의 에러 코드·HTTP 상태와 라인 단위로 일치하고, `1-workflow-list.md`가 이 동시성 세부를 명시하지 않는 점은 일반 에러 규약으로 이미 커버되는 침묵 영역(INFO)이지 코드 결함도 SPEC-DRIFT도 아니다. CRITICAL/WARNING 급 발견사항은 없다.

## 위험도
NONE
