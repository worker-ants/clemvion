---
id: "CLE-NODE-CAROUSEL-OUTPUT"
title: "Carousel 노드 — 출력 구조"
type: "design"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-NODE-CAROUSEL"
ancestors: ["CLE-VISION", "CLE-NODE", "CLE-NODE-PRES", "CLE-NODE-CAROUSEL"]
area: "CLE-NODE-PRES"
content_hash: "95a4654e8fa8eb5329fb71654a743c91b98d66ae21ef2764a6e9bfc3987f3e6c"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: ["spec/4-nodes/6-presentation/1-carousel.md"]
mirror_sha256: "afa1ac1c28d177c0452dfcb984b348e3777a44d3d0ed136cacf100e276bbfb2c"
etag: "sha256-955fdbfec8d7830698b082215561fb897c8bd8dd89d74216d055b540b6483181"
---
> 구현 상태: 구현됨 · 원문: `spec/4-nodes/6-presentation/1-carousel.md` · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

이 문서는 [Carousel 노드](CLE-NODE-CAROUSEL.md) 의 하위 문서로 노드 출력 구조(표시 전용 · 입력 대기 · 재개)와 필드별 출처 · 표현식 접근 예를 정한다. 설정 · 포트 · 실행 로직 · 에러 코드는 부모 문서가 정한다.

JSON 예시는 `undefined` 필드를 생략한다. 노드 출력의 다섯 필드(`config`·`output`·`meta?`·`port?`·`status?`) 밖의 최상위 키는 쓰지 않는다. 경우는 표시 전용, 입력 대기(정적·동적 모드), 재개(전역 버튼·항목 버튼·Continue)로 나뉜다. 설정 검증 실패는 실행 전 검증에서 던진다.

