# Testing Review — MultiSelectWidget

## 발견사항

### [INFO] `within` import 미사용
- 위치: `multi-select-widget.test.tsx` line 38
- 상세: `import { render, screen, fireEvent, within } from "@testing-library/react"` 에서 `within` 이 import 되어 있으나 테스트 내부에서 한 번도 사용되지 않는다. 현재 체크박스를 `screen.getByLabelText` 로 식별하므로 불필요한 import 이다. lint 경고가 발생할 수 있고 코드 읽는 사람에게 "scope 제한 쿼리를 사용하는 테스트가 있겠구나" 하는 혼동을 준다.
- 제안: `within` 제거. 또는 추후 "동일 레이블이 여러 곳에 나타날 경우를 대비" 주석 한 줄로 의도 표명.

---

### [INFO] `locale` 상태가 테스트 간 누출될 위험 — `afterEach` 리셋 없음
- 위치: `multi-select-widget.test.tsx` line 69–71, line 240–241
- 상세: `beforeEach` 에서 locale 을 `"ko"` 로 설정하므로 매 테스트 전 ko 로 초기화된다. 그러나 "renders raw English labels under `en` locale" 테스트(line 240)는 `useLocaleStore.getState().setLocale("en")` 을 호출한 뒤 이를 되돌리지 않는다. vitest 의 기본 동작상 같은 `describe` 블록이라면 다음 `beforeEach` 가 ko 로 재설정하므로 현재 테스트 순서에서는 안전하다. 하지만 `--randomize` 플래그나 파일 분리 실행 시 `en` 상태가 다른 `describe` 블록 또는 다른 파일의 테스트로 유출될 수 있다. `useLocaleStore` 가 zustand 모듈 수준 싱글턴이기 때문에 테스트 간 공유된다.
- 제안:
  ```ts
  afterEach(() => {
    useLocaleStore.getState().setLocale("ko");
  });
  ```
  또는 `beforeEach` 를 file 최상위 describe 밖 `beforeAll` 없이 각 테스트 안에서 명시적으로 locale 을 세팅하는 방식 중 하나를 선택.

---

### [WARNING] "rapid double-toggle" 테스트가 실제로 더블-클릭을 테스트하지 않음
- 위치: `multi-select-widget.test.tsx` lines 259–279
- 상세: 테스트 이름은 "emits the same option only once even on rapid double-toggle" 이지만, 실제 코드는 `fireEvent.click` 을 **한 번만** 호출한 뒤 `toHaveBeenCalledTimes(1)` 을 어설트한다. 코드 내 주석에도 "두 번째 클릭은... 다시 emit 한다"고 적혀 있으나 두 번째 클릭은 실제로 실행되지 않는다. 따라서 이 테스트는 "단 한 번의 클릭에 onChange 가 1회 호출된다"만 검증하며, 제목이 암시하는 idempotency/dedup 동작을 검증하지 않는다. 테스트 이름과 구현 사이 불일치는 리뷰어와 미래 유지보수자에게 혼란을 준다. 실제로 더블-클릭 시나리오를 의도했다면:
  ```ts
  fireEvent.click(checkbox); // 1st: ["time"] → [] emit
  expect(onChange).toHaveBeenNthCalledWith(1, []);
  fireEvent.click(checkbox); // 2nd: value prop 아직 ["time"] → [] 다시 emit
  expect(onChange).toHaveBeenNthCalledWith(2, []);
  expect(onChange).toHaveBeenCalledTimes(2);
  ```
  라는 패턴이 필요하다. 또는 테스트 이름을 "single click emits onChange exactly once" 처럼 실제 동작과 일치시켜야 한다.
- 제안: 테스트를 두 가지로 분리. (1) "single click calls onChange once" — 현재 구현 유지, 제목 수정. (2) "stale-value double-click emits twice with both values from the same prop base" — 실제 두 번 클릭 + 각 결과 검증.

---

### [INFO] `widget-registry.ts` 에 대한 독립 등록 테스트 없음
- 위치: `widget-registry.ts` lines 36/561
- 상세: `WIDGET_REGISTRY["multiselect"]` 가 실제로 `MultiSelectWidget` 을 가리키는지 단언하는 테스트가 없다. registry 키-값 매핑은 단순 선언이지만 오타나 향후 리팩토링으로 키가 오버라이드되거나 누락될 수 있다. 기존 auto-form `__tests__/` 의 다른 파일들도 registry 를 직접 테스트하지 않으므로 팀 관례에서 registry 테스트를 생략하는 것이 의도적일 수 있다. 하지만 최소한 smoke 어설션 한 줄로 등록 여부를 보장할 수 있다.
- 제안: 기존 관례를 따라 생략하거나, 원하면 `schema-form.test.ts` 또는 별도 파일에:
  ```ts
  import { WIDGET_REGISTRY } from "../widget-registry";
  import { MultiSelectWidget } from "../widgets";
  it("WIDGET_REGISTRY maps multiselect to MultiSelectWidget", () => {
    expect(WIDGET_REGISTRY["multiselect"]).toBe(MultiSelectWidget);
  });
  ```

