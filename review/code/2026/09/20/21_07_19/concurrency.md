# 동시성(Concurrency) 코드 리뷰

## 검토 범위

`WorkflowsService.remove()` / `WorkspacesService.deleteWorkspace()` 의 "동시 DELETE 두 건이 감사 행을
중복 기록"하는 TOCTOU(check-then-act) 결함 수정. 핵심 변경은 `TriggerResourceReleaserService
.lockParentAndListTriggerIds()` 가 `pessimistic_write` 로 잠그며 읽은 부모 행 결과를 버리지 않고
`LockedParentTriggers { parentPresence: 'present' | 'absent', triggerIds }` 로 호출자에게 돌려주고,
두 호출부가 `parentPresence === 'absent'` 를 트랜잭션 내부에서 즉시 검사해 `NotFoundException` 으로
단락(→ 트랜잭션 롤백)하도록 한 것. 부수적으로 `.catch` 가 `NotFoundException` 은 재던지기만 하고
"수동 정리 필요" error 로그를 남기지 않도록 가드를 추가했다. 검증용으로 실제 DB 락을 쥐고 두 요청을
결정적으로 겹치게 만드는 e2e 스펙 2개가 신규 추가됐다.

관련 파일: `codebase/backend/src/modules/triggers/trigger-resource-release.ts`,
`trigger-resource-releaser.service.ts`(+`.spec.ts`), `codebase/backend/src/modules/workflows/workflows.service.ts`
(+`.spec.ts`), `codebase/backend/src/modules/workspaces/workspaces.service.ts`(+`.spec.ts`),
`codebase/backend/test/workflow-delete-concurrency.e2e-spec.ts`,
`codebase/backend/test/workspace-delete-concurrency.e2e-spec.ts`.

## 발견사항

- **[INFO] `releaseExternalForParent` 는 여전히 잠금 밖·트랜잭션 밖에서 두 요청 모두 실행된다 (기존에 식별·유보된 잔여 이슈)**
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts` `remove()` 의
    `await releaser.releaseExternalForParent({ workflowId: id })` 호출부(파일 6 diff, `manager.transaction` 진입 직전) ·
    `codebase/backend/src/modules/workspaces/workspaces.service.ts` `deleteWorkspace()` 의 대칭 호출부(파일 8 diff)
  - 상세: 이번 diff 가 고치는 것은 트랜잭션 **내부**(잠금 뒤) 의 "부모 부재 무시" 문제다. 그런데 `releaseExternalForParent`
    (schedule job·provider teardown 등 외부 부수효과 해제)는 여전히 잠금 없는 상태로, 두 동시 요청 모두 트랜잭션에
    진입하기 **전에** 무조건 실행된다. 즉 동시 DELETE 두 건이 겹치면 이 외부 해제 호출 자체는 여전히 두 번
    일어날 수 있다(멱등을 전제로 함). 이번 수정 범위 밖이며, 직전 리뷰 라운드(`review/code/2026/09/20/20_06_26/SUMMARY.md`
    항목 #6)에서 이미 같은 형태로 식별돼 "신규 결함 아님, 후속 설계 개편 때 정리"로 명시적으로 유보된 항목이다.
    재확인 결과 이번 diff 로 그 상태가 바뀌지 않았음을 표시해 둔다(회귀 아님, 신규 완화도 아님).
  - 제안: 조치 불요(기존 유보 결정 유효). 후속 "공용 삭제 경로" 리팩터 시 `releaseExternalForParent` 도
    잠금 뒤로 옮기거나 명시적 멱등성 계약을 문서화하는 것을 함께 고려.

- **[INFO] e2e 겹침-대기 타이머가 clearTimeout 되지 않는다 (동시성 결함 아님, 테스트 위생)**
  - 위치: `codebase/backend/test/workflow-delete-concurrency.e2e-spec.ts:81-86`,
    `codebase/backend/test/workspace-delete-concurrency.e2e-spec.ts:73-78` — `Promise.race([pending.then(...), new Promise((resolve) => setTimeout(...))])`
  - 상세: `pending` 이 먼저 settle 돼도 `setTimeout` 핸들이 정리되지 않는다. 프로덕션 동시성과 무관하고 판정
    결과에도 영향 없음(레이스 대상 promise 는 이미 fulfilled 상태라 뒤늦은 resolve 호출은 무시된다) — Jest
    open-handle 경고 가능성 정도의 미미한 위생 이슈.
  - 제안: 필요시 `const t = setTimeout(...); ...; clearTimeout(t);` 로 정리(비차단).

## 검증한 항목 (문제 없음으로 판단)

- **원자성/롤백**: `locked.parentPresence === 'absent'` 검사와 예외 발생이 `manager.transaction()` 콜백 **내부**에
  있어, 두 서비스 모두 `manager.remove()` 실행 전에 단락되고 TypeORM 이 트랜잭션을 롤백한다 — 반쯤 지워진
  상태를 만들지 않는다.
- **락 해석의 정합성**: PostgreSQL 의 `SELECT ... FOR UPDATE` (TypeORM `pessimistic_write`) 는, 대기 중이던 행이
  잠금을 쥔 트랜잭션에 의해 커밋과 함께 삭제되면 재평가 후 그 행을 결과에서 제외한다(에러도, 무한 대기도
  아님). 두 번째 요청의 `findOne(..., lock: pessimistic_write)` 이 `null` 을 돌려주고 `parentPresence: 'absent'`
  로 정확히 매핑되는 근거가 이 semantics 와 일치한다.
  근거: `codebase/backend/src/modules/triggers/trigger-resource-releaser.service.ts:81-109`.
- **락 순서/데드락**: `WorkspacesService.deleteWorkspace()` 는 같은 트랜잭션 안에서 워크스페이스 행을
  `lockParentAndListTriggerIds` 로 한 번, `assertWorkspaceDeletable(..., { mode: 'pessimistic_write' })` 로
  다시 잠근다 — 같은 트랜잭션이 이미 쥔 행 잠금의 재획득이라 PostgreSQL 에서 즉시 성공하며 데드락을
  만들지 않는다. 이 이중 잠금 자체는 이번 diff 가 새로 만든 것이 아니라 기존 순서(워크스페이스 → 멤버십)를
  그대로 유지한 것이다.
  근거: `codebase/backend/src/modules/workspaces/workspaces.service.ts:498-560`.
- **에러 전파**: `.catch` 블록은 `NotFoundException` 을 조용히 재던지고, 그 외 에러만 로그 후 재던진다 — 두
  경우 모두 `throw`/재던지므로 `await` 체인이 끊기지 않고 상위(`triggerIds` 대입)로 예외가 정상 전파된다.
  `releaseSecretsAfterCommit`/`recordAudit` 호출은 두 실패 경로 모두에서 실행되지 않는다(코드 검토로 확인 —
  `await` 표현식이 reject 되면 그 다음 줄로 진행하지 않는다).
  근거: `workflows.service.ts:263-312`, `workspaces.service.ts:498-561`.
- **결정적 e2e 재현 기법**: 두 신규 e2e 스펙은 타이밍에 기대지 않고, 별도 커넥션(`locker`)이 대상 행을
  `SELECT ... FOR UPDATE` 로 직접 잠근 뒤 두 DELETE 요청을 발사하고, `Promise.race` 로 "락 해제 전에는 둘 다
  미종료"임을 공허성 가드로 확인한 다음 COMMIT 으로 동시에 풀어준다. 인터리빙 지점을 우연이 아니라 DB 락으로
  강제하는 방식이라 flaky 하지 않고, 회귀 시 결정적으로 재현된다.

## 요약

핵심 수정은 잠금 없는 선조회와 잠금 뒤 재확인 사이의 TOCTOU 창을 트랜잭션 내부 명시적 존재-검사로
닫는 정석적인 패턴이며, PostgreSQL 의 `SELECT ... FOR UPDATE`+행 삭제 semantics 를 정확히 반영해 구현했다.
트랜잭션 롤백을 통한 원자성, 기존 락 순서 유지(신규 데드락 없음), 에러 전파 경로 모두 코드 검토로 확인했고,
새 e2e 두 건은 실제 DB 락으로 겹침을 결정적으로 재현해 판별력이 있다. 발견한 두 항목은 모두 INFO 등급이며
하나는 이미 이전 리뷰 라운드에서 식별·유보된 기존 잔여 이슈(외부 해제 호출의 비멱등 중복 실행 가능성)의
재확인이고, 다른 하나는 프로덕션 코드와 무관한 e2e 테스트의 타이머 정리 누락이다. 이번 diff 가 새로
도입한 경쟁 조건이나 데드락, async/await 누락은 발견되지 않았다.

## 위험도

LOW
