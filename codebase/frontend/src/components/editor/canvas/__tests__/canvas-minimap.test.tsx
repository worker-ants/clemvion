import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// Panel renders children; MiniMap is a stub carrying its test id so we can
// assert show/hide without a real ReactFlow context.
vi.mock("@xyflow/react", () => ({
  Panel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  MiniMap: (props: { "data-testid"?: string; ariaLabel?: string }) => (
    <div data-testid={props["data-testid"]} aria-label={props.ariaLabel} />
  ),
}));

import { CanvasMinimap } from "../canvas-minimap";

describe("CanvasMinimap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the minimap by default with a toggle button", () => {
    render(<CanvasMinimap />);
    expect(screen.getByTestId("minimap")).toBeInTheDocument();
    const toggle = screen.getByTestId("minimap-toggle");
    expect(toggle).toBeInTheDocument();
    expect(toggle).toHaveAttribute("aria-pressed", "true");
  });

  it("hides the minimap when the toggle is clicked, and restores it", () => {
    render(<CanvasMinimap />);
    const toggle = screen.getByTestId("minimap-toggle");

    fireEvent.click(toggle);
    expect(screen.queryByTestId("minimap")).not.toBeInTheDocument();
    expect(toggle).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(toggle);
    expect(screen.getByTestId("minimap")).toBeInTheDocument();
    expect(toggle).toHaveAttribute("aria-pressed", "true");
  });

  it("labels the toggle for assistive tech", () => {
    render(<CanvasMinimap />);
    expect(screen.getByLabelText("미니맵 표시 전환")).toBeInTheDocument();
  });
});
