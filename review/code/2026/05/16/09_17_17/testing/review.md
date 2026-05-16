# Testing Review — cafe24-fields-add-btn-d3f8a2

## 발견사항

- **[INFO]** 테스트 파일 신규 추가 — 버그 수정과 동시에 회귀 테스트 5건 작성
  - 위치: `frontend/src/components/editor/settings-panel/node-configs/__tests__/cafe24-config.test.tsx` (전체)
  - 상세: 이번 커밋이 수정한 핵심 버그(빈 key 행이 object 변환 시 소실되는 문제)를 직접 재현·검증하는 단위 테스트가 포함되어 있다. TDD 원칙에 따라 구현과 함께 제공된 점은 양호하다.
  - 제안: 현 상태 유지.

- **[INFO]** `ControlledCafe24` 래퍼 헬퍼를 활용한 현실적인 테스트 환경 구성
  - 위치: 라인 24–41
  - 상세: `useState`로 config를 관리하는 `ControlledCafe24` 헬퍼를 두어 실제 부모 컴포넌트가 props를 내려주는 방식을 재현한다. 이는 `Cafe24Config` 내부의 derived-state 재동기화 로직(`objectsEqual` → `setFieldRows` 경로)이 외부 변경에 응답하는지까지 테스트할 수 있는 구조다. 설계가 적절하다.
  - 제안: 현 상태 유지.

- **[WARNING]** undo/redo(외부 config 재설정) 경로에 대한 테스트 없음
  - 위치: `integration-configs.tsx` 라인 349–355 (`objectsEqual` 분기 — derived-state 재동기화)
  - 상세: `Cafe24Config`의 핵심 신규 로직 중 하나는 "외부 변경(undo/redo, 프로그래매틱 리셋)을 감지해 `fieldRows`를 재동기화"하는 경로다. 이 경로는 `objectsEqual(externalFields, lastPropagated)`가 `false`일 때 실행된다. 현재 테스트 5건 중 이 경로를 직접 커버하는 케이스가 없다. `ControlledCafe24`에 `resetConfig` prop을 추가하거나 `rerender`를 사용해 초기 config와 다른 props를 주입하는 케이스가 필요하다.
  - 제안: 다음 테스트 추가 권장:
    ```typescript
    it("resyncs rows when config.fields is replaced externally (undo/redo)", () => {
      const onChange = vi.fn();
      const { rerender } = render(
        <ControlledCafe24
          initial={{ resource: "product", operation: "product_list", fields: { shop_no: "1" } }}
          onChange={onChange}
        />,
      );
      expect(screen.getByDisplayValue("shop_no")).toBeInTheDocument();

      // Simulate undo — parent provides a completely different fields object.
      rerender(
        <Cafe24Config
          config={{ resource: "product", operation: "product_list", fields: { display: "T" } }}
          onChange={onChange}
        />,
      );
      expect(screen.queryByDisplayValue("shop_no")).not.toBeInTheDocument();
      expect(screen.getByDisplayValue("display")).toBeInTheDocument();
    });
    ```

- **[WARNING]** 삭제 버튼 특정 방식이 DOM 구조에 의존하는 취약한 패턴
  - 위치: 라인 141–151
  - 상세: `removeButton`을 찾는 로직이 `row.querySelector("button:not([data-state])")` → 실패 시 `candidateButtons[candidateButtons.length - 1]` 폴백 순서로 이루어진다. 두 전략이 동시에 존재하고 `removeButton ?? targetButton` 형태로 OR 연결되어 실제로 어느 버튼이 클릭되는지 테스트 코드만 보아서는 불분명하다. `data-testid`가 없어서 발생한 문제이며, KeyValueEditor나 행 컴포넌트에 `data-testid="remove-row"` 같은 접근자가 없으면 테스트가 DOM 구조 변경에 취약해진다.
  - 제안: KeyValueEditor의 삭제 버튼에 `data-testid="kv-remove"` 또는 `aria-label`(예: `"Remove row"`)을 추가하고 테스트에서 `getByRole("button", { name: /remove/i })` 또는 `getAllByTestId("kv-remove")[0]`로 선택하도록 개선한다. 현 시점에는 버그는 아니지만 KeyValueEditor 내부 마크업 변경 시 해당 테스트가 조용히 잘못된 버튼을 누를 위험이 있다.

- **[WARNING]** `objectsEqual` 함수에 대한 단위 테스트 없음
  - 위치: `integration-configs.tsx` 라인 311–322
  - 상세: `objectsEqual`은 derived-state 재동기화 여부를 결정하는 핵심 순수 함수다. 현재 테스트는 이 함수를 컴포넌트 통합 수준에서만 간접 검증한다. `null`/`undefined` 값, 숫자 vs 문자열 강제 변환(`String(a[k] ?? "")` 로직), 키 순서가 다른 두 객체, 한 쪽에만 있는 키 등 엣지 케이스가 직접 검증되지 않는다.
  - 제안: `objectsEqual`을 별도 유틸 파일로 추출하거나 현재 위치에서 named export로 노출해 독립 단위 테스트를 작성한다. 특히 `{ a: 0 }` vs `{ a: "0" }` 케이스 — `String(0)` = `"0"`, `String("0")` = `"0"` 이므로 동일로 판정되는 의도된 동작인지 확인이 필요하다.

