# Spec: Transform

> 관련 문서: [Data 공통 규약](./0-common.md) · [Spec 노드 개요](../0-overview.md) · [Filter 노드](../1-logic/8-filter.md) · [Spec 표현식 언어](../../5-system/5-expression-language.md)

입력 데이터에 변환 연산(operations)을 순차적으로 적용하여 출력한다. 코딩 없이 시각적 빌더 UI를 통해 데이터를 재구조화할 수 있다.

---

## 1. Config

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| operations | Operation[] | ✓ | [] | 변환 연산 체인 (순차 적용) |

## 2. Operation 정의

각 Operation은 `type`과 해당 타입별 `params`로 구성된다.

| type | params | 설명 |
|------|--------|------|
| `rename_field` | `from` (String), `to` (String) | 필드 이름 변경 |
| `remove_field` | `field` (String) | 필드 제거 |
| `set_field` | `field` (String), `value` (표현식) | 필드 값 설정 (신규 생성 또는 덮어쓰기) |
| `type_convert` | `field` (String), `targetType` (string / number / boolean / array / object) | 타입 변환 |
| `string_op` | `field` (String), `operation` (trim / uppercase / lowercase / replace / split / join), `args` (Object) | 문자열 조작 |
| `math_op` | `field` (String), `operation` (add / subtract / multiply / divide / round / ceil / floor), `operand` (Number, 표현식) | 수학 연산 |
| `date_op` | `field` (String), `operation` (format / add / subtract / diff), `args` (Object) | 날짜 조작 |
| `array_filter` | `field` (String), `condition` (조건 표현식) | 배열 필터링. 다중 조건 필터링이나 매칭/비매칭 분기가 필요하면 [Filter 노드](../1-logic/8-filter.md) 사용 |
| `array_sort` | `field` (String), `sortBy` (String?), `order` (asc / desc) | 배열 정렬 |
| `object_pick` | `field` (String?), `keys` (String[]) | 객체에서 특정 키만 선택 |
| `object_omit` | `field` (String?), `keys` (String[]) | 객체에서 특정 키만 제거 |

**string_op args:**

| operation | args |
|-----------|------|
| trim | — |
| uppercase | — |
| lowercase | — |
| replace | `search` (String), `replacement` (String), `all` (Boolean, 기본 true), `regex` (Boolean, 기본 false) |
| split | `separator` (String) |
| join | `separator` (String) |

**date_op args:**

| operation | args |
|-----------|------|
| format | `pattern` (String, 예: "YYYY-MM-DD HH:mm:ss") |
| add | `amount` (Number), `unit` (years / months / days / hours / minutes / seconds) |
| subtract | `amount` (Number), `unit` |
| diff | `compareField` (String), `unit` |

## 3. 포트 정의

| 포트 | 방향 | 식별자 | 설명 |
|------|------|--------|------|
| Input | 입력 | `in` | 입력 데이터 |
| Output | 출력 | `out` | 변환 완료된 데이터 |

## 4. 실행 로직

1. 입력 데이터를 복제 (원본 불변)
2. `operations` 배열을 순서대로 적용
3. 각 연산은 이전 연산의 결과를 입력으로 받음
4. 최종 결과를 출력 포트로 전달
5. 모든 `field` 파라미터는 dot/bracket 중첩 경로를 지원한다 (예: `user.profile.name`, `items[0].id`). 대상 필드·객체가 없거나 타입이 맞지 않으면 해당 연산은 원값을 유지하고 다음 연산으로 넘어간다.

## 5. 설정 UI — 시각적 빌더

```
┌──────────────────────────────────────┐
│  Transform Operations                │
│  ────────────────────────────────── │
│  1. [rename_field ▼] from → to       │
│     [user.name___] → [userName___]   │
│                              [✕] [↕] │
│  ────────────────────────────────── │
│  2. [set_field ▼]                    │
│     field: [fullName___]             │
│     value: [{{ $input.first + " "... │
│                              [✕] [↕] │
│  ────────────────────────────────── │
│  3. [remove_field ▼]                 │
│     field: [tempData___]             │
│                              [✕] [↕] │
│  ────────────────────────────────── │
│  [+ Add Operation]                   │
│                                      │
│  ─── Preview ───────────────────── │
│  Input:  { "user": { "name": "Kim" } │
│  Step 1: { "userName": "Kim" }       │
│  Step 2: { "userName": "Kim",        │
│            "fullName": "Kim ..." }   │
│  Step 3: { "userName": "Kim",        │
│            "fullName": "Kim ..." }   │
└──────────────────────────────────────┘
```

- 각 연산을 카드 형태로 표시
- 드래그로 순서 변경 가능 (`[↕]` 핸들)
- 각 카드 삭제 버튼 (`[✕]`)
- `+ Add Operation` 버튼으로 연산 추가
- 하단 Preview: 마지막 실행 데이터 기준으로 각 단계별 결과 미리보기
