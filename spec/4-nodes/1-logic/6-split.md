# Spec: Split

> 관련 문서: [Logic 공통 규약](./0-common.md) · [Spec 노드 개요](../0-overview.md) · [ForEach 노드](./9-foreach.md) · [Spec 표현식 언어](../../5-system/5-expression-language.md) · [CONVENTIONS](../../../user_memo/node-specs-improvement/CONVENTIONS.md)

배열 데이터를 `{ index, value }` 형태로 정규화하여 단일 출력 포트(`out`)로 일괄 내보내는 **데이터 노드**. 분기 노드가 아니며 컨테이너도 아니므로 `port` / 컨테이너 오버라이트 컨트랙트는 사용하지 않는다. 각 항목에 대한 반복 실행이 필요하면 [ForEach 노드](./9-foreach.md)와 조합한다.

---

## 1. 설정 (config)

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| fieldPath | Expression | ✓ | `''` | 분리할 배열 필드 경로. **dot-path 문자열**(`"items"`, `"order.items"`)이면 `$input` 에 적용하고, **inline 표현식**(`{{ $var.a }}`)이면 expression resolver 가 평가한 값 자체를 그대로 사용 |

> Source of truth: `backend/src/nodes/logic/split/split.schema.ts` (export `splitNodeConfigSchema`)

## 2. 설정 UI

```
┌──────────────────────────────────────┐
│  Field Path                          │
│  ┌──────────────────────────────────┐│
│  │ $input.items                     ││
│  └──────────────────────────────────┘│
│  Dot-path or inline expression       │
│  returning an array                  │
└──────────────────────────────────────┘
```

## 3. 포트

### 3.1 입력 포트

| id | label | type | dynamic | 설명 |
|------|-------|------|---------|------|
| `in` | Input | data | false | 분리 대상 객체 (1개 필수) |

### 3.2 출력 포트

| id | label | type | dynamic | 설명 |
|------|-------|------|---------|------|
| `out` | Output | data | false | 정규화된 항목 배열을 일괄 출력 |

> Split 은 단일 출력 포트만 갖는다 (분기 아님). 동적 포트 없음.

## 4. 실행 로직

1. `context.rawConfig.fieldPath` 를 `config` 에 echo (Principle 7 — `{{ }}` 템플릿 보존).
2. `config.fieldPath`(평가 후 값) 를 [`resolveFieldValue(input, fieldPath)`](../../../backend/src/nodes/core/nested-value.util.ts) 로 해석:
   - dot-path 문자열이면 `input` 에 적용해 중첩 값 조회.
   - inline 표현식 결과(이미 배열 값)이면 그 값을 그대로 사용.
3. 결과가 배열이 아니면 (Principle 10 fallback) 빈 배열로 처리하며, `meta.fellBackToEmpty = true` 로 표시.
4. 배열 각 항목을 `{ index: number, value: unknown }` 으로 래핑.
5. `output: { items: [...], count: N }` 형태로 반환 (CONVENTIONS §9.2 대칭성 적용 — `foreach` 의 `items` 와 동일 키).

## 5. 출력 구조

> CONVENTIONS Principle 11 포맷. JSON 예시는 `undefined` 필드 생략, 5필드 (`config`/`output`/`meta?`/`port?`/`status?`) 외 top-level 키 금지.
>
> Split 은 단일 출력 포트의 데이터 노드이므로 정상 케이스 1종(§5.1)만 갖는다 — 분기 / 에러 포트 없음. 비배열 입력은 throw 가 아니라 `{ items: [], count: 0 }` 빈 배열 fallback 으로 처리되며 `meta.fellBackToEmpty` 로 식별 가능 (Principle 10).

### 5.1 Case: 정상 (단일 출력 `out`)

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

| 필드 | 타입 | 출처 | 설명 |
|------|------|------|------|
| `config.fieldPath` | Expression | config echo (Principle 7) | 사용자가 입력한 raw 경로 — 표현식 `{{ }}` 보존 |
| `output.items` | `Array<{ index: number, value: unknown }>` | handler return | 정규화된 항목 배열. `index` 는 0-base, `value` 는 원본 항목 (객체/스칼라 모두 동일하게 래핑) |
| `output.count` | number | handler return | `items.length` 와 동일. O(1) 접근용 (Principle 11) |
| `meta.durationMs` | number | engine inject | 실행 시간 (ms) |
| `meta.itemCount` | number | handler return | 처리된 항목 수 (실행 메트릭, Principle 2). `output.count` 와 동일 값이지만 Principle 2 분리 원칙에 따라 `meta` 에도 표기 |
| `meta.fellBackToEmpty` | boolean | handler return | 입력이 비배열이라 빈 배열 fallback 이 발동했는지 (Principle 10 진단용) |

**Expression 접근 예**:
- `$node["S"].output.items[0].value` → `{ "sku": "X1" }`
- `$node["S"].output.items[0].index` → `0`
- `$node["S"].output.count` → `2`
- `$node["S"].meta.fellBackToEmpty` → `false`

**스칼라 항목 처리**: `items: ['a', 'b', 'c']` 입력 시 `output.items` 는 `[{ index: 0, value: 'a' }, { index: 1, value: 'b' }, { index: 2, value: 'c' }]` 가 된다 (객체/스칼라 동일 래핑 규약).

**원본 비-대상 필드 비포함**: 입력에 `id` 등 다른 필드가 있어도 `output` 에는 분리된 배열만 담긴다. 후속 노드에서 다른 필드가 필요하면 `$node["이전 노드"].output.<필드>` 로 직접 참조한다.

## 6. 에러 코드

Split 은 **runtime 에러 포트를 갖지 않는다**. 모든 검증 실패는 pre-flight (config 검증) 단계에서 throw 된다 (CONVENTIONS Principle 3.1):

| 발생 조건 | 메시지 | 시점 |
|-----------|--------|------|
| `fieldPath` 누락 / 빈 문자열 | `Field path 를 입력해야 합니다.` | warningRule (캔버스 배지) + handler.validate |

> 비배열 입력은 **에러가 아니라** Principle 10 fallback (`{ items: [], count: 0 }` + `meta.fellBackToEmpty: true`) 으로 처리된다.

## 7. 캔버스 요약

[공통 §8](./0-common.md#8-캔버스-요약) — `Split` 행 인용 (`대상 필드 경로` 표시 — 예: `$input.items`).

## 8. ForEach 와의 조합 패턴

Split 은 배열을 일괄 출력하므로, 각 항목에 대해 개별 처리가 필요하면 ForEach 노드와 연결한다.

```
[Split] → out: { items: [{index,value}, ...], count } → [ForEach (arrayField: $input.items)] → body: 각 항목 처리 → done: 결과 배열
```

**예시 — 주문 항목 개별 처리:**

1. Split: `$input.order.items` → `{ items: [{ index: 0, value: <item0> }, ...], count: N }` 출력.
2. ForEach: `arrayField` 를 `$node["Split"].output.items` 로 지정. body 내에서 `$item.value` 로 실제 항목, `$item.index` 로 순번 참조.
3. `done`: 각 항목 처리 결과를 [공통 §5](./0-common.md#5-반복분기-출력-구조-conventions-92) 의 `{ items, count }` 형태로 수집.
