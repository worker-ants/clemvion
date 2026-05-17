import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { ExpressionHighlight } from "../expression-highlight";

function exprSpans(container: HTMLElement) {
  // Expression blocks get a `rounded-sm` class; text spans don't.
  return Array.from(container.querySelectorAll("span.rounded-sm"));
}

describe("ExpressionHighlight", () => {
  it("renders plain text without any expression spans", () => {
    const { container } = render(<ExpressionHighlight value="hello world" />);
    expect(exprSpans(container)).toHaveLength(0);
  });

  it("wraps a single {{ }} block in a highlighted span", () => {
    const { container } = render(
      <ExpressionHighlight value="Hello {{ $input.name }}" />,
    );
    const spans = exprSpans(container);
    expect(spans).toHaveLength(1);
    expect(spans[0].textContent).toBe("{{ $input.name }}");
  });

  it("handles two adjacent expression blocks", () => {
    const { container } = render(
      <ExpressionHighlight value="{{ a }}{{ b }}" />,
    );
    const spans = exprSpans(container);
    expect(spans).toHaveLength(2);
    expect(spans[0].textContent).toBe("{{ a }}");
    expect(spans[1].textContent).toBe("{{ b }}");
  });

  it("treats an unclosed block as a trailing expression span", () => {
    // Incomplete blocks still get highlighted so the user sees the colour flip
    // immediately after typing `{{`.
    const { container } = render(
      <ExpressionHighlight value="prefix {{ unterminated" />,
    );
    const spans = exprSpans(container);
    expect(spans).toHaveLength(1);
    expect(spans[0].textContent).toBe("{{ unterminated");
  });

  it("paints the block red when hasError is true", () => {
    const { container } = render(
      <ExpressionHighlight value="{{ bad }}" hasError />,
    );
    const span = exprSpans(container)[0];
    expect(span.className).toContain("bg-red-500/15");
  });

  it("paints the block amber when hasWarning is true and hasError is false", () => {
    const { container } = render(
      <ExpressionHighlight value="{{ scoped }}" hasWarning />,
    );
    const span = exprSpans(container)[0];
    expect(span.className).toContain("bg-amber-500/15");
    expect(span.className).not.toContain("bg-red-500/15");
  });

  it("prefers error over warning when both flags are set", () => {
    const { container } = render(
      <ExpressionHighlight value="{{ both }}" hasError hasWarning />,
    );
    const span = exprSpans(container)[0];
    expect(span.className).toContain("bg-red-500/15");
    expect(span.className).not.toContain("bg-amber-500/15");
  });

  it("defaults to blue when no flag is set", () => {
    const { container } = render(
      <ExpressionHighlight value="{{ ok }}" />,
    );
    const span = exprSpans(container)[0];
    expect(span.className).toContain("bg-blue-500/15");
  });

  it("preserves whitespace with pre-wrap", () => {
    const { container } = render(
      <ExpressionHighlight value="a  b" />,
    );
    const root = container.querySelector("span");
    expect(root?.className).toContain("whitespace-pre-wrap");
  });
});
