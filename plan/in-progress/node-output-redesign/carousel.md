# Carousel output 개선안

> **6차 갱신 (2026-06-25 코드 재검증)**: handler 디렉터리 구조 불변 (분할 없음). §8 5개 항목 중 **3개 해소**: ① spec §5.1/§5.4-B JSON 에 `config.maxItems` echo 반영 (`spec/4-nodes/6-presentation/1-carousel.md:163,254`) ② handler `configEcho` 에 `maxItems: rawConfig.maxItems` 추가 (`carousel.handler.ts:193`, D1 explicit-enumeration baseline) ③ `config.buttonConfig` 위치 결정 — spec 이 surface 표(`:236-237,280`)에서 `runtime` 으로 명시하고 §4 footnote 로 frontend 일관 접근 근거를 문서화하며 **config 위치 유지** 채택. **잔여 2개**: per-item 버튼 + cap 발동 시 `buttonItemMap` 정합성 unit 테스트 부재 (cap 테스트 `carousel.handler.spec.ts:424-453` 는 itemButtons 없는 케이스만), 이미지 `sanitizeUrl` 의 `data:`/`vbscript:` 미reject (`carousel.handler.ts:24-27`; 단 link 버튼 URL 은 `carousel.schema.ts:372` 에서 3종 모두 reject 로 비대칭 잔존). stale 라인 다수 정정 (handler 226→234줄, 블로킹 217-229→218-232, dynamic itemButtons 165-173→139-148/165-173). PR #440/#516 (spec audit sync).

> **최신화 검토 (2026-05-16)**: 현 spec 과 본 plan 의 분석이 정합. static/dynamic 모드 분기 + 블로킹 단계 + per-item 동적 포트 (`<id>__item_<idx>`) 모두 conventions 부합. PR #49 (Template preview 버튼 바 표시 fix) 으로 frontend 렌더링은 정상 동작.
> 잔여 권고 항목:
> - `config.buttonConfig` (runtime 생성 `buttons` 합산 + `buttonItemMap`) 의 위치 — `config` 안에 있지만 일부 필드가 runtime 생성이라 Principle 7 (config = raw echo) 와 미묘한 위배. `meta.buttonConfig` 이동 또는 spec 표현 명확화 (frontend 일관 접근 의도 명시) 검토.

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

2. **`config.buttonConfig` 의 위치** — `config` 안에 있지만 일부 필드는 runtime 생성 (`buttons` 배열의 per-item 추가, `buttonItemMap`). Principle 7 의 "config = raw echo" 와 약간 어긋남 — runtime 생성 필드는 `meta` 가 더 정합할 수도. 그러나 프런트 버튼 바 렌더가 `config.buttonConfig` 로 일관 접근하는 의도라면 합리적. spec footnote 가 명시: "프런트엔드는 `config` (mode/layout/items/...) + dynamic 모드의 `output.items` 를 조합해 슬라이드를 재구성한다" (2026-07-07 옵션 D 이후 two-surface: 인터랙티브 채널 = `layout` 시각 레이아웃 / 실행이력 프리뷰 = 텍스트 포워드 — §4 참조). 검토 권장.

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

## 구현 분석 (2026-05-16)

대상 파일: `codebase/backend/src/nodes/presentation/carousel/{carousel.handler.ts, carousel.schema.ts, carousel.handler.spec.ts, buttons.spec.ts, carousel.schema.spec.ts}`.

1. **spec §5 ↔ handler return 정합성**:
   - 비-블로킹: `carousel.handler.ts:234` `return { config: configEcho, output: payload }` 5필드 invariant 부합 (Principle 0). dynamic 모드는 `payload.items = cappedItems.value` (`:211`), static 모드는 `output: {}` (cap 발동 시 `itemsTruncated`/`itemsTotalCount` — `:213-216`).
   - 블로킹 waiting: `:218-232` 가 `status: 'waiting_for_input'` + `meta: { interactionType: 'buttons', durationMs: 0 }` + `config.buttonConfig: { buttons: allButtons, buttonItemMap }` 반환. spec §5.4-A/B 와 일치.
   - resumed 단계는 엔진(`execution-engine`) 이 주입하므로 핸들러는 관여하지 않음 — spec §5.5 의 `output.interaction.{type, data, receivedAt}` + `status: 'resumed'` 가 핸들러 외부에서 채워진다.

