# Carousel output 개선안

> 대상 spec: `spec/4-nodes/6-presentation/1-carousel.md` (§5 출력 구조)

## 현재 output (spec 인용)

§5.1 비-블로킹 (dynamic 모드, 버튼 미설정):

```json
{
  "config": { "mode": "dynamic", "layout": "card", "source": "{{ $input.items }}", "titleField": "name", "descriptionField": "summary", "imageField": "thumb" },
  "output": { "items": [{ "title": "Alpha", "description": "First", "image": "http://a.png" }, ...] },
  "meta": { "durationMs": 0 }
}
```

> static 모드 비-블로킹 시 `output: {}` (cap 발동 시 `{itemsTruncated, itemsTotalCount}`).

§5.4-A Waiting (Static 모드, 버튼 설정):

```json
{
  "config": { "mode": "static", "layout": "card", "items": [...], "buttons": [...], "buttonConfig": { "buttons": [...], "buttonItemMap": { "act__item_0": 0 } } },
  "output": {},
  "meta": { "durationMs": 0, "interactionType": "buttons" },
  "status": "waiting_for_input"
}
```

§5.4-B Waiting (Dynamic 모드): `output: { items: [...], itemsTruncated?, itemsTotalCount? }`.

§5.5-A/B/C Resumed: `output.interaction.{type, data, receivedAt}` 추가, waiting 시점 `output.items` (dynamic) 는 immutable snapshot 으로 유지.

## 진단

Carousel 은 **모드 분기 (static / dynamic) × 블로킹 분기 (버튼 유무) × 단계 (waiting / resumed)** 의 다중 차원. 사용자가 제시한 "단계마다 채워지는 field" 정의에 Form 만큼 잘 부합.

| 영역 | 적절성 | 근거 |
| --- | --- | --- |
| Static 모드 — `output: {}` | 적절 | 슬라이드는 `config.items` (리터럴) 참조. 런타임 계산값 없음 (Principle 1.1) |
| Dynamic 모드 — `output: { items: [...] }` | 적절 | `source` 표현식 + field 매핑으로 런타임 생성 — `config.items` 와 독립 (Principle 1.1.3) |
| `output.itemsTruncated?` / `itemsTotalCount?` | 적절 (output) | 1MB cap 동봉 — spec 공통 §4 |
| `output.interaction.{type, data, receivedAt}` (resumed) | 적절 | Principle 4.4 / 4.5 |
| `output.interaction.data.selectedItem` (per-item 클릭) | 적절 | 클릭된 슬라이드 데이터 — dynamic 은 `output.items[idx]` 와 동치, static 은 `config.items[idx]` 와 동치 |
| `meta.interactionType: 'buttons'` (블로킹 시) | 적절 (meta) | UI 인터랙션 식별자 |
| `meta.durationMs` | 적절 | engine 공통 |
| `config.buttonConfig.buttons` (runtime — 글로벌+per-item 합산) | 적절 (config) | 핸들러가 생성한 통합 버튼 목록 — spec footnote: NodeExecution 보존 + 프런트 버튼 바 렌더 사용. `config` 위치인 이유: 사용자 정의 + runtime 합산 결과로 사실상 "이 실행에 적용된 config" |
| `config.buttonConfig.buttonItemMap` (runtime — per-item ID → 인덱스 매핑) | 적절 | 엔진이 `__item_\d+$` suffix 분리에 사용 |
| `port: <button.id>` (per-item 시 base ID, suffix 제거) | 적절 | Principle 6 동적 포트 |
| `port: 'continue'` (link 전용 시) | 적절 | 시스템 예약 포트 |

핵심 점검:

1. **`output.items` (dynamic) ↔ `config.items` (static)** — 같은 의미 (슬라이드 데이터) 가 모드에 따라 다른 위치. spec 이 명시: dynamic 은 런타임 생성이라 `output`, static 은 사용자 리터럴이라 `config`. Principle 1.1.3 (식별 기준: "실행 없이 schema/config 만 보면 알 수 있음 → config / 실행 필요 → output") 정확히 부합.

