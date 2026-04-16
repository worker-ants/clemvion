## 문서화 코드 리뷰

### 발견사항

---

**[INFO] `selector-widgets.tsx` 주석이 구현 완료 이후에도 "placeholder" 표현을 유지함**
- 위치: `selector-widgets.tsx:20-29`
- 상세: `ButtonListWidget`와 `TableGridWidget`의 re-export 주석이 "placeholder that delegates to... Until then, renders as UnsupportedWidget"이라고 되어 있으나, 이미 실제 구현체로 교체되어 있음. 주석이 현재 상태와 불일치함.
- 제안:
  ```ts
  /** Auto-form widget wrapping ButtonListEditor for button arrays. */
  export { ButtonListWidget } from "./button-list-widget";

  /** Auto-form widget wrapping TableGridWidget for table column/row editing. */
  export { TableGridWidget } from "./table-grid-widget";
  ```

---

**[INFO] `table-grid-widget.tsx`의 JSDoc에서 `value` 형식 설명이 부정확함**
- 위치: `table-grid-widget.tsx:22-26`
- 상세: JSDoc이 "The widget value is `{ columns, rows, mode }`"라고 명시하지만, 실제로 이 위젯은 `columns`, `rows`, `mode`를 독립 필드로 받지 않음 — `mode`는 상위 `SchemaForm`이 관리하는 별도 필드임. `TableGridWidget`이 `mode`를 `data.mode`로 읽는 구조는 위젯의 책임 범위가 모호함을 내포하며, 문서도 이 의존 관계를 명확히 기술하지 않음.
- 제안:
  ```ts
  /**
   * Auto-form widget for Table node's columns + rows with cross-field sync.
   * Encapsulates column-row synchronization that cannot be expressed declaratively.
   *
   * NOTE: This widget reads `mode` from the parent config object passed as `value`,
   * so it must be used in a context where `value` contains the full table config.
   */
  ```

---

**[INFO] `widget-registry.ts` 주석에서 제거된 항목 목록이 불완전함**
- 위치: `widget-registry.ts:22-24`
- 상세: 이번 변경으로 `llm-config-selector`와 `kb-selector`가 `UnsupportedWidget`에서 실제 구현체로 이전되었으나, 주석은 "integrations, workflows, condition-builder"만 언급하며 이 변경 사실을 명확히 기술하지 않음. 현재 주석은 이전 상태를 올바르게 반영하고 있기는 하지만, 무엇이 _이전에_ unsupported였다가 구현되었는지 추적하기 어려움.
- 제안: 현행 수준으로 충분하나, 향후 `workflow-selector`, `condition-builder` 구현 시 동일한 패턴으로 주석 갱신 필요.

---

**[INFO] `override-registry.ts`의 마이그레이션 주석이 `carousel`은 설명하나 `ai_agent`는 이유가 누락됨**
- 위치: `override-registry.ts:66-67`
- 상세: `carousel`은 "migrated to auto-form (schema-driven)"으로 명시되어 있고, `table`은 "kept as override — column/row sync requires cross-field side effects"로 이유가 기술되어 있음. 반면 `ai_agent` 항목은 이유 없이 주석만 남아 있음.
- 제안:
  ```ts
  // AI — ai_agent migrated to auto-form; schema groups (Advanced, Multi Turn Settings, etc.) are expressive enough
  ```

---

**[INFO] `UiHint` 인터페이스 (`node-component.interface.ts`)에서 `clearFields`의 동작 범위가 불명확**
- 위치: `node-component.interface.ts:117`
- 상세: `clearFields` 주석이 "Field keys to clear from config when this field's value changes"로 기술되어 있으나, "어떤 변경에도" 동작하는지 아니면 "특정 값으로 변경될 때만" 동작하는지 명시되지 않음. 실제 구현(`schema-form.tsx`)에서는 값이 변경될 때마다 무조건 삭제하므로 주석과 일치하지만, 사용자가 조건부 동작을 기대할 수 있음.
- 제안:
  ```ts
  /**
   * Field keys to clear from config on every change to this field's value
   * (e.g. clearing mode-specific fields when the mode selector changes).
   */
  clearFields?: string[];
  ```

---

**[INFO] `frontend/src/lib/node-definitions/types.ts`의 `UiHint`에 새 필드 3개가 추가되었으나 일부는 JSDoc 없음**
- 위치: `types.ts:47-55`
- 상세: `itemDefault`, `group`, `collapsible`, `clearFields` 중 `itemDefault`만 JSDoc이 있고, `group`과 `collapsible`은 한 줄 설명이 있으나 `clearFields`는 단순 설명임. 백엔드의 `node-component.interface.ts`와 프론트엔드의 `types.ts`가 동일 타입을 중복 정의하고 있는 구조상, 두 파일의 JSDoc이 동기화되어 있어야 함 — 현재는 백엔드 쪽이 더 상세함.
- 제안: `types.ts`의 JSDoc도 백엔드 수준으로 맞춰 동기화. 특히 `visibleWhen`의 3가지 형식 설명 추가.

---

### 요약

이번 변경은 auto-form 위젯 시스템 확장 및 스키마 기반 UI 마이그레이션이라는 실질적인 구현 작업으로, 전반적으로 문서화 수준이 양호함. `node-component.interface.ts`의 `visibleWhen` DSL 확장 주석, `schema-form.tsx`의 `groupEntries` 함수 설명, `visibility.ts`의 규칙 형식 열거 등 핵심 로직에 인라인 문서가 충실히 작성되어 있음. 다만 `selector-widgets.tsx`의 "placeholder" 주석이 이미 구현 완료된 상태와 불일치하는 점, 백엔드와 프론트엔드 `UiHint` 타입 정의의 JSDoc 동기화 누락, `table-grid-widget.tsx`에서 `mode` 의존 관계 미기술 등 소규모 불일치가 존재함. 모두 기능 동작에는 영향 없는 INFO 수준이며 코드 변경 없이 주석 수정으로 해결 가능함.

### 위험도
**LOW**