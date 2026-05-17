import { describe, it, expect } from "vitest";
import {
  renderTemplate,
  evalWarnWhen,
  renderSummaryTemplate,
} from "../summary-template-interpreter";
import {
  evaluateWhen,
  renderSummaryTemplate as sharedRenderSummaryTemplate,
  renderTemplate as sharedRenderTemplate,
} from "@workflow/node-summary";

/**
 * `summary-template-interpreter` is now a back-compat re-export shim over
 * `@workflow/node-summary`. The interpreter itself is exhaustively tested
 * in the package; this suite only verifies the shim correctly forwards the
 * API surface so existing import paths keep working unchanged.
 */
describe("summary-template-interpreter shim", () => {
  it("re-exports renderTemplate from @workflow/node-summary", () => {
    expect(renderTemplate).toBe(sharedRenderTemplate);
    expect(renderTemplate("{{method}} {{url}}", { method: "GET", url: "/x" }))
      .toBe("GET /x");
  });

  it("re-exports renderSummaryTemplate from @workflow/node-summary", () => {
    expect(renderSummaryTemplate).toBe(sharedRenderSummaryTemplate);
    expect(renderSummaryTemplate(undefined, {})).toBeNull();
    expect(
      renderSummaryTemplate("{{method}} {{url}}", { method: "GET", url: "/" }),
    ).toEqual({ text: "GET /", isWarning: false });
  });

  it("aliases evalWarnWhen to evaluateWhen", () => {
    expect(evalWarnWhen).toBe(evaluateWhen);
    expect(evalWarnWhen("!url", {})).toBe(true);
    expect(evalWarnWhen("!url", { url: "/x" })).toBe(false);
  });

  it("warnWhen on a SummaryTemplateSpec still produces ⚠ prefixed text", () => {
    expect(
      renderSummaryTemplate(
        {
          template: "{{method}} {{url}}",
          warnWhen: "!url",
          warnMessage: "URL not set",
        },
        {},
      ),
    ).toEqual({ text: "⚠ URL not set", isWarning: true });
  });
});
