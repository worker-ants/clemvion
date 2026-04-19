# Chart (`chart`) — Output 일관성 개선안 (재작성)

- **카테고리**: presentation
- **현 문서**: [../../node-specs/presentation/chart.md](../../node-specs/presentation/chart.md)
- **전역 규칙**: [../CONVENTIONS.md](../CONVENTIONS.md)
- **관련 Principle**: **Principle 1.1 (`config` ↔ `output` 직교성)** — 최우선, **Principle 4 (블로킹/재개)**, Principle 0, Principle 11

> **요약**: chart 는 입력 배열을 `xAxis` 기준으로 버킷팅해 `{ x, y }` 포인트 배열을 집계합니다. `data` 는 **런타임 집계 결과** 이므로 `output` 에 유지. 그러나 `chartType` / `title` 은 **리터럴 config** 이므로 echo 금지 (Principle 1.1 위반). 이전 초안의 `output.view.{chartType, title}` 은 전형적인 config echo 였으며, 재작성 안에서 이를 제거합니다. `chartType` schema-handler 불일치 caveat (Principle 3.1) 는 별도 트랙으로 유지.

---

## 1. 현재 Output 구조 요약

Chart 는 입력 배열을 집계/변환해 `{ x, y }` 포인트 배열로 만듭니다. 버튼이 설정되면 blocking 이 됩니다. per-item 버튼은 지원하지 않고 global 버튼만 있습니다.

### Case A — 버튼 없음 (non-blocking)

```json
{
  "config": {
    "chartType": "bar",
    "title": "Sales by Month",
    "xAxis": { "field": "month" },
    "yAxis": { "field": "revenue", "aggregation": "sum" }
  },
  "output": {
    "type": "chart",
    "chartType": "bar",
    "title": "Sales by Month",
    "data": [
      { "x": "Jan", "y": 100 },
      { "x": "Feb", "y": 250 }
    ]
  }
}
```

### Case B — 버튼 있음, 초기 실행 (waiting)

```json
{
  "config": {
    "chartType": "bar", "title": "…",
    "xAxis": { "field": "month" }, "yAxis": { "field": "revenue" },
    "buttonConfig": { "buttons": [ { "id": "export", "label": "Export", "type": "port" } ] }
  },
  "output": {
    "type": "chart",
    "chartType": "bar",
    "title": "…",
    "data": [ /* … */ ]
  },
  "status": "waiting_for_input",
  "meta": { "interactionType": "buttons" }
}
```

### Case C — port 버튼 클릭 후 (resumed, 현 구현)

```json
{
  "output": {
    "interaction": {
      "interactionType": "button_click",
      "buttonId": "export", "buttonLabel": "Export",
      "clickedAt": "2026-04-19T12:34:56.000Z"
    },
    "previousOutput": { "type": "chart", "chartType": "bar", "data": [ /* … */ ] }
  },
  "port": "export",
  "status": "button_click",
  "meta": { "interactionType": "buttons" }
}
```

### Case D — link Continue

```json
{
  "output": {
    "interaction": { "interactionType": "button_continue", "clickedAt": "…" },
    "previousOutput": { "type": "chart", /* … */ }
  },
  "port": "continue",
  "status": "button_continue"
}
```

---

## 2. 식별된 불일치

| # | 항목 | 위반한 Principle | 설명 |
| --- | --- | --- | --- |
| 1 | Waiting 시 `output.chartType` | **Principle 1.1 (config echo 금지)** | `chartType` 는 사용자 UI 설정의 리터럴 값. 후속 노드는 `$node["Ch"].config.chartType` 로 참조해야 함. |
| 2 | Waiting 시 `output.title` | **Principle 1.1** | `title` 동상. |
| 3 | Waiting 시 `output.type` 판별자 | **Principle 1.1.4 / 축 4** | 노드 타입은 워크플로우 정의에서 파악. 판별자 불필요. |
| 4 | Resumed 시 `output.previousOutput` | **Principle 4.2** | CONVENTIONS 4.2 에 제거 명시. `chartType`/`title` 는 config, `data` 는 waiting 시점 output 유지로 재구성. |
| 5 | `status: 'button_click' \| 'button_continue'` | **Principle 4.1 / 축 9** | `'resumed'` 로 통일. |
| 6 | `output.interaction.interactionType` 필드명 | Principle 4 | `output.interaction.type` 으로 축약. |
| 7 | `clickedAt` top-level 위치 | Principle 4.4 | top-level 은 `receivedAt`. |
| 8 | `chartType` handler/schema 제약 불일치 | Principle 3.1 | schema=`bar\|line\|pie\|donut\|area`, handler=`bar\|line\|pie` 만. **본 개선안 범위 밖의 별도 caveat**. |

