# Table (`table`)

> 데이터를 표 형태로 렌더링합니다. static(수동 rows) 또는 dynamic(input/dataSource) 모드, 정렬·페이지네이션, per-column expression, 선택적 버튼 액션을 지원합니다.

- **카테고리**: `presentation`
- **컨테이너**: no
- **Blocking**: **조건부 yes** — `config.buttons`가 비어있지 않으면 `status: "waiting_for_input"` 반환
- **동적 포트**: **yes** (`dynamicPorts.kind = "presentation-buttons"`, `continueId: "continue"`)

## Config 파라메터

출처: `backend/src/nodes/presentation/table/table.schema.ts`

| 필드명 | 타입 | 필수 | 기본값 | 설명 | 표현식 |
| --- | --- | --- | --- | --- | --- |
| `mode` | `'static' \| 'dynamic'` | no | `'dynamic'` | 소스 모드 | — |
| `dataSource` | string | no | (없음) | dynamic 모드에서 사용할 배열 표현식 (expression — 엔진이 해석한 배열이 핸들러에 전달됨) | yes |
| `columns` | `ColumnDef[]` | yes (1개 이상) | `[]` | 컬럼 정의 | **per-item only** (아래 참고) |
| `rows` | `Row[]` | static 모드에서 1개 이상 | `[]` | static 모드 전용 행 배열 (`Record<string, string>`) | — |
| `pagination` | boolean | no | `true` | 페이지네이션 활성화 플래그 (UI용) | — |
| `pageSize` | number (1~200) | no | `20` | 한 페이지 행 수 (핸들러가 실제로 slice에 사용) | — |
| `sortBy` | string | no | (없음) | 기본 정렬 컬럼 필드 — `columns[*].field` 중 하나여야 함 | yes |
| `sortOrder` | `'asc' \| 'desc'` | no | `'asc'` | 정렬 방향 | — |
| `buttons` | `ButtonDef[]` | no | `[]` | 테이블 하단 버튼 (per-item 버튼 없음) | — |

`ColumnDef`:

| 필드 | 타입 | 기본값 | 설명 | 표현식 |
| --- | --- | --- | --- | --- |
| `field` | string | `''` | 필드 키 또는 per-row expression. 표현식(`{{ … }}`) 포함 시 per-row 평가 | **per-row** |
| `label` | string | `''` | 컬럼 헤더. 표현식이면 전역(first-item) 컨텍스트로 한 번 평가 | yes |
| `width` | string | — | 컬럼 폭 (UI용) | — |
| `sortable` | boolean | — | 정렬 가능 플래그 (UI용) | — |
| `format` | string | — | 셀 포맷 문자열 (UI용) | — |

`ButtonDef`: carousel 문서 참조. 구조 동일 (`id`, `label`, `type: 'link' \| 'port'`, `url?`, `style?`).

> **중요 — `columns`는 config 레벨 expression 해석에서 제외됨**: `backend/src/modules/execution-engine/expression/expression-exclusions.ts`의 `table: ['columns']`. 따라서 `{{ ... }}` 포함 문자열은 handler가 **per-row**로 직접 `evaluate()`한다. `label`만 dynamic 모드에서 한 번 해석되고, `field`는 행마다 `$sourceItem`/`$sourceItemIndex`/`$dataSource` 컨텍스트로 평가된다.

## Ports

| 방향 | id | label | 타입 | 설명 |
| --- | --- | --- | --- | --- |
| Input | `in` | Input | data | dynamic 모드에서 `dataSource` 미설정 시 fallback |
| Output (static) | `out` | Output | data | 버튼이 없을 때 |

### 동적 포트 생성 규칙

출처: `resolveDynamicPorts` → `presentationButtonPorts()` (`supportsItems: false`, `supportsItemButtons: false`)

1. `config.buttons[]` 중 `type === 'port'`인 버튼마다 포트 추가
2. 위에서 생성된 포트가 1개라도 있으면 그것을 반환
3. 하나도 없고 `link` 타입이 하나라도 존재 → `{ id: "continue", label: "Continue" }` 단일 포트
4. 버튼 자체가 없으면 정적 `out` 포트

## Input

- **static 모드**: `input` 무시, `config.rows`를 그대로 사용. 각 row에서 `columns[*].field` 키의 값만 추출 (없으면 `null`). 객체가 아닌 row 항목은 필터링됨.
- **dynamic 모드**:
  - 소스: `config.dataSource != null`이면 그것을, 아니면 `input`을 사용.
  - 배열이 아니면 `[source]`로 래핑.
  - 컬럼 분류: `field`에 `{{`가 포함되면 **expression column**, 아니면 **path column** (`getNestedValue`로 `a.b.c` 지원).
  - Expression column은 `evaluate(field, { ...baseCtx, $dataSource, $sourceItem, $sourceItemIndex })`로 per-row 평가.
  - 실패 시 `null` 반환 및 에러 로그.

## Output

### Case 1: 버튼 없음 — non-blocking

```json
{
  "config": {
    "mode": "dynamic",
    "columns": [
      { "field": "name", "label": "Name" },
      { "field": "email", "label": "Email" }
    ],
    "pageSize": 20,
    "sortBy": "name",
    "sortOrder": "asc"
  },
  "output": {
    "type": "table",
    "columns": [ /* resolved columns (label expressions 해석됨) */ ],
    "rows": [
      { "name": "Alice", "email": "alice@test.com" },
      { "name": "Bob", "email": "bob@test.com" }
    ],
    "totalRows": 2,
    "rendered": "<table><thead>…</thead><tbody>…</tbody></table>"
  }
}
```

