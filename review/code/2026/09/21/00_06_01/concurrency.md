# 동시성(Concurrency) 리뷰 — `SchedulesService.remove()` 동시 DELETE 중복 감사 수정

## 검토 범위

실질적으로 동시성과 관련된 변경은 3개 파일이다:

- `codebase/backend/src/modules/schedules/schedules.service.ts` — `remove()` 의 트리거 삭제 판정 로직 변경 (핵심)
- `codebase/backend/src/modules/schedules/schedules.service.spec.ts` — 위 변경에 대응하는 mock·유닛 테스트
- `codebase/backend/test/schedule-delete-concurrency.e2e-spec.ts` — advisory lock 을 강제로 쥐어 겹침을 재현하는 e2e

나머지 파일(`plan/in-progress/*.md`, `review/consistency/**`)은 plan 문서·이전 consistency-check 산출물로, 동시성 코드가 없어 검토 대상에서 제외했다(문서 서술 자체의 정합성은 이 리뷰의 관점 밖).

## 분석 요약

이 PR 은 `WorkflowsService.remove()`(#1369)·`TriggersService.remove()`(#1370)에서 이미 검증된 패턴 — "advisory lock 은 줄만 세우므로, 락으로 보호되는 실제 쓰기의 `affected` 를 판별자로 삼는다" — 을 `SchedulesService.remove()` 에 그대로 확장한 것이다. `schedule.trigger_id → trigger` FK 가 `onDelete: CASCADE` 라는 사실 때문에 스케줄 행 자체의 `affected` 로는 판정할 수 없고(이긴 쪽도 CASCADE 로 0행이 되어 둘 다 404 가 됨) 트리거 삭제의 `affected` 를 판별자로 삼은 설계는 정확하다.

인터리빙을 실제로 추적한 결과:

1. `findById` (락 없음) → 두 요청 모두 통과
2. `removeJob` (BullMQ, 락 밖, 되돌릴 수 없음) → 두 요청 모두 실행(중복은 기존에도 있었고 이 PR 이 명시적으로 다루지 않는 잔여 항목)
3. `triggerRepository.manager.transaction()` 안에서 `acquireTriggerConfigLock` → `pg_advisory_xact_lock` 으로 직렬화
4. 이긴 쪽: `m.delete(Trigger, triggerId)` → `affected=1` → 커밋 → CASCADE 로 스케줄 행도 함께 삭제됨 → 비밀 정리 → `scheduleRepository.remove`(0행 no-op) → 감사 기록
5. 진 쪽: 락을 기다렸다가 획득 후 `m.delete` → 이미 지워진 행이라 `affected=0` → `NotFoundException` throw → 트랜잭션 롤백(advisory lock 도 함께 해제) → `.catch` 에서 `NotFoundException` 은 그대로 재던짐(로그 없이) → 비밀 정리·스케줄 삭제·감사 기록 전부 스킵 → 404

이 흐름은 `codebase/backend/src/modules/triggers/trigger-config-lock.ts` 의 `acquireTriggerConfigLock`/`TRIGGER_DELETE_LOCK_TIMEOUT_MS` JSDoc 이 명시하는 계약(트랜잭션 안에서만 호출, xact 락은 커밋/롤백 시 자동 해제, 삭제 경로는 되돌릴 수 없는 정리를 락 **전에** 끝내므로 무한 대기 대신 5초 상한을 둔다)과 정확히 부합한다. `.catch` 블록에서 `NotFoundException` 을 먼저 걸러내고 그 외의 경우(락 타임아웃 등)만 "반쯤 삭제된 상태" 로 로깅하는 순서도 올바르다 — 동시 삭제로 인한 정상적인 0행 케이스를 거짓 경보로 로깅하지 않는다.

`triggerId` 가 없는 방어 분기(NOT NULL 제약상 현재 도달 불가)는 advisory lock 없이 `scheduleRepository.delete({id, workspaceId})` 의 `affected` 로 판정하는데, 이 경우는 CASCADE 가 개입하지 않고 단일 원자적 DELETE 문 자체가 DB 레벨에서 "누가 실제로 그 행을 지웠는가"를 정확히 가르므로 앱 레벨 락이 없어도 이중 감사가 나지 않는다 — 설계상 타당하다.

## 발견사항

- **[INFO]** BullMQ `removeJob()` 중복 호출은 이 PR 이 명시적으로 다루지 않는 잔여 항목이다
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts` — `remove()` 메서드, `await this.scheduleRunnerService.removeJob(schedule.id);` 호출부(advisory lock 진입 이전, `if (schedule.triggerId)` 분기보다 앞)
  - 상세: 동시 DELETE 두 건이 겹치면 `removeJob` 은 락 밖에서 두 번 다 실행된다. `plan/in-progress/schedule-dup-delete.md` "이 PR 이 하지 않는 것" 절이 이를 이미 알고 명시적으로 유예했고(형제 PR #1369/#1370 도 동일 잔여를 남김), `removeJob` 자체가 멱등(존재하지 않는 job 제거 시 예외 없음)이라는 전제 위에서 안전한 유예로 보인다. 새로 도입된 결함이 아니라 기존 패턴의 반복이므로 차단 사유는 아니다.
  - 제안: 조치 불요 — plan 이 이미 인지하고 트래커/후속으로 넘겼다. 다만 `removeJob` 의 멱등성이 실제로 보장되는지(BullMQ 라이브러리 계약)는 이 PR 범위 밖에서 한 번은 명시적으로 확인해 둘 가치가 있다.

- **[INFO]** 새 유닛 테스트(`schedules.service.spec.ts` — `'삭제 — 락 안 트리거 삭제가 0행이면 404 이고 감사·비밀 정리를 남기지 않는다'`)가 락 순서 자체는 재단언하지 않는다
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.spec.ts:772` (`it(...)` 시작) — 해당 `it` 블록 전체
  - 상세: 이 테스트는 `triggerRepo.delete.mockResolvedValueOnce({affected: 0, raw: []})` 로 0행 케이스만 검증하고 `triggerLockEvents` 의 락 획득 순서(`timeout:...` → `lock:...` → `delete:...`)는 단언하지 않는다. 락 순서 보증 자체는 인접한 성공 케이스 테스트(`'삭제 — trigger 행을 config 락 안에서 지운다'`, 736행)가 이미 전담하고 있고, plan 체크리스트에 "유효 뮤턴트(184자만 제거)가 새 테스트 하나만 죽인다"는 실측이 적혀 있어 판별력 자체는 확인됐다. 다만 이 특정 테스트만 놓고 보면 "락을 건너뛰고 바로 0행으로 판정하는" 뮤턴트가 이 테스트 하나만으로는 걸러지지 않을 수 있다(다른 테스트가 걸러줌).
  - 제안: 조치 불요(다른 테스트가 이미 커버) — 방어적으로 강화하고 싶다면 이 테스트에도 `triggerLockEvents` 앞부분(`lock:trigger-config:trig-race` 포함 여부)을 함께 단언해 두 케이스(성공/0행)가 각각 독립적으로 락 순서를 고정하게 할 수 있다.

- **[INFO]** e2e 테스트의 겹침 강제 기법은 적절하나, 판정 타이밍이 `TRIGGER_DELETE_LOCK_TIMEOUT_MS`(5초) 에 근접하면 flaky 해질 수 있다
  - 위치: `codebase/backend/test/schedule-delete-concurrency.e2e-spec.ts:94-121` (`locker` 트랜잭션으로 advisory lock 을 쥐고 1.5초 뒤 놓는 구간)
  - 상세: 테스트는 별도 커넥션(`locker`)이 같은 advisory lock key(`triggerConfigLockKey(triggerId)`)를 먼저 잡아 두 `fireDelete()` 요청을 강제로 대기시키고, "공허성 가드"(`Promise.race` 로 1.5초 시점에 아직 `pending` 상태인지 확인)로 겹침이 실제로 만들어졌는지 검증한다 — 우연히 겹치지 않는 fixture 를 방지하는 좋은 패턴이다. `locker` 는 1.5초 뒤 COMMIT 하므로 두 앱 트랜잭션이 실제로 대기하는 시간은 5초 상한보다 충분히 짧아 현재 설정에서는 문제가 없다. CI 환경의 부하로 요청 처리 자체가 느려지는 경우(락 획득 자체가 아니라 요청 큐잉·DB 커넥션 풀 대기 등) 5초에 근접할 가능성은 이론상 존재하나, 이는 이 PR 이 새로 만든 위험이 아니라 형제 e2e(`trigger-/workflow-/workspace-delete-concurrency.e2e-spec.ts`)와 동일한 기존 패턴이다.
  - 제안: 조치 불요 — 형제 테스트와 동일한 방식이며 새로운 리스크가 아니다.

## 요약

`SchedulesService.remove()` 변경은 이미 두 차례(#1369 워크플로, #1370 트리거) 검증된 "advisory lock + 락 보호 하위 쓰기의 `affected` 를 판별자로 삼는다" 패턴을 CASCADE 로 인해 판정 기준이 달라지는 세 번째 자리에 정확하게 확장 적용한다. 이긴 쪽/진 쪽의 인터리빙을 단계별로 추적한 결과 경쟁 조건·데드락·원자성 위반은 발견되지 않았고, 락 획득 → 삭제 → `affected` 판정 → 트랜잭션 커밋/롤백(advisory lock 자동 해제) 순서가 일관되게 지켜진다. `NotFoundException` 을 `.catch` 에서 우선 분리해 정상적인 동시 삭제 404 를 "반쯤 삭제된 상태" 오탐 로그로 잘못 분류하지 않는 점도 올바르다. 유닛 테스트(mock 계약 변경 포함)와 e2e(advisory lock 을 직접 쥐어 결정적으로 겹침을 만드는 기법)가 이 계약을 각각 다른 층에서 검증하고 있어 회귀 방어도 충분하다. 발견한 세 항목은 모두 INFO 수준(기존에 이미 인지·유예된 잔여, 테스트 커버리지의 중복 여부, 형제 e2e 와 동일한 타이밍 여유)으로 차단 사유가 아니다.

## 위험도

LOW
