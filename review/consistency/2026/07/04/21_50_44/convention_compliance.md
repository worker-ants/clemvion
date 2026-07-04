# 정식 규약 준수 검토 — orphan pending backstop (recoverOrphanPendingExecutions)

> impl-prep payload(`_prompts/convention_compliance.md`) 는 `spec/5-system/1-auth.md` 전체(1900+ 줄)를
> "구현 대상 영역" 으로 잘못 실었다(mis-scope, 오퍼레이터 확인 사항). 본 검토는 실제 계획 작업 —
> `plan/in-progress/orphan-pending-backstop.md` + `spec/5-system/4-execution-engine.md` §7.4/§8 +
> `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 의 `recoverStuckExecutions`/
> `markQueueWaitTimeout` 실제 구현 — 을 근거로 판정했다.

## 계획 요약 (검토 대상)

- 신규 private 메서드 `recoverOrphanPendingExecutions` 를 `execution-engine.service.ts` 에 추가.
- TypeORM `find` (`LessThan`) 로 `status='pending' AND queued_at < now - resolveQueueWaitTimeoutMs()` 후보 스캔.
- 각 후보에 기존 `markQueueWaitTimeout(id)` (조건부 UPDATE `WHERE status='pending'`, idempotent) 재사용.
- `recoverStuckExecutions()` 의 기존 `exec:recover:lock` + 부팅 트리거에 편승(신규 lock/env/migration 없음).
- spec §8 line 1088 / §7.4 의 "orphan pending 회수는 후속" 서술을 "구현 완료" 로 갱신 예정.

## 발견사항

- **[INFO]** 스캔 원자성 모델이 `recoverStuckExecutions`(RUNNING) 와 다른 전략
  - target 위치: 계획 §"설계 결정" 2번, 구현 예정 `recoverOrphanPendingExecutions`
  - 관련 규약/선례: `spec/5-system/4-execution-engine.md` §7.4 "Recovery" — `reclaimStuckRunningExecution` 은 **조건부 UPDATE…RETURNING(affected=1)** 로 스캔=claim 을 원자적으로 겸한다(`execution-engine.service.ts:2863` 부근).
  - 상세: 계획은 "TypeORM find(LessThan) 로 후보 조회 → 개별 `markQueueWaitTimeout` 호출"이라는 **read-then-act** 구조다. RUNNING 케이스의 `reclaimStuckRunningExecution` 은 스캔 자체를 원자 claim UPDATE 로 수행해 "affected=1 인 쪽만 진행" 패턴(§1.3 `_retryState` 일반화, spec 이 명시적으로 재사용 원칙으로 든 패턴)을 따르는 반면, PENDING 케이스는 스캔은 non-atomic find, 최종 전이만 원자(`markQueueWaitTimeout` 내부의 `WHERE status='pending'` 조건부 UPDATE)다.
  - 실제로는 안전하다: `markQueueWaitTimeout` 이 이미 idempotent 원자 연산(다른 인스턴스가 먼저 cancel/admit 했으면 affected=0 no-op, emit 은 affected>0 일 때만)이므로 여러 인스턴스가 동시에 같은 후보 목록을 얻어도 중복 emit 이나 이중 처리가 발생하지 않는다. 다만 "스캔=claim" 이라는 §7.4 의 기존 관용구와 다르다는 점에서 향후 독자가 "왜 이 스캔만 non-atomic find 를 쓰는가"를 되짚어야 하는 국소 비일관성이 남는다.
  - 제안: 코드 주석/spec §8 갱신 시 "PENDING 스캔은 read-only 후보 조회이며, 상태 전이의 원자성은 `markQueueWaitTimeout` 의 조건부 UPDATE 가 단독으로 보장한다(RUNNING re-claim 과 달리 스캔 단계 자체의 원자성은 불요 — cancel 은 재시도해도 idempotent)"를 한 줄 명시하면 이 설계 차이가 의도적임이 분명해진다. 규약 위반은 아니므로 BLOCK 사유 아님.

- **[INFO]** 신규 메서드명 컨벤션 정합
  - target 위치: 계획된 메서드명 `recoverOrphanPendingExecutions`
  - 관련 규약/선례: 같은 클래스의 `recoverStuckExecutions` / `reclaimStuckRunningExecution` / `failOrphanRunningNodeExecutions` 네이밍 계열(`recover<Target>Executions`, `<verb>Orphan<Target>`).
  - 상세: `recoverOrphanPendingExecutions` 는 두 선례(`recoverStuckExecutions` 의 `recover` 동사, `failOrphanRunningNodeExecutions` 의 `Orphan` 어휘)를 그대로 조합한 이름으로 기존 명명 계열과 자연스럽게 정합한다. 위반 없음 — 참고용 확인 항목.

- **[INFO]** 에러 코드 재사용의 의미 정합성
  - target 위치: `markQueueWaitTimeout` 재사용 계획, 코드 `EXECUTION_QUEUE_WAIT_TIMEOUT`
  - 관련 규약: `spec/conventions/error-codes.md` §1 "의미 기반 명명" — 코드 이름은 "무엇이 잘못되었는가"를 기술해야 하며 구현 경로(어느 트리거로 검출됐는지)를 이름에 박지 않는다.
  - 상세: `EXECUTION_QUEUE_WAIT_TIMEOUT` 의 의미("큐 대기 시간 초과")는 admission-time 검사든 부팅 backstop 스캔이든 트리거와 무관하게 동일하게 성립한다. 신규 트리거 추가를 위해 별도 코드를 신설할 필요가 없고, 오히려 신설하면 §1 원칙("구현 세부·전이적 맥락을 이름에 박지 않는다")에 어긋난다. 코드 재사용은 규약에 부합하며, `WORKER_HEARTBEAT_TIMEOUT` 이 PR3→PR4 에 걸쳐 "코드명 유지·의미 재정의 발효"로 처리된 선례와 동일 패턴이다. §3 historical-artifact 레지스트리 등재도 불필요(코드 자체가 이름·표기 모두 정확하므로 "부정확한 이름의 예외" 대상이 아님).

- **[INFO]** spec 문서 개정 시 "구현 완료" 배너 패턴 준수 필요
  - target 위치: `spec/5-system/4-execution-engine.md` §7.4/§8 예정 갱신
  - 관련 규약: 문서 내 기존 관행 — `**PR3 구현(2026-07-04)**`, `**PR2b 구현 완료**` 등 절 상단 "구현 상태" 배너(§7.1/§8 line 815, 1071)로 구현 진척을 표기.
  - 상세: 이번 PR 이 §8 line 1088 의 "orphan `pending` 회수는 후속 … 본 PR 스코프 아님" 문구를 갱신할 때, 기존 배너 스타일(`**PR<n> 구현 완료(YYYY-MM-DD)**`)과 "은퇴하지 않고 병존" 식의 backstop 관계 서술 패턴을 그대로 따라야 문서 전체 톤이 일관된다. 실제 커밋 시점에 재확인 필요 — 현재는 코드 미작성 단계라 판정 보류.
  - 제안: 구현 완료 후 §8 배너에 "PENDING 스캔 backstop 구현 완료" 를 §7.4 Recovery 절 서술과 함께 추가하고, §7.4 "Recovery (`recoverStuckExecutions`)" 절에 `recoverOrphanPendingExecutions` 가 같은 함수 내부에서 호출됨을 명시(코드 주석과 spec 양쪽 SoT 정합 유지).

발견된 항목 중 CRITICAL/WARNING 등급은 없다. 계획(`orphan-pending-backstop.md`)이 명시한 재사용 전략(`markQueueWaitTimeout` idempotent 조건부 UPDATE, 같은 lock·트리거 편승, 신규 migration/env 없음)은 기존 `spec/5-system/4-execution-engine.md` §7.4/§8 SoT 및 `spec/conventions/error-codes.md` 규약과 모두 정합한다.

## 요약

계획된 `recoverOrphanPendingExecutions` 는 spec §8 line 1088 이 명시적으로 "후속" 으로 예고해 둔 갭(orphan `pending` 스캔 확장)을 그대로 이행하는 작업이며, 신규 에러 코드·신규 명명 패턴·신규 문서 섹션 구조를 도입하지 않고 기존 `recoverStuckExecutions`/`markQueueWaitTimeout`/`EXECUTION_QUEUE_WAIT_TIMEOUT` 세 자산을 그대로 재사용한다. 메서드명은 기존 명명 계열과 자연스럽게 정합하고, 에러 코드 재사용은 error-codes.md §1 의미 기반 명명 원칙에 부합하며 historical-artifact 예외 등재도 불필요하다. 유일하게 짚을 점은 스캔 자체의 원자성 모델이 RUNNING 케이스(원자 claim UPDATE)와 다르다는 것인데, 최종 상태 전이가 이미 idempotent 원자 연산(`markQueueWaitTimeout`)이므로 안전성에 실질적 결함은 없다 — 문서/주석으로 그 설계 차이를 명시하면 충분한 INFO 수준 제안이다. 정식 규약 위반(CRITICAL/WARNING)은 발견되지 않았다.

## 위험도

NONE

BLOCK: NO
