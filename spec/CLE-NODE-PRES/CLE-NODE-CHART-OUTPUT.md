---
id: "CLE-NODE-CHART-OUTPUT"
title: "Chart 노드 — 출력 구조"
type: "design"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-NODE-CHART"
ancestors: ["CLE-VISION", "CLE-NODE", "CLE-NODE-PRES", "CLE-NODE-CHART"]
area: "CLE-NODE-PRES"
content_hash: "86698d1696d0558a2848358c01b76b6bbedbbb44ed66a3b5075a5e3eff5b8a5c"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "19749a17d71a9423b29b1e1d75108b90ce500fc0a7f62e48bb0bfaff4e64e62d"
etag: "sha256-41af2b19b04e1a70c9b2dafa1ccd1ce1a8a05121421b1394c60dbfcb7340ced2"
---
## 개요

이 문서는 [Chart 노드](CLE-NODE-CHART.md) 의 하위 문서로 Chart 노드 출력(표시 전용 · 입력 대기 · 재개)의 필드와 예시, 표시 도구 `render_chart` 페이로드, 출력 스키마(자동완성)를 정한다. 버튼 정의 · 블로킹 흐름 · 재개 출력의 공통 규격은 [Presentation 노드 공통](CLE-NODE-PRES-COMMON.md) 이 정한다.

## 출력 구조

JSON 예시는 `undefined` 필드를 생략한다. 노드 출력의 다섯 필드 밖의 최상위 키는 쓰지 않는다. Chart 의 경우는 표시 전용과 블로킹 쌍(입력 대기, 재개)이다. 따로 에러 경우는 없고 설정 검증 실패는 실행 전에 던진다.

`chartType`·`title`·`xAxis`·`yAxis`·`buttons` 같은 **리터럴 설정값은 출력 값에 되풀이하지 않는다**. `output.data` 는 입력을 X축 기준으로 묶고 집계한 **런타임 결과**라 출력 값에 둔다. `output.type`·`output.chartType`·`output.title`·`output.rendered` 는 쓰지 않는다. 노드 종류는 워크플로우 정의로 알 수 있고 리터럴 설정은 `$node["Ch"].config.*` 로 읽는다.

### 표시 전용(`buttons` 없음)

```json
{
  "config": {
    "chartType": "bar",
    "title": "Monthly Revenue",
    "xAxis": { "field": "month", "label": "월" },
    "yAxis": { "field": "revenue", "label": "매출", "aggregation": "sum" }
  },
  "output": {
    "data": [
      { "x": "Jan", "y": 1200 },
      { "x": "Feb", "y": 1500 },
      { "x": "Mar", "y": 1800 }
    ]
  },
  "meta": {
    "durationMs": 12
  }
}
```

| 필드 | 타입 | 출처 | 설명 |
|------|------|------|------|
| `config.chartType` | Enum | 설정 에코 | 사용자가 정한 차트 유형. 출력 값에 싣지 않는다 |
| `config.title` | String? | 설정 에코 | 차트 제목. `{{ }}` 원문을 보존한다. 출력 값에 싣지 않는다 |
| `config.xAxis` / `config.yAxis` | AxisDef | 설정 에코 | 축 정의 |
| `config.dataField?` | String | 설정 에코 | 데이터 배열이 든 최상위 키 |
| `config.groupBy?` | String | 설정 에코 | 시리즈를 나눈 항목 필드. pie·donut 이면 에코만 하고 쓰지 않는다 |
| `config.colors?` | String[] | 설정 에코 | 사용자 색상 배열 |
| `output.data` | `{ x, y?, series? }[]` | 런타임 집계 | 입력을 `xAxis.field`(`groupBy` 를 쓰면 시리즈까지) 기준으로 묶고 `yAxis.aggregation` 을 적용한 결과. `series` 는 `groupBy` 를 쓴 bar·line·area 에만 있다 |
| `meta.durationMs` | number | 엔진 주입 | 실행 시간(ms) |
| `port` | undefined | 없음 | 단일 출력(`out` 포트) |

표현식 접근 예:

- `$node["Ch"].config.chartType` → `"bar"`(리터럴. 유일한 참조 경로)
- `$node["Ch"].config.title` → `"Monthly Revenue"`
- `$node["Ch"].output.data[0].x` → `"Jan"`
- `$node["Ch"].output.data[0].y` → `1200`

**`groupBy` 를 쓴 다중 시리즈:**

