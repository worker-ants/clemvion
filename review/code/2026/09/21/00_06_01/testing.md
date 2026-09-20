# 테스트(Testing) 리뷰 — schedule-dup-delete

대상: `codebase/backend/src/modules/schedules/schedules.service.ts`(remove()) ·
`schedules.service.spec.ts` · 신규 `codebase/backend/test/schedule-delete-concurrency.e2e-spec.ts`.
(plan/consistency 산출물 5건은 코드가 아니므로 테스트 관점 리뷰 대상에서 제외.)

## 발견사항

- **[WARNING]** 방어 목적의 `scheduleRepository.remove(schedule)` 호출이 어떤 테스트에서도 "호출됐는가" 로 검증되지 않는다 — 지워도 GREEN
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts:364` (`if (schedule.triggerId)` 분기 끝)
  - 상세: 이 줄의 주석은 "CASCADE 가 없어지면 이 줄이 유일한 삭제다" 라고 명시적으로 그 존재 이유를 안전망(insurance)으로 규정한다. 그런데 이 분기의 성공 경로를 도는 유일한 단위 테스트(`schedules.service.spec.ts:736` `'삭제 — trigger 행을 config 락 안에서 지운다'`)는 `triggerLockEvents` 순서와 `triggerRepo.delete` 호출만 단언하고 `scheduleRepo.remove` 는 전혀 보지 않는다. 전 파일을 grep 해도 `scheduleRepo.remove` 를 "호출됐다" 로 단언하는 테스트는 없다 — 유일한 참조는 실패 경로 테스트의 `expect(scheduleRepo.remove).not.toHaveBeenCalled()` (`spec.ts:840`, 트랜잭션이 던지므로 애초에 도달 못 하는 자리에 대한 단언) 뿐이다. 이 줄을 통째로 지워도 유닛 스위트도, e2e(스케줄 행은 어차피 FK CASCADE 가 지운다)도 RED 로 만들지 못한다 — "안전망" 이라는 설계 근거 자체가 뮤테이션에 반증되지 않은 채로 남아 있다. 프로젝트가 반복적으로 강조해 온 "설계 근거는 뮤턴트로 반증해 보라" 원칙이 정확히 이 자리에 적용된다.
  - 제안: 성공 경로 테스트(`spec.ts:736`)에 `expect(scheduleRepo.remove).toHaveBeenCalledWith(schedule)` (또는 동등한 인자 단언)을 추가해, 이 줄이 실제로 실행 경로에 있다는 사실 자체를 최소한 고정한다. (CASCADE 가 사라진 미래 시나리오까지 검증하려면 별도 fixture 가 필요하지만, 최소 "호출은 된다" 만이라도 지금 비어 있다.)

- **[WARNING]** 신규 방어 분기(`triggerId` 없음 → `scheduleRepository.delete` 의 `affected === 0` → 404)의 0-affected 경로가 테스트되지 않는다
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts:368-377` (else 분기 신규 `NotFoundException` throw)
  - 상세: 이 분기를 도는 유일한 테스트(`schedules.service.spec.ts:850` `'삭제 — triggerId 가 없으면...'`)는 `scheduleRepo.delete` 기본 mock(`affected: 1`, `spec.ts:56`)에 의존하는 happy-path 만 exercise 한다 — `if (!affected) throw NotFoundException(...)` 가지는 한 번도 실행되지 않는다. 같은 파일이 다른 도달 불가 방어 분기(`computeNextRuns` 가 빈 배열을 반환하는 경우, `spec.ts:404` `'[방어 분기] 다음 실행 계산이 비면...'`)에 대해서는 사설(private) 메서드를 강제로 mock 해서라도 분기를 태우는 관행을 이미 확립해 두었는데, 이번에 새로 추가된 방어 분기는 그 관행을 따르지 않았다. `scheduleRepo.delete.mockResolvedValueOnce({ affected: 0 })` 로 이 else 경로에서도 404 가 나는지 확인하는 테스트가 없다는 것은, 이 새 로직 절반이 사실상 "쓰여만 있고 실행 검증은 안 된" 상태라는 뜻이다.
  - 제안: `it('[방어 분기] triggerId 없이 scheduleRepo.delete 가 0행이면 404')` 같은 대조 테스트를 추가해 `scheduleRepo.delete.mockResolvedValueOnce({ affected: 0, raw: [] })` → `service.remove(...)` 가 `RESOURCE_NOT_FOUND` 로 reject 하는지 고정한다.

