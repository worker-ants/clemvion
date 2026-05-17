import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { ExpressionInput } from "../expression-input";

// Mock stores
vi.mock("@/lib/stores/editor-store", () => ({
  useEditorStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      selectedNodeId: "current-node",
      nodes: [
        {
          id: "n1",
          data: { label: "HTTP Request", type: "http_request", config: {} },
        },
        {
          id: "n2",
          data: {
            label: "Vars",
            type: "variable_declaration",
            config: {
              variables: [
                { name: "counter", type: "number" },
                { name: "token", type: "string" },
              ],
            },
          },
        },
        {
          id: "current-node",
          data: { label: "Current", type: "http_request", config: {} },
        },
      ],
      edges: [{ source: "n1", target: "current-node" }],
    }),
}));

vi.mock("@/lib/stores/execution-store", () => ({
  useExecutionStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      nodeResults: [
        {
          nodeId: "n1",
          nodeLabel: "HTTP Request",
          outputData: {
            statusCode: 200,
            body: { data: { message: "test", code: 0 }, headers: {} },
          },
        },
      ],
    }),
}));

describe("ExpressionInput", () => {
  let onChange: ReturnType<typeof vi.fn<(value: string) => void>>;

  beforeEach(() => {
    onChange = vi.fn<(value: string) => void>();
  });

  it("renders with label and value", () => {
    render(
      <ExpressionInput
        label="URL"
        value="https://example.com"
        onChange={onChange}
      />,
    );

    expect(screen.getByText("URL")).toBeDefined();
    expect(screen.getByDisplayValue("https://example.com")).toBeDefined();
  });

  it("calls onChange on input", () => {
    render(
      <ExpressionInput label="URL" value="" onChange={onChange} />,
    );

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "test" } });
    expect(onChange).toHaveBeenCalledWith("test");
  });

  it("renders hint text", () => {
    render(
      <ExpressionInput
        label="URL"
        value=""
        onChange={onChange}
        hint="Enter a URL"
      />,
    );

    expect(screen.getByText("Enter a URL")).toBeDefined();
  });

  it("renders placeholder", () => {
    render(
      <ExpressionInput
        label="URL"
        value=""
        onChange={onChange}
        placeholder="https://..."
      />,
    );

    expect(screen.getByPlaceholderText("https://...")).toBeDefined();
  });

  it("renders as textarea when multiline", () => {
    render(
      <ExpressionInput
        label="Body"
        value="content"
        onChange={onChange}
        multiline
        rows={5}
      />,
    );

    const textarea = screen.getByRole("textbox");
    expect(textarea.tagName.toLowerCase()).toBe("textarea");
  });

  it("shows validation error for invalid expression after debounce", async () => {
    vi.useFakeTimers();

    render(
      <ExpressionInput
        label="URL"
        value="{{ $input. }}"
        onChange={onChange}
      />,
    );

    // Advance timer past debounce inside act
    await act(async () => {
      vi.advanceTimersByTime(600);
    });

    // Error message should appear
    const errorEl = document.querySelector(".text-red-400");
    expect(errorEl).toBeTruthy();

    vi.useRealTimers();
  });

  it("does not show validation error for valid expression", async () => {
    vi.useFakeTimers();

    render(
      <ExpressionInput
        label="URL"
        value="{{ $input.name }}"
        onChange={onChange}
      />,
    );

    await act(async () => {
      vi.advanceTimersByTime(600);
    });

    const errorEl = document.querySelector(".text-red-400");
    expect(errorEl).toBeFalsy();

    vi.useRealTimers();
  });

  it("shows an amber scope warning when referencing an unreachable node", async () => {
    vi.useFakeTimers();

    render(
      <ExpressionInput
        label="URL"
        // n2 (Vars) exists but is not an ancestor of current-node
        value='{{ $node["Vars"].output.counter }}'
        onChange={onChange}
      />,
    );

    await act(async () => {
      vi.advanceTimersByTime(600);
    });

    const warning = document.querySelector(".text-amber-400");
    expect(warning).toBeTruthy();
    expect(warning?.textContent ?? "").toContain("Vars");

    // Syntax error slot should remain empty because the expression is
    // syntactically valid.
    const errorEl = document.querySelector(".text-red-400");
    expect(errorEl).toBeFalsy();

    vi.useRealTimers();
  });

  it("shows an amber scope warning for $loop used outside a loop container", async () => {
    vi.useFakeTimers();

    render(
      <ExpressionInput
        label="URL"
        value="{{ $loop.index }}"
        onChange={onChange}
      />,
    );

    await act(async () => {
      vi.advanceTimersByTime(600);
    });

    const warning = document.querySelector(".text-amber-400");
    expect(warning).toBeTruthy();
    expect(warning?.textContent ?? "").toContain("$loop");

    vi.useRealTimers();
  });

  it("prefers the red syntax error over amber scope warnings when both are present", async () => {
    vi.useFakeTimers();

    render(
      <ExpressionInput
        label="URL"
        // Dangling dot triggers a syntax error; the $node["Vars"] reference
        // would also produce an unreachable-node scope warning.
        value='{{ $node["Vars"].output. }}'
        onChange={onChange}
      />,
    );

    await act(async () => {
      vi.advanceTimersByTime(600);
    });

    const errorEl = document.querySelector(".text-red-400");
    expect(errorEl).toBeTruthy();
    const warning = document.querySelector(".text-amber-400");
    expect(warning).toBeFalsy();

    vi.useRealTimers();
  });

  it("does not flag a reachable $node reference", async () => {
    vi.useFakeTimers();

    render(
      <ExpressionInput
        label="URL"
        value='{{ $node["HTTP Request"].output.statusCode }}'
        onChange={onChange}
      />,
    );

    await act(async () => {
      vi.advanceTimersByTime(600);
    });

    expect(document.querySelector(".text-red-400")).toBeFalsy();
    expect(document.querySelector(".text-amber-400")).toBeFalsy();

    vi.useRealTimers();
  });
});
