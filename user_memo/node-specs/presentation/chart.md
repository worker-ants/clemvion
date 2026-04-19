# Chart (`chart`)

> 입력 데이터를 차트로 시각화합니다. `bar`/`line`/`pie`/`donut`/`area` 타입을 지원하고, `sum`/`avg`/`count`/`min`/`max` 집계를 제공합니다. 선택적 버튼 액션도 지원.

- **카테고리**: `presentation`
- **컨테이너**: no
- **Blocking**: **조건부 yes** — `config.buttons`가 비어있지 않으면 `status: "waiting_for_input"` 반환
- **동적 포트**: **yes** (`dynamicPorts.kind = "presentation-buttons"`, `continueId: "continue"`)

## Config 파라메터

출처: `backend/src/nodes/presentation/chart/chart.schema.ts`

| 필드명 | 타입 | 필수 | 기본값 | 설명 | 표현식 |
| --- | --- | --- | --- | --- | --- |
| `chartType` | `'bar' \| 'line' \| 'pie' \| 'donut' \| 'area'` | yes | `'bar'` | 차트 타입 (**handler validation은 `bar`/`line`/`pie`만 허용**. donut/area는 schema만 정의) | — |
| `dataField` | string | no | `''` | `input`이 객체일 때 이 키로 배열을 꺼내 씀 (ex: `input.stats`) | yes |
| `xAxis` | `{ field: string, label?: string }` | yes | `{ field: '' }` | X축 필드 정의 | yes |
| `yAxis` | `{ field: string, label?: string, aggregation?: 'sum' \| 'count' \| 'avg' \| 'min' \| 'max' }` | no | `{ field: '' }` | Y축 필드 정의 + 집계 모드 | yes |
| `groupBy` | string | no | (없음) | 그룹 필드 (현 handler에서는 미사용, UI/확장용) | yes |
| `title` | string | no | (없음) | 차트 제목 | yes |
| `colors` | string[] | no | (없음) | 팔레트 색상 배열 | — |
| `buttons` | `ButtonDef[]` | no | `[]` | 차트 하단 버튼 (per-item 없음) | — |

> 추가로 `config.dataSource`(schema에는 없지만 `passthrough()`로 통과)가 있으면 입력 해석에서 `input`보다 우선함. carousel/table의 `dataSource`와 같은 의미로 쓰이며, expression은 엔진이 이미 해석한 값으로 handler에 도달한다.

`ButtonDef`: carousel 문서 참조.

## Ports

| 방향 | id | label | 타입 | 설명 |
| --- | --- | --- | --- | --- |
| Input | `in` | Input | data | 시각화 대상 데이터 |
| Output (static) | `out` | Output | data | 버튼이 없을 때 |

### 동적 포트 생성 규칙

`presentationButtonPorts()` 기준:

1. `config.buttons[*]` 중 `type === 'port'`마다 포트 추가
2. 하나 이상 있으면 그것을 반환
3. 없고 `link` 타입 버튼이 하나라도 존재 → `{ id: "continue", label: "Continue" }`
4. 버튼 자체가 없으면 정적 `out`

## Input

입력 배열 결정 로직 (`chart.handler.ts`):

1. `config.dataSource != null` → 배열이면 그대로, 아니면 `[config.dataSource]`로 래핑
2. else if `dataField` 지정 + `input`이 객체 → `input[dataField]`를 배열로 사용 (배열이 아니면 빈 배열)
3. else `Array.isArray(input) ? input : [input]`

각 아이템에 대해:
- `x = item[xAxis.field]`
- `y = item[yAxis.field]` (yAxis가 지정된 경우에만)

`yAxis.aggregation`이 있으면 같은 `x` 값끼리 묶어 집계 (`sum`/`avg`/`count`/`min`/`max`). `y`가 숫자로 변환되지 않으면 0으로 처리. 알 수 없는 aggregation 값은 `sum`으로 fallback.

## Output

### Case 1: 버튼 없음 — non-blocking

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

- `title`이 미설정이면 `output.title`은 `undefined`.
- `yAxis` 미지정 시 각 data point는 `{ x }`만 포함.

### Case 2: 버튼 있음 — 초기 실행 (waiting_for_input)

