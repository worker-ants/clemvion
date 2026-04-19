# Carousel (`carousel`) — Output 일관성 개선안

- **카테고리**: presentation
- **현 문서**: [../../node-specs/presentation/carousel.md](../../node-specs/presentation/carousel.md)
- **전역 규칙**: [../CONVENTIONS.md](../CONVENTIONS.md)
- **관련 Principle**: **Principle 4 (블로킹/재개)**, **Principle 6 (동적 포트 네이밍)**, Principle 0

> **요약**: carousel 은 이미 `output.interaction` / `output.previousOutput` 구조를 사용하고 있어 form 보다 개선 폭이 작지만, ① waiting 시 `output` 에 `view` 래퍼가 없고 (flat), ② resumed 시 `previousOutput` → `view` 로 네이밍 통일이 필요하며, ③ `status: 'button_click' | 'button_continue'` 를 `'resumed'` 로 통일하고 상호작용 타입은 `output.interaction.type` 으로 옮겨야 합니다. per-item 버튼 ID 관례(`__item_{idx}`) 는 Principle 6 으로 공식 승격됩니다.

---

## 1. 현재 Output 구조 요약

Carousel 은 아이템 리스트를 슬라이드 카드로 렌더링하고, 버튼이 하나라도 있으면 blocking 이 됩니다. 버튼은 global (`config.buttons`) / per-item (static `items[*].buttons` / dynamic `itemButtons` 템플릿) 으로 나뉘며, per-item 버튼은 런타임에 `${buttonId}__item_${index}` 접미사가 붙어 ID 충돌을 방지합니다.

