# Transform (`transform`)

> 입력 객체에 일련의 변형 작업(rename, set, math, date, sort, pick, omit 등)을 순서대로 적용합니다.

- **카테고리**: `data`
- **컨테이너**: no
- **Blocking**: no
- **동적 포트**: no

## Config 파라메터

| 필드명 | 타입 | 필수 | 기본값 | 설명 | 표현식 |
| --- | --- | --- | --- | --- | --- |
| `operations` | `TransformOperation[]` | yes | `[]` | 순서대로 적용할 변형 작업 목록 (operation 객체의 각 값은 기본적으로 expression resolver가 사전 해석) | yes (op 필드 값들은 모두 해석됨) |

### TransformOperation 타입

`operations`는 `type` discriminator를 갖는 union 배열입니다. 지원되는 `type`:

| type | 필수 필드 | 선택 필드 | 동작 |
| --- | --- | --- | --- |
| `rename_field` | `from`, `to` | — | 필드 키 이름 변경 (from 미존재 시 no-op) |
| `remove_field` | `field` | — | 필드 제거 |
| `set_field` | `field`, `value` | — | 필드를 특정 값으로 설정 (중첩 경로 지원) |
| `type_convert` | `field`, `targetType` | — | `string`/`number`/`boolean`/`array`/`object` 중 하나로 타입 변환 |
| `string_op` | `field`, `operation` | `args` | `trim`/`uppercase`/`lowercase`/`replace`/`split`/`join` |
| `math_op` | `field`, `operation` | `operand` | `add`/`subtract`/`multiply`/`divide`/`round`/`ceil`/`floor` |
| `date_op` | `field`, `operation` | `args` | `format`/`add`/`subtract`/`diff` (dayjs 사용) |
| `array_filter` | `field`, `condition` | — | 배열을 `Condition`으로 필터링 (Filter 노드와 동일한 조건 구조) |
| `array_sort` | `field`, `order` | `sortBy` | 배열 정렬. `sortBy`로 객체 배열의 특정 키 기준 정렬 가능 |
| `object_pick` | `keys` | `field` | 일부 키만 유지. `field` 미지정 시 루트 객체에 적용 |
| `object_omit` | `keys` | `field` | 일부 키 제거. `__proto__`/`constructor`/`prototype` 키는 차단됨 |

> 각 `type`의 `args` 세부 구조는 `backend/src/nodes/data/transform/transform.handler.ts`의 `TransformOperation` union을 참고하세요.

## Ports

| 방향 | id | label | type | 설명 |
| --- | --- | --- | --- | --- |
| Input | `in` | Input | `data` | 변형 대상 객체 |
| Output | `out` | Output | `data` | 변형 결과 객체 |

## Input

핸들러는 input을 `structuredClone(input)`으로 깊이 복사한 뒤 operations를 순서대로 적용합니다. 원본 input 객체는 변경되지 않으며, 각 operation은 이전 operation의 결과 객체 위에서 실행됩니다.

## Output

항상 기본 포트(`out`)로 흐르며 `meta` / `port` / `status`는 사용하지 않습니다. 핸들러는 `structuredClone`된 객체에 operations를 순서대로 반영하여 반환합니다.

### Case: 여러 변형 체인

input:
```json
{ "user": { "firstName": "alice", "age": "30" }, "items": [3, 1, 2] }
```

config:
```json
{
  "operations": [
    { "type": "rename_field", "from": "user.firstName", "to": "user.name" },
    { "type": "type_convert", "field": "user.age", "targetType": "number" },
    { "type": "string_op", "field": "user.name", "operation": "uppercase" },
    { "type": "array_sort", "field": "items", "order": "asc" }
  ]
}
```

핸들러 반환:
```json
{
  "config": {
    "operations": [
      { "type": "rename_field", "from": "user.firstName", "to": "user.name" },
      { "type": "type_convert", "field": "user.age", "targetType": "number" },
      { "type": "string_op", "field": "user.name", "operation": "uppercase" },
      { "type": "array_sort", "field": "items", "order": "asc" }
    ]
  },
  "output": {
    "user": { "name": "ALICE", "age": 30 },
    "items": [1, 2, 3]
  }
}
```

### Case: 배열 필터 + 정렬 + pick

input:
```json
{
  "users": [
    { "name": "A", "score": 30, "active": true, "email": "a@e" },
    { "name": "B", "score": 50, "active": false, "email": "b@e" },
    { "name": "C", "score": 70, "active": true, "email": "c@e" }
  ]
}
```

