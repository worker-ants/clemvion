import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ParallelConfig } from "../logic-configs";
import { useLocaleStore } from "@/lib/stores/locale-store";

describe("ParallelConfig", () => {
  beforeEach(() => {
    useLocaleStore.setState({ locale: "en" });
  });

  it("renders branchCount / maxConcurrency / errorPolicy fields (waitAll spec out — 결정 K)", () => {
    const onChange = vi.fn();
    render(<ParallelConfig config={{}} onChange={onChange} />);
    expect(screen.getByText(/Branch Count/i)).toBeInTheDocument();
    expect(screen.getByText(/Max Concurrency/i)).toBeInTheDocument();
    expect(screen.getByText(/Error Policy/i)).toBeInTheDocument();
    // waitAll CheckboxField 는 결정 K 로 제거됨
    expect(screen.queryByText(/Wait for All/i)).not.toBeInTheDocument();
  });

  it("defaults errorPolicy to 'stop' when missing", () => {
    const onChange = vi.fn();
    render(<ParallelConfig config={{}} onChange={onChange} />);
    const select = screen.getByDisplayValue("Stop on Error");
    expect(select).toBeInTheDocument();
  });

  it("renders stop / continue / cancel-others-on-fail options (no skip)", () => {
    const onChange = vi.fn();
    render(<ParallelConfig config={{}} onChange={onChange} />);
    const select = screen.getByDisplayValue("Stop on Error") as HTMLSelectElement;
    const optionValues = Array.from(select.options).map((o) => o.value);
    expect(optionValues).toEqual(["stop", "continue", "cancel-others-on-fail"]);
  });

  it("propagates errorPolicy change via onChange", () => {
    const onChange = vi.fn();
    render(
      <ParallelConfig
        config={{ branchCount: 3, maxConcurrency: 0 }}
        onChange={onChange}
      />,
    );
    const select = screen.getByDisplayValue("Stop on Error");
    fireEvent.change(select, { target: { value: "continue" } });
    expect(onChange).toHaveBeenCalledWith({
      branchCount: 3,
      maxConcurrency: 0,
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
