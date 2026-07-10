# Cross-Spec 일관성 검토 — `variables.__*` 예약 네임스페이스 3계층 강제 (`RESERVED_VARIABLE_NAME`)

대상: `git diff origin/main...HEAD` (spec: `spec/4-nodes/1-logic/4-variable-declaration.md`,
`spec/4-nodes/1-logic/5-variable-modification.md`, `spec/5-system/3-error-handling.md`,
`spec/conventions/execution-context.md` / 코드: `workflows.service.ts`,
`nodes/logic/_shared/reserved-variable-name.util.ts`, 두 노드 handler/schema)

## 발견사항

### [Warning] `RESERVED_VARIABLE_NAME` 카탈로그 항목이 L0(진짜 HTTP 400)과 L2(엔진 내부 message-prefix, 구조화 code 필드 미생성)를 단일 "HTTP 400" 행으로 병합 — 기존 카탈로그 관례와 불일치

- target 위치: `spec/5-system/3-error-handling.md:85` (§1.3 유효성 검증 에러 테이블, `RESERVED_VARIABLE_NAME` 신규 행, HTTP 컬럼 = `400`)
- 충돌 대상:
  - `spec/5-system/3-error-handling.md:91-102` (§1.4 "워크플로우 실행 에러" — `RECURSION_DEPTH_EXCEEDED`/`MAX_ITERATIONS_EXCEEDED`/`CYCLE_DETECTED`. 이 절은 **HTTP 컬럼 자체가 없다** — "엔진 수준 에러 (execution status → failed)"라는 전제로 설계된 별도 테이블)
  - `spec/conventions/error-codes.md` §3 `WORKER_HEARTBEAT_TIMEOUT` 행 — HTTP 컬럼을 `— (HTTP 무관 — 엔진 레벨 error.code, execution failed)` 로 명시 표기하는 기존 선례
  - `INVALID_NODE_CONFIG` — L1 이 이 코드로 "격하"된다고 target 이 스스로 서술하는데, 이 코드는 `spec/5-system/3-error-handling.md` §1 카탈로그 어디에도 등재돼 있지 않다(grep 0건) — 구조적으로 동일한 클래스(thrown plain `Error('CODE: ...')`, HTTP 무관)의 기존 코드는 **카탈로그에서 아예 제외**하는 것이 기존 관례임을 보여준다
- 상세: `RESERVED_VARIABLE_NAME` 은 실제로 **두 개의 이질적인 메커니즘**을 공유한다.
  - **L0** (`WorkflowsService.validateReservedVariableNames` → `BadRequestException({code, message, details})`, `codebase/backend/src/modules/workflows/workflows.service.ts:695-706`): 진짜 HTTP 400 응답, envelope 의 `error.code` 로 구조화 발행 — 카탈로그 HTTP=400 표기가 정확히 맞는다.
  - **L2** (`handler.execute` 런타임 throw, `reserved-variable-name.util.ts:50-58` `reservedVariableNameRuntimeError()` — 순수 `new Error(...)`, sentinel 클래스 아님): HTTP 요청/응답이 전혀 개입하지 않는 **엔진 내부 노드 실패 분류**다. 실제 코드 경로(`execution-engine.service.ts:4435-4462` `finalizeFailedExecution`)를 추적하면:
    ```
    savedExecution.error = {
      message: errMessage,
      ...(error instanceof ErrorPortFallbackError || error instanceof ExecutionTimeLimitError
        ? { code: error.code } : {}),
    };
    ```
    `RESERVED_VARIABLE_NAME:` 을 던지는 `Error` 는 이 두 sentinel 클래스 중 어느 것도 아니므로, **`Execution.error.code` 필드는 L2 케이스에서 결코 채워지지 않는다** — `RESERVED_VARIABLE_NAME` 값은 오직 `.message` 문자열의 prefix 로만 존재한다. `nodeExecution.error`(§5225-5620 부근 switch 문의 `stop`/`skip`/`route_error` 각 분기)도 동일하게 `{ message: err.message }` 만 저장하고 `code` 필드가 없다.
  - target 문서(§1.3 행)는 이 두 메커니즘을 "L0/L2" 로 정확히 구분해 **서술**은 하지만(`저장 시점 게이트... 발행` vs `handler.execute 가 message-prefix ... 로 throw → 엔진이 노드 실패로 분류`), 정작 테이블의 **HTTP 컬럼은 단일 `400`** 으로 남아 있어 L2 발생 시에도 "400" 이 유효한 것처럼 읽힌다. 기존 관례(§1.4 무-HTTP 테이블, `WORKER_HEARTBEAT_TIMEOUT` 의 "HTTP 무관" 명시)와 비교하면 이 카탈로그 표기는 **선례를 따르지 않는 예외**다.
  - 부수 확인: `codebase/backend/src/modules/chat-channel/shared/execution-failure-classifier.ts:12` 는 분류 입력을 "`event.error.code` + `event.error.details?.statusCode` 만" 로 화이트리스트한다(CCH-ERR-02/03, `.message` 사용 금지). `RESERVED_VARIABLE_NAME` 이 §1.4 의 `RECURSION_DEPTH_EXCEEDED`/`MAX_ITERATIONS_EXCEEDED`/`CYCLE_DETECTED` 처럼 이 분류기의 화이트리스트(INTERNAL_CODES)에 등재돼 있지 않다는 사실도, 이 코드가 §1.4 부류(엔진 레벨 message-prefix)에 더 가깝다는 정황이다. `conventions/error-codes.md` §1 은 "클라이언트는 코드의 의미로 분기하며 이름 토큰 부분 문자열을 파싱하지 않는다" 는 것을 원칙으로 못 박는데, L2 케이스는 구조적으로 `.message` 부분 문자열 파싱 없이는 식별 불가능한 값이라 이 원칙과도 긴장 관계다.
