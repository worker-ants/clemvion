# 동시성(Concurrency) 코드 리뷰 — schedule-dup-delete

## 발견사항

- **[INFO]** `SchedulesService.remove()` 의 승/패 판정 지점은 `m.delete(Trigger, triggerId)` 의 `affected` 하나뿐이고, 그 값이 감사·비밀 정리·스케줄 행 삭제를 모두 올바르게 게이팅한다
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts` — `remove()` 의 `if (schedule.triggerId) { … } else { … }` 블록 (`m.delete(Trigger, triggerId)` 및 뒤이은 `if (affected === 0) this.throwScheduleNotFound();`)
  - 상세: 잠금 없는 `findById` 는 동시 두 요청 모두 통과시키지만, `acquireTriggerConfigLock(m, triggerId, …)` 로 얻는 `pg_advisory_xact_lock` 이 트랜잭션 안에서 둘을 줄 세운다. 이긴 쪽은 `affected: 1` 로 정상 진행하고, 진 쪽은 `affected: 0` 을 받아 트랜잭션 콜백 안에서 즉시 `throwScheduleNotFound()` 를 던진다 — `manager.transaction()` 이 이를 잡아 ROLLBACK 후 재던지므로 advisory lock 은 COMMIT/ROLLBACK 시점에 자동 해제되어 락 잔존·데드락 위험이 없다. `.catch((err) => { if (err instanceof NotFoundException) throw err; … })` 는 이 404 만 그대로 통과시키고, 그 외 예외만 "반쯤 삭제된 상태" 로 로그를 남긴 뒤 재던진다 — 거짓 경보를 피하면서도 실제 실패는 계속 가시화한다. `await` 체인이 끊기지 않아 이 예외가 호출자에게 정확히 전파되고, 그 뒤의 `deleteTriggerSecretsAfterCommit` · `scheduleRepository.remove(schedule)` 은 승자만 도달한다.
  - `schedule.trigger_id → trigger` 가 `onDelete: 'CASCADE'` 라 스케줄 행 자체는(이긴 쪽도 포함) 삭제 시점에 이미 0행이 될 수 있어 판별자가 될 수 없다는 함정을 코드 주석·plan·CHANGELOG·e2e 네 곳이 일관되게 짚고 있고, 실측(고치기 전 `[204,204]`+감사 2건 → 고친 뒤 `[204,404]`+감사 1건, `schedule-delete-concurrency.e2e-spec.ts`)으로 뒷받침된다.
  - 제안: 조치 불요. (이번 라운드 신규 커밋 `210808701` 은 이 판정 로직 자체를 바꾸지 않고 `affected` 가 `null`/`undefined` 인 대조군 테스트만 추가했다 — `git diff 2879e88c7 210808701 -- .../schedules.service.ts` 로 프로덕션 코드 무변경을 확인함.)

- **[INFO]** `affected === 0` 명시 비교가 `null`/`undefined`("모른다")를 `0`("없다")으로 오독하지 않는다는 것을 새 대조군 두 쌍이 실행 경로로 고정한다
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.spec.ts` — `'삭제 — affected 를 보고하지 않는 드라이버에서는 404 로 뒤집지 않는다 (트리거 경로)'`, `'삭제 — 같은 대조군 (triggerId 없는 방어 분기)'`
  - 상세: `DeleteResult.affected` 의 타입은 `number | null | undefined` 다. 두 대조군 모두 `affected`에 `undefined`·`null`을 순회 대입해 `service.remove(...)`가 정상 완료(`resolves.toBeUndefined()`)하고 `recordAudit`가 호출됨을 단언한다 — `affected === 0`을 `!affected`로 되돌리는 회귀가 있으면 이 두 테스트가 즉시 실패한다(형제 서브시스템 `rewriteTriggerConfigLocked`가 이미 같은 형태의 대조군을 갖고 있어 설계 일관성도 맞다).
  - 제안: 조치 불요 — 이미 반영됨.

- **[INFO]** 락 밖 `scheduleRunnerService.removeJob(schedule.id)` 이중 호출은 이 PR 의 의도적 비목표이며 새로 만든 문제가 아니다
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts` — `remove()` 최상단, `findById` 직후 `acquireTriggerConfigLock` 이전
  - 상세: 진 쪽·이긴 쪽 모두 락 획득 전에 무조건 `removeJob`을 호출한다. BullMQ job 해제가 멱등하다는 전제 하에 결과적 영향은 없으나, "되돌릴 수 없는 정리를 락 전에 끝낸다"는 설계라 완전히 닫힌 것은 아니다. `plan/in-progress/schedule-dup-delete.md` "이 PR 이 하지 않는 것" 섹션과 CHANGELOG "남는 것" 항목이 형제 PR(#1369/#1370)과 동일한 잔여로 이미 명시적으로 스코프 아웃했다.
  - 제안: 조치 불요 — 이미 문서화된 유예.

- **[INFO]** `triggerId` 없는 방어 분기(엔티티 NOT NULL 제약상 현재 도달 불가)는 락 없이도 원자성이 보장된다
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts` — `else` 블록의 `this.scheduleRepository.delete({ id, workspaceId })`
  - 상세: 이 분기는 CASCADE가 개입하지 않으므로 단일 `DELETE … WHERE id = $1 AND workspace_id = $2` 문 자체가 DB 레벨에서 원자적이다. 두 동시 요청 중 하나만 실제 행을 지우고(`affected: 1`) 다른 하나는 `affected: 0`을 받아 404로 끝난다 — advisory lock이 불필요한 올바른 설계다.
  - 제안: 조치 불요.

## 요약

`SchedulesService.remove()`의 동시 DELETE 이중 감사 결함(형제 세 경로 #1369·#1370과 같은 결함 클래스의 네 번째 자리)을, 트랜잭션 스코프의 `pg_advisory_xact_lock` 안에서 실행되는 `m.delete(Trigger, triggerId)`의 `affected`를 유일한 판별자로 삼아 정확히 닫았다. `schedule.trigger_id → trigger`의 `ON DELETE CASCADE` 때문에 스케줄 행 자체는 판별자가 될 수 없다는 함정(이긴 쪽도 스케줄 행 0행이 되어 둘 다 404가 되는 함정)을 코드·plan·CHANGELOG·e2e 네 곳이 일관되게 짚었고 실측(`[204,204]`+감사2건 → `[204,404]`+감사1건)으로 뒷받침된다. advisory lock은 COMMIT/ROLLBACK 시 자동 해제되어 데드락·락 잔존 위험이 없고, `.catch`의 `NotFoundException` 분리는 정상적인 "진 쪽 404"를 "반쯤 삭제된 상태" 거짓 경보로 잘못 로그하지 않게 막는다. `affected === 0` 명시 비교는 `null`/`undefined`("모른다")를 오독하지 않는다는 것을 이번 라운드 신규 커밋(`210808701`)의 대조군 테스트 두 쌍이 실행 경로로 고정했으며, 이 커밋은 프로덕션 코드(`schedules.service.ts`)를 변경하지 않았음을 `git diff`로 확인했다. 직전 세 라운드의 concurrency 리뷰(00_06_01→00_37_06→00_56_52)가 이미 같은 코드를 훑어 WARNING을 전부 조치·INFO로 수렴시킨 상태이며, 이번 라운드에서도 신규 CRITICAL/WARNING급 동시성 결함은 발견되지 않았다. 락 밖 BullMQ `removeJob` 이중 호출은 형제 PR들과 동일하게 문서화된 의도적 잔여다.

## 위험도

LOW
