import { describe, it, expect } from "vitest";
import {
  classifyPresentation,
  toCarousel,
  toChart,
  toTable,
  toTemplate,
} from "./presentation";

describe("classifyPresentation", () => {
  it("chart — chartType 또는 output.data", () => {
    expect(classifyPresentation({ config: { chartType: "bar" } })).toBe("chart");
    expect(classifyPresentation({ output: { data: [{ x: 1, y: 2 }] } })).toBe("chart");
  });
  it("template — output.rendered 또는 config.template", () => {
    expect(classifyPresentation({ output: { rendered: "hi" } })).toBe("template");
    expect(classifyPresentation({ config: { template: "{{x}}" } })).toBe("template");
  });
  it("table — output.rows 또는 config.columns", () => {
    expect(classifyPresentation({ output: { rows: [] } })).toBe("table");
    expect(classifyPresentation({ config: { columns: [{ field: "a", label: "A" }] } })).toBe(
      "table",
    );
  });
  it("carousel — items 또는 layout", () => {
    expect(classifyPresentation({ output: { items: [] } })).toBe("carousel");
    expect(classifyPresentation({ config: { layout: "card" } })).toBe("carousel");
  });
  it("모르는 shape → null", () => {
    expect(classifyPresentation({ config: {}, output: {} })).toBeNull();
    expect(classifyPresentation(null)).toBeNull();
    expect(classifyPresentation("x")).toBeNull();
  });
});

describe("converters", () => {
  it("toCarousel — dynamic output.items 우선, layout 기본 card", () => {
    const c = toCarousel({
      config: { layout: "image", buttons: [{ id: "b1", label: "Go", type: "link", url: "u" }] },
      output: { items: [{ title: "T", description: "D", image: "i" }] },
    });
    expect(c.layout).toBe("image");
    expect(c.items).toEqual([{ title: "T", description: "D", image: "i", buttons: [] }]);
    expect(c.buttons[0]).toMatchObject({ id: "b1", type: "link", url: "u" });
  });
  it("toCarousel — static config.items 폴백, 잘못된 layout → card", () => {
    const c = toCarousel({ config: { mode: "static", layout: "weird", items: [{ title: "S" }] } });
    expect(c.layout).toBe("card");
    expect(c.items[0].title).toBe("S");
  });
  it("toTable — output.columns/rows", () => {
    const t = toTable({
      output: {
        columns: [{ field: "name", label: "이름" }],
        rows: [{ name: "kim" }],
        rowsTruncated: true,
      },
    });
    expect(t.columns).toEqual([{ field: "name", label: "이름" }]);
    expect(t.rows).toEqual([{ name: "kim" }]);
    expect(t.truncated).toBe(true);
  });
  it("toChart — points + 기본 bar", () => {
    const c = toChart({ config: { chartType: "weird" }, output: { data: [{ x: "a", y: 3 }] } });
    expect(c.chartType).toBe("bar");
    expect(c.points).toEqual([{ x: "a", y: 3 }]);
  });
  it("toTemplate — rendered + 기본 html", () => {
    const t = toTemplate({ config: {}, output: { rendered: "<b>x</b>" } });
    expect(t.outputFormat).toBe("html");
    expect(t.rendered).toBe("<b>x</b>");
  });
  it("버튼 필터 — id/label 없는 항목 제외", () => {
    const c = toCarousel({
      config: { layout: "card", buttons: [{ id: "ok", label: "L" }, { label: "no-id" }, {}] },
    });
    expect(c.buttons).toHaveLength(1);
  });
});
