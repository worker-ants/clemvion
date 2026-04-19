# Loop (`loop`) — Output 일관성 개선안

- **카테고리**: logic
- **현 문서**: [../../node-specs/logic/loop.md](../../node-specs/logic/loop.md)
- **전역 규칙**: [../CONVENTIONS.md](../CONVENTIONS.md)

## 1. 현재 Output 구조 요약

N 번 반복 실행되는 컨테이너 노드. 핸들러는 단순히 `output: null` 을 반환하고, 엔진의 `LoopExecutor` / `runContainerInner` 가 반복 종료 후 `collected.map(r => r.output)` 결과로 output 을 덮어씁니다.

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

특징 요약:

- **컨테이너 노드**: `isContainer: true`.
- 핸들러는 `{ config, output: null }` 반환, 엔진이 최종 `output` 을 덮어씀.
- 최종 `output` 이 **단순 배열** — 배열이 곧 결과라는 의미는 직관적이지만, count/metadata 가 같은 레벨에서 부재.
- `$loop.index`, `$loop.iteration`, `$loop.isFirst`, `$loop.isLast` 를 body 내부에 노출.
- `breakCondition` 은 schema 에 있지만 본 버전 엔진에서 자동 평가되지 않음 (dormant).

## 2. 식별된 불일치

| # | 항목 | 위반한 Principle | 설명 |
| --- | --- | --- | --- |
| 1 | 최종 `output` 이 단순 배열 | Principle 9.2 | CONVENTIONS 9.2 에 따르면 `{ iterations: [...], count: N }` 이어야 함 — foreach/map/parallel 과 네이밍 대칭성 확보 |
| 2 | `meta.durationMs`, `meta.iterations` 부재 | Principle 2 | 공통 메트릭 + 컨테이너 전용 `iterations` 메트릭 누락 |
| 3 | 핸들러 반환에서 오버라이트 컨트랙트 문서화 미흡 | Principle 9.1 | `output: null` → 엔진 덮어쓰기 규칙이 코드상으로만 명시, 문서/계약이 없음 |
| 4 | `breakCondition` dead field | Principle 7 / 3.1 | 사용자가 설정해도 동작 안함 — schema 에서 제거하거나 엔진에서 구현 |
| 5 | 첫 반복의 input 이 `undefined` | Principle 10 | 이전 반복 output 을 다음 input 으로 전달하는 구조상 첫 반복은 `undefined` — 명시적 문서화 필요 |

## 3. 제안된 Output 구조

### Before (엔진 덮어쓰기 후)

```json
{
  "config": { "count": 3, "maxIterations": 1000 },
  "output": [
    "body result 0",
    "body result 1",
    "body result 2"
  ]
}
```

### After

```json
{
  "config": { "count": 3, "maxIterations": 1000 },
  "output": {
    "iterations": [
      "body result 0",
      "body result 1",
      "body result 2"
    ],
    "count": 3
  },
  "meta": {
    "durationMs": 142,
    "iterations": 3,
    "maxIterationsReached": false
  },
  "port": "done"
}
```

**핵심 변경점**:

- 최종 `output` 을 `{ iterations: [...], count: N }` 객체로 래핑 — Principle 9.2 대로.
- 단순 배열 접근 `$node["X"].output[0]` → `$node["X"].output.iterations[0]` 로 이동. **Breaking change**.
- `meta.iterations`, `meta.durationMs`, `meta.maxIterationsReached` 추가.
- 핸들러 반환 규칙 문서화: "`output: null` 반환 시 엔진이 덮어쓴다" (Principle 9.1).
- `port: 'done'` 을 명시적으로 설정.
- `breakCondition` 은 schema 에서 제거 (P1) — 구현되지 않은 필드는 혼란만 유발.
- 에러 시 (`MAX_ITERATIONS_EXCEEDED`) 는 Principle 3.1 에 따라 pre-flight 에러로 throw 유지.

## 4. 마이그레이션 영향도

| Expression 경로 (Before) | Expression 경로 (After) | Breaking? | 비고 |
| --- | --- | --- | --- |
| `$node["X"].output` | `$node["X"].output.iterations` | **Yes** | 배열이 서브필드로 이동 |
| `$node["X"].output[0]` | `$node["X"].output.iterations[0]` | **Yes** | 접근 경로 변경 |
| `$node["X"].output.length` | `$node["X"].output.count` 또는 `$node["X"].output.iterations.length` | **Yes** | 선호는 `count` (O(1)) |
| (없음) | `$node["X"].meta.iterations` | No (추가) | 신규 |
| (없음) | `$node["X"].meta.durationMs` | No (추가) | 공통 |
| `$loop.index` | `$loop.index` | No | body 내부 컨텍스트 유지 |
| `$loop.iteration` | `$loop.iteration` | No | 유지 |
| `$node["X"].config.breakCondition` | (제거) | **Yes** | dead field 삭제 |

**권장 전략**:

1. P0: 엔진의 `runContainerInner` 에서 loop 결과를 `{ iterations, count }` 로 래핑하도록 변경. parallel/foreach/map 동시 변경 (축 5 일괄).
2. P0: 기존 워크플로우의 `$node["X"].output[i]` 접근을 자동으로 `$node["X"].output.iterations[i]` 로 재작성하는 migration script 제공.
3. P1: `breakCondition` schema 제거. 필요한 사용자에게는 body 내부 if_else + `$var.__loopBreak` 패턴으로 마이그레이션 안내.
4. P1: `meta.maxIterationsReached` 플래그로 maxIterations 에 도달하여 종료된 경우 표시.

## 5. 근거

- **Principle 9.2 (Container 오버라이트 컨트랙트)**: `loop` 의 최종 output 은 `{ iterations: [...], count: N }` 로 명문화됨. 이 제안은 해당 규칙을 그대로 구현.
- **Principle 9.1 (오버라이트 규칙)**: 핸들러가 `output: null` 을 반환하면 엔진이 덮어쓴다는 계약이 현재 implicit 이나 문서 레벨에서 명시화.
- **Principle 2 (meta)**: Container 카테고리 전용 메트릭 `meta.iterations` 는 INCONSISTENCY_MATRIX 축 2 및 CONVENTIONS Principle 2 Container 행에 정의됨.
- **Principle 7 (Config echo)**: dead field `breakCondition` 은 echo 대상에서 제거하거나 schema 에서 삭제.
- **네이밍 대칭성**: `loop.iterations` ↔ `foreach.items` ↔ `map.mapped` ↔ `parallel.branches` — 각 컨테이너 의도와 맞는 이름으로 통일.
- INCONSISTENCY_MATRIX 축 5: loop/foreach/map/parallel 의 "현재 단순 배열" → 개선 후 객체 래핑 결정이 근거.
