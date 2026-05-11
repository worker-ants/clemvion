# Table (`table`) — Output 일관성 개선안 (재작성)

- **카테고리**: presentation
- **현 문서**: [../../node-specs/presentation/table.md](../../node-specs/presentation/table.md)
- **전역 규칙**: [../CONVENTIONS.md](../CONVENTIONS.md)
- **관련 Principle**: **Principle 1.1 (`config` ↔ `output` 직교성)** — 최우선, **Principle 4 (블로킹/재개)**, Principle 0, Principle 11

> **요약**: table 은 두 모드를 갖습니다 — static (rows 가 핸들러에서 `columns[*].field` 기준으로 정규화된 값) 와 dynamic (rows 가 dataSource 에서 per-row expression 평가된 값). 양쪽 모두 `rows` 는 **런타임 정규화/평가 결과**이므로 `output.rows` 는 유지. 단, `columns` 정의는 리터럴 config 이므로 `output` 에 echo 금지. 이전 초안의 `output.view.{columns, rendered}` 는 **Principle 1.1 위반**이었으며, 재작성 안에서 이를 제거합니다.

---

## 1. 현재 Output 구조 요약

Table 은 데이터를 표로 렌더링합니다. 버튼이 설정되면(`config.buttons.length > 0`) blocking 노드가 됩니다. per-item / per-row 버튼은 지원하지 않고 global 버튼만 있습니다.

### Case A — 버튼 없음 (non-blocking)

```json
{
  "config": {
    "mode": "dynamic",
    "dataSource": "{{ $node[\"Query\"].output.rows }}",
    "columns": [
      { "field": "name", "label": "Name" },
      { "field": "email", "label": "Email" }
    ],
    "pageSize": 20, "sortBy": "name", "sortOrder": "asc"
  },
  "output": {
    "type": "table",
    "columns": [ /* resolved */ ],
    "rows": [ { "name": "Alice", "email": "alice@test.com" }, { "name": "Bob", "email": "bob@test.com" } ],
    "totalRows": 2,
    "rendered": "<table>…</table>"
  }
}
```

### Case B — 버튼 있음, 초기 실행 (waiting)

```json
{
  "config": {
    "mode": "dynamic",
    "columns": [ /* … */ ],
    "pageSize": 20,
    "buttonConfig": { "buttons": [ { "id": "approve", "label": "Approve", "type": "port" } ] }
  },
  "output": {
    "type": "table",
    "columns": [ /* … */ ],
    "rows": [ /* … */ ],
    "totalRows": 2,
    "rendered": "<table>…</table>"
  },
  "status": "waiting_for_input",
  "meta": { "interactionType": "buttons" }
}
```

### Case C — 버튼 클릭 후 (resumed, 현 구현)

```json
{
  "output": {
    "interaction": {
      "interactionType": "button_click",
      "buttonId": "approve",
      "buttonLabel": "Approve",
      "clickedAt": "2026-04-19T12:34:56.000Z"
    },
    "previousOutput": { "type": "table", "rows": [ /* … */ ], "columns": [ /* … */ ], "totalRows": 2, "rendered": "…" }
  },
  "port": "approve",
  "status": "button_click",
  "meta": { "interactionType": "buttons" }
}
```

### Case D — link 타입 Continue

```json
{
  "output": {
    "interaction": { "interactionType": "button_continue", "clickedAt": "…" },
    "previousOutput": { "type": "table", /* … */ }
  },
  "port": "continue",
  "status": "button_continue"
}
```

---

## 2. 식별된 불일치

