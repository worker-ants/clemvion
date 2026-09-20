# 동시성(Concurrency) 리뷰 — dup-delete-audit (2026-09-20 20:43:03, 2차 라운드)

## 리뷰 범위

이번 라운드는 1차 리뷰(`review/code/2026/09/20/20_06_26`)에서 지적된 WARNING(워크스페이스 삭제
경로가 워크플로 경로와 대칭적으로 닫히지 않아 403 오응답 + 거짓 ERROR 로그가 남을 수 있음)이
조치된 뒤의 스냅샷이다. 실제 코드 변경은 여전히 다음 9개 파일에 국한된다(그 외 `plan/**`,
`review/code/2026/09/20/20_06_26/**`, `review/consistency/2026/09/20/19_30_57/**` 는 1차 리뷰·
consistency-check 산출물이며 코드가 아니다):

- `CHANGELOG.md`
- `codebase/backend/src/modules/triggers/trigger-resource-release.ts`
- `codebase/backend/src/modules/triggers/trigger-resource-releaser.service.spec.ts`
- `codebase/backend/src/modules/triggers/trigger-resource-releaser.service.ts`
- `codebase/backend/src/modules/workflows/workflows.service.spec.ts`
- `codebase/backend/src/modules/workflows/workflows.service.ts`
- `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts`
- `codebase/backend/src/modules/workspaces/workspaces.service.ts`
- `codebase/backend/test/workflow-delete-concurrency.e2e-spec.ts`

현재 저장소의 실제 소스(`workflows.service.ts:263-312`, `workspaces.service.ts:498-567`,
`trigger-resource-releaser.service.ts:81-109`)를 직접 `Read` 로 열어 diff 게이트와 대조했다 —
프롬프트가 보여준 코드와 저장소 현재 상태가 일치함을 확인했다(저장소 뮤테이션 없음, `Read`
전용 조사).

## 발견사항

