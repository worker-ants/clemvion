import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ChartConfig } from "../presentation-configs";
import { useLocaleStore } from "@/lib/stores/locale-store";

// CLE-NODE-CHART 「설정 화면」 — Data Field 입력, 호환 키 dataSource 안내 · 지우기,
// pie · donut 의 Group By 숨김, 집계 없음 선택.
describe("ChartConfig 설정 화면 (CLE-NODE-CHART)", () => {
  beforeEach(() => {
    useLocaleStore.setState({ locale: "en" });
    cleanup();
  });

  it("Data Field 입력을 보여 주고 dataSource 표현식 입력은 두지 않는다", () => {
    render(<ChartConfig config={{ chartType: "bar" }} onChange={vi.fn()} />);
    expect(screen.getByText("Data Field")).toBeDefined();
    expect(screen.queryByText("Data Source")).toBeNull();
    expect(screen.queryByTestId("chart-legacy-data-source")).toBeNull();
  });

  it("저장된 dataSource 가 있으면 호환 안내와 함께 보여 주고 지우기는 키를 없앤다", () => {
    const onChange = vi.fn();
    const config = { chartType: "bar", dataSource: "{{$var.items}}", title: "T" };
    render(<ChartConfig config={config} onChange={onChange} />);
    const legacy = screen.getByTestId("chart-legacy-data-source");
    expect(legacy.textContent).toContain("{{$var.items}}");
    expect(legacy.textContent).toContain("used only while Data Field is empty");
    // 표현식은 Data Field 로 옮길 수 없으므로 옮기라는 안내가 아니라 입력으로 연결하라고 안내한다.
    expect(legacy.textContent).toContain("cannot be moved to Data Field");
    expect(legacy.textContent).toContain("connect it as the input");
    expect(legacy.textContent).not.toContain("Move it to Data Field");
    fireEvent.click(screen.getByRole("button", { name: /Clear/ }));
    expect(onChange).toHaveBeenCalledWith({ chartType: "bar", title: "T" });
  });

  it("빈 문자열 dataSource 는 저장된 값으로 보지 않는다", () => {
    render(<ChartConfig config={{ chartType: "bar", dataSource: "" }} onChange={vi.fn()} />);
    expect(screen.queryByTestId("chart-legacy-data-source")).toBeNull();
  });

  it.each(["bar", "line", "area"])("%s 는 Group By 입력을 보여 준다", (chartType) => {
    render(<ChartConfig config={{ chartType }} onChange={vi.fn()} />);
    expect(screen.getByText("Group By")).toBeDefined();
  });

  it.each(["pie", "donut"])(
    "%s 는 Group By 입력을 감추고 저장된 값은 건드리지 않는다",
    (chartType) => {
      const onChange = vi.fn();
      render(<ChartConfig config={{ chartType, groupBy: "region" }} onChange={onChange} />);
      expect(screen.queryByText("Group By")).toBeNull();
      expect(onChange).not.toHaveBeenCalled();
    },
  );

  it("집계가 없으면 None 을 보여 주고, None 을 고르면 aggregation 키를 없앤다", () => {
    const onChange = vi.fn();
    render(
      <ChartConfig
        config={{ chartType: "bar", yAxis: { field: "v", aggregation: "sum" } }}
        onChange={onChange}
      />,
    );
    const select = screen.getByDisplayValue("Sum") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "" } });
    expect(onChange).toHaveBeenCalledWith({ chartType: "bar", yAxis: { field: "v" } });
    cleanup();
    render(<ChartConfig config={{ chartType: "bar", yAxis: { field: "v" } }} onChange={vi.fn()} />);
    expect(screen.getByDisplayValue("None (raw values)")).toBeDefined();
  });
});
