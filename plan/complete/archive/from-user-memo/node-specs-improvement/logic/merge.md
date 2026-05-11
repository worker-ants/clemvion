# Merge (`merge`) — Output 일관성 개선안

- **카테고리**: logic
- **현 문서**: [../../node-specs/logic/merge.md](../../node-specs/logic/merge.md)
- **전역 규칙**: [../CONVENTIONS.md](../CONVENTIONS.md)

## 1. 현재 Output 구조 요약

여러 갈래에서 들어온 데이터를 하나로 합치는 노드. `strategy` × `outputFormat` 조합에 따라 output 의 **형태 자체가 변합니다** (array | object | indexed object).

```json
// Case: outputFormat=array
{
  "config": { "strategy": "wait_all", "outputFormat": "array" },
  "output": [{ "a": 1 }, { "b": 2 }]
}

// Case: outputFormat=merge_object
{
  "config": { "strategy": "wait_all", "outputFormat": "merge_object" },
  "output": { "a": 1, "b": 3 }
}

// Case: outputFormat=indexed
{
  "config": { "strategy": "wait_all", "outputFormat": "indexed" },
  "output": { "in_0": "first", "in_1": "second" }
}
```

특징 요약:

- **Phase P1**: 순차 엔진에서 predecessor 가 모두 완료된 뒤 실행 (Blocking 아님).
- `strategy`: `wait_all` / `first` / `append`.
- `outputFormat`: `array` / `merge_object` / `indexed`.
- `timeout` / `partialOnTimeout` 은 Phase P1 에서 **dormant** (config 수용만, 실제 동작 없음 + warn log).
- `meta` / `port` / `status` 미사용.
- `first` 전략은 실제 "먼저 도착한" 이 아니라 **정렬 키의 첫 값** (Phase P1 한정).
- `merge_object` 는 prototype pollution 방지 (`__proto__` / `constructor` / `prototype` 블록).

## 2. 식별된 불일치

| # | 항목 | 위반한 Principle | 설명 |
| --- | --- | --- | --- |
| 1 | `output` 의 shape 이 config 에 따라 3가지로 갈림 | Principle 1 / 예측성 원칙 | 후속 노드가 "merge 결과는 어떤 타입일까" 를 항상 config 를 읽어야 알 수 있음. **하지만 이는 merge 본연의 기능이므로 불가피** — shape 선택 자체는 유지 |
| 2 | `indexed` 형식의 `{in_0, in_1, ...}` 키 네이밍 | Principle 9 (대칭성) | 다른 컨테이너와 달리 index 가 **key 이름에 매몰**됨. 배열 순회 / 동적 인덱싱 어려움. `{items: [{index, value}], count}` 패턴이 대칭적 |
| 3 | `meta.durationMs`, `meta.inputCount` 부재 | Principle 2 | 공통 메트릭 + merge 전용 메트릭 (몇 개의 input 을 합쳤는지) 누락 |
| 4 | `timeout` / `partialOnTimeout` 은 dormant 지만 config 에 echo 됨 (누락됨 — 현 문서 "config 에 포함되지 않는다") | Principle 7 | echo 누락 자체도 불일치 — dormant 라면 meta 에 `dormantFields` 로 명시하거나 schema 에서 제거 |
| 5 | `first` 전략이 실제 의미와 다름 | Principle 11 / 문서 | 이름과 동작 불일치. 이름 변경 검토 (`sorted_first` 등) |
| 6 | `merge_object` 의 pollution 블록은 silent | Principle 3 | `__proto__` 키를 갖는 input 이 들어오면 조용히 drop — 로그 / meta 표시 권장 |

## 3. 제안된 Output 구조

### Before

**Case: outputFormat=array**
```json
{
  "config": { "strategy": "wait_all", "outputFormat": "array" },
  "output": [{ "a": 1 }, { "b": 2 }]
}
```

**Case: outputFormat=merge_object**
```json
{
  "config": { "strategy": "wait_all", "outputFormat": "merge_object" },
  "output": { "a": 1, "b": 3 }
}
```

**Case: outputFormat=indexed**
```json
{
  "config": { "strategy": "wait_all", "outputFormat": "indexed" },
  "output": { "in_0": "first", "in_1": "second" }
}
```

### After

**공통 meta**:
```json
"meta": {
  "durationMs": 2,
  "inputCount": 2,
  "strategy": "wait_all",
  "outputFormat": "array",
  "skippedKeys": []
}
```

**Case: outputFormat=array** — 현재 유지
```json
{
  "output": [{ "a": 1 }, { "b": 2 }]
}
```

**Case: outputFormat=merge_object** — 현재 유지 + skippedKeys
```json
{
  "output": { "a": 1, "b": 3 },
  "meta": { "skippedKeys": ["__proto__"] }
}
```

**Case: outputFormat=indexed** — **구조 변경 (Breaking)**
```json
{
  "output": {
    "items": [
      { "index": 0, "value": "first" },
      { "index": 1, "value": "second" }
    ],
    "count": 2
  }
}
```

