# Table (`table`) — Output 일관성 개선안

- **카테고리**: presentation
- **현 문서**: [../../node-specs/presentation/table.md](../../node-specs/presentation/table.md)
- **전역 규칙**: [../CONVENTIONS.md](../CONVENTIONS.md)
- **관련 Principle**: **Principle 4 (블로킹/재개)**, Principle 0, Principle 11

> **요약**: table 은 carousel 과 동일한 버튼/블로킹 패턴을 사용하므로 개선 방향도 동일합니다. waiting 시 `output` 에 `view` 래퍼를 추가하고, resumed 시 `previousOutput` → `view` 로 이동, interaction 래퍼를 `{ type, data, receivedAt }` 로 정규화, `status` 를 `'resumed'` 로 통일합니다. table 은 per-item 버튼을 **지원하지 않으므로** Principle 6 의 per-item suffix 규칙은 적용되지 않지만, **per-row expression 평가 caveat** 은 그대로 유지됩니다.

---

## 1. 현재 Output 구조 요약

Table 은 데이터를 표로 렌더링합니다. 버튼이 설정되면(`config.buttons.length > 0`) blocking 노드가 됩니다. carousel 과 달리 per-item / per-row 버튼은 지원하지 않고 global 버튼만 있습니다.

### Case A — 버튼 없음 (non-blocking)

```json
{
  "config": {
    "mode": "dynamic",
    "columns": [ { "field": "name", "label": "Name" }, { "field": "email", "label": "Email" } ],
    "pageSize": 20, "sortBy": "name", "sortOrder": "asc"
  },
  "output": {
    "type": "table",
    "columns": [ /* resolved */ ],
    "rows": [ { "name": "Alice", "email": "alice@test.com" } ],
    "totalRows": 2,
    "rendered": "<table>…</table>"
  }
}
```

### Case B — 버튼 있음, 초기 실행 (waiting)

