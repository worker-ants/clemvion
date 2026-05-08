import { Injectable } from '@nestjs/common';
import {
  ExecutionContext,
  NodeHandlerOutput,
} from '../../../nodes/core/node-handler.interface';
import { wrapBareAsNodeHandlerOutput } from '../handler-output.adapter';

/**
 * Engine-internal alias that drops the public `Readonly` qualifier on
 * `engineResolvedConfigCache` so the cache can be populated through the
 * dedicated setter while handlers still see the read-only public shape.
 */
type MutableExecutionContext = Omit<
  ExecutionContext,
  'engineResolvedConfigCache'
> & {
  engineResolvedConfigCache?: Record<string, Record<string, unknown>>;
};

/**
 * In-memory execution context management for Phase 1.
 * In production, this would be backed by Redis.
 */
@Injectable()
export class ExecutionContextService {
  private readonly contexts = new Map<string, ExecutionContext>();

  createContext(
    executionId: string,
    workflowId: string,
    initialVariables: Record<string, unknown> = {},
    recursionDepth?: number,
  ): ExecutionContext {
    const context: ExecutionContext = {
      executionId,
      workflowId,
      variables: { ...initialVariables },
      nodeOutputCache: {},
      structuredOutputCache: {},
      engineResolvedConfigCache: {},
      recursionDepth: recursionDepth ?? 0,
    };
    this.contexts.set(executionId, context);
    return context;
  }

  setStructuredOutput(
    executionId: string,
    nodeId: string,
    adapted: NodeHandlerOutput,
  ): void {
    const context = this.contexts.get(executionId);
    if (!context) return;
    if (!context.structuredOutputCache) {
      context.structuredOutputCache = {};
    }
    context.structuredOutputCache[nodeId] = adapted;
  }

  /**
   * Store the expression-resolved (evaluated) config for a node so engine
   * paths (runContainerInner / runParallel) can read iteration parameters
   * without re-evaluating expressions. Separated from `structuredOutputCache`
   * which carries the handler's raw echo per CONVENTIONS Principle 7.
   *
   * Shallow-copies the input so callers can keep mutating their local
   * `resolvedConfig` reference without leaking changes into the cache.
   */
  setEngineResolvedConfig(
    executionId: string,
    nodeId: string,
    resolvedConfig: Record<string, unknown>,
  ): void {
    const context = this.contexts.get(executionId) as
      | MutableExecutionContext
      | undefined;
    if (!context) return;
    // `createContext` initialises the slot to `{}`, so the runtime guard
    // here is for hypothetical legacy contexts deserialised without it
    // (e.g. when this layer is moved to Redis). Cheap to keep; defends
    // against future plumbing regressions.
    if (!context.engineResolvedConfigCache) {
      context.engineResolvedConfigCache = {};
    }
    context.engineResolvedConfigCache[nodeId] = { ...resolvedConfig };
  }

  getContext(executionId: string): ExecutionContext | undefined {
    return this.contexts.get(executionId);
  }

  updateVariables(
    executionId: string,
    variables: Record<string, unknown>,
  ): void {
    const context = this.contexts.get(executionId);
    if (!context) {
      throw new Error(`Execution context not found: ${executionId}`);
    }
    Object.assign(context.variables, variables);
  }

  setNodeOutput(executionId: string, nodeId: string, output: unknown): void {
    const context = this.contexts.get(executionId);
    if (!context) {
      throw new Error(`Execution context not found: ${executionId}`);
    }
    context.nodeOutputCache[nodeId] = output;

    // Keep the structured view in sync so that expression resolution picks up
    // post-resume mutations (form submittedData, button click metadata,
    // multi-turn AI output, etc.). Engine paths that already call
    // `setStructuredOutput` with a richer NodeHandlerOutput will overwrite
    // this derivation afterwards.
    //
    // Use the lenient wrapper here — `setNodeOutput` receives already-flattened
    // engine output (post `toEngineFlatShape` / `applyPortSelection`), which is
    // intentionally bare (e.g. `{parameters: {}}`). Running the strict
    // `adaptHandlerReturn` on a bare object would throw in production, even
    // though the handler boundary at the call site already validated the
    // canonical shape moments earlier. Strict contract enforcement belongs at
    // the single handler-return boundary in execution-engine.service.ts, not
    // here.
    if (!context.structuredOutputCache) {
      context.structuredOutputCache = {};
    }
    const existing = context.structuredOutputCache[nodeId];
    const isCanonical =
      typeof output === 'object' &&
      output !== null &&
      !Array.isArray(output) &&
      'config' in (output as Record<string, unknown>) &&
      'output' in (output as Record<string, unknown>);
    const derived = isCanonical
      ? (output as NodeHandlerOutput)
      : wrapBareAsNodeHandlerOutput(output);
    context.structuredOutputCache[nodeId] = existing
      ? {
          // Preserve the echoed config from the handler's original return —
          // resume flows receive a flat merged object that doesn't include it.
          config: existing.config,
          output: derived.output,
          ...(derived.meta !== undefined || existing.meta !== undefined
            ? { meta: derived.meta ?? existing.meta }
            : {}),
          ...(derived.port !== undefined || existing.port !== undefined
            ? { port: derived.port ?? existing.port }
            : {}),
          ...(derived.status !== undefined || existing.status !== undefined
            ? { status: derived.status ?? existing.status }
            : {}),
        }
      : derived;
  }

  getNodeOutput(executionId: string, nodeId: string): unknown {
    const context = this.contexts.get(executionId);
    if (!context) {
      throw new Error(`Execution context not found: ${executionId}`);
    }
    return context.nodeOutputCache[nodeId];
  }

  deleteContext(executionId: string): void {
    this.contexts.delete(executionId);
  }
}
