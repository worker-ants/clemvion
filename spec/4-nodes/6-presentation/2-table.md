# Spec: Table

> 관련 문서: [Presentation 공통 규약](./0-common.md) · [Spec 노드 개요](../0-overview.md)

데이터를 테이블 형태로 구조화하여 렌더링한다. **Static** 모드에서는 각 행을 직접 정의하고(표현식 사용 가능), **Dynamic** 모드에서는 배열 데이터 소스의 필드를 매핑하여 자동 생성한다. 컬럼 정의, 정렬, 페이지네이션을 지원한다.

ButtonDef / 포트 토폴로지 / Blocking 모드 / 출력 포맷은 [공통 규약](./0-common.md) 참조.

---

## 1. Config

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
| buttons | ButtonDef[] | ✗ | `[]` | 버튼 정의 배열. 비어있지 않으면 Blocking Mode 활성화. ButtonDef 구조는 [공통 §1](./0-common.md#1-buttondef-구조) |

> 버튼 클릭 시까지 무제한 대기합니다. (외부 cancel/종료 외에는 타임아웃이 발생하지 않습니다.)

**ColumnDef 구조:**

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| field | String | ✓ | 데이터 필드 경로 또는 `{{ }}` 표현식. 단순 문자열 시 dot-path 지원 (예: `address.city`). 표현식 시 per-item 평가 (예: `{{ $sourceItem.first + " " + $sourceItem.last }}`) |
| label | String | ✓ | 컬럼 헤더 표시 이름 (`{{ }}` 표현식 사용 가능) |
| width | String? | ✗ | 컬럼 너비 (예: "200px", "30%") |
| sortable | Boolean? | ✗ | 정렬 가능 여부 (기본: false) |
| format | String? | ✗ | 포맷 문자열 (날짜, 숫자 포맷팅) |

**RowDef (static 모드 행 정의):**

각 행은 `Record<string, string>` 형태이며, key는 컬럼의 `field` 값과 대응한다. 각 셀 값에 `{{ }}` 표현식을 사용할 수 있다.

## 2. 포트 정의

[공통 §2 포트 토폴로지](./0-common.md#2-포트-토폴로지-non-blocking-vs-blocking) 참조.

## 3. 실행 로직

1. `mode` 확인 (기본값: `dynamic`)
2. **Static 모드**: `rows` 배열을 직접 사용 (표현식은 실행 엔진이 사전 해석)
3. **Dynamic 모드**:
   1. `dataSource` 지정 시 해당 값 사용, 미지정 시 이전 노드 입력(`$input`) 사용
   2. 데이터를 배열로 정규화 (단일 객체는 `[obj]`로 래핑)
   3. `columns` 정의에 따라 각 행에서 필드 매핑:
      - **단순 필드 경로** (예: `name`, `address.city`): dot-path로 중첩 접근
      - **`{{ }}` 표현식** (예: `{{ $sourceItem.first + " " + $sourceItem.last }}`): per-item 표현식 평가
4. `format` 지정된 컬럼에 포맷팅 적용 (날짜/숫자)
5. `sortBy`/`sortOrder`에 따라 정렬
6. `pageSize`에 따른 페이지네이션 적용
7. HTML 테이블 렌더링 생성
8. 구조화된 JSON + 렌더링된 HTML 생성
9. **Blocking Mode** (`buttons`가 비어있지 않은 경우): [공통 §3](./0-common.md#3-blocking-mode-실행-흐름) 흐름. 외부 cancel/종료 전까지 무제한 대기.
10. **Non-blocking** (`buttons`가 비어있는 경우): `out` 포트로 출력 전달

**Dynamic 모드 per-item 변수:**

column의 `field`/`label`에서 `{{ }}` 표현식을 사용할 때 다음 변수가 추가로 제공된다:

| 변수 | 타입 | 설명 |
|------|------|------|
| `$dataSource` | `unknown[]` | 해석된 data source 배열 전체 |
| `$sourceItem` | `unknown` | 현재 순회 중인 배열 항목 |
| `$sourceItemIndex` | `number` | 현재 항목의 0-based 인덱스 |

기존 변수 (`$input`, `$var`, `$node`, `$execution` 등)도 함께 사용 가능하다.

## 4. 출력 형식

[공통 §4 출력 포맷](./0-common.md#4-출력-포맷-principle-11--43--45) 참조. `output` 에는 per-row 필터링/표현식 평가의 런타임 결과인 `rows`, 그 페이지 길이 `totalRows`, 렌더링된 HTML `rendered` 만 담는다. `output.rows` 는 [공통 §4 의 1MB cap](./0-common.md#4-출력-포맷-principle-11--43--45) 적용 대상이며 초과 시 `output.rowsTruncated: true` + `output.rowsTotalCount` (잘리기 전 행 수) 가 함께 포함된다. `totalRows` 는 cap 적용 전 전체 데이터셋 크기 (pageSize / sort 적용 후) 를 그대로 노출하므로, `rows.length !== totalRows` 만으로도 잘림을 감지할 수 있다.

```json
{
  "config": {
    "mode": "dynamic",
    "columns": [ { "field": "name", "label": "이름", "width": "200px" } ],
    "pageSize": 20,
    "sortBy": "score",
    "sortOrder": "asc"
  },
  "output": {
    "rows": [ { "name": "Kim", "email": "kim@example.com" } ],
    "totalRows": 1,
    "rendered": "<table>…</table>"
  }
}
```

버튼이 설정된 경우 `status:'waiting_for_input'` → 클릭 후 `status:'resumed'` + `output.interaction.{type,data,receivedAt}` 가 추가된다 (CONVENTIONS §4.5).

## 5. 설정 UI

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
- Dynamic 모드: 컬럼 Field에서 dot-path 접근 (예: `address.city`) 또는 `{{ }}` per-item 표현식 지원 (예: `{{ $sourceItem.first + " " + $sourceItem.last }}`)
- Dynamic 모드: 컬럼 Label에서 `{{ }}` 표현식 지원
- 컬럼 행을 드래그로 순서 변경 가능
- `+ Add Column` / `+ Add Row` 버튼으로 항목 추가
- 각 항목에 삭제 버튼 (`[✕]`)

## 6. 버튼 설정 UI

[Carousel §6](./1-carousel.md#6-버튼-설정-ui) 와 동일한 접이식 "Buttons" 섹션을 Table 설정 UI 하단에 추가한다.
