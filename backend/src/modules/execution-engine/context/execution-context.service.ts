import { Injectable } from '@nestjs/common';
import { ExecutionContext } from '../handlers/node-handler.interface';

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
  ): ExecutionContext {
    const context: ExecutionContext = {
      executionId,
      workflowId,
      variables: { ...initialVariables },
      nodeOutputCache: {},
    };
    this.contexts.set(executionId, context);
    return context;
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
