import { Injectable, Logger } from '@nestjs/common';
import {
  evaluate,
  ExpressionContext as EngineContext,
} from '@workflow/expression-engine';
import { ExecutionContext } from '../handlers/node-handler.interface';
import { Node } from '../../nodes/entities/node.entity';
import { EXPRESSION_EXCLUSIONS } from './expression-exclusions';

const EXPRESSION_PATTERN = /\{\{/;
const FULL_EXPRESSION_PATTERN = /^\s*\{\{(.+)\}\}\s*$/s;
const MAX_DEPTH = 10;

@Injectable()
export class ExpressionResolverService {
  private readonly logger = new Logger(ExpressionResolverService.name);

  /**
   * Build the expression context from execution state.
   */
  buildExpressionContext(
    nodeInput: unknown,
    executionContext: ExecutionContext,
    nodeMap: Map<string, Node>,
    executionMeta?: { startedAt?: string; mode?: string },
  ): EngineContext {
    // Build $node label-to-output map
    const $node: Record<string, { output: unknown }> = {};
    for (const [nodeId, node] of nodeMap) {
      const output = executionContext.nodeOutputCache[nodeId];
      if (output !== undefined) {
        $node[node.label] = { output };
      }
    }

    const now = new Date();

    return {
      $input: (nodeInput ?? {}) as Record<string, unknown>,
      $node,
      $var: executionContext.variables ?? {},
      $execution: {
        id: executionContext.executionId,
        workflowId: executionContext.workflowId,
        startedAt: executionMeta?.startedAt ?? now.toISOString(),
        mode: executionMeta?.mode ?? 'manual',
      },
      $now: now.toISOString(),
      $today: now.toISOString().split('T')[0],
      $loop: executionContext.loopContext
        ? {
            index: executionContext.loopContext.index,
            iteration: executionContext.loopContext.index + 1,
            isFirst: executionContext.loopContext.isFirst,
            isLast: executionContext.loopContext.isLast,
          }
        : undefined,
      $item: executionContext.itemContext?.item,
      $itemIndex: executionContext.itemContext?.index,
    };
  }

  /**
   * Resolve expressions in a config object.
   * Recursively walks the config and evaluates {{ }} patterns in string values.
   */
  resolveConfig(
    config: Record<string, unknown>,
    exprContext: EngineContext,
    nodeType?: string,
  ): Record<string, unknown> {
    const excludeKeys = nodeType ? EXPRESSION_EXCLUSIONS[nodeType] : undefined;
    return this.resolveObject(config, exprContext, excludeKeys, '', 0);
  }

  private resolveObject(
    obj: Record<string, unknown>,
    ctx: EngineContext,
    excludeKeys: Set<string> | undefined,
    path: string,
    depth: number,
  ): Record<string, unknown> {
    if (depth > MAX_DEPTH) {
      this.logger.warn(
        `Expression resolver exceeded max depth (${MAX_DEPTH}) at path "${path}". Config values beyond this depth are not resolved.`,
      );
      return obj;
    }

    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      const fieldPath = path ? `${path}.${key}` : key;

      if (excludeKeys?.has(key)) {
        result[key] = value;
        continue;
      }

      result[key] = this.resolveValue(
        value,
        ctx,
        excludeKeys,
        fieldPath,
        depth,
      );
    }
    return result;
  }

  private resolveValue(
    value: unknown,
    ctx: EngineContext,
    excludeKeys: Set<string> | undefined,
    path: string,
    depth: number,
  ): unknown {
    if (value === null || value === undefined) return value;

    if (typeof value === 'string') {
      return this.resolveString(value, ctx, path);
    }

    if (Array.isArray(value)) {
      return value.map((item, i) =>
        this.resolveValue(item, ctx, excludeKeys, `${path}[${i}]`, depth),
      );
    }

    if (typeof value === 'object') {
      return this.resolveObject(
        value as Record<string, unknown>,
        ctx,
        excludeKeys,
        path,
        depth + 1,
      );
    }

    // number, boolean — pass through
    return value;
  }

  private resolveString(
    value: string,
    ctx: EngineContext,
    path: string,
  ): unknown {
    if (!EXPRESSION_PATTERN.test(value)) return value;

    try {
      const result = evaluate(value, ctx);

      // If the entire value is a single expression, preserve the evaluated type
      if (FULL_EXPRESSION_PATTERN.test(value)) {
        return result;
      }

      // Mixed text + expression: always coerce to string
      return typeof result === 'string' ? result : String(result ?? '');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Expression error in config.${path}: ${message}`);
    }
  }
}
