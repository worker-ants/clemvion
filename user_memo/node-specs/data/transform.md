# Transform (`transform`)

> 입력 객체에 일련의 변형 작업(rename, set, math, date, sort, pick, omit 등)을 순서대로 적용합니다.

- **카테고리**: `data`
- **컨테이너**: no
- **Blocking**: no
- **동적 포트**: no

## Config 파라메터

| 필드명 | 타입 | 필수 | 기본값 | 설명 | 표현식 |
| --- | --- | --- | --- | --- | --- |
| `operations` | `TransformOperation[]` | yes | `[]` | 순서대로 적용할 변형 작업 목록 | (op별 args 내부) |

`TransformOperation`은 `type`을 discriminator로 갖는 union입니다. 지원 type:

| type | 필수 필드 | 동작 |
| --- | --- | --- |
| `rename_field` | `from`, `to` | 필드 키 이름 변경 |
| `remove_field` | `field` | 필드 제거 |
| `set_field` | `field`, `value` | 필드를 특정 값으로 설정 |
| `type_convert` | `field`, `targetType` (`string`/`number`/`boolean`/`array`/`object`) | 값의 타입 변환 |
| `string_op` | `field`, `operation` (`trim`/`uppercase`/`lowercase`/`replace`/`split`/`join`), `args?` | 문자열 변환 |
| `math_op` | `field`, `operation` (`add`/`subtract`/`multiply`/`divide`/`round`/`ceil`/`floor`), `operand?` | 산술 |
| `date_op` | `field`, `operation` (`format`/`add`/`subtract`/`diff`), `args?` | 날짜 (dayjs 사용) |
| `array_filter` | `field`, `condition` (Filter 노드 ConditionGroup) | 배열 필터링 |
| `array_sort` | `field`, `sortBy?`, `order` (`asc`/`desc`) | 배열 정렬 |
| `object_pick` | `keys`, `field?` | 객체에서 일부 키만 유지 (field 없으면 root) |
| `object_omit` | `keys`, `field?` | 객체에서 일부 키 제거 (`__proto__`, `constructor`, `prototype`은 차단) |

각 op의 `args` 세부 구조는 핸들러 코드(`backend/.../transform.handler.ts`)를 참고하세요.

## Ports

| 방향 | id | label | 설명 |
| --- | --- | --- | --- |
| Input | `in` | Input | 변형 대상 객체 |
| Output | `out` | Output | 변형 결과 객체 |

## Input

핸들러는 `structuredClone(input)`으로 input을 깊이 복사한 뒤 operations를 순서대로 적용합니다 — 원본 데이터는 변경되지 않습니다.

## Output

### Case 1: 여러 변형 적용

input: `{ user: { firstName: "alice", age: "30" }, items: [3, 1, 2] }`
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

```json
{
  "config": { "operations": [...] },
  "output": {
    "user": { "name": "ALICE", "age": 30 },
    "items": [1, 2, 3]
  }
}
```

| 필드 | 설명 |
| --- | --- |
| `config.operations` | 적용된 operation 목록 |
| `output` | 모든 op를 순서대로 적용한 결과 객체 |

`meta` / `port` / `status` 사용 안 함.

## 변수로 접근 가능한 항목

이 노드의 라벨이 `Normalize`라고 가정:

| 표현식 | 값 예시 | 설명 |
| --- | --- | --- |
| `{{ $node["Normalize"].output }}` | (변형된 객체) | 변형 결과 전체 |
| `{{ $node["Normalize"].output.user.name }}` | `"ALICE"` | 특정 필드 |
| `{{ $node["Normalize"].config.operations.length }}` | `4` | 적용된 op 수 |

## 주의사항

- operations는 **순차** 적용. 다음 op는 이전 op의 결과 객체에 적용됨.
- `dot.path` 형식의 nested field 접근 지원 (`user.profile.email` 등).
- 존재하지 않는 필드에 대한 op는 대체로 no-op (rename/remove/set 외에는 has 체크).
- `string_op replace`: `args.regex: true`이면 정규식 (200자 제한, 컴파일 실패 시 무시). `args.all` 기본 true.
- `math_op divide`: operand가 0이면 무시 (값 변경 안 함).
- `date_op`: dayjs 사용. 잘못된 날짜는 무시. unit은 `years`/`months`/`days`/`hours`/`minutes`/`seconds`만 허용.
- `object_pick`/`object_omit`에서 `field`를 지정하지 않으면 root 객체 자체에 적용 (중요: pick은 root를 새 객체로 교체).
- `object_omit`은 `__proto__`/`constructor`/`prototype` 키는 prototype pollution 방지를 위해 무시.
- `array_sort`: 숫자끼리는 numeric, 그 외는 `localeCompare`. `sortBy`로 객체의 특정 키 기준 정렬.
- `set_field`의 `value`에 `{{ ... }}` expression을 쓰면 expression resolver가 사전 평가합니다.
