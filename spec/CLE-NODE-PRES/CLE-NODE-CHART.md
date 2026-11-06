---
id: "CLE-NODE-CHART"
title: "Chart 노드"
type: "feature"
version: 5
status: "approved"
requirements: ["REQ-CHART-001", "REQ-CHART-002", "REQ-CHART-003", "REQ-CHART-004", "REQ-CHART-005", "REQ-CHART-006", "REQ-CHART-007", "REQ-CHART-008", "REQ-CHART-009", "REQ-CHART-010", "REQ-CHART-011", "REQ-CHART-012", "REQ-CHART-013", "REQ-CHART-014", "REQ-CHART-015", "REQ-CHART-016", "REQ-CHART-017", "REQ-CHART-018", "REQ-CHART-019", "REQ-CHART-020", "REQ-CHART-021"]
basis_superseded: false
parent: "CLE-NODE-PRES"
ancestors: ["CLE-VISION", "CLE-NODE", "CLE-NODE-PRES"]
area: "CLE-NODE-PRES"
content_hash: "fd4b34081974f9d36bb11c6497870b0c544fe4b017747e6d07b26c5b3b5c6e70"
read_as: "approved_fallback"
task: "CLE-T-N901G9"
source_paths: ["spec/4-nodes/6-presentation/3-chart.md", "spec/4-nodes/_product-overview.md"]
mirror_sha256: "ce2e907ceb321c7778bfedea7c2beeba9b6d69cfe22f3351441b9259a487a85d"
etag: "sha256-ca6d39c7b35078280fb1d143c2fddc12a4885fa544ee576469f3d71628177efa"
---
> 구현 상태: 부분 구현 (미구현: 설정 화면의 Colors 입력 · Preview, 설정 요약 `summaryTemplate`, 에디터 렌더러의 축 라벨은 CLE-T-ETS2WE, 포인트가 없을 때 웹채팅 위젯의 버튼 바는 CLE-T-670711) · 원문: `spec/4-nodes/6-presentation/3-chart.md`, `spec/4-nodes/_product-overview.md` (§9.3) · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

Chart 노드(Chart, `chart`)는 결과를 차트로 보여 주는 노드다. 입력 배열을 `xAxis` 기준으로 묶고 `yAxis.aggregation` 으로 집계해 `{ x, y }` 포인트 배열을 만든다. `groupBy` 를 쓰면 포인트마다 시리즈 이름 `series` 를 실어 시리즈 여러 개를 한 배열에 담는다. 화면은 이 배열로 bar·line·area·pie·donut 같은 차트를 그린다.

전역 버튼이 하나라도 있으면 블로킹 모드로 들어간다. 항목 버튼은 없다.

범위 밖:

