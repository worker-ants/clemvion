// Unit tests for `WorkflowSelectorWidget` — the auto-form widget for the
// Sub-Workflow node's `Target Workflow` field ([Spec §2/§7](../../../../../../../../spec/4-nodes/2-flow/1-workflow.md)).
//
// Verifies it: lists workspace workflows, excludes the currently-edited one,
// co-writes workflowId + workflowName on pick (via `onChangeFields`), and
// clears workflowName on manual UUID entry.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useLocaleStore } from "@/lib/stores/locale-store";

// Editor store mock — exposes the currently-edited workflow id so the widget
// can exclude it from the candidate list.
let currentWorkflowId: string | null = "wf-self";
vi.mock("@/lib/stores/editor-store", () => ({
  useEditorStore: (selector: (s: { workflowId: string | null }) => unknown) =>
    selector({ workflowId: currentWorkflowId }),
}));

// Workflows API mock — controlled per test.
let listResponse: unknown = {};
vi.mock("@/lib/api/workflows", () => ({
  workflowsApi: { list: vi.fn(() => Promise.resolve({ data: listResponse })) },
}));

// ExpressionInput stub — render a plain input so we can drive manual entry
// without pulling in the full expression editor.
vi.mock("@/components/editor/expression", () => ({
  ExpressionInput: ({
    value,
    onChange,
    label,
  }: {
    value: string;
    onChange: (v: string) => void;
    label?: string;
  }) => (
    <input
      aria-label={label ?? "manual"}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

import { WorkflowSelectorWidget } from "../selector-widgets";
import type { JsonSchemaNode } from "@/lib/node-definitions";

const SCHEMA: JsonSchemaNode = { type: "string" };

function setListResponse(body: unknown) {
  listResponse = body;
}

function renderWidget(
  overrides: {
    value?: unknown;
    onChange?: (v: unknown) => void;
    onChangeFields?: (patch: Record<string, unknown>) => void;
  } = {},
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  // Seed the cache synchronously so the dropdown renders without awaiting.
  queryClient.setQueryData(["workflows"], { data: listResponse });
  return render(
    <QueryClientProvider client={queryClient}>
      <WorkflowSelectorWidget
        schema={SCHEMA}
        label="Target Workflow"
        value={overrides.value ?? ""}
        onChange={overrides.onChange ?? (() => {})}
        onChangeFields={overrides.onChangeFields}
      />
    </QueryClientProvider>,
  );
}

const WORKFLOWS = [
  { id: "wf-self", name: "Self", isActive: true, tags: [], settings: {}, currentVersion: 1 },
  { id: "wf-a", name: "Alpha", isActive: true, tags: [], settings: {}, currentVersion: 1 },
  { id: "wf-b", name: "Beta", isActive: false, tags: [], settings: {}, currentVersion: 1 },
];

describe("WorkflowSelectorWidget", () => {
  beforeEach(() => {
    useLocaleStore.getState().setLocale("en");
    currentWorkflowId = "wf-self";
    setListResponse({ data: WORKFLOWS });
  });
  afterEach(() => cleanup());

  it("lists candidate workflows excluding the currently-edited one", () => {
    renderWidget();
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    const optionTexts = Array.from(select.options).map((o) => o.textContent);
    expect(optionTexts).toContain("Alpha");
    expect(optionTexts.join(" ")).not.toContain("Self");
  });

  it("marks inactive workflows with the inactive suffix", () => {
    renderWidget();
    expect(screen.getByRole("option", { name: /Beta/ }).textContent).toContain(
      "(inactive)",
    );
  });

  it("co-writes workflowId + workflowName on selection", () => {
    const onChangeFields = vi.fn();
    renderWidget({ onChangeFields });
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "wf-a" },
    });
    expect(onChangeFields).toHaveBeenCalledWith({
      workflowId: "wf-a",
      workflowName: "Alpha",
    });
  });

  it("clears workflowName on manual UUID entry", () => {
    const onChangeFields = vi.fn();
    renderWidget({ onChangeFields });
    fireEvent.change(screen.getByLabelText("Workflow ID"), {
      target: { value: "manual-uuid" },
    });
    expect(onChangeFields).toHaveBeenCalledWith({
      workflowId: "manual-uuid",
      workflowName: "",
    });
  });

  it("falls back to onChange when onChangeFields is absent", () => {
    const onChange = vi.fn();
    renderWidget({ onChange });
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "wf-a" },
    });
    expect(onChange).toHaveBeenCalledWith("wf-a");
  });
});