| # | 항목 | 위반한 Principle | 설명 |
| --- | --- | --- | --- |
| 1 | Waiting 시 `output.columns` | **Principle 1.1 (config echo 금지)** | `columns` 는 사용자가 UI 로 정의한 **리터럴 config**. 후속 노드는 `$node["T"].config.columns` 로 참조해야 함. |
| 2 | Waiting 시 `output.rendered` | **Principle 1.1 / Principle 1** | runtime 계산이지만 "후속 노드 로직에 사용할 도메인 데이터" 가 아님 (Principle 1). `meta.rendered` 로 이동 검토 또는 제거. |
| 3 | Waiting 시 `output.type` 판별자 | **Principle 1.1.4 / 축 4** | 노드 타입은 워크플로우 정의에서 파악. 판별자 불필요. |
| 4 | Resumed 시 `output.previousOutput` | **Principle 4.2** | CONVENTIONS 4.2 에 제거 명시. `columns` 는 config 로, `rows`/`totalRows` 는 waiting 시점 output 유지로 재구성. |
| 5 | `status: 'button_click' \| 'button_continue'` | **Principle 4.1 / 축 9** | `'resumed'` 로 통일. interaction 종류는 `output.interaction.type`. |
| 6 | `output.interaction.interactionType` 필드명 | Principle 4 | `output.interaction.type` 으로 축약. |
| 7 | `clickedAt` top-level 위치 | Principle 4.4 (예시) | top-level 은 `receivedAt`. |
| 8 | `totalRows` 의미 혼동 | Principle 11 (문서화) | **유지**. `totalRows` 는 "페이지 길이" 임을 문서에 재차 명시. |

**유지되는 사항 (개선 대상 아님)**:

- `rows` 는 waiting output 에 **유지**. 이유: static 모드는 핸들러가 `columns[*].field` 기준으로 row 를 필터링한 **런타임 정규화** 결과, dynamic 모드는 per-row expression 을 평가한 결과. 둘 다 config 에 없던 값 (Principle 1.1 식별 기준 적용).
- `totalRows` 유지 — slice 된 페이지 길이로, pageSize config 와 다름 (runtime 값).
- per-row expression caveat (`expression-exclusions.table = ['columns']`) 유지.

---

## 3. 제안된 Output 구조

### 3.1. Waiting (`status: "waiting_for_input"`)

**Before**

```json
{
  "output": {
    "type": "table",
    "columns": [ /* … */ ],
    "rows": [ /* … */ ],
    "totalRows": 2,
    "rendered": "<table>…</table>"
  },
  "status": "waiting_for_input"
}
```

**After** (static 모드 예시 — `columns[*].field` 기준으로 필터링)

```json
{
  "config": {
    "mode": "static",
    "columns": [
      { "field": "name", "label": "Name" },
      { "field": "email", "label": "Email" }
    ],
    "rows": [
      { "name": "Alice", "email": "alice@test.com", "_internal": "hidden" },
      { "name": "Bob", "email": "bob@test.com", "_internal": "hidden" }
    ],
    "pageSize": 20,
    "buttonConfig": { "buttons": [ /* … */ ] }
  },
  "output": {
    "rows": [
      { "name": "Alice", "email": "alice@test.com" },
      { "name": "Bob", "email": "bob@test.com" }
    ]
  },
  "status": "waiting_for_input",
  "meta": { "interactionType": "buttons", "durationMs": 12 }
}
```

**After** (dynamic 모드 예시 — dataSource + per-row expression)

```json
{
  "config": {
    "mode": "dynamic",
    "dataSource": "{{ $node[\"Query\"].output.rows }}",
    "columns": [
      { "field": "name", "label": "Name" },
      { "field": "{{ $sourceItem.first + ' ' + $sourceItem.last }}", "label": "Full" }
    ],
    "pageSize": 20,
    "buttonConfig": { "buttons": [ /* … */ ] }
  },
  "output": {
    "rows": [
      { "name": "Alice", "{{ $sourceItem.first + ' ' + $sourceItem.last }}": "Alice Kim" },
      { "name": "Bob",   "{{ $sourceItem.first + ' ' + $sourceItem.last }}": "Bob Lee" }
    ],
    "totalRows": 2
  },
  "status": "waiting_for_input",
  "meta": { "interactionType": "buttons", "durationMs": 34 }
}
```

핵심:

- `output.rows` — 핸들러가 `columns[*].field` 기준으로 정규화/평가한 **런타임 값**. 유지.
- `output.totalRows` — slice 된 페이지 길이 (dynamic 모드만). `config.pageSize` 와는 다른 런타임 값.
- `output.view` 래퍼 / `output.type` 판별자 / `output.columns` echo / `output.rendered` **모두 없음** (Principle 1.1 / 1.1.4).
- 프런트 렌더러는 `config.columns` + `output.rows` 조합으로 렌더. `rendered` HTML 스냅샷 없음.

