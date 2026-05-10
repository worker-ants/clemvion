# Spec: Chart

> 관련 문서: [Presentation 공통 규약](./0-common.md) · [Spec 노드 개요](../0-overview.md) · [CONVENTIONS](../../../user_memo/node-specs-improvement/CONVENTIONS.md)

입력 데이터 배열을 `xAxis` 기준으로 버킷팅하고 `yAxis.aggregation` 으로 집계하여 `{ x, y }` 포인트 배열로 변환한다. bar / line / area / pie / donut 등 시각화 차트로 렌더링된다. 글로벌 버튼이 하나라도 설정되면 **Blocking Mode** 로 진입한다 (per-item 버튼 미지원).

ButtonDef 구조 / 포트 토폴로지 / Blocking 모드 / 출력 포맷의 카테고리 공통 규약은 [Presentation 공통](./0-common.md) 참조.

---

## 1. 설정 (config)

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| chartType | Enum | ✓ | `bar` | `bar` / `line` / `area` / `pie` / `donut`. (handler caveat: §6 참조) |
| dataField | String? | ✗ | `''` | 입력 객체에서 데이터 배열 필드 경로 (객체 입력 시). 미지정 또는 객체가 아닐 경우 input 자체를 배열로 사용 |
| xAxis | AxisDef | ✓ | `{ field: '' }` | X축 정의 |
| yAxis | AxisDef | ✓ | `{ field: '' }` | Y축 정의 (`aggregation` 옵션 포함) |
| groupBy | String? | ✗ | — | 그룹화 필드 (다중 시리즈) |
| title | String? | ✗ | — | 차트 제목 (`{{ }}` 표현식 사용 가능) |
| colors | String[]? | ✗ | — | 커스텀 색상 배열 (미지정 시 기본 팔레트) |
| buttons | ButtonDef[] | ✗ | `[]` | 버튼 정의 배열. 비어있지 않으면 Blocking Mode 활성화. 구조는 [공통 §1](./0-common.md#1-buttondef-구조) |

> 버튼 클릭 시까지 무제한 대기합니다. (외부 cancel/종료 외에는 타임아웃이 발생하지 않습니다.)

**AxisDef 구조:**

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| field | String | ✓ | 데이터 필드 경로 |
| label | String? | ✗ | 축 라벨 |
| aggregation | Enum? | ✗ | `sum` / `count` / `avg` / `min` / `max` (Y축 전용. 미지정 시 raw 값 그대로) |

> Source of truth: `backend/src/nodes/presentation/chart/chart.schema.ts` (export `chartConfigSchema`)

## 2. 설정 UI

```
┌──────────────────────────────────────┐
│  Chart Settings                      │
│  ────────────────────────────────── │
│  Chart Type: [bar ▼]                 │
│  Title:      [Monthly Revenue___]    │
│                                      │
│  Data Field: [sales________]         │
│                                      │
│  X Axis                              │
│    Field: [month_____]               │
│    Label: [월________]               │
│                                      │
│  Y Axis                              │
│    Field:       [revenue_____]       │
│    Label:       [매출________]       │
│    Aggregation: [sum ▼]              │
│                                      │
│  Group By: [region_____] (선택)      │
│                                      │
│  Colors: [#3B82F6] [#10B981] [+]     │
│                                      │
│  ─── Preview ─────────────────────── │
│    ▐█▌                               │
│    ▐█▌ ▐█▌                           │
│    ▐█▌ ▐█▌ ▐█▌                       │
│    ─────────────                     │
│    Jan  Feb  Mar                     │
│                                      │
│  ▶ Buttons (0)                       │
└──────────────────────────────────────┘
```

- Chart Type 선택 시 설정 폼이 차트 유형에 맞게 조정 (pie/donut: xAxis 대신 labelField/valueField 의도지만 현 schema 는 동일 `xAxis`/`yAxis` 를 사용).
- 필드 경로 자동완성 지원.
- 하단 Preview: 마지막 실행 데이터 기준 차트 미리보기.
- "Buttons" 섹션은 [Carousel §6](./1-carousel.md#6-버튼-설정-ui) 와 동일한 접이식 UI.

## 3. 포트

[공통 §2 포트 토폴로지](./0-common.md#2-포트-토폴로지-non-blocking-vs-blocking) 참조. Chart 는 글로벌 버튼만 사용하며 per-item 버튼은 **미지원**.

### 3.1 입력 포트

| id | label | type | dynamic | 설명 |
|------|-------|------|---------|------|
| `in` | Input | data | false | 차트 데이터 입력 (배열 또는 `dataField` 로 추출 가능한 객체) |

### 3.2 출력 포트

| 모드 | id | 생성 조건 | 설명 |
|------|----|-----------|------|
| 비-블로킹 | `out` | `buttons` 없음 (기본) | 차트 결과 출력 |
| 블로킹 (port 버튼) | `<button.id>` | port 타입 버튼마다 동적 생성 | 글로벌 port 버튼 클릭 시 활성화 |
| 블로킹 (link 전용) | `continue` | link 타입 버튼만 존재 시 자동 생성 | Continue 클릭 시 활성화 |

> 동적 포트 명명 규칙: 글로벌 버튼은 [공통 §7.1](./0-common.md#71-동적-포트-명명-규칙-principle-6) 의 `<button.id>` 그대로. Chart 는 per-item 버튼 (`__item_<idx>` suffix) 을 사용하지 않는다.

## 4. 실행 로직

1. 입력 데이터 배열 정규화:
   - `config.dataSource` 가 정의되어 있으면 (배열은 그대로 / 단일 값은 `[v]`) 사용
   - 그렇지 않고 `dataField` + 객체 입력일 경우 `input[dataField]` 추출 (배열이 아니면 `[]` 로 fallback — Principle 10)
   - 그 외에는 `Array.isArray(input) ? input : [input]`
2. 각 항목에서 `{ x: item[xAxis.field], y: item[yAxis.field] }` 포인트 매핑 (`yAxis` 미지정 시 `y` 생략)
3. `yAxis.aggregation` 지정 시 §4.1 규칙대로 동일 X 키 그룹 내에서 집계 → `data: { x, y }[]`
4. `groupBy` 지정 시 그룹별 시리즈 생성 (다중 시리즈)
5. SVG 차트 렌더링 (frontend / 엔진 sidecar 가 `output.rendered` 를 채움 — Carousel/Table 의 `rendered` 와 대칭)
6. **Blocking Mode** (`config.buttons.length > 0`): [공통 §3](./0-common.md#3-blocking-mode-실행-흐름) 흐름 → §5.4. 외부 cancel/종료 전까지 무제한 대기.
7. **Non-blocking** (`buttons` 빈 배열 / 미설정 / 비배열): §5.1, `out` 포트로 출력 전달.

### 4.1 Aggregation 상세 규칙

X축 값이 중복되는 경우 (예: 동일 월이 여러 행) `yAxis.aggregation` 에 따라 자동 집계한다.

| aggregation | 동작 | 비고 |
|-------------|------|------|
| `sum` | 동일 X 키의 Y값 합계 | 미지정 / unknown 값 → `sum` 로 fallback |
| `count` | 동일 X 키의 행 수 | null 포함 카운트 |
| `avg` | 동일 X 키의 Y값 평균 | |
| `min` | 동일 X 키의 Y값 최솟값 | |
| `max` | 동일 X 키의 Y값 최댓값 | |

> 핸들러 구현: 숫자 변환 실패한 Y값은 `0` 으로 대체된 뒤 집계에 포함된다 (`Number(y)` → `NaN` → `0`). 명시적 null/undefined 도 동일하게 `0` 으로 처리되므로, "건너뜀" 의미가 필요한 경우 사전 필터링 노드를 거치는 것을 권장한다.

## 5. 출력 구조

> CONVENTIONS Principle 11 포맷. JSON 예시는 `undefined` 필드 생략, 5필드 (`config`/`output`/`meta?`/`port?`/`status?`) 외 top-level 키 금지.
>
> Chart 는 비-블로킹 (§5.1) 과 블로킹 페어 (§5.4 waiting / §5.5 resumed) 를 갖는다. 별도 에러 케이스는 없으며, config 검증 실패는 §6 pre-flight throw 로 처리된다.
>
> 핵심 원칙 (Principle 1.1): `chartType` / `title` / `xAxis` / `yAxis` / `buttons` 등 **리터럴 config 값은 `output` 에 echo 금지**. `output.data` 는 input 을 xAxis 기준으로 버킷팅 + aggregation 적용한 **런타임 집계 결과** 이므로 `output` 유지. `output.rendered` 는 SVG 스냅샷 (런타임 산출물).

### 5.1 Case: 비-블로킹 (`buttons` 없음)

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
    ],
    "rendered": "<svg>…</svg>"
  },
  "meta": {
    "durationMs": 12
  }
}
```

| 필드 | 타입 | 출처 | 설명 |
|------|------|------|------|
| `config.chartType` | Enum | config echo (Principle 7) | 사용자 설정 차트 타입 — `output` echo 금지 (Principle 1.1) |
| `config.title` | String? | config echo | 차트 제목 (raw `{{ }}` 보존). `output` echo 금지 |
| `config.xAxis` / `config.yAxis` | AxisDef | config echo | 축 정의 |
| `output.data` | `{ x, y? }[]` | runtime — 집계 | input 을 `xAxis.field` 기준으로 버킷팅 + `yAxis.aggregation` 적용한 결과 |
| `output.rendered` | String | runtime — SVG 스냅샷 | 차트 렌더 결과. 프런트 프리뷰 / 스크린샷 / PDF 경로에서 소비 |
| `meta.durationMs` | number | engine inject | 실행 시간 (ms) |
| `port` | undefined | — | 단일 출력 (`out` 포트로 라우팅) |

**Expression 접근 예**:
- `$node["Ch"].config.chartType` → `"bar"` (리터럴 — 유일한 참조 경로)
- `$node["Ch"].config.title` → `"Monthly Revenue"`
- `$node["Ch"].output.data[0].x` → `"Jan"`
- `$node["Ch"].output.data[0].y` → `1200`

### 5.4 Case: Waiting — 글로벌 버튼 대기 (`status: "waiting_for_input"`)

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
    ],
    "rendered": "<svg>…</svg>"
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
| `config.buttons` | ButtonDef[] | config echo | 사용자가 설정한 raw 버튼 정의 (Principle 7) |
| `config.buttonConfig.buttons` | ButtonDef[] | handler — 블로킹 페어 식별 | 블로킹 모드 진입 시 핸들러가 emit 하는 evaluated 버튼 목록. 실행 내역 페이지 / 프런트 버튼 바 렌더에서 사용 ([공통 §3](./0-common.md#3-blocking-mode-실행-흐름)) |
| `output.data` | `{ x, y? }[]` | runtime — 집계 | §5.1 동상. waiting 시점의 immutable snapshot — resumed 에서도 동일 |
| `output.rendered` | String | runtime — SVG | §5.1 동상 |
| `meta.interactionType` | `"buttons"` | handler return | 프런트가 버튼 바 인터랙션 모드를 식별 |
| `meta.durationMs` | number | engine inject | 집계까지 소요된 실행 시간 |
| `status` | `"waiting_for_input"` | handler return | 블로킹 진입 — 사용자 클릭 대기 |
| `port` | undefined | — | 클릭 전까지 활성 포트 없음 |

**Expression 접근 예**:
- `$node["Ch"].status === "waiting_for_input"` → `true`
- `$node["Ch"].config.buttons[0].label` → `"Export"`

> 옛 포맷에서 `output.type: 'chart'` / `output.chartType` / `output.title` / `output.previousOutput` 을 사용했다면 모두 폐기. 노드 종류는 워크플로우 정의로 식별하며 (Principle 1.1.4), 리터럴 config 는 `$node["Ch"].config.*` 로 직접 참조한다.

### 5.5 Case: Resumed — 버튼 클릭 후 (`status: "resumed"`)

#### 5.5.1 port 타입 버튼 클릭

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
    "rendered": "<svg>…</svg>",
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
| `output.data` / `output.rendered` | (§5.4 동상) | waiting snapshot — immutable | resumed 에서도 동일 값 유지. 별도 `previousOutput` 필드 사용 금지 (Principle 4.2) |
| `output.interaction.type` | `"button_click"` | engine — 사용자 클릭 | port 타입 버튼 클릭 식별자 |
| `output.interaction.data.buttonId` | String | engine | 클릭된 버튼의 정의 ID (= 활성화된 포트 ID) |
| `output.interaction.data.buttonLabel` | String | engine | 클릭 시점 버튼 라벨 |
| `output.interaction.receivedAt` | ISO8601 | engine | 클릭 수신 시각 ([공통 §4.2](./0-common.md#42-resumed-버튼-클릭--폼-제출-후)) |
| `meta.durationMs` | number | engine inject | waiting → resumed 까지 elapsed (대기 시간 포함) |
| `port` | `<button.id>` | engine — 라우팅 | 클릭된 port 버튼의 ID 그대로 |
| `status` | `"resumed"` | engine | 통일된 재개 상태 (Principle 4.1) |

**Expression 접근 예**:
- `$node["Ch"].port === "export"` → `true`
- `$node["Ch"].output.interaction.type` → `"button_click"`
- `$node["Ch"].output.interaction.data.buttonId` → `"export"`
- `$node["Ch"].output.data[0].y` → `1200` (waiting snapshot 그대로)

#### 5.5.2 link 타입 Continue 클릭 (link 전용 시)

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
    "rendered": "<svg>…</svg>",
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
| `output.interaction.type` | `"button_continue"` | engine | link 전용 시 자동 Continue 클릭 식별자 |
| `output.interaction.data.url` | String | engine | 사용자가 새 탭에서 연 URL ([공통 §4.2](./0-common.md#42-resumed-버튼-클릭--폼-제출-후)) |
| `port` | `"continue"` | engine — 라우팅 | link 전용 시 자동 생성된 시스템 포트 |
| (그 외 필드) | — | — | §5.5.1 동상 |

> Chart 는 per-item 버튼이 없으므로 `output.interaction.data.selectedItem` 는 사용되지 않는다 (Carousel 전용).

## 6. 에러 코드

Chart 는 **runtime 에러 포트를 갖지 않는다**. 모든 검증 실패는 pre-flight (config 검증) 단계에서 throw 된다 (CONVENTIONS Principle 3.1):

| 발생 조건 | 메시지 | 시점 |
|-----------|--------|------|
| `chartType` 누락 | `차트 타입을 선택해야 합니다.` | warningRule (캔버스 배지) + handler.validate |
| `chartType` 이 enum (`bar`/`line`/`pie`) 미일치 | `chartType is required and must be one of: bar, line, pie` | handler.validate |
| `xAxis.field` 누락 | `X축 필드를 입력해야 합니다.` | warningRule (캔버스 배지) |
| `yAxis.field` 누락 | `Y축 필드를 입력해야 합니다.` | warningRule (캔버스 배지) |
| `buttons[i]` 의 `id`/`label`/`url` 검증 실패 | `validateButtons` 규칙 위반 메시지 | handler.validate ([공통 §1.1](./0-common.md#11-유효성-검증)) |

> ⚠ **Caveat (P1) — `chartType` schema/handler 불일치**: schema enum 은 `bar | line | pie | donut | area` 5종을 모두 허용하지만 handler 의 `validate()` 는 `bar | line | pie` 3종만 통과시킨다 (`backend/src/nodes/presentation/chart/chart.handler.ts` `VALID_CHART_TYPES`). schema 정의로 `donut` / `area` 를 저장한 워크플로우는 실행 단계에서 reject 된다. 해소 옵션 두 가지: (A) handler 의 validation 을 schema 와 동일한 5종으로 확장 + 렌더러 구현, (B) schema enum 에서 `donut` / `area` 제거 (기존 draft breaking). 본 spec 의 출력 구조에는 영향 없음 — 별도 트랙으로 추적.

## 7. 캔버스 요약

[공통 §5](./0-common.md#5-캔버스-요약) — Chart 행 인용 (`{chartType} · {xAxis.field} / {yAxis.field}` 또는 버튼 있을 시 `{chartType} · {N} buttons`).
