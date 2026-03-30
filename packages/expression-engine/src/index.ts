/**
 * @workflow/expression-engine
 *
 * Expression language parser and evaluator.
 * Implements the spec defined in spec/5-system/5-expression-language.md
 *
 * Usage:
 *   import { evaluate } from '@workflow/expression-engine';
 *   const result = evaluate('{{ $input.name }}', context);
 */

// Placeholder exports - will be implemented in Stage 5
export interface ExpressionContext {
  $input?: Record<string, unknown>;
  $node?: Record<string, { output: unknown }>;
  $var?: Record<string, unknown>;
  $execution?: {
    id: string;
    startedAt: string;
    mode: string;
    workflowId: string;
  };
  $now?: string;
  $today?: string;
  $env?: Record<string, string>;
  $loop?: {
    index: number;
    iteration: number;
    isFirst: boolean;
    isLast: boolean;
  };
  $item?: unknown;
  $itemIndex?: number;
  $trigger?: Record<string, unknown>;
}

export function evaluate(
  template: string,
  _context: ExpressionContext,
): unknown {
  // Placeholder - returns template as-is
  return template;
}

export function validate(
  template: string,
): { valid: boolean; errors: string[] } {
  // Placeholder - always valid
  return { valid: true, errors: [] };
}
