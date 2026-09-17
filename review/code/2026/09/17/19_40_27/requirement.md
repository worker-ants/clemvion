# 요구사항(Requirement) 리뷰 — 트리거 삭제 자원 정리 (DRT-2, 3라운드)

## 범위·방법

검증을 위해 저장소 파일을 수정하지 않았다(읽기 전용 `Read`/`Grep`/`Bash`만 사용). `git status --short`
로 확인한 잔여 변경 없음(세션 시작 시점 `review/code/2026/09/17/19_40_27/`만 untracked).

1·2라운드(`review/code/2026/09/17/18_45_09`·`19_14_29`)의 requirement 리뷰가 `spec/2-navigation/
2-trigger-list.md §3·§4.3·§4.4`·`spec/conventions/secret-store.md §2.1·§5.3·§6` 대비 line-level
일치를 이미 exhaustive 하게 확인했고, 이번 라운드에서 실제 소스(`trigger-resource-release.ts`·
`trigger-resource-releaser.service.ts`·`triggers.service.ts`·`schedules.service.ts`·
`workflows.service.ts`·`workspaces.service.ts`·`chat-channel-binder.service.ts`·
`trigger-config-lock.ts`)를 직접 다시 읽어 그 결론을 독립적으로 재확인했다 — 이견 없음.

이번 라운드가 새로 보는 것은 **2라운드 리뷰 이후에 착지한 커밋 `d2184dcf2`**(2라운드 WARNING#2
"부모 행 잠금에 `lock_timeout` 없음" 처분)이다. 이 커밋은 어느 라운드도 아직 diff 로 보지 않았으므로
전용 관점(spec 대조)에서 새로 살폈다.

## 발견사항

