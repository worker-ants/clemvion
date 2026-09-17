# 동시성(Concurrency) 코드 리뷰 — 3라운드

대상: 트리거 행을 없애는 네 경로(트리거·스케줄·워크플로·워크스페이스 삭제)의 자원 정리. 1라운드
(`review/code/2026/09/17/18_45_09/concurrency.md`, HIGH·CRITICAL 1·WARNING 2)와 2라운드
(`review/code/2026/09/17/19_14_29/concurrency.md`, MEDIUM·WARNING 1)의 RESOLUTION(`097e583e1`,
`d2184dcf2`) 반영 뒤 상태를 다시 확인했다. 이번 라운드의 실제 코드 델타는 `d2184dcf2`(부모 삭제
트랜잭션 잠금 대기 5초 상한) 하나이고, `614a3561f`는 문서(docs)만 바꿔 코드 확인 대상이 아니다
(`git show 614a3561f --stat` 로 직접 대조). 검증을 위해 저장소 파일을 수정하지 않았다
(`Read`/`Grep`/`Bash cat` 읽기 전용 대조만). `git status --short` 로 확인한 잔여 변경 없음
(세션 산출 디렉터리 자신 제외).

## 발견사항

- **[WARNING]** `releaseExternalForParent`(락 없는 스냅샷)와 `lockParentAndListTriggerIds`(잠금된
  열거) 사이의 시차 — **1·2라운드와 동일한 결함, 이번 라운드도 코드는 바뀌지 않았다.** `d2184dcf2`는
  잠금 대기 자체의 무한 대기(W2)만 고쳤을 뿐, 스냅샷과 잠금 열거 사이에 생긴 트리거의 외부 자원
  누락은 그대로다.
  - 위치: `codebase/backend/src/modules/triggers/trigger-resource-releaser.service.ts:67-70`
    (`releaseExternalForParent` — `this.triggerRepository.find({ where: parent })` 에 락 없음) vs
    `:72-95`(`lockParentAndListTriggerIds` — `setLocalLockTimeout` 뒤 `pessimistic_write` 로 잠그고
    재열거). 호출부: `codebase/backend/src/modules/workflows/workflows.service.ts:268`
    (`releaseExternalForParent`) / `:273`(`lockParentAndListTriggerIds`),
    `codebase/backend/src/modules/workspaces/workspaces.service.ts:513` / `:522`.
  - 상세: 워크플로/워크스페이스 삭제 요청 A가 `releaseExternalForParent`로 현재 트리거 집합의 외부
    자원(BullMQ job scheduler·provider 등록·listener 등록)을 해제하는 동안 요청 B가 같은 부모에 새
    schedule 트리거를 만들면, A가 그 뒤 트랜잭션에서 부모를 잠그고 다시 여는 시점엔 B의 트리거가
    **포함**되어 CASCADE로 삭제되고 비밀도 `releaseSecretsAfterCommit`으로 정리되지만, B의 트리거가
    등록한 BullMQ job scheduler는 A의 `releaseExternalMany` 호출 어디에도 없어 한 번도 해제되지
    않는다 — 이 PR이 닫으려는 결함 클래스가 부모 삭제 경로의 좁은 창을 통해 재발한다.
  - 처분 확인: `trigger-resource-release.ts:152-155`(`lockParentAndListTriggerIds` JSDoc)와
    `trigger-resource-releaser.service.ts:60-65`(`releaseExternalForParent` JSDoc)가 이 창을
    "남는 창(spec §4.3)"으로 명시하고, 커밋 뒤로 옮기면 schedule 행이 CASCADE로 먼저 사라져 job id를
    못 찾는다는 반대급부까지 적어 뒀다. `plan/in-progress/trigger-deletion-release.md:176`의 종결
    체크리스트("트래커 반영")에 "sweeper 재판단 항목 신설(외부 해제 스냅샷 뒤 생긴 트리거)"가 여전히
    미체크 `[ ]`로 등재돼 있다 — 코드 수정 없이 문서화+백로그 등재로 처분된 상태가 3라운드째
    유지된다. 근거(비밀 삭제를 커밋 뒤로 옮기면 CASCADE로 schedule 행이 먼저 사라진다는 트레이드오프)는
    타당하지만, 실제 race window는 이번 라운드에도 코드 그대로 열려 있으므로 그 사실을 다시 보고한다.
  - 제안: 이번 PR 스코프에서 추가 조치는 불필요(1·2라운드와 같은 결론). `plan`이 `complete/`로
    이동하기 전, §176의 "sweeper 재판단 항목 신설"이 실제로 새 트래커 문서에 반영됐는지 반드시 확인할
    것 — 지금 상태로 이동하면 이 시나리오가 근거만 남고 추적 소유자가 없어진다.

## 검증한 항목 (이번 라운드 신규 코드 — 문제 없음)