```json
{
  "config": {
    "mode": "dynamic", "columns": [ /* … */ ], "pageSize": 20,
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

### Case C — 버튼 클릭 후 (resumed)

```json
{
  "output": {
    "interaction": {
      "interactionType": "button_click",
      "buttonId": "approve",
      "buttonLabel": "Approve",
      "clickedAt": "2026-04-19T…"
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

carousel 과 거의 동일한 패턴이므로 위반 사항도 동일합니다.

| # | 항목 | 위반한 Principle | 설명 |
| --- | --- | --- | --- |
| 1 | Waiting 시 `output` flat 구조 | **Principle 4.3** | `output.view.type: 'table'` 이 되어야 함. |
| 2 | Resumed 시 `previousOutput` 네이밍 | **Principle 4.2** | "`output.previousOutput` → `output.view`" 규약 위반. |
| 3 | `status: 'button_click' \| 'button_continue'` | **Principle 4.1 / 축 9** | `'resumed'` 로 통일. |
| 4 | `output.interaction.interactionType` 필드명 | Principle 4 | `output.interaction.type` 으로 축약. |
| 5 | `clickedAt` top-level 위치 | Principle 4.1 (예시) | interaction 래퍼 레벨은 `receivedAt`, 내부는 `data.clickedAt` 유지. |
| 6 | `totalRows` 의미 혼동 (per-row expression caveat 관련) | Principle 11 (문서화) | **유지 사항**: `totalRows` 는 "총 행 수" 가 아니라 "pageSize slice 후 현재 페이지 길이" 임을 문서에 재차 명시. |

table 고유의 per-row expression caveat 은 **개선 대상이 아니라 유지 대상** 입니다:

- `columns` 는 `expression-exclusions` 에 등록되어 config 레벨 해석에서 제외됨.
- `{{ }}` 포함 `field` 는 handler 가 per-row 로 `$sourceItem` 컨텍스트를 붙여 평가.
- 이 동작은 신규 `output.view.columns` / `output.view.rows` 구조에서도 그대로 유지됨.

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

**After**

```json
{
  "output": {
    "view": {
      "type": "table",
      "columns": [
        { "field": "name", "label": "Name" },
        { "field": "email", "label": "Email" }
      ],
      "rows": [
        { "name": "Alice", "email": "alice@test.com" },
        { "name": "Bob", "email": "bob@test.com" }
      ],
      "totalRows": 2,
      "rendered": "<table><thead>…</thead><tbody>…</tbody></table>"
    }
  },
  "status": "waiting_for_input",
  "meta": { "interactionType": "buttons", "durationMs": 0 }
}
```

- `view.type: 'table'` — Principle 4.3 판별자.
- `columns` / `rows` / `totalRows` / `rendered` 모두 view 내부로 내려감.
- `totalRows` 의 기존 의미(pageSize slice 후 길이) 는 변경 없음.

### 3.2. 버튼 없음 (non-blocking) — 일관성 적용

**Before**

```json
{
  "output": {
    "type": "table", "columns": [ … ], "rows": [ … ], "totalRows": 2, "rendered": "…"
  }
}
```

**After**

```json
{
  "output": {
    "view": {
      "type": "table",
      "columns": [ /* … */ ],
      "rows": [ /* … */ ],
      "totalRows": 2,
      "rendered": "…"
    }
  }
}
```

> non-blocking 경우에도 `output.view` 구조를 유지 — 후속 노드가 status 와 무관하게 동일 경로로 접근 가능.

### 3.3. Resumed — port 버튼 클릭 (`status: "resumed"`)

**After**

```json
{
  "output": {
    "view": {
      "type": "table",
      "columns": [ /* waiting snapshot */ ],
      "rows": [ /* … */ ],
      "totalRows": 2,
      "rendered": "…"
    },
    "interaction": {
      "type": "button_click",
      "data": {
        "buttonId": "approve",
        "buttonLabel": "Approve",
        "clickedAt": "2026-04-19T12:34:56.000Z"
      },
      "receivedAt": "2026-04-19T12:34:56.000Z"
    }
  },
  "port": "approve",
  "status": "resumed",
  "meta": { "interactionType": "buttons", "durationMs": 9800 }
}
```

### 3.4. Resumed — link 버튼(Continue) 클릭

**After**

```json
{
  "output": {
    "view": { "type": "table", /* waiting snapshot */ },
    "interaction": {
      "type": "button_continue",
      "data": { "clickedAt": "2026-04-19T12:34:56.000Z" },
      "receivedAt": "2026-04-19T12:34:56.000Z"
    }
  },
  "port": "continue",
  "status": "resumed"
}
```

### 3.5. table 은 per-item 버튼 불포함

- `supportsItems: false`, `supportsItemButtons: false`. Principle 6 의 `__item_{index}` suffix 는 table 에 **적용되지 않음**.
- 향후 per-row 액션이 요구되면 carousel 과 동일한 suffix 규칙을 재사용.

### 3.6. 유지되는 caveat (per-row expression)

- `EXPRESSION_EXCLUSIONS.table = ['columns']` 유지.
- `columns[*].field` 가 `{{ }}` 를 포함하면 per-row 로 handler 가 `$sourceItem` / `$sourceItemIndex` / `$dataSource` 컨텍스트로 평가.
- 평가 실패 시 해당 row 의 해당 셀은 `null` 로 채워짐.
- 결과 row 의 키는 원본 field 문자열(표현식 포함) 그대로 — 이는 **변경 없이** view.rows 구조로 이동. 예: `output.view.rows[0]["{{ $sourceItem.first + ' ' + $sourceItem.last }}"]`.

---

## 4. 마이그레이션 영향도

### 4.1. Expression 경로 변화

| Before | After | Breaking? | 비고 |
| --- | --- | --- | --- |
| `$node["T"].output.type` | `$node["T"].output.view.type` | **Yes** | type 판별. |
| `$node["T"].output.rows` | `$node["T"].output.view.rows` | **Yes (high)** | 가장 일반적 경로. |
| `$node["T"].output.rows[0].name` | `$node["T"].output.view.rows[0].name` | **Yes (high)** | |
| `$node["T"].output.columns` | `$node["T"].output.view.columns` | **Yes** | |
| `$node["T"].output.totalRows` | `$node["T"].output.view.totalRows` | **Yes** | |
| `$node["T"].output.rendered` | `$node["T"].output.view.rendered` | **Yes** | |
| `$node["T"].output.interaction.buttonId` | `$node["T"].output.interaction.data.buttonId` | **Yes (high)** | |
| `$node["T"].output.interaction.buttonLabel` | `$node["T"].output.interaction.data.buttonLabel` | **Yes** | |
| `$node["T"].output.interaction.interactionType` | `$node["T"].output.interaction.type` | **Yes** | |
| `$node["T"].output.interaction.clickedAt` | `$node["T"].output.interaction.data.clickedAt` (+`.receivedAt` top-level) | **Yes** | |
| `$node["T"].output.previousOutput.rows` | `$node["T"].output.view.rows` | **Yes** | |
| `$node["T"].output.previousOutput.*` | `$node["T"].output.view.*` | **Yes** | |
| `$node["T"].status === "button_click"` | `$node["T"].status === "resumed" && $node["T"].output.interaction.type === "button_click"` | **Yes** | |
| `$node["T"].status === "button_continue"` | `$node["T"].status === "resumed" && $node["T"].output.interaction.type === "button_continue"` | **Yes** | |
| `$node["T"].port === "approve"` | 유지 | No | |
| Per-row 표현식 키 접근 (e.g. `rows[0]["{{ $sourceItem.a }}"]`) | view 아래로 이동만 (`view.rows[0]["{{ … }}"]`) | **Yes** | 표현식 키 자체는 불변. |

### 4.2. 영향도 매트릭스

| 영역 | 영향 수준 | 세부 |
| --- | --- | --- |
| 기존 워크플로우 expression | **HIGH** | `output.rows` / `output.totalRows` 광범위 사용. |
| Per-row expression caveat | **NONE** | column expression 키는 변경 없음. |
| 프런트엔드 table 렌더러 | **MEDIUM** | `output.view.rows` 경로로 전환. `rendered` HTML 은 동일. |
| 엔진 resume 경로 | **HIGH** | structured output 재조립 로직 수정. |
| 테스트 | **HIGH** | table handler unit + e2e + `columns` 제외 회귀 테스트 유지. |

### 4.3. 마이그레이션 전략

1. **P0 — Handler 변경**: `TableHandler.execute()` 가 blocking / non-blocking 둘 다 `output.view` 구조로 반환. `rendered` / `rows` / `columns` / `totalRows` 를 view 아래로.
2. **P0 — `expression-exclusions` 유지**: `table: ['columns']` 규칙은 변함없이 유지. 개선 후에도 `config.columns` 가 제외 대상 — 그러나 `output.view.columns` 는 이미 label 이 해석된 스냅샷이므로 문제 없음.
3. **P0 — Engine resume 경로**: carousel 과 동일하게 `previousOutput → view`, interaction `{ type, data, receivedAt }`, status `'resumed'` 로 통일.
4. **P1 — Expression migration script**:
   - `\.output\.(rows|columns|totalRows|rendered|type)` → `.output.view.$1`
   - `\.output\.previousOutput\.` → `.output.view.`
   - `\.output\.interaction\.interactionType` → `.output.interaction.type`
   - `\.output\.interaction\.(buttonId|buttonLabel|clickedAt)` → `.output.interaction.data.$1`
   - `status === 'button_click'` / `'button_continue'` → 복합 조건으로 확장.
5. **P1 — 문서**: per-row expression caveat 과 `totalRows` 의 "페이지 길이" 의미를 `output.view` 구조에서도 재진술.
6. **P2 — 과거 이력 뷰어 호환**.

---

## 5. 근거

### 5.1. Principle 4 통일 (carousel 과 동일)

CONVENTIONS Principle 4.1 의 상태 전이와 4.3 의 `table.view: { type: 'table', columns, rows, totalRows }` 예시에 정확히 부합합니다.

### 5.2. Principle 4.2 명시

> carousel/chart/table/template의 `output.previousOutput` → `output.view` 로 이동

table 의 `previousOutput` 도 명시 대상.

### 5.3. `rendered` 포함 여부

`rendered` HTML 은 Principle 4.3 의 기본 view 예시(`{ type, columns, rows, totalRows }`) 에는 없지만, XSS 방지를 위해 서버에서 이미 escape 된 안전한 HTML snapshot 이므로 **view 내부에 포함** 하는 것이 합리적입니다. Principle 4.3 의 예시는 필수 필드 집합이고, 노드별 부가 필드는 허용됨.

### 5.4. non-blocking 에서도 `view` 래퍼 적용

table 은 버튼이 없으면 non-blocking (status undefined) 이지만, **output 구조는 동일한 `view` 래퍼** 로 통일합니다. 이유:

1. 후속 노드가 "이 노드가 blocking 이었는가" 를 고려하지 않고 `output.view.rows` 로 접근 가능.
2. 5개 presentation 노드 전체가 일관된 경로를 갖게 됨 (form 은 non-blocking 변형이 없지만, carousel/table/chart/template 은 모두 가능).
3. `status` 의 존재 여부만으로 blocking/non-blocking 을 구분 (Principle 4.1).

### 5.5. Per-row expression caveat 존속

`expression-exclusions` 에서 `columns` 가 제외되는 이유는 "handler 가 per-row 로 직접 평가하기 때문" 이며, 이는 `output.view.columns` 구조 변경과 **완전히 독립적** 입니다. 기존 테스트 (`EXPRESSION_EXCLUSIONS.table`) 는 그대로 유지.

### 5.6. 5개 노드 공통 구조

```
waiting:  { status: 'waiting_for_input', output: { view: { type: 'table', columns, rows, totalRows, rendered } } }
resumed:  { status: 'resumed', output: { view, interaction: { type, data, receivedAt } } }
non-blocking: { output: { view: { type: 'table', ... } } }  // status 없음
```

---

## 6. 참조

- [CONVENTIONS.md — Principle 4, Principle 11](../CONVENTIONS.md)
- [INCONSISTENCY_MATRIX.md 축 4 / 축 9](../INCONSISTENCY_MATRIX.md)
- 현 구현: `backend/src/nodes/presentation/table/table.handler.ts`, `.schema.ts`
- Expression 제외: `backend/src/modules/execution-engine/expression/expression-exclusions.ts` (`table: ['columns']`)
- 동적 포트 해석: `frontend/src/lib/node-definitions/resolve-dynamic-ports.ts` → `presentationButtonPorts()`