- **[WARNING]** `[SPEC-DRIFT]` `spec/2-navigation/2-trigger-list.md` §4.3·§4.4 가 이번 라운드에 새로
  착지한 "부모 행 잠금에도 5초 상한" 동작(`d2184dcf2`)을 서술하지 않는다 — 코드가 옳고(2라운드가
  요구한 동작 결함 수정) spec 본문이 아직 좁다. 이 항목은 plan 체크리스트의 기존 SPEC-DRIFT
  추적 목록(§4.3 과도기 문구 등)에 **포함돼 있지 않다** — 새로 등재해야 한다.
  - 위치: `spec/2-navigation/2-trigger-list.md:307`(§4.4 "락 대기 상한 5초" 불릿 — "트리거 화면
    삭제는 schedule 타입이면 BullMQ job 해제 → chat channel teardown, 스케줄 화면 삭제는 BullMQ job
    해제"만 열거) · `:296-300`(§4.3 "워크플로·워크스페이스 삭제는 … 부모 행을 잠근 뒤 같은
    트랜잭션에서 열거한다" 문단 — "남는 창"에 잠금 자체의 타임아웃 실패는 없음). 코드 근거:
    `codebase/backend/src/modules/triggers/trigger-resource-release.ts` `lockParentAndListTriggerIds`
    JSDoc("**트랜잭션의 첫 호출이어야 한다**… 트리거·스케줄 삭제와 같은 규칙이다(spec 트리거 목록
    §4.4)"), `codebase/backend/src/modules/triggers/trigger-resource-releaser.service.ts:76`
    (`await setLocalLockTimeout(manager, TRIGGER_DELETE_LOCK_TIMEOUT_MS)`), 호출부
    `workflows.service.ts:273-275`·`workspaces.service.ts:520-524`.
  - 상세: §4.4 는 "락 대기 상한 5초"를 **트리거 화면 삭제·스케줄 화면 삭제** 두 경로에만 명시적으로
    적용한다 — 표 형식이 아니라 산문이라 열거가 곧 범위다. 그런데 `d2184dcf2`(2라운드 WARNING#2
    처분)는 정확히 같은 원리("되돌릴 수 없는 외부 자원 해제 **뒤**에 잠그는 락은 무한 대기가 아니라
    상한이 있어야 한다")를 워크플로·워크스페이스 삭제의 **부모 행 잠금**(`pessimistic_write` on
    `Workflow`/`Workspace`)에도 적용했고, 실패 시 `WorkflowsService.remove`/
    `WorkspacesService.deleteWorkspace` 의 catch 블록이 §4.4 가 트리거/스케줄에 대해 서술하는 것과
    똑같은 형태의 "반쯤 삭제된 상태" error 로그를 남긴다(코드 대조 확인). 즉 **동작은 이미 네 경로
    모두에 일반화됐는데, spec 문구는 여전히 둘만 말한다** — 코드의 JSDoc 자신이 "spec 트리거 목록
    §4.4" 를 근거로 인용하지만 그 절의 실제 문장은 이 범위 확장을 담고 있지 않다(인용이 근거보다
    앞서 있다). 판단: 이 확장은 2라운드 리뷰가 요구한 실제 동작 결함(무한 대기 → hang) 수정이고
    뮤턴트 M21·M22 로 검증돼 있어 **코드가 옳다** — spec 이 낡은 SPEC-DRIFT 다.
  - plan 대조: `plan/in-progress/trigger-deletion-release.md:176` 의 "planner 후속 신설" 목록(Planned
    태그·§4.3 과도기 문구 제거·`secret-store.md` `partial`→`implemented`·`15-chat-channel.md` R8
    괄호·`4-execution-engine.md §4.4` throw 사례)에 이 항목이 **없다** — 이미 추적된 SPEC-DRIFT 들과
    달리 이번 라운드가 처음 발견한 것이므로 새로 등재하지 않으면 `complete/` 이동 시 유실된다.
  - 제안: 코드는 유지한다. `--impl-done` 이후 `project-planner` 턴에서 §4.4 "락 대기 상한 5초" 불릿에
    워크플로·워크스페이스의 부모 행 잠금도 포함하도록 문구를 넓히고(또는 별도 불릿 추가), §4.3 의
    "남는 창" 문단에 "부모 행 잠금이 5초를 넘기면 트랜잭션이 실패해 외부 자원은 이미 해제됐지만
    부모·트리거 행은 남는다"는 문장을 더한다. 그 전에 developer 몫으로 `plan/in-progress/
    trigger-deletion-release.md:176` 의 "planner 후속 신설" 목록에 이 항목을 추가해 두는 것을 권장 —
    코드 fix 는 아니므로 이 라운드의 수렴을 막을 사유는 아니다.

- **[INFO]** `TRIGGER_DELETE_LOCK_TIMEOUT_MS` JSDoc 의 "소비자마다 다르다" 목록이 이번 라운드로 다시
  과소 서술이 됐다 — 그 JSDoc 자신이 경고하는 바로 그 drift 패턴
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts:105-113`(정확히는 상수
    선언부 바로 위 블록 — "**무엇을 먼저 끝냈는지는 소비자마다 다르다** — `TriggersService.remove()`
    는 … `SchedulesService.remove()` 는 … 한때 앞 소비자의 정리 목록을 여기 나열했는데, 두 번째
    소비자가 생기자 그 목록이 곧바로 과대 서술이 됐다")
  - 상세: 이 주석은 이미 "목록을 나열하면 다음 소비자가 생겼을 때 낡는다"는 교훈을 담고 있는데,
    이번 PR 이 `TRIGGER_DELETE_LOCK_TIMEOUT_MS` 를 **세 번째·네 번째 소비자**
    (`TriggerResourceReleaserService.lockParentAndListTriggerIds` 경유 워크플로·워크스페이스 부모
    잠금)로 확장했음에도 이 문단은 여전히 트리거·스케줄 둘만 예시로 든다. 틀린 서술은 아니다(그
    둘도 여전히 소비자다)이지만, 코드가 스스로 경계했던 "두 번째 생기면 과대해진다"는 패턴이
    "세 번째·네 번째가 생겼는데 목록이 안 늘었다"는 대칭형으로 재발했다. `d2184dcf2` 의 diff 는
    이 블록을 건드리지 않았다(별도 JSDoc — `lockParentAndListTriggerIds` 쪽에만 새 설명을 붙였다).
  - 제안: 차단 사유 아님. 다음에 이 파일을 손댈 때 "예시는 대표일 뿐 전수 목록이 아니다" 로 문구를
    한 번 더 일반화하거나, 워크플로·워크스페이스를 세 번째 예시로 추가한다.

## 대조 결과 — 위반 없음 (`d2184dcf2` 관련, 직접 재확인)

- `WorkspacesService.deleteWorkspace`(`workspaces.service.ts:498-552`)의 재정렬(`lockParentAndListTriggerIds`
  가 이제 `assertWorkspaceDeletable(locked)` **앞**)은 정합성을 해치지 않는다 — `SET LOCAL
  lock_timeout` 이 트랜잭션 범위이므로 그 안의 모든 후속 잠금(워크스페이스 재잠금 no-op·멤버십
  잠금·`invRepo`/`memRepo`/`wsRepo` 의 DELETE 행 잠금)에 동일하게 적용된다. 트리거 열거는 여전히
  "부모 행이 잠긴 뒤" 시점에 일어나 §4.3 의 FK-INSERT-차단 불변식이 유지된다(재검사가 그 뒤에
  거부해도 트랜잭션 자체가 롤백되므로 열거 결과는 버려질 뿐 커밋되지 않는다).
- `workspaces.service.spec.ts:641-666` 의 재정렬된 이벤트 순서 단언
  (`['check:unlocked','releaseExternal:…','lockAndList:…','check:locked','workspace.remove',
  'releaseSecrets:…']`)이 실제 구현 순서와 일치함을 직접 대조.
- `deleteTriggerSecretsAfterCommit`/`undoAbsentTriggerWrite`(`trigger-resource-release.ts`)는 이번
  커밋에서 변경되지 않았고, 1·2라운드가 검증한 순서·실패 정책(§2.1/§5.3/§6, §3)이 여전히 그대로임을
  재확인.
- `TriggersService.remove`/`SchedulesService.remove`(트리거·스케줄 직접 삭제 경로)는 `d2184dcf2` 의
  변경 대상이 아니며(`acquireTriggerConfigLock` 이 이미 5초 상한을 갖고 있었다), §4.4 의 원래 서술과
  여전히 정확히 일치.
- TODO/FIXME/HACK/XXX: `git diff origin/main...HEAD -- codebase/` 전수 grep 0건(1·2라운드와 동일).
- 반환값: `setLocalLockTimeout`·`lockParentAndListTriggerIds` 모두 모든 분기에서 선언된 타입대로
  resolve/reject 한다 — 새로 추가된 코드에 암묵적 `undefined` 반환 경로 없음.

## 이미 추적된 항목 (재조사·이견 없음, 반복 등재하지 않음)

1·2라운드 requirement.md 가 이미 적어 둔 세 항목 — (1) §4.3 과도기 문구·`data-flow/10-triggers.md
§1.4`·`data-flow/12-workspace.md §1.10`·`secret-store.md` `partial` 이 이 PR 착지로 낡는 SPEC-DRIFT
(plan 체크리스트에 planner 후속으로 이미 예약), (2) `lockParentAndListTriggerIds` 가 부모 잠금
`findOne` 의 `null` 을 무시(기존 non-locking `findById` 레이스와 같은 클래스, RESOLUTION 항목
19·21 로 이미 처분), (3) 워크스페이스 트랜잭션 안 워크스페이스 행 이중 잠금(no-op, RESOLUTION 항목
20 으로 이미 처분) — 코드가 이번 라운드에도 그대로여서 재확인만 하고 새로 등재하지 않는다.

## 요약

`d2184dcf2`(2라운드 WARNING#2 처분: 부모 행 잠금에 5초 `lock_timeout` 추가)를 포함한 현재 상태를
직접 소스 대조로 재검증한 결과, 네 삭제 경로·다섯 쓰기 보상 자리의 기능 완전성·순서·실패 정책은
spec 본문과 line-level 로 계속 일치하며 이 커밋이 새로운 기능 결함을 만들지 않았다. 다만 이 커밋이
구현한 "부모 행 잠금에도 5초 상한" 이라는 (2라운드가 요구한, 옳은) 동작 확장이 `2-trigger-list.md
§4.3/§4.4` 본문에는 아직 반영되지 않았고 — 이미 추적 중인 다른 SPEC-DRIFT 목록과 달리 **plan
체크리스트에 등재돼 있지 않아** `complete/` 이동 시 유실될 위험이 있다. 코드를 되돌릴 사안이
아니므로 차단 사유는 아니지만, developer 가 plan 체크리스트의 "planner 후속 신설" 목록에 이 항목을
추가해 둘 것을 권한다. 그 외 CRITICAL 은 없다.

## 위험도

LOW
