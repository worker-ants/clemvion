# Sub-Workflow (`workflow`)

> 다른 워크플로우를 호출합니다. `sync` 모드는 인라인 실행(같은 실행 컨텍스트 공유), `async` 모드는 별도 실행으로 큐에 등록.

- **카테고리**: `flow`
- **컨테이너**: no (다른 워크플로우 자체를 실행)
- **Blocking**: no (sync 모드는 sub-workflow 종료까지 대기, async는 즉시 반환)
- **동적 포트**: no

## Config 파라메터

| 필드명 | 타입 | 필수 | 기본값 | 설명 | 표현식 |
| --- | --- | --- | --- | --- | --- |
| `workflowId` | string (UUID) | yes | `''` | 호출 대상 워크플로우 ID | no |
| `workflowName` | string | no | (없음) | 표시용 이름 (UI hidden) | no |
| `mode` | `'sync' \| 'async'` | no | `'sync'` | 인라인 실행 vs 비동기 큐 등록 | no |
| `inputMapping` | `Mapping[]` | no | `[]` | 부모 input → 서브 워크플로우 input 매핑. 비어있으면 부모 input 전체 전달 | `source`/`expression` 내부 |
| `timeout` | int (초) | no | `300` | (sync 모드) sub-workflow 실행 타임아웃. `0`이면 무제한 | no |

`Mapping` 항목 (스키마 정의):

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `target` | string | 서브 워크플로우 input의 키 이름 |
| `source` | string (expression) | 부모 input에서 가져올 값 표현식 |

> ⚠️ **현재 코드 불일치**: schema는 `target`/`source` 필드를 정의하지만, handler는 `paramName`/`expression`을 읽습니다 (`backend/src/modules/execution-engine/handlers/flow/workflow.handler.ts:8-11, 49, 83-84`). UI 저장과 핸들러 읽기 사이에 키 변환이 있는지, 아니면 단순 버그인지 확인이 필요합니다. 작성자 라벨로는 위와 같이 schema 기준으로 적었으나 실제 사용 시 `paramName`/`expression`도 함께 시도해보세요.

## Ports

| 방향 | id | label | 설명 |
| --- | --- | --- | --- |
| Input | `in` | Input | 부모 워크플로우에서의 입력 |
| Output | `out` | Output | sub-workflow 실행 결과 |

## Input

`inputMapping`이 비어있으면 부모 input 전체를 sub-workflow에 전달. 매핑이 있으면 매핑된 값들로만 구성된 객체를 전달합니다 (expression은 expression resolver가 실행 전에 미리 평가).

## Output

### Case 1: `sync` 모드 — 인라인 실행

```json
{
  "config": { "workflowId": "wf_uuid_1234", "mode": "sync" },
  "output": { "result": "...sub-workflow의 최종 노드 출력..." }
}
```

| 필드 | 설명 |
| --- | --- |
| `config.workflowId` | 호출된 워크플로우 ID |
| `config.mode` | `"sync"` |
| `output` | sub-workflow의 최종 결과 (`executeInline` 반환값) |

### Case 2: `async` 모드 — 큐 등록

```json
{
  "config": { "workflowId": "wf_uuid_1234", "mode": "async" },
  "output": { "executionId": "exec_uuid_5678" },
  "meta": { "status": "started" }
}
```

| 필드 | 설명 |
| --- | --- |
| `config.mode` | `"async"` |
| `output.executionId` | 큐에 등록된 새 실행의 ID (추적용) |
| `meta.status` | `"started"` |

### Case 3: 재귀 깊이 초과

`recursionDepth >= 10` 일 때 throw → 노드 실패. 에러 메시지: `Maximum recursion depth exceeded (limit: 10)`.

## 변수로 접근 가능한 항목

이 노드의 라벨이 `Order Sub`라고 가정.

**sync 모드**:

| 표현식 | 값 예시 | 설명 |
| --- | --- | --- |
| `{{ $node["Order Sub"].output }}` | `{...}` | sub-workflow 최종 결과 |
| `{{ $node["Order Sub"].output.<필드> }}` | (서브 워크플로우 최종 노드의 output 필드) | 서브 결과의 특정 필드 |
| `{{ $node["Order Sub"].config.workflowId }}` | `"wf_uuid_1234"` | 호출 대상 ID |

**async 모드**:

| 표현식 | 값 예시 | 설명 |
| --- | --- | --- |
| `{{ $node["Order Sub"].output.executionId }}` | `"exec_uuid_5678"` | 비동기 실행 추적 ID |
| `{{ $node["Order Sub"].meta.status }}` | `"started"` | 시작됨 |

> sub-workflow 내부의 노드들은 서브 그래프 내에서만 `$node[...]`으로 참조 가능합니다 — 부모 노드와 sub의 `$node` 네임스페이스는 분리됩니다.

## 주의사항

- 최대 재귀 깊이는 10. 그 이상 sub-workflow 호출 체인을 만들면 실행 실패.
- `sync` 모드의 sub-workflow 노드들은 부모와 같은 `executionId`를 공유하여 같은 실행 타임라인에 표시됩니다.
- `async` 모드는 별도 NodeExecution 트리. 결과를 기다리지 않고 즉시 다음 노드로.
- `timeout`은 sync 모드에서만 의미가 있습니다 (UI에서도 mode='sync'일 때만 노출).
- 위에서 언급한 `target`/`source` vs `paramName`/`expression` 불일치를 확인하세요. `inputMapping`이 작동하지 않는다면 양쪽 키를 모두 시도해보거나 매핑을 비워 부모 input 전체 전달로 대체하세요.
