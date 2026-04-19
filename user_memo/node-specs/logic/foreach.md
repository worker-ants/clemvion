# ForEach (`foreach`)

> 배열을 순회하며 각 항목마다 body 서브그래프를 실행하는 컨테이너 노드. side-effect 목적에 적합하며, body 결과의 배열 수집은 엔진이 부수적으로 담당합니다 (ForEachExecutor).

- **카테고리**: `logic`
- **컨테이너**: **yes** (`isContainer: true`)
- **Blocking**: no
- **동적 포트**: no

## Config 파라메터

출처: `backend/src/nodes/logic/foreach/foreach.schema.ts`

| 필드명 | 타입 | 필수 | 기본값 | 설명 | 표현식 |
| --- | --- | --- | --- | --- | --- |
| `arrayField` | string \| unknown (expression) | yes | `''` | 순회할 배열. 문자열이면 input에 대한 dot-path, 그 외 타입은 이미 해석된 값으로 간주 | yes (전체가 `{{ ... }}`인 경우 배열 값 그대로 전달됨) |
| `errorPolicy` | `'stop' \| 'skip' \| 'continue'` | no | `'stop'` | body 에러 처리 정책 — stop: 전체 중단 / skip·continue: skipped 엔트리로 기록 후 다음 항목 진행 | no |

## Ports

출처: `backend/src/nodes/logic/foreach/foreach.schema.ts`

| 방향 | id | label | type | 설명 |
| --- | --- | --- | --- | --- |
| Input | `in` | Input | data | 외부 데이터 |
| Input | `emit` | Emit | data | body 서브그래프 끝단 수집 지점 — **반드시 정확히 1개** 노드가 연결 |
| Output | `body` | Body | data | 매 항목마다 본문 서브그래프 진입 |
| Output | `done` | Done | data | 모든 항목 처리 완료 후 활성화 |

## Input

이전 노드로부터 받은 데이터. 핸들러는 `resolveFieldValue(input, arrayField)`로 배열을 해석합니다:
- `arrayField`가 문자열이면 dot-path 탐색
- 이미 배열/값이 들어오면 그대로 사용
- 결과가 배열이 아니면 **빈 배열로 fallback** (에러 아님)

## Output

### 1단계: 핸들러 반환

```json
{
  "config": { "arrayField": "items" },
  "output": [{ "id": 1 }, { "id": 2 }, { "id": 3 }]
}
```

| 필드 | 설명 |
| --- | --- |
| `config.arrayField` | 원본 `arrayField` (path 문자열 또는 해석된 값) |
| `output` | 해석된 배열 (배열이 아니면 `[]`) |

### 2단계: body 반복 (엔진의 ForEachExecutor)

`ForEachExecutor.execute`가 각 항목마다:
- `context.itemContext = { item, index, isFirst, isLast }` 갱신
- body 서브그래프 실행
- `collectResults: true` 기본이라 결과를 배열에 수집
- `errorPolicy`에 따라 실패 시 throw (`'stop'`) 혹은 `{ _skipped: true, error: { code, message } }` 항목 삽입 (`'skip'` / `'continue'`)

### 3단계: 최종 output 재설정

엔진의 `runContainerInner`가 수집된 배열로 ForEach의 output을 덮어씁니다:

```json
{
  "config": { "arrayField": "items", "errorPolicy": "stop" },
  "output": [
    "body emit for item 0",
    "body emit for item 1",
    { "_skipped": true, "error": { "code": "Error", "message": "..." } }
  ]
}
```

그 후 `done` 포트 하류 노드들이 이 배열을 input으로 받습니다.

## 변수로 접근 가능한 항목

이 노드의 라벨이 `For Each Item`이라고 가정.

**다른 노드(루프 외부)에서**:

| 표현식 | 값 예시 | 설명 |
| --- | --- | --- |
| `{{ $node["For Each Item"].config.arrayField }}` | `"items"` | 설정된 경로 또는 해석된 배열 |
| `{{ $node["For Each Item"].output }}` | `[...]` | 최종적으로는 각 반복의 body emit 결과 배열 |
| `{{ $node["For Each Item"].output.length }}` | `3` | 처리된 항목 수 |

**body 내부 노드에서**:

| 표현식 | 값 예시 | 설명 |
| --- | --- | --- |
| `{{ $item }}` | `{ id: 1 }` | 현재 순회 중인 항목 |
| `{{ $item.title }}` | `"Hello"` | 항목 내부 필드 |
| `{{ $itemIndex }}` | `0`, `1`, `2`, ... | 0-based 인덱스 |
| `{{ $loop.isFirst }}` | `true` / `false` | ForEachExecutor도 같은 itemContext만 관리하지만 expression-resolver가 `$loop.*`에도 동일 정보를 노출하는지는 코드 확인 필요 — 안전하게 `$itemIndex` 사용 권장 |

> Loop / ForEach / Map은 expression-resolver에서 각각 `loopContext` / `itemContext`를 별도로 노출합니다. ForEach body 내부에서는 `$item` / `$itemIndex`를 사용하세요.

## 주의사항

- `arrayField` 해석 결과가 배열이 아니면 **빈 배열로 간주** 되어 body는 한 번도 실행되지 않습니다. 에러를 원하면 앞단에서 validation이 필요합니다.
- body 서브그래프 끝단은 정확히 1개만 `emit` 포트에 연결되어야 합니다 (`CONTAINER_MISSING_EMIT` / `CONTAINER_MULTIPLE_EMIT`).
- body 내부에는 Blocking 노드를 둘 수 없습니다.
- `errorPolicy: 'skip'` 과 `'continue'`는 ForEachExecutor 구현상 결과 배열에 skipped 항목을 기록하는 동작이 **동일**합니다 (향후 의미 분리 예정).
- 중첩 ForEach는 외부 itemContext를 복원해 내부 종료 후 외부 `$item`이 다시 노출됩니다.
- Map 노드와 handler 로직은 거의 동일하지만, 의도는 ForEach=side-effect / Map=변환입니다. 결과 배열을 명시적으로 다음 단계에 넘길 거라면 Map을 쓰는 편이 의미가 명확합니다.