**유지되는 사항**:

- `data` 는 waiting output 에 **유지**. 이유: input 을 `xAxis` 기준으로 버킷팅하고 `yAxis.aggregation` 을 적용한 **런타임 집계** 결과. config 에 없는 값.

---

## 3. 제안된 Output 구조

### 3.1. Waiting (`status: "waiting_for_input"`)

**Before**

```json
{
  "output": {
    "type": "chart",
    "chartType": "bar",
    "title": "Sales by Month",
    "data": [ { "x": "Jan", "y": 100 }, { "x": "Feb", "y": 250 } ]
  },
  "status": "waiting_for_input"
}
```

**After**

```json
{
  "config": {
    "chartType": "bar",
    "title": "Sales by Month",
    "xAxis": { "field": "month" },
    "yAxis": { "field": "revenue", "aggregation": "sum" },
    "buttonConfig": {
      "buttons": [ { "id": "export", "label": "Export", "type": "port" } ]
    }
  },
  "output": {
    "data": [
      { "x": "Jan", "y": 100 },
      { "x": "Feb", "y": 250 },
      { "x": "Mar", "y": 180 }
    ]
  },
  "status": "waiting_for_input",
  "meta": { "interactionType": "buttons", "durationMs": 15 }
}
```

핵심:

- `output.data` — input 을 xAxis 기준 버킷팅 + yAxis.aggregation 적용한 **런타임 집계** 결과. 유지.
- `output.view` 래퍼 없음 (Principle 1.1.4).
- `output.type` / `output.chartType` / `output.title` **모두 제거** (Principle 1.1).
- 프런트 / 후속 노드는 `config.chartType` / `config.title` 에서 직접 참조.

### 3.2. Non-blocking (버튼 없음) — 동일 구조

```json
{
  "config": { "chartType": "bar", "title": "Sales by Month", "xAxis": { /* … */ }, "yAxis": { /* … */ } },
  "output": {
    "data": [
      { "x": "Jan", "y": 100 },
      { "x": "Feb", "y": 250 }
    ]
  }
}
```

> status 없음 (undefined). 구조는 waiting 과 동일.

### 3.3. Resumed — port 버튼 클릭

```json
{
  "config": { "chartType": "bar", "title": "Sales by Month", "buttonConfig": { /* … */ } },
  "output": {
    "data": [
      { "x": "Jan", "y": 100 },
      { "x": "Feb", "y": 250 },
      { "x": "Mar", "y": 180 }
    ],
    "interaction": {
      "type": "button_click",
      "data": {
        "buttonId": "export",
        "buttonLabel": "Export"
      },
      "receivedAt": "2026-04-19T12:34:56.000Z"
    }
  },
  "port": "export",
  "status": "resumed",
  "meta": { "interactionType": "buttons", "durationMs": 7200 }
}
```

- waiting 시점의 `data` 를 **그대로 유지** (immutable snapshot).
- `interaction.data` 에 버튼 정보 (Principle 4.5). `interaction.data.data` 같은 이중 네스팅은 없음 — 최상위 `output.data` (집계 배열) 와 `output.interaction.data` (interaction payload) 는 서로 다른 개념.

### 3.4. Resumed — link 타입 Continue

```json
{
  "output": {
    "data": [ /* waiting snapshot */ ],
    "interaction": {
      "type": "button_continue",
      "data": {
        "buttonId": "details",
        "buttonLabel": "See Details",
        "url": "https://dashboard.example.com/sales"
      },
      "receivedAt": "2026-04-19T12:34:56.000Z"
    }
  },
  "port": "continue",
  "status": "resumed"
}
```

### 3.5. chart 는 per-item 버튼 불포함

- `supportsItems: false`, `supportsItemButtons: false`. Principle 6 의 `__item_{index}` suffix 는 chart 에 **적용되지 않음**.
- per-bar / per-point 액션이 필요해지면 향후 확장 시 carousel 의 suffix 규칙 재사용.

### 3.6. `chartType` caveat — 별도 이슈 (유지)

- 현재 handler validation 은 `bar | line | pie` 만 허용하지만 schema 는 `donut | area` 도 받음. 이는 **Principle 3.1 (Pre-flight 에러)** 위반.
- 본 개선안 범위에서는 **유지** (별도 P1 이슈로 다룸). 두 옵션:
  - (A) handler 의 `VALID_CHART_TYPES` 에 `donut | area` 추가 + 렌더러 구현.
  - (B) schema enum 에서 `donut | area` 제거 (breaking for existing drafts).
