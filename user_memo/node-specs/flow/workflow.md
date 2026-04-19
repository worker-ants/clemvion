# Sub-Workflow (`workflow`)

> 다른 워크플로우를 호출합니다. `sync` 모드는 인라인 실행(부모와 동일한 실행 컨텍스트/타임라인 공유), `async` 모드는 별도 실행으로 큐에 등록합니다.

- **카테고리**: `flow`
- **컨테이너**: yes (sync 모드에서 sub-workflow 노드들이 부모 실행의 자식으로 타임라인에 그룹화됨)
- **Blocking**: no (sync는 sub-workflow 완료까지 await, async는 즉시 반환)
- **동적 포트**: no

## Config 파라메터

| 필드명 | 타입 | 필수 | 기본값 | 설명 | 표현식 |
| --- | --- | --- | --- | --- | --- |
| `workflowId` | string | yes | `''` | 호출 대상 워크플로우 ID (`workflow-selector` 위젯. UUID 수동 입력 가능) | no |
| `workflowName` | string | no | (없음) | 표시용 이름 (UI hidden 필드) | no |
| `mode` | `'sync' \| 'async'` | no | `'sync'` | `sync`=인라인 실행 / `async`=별도 실행 큐 등록 | no |
| `inputMapping` | `MappingDef[]` | no | `[]` | 부모 input → 서브 워크플로우 input 매핑. 비어 있으면 부모 input을 그대로 전달 | 각 항목의 `source` (expression 위젯) |
| `timeout` | int (초) | no | `300` | (sync 모드 전용) sub-workflow 실행 타임아웃. `0` = 무제한. UI에서는 `mode === 'sync'` 일 때만 노출 | no |

### `MappingDef` 항목

| 필드 | 타입 | 기본값 | 위젯 | 설명 |
| --- | --- | --- | --- | --- |
| `target` | string | `''` | `text` | 서브 워크플로우에 전달될 input 키 이름 |
| `source` | string | `''` | `expression` | 부모 input에서 값을 해석할 표현식 (예: `{{ $input.data }}`) |

> ⚠️ **스키마/핸들러 키 불일치**: `workflow.schema.ts` 는 매핑 항목을 `target`/`source` 로 정의하지만, `workflow.handler.ts` 는 매핑 객체에서 `paramName` / `expression` 필드를 읽어 sub-workflow input 을 구성합니다 (`workflow.handler.ts:8-11, 83-84`). 현재 코드 그대로 사용할 경우 `target`/`source` 로 저장된 매핑은 핸들러에 무시되어 `{ undefined: undefined }` 형태로 전달될 수 있습니다. 매핑을 반드시 적용해야 한다면 프론트엔드가 `paramName`/`expression` 로 저장하고 있는지 확인하거나, 매핑을 비워 부모 input 전체를 그대로 넘기는 방식을 사용하세요.

## Ports

| 방향 | id | label | 타입 | 설명 |
| --- | --- | --- | --- | --- |
| Input | `in` | Input | `data` | 부모 워크플로우에서의 입력 |
| Output | `out` | Output | `data` | sub-workflow 실행 결과 (sync) / 시작 정보 (async) |

## Input

- `inputMapping` 이 비어 있으면 (`length === 0`) **부모 노드의 input 객체 전체** 를 그대로 sub-workflow 로 전달합니다. `null` 이어도 그대로 넘어갑니다.
- `inputMapping` 이 1개 이상이면, 매핑 항목들을 이용해 **새 객체**(`{ [paramName]: expression, ... }`)를 만들어 sub-workflow input 으로 전달합니다. 부모 input 은 무시됩니다.
- 매핑 항목의 `expression` 값은 ExecutionEngineService 가 핸들러 호출 **이전**에 이미 해석을 완료하므로, 핸들러 레벨에서는 단순히 값 그대로를 꺼내 `subInput[paramName]` 에 대입합니다.

## Output

### Case 1: `sync` 모드 (인라인 실행)

`executeInline()` 의 반환값이 그대로 `output` 에 담깁니다.

```json
{
  "config": { "workflowId": "wf_uuid_1234", "mode": "sync" },
  "output": { "result": "success", "data": [1, 2, 3] }
}
```

| 필드 | 설명 |
| --- | --- |
| `config.workflowId` | 호출된 워크플로우 ID |
| `config.mode` | `"sync"` |
| `output` | `WorkflowExecutor.executeInline()` 의 반환값 (보통 sub-workflow 최종 노드의 결과) |

`executeInline()` 호출 옵션:

- `executionId`: 부모의 `context.executionId` 를 그대로 재사용 → 같은 실행 타임라인
- `context`: 부모 `ExecutionContext` 전체
- `executedNodes`: 부모의 `_executedNodes` Set (중복 실행 방지 공유)
- `recursionDepth`: `context.recursionDepth + 1`
- `parentNodeExecutionId`: 이 workflow 노드 자신의 `context.nodeExecutionId` — sub-workflow 내부의 모든 NodeExecution 레코드가 이 값으로 스탬프되어, 프론트엔드 타임라인이 Sub-Workflow 카드 아래에 자식을 그룹화할 수 있습니다.

### Case 2: `async` 모드 (비동기 큐 등록)

```json
{
  "config": { "workflowId": "wf_uuid_1234", "mode": "async" },
  "output": { "executionId": "sub-exec-async-1" },
  "meta": { "status": "started" }
}
```

