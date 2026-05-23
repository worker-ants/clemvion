---
id: carousel
status: spec-only
code: []
---

# Spec: Carousel

> 관련 문서: [Presentation 공통 규약](./0-common.md) · [Spec 노드 개요](../0-overview.md) · [Spec 표현식 언어](../../5-system/5-expression-language.md) · [CONVENTIONS](../../conventions/node-output.md)

데이터를 캐러셀(슬라이드) 형태로 구조화하여 시각적으로 렌더링하는 **블로킹 가능 프레젠테이션 노드**. **Static** 모드는 슬라이드를 직접 정의(리터럴 config)하고, **Dynamic** 모드는 `source` 표현식의 결과 배열을 `titleField` / `descriptionField` / `imageField` 로 매핑해 런타임 생성한다. 글로벌 / per-item 버튼이 하나라도 정의되면 Blocking Mode 로 진입한다.

ButtonDef 구조 / 유효성 / 포트 토폴로지 / Blocking 모드 / 출력 포맷은 [공통 규약](./0-common.md) 참조.

---

## 1. 설정 (config)

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| mode | `static` / `dynamic` | ✗ | `dynamic` | 캐러셀 데이터 소스 모드. 미지정 시 `dynamic` (하위호환) |
| items | ItemDef[] | static 시 ✓ | `[]` | 정적 슬라이드 정의 (static 전용). 1MB cap 적용 (§4) |
| source | Expression | ✗ | — | 배열 반환 표현식 (`{{ $node["X"].output.items }}` 등). 미설정 시 입력 포트 데이터를 직접 사용 (dynamic 전용, 하위호환) |
| titleField | String | dynamic 시 ✓ | — | 슬라이드 제목 필드 경로 (dynamic 전용) |
| descriptionField | String | ✗ | — | 슬라이드 설명 필드 경로 (dynamic 전용) |
| imageField | String | ✗ | — | 이미지 URL 필드 경로 (dynamic 전용) |
| maxItems | Number | ✗ | `10` | 최대 슬라이드 수 1~100 (dynamic 전용) |
| itemButtons | ButtonDef[] | ✗ | `[]` | 동적 아이템 공통 버튼 (dynamic 전용, 최대 5개 — [공통 §1.1](./0-common.md#11-유효성-검증)). 런타임에 `<itemButton.id>__item_<idx>` ID 가 생성되며 라우팅 시 base ID 로 매핑 (Principle 6) |
| layout | `card` / `image` / `minimal` | ✗ | `card` | 카드 레이아웃 |
| buttons | ButtonDef[] | ✗ | `[]` | 글로벌 버튼 정의 (최대 5개 — [공통 §1.1](./0-common.md#11-유효성-검증)). 비어있지 않으면 Blocking Mode 활성화. ButtonDef 구조는 [공통 §1](./0-common.md#1-buttondef-구조) |

> 버튼 클릭 시까지 무제한 대기 (외부 cancel/종료 외에는 타임아웃 없음).

**ItemDef (static 모드 슬라이드 정의):**

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| title | String | ✓ | 슬라이드 제목 (`{{ }}` 표현식 지원) |
| description | String | ✗ | 슬라이드 설명 (`{{ }}` 표현식 지원) |
| image | String | ✗ | 이미지 URL (`{{ }}` 표현식 지원). `javascript:` 스킴은 sanitize 됨 |
| buttons | ButtonDef[] | ✗ | per-item 버튼 (최대 5개 — [공통 §1.1](./0-common.md#11-유효성-검증)). port/link 모두 지원. port 클릭 시 `selectedItem` 이 interaction payload 에 포함 (§5.5) |

> Source of truth: `codebase/backend/src/nodes/presentation/carousel/carousel.schema.ts` (export `carouselNodeConfigSchema`)

## 2. 설정 UI

**Static 모드:**

```
┌──────────────────────────────────────┐
│  Carousel Settings                   │
│  Mode: [Static Items ▼]              │
│                                      │
│  ─── Items ─────────────────────     │
│  ┌ Item 1 ─────────────────── [X]   │
│  │ Title:       [Hello World____]   │
│  │ Description: [Description____]   │
│  │ Image URL:   [https://...___]    │
│  │ ▶ Item Buttons (0)               │
│  └────────────────────────────────   │
│  ┌ Item 2 ─────────────────── [X]   │
│  │ Title:       [Second Slide___]   │
│  │ ▶ Item Buttons (1)               │
│  │   ┌ Button 1 ──────── [✕]       │
│  │   │ Label: [선택]  Type:[port]   │
│  │   └────────────────────────────  │
│  └────────────────────────────────   │
│  [+ Add Item]                        │
│  Layout: [card ▼]                    │
└──────────────────────────────────────┘
```

**Dynamic 모드:**

```
┌──────────────────────────────────────┐
│  Carousel Settings                   │
│  Mode: [Dynamic (from input) ▼]      │
│                                      │
│  Source:            [{{ $input.items }}_]│
│  Title Field:       [name________]   │
│  Description Field: [summary_____]   │
│  Image Field:       [thumbnail___]   │
│  ▶ Item Buttons (0)                  │
│  Max Items:         [10_]            │
│  Layout: [card ▼]                    │
└──────────────────────────────────────┘
```

- Static 모드: 각 ItemDef 필드에서 `{{ }}` 표현식으로 변수 참조 가능
- Dynamic 모드: 필드 경로 입력 시 이전 노드 출력 스키마 기반 자동완성

## 3. 포트

[공통 §2 포트 토폴로지](./0-common.md#2-포트-토폴로지-non-blocking-vs-blocking) 참조. Carousel 의 글로벌 `buttons` 뿐만 아니라 per-item 버튼(static `items[].buttons` / dynamic `itemButtons`)도 Blocking Mode 진입 트리거가 된다.

### 3.1 입력 포트

| id | label | type | dynamic | 설명 |
|------|-------|------|---------|------|
| `in` | Input | data | false | 입력 데이터. dynamic 모드에서 `source` 미설정 시 폴백 데이터 |

### 3.2 출력 포트

**비-블로킹 (버튼 미설정 시):**

| id | label | type | dynamic | 설명 |
|------|-------|------|---------|------|
| `out` | Output | data | false | 노드 결과 출력 |

**블로킹 (버튼 설정 시):**

| id | label | type | dynamic | 설명 |
|------|-------|------|---------|------|
| `<button.id>` | (글로벌 버튼 라벨) | data | true | 글로벌 port 버튼마다 동적 생성 (Principle 6) |
| `<itemButton.id>` | (아이템 버튼 라벨) | data | true | per-item port 버튼의 base 포트. 런타임 ID 는 `<itemButton.id>__item_<idx>` 형태로 생성되며 엔진이 `__item_\d+$` suffix 를 분리해 base ID 로 라우팅 |
| `continue` | Continue | data | true | link 타입 버튼만 존재할 때 자동 생성 |

> 버튼 설정 시 `out` 은 제거된다 (공통 §2). per-item 포트 명명 규칙은 [공통 §7.1](./0-common.md#71-동적-포트-명명-규칙-principle-6) / CONVENTIONS Principle 6 참조.

## 4. 실행 로직

1. `mode` 확인 (기본값: `dynamic`)
2. **Static 모드**: `config.items` 를 직접 사용 (표현식은 실행 엔진이 사전 해석). 빈 배열 / 누락 시 `[]` 폴백.
3. **Dynamic 모드**:
   1. `source` 표현식이 설정되어 있으면 resolve 결과를 배열로 사용. 미설정 시 입력 포트 데이터(`input`) 사용 (배열 아니면 `[input]` 으로 wrap, null 이면 `[]`).
   2. `maxItems` 까지 슬라이드 제한.
   3. 각 항목에 `titleField` / `descriptionField` / `imageField` 매핑 (없는 필드는 빈 문자열, 이미지 `javascript:` 는 sanitize).
   4. `itemButtons` 가 설정되어 있으면 모든 아이템에 동일 버튼 적용 (런타임 ID `<btn.id>__item_<idx>`).
4. 1MB cap 적용 — `truncateArrayForOutput` 으로 tail 부터 element 단위 잘라냄. 잘린 결과는 array 형태 유지 (공통 §4). cap 발동 시 `output.itemsTruncated` / `output.itemsTotalCount` 를 surface 한다.
5. 글로벌 + per-item 버튼 합산해 `buttonConfig.buttons` 작성, per-item ID → 아이템 인덱스 매핑을 `buttonConfig.buttonItemMap` 에 기록 (cap 적용된 인덱스 기준).
6. output 분기 (Principle 1.1 / 4.3):
   - **static 모드**: `output: {}` (cap 발동 시 `{ itemsTruncated, itemsTotalCount }`). 슬라이드는 `config.items` 참조.
   - **dynamic 모드**: `output: { items }` (cap 발동 시 `itemsTruncated` / `itemsTotalCount` 동봉).
7. **Blocking Mode** (글로벌 또는 아이템 버튼이 하나라도 있는 경우): [공통 §3](./0-common.md#3-blocking-mode-실행-흐름) 흐름 — `status: 'waiting_for_input'` + `meta.interactionType: 'buttons'` + `buttonConfig` 보존.
8. **Non-blocking** (버튼 전혀 없음): `out` 포트로 출력 전달, `status` 미설정.

> 프론트엔드는 `config` (mode/layout/items/...) + dynamic 모드의 `output.items` 를 조합해 카드 / 이미지 / minimal 레이아웃을 재구성한다. 핸들러는 HTML snapshot 을 생성하지 않는다 (Principle 1).

## 5. 출력 구조

> CONVENTIONS Principle 11 포맷. JSON 예시는 `undefined` 필드 생략, 5필드 (`config`/`output`/`meta?`/`port?`/`status?`) 외 top-level 키 금지.
>
> Carousel 은 ① 비-블로킹 단일(§5.1) ② Waiting (Static §5.4-A / Dynamic §5.4-B) ③ Resumed (글로벌 §5.5-A / per-item §5.5-B / link continue §5.5-C) 케이스로 구성된다. config 검증 실패는 §3 pre-flight throw (Principle 3.1).

### 5.1 Case: 비-블로킹 단일 (버튼 미설정 시)

```json
{
  "config": {
    "mode": "dynamic",
    "layout": "card",
    "source": "{{ $input.items }}",
    "titleField": "name",
    "descriptionField": "summary",
    "imageField": "thumb",
    "maxItems": 10
  },
  "output": {
    "items": [
      { "title": "Alpha", "description": "First", "image": "http://a.png" },
      { "title": "Beta",  "description": "Second", "image": "http://b.png" }
    ]
  },
  "meta": { "durationMs": 0 }
}
```

| 필드 | 타입 | 출처 | 설명 |
|------|------|------|------|
| `config.mode` | `'static'` / `'dynamic'` | config echo (Principle 7) | 사용자가 설정한 모드. 미지정 시 `'dynamic'` |
| `config.layout` | `'card'` / `'image'` / `'minimal'` | config echo | 카드 레이아웃 (default `card`) |
| `config.source` | String (raw) | config echo | dynamic 모드의 표현식 (raw `{{ }}` 보존) |
| `config.titleField` / `descriptionField` / `imageField` | String | config echo | 매핑 필드 경로 (dynamic 전용) |
| `config.items` | ItemDef[] | config echo | static 모드의 슬라이드 정의 |
| `output.items` | Array | runtime — `source` resolve + field 매핑 (dynamic 전용) | dynamic 모드의 런타임 매핑 결과. 1MB cap 적용 (§4). **static 모드는 본 필드를 surface 하지 않는다** — 슬라이드는 `config.items` 참조 (Principle 1.1) |
| `meta.durationMs` | number | engine inject | 실행 시간 (ms) |
| `port` | `undefined` | — | 단일 출력 (`out`) — `port` 미설정 (Principle 5) |

> static 모드의 비-블로킹 케이스에서는 `output: {}` (cap 발동 시 `{ itemsTruncated, itemsTotalCount }`) — 슬라이드는 모두 `config.items` 에서 읽는다 (Principle 1.1).

**Expression 접근 예** (dynamic):
- `$node["C"].output.items[0].title` → `"Alpha"`
- `$node["C"].config.layout` → `"card"` (리터럴 config)

### 5.4 Case: Waiting (블로킹 모드 진입)

블로킹 진입 시 `status: 'waiting_for_input'` + `meta.interactionType: 'buttons'`. `output` 은 모드별로 분기된다 (CONVENTIONS Principle 4.3 / 1.1).

#### 5.4-A. Static 모드

```json
{
  "config": {
    "mode": "static",
    "layout": "card",
    "items": [
      {
        "title": "Item A",
        "description": "Desc A",
        "image": "http://a.png",
        "buttons": [ { "id": "act", "label": "Select", "type": "port", "style": "primary" } ]
      },
      { "title": "Item B", "description": "Desc B", "image": "http://b.png" }
    ],
    "buttons": [
      { "id": "approve", "label": "Approve", "type": "port", "style": "primary" },
      { "id": "reject",  "label": "Reject",  "type": "port", "style": "danger"  }
    ],
    "buttonConfig": {
      "buttons": [
        { "id": "approve", "label": "Approve", "type": "port", "style": "primary" },
        { "id": "reject",  "label": "Reject",  "type": "port", "style": "danger" },
        { "id": "act__item_0", "label": "Select", "type": "port", "style": "primary" }
      ],
      "buttonItemMap": { "act__item_0": 0 }
    }
  },
  "output": {},
  "meta": { "durationMs": 0, "interactionType": "buttons" },
  "status": "waiting_for_input"
}
```

| 필드 | 타입 | 출처 | 설명 |
|------|------|------|------|
| `config.items` | ItemDef[] | config echo | 사용자가 정의한 정적 슬라이드 (리터럴) — 후속 노드는 `$node["C"].config.items` 로 접근 (Principle 1.1) |
| `config.buttons` | ButtonDef[] | config echo | 글로벌 버튼 정의 (raw — `label`/`url` 의 `{{ }}` 보존) |
| `config.buttonConfig.buttons` | ButtonDef[] | runtime — 글로벌 + per-item 합산 | 핸들러가 생성한 통합 버튼 목록. per-item 은 `<btn.id>__item_<idx>` 런타임 ID |
| `config.buttonConfig.buttonItemMap` | `Record<string, number>?` | runtime | per-item 런타임 ID → cap 적용된 `items` 인덱스 매핑. 매핑이 비어있으면 생략 |
| `output` | `{}` | — | static 모드는 런타임 계산값 없음 (Principle 1.1 / 4.3). 슬라이드는 `config.items` 참조 |
| `meta.durationMs` | number | engine inject | |
| `meta.interactionType` | `'buttons'` | handler return | UI 인터랙션 종류 식별자 (공통 §3) |
| `status` | `'waiting_for_input'` | handler return | 블로킹 진입 |

#### 5.4-B. Dynamic 모드

```json
{
  "config": {
    "mode": "dynamic",
    "layout": "card",
    "source": "{{ $node[\"Fetch\"].output.response.items }}",
    "titleField": "name",
    "descriptionField": "desc",
    "imageField": "img",
    "maxItems": 10,
    "itemButtons": [ { "id": "act", "label": "Select", "type": "port" } ],
    "buttons": [ { "id": "approve", "label": "Approve", "type": "port" } ],
    "buttonConfig": {
      "buttons": [
        { "id": "approve", "label": "Approve", "type": "port" },
        { "id": "act__item_0", "label": "Select", "type": "port" },
        { "id": "act__item_1", "label": "Select", "type": "port" }
      ],
      "buttonItemMap": { "act__item_0": 0, "act__item_1": 1 }
    }
  },
  "output": {
    "items": [
      { "title": "Alpha", "description": "First",  "image": "http://a.png" },
      { "title": "Beta",  "description": "Second", "image": "http://b.png" }
    ]
  },
  "meta": { "durationMs": 42, "interactionType": "buttons" },
  "status": "waiting_for_input"
}
```

| 필드 | 타입 | 출처 | 설명 |
|------|------|------|------|
| `config.source` / `titleField` / `descriptionField` / `imageField` / `itemButtons` | (§1) | config echo | dynamic 모드 raw 설정 |
| `config.buttonConfig` | object | runtime | §5.4-A 와 동일 — 글로벌 + 아이템 버튼 합산 + 매핑 |
| `output.items` | Array | runtime — `source` resolve + field 매핑 + maxItems / cap 적용 | dynamic 모드 런타임 생성값 (Principle 4.3). `config.items` 와 독립 |
| `output.itemsTruncated` | `true?` | runtime | 1MB cap 으로 tail element 가 잘렸을 때만 surface (공통 §4) |
| `output.itemsTotalCount` | number? | runtime | cap 적용 전 원본 element 개수 |
| `meta.durationMs` / `meta.interactionType` | (§5.4-A) | | |
| `status` | `'waiting_for_input'` | | |

**Expression 접근 예** (dynamic, waiting):
- `$node["C"].output.items[0].title` → `"Alpha"` (런타임 매핑 결과)
- `$node["C"].config.layout` → `"card"` (리터럴 config)
- `$node["C"].status` → `"waiting_for_input"`

### 5.5 Case: Resumed (버튼 클릭 / Continue 후)

CONVENTIONS Principle 4.4 / 4.5 — Waiting 시점의 `output` 을 immutable snapshot 으로 유지하고 `output.interaction` 을 추가. `status: 'resumed'`, `port` 는 클릭된 버튼의 base ID (per-item 의 경우 suffix 제거) 또는 `'continue'`.

#### 5.5-A. 글로벌 port 버튼 클릭

```json
{
  "config": {
    "mode": "static",
    "layout": "card",
    "items": [ /* §5.4-A 와 동일 */ ],
    "buttons": [ { "id": "approve", "label": "Approve", "type": "port" } ],
    "buttonConfig": { /* §5.4-A 와 동일 */ }
  },
  "output": {
    "interaction": {
      "type": "button_click",
      "data": {
        "buttonId": "approve",
        "buttonLabel": "Approve"
      },
      "receivedAt": "2026-04-19T12:34:56.000Z"
    }
  },
  "meta": { "durationMs": 12340, "interactionType": "buttons" },
  "port": "approve",
  "status": "resumed"
}
```

| 필드 | 타입 | 출처 | 설명 |
|------|------|------|------|
| `output.interaction.type` | `'button_click'` | engine inject (resume) | 인터랙션 종류 (공통 §4.2 / Principle 4.5) |
| `output.interaction.data.buttonId` | String | engine | 클릭된 버튼의 base ID (per-item suffix 제거 후) |
| `output.interaction.data.buttonLabel` | String | engine | 버튼 라벨 (`{{ }}` resolve 후) |
| `output.interaction.receivedAt` | ISO8601 | engine | 클릭 시각 |
| `port` | String | engine | 클릭된 버튼의 base ID (= `interaction.data.buttonId`) |
| `status` | `'resumed'` | engine | Principle 4.1 통일 상태 |

> dynamic 모드의 글로벌 버튼 클릭 시에는 §5.4-B 의 `output.items` 가 그대로 유지되고 `interaction` 만 추가된다 (immutable snapshot, Principle 4.4).

#### 5.5-B. Per-item port 버튼 클릭

```json
{
  "output": {
    "items": [
      { "title": "Alpha", "description": "First",  "image": "http://a.png" },
      { "title": "Beta",  "description": "Second", "image": "http://b.png" }
    ],
    "interaction": {
      "type": "button_click",
      "data": {
        "buttonId": "act",
        "buttonLabel": "Select",
        "selectedItem": { "title": "Alpha", "description": "First", "image": "http://a.png" }
      },
      "receivedAt": "2026-04-19T12:34:56.000Z"
    }
  },
  "meta": { "durationMs": 9876, "interactionType": "buttons" },
  "port": "act",
  "status": "resumed"
}
```

| 필드 | 타입 | 출처 | 설명 |
|------|------|------|------|
| `output.items` | Array (dynamic) | Waiting snapshot | dynamic 모드일 때만 surface — static 은 `output: { interaction }` 만 (`items` 는 `config.items` 참조) |
| `output.interaction.data.selectedItem` | object | engine | 클릭된 per-item 의 슬라이드 데이터 (Principle 4.5). dynamic 모드는 `output.items[idx]` 와 동치, static 모드는 `config.items[idx]` 와 동치 |
| `port` | String | engine | per-item 버튼의 **base ID** — 런타임 `<btn.id>__item_<idx>` 에서 suffix 제거 (Principle 6) |
| 그 외 필드 | (§5.5-A) | | |

> per-item 버튼 라우팅: 엔진이 `__item_\d+$` 패턴을 분리해 워크플로우 edge 의 source port 인 base ID(`act`) 로 라우팅한다. 사용자가 정의한 `button.id` 에 `__item_` 포함은 schema 레벨에서 reject (carousel.schema.ts §validateCarouselItemButtons).

#### 5.5-C. Link 타입 Continue 클릭

link 타입 버튼만 존재할 때 자동 생성된 `continue` 포트가 활성화된다.

```json
{
  "output": {
    "interaction": {
      "type": "button_continue",
      "data": {
        "buttonId": "more",
        "buttonLabel": "More Info",
        "url": "https://docs.example.com/more"
      },
      "receivedAt": "2026-04-19T12:34:56.000Z"
    }
  },
  "meta": { "durationMs": 5432, "interactionType": "buttons" },
  "port": "continue",
  "status": "resumed"
}
```

| 필드 | 타입 | 출처 | 설명 |
|------|------|------|------|
| `output.interaction.type` | `'button_continue'` | engine | link 전용 시 Continue 클릭 (공통 §4.2) |
| `output.interaction.data.url` | String | engine | resolve 된 외부 URL (Principle 4.5) |
| `port` | `'continue'` | engine | link 전용 자동 포트 |

**Expression 접근 예**:
- `$node["C"].port` → `"approve"` / `"act"` / `"continue"`
- `$node["C"].output.interaction.type` → `"button_click"` / `"button_continue"`
- `$node["C"].output.interaction.data.selectedItem.title` → per-item 클릭 시 슬라이드 제목
- `$node["C"].config.items[0].title` → static 슬라이드 제목 (Waiting 시점과 동일)

## 6. 버튼 설정 UI

기존 설정 UI 하단에 접이식(collapsible) "Buttons" 섹션을 추가한다:

```
┌──────────────────────────────────────┐
│  ... (기존 Carousel Settings)        │
│                                      │
│  ▶ Buttons ─────────────────────     │
│  ┌ Button 1 ──────────── [✕] [↕]   │
│  │ Label: [승인____________]        │
│  │ Type:  [port ▼]                  │
│  │ Style: [primary ▼]               │
│  └────────────────────────────────   │
│  ┌ Button 2 ──────────── [✕] [↕]   │
│  │ Label: [상세 보기________]       │
│  │ Type:  [link ▼]                  │
│  │ URL:   [{{ $input.url }}____]    │
│  │ Style: [outline ▼]               │
│  └────────────────────────────────   │
│  [+ Add Button]                      │
└──────────────────────────────────────┘
```

- 버튼 카드: 드래그 순서 변경 (`[↕]`), 삭제 (`[✕]`)
- Type=link 선택 시 URL 입력 필드 표시, Type=port 선택 시 URL 숨김
- 버튼 추가 시 UUID v4 자동 할당 (ID 불변)
- 최대 5개 버튼 (글로벌, [공통 §1.1](./0-common.md#11-유효성-검증)). per-item 도 ItemDef 당 최대 5개 (static), `itemButtons` 도 최대 5개 (dynamic) — 한 아이템에서 최대 globalButtons 5 + itemButtons 5 = 10개 가시
- 버튼 클릭 시까지 무제한 대기 (외부 cancel/종료 외에는 타임아웃 없음)

## 7. 에러 코드

Carousel 은 **runtime 에러 포트를 갖지 않는다**. 모든 검증 실패는 pre-flight (config 검증) 단계에서 throw 된다 (Principle 3.1):

| 발생 조건 | 메시지 | 시점 |
|-----------|--------|------|
| dynamic 모드인데 `titleField` 누락 | `Dynamic 모드에서는 Title 필드를 입력해야 합니다.` | warningRule (캔버스 배지) + handler.validate |
| static 모드인데 `items` 빈 배열 | `Static 모드에서는 최소 1개 이상의 슬라이드를 추가해야 합니다.` | warningRule |
| `mode` 가 `static` / `dynamic` 외 | `Mode 는 static 또는 dynamic 이어야 합니다.` | warningRule |
| static 모드 `items` 가 배열 아님 | `items must be an array in static mode` | handler.validate |
| dynamic 모드 `titleField` 가 string 아님 | `titleField is required and must be a string` | handler.validate |
| static `items[i].title` 누락 | `items[i].title is required and must be a string` | validateConfig |
| per-item 버튼 ≥6개 | `items[i]: maximum 5 buttons per item` (static) / `itemButtons: maximum 5 buttons per item` (dynamic) | validateConfig |
| per-item `button.id` 에 `__item_` 포함 | `items[i].buttons[j].id must not contain reserved separator "__item_"` | validateConfig |
| per-item `button.id` 중복 | `items[i].buttons[j].id must be unique (duplicate: …)` | validateConfig |
| port 타입 버튼에 `url` 설정 | `…buttons[j].url is not allowed for port type buttons` | validateConfig |
| link 타입 버튼 `url` 누락 / 위험 스킴 | `…buttons[j].url is required for link type buttons` / `…contains a disallowed URL scheme` | validateConfig |
| 글로벌 `buttons` 위반 | (공통 [§1.1 유효성 검증](./0-common.md#11-유효성-검증)) | `validateButtons` (공유) |

## 8. 캔버스 요약

[공통 §5](./0-common.md#5-캔버스-요약) — `Carousel (버튼 없음)` / `Carousel (버튼 있음)` 행 인용.
