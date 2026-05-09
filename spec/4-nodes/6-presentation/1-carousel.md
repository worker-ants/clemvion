# Spec: Carousel

> 관련 문서: [Presentation 공통 규약](./0-common.md) · [Spec 노드 개요](../0-overview.md)

데이터를 캐러셀(슬라이드) 형태로 구조화하여 시각적으로 렌더링한다. **Static** 모드에서는 각 슬라이드를 직접 정의하고, **Dynamic** 모드에서는 입력 배열 데이터의 필드를 매핑하여 자동 생성한다.

ButtonDef 구조 / 유효성 / 포트 토폴로지 / Blocking 모드 / 출력 포맷은 [공통 규약](./0-common.md) 참조.

---

## 1. Config

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| mode | Enum | ✗ | `dynamic` | `static` / `dynamic` — 하위호환을 위해 미지정 시 `dynamic` |
| items | ItemDef[] | static 모드 시 ✓ | `[]` | 정적 캐러셀 아이템 목록 (static 모드 전용) |
| source | Expression | ✗ | — | 배열을 반환하는 표현식 (예: `{{ $input.items }}`, `{{ $node["API"].output.results }}`). 설정 시 실행 엔진이 resolve한 결과를 데이터 소스로 사용. 미설정 시 입력 포트 데이터를 직접 사용 (하위호환) |
| titleField | String | dynamic 모드 시 ✓ | — | 각 슬라이드의 제목으로 사용할 입력 데이터 필드 경로 |
| descriptionField | String | ✗ | — | 각 슬라이드의 설명으로 사용할 입력 데이터 필드 경로 (dynamic 모드 전용) |
| imageField | String? | ✗ | — | 이미지 URL 필드 경로 (지정 시 이미지 슬라이드, dynamic 모드 전용) |
| maxItems | Number | ✗ | 10 | 최대 슬라이드 수 1~100 (dynamic 모드 전용) |
| itemButtons | ButtonDef[] | ✗ | `[]` | 아이템별 공통 버튼 정의 (dynamic 모드 전용). 모든 동적 아이템에 동일한 버튼이 적용됨. 최대 4개. 런타임에 아이템별 고유 ID(`{btnId}__item_{index}`)가 생성되며, 포트 라우팅은 원래 정의 ID로 수행됨 |
| layout | Enum | ✗ | card | `card` / `image` / `minimal` |
| buttons | ButtonDef[] | ✗ | `[]` | 버튼 정의 배열. 비어있지 않으면 Blocking Mode 활성화. ButtonDef 구조는 [공통 §1](./0-common.md#1-buttondef-구조) 참조 |

> 버튼 클릭 시까지 무제한 대기합니다. (외부 cancel/종료 외에는 타임아웃이 발생하지 않습니다.)

**ItemDef (static 모드 아이템 정의):**

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| title | String | ✓ | 슬라이드 제목 (`{{ }}` 표현식 사용 가능) |
| description | String | ✗ | 슬라이드 설명 (`{{ }}` 표현식 사용 가능) |
| image | String? | ✗ | 이미지 URL (`{{ }}` 표현식 사용 가능) |
| buttons | ButtonDef[] | ✗ | 아이템별 버튼 (최대 4개). port, link 타입 모두 지원. 아이템 버튼 클릭 시 해당 아이템 데이터가 `selectedItem`으로 출력에 포함됨 |

## 2. 포트 정의

[공통 §2 포트 토폴로지](./0-common.md#2-포트-토폴로지-non-blocking-vs-blocking) 참조. 단, Carousel 의 아이템 버튼(static `items[].buttons` / dynamic `itemButtons`)도 글로벌 `buttons` 와 함께 Blocking Mode 진입 트리거가 된다.

## 3. 실행 로직

1. `mode` 확인 (기본값: `dynamic`)
2. **Static 모드**: `items` 배열을 직접 사용 (표현식은 실행 엔진이 사전 해석)
3. **Dynamic 모드**:
   1. `source` 표현식이 설정되어 있으면 resolve된 결과를 배열로 사용. 미설정 시 입력 데이터를 직접 사용 (하위호환)
   2. `maxItems`까지 항목 제한
   3. 각 항목에서 `titleField`, `descriptionField`, `imageField`를 매핑하여 슬라이드 구조 생성
   4. `itemButtons`가 설정되어 있으면 모든 아이템에 동일한 버튼을 적용 (아이템별 고유 ID `{btnId}__item_{index}` 자동 생성)
4. `layout`에 따른 HTML 렌더링 생성
5. 구조화된 JSON + 렌더링된 HTML 생성
6. **Blocking Mode** (글로벌 `buttons` 또는 아이템 `buttons`가 하나라도 있는 경우): [공통 §3](./0-common.md#3-blocking-mode-실행-흐름) 의 흐름을 따른다.
7. **Non-blocking** (버튼이 전혀 없는 경우): `out` 포트로 출력 전달

## 4. 출력 형식

[공통 §4 출력 포맷](./0-common.md#4-출력-포맷-principle-11--43--45) 의 원칙을 따른다. `output.items` 는 [공통 §4 의 1MB cap](./0-common.md#4-출력-포맷-principle-11--43--45) 적용 대상으로, 1MB 초과 시 `output.itemsTruncated: true` + `output.itemsTotalCount` 가 함께 포함된다.

Non-blocking (버튼 없음):

```json
{
  "config": { "layout": "card", "mode": "static", "items": [ /* static 모드 정의 */ ] },
  "output": {
    "items": [ { "title": "…", "description": "…", "image": "…" } ],
    "rendered": "<html>…"
  }
}
```

Resumed (버튼 클릭 후):

```json
{
  "config": { "layout": "card", "mode": "static", "items": [ /* … */ ], "buttons": [ /* … */ ] },
  "output": {
    "items": [ /* 이전 스냅샷 유지 */ ],
    "rendered": "<html>…",
    "interaction": {
      "type": "button_click",
      "data": {
        "buttonId": "uuid",
        "buttonLabel": "승인",
        "selectedItem": { "title": "…" }
      },
      "receivedAt": "2026-04-06T10:30:00Z"
    },
    "previousOutput": { /* Stage 3 전환기 호환 필드 — Phase 3 에서 제거 예정 */ }
  },
  "status": "resumed",
  "port": "uuid"
}
```

Link 타입 버튼 Continue 클릭 시 `interaction.type = "button_continue"` + `data: { buttonId, buttonLabel, url }`, `port: "continue"`.

## 5. 설정 UI

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
│  │ ▶ Item Buttons (0)               │
│  └──────────────────────────────── │
│  ┌ Item 2 ──────────────────── [X] │
│  │ Title: [Second Slide______]      │
│  │ Description: [Description_]      │
│  │ Image URL: [https://...]         │
│  │ ▶ Item Buttons (1)               │
│  │   ┌ Button 1 ──────── [✕]      │
│  │   │ Label: [선택]  Type: [port] │
│  │   └──────────────────────────── │
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
│  Source: [{{ $input.items }}____]     │
│  Title Field:       [name________]   │
│  Description Field: [summary_____]   │
│  Image Field:       [thumbnail___]   │
│  ▶ Item Buttons (0)                  │
│  Max Items:         [10_]            │
│                                      │
│  Layout: [card ▼]                    │
└──────────────────────────────┘
```

- Static 모드: 각 아이템의 필드에서 `{{ }}` 표현식으로 변수 참조 가능
- Dynamic 모드: 필드 경로 입력 시 이전 노드 출력 스키마 기반 자동완성 지원

## 6. 버튼 설정 UI

기존 설정 UI 하단에 접이식(collapsible) "Buttons" 섹션을 추가한다:

```
┌──────────────────────────────┐
│  ... (기존 Carousel Settings)        │
│                                      │
│  ▶ Buttons ──────────────────────── │
│  ┌ Button 1 ──────────────── [✕] [↕]│
│  │ Label: [승인____________]         │
│  │ Type:  [port ▼]                   │
│  │ Style: [primary ▼]               │
│  └──────────────────────────────── │
│  ┌ Button 2 ──────────────── [✕] [↕]│
│  │ Label: [상세 보기________]        │
│  │ Type:  [link ▼]                   │
│  │ URL:   [{{ $input.url }}____]     │
│  │ Style: [outline ▼]               │
│  └──────────────────────────────── │
│  [+ Add Button]                      │
└──────────────────────────────┘
```

- 버튼 카드: 드래그 순서 변경 (`[↕]`), 삭제 (`[✕]`)
- Type=link 선택 시 URL 입력 필드 표시, Type=port 선택 시 URL 숨김
- 버튼 추가 시 UUID v4 자동 할당 (ID 불변)
- 최대 10개 버튼
- 버튼 클릭 시까지 무제한 대기합니다. (외부 cancel/종료 외에는 타임아웃이 발생하지 않습니다.)
