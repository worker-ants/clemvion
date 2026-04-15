import { ZodSchema } from 'zod';
import { ValidationResult } from './node-component.interface';

/**
 * Build a NodeHandler.validate() implementation from a Zod schema.
 * Returns a function matching the NodeHandler interface.
 */
export function validateWithZod<T>(
  schema: ZodSchema<T>,
): (config: Record<string, unknown>) => ValidationResult {
  return (config: Record<string, unknown>): ValidationResult => {
    const result = schema.safeParse(config);
    if (result.success) {
      return { valid: true, errors: [] };
    }
    const errors = result.error.issues.map((issue) => {
      const path = issue.path.join('.');
      return path ? `${path}: ${issue.message}` : issue.message;
    });
    return { valid: false, errors };
  };
}