2. **schema ↔ spec config 정합성**: `carouselNodeConfigSchema` (`carousel.schema.ts:174-318`) 의 `mode`/`items`/`source`/`titleField`/`descriptionField`/`imageField`/`maxItems`/`itemButtons`/`layout`/`buttons` 모두 spec §1 표와 동일 (default `dynamic`/`[]`/`card`/`10`). ItemDef `title`/`description`/`image`/`buttons` 도 spec §1 의 ItemDef 와 일치 (`:55-99`).
   - **gap (경미)**: schema 의 ItemDef `buttons` default 가 `[]` 인데 spec §1 ItemDef 표는 max 4 권고만 명시 — schema 가 더 엄격하지 않음. 검증은 `validateCarouselItemButtons` (`:332-385`) 에서 처리.

3. **validate 일관성**:
   - `carousel.handler.ts:32-66` 의 `handler.validate()` 는 warningRules (mode/titleField/items) + handler-only residual 두 가지: `titleField is required and must be a string` (`:53`), `items must be an array in static mode` (`:62`). 둘 다 spec §7 에 기재된 에러 메시지와 일치.
   - SSOT 침범 없음 — per-item 규칙은 모두 `validateCarouselItemButtons` 가 담당.

4. **에러 컨트랙트 (Principle 3)**: pre-flight throw 만 — runtime `port:'error'` 없음. spec §7 와 일치.

5. **conventions Principle 0–11 위반 패턴**:
   - Principle 0: 5필드 invariant 부합 (`:218-232` / `:234`). top-level 추가 키 없음.
   - Principle 1.1: static 모드의 `output: {}` (`:209-216`) + dynamic 의 `output.items` 분기는 직교성 정확 부합. `config.items` echo (`:188`) 와 `output.items` (`:211`) 가 모드별로 다른 자리에 위치.
   - Principle 4: waiting/resumed 두 단계 명확. `meta.interactionType: 'buttons'` 부합.
   - Principle 5/6: `port` 는 동적 (`<button.id>` / `<itemButton.id>__item_<idx>` 라우팅) — `__item_` 분리는 엔진이 처리. schema `validateCarouselItemButtons` 가 사용자 ID 의 `__item_` 포함을 reject (`carousel.schema.ts:349-352`).
   - Principle 7: config raw echo — `rawConfig ?? config` (`:184`) 패턴으로 `layout`/`mode`/`items`/`titleField`/`descriptionField`/`imageField`/`maxItems`/`buttons`/`itemButtons` 모두 raw 보존 (`:185-196`). `buttonConfig` (runtime 생성) 는 `config` 안에 위치 — 본 plan §"진단" 2번의 위배 후보 → (2026-06-25) 결정: spec 이 surface 표(`spec/4-nodes/6-presentation/1-carousel.md:236-237,280`)에서 `runtime` 으로 명시하고 §4 footnote 로 frontend 일관 접근 근거를 문서화하여 **config 위치 유지** 채택 — 위배 후보 종결.
   - **gap → (2026-06-25) 해소**: `config.maxItems` echo 가 이제 `configEcho` 에 포함됨 (`carousel.handler.ts:193` `maxItems: rawConfig.maxItems`, D1 explicit-enumeration baseline). schema 정의(`carousel.schema.ts:263-276`, default 10) 와 spec §1 표 + §5.1/§5.4-B JSON 예시(`spec/4-nodes/6-presentation/1-carousel.md:163,254`) 모두 동기화 완료.

6. **handler 테스트 (`carousel.handler.spec.ts`, `buttons.spec.ts`)**:
   - 정상: static/dynamic + 빈 input + non-array 입력 wrap + javascript: URL sanitize + `output.rendered` 부재 (Principle 1) + `output.layout` 부재 (Principle 1.1) 모두 커버 (`carousel.handler.spec.ts:163-380`).
   - 에러: validate 단계 dynamic/static 양쪽 모든 케이스 커버 (`:22-159`).
   - waiting: `buttons.spec.ts:67-119` 가 `status='waiting_for_input'` / `meta.interactionType` / `config.buttonConfig` / dynamic `output.items` 존재 / `output.rendered` 부재 검증.
   - cap: 1MB 초과 시 `itemsTruncated`/`itemsTotalCount` (`carousel.handler.spec.ts:424-453`).
   - **미세 누락** (2026-06-25 재확인, 잔여):
     - **resumed 단계 핸들러 테스트 없음** — handler 가 직접 관여하지 않으므로 정상. (e2e 또는 execution-engine 통합 테스트에서 검증).
     - per-item 버튼 + dynamic 모드의 `buttonItemMap` 매핑 검증 직접 케이스 여전히 부재 — `carousel.handler.ts:139-148` (dynamic itemButtons 생성) + `:165-173` (cap 후 `buttonItemMap` 채움) 의 cap 적용 후 인덱스 정합 검증 unit 테스트가 누락. cap 테스트(`carousel.handler.spec.ts:424-453`) 는 itemButtons 없는 케이스만 다뤄 cap 발동 시 `buttonItemMap` 정합성 회귀 위험 잔존.

