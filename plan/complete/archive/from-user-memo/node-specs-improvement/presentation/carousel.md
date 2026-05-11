# Carousel (`carousel`) — Output 일관성 개선안 (재작성)

- **카테고리**: presentation
- **현 문서**: [../../node-specs/presentation/carousel.md](../../node-specs/presentation/carousel.md)
- **전역 규칙**: [../CONVENTIONS.md](../CONVENTIONS.md)
- **관련 Principle**: **Principle 1.1 (`config` ↔ `output` 직교성)** — 최우선, **Principle 4 (블로킹/재개)**, **Principle 6 (동적 포트 네이밍)**, Principle 0

> **요약**: carousel 은 두 모드를 갖습니다 — static (items 가 리터럴 config) 와 dynamic (items 가 런타임 `source` 표현식으로 계산). 이전 초안은 `output.view.{items, layout, rendered}` 로 **static 모드에서 리터럴 config 를 echo** 했는데, 이는 **Principle 1.1 위반**입니다. 재작성 안은 모드별로 엄격히 분리합니다: static → `output: {}` (런타임 값 없음), dynamic → `output: { items }` (런타임 resolve 된 items 만). `layout` / `buttons` 정의 등은 모두 `config` 에서 참조.

---

## 1. 현재 Output 구조 요약

Carousel 은 아이템 리스트를 슬라이드 카드로 렌더링합니다. 버튼이 하나라도 있으면 blocking 이 됩니다. 버튼은 global (`config.buttons`) / per-item (static `items[*].buttons` 또는 dynamic `itemButtons` 템플릿) 으로 나뉩니다. per-item 버튼은 런타임에 `${buttonId}__item_${index}` 접미사가 붙어 ID 충돌을 방지합니다.

### Case A — 초기 실행 (waiting, dynamic 모드)

```json
{
  "config": {
    "layout": "card",
    "mode": "dynamic",
    "source": "{{ $node[\"Fetch\"].output.response.items }}",
    "titleField": "name",
    "descriptionField": "desc",
    "imageField": "img",
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
    "items": [
      { "title": "Item A", "description": "Desc A", "image": "http://a.png", "buttons": [ /* … */ ] }
    ],
    "layout": "card",
    "rendered": "<div class=\"carousel carousel-card\">…</div>"
  },
  "status": "waiting_for_input",
  "meta": { "interactionType": "buttons" }
}
```

### Case B — port 버튼 클릭 후 (resumed, 현 구현)

```json
{
  "config": { "layout": "card", "mode": "dynamic", "buttonConfig": { /* … */ } },
  "output": {
    "interaction": {
      "interactionType": "button_click",
      "buttonId": "approve",
      "buttonLabel": "Approve",
      "clickedAt": "2026-04-19T12:34:56.000Z"
    },
    "selectedItem": { "title": "Item A", "description": "Desc A", "image": "…" },
    "previousOutput": { "type": "carousel", "items": [ /* … */ ], "layout": "card", "rendered": "…" }
  },
  "port": "approve",
  "status": "button_click",
  "meta": { "interactionType": "buttons" }
}
```

### Case C — link 타입 Continue

```json
{
  "output": {
    "interaction": { "interactionType": "button_continue", "clickedAt": "…" },
    "previousOutput": { "type": "carousel", "items": [ /* … */ ] }
  },
  "port": "continue",
  "status": "button_continue",
  "meta": { "interactionType": "buttons" }
}
```

특징 요약:

- Waiting 시 `output` 은 flat — `type` / `items` / `layout` / `rendered` 가 1차 키. static 모드에서는 `items` 가 `config.items` 와 **완전히 동일** (Principle 1.1 위반).
- Resumed 시 `output.previousOutput` 이 뷰 스냅샷 역할 — 내용은 이전 output 의 복제.
- `status` 리터럴: `'button_click'` / `'button_continue'` — 사실상 `interaction.interactionType` 과 중복.
- per-item 버튼 ID suffix `__item_{idx}` 는 핸들러 내부 규칙.

---

## 2. 식별된 불일치

