// Regression tests for selector widgets that wrap an app component without its
// own field label: McpServerSelectorWidget (FieldGroup → label + hint) and
// KbSelectorWidget (own label, but schema hint rendered as a caption). Earlier
// these dropped the schema label/hint so users could not tell what the field
// was for — the same class of bug as the model selector widgets.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { useLocaleStore } from "@/lib/stores/locale-store";

// Stub the wrapped app components — we only verify the widget's label/hint
// wiring, not the selectors' internals (heavy deps).
vi.mock("@/components/integrations/mcp-server-selector", () => ({
  McpServerSelector: () => <div data-testid="mcp-selector" />,
}));
vi.mock("@/components/knowledge-base/kb-selector", () => ({
  KbSelector: () => <div data-testid="kb-selector" />,
}));
vi.mock("@/components/llm-config/llm-config-selector", () => ({
  LlmConfigSelector: () => null,
}));
vi.mock("@/components/editor/expression", () => ({
  ExpressionInput: () => null,
}));
vi.mock("@/lib/api/workflows", () => ({ workflowsApi: { list: vi.fn() } }));
vi.mock("@/lib/stores/editor-store", () => ({ useEditorStore: () => null }));

import {
  McpServerSelectorWidget,
  KbSelectorWidget,
} from "../selector-widgets";
import type { JsonSchemaNode } from "@/lib/node-definitions";

const SCHEMA: JsonSchemaNode = { type: "array" };

describe("McpServerSelectorWidget — label + hint (regression)", () => {
  beforeEach(() => useLocaleStore.getState().setLocale("en"));
  afterEach(() => {
    cleanup();
    useLocaleStore.getState().setLocale("ko");
  });

  it("renders the schema label and hint via FieldGroup", () => {
    render(
      <McpServerSelectorWidget
        schema={SCHEMA}
        ui={{ hint: "Add a workspace-registered MCP server." }}
        label="MCP Servers"
        value={[]}
        onChange={() => {}}
      />,
    );
    expect(screen.getByText("MCP Servers")).toBeTruthy();
    expect(
      screen.getByText("Add a workspace-registered MCP server."),
    ).toBeTruthy();
    expect(screen.getByTestId("mcp-selector")).toBeTruthy();
  });
});

describe("KbSelectorWidget — hint (regression)", () => {
  beforeEach(() => useLocaleStore.getState().setLocale("en"));
  afterEach(() => {
    cleanup();
    useLocaleStore.getState().setLocale("ko");
  });

  it("renders the schema hint below the selector (KbSelector owns the label)", () => {
    render(
      <KbSelectorWidget
        schema={SCHEMA}
        ui={{ hint: "Selected KBs are exposed to the LLM as search tools." }}
        value={[]}
        onChange={() => {}}
      />,
    );
    expect(
      screen.getByText("Selected KBs are exposed to the LLM as search tools."),
    ).toBeTruthy();
    expect(screen.getByTestId("kb-selector")).toBeTruthy();
  });
});
