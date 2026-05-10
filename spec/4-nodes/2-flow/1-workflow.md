# Spec: Workflow (Sub-Workflow)

> 관련 문서: [Flow 공통 규약](./0-common.md) · [Spec 노드 개요](../0-overview.md) · [Spec 표현식 언어](../../5-system/5-expression-language.md) · [Spec 실행 엔진](../../5-system/4-execution-engine.md) · [Spec 에러 핸들링](../../5-system/3-error-handling.md) · [CONVENTIONS](../../../user_memo/node-specs-improvement/CONVENTIONS.md)

다른 워크플로우를 서브 워크플로우로 호출하여 재사용성·모듈화를 지원하는 **flow 노드**. 동기(`sync`) 모드는 부모 Execution 안에서 인라인 실행되며 서브 워크플로우의 최종 출력을 그대로 받는다. 비동기(`async`) 모드는 별도 Execution 으로 큐에 등록하고 즉시 추적 ID 를 반환한다.

---

## 1. 설정 (config)

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| workflowId | UUID (string) | ✓ | `''` | 호출 대상 워크플로우 정의 ID. 워크플로우 셀렉터 또는 expression(`{{ }}`) 으로 입력 |
| workflowName | string | | `undefined` | 캔버스 요약 표시용 이름. 셀렉터에서 자동 채움. 직접 UUID 입력 시 초기화 |
| mode | `sync` / `async` | ✓ | `sync` | 실행 모드 |
| inputMapping | MappingDef[] | | `[]` | 서브 워크플로우 입력 파라미터 매핑. 비어 있으면 부모 input 을 그대로 전달 |
| timeout | Integer | | `300` | sync 모드 타임아웃 (초). `0` = 무제한 대기. async 모드에서는 무시 |

**MappingDef 구조**:

| 필드 | 타입 | 설명 |
|------|------|------|
| paramName | string | 서브 워크플로우 입력 키 이름 (handler 가 읽는 키) |
| expression | unknown | 매핑할 값의 expression 또는 리터럴 (engine 이 평가 후 핸들러에 전달) |

> Source of truth: `backend/src/nodes/flow/workflow/workflow.schema.ts` (export `workflowNodeConfigSchema`). 스키마 / 핸들러 모두 `paramName` / `expression` 을 사용한다.

## 2. 설정 UI

```
┌────────────────────────────────────────┐
│  Sub-Workflow                          │
│  ────────────────────────────────────  │
│                                        │
│  Target Workflow:                      │
│  [Select a workflow...          ▼]     │
│    - Data Processing Pipeline          │
│    - Email Notification Flow           │
│    - ...                               │
│                                        │
│  Workflow ID:                          │
│  [_________________________]           │
│  (직접 UUID 또는 expression 입력 가능) │
│                                        │
│  Mode:   [Sync ▼]                      │
│                                        │
│  Input Mapping:                        │
│  ┌────────────────────────────────────┐│
│  │ param1  ←  {{ $input.data }}      ││
│  │ param2  ←  {{ $var.config }}      ││
│  │ [+ Add Parameter]                 ││
│  └────────────────────────────────────┘│
│                                        │
│  Timeout: [300] seconds (0=no timeout) │
│  (sync 모드에서만 표시)                │
└────────────────────────────────────────┘
```

- 셀렉터에서 선택 시 `workflowId` + `workflowName` 동시 저장
- 직접 입력 시 `workflowName` 초기화
- 같은 워크스페이스 내 워크플로우만 후보로 노출 (현재 편집 중 워크플로우 제외)
- 비활성 / 삭제된 워크플로우는 캔버스 배지에서 `⚠ Missing workflow` 표시

## 3. 포트

### 3.1 입력 포트

| id | label | type | dynamic | 설명 |
|------|-------|------|---------|------|
| `in` | Input | data | false | 부모로부터 전달받는 입력 (1개 필수) |

### 3.2 출력 포트

| id | label | type | dynamic | 설명 |
|------|-------|------|---------|------|
| `out` | Output | data | false | sync: `output.result` 에 1단 래핑된 서브 워크플로우 최종 출력 / async: `output.{executionId, workflowId, status}` 추적 envelope + top-level `status: 'started'` |
| `error` | Error | error | false | 서브 워크플로우 런타임 실패 — `port: 'error'` + `output.error` (CONVENTIONS §3.2) |

