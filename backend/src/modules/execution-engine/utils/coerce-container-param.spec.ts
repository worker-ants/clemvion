import {
  coerceContainerBoolean,
  coerceContainerNumber,
  coerceContainerNumberOptional,
  coerceErrorPolicy,
} from './coerce-container-param';

describe('coerceContainerNumber', () => {
  it('passes through finite numbers', () => {
    expect(coerceContainerNumber(3, 'count', 'loop')).toBe(3);
    expect(coerceContainerNumber(0, 'count', 'loop')).toBe(0);
    expect(coerceContainerNumber(-2, 'count', 'loop')).toBe(-2);
    expect(coerceContainerNumber(1.5, 'count', 'loop')).toBe(1.5);
  });

  it('parses finite numeric strings (post-resolver may keep "3" as string)', () => {
    expect(coerceContainerNumber('3', 'count', 'loop')).toBe(3);
    expect(coerceContainerNumber('  10  ', 'count', 'loop')).toBe(10);
    expect(coerceContainerNumber('-2.5', 'count', 'loop')).toBe(-2.5);
  });

  it('throws for unresolved {{ ... }} expression strings', () => {
    expect(() => coerceContainerNumber('{{3}}', 'count', 'loop')).toThrow(
      /INVALID_CONTAINER_PARAM.*loop\.count.*unresolved expression/,
    );
    expect(() =>
      coerceContainerNumber('{{ $var.n }}', 'count', 'loop'),
    ).toThrow(/unresolved expression/);
    expect(() =>
      coerceContainerNumber('prefix {{x}} suffix', 'count', 'loop'),
    ).toThrow(/unresolved expression/);
  });

  it('throws for empty strings', () => {
    expect(() => coerceContainerNumber('', 'count', 'loop')).toThrow(
      /empty string/,
    );
    expect(() => coerceContainerNumber('   ', 'count', 'loop')).toThrow(
      /empty string/,
    );
  });

  it('throws for non-numeric strings', () => {
    expect(() => coerceContainerNumber('abc', 'count', 'loop')).toThrow(
      /not a finite number/,
    );
  });

  it('throws for NaN / Infinity', () => {
    expect(() => coerceContainerNumber(NaN, 'count', 'loop')).toThrow(
      /not a finite number/,
    );
    expect(() => coerceContainerNumber(Infinity, 'count', 'loop')).toThrow(
      /not a finite number/,
    );
  });

  it('throws for non-numeric primitives and objects', () => {
    expect(() => coerceContainerNumber(undefined, 'count', 'loop')).toThrow();
    expect(() => coerceContainerNumber(null, 'count', 'loop')).toThrow();
    expect(() => coerceContainerNumber({}, 'count', 'loop')).toThrow();
    expect(() => coerceContainerNumber(true, 'count', 'loop')).toThrow();
  });

  it('error message includes node type, field name, and value for debugging', () => {
    try {
      coerceContainerNumber('{{$var.n}}', 'branchCount', 'parallel');
      fail('expected to throw');
    } catch (e) {
      const msg = (e as Error).message;
      expect(msg).toContain('parallel');
      expect(msg).toContain('branchCount');
      expect(msg).toContain('{{$var.n}}');
    }
  });
});

describe('coerceContainerNumberOptional', () => {
  it('returns undefined when value is undefined or null', () => {
    expect(
      coerceContainerNumberOptional(undefined, 'maxIterations', 'loop'),
    ).toBeUndefined();
    expect(
      coerceContainerNumberOptional(null, 'maxIterations', 'loop'),
    ).toBeUndefined();
  });

  it('delegates to coerceContainerNumber for all other inputs', () => {
    expect(coerceContainerNumberOptional(100, 'maxIterations', 'loop')).toBe(
      100,
    );
    expect(coerceContainerNumberOptional('250', 'maxIterations', 'loop')).toBe(
      250,
    );
    expect(() =>
      coerceContainerNumberOptional('{{x}}', 'maxIterations', 'loop'),
    ).toThrow(/unresolved expression/);
  });
});

