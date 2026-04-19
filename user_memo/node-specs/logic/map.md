# Map (`map`)

> 배열을 순회하며 각 항목을 body 서브그래프로 변환한 뒤 결과를 새 배열로 수집하는 컨테이너 노드. ForEach와 handler 로직은 거의 동일하지만, 의도는 **변환된 값 배열을 후속 단계로 넘기는 것**입니다.

- **카테고리**: `logic`
- **컨테이너**: **yes** (`isContainer: true`)
- **Blocking**: no
- **동적 포트**: no

## Config 파라메터

출처: `backend/src/nodes/logic/map/map.schema.ts`

| 필드명 | 타입 | 필수 | 기본값 | 설명 | 표현식 |
| --- | --- | --- | --- | --- | --- |
| `inputField` | string \| unknown (expression) | yes | `''` | 순회할 배열. 문자열이면 input에 대한 dot-path, 그 외 타입은 이미 해석된 값으로 간주 | yes |
| `errorPolicy` | `'stop' \| 'skip' \| 'continue'` | no | `'stop'` | body 에러 처리 정책. ForEach와 동일 | no |

## Ports

출처: `backend/src/nodes/logic/map/map.schema.ts`

| 방향 | id | label | type | 설명 |
| --- | --- | --- | --- | --- |
| Input | `in` | Input | data | 외부 데이터 |
| Input | `emit` | Emit | data | body 서브그래프의 변환 결과 수집 지점 — **반드시 정확히 1개** 노드가 연결 |
| Output | `body` | Body | data | 매 항목마다 body 진입 |
| Output | `done` | Done | data | 모든 항목 처리 완료 후 활성화. output은 변환 결과 배열 |

## Input

이전 노드로부터 받은 데이터. 핸들러는 `resolveFieldValue(input, inputField)`로 배열을 해석합니다:
- `inputField`가 문자열이면 dot-path 탐색
- 이미 배열/값이 들어오면 그대로 사용
- 결과가 배열이 아니면 **빈 배열로 fallback**

## Output

### 1단계: 핸들러 반환

```json
{
  "config": { "inputField": "items" },
  "output": [{ "id": 1 }, { "id": 2 }]
}
```

| 필드 | 설명 |
| --- | --- |
| `config.inputField` | 원본 `inputField` |
| `output` | 해석된 원본 배열 (배열이 아니면 `[]`) |

### 2단계: body 반복 (엔진의 ForEachExecutor 공유)

`ForEachExecutor.execute`가 각 항목마다:
- `context.itemContext = { item, index, isFirst, isLast }` 갱신
- body 서브그래프 실행
- 결과(= emit 포트로 도달한 값) 수집
- `errorPolicy` 처리 방식은 ForEach와 동일

### 3단계: 최종 output 재설정

엔진이 수집된 변환 결과 배열로 Map의 output을 덮어씁니다:

```json
{
  "config": { "inputField": "items", "errorPolicy": "stop" },
  "output": [
    { "transformedItemFor": "items[0]" },
    { "transformedItemFor": "items[1]" }
  ]
}
```

`done` 포트 하류 노드들이 이 변환 결과 배열을 input으로 받습니다.

## 변수로 접근 가능한 항목

이 노드의 라벨이 `Map Items`라고 가정.

**다른 노드(루프 외부)에서**:

| 표현식 | 값 예시 | 설명 |
| --- | --- | --- |
| `{{ $node["Map Items"].config.inputField }}` | `"items"` | 설정된 경로 |
| `{{ $node["Map Items"].output }}` | `[...변환결과]` | 최종 변환 결과 배열 |
| `{{ $node["Map Items"].output.length }}` | `2` | 변환된 항목 수 |
| `{{ $node["Map Items"].output[0].price }}` | `...` | 변환된 첫 항목의 필드 |

**body 내부 노드에서**:

| 표현식 | 값 예시 | 설명 |
| --- | --- | --- |
| `{{ $item }}` | 원본 배열 항목 | 현재 변환 중인 입력 |
| `{{ $item.name }}` | 항목 내부 필드 | |
| `{{ $itemIndex }}` | `0`, `1`, ... | 0-based 인덱스 |

## 주의사항

- 배열이 아닌 값이 들어오면 빈 배열이 되어 body는 실행되지 않습니다.
- body 서브그래프 끝단은 정확히 1개만 `emit` 포트에 연결되어야 합니다 (`CONTAINER_MISSING_EMIT` / `CONTAINER_MULTIPLE_EMIT`).
- `errorPolicy: 'skip'` / `'continue'`는 결과 배열에 `{ _skipped: true, error: {...} }` 형태로 항목이 들어갑니다. 후속 노드에서 이를 걸러내야 할 수 있습니다.
- body 내부에는 Blocking 노드를 둘 수 없습니다.
- 의도가 side-effect(예: 각 항목을 외부 API로 전송)라면 **ForEach** 를, 변환 결과 자체가 필요하면 **Map** 을 쓰세요. handler 로직은 거의 같지만 문서/의미 분리를 위한 구분입니다.
- 중첩 Map / ForEach는 외부 itemContext를 복원합니다.
