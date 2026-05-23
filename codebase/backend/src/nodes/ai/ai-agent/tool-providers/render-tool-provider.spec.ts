import {
  RenderToolProvider,
  backfillButtonUuids,
  overlayDefaults,
  renderToolName,
} from './render-tool-provider';

// RFC 4122 v4 UUID. Used to assert backfill output without coupling to
// crypto.randomUUID implementation details — only that the result is a
// well-formed UUID v4 string.
const UUID_V4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

  // Regression: user adds a presentationTools row in the settings panel
  // field-array widget but hasn't picked a `type` from the dropdown yet.
  // The engine read config before zod re-parsed → `type: undefined` reaches
  // buildTools and `z.toJSONSchema(undefined)` throws
  // `Cannot use 'in' operator to search for '_idmap' in undefined`.
  it('skips entries with missing/invalid type instead of throwing', async () => {
    const tools = await provider.buildTools(
      buildCtx([
        { type: undefined } as any,

        { type: '' } as any,

        { type: 'bogus' } as any,
        { type: 'table' },
      ]),
    );
    // Only the valid `table` entry should produce a ToolDef.
    expect(tools.map((t) => t.name)).toEqual(['render_table']);
  });

  it('survives null / non-object entries in presentationTools (partial config)', async () => {
    const tools = await provider.buildTools(
      buildCtx([null as any, undefined as any, { type: 'chart' }]),
    );
    expect(tools.map((t) => t.name)).toEqual(['render_chart']);
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
    // tool_result content carries a rich success payload so the LLM doesn't
    // loop ("ok:true 받고도 사용자에게 보였는지 확신 못 해 재호출" 회귀).
    expect(JSON.parse(result.content)).toMatchObject({
      ok: true,
      rendered: true,
      type: 'table',
    });
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

  // ai-review SUMMARY #7 — applyOneMbCap 이 이진 탐색으로 동작하는지 검증.
  it('caps oversized carousel.items via binary-search truncation', async () => {
    const bigItem = {
      title: 'Item',
      description: 'X'.repeat(1024),
    }; // ~1KB
    const items = Array.from({ length: 2000 }, () => bigItem); // ~2MB

    const result = await provider.execute(
      {
        id: 'call_big_c',
        name: 'render_carousel',
        arguments: JSON.stringify({
          mode: 'static',
          layout: 'card',
          items,
        }),
      },
      {
        config: { presentationTools: [{ type: 'carousel' }] },
        workspaceId: 'ws',
      },
    );

    expect(result.status).toBe('success');
    const truncation = result.presentationPayload!.truncation;
    expect(truncation?.itemsTruncated).toBe(true);
    expect(truncation?.itemsTotalCount).toBe(2000);
    const finalItems = (
      result.presentationPayload!.payload as { items: unknown[] }
    ).items;
    expect(finalItems.length).toBeLessThan(2000);
    expect(finalItems.length).toBeGreaterThan(0);
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
    const parsed = JSON.parse(result.content) as {
      error: string;
      issues: string[];
    };
    expect(parsed.error).toBe('INVALID_PAYLOAD');
    expect(parsed.issues[0]).toMatch(/1MB cap/);
  });
});

