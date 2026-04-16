## 성능 코드 리뷰

### 발견사항

---

**[WARNING] `groupEntries` 함수의 불필요한 이중 순회**
- 위치: `schema-form.tsx` — `groupEntries` + 렌더 내부 `visibleFields` 필터
- 상세: `groupEntries(entries)`로 그룹핑한 뒤, 렌더 시점에 각 그룹마다 다시 `group.entries.filter(...)` 호출. 이후 `countGroupValues`도 `group.entries`를 순회. 동일 entries에 대해 최대 3번 순회가 발생.
- 제안: `groupEntries` 단계에서 visibility 필터링을 하지 말고, 렌더 루프에서 한 번만 순회하여 `visibleFields`와 `count`를 동시에 산출.

```tsx
const visibleFields = group.entries.filter((e) => !e.ui?.hidden && isFieldVisible(e.ui, value));
const count = visibleFields.reduce((n, e) => { /* ... */ }, 0); // 한 번만 순회
```

---

**[WARNING] `StructuredItemForm`에서 `fieldEntries` 정렬이 매 렌더마다 재계산**
- 위치: `widgets.tsx` — `StructuredItemForm` 컴포넌트
- 상세: `Object.entries(props).map(...).sort(...)` 가 메모이제이션 없이 매 렌더에 실행. 아이템 목록이 길거나(Carousel static 모드의 다수 아이템) 아이템당 필드가 많을 때, 각 항목 수정마다 N개 아이템 × M개 필드의 정렬이 전체 재실행.
- 제안: `useMemo`로 `fieldEntries`를 메모이제이션. `itemSchema`가 변경되지 않으면 재계산 불필요.

```tsx
const fieldEntries = useMemo(() => (
  Object.entries(props).map(...).sort(...)
), [itemSchema]);
```

---

**[WARNING] `SchemaForm.entries` memoization이 `value` 변경에도 무관하게 재사용되지만, `groups` memoization 의존성이 `entries`에만 걸려 있어 `value` 기반 visibility가 memoized groups에 반영되지 않는 구조**
- 위치: `schema-form.tsx:153–154`
- 상세: `groups`는 `entries`만 의존하고, visibility 평가는 렌더 시점에 `value`를 참조함. 이 자체는 정확하나, `value`가 바뀔 때마다 `groups.map(...)` 내부의 `visibleFields` 필터가 항상 재실행되는 것은 피할 수 없음. 현재 구조는 정확성은 맞지만 개선 여지가 있음 — **실질적 성능 문제는 낮음**.

---

**[INFO] `countGroupValues`가 collapsible 섹션에서만 필요하지만 매 렌더마다 호출됨**
- 위치: `schema-form.tsx` — 렌더 내 `countGroupValues` 호출
- 상세: non-collapsible 그룹에도 잠재적으로 `visibleFields.length === 0` 체크 이후에 분기되어 있어 현재는 실질 낭비가 없음. 다만 collapsible 그룹의 `count`가 매 value 변경마다 재계산됨. 필드 수가 적으므로 현재는 무시 가능 수준.

---

**[INFO] `widget-registry.ts`에서 같은 파일(`selector-widgets`)에서 4번 개별 import**
- 위치: `widget-registry.ts:17–20`
- 상세: 번들러 tree-shaking 관점에서 동일 모듈을 여러 줄로 나눠 import해도 최종 번들에는 영향 없음. 단, 코드 가독성상 단일 import로 통합하는 것이 관례.
- 제안:
```ts
import { LlmConfigSelectorWidget, KbSelectorWidget, ButtonListWidget, TableGridWidget } from "./selector-widgets";
```

---

**[INFO] `TableGridWidget`이 `mode`를 `value` prop이 아닌 내부 data에서 읽는 구조**
- 위치: `table-grid-widget.tsx:28`
- 상세: 위젯이 단일 `value` prop으로 `{ columns, rows, mode }` 전체를 받는 구조. `TableConfig`는 실제로 `columns`, `rows`, `mode`가 schema의 최상위 별도 필드임에도 불구하고 이 위젯이 상위 `config` 전체를 받아 처리하는 경우 데이터 중복 또는 불일치 가능성 존재. 현재 `override-registry`에서 `TableConfig`는 여전히 old override를 사용하므로 실제 호출 경로 확인 필요.

---

### 요약

전반적으로 이번 변경은 schema-driven auto-form 확장으로, 성능 관련 구조적 문제는 없음. 주요 관심사는 `StructuredItemForm` 내 매 렌더 시 배열 정렬 재계산과, `schema-form.tsx`의 그룹 처리에서 동일 entries를 최대 3회 순회하는 부분으로 배열 크기가 작은 설정 폼에서는 체감 영향이 낮지만, Carousel static 모드처럼 아이템이 많아질 경우 누적될 수 있음. `useMemo` 적용과 단일 순회 통합으로 간단히 해결 가능.

### 위험도

**LOW**