2. **`config.buttonConfig` 의 위치** — `config` 안에 있지만 일부 필드는 runtime 생성 (`buttons` 배열의 per-item 추가, `buttonItemMap`). Principle 7 의 "config = raw echo" 와 약간 어긋남 — runtime 생성 필드는 `meta` 가 더 정합할 수도. 그러나 프런트 버튼 바 렌더가 `config.buttonConfig` 로 일관 접근하는 의도라면 합리적. spec footnote 가 명시: "프런트엔드는 `config` (mode/layout/items/...) + dynamic 모드의 `output.items` 를 조합해 카드 / 이미지 / minimal 레이아웃을 재구성한다". 검토 권장.

3. **금지 필드 명시** — spec §5.4-A footnote 에 옛 폐기 대상:
   - `output.type: 'carousel'` 판별자 (Principle 1.1.4)
   - `output.view` 래퍼
   - `output.layout`/`output.buttons` 등 config 리터럴 echo (Principle 1.1)

4. **per-item 동적 포트 (`<itemButton.id>__item_<idx>`) → base ID 라우팅** — Principle 6 의 명시 사례. 엔진이 suffix 분리. `__item_` 사용자 정의 ID 에 포함 금지 (schema reject).

## 개선안 — 정리된 output

현 spec 부합. `config.buttonConfig` 위치는 검토 후보.

```json
// Static 비-블로킹
{
  "config": { "mode": "static", "layout": "card", "items": [<ItemDef>, ...] },
  "output": {},                             // 또는 cap 발동 시 { itemsTruncated, itemsTotalCount }
  "meta": { "durationMs": <number> }
}

// Dynamic 비-블로킹
{
  "config": { "mode": "dynamic", "layout": "card", "source": <raw>, "titleField": ..., ... },
  "output": {
    "items": [{ "title": ..., "description": ..., "image": ... }, ...],
    "itemsTruncated"?: true, "itemsTotalCount"?: <number>
  },
  "meta": { "durationMs": <number> }
}

// Static / Dynamic Waiting (블로킹)
{
  "config": {
    ...,
    "buttons": [<ButtonDef raw>, ...],
    "buttonConfig": { "buttons": [<runtime 통합>, ...], "buttonItemMap"?: <Record<string, number>> }
  },
  "output": <static: {} / dynamic: { items: [...] }>,
  "meta": { "durationMs": <number>, "interactionType": "buttons" },
  "status": "waiting_for_input"
}

// Resumed
{
  "config": {...},                            // immutable snapshot
  "output": {
    ...waiting fields,                        // dynamic 은 items, static 은 빈 객체
    "interaction": {
      "type": "button_click" | "button_continue",
      "data": { "buttonId": ..., "buttonLabel": ..., "selectedItem"? /* per-item */, "url"? /* link */ },
      "receivedAt": <ISO8601>
    }
  },
  "meta": { ... },
  "port": "<button.id>" | "continue",
  "status": "resumed"
}
```

## 분리 제안 — output 에서 빠질 항목의 새 위치

| 기존 output 항목 | 새 위치 | 사유 |
| --- | --- | --- |
| (옛 패턴은 모두 폐기 마킹됨) | — | Principle 1.1 / 4 부합 |
| `config.buttonConfig` (runtime 생성 부분) | `meta.buttonConfig` 또는 spec 표현 명확화 검토 | runtime 생성 데이터가 `config` 안에 있어 Principle 7 의 raw echo 와 미묘한 위배 |

## Rationale

- Carousel 은 사용자 제시 정의의 두 단계 (waiting/resumed) 에 모드 분기까지 추가된 가장 복잡한 케이스 — Form 보다 분기는 많지만 본질적 패턴 동일.
- `output.items` 의 위치 (dynamic 만) 결정은 Principle 1.1.3 의 식별 기준에 정확히 부합 — 런타임 계산 vs 리터럴.
- `output.interaction.data.selectedItem` 은 per-item 클릭의 핵심 컨텍스트 — dynamic 은 immutable snapshot 의 인덱스, static 은 config 의 인덱스로 동치.
- `config.buttonConfig` 의 위치는 합리적 (프런트 일관 접근) 이지만 conventions 의 raw echo 원칙과는 약간 어긋남 — review 단계에서 `meta` 이동 여부 결정.
