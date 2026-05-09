import { TableHandler } from './table.handler.js';

describe('TableHandler', () => {
  let handler: TableHandler;

  beforeEach(() => {
    handler = new TableHandler();
  });

  const context = {
    executionId: 'exec-1',
    workflowId: 'wf-1',
    variables: {},
    nodeOutputCache: {},
  };

  describe('validate', () => {
    // Dynamic mode (default)
    it('should pass with valid columns in dynamic mode', () => {
      const result = handler.validate({
        columns: [{ field: 'name', label: 'Name' }],
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should pass with explicit mode=dynamic and columns', () => {
      const result = handler.validate({
        mode: 'dynamic',
        columns: [{ field: 'name', label: 'Name' }],
      });
      expect(result.valid).toBe(true);
    });

    it('should pass with dataSource in dynamic mode', () => {
      const result = handler.validate({
        mode: 'dynamic',
        dataSource: '{{ $var.list }}',
        columns: [{ field: 'name', label: 'Name' }],
      });
      expect(result.valid).toBe(true);
    });

    it('should warn when columns is missing (schema warningRule)', () => {
      const result = handler.validate({});
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('컬럼'))).toBe(true);
    });

    it('should warn when columns array is empty (schema warningRule)', () => {
      const result = handler.validate({ columns: [] });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('컬럼'))).toBe(true);
    });

    it('should fail when columns is not an array', () => {
      const result = handler.validate({ columns: 'not-array' });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('columns');
    });

    // Static mode
    it('should pass with valid columns and rows in static mode', () => {
      const result = handler.validate({
        mode: 'static',
        columns: [{ field: 'col0', label: 'Item' }],
        rows: [{ col0: 'Value' }],
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should warn when columns is missing in static mode (schema warningRule)', () => {
      const result = handler.validate({
        mode: 'static',
        rows: [{ col0: 'Value' }],
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('컬럼'))).toBe(true);
    });

    it('should accept missing rows in static mode (schema default is [])', () => {
      const result = handler.validate({
        mode: 'static',
        columns: [{ field: 'col0', label: 'Item' }],
      });
      expect(result.valid).toBe(true);
    });

    it('should accept empty rows in static mode (schema default)', () => {
      const result = handler.validate({
        mode: 'static',
        columns: [{ field: 'col0', label: 'Item' }],
        rows: [],
      });
      expect(result.valid).toBe(true);
    });

    it('should fail when rows is not an array in static mode', () => {
      const result = handler.validate({
        mode: 'static',
        columns: [{ field: 'col0', label: 'Item' }],
        rows: 'not-array',
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('rows');
    });

    // Invalid mode
    it('should fail for invalid mode value', () => {
      const result = handler.validate({
        mode: 'unknown',
        columns: [{ field: 'name', label: 'Name' }],
      });
      expect(result.valid).toBe(false);
      // Schema warningRule "Mode 는 static 또는 dynamic 이어야 합니다." fires.
      expect(result.errors.some((e) => e.includes('Mode'))).toBe(true);
    });

    // Backward compatibility
    it('should default to dynamic mode when mode is not specified', () => {
      const result = handler.validate({
        columns: [{ field: 'name', label: 'Name' }],
      });
      expect(result.valid).toBe(true);
    });
  });

  describe('execute', () => {
    // === Dynamic mode ===
    it('should map fields from input array in dynamic mode', async () => {
      const input = [
        { name: 'Alice', email: 'alice@test.com', age: 30 },
        { name: 'Bob', email: 'bob@test.com', age: 25 },
      ];
      const result = (await handler.execute(
        input,
        {
          columns: [
            { field: 'name', label: 'Name' },
            { field: 'email', label: 'Email' },
          ],
        },
        context,
      )) as Record<string, unknown>;

      expect(result.output.type).toBeUndefined();
      const rows = result.output.rows as Array<Record<string, unknown>>;
      expect(rows).toHaveLength(2);
      expect(rows[0]).toEqual({ name: 'Alice', email: 'alice@test.com' });
      expect(rows[1]).toEqual({ name: 'Bob', email: 'bob@test.com' });
    });

    it('should wrap single input in array for dynamic mode', async () => {
      const result = (await handler.execute(
        { name: 'Single' },
        { columns: [{ field: 'name', label: 'Name' }] },
        context,
      )) as Record<string, unknown>;

      const rows = result.output.rows as Array<Record<string, unknown>>;
      expect(rows).toHaveLength(1);
      expect(rows[0]).toEqual({ name: 'Single' });
    });

    it('should use dataSource when provided in dynamic mode', async () => {
      // dataSource is already resolved by ExpressionResolverService
      const resolvedDataSource = [
        { id: 1, title: 'Task A' },
        { id: 2, title: 'Task B' },
      ];
      const result = (await handler.execute(
        { someOtherData: 'ignored' }, // input is ignored when dataSource is provided
        {
          mode: 'dynamic',
          dataSource: resolvedDataSource,
          columns: [
            { field: 'id', label: 'ID' },
            { field: 'title', label: 'Title' },
          ],
        },
        context,
      )) as Record<string, unknown>;

      const rows = result.output.rows as Array<Record<string, unknown>>;
      expect(rows).toHaveLength(2);
      expect(rows[0]).toEqual({ id: 1, title: 'Task A' });
      expect(rows[1]).toEqual({ id: 2, title: 'Task B' });
    });

    it('should wrap non-array dataSource in array', async () => {
      const result = (await handler.execute(
        null,
        {
          mode: 'dynamic',
          dataSource: { name: 'Solo' },
          columns: [{ field: 'name', label: 'Name' }],
        },
        context,
      )) as Record<string, unknown>;

      const rows = result.output.rows as Array<Record<string, unknown>>;
      expect(rows).toHaveLength(1);
      expect(rows[0]).toEqual({ name: 'Solo' });
    });

    it('should fall back to input when dataSource is not provided', async () => {
      const input = [{ name: 'Fallback' }];
      const result = (await handler.execute(
        input,
        {
          mode: 'dynamic',
          columns: [{ field: 'name', label: 'Name' }],
        },
        context,
      )) as Record<string, unknown>;

      const rows = result.output.rows as Array<Record<string, unknown>>;
      expect(rows[0]).toEqual({ name: 'Fallback' });
    });

    // Sorting
    it('should sort rows by sortBy field ascending', async () => {
      const input = [
        { name: 'Charlie', score: 70 },
        { name: 'Alice', score: 90 },
        { name: 'Bob', score: 80 },
      ];
      const result = (await handler.execute(
        input,
        {
          columns: [
            { field: 'name', label: 'Name' },
            { field: 'score', label: 'Score' },
          ],
          sortBy: 'score',
          sortOrder: 'asc',
        },
        context,
      )) as Record<string, unknown>;

      const rows = result.output.rows as Array<Record<string, unknown>>;
      expect(rows[0].score).toBe(70);
      expect(rows[1].score).toBe(80);
      expect(rows[2].score).toBe(90);
    });

    it('should sort rows descending', async () => {
      const input = [
        { name: 'A', score: 10 },
        { name: 'B', score: 30 },
        { name: 'C', score: 20 },
      ];
      const result = (await handler.execute(
        input,
        {
          columns: [
            { field: 'name', label: 'Name' },
            { field: 'score', label: 'Score' },
          ],
          sortBy: 'score',
          sortOrder: 'desc',
        },
        context,
      )) as Record<string, unknown>;

      const rows = result.output.rows as Array<Record<string, unknown>>;
      expect(rows[0].score).toBe(30);
      expect(rows[2].score).toBe(10);
    });

    // Pagination
    it('should limit rows by pageSize', async () => {
      const input = Array.from({ length: 10 }, (_, i) => ({ n: i }));
      const result = (await handler.execute(
        input,
        {
          columns: [{ field: 'n', label: 'N' }],
          pageSize: 3,
        },
        context,
      )) as Record<string, unknown>;

      const rows = result.output.rows as Array<Record<string, unknown>>;
      expect(rows).toHaveLength(3);
      expect(result.output.totalRows).toBe(3);
    });

    // Missing fields
    it('should return null for missing fields', async () => {
      const result = (await handler.execute(
        [{ name: 'Alice' }],
        {
          columns: [
            { field: 'name', label: 'Name' },
            { field: 'email', label: 'Email' },
          ],
        },
        context,
      )) as Record<string, unknown>;

      const rows = result.output.rows as Array<Record<string, unknown>>;
      expect(rows[0]).toEqual({ name: 'Alice', email: null });
    });

    // === Static mode ===
    it('should use static rows directly from config', async () => {
      const result = (await handler.execute(
        null,
        {
          mode: 'static',
          columns: [
            { field: 'col0', label: 'Item' },
            { field: 'col1', label: 'Value' },
          ],
          rows: [
            { col0: 'User Count', col1: '42' },
            { col0: 'Avg Score', col1: '85.5' },
          ],
        },
        context,
      )) as Record<string, unknown>;

      expect(result.output.type).toBeUndefined();
      const rows = result.output.rows as Array<Record<string, unknown>>;
      expect(rows).toHaveLength(2);
      expect(rows[0]).toEqual({ col0: 'User Count', col1: '42' });
      expect(rows[1]).toEqual({ col0: 'Avg Score', col1: '85.5' });
    });

    it('should handle empty rows gracefully in static mode', async () => {
      const result = (await handler.execute(
        null,
        {
          mode: 'static',
          columns: [{ field: 'col0', label: 'Item' }],
        },
        context,
      )) as Record<string, unknown>;

      const rows = result.output.rows as Array<Record<string, unknown>>;
      expect(rows).toHaveLength(0);
    });

    it('should apply sorting in static mode', async () => {
      const result = (await handler.execute(
        null,
        {
          mode: 'static',
          columns: [
            { field: 'col0', label: 'Name' },
            { field: 'col1', label: 'Score' },
          ],
          rows: [
            { col0: 'Alice', col1: 90 },
            { col0: 'Bob', col1: 70 },
            { col0: 'Charlie', col1: 80 },
          ],
          sortBy: 'col1',
          sortOrder: 'asc',
        },
        context,
      )) as Record<string, unknown>;

      const rows = result.output.rows as Array<Record<string, unknown>>;
      expect(rows[0].col1).toBe(70);
      expect(rows[2].col1).toBe(90);
    });

    it('should apply pagination in static mode', async () => {
      const result = (await handler.execute(
        null,
        {
          mode: 'static',
          columns: [{ field: 'col0', label: 'Item' }],
          rows: [{ col0: 'A' }, { col0: 'B' }, { col0: 'C' }],
          pageSize: 2,
        },
        context,
      )) as Record<string, unknown>;

      const rows = result.output.rows as Array<Record<string, unknown>>;
      expect(rows).toHaveLength(2);
    });

    it('should ignore input in static mode', async () => {
      const result = (await handler.execute(
        [{ name: 'Ignored' }],
        {
          mode: 'static',
          columns: [{ field: 'col0', label: 'Item' }],
          rows: [{ col0: 'Static Value' }],
        },
        context,
      )) as Record<string, unknown>;

      const rows = result.output.rows as Array<Record<string, unknown>>;
      expect(rows).toHaveLength(1);
      expect(rows[0]).toEqual({ col0: 'Static Value' });
    });

    // Backward compatibility
    it('should default to dynamic mode when mode is absent', async () => {
      const result = (await handler.execute(
        [{ name: 'Test' }],
        { columns: [{ field: 'name', label: 'Name' }] },
        context,
      )) as Record<string, unknown>;

      expect(result.output.type).toBeUndefined();
      const rows = result.output.rows as Array<Record<string, unknown>>;
      expect(rows[0]).toEqual({ name: 'Test' });
    });

    // Rendered HTML
    it('should include rendered HTML in output', async () => {
      const result = (await handler.execute(
        [{ name: 'Alice' }],
        { columns: [{ field: 'name', label: 'Name' }] },
        context,
      )) as Record<string, unknown>;

      expect(result.output.rendered).toBeDefined();
      expect(typeof result.output.rendered).toBe('string');
      expect(result.output.rendered as string).toContain('<table>');
      expect(result.output.rendered as string).toContain('Alice');
    });

    it('should escape HTML in rendered output', async () => {
      const result = (await handler.execute(
        [{ name: '<script>alert("xss")</script>' }],
        { columns: [{ field: 'name', label: 'Name' }] },
        context,
      )) as Record<string, unknown>;

      expect(result.output.rendered as string).not.toContain('<script>');
      expect(result.output.rendered as string).toContain('&lt;script&gt;');
    });

    it('should render object values as JSON string', async () => {
      const result = (await handler.execute(
        null,
        {
          mode: 'static',
          columns: [{ field: 'col0', label: 'Data' }],
          rows: [{ col0: { nested: 'value' } }],
        },
        context,
      )) as Record<string, unknown>;

      // HTML escaping converts quotes to &quot;
      expect(result.output.rendered as string).toContain(
        '{&quot;nested&quot;:&quot;value&quot;}',
      );
    });

    it('should render array values as JSON string', async () => {
      const result = (await handler.execute(
        null,
        {
          mode: 'static',
          columns: [{ field: 'col0', label: 'List' }],
          rows: [{ col0: [1, 2, 3] }],
        },
        context,
      )) as Record<string, unknown>;

      expect(result.output.rendered as string).toContain('[1,2,3]');
    });

    it('should sort stably when some values are null', async () => {
      const input = [
        { name: 'A', score: null },
        { name: 'B', score: 10 },
        { name: 'C', score: null },
      ];
      const result = (await handler.execute(
        input,
        {
          columns: [
            { field: 'name', label: 'Name' },
            { field: 'score', label: 'Score' },
          ],
          sortBy: 'score',
          sortOrder: 'asc',
        },
        context,
      )) as Record<string, unknown>;

      const rows = result.output.rows as Array<Record<string, unknown>>;
      expect(rows).toHaveLength(3);
      // null values are treated as greater than non-null (pushed to end in asc)
      const nonNullRows = rows.filter((r) => r.score !== null);
      expect(nonNullRows).toHaveLength(1);
      expect(nonNullRows[0].score).toBe(10);
    });

    it('should filter non-object items from static rows', async () => {
      const result = (await handler.execute(
        null,
        {
          mode: 'static',
          columns: [{ field: 'col0', label: 'Item' }],
          rows: [{ col0: 'valid' }, 'invalid', null, { col0: 'also valid' }],
        },
        context,
      )) as Record<string, unknown>;

      const rows = result.output.rows as Array<Record<string, unknown>>;
      expect(rows).toHaveLength(2);
      expect(rows[0]).toEqual({ col0: 'valid' });
      expect(rows[1]).toEqual({ col0: 'also valid' });
    });

    it('should validate sortBy against column fields', () => {
      const result = handler.validate({
        columns: [{ field: 'name', label: 'Name' }],
        sortBy: 'nonexistent',
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('sortBy');
    });

    it('should include totalRows in output', async () => {
      const result = (await handler.execute(
        [{ n: 1 }, { n: 2 }],
        { columns: [{ field: 'n', label: 'N' }] },
        context,
      )) as Record<string, unknown>;

      expect(result.output.totalRows).toBe(2);
    });

    // === Dot-path (nested field) access ===
    it('should support dot-path access for nested fields', async () => {
      const input = [
        { name: 'Alice', address: { city: 'Seoul', zip: '01234' } },
        { name: 'Bob', address: { city: 'Busan', zip: '56789' } },
      ];
      const result = (await handler.execute(
        input,
        {
          columns: [
            { field: 'name', label: 'Name' },
            { field: 'address.city', label: 'City' },
          ],
        },
        context,
      )) as Record<string, unknown>;

      const rows = result.output.rows as Array<Record<string, unknown>>;
      expect(rows[0]).toEqual({ name: 'Alice', 'address.city': 'Seoul' });
      expect(rows[1]).toEqual({ name: 'Bob', 'address.city': 'Busan' });
    });

    it('should return null for missing nested path', async () => {
      const result = (await handler.execute(
        [{ name: 'Alice' }],
        {
          columns: [{ field: 'address.city', label: 'City' }],
        },
        context,
      )) as Record<string, unknown>;

      const rows = result.output.rows as Array<Record<string, unknown>>;
      expect(rows[0]).toEqual({ 'address.city': null });
    });

    // === Per-item expression evaluation ===
    it('should evaluate per-item expressions with $sourceItem', async () => {
      const input = [
        { first: 'Alice', last: 'Kim' },
        { first: 'Bob', last: 'Lee' },
      ];
      const result = (await handler.execute(
        input,
        {
          columns: [
            {
              field: '{{ $sourceItem.first + " " + $sourceItem.last }}',
              label: 'Full Name',
            },
          ],
        },
        context,
      )) as Record<string, unknown>;

      const rows = result.output.rows as Array<Record<string, unknown>>;
      expect(rows[0]['{{ $sourceItem.first + " " + $sourceItem.last }}']).toBe(
        'Alice Kim',
      );
      expect(rows[1]['{{ $sourceItem.first + " " + $sourceItem.last }}']).toBe(
        'Bob Lee',
      );
    });

    it('should provide $sourceItemIndex in per-item expressions', async () => {
      const input = [{ name: 'A' }, { name: 'B' }];
      const result = (await handler.execute(
        input,
        {
          columns: [
            { field: '{{ $sourceItemIndex + 1 }}', label: '#' },
            { field: 'name', label: 'Name' },
          ],
        },
        context,
      )) as Record<string, unknown>;

      const rows = result.output.rows as Array<Record<string, unknown>>;
      expect(rows[0]['{{ $sourceItemIndex + 1 }}']).toBe(1);
      expect(rows[1]['{{ $sourceItemIndex + 1 }}']).toBe(2);
    });

    it('should provide $dataSource in per-item expressions', async () => {
      const input = [{ x: 1 }, { x: 2 }, { x: 3 }];
      const result = (await handler.execute(
        input,
        {
          columns: [{ field: '{{ $dataSource.length }}', label: 'Total' }],
        },
        context,
      )) as Record<string, unknown>;

      const rows = result.output.rows as Array<Record<string, unknown>>;
      expect(rows[0]['{{ $dataSource.length }}']).toBe(3);
    });

    it('should use dataSource with per-item expression', async () => {
      const resolvedDataSource = [
        { id: 1, score: 90 },
        { id: 2, score: 80 },
      ];
      const result = (await handler.execute(
        null,
        {
          mode: 'dynamic',
          dataSource: resolvedDataSource,
          columns: [
            { field: '{{ $sourceItem.id }}', label: 'ID' },
            { field: '{{ $sourceItem.score }}', label: 'Score' },
          ],
        },
        context,
      )) as Record<string, unknown>;

      const rows = result.output.rows as Array<Record<string, unknown>>;
      expect(rows[0]['{{ $sourceItem.id }}']).toBe(1);
      expect(rows[0]['{{ $sourceItem.score }}']).toBe(90);
    });

    it('should access $var in per-item expressions via expressionContext', async () => {
      const ctxWithExpr = {
        ...context,
        variables: { prefix: 'User' },
        expressionContext: { $var: { prefix: 'User' } },
      };
      const input = [{ name: 'Alice' }];
      const result = (await handler.execute(
        input,
        {
          columns: [
            {
              field: '{{ $var.prefix + ": " + $sourceItem.name }}',
              label: 'Name',
            },
          ],
        },
        ctxWithExpr,
      )) as Record<string, unknown>;

      const rows = result.output.rows as Array<Record<string, unknown>>;
      expect(rows[0]['{{ $var.prefix + ": " + $sourceItem.name }}']).toBe(
        'User: Alice',
      );
    });

    it('should evaluate arithmetic expressions with $sourceItem and $var', async () => {
      const ctxWithExpr = {
        ...context,
        variables: { a: 10 },
        expressionContext: { $var: { a: 10 } },
      };
      const input = [{ value: 2 }, { value: 5 }];
      const result = (await handler.execute(
        input,
        {
          columns: [
            {
              field: '{{ $sourceItem.value * $var.a }}',
              label: 'Result',
            },
          ],
        },
        ctxWithExpr,
      )) as Record<string, unknown>;

      const rows = result.output.rows as Array<Record<string, unknown>>;
      expect(rows[0]['{{ $sourceItem.value * $var.a }}']).toBe(20);
      expect(rows[1]['{{ $sourceItem.value * $var.a }}']).toBe(50);
    });

    it('should not use per-item evaluation in static mode', async () => {
      const result = (await handler.execute(
        null,
        {
          mode: 'static',
          columns: [{ field: 'col0', label: 'Item' }],
          rows: [{ col0: 'plain value' }],
        },
        context,
      )) as Record<string, unknown>;

      const rows = result.output.rows as Array<Record<string, unknown>>;
      expect(rows[0]).toEqual({ col0: 'plain value' });
    });

    // ENG-RC-* — Phase 3 raw-echo migration. Resolved column labels (label
    // expression evaluated) move from `config.columns` to `output.columns`;
    // `config.columns` keeps the raw label templates.
    it('puts raw column definitions on config and resolved labels on output', async () => {
      const rawColumns = [
        {
          field: 'name',
          label: '{{ $var.locale === "ko" ? "이름" : "Name" }}',
        },
      ];
      const evaluatedColumns = [{ field: 'name', label: 'Name' }];
      const result = (await handler.execute(
        [{ name: 'Alice' }],
        { mode: 'dynamic', columns: evaluatedColumns },
        {
          ...context,
          rawConfig: Object.freeze({ mode: 'dynamic', columns: rawColumns }),
        },
      )) as Record<string, unknown>;

      const cfg = result.config as Record<string, unknown>;
      const out = result.output as Record<string, unknown>;
      // config.columns keeps the raw label template
      expect(cfg.columns).toEqual(rawColumns);
      // output.columns surfaces the resolved (label-evaluated) columns. Since
      // the resolver pre-evaluated the label expression upstream of the test
      // (we passed `evaluatedColumns` as `config.columns`), the handler's
      // `resolveColumnLabels` no-ops on already-literal labels.
      expect(out.columns).toEqual(evaluatedColumns);
    });
  });

  describe('output cap (PRESENTATION_MAX_BYTES = 1MB)', () => {
    it('passes through rows unchanged when payload is under 1MB', async () => {
      const result = (await handler.execute(
        [
          { name: 'Alice', age: 30 },
          { name: 'Bob', age: 25 },
        ],
        {
          mode: 'dynamic',
          columns: [
            { field: 'name', label: 'Name' },
            { field: 'age', label: 'Age' },
          ],
        },
        context,
      )) as Record<string, unknown>;

      const out = result.output as Record<string, unknown>;
      expect((out.rows as unknown[]).length).toBe(2);
      expect(out.rowsTruncated).toBeUndefined();
      expect(out.rowsTotalCount).toBeUndefined();
      // totalRows always reflects the post-pageSize/sort dataset count.
      expect(out.totalRows).toBe(2);
    });

    it('truncates rows and surfaces rowsTruncated flag when payload exceeds 1MB', async () => {
      const heavy = 'y'.repeat(200 * 1024);
      const sourceRows = Array.from({ length: 6 }, (_, i) => ({
        idx: i,
        blob: heavy,
      }));

      const result = (await handler.execute(
        sourceRows,
        {
          mode: 'dynamic',
          columns: [
            { field: 'idx', label: 'Idx' },
            { field: 'blob', label: 'Blob' },
          ],
        },
        context,
      )) as Record<string, unknown>;

      const out = result.output as Record<string, unknown>;
      expect(out.rowsTruncated).toBe(true);
      expect(out.rowsTotalCount).toBe(6);
      // totalRows reflects the full dataset size (pre-cap) so observers see
      // the mismatch even without diffing rows.length.
      expect(out.totalRows).toBe(6);
      const rows = out.rows as Array<Record<string, unknown>>;
      expect(Array.isArray(rows)).toBe(true);
      expect(rows.length).toBeLessThan(6);
      expect(rows.length).toBeGreaterThan(0);
      expect(
        Buffer.byteLength(JSON.stringify(rows), 'utf8'),
      ).toBeLessThanOrEqual(1024 * 1024);
    });
  });
});
