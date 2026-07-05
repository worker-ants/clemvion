# 신규 식별자 충돌 검토 — naming_collision

## 사전 확인: payload 스코프 이상

`_prompts/naming_collision.md` 는 `spec/5-system/` 전체를 대상 영역으로 선언했으나, 번들된 전체 섹션은
`spec/5-system/1-auth.md`, `spec/5-system/10-graph-rag.md` 두 개뿐이며 실제 이번 작업(target)의
SoT 인 **`spec/5-system/4-execution-engine.md` 는 본문이 번들되지 않았다** (다른 문서에서의 교차 링크
텍스트만 파편적으로 등장 — 예: `EXECUTION_MAX_ACTIVE_RUNNING_MS`, `§8 동시 실행 제한` 등이 `0-overview.md`/
`1-data-model.md` 인용 문맥에서만 나타남). 이는 과거 기록된 "impl-done spec bundle bug"(prompt 가 target
spec 본문을 못 실어 새 요구사항 ID 오탐 유발)와 동일한 payload 구성 결함이다.

→ payload 만으로는 이번 relocate 작업(`resolveExecutionRunWorkerConcurrency` /
`DEFAULT_EXECUTION_RUN_WORKER_CONCURRENCY` → `execution-limits.ts` 이동, `resolveContinuationWorkerConcurrency`
재사용)을 제대로 검증할 수 없어 **실제 레포(worktree 워킹 트리)를 직접 읽어 교차검증**했다. 아래 발견사항은 그
직접 확인 결과에 기반한다.

## 실제 레포 확인 내역

- `codebase/backend/src/modules/execution-engine/execution-limits.ts` 기존 export 전체:
  - `DEFAULT_MAX_ACTIVE_RUNNING_MS`, `resolveMaxActiveRunningMs`
  - `DEFAULT_WORKSPACE_MAX_CONCURRENT_EXECUTIONS`, `DEFAULT_WORKFLOW_MAX_CONCURRENT_EXECUTIONS`, `resolveConcurrencyCap`
  - `DEFAULT_QUEUE_WAIT_TIMEOUT_MS`, `EXECUTION_ADMISSION_RETRY_DELAY_MS`, `resolveQueueWaitTimeoutMs`
- 이동 대상 식별자의 현재 위치:
  - `DEFAULT_EXECUTION_RUN_WORKER_CONCURRENCY` / `resolveExecutionRunWorkerConcurrency`
    — `codebase/backend/src/modules/execution-engine/queues/execution-run.queue.ts` (라인 100, 109)
  - `resolveContinuationWorkerConcurrency` / `DEFAULT_CONTINUATION_WORKER_CONCURRENCY`
    — `codebase/backend/src/modules/execution-engine/queues/continuation-execution.queue.ts` (라인 57, 70) — **이동 대상 아님, 재사용만**
- spec SoT: `spec/5-system/4-execution-engine.md` §11 ENV 표(라인 ~1240-1247) 에 `CONTINUATION_WORKER_CONCURRENCY`,
  `EXECUTION_RUN_WORKER_CONCURRENCY`, `EXECUTION_MAX_ACTIVE_RUNNING_MS` 가 이미 정의되어 있고, 함수명
  `resolveExecutionRunWorkerConcurrency`/`resolveMaxActiveRunningMs` 도 이 표에서 그대로 언급된다 — 즉 두
  식별자 모두 **이미 spec 에 등록된 기존 이름**이며, 이번 계획은 새 이름을 도입하는 것이 아니라 **동일 이름을
  다른 모듈 파일로 재배치**하는 것으로 확인된다.

## 발견사항