- 제안: 다음 중 하나로 target 정정.
  1. §1.3 행의 HTTP 컬럼을 `400 (L0)` 로 한정 표기하고, L2 발생은 별도로 §1.4 에 `RESERVED_VARIABLE_NAME`(엔진 레벨, HTTP 무관) 행을 추가하거나 §1.3 행 설명에 "L2 는 `Execution.error.code` 에 반영되지 않으며 `.message` prefix 로만 존재(§1.4 `MAX_ITERATIONS_EXCEEDED` 류와 동일 성격)" 를 명시.
  2. 혹은 `conventions/error-codes.md` §3(WORKER_HEARTBEAT_TIMEOUT 선례)과 동일하게 HTTP 컬럼을 `400 (L0) / — (L2, 엔진 레벨)` 로 병기.
  - 코드 차원 대안(더 큰 변경): `reservedVariableNameRuntimeError()` 를 `ErrorPortFallbackError` 처럼 `readonly code` 를 갖는 sentinel `Error` 서브클래스로 승격해 `Execution.error.code` 에 실제로 반영되게 하면, target 의 "엔진이 노드 실패로 분류" 서술이 구조적으로도 참이 된다 — 단 이는 spec 변경이 아니라 코드 변경이므로 developer 트랙 후속 과제로 분리 권장.

### [Info] "Variable Declaration/Modification 은 에러 포트를 갖지 않는다" 단정 문구가 이번 PR에서 더 절대화됐고, node-common.md 의 노드-무관 "Route to Error Port" 옵션과 표현상 긴장 관계

