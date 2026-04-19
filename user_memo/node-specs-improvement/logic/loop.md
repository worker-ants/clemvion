# Loop (`loop`) — Output 일관성 개선안

> **v2**: Principle 1.1 적용으로 `output.count` 제거. `config.count` 와 중복되므로 echo 금지. 실제 실행된 횟수는 `meta.iterations` 로 노출 (breakCondition/에러로 조기 종료 시 `config.count` 와 다를 수 있음).

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
| 1 | 최종 `output` 이 단순 배열 | Principle 9.2 | CONVENTIONS 9.2 에 따르면 `{ iterations: [...] }` 형태로 래핑해야 foreach/map/parallel 과 네이밍 대칭성 확보 가능 |
| 2 | `meta.durationMs`, `meta.iterations` 부재 | Principle 2 | 공통 메트릭 + 컨테이너 전용 `iterations` 메트릭 누락 |
| 3 | 핸들러 반환에서 오버라이트 컨트랙트 문서화 미흡 | Principle 9.1 | `output: null` → 엔진 덮어쓰기 규칙이 코드상으로만 명시, 문서/계약이 없음 |
| 4 | `breakCondition` dead field | Principle 7 / 3.1 | 사용자가 설정해도 동작 안함 — schema 에서 제거하거나 엔진에서 구현 |
| 5 | 첫 반복의 input 이 `undefined` | Principle 10 | 이전 반복 output 을 다음 input 으로 전달하는 구조상 첫 반복은 `undefined` — 명시적 문서화 필요 |
| 6 | `output.count` 로 반복 횟수 echo 초안 | **Principle 1.1 — config ↔ output 직교성** | 초기 제안 `{ iterations, count }` 의 `count` 는 `config.count` 의 단순 echo (또는 `iterations.length` 의 중복). 런타임 메트릭으로 구분되어야 하므로 `output` 에서 제거하고 `meta.iterations` 로 이동 |

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
    ]
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

- 최종 `output` 을 `{ iterations: [...] }` 객체로 래핑 — Principle 9.2 의 구조적 통일.
- **`output.count` 제거** (P1.1). `config.count` 와 중복이며, 배열 길이가 필요하면 `iterations.length` 또는 `meta.iterations` 사용.
- 단순 배열 접근 `$node["X"].output[0]` → `$node["X"].output.iterations[0]` 로 이동. **Breaking change**.
- `meta.iterations` 는 **실제로 실행된 반복 수**를 기록. 정상 완료 시 `config.count` 와 같지만, 이후 `breakCondition` 구현 / 내부 에러로 조기 종료될 경우 값이 달라짐. 즉 런타임 메트릭으로서의 존재 가치가 있음.
- `meta.durationMs`, `meta.maxIterationsReached` 추가.
- 핸들러 반환 규칙 문서화: "`output: null` 반환 시 엔진이 덮어쓴다" (Principle 9.1).
- `port: 'done'` 을 명시적으로 설정.
- `breakCondition` 은 schema 에서 제거 (P1) — 구현되지 않은 필드는 혼란만 유발.
- 에러 시 (`MAX_ITERATIONS_EXCEEDED`) 는 Principle 3.1 에 따라 pre-flight 에러로 throw 유지.

### 3.1. `config.count` vs `meta.iterations` — 구분

| 필드 | 의미 | 예시 |
| --- | --- | --- |
| `config.count` | 사용자가 설정한 **목표 반복 횟수** (리터럴) | `3` |
| `meta.iterations` | **실제로 실행된 반복 횟수** (런타임 메트릭) | `3` (정상 완료), `2` (breakCondition 발동), `0` (초기 input 에러) |
| `output.iterations.length` | 수집된 결과 배열의 길이 (= `meta.iterations` 와 동일 값) | `3` |

> 정상 완료 시 세 값이 모두 같지만, `config` 의 값을 `output`/`meta` 에 "echo" 하는 것이 아니라 **각기 다른 축의 정보** 입니다. `meta.iterations` 는 실행하지 않으면 알 수 없는 값이므로 P1.1 합격.

