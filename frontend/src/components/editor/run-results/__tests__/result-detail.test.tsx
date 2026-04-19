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
  getCategoryColor: (category: string) => {
    const colors: Record<string, string> = {
      integration: "#F97316",
      presentation: "#EC4899",
      ai: "#10B981",
    };
    return colors[category] ?? "#6B7280";
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

  it("renders conversation inside Preview tab for completed multi-turn information extractor and keeps Output/Config accessible", () => {
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

    // Conversation is now rendered inside the Preview tab, so all standard
    // tabs remain accessible to the user.
    expect(screen.getByRole("button", { name: "Preview" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Input" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Output" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Config" })).toBeDefined();
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

  describe("selection-driven tab visibility for AI conversation nodes", () => {
    const aiConvOutput = {
      config: { schema: [], mode: "multi_turn" },
      output: {
        extracted: { name: "Alice" },
        messages: [
          { role: "user", content: "hi" },
          { role: "assistant", content: "hello" },
        ],
        endReason: "completed",
        turnCount: 1,
      },
      meta: { model: "gpt", interactionType: "ai_conversation" },
    };

    it("node-level view shows all tabs including LLM Usage", () => {
      render(
        <ResultDetail
          result={makeResult({
            nodeType: "ai_agent",
            nodeCategory: "ai",
            status: "completed",
            outputData: aiConvOutput,
          })}
          {...defaultProps}
          selectedConversationItemIndex={null}
        />,
      );
      expect(
        screen.getByRole("button", { name: "Preview" }),
      ).toBeDefined();
      expect(screen.getByRole("button", { name: "Input" })).toBeDefined();
      expect(screen.getByRole("button", { name: "Output" })).toBeDefined();
      expect(
        screen.getByRole("button", { name: "LLM Usage" }),
      ).toBeDefined();
      expect(screen.getByRole("button", { name: "Config" })).toBeDefined();
      expect(
        screen.queryByRole("button", { name: "LLM Information" }),
      ).toBeNull();
      // Response / Request are message-level only.
      expect(screen.queryByRole("button", { name: "Response" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Request" })).toBeNull();
    });

    it("user message selected → only Preview tab", () => {
      render(
        <ResultDetail
          result={makeResult({
            nodeType: "ai_agent",
            nodeCategory: "ai",
            status: "completed",
            outputData: aiConvOutput,
          })}
          {...defaultProps}
          selectedConversationItemIndex={0}
        />,
      );
      expect(
        screen.getByRole("button", { name: "Preview" }),
      ).toBeDefined();
      expect(screen.queryByRole("button", { name: "Input" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Output" })).toBeNull();
      expect(
        screen.queryByRole("button", { name: "LLM Information" }),
      ).toBeNull();
      expect(
        screen.queryByRole("button", { name: "LLM Usage" }),
      ).toBeNull();
      expect(screen.queryByRole("button", { name: "Response" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Request" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Config" })).toBeNull();
    });

    it("assistant message selected → Preview + Response/Request/LLM Usage", () => {
      render(
        <ResultDetail
          result={makeResult({
            nodeType: "ai_agent",
            nodeCategory: "ai",
            status: "completed",
            outputData: aiConvOutput,
          })}
          {...defaultProps}
          selectedConversationItemIndex={1}
        />,
      );
      expect(
        screen.getByRole("button", { name: "Preview" }),
      ).toBeDefined();
      expect(
        screen.getByRole("button", { name: "Response" }),
      ).toBeDefined();
      expect(
        screen.getByRole("button", { name: "Request" }),
      ).toBeDefined();
      expect(
        screen.getByRole("button", { name: "LLM Usage" }),
      ).toBeDefined();
      expect(
        screen.queryByRole("button", { name: "LLM Information" }),
      ).toBeNull();
      expect(screen.queryByRole("button", { name: "Input" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Output" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Config" })).toBeNull();
    });
  });

  describe("meta / port / status tabs", () => {
    it("shows Meta tab with raw meta JSON when meta is present", () => {
      render(
        <ResultDetail
          result={makeResult({
            nodeType: "http_request",
            nodeCategory: "integration",
            outputData: {
              config: {},
              output: { body: "ok" },
              meta: { durationMs: 123, statusCode: 200 },
            },
          })}
          {...defaultProps}
        />,
      );

      const metaTab = screen.getByRole("button", { name: "Meta" });
      fireEvent.click(metaTab);
      expect(screen.getByText(/durationMs/)).toBeDefined();
      expect(screen.getByText(/statusCode/)).toBeDefined();
    });

    it("hides Meta tab when node has no meta", () => {
      render(
        <ResultDetail
          result={makeResult({
            nodeType: "http_request",
            nodeCategory: "integration",
            outputData: {
              config: {},
              output: { body: "ok" },
            },
          })}
          {...defaultProps}
        />,
      );

      expect(screen.queryByRole("button", { name: "Meta" })).toBeNull();
    });

    it("shows Port tab with the port value", () => {
      render(
        <ResultDetail
          result={makeResult({
            nodeType: "if_else",
            nodeCategory: "logic",
            outputData: {
              config: {},
              output: { matched: true },
              port: "true",
            },
          })}
          {...defaultProps}
        />,
      );

      const portTab = screen.getByRole("button", { name: "Port" });
      fireEvent.click(portTab);
      expect(screen.getByText("true")).toBeDefined();
    });

    it("shows Status tab with the status value", () => {
      render(
        <ResultDetail
          result={makeResult({
            nodeType: "form",
            nodeCategory: "presentation",
            status: "waiting_for_input",
            outputData: {
              config: {},
              output: null,
              status: "waiting_for_input",
            },
          })}
          {...defaultProps}
        />,
      );

      const statusTab = screen.getByRole("button", { name: "Status" });
      fireEvent.click(statusTab);
      expect(screen.getByText("waiting_for_input")).toBeDefined();
    });

    it("hides Port / Status tabs when values are absent", () => {
      render(
        <ResultDetail
          result={makeResult({
            nodeType: "http_request",
            nodeCategory: "integration",
            outputData: {
              config: {},
              output: { body: "ok" },
              meta: { durationMs: 1 },
            },
          })}
          {...defaultProps}
        />,
      );

      expect(screen.queryByRole("button", { name: "Port" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Status" })).toBeNull();
    });
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