// spec/4-nodes/6-presentation/0-common.md §10.5 step 3 — button.id UUID v4
// backfill. Backend SoT for the "id: 자동 생성, 불변" 원칙 (§1) in LLM tool
// mode. Frontend defense-in-depth (`selectedButtonId != null` 가드) handles
// the legacy / non-AI-Agent surfaces; backend backfill is the canonical fix
// so that downstream consumers (thread query, future surfaces) see canonical
// button.id even on LLM-emitted payloads.
describe('backfillButtonUuids (spec §10.5 step 3)', () => {
  it('fills missing id on carousel items[].buttons with unique UUID v4', () => {
    const payload = {
      mode: 'static',
      items: [
        {
          title: 'Item A',
          buttons: [
            { label: 'Inquire', type: 'port' },
            { label: 'Order', type: 'port' },
          ],
        },
        {
          title: 'Item B',
          buttons: [{ label: 'Inquire', type: 'port' }],
        },
      ],
    };

    const out = backfillButtonUuids('carousel', payload) as {
      items: Array<{ buttons: Array<{ id: string }> }>;
    };

    const ids = out.items.flatMap((it) => it.buttons.map((b) => b.id));
    expect(ids).toHaveLength(3);
    for (const id of ids) expect(id).toMatch(UUID_V4_RE);
    expect(new Set(ids).size).toBe(3); // all unique
  });

  it('fills missing id on carousel global buttons + itemButtons', () => {
    const payload = {
      mode: 'static',
      items: [{ title: 'A' }],
      buttons: [{ label: 'Approve', type: 'port' }],
      itemButtons: [{ label: 'Select', type: 'port' }],
    };

    const out = backfillButtonUuids('carousel', payload) as {
      buttons: Array<{ id: string }>;
      itemButtons: Array<{ id: string }>;
    };

    expect(out.buttons[0].id).toMatch(UUID_V4_RE);
    expect(out.itemButtons[0].id).toMatch(UUID_V4_RE);
    expect(out.buttons[0].id).not.toBe(out.itemButtons[0].id);
  });

  it('fills missing id on table / chart / template global buttons', () => {
    const tablePayload = {
      mode: 'static',
      columns: [{ field: 'id', label: 'ID' }],
      rows: [{ id: '1' }],
      buttons: [{ label: 'Export', type: 'port' }],
    };
    const tableOut = backfillButtonUuids('table', tablePayload) as {
      buttons: Array<{ id: string }>;
    };
    expect(tableOut.buttons[0].id).toMatch(UUID_V4_RE);

    const templatePayload = {
      content: 'Hello',
      outputFormat: 'text',
      buttons: [{ label: 'More', type: 'port' }],
    };
    const templateOut = backfillButtonUuids('template', templatePayload) as {
      buttons: Array<{ id: string }>;
    };
    expect(templateOut.buttons[0].id).toMatch(UUID_V4_RE);

    const chartPayload = {
      chartType: 'bar',
      data: [{ x: 'a', y: 1 }],
      buttons: [{ label: 'Drill', type: 'port' }],
    };
    const chartOut = backfillButtonUuids('chart', chartPayload) as {
      buttons: Array<{ id: string }>;
    };
    expect(chartOut.buttons[0].id).toMatch(UUID_V4_RE);
  });

  it('preserves user-supplied button.id', () => {
    const preset = '11111111-2222-4333-8444-555555555555';
    const payload = {
      mode: 'static',
      items: [
        {
          title: 'Item A',
          buttons: [
            { id: preset, label: 'Keep me', type: 'port' },
            { label: 'Backfill me', type: 'port' },
          ],
        },
      ],
    };

    const out = backfillButtonUuids('carousel', payload) as {
      items: Array<{ buttons: Array<{ id: string }> }>;
    };

    expect(out.items[0].buttons[0].id).toBe(preset);
    expect(out.items[0].buttons[1].id).toMatch(UUID_V4_RE);
    expect(out.items[0].buttons[1].id).not.toBe(preset);
  });

  it('is a no-op for form payloads (no button concept)', () => {
    const payload = {
      fields: [{ name: 'email', type: 'email', label: 'Email' }],
    };
    const out = backfillButtonUuids('form', payload);
    expect(out).toEqual(payload);
  });

  it('does not crash on payload without buttons arrays', () => {
    expect(backfillButtonUuids('carousel', { mode: 'static', items: [] })).toEqual(
      { mode: 'static', items: [] },
    );
    expect(
      backfillButtonUuids('table', { mode: 'static', columns: [], rows: [] }),
    ).toEqual({ mode: 'static', columns: [], rows: [] });
  });

  it('handles items with missing/non-array buttons field gracefully', () => {
    const payload = {
      mode: 'static',
      items: [
        { title: 'A' }, // no buttons key
        { title: 'B', buttons: undefined as unknown as unknown[] },
        { title: 'C', buttons: [{ label: 'Go', type: 'port' }] },
      ],
    };
    const out = backfillButtonUuids('carousel', payload) as {
      items: Array<{ buttons?: Array<{ id?: string }> }>;
    };
    expect(out.items[0].buttons).toBeUndefined();
    expect(out.items[1].buttons).toBeUndefined();
    expect(out.items[2].buttons![0].id).toMatch(UUID_V4_RE);
  });
});

describe('RenderToolProvider.execute — backfill integration (spec §10.5 step 3)', () => {
  it('emits carousel payload with UUID v4 ids on per-item buttons that LLM left blank', async () => {
    const result = await provider.execute(
      {
        id: 'call_c_bf',
        name: 'render_carousel',
        arguments: JSON.stringify({
          mode: 'static',
          layout: 'card',
          items: [
            {
              title: '샘플상품 3',
              description: '가격: 10,000원',
              buttons: [
                { label: '문의하기', type: 'port' },
                { label: '주문하기', type: 'port' },
              ],
            },
            {
              title: '샘플상품 1',
              description: '가격: 5,000원',
              buttons: [
                { label: '문의하기', type: 'port' },
                { label: '주문하기', type: 'port' },
              ],
            },
          ],
        }),
      },
      {
        config: { presentationTools: [{ type: 'carousel' }] },
        workspaceId: 'ws',
      },
    );

    expect(result.status).toBe('success');
    const payload = result.presentationPayload!.payload as {
      items: Array<{ buttons: Array<{ id: string }> }>;
    };
    const ids = payload.items.flatMap((it) => it.buttons.map((b) => b.id));
    expect(ids).toHaveLength(4);
    for (const id of ids) expect(id).toMatch(UUID_V4_RE);
    expect(new Set(ids).size).toBe(4); // all unique across items
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