- **[INFO]** 신규 식별자 없음 — 순수 재배치(rename 없는 relocate)
  - target 신규 식별자: 없음. `resolveExecutionRunWorkerConcurrency`, `DEFAULT_EXECUTION_RUN_WORKER_CONCURRENCY` 는
    이름 변경 없이 `execution-run.queue.ts` → `execution-limits.ts` 로 위치만 이동, `resolveContinuationWorkerConcurrency`
    는 `continuation-execution.queue.ts` 에 그대로 두고 `execution-limits.ts` 에서 import 재사용
  - 기존 사용처: `execution-limits.ts` 라인 9-90 (기존 5개 export), `execution-run.queue.ts` 라인 92-120
    (`EXECUTION_RUN_MAX_STALLED_COUNT`, `EXECUTION_RUN_STALLED_INTERVAL_MS` 는 이동 대상에서 제외 — 이동 대상과
    인접해 있으니 이동 시 실수로 같이 옮기지 않도록 주의)
  - 상세: `execution-limits.ts` 의 현재 export 목록(`resolveMaxActiveRunningMs`, `resolveConcurrencyCap`,
    `resolveQueueWaitTimeoutMs` 등)과 이동해 오는 `resolveExecutionRunWorkerConcurrency`/
    `DEFAULT_EXECUTION_RUN_WORKER_CONCURRENCY` 사이에 이름 충돌은 없다. 함수명 접두사(`resolve*`)와 상수명
    접두사(`DEFAULT_*`)의 명명 패턴도 동일 컨벤션이라 합류 후에도 시각적 일관성 유지
  - 제안: 없음(충돌 없음). 다만 이동 후 `execution-run.queue.ts`, `system-status.constants.ts`,
    `execution-run.processor.ts`, `execution-run.queue.spec.ts` 등 기존 import 구문(`from
    './execution-limits'` 상대경로 vs `from './queues/execution-run.queue'`)을 전부 갱신해야 함 — 이는
    식별자 충돌이 아닌 구현 단계 import-path 갱신 작업이므로 developer 단계 체크리스트로 넘김

- **[INFO]** payload 스코프 결함 (검토 프로세스 자체에 대한 제언)
  - target 신규 식별자: 해당 없음(프로세스 이슈)
  - 기존 사용처: `_prompts/naming_collision.md` 자체
  - 상세: `--impl-prep` 모드로 `spec/5-system/` 전체를 대상 선언했음에도 실제 변경 대상 SoT 문서인
    `4-execution-engine.md` 본문이 번들에서 누락됨(1-auth.md, 10-graph-rag.md 만 전체 포함). orchestrator
    prompt 생성 로직의 파일 선택/번들링 단계 점검 필요
  - 제안: 이번 건은 실제 레포 직접 조회로 대체 검증했으므로 차단 사유 아님. 다만 향후 동일 패턴 재발 방지를
    위해 payload 생성 스크립트가 target 영역의 전체 파일 목록과 실제 번들된 섹션 헤더 수를 일치 검증하도록 보강 권장

## 요약

계획은 `resolveExecutionRunWorkerConcurrency`/`DEFAULT_EXECUTION_RUN_WORKER_CONCURRENCY` 를 이름 변경 없이
`execution-run.queue.ts` 에서 `execution-limits.ts` 로 재배치하고 `resolveContinuationWorkerConcurrency` 는
그대로 재사용하는 것으로, 신규 식별자를 전혀 도입하지 않는다. `execution-limits.ts` 의 기존 5개 export
(`resolveMaxActiveRunningMs`, `resolveConcurrencyCap`, `resolveQueueWaitTimeoutMs` 및 관련 `DEFAULT_*`/
`*_MS` 상수)와 이동해 올 2개 식별자 사이에 이름 충돌은 없음을 실제 코드(execution-limits.ts, execution-run.queue.ts,
continuation-execution.queue.ts) 와 spec SoT(4-execution-engine.md §11 ENV 표) 직접 대조로 확인했다.
prompt payload 자체는 target 영역(`spec/5-system/`)의 실제 SoT 문서(`4-execution-engine.md`)를 번들에서
누락시키는 스코프 결함이 있었으나, 실제 레포 조회로 우회 검증을 완료해 이 결함이 결론에 영향을 주지 않는다.

## 위험도

NONE

BLOCK: NO
STATUS: SUCCESS
