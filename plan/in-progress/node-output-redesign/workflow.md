# Workflow (Sub-Workflow) output 개선안

> **최신화 검토 (2026-05-16)**: 현 spec 과 본 plan 의 분석이 정합. sync/async/error 3 케이스 분기 유지.
> 잔여 권고 항목:
> - §5.2 (Async 정상) 의 `output.workflowId` 제거 — `config.workflowId` 와 의미 중복 (Principle 1.1 직교 위반). 다운스트림은 `$node["X"].config.workflowId` 사용.
> - §5.2 의 `output.status: 'started'` 제거 — top-level `status: 'started'` 만 유지 (5필드 invariant 일관성).

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

## 구현 분석 (2026-05-16)

대상 파일: `backend/src/nodes/flow/workflow/{workflow.handler.ts, workflow.schema.ts, workflow.handler.spec.ts, workflow.schema.spec.ts, workflow.component.ts}`.

1. **spec §5 ↔ handler return 정합성 (sync/async/error 3 케이스)**:
   - **Sync 정상** (`workflow.handler.ts:156-160`): `{ config: configEcho, output: { result: inlineResult }, meta: { durationMs } }` — `output.result` 1단 래핑 + `meta.durationMs` 모두 spec §5.1 과 일치. `port` 미설정 (= `'out'`) 도 일관.
   - **Async 정상** (`workflow.handler.ts:106-114`): `{ config, output: { executionId, workflowId, status: 'started' }, status: 'started' }` — spec §5.2 와 정합 **BUT** plan 잔여 권고 두 건이 정확히 여기서 발견됨:
     - `output.workflowId` (`:110`) = `config.workflowId` 와 중복 (Principle 1.1 위반)
     - `output.status: 'started'` (`:111`) = top-level `status` (`:113`) 와 중복
   - **Runtime 에러** (`workflow.handler.ts:176-207` `buildSubWorkflowError`): `output.error.{code, message, details: {workflowId, mode}}` + `port: 'error'` — spec §5.3 완벽 정합. `truncateForErrorDetails` (`:192`) 로 메시지 캡까지 적용.
   - **Pre-flight throw** (`workflow.handler.ts:36-49` validate, `:62-68` recursion, `:124-126` `_executedNodes` 누락): spec §5.8 표 모두 매칭.

2. **schema ↔ spec config 정합성**: `workflowNodeConfigSchema` (`workflow.schema.ts:68-117`) 모든 필드 spec §1 표와 일치 — `workflowId` (default `''`), `workflowName?`, `mode` (`'sync'|'async'`, default `'sync'`), `inputMapping` (default `[]`), `timeout` (int, default `300`). `mappingDefSchema` (`:7-30`) 의 `paramName` / `expression` 도 spec §1 MappingDef 와 일치.

3. **validate 일관성**:
   - `workflow.handler.ts:36-49` 의 `handler.validate()` 는 `evaluateMetadataBlockingErrors` (warningRules `workflow:no-workflow-selected` + `validateWorkflowConfig` SSOT) + `workflowId` type guard + `mode` enum guard 두 개만 추가. SSOT 침범 없음.
   - `validateWorkflowConfig` (`workflow.schema.ts:134-167`) 가 `timeout` (>=0, numeric) + `inputMapping` array shape + per-item `paramName` 검증. handler vs schema 분리 명확 (`workflow.schema.ts:128-133` 주석이 escape hatch 이유 명시).
   - `workflow.schema.spec.ts:34-78` 가 모든 validate path 커버 (`timeout=0` 허용, 음수/non-numeric 거부, inputMapping 형식, paramName 누락 등).

4. **에러 컨트랙트 (Principle 3)**:
   - `buildSubWorkflowError` (`workflow.handler.ts:176-207`) 가 spec §3.2 envelope 표준 100% 준수.
   - `mapSubWorkflowError` (`workflow.handler.ts:222-245`) 가 4-way 분기 (`SUB_WORKFLOW_NOT_FOUND` / `_TIMEOUT` / `_QUEUE_FAILED` / `_FAILED` fallback) — spec §6 표와 일치. `:223-235` 주석이 "bare `timeout` 토큰 거부 — 내부 노드의 DB 타임아웃 등을 sub-workflow timeout 으로 오분류 방지" 의도 명시.
   - 비-Error rejection (`mockExecutor.executeInline.mockRejectedValue('plain string')`) 도 `workflow.handler.ts:190` `err instanceof Error ? err.message : String(err)` fallback 으로 안전 처리. `workflow.handler.spec.ts:545-558` 가 커버.

5. **conventions Principle 0–11 위반 패턴**:
   - **Principle 1.1 (config ↔ output 직교)**: `output.workflowId` (`workflow.handler.ts:110`) 가 `config.workflowId` 와 중복. plan 잔여 권고 1.
   - **Principle 0 / 5필드 invariant**: `output.status: 'started'` (`workflow.handler.ts:111`) + top-level `status: 'started'` (`:113`) 두 곳 — plan 잔여 권고 2. spec/test 가 의도적으로 둘 다 노출하나 한 쪽 제거 필요.
   - **Principle 2 (meta = 실행 메트릭)**: sync 만 `meta.durationMs` 측정. async 는 `meta` 자체 미설정 (`workflow.handler.spec.ts:251` 명시) — spec §5.2 표가 `meta` 컬럼 자체를 두지 않아 일관. 즉 누락이 아니라 의도 (async 는 측정할 wall-clock 없음).
   - **Principle 7 (config raw echo)**: `configEcho` (`workflow.handler.ts:87-93`) 가 `rawConfig ?? config` 패턴으로 5필드 (`workflowId/workflowName/mode/inputMapping/timeout`) 모두 echo. credential 없음. 부합.
   - **Principle 8**: 이중 중첩 없음 (`output.result.<sub>` 1단 wrapping 은 spec 정당화).

