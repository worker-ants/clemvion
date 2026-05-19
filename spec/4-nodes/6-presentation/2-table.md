# Spec: Table

> 관련 문서: [Presentation 공통 규약](./0-common.md) · [Spec 노드 개요](../0-overview.md) · [Spec 표현식 언어](../../5-system/5-expression-language.md) · [CONVENTIONS](../../conventions/node-output.md)

데이터를 표 형태로 구조화하여 렌더링하는 **Presentation 노드**. **Static** 모드는 `rows` 를 직접 정의하고(셀 값에 표현식 사용 가능), **Dynamic** 모드는 `dataSource` 배열의 각 항목에서 `columns[*].field` 를 매핑하여 행을 생성한다. 정렬·페이지네이션·HTML 렌더링·1MB cap 을 지원한다. 글로벌 `buttons` 가 하나라도 있으면 Blocking Mode 로 전이한다.

ButtonDef / 포트 토폴로지 / Blocking Mode / 출력 cap / Resumed 규약은 [공통 규약](./0-common.md) 참조.

---

## 1. 설정 (config)

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| mode | `static` / `dynamic` | ✗ | `dynamic` | 행 생성 방식. 미지정 시 `dynamic` (하위호환) |
| dataSource | String? | ✗ | — | 배열 데이터 소스. `{{ }}` 표현식 사용 가능 (dynamic 전용). 미지정 시 입력 포트 데이터 사용 |
| columns | ColumnDef[] | ✓ | `[]` | 컬럼 정의 배열. 빈 배열 시 warningRule `table:no-columns` |
| rows | RowDef[] | static 모드 ✓ | `[]` | 정적 행 데이터 (`Record<string, string>`). 셀 값에 `{{ }}` 표현식 사용 가능 |
| pagination | Boolean | ✗ | `true` | 페이지네이션 활성화 |
| pageSize | Number (1~200) | ✗ | `20` | 페이지당 행 수 |
| sortBy | String? | ✗ | — | 기본 정렬 컬럼 필드명. `columns[*].field` 중 하나여야 함 (`validateConfig` cross-check) |
| sortOrder | `asc` / `desc` | ✗ | `asc` | 정렬 방향 |
| buttons | ButtonDef[] | ✗ | `[]` | 글로벌 버튼 정의. 비어있지 않으면 Blocking Mode 진입. 구조는 [공통 §1](./0-common.md#1-buttondef-구조) |

**ColumnDef 구조:**

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| field | String | ✓ | 데이터 필드 경로(dot-path 지원, 예: `address.city`) 또는 per-item `{{ }}` 표현식 (예: `{{ $sourceItem.first + " " + $sourceItem.last }}`) |
| label | String | ✓ | 컬럼 헤더 표시 이름 (`{{ }}` 표현식 지원, dynamic 모드는 핸들러가 `$dataSource` 컨텍스트로 평가) |
| width | String? | ✗ | 컬럼 너비 (예: `200px`, `30%`) |
| sortable | Boolean? | ✗ | 정렬 가능 여부 |
| format | String? | ✗ | 날짜/숫자 포맷 문자열 |

**Per-item 표현식 변수** (`columns[*].field` / `columns[*].label` 평가 시 추가 제공):

| 변수 | 타입 | 설명 |
|------|------|------|
| `$dataSource` | `unknown[]` | 정규화된 데이터 소스 배열 전체 |
| `$sourceItem` | `unknown` | 현재 순회 중인 배열 항목 |
| `$sourceItemIndex` | `number` | 현재 항목의 0-based 인덱스 |

기존 변수(`$input`, `$var`, `$node`, `$execution` 등)도 동시 사용 가능. `columns` 는 [표현식 제외 목록(`expression-exclusions.table`)](../../../codebase/backend/src/modules/execution-engine/expression/expression-exclusions.ts) 에 등록되어 핸들러가 per-row 컨텍스트로 평가한다 (엔진이 사전 평가하지 않음).

> 버튼 클릭 시까지 무제한 대기 (외부 cancel/종료 전까지 타임아웃 없음).
>
> Source of truth: `codebase/backend/src/nodes/presentation/table/table.schema.ts` (export `tableNodeConfigSchema`)

## 2. 설정 UI

**Dynamic 모드:**

```
┌──────────────────────────────────────┐
│  Table Settings                      │
│  ─────────────────────────────────── │
│  Mode: [Dynamic (from data) ▼]       │
│                                      │
│  Data Source:                        │
│  [{{ $node["API"].output.users }}]   │
│  hint: 배열 데이터 소스              │
│        (미지정 시 이전 노드 출력)    │
│                                      │
│  ─── Columns ──────────────────────  │
│  ┌────────────────────────────── [×]│
│  │ Field: [name________]            │
│  │ Label: [이름________]            │
│  └─────────────────────────────────  │
│  ┌────────────────────────────── [×]│
│  │ Field: [email_______]            │
│  │ Label: [이메일______]            │
│  └─────────────────────────────────  │
│  [+ Add Column]                      │
│                                      │
│  ☑ Enable Pagination                 │
│  Page Size: [20_]                    │
│  Sort By:    [score_____]            │
│  Sort Order: [asc ▼]                 │
│                                      │
│  ▶ Buttons ───────────────────────── │
└──────────────────────────────────────┘
```

**Static 모드:**

```
┌──────────────────────────────────────┐
│  Table Settings                      │
│  ─────────────────────────────────── │
│  Mode: [Static (manual) ▼]           │
│                                      │
│  ─── Columns ──────────────────────  │
│  Field: [col0_]  Label: [항목___]    │
│  Field: [col1_]  Label: [값_____]    │
│  [+ Add Column]                      │
│                                      │
│  ─── Rows ─────────────────────────  │
│  ┌ Row 1 ──────────────────────  [×]│
│  │ col0: [사용자 수______________]  │
│  │ col1: [{{ $var.count }}_______]  │
│  └─────────────────────────────────  │
│  [+ Add Row]                         │
│                                      │
│  ☑ Enable Pagination                 │
│  Page Size: [20_]                    │
│  Sort Order: [asc ▼]                 │
└──────────────────────────────────────┘
```

- Dynamic 모드: `field` 에 dot-path 또는 per-item `{{ }}` 표현식. `label` 에도 표현식 가능.
- Static 모드: 각 cell 값에서 `{{ }}` 표현식 사용 가능 (엔진이 사전 평가).
- 컬럼/행 드래그로 순서 변경, `[×]` 로 삭제.
- 버튼 설정 UI 는 접이식 "Buttons" 섹션 — [Carousel §6](./1-carousel.md#6-버튼-설정-ui) 와 동일.

## 3. 포트

### 3.1 입력 포트

| id | label | type | dynamic | 설명 |
|------|-------|------|---------|------|
| `in` | Input | data | false | dynamic 모드에서 `dataSource` 미지정 시 데이터 소스로 사용 |

### 3.2 출력 포트

| 모드 | id | label | dynamic | 설명 |
|------|------|-------|---------|------|
| 비-블로킹 (`buttons: []`) | `out` | Output | false | 노드 결과 출력 |
| 블로킹 — port 버튼 | `<button.id>` | (버튼 라벨) | true | port 타입 버튼마다 동적 생성 ([공통 §7.1](./0-common.md#71-동적-포트-명명-규칙-principle-6)) |
| 블로킹 — link 전용 | `continue` | Continue | true | 모든 버튼이 link 타입일 때 자동 생성 |

> Table 은 per-row 버튼을 지원하지 않는다 (글로벌 `buttons` 만). Carousel 의 `__item_<idx>` suffix 규칙은 적용되지 않는다.
>
> 포트 토폴로지·Blocking Mode 흐름은 [공통 §2](./0-common.md#2-포트-토폴로지-non-blocking-vs-blocking) / [공통 §3](./0-common.md#3-blocking-mode-실행-흐름) 참조.

## 4. 실행 로직

1. `mode` 결정 (기본값 `dynamic`).
2. **Static 모드**: `config.rows` 중 plain object 만 필터링 → 각 행에서 `columns[*].field` 만 추출하여 `dataRows` 생성 (`undefined` 는 `null`).
3. **Dynamic 모드**:
   1. `config.dataSource` 가 있으면 그 값을, 없으면 입력 포트 데이터를 사용. 비배열은 `[obj]` 로 래핑.
   2. 컬럼을 expression(`{{` 포함) 과 plain field 로 사전 분류.
   3. 각 항목에 대해 `{ $dataSource, $sourceItem, $sourceItemIndex }` 를 expressionContext 에 추가하여 셀 값 산출 — expression 컬럼은 `evaluate()` 로 평가, plain 컬럼은 `getNestedValue` 로 dot-path 접근. 평가 실패 시 해당 셀은 `null`.
4. `sortBy` 가 지정되면 `sortOrder` 에 따라 `dataRows` 정렬 (null 값은 항상 끝으로).
5. `pageSize` 가 truthy 이면 `dataRows = dataRows.slice(0, pageSize)`.
6. **Cap 적용**: `truncateArrayForOutput(dataRows, PRESENTATION_MAX_BYTES)` — 직렬화 후 1MB 초과 시 tail 부터 element 단위로 잘라낸다 ([공통 §4](./0-common.md#4-출력-포맷-principle-11--43--45)).
7. **컬럼 라벨 평가** (dynamic 모드 한정): label 에 `{{` 가 포함된 컬럼만 `$dataSource` 컨텍스트로 평가 → `resolvedColumns`. `output.columns` 에 surface.
8. **HTML 렌더링**: `resolvedColumns` 헤더 + cap 적용된 `cappedRows.value` 본문. 잘린 행의 HTML 이 leak 되지 않는다.
9. **버튼 분기**:
   - `buttons.length > 0` → §5.4 (waiting). 엔진이 사용자 입력 수신 후 §5.5 (resumed).
   - 아니면 → §5.1 (비-블로킹).

> 핸들러: `codebase/backend/src/nodes/presentation/table/table.handler.ts`. config echo 는 `context.rawConfig` 우선 (CONVENTIONS Principle 7).

## 5. 출력 구조

> CONVENTIONS Principle 11 포맷. JSON 예시는 `undefined` 필드 생략, 5필드 (`config`/`output`/`meta?`/`port?`/`status?`) 외 top-level 키 금지.
>
> Presentation 카테고리의 5필드 사용 패턴은 [공통 §7](./0-common.md#7-5필드-공통-규약-presentation-카테고리) 참조. 케이스: §5.1 (비-블로킹) / §5.4 (waiting) / §5.5 (resumed). 별도 에러 케이스 없음 — config 검증 실패는 pre-flight throw (§6).

### 5.1 Case: 비-블로킹 (`buttons: []`)

```json
{
  "config": {
    "mode": "dynamic",
    "columns": [
      { "field": "name", "label": "Name" },
      { "field": "email", "label": "{{ $var.locale === \"ko\" ? \"이메일\" : \"Email\" }}" }
    ],
    "pageSize": 20,
    "sortBy": "name",
    "sortOrder": "asc"
  },
  "output": {
    "rows": [
      { "name": "Alice", "email": "alice@test.com" },
      { "name": "Bob", "email": "bob@test.com" }
    ],
    "totalRows": 2,
    "columns": [
      { "field": "name", "label": "Name" },
      { "field": "email", "label": "Email" }
    ]
  }
}
```

> **D5 결정 (2026-05-17) — `output.rendered` 폐기, frontend client-side 렌더로 전환** (plan/in-progress/node-output-redesign D5): backend 는 HTML snapshot 을 더 이상 생성하지 않는다. 다운스트림/UI 는 `output.rows` + `output.columns` 로 직접 렌더한다 (Carousel/Chart 와 완전 일관). escape 책임은 표시 계층 (React JSX 자동 escape) 으로 이동. 다운스트림 expression `$node["T"].output.rendered` 참조 워크플로는 깨지므로 마이그레이션 필요.

| 필드 | 타입 | 출처 | 설명 |
|------|------|------|------|
| `config.mode` | `'static'` / `'dynamic'` | config echo (Principle 7) | 행 생성 방식 |
| `config.columns` | ColumnDef[] | config echo | **raw** 컬럼 정의 — `label` 에 `{{ }}` 가 있으면 보존됨 |
| `config.pageSize` | number? | config echo | 사용자 설정 (있을 때만 echo) |
| `config.sortBy` / `config.sortOrder` | string? / enum? | config echo | 정렬 설정 (sortBy 있을 때만 echo) |
| `output.rows` | `Record<string, unknown>[]` | runtime | static: `columns[*].field` 기준으로 필터링된 행 / dynamic: `dataSource` 항목별로 평가된 셀. cap 후 잘린 결과일 수 있음 |
| `output.totalRows` | number | runtime | **cap 적용 전** 데이터셋 크기 (pageSize / sort 적용 후). `rows.length !== totalRows` 만으로 cap 감지 가능 |
| `output.columns` | ColumnDef[] | runtime | `label` 표현식이 평가된 컬럼 (dynamic 모드 한정). config 의 raw label 과 직교 (Principle 1.1 / Principle 7) |
| `output.rowsTruncated?` | `true` | runtime — cap 동작 시에만 | 1MB cap 으로 tail 이 잘렸음을 표시 |
| `output.rowsTotalCount?` | number | runtime — cap 동작 시에만 | cap 전 element 개수 |

> **Cap 신호 일관성**: `output.totalRows` 는 cap 전 크기, `output.rows.length` 는 cap 후 길이. 둘이 다르면 잘림. cap 발동 시 `rowsTruncated: true` 와 `rowsTotalCount` 가 함께 명시되어 다운스트림이 양방향으로 감지 가능 ([공통 §4](./0-common.md#4-출력-포맷-principle-11--43--45)).

**Expression 접근 예**:
- `$node["T"].output.rows[0].name` → `"Alice"`
- `$node["T"].output.totalRows` → 2
- `$node["T"].output.columns[0].label` → 평가된 라벨 (예: `"Email"`)
- `$node["T"].config.columns[0].label` → raw 템플릿 (예: `"{{ $var.locale === \"ko\" ? \"이메일\" : \"Email\" }}"`)

### 5.4 Case: Waiting (`buttons.length > 0`, 초기 진입)

```json
{
  "config": {
    "mode": "dynamic",
    "columns": [
      { "field": "name", "label": "Name" },
      { "field": "email", "label": "Email" }
    ],
    "pageSize": 20,
    "buttons": [
      { "id": "approve", "label": "Approve", "type": "port", "style": "primary" },
      { "id": "reject", "label": "Reject", "type": "port", "style": "danger" }
    ],
    "buttonConfig": {
      "buttons": [
        { "id": "approve", "label": "Approve", "type": "port", "style": "primary" },
        { "id": "reject", "label": "Reject", "type": "port", "style": "danger" }
      ]
    }
  },
  "output": {
    "rows": [
      { "name": "Alice", "email": "alice@test.com" },
      { "name": "Bob", "email": "bob@test.com" }
    ],
    "totalRows": 2,
    "columns": [
      { "field": "name", "label": "Name" },
      { "field": "email", "label": "Email" }
    ]
  },
  "meta": {
    "interactionType": "buttons",
    "durationMs": 0
  },
  "status": "waiting_for_input"
}
```

| 필드 | 타입 | 출처 | 설명 |
|------|------|------|------|
| `config.*` | (§5.1 + 추가) | config echo | §5.1 의 모든 필드 + `buttons` (raw ButtonDef[]) + `buttonConfig.buttons` (엔진 입력 페이로드) |
| `output.rows` / `output.totalRows` / `output.columns` | (§5.1 동일) | runtime | 동일. waiting 시점의 immutable snapshot |
| `output.rowsTruncated?` / `output.rowsTotalCount?` | (§5.1 동일) | runtime — cap 동작 시 | 동일 |
| `meta.interactionType` | `'buttons'` | handler return | UI 가 어떤 인터랙션을 그릴지 결정 |
| `meta.durationMs` | number | handler return (engine override) | 엔진이 실제 측정값으로 덮어씀 — 핸들러는 `0` 으로 placeholder |
| `status` | `'waiting_for_input'` | handler return | Blocking Mode 진입. 엔진은 WS `execution.waiting_for_input` 발행 ([공통 §3](./0-common.md#3-blocking-mode-실행-흐름)) |

> Table 은 per-row 버튼을 지원하지 않으므로 `buttonConfig.buttonItemMap` 은 발행하지 않는다 (Carousel 한정).

### 5.5 Case: Resumed (버튼 클릭 / Continue 후)

엔진이 사용자 입력을 받아 §5.4 의 `output` 에 `interaction` 을 추가하고 `port` / `status` 를 갱신한다. waiting 시점의 `rows` / `totalRows` / `columns` 는 immutable snapshot 으로 유지된다 ([공통 §4.2](./0-common.md#42-resumed-버튼-클릭--폼-제출-후) / CONVENTIONS §4.4).

#### 5.5.1 port 버튼 클릭

```json
{
  "config": { "mode": "dynamic", "columns": [ /* … */ ], "buttons": [ /* … */ ], "buttonConfig": { /* … */ } },
  "output": {
    "rows": [
      { "name": "Alice", "email": "alice@test.com" },
      { "name": "Bob", "email": "bob@test.com" }
    ],
    "totalRows": 2,
    "columns": [ /* waiting snapshot 유지 */ ],
    "interaction": {
      "type": "button_click",
      "data": {
        "buttonId": "approve",
        "buttonLabel": "Approve"
      },
      "receivedAt": "2026-04-19T12:34:56.789Z"
    }
  },
  "meta": { "interactionType": "buttons", "durationMs": 9800 },
  "port": "approve",
  "status": "resumed"
}
```

| 필드 | 타입 | 출처 | 설명 |
|------|------|------|------|
| `output.<waiting fields>` | (§5.4 동일) | immutable snapshot | waiting 시점 그대로 유지 (CONVENTIONS §4.4) |
| `output.interaction.type` | `'button_click'` | engine inject | port 타입 버튼 클릭 |
| `output.interaction.data.buttonId` | string | engine inject | 클릭된 버튼의 `config.buttons[i].id` |
| `output.interaction.data.buttonLabel` | string | engine inject | 클릭된 버튼의 (평가된) 라벨 |
| `output.interaction.receivedAt` | ISO8601 | engine inject | 클릭 수신 시각 (top-level 명칭은 `receivedAt`, CONVENTIONS §4.4) |
| `port` | `<button.id>` | engine route | 클릭된 port 버튼의 동적 포트 ID |
| `status` | `'resumed'` | engine | 모든 인터랙션 종류 공통 (CONVENTIONS §4.1) |

> Table 은 per-row 버튼이 없으므로 `interaction.data.selectedItem` 은 사용되지 않는다 (Carousel 한정 — [공통 §4.2](./0-common.md#42-resumed-버튼-클릭--폼-제출-후)).

#### 5.5.2 link 전용 — Continue 클릭

모든 버튼이 link 타입이면 `continue` 포트가 자동 생성되고, 사용자가 `[Continue →]` 를 누르면 다음과 같이 재개된다.

```json
{
  "output": {
    "rows": [ /* waiting snapshot */ ],
    "totalRows": 2,
    "columns": [ /* waiting snapshot */ ],
    "interaction": {
      "type": "button_continue",
      "data": {
        "buttonId": "more",
        "buttonLabel": "More",
        "url": "https://docs.example.com/table"
      },
      "receivedAt": "2026-04-19T12:34:56.789Z"
    }
  },
  "meta": { "interactionType": "buttons", "durationMs": 9800 },
  "port": "continue",
  "status": "resumed"
}
```

| 필드 | 변경점 |
|------|--------|
| `output.interaction.type` | `'button_continue'` |
| `output.interaction.data.url` | link 버튼의 (평가된) URL |
| `port` | `'continue'` |

**Expression 접근 예**:
- `$node["T"].port === "approve"` → port 버튼 클릭 분기 판별
- `$node["T"].output.interaction.data.buttonId` → 클릭된 버튼 식별
- `$node["T"].status === "resumed" && $node["T"].output.interaction.type === "button_continue"` → Continue 분기

## 6. 에러 코드

Table 은 **runtime 에러 포트를 갖지 않는다**. 모든 검증 실패는 pre-flight 단계에서 throw (CONVENTIONS Principle 3.1):

| 발생 조건 | 메시지 | 시점 | 출처 |
|-----------|--------|------|------|
| `columns` 가 빈 배열/누락 | `컬럼을 1개 이상 정의해야 합니다.` | warningRule (캔버스 배지) + handler.validate | `warningRules.table:no-columns` |
| `mode` 가 `static`/`dynamic` 외 | `Mode 는 static 또는 dynamic 이어야 합니다.` | warningRule + handler.validate | `warningRules.table:invalid-mode` |
| `columns` 가 array 아님 | `columns must be an array` | handler.validate | `validateTableConfig` |
| static 모드에서 `rows` 가 array 아님 | `rows must be an array in static mode` | handler.validate | `validateTableConfig` |
| `sortBy` 가 `columns[*].field` 와 mismatch | `sortBy "<value>" must match one of the defined column fields` | handler.validate | `validateTableConfig` |
| 버튼 라벨 누락 / link URL 누락 / port + URL 충돌 / 버튼 ID 중복 / 5개 초과 | (공통 §1.1 메시지) | handler.validate | `validateButtons` ([공통 §1.1](./0-common.md#11-유효성-검증)) |

> per-row expression 평가 실패는 throw 하지 않고 해당 셀을 `null` 로 남긴다 (`safeEvaluate`) — runtime 비즈니스 실패로 분류 (Principle 3.1 의 "예상 가능한 비즈니스 실패").

## 7. 캔버스 요약

[공통 §5 캔버스 요약](./0-common.md#5-캔버스-요약) — `Table` 행 인용.

- 버튼 없음: `{N} columns` (pagination 활성화 시 `· pagination` 추가)
- 버튼 있음: `{N} columns · {N} buttons`
