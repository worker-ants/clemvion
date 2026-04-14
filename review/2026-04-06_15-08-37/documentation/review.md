### 발견사항

- **[INFO]** `ButtonDef` 인터페이스에 JSDoc 없음
  - 위치: 8-14라인
  - 상세: `type`, `style` 필드의 가능한 값(`"link" | "port"`, `"primary" | "secondary" | "outline" | "danger"`)과 각 값의 동작 차이가 타입 시그니처만으로는 명확하지 않음. 특히 `type: "port"`가 무엇을 의미하는지(워크플로우 포트 연결) 코드만 봐서는 알기 어려움.
  - 제안:
    ```ts
    /**
     * Defines a single interactive button in the ButtonBar.
     * - type "port": triggers workflow port navigation via onPortButtonClick
     * - type "link": opens an external URL via onLinkButtonClick (does not advance execution)
     */
    interface ButtonDef { ... }
    ```

- **[INFO]** `ButtonBarProps`에 JSDoc 없음
  - 위치: 16-23라인
  - 상세: `timeout`이 초 단위인지 밀리초 단위인지, `onContinueClick`이 언제 호출되는지(link-only 버튼 구성 시 암묵적 Continue 버튼), `disabled`의 의미(실행 중 비활성화 등)가 불명확함.
  - 제안:
    ```ts
    /**
     * @param timeout - countdown in **seconds** before timeoutAction fires
     * @param timeoutAction - "continue" advances execution; "cancel" aborts it
     * @param onContinueClick - called when the implicit Continue button is clicked
     *   (rendered automatically when all buttons are type "link")
     */
    ```

- **[INFO]** `__continue__` 매직 스트링에 주석 없음
  - 위치: 100-103라인
  - 상세: `buttonId: "__continue__"`는 명시적 버튼이 아닌 내부 센티넬 값임. 이 값이 상위 컴포넌트나 서버에서 특별 처리되는지 알 수 없음.
  - 제안: 인라인 주석 추가 — `// sentinel id — not a real button id, used to record implicit continue action`

- **[INFO]** `hasOnlyLinkButtons` 파생 로직에 설명 없음
  - 위치: 76라인
  - 상세: link-only 구성일 때 Continue 버튼이 암묵적으로 추가되는 UX 정책이 코드에서 처음 등장함. 이 정책의 근거를 알 수 없음.
  - 제안: 한 줄 주석 — `// link buttons don't advance execution, so we inject a Continue button to unblock the flow`

- **[INFO]** `STYLE_CLASSES` 상수에 설명 없음
  - 위치: 25-33라인
  - 상세: CSS 변수 기반 스타일 매핑의 존재 이유(CSS-in-JS 대신 Tailwind CSS 변수 사용)가 문서화되어 있지 않음. 유지보수 시 혼란 가능성.
  - 제안: 짧은 주석으로 의도 명시 — `// Maps ButtonDef.style to Tailwind classes using design-token CSS variables`

---

### 요약

`ButtonBar` 컴포넌트는 인라인 주석이 핵심 구간(`// Countdown timer`, `// Link clicks don't change execution state`, `// Render clicked state`)에 적절히 배치되어 있어 기본적인 가독성은 확보되어 있습니다. 다만 공개 인터페이스(`ButtonDef`, `ButtonBarProps`)에 JSDoc이 없어 컴포넌트를 처음 사용하는 개발자가 `type: "port"` vs `type: "link"`의 실행 흐름상 차이, `timeout`의 단위, `onContinueClick`의 호출 조건을 코드를 직접 읽지 않고는 파악하기 어렵습니다. 또한 link-only 구성 시 Continue 버튼이 자동 삽입되는 UX 정책과 `__continue__` 센티넬 값의 의미는 인라인 주석으로 명시되어야 합니다. README나 API 문서 업데이트는 이 컴포넌트가 내부 UI 컴포넌트이므로 필수는 아니지만, 워크플로우 버튼 인터랙션 스펙 문서(`spec/`)에 ButtonBar의 동작 정책(link vs port, timeout, implicit continue)이 반영되어 있는지 확인이 필요합니다.

### 위험도

**LOW**