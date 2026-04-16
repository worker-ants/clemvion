### 발견사항

- **[INFO]** `lucide-react` 아이콘 추가 사용 (`ChevronDown`, `ChevronRight`)
  - 위치: `schema-form.tsx:2`, `presentation-configs.tsx:4`
  - 상세: 이미 프로젝트에 설치된 `lucide-react` 패키지에서 추가 아이콘만 import. 새 패키지 추가 없음.
  - 제안: 문제 없음.

- **[INFO]** 내부 모듈 의존 구조 변경 — `button-list-editor.tsx` 추출로 공유
  - 위치: `presentation-configs.tsx`, `button-list-widget.tsx`, `selector-widgets.tsx`
  - 상세: `ButtonListEditor`와 `ButtonDef`가 `presentation-configs.tsx` 내부에서 `shared/button-list-editor.tsx`로 추출되어 두 경로에서 공유됨. 단방향 의존 구조가 유지됨(`auto-form → shared`, `node-configs → shared`).
  - 제안: 문제 없음. 오히려 중복 제거로 응집도 향상.

- **[INFO]** `selector-widgets.tsx`가 `button-list-widget.tsx`와 `table-grid-widget.tsx`를 re-export
  - 위치: `selector-widgets.tsx` 전체
  - 상세: 파일 목적(selector 위젯 모음)과 다른 widget들을 re-export하는 집합 파일로 사용되고 있어 파일명과 역할이 불일치함. `widget-registry.ts`에서 이 파일을 통해 4개 위젯을 import하는 간접 의존 구조.
  - 제안: 파일명을 `extra-widgets.tsx` 또는 `registry-widgets.tsx`로 변경하거나, `widget-registry.ts`에서 각 파일을 직접 import하는 것이 더 명확함. (Warning 수준은 아님)

- **[WARNING]** `TableGridWidget`의 의존성 계약 불일치
  - 위치: `table-grid-widget.tsx:28-32`, `table.schema.ts`
  - 상세: `TableGridWidget`은 `value`가 `{ columns, rows, mode }` 형태의 복합 객체라고 가정하지만, `table.schema.ts`에서는 `columns`, `rows`, `mode`가 각각 독립된 최상위 필드임. `widget-registry.ts`에 `table-grid`로 등록되어 있으나 현재 `table.schema.ts`에서는 이 위젯을 사용하지 않고 `field-array`를 사용하므로 실제로 호출되지 않음. 그러나 미래에 `table-grid` 위젯을 연결하면 데이터 구조 불일치로 즉시 오동작.
  - 제안: `TableGridWidget`의 `WidgetProps.value` 계약을 문서화하거나, 실제 스키마와 위젯 간 데이터 구조를 맞추는 어댑터 로직을 명시적으로 추가할 것.

- **[INFO]** `widgets.tsx`에서 `WIDGET_REGISTRY` 순환 참조 가능성 검토
  - 위치: `widgets.tsx:15`, `widget-registry.ts:1-17`
  - 상세: `widgets.tsx` → `WIDGET_REGISTRY` import, `widget-registry.ts` → `widgets.tsx` import. 순환 참조처럼 보이나 `pickItemFieldWidget` 함수가 런타임에 registry를 조회하는 방식이므로 번들러 수준에서 허용됨. 단, 모듈 초기화 순서에 따라 `WIDGET_REGISTRY`가 `undefined`일 수 있는 edge case가 있음.
  - 제안: `pickItemFieldWidget`을 `schema-form.tsx`의 `pickWidget`과 통합하거나, registry 대신 직접 타입 기반 분기로 대체하면 순환 의존 제거 가능.

---

### 요약

이번 변경은 모두 프로젝트 내부 모듈 간 의존 관계 재구성이며, **새로운 외부 패키지는 전혀 추가되지 않았다.** 기존에 사용 중이던 `lucide-react`, `zod` 등의 활용 범위만 확장됐고, 라이선스·취약점·번들 크기에 대한 리스크는 없다. 주요 의존성 설계 이슈는 두 가지다: (1) `selector-widgets.tsx` 파일이 이름과 맞지 않는 위젯들을 re-export하는 집합 파일로 변질되어 내부 의존 구조가 불명확해졌고, (2) `TableGridWidget`이 스키마 구조와 다른 복합 객체를 `value`로 가정하는 계약 불일치가 잠재적 버그 원인이 될 수 있다. 두 이슈 모두 현 시점에서는 런타임 오류를 일으키지 않으나, 향후 `table-grid` 위젯 연결 시 즉시 문제로 표면화될 수 있다.

### 위험도

**LOW**