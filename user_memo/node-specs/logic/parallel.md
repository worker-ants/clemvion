# Parallel (`parallel`)

> 입력을 N개의 분기(`branch_0` ~ `branch_{N-1}`)로 fan-out 시키는 노드. `PARALLEL_ENGINE=v1` 모드에서는 `p-limit` 기반 동시 실행, off이면 엔진이 순차적으로 분기를 실행합니다. 모든 분기가 끝나면 `done` 포트로 수집 결과를 보냅니다.

- **카테고리**: `logic`
- **컨테이너**: no (독립 서브그래프가 아니라 fan-out 노드로 관리됨)
- **Blocking**: no
- **동적 포트**: **yes** (`kind: 'parallel-branches'`)

## Config 파라메터

출처: `backend/src/nodes/logic/parallel/parallel.schema.ts`

| 필드명 | 타입 | 필수 | 기본값 | 설명 | 표현식 |
| --- | --- | --- | --- | --- | --- |
| `branchCount` | integer (2~16) | no | `2` | 동시 활성화할 분기 개수. `branch_0` ~ `branch_{N-1}` 포트가 동적 생성됨. 16 초과 값은 핸들러에서 16으로 클램프 | no |
| `maxConcurrency` | integer (0~16) | no | `0` | 동시에 실행할 분기 수 (`0` = `branchCount`와 동일, 제한 없음). 값이 `branchCount` 보다 작으면 나머지는 대기 | no |
| `waitAll` | boolean | no | `true` | 스키마상 정의. **Phase P1 엔진은 항상 `true`로 동작** — `false`로 설정해도 fire-and-forget 되지 않고 로그 warning만 출력. 실제 fire-and-forget 이 필요하면 `background` 노드 사용 | no |

## Ports

출처: `backend/src/nodes/logic/parallel/parallel.schema.ts`, 동적 포트는 `frontend/src/lib/node-definitions/resolve-dynamic-ports.ts`의 `parallelBranchPorts`

| 방향 | id | label | type | 설명 |
| --- | --- | --- | --- | --- |
| Input | `in` | Input | data | fan-out 될 데이터 |
| Output (정적) | `done` | Done | data | 모든 분기 완료 후 활성화. 수집된 분기별 최종 output 배열이 전달됨 |
| Output (동적) | `branch_0` ~ `branch_{branchCount-1}` | `Branch N` | data | 각 분기의 body 진입. 핸들러 단계에서 **모두 동시에 `port` 배열로 활성화** |

## Input

핸들러는 input을 그대로 pass-through 합니다. 각 분기는 동일한 input을 받아 자신만의 서브그래프를 실행합니다 (분기별 context는 shallow clone, `itemContext` / `loopContext` 는 초기화 — ParallelExecutor).

## Output

### 1단계: 핸들러 반환 (fan-out)

```json
{
  "config": { "branchCount": 3, "maxConcurrency": 0, "waitAll": true },
  "output": { "incoming": "data" },
  "port": ["branch_0", "branch_1", "branch_2"]
}
```

| 필드 | 설명 |
| --- | --- |
| `config.branchCount` | 클램프된 값 (2~16) |
| `config.maxConcurrency` | 클램프된 값 (0~16) |
| `config.waitAll` | 원본 값 (엔진은 항상 true로 취급) |
| `output` | input 그대로 |
| `port` | **배열** 형태. branch 포트 N개 동시 활성화 |

### 2단계: 분기 실행 (엔진 `runParallel` + `ParallelExecutor`)

- 각 분기의 exclusive body 서브그래프를 `p-limit(maxConcurrency)` 로 `Promise.allSettled` 실행
- 분기 실패는 `errorPolicy` 에 따라 처리: `errorPolicy=stop` 이면 첫 실패를 throw (Parallel 노드 FAILED), `continue` 계열이면 나머지 분기도 끝까지 실행

### 3단계: 분기 종료 후 output 재설정 + `done` 포트 활성화

엔진이 다음과 같이 output을 덮어씁니다:

```json
{
  "config": { "branchCount": 3, "maxConcurrency": 0, "waitAll": true },
  "output": [
    "branch_0 terminal output",
    "branch_1 terminal output",
    "branch_2 terminal output"
  ],
  "port": ["done"]
}
```

각 원소는 해당 분기의 **마지막(terminal) 노드의 output** 입니다. 내부적으로 `_selectedPort` 프로퍼티로 branch_N 에지를 마스킹하고 `done` 에지만 활성화합니다.

`done` 포트 하류 노드의 input은 `{ branches: [...] }` 형태입니다 (`context.nodeOutputCache` 에 `{ _selectedPort: ['done'], branches: [...] }` 로 저장되고, input 수집 단계에서 `_selectedPort`가 제거됨).

## 변수로 접근 가능한 항목

이 노드의 라벨이 `Fan Out`이라고 가정:

| 표현식 | 값 예시 | 설명 |
| --- | --- | --- |
| `{{ $node["Fan Out"].output }}` | `[branch0result, branch1result, ...]` | 최종 수집된 분기별 terminal output 배열 (엔진이 덮어쓴 값) |
| `{{ $node["Fan Out"].output[0] }}` | 첫 분기의 terminal output | |
| `{{ $node["Fan Out"].port }}` | `["done"]` | 최종 활성화된 포트 |
| `{{ $node["Fan Out"].config.branchCount }}` | `3` | 분기 수 |
| `{{ $node["Fan Out"].config.maxConcurrency }}` | `0` | 동시 실행 제한 (0 = 제한 없음) |

`done` 하류 노드의 input(`$input`)은 `{ branches: [...] }` 구조로 들어옵니다. 즉 `{{ $input.branches[0] }}` 식으로 접근 가능.

## 주의사항

- `branchCount` 는 정수 2~16 범위. 범위 밖이면 validate 실패 또는 handler에서 클램프.
- `maxConcurrency = 0` 은 "제한 없음 (= branchCount 만큼 동시 실행)" 의미입니다. 분기 수보다 작으면 나머지는 p-limit 큐에서 대기.
- `waitAll: false` 는 Phase P1에서 **무시**됩니다. fire-and-forget 이 필요하면 `background` 노드를 쓰세요.
- 각 분기의 서브그래프 끝단은 각자 독립적으로 실행되며, 끝단의 output이 `done` 배열에 수집됩니다. 한 분기에 여러 leaf가 있으면 `sortedNodeIds`의 **마지막 노드** 의 output이 사용됩니다.
- 분기 간 공유 변수는 각 분기 시작 시 `variables` 를 **shallow clone** 하므로 한 분기의 `$var` 변경이 다른 분기에 영향을 주지 않습니다. 단 참조된 객체 내부 mutation은 공유.
- `errorPolicy=stop` 에서는 첫 실패 시점에 나머지 분기도 취소 시도하지 않고 `Promise.allSettled` 결과에서 첫 failure를 throw.
- 실제 병렬 실행은 `PARALLEL_ENGINE=v1` feature flag 가 활성화된 경우에 한합니다. off이면 엔진의 기본 순차 루프로 fallback.
