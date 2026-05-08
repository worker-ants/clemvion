# Spec: Split

> 관련 문서: [Logic 공통 규약](./0-common.md) · [Spec 노드 개요](../0-overview.md) · [ForEach 노드](./9-foreach.md)

배열 데이터를 `[{ index, value }]` 형태로 정규화하여 출력한다. 각 항목에 대한 반복 실행이 필요하면 [ForEach 노드](./9-foreach.md)와 조합한다.

---

## 1. 설정 (config)

| 필드 | 타입 | 설명 |
|------|------|------|
| fieldPath | Expression | 분리할 배열 필드 경로 (예: `$input.items`) |

## 2. 포트
- 입력: `in` (1개)
- 출력: `out` (1개 — 정규화된 항목 배열을 일괄 출력)

## 3. 실행 로직
1. `fieldPath`로 배열 추출. **dot-path 문자열**(`"items"`, `"order.items"`)이면 `$input`에 적용하고, `{{ $var.a }}`처럼 **inline 표현식**이면 expression resolver가 값 자체를 치환하므로 그 값을 그대로 사용.
2. 배열이 아니면 빈 배열(`[]`)을 출력.
3. 각 항목을 `{ index, value }` 객체로 감싸 배열로 출력.

**예시:**
```
입력: { "id": 1, "items": [{ "name": "a" }, { "name": "b" }] }

출력:
  [
    { "index": 0, "value": { "name": "a" } },
    { "index": 1, "value": { "name": "b" } }
  ]
```

원본의 다른 필드(`id` 등)는 Split 출력에 포함되지 않는다. 필요하면 후속 노드에서 `$node["이전 노드"].output.id`로 직접 참조한다.

## 4. Split + ForEach 조합 패턴

Split은 배열을 일괄 출력하므로, 각 항목에 대해 개별 처리가 필요하면 ForEach 노드와 연결한다.

```
[Split] → out: [{index,value}, ...] → [ForEach (arrayField: $input)] → body: 각 항목 처리 → done: 결과 배열
```

**예시 — 주문 항목 개별 처리:**
```
1. Split: $input.order.items → [{ index: 0, value: <item0> }, ...] 배열 출력
2. ForEach: 배열의 각 항목에 대해 body 실행. body 내에서 $item.value로 실제 항목, $item.index로 순번 참조
3. done: 각 항목 처리 결과를 배열로 수집
```
