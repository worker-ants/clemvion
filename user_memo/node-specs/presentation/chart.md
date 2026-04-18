# Chart (`chart`)

> 데이터를 차트로 시각화합니다. bar/line/pie/donut/area 타입을 지원하며, 집계(sum/count/avg/min/max)도 가능. 선택적 버튼 액션 포함.

- **카테고리**: `presentation`
- **컨테이너**: no
- **Blocking**: yes (버튼이 있을 때만)
- **동적 포트**: yes (`presentation-buttons`)

## Config 파라메터

| 필드명 | 타입 | 필수 | 기본값 | 설명 | 표현식 |
| --- | --- | --- | --- | --- | --- |
| `chartType` | `'bar' \| 'line' \| 'pie' \| 'donut' \| 'area'` | yes | `'bar'` | 차트 종류 | no |
| `dataField` | string | no | `''` | input 객체에서 데이터 배열을 추출할 필드명 | no |
| `xAxis.field` | string | yes | `''` | x축 데이터 필드 | no |
| `xAxis.label` | string | no | (없음) | x축 라벨 | no |
| `yAxis.field` | string | no | `''` | y축 데이터 필드 | no |
| `yAxis.label` | string | no | (없음) | y축 라벨 | no |
| `yAxis.aggregation` | `'sum' \| 'count' \| 'avg' \| 'min' \| 'max'` | no | (없음) | y값 집계 함수 | no |
| `groupBy` | string | no | (없음) | (현재 핸들러는 `xAxis.field`로 자동 그룹화 — 별도 사용 안 함) | no |
| `title` | string | no | (없음) | 차트 제목 | no |
| `colors` | string[] | no | (없음) | 색상 팔레트 (UI에서 사용) | no |
| `buttons` | `Button[]` | no | `[]` | 액션 버튼 | (label/url) |

> validate는 `bar`/`line`/`pie`만 허용 (donut, area는 schema에는 있으나 validation에서 거부). 사용 가능한 타입은 실제로는 3종류.

`Button`: Carousel/Table과 동일.

## Ports

| 방향 | id | label | 설명 |
| --- | --- | --- | --- |
| Input | `in` | Input | 데이터 객체 또는 배열 |
| Output | `out` | Output | (버튼 없을 때) 즉시 진행 |
| Output | `<button.id>` | (button.label) | **동적** — 클릭된 버튼 |
| Output | `continue` | Continue | link만 있을 때 |

## Input

데이터 소스 결정 우선순위:

1. `config.dataSource`(passthrough된 값)가 있으면 사용
2. `dataField` + input이 객체이면 `input[dataField]`
3. 그 외는 input 자체 (배열이면 그대로, 아니면 `[input]`)

각 데이터 항목에서 `xAxis.field`/`yAxis.field` 값을 추출해 `{x, y}` 형태의 점 배열로 변환.

## Output

### Case 1: 단순 시각화 (집계 없음)

input: `[{name:"A", value:10}, {name:"B", value:20}]`
config: `{ chartType: "bar", xAxis: {field:"name"}, yAxis: {field:"value"}, title: "Sales" }`

```json
{
  "config": {
    "chartType": "bar",
    "title": "Sales",
    "xAxis": { "field": "name" },
    "yAxis": { "field": "value" }
  },
  "output": {
    "type": "chart",
    "chartType": "bar",
    "title": "Sales",
    "data": [
      { "x": "A", "y": 10 },
      { "x": "B", "y": 20 }
    ]
  }
}
```

### Case 2: 집계 적용 (sum)

input: `[{cat:"A", v:5}, {cat:"A", v:7}, {cat:"B", v:3}]`
config: `{ chartType: "bar", xAxis: {field:"cat"}, yAxis: {field:"v", aggregation: "sum"} }`

```json
{
  "config": { ... },
  "output": {
    "type": "chart",
    "chartType": "bar",
    "data": [
      { "x": "A", "y": 12 },
      { "x": "B", "y": 3 }
    ]
  }
}
```

### Case 3: 버튼 있음 → 사용자 입력 대기

```json
{
  "config": {
    ...,
    "buttonConfig": {
      "buttons": [{ "id": "btn_drill", "label": "Drill Down", "type": "port" }]
    }
  },
  "output": { "type": "chart", "data": [...], ... },
  "status": "waiting_for_input",
  "meta": { "interactionType": "buttons" }
}
```

| 필드 | 설명 |
| --- | --- |
| `output.type` | 항상 `"chart"` |
| `output.chartType` | 사용된 차트 타입 |
| `output.title` | (있으면) 제목 |
| `output.data` | `{x, y}[]` 데이터 포인트 배열 |
| `config.buttonConfig` | (버튼 있을 때) |
| `status` | (버튼 있을 때) `"waiting_for_input"` |
| `port` (제출 후) | 클릭된 버튼 ID |

## 변수로 접근 가능한 항목

이 노드의 라벨이 `Sales Chart`라고 가정.

| 표현식 | 값 예시 | 설명 |
| --- | --- | --- |
| `{{ $node["Sales Chart"].output.data }}` | `[{x:"A",y:10}, ...]` | 차트 데이터 포인트 |
| `{{ $node["Sales Chart"].output.data[0].y }}` | `10` | 첫 포인트의 y값 |
| `{{ $node["Sales Chart"].output.chartType }}` | `"bar"` | 차트 타입 |
| `{{ $node["Sales Chart"].output.title }}` | `"Sales"` | 제목 |
| `{{ $node["Sales Chart"].port }}` | `"btn_drill"` | (버튼 클릭 후) |

## 주의사항

- validation은 `bar`, `line`, `pie`만 허용. `donut`, `area`는 schema enum에는 있지만 validation을 통과하지 못합니다 (현재 단계에서는 사용 비권장).
- `xAxis.field`만 필수. `yAxis.field`가 없으면 `point.y`는 `undefined`.
- 집계 시 `xAxis.field` 값을 그룹 키로 사용 — 같은 x값을 가진 항목들끼리 묶임. y값을 `Number()`로 변환하며 NaN은 0 처리.
- 집계의 기본값(스위치 default)도 sum.
- `dataField`는 input이 객체일 때 배열을 꺼내는 키. 미지정 시 input 자체가 데이터로 간주.
- 버튼 한 개라도 있으면 blocking.
- `colors`, `groupBy`는 schema에 있지만 핸들러 출력에 직접 사용되지 않음 (UI 렌더러가 사용).
