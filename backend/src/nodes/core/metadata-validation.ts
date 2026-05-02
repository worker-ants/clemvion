import { evaluateWarnings } from '@workflow/node-summary';
import type { NodeComponentMetadata } from './node-component.interface';

/**
 * Evaluate every warning declared on a node component's metadata against a
 * concrete `config` and return the resulting Korean messages.
 *
 * SSOT bridge — both surfaces ultimately call this:
 *   - Backend `handler.validate()` (each node's handler) wires this into its
 *     `errors` array, which the assistant's
 *     `add_node` / `update_node` tool result surfaces as `configWarnings` and
 *     the `WORKFLOW_REVIEW_REQUIRED` review checks for `NODE_CONFIG_WARNINGS`.
 *   - Frontend `getConfigSummary()` (canvas card) calls
 *     `evaluateWarnings()` directly on the same `metadata.warningRules`
 *     shipped via `GET /nodes/definitions` and renders the ⚠️ badge.
 *
 * Result ordering matches the order rules are declared on the schema —
 * authors get to control the priority of which message wins on a single-line
 * canvas badge.
 *
 * Both `warningRules` and `validateConfig` are merged. `warningRules` first
 * (declarative, ported from the SSOT), then `validateConfig` (imperative
 * escape hatch for cross-field business logic the mini-DSL can't express).
 *
 * Severity:
 *   - `blocking` (default) → caller treats the entry as a hard error and
 *     surfaces it through the assistant review gate.
 *   - `advisory` → caller may keep it out of the gate but still display it
 *     to the user. The current backend handler.validate contract returns a
 *     flat `string[]`, so this helper offers the convenience of pre-filtering
 *     to blocking-only via {@link evaluateMetadataBlockingErrors}.
 */
export function evaluateMetadataValidation(
  metadata: Pick<
    NodeComponentMetadata,
    'warningRules' | 'validateConfig' | 'type'
  >,
  config: unknown,
): { id: string; message: string; severity: 'blocking' | 'advisory' }[] {
  const declarative = evaluateWarnings(
    config as Record<string, unknown> | undefined | null,
    metadata.warningRules,
  );
  const imperative = (metadata.validateConfig?.(config) ?? []).map(
    (message, idx) => ({
      // Anonymous ids are fine — the diagnostic value lives in the message,
      // and stable ids matter only for declarative rules where a test or a
      // dashboard wants to assert "this specific rule fired".
      id: `${metadata.type ?? 'node'}:imperative-${idx}`,
      message,
      severity: 'blocking' as const,
    }),
  );
  return [...declarative, ...imperative];
}

/**
 * Convenience wrapper: returns just the blocking messages as the flat
 * `string[]` shape that the existing `NodeHandler.validate(config).errors`
 * contract expects. Most node handlers will compose their `validate()` like:
 *
 *   validate(config) {
 *     return {
 *       isValid: errors.length === 0,
 *       errors: [
 *         ...evaluateMetadataBlockingErrors(this.metadata, config),
 *         ...this.legacyDomainChecks(config), // residual handler-only rules
 *       ],
 *     };
 *   }
 *
 * Advisory warnings are deliberately dropped from this flat array — they
 * surface through the frontend canvas badge but never block the assistant
 * gate. If a rule should block, mark it `severity: 'blocking'` (or omit
 * `severity` to take the default).
 */
export function evaluateMetadataBlockingErrors(
  metadata: Pick<
    NodeComponentMetadata,
    'warningRules' | 'validateConfig' | 'type'
  >,
  config: unknown,
): string[] {
  return evaluateMetadataValidation(metadata, config)
    .filter((w) => w.severity === 'blocking')
    .map((w) => w.message);
}
