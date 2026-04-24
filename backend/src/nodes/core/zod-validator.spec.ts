import { z } from 'zod';
import { validateWithZod } from './zod-validator';

describe('validateWithZod', () => {
  const schema = z.object({
    name: z.string().min(1),
    age: z.number().int().optional(),
    nested: z.object({ field: z.string() }).optional(),
  });
  const validate = validateWithZod(schema);

  it('returns valid=true for a correct config', () => {
    const result = validate({ name: 'foo', age: 1 });
    expect(result).toEqual({ valid: true, errors: [] });
  });

  it('returns valid=false with field path for single violation', () => {
    const result = validate({ name: '' });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.startsWith('name:'))).toBe(true);
  });

  it('includes nested path segments joined by dot', () => {
    const result = validate({
      name: 'foo',
      nested: { field: 123 as unknown as string },
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.startsWith('nested.field:'))).toBe(true);
  });

  it('aggregates multiple issues', () => {
    const result = validate({ name: '', age: 'bad' });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });

  it('emits message without path when the root fails', () => {
    const rootSchema = z.number();
    const rootValidate = validateWithZod(rootSchema);
    const result = rootValidate(
      'not-a-number' as unknown as Record<string, unknown>,
    );
    expect(result.valid).toBe(false);
    expect(result.errors[0]).not.toMatch(/^:/);
  });
});
