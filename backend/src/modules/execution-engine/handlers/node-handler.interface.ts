export interface ExecutionContext {
  executionId: string;
  workflowId: string;
  variables: Record<string, unknown>;
  nodeOutputCache: Record<string, unknown>;
  loopContext?: {
    index: number;
    count: number;
    isFirst: boolean;
    isLast: boolean;
  };
  itemContext?: {
    item: unknown;
    index: number;
    isFirst: boolean;
    isLast: boolean;
  };
  expressionContext?: Record<string, unknown>;
  recursionDepth?: number;
  /** Runtime state injected by ExecutionEngineService for sub-workflow inline execution */
  _executedNodes?: Set<string>;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface NodeHandler {
  validate(config: Record<string, unknown>): ValidationResult;
  execute(
    input: unknown,
    config: Record<string, unknown>,
    context: ExecutionContext,
  ): Promise<unknown>;
}
