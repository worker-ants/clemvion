# 테스트(Testing) Review Payload

본 파일은 orchestrator 가 테스트(Testing) reviewer 용으로 작성한 입력입니다. 다음 코드 변경을 테스트 관점에서 분석한다.
sub-agent 의 system prompt 에 정의된 호출 규약·등급 기준·출력 형식을 그대로
따르되, 분석 시 아래 "점검 관점" 을 빠짐없이 적용하세요. 결과는 `output_file`
인자에 review.md 로 Write 하고 호출자에게는 STATUS 한 줄만 반환합니다.

## 점검 관점 (테스트(Testing))

1. **테스트 존재 여부**: 변경 코드에 대한 테스트 존재·추가 필요성
2. **커버리지 갭**: 테스트로 커버되지 않는 코드 경로
3. **엣지 케이스 테스트**: 경계값·예외 상황·null 처리 테스트 필요 여부
4. **Mock 적절성**: mock/stub 사용 적절성, 실제 동작과의 괴리
5. **테스트 격리**: 테스트 간 의존성 없이 독립 실행 가능한지
6. **테스트 가독성**: 테스트 코드가 명확하고 의도를 잘 표현
7. **회귀 테스트**: 기존 테스트가 변경 후에도 유효한지
8. **테스트 용이성**: 코드가 테스트하기 쉬운 구조인지 (의존성 주입 등)

## 리뷰 대상 파일

### 파일 1: frontend/src/components/editor/settings-panel/node-configs/__tests__/cafe24-config.test.tsx
- 변경 유형: Review
- 언어: tsx

#### 변경된 코드
```
commit 6ceebadd3c31fff8894670fb1c4eab4d5389ac65
Author: worker-ants <admin@getit.co.kr>
Date:   Sat May 16 09:16:59 2026 +0900

    fix(node-configs/cafe24): keep newly added fields rows visible
    
    The Cafe24 node settings panel's `Fields` editor lost newly added rows
    the moment they were created. KeyValueEditor's "Add" button appended a
    blank `{key: "", value: ""}` row, but the onChange handler converted
    the list straight to `Record<string, unknown>` and dropped the
    empty-key entry — so the next render derived its list from the
    unchanged object and the new row was gone. The "추가" button appeared
    broken.
    
    Cafe24Config now maintains the editing rows in local React state
    initialized from `config.fields`. Mutations update the state and
    propagate the (still object-shaped) result upstream, preserving the
    backend contract. External resets (undo/redo, programmatic) trigger a
    derived-state re-sync during render.
    
    Added unit tests cover: clicking Add reveals a new row, typed keys
    persist into `config.fields`, multiple Add clicks accumulate rows
    independent of the object-form filter, removing rows mutates state
    correctly, and the empty-row visibility survives object conversion.
    
    consistency-check session: review/consistency/2026/05/16/09_03_04
    (BLOCK: NO — 5 checkers all NONE, 7 INFO suggestions).
    
    [skip-e2e] — single-component UI fix; backend / spec / data model
    unchanged.
    
    Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

diff --git a/frontend/src/components/editor/settings-panel/node-configs/__tests__/cafe24-config.test.tsx b/frontend/src/components/editor/settings-panel/node-configs/__tests__/cafe24-config.test.tsx
new file mode 100644
index 00000000..ce4795ef
--- /dev/null
+++ b/frontend/src/components/editor/settings-panel/node-configs/__tests__/cafe24-config.test.tsx
@@ -0,0 +1,178 @@
+import { describe, it, expect, vi, beforeEach } from "vitest";
+import { render, screen, fireEvent } from "@testing-library/react";
+import { useState } from "react";
+
+// IntegrationSelector pulls in react-query + the integrations API; stub it
+// so the Cafe24Config test stays focused on the local fields editor.
+vi.mock("../integration-selector", () => ({
+  IntegrationSelector: ({
+    label,
+    value,
+  }: {
+    label: string;
+    value: string;
+  }) => (
+    <div data-testid="integration-selector" data-value={value}>
+      {label}
+    </div>
+  ),
+}));
+
+import { Cafe24Config } from "../integration-configs";
+import { useLocaleStore } from "@/lib/stores/locale-store";
+
+function ControlledCafe24({
+  initial,
+  onChange,
+}: {
+  initial: Record<string, unknown>;
+  onChange: (next: Record<string, unknown>) => void;
+}) {
+  const [config, setConfig] = useState(initial);
+  return (
+    <Cafe24Config
+      config={config}
+      onChange={(next) => {
+        setConfig(next);
+        onChange(next);
+      }}
+    />
+  );
+}
+
+describe("Cafe24Config — Fields key-value editor", () => {
+  beforeEach(() => {
+    useLocaleStore.setState({ locale: "en" });
+  });
+
+  it("adds a new empty row when the Add button is clicked", () => {
+    const onChange = vi.fn();
+    render(
+      <ControlledCafe24
+        initial={{ resource: "product", operation: "product_list" }}
+        onChange={onChange}
+      />,
+    );
+
+    // Initially no field rows — only the "Add" button (placeholder shows on row).
+    expect(screen.queryByPlaceholderText(/shop_no/)).not.toBeInTheDocument();
+
+    // Click the editor's Add button. KeyValueEditor renders an "Add" button
+    // labeled by the `editor.sharedAdd` i18n key; in the en locale the label
+    // is "Add". Restrict the query to the button role to avoid matching
+    // other locale strings.
+    fireEvent.click(screen.getByRole("button", { name: /add/i }));
+
+    // After click, a new editable row appears (key input with the
+    // Cafe24-specific placeholder).
+    expect(screen.getByPlaceholderText(/shop_no/)).toBeInTheDocument();
+  });
+
+  it("persists each row independently and survives a key edit", () => {
+    const onChange = vi.fn();
+    render(
+      <ControlledCafe24
+        initial={{ resource: "product", operation: "product_list" }}
+        onChange={onChange}
+      />,
+    );
+
+    // Add a row.
+    fireEvent.click(screen.getByRole("button", { name: /add/i }));
+    const keyInput = screen.getByPlaceholderText(/shop_no/);
+
+    // Type a key — config.fields should now contain that key.
+    fireEvent.change(keyInput, { target: { value: "shop_no" } });
+    const lastCall = onChange.mock.calls.at(-1)?.[0] as
+      | { fields?: Record<string, unknown> }
+      | undefined;
+    expect(lastCall?.fields).toEqual({ shop_no: "" });
+
+    // Row should still be rendered after the round trip.
+    expect(screen.getByDisplayValue("shop_no")).toBeInTheDocument();
+  });
+
+  it("adds a second row without clobbering the first one with a typed key", () => {
+    const onChange = vi.fn();
+    render(
+      <ControlledCafe24
+        initial={{
+          resource: "product",
+          operation: "product_list",
+          fields: { shop_no: "1" },
+        }}
+        onChange={onChange}
+      />,
+    );
+
+    // Existing row is rendered.
+    expect(screen.getByDisplayValue("shop_no")).toBeInTheDocument();
+
+    // Click Add — a NEW empty row must appear without losing the first row.
+    fireEvent.click(screen.getByRole("button", { name: /add/i }));
+
+    // Two key inputs total: one with "shop_no", one empty.
+    const keyInputs = screen.getAllByPlaceholderText(/shop_no/);
+    expect(keyInputs).toHaveLength(2);
+    expect(keyInputs[0]).toHaveValue("shop_no");
+    expect(keyInputs[1]).toHaveValue("");
+  });
+
+  it("removes a row when the trash button is clicked", () => {
+    const onChange = vi.fn();
+    render(
+      <ControlledCafe24
+        initial={{
+          resource: "product",
+          operation: "product_list",
+          fields: { shop_no: "1", display: "T" },
+        }}
+        onChange={onChange}
+      />,
+    );
+
+    // Two rows rendered initially.
+    expect(screen.getAllByPlaceholderText(/shop_no/)).toHaveLength(2);
+
+    // Locate the first row by its key input, then click the row's own
+    // remove button (the icon-only ghost button at the right end of the
+    // same horizontal flex container). Filtering buttons by text doesn't
+    // work — ExpressionInput cells also render icon-only buttons.
+    const firstRowKeyInput = screen.getAllByDisplayValue("shop_no")[0];
+    const row = firstRowKeyInput.parentElement!;
+    const removeButton = row.querySelector(
+      "button:not([data-state])",
+    ) as HTMLButtonElement | null;
+    // The row layout is [key input, value cell, remove button]; the
+    // remove button is the trailing icon button without state attrs.
+    const candidateButtons = Array.from(row.querySelectorAll("button"));
+    const targetButton = candidateButtons[candidateButtons.length - 1]!;
+    expect(targetButton).toBeTruthy();
+    fireEvent.click(removeButton ?? targetButton);
+
+    // After removing the first row, only one row remains.
+    expect(screen.getAllByPlaceholderText(/shop_no/)).toHaveLength(1);
+    const lastCall = onChange.mock.calls.at(-1)?.[0] as
+      | { fields?: Record<string, unknown> }
+      | undefined;
+    expect(Object.keys(lastCall?.fields ?? {})).toHaveLength(1);
+  });
+
+  it("keeps the empty row visible until a key is typed (not lost in object conversion)", () => {
+    const onChange = vi.fn();
+    render(
+      <ControlledCafe24
+        initial={{ resource: "product", operation: "product_list" }}
+        onChange={onChange}
+      />,
+    );
+
+    // Click Add three times — each click should add one row, regardless of
+    // empty-key entries being absent from the persisted object form.
+    fireEvent.click(screen.getByRole("button", { name: /add/i }));
+    fireEvent.click(screen.getByRole("button", { name: /add/i }));
+    fireEvent.click(screen.getByRole("button", { name: /add/i }));
+
+    expect(screen.getAllByPlaceholderText(/shop_no/)).toHaveLength(3);
+  });
+});

```

---

### 파일 2: frontend/src/components/editor/settings-panel/node-configs/integration-configs.tsx
- 변경 유형: Review
- 언어: tsx

#### 변경된 코드
```
commit 6ceebadd3c31fff8894670fb1c4eab4d5389ac65
Author: worker-ants <admin@getit.co.kr>
Date:   Sat May 16 09:16:59 2026 +0900

    fix(node-configs/cafe24): keep newly added fields rows visible
    
    The Cafe24 node settings panel's `Fields` editor lost newly added rows
    the moment they were created. KeyValueEditor's "Add" button appended a
    blank `{key: "", value: ""}` row, but the onChange handler converted
    the list straight to `Record<string, unknown>` and dropped the
    empty-key entry — so the next render derived its list from the
    unchanged object and the new row was gone. The "추가" button appeared
    broken.
    
    Cafe24Config now maintains the editing rows in local React state
    initialized from `config.fields`. Mutations update the state and
    propagate the (still object-shaped) result upstream, preserving the
    backend contract. External resets (undo/redo, programmatic) trigger a
    derived-state re-sync during render.
    
    Added unit tests cover: clicking Add reveals a new row, typed keys
    persist into `config.fields`, multiple Add clicks accumulate rows
    independent of the object-form filter, removing rows mutates state
    correctly, and the empty-row visibility survives object conversion.
    
    consistency-check session: review/consistency/2026/05/16/09_03_04
    (BLOCK: NO — 5 checkers all NONE, 7 INFO suggestions).
    
    [skip-e2e] — single-component UI fix; backend / spec / data model
    unchanged.
    
    Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

diff --git a/frontend/src/components/editor/settings-panel/node-configs/integration-configs.tsx b/frontend/src/components/editor/settings-panel/node-configs/integration-configs.tsx
index 91234f32..7c59e207 100644
--- a/frontend/src/components/editor/settings-panel/node-configs/integration-configs.tsx
+++ b/frontend/src/components/editor/settings-panel/node-configs/integration-configs.tsx
@@ -1,3 +1,4 @@
+import { useState } from "react";
 import { FieldGroup, SelectField, NumberField, CheckboxField, KeyValueEditor } from "./shared";
 import { ExpressionInput } from "@/components/editor/expression";
 import { IntegrationSelector } from "./integration-selector";
@@ -292,9 +293,76 @@ function normalizeCafe24Fields(
   return [];
 }
 
+// Convert the UI's key-value list back to the persisted object form that the
+// backend handler expects (`Record<string, unknown>`). Empty-key rows are
+// dropped because they have no meaningful object representation — but they
+// remain visible in the UI because the editor list lives in local React state
+// (see `Cafe24Config`).
+function fieldRowsToObject(
+  rows: ReadonlyArray<{ key: string; value: string }>,
+): Record<string, string> {
+  const obj: Record<string, string> = {};
+  for (const it of rows) {
+    if (it.key) obj[it.key] = it.value;
+  }
+  return obj;
+}
+
+function objectsEqual(
+  a: Record<string, unknown>,
+  b: Record<string, unknown>,
+): boolean {
+  const aKeys = Object.keys(a);
+  const bKeys = Object.keys(b);
+  if (aKeys.length !== bKeys.length) return false;
+  for (const k of aKeys) {
+    if (String(a[k] ?? "") !== String(b[k] ?? "")) return false;
+  }
+  return true;
+}
+
 export function Cafe24Config({ config, onChange }: { config: Config; onChange: OnChange }) {
   const t = useT();
-  const fields = normalizeCafe24Fields(config.fields);
+  // The Fields editor maintains a list of {key, value} pairs locally so the
+  // user can add a blank row and type its key before it becomes a persisted
+  // object entry. The previous implementation derived the list from
+  // `config.fields` (object form) on every render, which silently dropped
+  // empty-key rows the moment they were created — making the "Add" button
+  // appear non-functional.
+  const [fieldRows, setFieldRows] = useState<
+    Array<{ key: string; value: string }>
+  >(() => normalizeCafe24Fields(config.fields));
+
+  // Track the last object we propagated upstream so we can detect *external*
+  // changes to `config.fields` (e.g. undo/redo, programmatic reset) and
+  // re-sync the local list during render. React's recommended "store
+  // information from previous renders" pattern keeps this in state, not
+  // in a ref (see https://react.dev/reference/react/useState).
+  const [lastPropagated, setLastPropagated] = useState<Record<string, unknown>>(
+    () => fieldRowsToObject(fieldRows),
+  );
+
+  const externalFields =
+    config.fields && typeof config.fields === "object" && !Array.isArray(config.fields)
+      ? (config.fields as Record<string, unknown>)
+      : {};
+  if (!objectsEqual(externalFields, lastPropagated)) {
+    // Derived-state update during render: React batches these into the
+    // current pass without an extra re-render.
+    const nextRows = normalizeCafe24Fields(externalFields);
+    setFieldRows(nextRows);
+    setLastPropagated(fieldRowsToObject(nextRows));
+  }
+
+  const handleFieldRowsChange = (
+    items: Array<{ key: string; value: string }>,
+  ) => {
+    setFieldRows(items);
+    const obj = fieldRowsToObject(items);
+    setLastPropagated(obj);
+    onChange({ ...config, fields: obj });
+  };
+
   const pagination = (config.pagination as { limit?: number; offset?: number } | undefined) ?? {};
 
   return (
@@ -328,19 +396,8 @@ export function Cafe24Config({ config, onChange }: { config: Config; onChange: O
       />
       <KeyValueEditor
         label="Fields"
-        items={fields.map((f) => ({ key: f.key, value: f.value }))}
-        onChange={(items) => {
-          // Translate KeyValue back to a plain object so the backend
-          // schema (which expects Record<string, unknown>) is happy.
-          const obj: Record<string, string> = {};
-          for (const it of items) {
-            if (it.key) obj[it.key] = it.value;
-          }
-          // Persist BOTH the keyvalue list (for UI round-trip) and the
-          // resolved object form. The handler reads `config.fields` as
-          // an object; the UI maintains it as a list for ergonomic editing.
-          onChange({ ...config, fields: obj });
-        }}
+        items={fieldRows}
+        onChange={handleFieldRowsChange}
         keyPlaceholder="shop_no, product_no, ..."
         valuePlaceholder="value or {{ $input.x }}"
         expressionValues

```

---

### 파일 3: plan/in-progress/cafe24-fields-add-button-fix.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
commit 6ceebadd3c31fff8894670fb1c4eab4d5389ac65
Author: worker-ants <admin@getit.co.kr>
Date:   Sat May 16 09:16:59 2026 +0900

    fix(node-configs/cafe24): keep newly added fields rows visible
    
    The Cafe24 node settings panel's `Fields` editor lost newly added rows
    the moment they were created. KeyValueEditor's "Add" button appended a
    blank `{key: "", value: ""}` row, but the onChange handler converted
    the list straight to `Record<string, unknown>` and dropped the
    empty-key entry — so the next render derived its list from the
    unchanged object and the new row was gone. The "추가" button appeared
    broken.
    
    Cafe24Config now maintains the editing rows in local React state
    initialized from `config.fields`. Mutations update the state and
    propagate the (still object-shaped) result upstream, preserving the
    backend contract. External resets (undo/redo, programmatic) trigger a
    derived-state re-sync during render.
    
    Added unit tests cover: clicking Add reveals a new row, typed keys
    persist into `config.fields`, multiple Add clicks accumulate rows
    independent of the object-form filter, removing rows mutates state
    correctly, and the empty-row visibility survives object conversion.
    
    consistency-check session: review/consistency/2026/05/16/09_03_04
    (BLOCK: NO — 5 checkers all NONE, 7 INFO suggestions).
    
    [skip-e2e] — single-component UI fix; backend / spec / data model
    unchanged.
    
    Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

