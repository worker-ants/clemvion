---
id: common
status: spec-only
code: []
---

# Spec: Flow 노드 공통 규약

> 관련 문서: [PRD 노드 시스템](../_product-overview.md#5-flow-노드-1종) · [Spec 노드 개요](../0-overview.md) · [Spec 실행 엔진](../../5-system/4-execution-engine.md) · [CONVENTIONS](../../conventions/node-output.md)

본 문서는 Flow 카테고리 노드 전체에 공통되는 규약을 정의한다. 노드별 동작·설정은 각 노드 문서를 참조한다.

- [Workflow](./1-workflow.md) (서브 워크플로우 호출)

> Flow 카테고리는 현재 단일 노드(`workflow`)로 구성되어 있으나, 향후 `parallel_workflow` / `workflow_template` 등 워크플로우 간 연결을 다루는 노드가 추가될 수 있다. 본 문서는 그 공통 기반을 정의한다.

---

## 1. 카테고리 정의

Flow 노드는 **워크플로우 간 연결**을 담당한다 — 한 워크플로우가 다른 워크플로우를 서브 호출하거나, 여러 워크플로우 간 데이터·실행 흐름을 매개한다. Logic 카테고리(단일 워크플로우 내부의 흐름 제어)와는 다르다.

| 카테고리 | 범위 |
|----------|------|
| **Logic** | 단일 워크플로우 내부의 흐름 제어 (분기, 반복, 변수, 병렬) |
| **Flow** | 여러 워크플로우 간 연결 (서브 호출, 워크플로우 간 데이터 전달) |
| **Trigger** | 워크플로우 진입점 (수동/Webhook/Schedule) |

## 2. 5필드 공통 규약 (Flow 카테고리)

Flow 노드는 모두 [CONVENTIONS Principle 0](../../conventions/node-output.md) 의 5필드 invariant `{ config, output, meta?, port?, status? }` 를 따른다. 카테고리 특이 사용 패턴:

| 필드 | Flow 카테고리에서의 사용 패턴 |
|------|--------------------------------|
| `config` | 사용자 입력 raw echo (Principle 7). `inputMapping[]` 의 expression 템플릿 보존. `workflowId` / `mode` / `timeout` 등 |
| `output` | **Sync 모드**: 서브 워크플로우의 최종 출력. **Async 모드**: `{ executionId, workflowId, status }` 형식의 즉시 반환 메타. 두 경우 모두 분명히 다른 형태 → 노드 문서에서 case 분리 |
| `meta` | 실행 메트릭만 (Principle 2). `meta.{durationMs, recursionDepth, subExecutionId?, mode}` |
| `port` | `'out'` (성공) / `'error'` (서브 워크플로우 실패, 동기 모드) |
| `status` | Flow 노드는 비-블로킹 (sync 모드도 인라인 실행으로 즉시 종결) → `undefined` |

### 2.1 에러 컨트랙트 (CONVENTIONS Principle 3)

| 시나리오 | 처리 방식 |
|----------|-----------|
| Pre-flight: `workflowId` 미설정·존재 안 함·재귀 깊이 초과 | throw |
| Sync 모드: 서브 워크플로우 런타임 실패 | `output.error.{code: 'SUB_WORKFLOW_FAILED', message, details: {workflowId, mode}}` + `port: 'error'` |
| Async 모드: 큐 enqueue 실패 | `port: 'error'` (드물게 발생) |
| Async 모드: 서브 워크플로우의 런타임 에러 | 부모에 전파되지 않음 (fire-and-forget) — 서브 Execution의 로그에만 기록 |

> `error` 포트에 엣지가 연결되지 않은 상태에서 서브 워크플로우 실패 시 동작은 [Spec 에러 핸들링 §3.2 Route to Error Port](../../5-system/3-error-handling.md#32-route-to-error-port-상세) 의 일반 정책을 따른다.

### 2.2 재귀 호출 방지

- `recursionDepth` 가 `ExecutionContext` (sync) 또는 Execution 레코드 (async) 에 누적
- 기본 최대 깊이 10 — 초과 시 throw `Maximum recursion depth exceeded`
- 자기 자신을 직접 호출(A→A)도 깊이 제한 내에서는 허용

## 3. 출력 구조 색인

| 노드 | Sync 정상 | Sync 에러 | Async | Pre-flight throw |
|------|-----------|-----------|---------|---------------------|
| [workflow](./1-workflow.md#5-출력-구조) | §5.1 | §5.3 | §5.2 (sync 외 별도 케이스) | §5.8 |

## 4. 캔버스 요약

| 노드 | 요약 포맷 | 예시 |
|------|-----------|------|
| Workflow | `{workflowName 또는 workflowId} · {mode}`. `workflowName`이 있으면 이름 표시, 없으면 ID 표시. 워크플로우 삭제 시 `⚠ Missing workflow` | `Data Pipeline · sync` |
