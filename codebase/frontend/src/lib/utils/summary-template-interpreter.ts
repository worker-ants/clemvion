/**
 * Backward-compat re-export shim. The real interpreter lives in
 * `@workflow/node-summary`, which is the single source of truth shared by
 * the backend `handler.validate()` / assistant `WORKFLOW_REVIEW_REQUIRED`
 * review and the frontend canvas badge. Existing call sites that import
 * from `@/lib/utils/summary-template-interpreter` keep working unchanged.
 *
 *  - `evalWarnWhen` is an alias of `evaluateWhen` (older name for the same
 *    `when`-expression evaluator).
 *  - `ConfigSummaryResult` aliases the package's `RenderedSummary` so the
 *    `{ text, isWarning }` shape stays identical.
 */
import {
  evaluateWhen,
  renderTemplate,
  renderSummaryTemplate,
  type RenderedSummary,
} from "@workflow/node-summary";

export { renderTemplate, renderSummaryTemplate };
export const evalWarnWhen = evaluateWhen;

export type ConfigSummaryResult = RenderedSummary;