diff --git a/plan/in-progress/cafe24-fields-add-button-fix.md b/plan/in-progress/cafe24-fields-add-button-fix.md
new file mode 100644
index 00000000..8567cb19
--- /dev/null
+++ b/plan/in-progress/cafe24-fields-add-button-fix.md
@@ -0,0 +1,58 @@
+---
+worktree: cafe24-fields-add-btn-d3f8a2
+started: 2026-05-16
+owner: developer
+---
+
+# Cafe24 노드 `fields` 추가 버튼 무동작 버그 수정
+
+## 배경
+
+사용자 보고 (2026-05-16): 워크플로 에디터의 Cafe24 노드 설정 패널에서 `Fields` 항목의 "추가" 버튼을 눌러도 행이 늘어나지 않는다.
+
+## 원인
+
+`frontend/src/components/editor/settings-panel/node-configs/integration-configs.tsx` 의 `Cafe24Config`:
+
+1. `KeyValueEditor` 의 `addItem` → `onChange([...items, { key: "", value: "" }])` 로 빈 행 1개 추가.
+2. `Cafe24Config` 의 onChange 콜백은 받은 items 를 object 로 변환할 때 `if (it.key) obj[it.key] = it.value` — **빈 key 행을 즉시 버린다**.
+3. 다음 렌더에서 `normalizeCafe24Fields(config.fields)` 는 object 에서 다시 list 를 만드는데, 빈 key 항목은 사라진 상태이므로 새 행이 보이지 않는다.
+
+기존 코드 주석(line 339–342) 은 "Persist BOTH the keyvalue list (for UI round-trip) and the resolved object form" 이라 적었지만 실제로는 object 만 저장 — 주석과 구현의 괴리가 버그의 원인.
+
+## 해결 방향
+
+`Cafe24Config` 내부에 keyvalue 편집 버퍼용 React `useState` 도입:
+
+- 초기값: `useState(() => normalizeCafe24Fields(config.fields))` — 마운트 시 1회 props 에서 파생.
+- KeyValueEditor 의 onChange 는 로컬 state 를 갱신하고, 동시에 빈 key 를 제거한 object 형태로 `config.fields` 에 반영.
+- 외부 변경(undo/redo 등)으로 `config.fields` 가 우리의 마지막 출력과 다른 내용으로 들어오면 로컬 state 를 재동기화.
+- 백엔드 계약 `config.fields: Record<string, unknown>` 은 그대로 보존 ([spec §1](../../../spec/4-nodes/4-integration/4-cafe24.md#1-설정-config), [conventions/cafe24-api-metadata.md](../../../spec/conventions/cafe24-api-metadata.md)).
+- `SettingsTab` 이 `selectedNodeId` 로 keyed 되어 있어 노드 전환 시 컴포넌트가 unmount/remount — 다른 노드 선택으로 인한 state stale 문제 없음.
+
+## consistency-check 결과
+
+세션: `review/consistency/2026/05/16/09_03_04/SUMMARY.md` — **BLOCK: NO**. 5 checker 전체 NONE.
+
+INFO 권고:
+- `fields` 변수와 충돌 회피용 state 명칭은 `fieldRows` 사용 (naming_collision INFO 6).
+- 구현 완료 후 spec §2 또는 §9 Rationale 에 "fields 편집 UI 는 key-value 배열로 관리, onChange 시 object 변환" 한 줄 추가 권장 (cross_spec INFO 1 + rationale_continuity INFO 2). → 본 plan 종료 시 `plan/in-progress/spec-update-cafe24-fields-ui-buffer.md` 로 위임.
+
+§9 절 순서 역전 (9.7/9.8) · §5 Case 번호 불연속 등 사전 존재 위배는 별도 시점 처리 (이번 PR 범위 외).
+
+## 작업 항목
+
+- [x] worktree 진입 (`cafe24-fields-add-btn-d3f8a2`)
+- [x] 스펙 분석 (`spec/4-nodes/4-integration/4-cafe24.md`, `spec/conventions/cafe24-api-metadata.md`)
+- [x] consistency-check (BLOCK: NO)
+- [x] TDD — 추가 버튼 동작 회귀 테스트 작성
+- [x] 구현 — `Cafe24Config` 에 `useState` 도입
+- [x] TEST WORKFLOW (lint / unit / build)
+- [x] REVIEW WORKFLOW (`/ai-review`) → RESOLUTION 작성
+- [x] spec 보완 위임 plan 작성 (`plan/in-progress/spec-update-cafe24-fields-ui-buffer.md`)
+
+## 영향 범위
+
+- Frontend 단일 파일 수정 + 신규 unit test 1건
+- 백엔드 / 스펙 본문 / 데이터 모델 변경 없음
+- e2e 대상 아님 (단일 컴포넌트 UI 트윅) — `[skip-e2e]`

```

---

### 파일 4: plan/in-progress/spec-update-cafe24-fields-ui-buffer.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
commit 6ceebadd3c31fff8894670fb1c4eab4d5389ac65
Author: worker-ants <admin@getit.co.kr>
Date:   Sat May 16 09:16:59 2026 +0900

    fix(node-configs/cafe24): keep newly added fields rows visible
    
    The Cafe24 node settings panel's `Fields` editor lost newly added rows
    the moment they were created. KeyValueEditor's "Add" button appended a
    blank `{key: "", value: ""}` row, but the onChange handler converted
    the list straight to `Record<string, unknown>` and dropped the
    empty-key entry — so the next render derived its list from the
    unchanged object and the new row was gone. The "추가" button appeared
    broken.
    
    Cafe24Config now maintains the editing rows in local React state
    initialized from `config.fields`. Mutations update the state and
    propagate the (still object-shaped) result upstream, preserving the
    backend contract. External resets (undo/redo, programmatic) trigger a
    derived-state re-sync during render.
    
    Added unit tests cover: clicking Add reveals a new row, typed keys
    persist into `config.fields`, multiple Add clicks accumulate rows
    independent of the object-form filter, removing rows mutates state
    correctly, and the empty-row visibility survives object conversion.
    
    consistency-check session: review/consistency/2026/05/16/09_03_04
    (BLOCK: NO — 5 checkers all NONE, 7 INFO suggestions).
    
    [skip-e2e] — single-component UI fix; backend / spec / data model
    unchanged.
    
    Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

diff --git a/plan/in-progress/spec-update-cafe24-fields-ui-buffer.md b/plan/in-progress/spec-update-cafe24-fields-ui-buffer.md
new file mode 100644
index 00000000..86c3a051
--- /dev/null
+++ b/plan/in-progress/spec-update-cafe24-fields-ui-buffer.md
@@ -0,0 +1,41 @@
+---
+worktree: (none — project-planner 진입 시 새 worktree)
+started: 2026-05-16
+owner: project-planner (다음 진입자)
+---
+
+# Spec Update: Cafe24 `fields` UI 편집 버퍼 분리 원칙 기록
+
+## 배경
+
+`plan/in-progress/cafe24-fields-add-button-fix.md` 의 구현 과정에서 Cafe24 노드 설정 UI 의 `fields` 항목은 다음 두 가지 표현 사이를 왔다갔다 한다:
+
+- **저장된 config 표현** — `Record<string, unknown>` (백엔드 계약, [spec/4-nodes/4-integration/4-cafe24.md §1](../../spec/4-nodes/4-integration/4-cafe24.md#1-설정-config), [conventions/cafe24-api-metadata.md](../../spec/conventions/cafe24-api-metadata.md))
+- **UI 편집 버퍼** — `Array<{key: string; value: string}>` (React state 안에서만 존재)
+
+두 표현 사이 변환:
+- 저장 → 편집: 컴포넌트 마운트 시 `Object.entries` 로 행 배열로 펼침
+- 편집 → 저장: `onChange` 시 빈 key 행을 제거(객체 표현 불가)한 뒤 `Object.fromEntries` 로 저장
+
+이 분리가 spec/Rationale 에 명시되어 있지 않다 — 같은 패턴이 향후 다른 노드(e.g. KeyValueEditor 를 fields=object 로 노출하는 모든 케이스)에 재발할 수 있어 한 줄 기록 권장.
+
+## consistency-check 출처
+
+`review/consistency/2026/05/16/09_03_04/SUMMARY.md` INFO 1 + INFO 2 (cross_spec · rationale_continuity).
+
+## 제안 변경
+
+`spec/4-nodes/4-integration/4-cafe24.md` 의 §2 (설정 UI) 또는 §9 Rationale 에 다음 한 줄 추가:
+
+> **Fields 편집 UI**: 내부적으로 `Array<{key, value}>` 편집 버퍼를 React state 로 관리한다. `onChange` 시 빈 key 행을 제거하고 `Record<string, unknown>` 로 변환해 `config.fields` 에 저장한다. 비어있는 key 행이 즉시 사라지는 것을 막아 "추가" 버튼이 행을 즉시 보여주도록 한다.
+
+§9.5 (5필드 invariant 준수) 직후나 §2 (설정 UI) 마지막 단락이 자연스러운 위치.
+
+## 작업 항목
+
+- [ ] `project-planner` 가 spec/4-nodes/4-integration/4-cafe24.md 에 한 줄 추가
+- [ ] (선택) 별도 시점 — §9 Rationale 절 순서 정리 (9.7/9.8 역전) + §5 Case 번호 연속화. SUMMARY.md INFO 3·4 참고
+
+## 영향 범위
+
+spec 본문 1~2 줄 추가. 코드/API/데이터모델 변경 없음.

```

---

### 파일 5: review/consistency/2026/05/16/09_03_04/SUMMARY.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
commit 6ceebadd3c31fff8894670fb1c4eab4d5389ac65
Author: worker-ants <admin@getit.co.kr>
Date:   Sat May 16 09:16:59 2026 +0900

    fix(node-configs/cafe24): keep newly added fields rows visible
    
    The Cafe24 node settings panel's `Fields` editor lost newly added rows
    the moment they were created. KeyValueEditor's "Add" button appended a
    blank `{key: "", value: ""}` row, but the onChange handler converted
    the list straight to `Record<string, unknown>` and dropped the
    empty-key entry — so the next render derived its list from the
    unchanged object and the new row was gone. The "추가" button appeared
    broken.
    
    Cafe24Config now maintains the editing rows in local React state
    initialized from `config.fields`. Mutations update the state and
    propagate the (still object-shaped) result upstream, preserving the
    backend contract. External resets (undo/redo, programmatic) trigger a
    derived-state re-sync during render.
    
    Added unit tests cover: clicking Add reveals a new row, typed keys
    persist into `config.fields`, multiple Add clicks accumulate rows
    independent of the object-form filter, removing rows mutates state
    correctly, and the empty-row visibility survives object conversion.
    
    consistency-check session: review/consistency/2026/05/16/09_03_04
    (BLOCK: NO — 5 checkers all NONE, 7 INFO suggestions).
    
    [skip-e2e] — single-component UI fix; backend / spec / data model
    unchanged.
    
    Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

diff --git a/review/consistency/2026/05/16/09_03_04/SUMMARY.md b/review/consistency/2026/05/16/09_03_04/SUMMARY.md
new file mode 100644
index 00000000..15bc4507
--- /dev/null
+++ b/review/consistency/2026/05/16/09_03_04/SUMMARY.md
@@ -0,0 +1,44 @@
+# Consistency Check 통합 보고서
+
+**BLOCK: NO** — Critical 발견 없음. 구현 착수에 차단 사유 없음.
+
+## 전체 위험도
+**NONE** — 5개 checker 전항 이상 없음. 변경 범위가 frontend 단일 컴포넌트 + unit test 1건에 국한되며, 백엔드 계약·데이터 모델·spec 변경 없음.
+
+## Critical 위배 (BLOCK 사유)
+없음
+
+## 경고 (WARNING)
+없음
+
+## 참고 (INFO)
+
+| # | Checker | 항목 | 위치 | 제안 |
+|---|---------|------|------|------|
+| 1 | cross_spec | `config.fields` UI 내부 표현(배열) ↔ 백엔드 object 형태 변환 패턴이 spec에 미기록 | `spec/4-nodes/4-integration/4-cafe24.md §2` 설정 UI 섹션 | 구현 완료 후 §2에 "fields 편집 UI는 내부적으로 key-value 배열을 관리하며, `onChange` 시 빈 key 항목 제거 후 `Record<string,unknown>`으로 변환해 저장한다" 한 줄 추가 권장 |
+| 2 | rationale_continuity | UI 편집 버퍼와 config 저장 상태 분리 패턴이 Rationale에 미기록 (이번 수정이 첫 도입 사례) | `spec/4-nodes/4-integration/4-cafe24.md §9` Rationale 또는 §2 | 구현 후 §9 Rationale 또는 §2에 "편집 버퍼와 config 저장 상태의 분리" 원칙 간략 기록 권장 (INFO 1과 동일 내용 — 1회 조치로 통합 해소 가능) |
+| 3 | convention_compliance | §9 Rationale 절 번호와 파일 내 순서 불일치 (9.7/9.8 역전) | `spec/4-nodes/4-integration/4-cafe24.md §9` 라인 406~451 | 9.7·9.8 절을 번호 순서에 맞게 재배열하거나 CHANGELOG 직전 정렬 |
+| 4 | convention_compliance | §5 출력 구조 Case 번호 불연속 (5.1, 5.3, 5.8 — 5.2·5.4~5.7 누락) | `spec/4-nodes/4-integration/4-cafe24.md §5` | 연속 번호 사용 또는 번호 없이 `### Case: <이름>` 형식으로 변경 |
+| 5 | plan_coherence | 동일 Cafe24 도메인 병렬 worktree 존재 (`cafe24-3rdparty-url-503aa0`) | `plan/in-progress/cafe24-app-url-3rdparty-shorten.md` | 현재 파일 수준 경합 없음. 상대 worktree가 `integration-configs.tsx` 수정 가능성이 생기면 그 시점에 직렬화 필요 |
+| 6 | naming_collision | 신규 draft React state를 `fields`/`setFields`로 명명 시 기존 지역 변수 `const fields`(`integration-configs.tsx:297`)와 동일 스코프 충돌 | `integration-configs.tsx:297` — `const fields = normalizeCafe24Fields(config.fields)` | `localRows` 또는 `fieldRows` 등 구분되는 이름 채택. TypeScript가 즉시 컴파일 에러로 잡으므로 실질 위험 낮음 |
+| 7 | naming_collision | `normalizeCafe24Fields` 호출 시점이 draft state 도입 후 변경됨 (전체 렌더 파생 → 초기화 전용), 역할 혼동 가능 | `integration-configs.tsx:270-293` | `useState(() => normalizeCafe24Fields(config.fields))` 또는 `useEffect` 내에서 호출해 역할 명시 |
+
+> INFO 1과 INFO 2는 동일 위배(UI 내부 표현 패턴 미기록)를 cross_spec·rationale_continuity 두 checker가 각도 달리 지적한 것. 실제 조치는 1회로 통합 가능.
+
+## Checker별 위험도
+
+| Checker | 위험도 | 핵심 발견 |
+|---------|--------|-----------|
+| cross_spec | NONE | 데이터 모델·API 계약·상태 전이·RBAC·계층 책임 모두 이상 없음. UI 표현 패턴 미기록 INFO 1건 |
+| rationale_continuity | NONE | 기각 대안 재도입·합의 원칙 위반·결정 번복·암묵적 가정 충돌 전무. UI 버퍼 분리 패턴 Rationale 미기록 INFO 1건 |
+| convention_compliance | NONE | 파일명·문서 구조·출력 포맷·API 문서 규약 모두 준수. §9 절 순서 역전·§5 Case 번호 불연속 INFO 2건 |
+| plan_coherence | NONE | 미해결 결정 충돌·동일 파일 경합·선행 조건 미해소·후속 항목 무효화 없음. 병렬 Cafe24 worktree 존재 INFO 1건 |
+| naming_collision | NONE | 스펙 레벨 식별자 신규 도입 없음. 컴포넌트 내부 draft state 명칭 주의 INFO 2건 |
+
+## 권장 조치사항
+
+1. **구현 착수 가능** — BLOCK 없음. `Cafe24Config` 내부 React state 도입 작업을 예정대로 진행한다.
+2. **draft state 명칭**: `localRows` 또는 `fieldRows` 처럼 기존 `const fields`와 구별되는 이름을 처음부터 사용한다 (INFO 6 해소).
+3. **`normalizeCafe24Fields` 호출 위치**: `useState` 초기값 (`useState(() => normalizeCafe24Fields(config.fields))`) 또는 `useEffect` 내에서 명시적으로 제한해 역할을 명확히 한다 (INFO 7 해소).
+4. **구현 완료 후 spec 보완**: `spec/4-nodes/4-integration/4-cafe24.md §2` 또는 §9 Rationale에 "fields 편집 UI는 내부적으로 key-value 배열을 관리하며, `onChange` 시 빈 key 항목을 제거한 뒤 `Record<string,unknown>`으로 변환해 저장한다" 한 줄을 추가한다 (INFO 1·2 통합 해소).
+5. **spec 문서 정리** (구현과 무관, 별도 시점 권장): §9 Rationale 절 순서 정리(9.7·9.8 역전), §5 Case 번호 연속화. 이번 PR에 포함하지 않아도 무방하다 (INFO 3·4 해소).

```

---

### 파일 6: review/consistency/2026/05/16/09_03_04/_prompts/convention_compliance.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
commit 6ceebadd3c31fff8894670fb1c4eab4d5389ac65
Author: worker-ants <admin@getit.co.kr>
Date:   Sat May 16 09:16:59 2026 +0900

    fix(node-configs/cafe24): keep newly added fields rows visible
    
    The Cafe24 node settings panel's `Fields` editor lost newly added rows
    the moment they were created. KeyValueEditor's "Add" button appended a
    blank `{key: "", value: ""}` row, but the onChange handler converted
    the list straight to `Record<string, unknown>` and dropped the
    empty-key entry — so the next render derived its list from the
    unchanged object and the new row was gone. The "추가" button appeared
    broken.
    
    Cafe24Config now maintains the editing rows in local React state
    initialized from `config.fields`. Mutations update the state and
    propagate the (still object-shaped) result upstream, preserving the
    backend contract. External resets (undo/redo, programmatic) trigger a
    derived-state re-sync during render.
    
    Added unit tests cover: clicking Add reveals a new row, typed keys
    persist into `config.fields`, multiple Add clicks accumulate rows
    independent of the object-form filter, removing rows mutates state
    correctly, and the empty-row visibility survives object conversion.
    
    consistency-check session: review/consistency/2026/05/16/09_03_04
    (BLOCK: NO — 5 checkers all NONE, 7 INFO suggestions).
    
    [skip-e2e] — single-component UI fix; backend / spec / data model
    unchanged.
    
    Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

diff --git a/review/consistency/2026/05/16/09_03_04/_prompts/convention_compliance.md b/review/consistency/2026/05/16/09_03_04/_prompts/convention_compliance.md
new file mode 100644
index 00000000..ed8f83dd
--- /dev/null
+++ b/review/consistency/2026/05/16/09_03_04/_prompts/convention_compliance.md
@@ -0,0 +1,659 @@
+# 정식 규약 준수 Check Payload
+
+본 파일은 orchestrator 가 정식 규약 준수 checker 용으로 작성한 입력입니다. target 문서가 정식 규약(`spec/conventions/**`) 을 따르고 있는지 분석한다.
+sub-agent 의 system prompt 에 정의된 호출 규약·등급 기준·출력 형식을 그대로
+따르되, 분석 시 아래 "점검 관점" 을 빠짐없이 적용하세요. 결과는 `output_file`
+인자에 review.md 로 Write 하고 호출자에게는 STATUS 한 줄만 반환합니다.
+
+## 점검 관점 (정식 규약 준수)
+
+1. **명명 규약** — 파일·식별자·API endpoint 명명이 conventions 규칙과 일치하는가
+2. **출력 포맷 규약** — 노드 Output, API 응답, error code 형식 등이 정식 규약을 따르는가
+3. **문서 구조 규약** — Overview / 본문 / Rationale 3섹션 권장, `_product-overview.md`·`0-` prefix 등 CLAUDE.md 의 명명 컨벤션 준수
+4. **API 문서 규약** — Swagger 패턴·request/response DTO 명명
+5. **금지 항목** — conventions 에서 명시적으로 금지한 패턴(예: 옛 prd/, memory/ 경로 사용)을 답습하고 있지 않은가
+
+## 검토 모드
+구현 착수 전 검토 (--impl-prep, scope=spec/4-nodes/4-integration/4-cafe24.md
+
+작업 요약: cafe24 노드 설정 UI(`frontend/src/components/editor/settings-panel/node-configs/integration-configs.tsx` 의 `Cafe24Config`) 에서 fields 항목의 "추가" 버튼이 동작하지 않는 버그 수정.
+
+원인: `KeyValueEditor` 가 빈 행 `{key:"", value:""}` 추가 → `onChange` 콜백이 빈 key 를 가진 행을 object 변환 시 즉시 제거 → 다음 렌더에서 새 행이 사라짐.
+
+수정 방향: `Cafe24Config` 내부에 keyvalue 편집용 React state 를 도입해 빈 key 행이 UI 에 유지되도록 함. 사용자가 key 를 입력하면 그 시점에 object 형태(`Record<string,unknown>`) 로 `config.fields` 에 반영. 백엔드 계약(spec/4-nodes/4-integration/4-cafe24.md §1, conventions/cafe24-api-metadata.md) 의 object shape 은 그대로 보존.
+
+영향 영역: frontend/src/components/editor/settings-panel/node-configs/integration-configs.tsx + 신규 unit test 1건. 백엔드/스펙/데이터모델 변경 없음.)
+
+## Target 문서
+경로: `spec/4-nodes/4-integration/4-cafe24.md
+
+작업 요약: cafe24 노드 설정 UI(`frontend/src/components/editor/settings-panel/node-configs/integration-configs.tsx` 의 `Cafe24Config`) 에서 fields 항목의 "추가" 버튼이 동작하지 않는 버그 수정.
+
+원인: `KeyValueEditor` 가 빈 행 `{key:"", value:""}` 추가 → `onChange` 콜백이 빈 key 를 가진 행을 object 변환 시 즉시 제거 → 다음 렌더에서 새 행이 사라짐.
+
+수정 방향: `Cafe24Config` 내부에 keyvalue 편집용 React state 를 도입해 빈 key 행이 UI 에 유지되도록 함. 사용자가 key 를 입력하면 그 시점에 object 형태(`Record<string,unknown>`) 로 `config.fields` 에 반영. 백엔드 계약(spec/4-nodes/4-integration/4-cafe24.md §1, conventions/cafe24-api-metadata.md) 의 object shape 은 그대로 보존.
+
+영향 영역: frontend/src/components/editor/settings-panel/node-configs/integration-configs.tsx + 신규 unit test 1건. 백엔드/스펙/데이터모델 변경 없음.`
+
+```
+### 구현 대상 영역: `spec/4-nodes/4-integration/4-cafe24.md
+
+작업 요약: cafe24 노드 설정 UI(`frontend/src/components/editor/settings-panel/node-configs/integration-configs.tsx` 의 `Cafe24Config`) 에서 fields 항목의 "추가" 버튼이 동작하지 않는 버그 수정.
+
+원인: `KeyValueEditor` 가 빈 행 `{key:"", value:""}` 추가 → `onChange` 콜백이 빈 key 를 가진 행을 object 변환 시 즉시 제거 → 다음 렌더에서 새 행이 사라짐.
+
+수정 방향: `Cafe24Config` 내부에 keyvalue 편집용 React state 를 도입해 빈 key 행이 UI 에 유지되도록 함. 사용자가 key 를 입력하면 그 시점에 object 형태(`Record<string,unknown>`) 로 `config.fields` 에 반영. 백엔드 계약(spec/4-nodes/4-integration/4-cafe24.md §1, conventions/cafe24-api-metadata.md) 의 object shape 은 그대로 보존.
+
+영향 영역: frontend/src/components/editor/settings-panel/node-configs/integration-configs.tsx + 신규 unit test 1건. 백엔드/스펙/데이터모델 변경 없음.`
+(없음)
+
+```
+
+## 정식 규약 모음 (spec/conventions/)
+
+### spec/conventions 정식 규약
+
+#### `spec/conventions/cafe24-api-metadata.md`
+```
+# CONVENTION: Cafe24 API Metadata
+
+> 관련 문서: [Spec Cafe24 노드](../4-nodes/4-integration/4-cafe24.md) · [Spec 통합 §5.8 Cafe24](../2-navigation/4-integration.md#58-cafe24) · [Spec MCP Client §2.3 Internal Bridge](../5-system/11-mcp-client.md#23-internal-bridge)
+
+본 컨벤션은 Cafe24 Admin API 의 endpoint 매핑 메타데이터 형식을 정의한다. backend 의 `Cafe24` 노드 핸들러와 `Cafe24McpBridge` 양쪽이 **같은 메타데이터 테이블** 을 소비한다 — 신규 endpoint 추가는 메타데이터 row 1 추가로 끝나야 한다.
+
+---
+
+## 1. 디렉토리 구조
+
+```
+backend/src/nodes/integration/cafe24/metadata/
+  index.ts             # 18 resource 의 종합 export
+  store.ts             # Store (상점)
+  product.ts           # Product (상품)
+  order.ts             # Order (주문)
+  customer.ts          # Customer (회원)
+  community.ts         # Community (게시판)
+  design.ts
+  promotion.ts
+  application.ts       # ⚠ Cafe24 앱 관리 API — OAuth 앱 등록(credentials.app_type)과 무관. naming collision 주의
+  category.ts
+  collection.ts
+  supply.ts
+  shipping.ts
+  salesreport.ts
+  personal.ts
+  privacy.ts
+  mileage.ts
+  notification.ts
+  translation.ts
+```
+
+각 파일은 한 Resource 의 모든 Operation 메타데이터를 export 한다.
+
+## 2. Operation 메타데이터 형식
+
+```ts
+interface Cafe24OperationMetadata {
+  // 식별
+  id: string;                    // 예: 'product_list'. resource 안에서 unique
+  label: string;                 // UI 드롭다운 라벨 (한국어) 예: '상품 목록 조회'
+  description: string;           // MCP tool description (영문 권장) 또는 다국어 키
+  scopeType: 'read' | 'write';   // scope 매핑 — mall.read_<resource> / mall.write_<resource>. Node.category 와의 명명 충돌 회피 위해 'category' 가 아닌 'scopeType' 사용
+
+  // HTTP 매핑
+  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
+  path: string;                  // path template. 예: 'products/{product_no}'
+
+  // 입력 스키마
+  requiredFields: string[];
+  fields: {
+    [fieldName: string]: {
+      type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'enum';
+      location: 'path' | 'query' | 'body';
+      enum?: string[];
+      description?: string;
+      default?: unknown;
+    };
+  };
+
+  responseShape?: 'list' | 'single' | 'empty';
+  paginated?: boolean;
+}
+```
+
+## 3. 예시 — `product` Resource 일부
+
+```ts
+export const productOperations: Cafe24OperationMetadata[] = [
+  {
+    id: 'product_list',
+    label: '상품 목록 조회',
+    description: 'List products in the mall. Supports filtering by category, display status, date range.',
+    scopeType: 'read',
+    method: 'GET',
+    path: 'products',
+    requiredFields: ['shop_no'],
+    fields: {
+      shop_no:     { type: 'number',  location: 'query',  description: 'Multi-shop number (default 1)' },
+      category_no: { type: 'number',  location: 'query',  description: 'Filter by category' },
+      display:     { type: 'enum',    location: 'query',  enum: ['T', 'F'] },
+      since:       { type: 'string',  location: 'query',  description: 'ISO8601 date — created_after' },
+    },
+    responseShape: 'list',
+    paginated: true,
+  },
+  {
+    id: 'product_get',
+    label: '상품 단건 조회',
+    description: 'Get a single product by product_no.',
+    scopeType: 'read',
+    method: 'GET',
+    path: 'products/{product_no}',
+    requiredFields: ['product_no'],
+    fields: {
+      product_no:  { type: 'number',  location: 'path' },
+      shop_no:     { type: 'number',  location: 'query' },
+    },
+    responseShape: 'single',
+  },
+  {
+    id: 'product_update',
+    label: '상품 수정',
+    description: 'Update a product (name, price, display, stock, etc).',
+    scopeType: 'write',
+    method: 'PUT',
+    path: 'products/{product_no}',
+    requiredFields: ['product_no'],
+    fields: {
+      product_no:    { type: 'number',  location: 'path' },
+      product_name:  { type: 'string',  location: 'body' },
+      price:         { type: 'string',  location: 'body', description: 'Decimal string (KRW)' },
+      display:       { type: 'enum',    location: 'body', enum: ['T', 'F'] },
+    },
+    responseShape: 'single',
+  },
+];
+```
+
+## 4. 신규 endpoint 추가 절차
+
+1. [Cafe24 공식 문서](https://developers.cafe24.com/docs/ko/api/admin/) 에서 endpoint 의 method / path / 필드 확인.
+2. 해당 resource 의 metadata 파일에 §2 형식으로 row 1 추가.
+3. `id` 는 `<resource>_<verb>` 형식 (예: `product_list`, `order_update_status`). 중복 금지 (resource 내).
+4. `scopeType` 은 read/write 결정 — scope 매핑에 사용.
+5. 백엔드 단위 테스트가 자동으로 검증:
+   - 모든 `id` 의 unique
+   - 모든 `path` 의 `{placeholder}` 가 `fields` 에 정의됐는지
+   - `requiredFields` 가 `fields` 의 키 부분집합인지
+6. **spec 본문 수정 불요** — `4-cafe24.md` 는 형식만 정의.
+
+## 5. MCP Bridge 와의 매핑
+
+> **레이어 경계**: 본 절의 `Cafe24McpBridge.callTool(name, args)` 와 `listTools()` 가 반환하는 도구 `name` 은 **bare operation id** (예: `product_list`) 다. MCP Client 레이어가 외부 노출 시점에 `mcp_<sid>__` prefix 를 자동 부여한다 ([Spec MCP Client §5.2](../5-system/11-mcp-client.md#52-도구-이름-규칙)). AI Agent config 의 `mcpServers[].enabledTools` 도 bare id 배열로 저장된다.
+
+`Cafe24McpBridge.listTools()` 는 메타데이터 테이블을 순회하여 다음을 생성한다:
+
+```ts
+function operationToMcpTool(op: Cafe24OperationMetadata): McpTool {
+  return {
+    name: op.id,                                 // bare id — 예: 'product_list'
+    description: `${op.description}\n\n(Cafe24 ${op.method} ${op.path})`,
+    inputSchema: {
+      type: 'object',
+      properties: Object.fromEntries(
+        Object.entries(op.fields).map(([k, f]) => [k, fieldToJsonSchema(f)])
+      ),
+      required: op.requiredFields,
+    },
+  };
+}
+```
+
+`Cafe24McpBridge.callTool(name, args)` 는 args 를 노드 핸들러의 `fields` 와 동일하게 처리하여 `Cafe24ApiClient` 로 위임 — **노드와 MCP 가 같은 호출 경로를 공유**.
+
+## 6. allowlist 와의 관계
+
+> 용어: **UI grouping 단위 = "카테고리"** (사용자 친화 표기) — 백엔드 메타데이터 파일 구조의 "Resource" 와 동일 범위를 가리키며, 문맥에 따라 혼용한다. spec 본문에서는 UI 맥락이면 "카테고리", 백엔드/Operation 메타데이터 맥락이면 "Resource" 사용. `Node.category` Enum 과는 별개 개념 (이름 충돌은 §2 의 `scopeType` 채택으로 이미 회피).
+
+AI Agent `mcpServers[].enabledTools` 가 비어있으면 모든 operation 이 노출. 사용자가 `['product_list', 'product_get']` 로 좁히면 그 둘만 LLM tool 로 노출 (bare id 비교). UI 는 카테고리 단위 grouping (예: "Product (read 전부)" 체크 → 백엔드는 `['product_list', 'product_get']` 로 저장).
+
+## 7. CHANGELOG
+
+| 일자 | 변경 |
+|------|------|
+| 2026-05-13 | 신규 컨벤션 — Cafe24 API metadata 의 형식·디렉토리·추가 절차 정의. `scopeType` 필드명 채택 (`Node.category` 와의 명명 충돌 회피) |
+
+```
+
+#### `spec/conventions/conversation-thread.md`
+```
+# Conversation Thread (대화 스레드)
+
+> 관련 문서: [Spec 실행 엔진 §6.1](../5-system/4-execution-engine.md#61-컨텍스트-구조) · [Spec AI Agent](../4-nodes/3-ai/1-ai-agent.md) · [Spec AI 공통 §11](../4-nodes/3-ai/0-common.md#11-conversation-context) · [CONVENTIONS Principle 4.5](./node-output.md#45-interactiondata-payload-규격) · [Spec 표현식 언어 §4.4](../5-system/5-expression-language.md#44-thread-속성)
+
+워크플로우 한 실행 동안 발생하는 사용자 인터랙션과 AI 대화 turn 을 시간순으로 누적하는 1급 컨텍스트. AI Agent 노드가 노드 설정 (`contextScope`) 으로 자동 주입받는다.
+
+---
+
+## 1. 자료구조
+
+### 1.1 ConversationTurnSource
+
+| 값 | 발생원 |
+|---|---|
+| `presentation_user` | Form / Carousel / Table / Chart / Template 의 `output.interaction.{type}` 가 `form_submitted` / `button_click` / `button_continue` 일 때 |
+| `ai_user` | AI Agent multi-turn 의 `output.interaction.type='message_received'` 시점 |
+| `ai_assistant` | AI Agent (single·multi) 의 final assistant 응답 |
+| `ai_tool` | KB / MCP / condition tool 결과 (opt-in 시 `includeToolTurns: true`) |
+| `system` | 명시적으로 push 한 system text (예약, v1 자동 누적 없음). **주의**: AssistantMessage `role: 'system'` 과 무관 — 워크플로우 레벨의 수동 push 전용 (예: 초기 시스템 안내 turn) |
+
+### 1.2 ConversationTurn
+
+| 필드 | 타입 | 설명 |
+|---|---|---|
+| `seq` | Number | 단조 증가. append 순서 == 시간 순서. thread 내 unique |
+| `nodeId` | UUID | turn 을 발생시킨 그래프 노드 |
+| `nodeLabel` | String | append 시점의 라벨 snapshot (라벨 변경 후에도 표시 일관성) |
+| `nodeType` | String | 예: `form`, `carousel`, `ai_agent` |
+| `timestamp` | String (ISO 8601) | 서버 시각 |
+| `source` | ConversationTurnSource | §1.1 |
+| `text` | String | system_text injection 과 UI 의 1차 텍스트. 빈 문자열 가능 (구조화 데이터만 있는 경우) |
+| `data?` | Object | 구조화 원본 — `output.interaction.data` snapshot |
+| `toolCalls?` | Array<{id,name,arguments}> | `source='ai_assistant'` 한정. provider 호환성을 위해 messages 모드에서 drop 가능 |
+| `toolCallId?` | String | `source='ai_tool'` 한정 |
+
+### 1.3 ConversationThread
+
+| 필드 | 타입 | 설명 |
+|---|---|---|
+| `id` | String | v1 고정값 `"default"` (multi-thread 는 v2). **port 예약어 `'default'` 와 무관** — namespace 분리. 코드에서 `DEFAULT_THREAD_ID = 'default'` 상수 추출 권장 |
+| `nextSeq` | Number | 다음 append 시 부여될 seq (== `turns.length`) |
+| `turns` | ConversationTurn[] | 시간순 누적 |
+| `totalChars` | Number | append 시 갱신되는 누적 char 길이 캐시 (cap 빠른 경로) |
+
+### 1.4 `text` 변환 규칙
+
+| `interaction.type` | text |
+|---|---|
+| `form_submitted` | `name=John, age=30` (key=value 리스트, 200자 cap, value 가 객체/배열이면 JSON 직렬화) |
+| `button_click` | `clicked: <buttonLabel>` (label 미존재 시 `<buttonId>`) |
+| `button_continue` | `continued: <url>` (url 미존재 시 `continued`) |
+| `message_received` (ai_user) | 메시지 본문 그대로 |
+| `ai_agent` final assistant | `output.result.response` 그대로 (CONVENTIONS Principle 8.2 LLM 응답 텍스트 경로) |
+| `text_classifier` final assistant (v2) | single-label: `output.result.category`. Multi-label: `output.result.categories.map(c => c.name).join(', ')` (categories 는 객체 배열이라 raw `.join` 불가). |
+| `information_extractor` final assistant (v2) | `output.result.extracted` 를 항상 `JSON.stringify` 직렬화 (`responseFormat` 필드는 `ai_agent` 전용 — extractor 는 항상 구조화 출력). |
+
+---
+
+## 2. 자동 누적 컨트랙트
+
+### 2.1 Presentation 노드
+
+`status: 'resumed'` 직전, `output.interaction` 빌드 후 엔진이 자동 push:
+- form `interaction.type='form_submitted'` → `source: 'presentation_user'`
+- carousel/table/chart/template `interaction.type='button_click' | 'button_continue'` → `source: 'presentation_user'`
+
+> 현재 실행 엔진의 presentation resume 코드는 `'submitted' / 'button_click' / 'button_continue'` 의 legacy status 값을 status 필드에 사용한다 (spec [실행 엔진 §1.3](../5-system/4-execution-engine.md#13-블로킹재개-컨트랙트-nodehandleroutput-status) 의 마이그레이션 노트 참조). 통일된 `'resumed'` 값으로의 마이그레이션은 별도 phase (presentation Principle 1.1 재작성) — 본 컨벤션은 status 값과 무관하게 `interaction.{type, data, receivedAt}` payload 가 emit 되는 시점에 push 가 발화함을 정의한다.
+
+### 2.2 AI Agent
+
+| 시점 | source |
+|---|---|
+| multi-turn user message 도착 (`output.interaction.type='message_received'`) | `ai_user` |
+| multi-turn 매 turn 종료 시 final assistant 응답 (`output.result.response`) | `ai_assistant` |
+| multi-turn condition route 시 assistant 응답 (`output.result.response`) | `ai_assistant` |
+| single-turn `userPrompt` (resolved) | `ai_user` (1회) |
+| single-turn 최종 `output.result.response` | `ai_assistant` (1회) |
+| tool-loop 중 assistant + tool result | `ai_assistant` / `ai_tool` (opt-in `includeToolTurns: true` 시에만) |
+
+### 2.3 v1 적용 범위 (push vs inject 구분)
+
+| 동작 | v1 적용 범위 | v2 로드맵 |
+|---|---|---|
+| **Turn push (누적)** | `ai_agent` 만 — multi-turn user/assistant + single-turn final assistant 자동 push | `text_classifier` / `information_extractor` 도 final assistant push 추가 (§1.4 의 v2 표기 행) |
+| **자동 주입 (inject — `contextScope` 활성화)** | `ai_agent` 만 | `text_classifier` / `information_extractor` 도 동일 인터페이스 |
+
+> push 와 inject 를 분리해 정의하는 이유: 다른 AI 노드의 final 응답도 후속 AI Agent 가 thread 로 받게 하려는 의도였으나, 분류·추출 노드 핸들러는 final-assistant 의미 있는 시점이 ai_agent 와 다르고 (text_classifier 는 카테고리, information_extractor 는 구조화 데이터), §1.4 의 변환 규칙도 노드별로 갈라진다. v1 출하 기준은 ai_agent 만이며 (handler 코드에 push hook 존재), 다른 두 노드의 push 는 §1.4 의 변환 규칙이 합의된 v2 에서 활성화.
+
+### 2.4 opt-out
+
+각 노드에 공통 boolean config: `excludeFromConversationThread` (default `false`). `true` 면 해당 노드의 모든 push 가 silent skip. UI 그룹은 `Advanced > Conversation`.
+
+---
+
+## 3. 스코프 규칙
+
+| 컨테이너 | 정책 |
+|---|---|
+| Sub-workflow (`executeInline`) | parent thread 상속·공유 |
+| Background | enqueue 시점 turns 배열까지 복사한 snapshot — 격리 |
+| Loop / ForEach / Map / Parallel | parent thread 상속·공유 |
+
+### 3.1 Sub-workflow 상속 근거
+
+`Workflow` 노드의 sync `executeInline` 경로는 부모 `ExecutionContext` 를 그대로 재사용한다 (`recursionDepth` 만 증가). 따라서 sub 안의 AI Agent 도 부모의 thread 를 본다. 사용자가 명시적으로 격리하고 싶으면 async mode 로 호출 (별도 Execution → 별도 thread).
+
+### 3.2 Background 격리 근거
+
+`scheduleBackgroundBody` 가 enqueue 시점에 thread 의 **turns 배열까지 함께 복사한 snapshot** 을 만든다 — 최소 `{ ...thread, turns: [...thread.turns] }` 형태. 단순 reference 복사가 아니라 새 array 인스턴스를 만들어, 백그라운드가 새 turn 을 push 해도 메인 thread 의 `turns` 가 변형되지 않음을 보장한다. ConversationTurn 객체 자체는 immutable (한 번 push 되면 수정되지 않음) 이라 깊은 복사까지 필요하지 않다.
+
+→ 메인 흐름이 이후 발생시킨 turn 은 background 가 못 보고, background 안에서 발생한 turn 은 메인 thread 에 영향 없음. PRD 3 §4.11 ND-BG-05 ("백그라운드 실패가 메인 흐름의 Execution 상태에 영향을 주지 않음") 격리 원칙과 정합.
+
+### 3.3 컨테이너 상속 근거
+
+Loop / ForEach / Map / Parallel 컨테이너는 별도 ExecutionContext 를 만들지 않고 같은 context.nodeOutputCache 를 공유한다. thread 도 같은 정책. iteration 메타 (index 등) 는 thread 에 자동 주입하지 않으며, 필요시 사용자가 `{{ $loop.index }}` 등으로 명시.
+
+---
+
+### 2.5 nextSeq 원자성
+
+`nextSeq` 의 단조 증가는 **단일 ExecutionContext 인스턴스 하에 직렬 실행** 보장에
+의존한다. v1 의 in-memory + single-instance 환경에서는 한 execution 의 노드
+처리가 한 번에 한 노드씩 진행되므로 (engine 의 `executeNode` 가 sequential)
+`appendInternal` 의 `seq = thread.nextSeq; thread.nextSeq = seq + 1` 가
+race-free.
+
+다음 시나리오에서는 별도 보장이 필요:
+- **Parallel 컨테이너**: 분기들이 같은 thread 에 동시 push 가능. v1 은 Parallel
+  내부 thread 사용을 정의하지 않음 (관련 spec follow-up). v2 에서 분기별 child
+  thread 또는 merge point 재통합 정책 결정.
+- **Multi-instance / Redis 분산**: thread 가 Redis 로 옮겨가면 `INCR` 같은
+  atomic operation 또는 lock 필요. v1 은 in-memory only.
+
+---
+
+## 4. 영속화
+
+| 단계 | 저장소 | 비고 |
+|---|---|---|
+| 실행 중 | `ExecutionContext` (실행 엔진 §6.2 정책에 따라 Redis 포함 직렬화) | `ExecutionContextService.createContext` 가 빈 thread (`{ id: 'default', nextSeq: 0, turns: [], totalChars: 0 }`) 로 초기화. TTL 은 실행 타임아웃 × 2 (execution-engine §6.2) |
+| 실행 후 | NodeExecution 분산 저장 | `output.interaction` (presentation, `interaction.type` ∈ form_submitted/button_click/button_continue), `output.messages` (AI 멀티턴 누적 — waiting/resumed 시), `output.result.response` (AI 최종 응답) 가 SoT. thread 자체는 재구성 가능한 derived view |
+| WS payload | `EXECUTION_WAITING_FOR_INPUT` 의 `conversationThread` snapshot 동봉 (선택) | UI 가 라이브 thread 표시 가능 |
+
+**v1 은 신규 DB 컬럼 도입 없음.** 향후 사용자 요구 명확해지면 `Execution.conversation_thread jsonb NULL` 컬럼 마이그레이션 검토.
+
+---
+
+## 5. AI Agent 자동 주입
+
+`spec/4-nodes/3-ai/1-ai-agent.md` §1 의 5 신규 필드:
+
+| 필드 | 타입 | 기본값 |
+|---|---|---|
+| `contextScope` | `none` / `thread` / `lastN` | `none` |
+| `contextScopeN` | Integer | `20` |
+| `contextInjectionMode` | `messages` / `system_text` | `messages` |
+| `includeToolTurns` | Boolean | `false` |
+| `excludeFromConversationThread` | Boolean | `false` |
+
+주입 위치는 `processMultiTurnMessageInner` 의 매 turn `llmService.chat` 직전 (single-turn 은 첫 chat 직전). messages 배열을 매 turn `[system, ...injectedThread, ...selfHistory]` 로 재빌드 — `injectedThread` 에서 자기 노드가 발생시킨 turn 은 `getThreadExcludingNode` 로 제외해 중복 방지.
+
+### 5.1 messages 모드 매핑
+
+| turn.source | role | content prefix |
+|---|---|---|
+| `presentation_user` | `user` | `[from <nodeLabel>] ` |
+| `ai_user` | `user` | (없음) |
+| `ai_assistant` | `assistant` | (없음, `toolCalls` 보존 또는 drop) |
+| `ai_tool` | `tool` | (없음, `toolCallId` 매칭) |
+| `system` | `system` | (없음) — **Anthropic API 비호환**: messages 배열 내 `role: 'system'` 미지원. provider 가 anthropic 이면 `system_text` 모드 또는 별도 분기로 우회 필수. v1 자동 push 없으므로 현재 실질 문제 없음 (수동 push 도입 시 provider 분기 검증 필수). |
+
+### 5.2 system_text 모드
+
+`thread-renderer` 가 헤더 `[#seq · timestamp · label (type) · source]` + text 본문으로 렌더해 `finalSystemPrompt` 끝에 첨부. KB guidance / condition suffix 보다 뒤.
+
+**Sanitization**: `turn.text` 가 사용자 입력 (form 제출, ai_user 메시지) 에서 유래한 경우 prompt injection 방어를 위해 `LlmService` 의 user content sanitizer 와 동일한 방식으로 sanitize 한다.
+
+### 5.3 Cap (v1 — char 기반)
+
+| 상수 | 값 | 동작 |
+|---|---|---|
+| `MAX_INJECTED_TURNS` | `100` | 초과 시 가장 오래된 turn 부터 drop, `[... N earlier turns omitted ...]` 마커 1줄 prepend |
+| `MAX_TURN_TEXT_CHARS` | `4000` | 초과 시 truncate (`...` 접미사) |
+| `MAX_INJECTED_CHARS` | `200_000` | 합산 char 추가 안전망 |
+
+`meta.contextInjection: { appliedScope, appliedMode, injectedTurns, droppedTurns, totalInjectedChars }` 디버그 echo. `appliedScope`/`appliedMode` 는 config 값의 echo 가 아니라 **실제 적용 결과** 를 표기 (예: `contextScope='thread'` 더라도 thread 가 비어있으면 `appliedScope='none'`, cap 으로 잘리면 `injectedTurns < turns.length`). Principle 2 (meta = 런타임 측정값) 정합.
+
+---
+
+## 6. Expression 통합
+
+`spec/5-system/5-expression-language.md` §4.4 의 `$thread` 변수:
+
+| 표현식 | 반환 |
+|---|---|
+| `$thread.turns` | ConversationTurn[] (readonly) |
+| `$thread.length` | Number |
+| `$thread.text` | String — system_text 렌더 결과 |
+
+자동 주입과 독립적으로 사용자가 명시 참조 가능 (예: 별도 `transform` 노드에서 thread 가공).
+
+---
+
+## 7. v2 로드맵
+
+- **Multi-thread**: 사용자 지정 key 로 한 execution 안에서 여러 thread 운영. presentation 노드가 어느 thread 에 push 할지 명시할 수 있게.
+- **Token-aware cap**: 현재 char-based cap (§5.3) 을 provider tokenizer 기반으로 — 모델별 정확한 토큰 budget 고려.
+- **`text_classifier` / `information_extractor` 자동 push + 주입**: §1.4 의 변환 규칙이 합의된 후 두 노드 핸들러에 push hook 추가, contextScope 적용 확장.
+- **DB 컬럼 신설**: `Execution.conversation_thread jsonb` 컬럼 마이그레이션 검토 — 현재는 NodeExecution 분산 저장이라 cross-node 조회가 N+1.
+- **실행 이력 화면의 ConversationThread 크로스노드 뷰**: EH-DETAIL-06 과 함께 v2 UI spec 정의.
+- **Parallel 컨테이너 + Thread 정책**: 현재 §2.5 가 "Parallel 내부 thread 사용을 정의하지 않음" 으로 명시. 분기별 child thread 또는 merge point 재통합 정책 결정 필요. 사용 케이스 정의 후 spec write.
+- **`$thread.text` lazy 평가**: 현재 `buildExpressionContext` 가 호출마다 전체 thread 를 system_text 로 즉시 렌더 (성능 hot path). 측정 결과 비용이 크면 `Object.defineProperty` lazy getter 또는 `$thread.text` 를 별도 key 로 분리해 명시 요청 시만 렌더.
+- **Service 모듈 위치 정리**: 현재 `backend/src/modules/execution-engine/conversation-thread/` 에 types/renderer/service 가 함께 있음. types/renderer 는 pure 라 향후 `src/shared/` 또는 별도 `@workflow/conversation-thread` 패키지로 분리해 nodes/ai → execution-engine 의 의존 그래프를 단순화 검토.
+- **Storage cap evict 정책**: §STORAGE_MAX_TURNS=500 은 LRU style FIFO drop. 향후 사용자 인터랙션 우선 보존 등 정책 옵션 검토.
+
+---
+
+## 8. Rationale
+
+설계 결정의 근거는 [Spec AI Agent §12](../4-nodes/3-ai/1-ai-agent.md#12-rationale) Rationale 섹션에 단일 인라인 — Conversation Thread 도입 동기, 선택지 비교, v1/v2 경계, 옛 `conversationHistory` 필드 제거 사유. 본 문서는 컨벤션의 단일 진실 공급원이며 동기·역사는 AI Agent 본문에 둔다.
+
+---
+
+## 9. CHANGELOG
+
+| 일자 | 변경 |
+|---|---|
+| 2026-05-14 | 신규 작성 — Conversation Thread 정식 도입 |
+| 2026-05-16 | AI Agent 의 옛 `conversationHistory` / `historyCount` schema·UI 메타 제거 (`contextScope` / `contextScopeN` 로 단일화) |
+
+```
+
+#### `spec/conventions/migrations.md`
+```
+# Flyway 마이그레이션 운영 규약
+
+## Overview
+
+본 규약은 PostgreSQL 스키마 마이그레이션을 다음 세 가지 안전성 기준으로 운영하기 위한 정식 규칙이다.
+
+1. **충돌 방지** — 여러 PR 이 병렬로 진행될 때 같은 V번호를 동시에 점유하는 사고를 사전에 차단한다.
+2. **순서 보장** — 마이그레이션 적용 순서를 작성 의도와 일치시켜, 의존성 (예: `V<N+1>` 이 `V<N>` 컬럼을 참조) 사고를 막는다.
+3. **운영 안전성** — 이미 운영에 적용된 마이그레이션을 수정해 Flyway checksum 불일치로 부팅이 실패하는 일을 막는다.
+
+본문 절차·도구는 모두 위 세 기준을 보장하기 위한 수단이다. 실제 작성 가이드(트랜잭션 모드, NOT VALID 패턴, extension 의존성 등)는 [`backend/migrations/README.md`](../../backend/migrations/README.md) 가 담당하며, 본 문서는 **버전 번호 정책과 머지 race 안전망**에 집중한다.
+
+---
+
+## 1. 명명 규약
+
+```text
+backend/migrations/V<번호>__<snake_case_descriptor>.sql
+backend/migrations/V<번호>__<snake_case_descriptor>.conf  # 필요한 경우만 (executeInTransaction=false 등)
+```
+
+- 번호는 **단조 증가하는 정수**. `V001__initial_schema.sql` 부터 시작해 1씩 증가한다.
+- 설명자는 `snake_case`. 영문 소문자 + 숫자 + `_` 만 사용한다.
+- `.conf` 페어는 항상 `.sql` 과 동일한 base name (`V<NNN>__<descriptor>`) 을 사용한다. 예: `V033__embedding_hnsw_1024.sql` ↔ `V033__embedding_hnsw_1024.conf`.
+- ⚠️ **alphanumeric suffix 금지** — `V035a`, `V035_1` 처럼 정수가 아닌 접미사를 붙이면 Flyway 의 기본 version 파서가 매치에 실패해 schema_history 에 미등록된 채 silent skip 된다. 이 조건은 `backend/src/migrations.spec.ts` 가 빌드/CI 마다 자동 검증한다.
+
+## 2. V번호 정책
+
+- **단조 증가**: 신규 V번호는 항상 현재 main 의 max(V) **+1** 이다.
+- **gap 금지**: 작업 도중 V번호를 건너뛰지 않는다. 두 개를 추가하면 `+1`, `+2` 가 되어야 한다.
+- **재사용 금지**: 한번 main 에 들어간 V번호는 다른 마이그레이션으로 재할당하지 않는다.
+
+작성 시 절차는 [§5 새 마이그레이션 추가 절차](#5-새-마이그레이션-추가-절차) 를 따른다.
+
+## 3. Append-only 원칙
+
+이미 main 에 들어간 V<N> 의 `.sql` / `.conf` 는 **절대 수정하지 않는다**.
+
+- Flyway 는 부팅 시 각 적용된 마이그레이션의 SQL 내용 checksum 을 `flyway_schema_history` 와 비교한다. 파일이 한 글자라도 바뀌면 `Migration checksum mismatch for migration version NNN` 으로 부팅이 실패한다.
+- 컬럼/인덱스/제약 추가·변경·삭제가 필요하면 **새 V<N+k>** 로 `ALTER`·`DROP`·`CREATE` 를 작성한다.
+- 운영 사고로 어쩔 수 없이 checksum 을 재정렬해야 한다면 `migrate-repair` 서비스를 사용한다 (절차는 [`backend/migrations/README.md`](../../backend/migrations/README.md) §4 참고).
+
+## 4. `outOfOrder=false` 유지
+
+Flyway 의 `outOfOrder=true` 옵션은 옛 V번호가 늦게 들어와도 실행을 허용한다. 본 repo 는 이 옵션을 **명시적으로 사용하지 않는다** (Flyway 기본값 `false` 유지).
+
+이유:
+- `outOfOrder=true` 환경에서 두 PR 이 동시에 V<N+1> 을 만들고 한쪽이 V<N+2> 로 양보한 뒤 늦게 머지되면, **의도된 의존성 순서와 실제 적용 순서가 어긋난다**.
+- 본 규약은 PR CI 단계에서 V번호 충돌을 잡아내므로 (`§5`), `outOfOrder` 를 켤 필요가 없다.
+
+## 5. 새 마이그레이션 추가 절차
+
+1. `git fetch origin main && git rebase origin/main` — base 를 최신화한다.
+2. `ls backend/migrations | tail -2` 로 현재 max V 를 확인한다.
+3. `V<max+1>__<descriptor>.sql` 을 작성한다. 필요하면 동일 base name 의 `.conf` 를 함께 둔다 ([`backend/migrations/README.md`](../../backend/migrations/README.md) §4·§5 참고).
+4. 로컬에서 `python3 scripts/check-migration-versions.py --base origin/main` 으로 V번호 가드를 통과시킨다.
+5. `make e2e-test` 로 dry-run — e2e 컨테이너의 Flyway 가 실제 마이그레이션을 적용해 본다.
+6. PR 을 연다. CI 의 `migration-check` 가 동일한 검사를 다시 돌린다.
+
+> PR open 후에는 가능한 빠르게 리뷰·머지하여 다른 PR 과의 V번호 점유 윈도우를 짧게 유지한다.
+
+## 6. 충돌 검출 / 머지 race
+
+본 repo 는 두 단계 안전망으로 V번호 충돌과 merge race 를 모두 차단한다.
+
+### 6.1 PR CI 가드 (`scripts/check-migration-versions.py`)
+
+`pull_request` 이벤트마다 [`/.github/workflows/migration-check.yml`](../../.github/workflows/migration-check.yml) 이 실행되어 다음을 검사한다.
+
+| 검사 | 위반 예시 | 메시지 |
+| --- | --- | --- |
+| 중복 | 같은 V<N>__*.sql 두 개 | `FAIL: V041 is duplicated` |
+| 단조성 | 신규 V<N> 가 main_max 이하 | `FAIL: V040 is not greater than base (origin/main) max V040` |
+| 연속성 | gap 발생 (예: V041 없이 V042) | `FAIL: V042 leaves a gap (expected V041 after base max V040)` |
+| `.conf` 페어 | `.conf` 의 base name 이 `.sql` 과 다름 | `FAIL: V041 .conf base name does not match its .sql` |
+
+위반 시 workflow exit 1 로 PR 머지가 막힌다. 작성자가 rebase 해 V번호를 재할당하면 즉시 재검증된다.
+
+로컬에서 동일 검사를 돌리려면:
+
+```bash
+python3 scripts/check-migration-versions.py --base origin/main
+```
+
+### 6.2 머지 직전 rebase 규약 (운영 규약)
+
+PR CI 가 통과한 직후 다른 PR 이 먼저 머지되어 main 의 max(V) 가 추월되는 **merge race** 가 발생할 수 있다. 본 repo 는 GitHub 무료 플랜의 private 저장소여서 branch protection 의 "Require branches to be up to date before merging" 옵션을 사용할 수 없으므로 (자세한 사유는 [§7 대안 4](#대안-4-github-branch-protection--require-branches-to-be-up-to-date)), race 차단을 다음 운영 규약으로 대체한다.
+
+**머지 직전 확인 (작성자 책임)**
+
+1. `git fetch origin main && git rebase origin/main` 으로 base 를 최신화한다.
+2. push 후 `migration-check` 가 PR 의 latest commit 기준 green 인지 확인한다.
+3. 본 PR 에 `migration-recheck-on-main` 알림 코멘트가 게시되어 있다면, 무조건 위 1·2 단계를 다시 수행한다.
+
+이 규약은 [`/.github/PULL_REQUEST_TEMPLATE.md`](../../.github/PULL_REQUEST_TEMPLATE.md) 의 Migration checklist 와 짝을 이룬다 — 작성자는 체크박스를 통해 self-confirmation 한다.
+
+### 6.3 사후 안전망 — `migration-recheck-on-main`
+
+`backend/migrations/**` 가 main 에 push 될 때 (= migration PR 이 머지된 직후) [`/.github/workflows/migration-recheck-on-main.yml`](../../.github/workflows/migration-recheck-on-main.yml) 이 두 가지를 자동 수행한다.
+
+- **Post-merge sanity** — `python3 scripts/check-migration-versions.py --base HEAD~1` 를 main 에서 실행. dup / gap / 단조성 / `.conf` 페어 위반이 main 에 실제로 도달했으면 워크플로가 fail 하여 Actions 탭에 빨간불이 켜진다 (Slack/Email 알림이 연동되어 있으면 자동 통지).
+- **Auto-nudge** — 열린 PR 중 `backend/migrations/**` 파일이 변경 목록에 포함된 PR 들에 "rebase + CI 재실행 필요" 코멘트를 자동 게시. PR 작성자가 race 가능성을 즉시 인지하고 §6.2 규약을 수행하도록 nudge.
+
+두 작업 모두 머지 자체를 막진 못한다 — 무료 private 환경에서 가능한 최대 강도는 "즉시 가시화 + nudge" 다. 향후 유료 플랜으로 전환 시 [§7 대안 4](#대안-4-github-branch-protection--require-branches-to-be-up-to-date) 의 branch protection 을 §6.2 로 승격하고 본 절은 backup 으로 유지할 수 있다.
+
+## 7. 폐기 대안 (Rationale)
+
+### 대안 1: 타임스탬프 prefix (`V<YYYYMMDDHHMMSS>__...`)
+
+장점은 unique 보장이 자연스럽다는 점이지만, 다음 단점으로 폐기.
+
+- 타임스탬프 순서가 **실제 의도된 실행 순서와 어긋날 수 있다** — 작성자 시계 차이 / merge 순서 / cherry-pick 으로 인해 의존성 깨짐이 발생한다.
+- Flyway 의 단조 정수 모델과 자연스럽게 맞물리지 않아 `outOfOrder` 위험을 흡수하게 된다.
+- 한 PR 의 마이그레이션을 다른 PR 의 마이그레이션 사이에 끼워 넣을 동기가 발생해 (시계 후순위) append-only 원칙이 흔들린다.
+
+### 대안 2: `flyway.outOfOrder=true`
+
+옛 V번호가 늦게 들어와도 실행한다. PR 충돌 부담은 줄지만:
+
+- **의존성 사고 위험** — V<N+1> 이 V<N> 컬럼을 참조하는 코드를 작성해 두었는데, 운영 환경에는 V<N> 이 더 늦게 들어가는 케이스가 가능해진다.
+- 환경별 적용 이력이 비결정적이 되어 디버깅·재현이 어려워진다.
+
+본 규약은 `outOfOrder=false` 를 유지하고 PR CI 가드로 충돌을 사전 차단한다.
+
+### 대안 3: GitHub Merge Queue
+
+자동화 강도는 가장 높지만:
+
+- GitHub plan 의존성 + 셋업 비용이 작지 않다 (private 저장소의 merge queue 는 유료 플랜 한정).
+- 본 repo 규모에서는 §6.2/§6.3 의 규약 + 사후 안전망만으로도 race 빈도 대비 비용 대비 효율이 더 낫다.
+- 향후 PR 동시성이 늘어 race 가 빈번해지면 재검토 후보로 둔다.
+
+### 대안 4: GitHub branch protection — "Require branches to be up to date"
+
+race 차단의 **정공법**이지만 본 repo 는 GitHub 무료 플랜의 private 저장소여서 다음 제약이 있다.
+
+- Settings → Branches → Branch protection rules 의 일부 옵션 (특히 required status checks / "up to date" 강제) 이 무료 private 에서 비활성화되어 있다.
+- `gh api -X PUT repos/<owner>/<repo>/branches/main/protection` CLI 역시 동일한 플랜 제약으로 실패한다.
+
+따라서 현재는 §6.2 (작성자 책임 규약) + §6.3 (`migration-recheck-on-main`) 으로 대체한다. 향후 유료 플랜으로 전환하면 다음 순서로 승격을 검토한다.
+
+1. Settings → Branches → main → "Require branches to be up to date before merging" 활성화.
+2. `migration-check / guard` 를 required status check 로 등록.
+3. §6.2 의 작성자 책임 규약을 자동화 차단으로 흡수.
+4. §6.3 의 `migration-recheck-on-main` 은 backup 으로 유지 — race 가 사후에라도 main 에 도달했을 때 가시화하는 역할은 branch protection 이 대체하지 못한다.
+
+---
+
+## 참고
+
+- 실제 작성 가이드(트랜잭션 모드, NOT VALID 패턴, extension, `.conf` 사용법, repair 절차): [`backend/migrations/README.md`](../../backend/migrations/README.md)
+- 시스템 아키텍처 §2.8 (Flyway 운영): [`spec/0-overview.md`](../0-overview.md)
+- 가드 스크립트: [`scripts/check-migration-versions.py`](../../scripts/check-migration-versions.py)
+- CI workflow: [`.github/workflows/migration-check.yml`](../../.github/workflows/migration-check.yml)
+
+```
+
+#### `spec/conventions/node-output.md`
+```
+# Output 변수 일관성 규칙 (Conventions)
+
+모든 노드 개선 문서가 참조하는 **공통 규칙집**입니다. 각 노드 개선 문서는 이 Principle들 중 위반 사항을 식별하고 그에 대한 구체적인 수정안을 제시합니다.
+
+> **설계 목표**: "워크플로우 작성자가 `$node["노드 이름"].output.*` 로 값을 꺼낼 때, **노드 종류를 몰라도 어디에 무엇이 있을지 예측 가능**하도록 한다."
+
+---
+
+## Principle 0 — `NodeHandlerOutput`의 5필드는 불변
+
+모든 노드 핸들러는 `{ config, output, meta?, port?, status? }` 형태의 객체를 반환합니다.
+- `config`: 해석된 설정값 (자격증명 제거)
+- `output`: 후속 노드에 전달되는 **주 데이터**
+- `meta`: **실행 메타데이터** (duration, statusCode, tokens, logs)
+- `port`: 라우팅 포트 지시 (string | string[])
+- `status`: 흐름 제어 상태 (`waiting_for_input`, `resumed`, `ended` 등)
+
+이 5필드의 의미는 **어떤 노드에서든 동일**해야 합니다.
+
+---
+
+## Principle 1 — `output` 은 "비즈니스 결과물"만 담는다
+
+`output` 아래에는 후속 노드가 로직에 사용할 **도메인 데이터**만 둡니다.
+
+| ✅ `output`에 두는 것 | ❌ `output`에 두지 않는 것 |
+| --- | --- |
+| 응답 본문 / 분류 결과 / 추출된 필드 | 토큰 수 / duration / HTTP status code |
+| 렌더링된 프레젠테이션 뷰 | LLM model 이름 / 디버그 로그 |
+| 사용자 입력 / 버튼 클릭 인터랙션 | 실행 횟수 / retry count |
+
+→ 실행 메트릭은 **Principle 2** 에 따라 `meta`에 둡니다.
+
+---
+
+
+... (truncated due to size limit) ...

```

---

### 파일 7: review/consistency/2026/05/16/09_03_04/_prompts/cross_spec.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 8: review/consistency/2026/05/16/09_03_04/_prompts/naming_collision.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 9: review/consistency/2026/05/16/09_03_04/_prompts/plan_coherence.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 10: review/consistency/2026/05/16/09_03_04/_prompts/rationale_continuity.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
commit 6ceebadd3c31fff8894670fb1c4eab4d5389ac65
Author: worker-ants <admin@getit.co.kr>
Date:   Sat May 16 09:16:59 2026 +0900

    fix(node-configs/cafe24): keep newly added fields rows visible
    
    The Cafe24 node settings panel's `Fields` editor lost newly added rows
    the moment they were created. KeyValueEditor's "Add" button appended a
    blank `{key: "", value: ""}` row, but the onChange handler converted
    the list straight to `Record<string, unknown>` and dropped the
    empty-key entry — so the next render derived its list from the
    unchanged object and the new row was gone. The "추가" button appeared
    broken.
    
    Cafe24Config now maintains the editing rows in local React state
    initialized from `config.fields`. Mutations update the state and
    propagate the (still object-shaped) result upstream, preserving the
    backend contract. External resets (undo/redo, programmatic) trigger a
    derived-state re-sync during render.
    
    Added unit tests cover: clicking Add reveals a new row, typed keys
    persist into `config.fields`, multiple Add clicks accumulate rows
    independent of the object-form filter, removing rows mutates state
    correctly, and the empty-row visibility survives object conversion.
    
    consistency-check session: review/consistency/2026/05/16/09_03_04
    (BLOCK: NO — 5 checkers all NONE, 7 INFO suggestions).
    
    [skip-e2e] — single-component UI fix; backend / spec / data model
    unchanged.
    
    Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

diff --git a/review/consistency/2026/05/16/09_03_04/_prompts/rationale_continuity.md b/review/consistency/2026/05/16/09_03_04/_prompts/rationale_continuity.md
new file mode 100644
index 00000000..d682f01d
--- /dev/null
+++ b/review/consistency/2026/05/16/09_03_04/_prompts/rationale_continuity.md
@@ -0,0 +1,612 @@
+# Rationale 연속성 Check Payload
+
+본 파일은 orchestrator 가 Rationale 연속성 checker 용으로 작성한 입력입니다. target 문서가 기존 spec 의 `## Rationale` 에서 이미 기각·폐기된 결정을 다시 도입하거나 합의 원칙을 무시하지 않는지 분석한다.
+sub-agent 의 system prompt 에 정의된 호출 규약·등급 기준·출력 형식을 그대로
+따르되, 분석 시 아래 "점검 관점" 을 빠짐없이 적용하세요. 결과는 `output_file`
+인자에 review.md 로 Write 하고 호출자에게는 STATUS 한 줄만 반환합니다.
+
+## 점검 관점 (Rationale 연속성)
+
+1. **기각된 대안의 재도입** — target 이 과거 Rationale 에서 명시적으로 거부한 대안을 다시 채택하고 있는가 (이유 명시 없이)
+2. **합의된 원칙 위반** — Rationale 에 박혀있는 설계 원칙을 따르지 않고 있는가
+3. **결정의 무근거 번복** — 과거 결정을 뒤집으면서 새 Rationale 를 함께 작성하지 않고 있는가
+4. **암묵적 가정 충돌** — Rationale 에 기록된 시스템 invariant 를 우회하는 설계가 들어와 있는가
+
+## 검토 모드
+구현 착수 전 검토 (--impl-prep, scope=spec/4-nodes/4-integration/4-cafe24.md
+
+작업 요약: cafe24 노드 설정 UI(`frontend/src/components/editor/settings-panel/node-configs/integration-configs.tsx` 의 `Cafe24Config`) 에서 fields 항목의 "추가" 버튼이 동작하지 않는 버그 수정.
+
+원인: `KeyValueEditor` 가 빈 행 `{key:"", value:""}` 추가 → `onChange` 콜백이 빈 key 를 가진 행을 object 변환 시 즉시 제거 → 다음 렌더에서 새 행이 사라짐.
+
+수정 방향: `Cafe24Config` 내부에 keyvalue 편집용 React state 를 도입해 빈 key 행이 UI 에 유지되도록 함. 사용자가 key 를 입력하면 그 시점에 object 형태(`Record<string,unknown>`) 로 `config.fields` 에 반영. 백엔드 계약(spec/4-nodes/4-integration/4-cafe24.md §1, conventions/cafe24-api-metadata.md) 의 object shape 은 그대로 보존.
+
+영향 영역: frontend/src/components/editor/settings-panel/node-configs/integration-configs.tsx + 신규 unit test 1건. 백엔드/스펙/데이터모델 변경 없음.)
+
+## Target 문서
+경로: `spec/4-nodes/4-integration/4-cafe24.md
+
+작업 요약: cafe24 노드 설정 UI(`frontend/src/components/editor/settings-panel/node-configs/integration-configs.tsx` 의 `Cafe24Config`) 에서 fields 항목의 "추가" 버튼이 동작하지 않는 버그 수정.
+
+원인: `KeyValueEditor` 가 빈 행 `{key:"", value:""}` 추가 → `onChange` 콜백이 빈 key 를 가진 행을 object 변환 시 즉시 제거 → 다음 렌더에서 새 행이 사라짐.
+
+수정 방향: `Cafe24Config` 내부에 keyvalue 편집용 React state 를 도입해 빈 key 행이 UI 에 유지되도록 함. 사용자가 key 를 입력하면 그 시점에 object 형태(`Record<string,unknown>`) 로 `config.fields` 에 반영. 백엔드 계약(spec/4-nodes/4-integration/4-cafe24.md §1, conventions/cafe24-api-metadata.md) 의 object shape 은 그대로 보존.
+
+영향 영역: frontend/src/components/editor/settings-panel/node-configs/integration-configs.tsx + 신규 unit test 1건. 백엔드/스펙/데이터모델 변경 없음.`
+
+```
+### 구현 대상 영역: `spec/4-nodes/4-integration/4-cafe24.md
+
+작업 요약: cafe24 노드 설정 UI(`frontend/src/components/editor/settings-panel/node-configs/integration-configs.tsx` 의 `Cafe24Config`) 에서 fields 항목의 "추가" 버튼이 동작하지 않는 버그 수정.
+
+원인: `KeyValueEditor` 가 빈 행 `{key:"", value:""}` 추가 → `onChange` 콜백이 빈 key 를 가진 행을 object 변환 시 즉시 제거 → 다음 렌더에서 새 행이 사라짐.
+
+수정 방향: `Cafe24Config` 내부에 keyvalue 편집용 React state 를 도입해 빈 key 행이 UI 에 유지되도록 함. 사용자가 key 를 입력하면 그 시점에 object 형태(`Record<string,unknown>`) 로 `config.fields` 에 반영. 백엔드 계약(spec/4-nodes/4-integration/4-cafe24.md §1, conventions/cafe24-api-metadata.md) 의 object shape 은 그대로 보존.
+
+영향 영역: frontend/src/components/editor/settings-panel/node-configs/integration-configs.tsx + 신규 unit test 1건. 백엔드/스펙/데이터모델 변경 없음.`
+(없음)
+
+```
+
+## 관련 Rationale 발췌
+
+### Rationale 발췌
+
+#### `spec/1-data-model.md` 의 Rationale
+
+## Rationale
+
+### Execution.execution_path → ExecutionNodeLog (V035 → V036)
+
+옛 `execution.execution_path UUID[]` 컬럼은 단일 인스턴스 환경에서는 동작했으나, 다중 backend 인스턴스가 동시에 `array_append()` 로 갱신할 때 인스턴스 간 절대 순서가 보장되지 않았다. 대체 모델로 append-only 테이블 `execution_node_log` 를 도입했고, BIGSERIAL `id` 가 PostgreSQL sequence (concurrency-safe) 로 부여되므로 `(execution_id, id)` 정렬이 곧 노드 실행 순서가 된다.
+
+이행은 lock 영향 최소화를 위해 두 단계로 분리되었다.
+
+- `backend/migrations/V035__execution_node_log_create.sql` — 테이블 생성 + `UNNEST WITH ORDINALITY` 로 기존 array 데이터 이행. `executeInTransaction=false`.
+- `backend/migrations/V036__execution_drop_execution_path.sql` — 컬럼 DROP. `lock_timeout=3s` 로 운영 영향 최소화.
+
+설계·운영 세부는 [`spec/5-system/4-execution-engine.md §7.4`](./5-system/4-execution-engine.md) 참고. 외부 API 응답의 `executionPath: string[]` 시그니처는 유지되며, `findById` 가 본 테이블의 정렬 쿼리로 채운다.
+
+### install_token 형식 (32byte hex → 16byte base64url, 2026-05-15)
+
+옛 32바이트 hex (64자) 는 Cafe24 Developers App URL 입력 필드의 100자 한도를 path prefix 단축만으로는 못 맞춰 함께 단축. 16바이트 (128-bit) 면 capability token 으로 NIST/OWASP 권장 (96-bit 이상) 을 충분히 상회. DB 컬럼 `install_token` 은 `String?` 으로 길이 제약이 없어 schema 변경 불필요 — 마이그레이션 entry 신규 추가 없음. 상세 배경·대안 비교는 [Spec 통합 화면 §9.2 Rationale "Cafe24 App URL 100자 한도 대응" 항](./2-navigation/4-integration.md#rationale).
+
+#### `spec/2-navigation/1-workflow-list.md` 의 Rationale
+
+## Rationale
+
+### 1. "공유 워크플로우" 의 정의 — 팀 워크스페이스 전체
+
+NAV-WF-07 의 "공유" 기준으로 두 옵션을 검토했다:
+
+- (a) **팀 워크스페이스에 속한 모든 워크플로우** = 공유 (선택)
+- (b) `createdBy ≠ 현재 사용자` 또는 명시적 sharedWith 컬럼 = 공유 (폐기)
+
+(a) 를 채택한 이유:
+
+- PRD 의 NAV-WF-07 원문("팀 워크스페이스에서 공유된 워크플로우 구분 표시")이 워크스페이스 단위의 격리·공유를 전제로 하고 있어, 워크스페이스 = 공유 단위라는 정의와 자연스럽게 부합한다.
+- 데이터 모델상 워크플로우 격리는 이미 `workspaceId` 로 처리되며(`backend/src/modules/workflows/entities/workflow.entity.ts`), `sharedWith` 컬럼이나 추가 마이그레이션 없이 구현 가능하다.
+- (b) 는 같은 팀 안에서 "내 것" 과 "남의 것" 을 다시 분리하는 정의지만, 그 구분은 §2.3 의 **소유 필터** 가 담당하므로 뱃지에서까지 중복으로 표현할 필요가 없다.
+
+결과적으로 뱃지(워크스페이스 = 공유)와 필터(작성자 단위 세분화)가 역할 분담된다.
+
+#### `spec/2-navigation/10-auth-flow.md` 의 Rationale
+
+## Rationale
+
+### R-1. 인증 화면 배경 — 그라데이션 복원 (2026-05-15 롤백)
+
+§1 배경 기술을 *"제품 브랜드 색상 또는 그래디언트"* (main 표현) 로 **복원**. 이전 Stage 1 (commit `b6267429`) 에서 *"`soil-50` 단색, 그라데이션 금지"* 로 구체화했으나, 동일자 §8 부분 롤백 (`spec/6-brand.md` R-13) 에서 `soil-50` 토큰이 §8.2 와 함께 폐기되어 본 표현도 함께 복원했다.
+
+코드 상태: `frontend/src/app/(auth)/layout.tsx` 는 `bg-gradient-to-br from-[hsl(var(--background))] via-[hsl(var(--muted))] to-[hsl(var(--background))]` 패턴 — Shadcn neutral 그라데이션. 로고는 `#111e14` 라운드 컨테이너 안에 별도 배치 (그라데이션 위 dark surface 로 시인성 확보).
+
+### R-2. `[Logo]` 자리 변종 명시 (2026-05-15 정정)
+
+§1 의 `[Logo]` 플레이스홀더에 *"Full logo 변종 사용"* 명시. 이전 Stage 1 에서는 *"Full logo (light)"* 로 라이트 한정했으나, §8 부분 롤백 (`spec/6-brand.md` R-13) 에서 라이트/다크 자산 선택을 노출 자리의 surface 톤에 위임하는 형태로 바뀌어 본 행에서도 라이트 한정을 제거.
+
+본 문서는 로고가 노출되는 **자리**를 정의하고, 자리에 들어가는 변종·라이트/다크 선택은 brand spec §8.4.1 매트릭스 + §8.4.6 의 노출 자리 규정을 따른다 (R-9 — 브랜드 spec 의 라우트 spec 우선권).
+
+근거 출처: `spec/6-brand.md §8.4.1`, `§8.4.6`, `R-13`. 사전 일관성 검토 세션: `review/consistency/2026/05/15/18_36_51/` (Stage 1), `review/consistency/2026/05/15/23_45_11/` (롤백).
+
+#### `spec/2-navigation/4-integration.md` 의 Rationale
+
+## Rationale
+
+### Cafe24 Private 앱의 callback 실패는 왜 status 를 보존하나 (2026-05-14)
+
+`pending_install` 상태의 Integration 이 callback 처리 중 token exchange 실패 등으로 떨어졌을 때, 자연스러운 선택지는 `error(auth_failed)` 로 전이하는 것이다. 그러나 Private 앱은 `reauthorize` 액션이 불가능하다 — OAuth 재시작은 **Cafe24 Developers 의 "테스트 실행"** 만 정식 진입점이고, 그 진입점은 우리가 발급한 `install_token` 을 path 에 그대로 사용한다. status 를 `error` 로 바꾸면 (a) UI 가 "reauthorize" 액션을 권장하지만 실제로 그 액션이 무력하고, (b) 사용자는 cafe24 측 설정을 고친 뒤 다시 "테스트 실행" 을 누르는 외부 흐름을 진행 중인데 우리 화면이 이를 "error" 로 표기해 흐름 단계를 오인하게 된다. 따라서 callback 실패는 `status_reason` + `last_error` 만 채우고 status 는 `pending_install` 그대로 유지한다. (참고: `review/consistency/2026/05/14/18_23_55`)
+
+`status_reason` 의 저장값은 callback 에러 코드를 `snake_case` 로 표기한다 — DB 컬럼 컨벤션 전체가 `auth_failed`, `token_expired` 등 `snake_case` 인 것과 통일. 한편 API 응답·callback HTML 의 에러 코드는 `OAUTH_*`, `CAFE24_*` 같은 `UPPER_SNAKE_CASE` 를 유지한다 (HTTP 컨벤션). 동일 의미 두 표기는 §10.4 에서 매핑.
+
+`last_error.code` 와 `status_reason` 이 같은 값을 중복 보존하는 이유: `last_error` 는 JSONB 라 보존 정책(향후 GDPR 등)에 따라 소거될 수 있다. `status_reason` 은 plain string 컬럼으로 더 가볍게 유지되며, "왜 이 상태에 있는지" 의 핵심 신호로 보존된다. `status_reason` 은 에러 분류 코드만 담아 민감 정보 미포함 → 평문 저장.
+
+### OAuthState.mode='reauthorize' 를 초기 install 에도 재사용한 이유 (2026-05-14)
+
+Cafe24 Private 의 "테스트 실행" 흐름은 `pending_install` 행이 이미 존재하는 상태에서 OAuthState 를 새로 발급해 token 교환을 완료한다 — 의미상 "기존 행에 token 을 채운다" 라는 점에서 `mode='reauthorize'` 와 동일 (`mode='new'` 는 OAuthState 에 integrationId 가 없고 callback 이 previewToken 을 발급하는 다른 흐름). 별도 `mode='cafe24_private_install'` 을 신설하는 안도 검토했으나, callback 의 처리 분기가 동일 (integration row UPDATE) 이고 §10.2 step 4 가 이미 reauthorize 를 "기존 integrationId 의 credentials 갱신" 으로 정의하고 있어 enum 확장으로 얻는 이득이 없다. status 가 `pending_install` 이냐 `connected` 이냐에 따라 callback 의 후처리만 살짝 다를 뿐 (`installToken=null` 처리 등). 단, 향후 reauthorize 와 분리해야 할 동작이 늘어나면 별도 mode 신설 검토.
+
+### CAFE24_PRIVATE_APP_ALREADY_CONNECTED 의 mall_id 비교 경로 (2026-05-15 갱신)
+
+**현행 (V045+)**: `mall_id` 가 plain 컬럼 (`integration.mall_id`) 으로 분리되어 — `credentials.mall_id` (encrypted JSONB) 와 동일 값을 plain 컬럼으로 복제 — SQL WHERE 절로 직접 필터링·UNIQUE 제약 강제가 가능. 부분 UNIQUE 인덱스 `(workspace_id, mall_id) WHERE service_type='cafe24' AND mall_id IS NOT NULL` 이 같은 workspace 내 중복 cafe24 통합 생성을 SQL constraint violation 으로 거부 (TOCTOU race 차단). begin 핸들러는 in-memory 사전 체크 (connected → 409 / pending → reuse 분기 판단) 와 함께 SQL UNIQUE 를 backstop 으로 사용 — 두 검사를 모두 통과한 동시 INSERT 는 `23505 unique_violation` 으로 변환되어 같은 409 응답을 받는다.
+
+**옛 (V045 이전, 2026-05-14)**: `mall_id` 가 암호화 JSONB 안에만 있어 SQL 필터 불가. begin 시점에 (a) 동일 workspace 의 cafe24 통합을 SQL 로 조회한 뒤 (b) ORM 경계의 자동 복호화로 `credentials.mall_id` 와 in-memory 비교. (a) O(N) decrypt 비용 + (b) SELECT 와 INSERT 사이의 TOCTOU 윈도우 두 가지 운영 위험.
+
+**전환기**: V045 이전 행은 `mall_id` 컬럼이 NULL — 부분 UNIQUE 가 그런 행을 비교 대상에서 제외하므로 새 행과 충돌하지 않는다. 옛 행은 callback / re-auth 시점에 plain 컬럼이 backfill 되어 점진적으로 인덱스 범위로 편입된다. begin 시점의 in-memory 비교도 동일 전환기 동안 `credentials.mall_id` fallback 을 둔다.
+
+### install_token 을 App URL path 식별 키로 승격 (2026-05-14)
+
+원래 설계는 `GET /oauth/install/cafe24` 가 mall_id + HMAC 만 받고, 백엔드가 `pending_install` 행을 in-memory 로 100건 스캔하면서 mall_id 일치 candidates 의 client_secret 으로 HMAC 검증을 trial 했다. 두 가지 운영 위험이 누적됐다 — (a) 동일 mall_id 의 중복 `pending_install` 이 누적되면 HMAC 매칭이 비결정적이고 사용자가 보고 있는 행이 아닌 다른 행이 connected 처리될 수 있다, (b) `pending_install` 수가 커지면 O(N) 매칭 비용. App URL path 에 `install_token` 을 박으면 단일 row 조회로 고정되고, 토큰 자체가 random 이므로 추측 불가능한 식별자 역할도 겸한다. 옛 토큰 없는 경로는 별도 PR 로 즉시 제거됐다 (운영 등록자 0 인 시점에 정리 — 이후 등록자는 새 token-pathed URL 만 발급받는다).
+
+(2026-05-15 후속: 토큰을 16바이트 base64url 22자로 단축 — 보안 동등성은 본 섹션 "Cafe24 App URL 100자 한도 대응" 항 참조)
+
+`install_token` 은 App URL path 에 공개 포함되는 식별자로 평문 저장 — credentials/last_error 암호화 정책 대상 아님.
+
+### CAFE24_INSTALL_INVALID_TOKEN(404) 의 보안 전제 (2026-05-14)
+
+옛 `CAFE24_INSTALL_INVALID_HMAC(403, pending 미발견 포함)` 합산 정책은 토큰이 path 에 없던 시절 "어느 mall_id 에 pending 이 있는지" 정보가 응답 코드로 새지 않게 하는 안전망이었다. 새 디자인에서 `install_token` 은 **128-bit 이상 random** (현행 16바이트 base64url, 2026-05-15 단축 이전엔 32바이트 hex 256-bit) 이라 추측 불가능 — URL path 자체가 capability token 처럼 동작한다. 이 전제 하에서 "토큰 미존재" 케이스를 `CAFE24_INSTALL_INVALID_TOKEN(404)` 로 분리해도 무의미한 enumeration 이 일어나지 않는다. **이 전제가 깨지면** (예: **96-bit (12바이트) 미만으로의 토큰 길이 단축**, PRNG 변경, install_token 노출 사고) 다시 403 으로 통합해야 한다.
+
+### install_token TTL 24h (2026-05-14)
+
+**기존 spec §6 는 install timeout 시 `→ (삭제)` 를 명시했으나 본 개정에서 `→ expired (status_reason='install_timeout')` 로 번복한다.** 이유: 데이터 분석·감사 목적으로 보존이 유리하고, 사용자가 만료된 행을 보고 "왜 install 이 안 됐는지" 를 진단할 단서가 남아야 함. 자동 삭제는 더 이상 일어나지 않으며, manual delete 만 삭제 경로다.
+
+Cafe24 Developers 의 앱 등록 → "테스트 실행" 까지의 사용자 작업 텀을 최대 1일로 가정한다. 더 길면 stale `pending_install` 행이 누적되어 §9.2 의 식별 키 룩업 성능과 §2.4 attention 카운트에 잡음. 더 짧으면 정상 흐름이 끊긴다 (사용자가 점심·미팅·휴일 사이클에 작업이 분할되기 쉬움). 24h 가 지나면 `status='expired'`, `status_reason='install_timeout'`, `install_token=NULL` 로 자동 전이. 만료된 행은 데이터 분석·감사 목적으로 삭제하지 않고 보존한다 (manual delete 별도).
+
+**TTL 기준 (2026-05-15 갱신)**: `install_token_issued_at` 컬럼 (V044) 을 기준으로 한다 — `created_at` 이 아닌 토큰 발급 시각. 변경 3 (중복 pending_install 재사용) 으로 같은 mall_id 의 begin 재호출이 기존 row 의 install_token 만 갱신할 때, 새 토큰이 발급되자마자 24h 카운트가 끝나 있는 문제를 해소. callback 성공 시 `install_token` 과 함께 `install_token_issued_at` 도 NULL 로 비워진다. 옛 (V044 이전) 행은 NULL — 스캐너 SQL 이 `COALESCE(install_token_issued_at, created_at)` 로 fallback 해 legacy 의미를 유지.
+
+`status_reason='install_timeout'` 인 expired 행에서는 reauthorize 버튼이 **비활성** 이다 — Private 앱은 재인증 진입점이 없고 cafe24 "테스트 실행" 만 정식이다. 사용자는 행을 삭제 후 새로 등록한다.
+
+### status_reason `oauth_token_exchange_failed` 와 auth 도메인의 `token_exchange_failed` 구분 (2026-05-14)
+
+소셜 로그인 흐름(`spec/2-navigation/10-auth-flow.md`) 의 URL param `error=token_exchange_failed` 와 본 spec 의 통합 callback `status_reason='oauth_token_exchange_failed'` 는 도메인이 다른 별개 신호다 — 전자는 user authentication 도메인, 후자는 integration credentials 도메인. 의도적으로 prefix `oauth_` 를 두어 grep·index 시 도메인 구분이 자명하도록 분리했다. 이름은 통일하지 않는다.
+
+### Cafe24 Private 의 `connected → expired` 복구 경로 (2026-05-14)
+
+일반 OAuth provider 는 `expired → connected` 가 reauthorize 또는 자동 refresh 로 복구된다 (§6 / data-flow §3.1). **Cafe24 Private 앱은 reauthorize 진입점이 없고**, refresh 도 token endpoint 가 mall 별이라 일반 흐름이긴 하지만 만약 refresh 가 실패해 `expired(refresh_failed)` 로 떨어지면 **복구 유일 경로는 삭제 후 재등록** 이다. 이건 Private 앱의 구조적 제약 (우리 서버가 OAuth 를 시작할 수 없음) 의 당연한 귀결이며, §6 전이 표의 `expired → connected (reauthorize)` 항은 Cafe24 Private 에는 적용되지 않음. UI 의 reauthorize 버튼 비활성 (§4.2) 이 이 사실을 반영한다.
+
+### `pending_install` 은 필터 칩에 추가하지 않는다 (2026-05-14)
+
+§2.3 상태 필터 칩은 `Connected / Expiring / Expired / Error` 4종 + All 로 운영된다. `Pending install` 은 사용자가 외부 흐름(Cafe24 Developers) 을 진행 중인 **정상 전환 상태** 로 보고 필터 칩에 추가하지 않는다. 별도 필터링 수요가 발생하면 후속 plan 으로 추가 검토.
+
+### Cafe24 App URL 100자 한도 대응 — `/api/3rd-party/<provider>/` namespace 도입 (2026-05-15)
+
+운영 사용자가 Cafe24 Developers 의 앱 URL 입력 필드에서 "허용 길이 초과" 경고를 받아 Private 앱 연동이 막혔다. 수동 테스트 결과 100자 제한이며, 호스트 변동 가능성까지 감안해 90자를 마지노선으로 잡았다. 현행 `/api/integrations/oauth/install/cafe24/<64-hex>` 은 호스트 32자 가정 135자로 한도 초과.
+
+**두 부분을 모두 단축**:
+
+- **path namespace**: `/api/integrations/oauth/install/cafe24/...` (39자) → `/api/3rd-party/cafe24/install/...` (30자). 옛 namespace 는 "사용자가 호출하는 통합 관리 API" 와 "3rd party 가 호출하는 콜백·설치 API" 가 한 prefix 에 섞여 있던 구조. 3rd-party 의미가 명확한 prefix 로 분리하면 IP allowlist · rate limit · 미래 webhook receiver 같은 per-provider 처리가 sub-tree 단위로 모인다.
+- **install_token**: 32바이트 hex (64자) → 16바이트 base64url no-padding (22자). 128-bit 엔트로피는 capability token 으로 충분 (NIST SP 800-63B §A.7 권장 96-bit 이상, OWASP capability token 가이드 128-bit 권장). 옛 256-bit 는 과잉.
+
+**provider-grouped vs action-grouped**: `/api/3rd-party/cafe24/install/:token` (provider-grouped) 대신 `/api/3rd-party/install/cafe24/:token` (action-grouped) 도 검토. 두 안 모두 길이 동일. provider-grouped 채택 이유 — (a) 향후 Cafe24 webhook receiver 등을 추가할 때 `/api/3rd-party/cafe24/webhook` 처럼 같은 sub-tree 에 모임. action-grouped 면 webhook 이 또 다른 top-level segment 가 되어 비일관. (b) 새 provider 가 들어올 때 모듈 단위 (`Cafe24ThirdPartyController` 등) 매핑이 자연스럽다. (c) per-provider 미들웨어 (IP allowlist 등) prefix 가 한 곳.
+
+**google/github callback 도 동시 이동**: cafe24 만 옮기면 callback 경로가 provider 별로 갈라져 비대칭 (`/api/3rd-party/cafe24/callback` vs `/api/integrations/oauth/callback/google`). 일관성 우선 + OAuth 콘솔 재등록을 한 번에 마치는 편이 운영상 깔끔. 운영 영향: Google Cloud Console / GitHub OAuth App / Cafe24 Developers 모두 새 redirect URI 등록 필요 (배포와 동시). 사용자 소셜 로그인용 redirect URI (`/api/auth/oauth/:provider/callback`) 는 **별개로 유지** — 두 URI 가 같은 OAuth 콘솔에 공존한다 (§10.1 참고 노트 참조).
+
+**callback URL 표기 컨벤션**: spec 본문·표·다이어그램은 모두 파라메트릭 단일 형식 `/api/3rd-party/:provider/callback` (`:provider ∈ {cafe24, google, github}`) 만 사용한다. 컨트롤러 구현이 provider 별 분리 (3개) 인지 파라메트릭 (1개) 인지는 구현 plan 의 결정 사항.
+
+**옛 경로 미보전**: `/api/integrations/oauth/install/cafe24/:installToken` 및 `/api/integrations/oauth/callback/:provider` 핸들러는 즉시 제거. 운영자에게 OAuth 콘솔 갱신이 강제로 가시화되는 편이 누락 없이 안전. 이전 동일 패턴 (2026-05-14, 토큰 없는 경로 즉시 제거) 의 선례를 따른다. 옛 토큰 없는 `/api/integrations/oauth/install/cafe24` 의 410 Gone hint 라우트는 현재 코드에 존재하지 않으며 (followup plan 의 가설적 항목이었음), 본 PR 의 변경과 무관.
+
+**기존 `pending_install` 행 마이그레이션 생략**: 옛 64자 hex 토큰을 가진 행은 이미 옛 라우트와 결속되어 있고, 새 라우트는 22자 base64url 만 발급한다. 새 라우트로 호출 자체가 path-format mismatch 로 404 가 되므로 자연 만료 (24h install_timeout 스캐너) 에 맡긴다. 실제 영향 범위는 보고된 사례 자체가 "길이 초과로 등록 못 함" 상태였으므로 거의 0.
+
+### Cafe24 App URL 재호출 흐름 — install_token persistent 격상 (2026-05-15)
+
+Cafe24 Developers Console 에 등록한 App URL 은 **두 가지 진입점** 모두에서 호출된다 — ① 초기 install (테스트 실행), ② **post-install navigation** (카페24 쇼핑몰 관리자의 "앱으로 가기" 버튼). ②번이 새로 발견된 요구사항으로, 옛 spec 의 single-use 가정 (callback 성공 시 `installToken=NULL` 소거) 과 충돌해 운영 사용자가 "앱으로 가기" 클릭 시 `404 CAFE24_INSTALL_INVALID_TOKEN` 을 받았다 (2026-05-15 사용자 보고).
+
+**결정**: `install_token` 을 통합 lifetime 동안 보존되는 persistent identifier 로 격상.
+
+- `pending_install → connected` 전이 시 token 보존 (옛: NULL 처리 → 새: 그대로).
+- `handleInstall` 이 status 분기 — `pending_install` → OAuth authorize, `connected`/`error(*)`/`expired` → 우리 frontend redirect.
+- HMAC 검증은 두 분기 모두 유지 (Cafe24 출처 보증).
+- V045 partial UNIQUE `(install_token) WHERE install_token IS NOT NULL` 은 변경 없음 — 한 워크스페이스 안에서 같은 token 이 한 row 에만 매핑되는 invariant 보존.
+
+**옛 connected 행 호환**: 본 변경 이전에 connected 로 전환되어 token 이 이미 NULL 인 통합은 새 동작이 작동하지 않는다 ("앱으로 가기" 클릭 시 여전히 404). 마이그레이션 plan 없이 자연 해소 — 사용자가 통합을 삭제 후 재등록하면 새 token 이 발급되고 새 동작 적용. 옛 행을 위해 추가 마이그레이션 비용을 들이지 않는 이유는 (a) Cafe24 Private 통합 사용자 수가 적고, (b) 재등록 비용이 SQL 마이그레이션 작성·테스트 비용보다 낮으며, (c) 옛 행의 client_secret 이 credentials 에 그대로 있어 token 재발급 자체는 가능하나 그 시점부터 다시 "테스트 실행" 부터 시작해야 하므로 결국 사용자 작업이 필요해 자동화 가치가 낮다.
+
+**NULL 처리 유지 경로**: `pending_install → expired (install_timeout)` 의 24h TTL 만료는 token 을 NULL 로 소거 유지 — 사용자가 새 통합을 등록해야 하므로 옛 token 무효화가 정당. 통합 삭제 시도 row 삭제로 token 자동 소멸.
+
+**post-install navigation 의 redirect target**: `${FRONTEND_URL}/integrations/<id>` 로 통일. 사용자가 카페24 admin 에서 우리 앱으로 들어올 때 그 통합의 상태·diagnostic 을 바로 확인할 수 있는 화면. 단순 `${FRONTEND_URL}/` 으로의 redirect 도 검토했으나 (워크플로 목록 등) 통합 컨텍스트 보존이 더 유익.
+
+### Cafe24 Private request-scopes 흐름 (2026-05-15)
+
+cafe24 Private 의 OAuth 시작은 우리 서버가 할 수 없어 `mode='reauthorize'` 에서 begin 이 `CAFE24_PRIVATE_APP_USE_TEST_RUN` 으로 거부한다. 옛 `/request-scopes` 는 내부적으로 begin 을 호출하며 mode `request_scopes` 도 같은 거부 분기에 걸려 동작 불가였다 (2026-05-15 운영 사용자 보고 — `CAFE24_INVALID_MALL_ID` 가 noise, 실제로는 Private 흐름이 막혀 있는 본질적 문제). 또한 옛 requestScopes 는 `entity.credentials.mall_id` 를 providerMeta 로 전달하지 않아 begin 의 cafe24 검증부가 missing mall_id 로 reject 도 함께 발생.
+
+**결정**: `requestScopes` 가 cafe24 Private 을 감지하면 begin 우회 — 기존 `installToken` 보존 + `credentials.scopes` merge 갱신 + `{ mode: 'cafe24_private_pending', integrationId, appUrl, callbackUrl, scopesAdded }` 응답. 사용자가 Cafe24 Developers 의 앱 권한에서 추가 scope 활성화 후 "테스트 실행" 누르면 기존 install handler 가 작동 → callback → token 의 scope 가 확장된 새 token 으로 교체된다.
+
+**왜 begin 우회인가**: begin 의 Private 거부는 정당 (OAuth 시작 불가). request-scopes 는 본질적으로 "OAuth 재시작 + 확장 scope" 인데, Private 에서는 Cafe24 측 진입점만 정식이므로 우리 화면은 안내만 담당. credentials.scopes merge 는 install handler 의 `OAuthState.requestedScopes` 채움에 영향을 주므로 사전에 갱신해 둔다.
+
+**`request_scopes` 와 `reauthorize` 의 분리 유지**: 옛 코드는 두 mode 가 거의 동일 처리. 새 흐름에서도 Private 의 reauthorize 는 여전히 거부 (사용자가 reauthorize 의도로 누르면 안내 — Private 앱은 "테스트 실행" 만 정식). request_scopes 만 위 우회 분기로 처리.
+
+**UI 안내 패턴 결정 (2026-05-16 추가)**: 분기 ② 응답(`cafe24_private_pending`) 에 대한 화면 표시는 modal/dialog 가 아닌 **inline alert + info 토스트** 로 정한다. modal 은 닫히면 잊혀지지만 Cafe24 측 작업(권한 활성화 → 테스트 실행)을 진행하는 동안 사용자가 안내를 계속 참조해야 한다 — 따라서 inline 으로 영구 표시. toast 는 응답 도착 신호로만 사용 (alert 가 본문). alert 생존 주기는 "다음 요청 시작 직전 reset" — `useMutation` 의 `onMutate` 훅에서 비워 옛 안내가 새 요청과 섞이지 않게 한다. 본 분기에서는 부모 페이지의 refetch 콜백을 호출하지 않는다 — token 갱신은 Cafe24 측 후속 callback handler (`handleInstall` 의 status 분기) 가 담당하므로 즉시 refetch 해도 변화 없음. `scopesAdded` 는 alert 안의 칩 목록으로 표시하되 빈 배열이면 칩 영역 자체를 숨긴다. UI 매핑 표는 §4.4.
+
+### Cafe24 install_token mismatch 회복 흐름 (2026-05-15 후속)
+
+운영 사용자 보고 — 새 통합 등록 후 Cafe24 Developers 에 App URL 을 등록했는데, "테스트 실행" 시 우리 endpoint 가 `404 CAFE24_INSTALL_INVALID_TOKEN` 응답. 원인: 사용자가 신규 통합 폼을 여러 번 제출하면서 (예: client_secret 오타 수정) idempotent begin 의 credentials-change 분기로 install_token 이 재발급됨. 마지막에 본 URL 만 옳고, 그 사이 Cafe24 Developers 에 등록한 옛 URL 은 stale.
+
+옛 동작은 단호한 404. 사용자는 통합 상세 페이지에서 현재 App URL 을 확인해 Cafe24 Developers 를 수동 갱신해야 회복 가능. UX 가 뚝뚝 끊기고 운영 문의가 잦음.
+
+**결정**: `handleInstall` 의 install_token 직접 매칭 실패 시 회복 분기 추가.
+
+1. 같은 mall_id 의 cafe24 row 들 조회 (V046 partial UNIQUE 로 보통 1~2건).
+2. 각 row 의 `client_secret` 으로 HMAC trial 검증.
+3. **정확히 1개** validates → 그 row 의 OAuth/navigation 흐름으로 fall-through.
+4. 0개 또는 2개+ → 기존 404 흐름 + HTML 안내 페이지 (사용자가 통합 상세의 현재 App URL 로 갱신).
+
+비용: O(N) HMAC verify (회복 분기에서만, 정상 흐름 zero impact). 옛 폐기된 "100건 mall_id 스캔 + trial HMAC" (Rationale "install_token 을 App URL path 식별 키로 승격" 항 참조) 과 형태는 비슷하나 (a) 호출 빈도가 낮고 (404 fallback only), (b) **같은 workspace 안에서는** V046 partial UNIQUE `(workspace_id, mall_id) WHERE service_type='cafe24' AND mall_id IS NOT NULL` 이 같은 mall_id row 를 최대 1개로 제한하며, 회복 분기 스캔이 workspace 횡단이라도 같은 mall_id 를 둘 이상 workspace 에서 동시 사용하는 케이스는 드물어 N=1~2 가 실무 값 ("구조적 상한 N≤2" 가 아니라 workspace-scoped 1개 보장 + 실무적으로 소수). 정상 식별은 여전히 install_token 단일 row 조회.
+
+**TOCTOU 부재**: 회복 분기는 SELECT + HMAC verify 만 수행하는 read-only 조회로 INSERT/UPDATE 가 없어 race 자체가 발생하지 않는다. begin 핸들러의 V045 partial UNIQUE backstop (`CAFE24_PRIVATE_APP_ALREADY_CONNECTED` Rationale 참조) 은 INSERT 단계의 동시 신청 차단을 담당하는 보완 보증이며, 본 분기와는 다른 시점의 보증.
+
+**보안 분석**: HMAC 위조에는 client_secret 이 필요. client_secret 보유자는 정상 흐름으로도 동일 행위 가능 → 회복 흐름이 추가 권한을 부여하지 않음. install_token capability-token 가정 ("CAFE24_INSTALL_INVALID_TOKEN(404) 의 보안 전제" 항 참조) 는 그대로 유지 — 옛 URL 이 leak 되어도 HMAC 위조 없이는 진행 불가.
+
+**모호 케이스 (2개+ HMAC 매칭)**: 같은 mall_id 가 두 workspace 에 등록되어 있고 동일 client_secret 을 공유하는 경우 (드문 케이스 — 한 Cafe24 앱을 우리 서비스의 둘 이상 workspace 에서 동시에 사용). 어느 row 를 선택할지 결정 불가 → 회복 포기 + 404. 회복 운영로그 (`[cafe24-install-recovery] ambiguous: N rows passed HMAC`) 가 진단을 보조.
+
+**HTML 에러 페이지**: 404 (회복 실패 포함) 시 요청의 `Accept: text/html` 일 때 minimal styled HTML 페이지 렌더. error code/message + 회복 안내 ("통합 상세 페이지에서 현재 App URL 을 확인해 Cafe24 Developers 를 갱신하세요"). API 클라이언트 (JSON 기대) 는 기존 JSON 응답 유지.
+
+### Cafe24 Public app 가용성 — env 기반 노출 (2026-05-15 후속)
+
+Cafe24 Public app 흐름은 우리 서버의 `CAFE24_CLIENT_ID` / `CAFE24_CLIENT_SECRET` env 가 등록된 경우에만 동작 (앱스토어 등록 앱의 OAuth client credentials). env 가 미설정이면 Public 옵션을 선택해도 begin 이 `OAUTH_CONFIG_MISSING` 으로 거부 — 사용자 입장에서 dead-end UX.
+
+**결정**: `/api/integrations/services` 응답의 cafe24 항목에 `meta.publicAppAvailable: boolean` 노출. `CAFE24_CLIENT_ID && CAFE24_CLIENT_SECRET` 둘 다 set 이면 true. Frontend 의 신규 통합 폼이 false 일 때 Public 옵션 토글에서 제거 + 기본값 `private` 강제 + 안내 문구 갱신.
+
+**Private 는 항상 노출**: env 와 무관. 사용자가 직접 client_id/secret 입력하므로 deployment 의 env 상태에 의존하지 않음. Public 만 env 게이트 (사용자 명시 결정).
+
+**왜 server-side 게이트인가**: 클라이언트가 env 를 알 길이 없으므로 server 가 single source of truth. `meta` 객체에 담아 향후 다른 가용성 hints (예: GitHub Enterprise URL 설정 여부 등) 도 같은 통로로 노출 가능.
+
+#### `spec/2-navigation/9-user-profile.md` 의 Rationale
+
+## Rationale
+
+### `/profile` 편집 인터랙션의 분리 (§2)
+
+초기 와이어프레임은 사용자 정보·환경설정·비밀번호 변경을 한 페이지의 폼으로 묶고 하단 단일 `[Save Changes]` 버튼으로 모두 커밋하는 형태였다. 다음과 같은 footgun 이 식별되어 현재의 하이브리드 편집 패턴(인라인 토글 + sub-route + diff 확인 모달) 으로 개정했다.
+
+- **이질적 변경의 의도 충돌** — 자격증명(비밀번호)·개인정보(이름·아바타)·환경설정(언어·테마) 은 위험 수준이 서로 다른데도 한 번의 클릭이 모두를 동시에 PATCH 하는 구조였다. 사용자 의도와 실제 결과가 어긋날 가능성이 컸다.
+- **무방비 편집 활성화** — 모든 input 이 디폴트로 활성화되어 있어 단순 탐색 중에도 실수 입력이 그대로 저장 대상이 되었다.
+- **세션 강제 종료 패턴과의 톤 불일치** — `/profile/sessions` 의 강제 종료는 이미 `RevokeConfirmDialog`(password/TOTP 재인증) 로 명시적 의도를 분리해 안전하게 운영 중인데, 같은 영역의 다른 민감 동작은 그 톤을 따르지 못하고 있었다.
+
+해법으로 (a) `/profile` 을 디폴트 readonly 로 두고 카드 단위 [편집] 토글로 의도를 분리, (b) 저위험 항목(이름·환경설정) 도 저장 직전 변경 전·후 diff 확인 모달을 한 단계 거치게 해 실수 방지, (c) 고위험 항목(비밀번호) 은 별도 sub-route 진입 자체가 의도 표명 역할을 하도록 채택했다. 이메일은 기존 결정대로 "별도 변경 (확인 메일)" 으로 본 화면에서 분리한 상태를 유지한다.
+
+폐기된 대안:
+
+- **모달 일원화** — 모든 편집을 모달로 처리(인라인 토글 없음). 환경설정처럼 자주 만지는 항목까지 매번 모달이 떠야 해 마찰이 과도하다고 판단.
+- **전 항목 sub-route** — 환경설정·이름까지 모두 별도 라우트로 분리. 라우팅·뒤로가기 비용이 가치 대비 과도. 위험 수준에 비례한 마찰이 더 합리적.
+- **단일 페이지 + 섹션별 Save 버튼** — 폼은 그대로 두고 Save 만 섹션 단위로 쪼개기. "폼이 디폴트로 노출되어 무방비" 라는 핵심 문제를 해결하지 못함.
+
+#### `spec/2-navigation/_layout.md` 의 Rationale
+
+## Rationale
+
+### R-1. 사이드바 로고 변종 규칙 (2026-05-15)
+
+§2.1 로고 행에 expanded/collapsed 변종 규칙을 추가한 이유: 본 문서는 사이드바의 **자리**만 정의하고, 자리에 들어가는 로고 변종·색은 `spec/6-brand.md §8.4` (brand spec) 가 단일 진실로 결정한다. 본 행은 brand spec §8.4.6 의 결정(expanded → Full logo / collapsed → Icon mark)을 자리 정의에 반영한 것이다.
+
+근거 출처: `spec/6-brand.md §8.4.6` (로고 노출 자리) 및 동 문서 R-9 (브랜드 spec 의 라우트 spec 우선권). 사전 일관성 검토 세션: `review/consistency/2026/05/15/18_36_51/`.
+
+### R-2. §2.1 로고 행 정정 (2026-05-15 롤백)
+
+§8.2 컬러 토큰 정식화 폐기(`spec/6-brand.md` R-13) 와 함께, 본 §2.1 의 *"Full logo (light)"* 표현에서 *(light)* 한정을 제거. 라이트/다크 자산 선택은 노출 자리(surface) 의 배경 톤에 따라 brand spec §8.4 가 결정한다. R-1 의 §8.4.6 참조는 본 롤백 후에도 유효하며, 다만 §8.4.6 표 자체가 *"라이트/다크 자산 선택은 노출 자리에 맞춤"* 표현으로 정정되었다.
+
+사전 일관성 검토 세션: `review/consistency/2026/05/15/23_45_11/`.
+
+#### `spec/3-workflow-editor/4-ai-assistant.md` 의 Rationale
+
+## Rationale
+
+본 spec 결정 사항의 배경·근거. memory/ 에 남아있던 작업 메모를 inline 흡수한 것이며, 폐기된 대안과 1회성 분석 자료는 `plan/complete/archive/from-memory/` 를 참조.
+
+_원본 메모: memory/workflow-ai-assistant-decisions.md_
+
+### Workflow AI Assistant — 기획 결정 메모
+
+Workflow AI Assistant(에디터 내 채팅형 AI) 스펙 작성 시 사용자와 합의한 결정 사항을 구현자가 재참조할 수 있도록 정리한다.
+
+#### 확정된 결정 사항
+
+| 항목 | 결정 | 근거 |
+|------|------|------|
+| 제품 명칭 | **Workflow AI Assistant** / 워크플로우 AI 어시스턴트 | PRD/Spec/i18n 전 영역에서 통일 사용. "Copilot", "AI Workflow Builder" 후보는 기각 |
+| PRD 배치 | `prd/2-workflow-editor.md` §10, 요구사항 ID 접두사 `ED-AI-*` | 에디터 내부 UI/UX가 주 영역이므로 에디터 문서에 포함. PRD 6에서는 cross-ref만 |
+| 채팅 세션 영속화 | **서버 저장** (신규 엔티티 `AssistantSession`, `AssistantMessage`) | 페이지 새로고침·재접속 시 이어서 대화 지원. 관련: `spec/1-data-model.md` §2.20~2.21 |
+| 변경 적용 방식 | 즉시 반영 + Undo (`editor-store` 재사용) | 기존 자동 저장/Ctrl+S 흐름과 일관. DB 영구 기록은 사용자의 Save를 통해서만 |
+| 스트리밍 | SSE + `LLMClient.stream()` 신규 메서드 | 관련: `spec/5-system/7-llm-client.md` §8 |
+| 스트리밍 v1 지원 provider | OpenAI, Anthropic만 | Google/Azure는 Tool-use 포맷 차이로 후속. 미지원 provider 선택 시 `ASSISTANT_STREAMING_UNSUPPORTED` 에러 |
+| NodeSettings Panel과 동시 오픈 | **상호 배타** (Assistant 열면 Settings 닫힘) | MVP 단순화. 사용자 피드백에 따라 후속 버전에서 나란히 배치 가능 |
+| Assistant의 편집 권한 | `editor` 역할 이상 | 기존 RBAC 규약 재사용 |
+
+#### 구현 시 유의 사항 (승인된 기술 플랜 `~/.claude/plans/ui-partitioned-porcupine.md` 대비 변경점)
+
+원래 기술 플랜에는 "채팅 히스토리는 in-memory only (MVP)"로 명시되어 있었으나, **기획 단계에서 서버 영속화로 변경**되었다. 따라서 다음 작업이 추가된다:
+
+1. **DB 엔티티 2개 신규**: `AssistantSession`, `AssistantMessage` (Flyway 마이그레이션 필요)
+2. **REST API 5개 신규**: `GET/POST/PATCH/DELETE /workflow-assistant/sessions`, `GET /workflow-assistant/sessions/:id`. SSE 엔드포인트는 `POST /workflow-assistant/sessions/:id/messages`로 경로 변경 (기존 플랜의 `/workflow-assistant/message`가 아님).
+3. **백엔드 Service**: 세션/메시지 CRUD + 대화 컨텍스트 조립(최근 30턴 프롬프트 주입 룰).
+4. **프론트엔드 스토어**: `assistant-store.ts`가 서버 세션 id를 들고 있어야 하며, 패널 오픈 시 `GET /sessions?workflowId=...`로 기존 세션을 로드.
+5. **Cascade 삭제**: `Workspace` 삭제 → `Workflow` 삭제 → `AssistantSession` 삭제 → `AssistantMessage` 삭제. Flyway 마이그레이션에서 ON DELETE CASCADE FK 설정.
+
+#### 미결 UX (발견 시 확인 필요)
+
+- 세션 보관 기간/자동 archive 정책 — 현재 Spec은 "수동 삭제까지 영속". 향후 워크스페이스별 용량 제한과 연계 가능.
+- 세션 공유/내보내기 — v1 스코프 밖 명시. 팀 워크스페이스 RBAC 선행 필요.
+- Plan 카드의 step을 사용자가 직접 편집/체크 가능한지 — 현재 Spec은 "사용자 조작 불가, 진행도 표시 전용"(§3.3). 필요해지면 별도 RFC.
+
+_원본 메모: memory/workflow-assistant-prompt-restructure.md_
+
+### Workflow AI Assistant 시스템 프롬프트 재구조 (2026-04-22)
+
+`backend/src/modules/workflow-assistant/prompts/system-prompt.ts` 를 5블록 구조로 재편한 작업의 핵심 결정 사항과 향후 주의점을 정리한다.
+
+#### 왜 바꿨나
+
+##### 이전 구조의 문제
+
+1. **규칙 중복.** "plan-only vs execution turn" 분기가 5군데(L84/L85/L129/L138–153/L251)에 흩어져 LLM이 매 턴 파싱해야 했다. `planStepId` 태깅 규칙도 4군데, `get_node_schema` 선행 규칙도 4군데 반복.
+2. **토큰/캐시 비효율.** 매 턴 변하는 `workflow snapshot JSON`(L121)과 `activePlanSection`(L87 근처)이 프롬프트 상단에 있어 provider prefix cache가 사실상 매 턴 무효화.
+3. **시각적 우선순위 부재.** 섹션이 전부 `##` 동일 레벨, MUST/SHOULD 계층 구분 없음. 서술형 문장 안에 분기 로직이 숨어 있었음.
+4. **부정문 지배.** DO NOT / NEVER / MUST NOT 위주. 긍정형 격언이 드물었다.
+5. **예시 중복.** 6개 예시 중 3개가 사실상 같은 교훈(trigger 연결 + dynamic-ports + label/id) 반복.
+
+#### 새 구조 (5블록)
+
+1. **ROLE & TURN-OP PROTOCOL** — 역할 1문장 + 툴 호출 규약 + **turn 결정표** (Markdown table: `Turn type | Emit prose? | finish call? | Further tools | When it applies`)
+2. **CONTRACTS (MUST)** — Node output contract (CONVENTIONS 0/1.1/2/8), Label vs identifier, Entry-point connectivity, Dynamic-ports (schema-first + stable ids), Plan gating (openQuestions / planStepId / completeness)
+3. **EDIT PLAYBOOK** — Closing the turn, pendingUserConfig, Editing existing node's config, Layout guidance, Error handling, Examples (3개)
+4. **REFERENCE** — Node catalog, Expression language
+5. **DYNAMIC STATE** — Active plan context + Current workflow snapshot JSON (**반드시 프롬프트 끝에 위치**)
+
+##### 주요 효과
+
+- **Prefix cache 친화.** 정적 콘텐츠가 앞, 동적 상태가 뒤로 이동해 prefix-cache hit rate가 크게 개선될 것으로 기대.
+- **규칙 단일 소스.** "Call `finish` immediately after `propose_plan`" 문구가 **딱 한 곳(turn 결정표)** 에만 존재. 다른 섹션에서는 "the decision table above" 로만 참조.
+- **Expression reference 캐시.** `EXPRESSION_REFERENCE_CACHE` 모듈 스코프 변수로 한 번만 문자열화. 이전엔 매 턴 `getAllFunctionNames().sort().join()` 을 재실행.
+- **예시 3개로 축소** — Ex1 단순 edit / Ex2 dynamic-ports+pendingUserConfig (label/id 동시 커버) / Ex3 openQuestions 포함 복잡 요청.
+
+#### 새 구조를 고정하는 테스트
+
+`system-prompt.spec.ts` 에 `5-block structural layout (cache-friendly ordering)` describe 블록 추가. 향후 변경 시 다음이 깨지면 안 된다:
+
+- `## Expression language` 이후에 workflow snapshot JSON(`"nodes":[`) 이 위치.
+- `## Expression language` 이후에 `## Active plan context` 위치.
+- `Label vs identifier` (CONTRACTS) 는 `## Expression language` (REFERENCE) 보다 앞.
+- Turn 결정표 헤더 `| Turn ... | ... prose ... | ... finish ...` 형태가 존재하고 `plan-only` / `execution` 두 턴 종류가 본문에 등장.
+- `Call finish immediately after propose_plan` 정규식 매치가 **1회 이하** (중복 금지).
+
+#### 보존한 계약 (기존 테스트가 보장하는 것)
+
+다음은 절대 문구를 깨면 안 된다 (regex 매칭됨):
+
+- `[dynamic-ports]` 카탈로그 마커
+- P0 guard rail: `manual_trigger` entry-point / `openQuestions` finish 금지 / `get_node_schema` MANDATORY
+- Label vs identifier 예시: `btn_approve`, `승인`, `interaction.data.buttonId`, `interaction.data.email`, `data["승인"]` 금지 사례
+- `## Closing the turn ... execution turn` 헤더 (동일 라인에 두 문구)
+- `pendingUserConfig`, 4종 selector: `integration-selector`, `llm-config-selector`, `kb-selector`, `workflow-selector`
+- `TODO|placeholder` 금지 가드
+- `## Expression language`, `validate()`, `INVALID_EXPRESSION`, `Optional chaining`, `` `??` ``, `Arrow`, `Template literal`
+- `Editing an existing node's config`, `shallow-merged`, `[REDACTED]`, `minimum patch`, "keep .* id"
+- Active plan rendering: `[x] s1 · add_node` / `[ ] s2 · add_edge` / `• [note] ...` / `awaiting approval` / XML fence `<user-request>...</user-request>`
+
+#### 이번 작업에서 발견한 pre-existing 이슈
+
+TEST WORKFLOW 중 다음 테스트가 **main 브랜치에서도 실패** 함을 확인 (git stash 로 재현):
+
+- `backend/src/modules/workflow-assistant/tools/validate-expressions.spec.ts` — "accepts optional chaining" 케이스
+- `backend/src/modules/workflow-assistant/tools/shadow-workflow.spec.ts` — "accepts add_node with optional chaining (supported syntax)"
+
+원인은 `@workflow/expression-engine` 패키지의 optional chaining 파서가 한글 키 인덱싱(`$node["1depth 음식 종류"]?.output?.interaction?.data.field`)을 거부하는 것으로 보인다. 최근 커밋 `6f6cfe1 표현식에 ? 지원` 에서 도입하려던 수정이 불완전한 듯하다.
+
+**이번 프롬프트 재구조 작업 범위 밖**이므로 별도 이슈로 처리해야 한다. 프롬프트 재구조는 이 실패들과 독립적으로 완결.
+
+#### 유지보수 시 체크
+
+- 섹션을 추가할 때 **블록 경계를 넘지 말 것.** 정적 내용은 BLOCK 1~4, 동적 내용은 BLOCK 5. 이 규율이 캐시 효과의 근간.
+- `STATIC_BLOCK_1_*`, `STATIC_BLOCK_2_*`, `STATIC_BLOCK_3_*` 모듈 스코프 상수로 빌드 타임에 1회만 문자열화됨. 동적 값이 필요하면 이 상수에 넣지 말고 `buildSystemPrompt` 본체에서 조립.
+- 새 규칙을 추가하기 전, **기존 섹션에 흡수 가능한지 먼저 검토.** 규칙을 여러 곳에 반복 넣으면 이번 리팩토링이 무효화된다.
+- Harmony control token 경고(`<|channel|>` 등) 는 OpenAI gpt-oss 계열 대비 유산. 현 provider (OpenAI/Anthropic/Google) 모두에서 발생하지 않는다는 것이 확인되면 제거 가능.
+
+_원본 메모: memory/workflow-assistant-self-review-and-error-hints.md_
+
+### Workflow Assistant — 자체 점검 + 에러 풍부화 (2026-04-23)
+
+Assistant 가 복합 워크플로우 (예: 설문조사) 를 만들 때 실패 tool call 이 연쇄적으로 발생하던 문제와, 완료 후 자체 점검이 없던 문제를 해결한다. 본 메모는 향후 유지보수 시 놓치면 안 되는 결정·제약을 정리한다.
+
+#### Part A — Tool-call 오류 감소
+
+##### 에러 풍부화 (ShadowResult 확장)
+
+`ShadowResult` 에 optional 필드 추가:
+- `knownTypes: string[]` (정렬, 최대 `KNOWN_TYPES_MAX=40`) — `UNKNOWN_NODE_TYPE`
+- `suggestedType: string` — alias 맵 hit (`NODE_TYPE_ALIASES`) 우선, 없으면 Levenshtein ≤ 3
+- `repeatCount: number` — 같은 label LABEL_CONFLICT 가 `LABEL_CONFLICT_REPEAT_THRESHOLD(=2)` 이상 반복 시
+- `hint: string` — 복구 지침 한 문장. 세 케이스에서 set 될 수 있다 (JSDoc 에 명시):
+  - UNKNOWN_NODE_TYPE (alias / Levenshtein / 후보 없음 별로 문구 다름)
+  - LABEL_CONFLICT (repeatCount ≥ 2)
+  - NODE_NOT_FOUND on add_edge (recentFailedAddNodeLabels 가 있을 때 cascading 힌트)
+
+##### alias 별칭 정책
+
+`NODE_TYPE_ALIASES` 는 `error_message | error | alert | notification | message | text → template`.
+기준: LLM 이 "UI 메세지용 전용 노드" 가 있다고 가정해 만들어내는 타입명을 `template` 으로 라우팅.
+반드시 `this.knownNodeTypes.has(aliasHit)` 를 확인한 뒤에만 suggestedType 으로 싣는다 (registry 변화 대응).
+
+##### LABEL_CONFLICT ≠ 실패한 노드 생성
+
+**규약**: `addNode()` 의 LABEL_CONFLICT 분기에서는 `recordFailedAddNode` 를 호출하지 않는다. 이유: LABEL_CONFLICT 는 "이름만 겹쳤을 뿐 타입·config 자체는 타당" 한 상태이므로, 이후 `add_edge` 가 NODE_NOT_FOUND 로 떨어졌을 때 cascading 힌트에 섞이면 "앞서 노드 생성이 실패했다" 는 잘못된 진단을 LLM 에 준다. 테스트: `shadow-workflow.spec.ts` "LABEL_CONFLICT does NOT poison the cascading NODE_NOT_FOUND hint".
+
+##### LLM 제공 문자열 embedding 규약
+
+LLM 이 자유 텍스트로 채우는 값(label, attemptedType) 을 힌트/에러 메세지에 embed 할 때는 **반드시** `sanitizeLlmProvidedString(value, maxLen)` 경유. 이 헬퍼가 제어 문자·개행 제거, 백틱·꺾쇠 중화, 길이 절단을 일관 처리한다. 이유: LLM 출력이 `\n## HACK` 같은 마크다운 헤더/인젝션을 품은 채 힌트로 재주입되면 다음 라운드 프롬프트에서 지시문으로 오해될 수 있다.
+
+길이 상수:
+- `ATTEMPTED_TYPE_MAX_LEN = 64` — node type 후보 embed
+- `LABEL_HINT_MAX_LEN = 80` — NODE_NOT_FOUND 힌트 label 목록
+
+##### schemaCache 정책
+
+`workflow-assistant-stream.service.ts` 의 턴 스코프 `schemaCache: Map<string, { result, hits }>`.
+
+카운트 규칙: **hits 값은 호출 순번 그 자체**. 첫 호출 후 1, 두 번째 2, 세 번째 3...
+- hits=1 (첫 호출): 정상 실행, cache set
+- hits=2 (두 번째): cached + `warning: 'REDUNDANT_SCHEMA_LOOKUP'` + `cached: true`
+- hits ≥ 3 (`SCHEMA_LOOKUP_HARD_STOP`): `ok: false, error: 'REDUNDANT_SCHEMA_LOOKUP'` (hard stop)
+
+이 상수를 변경할 때는 서비스 L137–142 주석 + L459–462 inline 주석 + 테스트 3회차 기대값을 모두 동시에 고친다.
+
+#### Part B — 2-stage finish (self-review)
+
+##### 흐름
+
+LLM 이 `finish` 를 호출하면 서버는 아래 순서로 판정:
+
+1. `evaluateFinishGuard` → `PLAN_NOT_COMPLETE` 면 block (기존 동작, 변경 없음).
+2. 통과하면 `evaluateReviewGuard` → `WORKFLOW_REVIEW_REQUIRED` 면 block.
+3. 둘 다 통과하면 `{ ok: true }` 로 finish 성공.
+
+Review 는 **한 턴에 한 번만** 발동 (`state.reviewCompleted`, `state.reviewRoundCount < 2`). 두 번째 `finish` 는 review 를 건너뛰고 통과해, LLM 이 사용자에게 다음 턴에서 후속 지시를 받을 기회를 보장.
+
+##### review skip 조건 (`shouldSkipReview`)
+
+다음 중 하나라도 참이면 review 는 발동하지 않는다. **시스템 프롬프트의 Self-review 섹션 설명과 반드시 동기화 유지** (프롬프트·구현 drift 가 곧 LLM 혼란으로 이어짐):
+
+- `state.reviewCompleted`
+- `state.reviewRoundCount >= 2`
+- `state.finishBlockCount > 0` — PLAN_NOT_COMPLETE 가 이미 발동했다면 LLM 은 한 라운드 feedback 을 받았으므로 review 는 중복
+- `state.planClearedThisTurn`
+- 이번 턴 성공 edit 이 0 — 실행 턴 아님
+- non-trigger 노드 ≤ 1 — trivial 편집 (plan 유무 무관)
+
+##### 체크리스트 항목 (`review-workflow.ts`)
+
+Blocking:
+- **UNRESOLVED_FAILED_CALLS** — `kind === 'edit'` 실패 중 같은 label(add_node) / id(update/remove) / source+target+port 튜플(add_edge, camelCase 도 포함) 로 성공 흔적이 없는 것. **`finish` / `explore` 계열은 제외** (review-guard feedback 이나 `REDUNDANT_SCHEMA_LOOKUP` 은 실패 의미가 아님).
+- **`PORT_NOT_FOUND` (2026-04-23 추가, add_edge 단계에서 즉시 반환)** — UNRESOLVED_FAILED_CALLS 과는 다른 class. `ShadowWorkflow.addEdge` 가 `portResolver` (stream.service 에서 `resolveEffectiveOutputPorts` 기반 주입) 로 source/target 포트 존재성을 검사, 없는 포트면 즉시 `PORT_NOT_FOUND` + `portInfo.knownPorts` 로 reject. 사용자가 config update 실패로 생성되지 못한 동적 포트 (carousel 버튼 / switch case 등) 에 edge 를 붙이려는 실수를 첫 시도에서 catch. 컨테이너 loopback `emit` 포트는 여전히 허용 (spec §4.4).
+- **ORPHAN_NODES** — trigger category 에서 BFS 도달 불가 + container emit loopback 조상도 미reachable. `byId` Map 은 `collectOrphans` 에서 1회 생성 후 인자로 주입 (O(N²) → O(N+E)).
+- **DANGLING_OUTPUT_PORTS** (2026-04-23 추가) — `resolveEffectiveOutputPorts` 가 돌려주는 `isUserConfigured=true` 포트 중 outgoing edge 없는 것. "ORPHAN_NODES 는 입력 방향 reachability, 이 검사는 출력 방향 connectivity" 의 대칭 쌍. weak 포트 (`error`/`default`/`fallback`/`continue`/단일 static `out`) 는 제외 — terminal 노드는 정상 케이스. `nodeDefs` 가 `BuildReviewChecklistInput` 으로 주입되어야 작동; 빈 배열이면 no-op. 상한 `MAX_DANGLING_PORTS=20`.
+- **FAKE_STEP_COMPLETION** — `planStepId` 또는 `planStepIds` 가 붙은 호출들이 step 에 연결되어 있으나 모두 `ok: false`.
+- **PENDING_USER_CONFIG_UNMENTIONED** — pendingUserConfig 있는 노드의 label 이 assistantText 에 포함되지 않음.
+
+Non-blocking:
+- **REQUEST_COVERAGE_LOW** — originalRequest 의미 토큰과 노드 label 겹침 비율 < 30%. 경고만.
+
+##### Port 해석 (resolve-dynamic-ports.ts)
+
+`frontend/src/lib/node-definitions/resolve-dynamic-ports.ts` 의 로직을 backend 로 포팅한 `tools/resolve-dynamic-ports.ts` 가 SSOT. 6 종 `DynamicPortsSpec` (switch-cases, classifier-categories, ai-agent-conditional, info-extractor-mode, presentation-buttons, parallel-branches) 를 전부 지원. 반환 구조에 `isUserConfigured: boolean` 추가 — strong (user-authored) vs weak (framework-synthesized) 구분이 DANGLING_OUTPUT_PORTS 의 핵심 필터. Frontend 사본과 드리프트하지 않도록 `resolve-dynamic-ports.spec.ts` 에 kind 별 시나리오 미러 (16 테스트).
+
+##### 프롬프트 인젝션 방어
+
+`WORKFLOW_REVIEW_REQUIRED` payload 의 `originalRequest` 필드는 `truncateReviewOriginalRequest()` 로 `REVIEW_ORIGINAL_REQUEST_MAX_LEN=200` 자로 잘라 싣는다. 전체 원문은 system prompt 의 Active plan context 에 XML fence 로 이미 중화되어 주입되므로 review 쪽에는 요약만.
+
+##### 프론트엔드 영향
+
+`tool-call-badge.tsx` 는 `kind === 'edit' | 'explore'` 만 SSE 로 구독하므로 `finish` tool_result (`ok: false, error: 'WORKFLOW_REVIEW_REQUIRED'`) 는 UI 빨간 배지로 누출되지 않는다. 사용자는 review 라운드 중 LLM 이 추가로 부른 `get_current_workflow` / 수정 edit 배지 + Korean "검토 완료" 문장만 본다.
+
+#### 유지보수 체크리스트
+
+- `SCHEMA_LOOKUP_HARD_STOP` 변경 시: 상수 정의부 + 인라인 주석 + 테스트 기대값 3곳 동시 수정.
+- `ShadowResult` 필드 추가/제거 시: JSDoc 블록 + 테스트 fixture + 후속 `detectPendingUserConfig` / `toChatMessages` rehydration 경로 확인.
+- Review skip 조건 변경 시: `prompts/system-prompt.ts` Self-review 섹션 문구 동기화 (테스트 `system-prompt.spec.ts` "teaches the 2-stage finish self-review routine..." 가 고정).
+- `NODE_TYPE_ALIASES` 변경 시: alias 가 registry 에 존재하지 않으면 Levenshtein fallthrough 로 빠지는지 회귀 확인 (`shadow-workflow.spec.ts` "falls through to Levenshtein when alias exists but not in knownTypes").
+- `resolveEffectiveOutputPorts` 변경 시: **frontend `resolveDynamicPorts` 와 동일 동작** 을 유지하는지 확인. 두 파일이 각자의 spec 을 가지므로 어느 한쪽만 업데이트하면 review false positive/negative 가 생긴다. 새로운 `DynamicPortsSpec.kind` 추가 시 양쪽에 동시에 branch 추가.
+- DANGLING_OUTPUT_PORTS 의 weak/strong 경계 변경 시: `resolve-dynamic-ports.spec.ts` 의 `isUserConfigured` 단언 + `review-workflow.spec.ts` "does NOT flag weak ports" 케이스 모두 업데이트.
+
+#### Follow-up (스코프 밖, 별도 이슈)
+
+- `ShadowResult` discriminated union 전환
+- `ShadowWorkflow` SRP 분리 (`ShadowWorkflowErrorAdvisor`)
+- `schemaCache` 응답 명시 구조 래핑 (`{ ok, data, cached, warning }`)
+- CHANGELOG 정책 수립 후 본 변경 소급 반영
+
+_원본 메모: memory/workflow-assistant-provider-

... (truncated due to prompt size limit) ...

---

### 파일 11: review/consistency/2026/05/16/09_03_04/_retry_state.json
- 변경 유형: Review
- 언어: json

#### 변경된 코드
```
commit 6ceebadd3c31fff8894670fb1c4eab4d5389ac65
Author: worker-ants <admin@getit.co.kr>
Date:   Sat May 16 09:16:59 2026 +0900

    fix(node-configs/cafe24): keep newly added fields rows visible
    
    The Cafe24 node settings panel's `Fields` editor lost newly added rows
    the moment they were created. KeyValueEditor's "Add" button appended a
    blank `{key: "", value: ""}` row, but the onChange handler converted
    the list straight to `Record<string, unknown>` and dropped the
    empty-key entry — so the next render derived its list from the
    unchanged object and the new row was gone. The "추가" button appeared
    broken.
    
    Cafe24Config now maintains the editing rows in local React state
    initialized from `config.fields`. Mutations update the state and
    propagate the (still object-shaped) result upstream, preserving the
    backend contract. External resets (undo/redo, programmatic) trigger a
    derived-state re-sync during render.
    
    Added unit tests cover: clicking Add reveals a new row, typed keys
    persist into `config.fields`, multiple Add clicks accumulate rows
    independent of the object-form filter, removing rows mutates state
    correctly, and the empty-row visibility survives object conversion.
    
    consistency-check session: review/consistency/2026/05/16/09_03_04
    (BLOCK: NO — 5 checkers all NONE, 7 INFO suggestions).
    
    [skip-e2e] — single-component UI fix; backend / spec / data model
    unchanged.
    
    Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

diff --git a/review/consistency/2026/05/16/09_03_04/_retry_state.json b/review/consistency/2026/05/16/09_03_04/_retry_state.json
new file mode 100644
index 00000000..4b7004d1
--- /dev/null
+++ b/review/consistency/2026/05/16/09_03_04/_retry_state.json
@@ -0,0 +1,58 @@
+{
+  "session_dir": "/Volumes/project/private/clemvion/.claude/worktrees/cafe24-fields-add-btn-d3f8a2/review/consistency/2026/05/16/09_03_04",
+  "summary_subagent_type": "consistency-summary",
+  "summary_output_file": "/Volumes/project/private/clemvion/.claude/worktrees/cafe24-fields-add-btn-d3f8a2/review/consistency/2026/05/16/09_03_04/SUMMARY.md",
+  "subagent_invocations": [
+    {
+      "name": "cross_spec",
+      "subagent_type": "cross-spec-checker",
+      "prompt_file": "/Volumes/project/private/clemvion/.claude/worktrees/cafe24-fields-add-btn-d3f8a2/review/consistency/2026/05/16/09_03_04/_prompts/cross_spec.md",
+      "output_file": "/Volumes/project/private/clemvion/.claude/worktrees/cafe24-fields-add-btn-d3f8a2/review/consistency/2026/05/16/09_03_04/cross_spec/review.md"
+    },
+    {
+      "name": "rationale_continuity",
+      "subagent_type": "rationale-continuity-checker",
+      "prompt_file": "/Volumes/project/private/clemvion/.claude/worktrees/cafe24-fields-add-btn-d3f8a2/review/consistency/2026/05/16/09_03_04/_prompts/rationale_continuity.md",
+      "output_file": "/Volumes/project/private/clemvion/.claude/worktrees/cafe24-fields-add-btn-d3f8a2/review/consistency/2026/05/16/09_03_04/rationale_continuity/review.md"
+    },
+    {
+      "name": "convention_compliance",
+      "subagent_type": "convention-compliance-checker",
+      "prompt_file": "/Volumes/project/private/clemvion/.claude/worktrees/cafe24-fields-add-btn-d3f8a2/review/consistency/2026/05/16/09_03_04/_prompts/convention_compliance.md",
+      "output_file": "/Volumes/project/private/clemvion/.claude/worktrees/cafe24-fields-add-btn-d3f8a2/review/consistency/2026/05/16/09_03_04/convention_compliance/review.md"
+    },
+    {
+      "name": "plan_coherence",
+      "subagent_type": "plan-coherence-checker",
+      "prompt_file": "/Volumes/project/private/clemvion/.claude/worktrees/cafe24-fields-add-btn-d3f8a2/review/consistency/2026/05/16/09_03_04/_prompts/plan_coherence.md",
+      "output_file": "/Volumes/project/private/clemvion/.claude/worktrees/cafe24-fields-add-btn-d3f8a2/review/consistency/2026/05/16/09_03_04/plan_coherence/review.md"
+    },
+    {
+      "name": "naming_collision",
+      "subagent_type": "naming-collision-checker",
+      "prompt_file": "/Volumes/project/private/clemvion/.claude/worktrees/cafe24-fields-add-btn-d3f8a2/review/consistency/2026/05/16/09_03_04/_prompts/naming_collision.md",
+      "output_file": "/Volumes/project/private/clemvion/.claude/worktrees/cafe24-fields-add-btn-d3f8a2/review/consistency/2026/05/16/09_03_04/naming_collision/review.md"
+    }
+  ],
+  "agents_pending": [],
+  "agents_success": [
+    "cross_spec",
+    "rationale_continuity",
+    "convention_compliance",
+    "plan_coherence",
+    "naming_collision"
+  ],
+  "agents_fatal": [],
+  "agent_history": {
+    "cross_spec": [{"status": "success", "issues": 1}],
+    "rationale_continuity": [{"status": "success", "issues": 1}],
+    "convention_compliance": [{"status": "success", "issues": 2}],
+    "plan_coherence": [{"status": "success", "issues": 1}],
+    "naming_collision": [{"status": "success", "issues": 2}]
+  },
+  "rate_limit_episodes": 0,
+  "total_wait_sec": 0,
+  "wake_history": [],
+  "last_reset_hint_sec": null,
+  "loop_mode": false
+}

```

---

### 파일 12: review/consistency/2026/05/16/09_03_04/convention_compliance/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
commit 6ceebadd3c31fff8894670fb1c4eab4d5389ac65
Author: worker-ants <admin@getit.co.kr>
Date:   Sat May 16 09:16:59 2026 +0900

    fix(node-configs/cafe24): keep newly added fields rows visible
    
    The Cafe24 node settings panel's `Fields` editor lost newly added rows
    the moment they were created. KeyValueEditor's "Add" button appended a
    blank `{key: "", value: ""}` row, but the onChange handler converted
    the list straight to `Record<string, unknown>` and dropped the
    empty-key entry — so the next render derived its list from the
    unchanged object and the new row was gone. The "추가" button appeared
    broken.
    
    Cafe24Config now maintains the editing rows in local React state
    initialized from `config.fields`. Mutations update the state and
    propagate the (still object-shaped) result upstream, preserving the
    backend contract. External resets (undo/redo, programmatic) trigger a
    derived-state re-sync during render.
    
    Added unit tests cover: clicking Add reveals a new row, typed keys
    persist into `config.fields`, multiple Add clicks accumulate rows
    independent of the object-form filter, removing rows mutates state
    correctly, and the empty-row visibility survives object conversion.
    
    consistency-check session: review/consistency/2026/05/16/09_03_04
    (BLOCK: NO — 5 checkers all NONE, 7 INFO suggestions).
    
    [skip-e2e] — single-component UI fix; backend / spec / data model
    unchanged.
    
    Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

diff --git a/review/consistency/2026/05/16/09_03_04/convention_compliance/review.md b/review/consistency/2026/05/16/09_03_04/convention_compliance/review.md
new file mode 100644
index 00000000..96dc21d3
--- /dev/null
+++ b/review/consistency/2026/05/16/09_03_04/convention_compliance/review.md
@@ -0,0 +1,60 @@
+# Convention Compliance Review
+
+**대상 문서**: `spec/4-nodes/4-integration/4-cafe24.md`
+**검토 모드**: 구현 착수 전 (--impl-prep)
+**작업 범위**: `Cafe24Config` UI 버그 수정 (fields "추가" 버튼 동작 안 함)
+
+---
+
+## 발견사항
+
+### 1. [INFO] §9.4 Rationale 의 9.7·9.8 절 순서 역전
+
+- target 위치: 문서 §9 Rationale 의 절 순서 (라인 404~451)
+- 위반 규약: CLAUDE.md 문서 구조 권장 — 본문 끝의 `## Rationale` 순서 정합성
+- 상세: `9.7 OAuth scope wire format` 절(라인 441~451)이 `9.8 Private 앱 App URL HMAC 검증` 절(라인 406~438) 뒤에 텍스트상 위치하지만 번호는 9.7 < 9.8 이다. 실제 파일에서는 9.8 절 내용 본문(라인 406~438) 이 먼저 나오고, 그 뒤에 9.7 절 텍스트(라인 441~451) 가 이어진다. 즉, 절 번호와 파일 내 순서가 불일치한다.
+- 제안: 9.7 과 9.8 절을 파일 내 순서와 번호가 일치하도록 재배열하거나, CHANGELOG(§10) 직전 순서로 정리한다.
+
+### 2. [INFO] Principle 11 Case 번호 불연속 (5.1 / 5.3 / 5.8)
+
+- target 위치: §5 출력 구조 (Case 번호: 5.1, 5.3, 5.8)
+- 위반 규약: `spec/conventions/node-output.md` Principle 11 — "Case별로 분리 (성공 / 에러 / 재개 등)"
+- 상세: Principle 11 의 포맷 규칙은 `### Case: <케이스 이름>` 형식을 요구한다. 본 문서는 Case 를 `5.1`, `5.3`, `5.8` 로 번호 붙여 관리하는데, 5.2 / 5.4~5.7 이 없어 독자가 누락을 의심하게 만든다. 실제 누락은 아니고 의도적 skip 이지만 규약이 권장하는 연속 Case 서술 패턴과 거리감이 있다.
+- 제안: 연속 번호를 쓰거나 (`5.1`, `5.2`, `5.3`), 또는 번호 없이 `### Case: 2xx 성공`, `### Case: API 에러 또는 Transport 실패`, `### Case: Pre-flight throw` 형식으로 서술한다.
+
+---
+
+## 이번 작업과의 직접 관련성 검토
+
+이번 구현 작업(Cafe24Config fields "추가" 버튼 버그 수정)은 다음 범위에만 영향을 미친다:
+
+- `frontend/src/components/editor/settings-panel/node-configs/integration-configs.tsx` — `Cafe24Config` 컴포넌트에 React state 추가
+- 신규 unit test 1건
+
+아래 항목들이 **변경 없음**을 확인하였다:
+
+| 항목 | 확인 결과 |
+|------|-----------|
+| `spec/4-nodes/4-integration/4-cafe24.md` §1 `config.fields` 타입 (`Record<string,unknown>`) | 보존 — 백엔드 계약 변경 없음 |
+| `spec/conventions/cafe24-api-metadata.md` §2 `fields` 형식 | 보존 — 메타데이터 테이블 변경 없음 |
+| `spec/conventions/node-output.md` Principle 0~11 출력 포맷 | 보존 — 출력 구조 변경 없음 |
+| 옛 `prd/` / `memory/` 경로 답습 여부 | 없음 |
+
+---
+
+## Target 문서 전체 규약 준수 요약
+
+`spec/4-nodes/4-integration/4-cafe24.md` 는 정식 규약과 전반적으로 잘 정합한다:
+
+- **명명 규약**: 파일명 `4-cafe24.md` — 숫자 prefix + 평문명 패턴 준수. Integration 영역의 `0-common.md` 참조 구조도 정상.
+- **문서 구조**: Overview(§ 없는 서두) / 본문(§1~§8) / Rationale(§9) / CHANGELOG(§10) 의 3섹션 + CHANGELOG 구성으로 CLAUDE.md 권장 구조 준수.
+- **출력 포맷 규약**: Principle 0(5필드), Principle 3.2(`output.error` envelope), Principle 7(`config` echo), Principle 8.2(`output.response` HTTP 관용 네이밍), Principle 11(JSON 예시 + 표) 모두 명시적으로 준수하고 있음.
+- **API 문서 규약**: Swagger/DTO 패턴 직접 정의 없으나 Source of Truth 를 `backend/src/nodes/integration/cafe24/cafe24.schema.ts` 로 명시해 DTO 명명 책임을 코드로 위임함.
+- **금지 항목**: 옛 `prd/`, `memory/`, `user_memo/` 경로 참조 없음. `spec/conventions/` 의 카페24 메타데이터 컨벤션을 올바르게 참조.
+- **이번 작업 직접 영향**: 발견된 2건은 모두 INFO 등급으로, 이번 구현 작업(프론트엔드 UI 버그 수정)의 착수를 차단할 규약 위반 없음.
+
+---
+
+## 위험도
+
+NONE

```

---

### 파일 13: review/consistency/2026/05/16/09_03_04/cross_spec/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
commit 6ceebadd3c31fff8894670fb1c4eab4d5389ac65
Author: worker-ants <admin@getit.co.kr>
Date:   Sat May 16 09:16:59 2026 +0900

    fix(node-configs/cafe24): keep newly added fields rows visible
    
    The Cafe24 node settings panel's `Fields` editor lost newly added rows
    the moment they were created. KeyValueEditor's "Add" button appended a
    blank `{key: "", value: ""}` row, but the onChange handler converted
    the list straight to `Record<string, unknown>` and dropped the
    empty-key entry — so the next render derived its list from the
    unchanged object and the new row was gone. The "추가" button appeared
    broken.
    
    Cafe24Config now maintains the editing rows in local React state
    initialized from `config.fields`. Mutations update the state and
    propagate the (still object-shaped) result upstream, preserving the
    backend contract. External resets (undo/redo, programmatic) trigger a
    derived-state re-sync during render.
    
    Added unit tests cover: clicking Add reveals a new row, typed keys
    persist into `config.fields`, multiple Add clicks accumulate rows
    independent of the object-form filter, removing rows mutates state
    correctly, and the empty-row visibility survives object conversion.
    
    consistency-check session: review/consistency/2026/05/16/09_03_04
    (BLOCK: NO — 5 checkers all NONE, 7 INFO suggestions).
    
    [skip-e2e] — single-component UI fix; backend / spec / data model
    unchanged.
    
    Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

diff --git a/review/consistency/2026/05/16/09_03_04/cross_spec/review.md b/review/consistency/2026/05/16/09_03_04/cross_spec/review.md
new file mode 100644
index 00000000..bb30010e
--- /dev/null
+++ b/review/consistency/2026/05/16/09_03_04/cross_spec/review.md
@@ -0,0 +1,41 @@
+# Cross-Spec 일관성 검토 결과
+
+검토 대상: `spec/4-nodes/4-integration/4-cafe24.md` (구현 착수 전 --impl-prep)
+작업 요약: `Cafe24Config` fields "추가" 버튼 버그 수정 — frontend React state 분리, 백엔드 계약 무변경
+
+---
+
+### 발견사항
+
+특이사항 없음 — 아래 6개 점검 관점 전항 이상 없음.
+
+- **[INFO]** `config.fields` 의 UI 내부 표현과 백엔드 계약 형태의 분리 패턴 — 명시적 문서화 권장
+  - target 위치: `Cafe24Config.onChange` 콜백 (현재 `integration-configs.tsx` lines ~332-342)
+  - 충돌 대상: `spec/4-nodes/4-integration/4-cafe24.md §1` (`fields: Record<string, unknown>`) · `spec/conventions/cafe24-api-metadata.md §2`
+  - 상세: 수정 방향은 `Cafe24Config` 내부에 `Array<{key,value}>` 형태의 React state 를 도입하여 빈 key 행을 UI 에 유지하고, key 가 채워질 때만 `Record<string,unknown>` 으로 변환해 `config.fields` 에 flush 한다. 이는 spec 이 규정한 백엔드 계약(`fields: Record<string,unknown>`) 을 그대로 준수하는 구현 선택이다. 다만 현재 spec §2 설정 UI 설명에는 이 "UI 내부 목록 표현 ↔ 백엔드 object 형태 간 변환" 패턴이 명시되지 않아, 향후 동일 컴포넌트를 유지보수하는 개발자가 UI 형태와 저장 형태의 차이를 spec 에서 확인할 수 없다.
+  - 제안: 구현 완료 후 `spec/4-nodes/4-integration/4-cafe24.md §2` 에 한 줄 주석("fields 편집 UI 는 내부적으로 key-value 배열을 관리하며, `onChange` 시 빈 key 항목을 제거한 뒤 `Record<string,unknown>` 으로 변환해 저장한다") 추가를 권장. 구현 차단 대상이 아님.
+
+---
+
+### 점검 관점별 결과
+
+| 관점 | 결과 | 비고 |
+|------|------|------|
+| 1. 데이터 모델 충돌 | 이상 없음 | `config.fields: Record<string,unknown>` shape 변경 없음. `spec/1-data-model.md §2.6 Node.config: JSONB` 와 일치 유지 |
+| 2. API 계약 충돌 | 이상 없음 | 백엔드 schema(`cafe24.schema.ts`) 가 `fields` 를 `Record<string,unknown>` 으로 수신하는 계약 유지. 프론트엔드 내부 상태 분리는 API 경계에 영향 없음 |
+| 3. 요구사항 ID 충돌 | 해당 없음 | 본 작업은 요구사항 ID 를 신규 정의·변경하지 않음 |
+| 4. 상태 전이 충돌 | 해당 없음 | 노드 실행 흐름·Integration 상태 머신 변경 없음 |
+| 5. 권한·RBAC 모델 충돌 | 해당 없음 | 권한 구조 변경 없음 |
+| 6. 계층 책임 충돌 | 이상 없음 | 변경이 frontend 설정 패널 내부(React state)에 국한. 백엔드 executor 계약(`spec/4-nodes/4-integration/4-cafe24.md §4` · `spec/4-nodes/4-integration/0-common.md §4`) 은 `config.fields` 의 object shape 을 그대로 받으며, 이 계약은 변경되지 않음. frontend/backend 경계 준수 |
+
+---
+
+### 요약
+
+본 작업은 `Cafe24Config` 컴포넌트 내부에서 `KeyValueEditor` 가 추가한 빈 key 행이 `onChange` 의 object 변환 시 즉시 소실되는 버그를 로컬 React state 도입으로 수정한다. 변경은 frontend 렌더 로직에만 한정되며, `config.fields` 의 백엔드 계약(`Record<string,unknown>`)·데이터 모델(`Node.config: JSONB`)·API 계약·Integration 상태 전이·RBAC 모델 중 어느 것도 변경하지 않는다. spec 과의 직접 모순은 발견되지 않았고, `spec/4-nodes/4-integration/4-cafe24.md §2` 에 UI 내부 표현 변환 패턴을 한 줄 보완하면 미래 유지보수 명료성이 높아지나 구현을 차단할 이유는 없다.
+
+---
+
+### 위험도
+
+NONE

```

---

### 파일 14: review/consistency/2026/05/16/09_03_04/meta.json
- 변경 유형: Review
- 언어: json

#### 변경된 코드
```
commit 6ceebadd3c31fff8894670fb1c4eab4d5389ac65
Author: worker-ants <admin@getit.co.kr>
Date:   Sat May 16 09:16:59 2026 +0900

    fix(node-configs/cafe24): keep newly added fields rows visible
    
    The Cafe24 node settings panel's `Fields` editor lost newly added rows
    the moment they were created. KeyValueEditor's "Add" button appended a
    blank `{key: "", value: ""}` row, but the onChange handler converted
    the list straight to `Record<string, unknown>` and dropped the
    empty-key entry — so the next render derived its list from the
    unchanged object and the new row was gone. The "추가" button appeared
    broken.
    
    Cafe24Config now maintains the editing rows in local React state
    initialized from `config.fields`. Mutations update the state and
    propagate the (still object-shaped) result upstream, preserving the
    backend contract. External resets (undo/redo, programmatic) trigger a
    derived-state re-sync during render.
    
    Added unit tests cover: clicking Add reveals a new row, typed keys
    persist into `config.fields`, multiple Add clicks accumulate rows
    independent of the object-form filter, removing rows mutates state
    correctly, and the empty-row visibility survives object conversion.
    
    consistency-check session: review/consistency/2026/05/16/09_03_04
    (BLOCK: NO — 5 checkers all NONE, 7 INFO suggestions).
    
    [skip-e2e] — single-component UI fix; backend / spec / data model
    unchanged.
    
    Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

diff --git a/review/consistency/2026/05/16/09_03_04/meta.json b/review/consistency/2026/05/16/09_03_04/meta.json
new file mode 100644
index 00000000..83fad5cf
--- /dev/null
+++ b/review/consistency/2026/05/16/09_03_04/meta.json
@@ -0,0 +1,12 @@
+{
+  "timestamp": "2026-05-16T09:03:04.490363",
+  "mode": "구현 착수 전 검토 (--impl-prep, scope=spec/4-nodes/4-integration/4-cafe24.md\n\n작업 요약: cafe24 노드 설정 UI(`frontend/src/components/editor/settings-panel/node-configs/integration-configs.tsx` 의 `Cafe24Config`) 에서 fields 항목의 \"추가\" 버튼이 동작하지 않는 버그 수정.\n\n원인: `KeyValueEditor` 가 빈 행 `{key:\"\", value:\"\"}` 추가 → `onChange` 콜백이 빈 key 를 가진 행을 object 변환 시 즉시 제거 → 다음 렌더에서 새 행이 사라짐.\n\n수정 방향: `Cafe24Config` 내부에 keyvalue 편집용 React state 를 도입해 빈 key 행이 UI 에 유지되도록 함. 사용자가 key 를 입력하면 그 시점에 object 형태(`Record<string,unknown>`) 로 `config.fields` 에 반영. 백엔드 계약(spec/4-nodes/4-integration/4-cafe24.md §1, conventions/cafe24-api-metadata.md) 의 object shape 은 그대로 보존.\n\n영향 영역: frontend/src/components/editor/settings-panel/node-configs/integration-configs.tsx + 신규 unit test 1건. 백엔드/스펙/데이터모델 변경 없음.)",
+  "target_path": "spec/4-nodes/4-integration/4-cafe24.md\n\n작업 요약: cafe24 노드 설정 UI(`frontend/src/components/editor/settings-panel/node-configs/integration-configs.tsx` 의 `Cafe24Config`) 에서 fields 항목의 \"추가\" 버튼이 동작하지 않는 버그 수정.\n\n원인: `KeyValueEditor` 가 빈 행 `{key:\"\", value:\"\"}` 추가 → `onChange` 콜백이 빈 key 를 가진 행을 object 변환 시 즉시 제거 → 다음 렌더에서 새 행이 사라짐.\n\n수정 방향: `Cafe24Config` 내부에 keyvalue 편집용 React state 를 도입해 빈 key 행이 UI 에 유지되도록 함. 사용자가 key 를 입력하면 그 시점에 object 형태(`Record<string,unknown>`) 로 `config.fields` 에 반영. 백엔드 계약(spec/4-nodes/4-integration/4-cafe24.md §1, conventions/cafe24-api-metadata.md) 의 object shape 은 그대로 보존.\n\n영향 영역: frontend/src/components/editor/settings-panel/node-configs/integration-configs.tsx + 신규 unit test 1건. 백엔드/스펙/데이터모델 변경 없음.",
+  "checkers": [
+    "cross_spec",
+    "rationale_continuity",
+    "convention_compliance",
+    "plan_coherence",
+    "naming_collision"
+  ]
+}
\ No newline at end of file

```

---

### 파일 15: review/consistency/2026/05/16/09_03_04/naming_collision/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
commit 6ceebadd3c31fff8894670fb1c4eab4d5389ac65
Author: worker-ants <admin@getit.co.kr>
Date:   Sat May 16 09:16:59 2026 +0900

    fix(node-configs/cafe24): keep newly added fields rows visible
    
    The Cafe24 node settings panel's `Fields` editor lost newly added rows
    the moment they were created. KeyValueEditor's "Add" button appended a
    blank `{key: "", value: ""}` row, but the onChange handler converted
    the list straight to `Record<string, unknown>` and dropped the
    empty-key entry — so the next render derived its list from the
    unchanged object and the new row was gone. The "추가" button appeared
    broken.
    
    Cafe24Config now maintains the editing rows in local React state
    initialized from `config.fields`. Mutations update the state and
    propagate the (still object-shaped) result upstream, preserving the
    backend contract. External resets (undo/redo, programmatic) trigger a
    derived-state re-sync during render.
    
    Added unit tests cover: clicking Add reveals a new row, typed keys
    persist into `config.fields`, multiple Add clicks accumulate rows
    independent of the object-form filter, removing rows mutates state
    correctly, and the empty-row visibility survives object conversion.
    
    consistency-check session: review/consistency/2026/05/16/09_03_04
    (BLOCK: NO — 5 checkers all NONE, 7 INFO suggestions).
    
    [skip-e2e] — single-component UI fix; backend / spec / data model
    unchanged.
    
    Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

diff --git a/review/consistency/2026/05/16/09_03_04/naming_collision/review.md b/review/consistency/2026/05/16/09_03_04/naming_collision/review.md
new file mode 100644
index 00000000..39eaa420
--- /dev/null
+++ b/review/consistency/2026/05/16/09_03_04/naming_collision/review.md
@@ -0,0 +1,34 @@
+# 신규 식별자 충돌 검토 결과
+
+검토 대상: `spec/4-nodes/4-integration/4-cafe24.md` (구현 착수 전 --impl-prep)
+작업: `Cafe24Config` fields "추가" 버튼 버그 수정 — `KeyValueEditor` 빈 key 행 유지를 위한 내부 React state 도입
+
+---
+
+## 발견사항
+
+### [INFO] `fields` 지역 변수와 신규 draft state 명칭 주의
+
+- **target 신규 식별자**: 구현 시 `Cafe24Config` 내부에 도입될 keyvalue draft용 React state 변수 (구체적 이름은 아직 미정 — 예: `localRows`, `kvRows`, `draftRows` 등)
+- **기존 사용처**: `integration-configs.tsx:297` — `const fields = normalizeCafe24Fields(config.fields)` 로 이미 `fields` 라는 지역 변수가 선언됨. `config.fields` 는 백엔드 계약 키명(`Record<string,unknown>`)으로 spec과 DB schema에서 고정.
+- **상세**: 신규 React state를 `fields` 또는 `setFields` 로 명명하면 기존 지역 변수 `const fields`와 동일 스코프에서 선언 충돌이 발생한다. TypeScript/ESLint 는 same-scope 재선언을 컴파일 에러로 거부하므로 실수로 같은 이름을 쓰면 즉시 빌드 실패가 난다. 다만 스펙 레벨의 식별자 충돌은 아니며 런타임 혼선 위험도 없다.
+- **제안**: draft state는 `localRows` 또는 `fieldRows`처럼 기존 `fields` 변수와 명확히 구분되는 이름을 채택한다. `useState<{ key: string; value: string }[]>` 형태로 초기화하고, `useEffect` 또는 controlled pattern으로 `config.fields` 와 동기화. 기존 `const fields` 선언은 draft state로 교체하거나 제거해 스코프 내 의미 중복을 없앤다.
+
+---
+
+### [INFO] `normalizeCafe24Fields` 함수 — 신규 state 도입 후 역할 재검토
+
+- **target 신규 식별자**: 신규 React state 도입 시 `normalizeCafe24Fields` 의 호출 위치·시점이 변경됨
+- **기존 사용처**: `integration-configs.tsx:270-293` — `normalizeCafe24Fields(config.fields)` 를 매 렌더마다 호출하여 `fields` 배열을 파생함
+- **상세**: draft state 패턴을 도입하면 `normalizeCafe24Fields` 는 초기화(mount 시) 또는 외부 props 변경 시에만 호출하게 된다. 함수 이름 자체의 충돌은 없으나, 동일 이름 함수가 다른 역할(전체 렌더 파생 vs 초기화 전용)로 쓰이면 읽는 사람에게 혼동을 줄 수 있다.
+- **제안**: 함수 이름은 그대로 유지하되, 사용 시점을 `useState` 초기값(`useState(() => normalizeCafe24Fields(config.fields))`) 또는 `useEffect` 내에서 명시적으로 제한해 역할을 명확히 한다.
+
+---
+
+## 종합 평가
+
+이번 구현은 프론트엔드 컴포넌트 내부의 React state 패턴 변경으로, 스펙 레벨 식별자(요구사항 ID, 엔티티/타입명, API endpoint, 이벤트명, 환경변수, 파일 경로)의 신규 도입이 전혀 없다. 백엔드 계약(`config.fields: Record<string,unknown>`)과 spec(`spec/4-nodes/4-integration/4-cafe24.md`, `spec/conventions/cafe24-api-metadata.md`)은 그대로 보존된다. 유일한 주의 사항은 `Cafe24Config` 내부 스코프에서 기존 `const fields` 지역 변수와 신규 draft state 이름이 충돌하지 않도록 하는 것으로, 이는 TypeScript 컴파일러가 즉시 잡아주므로 실질 리스크는 낮다. 명확한 이름(예: `localRows`)을 처음부터 선택하면 혼동 없이 구현 가능하다.
+
+## 위험도
+
+NONE

```

---

### 파일 16: review/consistency/2026/05/16/09_03_04/plan_coherence/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
commit 6ceebadd3c31fff8894670fb1c4eab4d5389ac65
Author: worker-ants <admin@getit.co.kr>
Date:   Sat May 16 09:16:59 2026 +0900

    fix(node-configs/cafe24): keep newly added fields rows visible
    
    The Cafe24 node settings panel's `Fields` editor lost newly added rows
    the moment they were created. KeyValueEditor's "Add" button appended a
    blank `{key: "", value: ""}` row, but the onChange handler converted
    the list straight to `Record<string, unknown>` and dropped the
    empty-key entry — so the next render derived its list from the
    unchanged object and the new row was gone. The "추가" button appeared
    broken.
    
    Cafe24Config now maintains the editing rows in local React state
    initialized from `config.fields`. Mutations update the state and
    propagate the (still object-shaped) result upstream, preserving the
    backend contract. External resets (undo/redo, programmatic) trigger a
    derived-state re-sync during render.
    
    Added unit tests cover: clicking Add reveals a new row, typed keys
    persist into `config.fields`, multiple Add clicks accumulate rows
    independent of the object-form filter, removing rows mutates state
    correctly, and the empty-row visibility survives object conversion.
    
    consistency-check session: review/consistency/2026/05/16/09_03_04
    (BLOCK: NO — 5 checkers all NONE, 7 INFO suggestions).
    
    [skip-e2e] — single-component UI fix; backend / spec / data model
    unchanged.
    
    Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

diff --git a/review/consistency/2026/05/16/09_03_04/plan_coherence/review.md b/review/consistency/2026/05/16/09_03_04/plan_coherence/review.md
new file mode 100644
index 00000000..d14a77fe
--- /dev/null
+++ b/review/consistency/2026/05/16/09_03_04/plan_coherence/review.md
@@ -0,0 +1,27 @@
+# Plan 정합성 검토 결과
+
+검토 대상: `cafe24-fields-add-btn-d3f8a2` worktree — `Cafe24Config` fields "추가" 버튼 버그 수정  
+검토 모드: `--impl-prep` (구현 착수 전)  
+검토 일시: 2026-05-16
+
+---
+
+### 발견사항
+
+발견된 CRITICAL / WARNING 사항 없음.
+
+- **[INFO]** 동일 도메인 병렬 worktree 존재 (Cafe24)
+  - target 위치: 작업 요약 — 영향 영역 `frontend/src/components/editor/settings-panel/node-configs/integration-configs.tsx`
+  - 관련 plan: `plan/in-progress/cafe24-app-url-3rdparty-shorten.md` (worktree: `cafe24-3rdparty-url-503aa0`)
+  - 상세: 두 worktree가 모두 Cafe24 기능을 다루지만 수정 파일이 겹치지 않는다. `cafe24-3rdparty-url-503aa0`은 URL routing / namespace / 토큰 단축 레이어(백엔드 + API 경로)를 다루고, 본 worktree는 설정 패널 UI 컴포넌트(`integration-configs.tsx`) 한 파일만 수정한다. 현재 알려진 정보 범위에서 파일 수준 경합은 없다.
+  - 제안: 추적 메모 수준으로 충분. `cafe24-3rdparty-url-503aa0`이 `integration-configs.tsx`를 수정할 가능성이 생기면 그 시점에 직렬화 필요.
+
+---
+
+### 요약
+
+진행 중인 plan 문서(`0-unimplemented-overview.md`, `ai-review-subagent.md`, `brand-refresh-impl.md`, `cafe24-app-url-3rdparty-shorten.md`, `2fa-webauthn.md`, `ai-agent-tool-connection-rewrite.md`)를 전수 검토한 결과, 본 target 작업과 미해결 결정 충돌, 동일 파일 경합, 선행 조건 미해소, 후속 항목 무효화 중 어느 항목도 해당하지 않는다. target은 `spec/4-nodes/4-integration/4-cafe24.md`와 `spec/conventions/cafe24-api-metadata.md`가 정의한 `config.fields` object shape을 변경하지 않으며, 변경 범위가 단일 frontend 컴포넌트 + unit test 1건으로 제한되어 worktree 간 경합 위험이 없다. 구현 착수를 차단할 사유가 없다.
+
+### 위험도
+
+NONE

```

---

### 파일 17: review/consistency/2026/05/16/09_03_04/rationale_continuity/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
commit 6ceebadd3c31fff8894670fb1c4eab4d5389ac65
Author: worker-ants <admin@getit.co.kr>
Date:   Sat May 16 09:16:59 2026 +0900

    fix(node-configs/cafe24): keep newly added fields rows visible
    
    The Cafe24 node settings panel's `Fields` editor lost newly added rows
    the moment they were created. KeyValueEditor's "Add" button appended a
    blank `{key: "", value: ""}` row, but the onChange handler converted
    the list straight to `Record<string, unknown>` and dropped the
    empty-key entry — so the next render derived its list from the
    unchanged object and the new row was gone. The "추가" button appeared
    broken.
    
    Cafe24Config now maintains the editing rows in local React state
    initialized from `config.fields`. Mutations update the state and
    propagate the (still object-shaped) result upstream, preserving the
    backend contract. External resets (undo/redo, programmatic) trigger a
    derived-state re-sync during render.
    
    Added unit tests cover: clicking Add reveals a new row, typed keys
    persist into `config.fields`, multiple Add clicks accumulate rows
    independent of the object-form filter, removing rows mutates state
    correctly, and the empty-row visibility survives object conversion.
    
    consistency-check session: review/consistency/2026/05/16/09_03_04
    (BLOCK: NO — 5 checkers all NONE, 7 INFO suggestions).
    
    [skip-e2e] — single-component UI fix; backend / spec / data model
    unchanged.
    
    Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

diff --git a/review/consistency/2026/05/16/09_03_04/rationale_continuity/review.md b/review/consistency/2026/05/16/09_03_04/rationale_continuity/review.md
new file mode 100644
index 00000000..589da63b
--- /dev/null
+++ b/review/consistency/2026/05/16/09_03_04/rationale_continuity/review.md
@@ -0,0 +1,39 @@
+# Rationale 연속성 검토 결과
+
+검토 대상: `spec/4-nodes/4-integration/4-cafe24.md`
+검토 범위: `--impl-prep` — Cafe24 `fields` 추가 버튼 버그 수정 구현 착수 전 검토
+수정 방향 요약: `Cafe24Config` 컴포넌트에 keyvalue 편집용 React state 도입 → 빈 key 행이 UI에 유지되도록 함. 사용자가 key를 채운 시점에 `Record<string,unknown>` 형태로 `config.fields`에 반영. 백엔드 계약의 object shape은 그대로 보존.
+
+---
+
+### 발견사항
+
+이하 4개 점검 관점 모두 적용한 결과, 명시적 CRITICAL·WARNING 항목은 발견되지 않았다. INFO 1건을 기록한다.
+
+- **[INFO]** UI state 분리 패턴이 Rationale 어느 항목에도 명시되지 않음
+  - target 위치: `frontend/src/components/editor/settings-panel/node-configs/integration-configs.tsx` `Cafe24Config` 컴포넌트 (spec §2 설정 UI 구현부)
+  - 과거 결정 출처: `spec/4-nodes/4-integration/4-cafe24.md §9.5` (Principle 7 — config는 rawConfig echo) 및 `§1` (fields 타입 `Record<string, unknown>`)
+  - 상세: Principle 7은 백엔드 handler가 `context.rawConfig`를 config echo로 사용하는 **backend 측 계약**이다. 수정 방향은 프론트엔드 편집 중간 상태(빈 key 행)를 React state에 격리하고, key가 채워진 시점에만 `Record<string,unknown>`으로 `config.fields`를 갱신하는 패턴이다. 이는 Principle 7을 위반하지 않는다 — 백엔드에는 항상 key가 있는 행만 전달되기 때문이다. 다만 이 "UI 편집 버퍼"와 "저장 계약 state"를 분리하는 패턴은 spec §2 설정 UI 섹션이나 §9 Rationale 어디에도 명시된 적이 없다. 이번 수정이 처음으로 이 패턴을 도입하는 구현 사례가 된다.
+  - 제안: spec §9 Rationale 또는 §2 설정 UI 섹션에 "편집 버퍼와 config 저장 상태의 분리" 원칙을 짧게 기록해두면, 동일 컴포넌트를 이후 수정하는 구현자가 패턴 의도를 오해할 가능성을 줄일 수 있다. 필수 수정 사항은 아니다.
+
+---
+
+### 점검 결과 (4개 관점)
+
+1. **기각된 대안의 재도입**: 해당 없음. spec §9.1은 endpoint-당 노드(A)·범용 HTTP 노드(B)를 기각하고 단일 노드+메타데이터(C)를 채택했다. 수정 방향은 이 결정과 무관한 UI 버그 수정이다.
+
+2. **합의된 원칙 위반**: 해당 없음. spec §1의 `fields: Record<string, unknown>` 타입 계약과 §9.5의 Principle 7(config echo) 모두 이번 수정 후에도 유지된다. UI 내부 편집 버퍼는 백엔드에 노출되지 않으며 key가 채워진 행만 object로 변환되어 전달된다.
+
+3. **결정의 무근거 번복**: 해당 없음. 수정 방향은 기존 결정을 번복하지 않는다. spec 변경도 없다.
+
+4. **암묵적 가정 충돌**: 해당 없음. spec §9.3(메타데이터 위치)·§9.4(Private/Public 앱)·§9.8(HMAC 검증) 등 모든 시스템 invariant는 프론트엔드 UI state 레이어와 무관하다.
+
+---
+
+### 요약
+
+이번 구현은 `Cafe24Config` 내부 React state에서 빈 key 행을 일시적으로 보유하고, key가 채워진 시점에만 `config.fields`(`Record<string,unknown>`)로 반영하는 UI 버그 수정이다. spec §4-cafe24.md의 모든 Rationale 항목 — 단일 노드+메타데이터 원칙(§9.1), config echo 계약(§9.5 Principle 7), object shape 타입(§1), HMAC 보안 invariant(§9.8) — 과 충돌하지 않는다. 기각된 대안의 재도입이나 합의된 원칙의 위반은 발견되지 않았다. 유일한 발견은 INFO 1건으로, UI 편집 버퍼 분리 패턴이 Rationale에 미기록 상태라는 보완 제안이다.
+
+### 위험도
+
+NONE

```
