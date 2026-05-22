import {
  RenderToolProvider,
  overlayDefaults,
  renderToolName,
} from './render-tool-provider';

const provider = new RenderToolProvider();

const buildCtx = (
  presentationTools: unknown[],
  extra: Record<string, unknown> = {},
) => ({
  config: { presentationTools, ...extra },
  workspaceId: 'ws-1',
  executionId: 'exec-1',
});

describe('RenderToolProvider.matches', () => {
  it('matches render_* tool names', () => {
    expect(provider.matches('render_table')).toBe(true);
    expect(provider.matches('render_chart')).toBe(true);
    expect(provider.matches('render_carousel')).toBe(true);
    expect(provider.matches('render_template')).toBe(true);
    expect(provider.matches('render_form')).toBe(true);
  });

  it('does not match other prefixes', () => {
    expect(provider.matches('kb_foo')).toBe(false);
    expect(provider.matches('mcp_abc__bar')).toBe(false);
    expect(provider.matches('cond_xyz')).toBe(false);
    expect(provider.matches('tool_xyz')).toBe(false);
    expect(provider.matches('rendered')).toBe(false);
  });
});

describe('renderToolName', () => {
  it('returns render_<type> without sanitization', () => {
    expect(renderToolName('table')).toBe('render_table');
    expect(renderToolName('chart')).toBe('render_chart');
    expect(renderToolName('form')).toBe('render_form');
  });
});

describe('overlayDefaults', () => {
  it('returns LLM value when defaults is undefined', () => {
    expect(overlayDefaults({ a: 1 }, undefined)).toEqual({ a: 1 });
  });

  it('replaces arrays entirely (defaults wins, no concat)', () => {
    expect(overlayDefaults([1, 2, 3], [9])).toEqual([9]);
  });

  it('deep-merges objects with defaults precedence', () => {
    const llm = {
      title: 'LLM title',
      columns: [{ field: 'x' }],
      pagination: { pageSize: 50 },
    };
    const defaults = {
      title: 'Brand title',
      pagination: { enabled: true, pageSize: 20 },
    };
    expect(overlayDefaults(llm, defaults)).toEqual({
      title: 'Brand title', // defaults wins
      columns: [{ field: 'x' }], // LLM survives (no default override)
      pagination: { enabled: true, pageSize: 20 }, // deep merge + defaults wins
    });
  });

  it('returns defaults primitive when set', () => {
    expect(overlayDefaults('llm', 'brand')).toBe('brand');
    expect(overlayDefaults(5, 10)).toBe(10);
  });

  it('returns LLM value when defaults is null (null treated as unset)', () => {
    // PresentationToolDef.defaults is Record<string,unknown>|undefined (never null).
    // overlayDefaults is exported and may be called externally — null should
    // behave like undefined (no-op) so LLM payload is not destroyed.
    expect(overlayDefaults({ a: 1 }, null)).toEqual({ a: 1 });
    expect(overlayDefaults('text', null)).toBe('text');
  });
});

describe('RenderToolProvider.buildTools', () => {
  it('returns empty array when presentationTools is empty (default OFF)', async () => {
    const tools = await provider.buildTools(buildCtx([]));
    expect(tools).toEqual([]);
  });

  it('emits one ToolDef per registered presentation type', async () => {
    const tools = await provider.buildTools(
      buildCtx([{ type: 'table' }, { type: 'chart' }]),
    );
    expect(tools.map((t) => t.name).sort()).toEqual([
      'render_chart',
      'render_table',
    ]);
  });

  it('uses description override when provided, else default copy', async () => {
    const tools = await provider.buildTools(
      buildCtx([
        { type: 'table', description: '주문 표 — rows만 채워라' },
        { type: 'chart' },
      ]),
    );
    const table = tools.find((t) => t.name === 'render_table')!;
    const chart = tools.find((t) => t.name === 'render_chart')!;
    expect(table.description).toBe('주문 표 — rows만 채워라');
    expect(chart.description).toContain('차트');
  });

  it('attaches JSON Schema parameters from the presentation node zod schema', async () => {
    const tools = await provider.buildTools(buildCtx([{ type: 'table' }]));
    expect(tools[0].parameters).toBeDefined();
    expect((tools[0].parameters as { type?: string }).type).toBe('object');
  });
});

