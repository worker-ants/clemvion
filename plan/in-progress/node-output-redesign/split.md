# Split output 개선안

> **최신화 검토 (2026-05-16)**: 현 spec 과 본 plan 의 분석이 정합. `output.count` ↔ `meta.itemCount` 의 의도적 분리 유지. 잔여 권고 없음.

> 대상 spec: `spec/4-nodes/1-logic/6-split.md` (§5 출력 구조)

## 현재 output (spec 인용)

`spec/4-nodes/1-logic/6-split.md:62-89`:

```json
{
  "config": { "fieldPath": "{{ $input.order.items }}" },
  "output": {
    "items": [
      { "index": 0, "value": { "sku": "X1" } },
      { "index": 1, "value": { "sku": "X2" } }
    ],
    "count": 2
  },
  "meta": {
    "durationMs": 1,
    "itemCount": 2,
    "fellBackToEmpty": false
  }
}
```

## 진단

Split 은 **데이터 변형 노드** (단계 1개). 입력 객체에서 배열을 추출 → `{index, value}` 정규화. "단계마다 채워지는 field" = 정규화된 배열.

| 항목 | 적절성 | 근거 |
| --- | --- | --- |
| `output.items: Array<{index, value}>` | 적절 (output) | 비즈니스 결과 — 다운스트림이 `items` 로 받음 |
| `output.count` | 적절 (output) | spec footnote: `items.length` 와 동일하지만 O(1) 접근용. ForEach 의 `{items, count}` 와 [공통 §5](../../../spec/4-nodes/1-logic/0-common.md) 대칭성 유지 |
| `meta.itemCount` | 약간 중복 (meta) | `output.count` 와 같은 값. spec footnote 가 "Principle 2 분리 원칙" 을 인용하지만, 본질적으로 같은 값. 둘 다 두는 것은 메트릭 축 분리 의도 |
| `meta.fellBackToEmpty` | 적절 (meta) | Principle 10 진단 |
| `meta.durationMs` | 적절 | engine 공통 |
| `config.fieldPath` (raw) | 적절 | Principle 7 |

추가 점검 — **`output.count` ↔ `meta.itemCount` 의 중복**:

- spec footnote: "Principle 2 분리 원칙에 따라 `meta` 에도 표기". 그러나 Loop 의 경우 `output.iterations.length` ↔ `meta.iterations` 로 두는 것과 동일 패턴 — Container 카테고리의 일관성을 위해 유지.
- 한쪽 제거 검토했으나 `output.count` 는 **다운스트림 비즈니스 분기**(예: `if count > 0`)에 자주 쓰이고, `meta.itemCount` 는 **모니터링 / 로그 메트릭** 목적. 의미 구분이 가능하므로 유지.

## 개선안 — 정리된 output

현 spec 부합. 변경 없음.

```json
{
  "config": { "fieldPath": <Expression raw> },
  "output": {
    "items": [{ "index": <number>, "value": <unknown> }, ...],
    "count": <number>
  },
  "meta": {
    "durationMs": <number>,
    "itemCount": <number>,         // output.count 메트릭 미러
    "fellBackToEmpty": <boolean>
  }
}
```

## 분리 제안 — output 에서 빠질 항목의 새 위치

| 기존 output 항목 | 새 위치 | 사유 |
| --- | --- | --- |
| (없음) | — | conventions 부합 |

## Rationale

- 데이터 변형 노드의 `output` 은 변형 결과 자체. 입력의 다른 필드는 (입력 객체 root 에 있던 `id` 등은) 의도적으로 **포함되지 않는다** — spec §5.1 후반부 명시. 단일 책임 원칙.
- `count` 직렬 노출은 ForEach·Map 의 `{items, count}` / `{mapped, count}` 와 [공통 §5](../../../spec/4-nodes/1-logic/0-common.md) 의 통일된 컬렉션 키 규약을 따른다.
- `meta.itemCount` 와 `output.count` 의 중복은 메트릭 축 / 비즈니스 데이터 축의 의도적 분리 (Principle 1 vs 2). 모니터링 사이드에서는 모든 노드의 `meta.*Count` 패턴으로 통일된 메트릭을 수집할 수 있어야 한다.