| # | 항목 | 위반한 Principle | 설명 |
| --- | --- | --- | --- |
| 1 | Waiting 시 `output.items` (static 모드) | **Principle 1.1 (config echo 금지)** | static 모드의 items 는 `config.items` 리터럴과 동일. 후속 노드는 `$node["C"].config.items` 로 참조해야 함. |
| 2 | Waiting 시 `output.layout` / `output.rendered` | **Principle 1.1** | `layout` 은 리터럴 config, `rendered` HTML 은 runtime 계산이지만 "후속 노드가 로직에 사용할 도메인 데이터" 가 아님 — Principle 1 에 따라 `meta.rendered` 로 이동 검토 또는 삭제. |
| 3 | Waiting 시 `output.type` 판별자 | **Principle 1.1.4 / 축 4** | 노드 타입은 워크플로우 정의에서 파악. 판별자 불필요. |
| 4 | Resumed 시 `output.previousOutput` | **Principle 4.2 (폐기 필드)** | CONVENTIONS 4.2 에 제거 명시. 스냅샷이 필요한 이유 자체가 없음 — waiting 시점의 runtime 값은 `config` + 원본 input 으로 재구성 가능. |
| 5 | `status: 'button_click' \| 'button_continue'` | **Principle 4.1 / 축 9** | `'resumed'` 로 통일. interaction 종류는 `output.interaction.type`. |
| 6 | `output.interaction.interactionType` 필드명 | Principle 4 | `output.interaction.type` 으로 축약. |
| 7 | `output.selectedItem` 위치 | Principle 4.5 | interaction payload 의 일부 → `output.interaction.data.selectedItem`. |
| 8 | `clickedAt` top-level 위치 | Principle 4.4 (예시) | top-level 은 `receivedAt`. |
| 9 | per-item 버튼 ID 암묵 규칙 | **Principle 6** | `${id}__item_${idx}` suffix 를 공식 규칙으로 승격. |

> **과거 초안 대비 차이**: 이전 초안은 `output.view.{type, items, layout, rendered}` 로 래핑했으나, 이는 static 모드에서 `items` 가 config 리터럴과 동일한 **중복 echo** 였습니다. 재작성 안은 **모드별로 분리**합니다.

---

## 3. 제안된 Output 구조

### 3.1. Waiting (static 모드)

**Before**

```json
{
  "config": { "mode": "static", "layout": "card", "items": [ /* literal */ ] },
  "output": {
    "type": "carousel",
    "items": [ /* literal config 와 동일 */ ],
    "layout": "card",
    "rendered": "<div>…</div>"
  },
  "status": "waiting_for_input"
}
```

**After**

```json
{
  "config": {
    "mode": "static",
    "layout": "card",
    "items": [
      { "title": "Item A", "description": "Desc A", "image": "http://a.png" },
      { "title": "Item B", "description": "Desc B", "image": "http://b.png" }
    ],
    "buttonConfig": {
      "buttons": [ { "id": "approve", "label": "Approve", "type": "port" } ]
    }
  },
  "output": {},
  "status": "waiting_for_input",
  "meta": { "interactionType": "buttons", "durationMs": 0 }
}
```

핵심:

- static 모드에서 `items` 는 **리터럴 config**. 런타임 계산 없음 → `output: {}`.
- 프런트 / 후속 노드는 `$node["C"].config.items` / `.config.layout` 으로 접근.
- `output.view` 래퍼 / `output.type` 판별자 **없음** (Principle 1.1.4).
- `rendered` HTML 은 **제거**. 프런트는 `config.items` + `config.layout` 으로 직접 렌더. (필요 시 `meta.rendered` 로 이동 가능하나 본 제안은 제거.)

### 3.2. Waiting (dynamic 모드)

**Before**

```json
{
  "config": { "mode": "dynamic", "source": "{{ … }}", "titleField": "name" },
  "output": {
    "type": "carousel",
    "items": [ /* source 해석 + field 매핑 결과 */ ],
    "layout": "card",
    "rendered": "<div>…</div>"
  },
  "status": "waiting_for_input"
}
```

**After**

```json
{
  "config": {
    "mode": "dynamic",
    "layout": "card",
    "source": "{{ $node[\"Fetch\"].output.response.items }}",
    "titleField": "name",
    "descriptionField": "desc",
    "imageField": "img",
    "buttonConfig": { "buttons": [ /* … */ ] }
  },
  "output": {
    "items": [
      { "title": "Alpha", "description": "First", "image": "http://a.png" },
      { "title": "Beta",  "description": "Second", "image": "http://b.png" }
    ]
  },
  "status": "waiting_for_input",
  "meta": { "interactionType": "buttons", "durationMs": 42 }
}
```

핵심:

- dynamic 모드의 `items` 는 `source` 표현식을 해석하고 `titleField`/`descriptionField`/`imageField` 매핑을 적용한 **런타임 생성** 결과. `config.items` (없음) 와는 독립.
- 후속 노드는 `$node["C"].output.items` 로 접근 (런타임 값).
- `layout` / `buttons` 정의 등은 `config` 에서 참조 — `output` 에 복사 금지.

