import type {
  NodeHandler,
  ValidationResult,
  ExecutionContext,
} from '../node-handler.interface';

export class ManualTriggerHandler implements NodeHandler {
  validate(config: Record<string, unknown>): ValidationResult {
    void config;
    return { valid: true, errors: [] };
  }

  execute(
    input: unknown,
    config: Record<string, unknown>,
    context: ExecutionContext,
  ): Promise<unknown> {
    void config;
    void context;
    return Promise.resolve({ config: {}, output: input });
  }
}