### 3.2. Non-blocking (버튼 없음) — 동일 구조

```json
{
  "config": { "mode": "dynamic", "columns": [ /* … */ ], "pageSize": 20 },
  "output": {
    "rows": [ { "name": "Alice", "email": "alice@test.com" } ],
    "totalRows": 1
  }
}
```

> status 없음 (undefined). 구조는 waiting 과 동일.

### 3.3. Resumed — port 버튼 클릭

```json
{
  "config": { "mode": "dynamic", "columns": [ /* … */ ], "buttonConfig": { /* … */ } },
  "output": {
    "rows": [
      { "name": "Alice", "email": "alice@test.com" },
      { "name": "Bob", "email": "bob@test.com" }
    ],
    "totalRows": 2,
    "interaction": {
      "type": "button_click",
      "data": {
        "buttonId": "approve",
        "buttonLabel": "Approve"
      },
      "receivedAt": "2026-04-19T12:34:56.000Z"
    }
  },
  "port": "approve",
  "status": "resumed",
  "meta": { "interactionType": "buttons", "durationMs": 9800 }
}
```

- waiting 시점의 `rows`/`totalRows` 를 **그대로 유지** (immutable snapshot) — 재개 후에도 어떤 행을 사용자가 봤는지 확인 가능.
- `interaction.data` 에 버튼 정보 (Principle 4.5).

### 3.4. Resumed — link 타입 Continue

```json
{
  "output": {
    "rows": [ /* waiting snapshot */ ],
    "totalRows": 2,
    "interaction": {
      "type": "button_continue",
      "data": {
        "buttonId": "more",
        "buttonLabel": "More",
        "url": "https://docs.example.com/table"
      },
      "receivedAt": "2026-04-19T12:34:56.000Z"
    }
  },
  "port": "continue",
  "status": "resumed"
}
```

### 3.5. table 은 per-item / per-row 버튼 불포함

- `supportsItems: false`, `supportsItemButtons: false`. Principle 6 의 `__item_{index}` suffix 는 table 에 **적용되지 않음**.
- 향후 per-row 액션이 요구되면 carousel 과 동일한 suffix 규칙을 재사용.

### 3.6. 유지되는 caveat (per-row expression)

- `EXPRESSION_EXCLUSIONS.table = ['columns']` 유지.
- `columns[*].field` 가 `{{ }}` 를 포함하면 per-row 로 handler 가 `$sourceItem` / `$sourceItemIndex` / `$dataSource` 컨텍스트로 평가.
- 평가 실패 시 해당 row 의 해당 셀은 `null` 로 채워짐.
- 결과 row 의 키는 원본 field 문자열(표현식 포함) 그대로 — `output.rows[0]["{{ $sourceItem.first + ' ' + $sourceItem.last }}"]` 같이 접근 가능.

---

## 4. 마이그레이션 영향도

### 4.1. Expression 경로 변화

| Before | After | Breaking? | 비고 |
| --- | --- | --- | --- |
| `$node["T"].output.type` | — (제거) | **Yes** | 판별자 폐기. |
| `$node["T"].output.rows` | `$node["T"].output.rows` | **No** | 유지 (runtime 값). |
| `$node["T"].output.rows[0].name` | `$node["T"].output.rows[0].name` | **No** | 동상. |
| `$node["T"].output.columns` | `$node["T"].config.columns` | **Yes (high)** | config 리터럴로 이동. |
| `$node["T"].output.totalRows` | `$node["T"].output.totalRows` | **No** | 유지 (runtime 값). |
| `$node["T"].output.rendered` | — (제거) | **Yes** | 프런트는 `config.columns` + `output.rows` 로 직접 렌더. |
| `$node["T"].output.interaction.buttonId` | `$node["T"].output.interaction.data.buttonId` | **Yes (high)** | |
| `$node["T"].output.interaction.buttonLabel` | `$node["T"].output.interaction.data.buttonLabel` | **Yes** | |
| `$node["T"].output.interaction.interactionType` | `$node["T"].output.interaction.type` | **Yes** | |
| `$node["T"].output.interaction.clickedAt` | `$node["T"].output.interaction.receivedAt` | **Yes** | top-level 명칭 변경. |
| `$node["T"].output.previousOutput.rows` | `$node["T"].output.rows` | **Yes** | resumed 시점의 rows 는 waiting 시점과 동일 (immutable snapshot). |
| `$node["T"].output.previousOutput.columns` | `$node["T"].config.columns` | **Yes** | |
| `$node["T"].output.previousOutput.totalRows` | `$node["T"].output.totalRows` | **Yes** | |
| `$node["T"].output.previousOutput.rendered` | — (제거) | **Yes** | |
| `$node["T"].status === "button_click"` | `$node["T"].status === "resumed" && $node["T"].output.interaction.type === "button_click"` | **Yes** | |
| `$node["T"].status === "button_continue"` | `$node["T"].status === "resumed" && $node["T"].output.interaction.type === "button_continue"` | **Yes** | |
| `$node["T"].port === "approve"` | 유지 | No | |
| Per-row 표현식 키 접근 (e.g. `rows[0]["{{ $sourceItem.a }}"]`) | 동상 | No | 표현식 키 자체는 불변, `rows` 위치도 불변. |

