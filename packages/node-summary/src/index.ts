/**
 * @workflow/node-summary
 *
 * SSOT for node config warnings and summary templates. Used by both the
 * frontend canvas (⚠️ badge on a node card) and the backend
 * `handler.validate()` / assistant `WORKFLOW_REVIEW_REQUIRED` review.
 *
 * Usage (backend, inside a node handler):
 *
 *   import { evaluateWarnings } from '@workflow/node-summary';
 *   const errors = evaluateWarnings(config, this.metadata.warningRules)
 *     .filter((w) => w.severity === 'blocking')
 *     .map((w) => w.message);
 *
 * Usage (frontend, inside the canvas summary helper):
 *
 *   import { evaluateWarnings, renderSummaryTemplate } from '@workflow/node-summary';
 *   const warnings = evaluateWarnings(config, def.metadata.warningRules);
 *   const blocking = warnings.find((w) => w.severity === 'blocking');
 *   if (blocking) return { text: `⚠ ${blocking.message}`, isWarning: true };
 *   return renderSummaryTemplate(def.metadata.summaryTemplate, config);
 */

export {
  WarningRule,
  WarningSeverity,
  EvaluatedWarning,
  SummaryTemplateSpec,
  NodeConfig,
} from './types';
export {
  evaluateWhen,
  evaluateWarnings,
  renderTemplate,
  renderSummaryTemplate,
  RenderedSummary,
} from './evaluator';