7. **횡단 일관성 (Presentation 5종)**:
   - Carousel/Chart/Template: handler 가 직접 HTML/SVG snapshot 생성 안 함 (`output.rendered` 부재) — frontend client-side 렌더. 일관됨.
   - **Table**: `table.handler.ts:139-143` 에서 `renderHtml(...)` 호출 + `:156` 의 `payload.rendered` 가 surface — Carousel/Chart 와 비대칭 (`output.rendered` 유지). plan README §"가장 빈번한 부적절 패턴" 2번 항목 명시.
   - `_shared/button.types.ts:60` 의 `validateButtons` 은 Carousel/Table/Chart/Template 4종에서 동일 호출 — 글로벌 버튼 검증 일관성 확보. Carousel 만 per-item 버튼 추가 (`validateCarouselItemButtons`).
   - 모두 `meta.interactionType: 'buttons'` (Form 만 `'form'`) 일관.

8. **구현 품질**:
   - XSS: `sanitizeUrl` (`:24-27`) 이 여전히 `javascript:` 스킴만 reject — `data:`/`vbscript:` 는 image field 에서 무방어 (2026-06-25 잔여). 단 ItemDef 의 `image` 는 frontend `<img src>` 에서 사용되므로 `data:` 는 일반적으로 허용 가능. spec §1 ItemDef 표는 "javascript: 스킴은 sanitize 됨" 만 명시. **비대칭 심화**: link 버튼 URL 검증은 이제 `carousel.schema.ts:372` 의 `validateCarouselItemButtons` 가 `javascript`/`data`/`vbscript` 3종 모두 reject — image field 만 javascript-only 로 남음.
   - 재개 토큰 검증: 엔진 책임 — 핸들러는 미관여.
   - 큰 dataset: 1MB cap 적용 (`:156`), `buttonItemMap` 도 cap 이후 인덱스 기준 (`:165-173`) — dangling 매핑 방지.
   - dead code 없음. `rawConfig ?? config` fallback (`:184`) escape hatch.

## 종합 개선안 (2026-05-16)

- [x] (spec) §5.4-A/B JSON 예시에 `config.maxItems` (dynamic 모드) raw echo 포함 여부 명시. — ✅ (2026-06-25) spec §5.1 (`spec/4-nodes/6-presentation/1-carousel.md:163`) + §5.4-B (`:254`) JSON 예시에 `"maxItems": 10` 포함, §5.1 필드 표(`:181`)도 echo 명시. PR #440/#516 (spec audit sync).
- [x] (impl) `carousel.handler.ts` 의 `configEcho` 에 `rawConfig.maxItems` 추가. — ✅ (2026-06-25) `carousel.handler.ts:193` `maxItems: rawConfig.maxItems` (D1 explicit-enumeration baseline). 근거 schema: `carousel.schema.ts:263-276`.
- [x] (spec) §"진단" 의 **`config.buttonConfig` 위치 결정**. — ✅ (2026-06-25) spec 이 surface 표(`spec/4-nodes/6-presentation/1-carousel.md:236-237,280`)에서 `buttonConfig.buttons`/`buttonItemMap` 출처를 `runtime` 으로 명시하고 §4 footnote(`:144`)로 frontend 일관 재구성 근거를 문서화 — **config 위치 유지** 채택 (meta 이동 미선택). PR #440/#516.
- [ ] (impl) per-item 버튼 + cap 발동 시 `buttonItemMap` 인덱스 정합성 unit 테스트 추가 — `carousel.handler.spec.ts` 의 cap 테스트 (`:424-453`) 가 여전히 itemButtons 없는 케이스만 다룸 (2026-06-25 잔여). 회귀 방지 위해 itemButtons 가 있고 cap 발생하는 케이스 보강. 근거: `carousel.handler.ts:139-148` (생성) + `:165-173` (매핑).
- [ ] (impl) `sanitizeUrl` (`carousel.handler.ts:24-27`) 이 `data:` / `vbscript:` 도 reject 하도록 확장 검토 — link 버튼 URL 은 `carousel.schema.ts:372` 가 3종 모두 reject 하므로 item image 만 javascript-only 로 비대칭 잔존 (2026-06-25). 단, image URL 의 `data:` 는 사용성 측면에서 유지 결정 가능 — spec §1 ItemDef footnote 에 정책 명시.