- 버튼 정의·버튼 편집기·포트 구성·블로킹 모드 흐름·재개 출력 규격: [Presentation 노드 공통](CLE-NODE-PRES-COMMON.md)
- 실행 결과 드로어의 Chart 표시: [Presentation 노드 공통](CLE-NODE-PRES-COMMON.md#실행-결과-드로어-표시). 다중 시리즈와 색 규칙은 이 문서의 [시리즈와 색](#시리즈와-색)이 정한다
- 표시 도구 `render_chart`: [Presentation 노드 공통](CLE-NODE-PRES-COMMON.md#표시-도구-모드)

## 요구사항

- REQ-CHART-001 WHEN 사용자가 차트 유형을 고르면 THE SYSTEM SHALL 고른 유형에 맞춰 X-Y 축 차트(bar·line·area) 또는 라벨-값 차트(pie·donut)로 그린다. (원본: ND-CH-01)
- REQ-CHART-002 WHEN 사용자가 축을 설정하면 THE SYSTEM SHALL X축·Y축 필드 매핑과 Y축 집계(`sum`·`count`·`avg`·`min`·`max`)를 받는다. (원본: ND-CH-02)
- REQ-CHART-003 WHEN 차트 유형이 bar·line·area 이고 `groupBy` 가 지정되면 THE SYSTEM SHALL 각 항목의 `groupBy` 필드 값을 시리즈 이름으로 삼아 포인트마다 `series` 를 싣고, 화면은 시리즈마다 막대·선·면을 하나씩 범례와 함께 그린다. (원본: ND-CH-03)
- REQ-CHART-004 WHEN 사용자가 차트 제목이나 색상을 설정하면 THE SYSTEM SHALL 그 제목과 색상 배열로 차트를 그리고, 색상 배열에 허용 형식의 색이 하나도 없으면 기본 팔레트를 쓴다. (원본: ND-CH-04) (부분 구현, CLE-T-ETS2WE)
- REQ-CHART-005 WHEN 노드가 결과를 내면 THE SYSTEM SHALL 집계 결과를 구조화된 출력 값 `output.data` 로 내고 SVG 스냅샷은 만들지 않는다. (원본: ND-CH-05)
- REQ-CHART-006 WHEN 화면이 차트를 그리면 THE SYSTEM SHALL 에디터 실행 결과 렌더러는 recharts 로, 웹채팅 위젯은 자체 SVG 렌더러로 `output.data` 와 `config.{chartType, title, xAxis, yAxis, colors}` 를 받아 직접 그린다. (원본: ND-CH-05) (부분 구현, CLE-T-ETS2WE)
- REQ-CHART-007 WHEN 사용자가 버튼을 설정하면 THE SYSTEM SHALL 링크 버튼과 포트 버튼을 노드당 최대 5개까지 라벨·스타일·URL(링크 버튼)과 함께 받는다. (원본: ND-CH-06)
- REQ-CHART-008 WHEN 버튼이 하나라도 있으면 THE SYSTEM SHALL 실행을 입력 대기로 멈추고 사용자가 누른 버튼의 포트로 실행을 재개한다. (원본: ND-CH-07)
- REQ-CHART-009 WHEN `dataField` 가 비어 있지 않고 입력이 객체(배열 포함)이면 THE SYSTEM SHALL 저장된 `dataSource` 와 상관없이 `input[dataField]` 를 데이터 배열로 쓰고 배열이 아니면 `[]` 로 대신한다.
- REQ-CHART-010 IF `dataField` 가 있는데 입력이 객체가 아니거나, `dataField` 와 저장된 `dataSource` 가 모두 비어 있으면 THE SYSTEM SHALL 입력이 배열이면 그대로, 아니면 `[input]` 으로 쓴다.
- REQ-CHART-011 WHEN `yAxis.aggregation` 이 지정되면 THE SYSTEM SHALL X 값이 같은 행의 Y 값을 그 방식으로 집계하고, `groupBy` 를 쓰면 X 값과 시리즈가 모두 같은 행끼리 집계한다.
- REQ-CHART-012 IF `yAxis.aggregation` 이 알 수 없는 값이면 THE SYSTEM SHALL `sum` 으로 집계한다.
- REQ-CHART-013 WHEN `yAxis.aggregation` 이 없으면 THE SYSTEM SHALL 집계하지 않고 원래 Y 값을 그대로 쓴다.
- REQ-CHART-014 IF Y 값을 숫자로 바꿀 수 없거나 null·undefined 이면 THE SYSTEM SHALL 그 값을 `0` 으로 바꿔 집계에 넣는다.
- REQ-CHART-015 IF `chartType`·`xAxis.field`·`yAxis.field` 가 비어 있으면 THE SYSTEM SHALL 노드 경고 규칙으로 캔버스에 알린다.
- REQ-CHART-016 IF 설정 검증에 실패하면 THE SYSTEM SHALL 실행 전 검증 단계에서 에러를 던지고 런타임 에러 포트는 쓰지 않는다.
- REQ-CHART-017 IF 차트 유형이 pie·donut 이면 THE SYSTEM SHALL `groupBy` 가 있어도 쓰지 않고 포인트에 `series` 를 싣지 않는 단일 시리즈로 집계한다.
- REQ-CHART-018 WHEN `dataField` 가 비어 있고 저장된 설정에 `dataSource` 값이 있으면 THE SYSTEM SHALL 그 값을 데이터 배열로 쓰고 배열이 아니면 `[dataSource]` 로 감싸며, 빈 문자열과 `null` 은 값이 없는 것으로 본다.
- REQ-CHART-019 WHEN 사용자가 Chart 설정 화면을 열면 THE SYSTEM SHALL 데이터 입력으로 `dataField` 입력란을 보여 주고, 노드에 저장된 `dataSource` 값이 있으면 그 값을 호환 안내와 함께 보여 주며 지울 수 있게 한다.
- REQ-CHART-020 WHEN 화면이 차트를 그리면 THE SYSTEM SHALL `colors` 에서 허용 형식의 색만 남긴 목록(길이 n)을 만들어 bar·line·area 는 처음 나온 순서로 i 번째 시리즈에, pie·donut 은 i 번째 조각에 그 목록의 `i % n` 번째 색을 쓰고, 남은 색이 없으면 그 렌더러의 기본 팔레트에 같은 규칙을 쓴다.
- REQ-CHART-021 IF `render_chart` 페이로드의 `data` 가 배열이 아니거나, 항목이 하나 이상인데 객체(배열 · `null` 제외)인 항목이 하나도 없으면 THE SYSTEM SHALL 도구 의미 검사에서 `INVALID_PAYLOAD` 를 돌려주어 LLM 이 다시 부르게 하고, 빈 배열은 그대로 받는다.

입력 대기에는 기한이 없다. 버튼이 있으면 사용자가 버튼을 누르거나 외부에서 실행을 취소할 때까지 기다린다([Presentation 노드 공통](CLE-NODE-PRES-COMMON.md#규칙) 규칙 10).

제품 요구사항 원문의 우선순위는 제목 · 색상 요구사항만 권장이고 나머지는 필수다. 다만 버튼 입력 대기 요구사항의 타임아웃 부분은 옮기지 않았다([Presentation 노드 공통](CLE-NODE-PRES-COMMON.md#입력-대기에-기한을-두지-않는다-2026-10-24)).

## 설정

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| `chartType` | Enum | ✓ | `bar` | `bar` / `line` / `area` / `pie` / `donut`. 설정 스키마와 실행 검증이 같은 목록(`CHART_TYPES`)을 쓴다 |
| `dataField` | String? | ✗ | `''` | 입력이 객체일 때 데이터 배열이 든 최상위 키. 점 경로를 따라가지 않는다. 다른 설정 값처럼 `{{ }}` 를 쓰면 엔진이 먼저 평가하고 그 결과 문자열을 키로 쓴다. 비어 있으면 저장된 `dataSource` 를, 그것도 없으면 입력 자체를 배열로 쓴다 |
| `xAxis` | AxisDef | ✓ | `{ field: '' }` | X축 정의 |
| `yAxis` | AxisDef | ✓ | `{ field: '' }` | Y축 정의(`aggregation` 포함) |
| `groupBy` | String? | ✗ | 없음 | 시리즈를 나눌 항목 필드. bar·line·area 에서만 쓰고 pie·donut 은 쓰지 않는다 |
| `title` | String? | ✗ | 없음 | 차트 제목. 표현식을 쓸 수 있다 |
| `colors` | String[]? | ✗ | 없음 | 사용자 색상 배열. 렌더러는 허용 형식의 값만 쓰고 남은 색이 없으면 기본 팔레트를 쓴다([시리즈와 색](#시리즈와-색)) |
| `buttons` | ButtonDef[] | ✗ | `[]` | 버튼 정의 배열. 비어 있지 않으면 블로킹 모드. 구조는 [Presentation 노드 공통](CLE-NODE-PRES-COMMON.md#버튼-정의) |

**AxisDef 구조:**

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `field` | String | ✓ | 항목에서 값을 읽을 최상위 키. 점 경로를 따라가지 않는다 |
| `label` | String? | ✗ | 축 라벨 |
| `aggregation` | Enum? | ✗ | `sum` / `count` / `avg` / `min` / `max`. Y축 전용. 없으면 원래 값을 그대로 쓴다 |

스키마 단일 기준은 `codebase/backend/src/nodes/presentation/chart/chart.schema.ts` 의 `chartConfigSchema` 다.

**호환 키 `dataSource`:** 이전 설정 화면은 Data Source 입력에 표현식(`{{$var.items}}` 같은)을 받아 `dataSource` 키로 저장했다. 이 키는 `chartConfigSchema` 에 선언하지 않는다. 스키마가 `.passthrough()` 라 이미 저장된 값은 남고, 핸들러는 `dataField` 가 비어 있을 때만 이 값을 읽는다([실행 로직](#실행-로직) 1단계). 저장된 표현식은 다른 설정 값처럼 엔진이 핸들러 호출 전에 평가하므로 핸들러는 평가된 값(보통 배열)을 받는다. 새 설정 화면은 이 키를 새로 쓰지 않는다. 지금처럼 설정 에코에도 싣지 않으므로 `$node["Ch"].config` 로는 이 값이 보이지 않는다.

## 설정 화면

| 영역 | 위치 | 들어가는 요소 | 동작 |
|------|------|---------------|------|
| 기본 | 맨 위 | Chart Type 드롭다운, Title | 차트 유형을 고르면 설정 폼이 유형에 맞게 바뀐다 |
| 데이터 | 기본 아래 | Data Field | 입력 객체에서 데이터 배열이 든 키를 적는다. 노드에 저장된 `dataSource` 가 있으면 그 값을 호환 안내, 지우기 버튼과 함께 보여 준다. 지우기 버튼은 설정에서 `dataSource` 키를 지운다 |
| X Axis | 데이터 아래 | Field, Label | 항목의 최상위 키를 적는다. 표현식 자동완성을 쓸 수 있다 |
| Y Axis | X Axis 아래 | Field, Label, Aggregation 드롭다운 | 항목의 최상위 키를 적는다. Aggregation 드롭다운에는 "없음 (원래 값)" 선택지가 있고, 이것을 고르면 `yAxis.aggregation` 키를 지운다 |
| 그룹과 색상 | Y Axis 아래 | Group By(선택), Colors(색 칩과 `[+]`) | 다중 시리즈와 색을 정한다. pie·donut 을 고르면 Group By 입력을 감추고 저장된 값은 지우지 않는다. 현재 화면에는 Colors 입력이 없다(미구현, CLE-T-ETS2WE) |
| Preview | 아래쪽 | 차트 미리보기 | 마지막 실행 데이터로 차트를 미리 그린다. 현재 화면에는 없다(미구현, CLE-T-ETS2WE) |
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

1. 입력 데이터 배열을 정규화한다(`chart.handler.ts` 의 `selectChartRows`). 우선순위는 다음과 같다.
   - `dataField` 가 비어 있지 않고 입력이 객체이면 `input[dataField]` 를 뽑는다. 배열도 객체로 보므로 입력이 배열이면 그 배열의 `dataField` 키를 읽는다. 배열에는 보통 그런 키가 없어서 결과는 `[]` 가 된다. 뽑은 값이 배열이 아니면 `[]` 로 대신한다. [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md#principle-10-비었거나-null-인-입력의-대체-값) 의 Principle 10 예외이고 [Logic 노드 공통](../CLE-NODE-LOGIC/CLE-NODE-LOGIC-COMMON.md#배열이-아닌-입력-처리) 의 예외 표에 있다.
   - `dataField` 가 비어 있지 않은데 입력이 객체가 아니면(`null` 포함) 마지막 규칙으로 간다. 저장된 `dataSource` 는 읽지 않는다.
   - `dataField` 가 비어 있고 저장된 `dataSource` 에 값이 있으면 그 값을 쓴다. 배열은 그대로 쓰고 단일 값은 `[v]` 로 감싼다. `undefined`·`null`·빈 문자열은 값이 없는 것으로 본다.
   - 그 밖에는 `Array.isArray(input) ? input : [input]` 을 쓴다. `null` · `undefined` 입력도 `[null]` · `[undefined]` 가 되어 x · y 가 없는 포인트 하나를 만든다. [Carousel 노드](CLE-NODE-CAROUSEL.md#실행-로직) 는 이런 입력을 `[]` 로 두지만 Chart 는 맞추지 않는다([Rationale](#null-입력은-carousel-과-맞추지-않는다-2026-11-05)). 이 정규화는 설정 경로로 꺼낸 값이 아니라 입력 전체를 다루므로 Principle 10 의 대상이 아니다([Logic 노드 공통](../CLE-NODE-LOGIC/CLE-NODE-LOGIC-COMMON.md#배열이-아닌-입력-처리) 규칙 2).
2. 각 항목에서 `{ x: item[xAxis.field], y: item[yAxis.field] }` 포인트를 만든다. `yAxis` 가 없으면 `y` 를 생략한다. 항목이 객체가 아니면(숫자 · 문자열 · `null` 등) x · y 를 읽지 못한 것으로 보고 예외를 던지지 않는다. 그런 항목도 포인트 하나가 된다. 차트 유형이 bar·line·area 이고 `groupBy` 가 비어 있지 않으면 `series: String(item[groupBy] ?? '')` 를 더한다. 그룹 값이 `undefined`·`null` 인 항목은 빈 문자열 시리즈로 묶는다.
3. `yAxis.aggregation` 이 있으면 아래 [집계 규칙](#집계-규칙)대로 같은 X 키 묶음 안에서 집계해 `data: { x, y }[]` 를 만든다. 포인트에 `series` 가 있으면 묶음 키는 (series, X) 이고 결과는 `{ x, y, series }[]` 다. 결과 순서는 묶음이 입력에서 처음 나온 순서다. `aggregation` 이 없으면 집계하지 않는다.
4. 다중 시리즈는 시리즈마다 배열을 따로 만들지 않고 한 배열 안에서 `series` 로 구분한다(긴 형식). 화면이 그리는 규칙은 [시리즈와 색](#시리즈와-색)에 있다.
5. 차트 그리기는 **프런트엔드가 `output.data` 와 `config.{chartType, title, xAxis, yAxis, colors}` 를 받아 직접 한다**. 에디터 실행 결과 렌더러는 recharts 로, 웹채팅 위젯은 자체 SVG 렌더러로 그린다. 백엔드는 SVG 스냅샷을 채우지 않는다. 축 라벨(`xAxis.label` · `yAxis.label`)은 웹채팅 위젯만 그리고 에디터 렌더러는 아직 그리지 않는다(미구현, CLE-T-ETS2WE).
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

### 시리즈와 색

에디터 실행 결과 렌더러와 웹채팅 위젯 렌더러는 `output.data` 를 다음 규칙으로 그린다. 표시 도구 `render_chart` 의 페이로드도 같은 규칙을 따른다([표시 도구 페이로드](#표시-도구-페이로드)).

- 두 렌더러는 객체가 아닌 포인트(배열 · `null` 포함)를 건너뛴다.
- `data` 가 빈 배열이거나 건너뛴 뒤 남은 포인트가 없으면 에디터 렌더러는 차트 대신 받은 출력 값을 JSON 으로 보여 준다. 웹채팅 위젯은 차트 블록을 그리지 않는다. 이때도 버튼 바는 보여 준다(미구현, CLE-T-670711).
- 포인트에 `series` 가 하나도 없으면 단일 시리즈로 그린다.
- `series` 가 있으면 X 값이 처음 나온 순서로 X축 카테고리를 만들고, 시리즈가 처음 나온 순서로 막대·선·면을 하나씩 그린다. 범례에 시리즈 이름을 보여 준다. 빈 문자열 시리즈의 범례 표기는 화면 문구로 정한다.
- 렌더러는 시리즈 이름을 데이터 행의 키로 그대로 쓰지 않는다. 시리즈 순번 같은 내부 키로 펼치고 이름은 범례와 툴팁에만 쓴다. 그래서 시리즈 이름이 `x`·`y`·빈 문자열이어도 다른 값과 섞이지 않는다.
- `series` 가 있는데 집계 없이 같은 (series, X) 포인트가 여러 번 나오면 마지막 값을 그린다. 값을 모두 반영하려면 `yAxis.aggregation` 을 정한다.
- bar·line·area 는 시리즈마다 한 색이고, 단일 시리즈면 모든 막대에 첫 색을 쓴다. pie·donut 은 조각마다 색을 바꾼다.

색은 `config.colors` 를 그대로 쓰지 않고 허용 형식의 값만 남긴 목록을 쓴다. 각 값은 앞뒤 공백을 지운 뒤 64자 이하이고 다음 셋 가운데 하나여야 남는다. 남는 값은 공백을 지운 값이다.

- `#` 뒤에 16진수 3 · 4 · 6 · 8자리
- `rgb()` · `rgba()` · `hsl()` · `hsla()`. 괄호 안에는 영문자 · 숫자 · `. , % + - /` · 공백만 올 수 있다. 괄호 · 따옴표 · `:` · `;` 는 올 수 없어서 `url(...)` 을 만들 수 없다.
- 영문자로만 된 색 이름

빈 문자열, 문자열이 아닌 값, 허용 밖의 값은 버린다. 남은 목록의 길이가 n 이면 i 번째 시리즈나 조각에 `i % n` 번째 색을 쓴다. 남은 색이 없으면 렌더러의 기본 팔레트에 같은 규칙을 쓴다. 기본 팔레트는 렌더러마다 따로 있다. 에디터는 10색(`chart-series.ts` 의 `EDITOR_DEFAULT_CHART_COLORS`), 웹채팅 위젯은 5색(`presentations.tsx` 의 `DEFAULT_CHART_COLORS`)이다.

두 렌더러의 색 규칙이 같은지는 공유 픽스처 `codebase/shared-fixtures/chart/colors.json` 을 두 렌더러의 테스트가 함께 읽어 확인한다. 시리즈 묶음 규칙은 `codebase/shared-fixtures/chart/series.json` 을 에디터 · 위젯 · 백엔드 테스트가 함께 읽어 확인한다.

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

표시 도구 `render_chart` 의 페이로드는 설정 필드와 함께 `data` 를 싣는다. `data` 의 모양은 [표시 전용](#표시-전용buttons-없음) 출력의 `output.data` 와 같은 `{ x, y?, series? }[]` 다. 화면은 노드 출력과 같은 렌더러와 [시리즈와 색](#시리즈와-색) 규칙으로 그린다. 도구 정의와 스키마 위반 처리는 [Presentation 노드 공통](CLE-NODE-PRES-COMMON.md#표시-도구-모드) 이 정한다. 기본 설명 문구 목록은 그 문서의 [도구 카탈로그](CLE-NODE-PRES-COMMON.md#도구-카탈로그) 에 있고, `render_chart` 문구에 넣는 `data` 모양 표기는 아래 상수를 쓴다.

도구 모드에서는 `dataField` · `groupBy` · `yAxis.aggregation` 을 쓰지 않는다. LLM 이 이미 묶고 집계한 포인트를 `data` 로 보내고 렌더러는 그 포인트를 그대로 그린다.

`data` 는 `chartConfigSchema` 에 선언하지 않는다. 이 스키마는 노드 설정 스키마이면서 도구 파라미터 스키마다. 여기에 런타임 출력인 `data` 를 넣으면 설정 스키마에 출력 값이 섞여 [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md#principle-11-설정과-출력-값은-겹치지-않는다) Principle 1.1 과 부딪친다. 그래서 LLM 은 도구 설명 문구를 보고 이 모양을 안다. 모양 표기는 `chart.schema.ts` 의 상수 `CHART_DATA_SHAPE`(값 `'{ x, y?, series? }[]'`) 하나다. 도구 기본 설명(`render-tool-provider.ts` 의 `DEFAULT_DESCRIPTIONS.chart`)과 AI 에이전트 시스템 안내(`ai-turn-executor.ts` 의 `PRESENTATION_TOOLS_GUIDANCE`)가 이 상수를 함께 쓴다.

zod 는 `data` 를 검사하지 않으므로 도구 의미 검사(`checkRenderToolSemanticIssues`)가 최소 모양을 본다. `data` 가 배열이 아니거나, 항목이 하나 이상인데 객체(배열 · `null` 제외)인 항목이 하나도 없으면 `INVALID_PAYLOAD` 를 돌려준다. 빈 배열은 받는다. 그 뒤의 재시도와 버림은 다른 표시 도구와 같은 [스키마 위반 처리와 정규화](CLE-NODE-PRES-COMMON.md#스키마-위반-처리와-정규화) 흐름을 따른다.

검사를 통과한 `data` 에 객체가 아닌 항목이 섞여 있으면 렌더러가 그 항목을 건너뛴다. 빈 배열이나 남은 포인트가 없는 경우의 표시는 [시리즈와 색](#시리즈와-색) 이 정한다.

### 출력 스키마(자동완성)

노드의 `outputSchema` 는 표현식 자동완성이 쓰는 출력 모양 힌트다. `chart.component.ts` 가 `chartOutputSchema` 를 등록한다. [Table 노드](CLE-NODE-TABLE.md) · [Carousel 노드](CLE-NODE-CAROUSEL.md) 와 같이 노드 출력 다섯 필드 형태(`config`·`output` 아래로 나눈 모양)로 선언한다.

- `config`: 설정 에코 필드(`chartType`·`title`·`dataField`·`xAxis`·`yAxis`·`groupBy`·`colors`·`buttons`·`buttonConfig`)를 모두 선택 필드로 둔다.
- `output`: `data: { x, y?, series? }[]` 와 재개 때 생기는 `interaction`(`type`·`data`·`receivedAt`)을 둔다.
- 노드 종류를 가리는 `type: 'chart'` 와 리터럴 설정인 `chartType`·`title` 을 `output` 이나 최상위에 선언하지 않는다([노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md#principle-11-설정과-출력-값은-겹치지-않는다) Principle 1.1, [4.2](../CLE-NODE/CLE-NODE-OUTPUT.md#42-폐기할-필드--구조)).

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

위 포맷은 목표 포맷이다. 현재 구현은 Chart 스키마에 `summaryTemplate` 이 없어 캔버스에 요약 줄이 보이지 않는다(미구현, CLE-T-ETS2WE, [Presentation 노드 공통](CLE-NODE-PRES-COMMON.md#설정-요약)).

## 미결 사항

- **채팅 채널 렌더러가 기대하는 차트 입력**: 채팅 채널 어댑터 문서와 렌더러는 차트 입력을 `output.payload.{title, series, labels}` 로 찾지만 이 노드는 `output.data` 를 `{ x, y?, series? }[]` 로 내고 제목은 `config.title` 에 둔다. 매트릭스와 렌더러를 고칠지, 렌더러 앞에 변환 층을 둘지는 [채팅 채널 어댑터 규약 미결 사항](../CLE-CHAT/CLE-CHAT-ADAPTER.md#미결-사항) 에서 정한다. 두 선택지 모두 이 문서의 [출력 구조](#출력-구조)를 노드 출력의 기준으로 둔다. 다중 시리즈는 `output.data` 의 `series` 로 담으므로(긴 형식) 채팅 렌더러의 `series[]` 는 렌더러나 변환 층이 `series` 값으로 묶어 만든다.

## 구현 위치

- `codebase/backend/src/nodes/presentation/chart/chart.component.ts`
- `codebase/backend/src/nodes/presentation/chart/chart.handler.ts` (`validate`, 데이터 원천 선택 `selectChartRows`, 집계, `SERIES_CHART_TYPES`)
- `codebase/backend/src/nodes/presentation/chart/chart.schema.ts` (`CHART_TYPES`, `chartConfigSchema`, `chartOutputSchema`, `CHART_DATA_SHAPE`, `warningRules`)
- `codebase/backend/src/nodes/ai/ai-agent/tool-providers/render-tool-provider.ts` (`DEFAULT_DESCRIPTIONS.chart`, 도구 의미 검사 `checkRenderToolSemanticIssues`)
- `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` (시스템 안내 `PRESENTATION_TOOLS_GUIDANCE`)
- `codebase/frontend/src/components/editor/run-results/renderers/presentation-renderers.tsx` (recharts 렌더러 `ChartContent`)
- `codebase/frontend/src/components/editor/run-results/renderers/chart-series.ts` (시리즈 펼침 `toChartSeriesModel`, 색 거르기 `resolveChartColors`, 에디터 기본 팔레트 `EDITOR_DEFAULT_CHART_COLORS`)
- `codebase/frontend/src/components/editor/settings-panel/node-configs/presentation-configs.tsx` (설정 화면 `ChartConfig`)
- `codebase/channel-web-chat/src/lib/presentation.ts` (`toChart`, 색 거르기 `sanitizeChartColors`)
- `codebase/channel-web-chat/src/lib/chart-model.ts` (위젯의 순수 변환 `toCartesianModel` · `numericPoints`)
- `codebase/channel-web-chat/src/widget/components/presentations.tsx` (웹채팅 위젯 SVG 렌더러, 위젯 기본 팔레트 `DEFAULT_CHART_COLORS`)
- `codebase/shared-fixtures/chart/` (`colors.json` 은 에디터 · 위젯 테스트가, `series.json` 은 에디터 · 위젯 · 백엔드 테스트가 함께 읽는 기대값. 형식 설명은 `codebase/shared-fixtures/README.md`)

## Rationale

### 백엔드는 SVG 스냅샷을 만들지 않는다

차트 그리기는 프런트엔드가 `output.data` 와 설정 에코를 받아 직접 한다. 에디터는 recharts 로, 웹채팅 위젯은 자체 SVG 렌더러로 그린다. 백엔드가 SVG 를 만들어 출력 값에 싣지 않는다. 메모리를 아끼고 Carousel 이 `rendered` 를 없앤 것과 같은 방식을 따른다. 리터럴 설정값(`chartType`·`title`)은 출력 값과 설정 에코에 겹쳐 싣지 않는다는 [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) 원칙도 따른다.

### 차트 유형은 다섯 가지가 정본이고 실행 검증이 스키마 목록을 그대로 쓴다

설정 스키마 enum, 프런트엔드 렌더러, 제품 요구사항 원문, [Presentation 노드 공통](CLE-NODE-PRES-COMMON.md) 은 이미 `bar`·`line`·`area`·`pie`·`donut` 다섯 유형을 받는다. 실행 검증 `handler.validate` 만 `bar`·`line`·`pie` 세 유형을 받아서 `area`·`donut` 노드가 실행 전에 막혔다. 그래서 다섯 유형을 정본으로 두고 실행 검증을 여기에 맞췄다(CLE-T-V0JAG1).

백엔드의 허용 목록은 `chart.schema.ts` 의 `CHART_TYPES` 다. 설정 스키마 `chartConfigSchema` 의 `chartType` enum 과 실행 검증 `ChartHandler.validate` 가 이 상수를 함께 쓴다. 그래서 백엔드의 설정 검증과 실행 검증은 목록이 다시 갈리지 않는다.

이 상수를 읽지 않는 목록이 따로 있다. 유형을 더하거나 뺄 때는 다음 곳도 함께 고친다.

- 프런트엔드 설정 패널의 Chart Type 선택지: `codebase/frontend/src/components/editor/settings-panel/node-configs/presentation-configs.tsx`
- 프런트엔드 실행 결과 렌더러의 유형별 분기: `codebase/frontend/src/components/editor/run-results/renderers/presentation-renderers.tsx`
- 웹채팅 위젯의 유형 사본: `codebase/channel-web-chat/src/lib/presentation.ts` 의 `ChartData.chartType` 타입과 `CHART_TYPES` 집합
- 웹채팅 위젯 렌더러의 유형별 분기: `codebase/channel-web-chat/src/widget/components/presentations.tsx`
- `groupBy` 로 시리즈를 나누는 유형 집합 `SERIES_CHART_TYPES` 의 사본 두 곳: 백엔드 `codebase/backend/src/nodes/presentation/chart/chart.handler.ts`, 설정 화면 `codebase/frontend/src/components/editor/settings-panel/node-configs/presentation-configs.tsx`
- 표시 도구 `render_chart` 의 기본 설명 문구: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/render-tool-provider.ts` 의 `DEFAULT_DESCRIPTIONS.chart`
- 사용자 문서의 `chartType` 설명: `codebase/frontend/src/content/docs/02-nodes/presentation.mdx`, `presentation.en.mdx`

기각한 대안은 스키마 enum 과 렌더러를 세 유형으로 줄이는 안이다. 이 안은 이전 초안의 미결 사항에 선택지 (B)로 올라 있었다. 이미 `area`·`donut` 으로 저장된 노드가 스키마 검증에서 깨지므로 택하지 않았다.

### `dataField` 가 배열이 아니면 빈 배열로 그린다 (2026-10-24)

[노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md#principle-10-비었거나-null-인-입력의-대체-값) 의 Principle 10 은 배열을 기대한 설정 필드에 배열이 아닌 값이 오면 throw 하라고 정한다. Chart 는 `dataField` 가 배열이 아닌 값을 가리키면 `[]` 로 그려 왔다. 이 동작은 승인본 요구사항이 이미 정한 동작이다. 반복·분리 노드는 아니지만 이 동작을 바꾸지 않고 [Logic 노드 공통](../CLE-NODE-LOGIC/CLE-NODE-LOGIC-COMMON.md#배열이-아닌-입력-처리) 의 예외 표에 넣었다(NERV Task `CLE-T-3HJ8MM`). 차트가 그려지지 않는 것이 화면에 바로 보여 사용자가 알아채므로 `meta.fellBackToEmpty` 를 더하지 않았다. 2026-10-10 에 사용자가 승인한 규칙은 입력 배열을 도는 반복·분리 노드만 다뤘다. Chart 를 예외 표에 함께 올린 경위는 [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md#예외-표에서-정한-노드만-배열이-아닌-입력을-빈-배열로-바꾼다-2026-10-24) 에 있다.

문자열 · 숫자 · 객체처럼 `null` · `undefined` 가 아닌 값도 빈 배열로 대신한다. 승인본 요구사항은 값의 타입을 나누지 않고 배열이 아니면 `[]` 로 대신한다고 정했다. 핸들러도 `input[dataField]` 가 배열이 아니면 타입과 상관없이 `[]` 로 집계한다(`chart.handler.ts`). 이런 값이 와도 Chart 는 실행을 멈추지 않고 `data` 를 빈 배열로 낸다. 화면에 차트가 그려지지 않으므로 사용자는 데이터가 잘못 들어온 것을 알아챌 수 있다. 그릴 포인트가 없을 때 화면에 무엇을 보여 주는지는 아래 2026-11-05 항목에 있다.

기각한 대안은 Principle 10 대로 throw 하는 안이다. 데이터가 아직 없어도 끝까지 돌던 워크플로우가 실패로 바뀐다.

### 그릴 포인트가 없으면 에디터는 출력 값을 JSON 으로 보여 준다 (2026-11-05)

[Presentation 노드 공통](CLE-NODE-PRES-COMMON.md) 승인본 v2 는 실행 결과 드로어 Chart 의 빈 데이터를 축만 있는 빈 차트와 "No data" 메시지로 적었다. 에디터 렌더러(`presentation-renderers.tsx`)는 2026-05 이전부터 그릴 포인트가 없으면 차트 대신 받은 출력 값을 JSON 으로 보여 줬다. 이번 개정에서 문서를 구현에 맞췄다(NERV Task `CLE-T-9W8F72`).

드로어는 끝난 실행을 살펴보는 디버깅 화면이다. JSON 을 보여 주면 `data` 가 비었는지, 출력의 다른 필드에 무엇이 들었는지를 사용자가 바로 확인할 수 있다. 빈 축과 "No data" 는 데이터가 없다는 사실만 알린다.

기각한 대안은 렌더러를 승인본 문구대로 빈 축과 "No data" 로 바꾸는 안이다. 지금 드로어에서 보이던 출력 값이 사라지고 얻는 정보가 없다.

### `null` 입력은 Carousel 과 맞추지 않는다 (2026-11-05)

`dataField` 없이 입력 자체를 쓸 때 Chart 는 `null` · `undefined` 입력도 `[input]` 으로 감싸 포인트 하나를 만든다. [Carousel 노드](CLE-NODE-CAROUSEL.md#실행-로직) 는 같은 입력을 `[]` 로 둔다. 입력 전체를 정규화하는 처리는 [Logic 노드 공통](../CLE-NODE-LOGIC/CLE-NODE-LOGIC-COMMON.md#배열이-아닌-입력-처리) 규칙 2 에 따라 Principle 10 의 대상이 아니고 노드 문서가 정한다. Carousel 과 맞추면 `null` 입력을 받던 노드의 `output.data` 가 포인트 하나에서 빈 배열로 바뀐다. 그래서 지금 동작을 그대로 두기로 했다(NERV Task `CLE-T-9W8F72`).

### 다중 시리즈는 `output.data` 의 `series` 로 담는다 (2026-11-01)

`groupBy` 는 설정 스키마 · 설정 화면 · 설정 에코 · 사용자 문서에 있었지만 핸들러와 렌더러가 쓰지 않아 값을 넣어도 아무 일이 없었다. 사람이 세 선택지 가운데 긴 형식 지원을 골랐다(NERV 질문 `01a19676-fcb8-70bb-9c05-d545aa3914ba`, 2026-11-01, Task `CLE-T-BRB8E6`).

긴 형식은 이전 판 [출력 구조](#출력-구조)의 `output.data: { x, y? }[]` 계약을 그대로 두고 포인트에 `series` 하나만 더한다. `groupBy` 를 비워 둔 노드는 출력이 이전과 같고 `$node["Ch"].output.data[i].x` · `.y` 표현식도 그대로 동작한다. `groupBy` 가 이미 저장된 bar·line·area 노드는 구현(CLE-T-YAW4XY) 뒤로 (series, X) 단위로 집계되어 `output.data` 의 길이와 값이 바뀌었다. 그 전에는 그 값이 아무 일도 하지 않았으므로 사용자가 넣은 뜻대로 바뀐 것이다. `render_chart` 페이로드도 같은 모양이라 두 렌더러가 노드 출력과 표시 도구를 한 규칙으로 그린다.

기각한 대안은 두 가지다. 넓은 형식 `{ labels, series: [{ name, data }] }` 는 채팅 채널 렌더러(Telegram · Slack · Discord)가 찾는 모양과 맞는다. 하지만 `output.data` 계약, 기존 표현식, 두 렌더러, `render_chart` 페이로드를 모두 바꿔야 한다. 채팅 렌더러와의 차이는 [채팅 채널 어댑터 규약](../CLE-CHAT/CLE-CHAT-ADAPTER.md#미결-사항) 미결 사항이 따로 다룬다. 지원하지 않는 안은 비용이 가장 적지만 `groupBy` 로 시리즈를 나누는 필수 요구를 철회하고 이미 화면에 있는 설정을 거둬야 한다.

pie · donut 은 원 하나에 시리즈 하나만 보여 줄 수 있어 `groupBy` 를 쓰지 않는다. 설정 화면은 이 두 유형에서 Group By 입력을 감추지만 저장된 값은 지우지 않는다. 사용자가 유형을 bar 로 되돌리면 같은 시리즈를 다시 쓸 수 있게 하려는 것이다. 시리즈 이름을 문자열로 바꾸는 이유는 범례에 그 이름을 그대로 보여 주고, 숫자 `1` 과 문자열 `"1"` 처럼 범례 표기가 같은 값을 한 시리즈로 묶기 위해서다.

색 규칙은 다중 시리즈를 넣으며 함께 정했다. X-Y 차트에서 색은 시리즈를 구분하는 표지다. 그래서 단일 시리즈 bar 도 한 색으로 칠한다. 웹채팅 위젯이 단일 시리즈 bar 를 막대마다 다른 색으로 칠하던 동작은 이 규칙으로 바뀌었다. 에디터 렌더러가 `config.colors` 를 읽지 않던 차이도 같은 구현(CLE-T-YAW4XY)에서 닫았다.

### 차트 색은 허용 형식만 받는다 (2026-11-05)

웹채팅 위젯의 범례 칩은 색 값을 `style.background` 에 그대로 넣는다. 여기에 `url(...)` 이 들어가면 위젯이 그 주소로 요청을 보낸다. `colors` 는 노드 설정이나 LLM 이 만든 `render_chart` 페이로드에서 오므로 렌더러가 받는 값을 [시리즈와 색](#시리즈와-색)의 허용 형식으로 좁혔다. 에디터 렌더러도 같은 규칙을 쓴다. 같은 설정을 두 화면이 같은 색으로 그리게 하려는 것이다.

기각한 대안은 문자열이면 모두 받는 안이다. 위젯 범례 칩이 외부 주소를 요청하는 경로가 열린다.

웹채팅 위젯은 이전에 문자열이면 모두 받았다. 이제 허용 형식 밖의 값(예: `var(--brand)`)은 버리고, 남은 색이 없으면 위젯 기본 팔레트로 그린다. 이런 값을 넣어 둔 설정은 위젯에서 색이 바뀔 수 있다.

### 렌더러 규칙 사본은 공유 픽스처로 맞춘다 (2026-11-05)

색 허용 규칙과 시리즈 묶음 규칙은 스택마다 따로 구현한다. 사본 위치는 다음과 같다.

- 색 허용 형식 `CHART_COLOR_PATTERNS` · `CHART_COLOR_MAX_LENGTH`: 에디터 `codebase/frontend/src/components/editor/run-results/renderers/chart-series.ts`, 웹채팅 위젯 `codebase/channel-web-chat/src/lib/presentation.ts`
- 시리즈 묶음: 에디터 `chart-series.ts` 의 `toChartSeriesModel`, 위젯 `codebase/channel-web-chat/src/lib/chart-model.ts` 의 `toCartesianModel`, 백엔드 `chart.handler.ts` 의 집계

두 규칙의 기대값은 공유 픽스처 `codebase/shared-fixtures/chart/` 에 둔다. `colors.json` 은 에디터와 위젯 테스트가, `series.json` 은 에디터 · 위젯 · 백엔드 테스트가 함께 읽는다. 한쪽 구현만 바꾸면 다른 쪽 테스트가 실패한다(CLE-T-NRN1RR).

공유 패키지로 코드를 합치지 않았다. 새 워크스페이스 패키지를 만들면 `pnpm-workspace.yaml` 과 각 스택의 Dockerfile 에 등록해야 한다. 또 렌더러는 같은 (series, X) 의 마지막 값을 그리고 백엔드는 집계하므로 규칙이 완전히 같지 않다. 코드를 합쳐도 세 스택을 대조할 공통 기대값은 따로 있어야 한다.

### `render_chart` 의 `data` 는 스키마 밖에 두고 최소 모양만 검사한다 (2026-11-05)

`chartConfigSchema` 는 노드 설정 스키마이면서 `render_chart` 의 도구 파라미터 스키마다([Presentation 노드 공통](CLE-NODE-PRES-COMMON.md#스키마-단일-기준)). 여기에 런타임 출력인 `data` 를 선언하면 설정 스키마에 출력 값이 들어가 [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md#principle-11-설정과-출력-값은-겹치지-않는다) Principle 1.1 과 부딪친다. 그래서 `data` 는 스키마 밖에 두고 도구 설명 문구를 LLM 에 주는 계약으로 삼는다. 문구가 여러 곳에서 갈리지 않도록 모양 표기를 상수 `CHART_DATA_SHAPE` 하나로 모았다(CLE-T-NRN1RR).

`data` 모양을 바꿀 때 함께 고칠 곳은 다음과 같다. 모양 표기는 `CHART_DATA_SHAPE` 에서 고친다.

- `codebase/backend/src/nodes/presentation/chart/chart.schema.ts` 의 `CHART_DATA_SHAPE` 와 `chartOutputSchema`
- `codebase/backend/src/nodes/ai/ai-agent/tool-providers/render-tool-provider.ts` 의 `DEFAULT_DESCRIPTIONS.chart` (포인트 필드를 설명하는 문장)
- `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` 의 `PRESENTATION_TOOLS_GUIDANCE` (`render_chart` 줄)
- 두 렌더러(`chart-series.ts`, 위젯 `presentation.ts` · `chart-model.ts`)와 공유 픽스처 `series.json`

스키마 밖의 `data` 는 zod 검사를 받지 않는다. 그래서 `data` 가 빠졌거나 객체가 아닌 값만 든 호출도 통과하고 LLM 은 성공 결과를 받는다. 사용자에게는 차트가 보이지 않고 LLM 은 다시 부를 기회를 얻지 못한다. 이것을 막으려고 도구 의미 검사에 최소 모양 검사를 두어 다른 표시 도구처럼 `INVALID_PAYLOAD` 로 다시 부르게 한다. 검사는 배열인지와 객체 항목이 하나라도 있는지만 본다. 일부 항목만 틀린 페이로드는 렌더러가 틀린 항목을 건너뛰고 나머지를 그리는 지금 동작을 그대로 둔다.

### 데이터 키는 `dataField` 가 정식이고 `dataSource` 는 호환용으로만 읽는다 (2026-11-01)

이전에는 데이터 키가 둘이었다. 설정 화면은 표현식 입력으로 `dataSource` 만 저장했고, 스키마는 `dataField` 만 선언했고, 핸들러는 `dataSource` 를 먼저 읽었다. 사람이 `dataField` 를 정식으로 두고 설정 화면을 `dataField` 입력으로 바꾸는 안을 골랐다(NERV 질문 `01a19677-22d3-7731-a9b2-ec4a7a0903c1`, 2026-11-01).

Data Field 는 데이터를 가리키는 표현식이 아니라 키 이름을 받는다. 그래서 설정 화면에서 다른 노드나 변수의 데이터를 표현식으로 골라 넣는 입력은 없어졌다. 다른 곳의 데이터를 그리려면 앞에 데이터 노드를 두어 Chart 의 입력으로 넘긴다. [Table 노드](CLE-NODE-TABLE.md) 는 여전히 `dataSource` 가 정식 키라 두 노드의 키가 다르다. 이 차이를 알고 택했다.

이미 `dataSource` 로 저장된 표현식은 `dataField` 로 자동 변환할 수 없다. 그래서 핸들러는 이 값을 계속 읽는다. 두 키가 함께 있으면 `dataField` 가 이긴다. 새 화면에서 고친 노드가 화면에 보이는 값대로 동작하게 하려는 것이다. 화면은 남아 있는 `dataSource` 를 지우기 버튼과 함께 보여 준다. 화면에 보이지 않는 값이 데이터를 바꾸는 일을 막는다. 이전 화면은 입력을 비우면 빈 문자열을 저장했고, 핸들러가 그 값을 데이터로 보아 점 하나짜리 차트를 그렸다. 그래서 빈 문자열은 값이 없는 것으로 본다. 배열이 아닌 값을 `[v]` 로 감싸는 것은 이미 저장된 설정의 동작을 그대로 두려는 것이다.

`dataField` 는 최상위 키만 읽고 점 경로를 따라가지 않는다. 핸들러가 `input[dataField]` 로 읽고, 축 필드도 `item[xAxis.field]` 처럼 같은 방식으로 읽는다.

기각한 대안은 `dataSource` 를 정식으로 올리는 안(Table 과 키가 같아지고 화면을 바꾸지 않아도 된다. 사람은 승인본 v2 가 이미 정식 경로로 적은 `dataField` 를 유지하는 쪽을 골랐다)과 두 키를 모두 정식으로 두는 안(같은 일을 하는 입력이 둘이라 설정이 헷갈린다)이다.

### 출력 스키마는 노드 출력 다섯 필드 형태로 선언한다 (2026-11-01)

이전 `chartOutputSchema` 는 `type: 'chart'`·`chartType`·`title` 을 선언했다. 승인본 v2 까지 미결 사항에 있던 항목이다. [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) Principle 1.1 · 4.2 가 이미 이 필드를 쓰지 않는다고 정했고, Table · Carousel 의 출력 스키마는 이미 그 형태다. 그래서 사람 결정 없이 같은 형태를 따른다. 핸들러는 출력 재설계 뒤로 이 필드를 출력에 싣지 않았다. 그래서 `$node["Ch"].output.chartType` 같은 표현식은 이전에도 값이 없었고, 스키마를 고쳐도 깨지는 워크플로우가 없다.
