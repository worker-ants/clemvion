# Parallel (`parallel`)

> 입력을 N개의 분기(`branch_0` ~ `branch_{N-1}`)로 동시에 fan-out 시키는 노드. `PARALLEL_ENGINE=v1` 환경에서는 진정한 병렬 실행, off에서는 순차 실행됩니다.

- **카테고리**: `logic`
- **컨테이너**: no (서브그래프를 직접 갖지 않고 분기 포트로 fan-out)
- **Blocking**: no
- **동적 포트**: yes (`parallel-branches`) — `config.branchCount` 만큼 `branch_<i>` 생성 + 정적 `done`

## Config 파라메터

| 필드명 | 타입 | 필수 | 기본값 | 설명 | 표현식 |
| --- | --- | --- | --- | --- | --- |
| `branchCount` | int (2~16) | yes | `2` | 병렬 실행할 분기 수 | no |
| `maxConcurrency` | int (0~16) | no | `0` | 동시 실행 슬롯 수. `0`이면 제한 없음 (`branchCount`와 동일) | no |
| `waitAll` | boolean | no | `true` | 모든 분기 완료 후 `done`으로 진행. Phase P1에서는 항상 true (false 미지원) | no |

## Ports

| 방향 | id | label | 설명 |
| --- | --- | --- | --- |
| Input | `in` | Input | fan-out 시킬 데이터 |
| Output | `branch_0` ... `branch_{N-1}` | Branch 0 ... | 동적 — 각 분기로 동시 라우팅 |
| Output | `done` | Done | 모든 분기 완료 후 라우팅 |

> **동적 포트 생성 규칙** (`resolve-dynamic-ports.ts`):
> `branchCount` 만큼 `{ id: "branch_${i}", label: "Branch ${i}", type: "data" }` + `{ id: "done", label: "Done", type: "data" }`

## Input

input은 변형 없이 모든 분기로 그대로 전달됩니다.

## Output

### Case 1: 핸들러 반환 (fan-out 시작)

```json
{
  "config": { "branchCount": 3, "maxConcurrency": 0, "waitAll": true },
  "output": { "userId": "u_1", "task": "process" },
  "port": ["branch_0", "branch_1", "branch_2"]
}
```

| 필드 | 설명 |
| --- | --- |
| `config.branchCount` | 해석된 분기 수 (clamp: 2~16) |
| `config.maxConcurrency` | 동시 실행 슬롯 수 (clamp: 0~16) |
| `config.waitAll` | 대기 정책 |
| `output` | input 그대로 (모든 분기에 동일하게 전달) |
| `port` | `["branch_0", ..., "branch_{N-1}"]` 배열 — 모든 분기 동시 활성화 |

### Case 2: `done` 포트로 흐르는 값

엔진이 모든 분기 완료 후 `done` 포트로 흐름을 보냅니다. 후속 노드의 input 형태는 엔진 구현(ParallelExecutor)에 따릅니다.

## 변수로 접근 가능한 항목

이 노드의 라벨이 `Fan Out`이라고 가정:

| 표현식 | 값 예시 | 설명 |
| --- | --- | --- |
| `{{ $node["Fan Out"].output }}` | `{ userId: "u_1", task: "process" }` | 분기로 보낸 데이터 (input 그대로) |
| `{{ $node["Fan Out"].port }}` | `["branch_0", "branch_1", "branch_2"]` | 활성화된 모든 분기 ID 배열 |
| `{{ $node["Fan Out"].config.branchCount }}` | `3` | 분기 수 |

## 주의사항

- 진정한 병렬 실행은 `PARALLEL_ENGINE=v1` 환경 변수가 켜져 있어야 동작. off이면 엔진이 분기들을 토폴로지 순서로 순차 실행.
- `branchCount`는 2~16 범위로 clamp. 범위 밖이면 validation 실패.
- `waitAll: false` 옵션은 schema에는 있지만 Phase P1에서 미지원이므로 항상 모든 분기 완료를 기다립니다.
- `port` 필드가 단일 문자열이 아닌 **배열**이라는 점에 주의 — 동시에 여러 포트를 활성화하는 노드.
- 각 분기에는 동일한 input 객체가 전달됩니다 (얕은 참조 공유 — 각 분기에서 input을 mutate하지 마세요).
