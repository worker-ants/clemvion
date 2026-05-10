import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  PresentationContent,
  JsonContent,
} from "../renderers/presentation-renderers";
import type { NodeResult } from "@/lib/stores/execution-store";

function makeResult(overrides: Partial<NodeResult> = {}): NodeResult {
  return {
    nodeId: "n1",
    nodeLabel: "Template Node",
    nodeType: "template",
    nodeCategory: "presentation",
    status: "completed",
    duration: 3,
    outputData: {
      config: { outputFormat: "text" },
      output: { rendered: "Hello World" },
    },
    ...overrides,
  };
}

describe("JsonContent", () => {
  it("renders JSON formatted output", () => {
    render(<JsonContent data={{ key: "value" }} />);
    expect(screen.getByText(/"key": "value"/)).toBeDefined();
  });

  it("renders null gracefully", () => {
    render(<JsonContent data={null} />);
    expect(screen.getByText("null")).toBeDefined();
  });
});

describe("PresentationContent", () => {
  describe("TemplateContent", () => {
    it("renders text preview with resolved content", () => {
      render(
        <PresentationContent
          result={makeResult({
            outputData: {
              config: { outputFormat: "text" },
              output: { rendered: "Score: 95, User: Alice" },
            },
          })}
        />,
      );

      expect(screen.getByText("Preview (text)")).toBeDefined();
      expect(screen.getByText("Score: 95, User: Alice")).toBeDefined();
    });

    it("renders html preview", () => {
      render(
        <PresentationContent
          result={makeResult({
            outputData: {
              config: { outputFormat: "html" },
              output: { rendered: "<h1>Title</h1><p>Paragraph</p>" },
            },
          })}
        />,
      );

      expect(screen.getByText("Preview (html)")).toBeDefined();
      expect(screen.getByText("Title")).toBeDefined();
      expect(screen.getByText("Paragraph")).toBeDefined();
    });

    it("renders markdown preview", () => {
      render(
        <PresentationContent
          result={makeResult({
            outputData: {
              config: { outputFormat: "markdown" },
              output: { rendered: "# Heading" },
            },
          })}
        />,
      );

      expect(screen.getByText("Preview (markdown)")).toBeDefined();
      expect(screen.getByText("Heading")).toBeDefined();
    });

    it("shows Output Data section with raw JSON", () => {
      render(
        <PresentationContent
          result={makeResult({
            outputData: {
              config: { outputFormat: "text" },
              output: { rendered: "Hello" },
            },
          })}
        />,
      );

      expect(screen.getByText("Output Data")).toBeDefined();
      expect(screen.getByText(/"rendered": "Hello"/)).toBeDefined();
    });

    it("falls back to JsonContent when rendered is missing", () => {
      render(
        <PresentationContent
          result={makeResult({
            outputData: {
              config: { outputFormat: "html" },
              output: { foo: "bar" },
            },
          })}
        />,
      );

      // rendered 가 없으면 TemplateContent 가 JsonContent 로 fallback (data = output)
      expect(screen.getByText(/"foo": "bar"/)).toBeDefined();
    });

    it("defaults to text format when outputFormat is not specified", () => {
      render(
        <PresentationContent
          result={makeResult({
            outputData: {
              config: {},
              output: { rendered: "Plain text" },
            },
          })}
        />,
      );

      expect(screen.getByText("Preview (text)")).toBeDefined();
      expect(screen.getByText("Plain text")).toBeDefined();
    });
  });

  describe("routing to correct renderer", () => {
    it("renders TableContent for table node type", () => {
      render(
        <PresentationContent
          result={makeResult({
            nodeType: "table",
            outputData: {
              rows: [{ name: "Alice" }],
              columns: ["name"],
            },
          })}
        />,
      );

      expect(screen.getByText("Alice")).toBeDefined();
    });

    it("renders JsonContent for unknown presentation node type", () => {
      render(
        <PresentationContent
          result={makeResult({
            nodeType: "unknown_type" as string,
            outputData: { foo: "bar" },
          })}
        />,
      );

      expect(screen.getByText(/"foo": "bar"/)).toBeDefined();
    });

    it("renders FormSubmittedContent for form node type", () => {
      render(
        <PresentationContent
          result={makeResult({
            nodeType: "form",
            outputData: {
              submittedData: { approved: "yes" },
            },
          })}
        />,
      );

      expect(screen.getByText("approved:")).toBeDefined();
      expect(screen.getByText("yes")).toBeDefined();
    });
  });

  describe("Carousel global buttons (new NodeHandlerOutput shape)", () => {
    it("renders global buttons from envelope config.buttonConfig", () => {
      render(
        <PresentationContent
          result={makeResult({
            nodeType: "carousel",
            outputData: {
              config: {
                layout: "card",
                mode: "static",
                buttonConfig: {
                  buttons: [
                    { id: "approve", label: "Approve", type: "port" },
                    { id: "reject", label: "Reject", type: "port" },
                  ],
                },
              },
              output: {
                type: "carousel",
                layout: "card",
                items: [{ title: "Item 1", description: "desc" }],
                rendered: "<div class=\"carousel\"><div>Item 1</div></div>",
              },
              status: "waiting_for_input",
              meta: { interactionType: "buttons" },
            },
          })}
          onPortButtonClick={() => {}}
        />,
      );

      expect(screen.getByText("Approve")).toBeDefined();
      expect(screen.getByText("Reject")).toBeDefined();
    });

    it("still renders buttons from legacy flat data.buttonConfig", () => {
      render(
        <PresentationContent
          result={makeResult({
            nodeType: "carousel",
            outputData: {
              type: "carousel",
              layout: "card",
              items: [{ title: "Item 1" }],
              rendered: "<div class=\"carousel\"><div>Item 1</div></div>",
              buttonConfig: {
                buttons: [{ id: "ok", label: "OK", type: "port" }],
              },
            },
          })}
          onPortButtonClick={() => {}}
        />,
      );

      expect(screen.getByText("OK")).toBeDefined();
    });

    it("renders items and highlights selected button on structured resume shape", () => {
      render(
        <PresentationContent
          result={makeResult({
            nodeType: "carousel",
            status: "completed",
            outputData: {
              config: {
                layout: "card",
                buttonConfig: {
                  buttons: [
                    { id: "approve", label: "Approve", type: "port" },
                    { id: "reject", label: "Reject", type: "port" },
                  ],
                },
              },
              output: {
                interaction: {
                  interactionType: "button_click",
                  buttonId: "approve",
                },
                previousOutput: {
                  type: "carousel",
                  layout: "card",
                  items: [{ title: "Item 1", description: "desc" }],
                  rendered:
                    "<div class=\"carousel\"><div>Item 1</div></div>",
                },
              },
              status: "button_click",
            },
          })}
        />,
      );

      expect(screen.getByText("Item 1")).toBeDefined();
      const approve = screen.getByText("Approve").closest("button");
      expect(approve).not.toBeNull();
      // Selected button carries primary-color classes in the renderer's styling.
      expect(approve?.className).toContain("bg-[hsl(var(--primary))]");
    });
  });
});
