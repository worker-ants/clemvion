# Loop (`loop`)

> N번 반복 실행하는 컨테이너 노드. body 서브그래프를 `count` 만큼 실행하며, 매 반복마다 `$loop` 컨텍스트가 노출됩니다.

- **카테고리**: `logic`
- **컨테이너**: **yes** (`isContainer: true`)
- **Blocking**: no
- **동적 포트**: no

## Config 파라메터

출처: `backend/src/nodes/logic/loop/loop.schema.ts`

| 필드명 | 타입 | 필수 | 기본값 | 설명 | 표현식 |
| --- | --- | --- | --- | --- | --- |
| `count` | string (expression) | yes | `'1'` | 반복 횟수. 정수 리터럴 (`"10"`) 또는 `{{ ... }}` 표현식. 숫자로 변환 불가하면 validate 실패 | yes |
| `maxIterations` | number | no | `1000` | 안전 상한. 엔진의 LoopExecutor에서 `count > maxIterations`면 `MAX_ITERATIONS_EXCEEDED` 에러 | no (핸들러가 number 그대로 취급) |
| `breakCondition` | `ConditionGroup` | no | (없음) | 조건 만족 시 루프 중도 종료. 스키마상 정의되어 있으며 Loop 핸들러 본체에서는 평가하지 않음 — 실제 break 로직은 엔진에서 처리 예정 | yes (조건 `field`/`value`) |

## Ports

출처: `backend/src/nodes/logic/loop/loop.schema.ts`

| 방향 | id | label | type | 설명 |
| --- | --- | --- | --- | --- |
| Input | `in` | Input | data | 외부에서 들어오는 데이터 |
| Input | `emit` | Emit | data | body 서브그래프 끝단이 Loop로 합류하는 수집 지점 — **반드시 정확히 1개** 노드가 연결되어야 함 |
| Output | `body` | Body | data | 매 반복마다 본문 서브그래프 진입 |
| Output | `done` | Done | data | 모든 반복 완료 후 활성화 |

## Input

핸들러 자체는 input을 사용하지 않습니다(`_input`). 실제 반복은 엔진의 `LoopExecutor` (`backend/src/modules/execution-engine/containers/loop-executor.ts`)가 수행하며, 각 반복의 body 결과를 다음 반복의 input으로 전달합니다 (`previousOutput`). 첫 반복의 input은 `undefined`.

## Output

### 1단계: 핸들러 반환 (반복 시작 직전)

```json
{
  "config": { "count": 5, "maxIterations": 1000 },
  "output": null
}
```

| 필드 | 설명 |
| --- | --- |
| `config.count` | 해석된 반복 횟수 (`parseNumeric`로 number 변환) |
| `config.maxIterations` | 해석된 안전 상한 (미설정 시 1000) |
| `output` | `null` — 핸들러는 컨테이너 진입 신호만 전달 |

`meta` / `port` / `status` 는 핸들러에서 반환하지 않습니다.

### 2단계: body 반복 (엔진의 LoopExecutor)

`LoopExecutor.execute`가 `count` 번 반복하며:
- `context.loopContext = { index, count, isFirst, isLast }` 를 매 반복마다 갱신
- body 서브그래프를 실행하고 leaf(= emit 포트에 도달한) 출력을 수집
- 이전 반복의 output을 다음 반복의 input으로 전달
- `count > maxIterations` 또는 루프 도중 인덱스가 `maxIterations`를 넘으면 `MAX_ITERATIONS_EXCEEDED` 에러

### 3단계: 반복 종료 후 최종 output 재설정

엔진 (`execution-engine.service.ts`의 `runContainerInner`)이 `collected.map(r => r.output)` 을 Loop 노드의 최종 `output`으로 덮어씁니다.

```json
{
  "config": { "count": 3, "maxIterations": 1000 },
  "output": [
    "body result of iteration 0",
    "body result of iteration 1",
    "body result of iteration 2"
  ]
}
```

그 후 `done` 포트 하류 노드들이 이 output을 input으로 받습니다.

## 변수로 접근 가능한 항목

이 노드의 라벨이 `Retry Loop`라고 가정.

**다른 노드(루프 외부)에서**:

| 표현식 | 값 예시 | 설명 |
| --- | --- | --- |
| `{{ $node["Retry Loop"].config.count }}` | `5` | 해석된 반복 횟수 |
| `{{ $node["Retry Loop"].config.maxIterations }}` | `1000` | 안전 상한 |
| `{{ $node["Retry Loop"].output }}` | `[result0, result1, ...]` | 각 반복의 body 결과 배열 (엔진이 최종적으로 덮어씀) |
| `{{ $node["Retry Loop"].output[0] }}` | `result0` | 첫 반복 결과 |

**body 내부 노드에서** (Loop가 노출하는 추가 전역 컨텍스트):

| 표현식 | 값 예시 | 설명 |
| --- | --- | --- |
| `{{ $loop.index }}` | `0`, `1`, `2`, ... | 0-based 인덱스 |
| `{{ $loop.iteration }}` | `1`, `2`, `3`, ... | `index + 1` (1-based) |
| `{{ $loop.isFirst }}` | `true` / `false` | 첫 반복 여부 |
| `{{ $loop.isLast }}` | `true` / `false` | 마지막 반복 여부 |

## 주의사항

- `count`가 표현식(`{{ ... }}`)이면 validate 단계에서는 통과시키고, execute 시 expression resolver가 해석한 값을 사용합니다.
- validate는 `count`와 `maxIterations`가 모두 리터럴일 때만 `count <= maxIterations`를 검사합니다.
- `maxIterations`가 실제 안전 상한으로 강제되는 시점은 **엔진의 LoopExecutor**이며, 핸들러는 리턴 값에 넣기만 합니다. 기본값은 `1000`.
- body 서브그래프의 끝단은 정확히 1개만 Loop의 `emit` 포트로 연결되어야 합니다 (위반 시 `CONTAINER_MISSING_EMIT` / `CONTAINER_MULTIPLE_EMIT` 에러).
- body 내부에는 `form`, blocking AI 노드 같은 Blocking 노드를 둘 수 없습니다 (워크플로우 레벨에서만 허용).
- `breakCondition` 은 schema에 정의되어 있으나 본 버전의 Loop 핸들러/LoopExecutor는 schema에서 받은 callback 형태의 break 조건만 지원 — UI로 설정한 조건이 자동 평가되지는 않습니다.
- 중첩 Loop는 prior `loopContext` 를 복원하므로 외부 루프의 `$loop.*` 값이 내부 루프 종료 후 다시 노출됩니다.
