import {
  ExecutionContext,
  NodeHandler,
  ValidationResult,
} from '../node-handler.interface.js';

const CODE_TIMEOUT_MS = 30_000;

export class CodeHandler implements NodeHandler {
  validate(config: Record<string, unknown>): ValidationResult {
    const errors: string[] = [];

    if (!config.code || typeof config.code !== 'string') {
      errors.push('code is required and must be a string');
    }

    return { valid: errors.length === 0, errors };
  }

  async execute(
    input: unknown,
    config: Record<string, unknown>,
    context: ExecutionContext,
  ): Promise<unknown> {
    const code = config.code as string;

    try {
      const fn = new Function(
        '$input',
        '$vars',
        '$execution',
        `"use strict";\n${code}`,
      );

      const result = await Promise.race([
        Promise.resolve().then(() =>
          fn(input, context.variables, {
            executionId: context.executionId,
            workflowId: context.workflowId,
          }),
        ),
        new Promise((_resolve, reject) => {
          setTimeout(
            () => reject(new Error('Code execution timed out')),
            CODE_TIMEOUT_MS,
          );
        }),
      ]);

      return { success: true, result };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;

      return { success: false, error: message, stack };
    }
  }
}
