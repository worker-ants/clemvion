## 발견사항

### **[WARNING]** 컨테이너 노드 위치 검증 부재
- **위치**: `custom-node.test.tsx` — `"renders container node summary in header"` (line ~147)
- **상세**: 헤더 vs 바디 렌더링 구분이 핵심 동작임에도 DOM 위치를 검증하지 않음. `screen.getByText("10x")`는 텍스트 존재만 확인하며, 실제로 헤더(`<div className="flex items-center gap-2 ...">`)에 렌더링되었는지 확인하지 않음. `"renders container node warning in body (not header)"` 테스트도 클래스명만 확인.
- **제안**:
  ```tsx
  it("renders container node summary in header", () => {
    const { container } = renderNode({ type: "loop", config: { count: "10" }, ... });
    const header = container.querySelector(".rounded-t-lg");
    expect(header).toHaveTextContent("10x");
    // body에는 없어야 함
    const body = container.querySelector(".relative.px-3");
    expect(body).not.toHaveTextContent("10x");
  });
  ```

---

### **[WARNING]** `isTruncated` 조건부 Tooltip 렌더링 미검증
- **위치**: `custom-node.test.tsx` — tooltip mock (line ~28–33), `custom-node.tsx:139`
- **상세**: 현재 `TooltipContent` 목(mock)은 항상 렌더링되므로, 컴포넌트 내 `{isTruncated && <TooltipContent>}` 조건 분기를 테스트할 수 없음. 40자 초과 텍스트에서만 TooltipContent가 나타나는지 검증이 전혀 없음.
- **제안**:
  ```tsx
  it("shows tooltip content only when text is truncated", () => {
    renderNode({
      type: "http_request",
      config: { method: "GET", url: "https://very-long-url-that-exceeds-forty-characters.example.com/api/v1/endpoint" },
    });
    expect(screen.getByTestId("tooltip-content")).toBeInTheDocument();
  });

  it("does not show tooltip content when text is short", () => {
    renderNode({
      type: "http_request",
      config: { method: "GET", url: "https://short.com" },
    });
    expect(screen.queryByTestId("tooltip-content")).not.toBeInTheDocument();
  });
  ```

---

### **[WARNING]** `tableSummary` `pagination: undefined` 동작 미검증
- **위치**: `node-config-summary.test.ts` — table describe 블록, `node-config-summary.ts:155`
- **상세**: `tableSummary`는 `if (pagination === false)`만 체크하므로 `pagination: undefined`도 `"· pagination"` 텍스트를 포함한 결과를 반환함. 이 기본 동작(pagination undefined → 표시)에 대한 테스트가 없어 의도인지 버그인지 불명확.
- **제안**:
  ```ts
  it("shows pagination when pagination is not set (default on)", () => {
    expect(getConfigSummary("table", {
      columns: [{ field: "name", label: "Name" }],
      // pagination 미설정
    })).toEqual({ text: "1 column · pagination", isWarning: false });
  });
  ```

---

### **[WARNING]** 노드 실행 상태(`nodeStatus`) 전혀 미테스트
- **위치**: `custom-node.test.tsx`, `custom-node.tsx:168–182`
- **상세**: `useExecutionStore` 목이 항상 `null`을 반환하므로 `running`/`completed`/`failed`/`skipped` 상태 렌더링(ring 클래스, 체크마크 아이콘, 느낌표 아이콘)이 전혀 테스트되지 않음. 새로운 summary 기능과 statusStyles 조합 렌더링도 검증 안 됨.
- **제안**: `useExecutionStore` mock을 selector를 존중하도록 변경하거나, 각 상태별 렌더 테스트 추가 필요.
  ```tsx
  vi.mock("@/lib/stores/execution-store", () => ({
    useExecutionStore: (selector: (s: unknown) => unknown) =>
      selector({ nodeStatuses: mockNodeStatuses }),
  }));
  ```

---

