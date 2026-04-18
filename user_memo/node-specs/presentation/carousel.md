# Carousel (`carousel`)

> 슬라이드(아이템) 목록을 표시하는 노드. 정적(static) 또는 동적(dynamic, input 배열로부터)으로 항목을 채우며, 버튼을 통해 사용자 선택을 받습니다 (있으면 blocking).

- **카테고리**: `presentation`
- **컨테이너**: no
- **Blocking**: yes (버튼이 있을 때만, `status: "waiting_for_input"`)
- **동적 포트**: yes (`presentation-buttons`)

## Config 파라메터

### 공통

| 필드명 | 타입 | 필수 | 기본값 | 설명 | 표현식 |
| --- | --- | --- | --- | --- | --- |
| `mode` | `'static' \| 'dynamic'` | no | `'dynamic'` | 항목 정의 방식 | no |
| `layout` | `'card' \| 'image' \| 'minimal'` | no | `'card'` | 슬라이드 레이아웃 | no |
| `buttons` | `Button[]` | no | `[]` | 글로벌 버튼 (모든 슬라이드 공통) | (label/url 내부) |

### `mode: 'static'`

| 필드명 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `items` | `Item[]` | yes (1개 이상) | 정적 항목 목록 |

`Item`: `{ title, description?, image?, buttons? }`

### `mode: 'dynamic'`

| 필드명 | 타입 | 필수 | 설명 | 표현식 |
| --- | --- | --- | --- | --- |
| `source` | string (expression) | no | 항목 배열을 반환하는 expression. 미지정 시 input 사용 | yes |
| `titleField` | string | yes | 각 항목에서 title을 뽑을 필드명 | (자체 expression) |
| `descriptionField` | string | no | description 필드명 | (자체 expression) |
| `imageField` | string | no | image URL 필드명 | (자체 expression) |
| `maxItems` | int (1~100) | no (`10`) | 최대 표시 개수 | no |
| `itemButtons` | `Button[]` | no | 모든 dynamic 아이템에 공통 적용되는 버튼 (각 아이템마다 `__item_<i>` suffix로 고유화) | (label/url) |

`Button`:

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `id` | string | 포트 ID (`__item_` 문자열은 예약어) |
| `label` | string (expression) | 버튼 라벨 |
| `type` | `'link' \| 'port'` | link면 URL로 이동, port면 워크플로우 분기 |
| `url` | string (expression) | (link만) 이동할 URL. `javascript:`, `data:`, `vbscript:` 스키마 차단 |
| `style` | `'primary' \| 'secondary' \| 'outline' \| 'danger'` | 시각 스타일 |

## Ports

| 방향 | id | label | 설명 |
| --- | --- | --- | --- |
| Input | `in` | Input | (dynamic 모드에서 source 미지정 시 사용) |
| Output | `out` | Output | (버튼 없거나 모두 link만 있을 때) 즉시 통과 |
| Output | `<button.id>` | (button.label) | **동적** — 클릭된 port-type 버튼의 id로 라우팅 |
| Output | `<button.id>__item_<index>` | | (dynamic + itemButtons) 각 아이템별 고유 포트 |
| Output | `continue` | Continue | 모든 버튼이 link만이고 따로 분기가 필요 없을 때 |

> **동적 포트 생성 규칙** (`presentation-buttons`, `resolve-dynamic-ports.ts`):
>
> - static 모드: 각 `items[].buttons[]`(type='port')마다 포트 (그룹: item title)
> - dynamic 모드: `itemButtons[]`(type='port')마다 포트 (그룹: "Item")
> - 글로벌 `buttons[]`(type='port')도 포함
> - 포트가 하나도 없고 link만 있으면 `continue` 단일 포트 (또는 정적 outputs fallback)

## Output

### Case 1: 버튼 없음 (즉시 진행)

```json
{
  "config": { "layout": "card", "mode": "static" },
  "output": {
    "type": "carousel",
    "items": [
      { "title": "Item 1", "description": "...", "image": "..." },
      { "title": "Item 2", "description": "..." }
    ],
    "layout": "card",
    "rendered": "<div class=\"carousel ...\">...</div>"
  }
}
```