- output 구조에는 영향 없음.

---

## 4. 마이그레이션 영향도

### 4.1. Expression 경로 변화

| Before | After | Breaking? | 비고 |
| --- | --- | --- | --- |
| `$node["Ch"].output.type` | — (제거) | **Yes** | 판별자 폐기. |
| `$node["Ch"].output.chartType` | `$node["Ch"].config.chartType` | **Yes (high)** | config 리터럴로 이동. |
| `$node["Ch"].output.title` | `$node["Ch"].config.title` | **Yes** | 동상. |
| `$node["Ch"].output.data` | `$node["Ch"].output.data` | **No** | 유지 (runtime 값). |
| `$node["Ch"].output.data[0].x` | `$node["Ch"].output.data[0].x` | **No** | 동상. |
| `$node["Ch"].output.data[0].y` | `$node["Ch"].output.data[0].y` | **No** | 동상. |
| `$node["Ch"].output.interaction.buttonId` | `$node["Ch"].output.interaction.data.buttonId` | **Yes** | |
| `$node["Ch"].output.interaction.buttonLabel` | `$node["Ch"].output.interaction.data.buttonLabel` | **Yes** | |
| `$node["Ch"].output.interaction.interactionType` | `$node["Ch"].output.interaction.type` | **Yes** | |
| `$node["Ch"].output.interaction.clickedAt` | `$node["Ch"].output.interaction.receivedAt` | **Yes** | top-level 명칭 변경. |
| `$node["Ch"].output.previousOutput.data` | `$node["Ch"].output.data` | **Yes** | resumed 시점 data 는 waiting 과 동일 (immutable). |
| `$node["Ch"].output.previousOutput.chartType` | `$node["Ch"].config.chartType` | **Yes** | |
| `$node["Ch"].output.previousOutput.title` | `$node["Ch"].config.title` | **Yes** | |
| `$node["Ch"].status === "button_click"` | `$node["Ch"].status === "resumed" && $node["Ch"].output.interaction.type === "button_click"` | **Yes** | |
| `$node["Ch"].status === "button_continue"` | `$node["Ch"].status === "resumed" && $node["Ch"].output.interaction.type === "button_continue"` | **Yes** | |
| `$node["Ch"].port === "export"` | 유지 | No | |
| `$node["Ch"].config.chartType` | 유지 | No | 이제 유일한 참조 경로. |

### 4.2. 영향도 매트릭스

| 영역 | 영향 수준 | 세부 |
| --- | --- | --- |
| 기존 워크플로우 expression (`output.data`) | **NONE** | 경로 유지 — 가장 큰 호환성 이점. dashboard/report 템플릿 그대로 동작. |
| 기존 워크플로우 expression (`output.chartType` / `output.title`) | **HIGH** | `config.*` 로 이동. |
| 프런트엔드 차트 렌더러 | **MEDIUM** | `config.chartType` + `output.data` 조합으로 렌더. chart.js/recharts 에 공급하는 데이터 shape (`{x, y}`) 자체는 불변. |
| 엔진 resume 경로 | **HIGH** | `previousOutput` 제거, waiting 시점 data 보존, interaction 3-필드 정규화. |
| `chartType` validation | **INDEPENDENT** | 본 개선안과 별개 이슈, 동시 조치 권장. |
| 테스트 | **HIGH** | chart handler unit + aggregation 로직 회귀 테스트. |

### 4.3. 마이그레이션 전략

1. **P0 — Handler 변경**: `ChartHandler.execute()` 가 blocking / non-blocking 둘 다 `output: { data }` 만 반환. `type` / `chartType` / `title` 제거.
2. **P0 — Engine resume 경로**:
   - `previousOutput` 제거.
   - waiting 시점의 `data` 를 resumed 에서도 유지 (immutable).
   - interaction 을 `{ type, data, receivedAt }` 3-필드로 재정렬.
3. **P0 — Status 전이**: `button_click` / `button_continue` → `'resumed'` 고정.
4. **P1 — Expression migration script**:
   - `\.output\.type\b` (chart 문맥) → 제거
   - `\.output\.chartType\b` → `.config.chartType`
   - `\.output\.title\b` → `.config.title`
   - `\.output\.interaction\.interactionType` → `.output.interaction.type`
   - `\.output\.interaction\.(buttonId|buttonLabel)` → `.output.interaction.data.$1`
   - `\.output\.interaction\.clickedAt` → `.output.interaction.receivedAt`
   - `\.output\.previousOutput\.data` → `.output.data`
   - `\.output\.previousOutput\.chartType` → `.config.chartType`
   - `\.output\.previousOutput\.title` → `.config.title`
   - status 리터럴 치환.