- **[해소 확인] 부모 삭제 트랜잭션의 잠금 대기 무한 대기 (2라운드 WARNING#2)** — `lockParentAndListTriggerIds`가
  잠그기 **전에** `setLocalLockTimeout(manager, TRIGGER_DELETE_LOCK_TIMEOUT_MS)`(5초)를 걸도록
  바뀌었다.
  - 위치: `codebase/backend/src/modules/triggers/trigger-resource-releaser.service.ts:76`
    (`await setLocalLockTimeout(manager, TRIGGER_DELETE_LOCK_TIMEOUT_MS);` — `pessimistic_write`
    잠금보다 먼저 실행). `codebase/backend/src/modules/triggers/trigger-config-lock.ts:63-70`
    (`setLocalLockTimeout` 정의, `SET LOCAL` 이라 트랜잭션 종료 시 자동 해제).
  - 확인 내용: `SET LOCAL lock_timeout`은 그 트랜잭션의 **모든** 후속 락 대기(부모 행·멤버십 행·
    CASCADE 되는 트리거/스케줄 행)에 적용된다. 되돌릴 수 없는 외부 해제(`releaseExternalForParent`)를
    이미 트랜잭션 밖에서 끝낸 뒤라, 잠금 대기가 무한정 걸리면 "자원은 다 뜯겼는데 행은 남은" 상태가
    관측 불가능한 hang으로 굳는 문제였다 — 트리거·스케줄 삭제에 이미 있던 5초 상한과 같은 클래스로
    맞춘 것이 정확하다. `toLockTimeoutMs`(같은 파일 32-53행)의 clamp/유한성 검증도 재사용해 값 형태가
    깨질 여지가 없다.
  - 워크스페이스 순서 재확인: `workspaces.service.ts:517-531`에서 `lockParentAndListTriggerIds`가
    트랜잭션의 **첫 호출**로 옮겨졌고(521-524행), `assertWorkspaceDeletable`의 잠금 재검사(525-531행)가
    그 뒤로 밀렸다 — Workspace 행이 이미 같은 트랜잭션에서 잠겨 있으므로 `assertWorkspaceDeletable`
    안의 재잠금(`wsRepo.findOne(...lock)`, `:564-570`)은 no-op이고, Membership 행 잠금(`:571-574`)만
    실질적으로 5초 상한 아래 들어간다. 잠금 순서(Workspace → Membership)는 `transferOwnership`과
    여전히 같아 2라운드에서 닫힌 교착 회피가 깨지지 않았다.
  - 테스트: `trigger-resource-releaser.service.spec.ts`(`d2184dcf2` diff) — Workflow/Workspace 두
    케이스 모두 이벤트 배열에 `"query:SET LOCAL lock_timeout = '5000ms'"`가 잠금(`lock:...`)보다
    **먼저** 오는 것을 순서까지 단언. `workspaces.service.spec.ts`도 `deleteEvents`에서
    `releaseExternal → lockAndList → check:locked → workspace.remove` 순서를 명시적으로 재확인해
    "열거·잠금이 재검사보다 먼저"라는 새 계약을 검증한다. 뮤턴트 M21(상한 제거)·M22(열거를 재검사
    뒤로) RED로 판별력도 있다(커밋 메시지에 명시, 직접 재실행은 하지 않았으나 순서를 뒤집는 조건을
    이벤트 배열 단언이 실제로 가른다는 점은 spec 코드로 확인).

- **[해소 확인 유지] 스케줄 job 배치 해제의 비원자성 (1라운드 CRITICAL#1)** — 코드 변경 없음,
  `097e583e1`의 수정이 그대로 유지된다: `removeScheduleJobsOrRestore`
  (`trigger-resource-releaser.service.ts:167-200`)가 전체 스케줄에 대해 `removeJob`을 전부 시도하고
  실패가 있으면 이미 해제한 활성 job만 재등록 후 던진다. 이번 라운드에서 새로 추가된 테스트
  (`trigger-resource-releaser.service.spec.ts` "실패가 여럿이면 전부를 한 메시지에 담는다")도 이
  경로의 기존 동작(개별 실패를 계속 모아 시도)을 재확인한다.

- **[해소 확인 유지] `deleteWorkspace` ↔ `transferOwnership` 잠금 순서 (1라운드 WARNING#3)** — 코드
  변경 없음, Workspace → Membership 순서가 이번 라운드의 순서 변경(열거를 재검사 앞으로) 이후에도
  두 트랜잭션 모두 유지된다(위 확인 참조).

## 요약

이번(3)라운드의 실제 코드 델타(`d2184dcf2`)는 2라운드 WARNING("부모 삭제 트랜잭션의 잠금 대기에
상한 없음")을 정확히 겨냥해 고쳤고, 잠금 순서(트랜잭션 첫 호출 = 상한 설정 + 부모 잠금 + 열거, 그 뒤
재검사)와 워크스페이스 잠금 순서(Workspace → Membership) 모두 소스를 직접 읽고 대조한 결과 문서화된
계약과 일치하며 순서를 뒤집는 뮤턴트를 가르는 판별력 있는 테스트가 붙어 있다. 새로 도입된 코드가
새로운 경쟁 조건이나 교착을 만들지는 않는다. 다만 1·2라운드에서 이미 지적된 **하나의 WARNING**
("외부 해제 스냅샷"과 "잠금된 트리거 열거" 사이의 시차 — 그 사이 새로 생긴 schedule 트리거의 BullMQ
job이 정리되지 않을 수 있음)은 이번 라운드에도 코드가 바뀌지 않아 그대로 열려 있다. 팀은 이를
"커밋 뒤로 옮기면 CASCADE로 schedule 행을 먼저 잃는다"는 실측 근거로 의도적으로 열어 두고 plan
체크리스트에 sweeper 후속 항목으로 추적 중이다 — 근거는 타당하나 실제 race window 자체는 여전히
존재하므로, plan이 `complete/`로 이동하기 전 그 후속 항목이 실제 트래커 문서에 등재됐는지 확인하는
것을 조건으로 이번 라운드를 닫는 것을 권한다.

## 위험도

MEDIUM