### 4.2. 영향도 매트릭스

| 영역 | 영향 수준 | 세부 |
| --- | --- | --- |
| 기존 워크플로우 expression (`output.rows`) | **NONE** | 경로 유지 — 가장 큰 호환성 이점. |
| 기존 워크플로우 expression (`output.columns`) | **HIGH** | `config.columns` 로 이동. |
| `output.type` / `output.rendered` 사용처 | **MEDIUM** | 삭제 대상. |
| Per-row expression caveat | **NONE** | column expression 키는 변경 없음. |
| 프런트엔드 table 렌더러 | **MEDIUM** | `rendered` HTML 을 더 이상 제공하지 않음 → `config.columns` + `output.rows` 로 렌더. |
| 엔진 resume 경로 | **HIGH** | `previousOutput` 제거, waiting 시점 rows 를 resumed 에서도 유지하도록 수정, interaction 3-필드 정규화. |
| 테스트 | **HIGH** | table handler unit + e2e + `columns` 제외 회귀 테스트 유지. |

### 4.3. 마이그레이션 전략

1. **P0 — Handler 변경**: `TableHandler.execute()` 가 blocking / non-blocking 둘 다 `output: { rows, totalRows? }` 만 반환. `type` / `columns` / `rendered` 제거.
2. **P0 — `expression-exclusions` 유지**: `table: ['columns']` 규칙 변함없이 유지.
3. **P0 — Engine resume 경로**:
   - `previousOutput` 제거.
   - waiting 시점의 `rows`/`totalRows` 를 resumed 에서도 유지 (immutable).
   - interaction 을 `{ type, data, receivedAt }` 3-필드로 재정렬.
4. **P0 — Status 전이**: `button_click` / `button_continue` → `'resumed'` 고정.
5. **P1 — Expression migration script**:
   - `\.output\.type\b` (table 문맥) → 제거
   - `\.output\.columns\b` → `.config.columns`
   - `\.output\.rendered\b` → 제거 (사용자 리뷰)
   - `\.output\.interaction\.interactionType` → `.output.interaction.type`
   - `\.output\.interaction\.(buttonId|buttonLabel)` → `.output.interaction.data.$1`
   - `\.output\.interaction\.clickedAt` → `.output.interaction.receivedAt`
   - `\.output\.previousOutput\.rows` → `.output.rows`
   - `\.output\.previousOutput\.columns` → `.config.columns`
   - `\.output\.previousOutput\.totalRows` → `.output.totalRows`
   - status 리터럴 복합 조건으로 확장.
6. **P1 — 문서**: per-row expression caveat 과 `totalRows` 의 "페이지 길이" 의미를 신규 구조에서도 재진술.
7. **P2 — 과거 이력 호환 뷰어**.

---

## 5. 근거

### 5.1. Principle 1.1 — columns 는 config, rows 는 output

Principle 1.1.1 표:

> 사용자가 UI/schema 로 설정한 리터럴 값 (..., **columns 정의**, ...) → `config` 만.
>
> 런타임에 계산/변형/집계/평가된 값 (..., **evaluated rows**, ...) → `output` 만.

table 은 이 규칙이 가장 명확히 적용되는 노드입니다. `columns` 는 사용자 스키마 정의, `rows` 는 dataSource + per-row expression 평가 결과.

