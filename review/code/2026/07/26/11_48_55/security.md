# 보안(Security) Review

## 발견사항

- **[WARNING]** `executeInline` 경로의 신규 취소 가드가 Sub-Workflow 노드 핸들러의 범용 catch 에 흡수되어, "Stop 이후에도 부수효과가 계속된다"는 이번 PR이 고치려던 바로 그 취약점 클래스가 Sub-Workflow 노드에 대해서만 부분적으로 재현된다.
  - 위치:
    - `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:3729` — `executeInline` 의 dispatch while-loop 안에 `await this.assertExecutionNotCancelled(executionId)` 신규 추가 (게이트 3729, diff 파일 2).
    - `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:7796-7807` — `assertExecutionNotCancelled` 정의. CANCELLED 감지 시 `ExecutionCancelledError` throw (게이트 7796-7807, diff 파일 2).
    - `codebase/backend/src/modules/execution-engine/workflow-errors.ts:314-325` — `ExecutionCancelledError` 클래스 JSDoc: `@internal — execution-engine 모듈 내부 cancel 전파 전용 sentinel. 모듈 외부 직접 참조 금지.` (게이트 314-325, diff 파일 3).
    - `codebase/backend/src/nodes/flow/workflow/workflow.handler.ts:177-186` — `executeInline` 호출을 감싸는 catch. `ParkReleaseSignal` 만 특별 취급해 재throw 하고, 그 외 모든 예외(신규 `ExecutionCancelledError` 포함)는 `buildSubWorkflowError(configEcho, err)` 로 흡수된다. (본 파일은 이번 diff 에 포함되지 않아 실제 소스를 직접 열어 확인한 실 파일 줄번호.)
    - `codebase/backend/src/nodes/flow/workflow/workflow.handler.ts:200-231` — `buildSubWorkflowError`: `err.message` 를 그대로 `truncateForErrorDetails` 해 `output.error.message` 로 client-visible 노드 출력에 싣는다.
    - `codebase/backend/src/nodes/flow/workflow/workflow.handler.ts:252-292` — `mapSubWorkflowError`: `WorkflowNotFoundError`/`SubWorkflowTimeoutError`/`WorkflowForbiddenWorkspaceError` 만 typed 분기가 있고 `ExecutionCancelledError` 분기가 없다 → 메시지도 `'cancelled'` 토큰을 안 봐서 결국 generic `SUB_WORKFLOW_FAILED` 로 떨어진다.
  - 상세:
    실제로 `grep -n "new ExecutionCancelledError" codebase/backend/src` 로 확인하면 이번 PR의 `assertExecutionNotCancelled` (execution-engine.service.ts:7804) 가 **프로덕션 코드에서 이 클래스를 던지는 유일한 지점**이다. 즉 `ExecutionCancelledError` 를 `instanceof` 로 받아 CANCELLED 로 정확히 마감하는 기존 catch 들(`execution-engine.service.ts:2619`, `:4504` 등, `runExecution`/`finalizeResumedExecutionOutcome` 자체 catch)은 지금까지 사실상 죽은 코드였고, 이번 PR이 처음으로 그것을 살아있게 만들었다.
    그런데 `executeInline` 은 `runExecution`/`runNodeDispatchLoop` 와 달리 **노드 핸들러(`workflow.handler.ts`)의 동기 호출 안에서** 실행된다. `assertExecutionNotCancelled` 가 `executeInline` 내부 while-loop 에서 throw 하면, 그 예외는 상위 dispatch loop 의 catch 로 곧장 가지 않고 먼저 `workflow.handler.ts:177` 의 catch 를 거친다. 거기서 `ParkReleaseSignal` 만 재throw 되고 나머지는 전부 `buildSubWorkflowError` 로 변환되어 **`NodeHandlerOutput` (throw 아님, 정상 반환값)** 이 된다. 결과적으로:
      1. **부수효과 재발**: 이 Sub-Workflow 노드의 `error` 포트가 하류 에러-핸들링 브랜치에 연결돼 있으면, 외부 cancel(Stop) 이후에도 그 브랜치의 다음 노드가 정상적으로 dispatch 된다 — 이메일/HTTP POST/DB 쓰기 등, 바로 이 PR의 JSDoc(execution-engine.service.ts:7780-7785)이 "Stop 버튼이 부수효과를 못 멈추던 버그"로 지목한 것과 동일한 결과 클래스가 이 경로에서 재현된다. (전파는 무한이 아니라 1홉으로 유계 — 그 다음 노드 dispatch 시점엔 outer loop 의 `assertExecutionNotCancelled` 가 다시 걸려 멈춘다. 그러나 그 1홉 동안의 부수효과는 이미 발생한다.)
      2. **분류 오류**: 실행/노드가 `cancelled` 가 아니라 `SUB_WORKFLOW_FAILED`(`ErrorCode.SUB_WORKFLOW_FAILED`) 로 남는다 — 정상적인 사용자 Stop 요청이 "sub-workflow 실행 실패"로 오분류된다. `error`-port 엣지가 없으면 spec §3.2 ERROR_PORT_FALLBACK 폴백이 걸려 최종적으로는 실행이 멎지만, 상태/코드가 틀려 알림·자동화가 오작동할 수 있다.
      3. **정보 노출 계약 위반**: `ExecutionCancelledError` 는 클래스 자체 JSDoc 에 "모듈 외부 직접 참조 금지"라고 명시돼 있고, `workflow-errors.ts` 의 이웃 클래스들(`InvalidExecutionStateError`, `RetryLastTurnError`, `ExecutionTimeLimitError`)은 하나같이 "client 노출 메시지는 내부 식별자를 담지 않는 고정 문자열, 수치/식별자는 `serverDetail`/전용 필드로 분리"라는 명시적 보안 정책을 갖고 있다. 반면 신규 `assertExecutionNotCancelled` 가 만드는 메시지 `Execution ${executionId} cancelled externally` 는 executionId 를 그대로 문자열에 박아 넣고, `executeInline` 경로를 타면 그 문자열이 그대로 `output.error.message` 로 client 에 노출된다 (같은 workspace 사용자 본인의 executionId 라 크로스테넌트 유출은 아니지만, 파일 전체가 지켜온 "내부 식별자 미노출" 규약을 이 신규 코드만 어긴다).
    회귀 테스트도 이 경로를 덮지 못한다 — 신규 유닛 테스트(`execution-engine.service.spec.ts` "선형 경로 외부 cancel 전파")는 제목 그대로 `runExecution` 의 단일 선형 그래프만 검증하고, `executeInline`/Sub-Workflow 조합은 다루지 않는다. `workflow.handler.spec.ts` 도 `mapSubWorkflowError`/`buildSubWorkflowError` 분기 표에 `ExecutionCancelledError` 케이스가 없다(`ParkReleaseSignal` 만 특별 케이스로 테스트됨, workflow.handler.ts:697-725 부근).
  - 제안:
    `workflow.handler.ts` 의 두 `executeInline`/async 진입 catch(177, 126) 에 `ParkReleaseSignal` 특별취급과 나란히 `if (err instanceof ExecutionCancelledError) throw err;` 를 추가해, 취소 신호가 상위 dispatch loop 의 정식 CANCELLED 종결 경로로 전파되도록 한다(그 상위 loop 는 이미 `instanceof ExecutionCancelledError` 를 올바르게 처리하는 catch 를 갖고 있다 — execution-engine.service.ts:2619, :4504). 아울러 "Sub-Workflow 노드 실행 중 부모 Execution 이 외부 cancel 되면 SUB_WORKFLOW_FAILED 가 아니라 CANCELLED 로 확정되고 error-port 하류가 dispatch 되지 않는다"를 고정하는 회귀 테스트(`workflow.handler.spec.ts` 또는 엔진 spec)를 추가할 것을 권장한다.

