import {
  NodeHandler,
  ValidationResult,
  ExecutionContext,
} from '../node-handler.interface.js';

interface WorkflowConfig {
  workflowId: string;
  mode: 'sync' | 'async';
  inputMapping?: Record<string, string>;
}

export class WorkflowHandler implements NodeHandler {
  validate(config: Record<string, unknown>): ValidationResult {
    const errors: string[] = [];
    const { workflowId, mode } = config as unknown as WorkflowConfig;

    if (!workflowId || typeof workflowId !== 'string') {
      errors.push('workflowId is required and must be a string');
    }

    if (mode && mode !== 'sync' && mode !== 'async') {
      errors.push('mode must be "sync" or "async"');
    }

    return { valid: errors.length === 0, errors };
  }

  async execute(
    _input: unknown,
    config: Record<string, unknown>,
    _context: ExecutionContext,
  ): Promise<unknown> {
    const { workflowId, mode = 'sync' } = config as unknown as WorkflowConfig;

    return {
      workflowId,
      mode,
      status: 'not_implemented',
    };
  }
}