describe('RenderToolProvider.execute — display-only', () => {
  it('renders table payload + emits presentationPayload + tool_result stub', async () => {
    const result = await provider.execute(
      {
        id: 'call_t1',
        name: 'render_table',
        arguments: JSON.stringify({
          mode: 'static',
          columns: [{ field: 'id', label: 'ID' }],
          rows: [{ id: '1' }, { id: '2' }],
        }),
      },
      { config: { presentationTools: [{ type: 'table' }] }, workspaceId: 'ws' },
    );

    expect(result.status).toBe('success');
    expect(JSON.parse(result.content)).toEqual({ ok: true });
    expect(result.presentationPayload).toBeDefined();
    expect(result.presentationPayload!.type).toBe('table');
    expect(result.presentationPayload!.toolCallId).toBe('call_t1');
    expect(result.presentationPayload!.payload).toMatchObject({
      rows: [{ id: '1' }, { id: '2' }],
    });
    expect(result.presentationCall).toMatchObject({
      toolName: 'render_table',
      toolCallId: 'call_t1',
      status: 'rendered',
    });
  });

  it('applies defaults overlay with defaults precedence', async () => {
    const result = await provider.execute(
      {
        id: 'call_t2',
        name: 'render_table',
        arguments: JSON.stringify({
          mode: 'static',
          columns: [{ field: 'x', label: 'X' }], // LLM tried, but defaults overrides
          rows: [{ x: '1' }],
        }),
      },
      {
        config: {
          presentationTools: [
            {
              type: 'table',
              defaults: { columns: [{ field: 'id', label: 'Brand ID' }] },
            },
          ],
        },
        workspaceId: 'ws',
      },
    );

    expect(result.status).toBe('success');
    const cols = (
      result.presentationPayload!.payload as { columns?: unknown[] }
    ).columns;
    expect(cols).toEqual([{ field: 'id', label: 'Brand ID' }]);
  });

  it('returns INVALID_PAYLOAD on JSON parse error', async () => {
    const result = await provider.execute(
      { id: 'call_bad', name: 'render_table', arguments: 'not json' },
      { config: { presentationTools: [{ type: 'table' }] }, workspaceId: 'ws' },
    );
    expect(result.status).toBe('error');
    expect(JSON.parse(result.content)).toMatchObject({
      error: 'INVALID_PAYLOAD',
    });
    expect(result.presentationSchemaViolation).toBeDefined();
    expect(result.presentationCall?.status).toBe('schema_violation');
  });

  it('presentationSchemaViolation includes toolCallId for spec §7.10 join', async () => {
    const result = await provider.execute(
      { id: 'call_tc99', name: 'render_table', arguments: 'not json' },
      { config: { presentationTools: [{ type: 'table' }] }, workspaceId: 'ws' },
    );
    expect(result.presentationSchemaViolation?.toolCallId).toBe('call_tc99');
  });

  it('returns INVALID_PAYLOAD when the tool is not registered (hallucination)', async () => {
    const result = await provider.execute(
      {
        id: 'call_h',
        name: 'render_table',
        arguments: JSON.stringify({ mode: 'static', columns: [], rows: [] }),
      },
      { config: { presentationTools: [] }, workspaceId: 'ws' }, // no tools registered
    );
    expect(result.status).toBe('error');
    expect(result.presentationSchemaViolation?.issues[0]).toContain(
      'not registered',
    );
  });

  it('caps oversized table.rows with tail truncation + truncation meta', async () => {
    const bigRow = { id: 'x', payload: 'A'.repeat(1024) }; // ~1KB
    const rows = Array.from({ length: 2000 }, () => bigRow); // ~2MB

    const result = await provider.execute(
      {
        id: 'call_big',
        name: 'render_table',
        arguments: JSON.stringify({
          mode: 'static',
          columns: [{ field: 'id', label: 'ID' }],
          rows,
        }),
      },
      { config: { presentationTools: [{ type: 'table' }] }, workspaceId: 'ws' },
    );

    expect(result.status).toBe('success');
    const truncation = result.presentationPayload!.truncation;
    expect(truncation?.rowsTruncated).toBe(true);
    expect(truncation?.rowsTotalCount).toBe(2000);
    const finalRows = (
      result.presentationPayload!.payload as { rows: unknown[] }
    ).rows;
    expect(finalRows.length).toBeLessThan(2000);
  });

  it('returns schema_violation for oversized render_chart (no truncatable array)', async () => {
    // chart has no array to tail-truncate; 1MB+ payload must be schema_violation.
    // Build a chart payload that definitely exceeds 1MB via a large title field
    // (chartConfigSchema uses .passthrough() so extra keys survive validation).
    const bigTitle = 'T'.repeat(1024 * 1024 + 100); // ~1MB string
    const result = await provider.execute(
      {
        id: 'call_chart_big',
        name: 'render_chart',
        arguments: JSON.stringify({
          chartType: 'bar',
          title: bigTitle,
        }),
      },
      { config: { presentationTools: [{ type: 'chart' }] }, workspaceId: 'ws' },
    );

    expect(result.status).toBe('error');
    expect(result.presentationCall?.status).toBe('schema_violation');
    const parsed = JSON.parse(result.content) as { error: string; issues: string[] };
    expect(parsed.error).toBe('INVALID_PAYLOAD');
    expect(parsed.issues[0]).toMatch(/1MB cap/);
  });
});

describe('RenderToolProvider.execute — render_form interactive', () => {
  it('emits blockingFormRender signal for multi_turn render_form', async () => {
    const result = await provider.execute(
      {
        id: 'call_f1',
        name: 'render_form',
        arguments: JSON.stringify({
          fields: [{ name: 'email', type: 'email', label: 'Email' }],
          title: 'Please provide your email',
        }),
      },
      {
        config: { mode: 'multi_turn', presentationTools: [{ type: 'form' }] },
        workspaceId: 'ws',
      },
    );

    expect(result.status).toBe('success');
    expect(result.blockingFormRender).toBeDefined();
    expect(result.blockingFormRender!.toolCallId).toBe('call_f1');
    expect(result.blockingFormRender!.formConfig).toMatchObject({
      title: 'Please provide your email',
    });
    expect(result.presentationCall?.status).toBe('form_pending');
  });

  it('silent-drops render_form in single_turn mode (spec §6.1.d.ii)', async () => {
    const result = await provider.execute(
      {
        id: 'call_f_st',
        name: 'render_form',
        arguments: JSON.stringify({
          fields: [{ name: 'email', type: 'email', label: 'Email' }],
          title: 't',
        }),
      },
      {
        config: { mode: 'single_turn', presentationTools: [{ type: 'form' }] },
        workspaceId: 'ws',
      },
    );

    expect(result.status).toBe('error');
    expect(result.blockingFormRender).toBeUndefined();
    expect(result.presentationSchemaViolation?.issues[0]).toContain(
      'single_turn',
    );
  });
});
