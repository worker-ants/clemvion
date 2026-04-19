# Carousel (`carousel`)

> 아이템 리스트를 슬라이드 카드로 렌더링하고, 선택적으로 버튼을 통해 사용자 입력을 받는 presentation 노드.

- **카테고리**: `presentation`
- **컨테이너**: no
- **Blocking**: **조건부 yes** — `config.buttons` 또는 item-level 버튼이 하나라도 있으면 `status: "waiting_for_input"` 반환
- **동적 포트**: **yes** (`dynamicPorts.kind = "presentation-buttons"`, `supportsItems: true`, `supportsItemButtons: true`, `continueId: "continue"`)

## Config 파라메터

출처: `backend/src/nodes/presentation/carousel/carousel.schema.ts`

| 필드명 | 타입 | 필수 | 기본값 | 설명 | 표현식 |
| --- | --- | --- | --- | --- | --- |
| `mode` | `'static' \| 'dynamic'` | no | `'dynamic'` | 아이템 소스 모드 | — |
| `items` | `CarouselItem[]` | static 모드에서 1개 이상 | `[]` | static 모드 전용 아이템 배열 | 항목 내부 필드는 expression |
| `source` | string | no | (없음) | dynamic 모드 데이터 소스 (expression — 엔진이 해석 후 배열로 전달) | yes |
| `titleField` | string | dynamic 모드 필수 | (없음) | dynamic 모드에서 아이템 title로 쓸 필드 경로 | yes |
| `descriptionField` | string | no | (없음) | dynamic 모드 description 필드 | yes |
| `imageField` | string | no | (없음) | dynamic 모드 image URL 필드 | yes |
| `maxItems` | number (1~100) | no | `10` | dynamic 모드 최대 아이템 수 | — |
| `itemButtons` | `ButtonDef[]` | no | `[]` | dynamic 모드 — 모든 아이템에 공통 적용되는 per-item 버튼 템플릿 | — |
| `layout` | `'card' \| 'image' \| 'minimal'` | no | `'card'` | 렌더링 레이아웃 | — |
| `buttons` | `ButtonDef[]` | no | `[]` | 전역(carousel 하단) 버튼 | — |

`CarouselItem` (static 모드):

| 필드 | 타입 | 기본값 | 설명 | 표현식 |
| --- | --- | --- | --- | --- |
| `title` | string | `''` | 슬라이드 제목 (static 모드 필수) | yes |
| `description` | string | — | 슬라이드 설명 | yes |
| `image` | string | — | 이미지 URL (`javascript:`는 sanitize되어 빈 문자열) | yes |
| `buttons` | `ButtonDef[]` | `[]` | 해당 item에만 붙는 per-item 버튼 (item당 최대 4개) | — |

`ButtonDef`:

| 필드 | 타입 | 기본값 | 설명 |
| --- | --- | --- | --- |
| `id` | string | — | 버튼 ID (global: unique, per-item: item 내 unique, `__item_` 포함 금지) |
| `label` | string | `''` | 버튼 표시 텍스트 (expression 지원) |
| `type` | `'link' \| 'port'` | `'port'` | `port`면 동적 출력 포트 생성, `link`면 URL 이동 |
| `url` | string | — | `type === 'link'`일 때 필수 (expression 지원, `javascript:`/`data:`/`vbscript:` 스킴 차단) |
| `style` | `'primary' \| 'secondary' \| 'outline' \| 'danger'` | `'secondary'` | UI 스타일 |

## Ports

| 방향 | id | label | 타입 | 설명 |
| --- | --- | --- | --- | --- |
| Input | `in` | Input | data | dynamic 모드에서 `source` 미설정 시 fallback으로 사용 |
| Output (static) | `out` | Output | data | 버튼이 전혀 없을 때 (정적 fallback) |

### 동적 포트 생성 규칙

출처: `frontend/src/lib/node-definitions/resolve-dynamic-ports.ts` → `presentationButtonPorts()`

