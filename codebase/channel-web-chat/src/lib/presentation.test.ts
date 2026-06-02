import { describe, it, expect } from "vitest";
import {
  classifyPresentation,
  isSafeUrl,
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
  it("toChart — xAxis/yAxis.label 추출", () => {
    const c = toChart({
      config: { chartType: "line", xAxis: { field: "m", label: "월" }, yAxis: { field: "v", label: "매출" } },
      output: { data: [{ x: "1월", y: 5 }] },
    });
    expect(c.xLabel).toBe("월");
    expect(c.yLabel).toBe("매출");
  });
  it("toChart — label 없으면 undefined", () => {
    const c = toChart({ config: { chartType: "bar", xAxis: { field: "m" } }, output: { data: [] } });
    expect(c.xLabel).toBeUndefined();
    expect(c.yLabel).toBeUndefined();
  });
  it("toChart — axisLabel 빈 문자열('') → undefined (I6)", () => {
    const c = toChart({
      config: { chartType: "bar", xAxis: { label: "" }, yAxis: { label: "" } },
      output: { data: [] },
    });
    expect(c.xLabel).toBeUndefined();
    expect(c.yLabel).toBeUndefined();
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

describe("isSafeUrl", () => {
  it("http:/https: URL 허용", () => {
    expect(isSafeUrl("https://example.com/img.png")).toBe(true);
    expect(isSafeUrl("http://example.com/page")).toBe(true);
  });
  it("javascript: 스킴 차단 (W1 XSS)", () => {
    expect(isSafeUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeUrl("  javascript:alert(1)")).toBe(false); // leading whitespace
    expect(isSafeUrl("JAVASCRIPT:alert(1)")).toBe(false); // case-insensitive
  });
  it("data: 스킴 차단 (W1 XSS)", () => {
    expect(isSafeUrl("data:text/html,<h1>hi</h1>")).toBe(false);
  });
  it("vbscript: 스킴 차단", () => {
    expect(isSafeUrl("vbscript:msgbox(1)")).toBe(false);
  });
  it("blob: 스킴 차단 (W1 XSS)", () => {
    expect(isSafeUrl("blob:https://example.com/some-uuid")).toBe(false);
  });
  it("file: 스킴 차단 (W1 XSS)", () => {
    expect(isSafeUrl("file:///etc/passwd")).toBe(false);
    expect(isSafeUrl("FILE:///etc/passwd")).toBe(false); // case-insensitive
  });
  it("프로토콜-상대 URL(//) 허용", () => {
    expect(isSafeUrl("//cdn.example.com/img.png")).toBe(true);
  });
  it("상대 경로 허용", () => {
    expect(isSafeUrl("/images/photo.png")).toBe(true);
    expect(isSafeUrl("images/photo.png")).toBe(true);
  });
});

describe("isSafeUrl in button/carousel", () => {
  it("asButtons: javascript: url → url undefined (W1)", () => {
    const c = toCarousel({
      config: {
        layout: "card",
        buttons: [{ id: "b1", label: "악성", type: "link", url: "javascript:alert(1)" }],
      },
    });
    expect(c.buttons[0].url).toBeUndefined();
  });
  it("toCarousel: javascript: image src → image undefined (I4)", () => {
    const c = toCarousel({
      output: { items: [{ title: "T", image: "javascript:alert(1)" }] },
    });
    expect(c.items[0].image).toBeUndefined();
  });
  it("toCarousel: https: image src → 유지", () => {
    const c = toCarousel({
      output: { items: [{ title: "T", image: "https://cdn.example.com/img.png" }] },
    });
    expect(c.items[0].image).toBe("https://cdn.example.com/img.png");
  });
});

describe("toTable — config 폴백 (I15)", () => {
  it("config.columns 폴백 — output.columns 없을 때", () => {
    const t = toTable({
      config: { columns: [{ field: "id", label: "ID" }] },
      output: { rows: [{ id: 1 }] },
    });
    expect(t.columns).toEqual([{ field: "id", label: "ID" }]);
    expect(t.rows).toEqual([{ id: 1 }]);
  });
  it("config.rows 폴백 — output.rows 없을 때", () => {
    const t = toTable({
      config: { columns: [{ field: "x", label: "X" }], rows: [{ x: "v" }] },
    });
    expect(t.rows).toEqual([{ x: "v" }]);
  });
  it("column label 없으면 field 값으로 fallback", () => {
    const t = toTable({
      config: { columns: [{ field: "name" }] },
    });
    expect(t.columns[0].label).toBe("name");
  });
});
