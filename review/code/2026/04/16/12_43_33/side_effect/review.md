## 발견사항

---

### [WARNING] `widgets.tsx` ↔ `widget-registry.ts` 순환 임포트

- **위치**: `widgets.tsx:10`, `widget-registry.ts:14-17`
- **상세**: `widgets.tsx`가 `WIDGET_REGISTRY`를 `./widget-registry`에서 임포트하고, `widget-registry.ts`는 다시 `./widgets`에서 위젯들을 임포트합니다. 이는 순환 의존성입니다. `pickItemFieldWidget` 함수 내에서만 사용되기 때문에 번들러에 따라 런타임에는 동작할 수 있으나, 일부 SSR 환경이나 모듈 초기화 순서에 따라 `WIDGET_REGISTRY`가 `undefined`로 평가될 수 있습니다.
- **제안**: `pickItemFieldWidget`에 필요한 위젯 선택 로직을 `widget-registry.ts`와 별도의 `pick-widget.ts` 유틸리티로 분리하거나, `FieldArrayWidget` 내부에서 직접 위젯을 조건 분기로 선택하도록 변경

---

### [WARNING] Carousel `clearFields`로 인한 데이터 손실 회귀

- **위치**: `carousel.schema.ts:mode` 필드 `clearFields` 설정
- **상세**: 기존 `CarouselConfig.handleModeChange`는 `static` 모드로 다시 전환할 때 기존 `items`를 보존(`items: items.length ? items : []`)했습니다. 새 `clearFields: ['items', ...]` 방식은 모드 전환 시 항상 `items`를 삭제합니다. static → dynamic → static 전환 시 사용자가 입력한 슬라이드 항목이 모두 사라집니다.
- **제안**: `clearFields`에서 `items`를 제거하거나, `mode` 필드의 `clearFields`를 방향별로 다르게 적용하는 메커니즘 도입. 또는 Carousel을 auto-form 대신 override 컴포넌트로 유지

---

### [WARNING] `TableGridWidget`의 값 구조 불일치

- **위치**: `table-grid-widget.tsx:27-30`, `table.schema.ts`
- **상세**: `TableGridWidget`은 `value`가 `{ columns, rows, mode }` 형태의 중첩 객체라고 가정하고 동작합니다. 그러나 실제 `table.schema.ts`에서 `columns`, `rows`, `mode`는 최상위 분리 필드이며, 현재 어떤 스키마 필드도 `widget: 'table-grid'`를 사용하지 않습니다. 위젯이 등록(`WIDGET_REGISTRY`)되어 있어 추후 잘못 연결되면 즉시 데이터 구조 불일치가 발생합니다.
- **제안**: `TableGridWidget` 내부에 주석으로 "이 위젯은 단일 필드 값이 아닌 전체 config를 받아야 하므로 표준 SchemaForm 패턴과 호환되지 않음"을 명시하거나, `table-grid`를 registry에서 제거

---

### [INFO] `CarouselConfig` 데드 코드

- **위치**: `presentation-configs.tsx`, `override-registry.ts`
- **상세**: `CarouselConfig`가 `override-registry.ts`에서 제거되었으나 `presentation-configs.tsx`에 `export function CarouselConfig`로 여전히 남아 있습니다. 현재 어디서도 임포트되지 않는 데드 코드입니다.
- **제안**: `presentation-configs.tsx`에서 `CarouselConfig` 및 관련 `CarouselItem` 인터페이스, `carouselItemId` 전역 변수, `ItemButtonsConfig` 컴포넌트 제거

---

### [INFO] `carouselItemId` 전역 모듈 변수 잔존

- **위치**: `presentation-configs.tsx:let carouselItemId = 0;`
- **상세**: `CarouselConfig`가 더 이상 사용되지 않더라도, 파일에 `let carouselItemId = 0`이 남아 있어 모듈 레벨 변수가 지속됩니다. 위 데드 코드 정리 시 함께 제거되어야 합니다.

---

### [INFO] `countGroupValues`가 숨겨진 필드 값도 카운트

- **위치**: `schema-form.tsx:countGroupValues`
- **상세**: 접힌 섹션의 배지 숫자를 계산할 때 `group.entries`(모든 항목)를 사용합니다. `visibleWhen` 조건에 의해 현재 숨겨진 필드의 값도 카운트에 포함될 수 있어 실제 표시되는 필드 수보다 배지 수가 높게 나타납니다.
- **제안**: `entries.filter(e => !e.ui?.hidden && isFieldVisible(e.ui, value))`를 거친 항목만 카운트

---

### [INFO] `conditionDefSchema.prompt` 위젯 `textarea` → `text` 변경

- **위치**: `ai-agent.schema.ts:conditionDefSchema.prompt`
- **상세**: Condition의 prompt 필드가 다중 줄 입력에 적합한 `textarea`에서 단일 줄 `text` 위젯으로 변경되었습니다. 조건 프롬프트는 실제로 장문 입력이 필요한 경우가 많아 UX 회귀가 발생할 수 있습니다.
- **제안**: `textarea` 또는 `expression` 위젯 사용 고려

---

### [INFO] `selector-widgets.tsx` 내 stale 주석

- **위치**: `selector-widgets.tsx:21-28`
- **상세**: `ButtonListWidget`과 `TableGridWidget`에 대해 "placeholder that renders as UnsupportedWidget"이라는 주석이 있으나, 실제로는 실구현을 re-export하고 있습니다. 주석과 동작이 불일치합니다.
- **제안**: 주석 업데이트

---

## 요약

이번 변경의 핵심은 AI Agent와 Carousel 노드를 override 컴포넌트에서 스키마 기반 auto-form으로 마이그레이션하고, `visibleWhen`/`clearFields`/`group` 등 UI DSL을 확장한 것입니다. 전반적으로 설계 의도가 명확하고 인터페이스 변경은 하위 호환적이나, **Carousel 모드 전환 시 `items` 데이터 손실**(기존 보존 동작의 회귀)과 **`widgets.tsx` ↔ `widget-registry.ts` 순환 임포트**가 실질적인 위험입니다. `TableGridWidget`은 등록은 되었으나 실제 schema에 연결되지 않아 현재는 무해하지만, 추후 잘못된 사용 시 디버깅이 어려운 구조입니다.

## 위험도

**MEDIUM** — 순환 임포트는 환경에 따라 런타임 오류로 이어질 수 있고, Carousel clearFields 동작 변경은 사용자 데이터 손실을 유발하는 회귀입니다.