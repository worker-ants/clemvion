import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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
      carousel: { label: "Carousel", category: "presentation" },
      ai_agent: { label: "AI Agent", category: "ai" },
      information_extractor: { label: "Information Extractor", category: "ai" },
    };
    return defs[type] ?? undefined;
  },
  CATEGORY_COLORS: {
    integration: "#F97316",
    presentation: "#EC4899",
    ai: "#10B981",
  },
}));

const defaultProps = {
  isWaitingForm: false,
  formConfig: null,
  isWaitingButtons: false,
  buttonConfig: null,
  isWaitingConversation: false,
  conversationConfig: null,
  conversationMessages: [],
  selectedConversationItemIndex: null,
  isWaitingAiResponse: false,
  executionId: "exec-1",
  onFormSubmit: vi.fn(),
  onButtonClick: vi.fn(),
  onConversationEnd: vi.fn(),
};

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
        {...defaultProps}
      />,
    );

    expect(screen.getByText("Select a node to view details")).toBeDefined();
  });

  it("renders header with node label and status", () => {
    render(
      <ResultDetail
        result={makeResult()}
        {...defaultProps}
      />,
    );

    expect(screen.getByText("My Node")).toBeDefined();
    expect(screen.getAllByText("250ms").length).toBeGreaterThanOrEqual(1);
  });

  describe("tabs for completed nodes", () => {
    it("shows Input and Output tabs for non-presentation completed nodes", () => {
      render(
        <ResultDetail
          result={makeResult({
            nodeType: "http_request",
            nodeCategory: "integration",
            outputData: { statusCode: 200 },
          })}
          {...defaultProps}
        />,
      );

      expect(screen.getByText("Input")).toBeDefined();
      expect(screen.getByText("Output")).toBeDefined();
      // Preview tab should NOT be shown for non-presentation nodes
      expect(screen.queryByText("Preview")).toBeNull();
    });

    it("shows Preview, Input, Output tabs for presentation completed nodes", () => {
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
          {...defaultProps}
        />,
      );

      // Tab buttons exist
      expect(screen.getAllByText("Preview").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("Input")).toBeDefined();
      expect(screen.getByText("Output")).toBeDefined();
    });

    it("defaults to Preview tab for presentation nodes with outputData", () => {
      render(
        <ResultDetail
          result={makeResult({
            nodeType: "table",
            nodeCategory: "presentation",
            outputData: {
              rows: [{ name: "Alice" }],
              columns: ["name"],
            },
          })}
          {...defaultProps}
        />,
      );

      // Preview tab should be active, showing table content
      expect(screen.getByText("Alice")).toBeDefined();
    });

    it("defaults to Output tab for non-presentation nodes", () => {
      render(
        <ResultDetail
          result={makeResult({
            nodeType: "http_request",
            nodeCategory: "integration",
            outputData: { statusCode: 200 },
          })}
          {...defaultProps}
        />,
      );

      // Output tab should be active, showing JSON
      expect(screen.getByText(/statusCode/)).toBeDefined();
    });

    it("defaults to Error tab when node has error", () => {
      render(
        <ResultDetail
          result={makeResult({
            status: "failed",
            error: "Connection timeout",
            outputData: null,
          })}
          {...defaultProps}
        />,
      );

      expect(screen.getByText("Error")).toBeDefined();
      expect(screen.getByText(/Connection timeout/)).toBeDefined();
    });

    it("switches tabs on click", () => {
      render(
        <ResultDetail
          result={makeResult({
            nodeType: "http_request",
            nodeCategory: "integration",
            outputData: { statusCode: 200 },
            inputData: { url: "https://example.com" },
          })}
          {...defaultProps}
        />,
      );

      // Default is Output tab
      expect(screen.getByText(/statusCode/)).toBeDefined();

      // Switch to Input tab
      fireEvent.click(screen.getByText("Input"));
      expect(screen.getByText(/example\.com/)).toBeDefined();
    });

    it("shows loading message when inputData is not yet available", () => {
      render(
        <ResultDetail
          result={makeResult({
            nodeType: "http_request",
            nodeCategory: "integration",
            outputData: { statusCode: 200 },
          })}
          {...defaultProps}
        />,
      );

      // Switch to Input tab
      fireEvent.click(screen.getByText("Input"));
      expect(screen.getByText("Loading input data...")).toBeDefined();
    });
  });

  it("renders template preview in Preview tab for template nodes", () => {
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
        {...defaultProps}
      />,
    );

    // "Preview (text)" heading is hidden in previewOnly mode (tab itself is Preview)
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
        {...defaultProps}
        isWaitingForm={true}
        formConfig={{
          title: "Approval Form",
          fields: [{ name: "approved", type: "checkbox", label: "Approve" }],
        }}
      />,
    );

    expect(screen.getByText("Approval Form")).toBeDefined();
    expect(screen.getByText("Submit")).toBeDefined();
  });

  it("renders conversation inspector for completed multi-turn information extractor", () => {
    render(
      <ResultDetail
        result={makeResult({
          nodeType: "information_extractor",
          nodeCategory: "ai",
          status: "completed",
          outputData: {
            config: { schema: {}, mode: "multi_turn" },
            output: {
              extracted: { name: "Alice" },
              messages: [
                { role: "user", content: "My name is Alice" },
                { role: "assistant", content: "Got it, Alice." },
              ],
              endReason: "completed",
              turnCount: 1,
            },
            meta: {
              model: "test-model",
              interactionType: "ai_conversation",
            },
          },
        })}
        {...defaultProps}
      />,
    );

    expect(screen.queryByText("Input")).toBeNull();
    expect(screen.getByText("My name is Alice")).toBeDefined();
  });

  it("shows tabs for single-turn ai agent nodes", () => {
    render(
      <ResultDetail
        result={makeResult({
          nodeType: "ai_agent",
          nodeCategory: "ai",
          status: "completed",
          outputData: {
            config: {},
            output: { response: "Hello" },
            meta: { model: "test-model" },
          },
        })}
        {...defaultProps}
      />,
    );

    expect(screen.getByText("Input")).toBeDefined();
    expect(screen.getByText("Output")).toBeDefined();
  });

  it("does not show tabs for running nodes", () => {
    render(
      <ResultDetail
        result={makeResult({
          status: "running",
          outputData: null,
        })}
        {...defaultProps}
      />,
    );

    // Should not have tab buttons
    expect(screen.queryByText("Input")).toBeNull();
    expect(screen.queryByText("Output")).toBeNull();
  });
});
