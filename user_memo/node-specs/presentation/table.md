# Table (`table`)

> 데이터를 테이블로 표시합니다. static(수동) 또는 dynamic(input/expression 기반) 모드, 정렬·페이지네이션, 선택적 버튼 액션 지원.

- **카테고리**: `presentation`
- **컨테이너**: no
- **Blocking**: yes (버튼이 있을 때만)
- **동적 포트**: yes (`presentation-buttons`)

## Config 파라메터

### 공통

| 필드명 | 타입 | 필수 | 기본값 | 설명 | 표현식 |
| --- | --- | --- | --- | --- | --- |
| `mode` | `'static' \| 'dynamic'` | no | `'dynamic'` | 데이터 소스 방식 | no |
| `columns` | `Column[]` | yes (1개 이상) | `[]` | 컬럼 정의 | (field/label 내부) |
| `pagination` | boolean | no | `true` | 페이지네이션 활성 | no |
| `pageSize` | int (1~200) | no | `20` | (pagination true일 때) 페이지당 row 수 — 핸들러는 단순히 첫 N개로 자름 | no |
| `sortBy` | string | no | (없음) | 정렬 기준 컬럼 (`columns[].field` 중 하나여야 함) | no |
| `sortOrder` | `'asc' \| 'desc'` | no | `'asc'` | 정렬 방향 | no |
| `buttons` | `Button[]` | no | `[]` | 액션 버튼 | (label/url 내부) |

`Column`:

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `field` | string | row의 dot-path 또는 `{{ ... }}` expression |
| `label` | string (expression) | 헤더 라벨 (dynamic 모드는 expression 평가 가능) |
| `width` | string | CSS width 힌트 |
| `sortable` | boolean | UI 정렬 가능 표시 |
| `format` | string | 포맷 힌트 (UI에서 사용) |

### `mode: 'dynamic'`

| 필드명 | 타입 | 필수 | 설명 | 표현식 |
| --- | --- | --- | --- | --- |
| `dataSource` | string (expression) | no | 데이터 배열 expression. 미지정 시 input 사용 | yes |

dynamic 모드에서 row마다 expression context는 `$dataSource`(전체 배열), `$sourceItem`(현재 row), `$sourceItemIndex`(인덱스)를 추가로 노출합니다.

### `mode: 'static'`

| 필드명 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `rows` | `Record<string,string>[]` | yes (1개 이상) | 정적 row 배열 (각 row는 컬럼 field를 키로) |

`Button`: Carousel과 동일 (`{id, label, type: 'link'|'port', url?, style}`).

## Ports

| 방향 | id | label | 설명 |
| --- | --- | --- | --- |
| Input | `in` | Input | (dynamic 모드에서 dataSource 미지정 시) |
| Output | `out` | Output | (버튼 없거나 link만) 즉시 진행 |
| Output | `<button.id>` | (button.label) | **동적** — 클릭된 port 버튼 ID |
| Output | `continue` | Continue | link만 있을 때 |

> **동적 포트 생성 규칙** (`presentation-buttons`):
> Carousel과 동일 — `buttons[]`(type='port')마다 포트, port 없고 link만 있으면 `continue`, 둘 다 없으면 정적 `out`.

## Output

### Case 1: 버튼 없음 (즉시 진행)

```json
{
  "config": {
    "mode": "dynamic",
    "columns": [
      { "field": "name", "label": "Name" },
      { "field": "age", "label": "Age" }
    ],
    "pageSize": 20,
    "sortBy": "name",
    "sortOrder": "asc"
  },
  "output": {
    "type": "table",
    "columns": [{ "field": "name", "label": "Name" }, ...],
    "rows": [
      { "name": "Alice", "age": 30 },
      { "name": "Bob", "age": 25 }
    ],
    "totalRows": 2,
    "rendered": "<table>...</table>"
  }
}
```

### Case 2: 버튼 있음 → 사용자 입력 대기

```json
{
  "config": {
    ...,
    "buttonConfig": {
      "buttons": [{ "id": "btn_export", "label": "Export", "type": "port" }]
    }
  },
  "output": { "type": "table", "rows": [...], ... },
  "status": "waiting_for_input",
  "meta": { "interactionType": "buttons" }
}
```

| 필드 | 설명 |
| --- | --- |
| `output.type` | 항상 `"table"` |
| `output.columns` | 정렬·label 평가 후의 컬럼 정의 |
| `output.rows` | 정렬·페이지네이션 적용 후 row 배열 (각 컬럼 field를 키로) |
| `output.totalRows` | 표시 row 수 (pageSize 적용 후) |
| `output.rendered` | HTML (XSS 안전 escape) |
| `config.columns` | resolved columns (expression label 평가됨) |
| `config.buttonConfig` | (버튼 있을 때) 버튼 정의 |
| `status` | (버튼 있을 때) `"waiting_for_input"` |
| `port` (제출 후) | 클릭된 버튼 ID |

## 변수로 접근 가능한 항목

이 노드의 라벨이 `Users Table`이라고 가정.

| 표현식 | 값 예시 | 설명 |
| --- | --- | --- |
| `{{ $node["Users Table"].output.rows }}` | `[{name:"Alice",age:30}, ...]` | 표시된 row 배열 |
| `{{ $node["Users Table"].output.rows[0].name }}` | `"Alice"` | 특정 row의 셀 값 |
| `{{ $node["Users Table"].output.totalRows }}` | `2` | row 수 |
| `{{ $node["Users Table"].output.columns }}` | `[{field:"name",label:"Name"}]` | resolved 컬럼 |
| `{{ $node["Users Table"].port }}` | `"btn_export"` | (버튼 클릭 후) 클릭된 버튼 ID |
| `{{ $node["Users Table"].config.sortBy }}` | `"name"` | 사용된 정렬 |

## 주의사항

- `columns`은 최소 1개 필수.
- static 모드는 `rows`도 필수.
- `sortBy`는 반드시 `columns[].field` 중 하나여야 함 (validation에서 거름).
- dynamic 모드에서 `field`가 expression(`{{ ... }}`)이면 매 row마다 `$sourceItem`/`$sourceItemIndex`/`$dataSource`로 평가됨. 평가 실패 시 `null`.
- dynamic 모드에서 `label`도 expression 가능. `$dataSource` 컨텍스트만 노출 (row별 컨텍스트 없음).
- `pagination: true` + `pageSize: N`이면 처음 N개만 표시 (실제 페이지 네비게이션은 UI 책임).
- 정렬은 `<` 비교 (모든 타입 대상). 같으면 0, null/undefined는 비교에 따라 임의 순서.
- 버튼 한 개라도 있으면 blocking 모드.
- `output.rendered` HTML은 escape됨 (& < > " ').
