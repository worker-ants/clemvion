# 아키텍처(Architecture) 리뷰

리뷰 대상: `multiselect-widget` 변경 세트 (6 파일)
날짜: 2026-05-26

---

## 발견사항

### [INFO] MultiSelectWidget 과 SelectWidget 의 옵션 파싱 로직 중복
- **위치**: `widgets.tsx` — `SelectWidget` (L805-826), `MultiSelectWidget` (L837-884)
- **상세**: 두 위젯 모두 `ui?.options ?? (Array.isArray(schema.enum) ? ...)` 패턴으로 rawOptions 를 구성하고 `translateBackendOptionLabel` 로 번역한다. `MultiSelectWidget` 은 `schema.items?.enum` 을 추가로 지원하지만 나머지 파이프라인은 동일하다. 현재는 위젯이 두 개뿐이어서 중복 유지 비용이 낮지만, 옵션 소스 우선순위 규칙이 변경되면 두 곳을 함께 수정해야 한다.
- **제안**: `resolveOptions(schema: JsonSchemaNode, ui?: UiHint, locale: Locale): { value: string; label: string }[]` 순수 함수를 `utils.ts` 또는 별도 `option-utils.ts` 에 추출해 두 위젯이 공유하게 한다. 단일 책임 원칙(SRP) 관점에서 "옵션 소스 결정 로직"을 위젯 렌더링에서 분리한다.

---

### [INFO] toggle 함수가 컴포넌트 본문에 인라인 정의됨
- **위치**: `widgets.tsx` L859-663 (`MultiSelectWidget` 내 `toggle`)
- **상세**: `toggle` 은 순수 변환 로직(`string[] × string → string[]`)이므로 컴포넌트 외부의 순수 함수 또는 커스텀 훅으로 추출 가능하다. 현재 구조에서는 매 렌더마다 클로저가 재생성되나 `useCallback` 없이 사용해도 하위 컴포넌트(`CheckboxField`) 로 직접 전달되어 불필요한 재렌더 리스크가 존재한다.
- **제안**: `useCallback`으로 메모이즈하거나 외부 순수 함수(`toggleArrayValue(arr, val)`)로 분리한다. 단 CheckboxField 구현이 `React.memo` 로 감싸져 있지 않다면 실질적 영향은 없으므로 LOW 이하 조치로 족하다.

---

### [INFO] widget-resolver.ts 의 런타임 주입 패턴 — 명시적 설계이나 가시성 제한
- **위치**: `widget-resolver.ts` (전체), `widget-registry.ts` L627 (`registerWidgets(WIDGET_REGISTRY)`)
- **상세**: 순환 의존성 차단을 위해 `widget-resolver.ts` 가 모듈-레벨 뮤터블 상태(`let registry`)를 사용하는 늦은 등록(lazy injection) 패턴을 채택했다. 주석에 의도가 명시되어 있어 아키텍처 결정으로 인정되나, `registry` 가 `null` 인 채로 `resolveWidget`이 호출될 경우 silently `undefined` 를 반환한다. `MultiSelectWidget` 이 `WIDGET_REGISTRY` 에 새로 등록됨에 따라 registry 초기화 전 호출 방어가 유지되는지 테스트에서는 확인되지 않는다.
- **제안**: 설계 자체는 적절하다. `resolveWidget` 호출 시 `registry === null` 이면 개발 환경에서 `console.warn` 또는 `throw new Error` 를 추가해 초기화 누락을 조기 발견할 수 있도록 고려하면 좋다.

---

### [INFO] MultiSelectWidget 이 `schema.items?.enum` 과 `schema.enum` 을 함께 지원하는 fallback 분기
- **위치**: `widgets.tsx` L847-852
- **상세**: `schema.items.enum` (array-of-enum 패턴) 을 우선하고 `schema.enum` (flat enum 패턴) 을 fallback으로 두는 구조는 `JsonSchemaNode` 타입 정의와 실제 AI 노드 스키마(`ARRAY_ENUM_SCHEMA`) 와 일치한다. 현재 spec(`AI Common §11`) 의 `systemContextSections` 는 `array` + `items.enum` 패턴이므로 추가 fallback 은 방어적 처리다. 이 로직이 `SelectWidget` 에는 없어 두 위젯의 지원 스키마 형태가 비대칭이나, `select` 는 단일 값 선택이므로 `items.enum` 이 의미 없어 의도적 차이로 볼 수 있다.
- **제안**: 추가 조치 불필요. 단 `resolveOptions` 추출 시 `supportsItemsEnum: boolean` 파라미터로 차이를 명시적으로 문서화할 것.

---

### [INFO] 테스트가 전역 store(`useLocaleStore`) 상태를 `beforeEach` 에서 직접 조작
- **위치**: `multi-select-widget.test.tsx` L69-71
- **상세**: `useLocaleStore.getState().setLocale("ko")` 를 `beforeEach` 에서 호출해 전역 상태를 설정한다. 이 패턴은 테스트 간 상태 누출 위험이 있다(`en` 로케일 테스트가 `ko` 리셋을 하지 않으면 후속 describe 블록에 영향 가능). 단일 describe 블록 내에서는 `beforeEach` 로 제어되므로 현재 코드 범위에서는 안전하지만, 향후 테스트 순서 의존성이 생길 수 있다.
- **제안**: `afterEach` 에서 locale 을 기본값으로 복원하거나, store 를 모킹(`vi.mock`)하는 방식으로 격리성을 강화하는 것을 검토한다. 아키텍처 관점에서 이는 테스트 레이어와 전역 상태 레이어 간 경계 문제다.

---

### [INFO] `UiWidget` 타입 union 과 `WIDGET_REGISTRY` Record 의 완전성 보장 구조
- **위치**: `types.ts` L1230-1249, `widget-registry.ts` L603-623
- **상세**: `WIDGET_REGISTRY: Record<UiWidget, ...>` 선언은 TypeScript 가 모든 `UiWidget` 리터럴에 대한 엔트리를 강제하므로, `"multiselect"` 를 `UiWidget` 에 추가하면서 `WIDGET_REGISTRY` 에도 누락 없이 추가된 것이 컴파일 타임에 검증된다. 이는 개방-폐쇄 원칙(OCP)을 만족하는 방향으로 확장이 이루어졌음을 의미한다 — 새 위젯 추가 시 타입 정의·레지스트리·구현 세 곳을 수정해야 하나 누락이 컴파일 오류로 즉시 감지된다.
- **제안**: 현재 구조 유지. 양호한 패턴이다.

---

## 요약

이번 변경 세트는 `UiWidget` 타입 확장 → `MultiSelectWidget` 구현 → `WIDGET_REGISTRY` 등록이라는 세 계층을 일관되게 잇는 단순하고 집중적인 수직 슬라이스다. 레이어 책임 분리(타입 정의는 `lib/node-definitions`, 렌더링 로직은 `auto-form/widgets`, 등록은 `widget-registry`, 순환 의존 해소는 `widget-resolver`)가 명확하게 유지되고, 기존 `SelectWidget` 의 아키텍처 관용구를 그대로 따라 코드베이스 일관성이 높다. 주요 아키텍처 리스크는 없으며, `SelectWidget` 과의 옵션 파싱 로직 중복 및 테스트 전역 상태 격리 미흡이 향후 확장 시 주의할 INFO 수준 항목으로 남는다. 순환 의존성은 `widget-resolver` 패턴으로 이미 해소되어 있고, 이번 변경이 해당 구조를 위반하지 않는다.

## 위험도

LOW