---

### [INFO] `schema.enum` 폴백(배열 최상위 enum) 케이스 커버리지 갭
- 위치: `widgets.tsx` lines 668–671 (구현), `multi-select-widget.test.tsx` 전체
- 상세: `MultiSelectWidget` 의 `rawOptions` 추출 로직은 세 가지 경로를 가진다.
  1. `ui?.options` 있을 때 (테스트 있음 — 대부분의 케이스)
  2. `schema.items?.enum` 있을 때 (테스트 있음 — "falls back to schema `items.enum`")
  3. `schema.enum` 있을 때 (`schema.items` 없이 최상위 `enum`) — **테스트 없음**
  세 번째 경로는 `SelectWidget` 패턴을 일관성을 위해 추가한 것으로 보이나 실제로 multiselect 가 top-level enum 을 받는 유효한 시나리오인지 spec 에서 불명확하다. 만약 사용 가능한 경로라면 테스트가 필요하고, 불필요하다면 코드에서 제거하는 것이 커버리지 갭 오인을 방지한다.
- 제안: `{ type: "array", enum: ["a", "b"] }` (items 없음) 케이스에 대한 테스트를 추가하거나, 해당 분기가 unreachable 임을 주석으로 명시.

---

### [INFO] `value` 에 중복 항목이 있을 때 동작 미검증
- 위치: `multi-select-widget.test.tsx` 전체
- 상세: `selected.includes(optionValue)` 로직은 중복 값이 있는 배열(`["time", "time"]`)을 uncheck 할 때 첫 번째 `"time"` 만 제거하는 `filter` 결과(`["time"]`)를 emit 한다. 이 동작이 의도된 것인지 명확하지 않으며, DB 에서 malformed 데이터가 올 경우 다소 예상치 못한 UX 가 된다. 비배열 입력 방어와 같은 맥락에서 다루면 좋다.
- 제안: 필수는 아니나 회귀 방어를 위해 `value={["time", "time"]}` 케이스에서 uncheck 시 `["time"]` 이 emit 됨을 어설션하는 테스트 추가 고려.

---

### [INFO] locale 스토어 mock 없이 실제 zustand 상태 사용
- 위치: `multi-select-widget.test.tsx` lines 39, 70, 241
- 상세: 테스트가 `useLocaleStore` 를 실제 zustand 모듈로 임포트해 직접 상태를 설정한다. 이 방식은 mock 없이도 잘 동작하며 실제 i18n 번역 함수를 거치므로 구현 밀착도(fidelity)가 높다. `translateBackendOptionLabel` 의 실제 KO 매핑(`OPTION_LABEL_KO`) 이 테스트에서 검증되는 부가효과도 있다. Mock 을 쓰는 것보다 오히려 바람직한 선택이다. 다만, `backend-labels.ts` 의 `OPTION_LABEL_KO` 에서 번역 키가 삭제·변경될 경우 이 테스트가 직접 깨지므로 regression guard 역할을 겸한다는 점을 주석에 명시하면 유지보수성이 올라간다.

---

### [INFO] 접근성(aria) 속성 테스트 부재
- 위치: `multi-select-widget.test.tsx` 전체, `widgets.tsx` `MultiSelectWidget` 렌더 부분
- 상세: `FieldGroup` 에 `required` prop 이 전달될 때 렌더 결과에 `aria-required` 또는 `required` 어트리뷰트가 붙는지 테스트되지 않는다. 다른 위젯(`TextWidget`)은 `aria-required={required || undefined}` 를 직접 `<Input>` 에 전달하는데, `MultiSelectWidget` 은 이를 `FieldGroup` 에 전달하고 `CheckboxField` 에는 전달하지 않는다. `CheckboxWidget` 은 `CheckboxField` 에 `required` 를 전달하는 반면 `MultiSelectWidget` 의 `CheckboxField` 에는 `required` 가 누락되어 있다. aria 일관성 갭이 될 수 있다.
- 제안: `required={true}` 를 전달했을 때 체크박스 그룹에 적절한 accessibility attribute 가 존재하는지 검증하는 테스트 1건 추가.

---

## 요약

`MultiSelectWidget` 에 대한 테스트 파일(`multi-select-widget.test.tsx`)은 핵심 기능(렌더링, 체크 상태 반영, toggle add/remove, i18n KO/EN, null/undefined/비배열 방어, enum fallback)을 실질적으로 잘 커버한다. 특히 edge case 로 간주되는 `undefined / null / non-array value` 처리와 스키마 enum fallback 경로를 별도 테스트로 명시한 점은 양호하다. 주요 문제는 "rapid double-toggle" 테스트의 이름과 구현 불일치(실제로 한 번만 클릭함) 로 테스트 의도가 왜곡되어 있으며, `locale` 상태가 `afterEach` 리셋 없이 공유 store 를 변이시켜 테스트 순서 의존성 위험이 있다. 나머지는 INFO 수준의 커버리지 갭 및 가독성 개선 사항이다.

## 위험도

LOW