- **[INFO]** 워크스페이스 삭제 경로의 동시-삭제 대칭 처리가 이번 라운드에서 실제로 닫혔다 — 확인
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:522-535`(신규 `absent`
    단락), `:549-562`(`.catch` 의 `NotFoundException` 분리 재던짐)
  - 상세: 1차 리뷰(architecture/maintainability/database 3개 리뷰어)가 지적한 대로, `lockParentAndListTriggerIds`
    가 잠금 뒤 워크스페이스 부재를 감지해도 그 판정을 `assertWorkspaceDeletable` 재검사(멤버십→존재
    순서)에만 맡기면 진 쪽이 404 대신 403 `OWNER_REQUIRED` + 거짓 "수동 정리 필요" ERROR 로그를
    받는 결함이 있었다. 이번 diff 는 `locked.parentPresence === 'absent'` 를 재검사보다 **먼저**
    검사해 `NotFoundException({code:'WORKSPACE_NOT_FOUND'})` 로 단락하고(`:530-534`), `.catch` 에서도
    `if (err instanceof NotFoundException) throw err;`(`:553`)를 워크플로 경로(`workflows.service.ts:293`)
    와 동일한 형태로 추가해 거짓 로그를 억제한다. 두 삭제 경로(`WorkflowsService.remove`,
    `WorkspacesService.deleteWorkspace`)가 이제 "잠금 뒤 부모 부재 → 404 → 로그 억제" 형태로
    대칭이다. RESOLUTION.md 가 기록한 뮤테이션 실측(단락 분기 제거 시 새 테스트 RED — 재검사를
    그대로 통과해 실제 삭제됨, 로그 가드 제거 시 `expect(error).not.toHaveBeenCalled()` RED)도
    이 판정을 뒷받침한다.
  - 제안: 없음(개선 확인, 신규 결함 아님).

- **[INFO]** 잠금 순서(Workspace → Membership)는 이번 변경으로 바뀌지 않았다 — 데드락 신규 위험 없음
  - 위치: `workspaces.service.ts:522-524`(`lockParentAndListTriggerIds` 가 Workspace 를
    `pessimistic_write` 로 첫 잠금), `:536-542`(`assertWorkspaceDeletable(..., {mode:'pessimistic_write'})`
    가 같은 트랜잭션에서 Workspace 를 재확인 후 Membership 을 잠금)
  - 상세: 새로 추가된 `absent` 단락 분기는 이미 잠근 Workspace 행의 조회 결과를 재사용할 뿐 새
    쿼리·새 락을 추가하지 않는다. 잠금 취득 순서(Workspace → Membership)는 `transferOwnership` 과
    동일하게 유지되어(`:576` 주석) 교착(40P01) 위험이 늘지 않는다.
  - 제안: 없음.

- **[INFO]** `WorkflowsService.remove()`/`WorkspacesService.deleteWorkspace()` 모두, 잠금 뒤
  `absent` 로 404 단락되는 경로에서는 `releaseSecretsAfterCommit` 이 호출되지 않는다(트랜잭션이
  예외로 끝나 그 아래 줄에 도달하지 못함) — 반면 `releaseExternalForParent`(비가역 외부 해제)는
  트랜잭션 진입 **전에** 두 요청 모두가 이미 호출한 상태다.
  - 위치: `workflows.service.ts:268`(외부 해제, 트랜잭션 밖) vs `:302-305`(비밀 정리, 트랜잭션 뒤 —
    404 시 도달 안 함), 대칭 `workspaces.service.ts:513`/`:563-566`
  - 상세: 이겨서 커밋한 요청이 자신의 `triggerIds`(그 워크플로/워크스페이스에 속한 전체 트리거
    목록)로 `releaseSecretsAfterCommit` 을 부르므로 트리거 행 자체는 CASCADE 로 한 번만 지워지고
    비밀도 그 한 번의 호출로 정리된다 — 진 쪽이 비밀 정리를 건너뛰어도 데이터가 새로 남는 것은
    아니다. 다만 이 지점은 이번 PR 이 만든 것이 아니라, plan(`plan/in-progress/dup-delete-audit.md`
    §"이 PR 이 하지 않는 것")이 명시적으로 스코프 밖으로 남긴 "외부 해제 중복 실행" 잔여 이슈와 같은
    뿌리이며, 1차 리뷰의 concurrency 라운드(`review/code/2026/09/20/20_06_26/concurrency.md`)가 이미
    INFO 로 확인했다.
  - 제안: 신규 결함 아님, 조치 불요 — 후속 "네 자리 공용 형태" 설계 개편(트래커에 이미 등재) 시
    같이 정리 대상.

- **[INFO]** e2e(`workflow-delete-concurrency.e2e-spec.ts`)의 결정적 경쟁 재현 기법은 견고하다 —
  참고 확인
  - 위치: `codebase/backend/test/workflow-delete-concurrency.e2e-spec.ts:69-97`
  - 상세: 별도 커넥션에서 `SELECT ... FOR UPDATE`(`:72-74`)로 대상 행을 실제로 잠근 뒤 두 DELETE
    요청을 동시에 발사하고, 락을 놓기 **전에** `Promise.race` 로 둘 다 아직 `settled` 되지 않았음을
    확인하는 공허성 가드(`:79-87`)까지 갖춰 우연한 통과를 배제한다. `finally` 의 `ROLLBACK` 재시도
    (`:94-96`)는 정상 `COMMIT` 이후에도 `.catch(() => undefined)` 로 삼켜지므로 부작용 없음.
  - 제안: 없음.

## 요약

이번 라운드의 실질 변경은 (1) `LockedParentTriggers.parent` → `parentPresence` 리네이밍(동시성과
무관, 가독성 조치), (2) 워크스페이스 삭제 경로에 워크플로와 대칭인 "잠금 뒤 부모 부재 → 404 →
거짓 로그 억제" 분기 추가, (3) 그 분기를 검증하는 단위 테스트, (4) CHANGELOG 항목이다. 1차
리뷰에서 architecture/maintainability/database 세 리뷰어가 공통 지적한 워크스페이스 경로의 403
오응답·거짓 ERROR 로그 비대칭은 이번 diff 로 실제로 닫혔고, 잠금 순서(Workspace → Membership)는
변경되지 않아 새 데드락 위험도 없다. `lockParentAndListTriggerIds` 가 `pessimistic_write` 로 잠근
행의 존재 여부를 이제 양쪽 호출자 모두에 명시적으로 돌려주므로, TOCTOU/lost-update 성격의 감사
중복 결함은 두 삭제 경로에서 동일한 형태로 막힌다. 스코프 밖으로 남은 "외부 자원 해제 중복 실행"
잔여 이슈는 기존부터 문서화된 것이며 이번 변경이 새로 만든 위험이 아니다. 신규 Critical/Warning
급 동시성 결함은 발견되지 않았다.

## 위험도

LOW
