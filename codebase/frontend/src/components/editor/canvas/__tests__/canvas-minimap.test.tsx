import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// Panel renders children; MiniMap is a stub. Both forward `className` and
// `position` to the DOM so we can assert the layout offsets that keep the map
// from covering the toggle button (see the overlap regression test below).
vi.mock("@xyflow/react", () => ({
  Panel: (props: {
    children: React.ReactNode;
    className?: string;
    position?: string;
  }) => (
    <div
      data-testid="panel"
      data-position={props.position}
      className={props.className}
    >
      {props.children}
    </div>
  ),
  MiniMap: (props: {
    "data-testid"?: string;
    ariaLabel?: string;
    className?: string;
    position?: string;
  }) => (
    <div
      data-testid={props["data-testid"]}
      aria-label={props.ariaLabel}
      data-position={props.position}
      className={props.className}
    />
  ),
}));

import { CanvasMinimap } from "../canvas-minimap";

// Tailwind spacing scale: the `N` in `bottom-N` / `h-N` equals N * 4px. The `!`
// (important) prefix is optional. Reads the value straight off the rendered
// className so the assertions track the real classes, not a copy of them.
function twSpacingPx(className: string, prefix: "bottom" | "h"): number {
  const match = className.match(new RegExp(`(?:^|\\s)!?${prefix}-(\\d+)(?:\\s|$)`));
  if (!match) {
    throw new Error(`no "${prefix}-<n>" class found in: ${className}`);
  }
  return Number(match[1]) * 4;
}

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
    // Both overlays are anchored to the bottom-right corner.
    expect(screen.getByTestId("minimap")).toHaveAttribute(
      "data-position",
      "bottom-right",
    );
    expect(screen.getByTestId("panel")).toHaveAttribute(
      "data-position",
      "bottom-right",
    );
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

  // Regression guard for the map-covers-button bug: the minimap must float
  // above the toggle so its bottom edge never overlaps the button's top edge.
  it("floats the minimap above the toggle button so they never overlap", () => {
    render(<CanvasMinimap />);
    const minimapBottomPx = twSpacingPx(
      screen.getByTestId("minimap").className,
      "bottom",
    );
    const toggleBottomPx = twSpacingPx(
      screen.getByTestId("panel").className,
      "bottom",
    );
    const toggleHeightPx = twSpacingPx(
      screen.getByTestId("minimap-toggle").className,
      "h",
    );
    // The minimap and the toggle both live in a react-flow <Panel> with the
    // same default margin, so it cancels out: the map's bottom edge must sit at
    // or above the button's top edge (button bottom offset + button height).
    expect(minimapBottomPx).toBeGreaterThanOrEqual(toggleBottomPx + toggleHeightPx);
  });

  // The toggle is pinned at the corner and must not shift when the minimap is
  // toggled off — guards against re-introducing a visibility-dependent lift.
  it("keeps the toggle pinned at the corner whether the minimap is shown or hidden", () => {
    render(<CanvasMinimap />);
    const shownClass = screen.getByTestId("panel").className;

    fireEvent.click(screen.getByTestId("minimap-toggle"));
    expect(screen.queryByTestId("minimap")).not.toBeInTheDocument();
    expect(screen.getByTestId("panel").className).toBe(shownClass);
  });
});
