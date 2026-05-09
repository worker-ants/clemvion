import {
  PRESENTATION_MAX_BYTES,
  truncateArrayForOutput,
  truncateBodyForOutput,
} from './truncate-body.util.js';

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

describe('truncateArrayForOutput', () => {
  it('exposes 1MB cap as PRESENTATION_MAX_BYTES', () => {
    expect(PRESENTATION_MAX_BYTES).toBe(1024 * 1024);
  });

  it('passes through arrays under the cap unchanged', () => {
    const arr = [{ a: 1 }, { a: 2 }, { a: 3 }];
    const result = truncateArrayForOutput(arr, 1024);
    expect(result.value).toBe(arr);
    expect(result.truncated).toBe(false);
    expect(result.originalLength).toBe(3);
  });

  it('passes through empty arrays unchanged', () => {
    const result = truncateArrayForOutput([] as unknown[], 1024);
    expect(result.value).toEqual([]);
    expect(result.truncated).toBe(false);
    expect(result.originalLength).toBe(0);
  });

  it('truncates from the tail when JSON serialization exceeds maxBytes', () => {
    // 100 items × ~30 bytes ≈ 3KB serialized. Cap at 1KB → ~33 items kept.
    const arr = Array.from({ length: 100 }, (_, i) => ({
      idx: i,
      label: 'row',
    }));
    const result = truncateArrayForOutput(arr, 1024);
    expect(result.truncated).toBe(true);
    expect(result.originalLength).toBe(100);
    expect(result.value.length).toBeLessThan(100);
    expect(result.value.length).toBeGreaterThan(0);
    // Surviving slice must serialize within the budget.
    expect(
      Buffer.byteLength(JSON.stringify(result.value), 'utf8'),
    ).toBeLessThanOrEqual(1024);
    // Tail-drop semantics: the kept prefix matches the original head.
    for (let i = 0; i < result.value.length; i++) {
      expect((result.value[i] as { idx: number }).idx).toBe(i);
    }
  });

  it('returns shape-preserving array (downstream ForEach / Map keep working)', () => {
    const arr = Array.from({ length: 1000 }, (_, i) => ({
      i,
      payload: 'x'.repeat(10000),
    }));
    const result = truncateArrayForOutput(arr, PRESENTATION_MAX_BYTES);
    // Even when truncated, value must remain an Array — not a string snippet
    // (truncateBodyForOutput's behaviour).
    expect(Array.isArray(result.value)).toBe(true);
  });

  it('returns empty array (truncated:false) when input is not an array', () => {
    const result = truncateArrayForOutput('not an array' as never, 1024);
    expect(result.value).toEqual([]);
    expect(result.truncated).toBe(false);
  });

  it('falls back gracefully when individual elements are unserializable', () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    const arr = [{ ok: 1 }, { ok: 2 }, cyclic, { ok: 3 }];
    const result = truncateArrayForOutput(arr, 1024);
    // Cyclic element makes the prefix unserializable past index 1, so the
    // binary search converges on the largest serializable prefix.
    expect(result.truncated).toBe(true);
    expect(result.originalLength).toBe(4);
    // The kept prefix must JSON.stringify cleanly.
    expect(() => JSON.stringify(result.value)).not.toThrow();
  });
});
