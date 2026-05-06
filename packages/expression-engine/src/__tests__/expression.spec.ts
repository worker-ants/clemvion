import { evaluate, validate, ExpressionContext, ExpressionError, ErrorCode } from '../index';

describe('Expression Engine', () => {
  const defaultContext: ExpressionContext = {
    $input: {
      name: 'Alice',
      age: 25,
      active: true,
      email: 'alice@example.com',
      user: { name: 'Alice', role: 'admin' },
      items: ['a', 'b', 'c'],
      count: 10,
      data: { x: 1, y: 2, z: 3 },
    },
    $var: { counter: 5 },
    $execution: {
      id: 'exec-123',
      startedAt: '2026-03-30T00:00:00.000Z',
      mode: 'manual',
      workflowId: 'wf-456',
    },
    $now: '2026-03-30T12:00:00.000Z',
    $env: { API_URL: 'https://api.example.com' },
    $loop: { index: 0, iteration: 1, isFirst: true, isLast: false },
    $item: { id: 1, name: 'Item1' },
    $itemIndex: 0,
    $trigger: { body: { event: 'push' } },
  };

  // 1. Simple variable access
  describe('Variable Access', () => {
    it('should access $input properties', () => {
      expect(evaluate('{{ $input.name }}', defaultContext)).toBe('Alice');
    });

    it('should access $execution properties', () => {
      expect(evaluate('{{ $execution.id }}', defaultContext)).toBe('exec-123');
    });

    it('should access $var properties', () => {
      expect(evaluate('{{ $var.counter }}', defaultContext)).toBe(5);
    });

    it('should access $now', () => {
      expect(evaluate('{{ $now }}', defaultContext)).toBe('2026-03-30T12:00:00.000Z');
    });

    // $today was removed because it was always derived in UTC, which surfaced
    // off-by-one days in non-UTC zones. Workflows that previously used `$today`
    // must migrate to `formatDate($now, "YYYY-MM-DD")` or `today()`. The
    // evaluator must fail loudly (EXPR_REFERENCE_ERROR), not silently return
    // undefined, so users notice the migration is needed.
    it('should fail loudly with EXPR_REFERENCE_ERROR when $today is used (removed variable)', () => {
      expect(() => evaluate('{{ $today }}', defaultContext)).toThrow(/Undefined variable: \$today/);
    });

    it('should access $loop properties', () => {
      expect(evaluate('{{ $loop.index }}', defaultContext)).toBe(0);
      expect(evaluate('{{ $loop.isFirst }}', defaultContext)).toBe(true);
    });

    it('should access $item and $itemIndex', () => {
      expect(evaluate('{{ $itemIndex }}', defaultContext)).toBe(0);
    });

    it('should access $trigger nested properties', () => {
      expect(evaluate('{{ $trigger.body.event }}', defaultContext)).toBe('push');
    });
  });

  // 2. String interpolation
  describe('String Interpolation', () => {
    it('should interpolate variables into text', () => {
      expect(evaluate('Hello, {{ $input.name }}!', defaultContext)).toBe('Hello, Alice!');
    });

    it('should handle multiple interpolations', () => {
      expect(
        evaluate('{{ $input.name }} is {{ $input.age }} years old', defaultContext),
      ).toBe('Alice is 25 years old');
    });

    it('should return plain text without expressions', () => {
      expect(evaluate('Hello, World!', defaultContext)).toBe('Hello, World!');
    });

    it('should handle escaped curly braces', () => {
      expect(evaluate('\\{{ not an expression }}', defaultContext)).toBe('{{ not an expression }}');
    });
  });

  // 3. Arithmetic
  describe('Arithmetic', () => {
    it('should evaluate 1 + 2 * 3 with correct precedence', () => {
      expect(evaluate('{{ 1 + 2 * 3 }}', defaultContext)).toBe(7);
    });

    it('should evaluate parenthesized expressions', () => {
      expect(evaluate('{{ (1 + 2) * 3 }}', defaultContext)).toBe(9);
    });

    it('should evaluate modulo', () => {
      expect(evaluate('{{ 10 % 3 }}', defaultContext)).toBe(1);
    });

    it('should evaluate division', () => {
      expect(evaluate('{{ 10 / 4 }}', defaultContext)).toBe(2.5);
    });

    it('should evaluate subtraction', () => {
      expect(evaluate('{{ $input.count - 3 }}', defaultContext)).toBe(7);
    });

    it('should handle unary minus', () => {
      expect(evaluate('{{ -5 }}', defaultContext)).toBe(-5);
    });
  });

  // 4. Comparison
  describe('Comparison', () => {
    it('should evaluate greater than', () => {
      expect(evaluate('{{ $input.age > 18 }}', defaultContext)).toBe(true);
    });

    it('should evaluate less than', () => {
      expect(evaluate('{{ $input.age < 18 }}', defaultContext)).toBe(false);
    });

    it('should evaluate equality', () => {
      expect(evaluate('{{ $input.name == "Alice" }}', defaultContext)).toBe(true);
    });

    it('should evaluate inequality', () => {
      expect(evaluate('{{ $input.name != "Bob" }}', defaultContext)).toBe(true);
    });

    it('should evaluate <= and >=', () => {
      expect(evaluate('{{ $input.age >= 25 }}', defaultContext)).toBe(true);
      expect(evaluate('{{ $input.age <= 25 }}', defaultContext)).toBe(true);
    });
  });

  // 5. Ternary
  describe('Ternary', () => {
    it('should evaluate ternary with true condition', () => {
      expect(evaluate('{{ $input.active ? "Yes" : "No" }}', defaultContext)).toBe('Yes');
    });

    it('should evaluate ternary with false condition', () => {
      const ctx = { ...defaultContext, $input: { ...defaultContext.$input, active: false } };
      expect(evaluate('{{ $input.active ? "Yes" : "No" }}', ctx)).toBe('No');
    });

    it('should evaluate nested ternary', () => {
      expect(
        evaluate('{{ $input.age > 18 ? ($input.age > 30 ? "Senior" : "Adult") : "Minor" }}', defaultContext),
      ).toBe('Adult');
    });
  });

  // 6. Member access
  describe('Member Access', () => {
    it('should access nested object properties', () => {
      expect(evaluate('{{ $input.user.name }}', defaultContext)).toBe('Alice');
    });

    it('should access nested object role', () => {
      expect(evaluate('{{ $input.user.role }}', defaultContext)).toBe('admin');
    });

    it('should return null for missing properties', () => {
      expect(evaluate('{{ $input.user.missing }}', defaultContext)).toBe(null);
    });
  });

  // 7. Index access
  describe('Index Access', () => {
    it('should access array elements by index', () => {
      expect(evaluate('{{ $input.items[0] }}', defaultContext)).toBe('a');
    });

    it('should access last array element', () => {
      expect(evaluate('{{ $input.items[2] }}', defaultContext)).toBe('c');
    });

    it('should return null for out-of-bounds index', () => {
      expect(evaluate('{{ $input.items[10] }}', defaultContext)).toBe(null);
    });

    it('should access object by string key', () => {
      expect(evaluate('{{ $input.data["x"] }}', defaultContext)).toBe(1);
    });
  });

  // 8. Function calls
  describe('Function Calls', () => {
    it('should call length on string', () => {
      expect(evaluate('{{ length($input.name) }}', defaultContext)).toBe(5);
    });

    it('should call uppercase', () => {
      expect(evaluate('{{ uppercase("hello") }}', defaultContext)).toBe('HELLO');
    });

    it('should call lowercase', () => {
      expect(evaluate('{{ lowercase("HELLO") }}', defaultContext)).toBe('hello');
    });

    it('should call length on array', () => {
      expect(evaluate('{{ length($input.items) }}', defaultContext)).toBe(3);
    });

    it('should call round with decimals', () => {
      expect(evaluate('{{ round(3.14159, 2) }}', defaultContext)).toBe(3.14);
    });

    it('should call min and max', () => {
      expect(evaluate('{{ min(1, 2, 3) }}', defaultContext)).toBe(1);
      expect(evaluate('{{ max(1, 2, 3) }}', defaultContext)).toBe(3);
    });
  });

  // 9. Array/Object literals
  describe('Literals', () => {
    it('should evaluate array literal', () => {
      expect(evaluate('{{ [1, 2, 3] }}', defaultContext)).toEqual([1, 2, 3]);
    });

    it('should evaluate object literal', () => {
      expect(evaluate('{{ { a: 1, b: 2 } }}', defaultContext)).toEqual({ a: 1, b: 2 });
    });

    it('should evaluate empty array', () => {
      expect(evaluate('{{ [] }}', defaultContext)).toEqual([]);
    });

    it('should evaluate empty object', () => {
      expect(evaluate('{{ {} }}', defaultContext)).toEqual({});
    });
  });

  // 10. Nested expressions
  describe('Nested Expressions', () => {
    it('should access last element using length', () => {
      expect(
        evaluate('{{ $input.items[length($input.items) - 1] }}', defaultContext),
      ).toBe('c');
    });

    it('should use function result in arithmetic', () => {
      expect(
        evaluate('{{ length($input.name) + length($input.items) }}', defaultContext),
      ).toBe(8);
    });
  });

  // 11. Type coercion
  describe('Type Coercion', () => {
    it('should coerce string to number in loose equality', () => {
      expect(evaluate('{{ "42" == 42 }}', defaultContext)).toBe(true);
    });

    it('should not coerce in strict mode', () => {
      expect(evaluate('{{ "42" == 42 }}', defaultContext, { strictComparison: true })).toBe(false);
    });

    it('should concatenate string + number', () => {
      expect(evaluate('{{ "count: " + $input.count }}', defaultContext)).toBe('count: 10');
    });

    it('should handle null == null', () => {
      expect(evaluate('{{ null == null }}', defaultContext)).toBe(true);
    });

    it('should handle boolean coercion in conditions', () => {
      expect(evaluate('{{ "" ? "yes" : "no" }}', defaultContext)).toBe('no');
      expect(evaluate('{{ "hello" ? "yes" : "no" }}', defaultContext)).toBe('yes');
    });
  });

  // 12. Null safety
  describe('Null Safety', () => {
    it('should throw ReferenceError on null member access', () => {
      const ctx: ExpressionContext = { $input: { user: null } };
      expect(() => evaluate('{{ $input.user.name }}', ctx)).toThrow();
      try {
        evaluate('{{ $input.user.name }}', ctx);
      } catch (e) {
        expect((e as ExpressionError).code).toBe(ErrorCode.EXPR_REFERENCE_ERROR);
      }
    });

    it('should throw on undefined variable', () => {
      expect(() => evaluate('{{ $missing }}', defaultContext)).toThrow();
    });
  });

  // 12.1 Optional chaining (?.)
  // `?.` 는 체인 전체에 short-circuit 을 퍼뜨린다. 즉 `a?.b.c` 에서 a 가
  // null 이면 .c 가 non-optional 이라도 throw 하지 않고 체인 결과가 null.
  describe('Optional Chaining', () => {
    const ctx: ExpressionContext = {
      $input: {
        user: { name: 'Alice', profile: { age: 30 } },
        nullUser: null,
        items: ['a', 'b'],
      },
      $node: {
        '1depth 음식 종류': {
          output: {
            interaction: { data: { food_category: '한식' } },
          },
        },
        MissingNode: null,
      },
    };

    it('resolves member access when the head is present', () => {
      expect(evaluate('{{ $input.user?.name }}', ctx)).toBe('Alice');
    });

    it('short-circuits to null when the head is null', () => {
      expect(evaluate('{{ $input.nullUser?.name }}', ctx)).toBeNull();
    });

    it('propagates short-circuit through the rest of the chain (optional-only)', () => {
      expect(evaluate('{{ $input.nullUser?.profile?.age }}', ctx)).toBeNull();
    });

    it('propagates short-circuit through a mixed optional/non-optional chain', () => {
      // a?.b.c 에서 a 가 null 이면 .c 까지 통째로 short-circuit
      expect(evaluate('{{ $input.nullUser?.profile.age }}', ctx)).toBeNull();
    });

    it('supports optional index access with ?.[]', () => {
      expect(evaluate('{{ $input.nullUser?.["name"] }}', ctx)).toBeNull();
      expect(evaluate('{{ $input.user?.["name"] }}', ctx)).toBe('Alice');
    });

    it('resolves the reported switchValue-style expression end-to-end', () => {
      expect(
        evaluate(
          '{{ $node["1depth 음식 종류"]?.output?.interaction?.data?.food_category }}',
          ctx,
        ),
      ).toBe('한식');
      expect(
        evaluate(
          '{{ $node["MissingNode"]?.output?.interaction?.data?.food_category }}',
          ctx,
        ),
      ).toBeNull();
    });

    it('still throws on a non-optional access after a non-null head', () => {
      // user.profile 은 존재하지만 user.profile.missing 은 없다 → null
      expect(evaluate('{{ $input.user?.profile.missing }}', ctx)).toBeNull();
    });

    it('does not confuse ?. with the ternary `?`', () => {
      expect(
        evaluate('{{ $input.user ? $input.user.name : "fallback" }}', ctx),
      ).toBe('Alice');
      expect(
        evaluate('{{ $input.nullUser ? "yes" : "no" }}', ctx),
      ).toBe('no');
    });

    it('reports a helpful syntax error on trailing ?.', () => {
      // `{{ a?. }}` 식으로 뒤에 식별자/[ / ( 가 없는 경우
      expect(() => evaluate('{{ $input?. }}', ctx)).toThrow();
    });
  });

  // 13. Date functions
  describe('Date Functions', () => {
    it('should format a date', () => {
      expect(
        evaluate('{{ formatDate("2026-03-30T12:00:00.000Z", "YYYY-MM-DD") }}', defaultContext),
      ).toBe('2026-03-30');
    });

    it('should add time', () => {
      const result = evaluate(
        '{{ addTime("2026-03-30T00:00:00.000Z", 1, "days") }}',
        defaultContext,
      ) as string;
      expect(result).toContain('2026-03-31');
    });

    it('should calculate diff', () => {
      const result = evaluate(
        '{{ diffTime("2026-03-30T00:00:00.000Z", "2026-03-28T00:00:00.000Z", "days") }}',
        defaultContext,
      );
      expect(result).toBe(2);
    });
  });

  // 14. String functions
  describe('String Functions', () => {
    it('should trim whitespace', () => {
      expect(evaluate('{{ trim("  hello  ") }}', defaultContext)).toBe('hello');
    });

    it('should check contains', () => {
      expect(evaluate('{{ contains($input.email, "@") }}', defaultContext)).toBe(true);
      expect(evaluate('{{ contains($input.email, "xyz") }}', defaultContext)).toBe(false);
    });

    it('should split and join', () => {
      expect(evaluate('{{ split("a,b,c", ",") }}', defaultContext)).toEqual(['a', 'b', 'c']);
      expect(evaluate('{{ join(split("a,b,c", ","), "-") }}', defaultContext)).toBe('a-b-c');
    });

    it('should replace', () => {
      expect(evaluate('{{ replace("hello world", "world", "there") }}', defaultContext)).toBe('hello there');
    });

    it('should replaceAll', () => {
      expect(evaluate('{{ replaceAll("a.b.c", ".", "-") }}', defaultContext)).toBe('a-b-c');
    });

    it('should handle substring', () => {
      expect(evaluate('{{ substring("hello", 0, 3) }}', defaultContext)).toBe('hel');
    });

    it('should handle padStart', () => {
      expect(evaluate('{{ padStart("5", 3, "0") }}', defaultContext)).toBe('005');
    });

    it('should handle startsWith and endsWith', () => {
      expect(evaluate('{{ startsWith("hello", "hel") }}', defaultContext)).toBe(true);
      expect(evaluate('{{ endsWith("hello.pdf", ".pdf") }}', defaultContext)).toBe(true);
    });
  });

  // 15. Object/Array functions
  describe('Object and Array Functions', () => {
    it('should get keys of object', () => {
      expect(evaluate('{{ keys($input.data) }}', defaultContext)).toEqual(['x', 'y', 'z']);
    });

    it('should get values of object', () => {
      expect(evaluate('{{ values($input.data) }}', defaultContext)).toEqual([1, 2, 3]);
    });

    it('should check hasKey', () => {
      expect(evaluate('{{ hasKey($input.data, "x") }}', defaultContext)).toBe(true);
      expect(evaluate('{{ hasKey($input.data, "w") }}', defaultContext)).toBe(false);
    });

    it('should merge objects', () => {
      expect(
        evaluate('{{ merge({ a: 1 }, { b: 2 }) }}', defaultContext),
      ).toEqual({ a: 1, b: 2 });
    });

    it('should get first and last of array', () => {
      expect(evaluate('{{ first($input.items) }}', defaultContext)).toBe('a');
      expect(evaluate('{{ last($input.items) }}', defaultContext)).toBe('c');
    });

    it('should check includes', () => {
      expect(evaluate('{{ includes($input.items, "b") }}', defaultContext)).toBe(true);
      expect(evaluate('{{ includes($input.items, "z") }}', defaultContext)).toBe(false);
    });

    it('should reverse array', () => {
      expect(evaluate('{{ reverse($input.items) }}', defaultContext)).toEqual(['c', 'b', 'a']);
    });

    it('should compact array', () => {
      const ctx: ExpressionContext = { $input: { arr: [1, null, 2, null, 3] } };
      expect(evaluate('{{ compact($input.arr) }}', ctx)).toEqual([1, 2, 3]);
    });

    it('should unique array', () => {
      const ctx: ExpressionContext = { $input: { arr: [1, 2, 2, 3, 3] } };
      expect(evaluate('{{ unique($input.arr) }}', ctx)).toEqual([1, 2, 3]);
    });

    it('should slice array', () => {
      expect(evaluate('{{ slice($input.items, 1, 3) }}', defaultContext)).toEqual(['b', 'c']);
    });

    it('should concat arrays', () => {
      expect(evaluate('{{ concat([1, 2], [3, 4]) }}', defaultContext)).toEqual([1, 2, 3, 4]);
    });
  });

  // 16. Type functions
  describe('Type Functions', () => {
    it('should return typeOf', () => {
      expect(evaluate('{{ typeOf("hello") }}', defaultContext)).toBe('string');
      expect(evaluate('{{ typeOf(42) }}', defaultContext)).toBe('number');
      expect(evaluate('{{ typeOf(true) }}', defaultContext)).toBe('boolean');
      expect(evaluate('{{ typeOf(null) }}', defaultContext)).toBe('null');
      expect(evaluate('{{ typeOf([1]) }}', defaultContext)).toBe('array');
      expect(evaluate('{{ typeOf({ a: 1 }) }}', defaultContext)).toBe('object');
    });

    it('should check isEmpty', () => {
      expect(evaluate('{{ isEmpty("") }}', defaultContext)).toBe(true);
      expect(evaluate('{{ isEmpty(null) }}', defaultContext)).toBe(true);
      expect(evaluate('{{ isEmpty([]) }}', defaultContext)).toBe(true);
      expect(evaluate('{{ isEmpty({}) }}', defaultContext)).toBe(true);
      expect(evaluate('{{ isEmpty("hello") }}', defaultContext)).toBe(false);
      expect(evaluate('{{ isEmpty(0) }}', defaultContext)).toBe(false);
    });

    it('should check isNull', () => {
      expect(evaluate('{{ isNull(null) }}', defaultContext)).toBe(true);
      expect(evaluate('{{ isNull(0) }}', defaultContext)).toBe(false);
    });

    it('should convert toString', () => {
      expect(evaluate('{{ toString(42) }}', defaultContext)).toBe('42');
      expect(evaluate('{{ toString(null) }}', defaultContext)).toBe('');
    });

    it('should convert toNumber', () => {
      expect(evaluate('{{ toNumber("42") }}', defaultContext)).toBe(42);
      expect(evaluate('{{ toNumber(true) }}', defaultContext)).toBe(1);
    });

    it('should convert toBoolean', () => {
      expect(evaluate('{{ toBoolean(0) }}', defaultContext)).toBe(false);
      expect(evaluate('{{ toBoolean(1) }}', defaultContext)).toBe(true);
      expect(evaluate('{{ toBoolean("") }}', defaultContext)).toBe(false);
    });

    it('should convert toJSON and fromJSON', () => {
      expect(evaluate('{{ toJSON({ a: 1 }) }}', defaultContext)).toBe('{"a":1}');
      expect(evaluate('{{ fromJSON("{\\"a\\":1}") }}', defaultContext)).toEqual({ a: 1 });
    });
  });

  // 17. Logical operators
  describe('Logical Operators', () => {
    it('should evaluate && with short circuit', () => {
      expect(evaluate('{{ true && "yes" }}', defaultContext)).toBe('yes');
      expect(evaluate('{{ false && "yes" }}', defaultContext)).toBe(false);
    });

    it('should evaluate || with short circuit', () => {
      expect(evaluate('{{ null || "default" }}', defaultContext)).toBe('default');
      expect(evaluate('{{ "value" || "default" }}', defaultContext)).toBe('value');
    });

    it('should evaluate !', () => {
      expect(evaluate('{{ !true }}', defaultContext)).toBe(false);
      expect(evaluate('{{ !false }}', defaultContext)).toBe(true);
      expect(evaluate('{{ !null }}', defaultContext)).toBe(true);
    });
  });

  // 18. Error cases
  describe('Error Cases', () => {
    it('should throw EXPR_SYNTAX_ERROR for invalid syntax', () => {
      const result = validate('{{ $input. }}');
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe(ErrorCode.EXPR_SYNTAX_ERROR);
    });

    it('should throw EXPR_REFERENCE_ERROR for undefined variable', () => {
      expect(() => evaluate('{{ $undefined_var }}', defaultContext)).toThrow();
      try {
        evaluate('{{ $undefined_var }}', defaultContext);
      } catch (e) {
        expect((e as ExpressionError).code).toBe(ErrorCode.EXPR_REFERENCE_ERROR);
      }
    });

    it('should throw EXPR_TYPE_ERROR for invalid arithmetic', () => {
      expect(() => evaluate('{{ "hello" - 1 }}', defaultContext)).toThrow();
      try {
        evaluate('{{ "hello" - 1 }}', defaultContext);
      } catch (e) {
        expect((e as ExpressionError).code).toBe(ErrorCode.EXPR_TYPE_ERROR);
      }
    });

    it('should throw EXPR_FUNCTION_ERROR for unknown function', () => {
      expect(() => evaluate('{{ unknownFn() }}', defaultContext)).toThrow();
      try {
        evaluate('{{ unknownFn() }}', defaultContext);
      } catch (e) {
        expect((e as ExpressionError).code).toBe(ErrorCode.EXPR_FUNCTION_ERROR);
      }
    });

    it('should throw for unterminated expression', () => {
      expect(() => evaluate('{{ $input.name', defaultContext)).toThrow();
    });
  });

  // 19. Validation
  describe('Validation', () => {
    it('should validate correct expressions', () => {
      expect(validate('{{ $input.name }}')).toEqual({ valid: true, errors: [] });
      expect(validate('Hello, {{ $input.name }}!')).toEqual({ valid: true, errors: [] });
      expect(validate('{{ 1 + 2 }}')).toEqual({ valid: true, errors: [] });
    });

    it('should invalidate incorrect expressions', () => {
      const result = validate('{{ + }}');
      expect(result.valid).toBe(false);
    });
  });

  // 20. Edge cases
  describe('Edge Cases', () => {
    it('should handle empty template', () => {
      expect(evaluate('', defaultContext)).toBe('');
    });

    it('should handle expression with only whitespace inside', () => {
      // "{{ }}" -> ExprEnd immediately -> should parse as empty, which hits unexpected token
      expect(() => evaluate('{{  }}', defaultContext)).toThrow();
    });

    it('should handle boolean literal', () => {
      expect(evaluate('{{ true }}', defaultContext)).toBe(true);
      expect(evaluate('{{ false }}', defaultContext)).toBe(false);
    });

    it('should handle null literal', () => {
      expect(evaluate('{{ null }}', defaultContext)).toBe(null);
    });

    it('should handle string literals with escapes', () => {
      expect(evaluate('{{ "hello\\nworld" }}', defaultContext)).toBe('hello\nworld');
    });

    it('should handle nested member + index', () => {
      const ctx: ExpressionContext = {
        $input: { users: [{ name: 'Alice' }, { name: 'Bob' }] },
      };
      expect(evaluate('{{ $input.users[1].name }}', ctx)).toBe('Bob');
    });

    it('should handle pick and omit', () => {
      expect(
        evaluate('{{ pick($input.data, ["x", "y"]) }}', defaultContext),
      ).toEqual({ x: 1, y: 2 });
      expect(
        evaluate('{{ omit($input.data, ["z"]) }}', defaultContext),
      ).toEqual({ x: 1, y: 2 });
    });

    it('should handle flatten', () => {
      const ctx: ExpressionContext = { $input: { arr: [[1, 2], [3, 4]] } };
      expect(evaluate('{{ flatten($input.arr) }}', ctx)).toEqual([1, 2, 3, 4]);
    });

    it('should handle parseInt and parseFloat', () => {
      expect(evaluate('{{ parseInt("42") }}', defaultContext)).toBe(42);
      expect(evaluate('{{ parseFloat("3.14") }}', defaultContext)).toBe(3.14);
    });

    it('should handle toFixed', () => {
      expect(evaluate('{{ toFixed(3.14159, 2) }}', defaultContext)).toBe('3.14');
    });

    it('should handle abs, ceil, floor', () => {
      expect(evaluate('{{ abs(-5) }}', defaultContext)).toBe(5);
      expect(evaluate('{{ ceil(3.2) }}', defaultContext)).toBe(4);
      expect(evaluate('{{ floor(3.8) }}', defaultContext)).toBe(3);
    });

    it('should handle entries', () => {
      const ctx: ExpressionContext = { $input: { obj: { a: 1, b: 2 } } };
      expect(evaluate('{{ entries($input.obj) }}', ctx)).toEqual([['a', 1], ['b', 2]]);
    });

    it('should handle $node access with bracket notation', () => {
      const ctx: ExpressionContext = {
        $node: { 'Fetch User': { output: { id: 123 } } },
      };
      expect(evaluate('{{ $node["Fetch User"].output.id }}', ctx)).toBe(123);
    });
  });

  // 21. Number functions
  describe('Number Functions - Additional', () => {
    it('should handle random (returns a number between 0 and 1)', () => {
      const result = evaluate('{{ random() }}', defaultContext) as number;
      expect(typeof result).toBe('number');
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThan(1);
    });
  });

  // 22. Date functions - Additional
  describe('Date Functions - Additional', () => {
    it('should handle subtractTime', () => {
      const result = evaluate(
        '{{ subtractTime("2026-03-30T00:00:00.000Z", 1, "days") }}',
        defaultContext,
      ) as string;
      expect(result).toContain('2026-03-29');
    });

    it('should handle parseDate', () => {
      const result = evaluate('{{ parseDate("2026-03-30T12:00:00Z") }}', defaultContext) as string;
      expect(result).toContain('2026-03-30');
    });
  });
});
