import { Injectable } from '@nestjs/common';
import {
  ExecutionContext,
  NodeHandlerOutput,
} from '../../../nodes/core/node-handler.interface';
import { adaptHandlerReturn } from '../handler-output.adapter';

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
    if (!context.structuredOutputCache) {
      context.structuredOutputCache = {};
    }
    const existing = context.structuredOutputCache[nodeId];
    const derived = adaptHandlerReturn(output);
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