| 필드 | 설명 |
| --- | --- |
| `config.mode` | `"async"` |
| `output.executionId` | 큐에 새로 등록된 sub-execution 의 ID (추적용) |
| `meta.status` | 항상 `"started"` |

`executeAsync()` 호출 옵션:

- `parentExecutionId`: 부모 `context.executionId`
- `recursionDepth`: `context.recursionDepth + 1`

### Case 3: 재귀 깊이 초과 (모든 모드)

`context.recursionDepth ?? 0` 이 **10 이상** 이면 `executeInline`/`executeAsync` 를 호출하지 않고 즉시 throw:

```
Error: Maximum recursion depth exceeded (limit: 10)
```

→ 노드가 실패 처리되고, 연결된 `error` 포트가 없으므로 실행이 중단됩니다.

### Case 4: 내부 에러 전파

- `executeInline()` 혹은 `executeAsync()` 에서 throw 된 에러 (예: `Workflow not found`, sub-workflow 내부 노드 실패, expression 에러 등) 는 **그대로 재던져집니다**. 핸들러가 별도로 변환하지 않습니다.
- sync 모드에서 `context._executedNodes` 가 없으면 실행 전에 `Error('Inline execution requires _executedNodes in context')` 를 throw 합니다. (정상 실행 엔진 호출 경로에서는 항상 세팅되어 있음.)

## 변수로 접근 가능한 항목

이 노드의 라벨이 `Order Sub` 라고 가정.

### `sync` 모드

| 표현식 | 값 예시 | 설명 |
| --- | --- | --- |
| `{{ $node["Order Sub"].config.workflowId }}` | `"wf_uuid_1234"` | 호출한 sub-workflow ID |
| `{{ $node["Order Sub"].config.mode }}` | `"sync"` | 실행 모드 |
| `{{ $node["Order Sub"].output }}` | `{ "result": "success", ... }` | `executeInline` 반환값 (sub-workflow 최종 결과) |
| `{{ $node["Order Sub"].output.<필드> }}` | (반환 객체의 필드) | 반환값에서 dot-path 로 꺼내기 |

### `async` 모드

| 표현식 | 값 예시 | 설명 |
| --- | --- | --- |
| `{{ $node["Order Sub"].config.workflowId }}` | `"wf_uuid_1234"` | 호출한 sub-workflow ID |
| `{{ $node["Order Sub"].config.mode }}` | `"async"` | 실행 모드 |
| `{{ $node["Order Sub"].output.executionId }}` | `"sub-exec-async-1"` | 비동기 실행 추적 ID |
| `{{ $node["Order Sub"].meta.status }}` | `"started"` | 큐 등록 완료 표시 |

> sub-workflow 내부의 노드들은 서브 그래프 안에서만 `$node[...]` 로 참조 가능합니다. 부모와 sub 의 `$node` 네임스페이스는 논리적으로 분리되지만, sync 모드에서는 `executionId`/`_executedNodes`/`nodeOutputCache` 가 공유되므로 히스토리 타임라인은 하나로 엮여 표시됩니다.

## 주의사항

- **최대 재귀 깊이 10**. `MAX_RECURSION_DEPTH = 10` 상수로 고정이며, sync/async 모두 시작 시점에 검사합니다. sub-workflow 체인이 10 단계를 넘으면 10 번째 호출에서 실패합니다.
- **sync 모드** 는 부모 실행과 같은 `executionId`, 같은 `nodeOutputCache`, 같은 `_executedNodes` Set 을 공유합니다. → sub-workflow 노드들이 부모 타임라인에 자식으로 표시되며, 이 workflow 노드의 `nodeExecutionId` 가 `parentNodeExecutionId` 로 모든 자식 NodeExecution 에 스탬프됩니다.
- **async 모드** 는 별도 Execution 레코드와 별도 `executionId` 로 독립 실행됩니다. 부모는 `output.executionId` 만 받고 결과를 기다리지 않은 채 즉시 다음 노드로 진행합니다. 결과 조회는 `executionId` 로 별도 API 를 통해 하세요.
- **`timeout`** 은 현재 핸들러 `execute()` 경로에서 직접 사용되지는 않으며 (`SubWorkflowOptions.timeoutMs` 로 executor 에 전달할 수 있는 스키마만 존재), `validate()` 에서 음수 방지 검증만 수행합니다. UI 에서는 `mode === 'sync'` 일 때만 노출됩니다.
- **`workflowName`** 은 UI 표시용이며 핸들러는 읽지 않습니다. 실제 호출 대상은 `workflowId` 로만 결정됩니다.
- **`inputMapping` 의 `source` expression** 은 핸들러가 아니라 ExecutionEngineService 의 expression resolver 가 노드 호출 직전에 이미 해석합니다. 해석 결과(문자열/숫자/객체 등)가 그대로 sub-workflow input 의 값으로 들어갑니다.
- 위에서 언급한 **스키마 `target`/`source` vs 핸들러 `paramName`/`expression` 키 불일치** 이슈에 주의하세요. 매핑이 기대대로 전달되지 않는다면 가장 먼저 확인할 지점입니다.
- `validate()` 는 `workflowId` 누락/비문자열, 잘못된 `mode`, 음수 `timeout`, 배열이 아닌 `inputMapping`, 각 매핑 항목의 `paramName` 누락을 검사합니다. (`target` 이 아닌 `paramName` 을 검증한다는 점에 유의.)
