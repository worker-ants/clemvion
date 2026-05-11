# Split (`split`) — Output 일관성 개선안

- **카테고리**: logic
- **현 문서**: [../../node-specs/logic/split.md](../../node-specs/logic/split.md)
- **전역 규칙**: [../CONVENTIONS.md](../CONVENTIONS.md)

## 1. 현재 Output 구조 요약

배열의 각 항목에 명시적인 인덱스를 붙여 `{ index, value }[]` 로 변환하는 비-컨테이너 노드. 병렬 fan-out 이나 인덱스 추적이 필요한 후속 처리에서 사용됩니다.

```json
{
  "config": { "fieldPath": "items" },
  "output": [
    { "index": 0, "value": { "sku": "X1" } },
    { "index": 1, "value": { "sku": "X2" } }
  ]
}
```

특징 요약:

- **컨테이너가 아님**: 단일 핸들러 호출로 배열 변환.
- `output` 이 **단순 배열** (`[{index, value}]`).
- 비배열 입력 → 빈 배열 fallback (throw 아님, Principle 10 부합).
- 단일 `out` 포트, `meta` / `port` / `status` 미사용.

## 2. 식별된 불일치

| # | 항목 | 위반한 Principle | 설명 |
| --- | --- | --- | --- |
| 1 | 최종 `output` 이 단순 배열 | Principle 9 (확장 적용) | 엄밀히 컨테이너는 아니지만 foreach/map/loop/parallel 과의 대칭성을 위해 `{ items: [{index, value}], count: N }` 구조 권장 |
| 2 | `meta.durationMs` 부재 | Principle 2 | 공통 메트릭 |
| 3 | 배열 길이 접근이 `.length` 전용 | Principle 11 | `count` 필드가 있으면 O(1) 접근과 가독성 향상 |
| 4 | 빈 배열 fallback 이 명시적 플래그로 구별 불가 | Principle 10 | fallback 으로 들어왔는지 원래 빈 배열이었는지 meta 로 구별 가능 |

## 3. 제안된 Output 구조

### Before

```json
{
  "config": { "fieldPath": "items" },
  "output": [
    { "index": 0, "value": { "sku": "X1" } },
    { "index": 1, "value": { "sku": "X2" } }
  ]
}
```

### After

```json
{
  "config": { "fieldPath": "items" },
  "output": {
    "items": [
      { "index": 0, "value": { "sku": "X1" } },
      { "index": 1, "value": { "sku": "X2" } }
    ],
    "count": 2
  },
  "meta": {
    "durationMs": 1,
    "fellBackToEmpty": false
  }
}
```

**핵심 변경점**:

- 최종 `output` 을 `{ items: [{ index, value }], count: N }` 로 래핑. foreach 와 동일한 `items` 네이밍으로 대칭성 확보. **Breaking change**.
- `meta.durationMs` 추가.
- `meta.fellBackToEmpty: boolean` 추가 — 비배열 입력으로 인해 빈 배열 fallback 이 발생했는지 구별. 디버깅 / 사용자 오류 탐지에 유용.
- 스칼라 값도 기존처럼 `{ index, value: '...' }` 로 감쌈 (유지).

## 4. 마이그레이션 영향도

| Expression 경로 (Before) | Expression 경로 (After) | Breaking? | 비고 |
| --- | --- | --- | --- |
| `$node["X"].output` | `$node["X"].output.items` | **Yes** | 배열이 서브필드로 이동 |
| `$node["X"].output[0]` | `$node["X"].output.items[0]` | **Yes** | 접근 경로 변경 |
| `$node["X"].output[0].index` | `$node["X"].output.items[0].index` | **Yes** | 중첩 경로 변경 |
| `$node["X"].output[0].value` | `$node["X"].output.items[0].value` | **Yes** | 중첩 경로 변경 |
| `$node["X"].output.length` | `$node["X"].output.count` | **Yes** | O(1) count |
| (없음) | `$node["X"].meta.fellBackToEmpty` | No (추가) | 사용자 실수 탐지용 |
| (없음) | `$node["X"].meta.durationMs` | No (추가) | 공통 |

**권장 전략**:

1. P0: 핸들러에서 return 구조 변경. split 은 컨테이너가 아니라 엔진 덮어쓰기 경로가 아니므로 핸들러 수정만으로 충분.
2. P0: Migration script — `$node["X"].output[i]` → `$node["X"].output.items[i]`, `.length` → `.count`.
3. P1: `meta.fellBackToEmpty` 가 `true` 일 때 워크플로우 로그에 info 레벨 이벤트를 기록해 디버깅 돕기.

## 5. 근거

- **Principle 9 (대칭성 확대 적용)**: split 은 엄밀히 컨테이너가 아니지만 결과가 배열인 노드들과의 일관성을 위해 동일 패턴 적용. `foreach.items` 와 같은 네이밍으로 후속 노드가 "이 노드의 결과는 `.items` 에 있다" 를 동일하게 예측 가능.
- **Principle 10 (빈/null fallback)**: 현재 비배열 → `[]` 동작은 그대로 유지. fallback 발생 사실을 `meta` 로 노출해 invisibility 해소.
- **Principle 2 (meta)**: `durationMs` 는 공통 메트릭.
- **Principle 11**: `output.count` 는 문서화된 O(1) 접근 필드.
- INCONSISTENCY_MATRIX 축 5: split 도 `{ items: [...], count: N }` 로 변경 결정.
