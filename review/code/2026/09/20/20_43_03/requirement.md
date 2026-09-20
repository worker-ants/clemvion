# 요구사항(Requirement) 리뷰 — 동시 DELETE 감사 중복 후속 (20_43_03)

## 검증 방법

- `lockParentAndListTriggerIds` 반환 계약 변경(`string[]` → `LockedParentTriggers`)의 호출부 3곳(triggers/workflows/workspaces)·spec 3곳 전수 grep 확인, 미갱신 잔여 없음.
- `WorkflowsService.remove` / `WorkspacesService.deleteWorkspace` 전체 소스를 직접 Read 해 `parentPresence === 'absent'` 단락 위치와 `.catch` 의 `NotFoundException` 재던짐 가드가 diff 대로 반영됐는지 대조.
- `assertWorkspaceDeletable` 원문을 확인해 판정 순서가 실제로 "멤버십(`OWNER_REQUIRED`) → 존재(`WORKSPACE_NOT_FOUND`)" 임을 코드 레벨로 재확인 — CHANGELOG/plan/RESOLUTION 이 주장하는 근본 원인과 일치.
- `spec/2-navigation/2-trigger-list.md` §4.4("동시 삭제: … 두 번째는 `404 RESOURCE_NOT_FOUND`"), `spec/2-navigation/1-workflow-list.md` §2.6, `spec/conventions/error-codes.md`(`WORKSPACE_NOT_FOUND` 가 `workspaces.service` 전역 generic 코드임)를 Read 해 코드의 에러 코드·문구가 spec 과 line-level 로 어긋나지 않는지 확인.
- `audit_log` 테이블 스키마(`V001__initial_schema.sql`)·`AUDIT_ACTIONS.WORKFLOW_DELETED='workflow.deleted'`·`WORKFLOW_RESOURCE_TYPE='workflow'` 를 확인해 신규 e2e(`workflow-delete-concurrency.e2e-spec.ts`)의 DB 쿼리(컬럼명·값)가 실제 스키마·상수와 일치함을 검증.
- e2e 헬퍼(`registerAndLogin`/`createTeamWorkspace`) 시그니처, 컨트롤러 라우트(`DELETE /api/workflows/:id`, `@WorkspaceId()` → `X-Workspace-Id` 헤더)를 대조해 신규 e2e 가 실제 API 표면과 맞는지 확인.
- `npx jest src/modules/triggers/trigger-resource-releaser.service.spec.ts src/modules/workflows/workflows.service.spec.ts src/modules/workspaces/workspaces.service.spec.ts` 로 3 스위트 174 테스트 전부 GREEN 재확인(저장소 트리 뮤테이션 없음, Read/실행만 수행). `git status --short` 로 조회 전후 상태 불변 확인.
- `npx tsc --noEmit` 전체 실행 — 발견된 타입 오류는 전부 diff 밖 파일(`ai-turn-executor.spec.ts`, `carousel/*.spec.ts` 등)이거나 diff 범위와 무관한 같은 파일의 다른 위치(`workflows.service.spec.ts` 라인 569/588/732/2050 등 — `duplicate()` 테스트 블록의 기존 mock 타입 이슈)로, 이번 변경이 새로 만든 회귀가 아님을 라인 대조로 확인.

## 발견사항

