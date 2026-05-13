# Workflow (Sub-Workflow) output 개선안

> 대상 spec: `spec/4-nodes/2-flow/1-workflow.md` (§5 출력 구조)

## 현재 output (spec 인용)

`spec/4-nodes/2-flow/1-workflow.md:106-127` — §5.1 Sync 정상 (port `out`):

```json
{
  "config": { "workflowId": "wf_uuid_1234", "workflowName": "Data Processing Pipeline", "mode": "sync", "inputMapping": [...], "timeout": 300 },
  "output": { "result": { "result": "success", "data": [1, 2, 3] } },
  "meta": { "durationMs": 0 }
}
```

`spec/4-nodes/2-flow/1-workflow.md:150-165` — §5.2 Async 정상 (port `out`):

```json
{
  "config": {...},
  "output": { "executionId": "sub-exec-async-1", "workflowId": "wf_uuid_1234", "status": "started" },
  "status": "started"
}
```

`spec/4-nodes/2-flow/1-workflow.md:188-207` — §5.3 런타임 에러 (port `error`):

```json
{
  "config": {...},
  "output": { "error": { "code": "SUB_WORKFLOW_NOT_FOUND", "message": "...", "details": { "workflowId": ..., "mode": "sync" } } },
  "port": "error"
}
```

## 진단

Workflow 노드는 sync / async / error 3 모드에 따라 `output` shape 이 다르다. 단계는 1개이지만 모드별 출력 shape 분기.

| Case | output shape | 적절성 |
| --- | --- | --- |
| §5.1 Sync 정상 | `output: { result: <inline 결과> }` | 적절 — 1단 래핑 (spec footnote: "sub_workflow output 이 `result` 키 가지면 `output.result.result`. 일관성 의도") |
| §5.2 Async 정상 | `output: { executionId, workflowId, status: 'started' }` + top-level `status: 'started'` | **부분적으로 부적절** — `output.workflowId` 와 `config.workflowId` 의 직교 위반 (Principle 1.1). spec footnote: "사용자 편의를 위한 echo, 항상 `config.workflowId` 와 동일" → 명시적 echo 라 일관성에 맞지 않음 |
| §5.3 런타임 에러 | `output: { error: {code, message, details: {workflowId, mode}} }` + `port: 'error'` | 적절 — Principle 3.2 표준 envelope. `details` 는 자유 스키마 |

| 필드 | 적절성 | 근거 |
| --- | --- | --- |
| §5.1 `output.result` | 적절 | 서브 워크플로우 최종 노드 output 1 단 래핑 — spec footnote: 일관된 접근 경로 보장 (`output.result.<field>`) |
| §5.2 `output.executionId` | 적절 (output) | 런타임 생성 추적 ID — 매 호출마다 다름. 비즈니스 데이터 (모니터링 분기에 사용) |
| §5.2 `output.workflowId` | **부적절 — `config.workflowId` 와 중복** | Principle 1.1 직교 위반. spec footnote 가 "사용자 편의 echo" 라고 정당화하지만 conventions 명시 위반 |
| §5.2 `output.status: 'started'` + top-level `status: 'started'` | **약간 부적절** — 두 곳 중복 | top-level `status` 는 5필드 invariant 의 일부 (Principle 11), `output.status` 는 비즈니스 데이터 — 의미 분리는 가능하지만 같은 값을 두 곳에 두는 것은 혼동 우려 |
| §5.3 `output.error` (표준 envelope) | 적절 | Principle 3.2 |
| §5.3 `output.error.details.workflowId` / `mode` | 적절 | 에러 컨텍스트는 자유 스키마 — config↔output 직교 예외 (spec 명시) |
| `meta.durationMs` (sync) | 적절 | inline 실행 wall-clock |
| `config.*` (raw echo) | 적절 | Principle 7 |

핵심 점검:

1. **`output.workflowId` 제거 권장** — `config.workflowId` 가 같은 값으로 echo 되므로 중복. 후속 노드는 `$node["X"].config.workflowId` 또는 `$node["X"].output.executionId` 로 분기 — 충분.
2. **`output.status: 'started'` vs top-level `status: 'started'` 의 중복** — top-level 만 유지 권장. 다운스트림은 `$node["X"].status === 'started'` 로 async 분기 식별. spec 의 5필드 invariant 와 일관.
3. **`output.result` 1단 래핑** — `output.<field>` 직접 노출 vs `output.result.<field>` 래핑 사이의 trade-off. 현 spec 은 래핑 선택 — sub_workflow 의 다양한 shape 을 일관된 컨테이너로 받기 위함. 합리적.

## 개선안 — 정리된 output

**Sync 정상:**
```json
{
  "config": { "workflowId": ..., "workflowName"?, "mode": "sync", "inputMapping": [...], "timeout": <number> },
  "output": { "result": <서브 워크플로우 최종 출력> },
  "meta": { "durationMs": <number> }
}
```

**Async 정상 (개선):**
```json
{
  "config": {...},
  "output": {
    "executionId": <런타임 생성 추적 ID>
    // ⚠ "workflowId" 제거 — config.workflowId 와 중복
    // ⚠ "status: 'started'" 제거 — top-level status 만 유지
  },
  "status": "started"
}
```

**런타임 에러:**
```json
{
  "config": {...},
  "output": {
    "error": {
      "code": "SUB_WORKFLOW_NOT_FOUND" | "SUB_WORKFLOW_TIMEOUT" | "SUB_WORKFLOW_QUEUE_FAILED" | "SUB_WORKFLOW_FAILED",
      "message": <string>,
      "details": { "workflowId": <string>, "mode": "sync" | "async" }
    }
  },
  "port": "error"
}
```

## 분리 제안 — output 에서 빠질 항목의 새 위치

| 기존 output 항목 | 새 위치 | 사유 |
| --- | --- | --- |
| `output.workflowId` (§5.2) | 제거 — `$node["X"].config.workflowId` 사용 | Principle 1.1 직교 위반 |
| `output.status: 'started'` (§5.2) | 제거 — top-level `status` 만 사용 | 5필드 invariant 와 중복 |

## Rationale

- `output.workflowId` echo 는 "사용자 편의" 라는 명분만 있고 conventions 직교 원칙을 분명히 위반. 호환성 영향이 있다면 deprecation 후 제거 단계가 필요할 수 있으나, 본 plan 은 정의상 제거를 권장.
- top-level `status` 와 `output.status` 의 의미 분리:
  - top-level `status` = 노드 실행 상태 (5필드 invariant — `waiting_for_input`, `resumed`, `started`, `ended` 등)
  - `output.status` = 비즈니스 데이터의 일부 (예: 서브 워크플로우의 자체 status 값)
  - 두 값이 같다면 `output.status` 는 불필요한 중복.
- async 모드 `output.executionId` 는 모니터링·후속 처리에 필수 — 유지.
- sync 모드 `output.result` 1단 래핑은 호출된 워크플로우의 다양한 output shape 을 일관 컨테이너로 받는 의도 — 유지.
