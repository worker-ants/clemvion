# 신규 식별자 충돌 검토 — orphan pending backstop (`recoverOrphanPendingExecutions`)

## 검토 대상

- 신규 method: `recoverOrphanPendingExecutions()` — `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 에 추가 예정 (plan: `plan/in-progress/orphan-pending-backstop.md`)
- 검토 모드: `--impl-prep` (scope=`spec/5-system/`)
- 목적: `recoverStuckExecutions` 안에서 running 회수 뒤 호출되어, queue-wait timeout 을 이미 초과한 orphan `pending` Execution 을 `markQueueWaitTimeout` 재사용으로 회수(cancel)한다.

## 발견사항

- **[INFO]** 신규 메서드명과 기존 이웃 메서드명 비교 — 명명 일관성 양호, 실질 충돌 없음
  - target 신규 식별자: `recoverOrphanPendingExecutions`
  - 기존 사용처:
    - `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2807` — `private async recoverStuckExecutions(): Promise<void>` (부팅 backstop, RUNNING 대상 재구동 트리거)
    - `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2863` — `private async reclaimStuckRunningExecution(staleThreshold: Date): Promise<string[]>` (RUNNING row 원자 re-claim, `recoverStuckExecutions` 내부에서 호출)
  - 상세: 저장소 전체(`codebase/`, `spec/`, `plan/`)에 `recoverOrphanPendingExecutions` 문자열은 오직 plan 파일(`plan/in-progress/orphan-pending-backstop.md:22,28`)에만 등장 — 코드·spec 상 동일/유사 식별자가 이미 다른 의미로 쓰이고 있지 않음(grep 확인, 0 hit in codebase/spec). 명명 패턴은 기존 계열과 정합적이다:
      - `recoverStuckExecutions` (RUNNING 스캔·트리거) ↔ `recoverOrphanPendingExecutions` (PENDING 스캔·트리거) — "recover + 대상상태 + Executions" 패턴 유지, 병렬 구조로 오독 가능성 낮음.
      - `reclaimStuckRunningExecution` (단수, RUNNING row 원자 UPDATE 헬퍼, `recoverStuckExecutions` 내부 private helper) — plan 은 신규 메서드 자체를 `recoverStuckExecutions` 안에서 직접 호출(`markQueueWaitTimeout` 재사용)하는 구조로 설계했고, `reclaimStuckRunningExecution` 처럼 별도 "reclaim" 단수 헬퍼를 도입하지 않는다. 명명 계층(recover=상위 스캔/트리거, reclaim=원자 claim 서브루틴)과 어긋나지 않음.
      - 이미 "orphan" 어휘가 코드에 한 곳 더 존재한다: `failOrphanRunningNodeExecutions`(`execution-engine.service.ts:2890`, **NodeExecution** RUNNING orphan row 를 FAILED 로 마감 — 대상 엔티티·상태가 다름: NodeExecution/RUNNING vs Execution/PENDING). 의미가 명확히 분리되어 있어 혼동 위험은 낮으나(제안 참고), 두 "orphan *" 메서드가 같은 클래스에 공존하게 되므로 JSDoc 첫 줄에서 서로를 상호 참조해 두면 향후 유지보수자의 오독을 방지할 수 있다.
  - 제안: 변경 불필요(현 계획대로 진행 가능). 선택적 보완: `recoverOrphanPendingExecutions` JSDoc 에 "`failOrphanRunningNodeExecutions`(NodeExecution 대상)와는 별개 — 본 메서드는 Execution/PENDING 대상"이라는 1줄 각주를 추가하면 두 "orphan" 계열 메서드의 스코프 차이가 코드 레벨에서도 즉시 드러난다(선택, 차단 아님).

- **[INFO]** 에러 코드/ENV 재사용 — 신규 도입 없음, 기존 정의와 완전 일치
  - target 신규 식별자: (해당 없음 — 신규 코드/ENV 미도입)
  - 기존 사용처: `spec/5-system/4-execution-engine.md:1087` (`EXECUTION_QUEUE_WAIT_TIMEOUT`, PR2b 구현 완료), `execution-engine.service.ts:2559-2602` (`markQueueWaitTimeout` 구현체, `code = 'EXECUTION_QUEUE_WAIT_TIMEOUT'`)
  - 상세: plan 결정 2가 명시한 대로 신규 메서드는 기존 `markQueueWaitTimeout(id)`를 그대로 재사용하며 새 error code/ENV 를 만들지 않는다. 코드베이스 검증 결과 `markQueueWaitTimeout`은 `WHERE status='pending'` 조건부 UPDATE로 admit/cancel race 에 멱등하고, `EXECUTION_CANCELLED`/`cancelledBy='timeout'`/`EXECUTION_QUEUE_WAIT_TIMEOUT`/routing release 를 그대로 emit — 신규 payload 필드나 신규 이벤트명 도입 없음. 충돌 없음.
  - 제안: 없음 (계획대로 진행).

- **[INFO]** 파일 경로 — 신규 파일 없음
  - target 신규 식별자: (해당 없음)
  - 기존 사용처: `spec/5-system/4-execution-engine.md` (§7.4/§8 수정 예정, 기존 파일)
  - 상세: plan 은 기존 `execution-engine.service.ts`/`execution-engine.service.spec.ts`/`spec/5-system/4-execution-engine.md`만 수정하며 신규 spec 파일·신규 migration·신규 config key 를 만들지 않는다(plan 체크리스트 "신규 migration/env 없음"과 일치). 파일 경로 충돌 없음.
  - 제안: 없음.

## 요약

신규 메서드 `recoverOrphanPendingExecutions`는 저장소 전체(코드·spec·plan)에서 계획 문서 외 다른 곳에 등장하지 않아 요구사항 ID·엔티티명·API endpoint·이벤트명·ENV/설정키·파일 경로 어느 관점에서도 실질 충돌(CRITICAL/WARNING)이 없다. 이웃 메서드 `recoverStuckExecutions`/`reclaimStuckRunningExecution`과의 명명 계층(상위 스캔-트리거 vs 원자 claim 서브루틴)도 일관되게 유지되며, 기존에 이미 존재하는 "orphan" 어휘 사용처(`failOrphanRunningNodeExecutions`, NodeExecution 대상)와도 대상 엔티티·상태가 명확히 달라 혼동 소지가 작다. 에러 코드(`EXECUTION_QUEUE_WAIT_TIMEOUT`)·헬퍼(`markQueueWaitTimeout`) 재사용 계획도 기존 정의와 정확히 일치해 신규 도입에 따른 충돌이 없다. 발견된 두 건은 모두 INFO(선택적 문서 보완 제안)로, 구현 착수를 막을 사유가 없다.

## 위험도

NONE

---

BLOCK: NO

STATUS: SUCCESS
