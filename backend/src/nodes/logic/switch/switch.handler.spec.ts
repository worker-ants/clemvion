import { SwitchHandler } from './switch.handler.js';
import { ExecutionContext } from '../../core/node-handler.interface.js';

describe('SwitchHandler', () => {
  let handler: SwitchHandler;
  let context: ExecutionContext;

  beforeEach(() => {
    handler = new SwitchHandler();
    context = {
      executionId: 'test-exec-1',
      workflowId: 'test-wf-1',
      variables: {},
      nodeOutputCache: {},
      structuredOutputCache: {},
      engineResolvedConfigCache: {},
      recursionDepth: 0,
    };
  });

  // NOTE on contract:
  // The expression engine pre-resolves `switchValue` templates (`{{ ... }}`)
  // before the handler runs, so the handler always receives a final
  // primitive/object in config.switchValue. It must NOT perform another
  // path lookup on the input. See plan/switch-node-input-lucky-dove for
  // the bug these tests guard against.

  describe('validate', () => {
    it('returns valid for minimal value-mode config', () => {
      const result = handler.validate({
        switchValue: 'active',
        cases: [{ id: 'case-1', value: 'active' }],
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('accepts non-string switchValue (expression-resolved primitive)', () => {
      const result = handler.validate({
        switchValue: 42,
        cases: [{ id: 'case-1', value: 42 }],
      });
      expect(result.valid).toBe(true);
    });

    it('rejects missing switchValue in value mode', () => {
      const result = handler.validate({
        mode: 'value',
        cases: [{ id: 'case-1', value: 'a' }],
      });
      expect(result.valid).toBe(false);
      // Schema warningRule "Value 모드에서는 Switch Value 를 입력해야 합니다." fires.
      expect(result.errors.some((e) => e.includes('Switch Value'))).toBe(true);
    });

    it('rejects null switchValue', () => {
      const result = handler.validate({
        switchValue: null,
        cases: [{ id: 'case-1', value: 'a' }],
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Switch Value'))).toBe(true);
    });

    it('rejects whitespace-only switchValue string', () => {
      const result = handler.validate({
        switchValue: '  ',
        cases: [{ id: 'case-1', value: 'a' }],
      });
      expect(result.valid).toBe(false);
      // Handler-only residual (schema's `!switchValue` is truthy on whitespace).
      expect(result.errors).toContain('switchValue is required');
    });

    it('does NOT require switchValue in expression mode', () => {
      const result = handler.validate({
        mode: 'expression',
        cases: [
          {
            id: 'case-1',
            condition: { field: 'role', operator: 'eq', value: 'admin' },
          },
        ],
      });
      expect(result.valid).toBe(true);
    });

    it('requires condition on every case in expression mode', () => {
      const result = handler.validate({
        mode: 'expression',
        cases: [{ id: 'case-1', value: 'a' }],
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'cases[0].condition is required when mode is "expression"',
      );
    });

    it('rejects non-array cases', () => {
      const result = handler.validate({
        switchValue: 'x',
        cases: 'not-array',
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('cases must be a non-empty array');
    });

    it('rejects empty cases array', () => {
      const result = handler.validate({
        switchValue: 'x',
        cases: [],
      });
      expect(result.valid).toBe(false);
      // Schema warningRule "최소 1개 이상의 case 를 추가해야 합니다." fires.
      expect(result.errors.some((e) => e.includes('case'))).toBe(true);
    });

    it('rejects case missing id', () => {
      const result = handler.validate({
        switchValue: 'x',
        cases: [{ value: 'a' }],
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'cases[0].id is required and must be a string',
      );
    });

    it('rejects case with empty id', () => {
      const result = handler.validate({
        switchValue: 'x',
        cases: [{ id: '', value: 'a' }],
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'cases[0].id is required and must be a string',
      );
    });

    it('rejects duplicate case ids', () => {
      const result = handler.validate({
        switchValue: 'x',
        cases: [
          { id: 'dup', value: 'a' },
          { id: 'dup', value: 'b' },
        ],
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("cases[1].id 'dup' is duplicated");
    });

    it('rejects non-boolean hasDefault', () => {
      const result = handler.validate({
        switchValue: 'x',
        cases: [{ id: 'case-1', value: 'a' }],
        hasDefault: 'yes',
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('hasDefault must be a boolean');
    });

    it('rejects non-boolean strictComparison', () => {
      const result = handler.validate({
        switchValue: 'x',
        cases: [{ id: 'case-1', value: 'a' }],
        strictComparison: 'yes',
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('strictComparison must be a boolean');
    });

    it('rejects invalid mode', () => {
      const result = handler.validate({
        mode: 'neither',
        switchValue: 'x',
        cases: [{ id: 'case-1', value: 'a' }],
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('mode must be "value" or "expression"');
    });

    it('rejects bad valueType', () => {
      const result = handler.validate({
        switchValue: 'x',
        cases: [{ id: 'case-1', value: 'a', valueType: 'integer' }],
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'cases[0].valueType must be one of: string, number, boolean',
      );
    });
  });

  describe('execute — mode: value', () => {
    const inputIgnored = { someField: 'ignored' };

    it('matches a case whose value equals the resolved primitive', async () => {
      const result = await handler.execute(
        inputIgnored,
        {
          switchValue: '한식',
          cases: [
            { id: 'case_korean', label: '한식 선택', value: '한식' },
            { id: 'case_western', label: '양식 선택', value: '양식' },
            { id: 'case_chinese', label: '중식 선택', value: '중식' },
          ],
          hasDefault: true,
        },
        context,
      );
      expect(result).toMatchObject({
        port: 'case_korean',
        output: inputIgnored,
        meta: { mode: 'value', matchedCase: 'case_korean', value: '한식' },
      });
    });

    it('passes input through untouched on match', async () => {
      const input = { a: 1, b: [2, 3] };
      const result = (await handler.execute(
        input,
        {
          switchValue: 'x',
          cases: [{ id: 'c1', value: 'x' }],
        },
        context,
      )) as unknown as Record<string, unknown>;
      expect(result.output).toBe(input);
    });

    it('matches number primitives directly', async () => {
      const result = await handler.execute(
        {},
        {
          switchValue: 2,
          cases: [
            { id: 'one', value: 1 },
            { id: 'two', value: 2 },
            { id: 'three', value: 3 },
          ],
          hasDefault: true,
        },
        context,
      );
      expect(result).toMatchObject({ port: 'two' });
    });

    it('matches boolean primitives directly', async () => {
      const result = await handler.execute(
        {},
        {
          switchValue: true,
          cases: [
            { id: 'yes', value: true },
            { id: 'no', value: false },
          ],
          hasDefault: true,
        },
        context,
      );
      expect(result).toMatchObject({ port: 'yes' });
    });

    it('matches the falsy primitive 0 against a case with value 0', async () => {
      const result = await handler.execute(
        {},
        {
          switchValue: 0,
          cases: [
            { id: 'zero', value: 0 },
            { id: 'one', value: 1 },
          ],
          hasDefault: true,
        },
        context,
      );
      expect(result).toMatchObject({ port: 'zero' });
    });

    it('loose comparison (default) treats "1" and 1 as equal', async () => {
      const result = await handler.execute(
        {},
        {
          switchValue: '1',
          cases: [{ id: 'num', value: 1 }],
          hasDefault: true,
        },
        context,
      );
      expect(result).toMatchObject({ port: 'num' });
    });

    it('strict comparison rejects "1" vs 1', async () => {
      const result = await handler.execute(
        {},
        {
          switchValue: '1',
          cases: [{ id: 'num', value: 1 }],
          hasDefault: true,
          strictComparison: true,
        },
        context,
      );
      expect(result).toMatchObject({ port: 'default' });
    });

    it('uses valueType to coerce case value before comparison', async () => {
      const result = await handler.execute(
        {},
        {
          switchValue: 42,
          cases: [{ id: 'num', value: '42', valueType: 'number' }],
          hasDefault: true,
          strictComparison: true,
        },
        context,
      );
      expect(result).toMatchObject({ port: 'num' });
    });

    it('matches the first case when two cases share the same value', async () => {
      const result = await handler.execute(
        {},
        {
          switchValue: 1,
          cases: [
            { id: 'first', value: 1 },
            { id: 'second', value: 1 },
          ],
          hasDefault: true,
        },
        context,
      );
      expect(result).toMatchObject({ port: 'first' });
    });

    it('falls through to default when no case matches and hasDefault=true', async () => {
      const result = await handler.execute(
        inputIgnored,
        {
          switchValue: '일식',
          cases: [
            { id: 'case_korean', value: '한식' },
            { id: 'case_western', value: '양식' },
          ],
          hasDefault: true,
        },
        context,
      );
      expect(result).toMatchObject({
        port: 'default',
        output: inputIgnored,
        meta: { mode: 'value', matchedCase: 'default' },
      });
    });

    it('falls through to default when hasDefault is omitted (defaults to true per prior behavior)', async () => {
      const result = await handler.execute(
        {},
        {
          switchValue: 'missing',
          cases: [{ id: 'c1', value: 'a' }],
        },
        context,
      );
      expect(result).toMatchObject({ port: 'default' });
    });

    it('throws when no case matches and hasDefault=false', async () => {
      await expect(
        handler.execute(
          {},
          {
            switchValue: 'missing',
            cases: [{ id: 'c1', value: 'a' }],
            hasDefault: false,
          },
          context,
        ),
      ).rejects.toThrow(
        'No matching case found and no default case configured',
      );
    });

    describe('coerceCaseValue (via valueType)', () => {
      it('coerces case value "42" → 42 when valueType=number (strict mode)', async () => {
        const result = await handler.execute(
          {},
          {
            switchValue: 42,
            cases: [{ id: 'num', value: '42', valueType: 'number' }],
            hasDefault: true,
            strictComparison: true,
          },
          context,
        );
        expect(result).toMatchObject({ port: 'num' });
      });

      it('coerces case value "true" → true when valueType=boolean (strict mode)', async () => {
        const result = await handler.execute(
          {},
          {
            switchValue: true,
            cases: [
              { id: 'yes', value: 'true', valueType: 'boolean' },
              { id: 'no', value: 'false', valueType: 'boolean' },
            ],
            hasDefault: true,
            strictComparison: true,
          },
          context,
        );
        expect(result).toMatchObject({ port: 'yes' });
      });

      it('keeps original string when valueType=number coercion fails (NaN)', async () => {
        const result = await handler.execute(
          {},
          {
            switchValue: 'abc',
            cases: [{ id: 'nan', value: 'abc', valueType: 'number' }],
            hasDefault: true,
            strictComparison: true,
          },
          context,
        );
        expect(result).toMatchObject({ port: 'nan' });
      });

      it('keeps original string when valueType=boolean gets a non-boolean token', async () => {
        const result = await handler.execute(
          {},
          {
            switchValue: 'yes',
            cases: [{ id: 'literal', value: 'yes', valueType: 'boolean' }],
            hasDefault: true,
            strictComparison: true,
          },
          context,
        );
        expect(result).toMatchObject({ port: 'literal' });
      });

      it('skips coercion when valueType is omitted or "string"', async () => {
        const result = await handler.execute(
          {},
          {
            switchValue: 42,
            cases: [{ id: 'str', value: '42', valueType: 'string' }],
            hasDefault: true,
            strictComparison: true,
          },
          context,
        );
        expect(result).toMatchObject({ port: 'default' });
      });
    });

    describe('loose-equality boundary cases (default comparison)', () => {
      it('matches "0" against case value 0 under loose comparison', async () => {
        const result = await handler.execute(
          {},
          {
            switchValue: '0',
            cases: [{ id: 'zero', value: 0 }],
            hasDefault: true,
          },
          context,
        );
        expect(result).toMatchObject({ port: 'zero' });
      });

      it('does NOT match null against case value undefined under strict', async () => {
        const result = await handler.execute(
          {},
          {
            switchValue: null,
            cases: [{ id: 'undef', value: undefined }],
            hasDefault: true,
            strictComparison: true,
          },
          context,
        );
        expect(result).toMatchObject({ port: 'default' });
      });
    });
  });

  describe('execute — mode: expression', () => {
    it('matches the first case whose condition is true', async () => {
      const result = await handler.execute(
        { user: { age: 20, role: 'admin' } },
        {
          mode: 'expression',
          cases: [
            {
              id: 'minor',
              condition: {
                field: 'user.age',
                operator: 'lt',
                value: 18,
              },
            },
            {
              id: 'adult_admin',
              condition: {
                field: 'user.role',
                operator: 'eq',
                value: 'admin',
              },
            },
          ],
          hasDefault: true,
        },
        context,
      );
      expect(result).toMatchObject({
        port: 'adult_admin',
        meta: { mode: 'expression', matchedCase: 'adult_admin' },
      });
    });

    it('falls through to default when no condition is true', async () => {
      const result = await handler.execute(
        { user: { age: 10 } },
        {
          mode: 'expression',
          cases: [
            {
              id: 'adult',
              condition: {
                field: 'user.age',
                operator: 'gte',
                value: 18,
              },
            },
          ],
          hasDefault: true,
        },
        context,
      );
      expect(result).toMatchObject({ port: 'default' });
    });

    it('throws when no condition matches and hasDefault=false', async () => {
      await expect(
        handler.execute(
          {},
          {
            mode: 'expression',
            cases: [
              {
                id: 'c1',
                condition: { field: 'x', operator: 'eq', value: 1 },
              },
            ],
            hasDefault: false,
          },
          context,
        ),
      ).rejects.toThrow(
        'No matching case found and no default case configured',
      );
    });

    it('respects strictComparison in expression mode', async () => {
      const result = await handler.execute(
        { n: '42' },
        {
          mode: 'expression',
          cases: [
            {
              id: 'match',
              condition: { field: 'n', operator: 'eq', value: 42 },
            },
          ],
          hasDefault: true,
          strictComparison: true,
        },
        context,
      );
      expect(result).toMatchObject({ port: 'default' });
    });
  });

  // ENG-RC-* — Phase 3 raw-echo migration.
  describe('config echoes rawConfig over evaluated config', () => {
    it('preserves `{{ ... }}` switchValue template', async () => {
      const result = (await handler.execute(
        { region: 'asia' },
        {
          mode: 'value',
          switchValue: 'asia',
          cases: [{ id: 'asia', value: 'asia' }],
          hasDefault: true,
        },
        {
          ...context,
          rawConfig: Object.freeze({
            mode: 'value',
            switchValue: '{{ $input.region }}',
            cases: [{ id: 'asia', value: 'asia' }],
            hasDefault: true,
          }),
        },
      )) as unknown as { config: { switchValue: unknown }; port: string };

      expect(result.port).toBe('asia');
      expect(result.config.switchValue).toBe('{{ $input.region }}');
    });
  });
});
