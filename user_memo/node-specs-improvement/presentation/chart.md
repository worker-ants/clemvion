# Chart (`chart`) — Output 일관성 개선안

- **카테고리**: presentation
- **현 문서**: [../../node-specs/presentation/chart.md](../../node-specs/presentation/chart.md)
- **전역 규칙**: [../CONVENTIONS.md](../CONVENTIONS.md)
- **관련 Principle**: **Principle 4 (블로킹/재개)**, Principle 0, Principle 11

> **요약**: chart 는 carousel/table 과 동일한 버튼/블로킹 패턴을 사용합니다. waiting 시 `output.view` 래퍼를 추가하고, resumed 시 `previousOutput` → `view` 로 이동, interaction 래퍼 정규화, `status` 를 `'resumed'` 로 통일합니다. chart 는 per-item 버튼을 지원하지 않으며, handler validation 이 schema 보다 좁은 제약(`chartType ∈ {bar, line, pie}`)을 가지는 기존 caveat 는 별도 이슈로 추적합니다.

---

## 1. 현재 Output 구조 요약

Chart 는 입력 배열을 집계/변환해 `{ x, y }` 포인트 배열로 만들어 렌더링합니다. 버튼이 설정되면 blocking 이 됩니다. per-item 버튼은 지원하지 않고 global 버튼만 있습니다.

### Case A — 버튼 없음 (non-blocking)

