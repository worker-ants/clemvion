# 동시성(Concurrency) 코드 리뷰 — schedule-dup-delete

## 발견사항

- **[INFO]** 판정 기준을 `affected === 0` 명시 비교로 통일한 것은 자매 서브시스템(`rewriteTriggerConfigLocked`)의 선례와 일치하며 안전하다
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts:341-342`(락 안 트리거 삭제 판정), `:375-380`(방어 분기 판정)
  - 상세: `m.delete(Trigger, triggerId)` 와 `scheduleRepository.delete({...})` 모두 `DeleteResult.affected` 를 `!affected` 대신 `affected === 0` 으로 명시 비교한다. `affected` 타입은 `number | null | undefined` 인데, `null`/`undefined`(드라이버가 행 수를 보고하지 않는 경우)를 "없다" 로 잘못 읽으면 정상 삭제를 404 로 뒤집는 반대 방향 버그가 생긴다 — 이는 직전 라운드 concurrency 리뷰(`review/code/2026/09/21/00_37_06` WARNING 2)가 지적해 이번 커밋(`2879e88c7`)에서 이미 교정됐다. Postgres 드라이버는 실전에서 `affected` 를 항상 정수로 채우므로 이 갈래가 실제로 갈릴 가능성은 낮지만, 명시 비교로 바꾼 것 자체는 올바른 방향이다.
  - 제안: 조치 불요 — 이미 반영됨.

- **[INFO]** 락 안 삭제(`m.delete(Trigger, triggerId)`)가 유일한 판별 지점이고, 그 결과에 따른 분기(승/패)가 감사·비밀 정리·스케줄 행 삭제 모두를 올바르게 게이팅한다
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts:322-388` (`remove()` 의 `if (schedule.triggerId) { ... } else { ... }` 및 뒤이은 `recordAudit`)
  - 상세: `acquireTriggerConfigLock(m, triggerId, ...)` → `m.delete(Trigger, triggerId)` → `affected === 0` 이면 트랜잭션 콜백 안에서 즉시 `throwScheduleNotFound()` 를 던져 `manager.transaction()` 이 ROLLBACK 하고 재던진다. `pg_advisory_xact_lock` 은 트랜잭션 종료(COMMIT/ROLLBACK) 시 자동 해제되므로 진 쪽도 락을 정상적으로 반납한다 — 데드락 잔존 위험 없음. `.catch` 는 `NotFoundException` 만 그대로 재던지고(거짓 "반쯤 삭제" 경보 방지), 그 외 예외만 `logger.error` 로 남긴 뒤 재던진다. `await` 체인이 끊기지 않아(324행 `await this.triggerRepository.manager.transaction(...).catch(...)`) 이 예외가 `remove()` 호출자에게 정확히 전파되고, 그 아래 `deleteTriggerSecretsAfterCommit`·`scheduleRepository.remove`·`recordAudit` 는 승자만 도달한다. 신규 단위 테스트 두 건(진 쪽 트리거 경로·진 쪽 방어 분기 모두 감사·`scheduleRepo.remove`·비밀 정리 미호출을 단언)과 e2e(`schedule-delete-concurrency.e2e-spec.ts`, `pg_advisory_xact_lock` 을 별도 커넥션으로 쥐어 실겹침 생성 + `Promise.race` 공허성 가드)가 이 계약을 실측으로 고정한다.
  - 제안: 조치 불요.

- **[INFO]** `scheduleRunnerService.removeJob(schedule.id)`(325행 이전, 트랜잭션 밖) 는 락 보호를 받지 않아 동시 두 요청 모두 각자 호출한다 — 이 PR 의 의도적 비목표
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts:308-311`
  - 상세: 진 쪽·이긴 쪽 모두 `findById` 직후 무조건 `removeJob` 을 호출한다(락 획득 전). BullMQ job 해제가 멱등하다는 전제 하에 결과적 영향은 없지만, "되돌릴 수 없는 정리를 락 전에 끝낸다" 는 설계이므로 이 자체가 결함은 아니다. `plan/in-progress/schedule-dup-delete.md` "이 PR 이 하지 않는 것" 섹션과 CHANGELOG "남는 것" 항목이 형제 세 PR(#1369/#1370)과 동일한 잔여로 이미 명시적으로 스코프 아웃했다.
  - 제안: 조치 불요 — 이미 문서화된 의도적 유예. 새로 닫을 필요 없음.

- **[INFO]** `triggerId` 없는 방어 분기(현재 엔티티 NOT NULL 제약상 도달 불가)의 원자성도 락 없이 안전하다
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts:372-380`
  - 상세: 이 분기는 CASCADE 가 개입하지 않으므로 단일 `DELETE ... WHERE id = $1 AND workspace_id = $2` 문 자체가 DB 레벨에서 원자적이다 — 두 동시 요청 중 하나만 실제로 행을 지우고(`affected: 1`), 다른 하나는 `affected: 0` 을 받아 404 로 끝난다. 별도 advisory lock 없이도 정합성이 보장되는 올바른 설계(향후 `IntegrationsService.remove()` 를 처방할 때 같은 형태를 쓰겠다는 plan 의 언급과도 부합).
  - 제안: 조치 불요.

## 요약

`SchedulesService.remove()` 의 동시 DELETE 이중 감사 결함을, 락(`pg_advisory_xact_lock`, 트랜잭션 스코프) 안에서 실행되는 `m.delete(Trigger, triggerId)` 의 `affected` 를 유일한 판별자로 삼아 정확히 닫았다. `schedule.trigger_id → trigger` 의 `ON DELETE CASCADE` 때문에 스케줄 행 자체는 판별자가 될 수 없다는 함정을 code·plan·e2e 세 곳이 일관되게 짚었고 실측(고치기 전 `[204,204]`+감사 2건 → 고친 뒤 `[204,404]`+감사 1건)으로 뒷받침된다. `affected` 판정을 `=== 0` 명시 비교로 통일한 것은 직전 라운드 concurrency 리뷰의 지적(`null`/`undefined` 를 "없다" 로 오독하면 정상 삭제가 실패로 뒤집힌다)을 정확히 반영한 결과다. advisory lock 은 COMMIT/ROLLBACK 시 자동 해제되어 데드락·락 잔존 위험이 없고, 단위 테스트·e2e 모두 승/패 두 경로를 분리해 감사·비밀 정리·스케줄 행 삭제가 승자에게만 일어남을 실측으로 고정한다. 락 밖에서 두 요청이 각각 호출하는 BullMQ `removeJob` 중복은 형제 PR 들과 동일한 이미 문서화된 잔여이며 이번 diff 가 새로 만든 문제가 아니다. 신규 CRITICAL/WARNING 급 동시성 결함은 발견되지 않았다.

## 위험도

LOW