**핵심 변경점**:

- `outputFormat: array` / `merge_object` 는 **현 동작 유지** — 각각의 의미가 명확하고 breaking 유인 부족.
- `outputFormat: indexed` 는 `{in_0, in_1, ...}` 대신 `{ items: [{ index, value }], count }` 로 표준화. **Breaking change** 이지만 `split` / `foreach.items` 와 대칭 — 동적 순회 / 배열 인덱싱 가능.
- `meta.inputCount`, `meta.durationMs`, `meta.strategy`, `meta.outputFormat` 추가 — 후속 노드가 shape 을 meta 로 판별 가능.
- `meta.skippedKeys: string[]` 추가 (`merge_object` 한정) — prototype pollution 블록 시 어떤 키가 drop 됐는지 가시화. Principle 3 의 silent failure 해소.
- `timeout` / `partialOnTimeout` 는 Phase P1 동안 schema 에는 유지하되 `meta.dormantFields: ['timeout', 'partialOnTimeout']` 으로 dormant 상태 명시 (Principle 7).
- `first` 전략은 P1 에서 이름 유지, 문서에 "정렬 키 기준 첫 값 (Phase P1 한정)" 을 강조. Phase P2 에서 "먼저 도착한" 의미로 구현 예정. 이름 변경은 Phase P2 전환 시 재검토.
- null / undefined / 스칼라 input 처리는 Principle 10 에 따라 현 동작 유지 (`[input]` 으로 감쌈).

## 4. 마이그레이션 영향도

| Expression 경로 (Before) | Expression 경로 (After) | Breaking? | 비고 |
| --- | --- | --- | --- |
| `$node["X"].output` (array) | `$node["X"].output` | No | 배열 형태 유지 |
| `$node["X"].output[0]` (array) | `$node["X"].output[0]` | No | 유지 |
| `$node["X"].output.a` (merge_object) | `$node["X"].output.a` | No | 유지 |
| `$node["X"].output.in_0` (indexed) | `$node["X"].output.items[0].value` | **Yes** | indexed 접근 경로 변경 |
| `$node["X"].output.in_1` (indexed) | `$node["X"].output.items[1].value` | **Yes** | indexed 접근 경로 변경 |
| (없음) | `$node["X"].output.count` (indexed) | No (추가) | 신규 |
| (없음) | `$node["X"].meta.inputCount` | No (추가) | 공통 메트릭 |
| (없음) | `$node["X"].meta.durationMs` | No (추가) | 공통 |
| (없음) | `$node["X"].meta.skippedKeys` | No (추가) | merge_object 한정 |
| `$node["X"].config.strategy` | `$node["X"].config.strategy` | No | echo 유지 |
| `$node["X"].config.outputFormat` | `$node["X"].config.outputFormat` | No | echo 유지 |

**권장 전략**:

1. P0 (additive): `meta.inputCount`, `meta.durationMs`, `meta.strategy`, `meta.outputFormat`, `meta.skippedKeys` 추가.
2. P1 (breaking - indexed): `indexed` format 결과를 `{items, count}` 로 전환. Migration:
   - 기존 워크플로우의 `output.in_0` / `output.in_1` / ... 접근을 `output.items[0].value` / `[1].value` / ... 로 재작성.
   - indexed format 사용 빈도 조사 후 적용 시점 결정.
3. P1 (documentation): `first` 전략의 Phase P1 한정 동작을 스펙 문서에 대문자 경고로 표기.
4. P2 (future): `timeout` / `partialOnTimeout` 활성화 시 `meta.timedOut`, `meta.receivedCount` 등 상태 필드 추가.

## 5. 근거

- **Principle 1 (output 은 비즈니스 데이터)**: merge 는 본질적으로 "여러 데이터를 합친 결과 자체" 가 비즈니스 데이터이므로 `output` 에 직접 둠. shape 이 config 에 따라 다른 것은 merge 의 본질적 기능 — 단 `meta.outputFormat` 으로 shape 판별 가능하게.
- **Principle 9 (대칭성)**: 엄밀히 컨테이너는 아니지만 `indexed` format 의 `{in_N}` 패턴은 다른 컨테이너의 배열 네이밍과 어긋남. `{items: [{index, value}], count}` 로 통일.
- **Principle 2 (meta)**: `inputCount`, `durationMs` 는 실행 메트릭.
- **Principle 3 (silent failure 해소)**: `merge_object` 의 prototype pollution 블록은 현재 silent — `meta.skippedKeys` 로 가시화.
- **Principle 7 (Config echo)**: dormant 필드는 `meta.dormantFields` 로 노출하거나 schema 에서 일시 제거.
- **Principle 10 (빈/null fallback)**: 스칼라/null → `[input]` wrap 동작은 Principle 10 과 일치 (throw 아님).
- INCONSISTENCY_MATRIX 축 5: merge 는 "strategy 로 선택되므로 현재도 명확" 으로 주된 유지 기조. 단 `indexed` 케이스는 축 5 의 대칭성 원칙과 충돌하므로 본 제안에서 표준화.
