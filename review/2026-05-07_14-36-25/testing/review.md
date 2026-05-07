## 발견사항

### [CRITICAL] `assistant-message.test.ts` 파일이 누락됨
- **위치**: plan 문서 `ai-assistant-pending-config-mcp-multi.md` TODO 항목 / `assistant-message.tsx`
- **상세**: plan 문서가 명시적으로 `frontend/src/components/editor/assistant-panel/assistant-message.test.ts`에 `mcp-server-selector multi-confirm 시 McpServerRef 객체 배열로 매핑되는지` 테스트를 요구하고 있다. `buildPickerSubmissionValue`는 exported 함수로 4개 분기(single / kb-selector multi / mcp-server-selector multi / 비정상 fallback)를 갖지만, 이 diff에 해당 테스트 파일이 존재하지 않는다.
- **제안**: `buildPickerSubmissionValue` 단위 테스트를 별도로 추가할 것.
  ```ts
  it("mcp-server-selector: maps ids to McpServerRef objects", () => {
    const result = buildPickerSubmissionValue("mcp-server-selector", {
      mode: "multi", ids: ["int-1", "int-2"]
    });
    expect(result).toEqual([
      { integrationId: "int-1", includeResources: true, includePrompts: true },
      { integrationId: "int-2", includeResources: true, includePrompts: true },
    ]);
  });
  ```

---

### [WARNING] `mcp-server-selector` rehydrate 상태 (`currentValue` 객체 배열) 테스트 누락
- **위치**: `candidate-picker.test.tsx`
- **상세**: `extractSelectedIds`는 `{integrationId: string}[]` 형태(MCP 실제 저장값)를 처리하는 분기를 갖는다. KB rehydrate(`currentValue: ["kb-1", "kb-2"]`)는 테스트되지만, MCP rehydrate(`currentValue: [{integrationId: "int-mcp-1", ...}]`) 케이스는 없다. "확정됨" 버블에서 `int-mcp-1` raw id 대신 `GitHub MCP` 라벨이 표시되는지 검증하지 않는다.
- **제안**:
  ```ts
  it("enters '✓ 설정됨' and shows label when currentValue is MCP object array (rehydrate)", () => {
    render(<CandidatePicker
      field={{ field: "mcpServers", widget: "mcp-server-selector",
               label: "MCP Servers", selectionMode: "multi",
               candidates: [{ id: "int-mcp-1", label: "GitHub MCP" }] }}
      currentValue={[{ integrationId: "int-mcp-1", includeResources: true, includePrompts: true }]}
      onConfirm={vi.fn()} />);
    expect(screen.getByRole("status")).toBeDefined();
    expect(screen.getByText(/GitHub MCP/)).toBeDefined();
  });
  ```

---

### [WARNING] 체크박스 전체 해제 후 Confirm 버튼 재비활성화 테스트 누락
- **위치**: `candidate-picker.test.tsx` — multi-select describe 블록
- **상세**: 사용자가 체크박스를 선택 후 다시 해제하면 `selectedIds`가 다시 비어 Confirm 버튼이 `disabled`로 돌아가야 한다. 이 경로가 테스트되지 않는다.
- **제안**: 기존 "renders a checkbox list" 테스트에 토글 해제 스텝 추가하거나 별도 케이스 작성.

---

### [WARNING] `buildPickerSubmissionValue` fallback 분기 미테스트
- **위치**: `assistant-message.tsx:buildPickerSubmissionValue`
- **상세**: `selection.mode === 'multi'`이면서 widget이 scalar인 비정상 경우에 `selection.ids[0] ?? ""`를 반환하는 fallback은 "실제로 도달하지 않는다"는 주석이 있으나, 코드로 존재하는 한 커버가 없다.
- **제안**: `buildPickerSubmissionValue` 테스트에 unknown-multi fallback 케이스 포함.

---

### [INFO] `error-degradation` 테스트 블록이 `mcp-server-selector`를 명시적으로 커버하지 않음
- **위치**: `candidate-lookup.service.spec.ts` — `error degradation` describe
- **상세**: 공유된 try-catch 경로이므로 동작은 동일하지만, `mcp-server-selector`가 새로 추가된 widget임을 감안하면 명시적 케이스 1개가 미래 회귀에 대한 안전망이 된다.
- **제안**: 기존 error degradation 테스트와 동일한 패턴으로 widget만 `mcp-server-selector`로 교체한 케이스 추가.

---

### [INFO] `selectionMode: undefined` legacy fallback이 묵시적으로만 검증됨
- **위치**: `candidate-picker.test.tsx`
- **상세**: 기존 테스트들(amber box, single select)은 `selectionMode` 없이 렌더하여 묵시적으로 'single' fallback을 테스트하고 있으나, "legacy payload에서 `selectionMode`가 없을 때 단일선택으로 동작한다"는 명시적 테스트는 없다.
- **제안**: `// review W-1` legacy 케이스와 같이 명시적인 legacy-compat 테스트 1개 추가.

---

## 요약

전반적으로 테스트 구조는 양호하다. `detect-pending-user-config`, `candidate-lookup.service`, `candidate-picker` 세 핵심 유닛 각각에 신규 widget 케이스가 추가되었고, `selectionMode` 매핑 로직도 독립 describe 블록으로 검증된다. 그러나 plan 문서가 명시한 `assistant-message.test.ts`가 이 diff에 존재하지 않아 `buildPickerSubmissionValue`의 MCP 객체 변환 로직이 전혀 테스트되지 않는 것이 가장 큰 공백이며, MCP rehydrate(`{integrationId}[]` 형태 currentValue)의 라벨 표시 경로도 누락되어 있다.

## 위험도

**MEDIUM** — 핵심 비즈니스 로직(`buildPickerSubmissionValue`의 MCP 객체 매핑)이 미테스트이고 plan에서 요구한 테스트 파일이 미제출 상태이나, 기존 picker·lookup 단위 테스트 커버리지 자체는 충실하다.