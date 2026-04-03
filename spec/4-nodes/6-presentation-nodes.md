# Spec: Presentation 노드

> 관련 문서: [PRD Presentation 노드](../../prd/3-node-system.md#8-presentation-노드-6종) · [Spec 노드 개요](./0-overview.md) · [Spec 노드 공통](../3-workflow-editor/1-node-common.md) · [Spec 실행 엔진](../5-system/4-execution-engine.md)

---

## 1. Carousel

데이터를 캐러셀(슬라이드) 형태로 구조화하여 시각적으로 렌더링한다. **Static** 모드에서는 각 슬라이드를 직접 정의하고, **Dynamic** 모드에서는 입력 배열 데이터의 필드를 매핑하여 자동 생성한다. 다운스트림 노드에 구조화된 데이터를 전달하고, 실행 결과 뷰어에서 슬라이드 형태로 확인할 수 있다.

### 1.1 Config

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| mode | Enum | ✗ | `dynamic` | `static` / `dynamic` — 하위호환을 위해 미지정 시 `dynamic` |
| items | ItemDef[] | static 모드 시 ✓ | `[]` | 정적 캐러셀 아이템 목록 (static 모드 전용) |
| titleField | String | dynamic 모드 시 ✓ | — | 각 슬라이드의 제목으로 사용할 입력 데이터 필드 경로 |
| descriptionField | String | ✗ | — | 각 슬라이드의 설명으로 사용할 입력 데이터 필드 경로 (dynamic 모드 전용) |
| imageField | String? | ✗ | — | 이미지 URL 필드 경로 (지정 시 이미지 슬라이드, dynamic 모드 전용) |
| maxItems | Number | ✗ | 10 | 최대 슬라이드 수 1~100 (dynamic 모드 전용) |
| layout | Enum | ✗ | card | `card` / `image` / `minimal` |

**ItemDef (static 모드 아이템 정의):**

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| title | String | ✓ | 슬라이드 제목 (`{{ }}` 표현식 사용 가능) |
| description | String | ✗ | 슬라이드 설명 (`{{ }}` 표현식 사용 가능) |
| image | String? | ✗ | 이미지 URL (`{{ }}` 표현식 사용 가능) |

### 1.2 포트 정의

| 포트 | 방향 | 식별자 | 설명 |
|------|------|--------|------|
| Input | 입력 | `in` | 배열 데이터 입력 (static 모드에서는 선택적 — 표현식에서 참조할 경우에만 필요) |
| Output | 출력 | `out` | 캐러셀 구조 데이터 출력 |

### 1.3 실행 로직

1. `mode` 확인 (기본값: `dynamic`)
2. **Static 모드**: `items` 배열을 직접 사용 (표현식은 실행 엔진이 사전 해석)
3. **Dynamic 모드**:
   1. 입력 데이터에서 배열 추출 (최상위가 배열이 아닌 경우 배열 필드 자동 탐색)
   2. `maxItems`까지 항목 제한
   3. 각 항목에서 `titleField`, `descriptionField`, `imageField`를 매핑하여 슬라이드 구조 생성
4. `layout`에 따른 HTML 렌더링 생성
5. 구조화된 JSON + 렌더링된 HTML을 출력 포트로 전달

**출력 형식:**

```json
{
  "type": "carousel",
  "items": [
    {
      "title": "...",
      "description": "...",
      "image": "..."
    }
  ],
  "layout": "card",
  "rendered": "<html>..."
}
```

### 1.4 설정 UI

**Static 모드:**

```
┌──────────────────────────────┐
│  Carousel Settings                   │
│  ────────────────────────────── │
│  Mode: [Static Items ▼]             │
│                                      │
│  ─── Items ─────────────────────── │
│  ┌ Item 1 ──────────────────── [X] │
│  │ Title: [Hello World_______]      │
│  │ Description: [Description_]      │
│  │ Image URL: [https://...]         │
│  └──────────────────────────────── │
│  ┌ Item 2 ──────────────────── [X] │
│  │ Title: [Second Slide______]      │
│  │ Description: [Description_]      │
│  │ Image URL: [https://...]         │
│  └──────────────────────────────── │
│  [+ Add Item]                        │
│                                      │
│  Layout: [card ▼]                    │
└──────────────────────────────┘
```

**Dynamic 모드:**

```
┌──────────────────────────────┐
│  Carousel Settings                   │
│  ────────────────────────────── │
│  Mode: [Dynamic (from input) ▼]     │
│                                      │
│  Title Field:       [name________]   │
│  Description Field: [summary_____]   │
│  Image Field:       [thumbnail___]   │
│  Max Items:         [10_]            │
│                                      │
│  Layout: [card ▼]                    │
└──────────────────────────────┘
```

- Static 모드: 각 아이템의 필드에서 `{{ }}` 표현식으로 변수 참조 가능
- Dynamic 모드: 필드 경로 입력 시 이전 노드 출력 스키마 기반 자동완성 지원

---

## 2. Table

데이터를 테이블 형태로 구조화하여 렌더링한다. **Static** 모드에서는 각 행을 직접 정의하고(표현식 사용 가능), **Dynamic** 모드에서는 배열 데이터 소스의 필드를 매핑하여 자동 생성한다. 컬럼 정의, 정렬, 페이지네이션을 지원한다.

### 2.1 Config

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| mode | Enum | ✗ | `dynamic` | `static` / `dynamic` — 하위호환을 위해 미지정 시 `dynamic` |
| dataSource | String? | ✗ | — | 배열 데이터 소스 (`{{ }}` 표현식 사용 가능, dynamic 모드 전용). 미지정 시 이전 노드 입력(`$input`) 사용 |
| columns | ColumnDef[] | ✓ | [] | 컬럼 정의 배열 |
| rows | RowDef[] | static 모드 시 ✓ | `[]` | 정적 행 데이터 목록 (static 모드 전용) |
| pagination | Boolean | ✗ | true | 페이지네이션 활성화 여부 |
| pageSize | Number | ✗ | 20 | 페이지당 행 수 (1~200) |
| sortBy | String? | ✗ | — | 기본 정렬 컬럼 필드명 |
| sortOrder | Enum | ✗ | asc | `asc` / `desc` |

**ColumnDef 구조:**

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| field | String | ✓ | 데이터 필드 경로 (`{{ }}` 표현식 사용 가능) |
| label | String | ✓ | 컬럼 헤더 표시 이름 (`{{ }}` 표현식 사용 가능) |
| width | String? | ✗ | 컬럼 너비 (예: "200px", "30%") |
| sortable | Boolean? | ✗ | 정렬 가능 여부 (기본: false) |
| format | String? | ✗ | 포맷 문자열 (날짜, 숫자 포맷팅) |

**RowDef (static 모드 행 정의):**

각 행은 `Record<string, string>` 형태이며, key는 컬럼의 `field` 값과 대응한다. 각 셀 값에 `{{ }}` 표현식을 사용할 수 있다.

### 2.2 포트 정의

| 포트 | 방향 | 식별자 | 설명 |
|------|------|--------|------|
| Input | 입력 | `in` | 배열 데이터 입력 (static 모드에서는 선택적 — 표현식에서 참조할 경우에만 필요) |
| Output | 출력 | `out` | 테이블 구조 데이터 출력 |

### 2.3 실행 로직

1. `mode` 확인 (기본값: `dynamic`)
2. **Static 모드**: `rows` 배열을 직접 사용 (표현식은 실행 엔진이 사전 해석)
3. **Dynamic 모드**:
   1. `dataSource` 지정 시 해당 값 사용, 미지정 시 이전 노드 입력(`$input`) 사용
   2. 데이터를 배열로 정규화 (단일 객체는 `[obj]`로 래핑)
   3. `columns` 정의에 따라 각 행에서 필드 매핑
4. `format` 지정된 컬럼에 포맷팅 적용 (날짜/숫자)
5. `sortBy`/`sortOrder`에 따라 정렬
6. `pageSize`에 따른 페이지네이션 적용
7. HTML 테이블 렌더링 생성
8. 구조화된 JSON + 렌더링된 HTML을 출력 포트로 전달

**출력 형식:**

```json
{
  "type": "table",
  "columns": [
    { "field": "name", "label": "이름", "width": "200px" }
  ],
  "rows": [
    { "name": "Kim", "email": "kim@example.com" }
  ],
  "totalRows": 1,
  "rendered": "<html>..."
}
```

### 2.4 설정 UI

**Dynamic 모드:**

```
┌──────────────────────────────┐
│  Table Settings                      │
│  ────────────────────────────── │
│  Mode: [Dynamic (from data) ▼]      │
│                                      │
│  Data Source:                         │
│  [{{ $node["API"].output.users }}]   │
│  hint: 배열 데이터 소스               │
│        (미지정 시 이전 노드 출력)     │
│                                      │
│  ─── Columns ───────────────────── │
│  ┌────────────────────────────── [X]│
│  │ Field: [name________]            │
│  │ Label: [이름________]            │
│  └──────────────────────────────── │
│  ┌────────────────────────────── [X]│
│  │ Field: [email_______]            │
│  │ Label: [이메일______]            │
│  └──────────────────────────────── │
│  [+ Add Column]                      │
│                                      │
│  ☑ Enable Pagination                 │
│  Page Size: [20_]                    │
│  Sort By:    [score_____]            │
│  Sort Order: [asc ▼]                │
└──────────────────────────────┘
```

**Static 모드:**

```
┌──────────────────────────────┐
│  Table Settings                      │
│  ────────────────────────────── │
│  Mode: [Static (manual) ▼]          │
│                                      │
│  ─── Columns ───────────────────── │
│  Label: [항목___]  Label: [값___]   │
│  [+ Add Column]                      │
│                                      │
│  ─── Rows ──────────────────────── │
│  ┌ Row 1 ────────────────────── [X] │
│  │ 항목: [사용자 수______________]   │
│  │ 값:   [{{ $var.count }}________]   │
│  └──────────────────────────────── │
│  ┌ Row 2 ────────────────────── [X] │
│  │ 항목: [평균 점수______________]   │
│  │ 값:   [{{ $var.avg }}__________]   │
│  └──────────────────────────────── │
│  [+ Add Row]                         │
│                                      │
│  ☑ Enable Pagination                 │
│  Page Size: [20_]                    │
│  Sort By:    [____________]          │
│  Sort Order: [asc ▼]                │
└──────────────────────────────┘
```

- Static 모드: 각 행의 셀 값에서 `{{ }}` 표현식으로 변수 참조 가능
- Dynamic 모드: Data Source에서 `{{ }}` 표현식으로 변수 시스템 전체 활용 가능
- Dynamic 모드: 컬럼 Field/Label에서 `{{ }}` 표현식 지원, 자동완성 제공
- 컬럼 행을 드래그로 순서 변경 가능
- `+ Add Column` / `+ Add Row` 버튼으로 항목 추가
- 각 항목에 삭제 버튼 (`[✕]`)

---

## 3. Chart

입력 데이터를 바, 라인, 파이 등 데이터 시각화 차트로 생성한다. SVG 기반 렌더링을 제공한다.

### 3.1 Config

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| chartType | Enum | ✓ | bar | `bar` / `line` / `pie` / `donut` / `area` |
| dataField | String | ✓ | — | 데이터 배열 필드 경로 |
| xAxis | AxisDef | ✓ | — | X축 정의 |
| yAxis | AxisDef | ✓ | — | Y축 정의 |
| groupBy | String? | ✗ | — | 그룹화 필드 (다중 시리즈) |
| title | String? | ✗ | — | 차트 제목 |
| colors | String[]? | ✗ | — | 커스텀 색상 배열 (미지정 시 기본 팔레트) |

**AxisDef 구조:**

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| field | String | ✓ | 데이터 필드 경로 |
| label | String? | ✗ | 축 라벨 |
| aggregation | Enum? | ✗ | `sum` / `count` / `avg` / `min` / `max` (Y축 전용) |

### 3.2 포트 정의

| 포트 | 방향 | 식별자 | 설명 |
|------|------|--------|------|
| Input | 입력 | `in` | 데이터 입력 |
| Output | 출력 | `out` | 차트 구조 데이터 출력 |

### 3.3 실행 로직

1. 입력 데이터에서 `dataField` 경로로 배열 추출
2. `xAxis.field`로 카테고리/라벨 추출
3. `yAxis.field` + `yAxis.aggregation`으로 값 산출 (§3.3.1 aggregation 규칙 참조)
4. `groupBy` 지정 시 시리즈별 데이터 그룹화
5. `chartType`에 따른 SVG 차트 렌더링
6. 차트 설정 JSON + SVG 문자열을 출력 포트로 전달

#### 3.3.1 Aggregation 상세 규칙

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

**출력 형식:**

```json
{
  "type": "chart",
  "chartType": "bar",
  "config": {
    "xAxis": { "field": "month", "label": "월" },
    "yAxis": { "field": "revenue", "label": "매출", "aggregation": "sum" },
    "data": [ ... ]
  },
  "rendered": "<svg>...</svg>"
}
```

### 3.4 설정 UI

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

---

## 4. Form (Human-in-the-loop)

워크플로우 실행 중간에 사용자 입력을 받는 Human-in-the-loop 노드. 실행을 일시 정지하고, 폼 UI를 통해 사용자 입력을 수집한 뒤 실행을 재개한다.

### 4.1 Config

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| fields | FormField[] | ✓ | [] | 폼 필드 정의 배열 |
| title | String | ✓ | — | 폼 제목 |
| description | String? | ✗ | — | 폼 설명 (Markdown 지원) |
| submitLabel | String | ✗ | "Submit" | 제출 버튼 텍스트 |
| timeout | Number? | ✗ | — | 대기 타임아웃 (초 단위, 미지정 시 무제한) |

**파일 업로드 설정 (FormField.type = `file` 인 경우):**

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| allowedMimeTypes | String[] | ✗ | 아래 참조 | 허용 MIME 타입 목록 |
| maxFileSize | Number | ✗ | 10 | 단일 파일 최대 크기 (MB) |
| maxTotalSize | Number | ✗ | 50 | 필드 내 전체 파일 합계 최대 크기 (MB) |
| maxFiles | Number | ✗ | 5 | 필드당 최대 파일 수 |

**allowedMimeTypes 기본값 (문서/이미지만 허용):**

```json
[
  "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain", "text/csv"
]
```

> 실행 파일(.exe, .sh 등), 스크립트(.js, .py 등), 아카이브(.zip, .tar.gz 등)는 기본 허용 목록에 포함되지 않는다. 필요 시 `allowedMimeTypes`를 명시적으로 확장한다.

**타임아웃 후 재제출:**

| 상태 | 재제출 가능 여부 |
|------|-----------------|
| `waiting_for_input` | 가능 — 타임아웃 전까지 폼을 반복 제출/수정할 수 있음 |
| `cancelled` (타임아웃 후 전이) | 불가 — 실행이 종료되었으므로 새 실행을 시작해야 함 |

**FormField 구조:**

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| name | String | ✓ | 필드 식별자 (출력 데이터의 키) |
| type | Enum | ✓ | `text` / `number` / `email` / `textarea` / `select` / `checkbox` / `radio` / `date` / `file` |
| label | String | ✓ | 필드 라벨 |
| required | Boolean? | ✗ | 필수 입력 여부 (기본: false) |
| options | Option[]? | ✗ | select/radio/checkbox용 선택지 (`{ label, value }`) |
| defaultValue | Any? | ✗ | 기본값 |
| validation | ValidationRule? | ✗ | 유효성 검증 규칙 |

**ValidationRule 구조:**

| 필드 | 타입 | 설명 |
|------|------|------|
| minLength | Number? | 최소 길이 (text, textarea) |
| maxLength | Number? | 최대 길이 (text, textarea) |
| min | Number? | 최솟값 (number) |
| max | Number? | 최댓값 (number) |
| pattern | String? | 정규표현식 패턴 |
| message | String? | 유효성 실패 시 에러 메시지 |

### 4.2 포트 정의

| 포트 | 방향 | 식별자 | 설명 |
|------|------|--------|------|
| Input | 입력 | `in` | 입력 데이터 (폼 기본값 등에 활용 가능) |
| Output | 출력 | `out` | 사용자가 제출한 폼 데이터 |

### 4.3 실행 로직

1. Form 노드에 도달하면 실행 일시 정지
   - `NodeExecution.status` = `waiting_for_input`
   - `Execution.status` = `waiting_for_input`
2. 폼 URL 생성 및 WebSocket 이벤트 발행 (`execution.waiting_for_input`)
3. 클라이언트에서 폼 UI 렌더링 (제목, 설명, 필드 목록)
4. 사용자가 폼을 제출하면:
   - 클라이언트 → 서버: `execution.submit_form` 이벤트
   - 서버에서 유효성 검증 수행
   - 검증 실패 시 에러 응답 → 폼 재표시
   - 검증 성공 시 실행 재개
5. 제출된 데이터를 출력 포트로 전달
6. `timeout` 지정 시 타임아웃 초과 → `FORM_TIMEOUT` 에러 → 에러 처리 정책에 따라 처리

**출력 형식:**

```json
{
  "type": "form",
  "submittedData": {
    "approval": "approved",
    "comment": "Looks good"
  },
  "submittedAt": "2026-03-29T10:30:00Z",
  "submittedBy": "user-uuid"
}
```

### 4.4 실행 엔진 연동

Form 노드는 기존 브레이크포인트 메커니즘과 유사하게 실행을 일시 정지한다. 차이점은 다음과 같다:

| 항목 | 브레이크포인트 | Form 노드 |
|------|---------------|-----------|
| 트리거 | 개발자 설정 | 노드 자체의 동작 |
| 상태 | `Execution.status` 변경 없음 (디버그 용도) | `Execution.status` = `waiting_for_input` |
| 재개 조건 | Continue/Step Over 버튼 | 폼 제출 |
| 데이터 주입 | 없음 | 폼 데이터가 노드 출력으로 전달 |
| 프로덕션 | 브레이크포인트 무시 | 정상 동작 |

> **실행 엔진 상태 머신 변경**: [Spec 실행 엔진](../5-system/4-execution-engine.md) 참조. `waiting_for_input` 상태가 Execution 및 NodeExecution 상태 머신에 추가된다.

### 4.5 설정 UI

```
┌──────────────────────────────┐
│  Form Settings                       │
│  ────────────────────────────── │
│  Title:       [Approval Request__]   │
│  Description: [Please review...__]   │
│  Submit Label:[Submit__]             │
│  Timeout:     [_____] seconds        │
│                                      │
│  ─── Fields ────────────────────── │
│  1. [text ▼]                         │
│     Name:  [approval_____]           │
│     Label: [승인 여부_____]          │
│     ☑ Required          [✕] [↕]     │
│  ────────────────────────────── │
│  2. [textarea ▼]                     │
│     Name:  [comment______]           │
│     Label: [코멘트_______]           │
│     ☐ Required          [✕] [↕]     │
│  ────────────────────────────── │
│  [+ Add Field]                       │
│                                      │
│  ─── Form Preview ─────────────── │
│  ┌────────────────────────────────┐  │
│  │ Approval Request               │  │
│  │ Please review...               │  │
│  │                                │  │
│  │ 승인 여부 *                    │  │
│  │ [________________]             │  │
│  │                                │  │
│  │ 코멘트                         │  │
│  │ [________________]             │  │
│  │               [Submit]         │  │
│  └────────────────────────────────┘  │
└──────────────────────────────┘
```

- 필드를 카드 형태로 표시, 드래그로 순서 변경 (`[↕]`), 삭제 (`[✕]`)
- 필드 type 변경 시 해당 타입 전용 옵션 표시 (select/radio → 선택지 편집기)
- 하단 Form Preview: 설정한 필드 구성으로 실제 폼 미리보기

---

## 5. Template

Handlebars 스타일 템플릿으로 입력 데이터를 바인딩하여 리치 텍스트/HTML/Markdown 콘텐츠를 생성한다.

### 5.1 Config

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| template | String | ✓ | — | Handlebars 문법 템플릿 문자열 |
| outputFormat | Enum | ✗ | html | `html` / `markdown` / `text` |
| helpers | Boolean | ✗ | true | 내장 Handlebars 헬퍼 활성화 |

**내장 헬퍼:**

| 헬퍼 | 설명 | 예시 |
|------|------|------|
| `{{#if}}` | 조건부 렌더링 | `{{#if user.active}}...{{/if}}` |
| `{{#each}}` | 배열 반복 | `{{#each items}}...{{/each}}` |
| `{{#unless}}` | 부정 조건 | `{{#unless error}}...{{/unless}}` |
| `{{formatDate}}` | 날짜 포맷팅 | `{{formatDate createdAt "YYYY-MM-DD"}}` |
| `{{formatNumber}}` | 숫자 포맷팅 | `{{formatNumber price "0,0.00"}}` |
| `{{truncate}}` | 문자열 자르기 | `{{truncate description 100}}` |
| `{{uppercase}}` | 대문자 변환 | `{{uppercase status}}` |
| `{{lowercase}}` | 소문자 변환 | `{{lowercase tag}}` |
| `{{json}}` | JSON 문자열화 | `{{json data}}` |

### 5.2 포트 정의

| 포트 | 방향 | 식별자 | 설명 |
|------|------|--------|------|
| Input | 입력 | `in` | 템플릿 컨텍스트 데이터 |
| Output | 출력 | `out` | 렌더링된 콘텐츠 |

### 5.3 실행 로직

1. 입력 데이터를 Handlebars 컨텍스트로 바인딩
2. `helpers` 활성화 시 내장 헬퍼 등록
3. 템플릿 컴파일 및 렌더링
4. `outputFormat`에 따른 후처리 (HTML 새니타이징, Markdown→HTML 변환 등)
5. 렌더링 결과를 출력 포트로 전달

**출력 형식:**

```json
{
  "type": "template",
  "format": "html",
  "content": "<h1>Monthly Report</h1><p>Total: 1,234</p>..."
}
```

### 5.4 설정 UI

```
┌──────────────────────────────┐
│  Template Settings                   │
│  ────────────────────────────── │
│  Output Format: [html ▼]            │
│  ☑ Enable Built-in Helpers           │
│  ────────────────────────────── │
│  Template:                           │
│  ┌──────────────────────────────┐│
│  │ 1│ <h1>{{title}}</h1>            ││
│  │ 2│ <p>Generated: {{formatDate .. ││
│  │ 3│                                ││
│  │ 4│ {{#each items}}               ││
│  │ 5│   <div class="item">         ││
│  │ 6│     <h2>{{this.name}}</h2>    ││
│  │ 7│     <p>{{this.desc}}</p>      ││
│  │ 8│   </div>                      ││
│  │ 9│ {{/each}}                     ││
│  └──────────────────────────────┘│
│                                      │
│  ─── Rendered Preview ──────────── │
│  ┌──────────────────────────────┐│
│  │ Monthly Report                    ││
│  │ Generated: 2026-03-29            ││
│  │                                   ││
│  │ Item A                            ││
│  │ Description of item A            ││
│  └──────────────────────────────┘│
└──────────────────────────────┘
```

- 코드 에디터: Handlebars 구문 강조, `{{` 입력 시 입력 데이터 필드 자동완성
- 하단 Rendered Preview: 마지막 실행 데이터 기준 렌더링 결과 미리보기

---

## 6. PDF

데이터를 HTML 템플릿에 바인딩하여 PDF 문서로 렌더링한다. 생성된 PDF는 Object Storage에 저장되고 다운로드 URL이 출력된다.

### 6.1 Config

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| template | String | ✓ | — | HTML 템플릿 (Handlebars 문법 지원) |
| pageSize | Enum | ✗ | A4 | `A4` / `Letter` / `A3` |
| orientation | Enum | ✗ | portrait | `portrait` / `landscape` |
| margin | Object | ✗ | `{ top: "20mm", right: "15mm", bottom: "20mm", left: "15mm" }` | 페이지 여백 |
| headerTemplate | String? | ✗ | — | 머리글 HTML 템플릿 |
| footerTemplate | String? | ✗ | — | 바닥글 HTML 템플릿 (페이지 번호 등) |
| fileName | String | ✗ | "document.pdf" | 출력 파일명 (표현식 가능, 예: `report_{{date}}.pdf`) |

**margin 구조:**

| 필드 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| top | String | "20mm" | 상단 여백 |
| right | String | "15mm" | 우측 여백 |
| bottom | String | "20mm" | 하단 여백 |
| left | String | "15mm" | 좌측 여백 |

### 6.2 포트 정의

| 포트 | 방향 | 식별자 | 설명 |
|------|------|--------|------|
| Input | 입력 | `in` | 템플릿 컨텍스트 데이터 |
| Output | 출력 | `out` | PDF 파일 정보 |

### 6.3 실행 로직

1. 입력 데이터를 Handlebars 컨텍스트로 바인딩하여 HTML 렌더링
2. **Playwright** 기반 Chromium 헤드리스 브라우저로 HTML→PDF 변환
   - `page.pdf()` API 사용
   - `pageSize`, `orientation`, `margin` 적용
   - `headerTemplate`, `footerTemplate` 적용
3. 생성된 PDF를 Object Storage에 업로드
4. 파일 메타데이터(URL, 크기 등)를 출력 포트로 전달

**출력 형식:**

```json
{
  "type": "pdf",
  "fileName": "report_2026-03.pdf",
  "fileSize": 245760,
  "url": "https://storage.example.com/files/uuid/report_2026-03.pdf"
}
```

### 6.4 리소스 제한

| 항목 | 제한 | 설명 |
|------|------|------|
| PDF 렌더링 타임아웃 | 60초 | 기본 노드 타임아웃(30초)보다 긴 기본값 적용 |
| 최대 파일 크기 | 50MB | 초과 시 `PDF_SIZE_EXCEEDED` 에러 |
| 동시 렌더링 수 | Worker당 2 | Playwright Chromium 인스턴스 풀 관리 |

### 6.6 구현 참고사항

| 항목 | 설명 |
|------|------|
| 렌더링 엔진 | **Playwright** (Chromium 헤드리스) |
| PDF 생성 API | `page.pdf({ format, landscape, margin, headerTemplate, footerTemplate })` |
| 페이지 사이즈/방향 | config의 `pageSize`, `orientation` 값을 `page.pdf()` 옵션으로 매핑 |
| 브라우저 풀 | Worker 시작 시 Playwright Browser 인스턴스를 미리 생성하고 풀로 관리. 각 PDF 렌더링마다 새 Page를 열고 완료 후 닫음 |

### 6.5 설정 UI

```
┌──────────────────────────────┐
│  PDF Settings                        │
│  ────────────────────────────── │
│  File Name: [report_{{date}}.pdf]    │
│  Page Size: [A4 ▼]                   │
│  Orientation: [portrait ▼]           │
│                                      │
│  Margin:                             │
│  Top:[20mm] Right:[15mm]             │
│  Bottom:[20mm] Left:[15mm]           │
│  ────────────────────────────── │
│  Template (HTML):                    │
│  ┌──────────────────────────────┐│
│  │ 1│ <h1>{{title}}</h1>            ││
│  │ 2│ <table>                        ││
│  │ 3│ {{#each rows}}                ││
│  │ 4│   <tr><td>{{this.name}}</td>  ││
│  │ 5│       <td>{{this.value}}</td> ││
│  │ 6│   </tr>                        ││
│  │ 7│ {{/each}}                     ││
│  │ 8│ </table>                       ││
│  └──────────────────────────────┘│
│                                      │
│  ▶ Header Template (선택)            │
│  ▶ Footer Template (선택)            │
│                                      │
│  ─── Preview ───────────────────── │
│  [📄 PDF Preview]  (새 탭에서 열기)  │
└──────────────────────────────┘
```

- HTML 템플릿 에디터: Handlebars + HTML 구문 강조
- Header/Footer 템플릿: 접을 수 있는(collapsible) 섹션
- Preview: 마지막 실행의 PDF를 새 탭에서 미리보기, 또는 썸네일 표시

---

## 7. 캔버스 요약

각 Presentation 노드가 캔버스에 표시하는 설정 요약 텍스트 포맷. ([캔버스 §5.3](../3-workflow-editor/0-canvas.md#53-노드-설정-요약-configuration-summary) 참조)

| 노드 | 요약 포맷 | 예시 |
|------|-----------|------|
| Carousel | `{layout} · {titleField}` | `card · name` |
| Table | `{N} columns`. pagination 활성화 시 `· pagination` 추가 | `3 columns · pagination` |
| Chart | `{chartType} · {xAxis.field} / {yAxis.field}` | `bar · month / revenue` |
| Form | `{N} fields · "{title}"` (필드 수 + 폼 제목) | `3 fields · "Approval"` |
| Template | `{outputFormat} · {N} lines` (템플릿 줄 수) | `html · 9 lines` |
| PDF | `{pageSize} {orientation} · {fileName}` | `A4 portrait · report.pdf` |

---

## 8. Run Results Drawer 렌더링

각 Presentation 노드가 실행 완료 후 Run Results Drawer의 **채팅형 히스토리 항목**으로 렌더링되는 방식. 히스토리는 실행 순서대로 누적되며, 각 항목은 접기/펼치기 가능하다. ([실행/디버깅 §10 Run Results Drawer](../3-workflow-editor/3-execution.md#10-run-results-drawer) 참조)

### 8.1 Carousel

| 항목 | 설명 |
|------|------|
| 렌더링 | `output.items` 배열을 `layout` 설정에 따라 카드/이미지/미니멀 형태로 표시 |
| 인터랙션 | 좌/우 화살표로 슬라이드 탐색. 현재 슬라이드 인디케이터 (예: 3/10) |
| 이미지 | `imageField` 지정 시 이미지 렌더링. 로드 실패 시 placeholder |
| 빈 데이터 | "No items to display" 메시지 |

### 8.2 Table

| 항목 | 설명 |
|------|------|
| 렌더링 | `output.columns`와 `output.rows`를 테이블로 표시 |
| 인터랙션 | `sortable` 컬럼 헤더 클릭 시 정렬 토글 (asc/desc). 페이지네이션 컨트롤 |
| 포맷팅 | `format` 지정된 컬럼은 날짜/숫자 포맷 적용 |
| 빈 데이터 | 컬럼 헤더만 표시 + "No data" 행 |
| 대량 데이터 | 페이지네이션 강제 (최대 200행/페이지) |

### 8.3 Chart

| 항목 | 설명 |
|------|------|
| 렌더링 | `output.rendered` SVG를 인터랙티브 차트로 표시 |
| 인터랙션 | 데이터 포인트 호버 시 값 툴팁. 범례 표시. 축 라벨 |
| 차트 타입 | bar/line/area: X-Y 축 차트. pie/donut: 라벨-값 차트 |
| 빈 데이터 | 축만 표시된 빈 차트 + "No data" 메시지 |
| 리사이즈 | 드로어 크기 변경 시 차트 반응형 리사이즈 |

### 8.4 Form

| 항목 | 설명 |
|------|------|
| 대기 중 (`waiting_for_input`) | 실제 폼 UI 렌더링 — 제목, 설명(Markdown), 필드 목록, 제출 버튼. 필드 유효성 검증 실시간 적용 |
| 파일 업로드 | `type: file` 필드는 드래그앤드롭 + 파일 선택 UI. MIME/크기 제한 실시간 검증 |
| 제출 | 제출 버튼 클릭 → `execution.submit_form` WebSocket 명령 전송 → 검증 실패 시 에러 표시, 성공 시 실행 재개 |
| 제출 후 | 제출된 데이터를 키-값 테이블로 표시. 제출 시각, 제출자 정보 포함 |
| 타임아웃 | 타임아웃 설정 시 잔여 시간 카운트다운 표시. 타임아웃 도달 시 폼 비활성화 + "Timed out" 상태 표시 |

### 8.5 Template

| 항목 | 설명 |
|------|------|
| HTML 출력 | 샌드박스 iframe 내에서 렌더링. 외부 스크립트 실행 차단 |
| Markdown 출력 | Markdown → HTML 변환 후 렌더링 |
| Text 출력 | 코드 블록(`<pre>`) 형태로 표시 |
| 빈 결과 | "Empty output" 메시지 |

### 8.6 PDF

| 항목 | 설명 |
|------|------|
| 생성 중 | 로딩 스피너 + "Generating PDF..." 메시지 |
| 완료 | 브라우저 내장 PDF 뷰어로 임베드 렌더링 |
| 버튼 | `[Download]` — 파일 다운로드. `[새 탭에서 열기]` — 새 탭에서 PDF 열기 |
| 파일 정보 | 파일명, 파일 크기 표시 |
| 에러 | PDF 생성 실패 시 에러 메시지 + 재시도 안내 |
