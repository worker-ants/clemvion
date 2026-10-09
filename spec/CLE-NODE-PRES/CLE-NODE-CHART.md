---
id: "CLE-NODE-CHART"
title: "Chart 노드"
type: "feature"
version: 1
status: "approved"
requirements: ["REQ-CHART-001", "REQ-CHART-002", "REQ-CHART-003", "REQ-CHART-004", "REQ-CHART-005", "REQ-CHART-006", "REQ-CHART-007", "REQ-CHART-008", "REQ-CHART-009", "REQ-CHART-010", "REQ-CHART-011", "REQ-CHART-012", "REQ-CHART-013", "REQ-CHART-014", "REQ-CHART-015", "REQ-CHART-016"]
basis_superseded: false
parent: "CLE-NODE-PRES"
ancestors: ["CLE-VISION", "CLE-NODE", "CLE-NODE-PRES"]
area: "CLE-NODE-PRES"
content_hash: "c28410fdcd6be448d894a5df96f870d805378ded1ab1b1ef2dd9288c3f3cce12"
read_as: "approved_fallback"
task: "CLE-T-V0JAG1"
source_paths: ["spec/4-nodes/6-presentation/3-chart.md", "spec/4-nodes/_product-overview.md"]
mirror_sha256: "e383c6a2d2ff7ff8ff688dc8c07b62e2301f770c7b190cc81b707dc085be6254"
etag: "sha256-39021de57d259d2276537b5af01e4389ebfc66bd27eeb0c3032ec13bc8dd1929"
---
> 구현 상태: 부분 구현 (`groupBy` 다중 시리즈 미구현. 핸들러는 `groupBy` 를 설정 에코에만 실음) · 원문: `spec/4-nodes/6-presentation/3-chart.md`, `spec/4-nodes/_product-overview.md` (§9.3) · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

Chart 노드(Chart, `chart`)는 결과를 차트로 보여 주는 노드다. 입력 배열을 `xAxis` 기준으로 묶고 `yAxis.aggregation` 으로 집계해 `{ x, y }` 포인트 배열을 만든다. 화면은 이 배열로 bar·line·area·pie·donut 같은 차트를 그린다.

전역 버튼이 하나라도 있으면 블로킹 모드로 들어간다. 항목 버튼은 없다.

범위 밖:

