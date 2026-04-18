# Loop (`loop`)

> N번 반복 실행하는 컨테이너 노드. 본문(body) 서브그래프를 `count` 만큼 실행하며, 매 반복마다 `$loop` 컨텍스트가 노출됩니다.

- **카테고리**: `logic`
- **컨테이너**: yes (`isContainer: true`)
- **Blocking**: no
- **동적 포트**: no

## Config 파라메터

| 필드명 | 타입 | 필수 | 기본값 | 설명 | 표현식 |
| --- | --- | --- | --- | --- | --- |
| `count` | string (expression) | yes | `'1'` | 반복 횟수. 정수 리터럴(`"10"`) 또는 `{{ ... }}` 표현식 | yes |
| `maxIterations` | number | no | `1000` | 안전장치 — 이 횟수를 초과하지 않음 | no |
| `breakCondition` | `ConditionGroup` | no | (없음) | 조건 만족 시 루프 중도 종료 (If/Else와 동일 스키마) | yes |

## Ports

| 방향 | id | label | 설명 |
| --- | --- | --- | --- |
| Input | `in` | Input | 외부에서 들어오는 데이터 |
| Input | `emit` | Emit | body 서브그래프 끝단에서 다시 Loop로 합류시키는 수집 지점 (1개 노드만 연결 가능) |
| Output | `body` | Body | 매 반복마다 본문 서브그래프 진입 |
| Output | `done` | Done | 모든 반복 완료 후 라우팅 |

## Input

핸들러 자체는 input을 사용하지 않고 무시합니다(`_input`). 실제 반복은 엔진의 컨테이너 메커니즘이 수행합니다.

## Output

### Case 1: 핸들러 반환 (반복 시작 직전)

```json
{
  "config": { "count": 5, "maxIterations": 1000 },
  "output": null
}
```

| 필드 | 설명 |
| --- | --- |
| `config.count` | 해석된 반복 횟수 (number로 강제 변환됨) |
| `config.maxIterations` | 해석된 안전 상한 |
| `output` | `null` (핸들러는 컨테이너 진입 신호만 전달) |

### Case 2: body 서브그래프 내부에서 노출되는 컨텍스트

매 반복마다 본문 노드들은 다음 변수에 접근 가능:

| 변수 | 설명 |
| --- | --- |
| `$loop.index` | 현재 인덱스 (0부터 시작) |
| `$loop.iteration` | `index + 1` |
| `$loop.isFirst` | 첫 반복 여부 |
| `$loop.isLast` | 마지막 반복 여부 |

### Case 3: `done` 포트로 흘러가는 값

엔진이 모든 반복 종료 후 `done` 포트로 흐름을 보냅니다. 후속 노드의 input은 컨테이너 종료 시점의 합류 결과(엔진 구현에 따라 결정)를 받습니다.

## 변수로 접근 가능한 항목

이 노드의 라벨이 `Retry Loop`라고 가정.

**다른 노드(루프 외부)에서**:

| 표현식 | 값 예시 | 설명 |
| --- | --- | --- |
| `{{ $node["Retry Loop"].config.count }}` | `5` | 결정된 반복 횟수 |
| `{{ $node["Retry Loop"].config.maxIterations }}` | `1000` | 안전 상한 |
| `{{ $node["Retry Loop"].output }}` | `null` | 항상 null (핸들러 자체 출력 없음) |

**body 내부 노드에서** (Loop가 노출하는 추가 컨텍스트):

| 표현식 | 값 예시 | 설명 |
| --- | --- | --- |
| `{{ $loop.index }}` | `0`, `1`, `2`, ... | 0-based 인덱스 |
| `{{ $loop.iteration }}` | `1`, `2`, `3`, ... | 1-based 반복 횟수 |
| `{{ $loop.isFirst }}` | `true` / `false` | 첫 반복 여부 |
| `{{ $loop.isLast }}` | `true` / `false` | 마지막 반복 여부 |

## 주의사항

- `count`가 표현식(`{{ ... }}`)인 경우 validate 단계에서는 통과시키고, execute 시 해석된 값을 사용합니다.
- `count` 가 `maxIterations`를 초과하면 안 됩니다 (validate에서 거름, 단 둘 중 하나라도 표현식이면 검사 생략).
- `breakCondition`은 schema에 정의되어 있으나 핸들러는 받기만 하고 실제 break는 엔진이 매 반복 후 평가합니다.
- body 서브그래프의 끝단 노드는 정확히 1개만 `emit` 포트에 연결되어야 합니다 (CONTAINER_MISSING_EMIT / CONTAINER_MULTIPLE_EMIT 에러).
- body 내부에는 form 같은 blocking 노드를 둘 수 없습니다.
