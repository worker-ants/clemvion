import { validateConfigExpressions } from './validate-expressions';

describe('validateConfigExpressions', () => {
  it('accepts configs without expressions', () => {
    const r = validateConfigExpressions({
      method: 'GET',
      timeout: 30,
      headers: { 'X-Trace': 'plain-string' },
    });
    expect(r.valid).toBe(true);
    expect(r.issues).toEqual([]);
  });

  it('accepts valid expression strings', () => {
    const r = validateConfigExpressions({
      subject: '{{ $input.name }}님께',
      cc: ['{{ $input.email }}', 'static@example.com'],
      body: 'Score: {{ $input.score >= 80 ? "pass" : "fail" }}',
    });
    expect(r.valid).toBe(true);
  });

  it('accepts optional chaining (added after the switchValue incident)', () => {
    const r = validateConfigExpressions({
      switchValue:
        '{{ $node["1depth 음식 종류"]?.output?.interaction?.data?.food_category }}',
    });
    expect(r.valid).toBe(true);
  });

  it('rejects nullish coalescing (??)', () => {
    const r = validateConfigExpressions({
      body: '{{ $input.name ?? "unknown" }}',
    });
    expect(r.valid).toBe(false);
    expect(r.issues[0].path).toBe('body');
    expect(r.issues[0].message).toMatch(/Unexpected|Expected/);
  });

  it('rejects arrow functions / method chains', () => {
    const r = validateConfigExpressions({
      body: '{{ $input.items.filter(x => x > 0) }}',
    });
    expect(r.valid).toBe(false);
    expect(r.issues[0].path).toBe('body');
  });

  it('rejects the unterminated expression that caused the original bug', () => {
    // 사용자가 보고한 실제 에러 재현 — `?.` 지원 전에는 이렇게 parsing 에서 실패
    const r = validateConfigExpressions({
      body: '{{ $input.foo ? }}',
    });
    expect(r.valid).toBe(false);
  });

  it('reports the deep path of the failing field', () => {
    const r = validateConfigExpressions({
      cases: [
        { id: 'case_yes', condition: '{{ $input.ok == true }}' },
        { id: 'case_no', condition: '{{ $input.count ?? 0 }}' },
      ],
    });
    expect(r.valid).toBe(false);
    expect(r.issues[0].path).toBe('cases[1].condition');
  });

  it('collects multiple issues from the same config', () => {
    const r = validateConfigExpressions({
      subject: '{{ $input.a ?? "x" }}',
      body: '{{ $input.items.map(x => x) }}',
      good: '{{ $input.ok }}',
    });
    expect(r.valid).toBe(false);
    expect(r.issues.length).toBeGreaterThanOrEqual(2);
    const paths = r.issues.map((i) => i.path);
    expect(paths).toContain('subject');
    expect(paths).toContain('body');
    expect(paths).not.toContain('good');
  });

  it('ignores null/undefined/number/boolean values', () => {
    const r = validateConfigExpressions({
      a: null,
      b: undefined,
      c: 42,
      d: true,
    });
    expect(r.valid).toBe(true);
  });
});
