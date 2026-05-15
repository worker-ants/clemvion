## 유지보수성 코드 리뷰

### 발견사항

---

**[WARNING] `pickItemFieldWidget` 함수가 `schema-form.tsx`의 `pickWidget`과 중복**
- 위치: `widgets.tsx:155-180`, `schema-form.tsx:31-60`
- 상세: 두 함수는 동일한 로직(widget 선택 순서: registry → enum → type → fallback)을 완전히 복제하고 있습니다. 향후 위젯 타입 추가 시 두 곳을 모두 수정해야 하는 동기화 부담이 발생합니다.
- 제안: `schema-form.tsx`의 `pickWidget`을 공용 유틸로 분리하거나, `widgets.tsx`에서 직접 `import`하여 사용하세요.

---

**[WARNING] `humanize` 함수가 `widgets.tsx`와 `schema-form.tsx` 양쪽에 중복 정의됨**
- 위치: `widgets.tsx:182-188`, `schema-form.tsx:62-68`
- 상세: 완전히 동일한 구현이 두 파일에 존재합니다.
- 제안: `auto-form/utils.ts` 등으로 추출 후 공유 사용.

---

**[WARNING] `TableGridWidget`의 `value` 파라미터 계약이 불명확**
- 위치: `table-grid-widget.tsx:32`
- 상세: `WidgetProps.value`는 `unknown` 타입이지만 이 위젯은 `{ columns, rows, mode }`를 기대합니다. 그러나 실제 Table 노드의 schema에서 `table-grid` 위젯에 바인딩되는 필드가 없습니다 — `table.schema.ts`는 `columns`, `rows`를 각각 개별 필드로 선언하고 있어, 이 위젯이 어떤 값을 받는지 계약이 모호합니다.
- 제안: 위젯 JSDoc에 어떤 상위 config 구조를 기대하는지 명시하거나, 전용 props 타입을 정의하세요.

---

**[WARNING] `selector-widgets.tsx`의 주석이 실제 구현과 불일치**
- 위치: `selector-widgets.tsx:21-30`
- 상세: `ButtonListWidget`과 `TableGridWidget`의 JSDoc에 "placeholder that delegates to ... Until then, renders as UnsupportedWidget"이라고 작성되어 있으나, 실제로는 이미 구현된 위젯을 re-export하고 있습니다. 오해를 유발하는 stale comment입니다.
- 제안: 주석을 제거하거나 "Delegates to ButtonListEditor / TableGridWidget" 수준으로 간략히 수정하세요.

---

**[WARNING] `collapsible` 플래그의 그룹 전파 로직이 취약**
- 위치: `schema-form.tsx:79-93` (`groupEntries`)
- 상세: `collapsible`이 `true`인 entry가 그룹 중간에 등장하면 기존 그룹을 `collapsible: true`로 전환합니다. 반대로 첫 entry가 `collapsible: false`, 나중 entry가 `true`면 그룹이 collapsible로 바뀌지만, `false → true → false` 같은 혼합 시나리오에서 의도가 불명확합니다.
- 제안: `collapsible`은 그룹의 첫 번째 entry에서만 결정하거나, schema 수준에서 필드별이 아닌 그룹별로 선언하는 방식을 고려하세요.

---

**[INFO] `carousel.schema.ts`의 `clearFields` 목록에 필드 오탈자 가능성**
- 위치: `carousel.schema.ts:97-106`
- 상세: `clearFields`에 `'itemButtons'`가 포함되어 있는데, schema 상의 실제 필드명과 일치하는지 확인이 필요합니다 (schema에는 `itemButtons`로 선언되어 있어 현재는 맞지만, 필드명 변경 시 런타임 오류 없이 조용히 실패합니다).
- 제안: `clearFields`는 타입 안전성이 없으므로, 상수로 추출하거나 향후 타입 체크 유틸 도입을 고려하세요.

---

**[INFO] `button-list-widget.tsx`와 `selector-widgets.tsx`의 역할 중복**
- 위치: `button-list-widget.tsx`, `selector-widgets.tsx:21-25`
- 상세: `ButtonListWidget`이 별도 파일(`button-list-widget.tsx`)에 구현되어 있고, `selector-widgets.tsx`에서 단순 re-export합니다. 진입점이 두 개가 되어 어디서 import해야 하는지 혼란스럽습니다.
- 제안: `selector-widgets.tsx`에 인라인으로 구현하거나, re-export를 유지하되 실제 구현 위치를 명확히 문서화하세요.

---

**[INFO] `StructuredItemForm`에서 `isFieldVisible`에 전달하는 `item` context**
- 위치: `widgets.tsx:207-233`
- 상세: 하위 form의 `visibleWhen`은 item 내부 필드를 기준으로 평가됩니다. 이는 의도된 동작이지만, 상위 config 값에 의존하는 가시성 규칙은 작동하지 않습니다. 현재 사용 사례에서는 문제없으나, 향후 중첩 가시성이 필요할 때 예상치 못한 동작을 유발할 수 있습니다.
- 제안: JSDoc에 "visibility evaluation is scoped to the item's own fields" 명시.

---

### 요약

전반적으로 auto-form의 schema 기반 렌더링으로의 마이그레이션 방향은 올바르며, visibility DSL 확장, 그룹핑, collapsible section 등 유지보수성 개선에 기여하는 변경들입니다. 다만 `pickWidget`/`humanize` 함수의 중복 정의, `TableGridWidget`의 암묵적 value 계약, stale JSDoc 주석 등 소규모 유지보수 부채가 누적되고 있습니다. 특히 widget 선택 로직 중복은 향후 위젯 추가 시 동기화 누락으로 이어질 수 있는 **실질적인 위험**이므로 조기 정리가 권장됩니다.

### 위험도
**LOW**