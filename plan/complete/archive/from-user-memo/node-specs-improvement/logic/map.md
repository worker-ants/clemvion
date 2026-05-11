# Map (`map`) — Output 일관성 개선안

- **카테고리**: logic
- **현 문서**: [../../node-specs/logic/map.md](../../node-specs/logic/map.md)
- **전역 규칙**: [../CONVENTIONS.md](../CONVENTIONS.md)

## 1. 현재 Output 구조 요약

배열을 순회하며 각 항목을 body 서브그래프로 **변환** 하는 컨테이너 노드. ForEach 와 handler 로직은 거의 동일하지만 "변환 결과 배열을 후속 단계에 넘긴다" 는 의도가 다릅니다.

```json
{
  "config": { "inputField": "items", "errorPolicy": "stop" },
  "output": [
    { "transformedItemFor": "items[0]" },
    { "transformedItemFor": "items[1]" }
  ]
}
```

특징 요약:

- **컨테이너 노드**: `isContainer: true`.
- 핸들러는 해석된 원본 배열을 1단계 output 으로 반환 → 엔진이 변환 결과 배열로 덮어씀.
- 최종 `output` 은 **단순 배열** (body emit 결과 = 변환된 값들).
- ForEachExecutor 를 공유하므로 errorPolicy / skipped 처리 ForEach 와 동일.
- body 내부에서 `$item`, `$itemIndex` 접근 가능.

## 2. 식별된 불일치

| # | 항목 | 위반한 Principle | 설명 |
| --- | --- | --- | --- |
| 1 | 최종 `output` 이 단순 배열 | Principle 9.2 | `{ mapped: [...], count: N }` 로 통일 필요 |
| 2 | `_skipped` 엔트리가 결과에 섞여 변환 배열의 타입 일관성 손상 | Principle 1 / 3 | Map 의 의도는 "변환된 값들의 순수 배열" 이므로 skipped 섞임이 특히 문제 |
| 3 | `meta.iterations`, `meta.durationMs` 부재 | Principle 2 | Container 공통 메트릭 |
| 4 | ForEach 와 거의 동일한 핸들러인데 문서/의도 분리 | 의미론적 | "map = 변환", "foreach = side-effect" 의도 분리는 네이밍으로 강화 |
| 5 | 핸들러 1단계 output 과 최종 output 의 의미 차이 | Principle 9.1 | foreach 와 동일 — pass-through 혼동 |

## 3. 제안된 Output 구조

### Before (엔진 덮어쓰기 후)

```json
{
  "config": { "inputField": "items", "errorPolicy": "stop" },
  "output": [
    { "transformed": 0 },
    { "transformed": 1 }
  ]
}
```

### After

```json
{
  "config": { "inputField": "items", "errorPolicy": "stop" },
  "output": {
    "mapped": [
      { "transformed": 0 },
      { "transformed": 1 }
    ],
    "count": 2
  },
  "meta": {
    "durationMs": 180,
    "iterations": 2,
    "skippedCount": 0,
    "errorPolicy": "stop"
  },
  "port": "done"
}
```

**핵심 변경점**:

- 최종 `output` 을 `{ mapped: [...], count: N }` 로 래핑 (Principle 9.2). **Breaking change**.
- `_skipped` 항목은 **별도 분리** — 변환 결과 배열의 타입 일관성을 유지하기 위해 필수:
  ```json
  "output": {
    "mapped": [{"transformed": 0}, {"transformed": 1}],
    "count": 2,
    "skipped": [{ "index": 2, "error": { "code": "Error", "message": "..." } }]
  }
  ```
- `meta.iterations`, `meta.durationMs`, `meta.skippedCount` 추가.
- 핸들러는 `output: null` 반환 + 엔진 덮어쓰기 (foreach 와 동일 패턴).
- 빈 배열 입력은 Principle 10 에 따라 `output.mapped: []`, body 0회 실행 (현 동작 유지).

## 4. 마이그레이션 영향도

| Expression 경로 (Before) | Expression 경로 (After) | Breaking? | 비고 |
| --- | --- | --- | --- |
| `$node["X"].output` | `$node["X"].output.mapped` | **Yes** | 배열이 서브필드로 이동 |
| `$node["X"].output[0]` | `$node["X"].output.mapped[0]` | **Yes** | 접근 경로 변경 |
| `$node["X"].output[0].price` | `$node["X"].output.mapped[0].price` | **Yes** | 변환된 필드 접근 |
| `$node["X"].output.length` | `$node["X"].output.count` | **Yes** | O(1) count |
| `$node["X"].output.filter(r => !r._skipped)` | `$node["X"].output.mapped` (자동) | **Yes** (긍정) | 사용자 필터링 제거 |
| (없음) | `$node["X"].output.skipped` | No (추가) | 실패 항목 분리 |
| (없음) | `$node["X"].meta.skippedCount` | No (추가) | 실행 메트릭 |
| `$item`, `$itemIndex` | `$item`, `$itemIndex` | No | body 컨텍스트 유지 |

**권장 전략**:

1. P0: foreach/loop/map/parallel 동시 전환. ForEachExecutor 가 공유되므로 한 번의 엔진 변경으로 둘 다 적용.
2. P0: Migration script — `$node["X"].output[i]` → `$node["X"].output.mapped[i]`.
3. P0: skipped 분리 — Map 은 "변환된 동일 타입 배열" 이 핵심이므로 실패 항목 혼재 방지 우선순위 높음.
4. P1: map / foreach 의 차이를 문서 레벨에서 강화 (네이밍으로 의도 전달: `mapped` vs `items`).

## 5. 근거

- **Principle 9.2**: `map` 의 결과는 `{ mapped: [...], count: N }` 로 명문화 — CONVENTIONS 에서 직접 정의.
- **Principle 9.1**: 핸들러의 pass-through 1단계 output 을 제거하고 `null` 반환으로 컨트랙트 통일.
- **Principle 1 (비즈니스 데이터)**: map 의 비즈니스 데이터 = 변환 결과 배열. `mapped` 라는 이름이 의도를 직접 표현.
- **Principle 3 (에러 분리)**: `_skipped` 인라인 혼재는 배열 타입 일관성을 손상 — 특히 map 에서 치명적. `output.skipped` 로 분리.
- **Principle 2 (meta)**: `iterations`, `durationMs`, `skippedCount` 는 실행 메트릭.
- **의도 분리**: `foreach.items` vs `map.mapped` 라는 네이밍 차이로 "side-effect vs 변환" 의도를 output 구조에서도 드러냄.
- INCONSISTENCY_MATRIX 축 5: 단순 배열 → 객체 래핑 결정.
