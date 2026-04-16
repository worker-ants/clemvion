## 발견사항

### [CRITICAL] Condition `id` 자동 생성 누락
- **위치**: `ai-agent.schema.ts` `conditionDefSchema` + `widgets.tsx` `FieldArrayWidget`
- **상세**: `conditionDefSchema.id`는 `z.string()` (`.optional()` 없음)이므로 필수값이지만, `FieldArrayWidget`이 새 항목 추가 시 `ui?.itemDefault ?? {}` 를 삽입합니다. `conditions` 필드의 UI hint에 `itemDefault`가 지정되어 있지 않아 새로 추가된 condition은 `id: undefined` 상태가 됩니다. 백엔드 zod 유효성 검증(`z.string()`)이 이를 거부하여 런타임 오류가 발생합니다.
- **제안**: conditions 필드에 `itemDefault: { id: crypto.randomUUID(), label: '', prompt: '' }` 추가, 또는 `conditionDefSchema.id`에 `.default(() => crypto.randomUUID())` 적용

---

### [WARNING] `CarouselConfig` 고아(orphan) 코드 잔존
- **위치**: `presentation-configs.tsx` (전체 파일 컨텍스트)
- **상세**: `override-registry.ts`에서 `CarouselConfig` import가 제거되었으나, `presentation-configs.tsx`에서 함수가 여전히 export되고 있습니다. 약 150줄의 dead code가 남아있으며, `ButtonListEditor` 이전 인라인 구현 코드도 포함됩니다.
- **제안**: `CarouselConfig` 함수 및 관련 타입(`CarouselItem`, `ItemButtonsConfig`, `carouselItemId`) 삭제

---

### [WARNING] `countGroupValues` 가 보이지 않는 필드도 집계
- **위치**: `schema-form.tsx:99-109` (`countGroupValues` 함수)
- **상세**: 접을 수 있는 섹션의 배지 카운트는 `group.entries` 전체를 순회하지만, `visibleWhen` 조건으로 숨겨진 필드나 `hidden: true` 필드의 값도 포함합니다. 예: `userPrompt`가 `multi_turn` 모드에서 숨겨져 있어도 설정된 값이 있으면 카운트에 포함됩니다.
- **제안**: `countGroupValues` 내부에서 `isFieldVisible(e.ui, value) && !e.ui?.hidden` 조건으로 필터링 후 집계

---

### [WARNING] `TableGridWidget` 인터페이스 설계 불일치
- **위치**: `table-grid-widget.tsx:30-35`
- **상세**: `TableGridWidget`은 `value`로 `{ columns, rows, mode }` 형태의 전체 config 객체를 받도록 설계되어 있습니다. 하지만 `SchemaForm`의 `renderField`는 각 위젯에 해당 필드의 값(`value[key]`)만 전달합니다. 현재는 Table 노드가 override registry에 남아있어 실제 문제가 발생하지 않으나, 향후 `table-grid` 위젯을 실제 필드에 연결하면 즉시 broken 상태가 됩니다.
- **제안**: 위젯 접근 방식을 재설계하거나, 테이블 마이그레이션 전까지 `UnsupportedWidget`으로 남겨두고 명시적 TODO 추가

---

### [WARNING] `selector-widgets.tsx` outdated 주석
- **위치**: `selector-widgets.tsx:19-25`
- **상세**: "placeholder that delegates to the ButtonListEditor extracted in Phase 2A. Until then, renders as UnsupportedWidget" 라고 되어 있으나, 실제로는 이미 완전히 구현된 컴포넌트를 re-export하고 있습니다. 이미 구현 완료된 코드에 미구현 암시 주석이 있어 혼란을 유발합니다.
- **제안**: 주석을 실제 상태에 맞게 업데이트

---

### [INFO] `AiAgentConfig` 고아 코드 추정
- **위치**: `frontend/src/components/editor/settings-panel/node-configs/ai-configs.tsx` (미검토)
- **상세**: `override-registry.ts`에서 `AiAgentConfig` import가 제거되었지만, `ai-configs.tsx`에 함수 정의가 남아있을 가능성이 높습니다.
- **제안**: `ai-configs.tsx`에서 `AiAgentConfig` 함수 삭제 여부 확인

---

### [INFO] `CollapsibleSection` 초기 상태가 항상 expanded
- **위치**: `schema-form.tsx:119`
- **상세**: `const [expanded, setExpanded] = useState(true)` — 접을 수 있는 섹션이 처음부터 펼쳐진 상태입니다. "Buttons", "Advanced" 같은 보조적 섹션도 항상 열려있어 UX 의도와 다를 수 있습니다.
- **제안**: 기획 의도에 따라 `useState(false)`로 변경 고려

---

## 요약

이번 변경은 auto-form 기반의 스키마 주도 설정 UI로의 대규모 마이그레이션으로, `ai_agent`와 `carousel` 노드를 override registry에서 제거하고, visibility DSL 확장(`notEquals`, `oneOf`), 그룹/섹션 기능, 구조화된 배열 아이템 렌더링 등을 도입한 기능적으로 의미 있는 변경입니다. 가장 심각한 문제는 **Condition 항목 추가 시 필수 `id` 필드가 자동 생성되지 않아** 백엔드 유효성 검증을 통과하지 못하는 것으로, AI Agent 노드의 Conditions 기능 전체가 사용 불가 상태입니다. `TableGridWidget`의 인터페이스 설계 불일치도 향후 테이블 마이그레이션 시 큰 리스크입니다. `CarouselConfig` dead code 정리도 필요합니다.

## 위험도

**HIGH**