- **[WARNING]** `normalizeCafe24Fields` 배열 입력 경로에 대한 테스트 없음
  - 위치: `integration-configs.tsx` 라인 279–286
  - 상세: `normalizeCafe24Fields`는 배열과 객체 두 형태를 모두 처리한다. 테스트 5건 모두 `config.fields`가 객체(`Record<string, unknown>`) 형태인 경우만 다룬다. 배열 형태의 `fields`가 마운트 시 올바르게 정규화되는지, 잘못된 형태(예: `null`, `string`, `Array` with missing `key` 필드)가 안전하게 처리되는지 커버되지 않는다.
  - 제안: 배열 형태의 `fields`로 초기화하는 테스트 케이스 추가:
    ```typescript
    it("initializes from array-shaped config.fields without crash", () => {
      render(
        <ControlledCafe24
          initial={{ fields: [{ key: "shop_no", value: "1" }] }}
          onChange={vi.fn()}
        />,
      );
      expect(screen.getByDisplayValue("shop_no")).toBeInTheDocument();
    });
    ```

- **[INFO]** `value` 필드 편집에 대한 테스트 없음
  - 위치: 테스트 파일 전체
  - 상세: 현재 테스트는 `key` 입력에 집중되어 있다. value 입력 변경 시 `config.fields[key]` 가 올바르게 업데이트되는지, ExpressionInput이 expression 모드와 literal 모드를 전환할 때 값이 보존되는지는 커버되지 않는다.
  - 제안: value 편집 케이스 1건 추가 권장 (CRITICAL 수준은 아니지만 핵심 편집 경로).

- **[INFO]** `beforeEach`에서 locale만 설정 — 다른 전역 상태 클린업 없음
  - 위치: 라인 109–111
  - 상세: `useLocaleStore.setState({ locale: "en" })`만 설정하고 테스트 간 스토어 전체를 초기화하지 않는다. 현재 테스트 5건은 locale 외 다른 zustand 스토어에 의존하지 않으므로 문제없지만, 향후 테스트 추가 시 이전 테스트의 스토어 상태가 누수될 수 있다. `afterEach(() => useLocaleStore.setState(initialState))` 패턴을 고려하면 격리가 더 견고해진다.
  - 제안: 필요 시 `afterEach`에 스토어 초기화 추가.

- **[INFO]** e2e 스킵 태그(`[skip-e2e]`) 사용 — 타당성 확인
  - 위치: 커밋 메시지
  - 상세: `[skip-e2e]` 태그가 "단일 컴포넌트 UI 수정, 백엔드/스펙/데이터 모델 변경 없음"을 근거로 적용되었다. 수정 내용이 UI 상태 관리 버그 수정에 국한되므로 e2e 스킵은 합리적이다. 다만 Cafe24 노드 Fields 편집 → 저장 → 재로드 주기가 실제 사용자 흐름에서 이 버그와 연관된다면 향후 e2e 회귀 케이스 추가를 고려할 수 있다.
  - 제안: 현재로서는 수용 가능. 향후 Cafe24 노드 e2e 시나리오 작성 시 Fields 추가/편집/삭제 흐름 포함 권장.

- **[INFO]** 테스트 격리 — 각 `it` 블록이 독립적으로 `render`를 호출하고 `cleanup`이 자동 적용됨
  - 위치: 전체 테스트 파일
  - 상세: Vitest + Testing Library 조합에서 `@testing-library/react`의 자동 cleanup이 `afterEach`에 등록되어 각 테스트가 독립적으로 실행된다. `vi.fn()`도 각 테스트마다 새 인스턴스를 사용한다. 테스트 간 상태 누수 위험은 낮다.
  - 제안: 현 상태 유지.

---

## 요약

테스트 관점에서 이번 변경은 버그 수정과 동시에 핵심 회귀 케이스를 포함한 5건의 단위 테스트를 추가한 점에서 TDD 원칙을 잘 따르고 있다. 버그를 직접 재현하는 케이스("Add 3회 클릭 → 3행 존재"), key 편집 후 round-trip 생존, 기존 행과의 공존, 삭제 동작을 각각 독립적인 테스트로 분리한 가독성도 양호하다. 그러나 핵심 신규 로직인 외부 config 재설정(undo/redo) 경로가 테스트되지 않았고, 삭제 버튼 특정 방식이 DOM 구조에 과도하게 의존하며, `objectsEqual` 순수 함수와 `normalizeCafe24Fields`의 배열 입력 경로가 직접 검증되지 않는 커버리지 갭이 존재한다. 이 세 가지는 WARNING 수준으로, 단기적 안정성에 위협이 되지는 않지만 향후 리팩토링이나 KeyValueEditor 마크업 변경 시 테스트가 무력화될 수 있다.

## 위험도

LOW