### Case A — 초기 실행 (waiting)

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
    "items": [ { "title": "Item A", "description": "Desc A", "image": "http://a.png", "buttons": [ /* … */ ] } ],
    "layout": "card",
    "rendered": "<div class=\"carousel carousel-card\">…</div>"
  },
  "status": "waiting_for_input",
  "meta": { "interactionType": "buttons" }
}
```

### Case B — port 타입 버튼 클릭 후 (resumed)

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

### Case C — link 타입 버튼(Continue) 클릭 후

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

- Waiting 시 `output` 은 flat 구조 — `type` / `items` / `layout` / `rendered` 가 모두 1차 키.
- Resumed 시 `output.previousOutput` 이 뷰 스냅샷 역할을 함 (의도는 Principle 4 의 `view` 와 동일).
- `status` 는 `button_click` / `button_continue` 두 리터럴 사용 — 사실상 `output.interaction.interactionType` 과 중복.
- per-item 버튼 ID: `${id}__item_${idx}` 는 핸들러 내부 규칙이지만 문서에만 언급되어 있고 엔진/프런트 전역 계약이 없음.

---

## 2. 식별된 불일치

| # | 항목 | 위반한 Principle | 설명 |
| --- | --- | --- | --- |
| 1 | Waiting 시 `output` 에 `view` 래퍼 없음 | **Principle 4.3** | `output.view.type` 으로 판별 가능해야 함. 현재는 `output.type` (하나 얕음). |
| 2 | Resumed 시 `previousOutput` 네이밍 | **Principle 4.2** | "`output.previousOutput` → `output.view` 로 이동" CONVENTIONS 에 명시됨. |
| 3 | `status: 'button_click' \| 'button_continue'` | **Principle 4.1 / 축 9 status 사전** | `'resumed'` 로 통일. 상호작용 타입은 `output.interaction.type` 으로. |
| 4 | `output.interaction.interactionType` 중복 | Principle 4 | 이미 interaction 래퍼 안에 있지만 필드명이 `interactionType` 라 `output.interaction.type` 대비 장황. `type` 으로 축약. |
| 5 | per-item 버튼 ID 규칙 암묵 | **Principle 6 (동적 포트 네이밍)** | `${id}__item_${idx}` suffix 는 carousel 만 사용하지만 엔진이 파싱. CONVENTIONS 는 이를 "공식 규칙으로 승격" 이라 명시. |
| 6 | `selectedItem` 의 위치 | Principle 4 | per-item 버튼에서 선택된 item 은 interaction 의 일부이므로 `output.interaction.data.selectedItem` 으로 내려야 함. |
| 7 | `clickedAt` vs `receivedAt` | Principle 4.1 (예시) | Principle 4.1 의 예시는 `receivedAt`. presentation 카테고리 전체 통일 필요. |

---

## 3. 제안된 Output 구조

### 3.1. Waiting (`status: "waiting_for_input"`)

**Before**

```json
{
  "output": {
    "type": "carousel",
    "items": [ /* … */ ],
    "layout": "card",
    "rendered": "<div>…</div>"
  },
  "status": "waiting_for_input",
  "meta": { "interactionType": "buttons" }
}
```

**After**

```json
{
  "output": {
    "view": {
      "type": "carousel",
      "items": [
        { "title": "Item A", "description": "Desc A", "image": "http://a.png",
          "buttons": [ { "id": "act__item_0", "label": "Select", "type": "port" } ] }
      ],
      "layout": "card",
      "rendered": "<div class=\"carousel carousel-card\">…</div>"
    }
  },
  "status": "waiting_for_input",
  "meta": { "interactionType": "buttons", "durationMs": 0 }
}
```

- `view.type: 'carousel'` 판별자.
- `rendered` 는 view 내부에 유지 — HTML snapshot.
- `items`/`layout` 은 view 내부로 한 단계 내려감.

### 3.2. Resumed — port 버튼 클릭 (`status: "resumed"`)

**Before**

```json
{
  "output": {
    "interaction": {
      "interactionType": "button_click",
      "buttonId": "approve",
      "buttonLabel": "Approve",
      "clickedAt": "2026-04-19T…"
    },
    "selectedItem": { "title": "Item A", /* … */ },
    "previousOutput": { "type": "carousel", "items": [ /* … */ ], "layout": "card", "rendered": "…" }
  },
  "port": "approve",
  "status": "button_click"
}
```

**After**

```json
{
  "output": {
    "view": {
      "type": "carousel",
      "items": [ /* waiting 시점 스냅샷 */ ],
      "layout": "card",
      "rendered": "<div>…</div>"
    },
    "interaction": {
      "type": "button_click",
      "data": {
        "buttonId": "approve",
        "buttonLabel": "Approve",
        "selectedItem": { "title": "Item A", "description": "Desc A", "image": "…" },
        "clickedAt": "2026-04-19T12:34:56.000Z"
      },
      "receivedAt": "2026-04-19T12:34:56.000Z"
    }
  },
  "port": "approve",
  "status": "resumed",
  "meta": { "interactionType": "buttons", "durationMs": 12340 }
}
```

### 3.3. Resumed — link 버튼(Continue) 클릭

**Before**

```json
{
  "output": {
    "interaction": { "interactionType": "button_continue", "clickedAt": "…" },
    "previousOutput": { "type": "carousel", /* … */ }
  },
  "port": "continue",
  "status": "button_continue"
}
```

**After**

```json
{
  "output": {
    "view": { "type": "carousel", /* waiting snapshot */ },
    "interaction": {
      "type": "button_continue",
      "data": { "clickedAt": "2026-04-19T12:34:56.000Z" },
      "receivedAt": "2026-04-19T12:34:56.000Z"
    }
  },
  "port": "continue",
  "status": "resumed"
}
```

### 3.4. 동적 포트 ID 공식화 (Principle 6)

- **Global 버튼**: `config.buttons[i].id` 그대로 → 출력 포트 ID.
- **Per-item 버튼**: 런타임 네이밍 `${buttonId}__item_${index}` — 엔진이 `__item_\d+$` 를 분리해 원본 포트 ID (`buttonId`) 로 라우팅.
- **예약어**: `out`, `continue`, `default`, `error` 는 사용자 버튼 ID 로 사용 금지 (프런트 검증에서 reject).
- `button.id` 내부에 `__item_` 포함 금지 (현 schema-level 검증 유지).
- 문서 상 `__item_` suffix 는 Principle 6 의 **공식 per-item 포트 suffix 규칙** 으로 승격.

### 3.5. interaction.type enum

presentation 카테고리 전체에서 `output.interaction.type` 은 다음 enum 중 하나:

- `'button_click'` — port 타입 버튼 클릭 (carousel/table/chart/template)
- `'button_continue'` — link 타입 버튼 클릭 후 Continue 신호
- `'form_submitted'` — form 제출 (form 전용)

---

## 4. 마이그레이션 영향도

### 4.1. Expression 경로 변화

| Before | After | Breaking? | 비고 |
| --- | --- | --- | --- |
| `$node["C"].output.type` | `$node["C"].output.view.type` | **Yes** | waiting 시 type 판별. |
| `$node["C"].output.items` | `$node["C"].output.view.items` | **Yes** | waiting 시. |
| `$node["C"].output.layout` | `$node["C"].output.view.layout` | **Yes** | |
| `$node["C"].output.rendered` | `$node["C"].output.view.rendered` | **Yes** | |
| `$node["C"].output.interaction.buttonId` | `$node["C"].output.interaction.data.buttonId` | **Yes (high)** | 가장 자주 사용되는 경로. |
| `$node["C"].output.interaction.buttonLabel` | `$node["C"].output.interaction.data.buttonLabel` | **Yes (high)** | |
| `$node["C"].output.interaction.interactionType` | `$node["C"].output.interaction.type` | **Yes** | 필드명 변경. |
| `$node["C"].output.interaction.clickedAt` | `$node["C"].output.interaction.data.clickedAt` (또는 `.receivedAt`) | **Yes** | data 아래로 이동 + top-level `receivedAt` 추가. |
| `$node["C"].output.selectedItem` | `$node["C"].output.interaction.data.selectedItem` | **Yes (high)** | per-item 분기에서 광범위 사용. |
| `$node["C"].output.previousOutput.items` | `$node["C"].output.view.items` | **Yes** | previousOutput 소멸. |
| `$node["C"].output.previousOutput.*` | `$node["C"].output.view.*` | **Yes** | |
| `$node["C"].status === "button_click"` | `$node["C"].status === "resumed" && $node["C"].output.interaction.type === "button_click"` | **Yes** | 흐름 제어 조건 전환. |
| `$node["C"].status === "button_continue"` | `$node["C"].status === "resumed" && $node["C"].output.interaction.type === "button_continue"` | **Yes** | |
| `$node["C"].port === "approve"` | 유지 | No | port 라우팅은 그대로. |

### 4.2. 영향도 매트릭스

| 영역 | 영향 수준 | 세부 |
| --- | --- | --- |
| 기존 워크플로우 expression | **HIGH** | `output.interaction.buttonId`/`selectedItem`/`previousOutput.*` 광범위 사용. |
| Status 기반 조건 분기 | **MEDIUM** | `'button_click'` 리터럴 비교는 상대적으로 드물지만 존재. |
| Per-item 포트 라우팅 | **LOW** | 엔진 내부 suffix 처리는 이미 구현됨 — 문서화만 추가. |
| 프런트엔드 렌더러 | **MEDIUM** | waiting 상태에서 `output.view.items` 로 접근 경로 변경. |
| 엔진 resume 경로 | **HIGH** | structured output 의 재조립 로직 수정 필요. |
| 테스트 | **HIGH** | carousel handler unit + execution engine e2e 전수 갱신. |

### 4.3. 마이그레이션 전략

1. **P0 — Handler 변경**: `CarouselHandler.execute()` 가 waiting 시 `output.view` 구조로 반환. `rendered` 등 기존 키를 view 내부로 이동.
2. **P0 — Engine resume 경로**: 버튼 클릭 이벤트를 받아 structured output 을 재조립할 때 `previousOutput` → `view` 로 네이밍 변경, interaction 을 `{ type, data, receivedAt }` 3-필드로 재정렬, `selectedItem` 을 `data` 안으로 이동.
3. **P0 — Status 전이**: `button_click` / `button_continue` 를 반환하지 않고 `resumed` 고정.
4. **P1 — Expression migration script**: 다음 정규식 치환을 일괄 수행.
   - `\.output\.interaction\.interactionType` → `.output.interaction.type`
   - `\.output\.interaction\.(buttonId|buttonLabel|clickedAt)` → `.output.interaction.data.$1`
   - `\.output\.selectedItem` → `.output.interaction.data.selectedItem`
   - `\.output\.previousOutput` → `.output.view`
   - `\.output\.(type|items|layout|rendered)` (waiting 상태에서만) → `.output.view.$1` — **정적 판별 어려움**, 사용자 리뷰 필요.
5. **P1 — Status 리터럴 치환**: `status === 'button_click'` → `status === 'resumed' && output.interaction.type === 'button_click'`. 자동 변환 가능.
6. **P2 — Execution history 호환 뷰어**: 과거 이력에 대해 두 포맷 모두 렌더.
7. **P2 — 문서 업데이트**: node-spec, frontend/docs, OpenAPI 예제.

### 4.4. Per-item 포트 suffix 계약 문서화

- CONVENTIONS Principle 6 으로 승격된 내용을 carousel 문서에 "per-item 버튼 포트는 런타임에 `__item_{index}` 접미사가 붙으며 엔진이 분리해 base ID 로 라우팅" 명시.
- 프런트엔드 포트 해석기 (`resolve-dynamic-ports.ts`) 에서 노출되는 포트는 base ID 이므로 workflow edge 의 source port 는 변경 없음.
- `button.id` 에 `__item_` 포함 금지하는 현행 schema-level 검증을 Principle 6 의 **reserved separator** 규약으로 격상.

---

## 5. 근거

### 5.1. Principle 4.2 의 명시

> 현재 carousel/chart/table/template의 `output.previousOutput` → `output.view` 로 이동 (이전 뷰를 재사용한다는 의미는 동일).

CONVENTIONS 4.2 에 정확히 명시된 조항. 본 제안은 해당 조항의 구체화.

### 5.2. Principle 4.1 상태 전이 통일

`'button_click'` / `'button_continue'` 두 리터럴은 "interaction 종류" 를 status 로 부풀린 것인데, 이미 `output.interaction.type` 에 동일 정보가 존재합니다. status 는 **흐름 제어** 용이므로 `'resumed'` 하나로 충분하고, UI 가 분기해야 할 "버튼 클릭인지 continue 인지" 는 interaction.type 으로 결정합니다.

### 5.3. Principle 6 per-item suffix 공식화

CONVENTIONS Principle 6:

> Per-item 버튼 (carousel static 모드 등): `${buttonId}__item_${index}` — carousel이 이미 사용 중인 suffix를 공식 규칙으로 승격. 엔진이 `__item_\d+$` 패턴을 분리하여 원본 포트로 라우팅.

본 제안은 이 규칙을 carousel 문서에도 명시하고, 장기적으로 다른 presentation 노드(예: 향후 table 에서도 per-row 버튼이 생긴다면) 도 동일 suffix 를 쓰도록 확장할 수 있음을 보장합니다.

### 5.4. `selectedItem` 의 위치

현재 `output.selectedItem` 은 per-item 버튼이 클릭된 경우에만 존재하는 조건부 필드입니다. "버튼 클릭 interaction 의 payload 일부" 이므로 Principle 4.1 의 `output.interaction.data` 아래로 배치하는 것이 의미론적으로 일관합니다.

### 5.5. `receivedAt` 통일

Principle 4.1 예시가 `receivedAt: ISO8601` 을 사용하므로 top-level interaction 필드명은 `receivedAt` 으로 통일합니다. 단, "버튼이 **클릭**된 시각" 이라는 구체적 의미는 `data.clickedAt` 에 보존 — 의미상 겹치지만 다른 presentation 노드와의 일관성을 위해 interaction 래퍼 레벨에는 `receivedAt` 을 노출합니다.

### 5.6. 5개 노드 공통 구조 수렴

본 개선으로 carousel 은 form/table/chart/template 과 완전히 동일한 상태 전이 컨트랙트를 갖게 됩니다:

```
waiting:  { status: 'waiting_for_input', output: { view: { type: 'carousel', items, layout, rendered } } }
resumed:  { status: 'resumed', output: { view, interaction: { type, data, receivedAt } } }
```

---

## 6. 참조

- [CONVENTIONS.md — Principle 4, Principle 6](../CONVENTIONS.md)
- [INCONSISTENCY_MATRIX.md 축 4 / 축 7 / 축 9](../INCONSISTENCY_MATRIX.md)
- 현 구현: `backend/src/nodes/presentation/carousel/carousel.handler.ts`, `.schema.ts`
- 동적 포트 해석: `frontend/src/lib/node-definitions/resolve-dynamic-ports.ts` → `presentationButtonPorts()`
- Engine resume: `backend/src/modules/execution-engine/execution-engine.service.ts` (button click resume)
