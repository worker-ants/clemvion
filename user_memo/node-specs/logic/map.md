# Map (`map`)

> 배열의 각 항목을 본문 서브그래프로 변환한 뒤 결과를 새 배열로 수집하는 컨테이너 노드. ForEach와 구조가 같지만 **각 항목의 변환 결과를 수집해서 배열로 반환**하는 점이 다릅니다.

- **카테고리**: `logic`
- **컨테이너**: yes (`isContainer: true`)
- **Blocking**: no
- **동적 포트**: no

## Config 파라메터

| 필드명 | 타입 | 필수 | 기본값 | 설명 | 표현식 |
| --- | --- | --- | --- | --- | --- |
| `inputField` | string (expression) | yes | `''` | 변환할 배열을 가리키는 dot-path 또는 inline 표현식 | yes |
| `errorPolicy` | `'stop' \| 'skip' \| 'continue'` | no | `'stop'` | 항목 처리 중 에러 발생 시 동작 (ForEach와 동일) | no |

## Ports

| 방향 | id | label | 설명 |
| --- | --- | --- | --- |
| Input | `in` | Input | 외부 입력 (배열을 포함한 객체) |
| Input | `emit` | Emit | body 끝단에서 변환 결과를 수집하는 지점 (정확히 1개 노드만 연결) |
| Output | `body` | Body | 매 항목마다 본문 서브그래프 진입 |
| Output | `done` | Done | 모든 항목 변환 완료 후 — **수집된 결과 배열**이 다음 노드 input으로 |

## Input

ForEach와 동일한 방식으로 `inputField`를 해석합니다.

- dot-path면 input에서 추출
- inline 표현식이면 미리 해석된 값이 들어옴
- 결과가 배열이 아니면 `[]`로 처리

## Output

### Case 1: 핸들러 반환

```json
{
  "config": { "inputField": "items" },
  "output": [
    { "id": "p1", "qty": 2 },
    { "id": "p2", "qty": 1 }
  ]
}
```

### Case 2: body 내부 컨텍스트 (ForEach와 동일)

| 변수 | 설명 |
| --- | --- |
| `$item` | 현재 변환할 항목 |
| `$itemIndex` | 인덱스 (0-based) |
| `$loop.*` | 루프 메타 정보 |

본문 서브그래프 끝단의 `emit` 포트에 연결된 노드의 출력값이 **항목별 변환 결과**로 수집됩니다.

### Case 3: `done` 포트로 흐르는 값

엔진이 모든 변환 완료 후 `done` 포트로 보냅니다. 다음 노드의 input은 **수집된 변환 결과 배열** (원본 인덱스 순서 유지). 정확한 형태는 `errorPolicy`에 따라:

- `stop`: 첫 에러에서 중단, 노드 실패
- `skip`: 에러 항목은 `{_skipped: true, error: "..."}` 로 채워짐
- `continue`: 에러 항목도 빈 결과나 마지막 정상 결과로 포함 (엔진 구현)

## 변수로 접근 가능한 항목

이 노드의 라벨이 `Transform Items`라고 가정.

**다른 노드(Map 외부)에서**:

| 표현식 | 값 예시 | 설명 |
| --- | --- | --- |
| `{{ $node["Transform Items"].output }}` | `[{...}, {...}]` | 추출된 입력 배열 (변환 시작 시점) |
| `{{ $node["Transform Items"].config.inputField }}` | `"items"` | 입력 dot-path |

> **중요**: `$node["Transform Items"].output`은 변환 **이전** 입력 배열입니다. 변환 결과 배열은 done 포트 다음 노드의 `$input`으로만 접근 가능합니다.

**body 내부 노드에서**:

| 표현식 | 값 예시 | 설명 |
| --- | --- | --- |
| `{{ $item }}` | `{ id: "p1", qty: 2 }` | 변환할 항목 |
| `{{ $itemIndex }}` | `0`, `1`, ... | 인덱스 |

## ForEach와의 차이

| 측면 | ForEach | Map |
| --- | --- | --- |
| 본문에서 결과 수집 | 결과 무시 가능 (사이드이펙트 위주) | 각 항목의 변환 결과를 새 배열로 수집 |
| 사용 사례 | API 호출 N번, 알림 발송 등 | 배열의 각 항목을 객체 변환, 필드 추가 등 |
| `done` 포트 다음 input | (엔진이 ForEach 결과를 어떻게 만들지 결정 — 보통 입력 그대로 통과) | **변환된 배열** |

## 주의사항

- `inputField` 누락 시 validation 실패.
- 결과가 배열이 아니면 빈 배열로 fall-through (조용한 처리).
- body 끝단 `emit` 노드는 정확히 1개여야 함.
- body 내부 blocking 노드 금지.
- `$node["Map 노드"].output`은 입력 배열입니다 — 변환 결과는 후속 노드의 `$input`으로 받으세요.