- 버튼 정의·버튼 편집기·포트 구성·블로킹 모드 흐름·재개 출력 규격: [Presentation 노드 공통](CLE-NODE-PRES-COMMON.md)
- 실행 결과 드로어의 Chart 표시: [Presentation 노드 공통](CLE-NODE-PRES-COMMON.md#실행-결과-드로어-표시)
- 표시 도구 `render_chart`: [Presentation 노드 공통](CLE-NODE-PRES-COMMON.md#표시-도구-모드)

## 요구사항

- REQ-CHART-001 WHEN 사용자가 차트 유형을 고르면 THE SYSTEM SHALL 고른 유형에 맞춰 X-Y 축 차트(bar·line·area) 또는 라벨-값 차트(pie·donut)로 그린다. (원본: ND-CH-01)
- REQ-CHART-002 WHEN 사용자가 축을 설정하면 THE SYSTEM SHALL X축·Y축 필드 매핑과 Y축 집계(`sum`·`count`·`avg`·`min`·`max`)를 받는다. (원본: ND-CH-02)
- REQ-CHART-003 WHEN `groupBy` 가 지정되면 THE SYSTEM SHALL 그룹마다 시리즈를 만들어 다중 시리즈 차트를 지원한다. (원본: ND-CH-03) (미구현)
- REQ-CHART-004 WHEN 사용자가 차트 제목이나 색상을 설정하면 THE SYSTEM SHALL 그 제목과 색상 배열로 차트를 그리고 색상이 없으면 기본 팔레트를 쓴다. (원본: ND-CH-04)
- REQ-CHART-005 WHEN 노드가 결과를 내면 THE SYSTEM SHALL 집계 결과를 구조화된 출력 값 `output.data` 로 내고 SVG 스냅샷은 만들지 않는다. (원본: ND-CH-05)
- REQ-CHART-006 WHEN 화면이 차트를 그리면 THE SYSTEM SHALL 프런트엔드가 recharts 로 `output.data` 와 `config.{chartType, title, xAxis, yAxis, colors}` 를 받아 직접 그린다. (원본: ND-CH-05)
- REQ-CHART-007 WHEN 사용자가 버튼을 설정하면 THE SYSTEM SHALL 링크 버튼과 포트 버튼을 노드당 최대 5개까지 라벨·스타일·URL(링크 버튼)과 함께 받는다. (원본: ND-CH-06)
- REQ-CHART-008 WHEN 버튼이 하나라도 있으면 THE SYSTEM SHALL 실행을 입력 대기로 멈추고 사용자가 누른 버튼의 포트로 실행을 재개한다. (원본: ND-CH-07)
- REQ-CHART-009 WHEN `dataField` 가 있고 입력이 객체이면 THE SYSTEM SHALL `input[dataField]` 를 데이터 배열로 쓰고 배열이 아니면 `[]` 로 대신한다.
- REQ-CHART-010 IF `dataField` 가 없거나 입력이 객체가 아니면 THE SYSTEM SHALL 입력이 배열이면 그대로, 아니면 `[input]` 으로 쓴다.
- REQ-CHART-011 WHEN `yAxis.aggregation` 이 지정되면 THE SYSTEM SHALL X 값이 같은 행의 Y 값을 그 방식으로 집계한다.
- REQ-CHART-012 IF `yAxis.aggregation` 이 알 수 없는 값이면 THE SYSTEM SHALL `sum` 으로 집계한다.
- REQ-CHART-013 WHEN `yAxis.aggregation` 이 없으면 THE SYSTEM SHALL 집계하지 않고 원래 Y 값을 그대로 쓴다.
- REQ-CHART-014 IF Y 값을 숫자로 바꿀 수 없거나 null·undefined 이면 THE SYSTEM SHALL 그 값을 `0` 으로 바꿔 집계에 넣는다.
- REQ-CHART-015 IF `chartType`·`xAxis.field`·`yAxis.field` 가 비어 있으면 THE SYSTEM SHALL 노드 경고 규칙으로 캔버스에 알린다.
- REQ-CHART-016 IF 설정 검증에 실패하면 THE SYSTEM SHALL 실행 전 검증 단계에서 에러를 던지고 런타임 에러 포트는 쓰지 않는다.

입력 대기 기한(타임아웃)은 정의가 갈린다. [미결 사항](#미결-사항) 참조.

제품 요구사항 원문(ND-CH-01~07)의 우선순위는 ND-CH-04(제목·색상)만 권장이고 나머지는 필수다.

## 설정

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| `chartType` | Enum | ✓ | `bar` | `bar` / `line` / `area` / `pie` / `donut`. 설정 스키마와 실행 검증이 같은 목록(`CHART_TYPES`)을 쓴다 |
| `dataField` | String? | ✗ | `''` | 입력이 객체일 때 데이터 배열이 든 필드 경로. 없거나 입력이 객체가 아니면 입력 자체를 배열로 쓴다 |
| `xAxis` | AxisDef | ✓ | `{ field: '' }` | X축 정의 |
| `yAxis` | AxisDef | ✓ | `{ field: '' }` | Y축 정의(`aggregation` 포함) |
| `groupBy` | String? | ✗ | 없음 | 그룹 필드(다중 시리즈) |
| `title` | String? | ✗ | 없음 | 차트 제목. 표현식을 쓸 수 있다 |
| `colors` | String[]? | ✗ | 없음 | 사용자 색상 배열. 없으면 기본 팔레트 |
| `buttons` | ButtonDef[] | ✗ | `[]` | 버튼 정의 배열. 비어 있지 않으면 블로킹 모드. 구조는 [Presentation 노드 공통](CLE-NODE-PRES-COMMON.md#버튼-정의) |

**AxisDef 구조:**

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `field` | String | ✓ | 데이터 필드 경로 |
| `label` | String? | ✗ | 축 라벨 |
| `aggregation` | Enum? | ✗ | `sum` / `count` / `avg` / `min` / `max`. Y축 전용. 없으면 원래 값을 그대로 쓴다 |

스키마 단일 기준은 `codebase/backend/src/nodes/presentation/chart/chart.schema.ts` 의 `chartConfigSchema` 다.

## 설정 화면

| 영역 | 위치 | 들어가는 요소 | 동작 |
|------|------|---------------|------|
| 기본 | 맨 위 | Chart Type 드롭다운, Title | 차트 유형을 고르면 설정 폼이 유형에 맞게 바뀐다 |
| 데이터 | 기본 아래 | Data Field | 필드 경로를 자동완성한다 |
| X Axis | 데이터 아래 | Field, Label | 필드 경로를 자동완성한다 |
| Y Axis | X Axis 아래 | Field, Label, Aggregation 드롭다운 | 필드 경로를 자동완성한다 |
| 그룹과 색상 | Y Axis 아래 | Group By(선택), Colors(색 칩과 `[+]`) | 다중 시리즈와 색을 정한다 |
| Preview | 아래쪽 | 차트 미리보기 | 마지막 실행 데이터로 차트를 미리 그린다 |
| Buttons 섹션 | 맨 아래 | 전역 버튼 편집기 | [Presentation 노드 공통](CLE-NODE-PRES-COMMON.md#버튼-편집기) 의 버튼 편집기를 쓴다 |

pie·donut 은 `xAxis` 대신 labelField·valueField 를 쓰려는 의도였지만 지금 스키마는 같은 `xAxis`·`yAxis` 를 쓴다.

## 포트

포트 구성의 공통 규칙은 [Presentation 노드 공통](CLE-NODE-PRES-COMMON.md#포트-구성) 이 정한다. Chart 는 전역 버튼만 쓰고 항목 버튼은 **지원하지 않는다**.

**입력 포트:**

| id | label | type | dynamic | 설명 |
|------|-------|------|---------|------|
| `in` | Input | data | false | 차트 데이터 입력. 배열이거나 `dataField` 로 배열을 뽑을 수 있는 객체 |

**출력 포트:**

| 모드 | id | 만드는 조건 | 설명 |
|------|----|-------------|------|
| 표시 전용 | `out` | `buttons` 없음(기본) | 차트 결과 출력 |
| 블로킹(포트 버튼) | `<button.id>` | 포트 버튼마다 동적으로 만든다 | 전역 포트 버튼을 누르면 켜진다 |
| 블로킹(링크 버튼만) | `continue` | 링크 버튼만 있으면 자동으로 만든다 | Continue 를 누르면 켜진다 |

전역 버튼 포트 ID 는 `<button.id>` 그대로다([Presentation 노드 공통](CLE-NODE-PRES-COMMON.md#동적-포트-id-규칙)). Chart 는 항목 버튼 접미사(`__item_<idx>`)를 쓰지 않는다.

## 실행 로직

1. 입력 데이터 배열을 정규화한다. 핸들러 `execute` 의 우선순위는 다음과 같다.
   - `dataField` 가 있고 입력이 객체이면 `input[dataField]` 를 뽑는다. 배열이 아니면 `[]` 로 대신한다.
   - 그 밖에는 `Array.isArray(input) ? input : [input]` 을 쓴다.
   - 현재 구현은 이보다 먼저 `config.dataSource` 가 있으면 그 값을 쓴다. 배열은 그대로 쓰고 단일 값은 `[v]` 로 감싼다(`ChartHandler.execute` 의 데이터 원천 선택 분기). `dataSource` 는 `chartConfigSchema` 에 없는 키이고 스키마가 `.passthrough()` 라 저장만 통과한다. 정식 설정 항목이 아니며 정식 데이터 추출 경로는 `dataField` 다.
2. 각 항목에서 `{ x: item[xAxis.field], y: item[yAxis.field] }` 포인트를 만든다. `yAxis` 가 없으면 `y` 를 생략한다.
3. `yAxis.aggregation` 이 있으면 아래 [집계 규칙](#집계-규칙)대로 같은 X 키 묶음 안에서 집계해 `data: { x, y }[]` 를 만든다. 없으면 집계하지 않는다.
4. `groupBy` 가 있으면 그룹별 시리즈를 만든다(다중 시리즈). 현재 핸들러는 `groupBy` 로 시리즈를 나누지 않고 설정 에코에만 싣는다.
5. 차트 그리기는 **프런트엔드가 recharts 로 `output.data` 와 `config.{chartType, title, xAxis, yAxis, colors}` 를 받아 직접 한다**. 백엔드는 SVG 스냅샷을 채우지 않는다.
6. **블로킹 모드**(`config.buttons.length > 0`): [Presentation 노드 공통](CLE-NODE-PRES-COMMON.md#블로킹-모드-실행-흐름) 흐름으로 입력 대기 출력을 낸다.
7. **표시 전용**(`buttons` 가 빈 배열, 없음, 배열 아님): `out` 포트로 출력한다.

### 집계 규칙

X 값이 겹치면(예: 같은 월이 여러 행) `yAxis.aggregation` 에 따라 자동으로 집계한다.

| aggregation | 동작 | 비고 |
|-------------|------|------|
| `sum` | 같은 X 키의 Y 값 합계 | 알 수 없는 값도 `sum` 으로 처리한다 |
| `count` | 같은 X 키의 행 수 | null 도 센다 |
| `avg` | 같은 X 키의 Y 값 평균 | |
| `min` | 같은 X 키의 Y 값 최솟값 | |
| `max` | 같은 X 키의 Y 값 최댓값 | |

`aggregation` 이 없으면 집계하지 않고 원래 포인트를 그대로 쓴다. 숫자로 바꿀 수 없는 Y 값은 `0` 으로 바꿔 집계에 넣는다(`Number(y)` → `NaN` → `0`). null·undefined 도 `0` 이 되므로 "건너뜀" 이 필요하면 앞에 필터 노드를 두는 것을 권한다.

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
| `config.dataField?` | String | 설정 에코 | 데이터 배열이 든 필드 경로 |
| `config.groupBy?` | String | 설정 에코 | 그룹 필드. 현재 핸들러는 이 값으로 시리즈를 나누지 않는다 |
| `config.colors?` | String[] | 설정 에코 | 사용자 색상 배열 |
| `output.data` | `{ x, y? }[]` | 런타임 집계 | 입력을 `xAxis.field` 기준으로 묶고 `yAxis.aggregation` 을 적용한 결과 |
| `meta.durationMs` | number | 엔진 주입 | 실행 시간(ms) |
| `port` | undefined | 없음 | 단일 출력(`out` 포트) |

표현식 접근 예:

- `$node["Ch"].config.chartType` → `"bar"`(리터럴. 유일한 참조 경로)
- `$node["Ch"].config.title` → `"Monthly Revenue"`
- `$node["Ch"].output.data[0].x` → `"Jan"`
- `$node["Ch"].output.data[0].y` → `1200`

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
| `output.data` | `{ x, y? }[]` | 런타임 집계 | 표시 전용과 같다. 입력 대기 시점의 바뀌지 않는 스냅샷이고 재개에서도 같다 |
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

## 에러 코드

Chart 는 **런타임 에러 포트가 없다**. 모든 검증 실패는 실행 전 설정 검증 단계에서 던진다.

| 발생 조건 | 메시지 | 시점 |
|-----------|--------|------|
| `chartType` 이 없음 | `Chart type must be selected.` | 노드 경고 규칙(캔버스 배지) + `handler.validate` |
| `chartType` 이 허용 목록(`CHART_TYPES`)에 없음 | `chartType is required and must be one of: bar, line, pie, donut, area`. 나열 순서는 `CHART_TYPES` 정의 순서다 | `handler.validate` |
| `xAxis.field` 가 없음 | `X-axis field must be entered.` | 노드 경고 규칙(캔버스 배지) |
| `yAxis.field` 가 없음 | `Y-axis field must be entered.` | 노드 경고 규칙(캔버스 배지) |
| `buttons[i]` 의 `id`·`label`·`url` 검증 실패 | `validateButtons` 규칙 위반 메시지 | `handler.validate`([Presentation 노드 공통](CLE-NODE-PRES-COMMON.md#유효성-검증)) |

`chartType`·`xAxis.field`·`yAxis.field` 누락 메시지의 단일 기준은 `chart.schema.ts` 의 `chartMetadata.warningRules` 에 있는 영문 문자열이다. 캔버스 배지의 한국어 표기는 다국어 렌더 결과다.

## 설정 요약

| 경우 | 설정 요약 포맷 | 예시 |
|------|----------------|------|
| 버튼 없음 | `{chartType} · {xAxis.field} / {yAxis.field}` | `bar · month / revenue` |
| 버튼 있음 | `{chartType} · {N} buttons` | `bar · 2 buttons` |

위 포맷은 목표 포맷이다. 현재 구현은 Chart 스키마에 `summaryTemplate` 이 없어 캔버스에 요약 줄이 보이지 않는다(미구현, [Presentation 노드 공통](CLE-NODE-PRES-COMMON.md#설정-요약)).

## 미결 사항

- **채팅 채널 렌더러가 기대하는 차트 입력**: 채팅 채널 어댑터 문서와 렌더러는 차트 입력을 `output.payload.{title, series, labels}` 로 찾지만 이 노드는 `output.data` 를 `{ x, y? }[]` 로 내고 제목은 `config.title` 에 둔다. 매트릭스와 렌더러를 고칠지, 렌더러 앞에 변환 층을 둘지는 [채팅 채널 어댑터 규약 미결 사항](../CLE-CHAT/CLE-CHAT-ADAPTER.md#미결-사항) 에서 정한다. 두 선택지 모두 이 문서의 [출력 구조](#출력-구조)를 노드 출력의 기준으로 둔다.
- **입력 대기 기한(타임아웃)**: 요구사항 원문(ND-CH-07)은 "선택적 타임아웃 지원(무제한 가능)" 을 적고 이 노드 원문은 외부 취소나 종료 전까지 기한 없이 기다린다고 적는다. 결정은 [Presentation 노드 공통](CLE-NODE-PRES-COMMON.md#미결-사항) 에서 함께 한다.
- **출력 스키마가 폐기한 필드를 선언한다**: `chart.schema.ts` 의 `chartOutputSchema` 는 `data` 말고도 `type: 'chart'`·`chartType`·`title` 을 선언한다. `chart.component.ts` 가 이 스키마를 노드의 `outputSchema` 로 등록한다. 핸들러가 출력 값에 싣는 것은 `data` 뿐이다. 세 필드 선언은 [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) Principle 1.1 · 4.2 와 어긋나므로 정리 대상이다.

## 구현 위치

- `codebase/backend/src/nodes/presentation/chart/chart.component.ts`
- `codebase/backend/src/nodes/presentation/chart/chart.handler.ts` (`validate`, 집계)
- `codebase/backend/src/nodes/presentation/chart/chart.schema.ts` (`CHART_TYPES`, `chartConfigSchema`, `warningRules`)
- `codebase/frontend/src/components/editor/run-results/renderers/presentation-renderers.tsx` (recharts 렌더러)

## Rationale

### 백엔드는 SVG 스냅샷을 만들지 않는다

차트 그리기는 프런트엔드가 recharts 로 `output.data` 와 설정 에코를 받아 직접 한다. 백엔드가 SVG 를 만들어 출력 값에 싣지 않는다. 메모리를 아끼고 Carousel 이 `rendered` 를 없앤 것과 같은 방식을 따른다. 리터럴 설정값(`chartType`·`title`)은 출력 값과 설정 에코에 겹쳐 싣지 않는다는 [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) 원칙도 따른다.

### 차트 유형은 다섯 가지가 정본이고 실행 검증이 스키마 목록을 그대로 쓴다

설정 스키마 enum, 프런트엔드 렌더러, 제품 요구사항(ND-CH-01), [Presentation 노드 공통](CLE-NODE-PRES-COMMON.md) 은 이미 `bar`·`line`·`area`·`pie`·`donut` 다섯 유형을 받는다. 실행 검증 `handler.validate` 만 `bar`·`line`·`pie` 세 유형을 받아서 `area`·`donut` 노드가 실행 전에 막혔다. 그래서 다섯 유형을 정본으로 두고 실행 검증을 여기에 맞췄다(CLE-T-V0JAG1).

백엔드의 허용 목록은 `chart.schema.ts` 의 `CHART_TYPES` 다. 설정 스키마 `chartConfigSchema` 의 `chartType` enum 과 실행 검증 `ChartHandler.validate` 가 이 상수를 함께 쓴다. 그래서 백엔드의 설정 검증과 실행 검증은 목록이 다시 갈리지 않는다.

이 상수를 읽지 않는 목록이 따로 있다. 유형을 더하거나 뺄 때는 다음 곳도 함께 고친다.

- 프런트엔드 설정 패널의 Chart Type 선택지: `codebase/frontend/src/components/editor/settings-panel/node-configs/presentation-configs.tsx`
- 프런트엔드 실행 결과 렌더러의 유형별 분기: `codebase/frontend/src/components/editor/run-results/renderers/presentation-renderers.tsx`
- 웹채팅 위젯의 유형 사본: `codebase/channel-web-chat/src/lib/presentation.ts` 의 `ChartData.chartType` 타입과 `CHART_TYPES` 집합
- 웹채팅 위젯 렌더러의 유형별 분기: `codebase/channel-web-chat/src/widget/components/presentations.tsx`
- 표시 도구 `render_chart` 의 기본 설명 문구: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/render-tool-provider.ts` 의 `DEFAULT_DESCRIPTIONS.chart`
- 사용자 문서의 `chartType` 설명: `codebase/frontend/src/content/docs/02-nodes/presentation.mdx`, `presentation.en.mdx`

기각한 대안은 스키마 enum 과 렌더러를 세 유형으로 줄이는 안이다. 이 안은 이전 초안의 미결 사항에 선택지 (B)로 올라 있었다. 이미 `area`·`donut` 으로 저장된 노드가 스키마 검증에서 깨지므로 택하지 않았다.