- **[INFO]** 신규 취소 가드의 커버리지가 `runExecution` 단일 선형 경로로만 회귀 고정되어 있어, 위 WARNING 이 지적하는 `executeInline` 갭이 리뷰/테스트 양쪽에서 가려졌다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:4934-4970` (게이트, diff 파일 1) — describe 제목 자체가 "선형 경로 외부 cancel 전파"로 스코프를 명시하고 있어 의도된 축소이긴 하나, plan 문서(`plan/in-progress/node-cancellation-residual-signal-propagation.md:73-85`, 게이트)는 "순회 루프 3곳(`runExecution`·`runNodeDispatchLoop`·`executeInline`) 전부 조치 완료"라고 서술해 세 경로가 동등하게 안전하다는 인상을 준다. 실제로는 `executeInline` 만 노드-핸들러 경계를 하나 더 거쳐 위 WARNING 의 흡수 문제가 있다.
  - 상세: 코드 자체의 결함이라기보다 검증 공백이지만, 이번 리뷰가 아니었다면 `executeInline` 경로의 재분류/재노출 문제는 다음 개발 사이클까지 미발견 상태로 남았을 것이다.
  - 제안: WARNING 항목의 수정과 함께, 세 경로 모두를 커버하는 동등한 단위 테스트 세트로 확장.

## 요약

이번 변경(`assertExecutionNotCancelled` 도입)은 그 자체로 타당하고 실제 취약점(Stop 이후 부수효과 지속)을 겨냥한 좋은 방어다 — SQL/커맨드 인젝션, 하드코딩 시크릿, 인증 우회, 암호화 약화 등 전통적 항목에서는 문제가 없고, `POST /executions/:id/stop` 이 쓰는 raw SQL 도 파라미터 바인딩(`$1`)을 정확히 쓴다. 다만 세 개의 dispatch loop 중 `executeInline` 만은 노드 핸들러(`workflow.handler.ts`)의 범용 catch-and-convert 경계를 통과해야 하는데, 그 경계가 신규 `ExecutionCancelledError`(이번 PR 이전에는 프로덕션에서 한 번도 실제로 throw 되지 않던 sentinel)를 특별 취급하지 않아 Sub-Workflow 노드에 대해서는 취소가 `SUB_WORKFLOW_FAILED` 로 오분류되고, 그 error 포트에 연결된 하류 노드가 한 홉만큼 계속 dispatch 될 수 있다 — 이는 이 PR이 명시적으로 막으려던 바로 그 위험(취소 후 부수효과 지속)의 재현이며, 내부 전용으로 문서화된 에러 메시지가 client-visible 노드 출력으로 새는 부수적 계약 위반도 동반한다. 착취를 위해서는 워크플로 소유자가 이미 Sub-Workflow + 에러-브랜치 구조를 스스로 구성해야 하고 전파가 1홉으로 유계라 CRITICAL 로 보진 않지만, 이 PR의 핵심 안전 목표를 부분적으로 무력화하므로 반드시 후속 수정이 필요하다.

## 위험도
MEDIUM