6. **handler 테스트 (`workflow.handler.spec.ts`)**:
   - sync wrap (`:124-180`, primitive/null 도 wrap), recursion (`:272-329`, depth 9/10/15/undefined), inputMapping (`:331-402`), error code 매핑 6 종 (`:404-575`), `mapSubWorkflowError` unit (`:577-632`) 모두 커버. `meta.durationMs` 도 sync 에 한해 non-negative 검증 (`:142-145`).
   - **미세 누락**: `outputSchema` 에 `meta` / `port` / `status` 가 declarative 정의되어 있는데 (`workflow.schema.ts:48-66`), `outputSchema` 가 실제로 handler 결과를 통과시키는지 (zod parse) 직접 검증하는 테스트는 부재. 다른 노드 패턴도 동일하므로 횡단 일관 — 별개 이슈.
   - **미세 누락 2**: async 의 `output.workflowId` echo 가 `config.workflowId` 와 동일 값임을 직접 어서트하는 테스트는 있으나 (`:241-249` matchObject), 두 값 *분리* 시나리오 (예: workflowId resolution 이 다른 ID 로 평가) 가 없다. 그러나 spec 이 "항상 동일" 이라 정의하므로 의도된 제약.

7. **횡단 일관성 (Flow 카테고리 단독, 컨테이너 비교)**:
   - Flow `0-common.md:23-33` 의 5필드 사용 패턴 표가 Workflow handler 와 일치 — `status: undefined` (블로킹 아님) 가 sync 에는 맞으나 async 의 `status: 'started'` 케이스가 표에는 명시 안 됨. 0-common 표가 sync 기준이며 async 의 `'started'` 는 노드 spec §5.2 footnote 에 위임된 형태 — 모호함.
   - Container 노드 (Loop/ForEach/Map/Parallel) 의 `output: null` → 엔진 오버라이트 (Principle 9) 와는 무관 — Workflow 는 sub-workflow 결과를 직접 wrap 하지 엔진이 덮어쓰지 않는다. 카테고리 정의상 정합.
   - Async `meta` 부재가 Loop / ForEach (`meta.iterations`) / Parallel (잔여 권고: `meta.durationMs` 보강) 과 카테고리 횡단 비교 시 한 줄 정당화 필요 — async 는 fire-and-forget 으로 sub 자체 측정 불가.

8. **구현 품질**:
   - dead code 없음. `MAX_RECURSION_DEPTH = 10` 상수 (`workflow.handler.ts:29`) 단일 진입점.
   - `rawConfig ?? config` fallback 패턴 (`:85-86`) — unit-test 가 엔진 없이 실행되도록 의도된 escape hatch, 다른 노드와 일관.
   - `mapSubWorkflowError` 의 `@internal` JSDoc + `TODO` (`:216-220`) — `WorkflowExecutor` 가 typed error hierarchy 도입 시 string 매칭 → instanceof 로 마이그레이션할 future work 명시. 합리적.
   - `parentNodeExecutionId` (`:146`) — sub-workflow children 의 timeline 그룹핑용. test (`:167-180`) 커버.

## 종합 개선안 (2026-05-16)

- [ ] (spec) §5.2 (Async 정상) JSON 예시 + 표에서 `output.workflowId` 제거. 후속 노드는 `$node["X"].config.workflowId` 로 접근. 근거: Principle 1.1 직교 위반, plan 잔여 권고 1, `workflow.handler.ts:110`.
- [ ] (spec) §5.2 (Async 정상) JSON 예시 + 표에서 `output.status` 제거 — top-level `status` 만 유지. 5필드 invariant 일관성. 근거: plan 잔여 권고 2, `workflow.handler.ts:111`.
- [ ] (impl) `workflow.handler.ts:108-112` async 반환 객체에서 `workflowId` / `status` 두 필드 제거. `output: { executionId: subExecutionId }` 로 축소. 근거: 위 spec 결정 반영.
- [ ] (impl) `workflow.handler.spec.ts:241-249` 의 matchObject 어서트에서 `output.workflowId` / `output.status` 기대치 제거 + 명시적 `expect(result.output.workflowId).toBeUndefined()` / `expect(result.output.status).toBeUndefined()` 추가. 근거: 위 impl 변경 검증.
- [ ] (spec) `spec/4-nodes/2-flow/0-common.md:30` 의 `output` 카테고리 행에 async 시 "executionId 만 노출" 명시 (현재 `{executionId, workflowId, status}` 로 기재되어 있어 정리 필요). 근거: 본 변경 후 표와 노드 spec 의 정합 유지.
- [ ] (spec) §5.2 footnote 또는 §6 에 "async 모드는 fire-and-forget 이라 `meta.durationMs` 측정 없음" 한 줄 명시 — 카테고리 횡단 비교 시 의문 발생 방지. 근거: Loop/ForEach 의 `meta.iterations` 와의 비대칭 정당화.
- [ ] (frontend) `frontend` 의 workflow 노드 출력 viewer / expression autocomplete 가 `$node["X"].output.workflowId` 또는 `$node["X"].output.status` 를 추천 항목으로 노출하는지 확인 후, 제거된 필드라면 autocomplete 사전·sample fixture 도 함께 정리. 근거: 호환성 - 본 변경은 잠재적 breaking, 사용자 워크플로우 마이그레이션 가이드 필요.
