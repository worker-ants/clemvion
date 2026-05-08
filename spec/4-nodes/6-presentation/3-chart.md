# Spec: Chart

> 관련 문서: [Presentation 공통 규약](./0-common.md) · [Spec 노드 개요](../0-overview.md)

입력 데이터를 바, 라인, 파이 등 데이터 시각화 차트로 생성한다. SVG 기반 렌더링을 제공한다.

ButtonDef / 포트 토폴로지 / Blocking 모드 / 출력 포맷은 [공통 규약](./0-common.md) 참조.

---

## 1. Config

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| chartType | Enum | ✓ | bar | `bar` / `line` / `pie` / `donut` / `area` |
| dataField | String | ✓ | — | 데이터 배열 필드 경로 |
| xAxis | AxisDef | ✓ | — | X축 정의 |
| yAxis | AxisDef | ✓ | — | Y축 정의 |
| groupBy | String? | ✗ | — | 그룹화 필드 (다중 시리즈) |
| title | String? | ✗ | — | 차트 제목 |
| colors | String[]? | ✗ | — | 커스텀 색상 배열 (미지정 시 기본 팔레트) |
| buttons | ButtonDef[] | ✗ | `[]` | 버튼 정의 배열. 비어있지 않으면 Blocking Mode 활성화. ButtonDef 구조는 [공통 §1](./0-common.md#1-buttondef-구조) |

> 버튼 클릭 시까지 무제한 대기합니다. (외부 cancel/종료 외에는 타임아웃이 발생하지 않습니다.)

**AxisDef 구조:**

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| field | String | ✓ | 데이터 필드 경로 |
| label | String? | ✗ | 축 라벨 |
| aggregation | Enum? | ✗ | `sum` / `count` / `avg` / `min` / `max` (Y축 전용) |

## 2. 포트 정의

[공통 §2 포트 토폴로지](./0-common.md#2-포트-토폴로지-non-blocking-vs-blocking) 참조.

## 3. 실행 로직

1. 입력 데이터에서 `dataField` 경로로 배열 추출
2. `xAxis.field`로 카테고리/라벨 추출
3. `yAxis.field` + `yAxis.aggregation`으로 값 산출 (§3.1 aggregation 규칙 참조)
4. `groupBy` 지정 시 시리즈별 데이터 그룹화
5. `chartType`에 따른 SVG 차트 렌더링
6. 차트 설정 JSON + SVG 문자열 생성
7. **Blocking Mode** (`buttons`가 비어있지 않은 경우): [공통 §3](./0-common.md#3-blocking-mode-실행-흐름) 흐름. 외부 cancel/종료 전까지 무제한 대기.
8. **Non-blocking** (`buttons`가 비어있는 경우): `out` 포트로 출력 전달

### 3.1 Aggregation 상세 규칙

X축 값이 중복되는 경우(예: 동일 월이 여러 행에 존재) `yAxis.aggregation`에 따라 자동 합산한다.

| aggregation | 동작 | null/undefined 처리 |
|-------------|------|---------------------|
| `sum` (기본) | 동일 X축 키의 Y값 합계 | 건너뜀 (합산에서 제외) |
| `count` | 동일 X축 키의 행 수 | null 포함 카운트 |
| `avg` | 동일 X축 키의 Y값 평균 | 건너뜀 (분모에서도 제외) |
| `min` | 동일 X축 키의 Y값 최솟값 | 건너뜀 |
| `max` | 동일 X축 키의 Y값 최댓값 | 건너뜀 |

**규칙:**

| 항목 | 설명 |
|------|------|
| 기본 aggregation | `aggregation` 미지정 시 기본값은 `sum` |
| X축 중복 처리 | 동일 X축 키에 여러 행이 매핑되면 aggregation에 따라 자동 합산 |
| groupBy 조합 | `groupBy` 사용 시 그룹 내에서 X축 중복 합산 → 그룹별 시리즈 생성 |
| null/undefined Y값 | `count`를 제외한 모든 aggregation에서 해당 행을 건너뜀 (합산/평균/최솟값/최댓값에서 제외) |
| null X축 값 | X축 값이 null/undefined인 행은 차트에서 제외 |
| 빈 결과 | aggregation 후 데이터가 0건이면 빈 차트 렌더링 (축만 표시) |

## 4. 출력 형식

[공통 §4 출력 포맷](./0-common.md#4-출력-포맷-principle-11--43--45) 참조. `output` 에는 런타임 집계된 `data` (`{x, y}` 쌍 배열) 만.

```json
{
  "config": {
    "chartType": "bar",
    "title": "Monthly Revenue",
    "xAxis": { "field": "month", "label": "월" },
    "yAxis": { "field": "revenue", "label": "매출", "aggregation": "sum" }
  },
  "output": {
    "data": [ { "x": "Jan", "y": 1200 }, { "x": "Feb", "y": 1500 } ],
    "rendered": "<svg>…</svg>"
  }
}
```

Carousel/Table 와 대칭으로 `output.rendered` 는 엔진이 생성한 SVG/HTML 스냅샷이다 (프런트 프리뷰 및 스크린샷/PDF 경로에서 소비). 버튼이 설정된 경우 `status:'waiting_for_input'` → `status:'resumed'` + `output.interaction.*` 흐름을 따른다.

## 5. 설정 UI

```
┌──────────────────────────────┐
│  Chart Settings                      │
│  ────────────────────────────── │
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
│  ─── Preview ───────────────────── │
│    ▐█▌                               │
│    ▐█▌ ▐█▌                           │
│    ▐█▌ ▐█▌ ▐█▌                       │
│    ─────────────                     │
│    Jan  Feb  Mar                     │
└──────────────────────────────┘
```

- Chart Type 선택 시 설정 폼이 차트 유형에 맞게 조정 (pie/donut: xAxis 대신 labelField/valueField)
- 필드 경로 자동완성 지원
- 하단 Preview: 마지막 실행 데이터 기준 차트 미리보기

## 6. 버튼 설정 UI

[Carousel §6](./1-carousel.md#6-버튼-설정-ui) 와 동일한 접이식 "Buttons" 섹션을 Chart 설정 UI 하단에 추가한다.
