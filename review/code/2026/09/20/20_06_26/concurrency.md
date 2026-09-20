# 동시성(Concurrency) 리뷰

## 발견사항

- **[INFO]** 동시 삭제 시 `releaseExternalForParent` (외부 자원 해제: schedule job 해제/재등록, provider teardown, listener unregister)는 여전히 잠금 없는 선조회 뒤·트랜잭션 밖에서 두 요청 모두가 각자 호출한다 — 두 번 실행될 수 있다.
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:268` (`await releaser.releaseExternalForParent({ workflowId: id });`, `remove()` 메서드), 대칭으로 `codebase/backend/src/modules/workspaces/workspaces.service.ts:513`.
  - 상세: 이번 PR 은 "잠근 뒤 부모 부재" 판정만 도입해 **감사 행 중복**을 닫았고, 외부 해제 중복 실행은 `plan/in-progress/dup-delete-audit.md` §"이 PR 이 하지 않는 것" 에 명시적으로 스코프 밖으로 남겨 두었다 — schedule job 해제·provider teardown 이 멱등(대상 없으면 no-op)이라는 전제에 기대는 기존 동작이며 이번 diff 가 새로 만든 문제는 아니다. 검토 결과 이 전제 자체는 타당해 보이나(`removeJob`/teardown 계열이 존재 여부로 분기), 두 요청이 동시에 같은 provider·Redis 에 중복 요청을 보내는 부수효과(예: webhook provider 에 두 번 unregister 호출)는 여전히 남는다.
  - 제안: 신규 결함 아님 — 현재 스코프 그대로 두는 결정에 동의. 다만 이 사실이 plan 문서에는 있지만 `trigger-resource-releaser.service.ts` JSDoc 의 "남는 창" 설명에는 감사 중복 얘기가 빠져 있으니, 후속 개편(트래커의 "네 자리 공용 형태" 설계) 시 같이 정리하면 좋다.

- **[INFO]** `workflow-delete-concurrency.e2e-spec.ts` 의 `finally` 블록이 `COMMIT` 성공 이후에도 항상 `ROLLBACK` 을 시도한다.
  - 위치: `codebase/backend/test/workflow-delete-concurrency.e2e-spec.ts:94-96` (게이트 기준, `finally { await locker.query('ROLLBACK').catch(() => undefined); ... }`).
  - 상세: 정상 경로(COMMIT 성공)에서는 이미 트랜잭션이 끝난 뒤라 이 `ROLLBACK` 이 "활성 트랜잭션 없음" 경고를 유발할 수 있지만 `.catch(() => undefined)` 로 삼켜지므로 테스트 정확성에는 영향이 없다. `COMMIT` 자체가 실패하는 예외 경로에서는 오히려 이 안전망이 남은 트랜잭션을 정리하고 `pending` 프라미스를 드레인해 커넥션 누수·미해결 rejection 을 막아준다 — 의도된 방어적 패턴으로 보인다.
  - 제안: 조치 불요. 참고 사항으로만 기재.

## 점검한 동시성 로직 요약 (경쟁 조건/원자성 중심)

- `TriggerResourceReleaserService.lockParentAndListTriggerIds` (`codebase/backend/src/modules/triggers/trigger-resource-releaser.service.ts:81-109`)가 `pessimistic_write` 로 잠근 뒤 읽은 부모 행(`findOne` 결과)을 더 이상 버리지 않고 `{ parent: 'present' | 'absent', triggerIds }` 로 호출자에게 돌려준다. 종전에는 이 결과를 폐기해, 동시 삭제 두 요청이 잠금 없는 선조회(`findById`/`assertWorkspaceDeletable` 무잠금 버전)를 모두 통과한 뒤 먼저 커밋한 쪽이 행을 지워도 두 번째 요청이 이를 알 방법이 없어 `manager.remove()` 가 0행 삭제를 성공으로 처리(TypeORM 은 0행 DELETE 도 던지지 않음)하며 감사 로그가 중복 기록되는 결함이 있었다. 반환 타입을 `string[] | null` 이 아닌 이름 있는 유니온으로 설계해 "부모 부재"와 "트리거 0개"를 값으로 구분한 점은 이 저장소가 과거 반복적으로 겪은 truthiness 오판 패턴을 피한 좋은 설계다.
- `WorkflowsService.remove()` (`codebase/backend/src/modules/workflows/workflows.service.ts:263-312`): `locked.parent === 'absent'` 이면 트랜잭션 콜백 내부에서 `NotFoundException` 을 던져 TypeORM 이 자동으로 ROLLBACK 하게 하고(감사 미기록 보장), `.catch()` 에서 `NotFoundException` 은 그대로 재던지되 "반쯤 삭제된 상태" 에러 로그는 남기지 않도록 분기했다 — 거짓 경보를 피하는 설계로 타당하다. `manager.remove(workflow)` 는 트랜잭션 밖에서 로드한 `workflow` 엔티티를 쓰지만 DELETE 는 PK 기준이라 staleness 문제가 없다.
- `WorkspacesService.deleteWorkspace()` (`codebase/backend/src/modules/workspaces/workspaces.service.ts:498-555`): `lockParentAndListTriggerIds` 가 이미 Workspace 행을 `pessimistic_write` 로 잠그지만, 곧이어 `assertWorkspaceDeletable(..., { mode: 'pessimistic_write' })` 로 같은 트랜잭션·같은 커넥션에서 Workspace 와 Membership 을 재검사한다. 같은 트랜잭션 내 동일 행 재잠금은 self-deadlock 을 유발하지 않으며, 잠금 순서(Workspace → Membership)도 `transferOwnership` 과 동일하게 유지되어 교착(40P01) 우려가 없다. `parent: 'absent'` 케이스를 이 경로에서 별도로 처리하지 않고 `assertWorkspaceDeletable` 의 재검사에 위임한 것은 판정 지점을 한 곳으로 모으는 합리적 선택이다.
- `test/workflow-delete-concurrency.e2e-spec.ts`: 별도 커넥션에서 `SELECT ... FOR UPDATE` 로 대상 행을 실제로 잠근 뒤 두 DELETE 요청을 동시에 발사하고, 두 요청이 모두 아직 `settled` 되지 않았음을 `Promise.race` 로 확인(공허성 가드)한 다음 `COMMIT` 으로 동시에 푸는 방식은 우연에 기대지 않는 결정적 경쟁 재현이다. plan 문서에 기록된 것처럼 수정 전 코드로 되돌려 실제로 `[204, 204]` + 감사 2건을 관측했다는 실측이 있어 판별력도 확인됐다.

## 요약

동시 DELETE 두 건이 잠금 없는 선조회를 모두 통과해 감사 로그 중복을 남기던 TOCTOU/lost-update 성격의 결함을, "잠그며 읽은 부모 행의 존재 여부"를 폐기하지 않고 호출자에게 이름 있는 값(`parent: 'present'|'absent'`)으로 돌려주는 방식으로 닫았다. 잠금 순서·타임아웃(`SET LOCAL lock_timeout`)·트랜잭션 롤백 경로·에러 로깅 분기가 모두 일관되게 유지되며, 새로 추가된 데드락이나 잠금 누락은 발견되지 않았다. 결정적 e2e(실 DB 행 락으로 강제 인터리빙) 로 수정 전/후 행동 차이를 실측했다는 점도 신뢰도를 높인다. 스코프 밖으로 남긴 "외부 자원 해제 중복 실행"은 기존부터 있던 별개의 잔여 이슈이며 문서화·정당화되어 있어 이번 변경이 새로 만든 위험은 아니다.

## 위험도

LOW