- target 위치: `spec/4-nodes/1-logic/4-variable-declaration.md:95` / `spec/4-nodes/1-logic/5-variable-modification.md:101` (diff: `"runtime 에러 포트를 갖지 않는다"` → `"에러 포트를 갖지 않는다"`, "runtime" 한정어 삭제로 더 절대적인 문장이 됨), `4-variable-declaration.md:140` / `5-variable-modification.md:149` (§6 동일 문구)
- 충돌 대상: `spec/3-workflow-editor/1-node-common.md:146` (Error Handling 은 §2.3 "공통 설정 필드" — 트리거를 제외한 **모든** 노드에 적용), `:173`("Route to Error Port ... 선택 시 노드에 error 포트가 동적 생성됨"), `:42`/`:78`(포트 다이어그램/표에도 "에러 처리 정책이 'Route to Error Port'인 경우 동적 생성" 이라고만 돼 있고 노드 타입 예외 없음). 코드 확인: `codebase/frontend/src/components/editor/settings-panel/node-settings-panel.tsx:295-299` `{!isTrigger && (...)}` — 유일한 예외는 `manual_trigger` 뿐이고, `variable_declaration`/`variable_modification` 을 포함한 모든 비-트리거 노드가 5개 정책(`stop_workflow`/`skip_node`/`use_default_output`/`retry`/`route_to_error_port`) 선택 UI 를 그대로 받는다.
- 상세: node-common.md 의 범용 정책에 따르면 사용자가 Variable Declaration/Modification 에 "Route to Error Port" 를 선택하면 실제로 `error` 포트가 동적 생성된다 — 두 노드 spec 의 "에러 포트를 갖지 않는다" 는 정확히는 "**기본적으로**·**노드 고유의 사전 정의 포트로는** 갖지 않는다" 는 의미이지 categorical 사실이 아니다. 이 표현 갭은 이번 PR 이전부터 있었으나(§6 서술은 이미 이전부터 "runtime 에러 포트" 라는 다소 좁은 한정을 두고 있었음), 이번 PR 이 그 한정어를 제거해 문구를 더 절대화했고, 동시에 두 노드에 실제 런타임 throw(L2)를 신설한 시점이라 잠재적 오독 가능성이 소폭 커졌다. 다만 실질 동작에는 영향 없음 — L2 throw 는 어떤 errorHandling.policy 를 선택하든 `context.variables[name] = ...` 대입 **이전에** 발생하므로, "Use Default Output"/"Skip Node" 를 선택해도 예약 이름이 실제로 쓰이는 것을 막는 핵심 보장 자체는 policy 와 무관하게 유지된다(달라지는 것은 워크플로우가 실제로 멈추는지 여부뿐).
- 제안: 급하지 않음(동기화 권장). §6 문구를 "노드 고유의 사전 정의 에러 포트를 갖지 않는다(범용 'Route to Error Port' 정책 선택 시 여느 노드처럼 동적 생성 가능, node-common.md §2.4)" 정도로 완화해 두 문서 간 정합성을 명시하면 향후 혼란을 줄일 수 있음.

## 요약

이번 PR 의 핵심 3계층 강제(L0/L1/L2) 는 코드와 spec 서술이 정확히 일치한다 — `saveCanvas`/`importWorkflow` 게이트, `restoreVersion` 면제, `validateConfig`(L1)→`INVALID_NODE_CONFIG` 격하, `handler.execute`(L2) 런타임 재검사, 시스템 주입 키 4종(`__workspaceId`/`__workspaceName`/`__workspaceTimezone`/`__dryRun`) 목록, 변수 이름 필드가 `EXPRESSION_EXCLUSIONS` 에 없어 표현식 해석 대상이라는 전제(5-expression-language.md §8.3.3과 정합) 모두 코드 대조 결과 일치했고 새로 등록해야 할 요구사항 ID·엔티티·엔드포인트도 없다. 유일한 실질적 지적은 신규 에러 코드 `RESERVED_VARIABLE_NAME` 을 §1.3(HTTP 봉투 카탈로그, HTTP=400 단일값)에 등재하면서, 실제로는 L0(진짜 HTTP 400)와 L2(엔진 내부 throw, `Execution.error.code` 에 결코 반영되지 않는 message-prefix 전용)라는 이질적 두 메커니즘을 한 행에 병합해, 기존 카탈로그가 §1.4/§3(`WORKER_HEARTBEAT_TIMEOUT`)에서 지켜온 "엔진 레벨 코드는 HTTP 컬럼을 분리 표기하거나 아예 카탈로그에서 제외한다"는 관례와 어긋난다는 점이다(WARNING). 부수적으로 "에러 포트를 갖지 않는다" 단정 문구가 node-common.md 의 범용 에러 정책 UI와 표현상 긴장 관계에 있으나 실질 동작에는 영향이 없다(INFO).

## 위험도

LOW

STATUS: DONE