## 4. 마이그레이션 영향도

| Expression 경로 (Before) | Expression 경로 (After) | Breaking? | 비고 |
| --- | --- | --- | --- |
| `$node["X"].output` | `$node["X"].output.iterations` | **Yes** | 배열이 서브필드로 이동 |
| `$node["X"].output[0]` | `$node["X"].output.iterations[0]` | **Yes** | 접근 경로 변경 |
| `$node["X"].output.length` | `$node["X"].output.iterations.length` 또는 `$node["X"].meta.iterations` | **Yes** | **`output.count` 제거**. 배열 길이가 필요하면 `iterations.length`, 의도가 "실제 실행된 횟수"이면 `meta.iterations` |
| (없음) | `$node["X"].meta.iterations` | No (추가) | 신규 — 실제로 실행된 반복 수 |
| (없음) | `$node["X"].meta.durationMs` | No (추가) | 공통 |
| `$node["X"].config.count` | `$node["X"].config.count` | No | 설정값은 `config` 로만 참조 (P1.1) |
| `$loop.index` | `$loop.index` | No | body 내부 컨텍스트 유지 |
| `$loop.iteration` | `$loop.iteration` | No | 유지 |
| `$node["X"].config.breakCondition` | (제거) | **Yes** | dead field 삭제 |

**권장 전략**:

1. P0: 엔진의 `runContainerInner` 에서 loop 결과를 `{ iterations }` 로 래핑하도록 변경 (count 없이). parallel/foreach/map 동시 변경 (축 5 일괄).
2. P0: 기존 워크플로우의 `$node["X"].output[i]` 접근을 자동으로 `$node["X"].output.iterations[i]` 로 재작성하는 migration script 제공.
3. P1: `breakCondition` schema 제거. 필요한 사용자에게는 body 내부 if_else + `$var.__loopBreak` 패턴으로 마이그레이션 안내.
4. P1: `meta.maxIterationsReached` 플래그로 maxIterations 에 도달하여 종료된 경우 표시.

## 5. 근거

- **Principle 9.2 (Container 오버라이트 컨트랙트)**: `loop` 의 최종 output 은 `{ iterations: [...] }` 로 구조화. 이 제안은 해당 규칙을 따르되 P1.1 을 함께 적용하여 `count` 필드를 제거.
- **Principle 1.1 (config ↔ output 직교성, 신규 적용)**: `config.count` 는 사용자가 UI 에서 설정한 리터럴 값이므로 `config` 에만 존재. `output.count` 는 정상 완료 시 `config.count` 와 동일 값을 echo 하므로 직교성 위반. 런타임 관점의 "실제 실행 횟수" 는 `meta.iterations` 로 분리.
- **Principle 9.1 (오버라이트 규칙)**: 핸들러가 `output: null` 을 반환하면 엔진이 덮어쓴다는 계약이 현재 implicit 이나 문서 레벨에서 명시화.
- **Principle 2 (meta)**: Container 카테고리 전용 메트릭 `meta.iterations` 는 INCONSISTENCY_MATRIX 축 2 및 CONVENTIONS Principle 2 Container 행에 정의됨. 이 필드가 `output.count` 를 대체하는 위치.
- **Principle 7 (Config echo)**: dead field `breakCondition` 은 echo 대상에서 제거하거나 schema 에서 삭제.
- **네이밍 대칭성**: `loop.iterations` ↔ `foreach.items` ↔ `map.mapped` ↔ `parallel.branches` — 각 컨테이너 의도와 맞는 이름으로 통일. `count` 필드는 loop/parallel 에서는 제거되고, foreach/map 은 input 길이에 따라 변동되는 런타임 값이므로 유지 (INCONSISTENCY_MATRIX 축 7.5 의 "보존" 섹션 참조).
- INCONSISTENCY_MATRIX 축 5 / 축 7.5: loop 의 "현재 단순 배열" → 개선 후 `{ iterations }` 객체 래핑 + `count` 제거 결정이 근거.
