import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ParallelConfig } from "../logic-configs";
import { useLocaleStore } from "@/lib/stores/locale-store";

describe("ParallelConfig", () => {
  beforeEach(() => {
    useLocaleStore.setState({ locale: "en" });
  });

  it("renders branchCount / maxConcurrency / waitAll / errorPolicy fields", () => {
    const onChange = vi.fn();
    render(<ParallelConfig config={{}} onChange={onChange} />);
    expect(screen.getByText(/Branch Count/i)).toBeInTheDocument();
    expect(screen.getByText(/Max Concurrency/i)).toBeInTheDocument();
    expect(screen.getByText(/Wait for All/i)).toBeInTheDocument();
    expect(screen.getByText(/Error Policy/i)).toBeInTheDocument();
  });

  it("defaults errorPolicy to 'stop' when missing", () => {
    const onChange = vi.fn();
    render(<ParallelConfig config={{}} onChange={onChange} />);
    const select = screen.getByDisplayValue("Stop on Error");
    expect(select).toBeInTheDocument();
  });

  it("renders only 'stop' and 'continue' options (no 'skip')", () => {
    const onChange = vi.fn();
    render(<ParallelConfig config={{}} onChange={onChange} />);
    const select = screen.getByDisplayValue("Stop on Error") as HTMLSelectElement;
    const optionValues = Array.from(select.options).map((o) => o.value);
    expect(optionValues).toEqual(["stop", "continue"]);
  });

  it("propagates errorPolicy change via onChange", () => {
    const onChange = vi.fn();
    render(
      <ParallelConfig
        config={{ branchCount: 3, maxConcurrency: 0, waitAll: true }}
        onChange={onChange}
      />,
    );
    const select = screen.getByDisplayValue("Stop on Error");
    fireEvent.change(select, { target: { value: "continue" } });
    expect(onChange).toHaveBeenCalledWith({
      branchCount: 3,
      maxConcurrency: 0,
      waitAll: true,
      errorPolicy: "continue",
    });
  });

  it("preserves an existing errorPolicy='continue' selection", () => {
    const onChange = vi.fn();
    render(
      <ParallelConfig
        config={{ branchCount: 2, errorPolicy: "continue" }}
        onChange={onChange}
      />,
    );
    expect(screen.getByDisplayValue("Continue")).toBeInTheDocument();
  });
});