- `totalRows` = 현재 페이지에 남아있는 행 수 (pageSize 적용 후 길이).
- rows의 키는 `columns[*].field` — expression column이면 원본 표현식 문자열이 그대로 키로 사용됨. 예: `{ "{{ $sourceItem.first + ' ' + $sourceItem.last }}": "Alice Kim" }`.

### Case 2: 버튼 있음 — 초기 실행 (waiting_for_input)

```json
{
  "config": {
    "mode": "dynamic",
    "columns": [ … ],
    "pageSize": 20,
    "buttonConfig": {
      "buttons": [
        { "id": "approve", "label": "Approve", "type": "port" }
      ]
    }
  },
  "output": {
    "type": "table",
    "columns": [ … ],
    "rows": [ … ],
    "totalRows": 2,
    "rendered": "<table>…</table>"
  },
  "status": "waiting_for_input",
  "meta": { "interactionType": "buttons" }
}
```

Table은 per-item/per-row 버튼을 지원하지 않으므로 `buttonItemMap`이 없습니다.

### Case 3: 사용자 버튼 클릭 후

carousel과 동일한 엔진 resume 경로. port 타입:

```json
{
  "config": { … "buttonConfig": { "buttons": [ … ] } },
  "output": {
    "interaction": {
      "interactionType": "button_click",
      "buttonId": "approve",
      "buttonLabel": "Approve",
      "clickedAt": "2026-04-19T…"
    },
    "previousOutput": { "type": "table", "rows": [ … ], … }
  },
  "port": "approve",
  "status": "button_click",
  "meta": { "interactionType": "buttons" }
}
```

link 타입(Continue):

```json
{
  "config": { … },
  "output": {
    "interaction": { "interactionType": "button_continue", "clickedAt": "…" },
    "previousOutput": { "type": "table", … }
  },
  "port": "continue",
  "status": "button_continue",
  "meta": { "interactionType": "buttons" }
}
```

## 변수로 접근 가능한 항목

이 노드의 라벨이 `Users Table`이라고 가정.

### 버튼 없는 경우:

| 표현식 | 값 | 설명 |
| --- | --- | --- |
| `{{ $node["Users Table"].output.rows }}` | `[{name,email}, …]` | 렌더 후 행 데이터 배열 |
| `{{ $node["Users Table"].output.totalRows }}` | `2` | 행 수 (페이지네이션 후) |
| `{{ $node["Users Table"].output.columns }}` | `[{field,label},…]` | label expression 해석 후 컬럼 |
| `{{ $node["Users Table"].output.rendered }}` | `"<table>…</table>"` | 렌더된 HTML |
| `{{ $node["Users Table"].config.columns }}` | `[…]` | resolved columns (config echo) |
| `{{ $node["Users Table"].config.sortBy }}` | `"name"` | 설정된 정렬 컬럼 |

### 버튼 클릭 후 (AFTER interaction):

| 표현식 | 값 예시 | 설명 |
| --- | --- | --- |
| `{{ $node["Users Table"].output.interaction.buttonId }}` | `"approve"` | 클릭 버튼 ID |
| `{{ $node["Users Table"].output.interaction.buttonLabel }}` | `"Approve"` | 클릭 버튼 라벨 |
| `{{ $node["Users Table"].output.interaction.interactionType }}` | `"button_click"` \| `"button_continue"` | 상호작용 종류 |
| `{{ $node["Users Table"].output.interaction.clickedAt }}` | `"2026-04-19T…"` | 클릭 시각 |
| `{{ $node["Users Table"].output.previousOutput.rows }}` | `[ … ]` | 대기 시점의 테이블 데이터 |
| `{{ $node["Users Table"].port }}` | `"approve"` \| `"continue"` | 활성화된 포트 |
| `{{ $node["Users Table"].status }}` | `"button_click"` \| `"button_continue"` | 상태 |

## 주의사항

- **`columns` 필드는 config 레벨 expression 해석에서 제외됨** (`EXPRESSION_EXCLUSIONS.table = ['columns']`). 표현식은 row 반복 중에 handler가 `$sourceItem` 컨텍스트를 붙여 per-row 평가. 따라서 `columns` 값에 `{{ }}`가 들어 있어도 config 레벨에선 해석되지 않음.
- per-row expression 컨텍스트에서 사용 가능한 변수: `$sourceItem` (현재 행 객체), `$sourceItemIndex` (0-based), `$dataSource` (전체 배열), 그리고 기존 `$var`/`$node` 등 `context.expressionContext` 전체.
- `columns` 비어있으면 validation 실패.
- `sortBy`는 **`columns[*].field` 중 하나와 일치**해야 함 (일치하지 않으면 validation 실패).
- static 모드에서는 expression 평가를 적용하지 않음 (`columns[*].field`가 plain key로만 사용됨).
- `pageSize`가 설정되어 있으면 핸들러가 `rows.slice(0, pageSize)` 실행 후 `totalRows`에 잘린 길이를 담음. **"총 행 수"가 아니라 현재 페이지 길이**임에 주의.
- **Blocking 조건**: `config.buttons`가 배열이면서 길이 > 0 이면 waiting_for_input. 그 외엔 non-blocking.
- **Blocking 모드에서는 컨테이너 본문 내부에 배치 금지**.
- Table은 global buttons만 지원 (carousel의 per-item / itemButtons 같은 개념 없음).
- HTML `rendered`는 모든 셀·헤더 값이 escape 처리됨. 객체/배열은 `JSON.stringify` 후 escape.