### 5.2. Principle 1.1.2 — 식별 기준 적용

> "이 값을 알기 위해 노드를 실제 실행해야 하는가?"

- `columns[*].field`, `columns[*].label` — 실행 없이 schema 만 봐도 알 수 있음 → `config`.
- `rows[0].name` — dataSource 에 따라 달라짐, 실행이 필요 → `output`.
- `totalRows` — pageSize slice 후 실제 길이, 실행이 필요 → `output`.

### 5.3. Principle 4.3 — table 의 waiting output 공식 정의

> | `table` (static) | `{ rows }` | 핸들러가 `columns[*].field` 기준으로 row 필터링 → 런타임 정규화됨. |
> | `table` (dynamic) | `{ rows, totalRows }` | dataSource 에서 per-row expression 평가 결과. `totalRows` 는 slice 된 페이지 길이. |

CONVENTIONS 4.3 표에 table 의 waiting output 이 모드별로 명확히 정의되어 있습니다. 본 제안은 이를 그대로 반영합니다.

### 5.4. Principle 4.2 — previousOutput 제거

> 현재 carousel/chart/table/template의 `output.previousOutput` → **제거**.

waiting 시점의 `rows`/`totalRows` 는 resumed 시점에도 동일한 `output.rows`/`output.totalRows` 로 유지되므로 별도 스냅샷 키 불필요. config 리터럴 (`columns`, `pageSize` 등) 은 이미 `config` 에 있음.

### 5.5. Principle 4.4 — Resumed 시 waiting output 보존

> Waiting 시점 output 을 그대로 유지 (immutable snapshot) 하고 `output.interaction` 을 추가.

table 은 waiting 시 `{ rows, totalRows }` 를 반환했으므로 resumed 에서도 동일한 키가 그대로 있어야 합니다. 여기에 `interaction` 이 추가될 뿐.

### 5.6. Principle 4.5 — button_click payload

| `interaction.type` | `data` shape |
| --- | --- |
| `button_click` | `{ buttonId, buttonLabel, selectedItem? }` |

table 은 per-row 버튼 미지원이므로 `selectedItem` 은 사용되지 않습니다. 단순 `{ buttonId, buttonLabel }`.

### 5.7. `rendered` HTML 제거 근거

Principle 1 은 "후속 노드 로직에 사용할 도메인 데이터" 만 `output` 에 두도록 규정합니다. HTML 스냅샷은 프런트 렌더링 보조용이며 후속 노드 로직에 사용되지 않습니다. 두 옵션:

- **(A) 제거**: 프런트가 `config.columns` + `output.rows` 로 직접 렌더. (본 제안)
- **(B) `meta.rendered` 로 이동**: 실행 메타데이터로 간주. 디버깅 이력에 유용.

본 제안은 (A) 를 채택하되, 실제 구현 시 UI 요구에 따라 (B) 도 허용.

### 5.8. 5개 presentation 노드 공통 구조 수렴

```
waiting (static)  : { status: 'waiting_for_input', output: { rows } }
waiting (dynamic) : { status: 'waiting_for_input', output: { rows, totalRows } }
resumed           : { status: 'resumed', output: { ...waiting fields, interaction: { type, data, receivedAt } } }
non-blocking      : { output: { rows, totalRows? } }
```

- config 리터럴 (`columns`, `pageSize`) 은 `output` echo 금지 (Principle 1.1).
- 노드 타입 판별자 없음 (Principle 1.1.4).
- 상호작용은 `output.interaction.{type, data, receivedAt}` (Principle 4.4).

---

## 6. 참조

- [CONVENTIONS.md — Principle 1.1, Principle 4, Principle 11](../CONVENTIONS.md)
- [INCONSISTENCY_MATRIX.md 축 4 / 축 7.5 / 축 9](../INCONSISTENCY_MATRIX.md)
- 현 구현: `backend/src/nodes/presentation/table/table.handler.ts`, `.schema.ts`
- Expression 제외: `backend/src/modules/execution-engine/expression/expression-exclusions.ts` (`table: ['columns']`)
- 동적 포트 해석: `frontend/src/lib/node-definitions/resolve-dynamic-ports.ts` → `presentationButtonPorts()`
