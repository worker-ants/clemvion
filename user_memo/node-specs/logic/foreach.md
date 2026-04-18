# ForEach (`foreach`)

> 배열을 순회하며 각 항목에 대해 본문(body) 서브그래프를 실행하는 컨테이너 노드. 매 반복마다 `$item` / `$itemIndex` 가 노출됩니다.

- **카테고리**: `logic`
- **컨테이너**: yes (`isContainer: true`)
- **Blocking**: no
- **동적 포트**: no

## Config 파라메터

| 필드명 | 타입 | 필수 | 기본값 | 설명 | 표현식 |
| --- | --- | --- | --- | --- | --- |
| `arrayField` | string (expression) | yes | `''` | 순회할 배열을 가리키는 dot-path(`"items"`, `"order.items"`) 또는 inline 표현식(`{{ $var.list }}`) | yes |
| `errorPolicy` | `'stop' \| 'skip' \| 'continue'` | no | `'stop'` | 항목 실행 중 에러 발생 시 동작 (아래 표 참고) | no |

`errorPolicy` 동작:

| 값 | 동작 |
| --- | --- |
| `stop` | 첫 에러 발생 즉시 ForEach 노드 실패 |
| `skip` | 에러 항목은 결과에 `{_skipped: true, error}` 로 삽입하고 다음 항목 진행 |
| `continue` | 에러 항목도 결과에 포함, 에러 정보는 NodeExecution 로그에만 기록 |

## Ports

| 방향 | id | label | 설명 |
| --- | --- | --- | --- |
| Input | `in` | Input | 외부에서 들어오는 데이터 (보통 배열을 포함한 객체) |
| Input | `emit` | Emit | body 끝단에서 다시 ForEach로 합류시키는 수집 지점 (정확히 1개 노드만 연결) |
| Output | `body` | Body | 매 항목마다 본문 서브그래프 진입 |
| Output | `done` | Done | 모든 항목 처리 후 라우팅 (수집된 결과 배열을 다음 노드 input으로) |

## Input

핸들러는 input과 `config.arrayField`를 받아 다음과 같이 처리합니다.

- `arrayField`가 dot-path(`"items"`, `"order.items"`)면 → `input` 객체에서 해당 경로의 값을 추출
- `arrayField`가 inline 표현식(`{{ $var.list }}`)이면 → expression resolver가 미리 평가한 값이 `arrayField`에 들어옴

추출 결과가 배열이 아니면 빈 배열 `[]`로 간주합니다.

## Output

### Case 1: 핸들러 반환 (반복 시작 직전)

```json
{
  "config": { "arrayField": "items" },
  "output": [
    { "id": "p1", "qty": 2 },
    { "id": "p2", "qty": 1 }
  ]
}
```

| 필드 | 설명 |
| --- | --- |
| `config.arrayField` | 사용된 arrayField 값 (dot-path 또는 해석된 배열) |
| `output` | 추출된 배열 (배열이 아니면 `[]`) |

### Case 2: body 내부에서 노출되는 컨텍스트

본문 서브그래프의 노드들은 다음 변수에 접근:

| 변수 | 설명 |
| --- | --- |
| `$item` | 현재 항목 값 (배열 원소) |
| `$itemIndex` | 현재 항목 인덱스 (0-based) |
| `$loop.index`, `$loop.iteration`, `$loop.isFirst`, `$loop.isLast` | itemContext와 동일 정보를 loop 형식으로도 접근 가능 |

### Case 3: `done` 포트 흐름

엔진은 모든 항목 처리 완료 후 `done` 포트로 흐름을 보냅니다. 후속 노드의 input에는 본문 결과가 원본 인덱스 순서로 수집된 배열이 전달됩니다 (정확한 형태는 엔진 처리에 따름; `errorPolicy`에 따라 `_skipped` 항목 포함 가능).

## 변수로 접근 가능한 항목

이 노드의 라벨이 `Process Items`라고 가정.

**다른 노드(ForEach 외부)에서**:

| 표현식 | 값 예시 | 설명 |
| --- | --- | --- |
| `{{ $node["Process Items"].output }}` | `[{...}, {...}]` | 추출된 배열 (반복 시작 시점) |
| `{{ $node["Process Items"].output.length }}` | `2` | 항목 개수 |
| `{{ $node["Process Items"].config.arrayField }}` | `"items"` | 사용된 arrayField |

**body 내부 노드에서** (ForEach가 노출하는 추가 컨텍스트):

| 표현식 | 값 예시 | 설명 |
| --- | --- | --- |
| `{{ $item }}` | `{ id: "p1", qty: 2 }` | 현재 배열 항목 |
| `{{ $item.id }}` | `"p1"` | 항목의 특정 필드 |
| `{{ $itemIndex }}` | `0`, `1`, ... | 0-based 인덱스 |
| `{{ $loop.iteration }}` | `1`, `2`, ... | 1-based 반복 번호 |
| `{{ $loop.isFirst }}` / `{{ $loop.isLast }}` | bool | 첫/마지막 항목 여부 |

## 주의사항

- `arrayField` 누락 시 validation 실패. 빈 문자열도 허용되지 않음.
- 추출 결과가 배열이 아니면 에러를 던지지 않고 빈 배열로 처리합니다 (조용한 fallback).
- body 서브그래프 끝단은 정확히 하나의 노드만 `emit` 포트에 연결되어야 합니다.
- body 내부에는 form 같은 blocking 노드를 둘 수 없습니다.
- `$item` 은 ForEach 외부에서는 `undefined`. 외부에서 결과 항목을 참조하려면 `done` 이후 후속 노드에서 `$input[N]` 형태로 사용하거나 Map 노드를 활용하세요.