```json
{
  "config": {
    "chartType": "bar", "title": "Sales by Month",
    "xAxis": { "field": "month" },
    "yAxis": { "field": "revenue", "aggregation": "sum" }
  },
  "output": {
    "type": "chart",
    "chartType": "bar",
    "title": "Sales by Month",
    "data": [ { "x": "Jan", "y": 100 }, { "x": "Feb", "y": 250 } ]
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

### Case C — port 버튼 클릭 후 (resumed)

```json
{
  "output": {
    "interaction": {
      "interactionType": "button_click",
      "buttonId": "export", "buttonLabel": "Export",
      "clickedAt": "2026-04-19T…"
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

carousel/table 과 동일한 패턴의 위반:

| # | 항목 | 위반한 Principle | 설명 |
| --- | --- | --- | --- |
| 1 | Waiting 시 `output` flat | **Principle 4.3** | `output.view.type: 'chart'` 필요. |
| 2 | Resumed 시 `previousOutput` 네이밍 | **Principle 4.2** | → `output.view` 이동. |
| 3 | `status: 'button_click' \| 'button_continue'` | **Principle 4.1 / 축 9** | `'resumed'` 통일. |
| 4 | `output.interaction.interactionType` | Principle 4 | → `output.interaction.type`. |
| 5 | `clickedAt` top-level 위치 | Principle 4.1 | interaction 래퍼 레벨은 `receivedAt`. |
| 6 | `chartType` handler/schema 제약 불일치 | **Principle 3.1 (Pre-flight)** (기존 caveat) | schema 는 `bar \| line \| pie \| donut \| area`, handler 는 `bar \| line \| pie` 만 허용. validate 단계에서 reject 하거나 schema enum 을 handler 와 맞춰야 함. **본 개선안의 핵심은 아니지만 함께 다뤄야 할 이슈**. |
| 7 | `title` 이 `output` 과 `config` 양쪽 존재 | Principle 7 (형식적 중복) | `output.view.title` 은 렌더 시점 스냅샷, `config.title` 은 원본 — 의도적 echo 로 유지. |

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
    "data": [ /* … */ ]
  },
  "status": "waiting_for_input"
}
```

**After**

```json
{
  "output": {
    "view": {
      "type": "chart",
      "chartType": "bar",
      "title": "Sales by Month",
      "data": [
        { "x": "Jan", "y": 100 },
        { "x": "Feb", "y": 250 }
      ]
    }
  },
  "status": "waiting_for_input",
  "meta": { "interactionType": "buttons", "durationMs": 0 }
}
```

- `view.type: 'chart'` — Principle 4.3 판별자.
- `chartType` / `title` / `data` 가 view 내부로 이동.
- `title` 미설정이면 `view.title` 은 JSON 에서 **생략** (Principle 11 "undefined 필드는 JSON 예시에서 생략").

### 3.2. Non-blocking — 동일 래퍼 적용

```json
{
  "output": {
    "view": {
      "type": "chart",
      "chartType": "bar",
      "title": "Sales by Month",
      "data": [ { "x": "Jan", "y": 100 } ]
    }
  }
}
```

> non-blocking 에서도 `view` 래퍼를 유지해 후속 노드 접근 경로를 일관화.

### 3.3. Resumed — port 버튼 클릭

```json
{
  "output": {
    "view": {
      "type": "chart",
      "chartType": "bar",
      "title": "…",
      "data": [ /* waiting snapshot */ ]
    },
    "interaction": {
      "type": "button_click",
      "data": {
        "buttonId": "export",
        "buttonLabel": "Export",
        "clickedAt": "2026-04-19T12:34:56.000Z"
      },
      "receivedAt": "2026-04-19T12:34:56.000Z"
    }
  },
  "port": "export",
  "status": "resumed",
  "meta": { "interactionType": "buttons", "durationMs": 7200 }
}
```

### 3.4. Resumed — link Continue

```json
{
  "output": {
    "view": { "type": "chart", /* waiting snapshot */ },
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

### 3.5. chart 는 per-item 버튼 불포함

- `supportsItems: false`, `supportsItemButtons: false`. Principle 6 의 `__item_{index}` suffix 는 chart 에 **적용되지 않음**.
- per-bar / per-point 액션이 필요해지면 향후 확장 시 carousel 의 suffix 규칙 재사용.

### 3.6. `chartType` caveat — 별도 이슈

- 현재 handler validation 은 `bar | line | pie` 만 허용하지만 schema 는 `donut | area` 도 받음. 이는 **Principle 3.1 (Pre-flight 에러)** 위반.
- 본 개선안 범위에서는 **유지** (별도 P1 이슈로 다룸). 다음 두 옵션 중 택일:
  - (A) handler 의 `VALID_CHART_TYPES` 에 `donut | area` 추가 + 렌더러 구현.
  - (B) schema enum 에서 `donut | area` 제거 (breaking for existing drafts).
- view 구조에는 영향 없음.

---

## 4. 마이그레이션 영향도

### 4.1. Expression 경로 변화

| Before | After | Breaking? | 비고 |
| --- | --- | --- | --- |
| `$node["Ch"].output.type` | `$node["Ch"].output.view.type` | **Yes** | |
| `$node["Ch"].output.chartType` | `$node["Ch"].output.view.chartType` | **Yes** | |
| `$node["Ch"].output.title` | `$node["Ch"].output.view.title` | **Yes** | |
| `$node["Ch"].output.data` | `$node["Ch"].output.view.data` | **Yes (high)** | 가장 일반적 경로. |
| `$node["Ch"].output.data[0].x` | `$node["Ch"].output.view.data[0].x` | **Yes (high)** | |
| `$node["Ch"].output.data[0].y` | `$node["Ch"].output.view.data[0].y` | **Yes (high)** | |
| `$node["Ch"].output.interaction.buttonId` | `$node["Ch"].output.interaction.data.buttonId` | **Yes** | |
| `$node["Ch"].output.interaction.buttonLabel` | `$node["Ch"].output.interaction.data.buttonLabel` | **Yes** | |
| `$node["Ch"].output.interaction.interactionType` | `$node["Ch"].output.interaction.type` | **Yes** | |
| `$node["Ch"].output.interaction.clickedAt` | `$node["Ch"].output.interaction.data.clickedAt` (+`.receivedAt` top) | **Yes** | |
| `$node["Ch"].output.previousOutput.data` | `$node["Ch"].output.view.data` | **Yes** | |
| `$node["Ch"].output.previousOutput.chartType` | `$node["Ch"].output.view.chartType` | **Yes** | |
| `$node["Ch"].status === "button_click"` | `$node["Ch"].status === "resumed" && $node["Ch"].output.interaction.type === "button_click"` | **Yes** | |
| `$node["Ch"].status === "button_continue"` | `$node["Ch"].status === "resumed" && $node["Ch"].output.interaction.type === "button_continue"` | **Yes** | |
| `$node["Ch"].port === "export"` | 유지 | No | |
| `$node["Ch"].config.chartType` | 유지 | No | |

### 4.2. 영향도 매트릭스

| 영역 | 영향 수준 | 세부 |
| --- | --- | --- |
| 기존 워크플로우 expression | **HIGH** | `output.data` 는 dashboard/report 템플릿에서 광범위 사용. |
| 프런트엔드 차트 렌더러 | **MEDIUM** | `output.view.data` 로 경로 전환. chart.js/recharts 등 외부 렌더러에 공급하는 데이터 shape 자체는 불변. |
| 엔진 resume 경로 | **HIGH** | structured output 재조립. |
| `chartType` validation | **INDEPENDENT** | 본 개선안과 별개 이슈, 동시 조치 권장. |
| 테스트 | **HIGH** | chart handler unit + aggregation 로직 회귀 테스트. |

### 4.3. 마이그레이션 전략

1. **P0 — Handler 변경**: `ChartHandler.execute()` 가 blocking / non-blocking 둘 다 `output.view` 구조로 반환.
2. **P0 — Engine resume 경로**: carousel/table 과 동일 — `previousOutput → view`, interaction `{ type, data, receivedAt }`, status `'resumed'`.
3. **P1 — Expression migration script**:
   - `\.output\.(type|chartType|title|data)` → `.output.view.$1` (단, status 비교와 무관한 맥락에서만)
   - `\.output\.previousOutput\.` → `.output.view.`
   - `\.output\.interaction\.interactionType` → `.output.interaction.type`
   - `\.output\.interaction\.(buttonId|buttonLabel|clickedAt)` → `.output.interaction.data.$1`
   - status 리터럴 치환.
4. **P1 — `chartType` caveat 해결**: handler validation 확장 또는 schema enum 축소.
5. **P2 — 과거 이력 뷰어 호환**.

---

## 5. 근거

### 5.1. Principle 4 통일

carousel/table 과 동일한 근거. Principle 4.3 의 예시:

> `chart.view`: `{ type: 'chart', chartType, data, title? }`

본 제안은 정확히 이 shape 을 따르며, `title?` 표기와 Principle 11 (undefined 필드 생략) 에 부합합니다.

### 5.2. `data` 배열의 원래 shape 보존

chart 의 `data: [{ x, y? }, …]` 구조는 다운스트림 렌더러(chart.js, recharts 등) 가 직접 소비하는 정형 shape 이므로 **내부 element shape 은 변경하지 않습니다**. view 래퍼만 추가.

### 5.3. `title?` 의 optional 처리

- `config.title` 미지정 → handler 가 `output.title: undefined` 로 두던 기존 동작 유지.
- Principle 11 에 따라 JSON 예시에서는 생략.
- 표 표기: `output.view.title?: string`.

### 5.4. `chartType` 제약 caveat

본 문서는 view 구조 통일에 집중하지만, Principle 3.1 위반(schema-handler 불일치)은 별도 P1 이슈로 반드시 추적해야 합니다. view 구조가 변경되어도 `config.chartType` 은 그대로 echo 되므로 caveat 은 독립적으로 해결 가능합니다.

### 5.5. 5개 노드 공통 구조

```
waiting:  { status: 'waiting_for_input', output: { view: { type: 'chart', chartType, data, title? } } }
resumed:  { status: 'resumed', output: { view, interaction: { type, data, receivedAt } } }
non-blocking: { output: { view: { type: 'chart', ... } } }
```

---

## 6. 참조

- [CONVENTIONS.md — Principle 4, Principle 11](../CONVENTIONS.md)
- [INCONSISTENCY_MATRIX.md 축 4 / 축 9](../INCONSISTENCY_MATRIX.md)
- 현 구현: `backend/src/nodes/presentation/chart/chart.handler.ts`, `.schema.ts`
- 관련 미해결 caveat: `chartType` schema-handler 불일치 (Principle 3.1)
- 동적 포트 해석: `frontend/src/lib/node-definitions/resolve-dynamic-ports.ts` → `presentationButtonPorts()`