> Workflow 노드는 동적 포트가 없다. `error` 포트는 항상 노출되며 미연결 시 [에러 핸들링 §3.2 Route to Error Port](../../5-system/3-error-handling.md#32-route-to-error-port-상세) 의 일반 정책 (Stop Workflow 폴백) 을 따른다.

## 4. 실행 로직

1. **Pre-flight 검증** (Principle 3.1, throw):
   - `workflowId` 미설정 → schema warningRule "실행할 워크플로우를 선택해야 합니다."
   - `workflowId` 가 string 아님 / `mode` 가 `sync`·`async` 외 / `timeout` 음수·non-numeric / `inputMapping` 비배열 / `inputMapping[i].paramName` 누락 → handler.validate
   - `context.recursionDepth >= 10` → throw `Maximum recursion depth exceeded (limit: 10)`
   - sync 모드에서 `context._executedNodes` 누락 → throw `Inline execution requires _executedNodes in context`
2. **서브 입력 구성**: `inputMapping` 이 1개 이상이면 `{ [paramName]: expression(평가됨) }` 객체를 만들어 사용. 비어 있으면 부모 `input` 을 그대로 전달 (pass-through)
3. **모드 분기**:
   - **Sync**: `executionEngine.executeInline(workflowId, effectiveInput, { executionId, context, executedNodes, recursionDepth: depth+1, parentNodeExecutionId })` → 반환값을 `output: { result: <inlineResult> }` 으로 1단 래핑 (§5.1)
   - **Async**: `executionEngine.executeAsync(workflowId, effectiveInput, { parentExecutionId, recursionDepth: depth+1 })` → `output: { executionId, workflowId, status: 'started' }` + top-level `status: 'started'` 즉시 반환 (§5.2)
4. **런타임 에러 처리** (Principle 3.2):
   - sync `executeInline` / async `executeAsync` 가 throw 한 경우 — `output.error.{code, message, details: {workflowId, mode}}` + `port: 'error'` (§5.3). `code` 는 executor 메시지에 따라 `SUB_WORKFLOW_NOT_FOUND` / `SUB_WORKFLOW_TIMEOUT` / `SUB_WORKFLOW_QUEUE_FAILED` / `SUB_WORKFLOW_FAILED` (기본) 로 매핑된다 (§6 표 참조)
5. **재귀 깊이 누적**: 자식 호출 시 `recursionDepth` 를 +1 하여 전달. sync 는 `ExecutionContext`, async 는 Execution 레코드에 누적 (Flow 공통 §2.2)

> sync 모드의 서브 워크플로우 진입점 trigger 는 `manual_trigger` 만 허용된다 — 다른 trigger 타입은 엔진이 명시적 throw (silent skip 금지). 이유: webhook/schedule trigger 는 외부 이벤트와 결합된 출처 분류 의미를 가져 부모 Execution 의 출처를 덮어쓰면 안 됨. 자세한 내용은 [실행 엔진 §6.1.1](../../5-system/4-execution-engine.md) 참조.

## 5. 출력 구조

> CONVENTIONS Principle 11 포맷. JSON 예시는 `undefined` 필드 생략, 5필드 (`config`/`output`/`meta?`/`port?`/`status?`) 외 top-level 키 금지.
>
> Workflow 노드는 `mode` 에 따라 `output` 모양이 분명히 다르다 — sync 정상(§5.1) / async 정상(§5.2) / 런타임 에러(§5.3) / Pre-flight throw(§5.8) 4 케이스로 분리한다.

### 5.1 Case: Sync 정상 (port `out`)

```json
{
  "config": {
    "workflowId": "wf_uuid_1234",
    "workflowName": "Data Processing Pipeline",
    "mode": "sync",
    "inputMapping": [
      { "paramName": "userId", "expression": "{{ $input.user.id }}" }
    ],
    "timeout": 300
  },
  "output": {
    "result": {
      "result": "success",
      "data": [1, 2, 3]
    }
  },
  "meta": {
    "durationMs": 0
  }
}
```

| 필드 | 타입 | 출처 | 설명 |
|------|------|------|------|
| `config.workflowId` | string | config echo (Principle 7) | 사용자가 설정한 워크플로우 정의 ID — 모든 실행에서 동일 |
| `config.workflowName` | string? | config echo | 셀렉터로 채워진 표시용 이름 (캔버스 요약·디버깅 용도) |
| `config.mode` | `'sync'` | config echo | 실행 모드 (default `sync`) |
| `config.inputMapping` | MappingDef[] | config echo | 사용자가 입력한 raw 매핑 — `expression` 의 `{{ }}` 템플릿 보존 |
| `config.timeout` | number | config echo | 타임아웃 (초) |
| `output.result` | (서브 워크플로우 출력) | runtime — `executeInline` 반환값 | **서브 워크플로우의 최종 노드 출력이 1단 래핑되어 담긴다.** 키 구조는 호출된 워크플로우에 전적으로 의존 (`workflow.schema.ts` 의 `workflowNodeOutputSchema` 가 Tier 3 unknown 으로 표시) |
| `meta.durationMs` | number | engine inject | inline 실행 소요 시간 (ms) |
| `port` | (생략 = `'out'`) | handler return | 단일 성공 출력 (Principle 5) |

> ⚠ **미구현 (P1)**: 현재 핸들러는 sync `meta` 를 비워 둔다 (`durationMs` 등 메트릭 미주입). 위 예시의 `meta.durationMs: 0` 은 엔진이 모든 노드에 공통 주입하려는 값으로, 본 노드에도 적용 예정. Phase 4 정비 항목 (`spec-4-nodes-unimplemented-cleanup.md`).

**Expression 접근 예**:
- `$node["X"].output.result.data` → `[1, 2, 3]` (서브 워크플로우 최종 출력의 필드 — 1단 래핑)
- `$node["X"].output.result` → 서브 워크플로우의 최종 노드 output 전체
- `$node["X"].config.workflowId` → `"wf_uuid_1234"` (대상 워크플로우 정의 ID)
- `$node["X"].port` → `undefined` (= 기본 `'out'`)

### 5.2 Case: Async 정상 (port `out`)

```json
{
  "config": {
    "workflowId": "wf_uuid_1234",
    "workflowName": "Email Notification Flow",
    "mode": "async",
    "inputMapping": [],
    "timeout": 300
  },
  "output": {
    "executionId": "sub-exec-async-1",
    "workflowId": "wf_uuid_1234",
    "status": "started"
  },
  "status": "started"
}
```

| 필드 | 타입 | 출처 | 설명 |
|------|------|------|------|
| `config.*` | (§5.1 과 동일) | config echo | `mode: 'async'` |
| `output.executionId` | string | runtime — `executeAsync` 반환값 | **이번 호출로 큐에 등록된 sub-execution 추적 ID** (런타임 생성). `config.workflowId` 와 의미가 다름 — 매 호출마다 다른 값 |
| `output.workflowId` | string | runtime — echo | 대상 워크플로우 정의 ID (사용자 편의를 위한 echo). 항상 `config.workflowId` 와 동일 |
| `output.status` | `'started'` | runtime | 비동기 큐 등록 완료 상태 표시 |
| `status` | `'started'` | handler return | 큐 등록 완료를 5필드 invariant 의 top-level `status` 로 노출 (CONVENTIONS Principle 11) |
| `port` | (생략 = `'out'`) | handler return | 단일 성공 출력 |

**Expression 접근 예**:
- `$node["X"].output.executionId` → `"sub-exec-async-1"` (이번 호출의 sub-execution 추적 ID)
- `$node["X"].output.workflowId` → `"wf_uuid_1234"` (대상 워크플로우 정의 ID — `config.workflowId` 와 동일)
- `$node["X"].output.status` → `"started"`
- `$node["X"].status` → `"started"` (top-level status)

### 5.3 Case: 런타임 에러 (port `error`)

`executeInline` (sync) 또는 `executeAsync` (async) 가 throw 한 모든 케이스 — sub-workflow 내부 노드 실패, `Workflow not found`, expression 평가 에러, 큐 enqueue 실패 등.

```json
{
  "config": {
    "workflowId": "wf_uuid_9999",
    "mode": "sync",
    "inputMapping": [],
    "timeout": 300
  },
  "output": {
    "error": {
      "code": "SUB_WORKFLOW_FAILED",
      "message": "Workflow not found: wf_uuid_9999",
      "details": {
        "workflowId": "wf_uuid_9999",
        "mode": "sync"
      }
    }
  },
  "port": "error"
}
```

| 필드 | 타입 | 출처 | 설명 |
|------|------|------|------|
| `config.*` | (§5.1 과 동일) | config echo | 에러 케이스에서도 동일하게 echo |
| `output.error.code` | `ErrorCodeValue` | handler return | §6 의 코드 표 참조 — executor 에러 메시지에 따라 세분화 (`SUB_WORKFLOW_NOT_FOUND` / `SUB_WORKFLOW_TIMEOUT` / `SUB_WORKFLOW_QUEUE_FAILED` / `SUB_WORKFLOW_FAILED`) |
| `output.error.message` | string | handler return | `err.message` 원문 (i18n 없음, 로그/디버깅용) |
| `output.error.details.workflowId` | string | handler return | 실패한 sub-workflow 정의 ID (디버깅 payload — Principle 1.1 의 config↔output 직교성 예외 — 에러 컨텍스트는 자유 스키마) |
| `output.error.details.mode` | `'sync'` / `'async'` | handler return | 실패 발생 모드 |
| `port` | `'error'` | handler return | 에러 분기 (CONVENTIONS §3.2) |

**Expression 접근 예**:
- `$node["X"].port === "error"` → 에러 분기 진입 판별
- `$node["X"].output.error.code` → `"SUB_WORKFLOW_NOT_FOUND"` 등
- `$node["X"].output.error.details.workflowId` → 실패한 워크플로우 ID

### 5.8 Pre-flight throw (포트 라우팅 없음)

다음 조건은 핸들러가 즉시 `throw` 하여 엔진이 노드 실행을 `failed` 로 마킹한다 (CONVENTIONS Principle 3.1). `output` / `port` 가 생성되지 않으므로 다운스트림 노드는 라우팅되지 않는다.

| 발생 조건 | 메시지 | 시점 |
|-----------|--------|------|
| `workflowId` 미설정·빈 문자열 | `실행할 워크플로우를 선택해야 합니다.` | warningRule (캔버스 배지) + handler.validate |
| `workflowId` 가 string 아님 | `workflowId is required and must be a string` | handler.validate |
| `mode` 가 `sync`/`async` 외 | `mode must be "sync" or "async"` | handler.validate |
| `timeout` 음수 또는 non-numeric | `timeout must be a non-negative number (0 = no timeout)` | validateConfig (schema) |
| `inputMapping` 이 배열 아님 | `inputMapping must be an array` | validateConfig |
| `inputMapping[i].paramName` 누락 / 비-string / 빈 문자열 | `inputMapping[i].paramName is required and must be a string` | validateConfig |
| `context.recursionDepth >= 10` | `Maximum recursion depth exceeded (limit: 10)` | execute (런타임) |
| sync 모드에서 `context._executedNodes` 누락 | `Inline execution requires _executedNodes in context` | execute (런타임 — 직접 호출자용 방어) |

> 재귀 깊이 초과는 "런타임에 발견되는" 조건이지만, 사용자 입력으로 회복 가능한 비즈니스 실패가 아니라 **환경 invariant 위반** 이므로 throw (Pre-flight 분류). 자세한 분류 기준은 CONVENTIONS Principle 3.1 참조.

## 6. 에러 코드

§5.3·§5.8 표 참조. 정리하면:

| code | 분류 | 의미 |
|------|------|------|
| `SUB_WORKFLOW_NOT_FOUND` | Runtime (port `error`) | 대상 워크플로우 정의가 존재하지 않음 — executor 의 `Workflow not found: <id>` 를 매핑 |
| `SUB_WORKFLOW_TIMEOUT` | Runtime (port `error`) | sync 모드 timeout 초과 — executor 의 `timed out` / `timeout` 메시지를 매핑 |
| `SUB_WORKFLOW_QUEUE_FAILED` | Runtime (port `error`) | async 모드 큐 등록 실패 — 메시지에 `queue` + 실패 표시(`failed`/`enqueue`/`reject`) 가 모두 포함된 경우 |
| `SUB_WORKFLOW_FAILED` | Runtime (port `error`) | 위 3개에 매칭되지 않은 모든 런타임 실패 — sub-workflow 내부 노드 실패, expression 평가 에러 등 일반 fallback |
| (throw) `Maximum recursion depth exceeded` | Pre-flight | `recursionDepth >= 10` |
| (throw) `Inline execution requires _executedNodes in context` | Pre-flight | sync 모드 내부 invariant 위반 (직접 호출자용 방어) |
| (throw) Schema/validate 메시지 | Pre-flight | §5.8 표 참조 |

> Async 모드에서 큐 등록 후 발생한 sub-workflow 런타임 에러는 **부모 Execution 에 전파되지 않는다** (fire-and-forget). 서브 Execution 자체의 로그·상태에만 기록되며, 모니터링은 `parentExecutionId` 로 조회한다.

## 7. 캔버스 요약

[Flow 공통 §4](./0-common.md#4-캔버스-요약) — `Workflow` 행 인용 (`{workflowName 또는 workflowId} · {mode}`. 대상 워크플로우가 삭제·비활성화되면 `⚠ Missing workflow` 배지).