describe('coerceContainerBoolean', () => {
  it('passes through booleans', () => {
    expect(coerceContainerBoolean(true, 'waitAll', 'parallel', false)).toBe(
      true,
    );
    expect(coerceContainerBoolean(false, 'waitAll', 'parallel', true)).toBe(
      false,
    );
  });

  it('returns default when value is undefined or null', () => {
    expect(coerceContainerBoolean(undefined, 'waitAll', 'parallel', true)).toBe(
      true,
    );
    expect(coerceContainerBoolean(null, 'waitAll', 'parallel', false)).toBe(
      false,
    );
  });

  it('parses "true"/"false" string literals', () => {
    expect(coerceContainerBoolean('true', 'waitAll', 'parallel', false)).toBe(
      true,
    );
    expect(coerceContainerBoolean('false', 'waitAll', 'parallel', true)).toBe(
      false,
    );
    expect(coerceContainerBoolean(' true ', 'waitAll', 'parallel', false)).toBe(
      true,
    );
  });

  it('throws for unresolved expression strings', () => {
    expect(() =>
      coerceContainerBoolean('{{$var.flag}}', 'waitAll', 'parallel', false),
    ).toThrow(/unresolved expression/);
  });

  it('throws for non-boolean strings (no truthy fallback)', () => {
    expect(() =>
      coerceContainerBoolean('yes', 'waitAll', 'parallel', false),
    ).toThrow(/not a boolean/);
    expect(() =>
      coerceContainerBoolean('1', 'waitAll', 'parallel', false),
    ).toThrow(/not a boolean/);
  });

  it('throws for non-boolean primitives and objects', () => {
    expect(() =>
      coerceContainerBoolean(0, 'waitAll', 'parallel', false),
    ).toThrow(/not a boolean/);
    expect(() =>
      coerceContainerBoolean({}, 'waitAll', 'parallel', false),
    ).toThrow(/not a boolean/);
  });
});

describe('coerceErrorPolicy', () => {
  it('passes through valid enum values', () => {
    expect(coerceErrorPolicy('stop', 'errorPolicy', 'foreach', 'stop')).toBe(
      'stop',
    );
    expect(coerceErrorPolicy('skip', 'errorPolicy', 'foreach', 'stop')).toBe(
      'skip',
    );
    expect(
      coerceErrorPolicy('continue', 'errorPolicy', 'foreach', 'stop'),
    ).toBe('continue');
  });

  it('trims whitespace before matching', () => {
    expect(
      coerceErrorPolicy('  skip  ', 'errorPolicy', 'foreach', 'stop'),
    ).toBe('skip');
  });

  it('returns default when value is undefined or null', () => {
    expect(coerceErrorPolicy(undefined, 'errorPolicy', 'foreach', 'stop')).toBe(
      'stop',
    );
    expect(coerceErrorPolicy(null, 'errorPolicy', 'foreach', 'continue')).toBe(
      'continue',
    );
  });

  it('throws for unresolved expression strings', () => {
    expect(() =>
      coerceErrorPolicy('{{$var.policy}}', 'errorPolicy', 'foreach', 'stop'),
    ).toThrow(/unresolved expression/);
  });

  it('throws for invalid string values (no silent default)', () => {
    expect(() =>
      coerceErrorPolicy('crash', 'errorPolicy', 'foreach', 'stop'),
    ).toThrow(/not a valid error policy/);
    // Empty string is rejected too — trimmed empty is not in enum.
    expect(() =>
      coerceErrorPolicy('', 'errorPolicy', 'foreach', 'stop'),
    ).toThrow(/not a valid error policy/);
  });

  it('throws for non-string primitives and objects', () => {
    expect(() =>
      coerceErrorPolicy(1, 'errorPolicy', 'foreach', 'stop'),
    ).toThrow(/not a valid error policy/);
    expect(() =>
      coerceErrorPolicy(true, 'errorPolicy', 'foreach', 'stop'),
    ).toThrow(/not a valid error policy/);
    expect(() =>
      coerceErrorPolicy({}, 'errorPolicy', 'foreach', 'stop'),
    ).toThrow(/not a valid error policy/);
  });
});
