import {
  evaluateWarnings,
  renderSummaryTemplate,
  type EvaluatedWarning,
} from "@workflow/node-summary";
import { getNodeDefinition } from "@/lib/stores/node-definitions-store";

type NodeConfig = Record<string, unknown>;

export type ConfigSummaryResult = {
  text: string;
  isWarning: boolean;
};

/**
 * Per-call context that the backend cannot evaluate (it has no awareness of
 * workspace-default LLM configs etc.). The summary helper layers this on
 * top of the SSOT warning evaluation so the canvas badge can stay quiet
 * when a default LLM provider exists, even though the backend
 * `*:no-llm-provider` rule still fires (intentional — it remains the safety
 * net for `WORKFLOW_REVIEW_REQUIRED`).
 */
export type SummaryContext = {
  hasDefaultLlmConfig?: boolean;
};

/**
 * Node types where a backend warningRule with id `<type>:no-llm-provider`
 * should be suppressed from the canvas badge when the workspace has a
 * default LLM config. Keeps the backend review behavior unchanged — only
 * the canvas surface honors the context flag.
 */
export const LLM_PROVIDER_NODES: ReadonlySet<string> = new Set([
  "ai_agent",
  "text_classifier",
  "information_extractor",
]);

function isLlmProviderRule(warning: EvaluatedWarning): boolean {
  return warning.id.endsWith(":no-llm-provider");
}

/**
 * Returns the canvas summary for a node, derived purely from its backend
 * SSOT metadata (`warningRules` + `summaryTemplate`).
 *
 * Order:
 *  1. Run `evaluateWarnings(config, def.warningRules)`. If a blocking
 *     warning fires, return `{ text: '⚠ <message>', isWarning: true }`.
 *     For LLM nodes, drop the `*:no-llm-provider` rule from the badge when
 *     `context.hasDefaultLlmConfig` is true (backend review still fires).
 *  2. Otherwise render `def.summaryTemplate` if present.
 *  3. Otherwise return `null` (the canvas hides the body summary).
 *
 * `manual_trigger` is special-cased: it ships parameter slots that are
 * never "configured" in the same sense, so the canvas keeps its previous
 * behavior of rendering nothing.
 */
export function getConfigSummary(
  nodeType: string,
  config: NodeConfig,
  context?: SummaryContext,
): ConfigSummaryResult | null {
  if (nodeType === "manual_trigger") return null;

  const def = getNodeDefinition(nodeType);

  const warnings = evaluateWarnings(config, def?.warningRules);
  const blocking = warnings.find((w) => {
    if (w.severity !== "blocking") return false;
    if (
      LLM_PROVIDER_NODES.has(nodeType) &&
      isLlmProviderRule(w) &&
      context?.hasDefaultLlmConfig
    ) {
      return false;
    }
    return true;
  });
  if (blocking) {
    return { text: `⚠ ${blocking.message}`, isWarning: true };
  }

  return renderSummaryTemplate(def?.summaryTemplate, config);
}

/** Truncates text to maxLen (default 40) with ellipsis. Returns whether truncation occurred. */
export function truncateSummary(
  text: string,
  maxLen = 40,
): { display: string; isTruncated: boolean } {
  if (text.length <= maxLen) return { display: text, isTruncated: false };
  return { display: text.slice(0, maxLen - 1) + "…", isTruncated: true };
}