1. **static 모드 only**: `config.items[*].buttons[]` 중 `type === 'port'`인 버튼마다 포트 추가 (group = `item.title || "Item"`)
2. `config.itemButtons[]` 중 `type === 'port'`인 버튼마다 포트 추가 (group = `"Item"`, dynamic 모드에서 주로 사용)
3. `config.buttons[]` (global) 중 `type === 'port'`인 버튼마다 포트 추가 (group 없음)
4. 위 1~3으로 생성된 포트가 1개라도 있으면 그것을 반환
5. 하나도 없고 `link` 타입 버튼이 하나라도 존재 → `{ id: "continue", label: "Continue", type: "data" }` 단일 포트
6. 버튼 자체가 아예 없으면 정적 `outputs` (`out`)만 노출

> **주의**: dynamic 모드의 per-item port 버튼은 프론트엔드 포트 해석에선 하나의 포트로만 나타나지만, 핸들러가 런타임에 `__item_{idx}` 접미사를 붙여 ID 충돌을 방지합니다. 엔진은 click 시 접미사를 제거하고 base ID로 라우팅합니다.

## Input

- **static 모드**: input 무시, `config.items`를 그대로 사용.
- **dynamic 모드**: `config.source`가 있으면 우선 사용 (expression은 엔진이 먼저 해석해 배열로 전달), 없으면 `input`을 사용. 배열이 아니면 `[value]`로 래핑, `null`/`undefined`는 빈 배열. 이후 `maxItems`로 슬라이스.

dynamic 매핑 (per item):

```
items[i] = {
  title: toStr(sourceItem[titleField]),
  description: descriptionField ? toStr(sourceItem[descriptionField]) : '',
  image: imageField ? sanitize(toStr(sourceItem[imageField])) : undefined,
  buttons: itemButtons?.map(b => ({ ...b, id: `${b.id}__item_${i}` })),
}
```

## Output

### Case 1: 버튼 없음 — non-blocking

```json
{
  "config": { "layout": "card", "mode": "dynamic" },
  "output": {
    "type": "carousel",
    "items": [
      { "title": "Item A", "description": "Desc A", "image": "http://a.png" }
    ],
    "layout": "card",
    "rendered": "<div class=\"carousel carousel-card\">…</div>"
  }
}
```

### Case 2: 버튼 있음 — 초기 실행 (waiting_for_input)

```json
{
  "config": {
    "layout": "card",
    "mode": "dynamic",
    "buttonConfig": {
      "buttons": [
        { "id": "approve", "label": "Approve", "type": "port", "style": "primary" },
        { "id": "reject", "label": "Reject", "type": "port", "style": "danger" },
        { "id": "act__item_0", "label": "Select", "type": "port" }
      ],
      "buttonItemMap": { "act__item_0": 0 }
    }
  },
  "output": {
    "type": "carousel",
    "items": [ /* title/description/image/buttons */ ],
    "layout": "card",
    "rendered": "<div …>…</div>"
  },
  "status": "waiting_for_input",
  "meta": { "interactionType": "buttons" }
}
```

- `buttonConfig.buttons`는 global + per-item 버튼을 모두 flatten한 배열.
- `buttonConfig.buttonItemMap`은 per-item 버튼 ID → item 인덱스 매핑 (per-item 버튼 존재 시에만 포함).

### Case 3: 사용자 버튼 클릭 후 (엔진이 structured output 덮어씀)

출처: `execution-engine.service.ts` button click resume

**port 타입 버튼 클릭 시:**

```json
{
  "config": { "layout": "card", "mode": "dynamic", "buttonConfig": { … } },
  "output": {
    "interaction": {
      "interactionType": "button_click",
      "buttonId": "approve",
      "buttonLabel": "Approve",
      "clickedAt": "2026-04-19T12:34:56.000Z"
    },
    "selectedItem": { "title": "Item A", "description": "Desc A", "image": "…" },
    "previousOutput": { "type": "carousel", "items": [ … ], "layout": "card", "rendered": "…" }
  },
  "port": "approve",
  "status": "button_click",
  "meta": { "interactionType": "buttons" }
}
```

- `selectedItem`은 per-item 버튼(`buttonItemMap`에 매핑이 있는 경우)에만 채워짐.
- `port`는 dynamic item 버튼이 클릭되었을 경우 `__item_{idx}` 접미사가 제거된 base ID.

