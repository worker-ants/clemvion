import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// --- @xyflow/react mock -----------------------------------------------------
// Panel just renders its children; useReactFlow exposes spies; useStore feeds a
// fake transform whose z-component is the live zoom (per-test via mockZoom).
let mockZoom = 1;
const zoomIn = vi.fn();
const zoomOut = vi.fn();
const fitView = vi.fn();
const zoomTo = vi.fn();
vi.mock("@xyflow/react", () => ({
  Panel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useReactFlow: () => ({ zoomIn, zoomOut, fitView, zoomTo }),
  useStore: (selector: (s: { transform: number[] }) => unknown) =>
    selector({ transform: [0, 0, mockZoom] }),
}));

import { ZoomControls, MIN_ZOOM, MAX_ZOOM } from "../zoom-controls";

function renderControls(zoom = 1) {
  mockZoom = zoom;
  return render(<ZoomControls />);
}

describe("ZoomControls", () => {
  beforeEach(() => {
    mockZoom = 1;
    vi.clearAllMocks();
  });

  it("exports the 25%–200% zoom bounds as a single source", () => {
    expect(MIN_ZOOM).toBe(0.25);
    expect(MAX_ZOOM).toBe(2);
  });

  it("renders the current zoom level as a percentage", () => {
    renderControls(0.5);
    expect(screen.getByTestId("zoom-percent").textContent).toBe("50%");
  });

  it("rounds the zoom percentage", () => {
    renderControls(0.734);
    expect(screen.getByTestId("zoom-percent").textContent).toBe("73%");
  });

  it("renders a slider bounded to 25–200", () => {
    renderControls(1);
    const slider = screen.getByTestId("zoom-slider") as HTMLInputElement;
    expect(slider.min).toBe("25");
    expect(slider.max).toBe("200");
    expect(slider.value).toBe("100");
  });

  it("drives zoomTo (as a 0–1 ratio) when the slider changes", () => {
    renderControls(1);
    const slider = screen.getByTestId("zoom-slider");
    fireEvent.change(slider, { target: { value: "150" } });
    expect(zoomTo).toHaveBeenCalledWith(1.5, { duration: 0 });
  });

  it("clamps the slider thumb into range when zoom is out of bounds", () => {
    // Defensive: minZoom/maxZoom keep zoom in range in practice, but the range
    // input's value must never fall outside [min,max].
    renderControls(0.1);
    const slider = screen.getByTestId("zoom-slider") as HTMLInputElement;
    expect(slider.value).toBe("25");
    // The readout still reflects the true (out-of-range) zoom.
    expect(screen.getByTestId("zoom-percent").textContent).toBe("10%");
  });

  it("wires zoom in / out / fit buttons", () => {
    renderControls(1);
    fireEvent.click(screen.getByLabelText("확대"));
    expect(zoomIn).toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText("축소"));
    expect(zoomOut).toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText("화면에 맞추기"));
    expect(fitView).toHaveBeenCalledWith({ padding: 0.2 });
  });
});