5. **P1 — `chartType` caveat 해결** (별도 트랙): handler validation 확장 또는 schema enum 축소.
6. **P2 — 과거 이력 호환 뷰어**.

---

## 5. 근거

### 5.1. Principle 1.1.3 — chart 가 직접 예시에 포함됨

> `chart.config.chartType = "bar"` → output 에 echo 금지. 반면 `output.data` 는 input 을 집계한 런타임 값이므로 OK.

CONVENTIONS 1.1.3 에 chart 가 직접 예시로 명시되어 있습니다. 본 제안은 이 조항의 구체화.

### 5.2. Principle 1.1.2 — 식별 기준

> "이 값을 알기 위해 노드를 실제 실행해야 하는가?"

- `chartType`, `title` — schema 만 봐도 알 수 있음 → `config`.
- `data = [{x, y}, ...]` — input 배열에 따라 결과가 달라짐 (xAxis 버킷팅, aggregation) → `output`.

### 5.3. Principle 4.3 — chart 의 waiting output 공식 정의

> | `chart` | `{ data }` | input 을 xAxis 기준으로 **런타임 집계**한 `[{x, y}, ...]`. chartType/title 은 config. |

CONVENTIONS 4.3 표가 chart 의 waiting output 을 `{ data }` 로 정의합니다. `chartType`/`title` 이 명시적으로 config 로 분리됨.

### 5.4. Principle 4.2 — previousOutput 제거

> 현재 carousel/chart/table/template의 `output.previousOutput` → **제거**.

waiting 시점의 `data` 는 resumed 시점에도 동일 `output.data` 로 유지되므로 별도 스냅샷 키 불필요. `chartType`/`title` 는 config 에 그대로 있음.

### 5.5. Principle 4.4 — Resumed 시 waiting output 보존

> Waiting 시점 output 을 그대로 유지 (immutable snapshot) 하고 `output.interaction` 을 추가.

chart 의 경우 `output.data` (집계 배열) 가 그대로 유지되고, `output.interaction` 이 추가됨.

### 5.6. `data` 배열 내부 shape 보존

chart 의 `data: [{ x, y? }, …]` 구조는 다운스트림 렌더러(chart.js, recharts 등) 가 직접 소비하는 정형 shape 이므로 **내부 element shape 은 변경하지 않습니다**. view 래퍼만 벗기면 끝.

### 5.7. `title?` 의 optional 처리

- `config.title` 미지정 시 — handler 가 `output.title: undefined` 던 과거 동작 → 재작성 안에서는 `output.title` 자체가 없어졌으므로 무관.
- 프런트는 `config.title` 이 존재하는지 확인하고 렌더.

### 5.8. 5개 presentation 노드 공통 구조 수렴

```
waiting      : { status: 'waiting_for_input', output: { data } }
resumed      : { status: 'resumed', output: { data, interaction: { type, data, receivedAt } } }
non-blocking : { output: { data } }
```

> **주의**: `output.data` (집계 배열) 와 `output.interaction.data` (interaction payload) 는 이름이 같지만 **다른 네임스페이스**. 혼동 방지를 위해 코드 리뷰 / 문서에서 항상 full path 로 언급.

- config 리터럴 (`chartType`, `title`, `xAxis`, `yAxis`, `buttonConfig`) 은 `output` echo 금지 (Principle 1.1).
- 노드 타입 판별자 없음 (Principle 1.1.4).
- 상호작용은 `output.interaction.{type, data, receivedAt}` (Principle 4.4).

---

## 6. 참조

- [CONVENTIONS.md — Principle 1.1, Principle 4, Principle 11](../CONVENTIONS.md)
- [INCONSISTENCY_MATRIX.md 축 4 / 축 7.5 / 축 9](../INCONSISTENCY_MATRIX.md)
- 현 구현: `backend/src/nodes/presentation/chart/chart.handler.ts`, `.schema.ts`
- 관련 미해결 caveat: `chartType` schema-handler 불일치 (Principle 3.1)
- 동적 포트 해석: `frontend/src/lib/node-definitions/resolve-dynamic-ports.ts` → `presentationButtonPorts()`