config:
```json
{
  "operations": [
    { "type": "array_filter", "field": "users",
      "condition": { "field": "active", "operator": "eq", "value": true } },
    { "type": "array_sort", "field": "users", "sortBy": "score", "order": "desc" }
  ]
}
```

output (`output` 필드):
```json
{
  "users": [
    { "name": "C", "score": 70, "active": true, "email": "c@e" },
    { "name": "A", "score": 30, "active": true, "email": "a@e" }
  ]
}
```

| 필드 | 설명 |
| --- | --- |
| `config.operations` | 실행에 사용된 operation 목록 (expression resolver가 이미 해석한 값) |
| `output` | 모든 op를 순서대로 적용한 최종 객체. `object_pick`을 root로 적용한 경우에는 root가 완전히 새 객체로 교체됨 |

## 변수로 접근 가능한 항목

이 노드의 라벨이 `Normalize`라고 가정:

| 표현식 | 값 예시 | 설명 |
| --- | --- | --- |
| `{{ $node["Normalize"].output }}` | (변형된 객체) | 변형 결과 전체 |
| `{{ $node["Normalize"].output.user.name }}` | `"ALICE"` | 변형 결과의 특정 필드 |
| `{{ $node["Normalize"].output.items[0] }}` | `1` | 변형 결과 배열 요소 |
| `{{ $node["Normalize"].config.operations }}` | `[{...}, ...]` | 실행된 operation 목록 |
| `{{ $node["Normalize"].config.operations.length }}` | `4` | 적용된 operation 수 |

`meta` / `port` / `status`는 이 노드에서는 제공되지 않습니다.

## 주의사항

- operations는 **순차** 적용. 각 op는 이전 op의 결과 객체를 입력으로 받습니다.
- 필드 경로는 `getNestedValue`/`setNestedValue` 유틸 기반으로 `dot.path` 및 `items[0].v` 같은 bracket 표기를 지원합니다.
- 존재하지 않는 필드에 대한 op는 대체로 no-op (`rename_field`/`type_convert`/`string_op`/`math_op`/`date_op`/`array_filter`/`array_sort`는 모두 값 유무를 먼저 확인).
- `set_field`의 `value`, `string_op`의 `args`, `date_op`의 `args` 등은 expression resolver가 사전 평가하므로 `{{ $input.x }}`, `{{ $vars.base }}` 같은 표현식을 그대로 사용 가능합니다.
- `string_op` / `replace`:
  - `args.all` 기본 `true` (미지정 시 모든 매칭 치환).
  - `args.regex: true`이면 정규식. 패턴 길이 200자 초과 또는 컴파일 실패 시 **치환이 적용되지 않음** (원본 유지).
- `math_op` / `divide`: `operand === 0`이면 변경 없이 원값 유지 (divide-by-zero 방지).
- `date_op`:
  - 입력이 유효하지 않은 날짜(`dayjs().isValid() === false`)이면 no-op.
  - `format`은 `args.pattern` 필요, `add`/`subtract`는 `args.amount`(number) + `args.unit` 필요, `diff`는 `args.compareField` + `args.unit` 필요.
  - `unit`은 `years`/`months`/`days`/`hours`/`minutes`/`seconds`만 허용. 결과 값은 `add`/`subtract`는 ISO 문자열, `diff`는 숫자.
- `array_filter` / `array_sort`: 타겟이 배열이 아니면 no-op. `array_sort`는 비파괴(`[...arr].sort()`), 숫자끼리는 수치 비교, 그 외는 `stringifyForSort` 후 `localeCompare`.
- `object_pick` / `object_omit`:
  - `field` 미지정이면 root에 적용. `object_pick`은 root를 픽된 키만 갖는 **새 객체로 교체**하므로 출력 형태가 크게 달라질 수 있음.
  - `object_omit`은 `__proto__`/`constructor`/`prototype` 키를 무시해 prototype pollution을 방지.
  - `field` 지정 시 해당 경로 값이 **object(배열 제외)**가 아니면 no-op.
- `rename_field`는 내부적으로 `set → del` 순으로 동작하므로 `from`과 `to`가 동일한 prefix를 공유하면 의도치 않은 결과가 나올 수 있습니다. `from`이 없으면 전체 no-op.
- `config.operations`에는 자격증명 같은 민감 정보가 포함될 가능성이 없으므로 후속 노드의 `$node["..."].config.operations`로 전체가 그대로 노출됩니다.
