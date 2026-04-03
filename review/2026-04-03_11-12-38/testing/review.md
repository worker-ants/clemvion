### 발견사항

- **[INFO]** `formatVariable` 함수의 단독 단위 테스트 없음
  - 위치: `node-config-summary.ts` - `formatVariable` 함수
  - 상세: `formatVariable`은 독립적인 헬퍼 함수이지만 `variableDeclarationSummary`를 통해서만 간접 테스트됨. 현재 테스트 파일에는 해당 함수를 직접 export하지 않으므로 단독 테스트는 불가능하나, 커버리지는 통합 경로로 충분히 확보됨.
  - 제안: `formatVariable`을 export하여 직접 단위 테스트하거나 현 상태 유지 (간접 커버리지로 충분하면 INFO 수준)

- **[WARNING]** `defaultValue`가 `"0"` (falsy 아닌 숫자 문자열) vs `""` (빈 문자열) 구분 테스트 부재
  - 위치: `node-config-summary.test.ts` - `variable_declaration summary` 블록
  - 상세: `formatVariable`에서 `defaultValue !== undefined && defaultValue !== ""`로 빈 문자열을 걸러내는 로직이 있음. 기존 테스트(line 175~179)에서 `defaultValue: ""`를 가진 항목을 테스트하지만, 출력 결과에서 `= ` suffix가 없는지를 명시적으로 검증하지 않음. 테스트 코드:
    ```ts
    // 현재: { name: "a", type: "string", defaultValue: "" }
    // 결과가 "a: string"이 되어야 함을 assert 하지 않음
    expect(result).toEqual({ text: "a: string, b: string, +1", isWarning: false });
    ```
    위 테스트는 `defaultValue: ""`가 표시되지 않음을 암묵적으로 검증하므로 통과하지만, 의도가 불명확함.
  - 제안: `defaultValue`가 빈 문자열일 때 출력에서 제외되는 것을 명시적으로 검증하는 케이스 추가
    ```ts
    it("omits empty defaultValue", () => {
      expect(getConfigSummary("variable_declaration", {
        variables: [{ name: "x", type: "string", defaultValue: "" }],
      })).toEqual({ text: "x: string", isWarning: false });
    });
    ```

- **[WARNING]** `variable_declaration`: `defaultValue`가 `undefined`인 경우 테스트 누락
  - 위치: `node-config-summary.test.ts` - `variable_declaration summary`
  - 상세: `formatVariable`은 `defaultValue !== undefined`를 체크하지만, `defaultValue` 프로퍼티가 아예 없는 경우(`undefined`)에 대한 명시적 테스트가 없음. line 165~170의 테스트가 이를 커버하나, `type`도 없고 `defaultValue`도 없는 최소 케이스 테스트 없음.
  - 제안:
    ```ts
    it("shows name only when type and defaultValue are absent", () => {
      expect(getConfigSummary("variable_declaration", {
        variables: [{ name: "x" }],
      })).toEqual({ text: "x", isWarning: false });
    });
    ```

- **[INFO]** `ExpressionInput`의 스크롤 동기화(`handleScroll`) 로직에 대한 테스트 없음
  - 위치: `expression-input.tsx` - `handleScroll` 콜백 (line ~215)
  - 상세: `highlightRef.scrollTop/scrollLeft`를 input 스크롤에 동기화하는 로직은 UI 행동 테스트가 필요하나, 현재 `ExpressionInput` 컴포넌트 테스트 파일이 확인되지 않음.
  - 제안: `@testing-library/react`를 사용한 컴포넌트 테스트에서 `multiline` 모드로 렌더링 후 scroll 이벤트 발생 시 overlay의 `scrollTop`이 동기화되는지 검증

- **[INFO]** `FormConfig`의 `required` 체크박스 추가에 대한 테스트 없음
  - 위치: `presentation-configs.tsx` - `FormConfig` 컴포넌트
  - 상세: `presentation-configs.tsx`에 대한 전용 테스트 파일이 존재하지 않는 것으로 보임. `required` 필드가 토글될 때 `onChange`가 올바른 config 객체를 받는지 검증 필요.
  - 제안: `FormConfig` 렌더 테스트 추가
    ```ts
    it("toggles required field", async () => {
      const onChange = vi.fn();
      render(<FormConfig config={{ fields: [{ name: "x", type: "text", label: "", required: false }] }} onChange={onChange} />);
      await userEvent.click(screen.getByRole("checkbox"));
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
        fields: [expect.objectContaining({ required: true })],
      }));
    });
    ```

---

### 요약

`node-config-summary.ts`의 변경(`formatVariable` 헬퍼 추출, 표시 한계 3→2 변경)에 대한 테스트는 전반적으로 잘 갱신되어 있으며, `+N` 임계값 변경(3→2)과 타입/기본값 표시 포맷도 새로운 케이스로 커버됨. 다만 `defaultValue`가 빈 문자열일 때와 `undefined`일 때를 명시적으로 구분하는 케이스가 부재하고, `ExpressionInput` 스크롤 동기화 및 `FormConfig`의 `required` 체크박스는 컴포넌트 레벨 테스트가 전무하여 회귀 안전망이 없다. 순수 유틸리티 함수 대비 UI 컴포넌트 계층의 테스트 커버리지 부재가 가장 큰 갭이다.

### 위험도

**LOW** — 핵심 비즈니스 로직(`variableDeclarationSummary`)은 충분히 테스트됨. UI 컴포넌트 변경에 대한 테스트 부재는 리그레션 위험이 있으나, 변경 범위가 좁고 단순한 UI 연결 코드에 해당.