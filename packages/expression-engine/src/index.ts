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

import { tokenize } from './tokenizer';
import { parse } from './parser';
import { Evaluator, ExpressionContext, EvalOptions } from './evaluator';
import { ExpressionError, ErrorCode } from './errors';

// Re-export types
export { ExpressionContext, EvalOptions } from './evaluator';
export { ExpressionError, ErrorCode } from './errors';
export type { ASTNode } from './ast';
export type { Token } from './tokens';
export { TokenType } from './tokens';

/**
 * Evaluate a template string with expression interpolation.
 *
 * @param template - The template string, e.g. `"Hello, {{ $input.name }}!"`
 * @param context - The expression context with built-in variables
 * @param options - Evaluation options (strictComparison, timeout, etc.)
 * @returns The evaluated result
 */
export function evaluate(
  template: string,
  context: ExpressionContext,
  options?: EvalOptions,
): unknown {
  const tokens = tokenize(template);
  const ast = parse(tokens);
  const evaluator = new Evaluator(context, options);
  return evaluator.evaluate(ast);
}

/**
 * Validate a template string for syntax errors without evaluating.
 *
 * @param template - The template string to validate
 * @returns An object with `valid` boolean and `errors` array
 */
export function validate(
  template: string,
): { valid: boolean; errors: ExpressionError[] } {
  try {
    const tokens = tokenize(template);
    parse(tokens);
    return { valid: true, errors: [] };
  } catch (e) {
    if (e instanceof ExpressionError) {
      return { valid: false, errors: [e] };
    }
    return {
      valid: false,
      errors: [new ExpressionError(ErrorCode.EXPR_SYNTAX_ERROR, (e as Error).message)],
    };
  }
}

// Also export lower-level APIs for advanced usage
export { tokenize } from './tokenizer';
export { parse } from './parser';
export { Evaluator } from './evaluator';
export { getFunction, hasFunction, getAllFunctionNames } from './functions';