```json
{
  "config": {
    "chartType": "line",
    "title": "Monthly Revenue by Region",
    "dataField": "sales",
    "xAxis": { "field": "month" },
    "yAxis": { "field": "revenue", "aggregation": "sum" },
    "groupBy": "region"
  },
  "output": {
    "data": [
      { "x": "Jan", "y": 1200, "series": "Seoul" },
      { "x": "Jan", "y": 800, "series": "Busan" },
      { "x": "Feb", "y": 1500, "series": "Seoul" },
      { "x": "Feb", "y": 900, "series": "Busan" }
    ]
  },
  "meta": {
    "durationMs": 14
  }
}
```

표현식 접근 예:

- `$node["Ch"].output.data[1].series` → `"Busan"`
- `$node["Ch"].output.data[1].y` → `800`

### 입력 대기(전역 버튼 대기)

```json
{
  "config": {
    "chartType": "bar",
    "title": "Sales by Month",
    "xAxis": { "field": "month" },
    "yAxis": { "field": "revenue", "aggregation": "sum" },
    "buttons": [
      { "id": "export", "label": "Export", "type": "port" },
      { "id": "details", "label": "See Details", "type": "link", "url": "https://dashboard.example.com/sales" }
    ],
    "buttonConfig": {
      "buttons": [
        { "id": "export", "label": "Export", "type": "port" },
        { "id": "details", "label": "See Details", "type": "link", "url": "https://dashboard.example.com/sales" }
      ]
    }
  },
  "output": {
    "data": [
      { "x": "Jan", "y": 1200 },
      { "x": "Feb", "y": 1500 },
      { "x": "Mar", "y": 1800 }
    ]
  },
  "meta": {
    "interactionType": "buttons",
    "durationMs": 15
  },
  "status": "waiting_for_input"
}
```

| 필드 | 타입 | 출처 | 설명 |
|------|------|------|------|
| `config.buttons` | ButtonDef[] | 설정 에코 | 사용자가 정한 버튼 정의 원문 |
| `config.buttonConfig.buttons` | ButtonDef[] | 핸들러(블로킹 쌍 식별) | 블로킹 모드에 들어갈 때 핸들러가 내는 평가된 버튼 목록. 실행 내역 화면과 버튼 바가 쓴다 |
| `output.data` | `{ x, y?, series? }[]` | 런타임 집계 | 표시 전용과 같다. 입력 대기 시점의 바뀌지 않는 스냅샷이고 재개에서도 같다 |
| `meta.interactionType` | `"buttons"` | 핸들러 반환 | 대기 표면. 화면이 버튼 바 모드를 알아본다 |
| `meta.durationMs` | number | 엔진 주입 | 집계까지 걸린 시간 |
| `status` | `"waiting_for_input"` | 핸들러 반환 | 블로킹 진입. 사용자 클릭을 기다린다 |
| `port` | undefined | 없음 | 클릭 전에는 켜진 포트가 없다 |

표현식 접근 예:

- `$node["Ch"].status === "waiting_for_input"` → `true`
- `$node["Ch"].config.buttons[0].label` → `"Export"`

