# 요구사항(Requirement) Review — linear-cancel-mechanism

## 맥락 요약

`spec/conventions/node-cancellation.md:140`("dispatch 사전 abort 체크 ✓")과 `:60`("stop 이 실행을
중단")이 선형 경로에서 사실이 아니었다(하류 노드가 그대로 dispatch)는 실측을 근거로, 본 변경은
`assertExecutionNotCancelled()`를 3개 순회 루프(`runExecution` · `runNodeDispatchLoop` ·
`executeInline`) 경계에 추가해 문제를 "결정적으로 고정"했다고 plan에 기록했다. 코드베이스를 직접
열어 확인한 결과, **선형 3-노드 그래프에 한해서는** 이 주장이 맞다. 그러나 (1) 세 guard 지점 중
하나(`executeInline`)는 유일한 호출자가 예외를 흡수해버려 실제로는 작동하지 않고, (2) 새 JSDoc이
명시한 "stop이 쓴 finishedAt/durationMs 보존" 주장은 실제 코드와 모순되며, (3) ForEach/Loop/Map/
Parallel 컨테이너 내부 dispatch는 이번 fix의 적용 범위 밖에 있다 — 즉 "Stop 버튼이 부수효과까지
멈추게 한다"는 이번 PR의 핵심 주장이 최소 세 가지 경로에서 아직 거짓이다.

## 발견사항

### [CRITICAL] `executeInline` guard가 유일한 호출자(Sub-Workflow 핸들러)에서 흡수되어 무력화된다

- 위치:
  - `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:3729` (신설 guard 호출 — 프롬프트 diff 게이트 `3729`와 일치)
  - `codebase/backend/src/nodes/flow/workflow/workflow.handler.ts:177-187` (executeInline의 유일한 호출자, catch 블록)
  - `codebase/backend/src/nodes/flow/workflow/workflow.handler.ts:252-291` (`mapSubWorkflowError`)
  - `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:5859-5870` (error 포트 라우팅 결과 처리)
- 상세: `executeInline`은 `codebase/backend/src/nodes/flow/workflow/workflow.handler.ts`(Sub-Workflow
  노드, sync/inline 모드)에서만 호출된다. 그 호출부의 catch는 `ParkReleaseSignal`만 특별 취급해
  re-throw하고, 그 외 **모든 예외**(신설된 `ExecutionCancelledError` 포함)는
  `buildSubWorkflowError()`로 감싸 **정상 반환값**(`{ port: 'error', output: {...} }`)으로
  바꿔버린다. `mapSubWorkflowError()`는 `WorkflowNotFoundError`/`SubWorkflowTimeoutError`/
  `WorkflowForbiddenWorkspaceError` instanceof 분기와 메시지 substring(`'workflow not found'`,
  `'timed out'`, `'queue'+...`, `'workflow_forbidden_workspace'`)만 인식하고
  `ExecutionCancelledError`(message: `Execution ${id} cancelled externally`)는 아무 분기에도
  안 걸려 `SUB_WORKFLOW_FAILED`로 떨어진다.
  결과적으로 handler.execute()는 **throw가 아니라 정상 resolve**하고, 엔진의 `executeNode`는
  이를 일반 error-port 라우팅으로 처리한다(`execution-engine.service.ts:5859-5870`):
  - error 포트에 엣지가 연결돼 있으면 → **부모 그래프의 dispatch가 계속 진행**된다. 즉
    "취소 후에도 하류 노드가 dispatch된다"는, 이번 PR이 고쳤다고 주장하는 바로 그 버그가
    Sub-Workflow 노드 뒤에서 재현된다.
  - 엣지가 없으면 → `ErrorPortFallbackError`가 던져져 위쪽 catch(`finalizeFailedExecution`)로
    가고 Execution이 `cancelled`가 아니라 **`failed`**로 마감된다 — spec §5.1
    ("AbortError → failed 아닌 cancelled")·§1.2 상태 전이 계약 위반.
  - `workflow.handler.spec.ts`에는 `ParkReleaseSignal` re-throw를 검증하는 전용 describe가
    있지만(`execute - ParkReleaseSignal re-throw`), `ExecutionCancelledError`/`AbortError`에
    대한 동등한 테스트는 없다 — 이 gap이 그대로 미검증 상태로 남아 있다.
- 제안: `workflow.handler.ts`의 catch에서 `ParkReleaseSignal`과 동일하게
  `err instanceof ExecutionCancelledError`(및 기존 `isAbortError(err)`)도 re-throw하도록
  분기를 추가한다. 이후 workflow.handler.spec.ts에 "executeInline이 ExecutionCancelledError를
  던지면 error 포트로 흡수되지 않고 re-throw된다" 테스트를 `ParkReleaseSignal` 선례와 대칭으로
  추가할 것. 이 수정 없이는 plan 체크리스트의 "3곳 모두 결정적으로 고정" 주장이 사실이 아니다.

### [CRITICAL] 신설 JSDoc의 "stop이 쓴 finishedAt/durationMs가 보존된다" 주장이 실제 코드와 모순된다

- 위치:
  - `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:7792-7795` (신설 JSDoc — 프롬프트 diff 게이트 `7792`~`7795`)
  - `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:4504-4517` (`runExecution`의 catch, 기존 코드 — 실 파일 확인)
  - `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2619-2631` (`finalizeResumedExecutionOutcome`, 기존 코드 — 실 파일 확인)
  - 대조 선례: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:7941-7950` (`updateExecutionStatus`의 M-3 guarded UPDATE — "stale entity가 동시 전이를 덮어쓰는" 동일 클래스 문제를 이미 인지·해결한 코드)
- 상세: 신설 `assertExecutionNotCancelled`의 JSDoc은 "이미 terminal인 행을 다시 마킹하지
  않으므로 stop이 쓴 `finishedAt`/`durationMs`가 보존된다"고 명시한다. 그러나 이 함수가 throw한
  `ExecutionCancelledError`를 실제로 받는 두 catch 지점(`runExecution` 자체 catch, resume
  경로의 `finalizeResumedExecutionOutcome`)은 둘 다 **"이미 terminal인지" 확인 없이** 무조건
  다음을 수행한다:
  ```
  savedExecution.status = ExecutionStatus.CANCELLED;
  savedExecution.finishedAt = new Date();          // ← stop()이 쓴 원래 시각을 덮어씀
  savedExecution.durationMs = finishedAt - startedAt; // ← 재계산되어 부풀려짐
  await this.executionRepository.save(savedExecution);
  ```
  `stop()`(`executions.service.ts:774-792`)은 `status/finishedAt/durationMs` 3컬럼만 원자
  UPDATE로 쓰지만, 위 catch는 루프가 들고 있던 **stale 인메모리 `savedExecution`**을 그대로
  `.save()`한다 — 정확히 `updateExecutionStatus`의 M-3 주석이 "stale entity의 모든 컬럼을
  덮어써 동시 cancel/park 전이를 잃어버리는 lost-update 위험"이라고 명명한 바로 그 문제 클래스다.
  이 catch 경로는 원래 "park 대기 중 취소"(행이 아직 CANCELLED로 마킹되지 않은 최초 시점) 전용으로
  안전했으나, 이번 PR이 추가한 새 guard 때문에 **행이 이미 CANCELLED인 상태에서** 처음으로
  도달 가능해졌다. 결과: 사용자가 Stop을 누른 실제 시각이 아니라, 엔진이 다음 노드 경계에서
  취소를 알아챈(더 늦은) 시각이 `finishedAt`으로 기록되고 `durationMs`가 부풀려진다. 신설 테스트
  (`선형 경로 외부 cancel 전파` describe)는 `mockHandler.execute` 호출 횟수만 검증하고
  `finishedAt`/`durationMs` 보존 여부는 검증하지 않아 이 모순이 그대로 통과했다.
- 제안: 두 catch 지점을 `updateExecutionStatus`의 guarded-UPDATE 패턴(또는 최소한 `execution
  Repository.findOneBy`로 재조회해 이미 CANCELLED면 `finishedAt`/`durationMs` 재기록을 skip)으로
  바꾸거나, JSDoc의 "보존된다" 문구를 실제 동작에 맞게 정정할 것. 전자를 권장 — 사용자에게
  노출되는 타임스탬프 정확성 문제이므로.

### [CRITICAL] ForEach/Loop/Map/Parallel 컨테이너 내부 dispatch는 이번 fix의 적용 범위 밖 — 동일 버그가 그대로 재현된다

- 위치:
  - `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:6429-6539` (`executeContainerBody` — ForEach/Loop/Map 바디, `assertExecutionNotCancelled` 미호출)
  - `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:7051-7130` (`executeParallelBranchBody` — Parallel 분기 바디, 동일)
  - `codebase/backend/src/modules/execution-engine/containers/foreach-executor.ts:73-108` (`ForEachExecutor.execute` — 반복 사이 취소 체크 없음)
  - `codebase/backend/src/modules/execution-engine/containers/loop-executor.ts` (`LoopExecutor.execute` — 동일)
  - `plan/in-progress/node-cancellation-residual-signal-propagation.md` 게이트 `73`~`89` ("선형 경로 cancel 전파의 기전 규명 + 결정적 고정 — 2026-07-26 완료" 체크 항목)
- 상세: `assertExecutionNotCancelled`는 top-level `while (pointer < sortedNodeIds.length)` 루프
  3곳에만 삽입됐다(실측: 파일 전체에서 `while (pointer`는 정확히 이 3곳뿐). 그러나 ForEach/Loop/Map
  컨테이너는 자신의 body를 `executeContainerBody`(`for (const nodeId of sortedNodeIds)`)로,
  Parallel 분기는 `executeParallelBranchBody`(동일한 `for` 패턴)로 각각 별도 순회하며, 두 함수
  모두 반복마다 `executeNode`를 직접 호출할 뿐 `assertExecutionNotCancelled`를 호출하지 않는다.
  `ForEachExecutor.execute`/`LoopExecutor.execute` 자체 반복 루프에도 취소 체크가 없다. 즉
  ForEach가 1,000개 항목을 순회 중이거나 Parallel 분기가 여러 노드를 실행 중일 때 외부에서
  Stop을 눌러도, 그 컨테이너의 **현재 top-level 노드 dispatch가 끝날 때까지**(=컨테이너 전체가
  끝날 때까지) 이메일 발송·HTTP POST·DB 쓰기가 계속된다 — 이번 PR의 JSDoc이 "이 가드가 없던
  동안" 벌어졌다고 설명한 바로 그 부수효과 버그가, ForEach/Loop/Map/Parallel을 쓰는 워크플로에서는
  여전히 벌어진다.
  plan 체크리스트는 이 항목을 "선형 경로"로 명시적으로 스코프했지만, 완료 서술 자체("기전은
  존재하지 않았다(진짜 결함)... Stop 버튼이 부수효과까지 멈추게 한다")와 code JSDoc("이 가드가
  없던 동안 Stop 버튼은... 부수효과를 멈추지 못했다")은 스코프 한정 없이 절대적으로 서술되어,
  컨테이너/Parallel 워크플로에 대해서는 오도의 소지가 있다. 신설 unit test·e2e test 모두 순수
  선형 3-노드 그래프만 사용해 이 gap을 검증하지 않는다.
- 제안: (a) 최소한 `executeContainerBody`/`executeParallelBranchBody`의 반복마다
  `assertExecutionNotCancelled` 호출을 추가해 커버리지를 넓히거나, (b) 지금 범위로 유지한다면
  plan 체크리스트·spec 양쪽에 "컨테이너 내부/Parallel 분기 내부는 미적용 — 다음 top-level 노드
  경계에서만 관측" 이라는 명시적 잔여 스코프를 남길 것(현재는 미언급). 완료 라벨을 그대로 두면
  §6 표(구현 현황)와 실제 동작의 괴리가 재발한다 — 이 프로젝트가 이미 한 차례 겪은 문제(라벨/본문
  불일치, 2026-07-24 grooming)와 동일 패턴이다.

### [WARNING] `spec/conventions/node-cancellation.md`의 `:60`/`:140` 서술이 이번 fix 이후에도 완전히는 참이 아니다

- 위치: `spec/conventions/node-cancellation.md:60`, `:140` (이번 diff에 포함되지 않음 — 참조용)
- 상세: 두 줄은 각각 "stop이 실행을 중단"·"dispatch 사전 abort 체크 ✓"를 조건 없이 서술한다.
  위 세 CRITICAL 발견사항(Sub-Workflow 흡수, finishedAt 보존 실패, 컨테이너/Parallel 미적용)이
  해소되기 전까지는 이 서술이 전면적으로 참이 아니다. spec 자체가 코드보다 앞서 나간 것(=코드가
  더 발전된 SPEC-DRIFT)이 아니라, **spec과 plan 양쪽이 실제 구현보다 낙관적으로 서술**된
  경우이므로 SPEC-DRIFT로 분류하지 않는다. 이 문서는 이번 리뷰 대상 diff에 포함되지 않았으므로
  reviewer가 직접 수정하지 않되, 위 CRITICAL findings 해소 작업과 함께 `project-planner`가 문구를
  정정(또는 잔여 스코프를 명시)해야 한다.
- 제안: 위 CRITICAL 3건을 해결한 뒤, 여전히 컨테이너/Parallel 범위를 의도적으로 남겨둔다면
  §2.3·§6 표에 "노드 경계"의 정의를 "top-level dispatch loop 경계만(컨테이너/Parallel 분기 내부
  제외)"로 명시할 것.

### [INFO] `assertExecutionNotCancelled`의 DB 조회 실패 경로가 테스트되지 않음

- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:7796-7807`(`assertExecutionNotCancelled` 함수 본문 — 프롬프트 diff 게이트 `7796`~`7807`)
- 상세: `this.executionRepository.findOneBy(...)`가 reject하면(일시적 DB 장애 등) 그 원시
  에러가 그대로 dispatch loop 밖으로 전파되어 `finalizeFailedExecution` 경로로 `failed` 종결된다.
  Fail-closed 방향이라 안전 쪽으로 치우치지만, 의도된 동작인지 문서화·테스트가 없다.
- 제안: 필수는 아니나, 원한다면 "DB 조회 실패 시 execution은 failed로 종결(취소 재시도 없음)"을
  JSDoc 한 줄로 명시하고 회귀 테스트를 추가하면 향후 논쟁을 줄일 수 있다.

## 긍정적으로 확인된 부분 (참고)

- 선형 3-노드 그래프에 대해서는 신설 engine unit test(`선형 경로 외부 cancel 전파` describe)가
  `assertExecutionNotCancelled`의 핵심 동작(노드 1 실행 후 CANCELLED 관측 시 노드 2/3 미dispatch)을
  정확히 고정한다 — mock 시점(calls===1 이후 findOneBy override)이 검증 대상과 정확히 대응한다.
- e2e(`node-cancellation-propagation.e2e-spec.ts`)의 관측 시점 수정(4-pre 블록, 노드 A가 실제
  terminal에 도달한 뒤에 하류를 판정)은 "가드가 없어도 통과하던" 원래 취약점을 정확히 짚어 고쳤다.
- `ExecutionCancelledError` 생성자에 선택적 `message` 파라미터를 추가한 하위 호환 방식(기본값
  보존)은 기존 park-cancel 경로를 깨지 않는다 — 이 부분 자체는 안전하다.

## 요약

선형(비-container, 비-Sub-Workflow) 경로에 한해서는 이번 변경이 실제로 spec의 "stop이 하류 dispatch를
막는다" 약속을 이행하며, 회귀 테스트도 그 범위에서는 견고하다. 그러나 (1) 이 PR이 명시적으로
고쳤다고 주장하는 3개 guard 지점 중 `executeInline`(Sub-Workflow)은 유일한 호출자의 error-port
흡수 로직 때문에 실제로는 작동하지 않아 그 경로에서 원래 버그가 그대로 재현되고, (2) 신설 JSDoc이
보장한다고 명시한 "stop이 쓴 finishedAt/durationMs 보존"은 실제 catch 코드와 정면으로 모순되며,
(3) ForEach/Loop/Map/Parallel 컨테이너 내부 dispatch는 애초에 이번 fix의 적용 범위 밖이라 동일한
부수효과 버그가 여전히 존재한다. 세 가지 모두 plan의 "완료" 라벨과 코드 주석의 절대적 서술에
가려져 있고, 신설 테스트(엔진 unit·e2e 모두 순수 선형 그래프만 사용)로는 검증되지 않는다. spec
`:60`/`:140` 서술도 같은 이유로 아직 전면적으로는 참이 아니다 — 코드가 spec을 앞서간 것이 아니라
양쪽 모두 실제 구현 범위보다 낙관적으로 서술된 경우이므로 SPEC-DRIFT가 아니라 잔여 결함으로
분류한다.

## 위험도

CRITICAL
