## 발견사항

### WARNING: `TableGridWidget`이 등록되었으나 실제 소비자 없음
- **위치**: `widget-registry.ts` + `table-grid-widget.tsx` + `table.schema.ts`
- **상세**: `WIDGET_REGISTRY`에 `'table-grid': TableGridWidget`이 등록되었으나, `table.schema.ts`의 어떤 필드도 `widget: 'table-grid'`를 사용하지 않음 (`columns`, `rows` 모두 `widget: 'field-array'` 유지). 게다가 `TableGridWidget`은 `value`를 `{ columns, rows, mode }`가 포함된 단일 객체로 받으나, 실제 스키마에서 이 세 필드는 분리된 최상위 필드임 — API 계약 자체가 현재 구조와 불일치. `table` 노드는 override 레지스트리에 계속 남아 있음 (`TableConfig`).
- **제안**: 해당 위젯을 실제로 연결하는 커밋과 함께 도입하거나, 그 전까지는 등록 자체를 보류

### WARNING: `selector-widgets.tsx`의 JSDoc 주석이 구현 현실과 불일치
- **위치**: `selector-widgets.tsx` 25~35행
- **상세**: `ButtonListWidget`에 "Until then, renders as UnsupportedWidget"이라고 되어 있지만 실제로는 완전히 구현된 위젯이 export됨. `TableGridWidget`도 동일. 코드를 읽는 사람이 혼란을 겪을 수 있음.
- **제안**: 주석을 실제 구현 상태를 반영하도록 업데이트

### WARNING: `CarouselConfig` 함수가 dead code로 남음
- **위치**: `presentation-configs.tsx` (전체 파일에 `CarouselConfig` export 잔존)
- **상세**: `override-registry.ts`에서 `CarouselConfig` import와 `carousel` 항목이 제거되었으나, `presentation-configs.tsx`에서 `CarouselConfig` 함수 자체는 삭제되지 않음. 현재 아무 곳에서도 import되지 않는 dead code.
- **제안**: `CarouselConfig` 및 관련 로컬 타입/헬퍼(`CarouselItem`, `ItemButtonsConfig`, `carouselItemId`)도 함께 제거

### INFO: `conditionDefSchema.prompt` 위젯 변경 — 잠재적 UX 회귀
- **위치**: `ai-agent.schema.ts` conditionDefSchema
- **상세**: `prompt` 필드가 `widget: 'textarea'`에서 `widget: 'text'`(단일 행 input)로 변경됨. Condition prompt는 일반적으로 긴 텍스트이므로 의도적 변경인지 불분명.
- **제안**: 의도적 변경이라면 무시. 아니라면 `textarea` 또는 `expression` 위젯으로 유지

### INFO: `AiAgentConfig` 컴포넌트가 dead code 가능성
- **위치**: `ai-configs.tsx` (미포함 파일)
- **상세**: `override-registry.ts`에서 `AiAgentConfig` import가 제거됨. `ai-configs.tsx` 내 해당 컴포넌트가 다른 곳에서 사용되지 않는다면 dead code.
- **제안**: `ai-configs.tsx`에서 `AiAgentConfig` 정의도 함께 제거하거나 확인

---

## 요약

이 변경 세트는 auto-form 시스템 강화 및 AI Agent/Carousel 노드의 스키마 주도 렌더링 마이그레이션이라는 일관된 목표 하에 이루어졌으며, 전체적인 방향성과 내부 일관성은 적절하다. 다만 `TableGridWidget`이 registry에 등록되었음에도 실제 스키마에 연결되지 않아 동작하지 않는 dead code 상태이며, 이를 감추는 오해의 소지 있는 JSDoc 주석 문제가 동반된다. 또한 `CarouselConfig`와 `AiAgentConfig` 컴포넌트의 정리가 미완료로, override 레지스트리에서 제거된 대상의 구현 코드가 소스에 잔류한다.

## 위험도

**LOW** — 기능 회귀 위험은 낮으나 미완성 연결(`table-grid` 위젯)과 dead code 잔류가 향후 유지보수 혼란을 초래할 수 있음.