재개 출력에는 과도기 필드 `previousOutput` 이 함께 실린다. 새로 읽지 않는다([Presentation 노드 공통](CLE-NODE-PRES-COMMON.md#previousoutput-과도기-예외)).

### 재개(버튼 클릭 후)

**포트 버튼 클릭:**

```json
{
  "config": {
    "chartType": "bar",
    "title": "Sales by Month",
    "xAxis": { "field": "month" },
    "yAxis": { "field": "revenue", "aggregation": "sum" },
    "buttons": [
      { "id": "export", "label": "Export", "type": "port" }
    ]
  },
  "output": {
    "data": [
      { "x": "Jan", "y": 1200 },
      { "x": "Feb", "y": 1500 },
      { "x": "Mar", "y": 1800 }
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
  "meta": {
    "interactionType": "buttons",
    "durationMs": 7200
  },
  "port": "export",
  "status": "resumed"
}
```

| 필드 | 타입 | 출처 | 설명 |
|------|------|------|------|
| `output.data` | 입력 대기와 같다 | 입력 대기 스냅샷 | 재개에서도 같은 값이다. 이전 값은 이 필드로 충분하다 |
| `output.interaction.type` | `"button_click"` | 엔진(사용자 클릭) | 포트 버튼 클릭 |
| `output.interaction.data.buttonId` | String | 엔진 | 누른 버튼의 정의 ID(켜진 포트 ID 와 같다) |
| `output.interaction.data.buttonLabel` | String | 엔진 | 클릭 시점 버튼 라벨 |
| `output.interaction.receivedAt` | ISO8601 | 엔진 | 클릭 수신 시각 |
| `meta.durationMs` | number | 엔진 주입 | 입력 대기에서 재개까지 걸린 시간(대기 시간 포함) |
| `port` | `<button.id>` | 엔진 라우팅 | 누른 포트 버튼의 ID 그대로 |
| `status` | `"resumed"` | 엔진 | 재개 상태 |

표현식 접근 예:

- `$node["Ch"].port === "export"` → `true`
- `$node["Ch"].output.interaction.type` → `"button_click"`
- `$node["Ch"].output.interaction.data.buttonId` → `"export"`
- `$node["Ch"].output.data[0].y` → `1200`(입력 대기 스냅샷 그대로)

**링크 버튼만 있을 때 Continue 클릭:**

```json
{
  "config": {
    "chartType": "bar",
    "title": "Monthly Revenue",
    "buttons": [
      { "id": "details", "label": "See Details", "type": "link", "url": "https://dashboard.example.com/sales" }
    ]
  },
  "output": {
    "data": [
      { "x": "Jan", "y": 1200 },
      { "x": "Feb", "y": 1500 }
    ],
    "interaction": {
      "type": "button_continue",
      "data": {
        "buttonId": "details",
        "buttonLabel": "See Details",
        "url": "https://dashboard.example.com/sales"
      },
      "receivedAt": "2026-04-19T12:35:10.000Z"
    }
  },
  "meta": {
    "interactionType": "buttons",
    "durationMs": 14000
  },
  "port": "continue",
  "status": "resumed"
}
```

| 필드 | 타입 | 출처 | 설명 |
|------|------|------|------|
| `output.interaction.type` | `"button_continue"` | 엔진 | 링크 버튼만 있을 때 Continue 클릭 |
| `output.interaction.data.url` | String | 엔진 | 사용자가 새 탭에서 연 URL |
| `port` | `"continue"` | 엔진 라우팅 | 링크 버튼 전용 자동 포트 |
| 그 밖 | 포트 버튼 클릭과 같다 | | |

Chart 는 항목 버튼이 없으므로 `output.interaction.data.selectedItem` 을 쓰지 않는다.

### 표시 도구 페이로드

표시 도구 `render_chart` 의 페이로드는 설정 필드와 함께 `data` 를 싣는다. `data` 의 모양은 [표시 전용](#표시-전용buttons-없음) 출력의 `output.data` 와 같은 `{ x, y?, series? }[]` 다. 화면은 노드 출력과 같은 렌더러와 [시리즈와 색](CLE-NODE-CHART-EXEC.md#시리즈와-색) 규칙으로 그린다. 도구 정의와 스키마 위반 처리는 [Presentation 노드 공통](CLE-NODE-PRES-COMMON.md#표시-도구-모드) 이 정한다. 기본 설명 문구 목록은 그 문서의 [도구 카탈로그](CLE-NODE-PRES-COMMON.md#도구-카탈로그) 에 있고, `render_chart` 문구에 넣는 `data` 모양 표기는 아래 상수를 쓴다.

도구 모드에서는 `dataField` · `groupBy` · `yAxis.aggregation` 을 쓰지 않는다. LLM 이 이미 묶고 집계한 포인트를 `data` 로 보내고 렌더러는 그 포인트를 그대로 그린다.

`data` 는 `chartConfigSchema` 에 선언하지 않는다. 이 스키마는 노드 설정 스키마이면서 도구 파라미터 스키마다. 여기에 런타임 출력인 `data` 를 넣으면 설정 스키마에 출력 값이 섞여 [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md#principle-11-설정과-출력-값은-겹치지-않는다) Principle 1.1 과 부딪친다. 그래서 LLM 은 도구 설명 문구를 보고 이 모양을 안다. 모양 표기는 `chart.schema.ts` 의 상수 `CHART_DATA_SHAPE`(값 `'{ x, y?, series? }[]'`) 하나다. 도구 기본 설명(`render-tool-provider.ts` 의 `DEFAULT_DESCRIPTIONS.chart`)과 AI 에이전트 시스템 안내(`ai-turn-executor.ts` 의 `PRESENTATION_TOOLS_GUIDANCE`)가 이 상수를 함께 쓴다.

zod 는 `data` 를 검사하지 않으므로 도구 의미 검사(`checkRenderToolSemanticIssues`)가 최소 모양을 본다. `data` 가 배열이 아니거나, 항목이 하나 이상인데 객체(배열 · `null` 제외)인 항목이 하나도 없으면 `INVALID_PAYLOAD` 를 돌려준다. 빈 배열은 받는다. 그 뒤의 재시도와 버림은 다른 표시 도구와 같은 [스키마 위반 처리와 정규화](CLE-NODE-PRES-COMMON.md#스키마-위반-처리와-정규화) 흐름을 따른다.

검사를 통과한 `data` 에 객체가 아닌 항목이 섞여 있으면 렌더러가 그 항목을 건너뛴다. 빈 배열이나 남은 포인트가 없는 경우의 표시는 [시리즈와 색](CLE-NODE-CHART-EXEC.md#시리즈와-색) 이 정한다.

### 출력 스키마(자동완성)

노드의 `outputSchema` 는 표현식 자동완성이 쓰는 출력 모양 힌트다. `chart.component.ts` 가 `chartOutputSchema` 를 등록한다. [Table 노드](CLE-NODE-TABLE.md) · [Carousel 노드](CLE-NODE-CAROUSEL.md) 와 같이 노드 출력 다섯 필드 형태(`config`·`output` 아래로 나눈 모양)로 선언한다.

- `config`: 설정 에코 필드(`chartType`·`title`·`dataField`·`xAxis`·`yAxis`·`groupBy`·`colors`·`buttons`·`buttonConfig`)를 모두 선택 필드로 둔다.
- `output`: `data: { x, y?, series? }[]` 와 재개 때 생기는 `interaction`(`type`·`data`·`receivedAt`)을 둔다.
- 노드 종류를 가리는 `type: 'chart'` 와 리터럴 설정인 `chartType`·`title` 을 `output` 이나 최상위에 선언하지 않는다([노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md#principle-11-설정과-출력-값은-겹치지-않는다) Principle 1.1, [4.2](../CLE-NODE/CLE-NODE-OUTPUT.md#42-폐기할-필드--구조)).

## Rationale

### `render_chart` 의 `data` 는 스키마 밖에 두고 최소 모양만 검사한다 (2026-11-05)

`chartConfigSchema` 는 노드 설정 스키마이면서 `render_chart` 의 도구 파라미터 스키마다([Presentation 노드 공통](CLE-NODE-PRES-COMMON.md#스키마-단일-기준)). 여기에 런타임 출력인 `data` 를 선언하면 설정 스키마에 출력 값이 들어가 [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md#principle-11-설정과-출력-값은-겹치지-않는다) Principle 1.1 과 부딪친다. 그래서 `data` 는 스키마 밖에 두고 도구 설명 문구를 LLM 에 주는 계약으로 삼는다. 문구가 여러 곳에서 갈리지 않도록 모양 표기를 상수 `CHART_DATA_SHAPE` 하나로 모았다(CLE-T-NRN1RR).

`data` 모양을 바꿀 때 함께 고칠 곳은 다음과 같다. 모양 표기는 `CHART_DATA_SHAPE` 에서 고친다.

- `codebase/backend/src/nodes/presentation/chart/chart.schema.ts` 의 `CHART_DATA_SHAPE` 와 `chartOutputSchema`
- `codebase/backend/src/nodes/ai/ai-agent/tool-providers/render-tool-provider.ts` 의 `DEFAULT_DESCRIPTIONS.chart` (포인트 필드를 설명하는 문장)
- `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` 의 `PRESENTATION_TOOLS_GUIDANCE` (`render_chart` 줄)
- 두 렌더러(`chart-series.ts`, 위젯 `presentation.ts` · `chart-model.ts`)와 공유 픽스처 `series.json`

스키마 밖의 `data` 는 zod 검사를 받지 않는다. 그래서 `data` 가 빠졌거나 객체가 아닌 값만 든 호출도 통과하고 LLM 은 성공 결과를 받는다. 사용자에게는 차트가 보이지 않고 LLM 은 다시 부를 기회를 얻지 못한다. 이것을 막으려고 도구 의미 검사에 최소 모양 검사를 두어 다른 표시 도구처럼 `INVALID_PAYLOAD` 로 다시 부르게 한다. 검사는 배열인지와 객체 항목이 하나라도 있는지만 본다. 일부 항목만 틀린 페이로드는 렌더러가 틀린 항목을 건너뛰고 나머지를 그리는 지금 동작을 그대로 둔다.

### 출력 스키마는 노드 출력 다섯 필드 형태로 선언한다 (2026-11-01)

이전 `chartOutputSchema` 는 `type: 'chart'`·`chartType`·`title` 을 선언했다. 승인본 v2 까지 미결 사항에 있던 항목이다. [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) Principle 1.1 · 4.2 가 이미 이 필드를 쓰지 않는다고 정했고, Table · Carousel 의 출력 스키마는 이미 그 형태다. 그래서 사람 결정 없이 같은 형태를 따른다. 핸들러는 출력 재설계 뒤로 이 필드를 출력에 싣지 않았다. 그래서 `$node["Ch"].output.chartType` 같은 표현식은 이전에도 값이 없었고, 스키마를 고쳐도 깨지는 워크플로우가 없다.
