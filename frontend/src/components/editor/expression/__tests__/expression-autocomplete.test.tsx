import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { createRef } from "react";
import { ExpressionAutocomplete } from "../expression-autocomplete";
import type { Suggestion } from "../use-expression-suggestions";

function sugg(label: string, type: Suggestion["type"] = "variable"): Suggestion {
  return { label, insertText: label, type };
}

/** Helper: render the autocomplete wired to a real textarea so keydown works. */
function setup({
  suggestions = [sugg("$input"), sugg("$node"), sugg("$var")],
  visible = true,
  selectedIndex = 0,
}: {
  suggestions?: Suggestion[];
  visible?: boolean;
  selectedIndex?: number;
} = {}) {
  const onSelect = vi.fn();
  const onNavigate = vi.fn();
  const anchorRef = createRef<HTMLTextAreaElement>();

  const utils = render(
    <div>
      <textarea ref={anchorRef} aria-label="anchor" />
      <ExpressionAutocomplete
        suggestions={suggestions}
        selectedIndex={selectedIndex}
        onSelect={onSelect}
        onNavigate={onNavigate}
        visible={visible}
        anchorRef={anchorRef}
      />
    </div>,
  );

  return { ...utils, onSelect, onNavigate, anchor: anchorRef.current! };
}

describe("ExpressionAutocomplete", () => {
  beforeEach(() => {
    // jsdom lacks scrollIntoView — stub it to avoid console errors.
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("renders a button per suggestion (capped at 20)", () => {
    const many: Suggestion[] = Array.from({ length: 25 }, (_, i) =>
      sugg(`$v${i}`),
    );
    const { container } = setup({ suggestions: many });
    expect(container.querySelectorAll("button").length).toBe(20);
  });

  it("renders nothing when visible is false", () => {
    const { container } = setup({ visible: false });
    expect(container.querySelectorAll("button").length).toBe(0);
  });

  it("renders nothing when there are no suggestions", () => {
    const { container } = setup({ suggestions: [] });
    expect(container.querySelectorAll("button").length).toBe(0);
  });

  it("highlights the selected index", () => {
    const { container } = setup({ selectedIndex: 1 });
    const buttons = container.querySelectorAll("button");
    expect(buttons[1].className).toContain("bg-[hsl(var(--accent))]");
    expect(buttons[0].className).not.toMatch(/bg-\[hsl\(var\(--accent\)\)\]$/);
  });

  it("calls onSelect with the clicked suggestion", () => {
    const { container, onSelect } = setup();
    const buttons = container.querySelectorAll("button");
    fireEvent.mouseDown(buttons[2]);
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ label: "$var" }));
  });

  it("navigates down on ArrowDown and up on ArrowUp", () => {
    const { anchor, onNavigate } = setup();
    fireEvent.keyDown(anchor, { key: "ArrowDown" });
    expect(onNavigate).toHaveBeenCalledWith("down");

    fireEvent.keyDown(anchor, { key: "ArrowUp" });
    expect(onNavigate).toHaveBeenCalledWith("up");
  });

  it("selects the current index on Enter and Tab", () => {
    const { anchor, onSelect } = setup({ selectedIndex: 1 });
    fireEvent.keyDown(anchor, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ label: "$node" }));

    fireEvent.keyDown(anchor, { key: "Tab" });
    expect(onSelect).toHaveBeenCalledTimes(2);
  });

  it("does not react to keys while invisible", () => {
    const { anchor, onNavigate, onSelect } = setup({ visible: false });
    fireEvent.keyDown(anchor, { key: "ArrowDown" });
    fireEvent.keyDown(anchor, { key: "Enter" });
    expect(onNavigate).not.toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
  });
});
