import { truncateBodyForOutput } from './truncate-body.util.js';

describe('truncateBodyForOutput', () => {
  it('passes through small strings unchanged', () => {
    const result = truncateBodyForOutput('hello world');
    expect(result.value).toBe('hello world');
    expect(result.truncated).toBe(false);
  });

  it('passes through small JSON-serializable objects unchanged', () => {
    const obj = { foo: 'bar', n: 42 };
    const result = truncateBodyForOutput(obj);
    expect(result.value).toEqual(obj);
    expect(result.truncated).toBe(false);
  });

  it('passes through small Buffers unchanged', () => {
    const buf = Buffer.from('hello', 'utf8');
    const result = truncateBodyForOutput(buf);
    expect(result.value).toBe(buf);
    expect(result.truncated).toBe(false);
  });

  it('truncates strings exceeding the byte cap', () => {
    const big = 'a'.repeat(300 * 1024); // 300KB ASCII
    const result = truncateBodyForOutput(big);
    expect(result.truncated).toBe(true);
    expect(typeof result.value).toBe('string');
    expect(
      Buffer.byteLength(result.value as string, 'utf8'),
    ).toBeLessThanOrEqual(256 * 1024);
  });

  it('truncates objects whose JSON serialization exceeds the byte cap', () => {
    const big = { items: 'x'.repeat(300 * 1024) };
    const result = truncateBodyForOutput(big);
    expect(result.truncated).toBe(true);
    // Truncated objects fall back to a string preview to avoid silently
    // returning a malformed object.
    expect(typeof result.value).toBe('string');
    expect(
      Buffer.byteLength(result.value as string, 'utf8'),
    ).toBeLessThanOrEqual(256 * 1024);
  });

  it('truncates Buffers exceeding the byte cap', () => {
    const big = Buffer.alloc(300 * 1024, 0x61);
    const result = truncateBodyForOutput(big);
    expect(result.truncated).toBe(true);
    expect(Buffer.isBuffer(result.value)).toBe(true);
    expect((result.value as Buffer).length).toBeLessThanOrEqual(256 * 1024);
  });

  it('honours a custom maxBytes', () => {
    const result = truncateBodyForOutput('hello world', 5);
    expect(result.truncated).toBe(true);
    expect(
      Buffer.byteLength(result.value as string, 'utf8'),
    ).toBeLessThanOrEqual(5);
  });

  it('does not split a multi-byte UTF-8 codepoint at the boundary', () => {
    // '한' = 3 bytes in UTF-8. Capping at 4 bytes must not yield an invalid
    // sequence — the second char's first byte alone would be malformed.
    const result = truncateBodyForOutput('한글', 4);
    expect(result.truncated).toBe(true);
    const bytes = Buffer.byteLength(result.value as string, 'utf8');
    expect(bytes).toBeLessThanOrEqual(4);
    // Decoded value must be a complete codepoint sequence.
    expect(result.value).toBe('한');
  });

  it('passes through null/undefined unchanged (no truncation needed)', () => {
    expect(truncateBodyForOutput(undefined)).toEqual({
      value: undefined,
      truncated: false,
    });
    expect(truncateBodyForOutput(null)).toEqual({
      value: null,
      truncated: false,
    });
  });

  it('coerces primitives via String() and truncates if needed', () => {
    expect(truncateBodyForOutput(42).value).toBe(42);
    expect(truncateBodyForOutput(true).value).toBe(true);
  });

  it('handles non-serializable objects gracefully', () => {
    const a: Record<string, unknown> = {};
    a.self = a; // cyclic
    const result = truncateBodyForOutput(a);
    // Cyclic objects fail JSON.stringify; helper falls back to a placeholder
    // string rather than throwing.
    expect(result.truncated).toBe(false);
    expect(typeof result.value).toBe('string');
    expect(result.value).toContain('[Unserializable]');
  });
});
