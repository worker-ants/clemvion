import { describe, it, expect } from "vitest";
import {
  renderTemplate,
  evalWarnWhen,
  renderSummaryTemplate,
} from "../summary-template-interpreter";

describe("renderTemplate", () => {
  it("interpolates simple fields", () => {
    expect(renderTemplate("{{method}} {{url}}", { method: "GET", url: "/foo" }))
      .toBe("GET /foo");
  });

  it("renders empty string for missing fields", () => {
    expect(renderTemplate("{{missing}}", {})).toBe("");
  });

  it("walks dot-paths into nested objects", () => {
    expect(
      renderTemplate("{{request.url}}", { request: { url: "/nested" } }),
    ).toBe("/nested");
  });

  it("supports array length", () => {
    expect(
      renderTemplate("{{items.length}} items", { items: [1, 2, 3] }),
    ).toBe("3 items");
  });

  it("applies upper filter", () => {
    expect(renderTemplate("{{method|upper}}", { method: "get" })).toBe("GET");
  });

  it("applies lower filter", () => {
    expect(renderTemplate("{{method|lower}}", { method: "POST" })).toBe("post");
  });

  it("applies default filter when path is missing", () => {
    expect(renderTemplate("{{method|default:GET}}", {})).toBe("GET");
  });

  it("applies default filter when path is empty string", () => {
    expect(renderTemplate("{{method|default:GET}}", { method: "" })).toBe("GET");
  });

  it("ignores default filter when path is set", () => {
    expect(
      renderTemplate("{{method|default:GET}}", { method: "POST" }),
    ).toBe("POST");
  });

  it("chains default then upper", () => {
    expect(
      renderTemplate("{{method|default:get|upper}}", {}),
    ).toBe("GET");
  });

  it("tolerates whitespace inside delimiters", () => {
    expect(renderTemplate("{{ url }}", { url: "x" })).toBe("x");
  });

  it("leaves unknown filters as passthrough", () => {
    expect(renderTemplate("{{val|nonsense}}", { val: "keep" })).toBe("keep");
  });
});

describe("evalWarnWhen", () => {
  it("!path returns true when missing", () => {
    expect(evalWarnWhen("!url", {})).toBe(true);
    expect(evalWarnWhen("!url", { url: "" })).toBe(true);
    expect(evalWarnWhen("!url", { url: "/foo" })).toBe(false);
  });

  it("!path.length returns true for empty arrays", () => {
    expect(evalWarnWhen("!fields.length", { fields: [] })).toBe(true);
    expect(evalWarnWhen("!fields.length", { fields: [1] })).toBe(false);
  });

  it("path==value compares as string", () => {
    expect(evalWarnWhen("mode==static", { mode: "static" })).toBe(true);
    expect(evalWarnWhen("mode==static", { mode: "dynamic" })).toBe(false);
  });

  it("path!=value compares as string", () => {
    expect(evalWarnWhen("mode!=static", { mode: "dynamic" })).toBe(true);
    expect(evalWarnWhen("mode!=static", { mode: "static" })).toBe(false);
  });

  it("bare path evaluates truthiness", () => {
    expect(evalWarnWhen("flag", { flag: true })).toBe(true);
    expect(evalWarnWhen("flag", { flag: false })).toBe(false);
  });

  it("returns false on empty expression", () => {
    expect(evalWarnWhen("", { url: "x" })).toBe(false);
  });
});

describe("renderSummaryTemplate", () => {
  it("returns null when no template is provided", () => {
    expect(renderSummaryTemplate(undefined, {})).toBeNull();
  });

  it("bare string template renders without warning", () => {
    expect(renderSummaryTemplate("{{method}} {{url}}", { method: "GET", url: "/" }))
      .toEqual({ text: "GET /", isWarning: false });
  });

  it("object spec without warnWhen renders without warning", () => {
    expect(
      renderSummaryTemplate(
        { template: "{{method}} {{url}}" },
        { method: "POST", url: "/api" },
      ),
    ).toEqual({ text: "POST /api", isWarning: false });
  });

  it("warnWhen match returns warning with ⚠ prefix and warnMessage", () => {
    const result = renderSummaryTemplate(
      {
        template: "{{method}} {{url}}",
        warnWhen: "!url",
        warnMessage: "URL not set",
      },
      {},
    );
    expect(result).toEqual({ text: "⚠ URL not set", isWarning: true });
  });

  it("warnWhen match without warnMessage falls back to rendered template", () => {
    const result = renderSummaryTemplate(
      { template: "Missing {{url}}", warnWhen: "!url" },
      {},
    );
    expect(result).toEqual({ text: "⚠ Missing ", isWarning: true });
  });

  it("warnWhen no-match renders template normally", () => {
    expect(
      renderSummaryTemplate(
        {
          template: "{{method|default:GET}} {{url}}",
          warnWhen: "!url",
          warnMessage: "URL not set",
        },
        { url: "/x" },
      ),
    ).toEqual({ text: "GET /x", isWarning: false });
  });
});