### 3.3. Resumed — port 버튼 클릭 (static 모드)

```json
{
  "config": { "mode": "static", "layout": "card", "items": [ /* … */ ], "buttonConfig": { /* … */ } },
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
  "port": "approve",
  "status": "resumed",
  "meta": { "interactionType": "buttons", "durationMs": 12340 }
}
```

### 3.4. Resumed — per-item 버튼 클릭 (static 모드)

```json
{
  "output": {
    "interaction": {
      "type": "button_click",
      "data": {
        "buttonId": "act",
        "buttonLabel": "Select",
        "selectedItem": { "title": "Item A", "description": "Desc A", "image": "http://a.png" }
      },
      "receivedAt": "2026-04-19T12:34:56.000Z"
    }
  },
  "port": "act",
  "status": "resumed"
}
```

- per-item 클릭 시 원본 포트는 `act` (suffix `__item_0` 제거됨, Principle 6).
- `selectedItem` 은 **interaction 의 payload 일부** 로 `data.selectedItem` 안에 위치 (Principle 4.5).
- static 모드의 selectedItem 은 `config.items[index]` 와 동일한 객체 → 엄밀히는 config echo 여지가 있으나, "사용자가 클릭한 아이템이 무엇인가" 라는 **인터랙션 문맥** 정보이므로 interaction.data 에 포함하는 것이 타당 (Principle 4.5 의 `button_click` payload 규격).

### 3.5. Resumed — per-item 버튼 클릭 (dynamic 모드)

```json
{
  "output": {
    "items": [
      { "title": "Alpha", "description": "First", "image": "…" },
      { "title": "Beta",  "description": "Second", "image": "…" }
    ],
    "interaction": {
      "type": "button_click",
      "data": {
        "buttonId": "act",
        "buttonLabel": "Select",
        "selectedItem": { "title": "Alpha", "description": "First", "image": "…" }
      },
      "receivedAt": "2026-04-19T12:34:56.000Z"
    }
  },
  "port": "act",
  "status": "resumed"
}
```

- dynamic 모드에서는 waiting 시점의 `output.items` (런타임 resolve 결과) 를 **그대로 유지** (immutable snapshot). 재개 후에도 어떤 items 를 사용자가 봤는지 확인 가능.
- `selectedItem` 은 `output.items[index]` 와 참조 동일.