### **[WARNING]** `merge` 부분 설정 시나리오 미테스트
- **위치**: `node-config-summary.test.ts` — merge describe 블록
- **상세**: `"uses defaults when partially configured"` 테스트 이름이 오해를 유발하며, 실제로는 두 필드가 모두 제공됨. `inputCount`만 있거나 `strategy`만 있는 실제 부분 설정 케이스(→ WARNING 반환)가 미검증.
- **제안**:
  ```ts
  it("shows warning when only inputCount is provided", () => {
    expect(getConfigSummary("merge", { inputCount: 2 })).toEqual(NOT_CONFIGURED);
  });
  it("shows warning when only strategy is provided", () => {
    expect(getConfigSummary("merge", { strategy: "wait_all" })).toEqual(NOT_CONFIGURED);
  });
  ```

---

### **[INFO]** `carouselSummary` titleField 없는 dynamic 모드 미테스트
- **위치**: `node-config-summary.test.ts` — carousel describe 블록, `node-config-summary.ts:135`
- **상세**: mode가 `dynamic`이고 `titleField`가 없을 때 `layout`만 반환하는 코드 경로가 테스트되지 않음.
- **제안**:
  ```ts
  it("formats layout only when titleField is absent in dynamic mode", () => {
    expect(getConfigSummary("carousel", { layout: "card", mode: "dynamic" }))
      .toEqual({ text: "card", isWarning: false });
  });
  ```

---

### **[INFO]** `codeSummary` 비JavaScript 언어 fallback 미테스트
- **위치**: `node-config-summary.test.ts`, `node-config-summary.ts:121`
- **상세**: `LANG_DISPLAY`에는 `javascript`만 등록되어 있고 다른 언어는 `charAt(0).toUpperCase() + slice(1)` fallback 사용. `python`, `typescript` 등에 대한 테스트 없음.
- **제안**:
  ```ts
  it("capitalizes unknown language name", () => {
    expect(getConfigSummary("code", { language: "python", code: "print(1)" }))
      .toEqual({ text: "Python · 1 line", isWarning: false });
  });
  ```

---

### **[INFO]** `pdfSummary` 기본값(default) 동작 미테스트
- **위치**: `node-config-summary.test.ts`, `node-config-summary.ts:164`
- **상세**: `pageSize`, `orientation`, `fileName`이 없을 때 각각 `"A4"`, `"portrait"`, `"document.pdf"` 기본값 적용 로직이 검증되지 않음.

---

### **[INFO]** `isDisabled` / `selected` 노드 렌더링 미테스트
- **위치**: `custom-node.test.tsx`
- **상세**: `data.isDisabled = true`일 때 `opacity-50` 적용, `selected = true`일 때 ring 클래스 적용이 테스트 없음. 새 summary 기능과의 조합 렌더링도 미검증.

---

### **[INFO]** `WorkflowCanvas` `TooltipProvider` 래핑 미테스트
- **위치**: `workflow-canvas.tsx:368`, 테스트 파일 없음
- **상세**: `TooltipProvider`가 없으면 Tooltip이 동작하지 않는데, WorkflowCanvas 컴포넌트 테스트 자체가 없어 이 통합을 검증할 방법이 없음.

---

## 요약

`node-config-summary.ts`와 `truncateSummary`에 대한 단위 테스트는 25개 노드 타입을 망라하여 전반적으로 충실하며, 구조도 명확하다. 그러나 `CustomNode` 컴포넌트 테스트에서는 이 기능의 핵심 동작인 **헤더/바디 위치 구분**과 **툴팁 조건부 렌더링**이 현재 mock 구조 때문에 실질적으로 검증되지 않는 것이 주요 문제다. 또한 `useExecutionStore`가 항상 `null`을 반환하도록 고정되어 실행 상태 UI가 전혀 커버되지 않고, `tableSummary`의 기본 pagination 동작과 여러 유틸리티 함수의 코드 경로 일부가 테스트 공백으로 남아 있다.

## 위험도

**MEDIUM**