---
id: "CLE-NODE-CHART-EXEC"
title: "Chart 노드 — 실행 로직과 렌더링"
type: "design"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-NODE-CHART"
ancestors: ["CLE-VISION", "CLE-NODE", "CLE-NODE-PRES", "CLE-NODE-CHART"]
area: "CLE-NODE-PRES"
content_hash: "53702411ff3a11c3a55b2be988e2f0d0bf87e3e50586a60028c1e54a23b3e4ba"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "1071fb44b21229af69fd8d3617496191aa3a44b946d9977dc10596ab7b1398cf"
etag: "sha256-0d38322b79f986fc02f232b77337a4f9fdfc9808860c825685c008673e9418c5"
---
## 개요

이 문서는 [Chart 노드](CLE-NODE-CHART.md) 의 하위 문서로 입력 데이터 정규화 · 집계 · 다중 시리즈와 색 규칙, 두 렌더러(에디터 · 웹채팅 위젯)가 `output.data` 를 그리는 규칙을 정한다. 설정 필드는 [Chart 노드](CLE-NODE-CHART.md#설정), 출력 필드는 [Chart 노드 — 출력 구조](CLE-NODE-CHART-OUTPUT.md) 이 정한다.

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

에디터 실행 결과 렌더러와 웹채팅 위젯 렌더러는 `output.data` 를 다음 규칙으로 그린다. 표시 도구 `render_chart` 의 페이로드도 같은 규칙을 따른다([표시 도구 페이로드](CLE-NODE-CHART-OUTPUT.md#표시-도구-페이로드)).

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

## Rationale

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

긴 형식은 이전 판 [출력 구조](CLE-NODE-CHART-OUTPUT.md#출력-구조)의 `output.data: { x, y? }[]` 계약을 그대로 두고 포인트에 `series` 하나만 더한다. `groupBy` 를 비워 둔 노드는 출력이 이전과 같고 `$node["Ch"].output.data[i].x` · `.y` 표현식도 그대로 동작한다. `groupBy` 가 이미 저장된 bar·line·area 노드는 구현(CLE-T-YAW4XY) 뒤로 (series, X) 단위로 집계되어 `output.data` 의 길이와 값이 바뀌었다. 그 전에는 그 값이 아무 일도 하지 않았으므로 사용자가 넣은 뜻대로 바뀐 것이다. `render_chart` 페이로드도 같은 모양이라 두 렌더러가 노드 출력과 표시 도구를 한 규칙으로 그린다.

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