## 표시 전용(버튼 없음)

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
  }
}
```

표시 전용 핸들러는 `{ config, output }` 만 돌려준다(`carousel.handler.ts`). `meta.durationMs` 는 엔진이 넣는다. 아래 표에서 `?` 가 붙은 설정 에코 키는 핸들러가 기본값을 채우지 않고 저장된 값을 그대로 싣는다. 미설정이면 값이 `undefined` 라 JSON 에서 빠진다.

| 필드 | 타입 | 출처 | 설명 |
|------|------|------|------|
| `config.mode` | `'static'` / `'dynamic'` | 설정 에코 | 사용자가 정한 모드. 설정하지 않았으면 핸들러가 `dynamic` 을 채운다 |
| `config.layout` | `'card'` / `'image'` / `'minimal'` | 설정 에코 | 카드 레이아웃. 설정하지 않았으면 핸들러가 `card` 를 채운다 |
| `config.source?` | String(원문) | 설정 에코 | 동적 모드 표현식. `{{ }}` 원문을 보존한다. 미설정이면 입력 포트 데이터를 쓴다 |
| `config.titleField?` / `config.descriptionField?` / `config.imageField?` | String | 설정 에코 | 매핑 필드 경로(동적 모드 전용). 미설정이면 슬라이드의 그 칸이 빈다 |
| `config.items?` | ItemDef[] | 설정 에코 | 정적 모드 슬라이드 정의. 미설정이면 슬라이드가 없을 때와 같다(동적 모드에서는 쓰지 않는다) |
| `config.maxItems?` | number | 설정 에코 | 최대 슬라이드 수(동적 모드 전용). 미설정이면 개수를 자르지 않는다. 출력 크기 한도는 그대로 적용한다 |
| `config.itemButtons?` | ButtonDef[] | 설정 에코 | 동적 모드 항목 공통 버튼 원문. 미설정이면 항목 버튼이 없을 때와 같다. 버튼이 없어 표시 전용으로 끝났으면 이 값은 빈 배열이거나 키가 빠진다 |
| `config.buttons?` | ButtonDef[] | 설정 에코 | 전역 버튼 정의 원문. 미설정이면 전역 버튼이 없을 때와 같다. 버튼이 없어 표시 전용으로 끝났으면 이 값은 빈 배열이거나 키가 빠진다 |
| `output.items` | Array | 런타임(`source` 해석 + 필드 매핑, 동적 모드 전용) | 동적 모드 매핑 결과. 출력 크기 한도를 적용한다. **정적 모드는 이 필드를 싣지 않는다.** 슬라이드는 `config.items` 를 본다 |
| `meta.durationMs` | number | 엔진 주입 | 실행 시간(ms) |
| `port` | `undefined` | 없음 | 단일 출력(`out`). `port` 를 두지 않는다 |

정적 모드의 표시 전용 출력 값은 `{}` 다. 한도가 걸리면 `{ itemsTruncated, itemsTotalCount }` 다.

표현식 접근 예(동적 모드):

- `$node["C"].output.items[0].title` → `"Alpha"`
- `$node["C"].config.layout` → `"card"`(리터럴 설정)

## 입력 대기

블로킹 모드에 들어가면 `status: 'waiting_for_input'` 과 `meta.interactionType: 'buttons'` 를 싣는다. 출력 값은 모드별로 다르다.

**정적 모드:**

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
| `config.items` | ItemDef[] | 설정 에코 | 사용자가 정의한 정적 슬라이드. 다음 노드는 `$node["C"].config.items` 로 읽는다 |
| `config.buttons?` | ButtonDef[] | 설정 에코 | 전역 버튼 정의 원문. `label`·`url` 의 `{{ }}` 를 보존한다. 항목 버튼만으로 입력 대기에 들어왔고 전역 버튼을 설정하지 않았으면 값이 `undefined` 라 JSON 에서 빠진다 |
| `config.*`(이 표에 따로 적지 않은 키) | 표시 전용과 같다 | 설정 에코 | 표시 전용 표의 키를 모두 싣는다. `?` 표기와 미설정 때 동작도 같다 |
| `config.buttonConfig.buttons` | ButtonDef[] | 런타임(전역 + 항목 합산) | 핸들러가 만든 통합 버튼 목록. 항목 버튼은 `<btn.id>__item_<idx>` 런타임 ID 다 |
| `config.buttonConfig.buttonItemMap?` | `Record<string, number>` | 런타임 | 항목 버튼 런타임 ID → 한도 적용 후 `items` 인덱스. 비어 있으면 생략한다 |
| `output` | `{}` | 없음 | 정적 모드는 런타임 계산값이 없다. 슬라이드는 `config.items` 를 본다 |
| `meta.durationMs` | number | 엔진 주입 | |
| `meta.interactionType` | `'buttons'` | 핸들러 반환 | 대기 표면 |
| `status` | `'waiting_for_input'` | 핸들러 반환 | 블로킹 모드 진입 |

**동적 모드:**

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
| `config.*` | 표시 전용과 같다 | 설정 에코 | 표시 전용 표의 키를 모두 싣는다. `?` 표기와 미설정 때 동작도 같다. 동적 모드 설정(`source` · `titleField` · `descriptionField` · `imageField` · `maxItems` · `itemButtons`)은 원문이다 |
| `config.buttonConfig` | object | 런타임 | 정적 모드와 같다. 전역 버튼과 항목 버튼을 합치고 매핑한다 |
| `output.items` | Array | 런타임(`source` 해석 + 필드 매핑 + `maxItems`·한도 적용) | 동적 모드 런타임 값. `config.items` 와 독립이다 |
| `output.itemsTruncated?` | `true` | 런타임 | 한도로 뒤쪽 원소를 잘랐을 때만 싣는다 |
| `output.itemsTotalCount?` | number | 런타임 | 한도 적용 전 원소 수. 한도로 잘랐을 때만 싣는다 |
| `meta.durationMs` / `meta.interactionType` | 정적 모드와 같다 | | |
| `status` | `'waiting_for_input'` | | |

표현식 접근 예(동적 모드, 입력 대기):

- `$node["C"].output.items[0].title` → `"Alpha"`(런타임 매핑 결과)
- `$node["C"].status` → `"waiting_for_input"`

## 재개

입력 대기 시점의 출력 값을 바꾸지 않는 스냅샷으로 두고 `output.interaction` 을 더한다. `status: 'resumed'` 이고 `port` 는 누른 버튼의 원래 ID(항목 버튼은 접미사를 뗀 값)나 `'continue'` 다.

**전역 포트 버튼 클릭:**

```json
{
  "config": {
    "mode": "static",
    "layout": "card",
    "items": [ /* 입력 대기와 같다 */ ],
    "buttons": [ { "id": "approve", "label": "Approve", "type": "port" } ],
    "buttonConfig": { /* 입력 대기와 같다 */ }
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
| `output.interaction.type` | `'button_click'` | 엔진 주입(재개) | 사용자 행동 종류 |
| `output.interaction.data.buttonId` | String | 엔진 | 누른 버튼의 원래 ID(항목 버튼은 접미사를 뗀 값) |
| `output.interaction.data.buttonLabel` | String | 엔진 | 표현식을 해석한 버튼 라벨 |
| `output.interaction.receivedAt` | ISO8601 | 엔진 | 클릭 시각 |
| `port` | String | 엔진 | 누른 버튼의 원래 ID(`interaction.data.buttonId` 와 같다) |
| `status` | `'resumed'` | 엔진 | 재개 상태 |

동적 모드에서 전역 버튼을 누르면 입력 대기의 `output.items` 가 그대로 남고 `interaction` 만 더해진다.

**항목 포트 버튼 클릭:**

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
| `output.items` | Array(동적 모드) | 입력 대기 스냅샷 | 동적 모드일 때만 싣는다. 정적 모드는 `output: { interaction }` 만 있고 슬라이드는 `config.items` 를 본다 |
| `output.interaction.data.selectedItem` | object | 엔진 | 누른 항목의 슬라이드 데이터. 동적 모드는 `output.items[idx]`, 정적 모드는 `config.items[idx]` 와 같다 |
| `port` | String | 엔진 | 항목 버튼의 **원래 ID**. 런타임 `<btn.id>__item_<idx>` 에서 접미사를 뗀다 |
| 그 밖 | 전역 버튼 클릭과 같다 | | |

엔진은 `__item_\d+$` 를 떼어 워크플로우 연결선의 출발 포트인 원래 ID(`act`)로 라우팅한다. 사용자가 정의한 `button.id` 에 `__item_` 이 있으면 스키마 검증(`validateCarouselItemButtons`)에서 거부한다.

**링크 버튼만 있을 때 Continue 클릭:**

링크 버튼만 있으면 자동으로 만든 계속 포트(`continue`)가 켜진다.

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
| `output.interaction.type` | `'button_continue'` | 엔진 | 링크 버튼만 있을 때 Continue 클릭 |
| `output.interaction.data.url` | String | 엔진 | 해석한 외부 URL |
| `port` | `'continue'` | 엔진 | 링크 버튼 전용 자동 포트 |

표현식 접근 예:

- `$node["C"].port` → `"approve"` / `"act"` / `"continue"`
- `$node["C"].output.interaction.type` → `"button_click"` / `"button_continue"`
- `$node["C"].output.interaction.data.selectedItem.title` → 항목 버튼을 눌렀을 때 슬라이드 제목
- `$node["C"].config.items[0].title` → 정적 슬라이드 제목(입력 대기 때와 같다)

## Rationale

출력 구조의 결정 근거(표시 전용 · 입력 대기 · 재개 출력의 형태와 기각한 대안)는 부모 문서 [Carousel 노드](CLE-NODE-CAROUSEL.md#rationale) 의 Rationale 이 정한다. 이 문서는 길이 한도 때문에 출력 구조를 따로 떼어 낸 것이다.