- **[INFO]** `spec/2-navigation/1-workflow-list.md` §2.6(더보기 메뉴 "삭제" 행)은 트리거 §4.3(CASCADE)만 참조하고, 동시 삭제 시 "두 번째 요청 404" 서술이 없다 — spec 이 이 케이스에 대해 침묵한다(모순이 아니라 부재).
  - 위치: `spec/2-navigation/1-workflow-list.md:107` (§2.6 삭제 행), 대조 `spec/2-navigation/2-trigger-list.md:318`(§4.4)
  - 상세: 코드(`workflows.service.ts` 의 `RESOURCE_NOT_FOUND` 단락)는 트리거 §4.4 의 기존 정책을 그대로 워크플로에 대칭 적용한 것이며 spec 과 모순되지 않는다. 이미 `--impl-prep`(`review/consistency/2026/09/20/19_30_57`)과 직전 리뷰(`review/code/2026/09/20/20_06_26` SUMMARY INFO#2)가 같은 결론으로 비차단 처리했고, 이번 라운드에서 재확인해도 결론은 동일하다.
  - 제안: 코드 수정 불요. 후속 project-planner 턴에서 §2.6 에 트리거 §4.4 와 대칭되는 한 줄을 추가할지는 선택 사항(이미 트래커/plan 에 등재됨).

- **[INFO]** `RESOURCE_NOT_FOUND` / `'Workflow not found'` 리터럴이 `WorkflowsService` 안에서 `findById`(기존)와 신규 `absent` 분기 두 곳에 중복된다.
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts` `findById`(코드 `RESOURCE_NOT_FOUND` 최초 등장부) 및 `remove()` 트랜잭션 내 `if (locked.parentPresence === 'absent')` 블록
  - 상세: 값 자체는 두 곳이 완전히 동일해 drift 위험은 낮지만, 리터럴 중복이다. 직전 리뷰(SUMMARY INFO#1)가 이미 같은 지점을 발견해 비차단 처리했고, 이번 diff 로 새로 생긴 것도 아니다(신규 분기가 기존 상수를 재사용하지 않고 리터럴을 복붙한 것).
  - 제안: private 헬퍼(`workflowNotFound()`)로 묶는 것을 다음에 이 파일을 만질 때 고려(급하지 않음, 이미 권고됨).

- **[INFO]** 신규 e2e(`workflow-delete-concurrency.e2e-spec.ts`)는 `locker` 커넥션의 `SELECT … FOR UPDATE` 로 겹침을 강제하고 `raced==='pending'` 공허성 가드까지 두어 견고하지만, `TRIGGER_DELETE_LOCK_TIMEOUT_MS`(5000ms local lock_timeout)가 걸린 상태에서 CI 가 심하게 느려 두 번째 트랜잭션의 대기 시간이 5초에 근접하면 `lock_timeout` 에러로 응답이 204/404 가 아닌 값이 될 이론적 여지가 있다.
  - 위치: `codebase/backend/test/workflow-delete-concurrency.e2e-spec.ts` (`raced` 가드 ~1.5s 뒤 즉시 `COMMIT`)
  - 상세: 실제로는 `raced` 가드 이후 곧바로 COMMIT 하므로 대기 시간은 통상 수십~수백 ms 수준이라 위험은 낮고, 같은 기법이 이미 `plan/complete/rotate-lost-update.md`·`trigger-config-lost-update.md §C` 에 선례로 쓰였다. 새 결함이 아니라 기존에 이미 감수한 트레이드오프.
  - 제안: 조치 불요(low-probability, 선례 있음). 참고로만 기록.

## 요약

`WorkflowsService.remove` / `WorkspacesService.deleteWorkspace` 양쪽 모두 `lockParentAndListTriggerIds` 가 잠그며 읽은 부모 행의 존재 여부(`parentPresence`)를 이제 호출자에게 돌려주고, 두 경로 모두 `absent` 를 재검사보다 먼저 검사해 트리거 목록 §4.4 의 "두 번째 요청은 404" 선례와 대칭으로 단락한다. 워크스페이스 경로는 `assertWorkspaceDeletable` 의 실제 판정 순서(멤버십→존재)를 코드로 직접 확인해, plan 이 처음 "이미 재검사가 덮는다"고 적었다가 정정한 근거(403 오응답+거짓 ERROR 로그)가 사실임을 검증했다. 두 `.catch` 블록 모두 `NotFoundException` 재던짐 가드로 거짓 "수동 정리 필요" 로그를 억제하며, 관련 신규/수정 단위 테스트(174개 스위트 3개, 전부 GREEN)와 신규 e2e(락 직접 보유로 겹침을 결정적으로 재현, 공허성 가드 포함)가 각 분기·로그 억제를 뮤테이션 근거와 함께 고정한다. `LockedParentTriggers` 인터페이스 변경은 호출부·모의 객체·spec 파일 전수 동기화됐고 타입 오류 없음(잔여 tsc 오류는 diff 밖 기존 부채). spec 대조 결과 에러 코드(`RESOURCE_NOT_FOUND`, `WORKSPACE_NOT_FOUND`)·정책(두 번째 요청 404)이 트리거 목록 §4.4 및 error-codes.md 컨벤션과 line-level 로 일치하며, `spec_impact: none` 판단(새 정책이 아니라 기존 트리거 정책에 워크플로/워크스페이스를 맞추는 것)은 타당하다. Critical/Warning 급 결함 없음 — 남은 것은 이미 여러 차례 비차단 처리된 INFO 수준 사안뿐이다.

## 위험도

NONE