**link 타입 버튼 클릭 시** (프론트는 URL 이동 후 Continue 신호를 보냄):

```json
{
  "config": { … },
  "output": {
    "interaction": { "interactionType": "button_continue", "clickedAt": "…" },
    "previousOutput": { "type": "carousel", … }
  },
  "port": "continue",
  "status": "button_continue",
  "meta": { "interactionType": "buttons" }
}
```

## 변수로 접근 가능한 항목

이 노드의 라벨이 `Approval Carousel`이라고 가정.

### 버튼 없는 모드 (일반 흐름):

| 표현식 | 값 | 설명 |
| --- | --- | --- |
| `{{ $node["Approval Carousel"].output.items }}` | `[{title,description,image}, …]` | 렌더된 아이템 배열 |
| `{{ $node["Approval Carousel"].output.layout }}` | `"card"` | 레이아웃 |
| `{{ $node["Approval Carousel"].output.rendered }}` | `"<div …>…</div>"` | 렌더된 HTML |
| `{{ $node["Approval Carousel"].config.mode }}` | `"dynamic"` | 모드 |

### 버튼 모드 — 클릭 후 (AFTER 사용자 상호작용):

| 표현식 | 값 예시 | 설명 |
| --- | --- | --- |
| `{{ $node["Approval Carousel"].output.interaction.buttonId }}` | `"approve"` | 클릭된 버튼 ID (port 타입만; link는 없음) |
| `{{ $node["Approval Carousel"].output.interaction.buttonLabel }}` | `"Approve"` | 클릭된 버튼 라벨 |
| `{{ $node["Approval Carousel"].output.interaction.interactionType }}` | `"button_click"` \| `"button_continue"` | 상호작용 종류 |
| `{{ $node["Approval Carousel"].output.interaction.clickedAt }}` | `"2026-04-19T…"` | 클릭 시각 |
| `{{ $node["Approval Carousel"].output.selectedItem }}` | `{title,description,image}` | per-item 버튼 클릭 시 해당 아이템 |
| `{{ $node["Approval Carousel"].output.previousOutput.items }}` | `[ … ]` | 대기 시점의 원본 carousel payload |
| `{{ $node["Approval Carousel"].port }}` | `"approve"` \| `"continue"` | 활성화된 포트 ID |
| `{{ $node["Approval Carousel"].status }}` | `"button_click"` \| `"button_continue"` | 상태 |
| `{{ $node["Approval Carousel"].config.buttonConfig.buttons }}` | `[ … ]` | 전체 버튼 목록 (per-item flatten 포함) |

> 버튼 모드에서 **대기 중**에는 `output.interaction`이 아직 없고, `output`은 원본 carousel payload 형태입니다 (Case 2 참조).

## 주의사항

- **Blocking 조건**: global `buttons` + dynamic `itemButtons` + static item `buttons` 중 하나라도 결과적으로 1개 이상 만들어지면 waiting_for_input 반환. 전부 비어있으면 non-blocking.
- **Blocking 모드에서는 컨테이너 본문 내부에 배치 금지** (Loop/ForEach/Map/Parallel 등).
- `button.id`에 **`__item_` 포함 금지** (예약 separator — per-item 네이밍과 충돌).
- Per-item 버튼은 **item당 최대 4개**, global 버튼은 **총 10개** 제한.
- `link` 타입 버튼의 `url`은 `javascript:` / `data:` / `vbscript:` 스킴 차단. `image` 필드도 동일 sanitize.
- dynamic 모드에서 `source`는 expression이 이미 해석된 배열로 핸들러에 도달 (핸들러 내부에서 재해석하지 않음).
- `mode` 스위치 시 `items`/`itemButtons` 데이터는 **보존됨** (schema UI의 clearFields에 포함 안 됨 — 사용자 데이터 유실 방지; `carousel.schema.spec.ts`의 regression 테스트가 이를 보장).
- HTML `rendered` 문자열의 모든 텍스트/URL은 HTML escape 처리됨 (XSS 방지).
