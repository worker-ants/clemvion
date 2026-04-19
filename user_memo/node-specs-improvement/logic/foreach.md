# ForEach (`foreach`) — Output 일관성 개선안

- **카테고리**: logic
- **현 문서**: [../../node-specs/logic/foreach.md](../../node-specs/logic/foreach.md)
- **전역 규칙**: [../CONVENTIONS.md](../CONVENTIONS.md)

## 1. 현재 Output 구조 요약

배열을 순회하며 각 항목마다 body 서브그래프를 실행하는 컨테이너. side-effect 중심이지만 결과 배열은 부수적으로 수집됩니다. 핸들러가 해석된 배열을 1단계 output 으로 반환하고, 엔진의 `ForEachExecutor` + `runContainerInner` 가 최종 `output` 을 반복 결과 배열로 덮어씁니다.

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

특징 요약:

- **컨테이너 노드**: `isContainer: true`.
- 핸들러는 `output: <resolvedArray>` 반환 → 엔진이 반복 후 덮어씀.
- 최종 `output` 은 **단순 배열** (body emit 결과).
- `errorPolicy: skip/continue` 시 `{ _skipped: true, error: {...} }` 항목이 배열에 섞임.
- body 내부에서 `$item`, `$itemIndex` 접근 가능.
- `arrayField` 해석 실패 시 빈 배열로 fallback (throw 아님).

## 2. 식별된 불일치

| # | 항목 | 위반한 Principle | 설명 |
| --- | --- | --- | --- |
| 1 | 최종 `output` 이 단순 배열 | Principle 9.2 | `{ items: [...], count: N }` 로 통일 필요. loop/map/parallel 과 대칭 |
| 2 | `_skipped` 엔트리가 결과 배열에 섞임 | Principle 1 / 3 | 성공과 실패가 같은 배열에 뒤섞여 후속 노드에서 필터링 부담. 별도 위치 권장 |
| 3 | 핸들러 1단계 output 과 최종 output 의 의미 차이 | Principle 9.1 | 1단계는 "순회할 원본 배열", 최종은 "body emit 결과" — 같은 `output` 이름이 다른 의미를 가짐 |
| 4 | `meta.iterations`, `meta.durationMs` 부재 | Principle 2 | Container 공통 메트릭 누락 |
| 5 | `errorPolicy: 'skip'` 과 `'continue'` 가 동일 동작 | Principle 3 | 네이밍이 다른데 동작이 같음 — 구현 분리 또는 schema 통합 필요 |

## 3. 제안된 Output 구조

### Before (엔진 덮어쓰기 후)

```json
{
  "config": { "arrayField": "items", "errorPolicy": "stop" },
  "output": [
    "body emit 0",
    "body emit 1"
  ]
}
```

### After

```json
{
  "config": { "arrayField": "items", "errorPolicy": "stop" },
  "output": {
    "items": [
      "body emit 0",
      "body emit 1"
    ],
    "count": 2
  },
  "meta": {
    "durationMs": 320,
    "iterations": 2,
    "skippedCount": 0,
    "errorPolicy": "stop"
  },
  "port": "done"
}
```

**핵심 변경점**:

- 최종 `output` 을 `{ items: [...], count: N }` 로 래핑 (Principle 9.2). **Breaking change**.
- `_skipped` 엔트리는 **별도 분리** — `output.items` 에는 성공 결과만, `output.skipped: [{ index, error }]` 로 분리 권장:
  ```json
  "output": {
    "items": ["ok0", "ok1"],
    "count": 2,
    "skipped": [{ "index": 2, "error": { "code": "Error", "message": "..." } }]
  }
  ```
- `meta.skippedCount`, `meta.iterations`, `meta.durationMs` 추가.
- 핸들러 1단계 output (해석된 원본 배열) 은 **외부로 노출하지 않음** — Principle 9.1 에 따라 `output: null` 을 반환하고 엔진이 덮어쓰는 패턴으로 통일. 핸들러의 현재 "해석된 배열 echo" 는 디버깅 목적으로 `meta._resolvedInput` 정도로 옮기거나 제거.
- `errorPolicy: 'skip'` 과 `'continue'` 통합 또는 의미 분리 결정 필요 (P1).
- 빈 배열 입력은 Principle 10 에 따라 `output.items: []`, `output.count: 0`, body 0회 실행 (현 동작 유지).

## 4. 마이그레이션 영향도

| Expression 경로 (Before) | Expression 경로 (After) | Breaking? | 비고 |
| --- | --- | --- | --- |
| `$node["X"].output` | `$node["X"].output.items` | **Yes** | 배열이 서브필드로 이동 |
| `$node["X"].output[0]` | `$node["X"].output.items[0]` | **Yes** | 접근 경로 변경 |
| `$node["X"].output.length` | `$node["X"].output.count` | **Yes** | O(1) count |
| `$node["X"].output.filter(r => !r._skipped)` | `$node["X"].output.items` (자동 분리) | **Yes** (긍정) | 사용자 필터링 부담 제거 |
| (없음) | `$node["X"].output.skipped` | No (추가) | 실패 항목 분리 |
| (없음) | `$node["X"].meta.skippedCount` | No (추가) | 실행 메트릭 |
| `$item`, `$itemIndex` | `$item`, `$itemIndex` | No | body 컨텍스트 유지 |

**권장 전략**:

1. P0: 엔진의 `runContainerInner` 에서 foreach/loop/map/parallel 동시 래핑 변경.
2. P0: body 결과와 skipped 를 분리하는 로직을 `ForEachExecutor` 에 추가.
3. P0: Migration script — `$node["X"].output[i]` → `$node["X"].output.items[i]`, `.filter(r => !r._skipped)` 제거.
4. P1: `errorPolicy: 'skip'` / `'continue'` 의미 분리 또는 schema 통합 결정.
5. P1: 1단계 핸들러 output 은 `null` 로 변경하고 `meta` 에 debug 정보 제공.

## 5. 근거

- **Principle 9.2 (Container 최종 output)**: `foreach` 의 결과는 `{ items: [...], count: N }` 로 명문화. CONVENTIONS 표에 직접 정의됨.
- **Principle 9.1 (오버라이트 규칙)**: 핸들러가 pass-through 스타일로 해석 배열을 output 에 넣는 현 구현은 이 규칙과 어긋남. `null` 반환 + 엔진 덮어쓰기로 통일.
- **Principle 1 / 3 (성공/실패 분리)**: `_skipped` 마커 배열 내 섞임은 비즈니스 데이터와 에러가 한 구조에 혼재 — 에러 컨트랙트 관점에서 분리가 바람직.
- **Principle 2 (meta)**: Container 메트릭 `iterations`, `durationMs`, `skippedCount` 는 실행 메트릭.
- **Principle 10 (빈/null fallback)**: 비배열 입력의 빈배열 fallback 은 이미 Principle 10 과 일치 — 유지.
- **네이밍 대칭성**: `items` 는 "각 아이템 처리 결과" 의미에 가장 직관적.
- INCONSISTENCY_MATRIX 축 5: foreach 의 현재 단순 배열 → `{items, count}` 전환 결정.
