import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  PresentationContent,
  CarouselContent,
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

    it("strips inline style attribute from html (W-3)", () => {
      // style 은 CSS 속성을 따로 화이트리스트 하기 어려워 ALLOWED_ATTR 에서 제거.
      // class 는 유지 — 미리 정의된 클래스만 의도된 시각 효과를 가진다.
      const { container } = render(
        <PresentationContent
          result={makeResult({
            outputData: {
              config: { outputFormat: "html" },
              output: {
                rendered:
                  '<div class="kept" style="background:url(javascript:alert(1))">A</div>',
              },
            },
          })}
        />,
      );

      const div = container.querySelector("div.kept");
      expect(div).not.toBeNull();
      expect(div!.getAttribute("style")).toBeNull();
      expect(div!.getAttribute("class")).toBe("kept");
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

      // rendered 가 없으면 TemplateContent 가 null 반환 → 공유 Output Data 섹션의
      // JsonContent 만 표시 (data = output, "foo": "bar" 포함)
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

  describe("Template global buttons", () => {
    // Spec 4-nodes/6-presentation/0-common.md §1, §6.5 and 5-template.md §1, §5.4 —
    // Template supports ButtonDef and must render a button bar below its rendered
    // content while waiting_for_input (and keep the selected button highlighted
    // after resume).
    it("renders global buttons from envelope config.buttonConfig", () => {
      render(
        <PresentationContent
          result={makeResult({
            nodeType: "template",
            outputData: {
              config: {
                outputFormat: "html",
                template: "<h1>Hello</h1>",
                buttonConfig: {
                  buttons: [
                    { id: "approve", label: "Approve", type: "port" },
                    { id: "reject", label: "Reject", type: "port" },
                  ],
                },
              },
              output: { rendered: "<h1>Hello</h1>" },
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
            nodeType: "template",
            outputData: {
              rendered: "Hello plaintext",
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

    it("invokes onPortButtonClick for port-type buttons", () => {
      const handler = vi.fn();
      render(
        <PresentationContent
          result={makeResult({
            nodeType: "template",
            outputData: {
              config: {
                outputFormat: "text",
                buttonConfig: {
                  buttons: [{ id: "approve", label: "Approve", type: "port" }],
                },
              },
              output: { rendered: "ready" },
              status: "waiting_for_input",
            },
          })}
          onPortButtonClick={handler}
        />,
      );

      fireEvent.click(screen.getByText("Approve"));
      expect(handler).toHaveBeenCalledWith("approve");
    });

    it("invokes onLinkButtonClick for link-type buttons", () => {
      const linkHandler = vi.fn();
      render(
        <PresentationContent
          result={makeResult({
            nodeType: "template",
            outputData: {
              config: {
                outputFormat: "text",
                buttonConfig: {
                  buttons: [
                    {
                      id: "docs",
                      label: "Docs",
                      type: "link",
                      url: "https://example.com",
                    },
                  ],
                },
              },
              output: { rendered: "ready" },
              status: "waiting_for_input",
            },
          })}
          onLinkButtonClick={linkHandler}
        />,
      );

      fireEvent.click(screen.getByText("Docs"));
      expect(linkHandler).toHaveBeenCalledWith("https://example.com");
    });

    it("highlights selected button on resumed shape", () => {
      render(
        <PresentationContent
          result={makeResult({
            nodeType: "template",
            status: "completed",
            outputData: {
              config: {
                outputFormat: "text",
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
                previousOutput: { rendered: "snapshot" },
              },
              status: "button_click",
            },
          })}
        />,
      );

      const approve = screen.getByText("Approve").closest("button");
      expect(approve).not.toBeNull();
      expect(approve?.className).toContain("bg-[hsl(var(--primary))]");
    });

    it("renders no button bar when buttonConfig is absent", () => {
      render(
        <PresentationContent
          result={makeResult({
            nodeType: "template",
            outputData: {
              config: { outputFormat: "text" },
              output: { rendered: "Plain content" },
            },
          })}
        />,
      );

      // Rendered content stays intact, but no buttons surface.
      expect(screen.getByText("Plain content")).toBeDefined();
      expect(screen.queryByRole("button")).toBeNull();
    });

    it("renders buttons even with previewOnly (button bar must remain interactive while waiting_for_input)", () => {
      render(
        <PresentationContent
          result={makeResult({
            nodeType: "template",
            outputData: {
              config: {
                outputFormat: "text",
                buttonConfig: {
                  buttons: [{ id: "approve", label: "Approve", type: "port" }],
                },
              },
              output: { rendered: "Confirm?" },
              status: "waiting_for_input",
            },
          })}
          onPortButtonClick={() => {}}
          previewOnly
        />,
      );

      expect(screen.getByText("Approve")).toBeDefined();
      // previewOnly suppresses the "Preview (...)" header and the Output Data section.
      expect(screen.queryByText(/Preview \(/)).toBeNull();
      expect(screen.queryByText("Output Data")).toBeNull();
    });

    it("rejects non-http(s) urls at the click site (defense in depth)", () => {
      const linkHandler = vi.fn();
      const portHandler = vi.fn();
      render(
        <PresentationContent
          result={makeResult({
            nodeType: "template",
            outputData: {
              config: {
                outputFormat: "text",
                buttonConfig: {
                  buttons: [
                    {
                      id: "evil",
                      label: "Evil",
                      type: "link",
                      // Unsafe scheme — must not reach onLinkButtonClick even
                      // though openExternalLink would also block it later.
                      url: "javascript:alert(1)",
                    },
                  ],
                },
              },
              output: { rendered: "ready" },
              status: "waiting_for_input",
            },
          })}
          onPortButtonClick={portHandler}
          onLinkButtonClick={linkHandler}
        />,
      );

      fireEvent.click(screen.getByText("Evil"));
      expect(linkHandler).not.toHaveBeenCalled();
      // Falls through to port click with the button id (renderer keeps a
      // single callback path even when the URL is rejected).
      expect(portHandler).toHaveBeenCalledWith("evil");
    });

    it("uses legacy flat outputFormat as previewHeader fallback", () => {
      // Legacy flat shape (pre-envelope migration) keeps `outputFormat` at the
      // top level. The previewHeader must surface it instead of silently
      // defaulting to "text" — otherwise html/markdown historic runs would
      // appear mislabelled. Content rendering itself is unaffected here
      // (TemplateContent still reads from envelope `config`, not the legacy
      // top-level field — that's a separate pre-existing limitation).
      render(
        <PresentationContent
          result={makeResult({
            nodeType: "template",
            outputData: {
              rendered: "Some output",
              outputFormat: "markdown",
            },
          })}
        />,
      );

      expect(screen.getByText("Preview (markdown)")).toBeDefined();
    });
  });

  describe("Template buttonItemMap filtering", () => {
    // Spec 4-nodes/6-presentation/0-common.md §3 — `buttonItemMap` is a
    // Carousel-only construct, but the shared filtering logic in
    // PresentationContent (`!(btn.id in buttonItemMap)`) must still exclude
    // any spurious item-mapped entries when a Template payload accidentally
    // carries one — otherwise a per-item button would leak into the global
    // bar of a node type that has no per-item concept.
    it("excludes buttons present in buttonItemMap from the global bar", () => {
      render(
        <PresentationContent
          result={makeResult({
            nodeType: "template",
            outputData: {
              config: {
                outputFormat: "text",
                buttonConfig: {
                  buttons: [
                    { id: "global-1", label: "Global", type: "port" },
                    { id: "item-1", label: "Item only", type: "port" },
                  ],
                  buttonItemMap: { "item-1": 0 },
                },
              },
              output: { rendered: "ready" },
              status: "waiting_for_input",
            },
          })}
          onPortButtonClick={() => {}}
        />,
      );

      expect(screen.getByText("Global")).toBeDefined();
      expect(screen.queryByText("Item only")).toBeNull();
    });
  });
});

// spec/4-nodes/6-presentation/0-common.md §10.5 step 3 — frontend
// defense-in-depth guard. The backend backfills missing `button.id` with
// UUID v4 for new payloads, but legacy persisted runs / non-AI-Agent
// surfaces can still arrive with `id: undefined`. Without the guard the
// comparison `selectedButtonId === btn.id` short-circuits to `true` when
// both sides are undefined, the button is rendered in primary "selected"
// style, and the click handler's `if (isSelected) return;` early-return
// silently swallows the click. See Rationale "`button.id` backfill 도입
// (2026-05-23)" for the chain of events that produced the original report.
describe("CarouselContent — isSelected guard for undefined ids (spec §10.5)", () => {
  it("invokes onPortButtonClick when both selectedButtonId and btn.id are undefined", () => {
    const onPortButtonClick = vi.fn();
    render(
      <CarouselContent
        data={{
          items: [
            {
              title: "샘플상품 3",
              description: "가격: 10,000원",
              buttons: [
                { label: "문의하기", type: "port" }, // no id — LLM-emitted shape
                { label: "주문하기", type: "port" },
              ],
            },
          ],
        }}
        // selectedButtonId intentionally omitted (matches AssistantPresentationsBlock)
        onPortButtonClick={onPortButtonClick}
      />,
    );

    const orderBtn = screen.getByText("주문하기").closest("button")!;
    // Primary "selected" classes are gated on a real id match — undefined
    // must not flip the comparison true.
    expect(orderBtn.className).not.toContain("bg-[hsl(var(--primary))]");
    fireEvent.click(orderBtn);
    expect(onPortButtonClick).toHaveBeenCalledTimes(1);
  });

  it("preserves selected highlighting when selectedButtonId matches a real button id (defense-in-depth keeps existing semantics)", () => {
    const onPortButtonClick = vi.fn();
    render(
      <CarouselContent
        data={{
          items: [
            {
              title: "Item",
              buttons: [
                { id: "btn-a", label: "A", type: "port" },
                { id: "btn-b", label: "B", type: "port" },
              ],
            },
          ],
        }}
        selectedButtonId="btn-a"
        onPortButtonClick={onPortButtonClick}
      />,
    );

    const aBtn = screen.getByText("A").closest("button")!;
    const bBtn = screen.getByText("B").closest("button")!;
    expect(aBtn.className).toContain("bg-[hsl(var(--primary))]");
    expect(bBtn.className).not.toContain("bg-[hsl(var(--primary))]");

    // Selected button stays click-inert (existing behaviour preserved).
    fireEvent.click(aBtn);
    expect(onPortButtonClick).not.toHaveBeenCalled();
    fireEvent.click(bBtn);
    expect(onPortButtonClick).toHaveBeenCalledWith("btn-b");
  });
});