- **[INFO]** 새 race 테스트가 `triggerRepo.delete` 호출 인자를 단언하지 않는다 — 형제 happy-path 테스트와 비대칭
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.spec.ts:772-804` (`'삭제 — 락 안 트리거 삭제가 0행이면 404...'`)
  - 상세: 바로 위 happy-path 테스트(`spec.ts:762`)는 `expect(triggerRepo.delete).toHaveBeenCalledWith('trig-del')` 로 "무엇을 지우려 했는지" 까지 본다. 이 race 테스트는 `mockResolvedValueOnce` 로 반환값만 강제하고 호출 인자는 확인하지 않는다 — 지금은 `affected:0` 이 인자와 무관하게 강제되므로 통과에 영향은 없지만, 우선순위가 낮은 스타일 비대칭으로 남는다.
  - 제안: `expect(triggerRepo.delete).toHaveBeenCalledWith('trig-race')` 한 줄 추가로 형제 테스트와 대칭을 맞출 것을 권장(강제 아님).

- **[INFO]** `affected` 판정이 `0`/`null`/`undefined` 를 모두 동일하게 취급하지만(`if (!affected)`), 테스트는 `0` 만 다룬다
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts:329-330`, `372-373`
  - 상세: TypeORM `DeleteResult.affected` 의 타입은 `number | null | undefined` 다. 코드의 falsy 체크는 셋 다 안전하게 404 로 처리하지만, 테스트(`spec.ts:785-788`)는 `affected: 0` 케이스만 가짐 — Postgres 드라이버 실사용에서는 항상 숫자가 오므로 실질 위험은 낮지만, 타입이 허용하는 값 중 검증된 것은 한 갈래뿐이다.
  - 제안: 우선순위 낮음(변경 불요). 필요 시 `affected: undefined` 케이스를 파라미터화 테스트로 추가하는 정도.

## 긍정적으로 확인한 부분

- `Logger.prototype.error` spy 는 두 신규/기존 테스트 모두 `try/finally` 로 원복을 보장해 spy 누출이 없다.
- e2e(`schedule-delete-concurrency.e2e-spec.ts`)는 형제 PR(#1369/#1370)의 `trigger-/workflow-/workspace-delete-concurrency.e2e-spec.ts` 와 구조적으로 동일한 패턴(advisory lock 선점 → 동시 요청 fan-out → `Promise.race` 공허성 가드 → COMMIT → 상태쌍/감사 행 수 단언)을 그대로 재사용해 새 클래스의 flaky/vacuous 위험을 도입하지 않는다.
- 이 PR 의 e2e 는 형제들과 달리 `schedule` 행 자체가 CASCADE 로 사라졌는지까지 추가로 단언(`left.rows[0].count).toBe('0')`)해, "판정자가 트리거인 이유"(CASCADE)라는 설계 근거를 실측으로 뒷받침한다 — 이는 형제 테스트보다 한 단계 더 나간 검증이다.
- 기존 회귀 테스트 셋(감사 로깅, 실패 시 로그, `triggerId` 없음 분기, config 락 순서)은 새 계약(`delete` 가 `{affected}` 를 돌려준다)에 맞춰 fixture 가 적절히 갱신됐고, 실측 mutation testing(계획서에 "184자 제거 뮤턴트가 새 테스트 하나만 죽인다" 기록)까지 수행돼 최소한의 판별력은 확인됐다.
- `DeleteResult` 타입을 실제로 import 해 mock 캐스팅에 사용, `affected: 0` 시나리오를 타입 안전하게 표현했다.

## 요약

핵심 동시성 결함(advisory lock 통과 후 진 쪽이 0행 삭제를 그대로 진행해 감사가 두 번 남는 문제)에 대한 테스트는 unit(판정 로직·false-alarm 로그 부재까지)과 e2e(실제 DB CASCADE·동시성) 양쪽에서 견고하게 커버된다. 다만 이번 리팩터로 새로 생긴 두 자리 — ① CASCADE 안전망으로 남긴 `scheduleRepository.remove(schedule)` 호출, ② `triggerId` 없음 방어 분기의 `affected===0` → 404 경로 — 는 "쓰여 있지만 어떤 테스트도 그 실행을 검증하지 않는" 상태다. 특히 ①은 그 줄이 존재하는 이유("CASCADE 가 없어지면 유일한 삭제") 자체가 뮤테이션 검증 없이 방치돼, 이 프로젝트가 반복해서 지적해 온 "미검증 설계 근거" 패턴과 정확히 일치한다. 기능적 결함은 아니며 전체 회귀 스위트는 유효하다.

## 위험도

MEDIUM
