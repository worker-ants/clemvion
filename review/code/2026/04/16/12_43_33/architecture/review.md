### 발견사항

---

**[CRITICAL] `widgets.tsx`와 `widget-registry.ts` 간 순환 의존성**
- 위치: `widgets.tsx:14`, `widget-registry.ts:14-17`
- 상세: `widgets.tsx`가 `WIDGET_REGISTRY`를 import하고, `widget-registry.ts`가 `FieldArrayWidget`, `UnsupportedWidget` 등을 `widgets.tsx`에서 import함. 번들러에 따라 런타임 오류 또는 undefined 참조가 발생할 수 있음.
- 제안: `FieldArrayWidget`이 `pickItemFieldWidget`에서 `WIDGET_REGISTRY`를 직접 참조하는 대신, widget 선택 로직을 별도 `pick-widget.ts`로 분리하여 순환 참조를 끊을 것.

---

**[CRITICAL] `TableGridWidget`의 계약(Contract) 불일치**
- 위치: `table-grid-widget.tsx:30-33`, `table.schema.ts`
- 상세: `TableGridWidget`은 `{ columns, rows, mode }`가 번들된 단일 `value`를 기대하지만, `tableNodeConfigSchema`에서 `columns`, `rows`, `mode`는 개별 최상위 필드임. 이 위젯은 현재 어떤 필드에도 `widget: 'table-grid'`가 지정되어 있지 않아 dead code 상태. `override-registry.ts` 주석("column/row sync requires cross-field side effects")과도 모순됨.
- 제안: `table-grid` 위젯의 적용 방식을 명확히 결정하거나 제거할 것. 크로스-필드 동기화가 필요하다면 override 방식을 유지하고 위젯 등록을 제거해야 함.

---

**[WARNING] `CarouselConfig` 고아 코드(Orphaned Code)**
- 위치: `presentation-configs.tsx` (전체 컨텍스트 중반부)
- 상세: `override-registry.ts`에서 `carousel`이 제거되었으나 `CarouselConfig` 컴포넌트와 관련 타입(`CarouselItem`, `ItemButtonsConfig`)이 `presentation-configs.tsx`에 여전히 남아있음. 불필요한 코드가 번들에 포함되고 혼란을 야기함.
- 제안: `CarouselConfig` 및 관련 코드 제거.

---

**[WARNING] `groupEntries`의 순서 의존적 그루핑 로직**
- 위치: `schema-form.tsx:76-89`
- 상세: 동일한 `group` 이름을 가진 필드가 *연속적*일 때만 같은 그룹으로 묶임. 필드 순서가 바뀌거나 `order` 값이 잘못 설정되면 동일 그룹명이 여러 분리된 섹션으로 렌더링됨. 현재 `aiAgentNodeConfigSchema`에서 `conditions`(order:20)와 `temperature`(order:30)가 각각 다른 group에 속해 문제 없지만, 구조적으로 취약함.
- 제안: 그룹을 이름으로 집계(Map 사용)한 뒤 렌더링하거나, 연속 배치 가정을 문서화할 것.

---

**[WARNING] `clearFields`를 스키마(백엔드)에 선언하는 레이어 책임 혼재**
- 위치: `carousel.schema.ts:96-109`, `node-component.interface.ts:110`
- 상세: `clearFields`는 순수 UI 상태 초기화 동작(모드 전환 시 관련 필드 리셋)을 백엔드 스키마 DSL에 표현함. 이는 렌더링 정책이 도메인 모델에 침투하는 SRP 위반임. 백엔드는 이 속성을 유효성 검사에 활용하지 않으므로 실질적 가치도 없음.
- 제안: `clearFields`를 `UiHint`에서 제거하고 override 컴포넌트 또는 프런트엔드 전용 config 파일로 이동할 것.

---

**[WARNING] `collapsible` 속성의 의미적 모호성 (필드-레벨 vs. 그룹-레벨)**
- 위치: `node-component.interface.ts:108`, `schema-form.tsx:80-84`
- 상세: `collapsible`은 `UiHint`(필드 단위)에 정의되어 있으나 실제로는 그룹 전체의 동작을 제어함. 그룹 내 첫 번째 필드에 `collapsible: true`가 설정되면 이후 필드에는 없어도 그룹 전체가 collapsible이 됨. 이는 DSL의 의미가 필드-스코프와 그룹-스코프 간에 불명확하게 혼재함을 의미함.
- 제안: `collapsible`을 필드 레벨이 아닌 그룹 수준의 별도 메타데이터 구조로 분리하거나, 그루핑 DSL을 `{ group: string; collapsible?: boolean }` 객체로 리팩터링할 것.

---

**[WARNING] `humanize` 함수 중복 정의**
- 위치: `schema-form.tsx:61-67`, `widgets.tsx:176-182`
- 상세: 동일한 `humanize` 함수가 두 파일에 독립적으로 정의됨. 로직 변경 시 두 곳을 모두 수정해야 함.
- 제안: `auto-form/utils.ts`로 추출하여 공유할 것.

---

**[WARNING] `selector-widgets.tsx`의 불필요한 중간 계층**
- 위치: `selector-widgets.tsx:24-33`
- 상세: `ButtonListWidget`과 `TableGridWidget`을 각각의 파일에서 re-export하는 barrel 파일로, 추가적인 indirection 없이 `widget-registry.ts`에서 직접 import해도 동일한 결과를 얻을 수 있음. 주석("Phase 2A", "Phase 2D")이 잔류하며 완료된 작업임을 암시함.
- 제안: `widget-registry.ts`에서 각 위젯을 직접 import하고 `selector-widgets.tsx`의 barrel 역할을 정리할 것.

---

**[INFO] `pickItemFieldWidget`과 `pickWidget`(schema-form)의 로직 중복**
- 위치: `widgets.tsx:155-184`, `schema-form.tsx:24-52`
- 상세: 두 함수가 동일한 타입→위젯 매핑 로직을 구현함. 유지보수 시 양쪽을 모두 업데이트해야 함.
- 제안: 공통 `pickWidget` 유틸리티로 통합할 것.

---

**[INFO] `visibleWhen` DSL의 복합 조건(AND/OR) 미지원**
- 위치: `visibility.ts`, `node-component.interface.ts:93-97`
- 상세: 현재 단일 규칙만 지원함. 향후 "mode === 'dynamic' AND pagination === true" 같은 복합 조건이 필요할 경우 인터페이스 변경이 불가피함.
- 제안: 단기적으로 현 설계를 유지하되, 확장 시 `{ all: [...rules] }` / `{ any: [...rules] }` 형태로 wrapping 가능하도록 파싱 레이어(`isFieldVisible`)를 캡슐화할 것. 현재 구조는 이미 함수로 잘 격리되어 있어 변경 비용은 낮음.

---

### 요약

이번 변경은 수동 override 컴포넌트에서 스키마 기반 auto-form으로의 명확한 아키텍처 방향성을 가지며, `visibleWhen` DSL 확장·그루핑·clearFields 등 선언적 UI 제어 능력이 크게 향상되었음. 그러나 `widgets.tsx`↔`widget-registry.ts` 간 순환 의존성과 `TableGridWidget`의 계약 불일치는 런타임 오류 가능성이 있는 Critical 이슈이며, 고아 코드(`CarouselConfig`)와 레이어 책임 혼재(`clearFields` in backend schema), `humanize`·`pickWidget` 중복 정의 등 Warning 수준의 설계 부채가 다수 존재함. 전반적인 방향성은 올바르나, 순환 참조 해소와 `TableGridWidget` 계약 명확화가 선행되어야 안정적인 확장이 가능함.

### 위험도

**HIGH**