### Case 2: 버튼 있음 → 사용자 선택 대기

```json
{
  "config": {
    "layout": "card",
    "mode": "dynamic",
    "buttonConfig": {
      "buttons": [
        { "id": "btn_yes", "label": "Yes", "type": "port" },
        { "id": "btn_no", "label": "No", "type": "port" }
      ]
    }
  },
  "output": {
    "type": "carousel",
    "items": [...],
    "layout": "card",
    "rendered": "..."
  },
  "status": "waiting_for_input",
  "meta": { "interactionType": "buttons" }
}
```

엔진이 사용자의 버튼 선택을 받으면 `port`를 채우고 흐름 진행 (사용자 선택 후 후속 노드 input은 엔진 구현에 따름).

### Case 3: dynamic 모드 + itemButtons (아이템별 버튼)

```json
{
  "config": {
    "buttonConfig": {
      "buttons": [
        { "id": "select__item_0", ... },
        { "id": "select__item_1", ... }
      ],
      "buttonItemMap": { "select__item_0": 0, "select__item_1": 1 }
    }
  },
  "output": { "type": "carousel", "items": [...], ... },
  "status": "waiting_for_input",
  "meta": { "interactionType": "buttons" }
}
```

`buttonItemMap`은 어떤 버튼이 어느 아이템에 속하는지 매핑.

| 필드 | 설명 |
| --- | --- |
| `output.type` | 항상 `"carousel"` (UI 마커) |
| `output.items` | 정규화된 슬라이드 배열 (`{title, description, image?, buttons?}`) |
| `output.layout` | 사용된 레이아웃 |
| `output.rendered` | 미리 렌더링된 HTML (XSS 안전 escape 적용) |
| `config.buttonConfig.buttons` | 모든 버튼 합산 (글로벌 + 아이템별) |
| `config.buttonConfig.buttonItemMap` | 아이템별 버튼의 인덱스 매핑 |
| `status` | 버튼 있을 때 `"waiting_for_input"` |
| `meta.interactionType` | `"buttons"` (UI 마커) |
| `port` (제출 후) | 클릭된 버튼의 id |

## 변수로 접근 가능한 항목

이 노드의 라벨이 `Choose`라고 가정.

### 사용자 선택 후:

| 표현식 | 값 예시 | 설명 |
| --- | --- | --- |
| `{{ $node["Choose"].port }}` | `"btn_yes"` 또는 `"select__item_2"` | 클릭된 버튼 ID |
| `{{ $node["Choose"].output.items }}` | `[{title: "Item 1", ...}]` | 표시된 항목들 |
| `{{ $node["Choose"].output.items[0].title }}` | `"Item 1"` | 첫 슬라이드 |
| `{{ $node["Choose"].config.buttonConfig.buttonItemMap }}` | `{ "select__item_0": 0 }` | 버튼-아이템 매핑 |

### 버튼 없는 경우:

| 표현식 | 값 예시 | 설명 |
| --- | --- | --- |
| `{{ $node["Choose"].output.items }}` | `[...]` | 표시된 항목 |
| (status, port 없음) | | |

## 주의사항

- 버튼이 한 개라도 있으면 noid blocking (`waiting_for_input`).
- 글로벌 + 아이템별 버튼이 같이 있으면 모두 합쳐 `config.buttonConfig.buttons`에 노출.
- dynamic 모드에서 `itemButtons` 사용 시 각 아이템마다 `<button.id>__item_<index>` 형태로 ID가 고유화됩니다 — 후속 노드는 이 ID 패턴으로 어떤 아이템이 선택됐는지 구분.
- static 모드에서는 `items[].buttons[].id`가 그대로 포트 ID. 같은 워크플로우 내 모든 아이템 통틀어 unique해야 함 (`__item_` 문자열은 예약어).
- 각 아이템당 버튼 최대 4개 제한.
- `link` 타입 버튼의 URL: `javascript:`, `data:`, `vbscript:` 스키마는 차단 (XSS 방지).
- `output.rendered` HTML은 escape 처리되어 안전 (& < > " ' 처리).
- `image` URL이 `javascript:` 같으면 비워짐.