### 3.6. Resumed — link 타입 Continue

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
  "port": "continue",
  "status": "resumed"
}
```

- `button_continue` payload 는 `{ buttonId, buttonLabel, url }` (Principle 4.5).
- dynamic 모드였다면 `output.items` 도 유지.

### 3.7. 동적 포트 ID 공식화 (Principle 6)

- **Global 버튼**: `config.buttons[i].id` 그대로 → 출력 포트 ID.
- **Per-item 버튼**: 런타임 `${buttonId}__item_${index}` — 엔진이 `__item_\d+$` 를 분리해 원본 포트 ID 로 라우팅. 워크플로우 edge 의 source port 는 항상 base ID.
- **예약어**: `out`, `continue`, `default`, `error` 사용자 버튼 ID 로 사용 금지 (프런트 검증에서 reject).
- `button.id` 내부에 `__item_` 포함 금지 (현 schema-level 검증 유지).

### 3.8. interaction.type enum (presentation 카테고리 공통)

- `'button_click'` — port 타입 버튼 클릭 (carousel/table/chart/template)
- `'button_continue'` — link 타입 버튼 클릭 후 Continue 신호
- `'form_submitted'` — form 제출 (form 전용)

---

## 4. 마이그레이션 영향도

### 4.1. Expression 경로 변화 (static 모드)

| Before | After | Breaking? | 비고 |
| --- | --- | --- | --- |
| `$node["C"].output.type` | — (제거) | **Yes** | 판별자 폐기. 워크플로우 정의에서 노드 타입 파악. |
| `$node["C"].output.items` (waiting, static) | `$node["C"].config.items` | **Yes (high)** | static items 는 config 리터럴. |
| `$node["C"].output.layout` | `$node["C"].config.layout` | **Yes** | |
| `$node["C"].output.rendered` | — (제거) | **Yes** | 프런트는 `config.items` + `config.layout` 으로 직접 렌더. |
| `$node["C"].output.interaction.buttonId` | `$node["C"].output.interaction.data.buttonId` | **Yes (high)** | |
| `$node["C"].output.interaction.buttonLabel` | `$node["C"].output.interaction.data.buttonLabel` | **Yes (high)** | |
| `$node["C"].output.interaction.interactionType` | `$node["C"].output.interaction.type` | **Yes** | |
| `$node["C"].output.interaction.clickedAt` | `$node["C"].output.interaction.receivedAt` | **Yes** | top-level 은 `receivedAt`. |
| `$node["C"].output.selectedItem` | `$node["C"].output.interaction.data.selectedItem` | **Yes (high)** | |
| `$node["C"].output.previousOutput.items` | `$node["C"].config.items` (static) | **Yes** | previousOutput 소멸. |
| `$node["C"].output.previousOutput.*` | `$node["C"].config.*` 또는 `$node["C"].output.items` (dynamic) | **Yes** | |
| `$node["C"].status === "button_click"` | `$node["C"].status === "resumed" && $node["C"].output.interaction.type === "button_click"` | **Yes** | |
| `$node["C"].status === "button_continue"` | `$node["C"].status === "resumed" && $node["C"].output.interaction.type === "button_continue"` | **Yes** | |
| `$node["C"].port === "approve"` | 유지 | No | port 라우팅은 그대로. |

### 4.2. Expression 경로 변화 (dynamic 모드)

| Before | After | Breaking? | 비고 |
| --- | --- | --- | --- |
| `$node["C"].output.items` (waiting, dynamic) | `$node["C"].output.items` | **No** | dynamic 모드는 runtime 값이므로 `output` 유지. |
| `$node["C"].output.items[0].title` | `$node["C"].output.items[0].title` | **No** | 동상. |
| 나머지 경로 변경 | static 과 동일 | — | interaction/previousOutput 경로는 공통. |

### 4.3. 영향도 매트릭스

| 영역 | 영향 수준 | 세부 |
| --- | --- | --- |
| 기존 워크플로우 expression (static) | **HIGH** | `output.items` → `config.items` 로 경로 이동. 가장 큰 변화. |
| 기존 워크플로우 expression (dynamic) | **MEDIUM** | `output.items` 는 유지. interaction/previousOutput 경로만 조정. |
| Status 기반 조건 분기 | **MEDIUM** | `'button_click'`/`'button_continue'` 리터럴 사용처. |
| Per-item 포트 라우팅 | **LOW** | 엔진 내부 suffix 처리는 이미 구현됨 — 문서화만 추가. |
| 프런트엔드 렌더러 | **MEDIUM** | static 모드는 `config.items` / `config.layout`, dynamic 모드는 `output.items` + `config.layout` 로 분기. |
| 엔진 resume 경로 | **HIGH** | structured output 의 `previousOutput` 재조립 로직 제거, interaction 3-필드 정규화. |
| 테스트 | **HIGH** | carousel handler unit + execution engine e2e 전수 갱신. |

### 4.4. 마이그레이션 전략

1. **P0 — Handler 변경**:
   - static 모드: waiting 시 `output: {}` 반환.
   - dynamic 모드: waiting 시 `output: { items: <resolved> }` 반환.
   - `rendered` HTML 제거 (또는 선택적으로 `meta.rendered`).
2. **P0 — Engine resume 경로**:
   - `previousOutput` 제거.
   - interaction 을 `{ type, data, receivedAt }` 3-필드로 재정렬. `selectedItem` 을 `data` 안으로 이동. `buttonId`/`buttonLabel`/`url` 도 `data` 안.
   - dynamic 모드의 경우 waiting 시점의 `output.items` 를 resumed 시점에도 그대로 보존 (immutable).
3. **P0 — Status 전이**: `button_click` / `button_continue` → `'resumed'` 고정.
4. **P1 — Expression migration script**:
   - `\.output\.interaction\.interactionType` → `.output.interaction.type`
   - `\.output\.interaction\.(buttonId|buttonLabel)` → `.output.interaction.data.$1`
   - `\.output\.interaction\.clickedAt` → `.output.interaction.receivedAt`
   - `\.output\.selectedItem` → `.output.interaction.data.selectedItem`
   - `\.output\.previousOutput\.` → `.config.` (static 리터럴) — **사용자 수동 리뷰 필요**, 자동 치환 불가.
   - static 모드 `\.output\.(items|layout|rendered)` → `.config.$1` — **정적 판별 어려움**, 사용자 리뷰.
5. **P1 — Status 리터럴 치환**: `status === 'button_click'` → 복합 조건. 자동 변환 가능.
6. **P2 — 과거 이력 호환 뷰어**.
7. **P2 — 문서 업데이트**: node-spec, frontend/docs, OpenAPI 예제.

### 4.5. Per-item 포트 suffix 계약 문서화

- CONVENTIONS Principle 6 으로 승격된 내용을 carousel 문서에 "per-item 버튼 포트는 런타임에 `__item_{index}` 접미사가 붙으며 엔진이 분리해 base ID 로 라우팅" 명시.
- 프런트엔드 포트 해석기 (`resolve-dynamic-ports.ts`) 에서 노출되는 포트는 base ID 이므로 workflow edge 의 source port 는 변경 없음.

---

## 5. 근거

### 5.1. Principle 1.1 — 직교성의 핵심 적용

Principle 1.1.1 표는 `layout` / `items` (static) 등을 `config` **만** 에 두도록 규정합니다.

> 사용자가 UI/schema 로 설정한 리터럴 값 (title, submitLabel, **layout**, chartType, format, columns 정의, fields 정의, **systemPrompt, maxTurns, categories 정의** 등) → `config` 만.

carousel 의 `layout` 은 이 목록에 직접 포함됩니다. static 모드의 `items` 는 "사용자가 UI 로 정의한 리터럴 배열" 이므로 동일 범주.

### 5.2. Principle 1.1.3 적용 예

> `carousel.config.layout = "card"` → output 에 echo 금지.

CONVENTIONS 에 carousel 이 직접 예시로 언급되어 있습니다. 본 제안은 해당 조항의 구체화.

### 5.3. Principle 4.3 — carousel 의 waiting output 공식 정의

> | `carousel` (static) | `{}` | `items` 가 literal config. 런타임 계산 없음. 후속 노드는 `config.items` 참조. |
> | `carousel` (dynamic) | `{ items }` | `source` 표현식 해석 + `titleField`/`descriptionField`/`imageField` 매핑으로 런타임 생성된 items 배열. `config.items` 와 독립. |

CONVENTIONS 4.3 표가 carousel 을 static/dynamic 두 줄로 분리해서 공식 정의하고 있습니다. 본 제안은 이를 그대로 반영합니다.

### 5.4. Principle 4.2 — previousOutput 제거 근거

> 현재 carousel/chart/table/template의 `output.previousOutput` → **제거**. 이전 뷰 정보는 `config` + output의 런타임 필드 조합으로 재구성 가능 (Principle 1.1).

이전 초안은 `previousOutput` 을 `view` 로 리네이밍했지만, 재작성 안은 **완전 제거**합니다. 이유: config 리터럴은 이미 `config` 에 있고, dynamic runtime 값 (items) 은 `output.items` 에 그대로 보존되므로 별도 스냅샷 불필요.

### 5.5. Principle 4.5 — button_click payload 규격

| `interaction.type` | `data` shape | 적용 노드 |
| --- | --- | --- |
| `button_click` | `{ buttonId, buttonLabel, selectedItem? }` | `carousel`, `table`, `chart`, `template` |
| `button_continue` | `{ buttonId, buttonLabel, url }` | link 타입 버튼의 Continue 포트 |

carousel 의 `selectedItem` 은 "per-item 버튼인 경우에만 존재하는 선택적 필드" 로 `data.selectedItem?` 에 위치합니다.

### 5.6. Principle 6 per-item suffix 공식화

> Per-item 버튼 (carousel static 모드 등): `${buttonId}__item_${index}` — carousel이 이미 사용 중인 suffix를 공식 규칙으로 승격. 엔진이 `__item_\d+$` 패턴을 분리하여 원본 포트로 라우팅.

### 5.7. 5개 presentation 노드 공통 구조 수렴

```
waiting  (static) : { status: 'waiting_for_input', output: {} }
waiting (dynamic) : { status: 'waiting_for_input', output: { items } }
resumed           : { status: 'resumed', output: { ...waiting fields, interaction: { type, data, receivedAt } } }
```

**공통 원칙**:

- config 리터럴은 `output` 에 echo 금지 (Principle 1.1).
- 노드 타입 판별자는 `output` 에 포함되지 않음 (Principle 1.1.4).
- 상호작용은 `output.interaction.{type, data, receivedAt}` 로 표현.
- status ∈ `{undefined, 'waiting_for_input', 'resumed'}`.

---

## 6. 참조

- [CONVENTIONS.md — Principle 1.1, Principle 4, Principle 6](../CONVENTIONS.md)
- [INCONSISTENCY_MATRIX.md 축 4 / 축 7 / 축 7.5 / 축 9](../INCONSISTENCY_MATRIX.md)
- 현 구현: `backend/src/nodes/presentation/carousel/carousel.handler.ts`, `.schema.ts`
- 동적 포트 해석: `frontend/src/lib/node-definitions/resolve-dynamic-ports.ts` → `presentationButtonPorts()`
- Engine resume: `backend/src/modules/execution-engine/execution-engine.service.ts` (button click resume)
