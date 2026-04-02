import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ResultDetail } from "../result-detail";
import type { NodeResult } from "@/lib/stores/execution-store";

// Mock ws-client
vi.mock("@/lib/websocket/ws-client", () => ({
  getWsClient: () => ({
    emit: vi.fn(),
  }),
}));

// Mock node-definitions
vi.mock("@/lib/node-definitions", () => ({
  getNodeDefinition: (type: string) => {
    const defs: Record<string, { label: string; category: string }> = {
      http_request: { label: "HTTP Request", category: "integration" },
      table: { label: "Table", category: "presentation" },
      form: { label: "Form", category: "presentation" },
      template: { label: "Template", category: "presentation" },
    };
    return defs[type] ?? undefined;
  },
  CATEGORY_COLORS: {
    integration: "#F97316",
    presentation: "#EC4899",
  },
}));

function makeResult(overrides: Partial<NodeResult> = {}): NodeResult {
  return {
    nodeId: "n1",
    nodeLabel: "My Node",
    nodeType: "http_request",
    nodeCategory: "integration",
    status: "completed",
    duration: 250,
    outputData: { statusCode: 200, body: { data: "test" } },
    ...overrides,
  };
}

describe("ResultDetail", () => {
  it("shows placeholder when no result selected", () => {
    render(
      <ResultDetail
        result={null}
        isWaitingForm={false}
        formConfig={null}
        executionId="exec-1"
        onFormSubmit={vi.fn()}
      />,
    );

    expect(screen.getByText("Select a node to view details")).toBeDefined();
  });

  it("renders header with node label and status", () => {
    render(
      <ResultDetail
        result={makeResult()}
        isWaitingForm={false}
        formConfig={null}
        executionId="exec-1"
        onFormSubmit={vi.fn()}
      />,
    );

    expect(screen.getByText("My Node")).toBeDefined();
    // Duration appears in both header and detail view
    expect(screen.getAllByText("250ms").length).toBeGreaterThanOrEqual(1);
  });

  it("renders generic view for non-presentation nodes", () => {
    render(
      <ResultDetail
        result={makeResult({
          nodeType: "http_request",
          nodeCategory: "integration",
          outputData: { statusCode: 200 },
        })}
        isWaitingForm={false}
        formConfig={null}
        executionId="exec-1"
        onFormSubmit={vi.fn()}
      />,
    );

    // Should show JSON output
    expect(screen.getByText(/statusCode/)).toBeDefined();
  });

  it("renders presentation content for presentation nodes", () => {
    render(
      <ResultDetail
        result={makeResult({
          nodeType: "table",
          nodeCategory: "presentation",
          outputData: {
            rows: [{ name: "Alice", score: 95 }],
            columns: ["name", "score"],
          },
        })}
        isWaitingForm={false}
        formConfig={null}
        executionId="exec-1"
        onFormSubmit={vi.fn()}
      />,
    );

    // Should render table
    expect(screen.getByText("Alice")).toBeDefined();
    expect(screen.getByText("95")).toBeDefined();
  });

  it("renders error for failed nodes", () => {
    render(
      <ResultDetail
        result={makeResult({
          status: "failed",
          error: "Connection timeout",
          outputData: null,
        })}
        isWaitingForm={false}
        formConfig={null}
        executionId="exec-1"
        onFormSubmit={vi.fn()}
      />,
    );

    expect(screen.getByText("Connection timeout")).toBeDefined();
  });

  it("renders template preview for template nodes", () => {
    render(
      <ResultDetail
        result={makeResult({
          nodeType: "template",
          nodeCategory: "presentation",
          outputData: {
            type: "template",
            format: "text",
            content: "Score: 95, User: Alice",
          },
        })}
        isWaitingForm={false}
        formConfig={null}
        executionId="exec-1"
        onFormSubmit={vi.fn()}
      />,
    );

    expect(screen.getByText("Preview (text)")).toBeDefined();
    expect(screen.getByText("Score: 95, User: Alice")).toBeDefined();
  });

  it("renders form UI when waiting for input", () => {
    render(
      <ResultDetail
        result={makeResult({
          nodeType: "form",
          nodeCategory: "presentation",
          status: "waiting_for_input",
        })}
        isWaitingForm={true}
        formConfig={{
          title: "Approval Form",
          fields: [{ name: "approved", type: "checkbox", label: "Approve" }],
        }}
        executionId="exec-1"
        onFormSubmit={vi.fn()}
      />,
    );

    expect(screen.getByText("Approval Form")).toBeDefined();
    expect(screen.getByText("Submit")).toBeDefined();
  });
});
