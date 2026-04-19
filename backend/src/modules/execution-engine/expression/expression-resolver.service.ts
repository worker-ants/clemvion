import { Injectable, Logger } from '@nestjs/common';
import {
  evaluate,
  ExpressionContext as EngineContext,
  buildDisambiguatedKeys,
} from '@workflow/expression-engine';
import { ExecutionContext } from '../../../nodes/core/node-handler.interface';
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
    // Build $node label-to-output map with disambiguation and UUID fallback.
    // Note: nodeMap must be ordered by topological sort (execution order) for
    // deterministic #N suffix assignment in buildDisambiguatedKeys. The
    // engine populates `structuredOutputCache` via the runtime path; test
    // fixtures that only pre-seed `nodeOutputCache` (no structured entry)
    // fall back to a `{ output: flat }` shim so expressions can still
    // resolve `$node["X"].output.field`.
    const $node: Record<string, Record<string, unknown>> = {};

    const nodesWithOutput: Array<{ id: string; label: string }> = [];
    for (const [nodeId, node] of nodeMap) {
      if (executionContext.nodeOutputCache[nodeId] !== undefined) {
        nodesWithOutput.push({ id: nodeId, label: node.label });
      }
    }

    const structured = executionContext.structuredOutputCache ?? {};
    const disambiguatedKeys = buildDisambiguatedKeys(nodesWithOutput);
    for (const [nodeId] of nodeMap) {
      const flat = executionContext.nodeOutputCache[nodeId];
      if (flat === undefined) continue;

      const adapted = structured[nodeId];
      const entry: Record<string, unknown> = adapted
        ? {
            config: adapted.config ?? {},
            output: adapted.output,
            ...(adapted.meta !== undefined ? { meta: adapted.meta } : {}),
            ...(adapted.port !== undefined ? { port: adapted.port } : {}),
            ...(adapted.status !== undefined ? { status: adapted.status } : {}),
          }
        : { output: flat };

      const resolvedKey = disambiguatedKeys.get(nodeId)!;
      $node[resolvedKey] = entry;
      // UUID fallback: always accessible by node ID
      $node[nodeId] = entry;
    }

    const now = new Date();

    const inputObject = (nodeInput ?? {}) as Record<string, unknown>;
    const paramsFromInput =
      inputObject &&
      typeof inputObject === 'object' &&
      inputObject.parameters &&
      typeof inputObject.parameters === 'object' &&
      !Array.isArray(inputObject.parameters)
        ? (inputObject.parameters as Record<string, unknown>)
        : {};

    return {
      $input: inputObject,
      $params: paramsFromInput,
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
      if (typeof result === 'string') return result;
      if (result === null || result === undefined) return '';
      if (typeof result === 'object') return JSON.stringify(result);
      if (typeof result === 'number' || typeof result === 'boolean') {
        return result.toString();
      }
      return `${result as string}`;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Expression error in config.${path}: ${message}`);
    }
  }
}