```json
{
  "config": {
    "chartType": "bar",
    "title": "…",
    "xAxis": { "field": "month" },
    "yAxis": { "field": "revenue" },
    "buttonConfig": {
      "buttons": [
        { "id": "export", "label": "Export", "type": "port" }
      ]
    }
  },
  "output": {
    "type": "chart",
    "chartType": "bar",
    "title": "…",
    "data": [ … ]
  },
  "status": "waiting_for_input",
  "meta": { "interactionType": "buttons" }
}
```

### Case 3: 사용자 버튼 클릭 후

port 타입:

```json
{
  "config": { … "buttonConfig": { "buttons": [ … ] } },
  "output": {
    "interaction": {
      "interactionType": "button_click",
      "buttonId": "export",
      "buttonLabel": "Export",
      "clickedAt": "2026-04-19T…"
    },
    "previousOutput": { "type": "chart", "chartType": "bar", "data": [ … ], … }
  },
  "port": "export",
  "status": "button_click",
  "meta": { "interactionType": "buttons" }
}
```

link 타입(Continue):

```json
{
  "output": {
    "interaction": { "interactionType": "button_continue", "clickedAt": "…" },
    "previousOutput": { "type": "chart", … }
  },
  "port": "continue",
  "status": "button_continue",
  "meta": { "interactionType": "buttons" }
}
```

## 변수로 접근 가능한 항목

이 노드의 라벨이 `Revenue Chart`라고 가정.

### 버튼 없는 경우:

| 표현식 | 값 | 설명 |
| --- | --- | --- |
| `{{ $node["Revenue Chart"].output.chartType }}` | `"bar"` | 차트 타입 |
| `{{ $node["Revenue Chart"].output.title }}` | `"Sales by Month"` | 제목 (없으면 undefined) |
| `{{ $node["Revenue Chart"].output.data }}` | `[{x,y}, …]` | 차트 데이터 포인트 배열 |
| `{{ $node["Revenue Chart"].config.xAxis.field }}` | `"month"` | X축 필드 |
| `{{ $node["Revenue Chart"].config.yAxis.aggregation }}` | `"sum"` | 집계 모드 |

### 버튼 클릭 후 (AFTER interaction):

| 표현식 | 값 예시 | 설명 |
| --- | --- | --- |
| `{{ $node["Revenue Chart"].output.interaction.buttonId }}` | `"export"` | 클릭 버튼 ID |
| `{{ $node["Revenue Chart"].output.interaction.buttonLabel }}` | `"Export"` | 클릭 버튼 라벨 |
| `{{ $node["Revenue Chart"].output.interaction.interactionType }}` | `"button_click"` \| `"button_continue"` | 상호작용 종류 |
| `{{ $node["Revenue Chart"].output.previousOutput.data }}` | `[ … ]` | 대기 시점의 차트 데이터 |
| `{{ $node["Revenue Chart"].port }}` | `"export"` \| `"continue"` | 활성 포트 |
| `{{ $node["Revenue Chart"].status }}` | `"button_click"` \| `"button_continue"` | 상태 |

## 주의사항

- **`chartType` handler validation은 `bar`/`line`/`pie`만 허용** — schema는 `donut`/`area`까지 받지만 handler가 validation 단계에서 거부 (`'chartType is required and must be one of: bar, line, pie'`). donut/area를 쓰려면 handler 업데이트 필요.
- `xAxis.field`는 필수. 누락 시 validation 실패.
- `yAxis` 자체는 선택. 없으면 `data` 포인트에 `y` 키가 없음 (pie 차트에서 유용).
- 집계 시 non-numeric `y`는 `0`으로 취급 (`Number(value) == NaN` → 0).
- Handler는 `groupBy`, `colors`를 읽지 않으며 UI 렌더러에서 해석되어야 함.
- **Blocking 조건**: `config.buttons`가 배열이면서 길이 > 0.
- **Blocking 모드에서는 컨테이너 본문 내부에 배치 금지**.
- per-item/per-bar 버튼은 지원하지 않음 (`supportsItems`/`supportsItemButtons` 모두 false). global buttons만.
- `button.url`은 `javascript:`/`data:`/`vbscript:` 스킴 차단, `id`에 `__item_` 금지, 총 10개 이하.
