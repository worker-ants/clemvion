import {
  RenderToolProvider,
  backfillButtonUuids,
  backfillFormOptionValues,
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

  it.each([
    [
      'table',
      {
        mode: 'static',
        columns: [{ field: 'id', label: 'ID' }],
        rows: [{ id: '1' }],
        buttons: [{ label: 'Export', type: 'port' }],
      },
    ],
    [
      'template',
      {
        content: 'Hello',
        outputFormat: 'text',
        buttons: [{ label: 'More', type: 'port' }],
      },
    ],
    [
      'chart',
      {
        chartType: 'bar',
        data: [{ x: 'a', y: 1 }],
        buttons: [{ label: 'Drill', type: 'port' }],
      },
    ],
  ] as const)('fills missing id on %s global buttons', (type, payload) => {
    const out = backfillButtonUuids(type, payload) as {
      buttons: Array<{ id: string }>;
    };
    expect(out.buttons[0].id).toMatch(UUID_V4_RE);
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
    expect(
      backfillButtonUuids('carousel', { mode: 'static', items: [] }),
    ).toEqual({ mode: 'static', items: [] });
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

describe('backfillButtonUuids — userMessage preservation (spec §10.8, SUMMARY#10)', () => {
  it('preserves userMessage field on carousel global buttons through backfill', () => {
    const payload = {
      mode: 'static',
      items: [{ title: 'A' }],
      buttons: [
        { label: 'Approve', type: 'port', userMessage: 'Custom approve' },
      ],
    };
    const out = backfillButtonUuids('carousel', payload) as {
      buttons: Array<{ id: string; userMessage?: string }>;
    };
    expect(out.buttons[0].id).toMatch(UUID_V4_RE);
    expect(out.buttons[0].userMessage).toBe('Custom approve');
  });

  it('preserves userMessage field on carousel items[].buttons through backfill', () => {
    const payload = {
      mode: 'static',
      items: [
        {
          title: 'Sample 1',
          buttons: [
            { label: '문의하기', type: 'port', userMessage: 'Sample 1 문의' },
          ],
        },
      ],
    };
    const out = backfillButtonUuids('carousel', payload) as {
      items: Array<{ buttons: Array<{ id: string; userMessage?: string }> }>;
    };
    expect(out.items[0].buttons[0].id).toMatch(UUID_V4_RE);
    expect(out.items[0].buttons[0].userMessage).toBe('Sample 1 문의');
  });

  it('backfillButtonUuids does not strip userMessage when id is already set', () => {
    // Regression guard: backfill must not delete userMessage on buttons that
    // already have a user-supplied id.
    const presetId = '11111111-2222-4333-8444-666666666666';
    const payload = {
      mode: 'static',
      items: [{ title: 'A' }],
      buttons: [
        { id: presetId, label: 'Approve', type: 'port', userMessage: 'Kept' },
      ],
    };
    const out = backfillButtonUuids('carousel', payload) as {
      buttons: Array<{ id: string; userMessage?: string }>;
    };
    expect(out.buttons[0].id).toBe(presetId);
    expect(out.buttons[0].userMessage).toBe('Kept');
  });
});

describe('RenderToolProvider.execute — userMessage preservation (SUMMARY#10)', () => {
  it('render_carousel execute preserves button.userMessage in presentationPayload', async () => {
    const result = await provider.execute(
      {
        id: 'call_um_1',
        name: 'render_carousel',
        arguments: JSON.stringify({
          mode: 'static',
          layout: 'card',
          items: [
            {
              title: '샘플상품 1',
              buttons: [
                {
                  label: '문의하기',
                  type: 'port',
                  userMessage: '샘플상품 1 에 대해 문의하고 싶습니다',
                },
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
      items: Array<{
        buttons: Array<{ userMessage?: string }>;
      }>;
    };
    expect(payload.items[0].buttons[0].userMessage).toBe(
      '샘플상품 1 에 대해 문의하고 싶습니다',
    );
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

describe('backfillFormOptionValues (spec §10.5 step 4)', () => {
  it('is a no-op for non-form types', () => {
    const payload = { mode: 'static', items: [] };
    expect(backfillFormOptionValues('carousel', payload)).toEqual(payload);
    expect(backfillFormOptionValues('table', payload)).toEqual(payload);
    expect(backfillFormOptionValues('chart', payload)).toEqual(payload);
    expect(backfillFormOptionValues('template', payload)).toEqual(payload);
  });

  it('fills missing option values with deterministic opt-{fieldIdx}-{optIdx} fallback', () => {
    // LLM emits options without `value` → zod default fills with '' → all
    // options collide. backfill replaces empty value with deterministic id.
    const payload = {
      fields: [
        {
          name: 'inquiryType',
          type: 'select',
          label: '문의 유형',
          options: [
            { label: '주문 문의' }, // value missing
            { label: '교환/환불' },
            { label: '기타' },
          ],
        },
      ],
    };
    const out = backfillFormOptionValues('form', payload) as {
      fields: Array<{
        options: Array<{ label: string; value: string }>;
      }>;
    };
    expect(out.fields[0].options[0].value).toBe('opt-0-0');
    expect(out.fields[0].options[1].value).toBe('opt-0-1');
    expect(out.fields[0].options[2].value).toBe('opt-0-2');
    // Original labels preserved.
    expect(out.fields[0].options[0].label).toBe('주문 문의');
  });

  it('treats empty-string value as missing (PR root cause — zod default fills empty)', () => {
    const payload = {
      fields: [
        {
          name: 'pick',
          type: 'select',
          options: [
            { label: 'A', value: '' },
            { label: 'B', value: '' },
          ],
        },
      ],
    };
    const out = backfillFormOptionValues('form', payload) as {
      fields: Array<{ options: Array<{ value: string }> }>;
    };
    expect(out.fields[0].options[0].value).toBe('opt-0-0');
    expect(out.fields[0].options[1].value).toBe('opt-0-1');
  });

  it('preserves user-supplied (LLM-emitted) non-empty option values', () => {
    const payload = {
      fields: [
        {
          name: 'pick',
          type: 'select',
          options: [
            { label: 'A', value: 'preset-a' },
            { label: 'B', value: 'preset-b' },
          ],
        },
      ],
    };
    const out = backfillFormOptionValues('form', payload) as {
      fields: Array<{ options: Array<{ value: string }> }>;
    };
    expect(out.fields[0].options[0].value).toBe('preset-a');
    expect(out.fields[0].options[1].value).toBe('preset-b');
  });

  it('treats null / undefined option values as missing', () => {
    const payload = {
      fields: [
        {
          name: 'pick',
          type: 'select',
          options: [
            { label: 'A', value: null },
            { label: 'B', value: undefined },
            { label: 'C' }, // value field absent
          ],
        },
      ],
    };
    const out = backfillFormOptionValues('form', payload) as {
      fields: Array<{ options: Array<{ value: string }> }>;
    };
    expect(out.fields[0].options[0].value).toBe('opt-0-0');
    expect(out.fields[0].options[1].value).toBe('opt-0-1');
    expect(out.fields[0].options[2].value).toBe('opt-0-2');
  });

  it('preserves typed (number / boolean) option values — type drift handled by frontend coerce', () => {
    const payload = {
      fields: [
        {
          name: 'pick',
          type: 'select',
          options: [
            { label: 'Zero', value: 0 },
            { label: 'False', value: false },
            { label: 'One', value: 1 },
          ],
        },
      ],
    };
    const out = backfillFormOptionValues('form', payload) as {
      fields: Array<{ options: Array<{ value: unknown }> }>;
    };
    // Numbers / booleans are kept as-is; frontend uses String(value) coerce
    // (spec §10.5 step 4 SSOT 4-layer alignment).
    expect(out.fields[0].options[0].value).toBe(0);
    expect(out.fields[0].options[1].value).toBe(false);
    expect(out.fields[0].options[2].value).toBe(1);
  });

  it('disambiguates between fields — opt-{fieldIdx}-{optIdx} uses field index', () => {
    const payload = {
      fields: [
        {
          name: 'firstField',
          type: 'select',
          options: [{ label: 'A' }, { label: 'B' }],
        },
        {
          name: 'secondField',
          type: 'radio',
          options: [{ label: 'X' }, { label: 'Y' }],
        },
      ],
    };
    const out = backfillFormOptionValues('form', payload) as {
      fields: Array<{ options: Array<{ value: string }> }>;
    };
    expect(out.fields[0].options[0].value).toBe('opt-0-0');
    expect(out.fields[0].options[1].value).toBe('opt-0-1');
    expect(out.fields[1].options[0].value).toBe('opt-1-0');
    expect(out.fields[1].options[1].value).toBe('opt-1-1');
  });

  it('skips fields without options array (text / number / email / textarea / date / file / checkbox)', () => {
    const payload = {
      fields: [
        { name: 'plain', type: 'text', label: 'Plain' },
        { name: 'num', type: 'number', label: 'Num' },
        { name: 'pick', type: 'select', options: [{ label: 'A' }] },
        { name: 'agree', type: 'checkbox' }, // no options
      ],
    };
    const out = backfillFormOptionValues('form', payload) as {
      fields: Array<{ options?: Array<{ value?: string }> }>;
    };
    expect(out.fields[0].options).toBeUndefined();
    expect(out.fields[1].options).toBeUndefined();
    expect(out.fields[2].options?.[0].value).toBe('opt-2-0');
    expect(out.fields[3].options).toBeUndefined();
  });

  it('returns the original payload reference when no fields needed backfill (no-op fast path)', () => {
    const payload = {
      fields: [
        {
          name: 'pick',
          type: 'select',
          options: [
            { label: 'A', value: 'a' },
            { label: 'B', value: 'b' },
          ],
        },
      ],
    };
    const out = backfillFormOptionValues('form', payload);
    expect(out).toBe(payload);
  });

  it('does not crash on missing fields array', () => {
    expect(backfillFormOptionValues('form', { title: 'No fields' })).toEqual({
      title: 'No fields',
    });
    expect(backfillFormOptionValues('form', { fields: null })).toEqual({
      fields: null,
    });
  });

  it('handles non-object option entries gracefully (LLM may emit primitives)', () => {
    const payload = {
      fields: [
        {
          name: 'pick',
          type: 'select',
          options: [
            'string-not-object', // primitive — pass through
            { label: 'B' }, // empty value — backfill
            null, // null — pass through
          ],
        },
      ],
    };
    const out = backfillFormOptionValues('form', payload) as {
      fields: Array<{ options: unknown[] }>;
    };
    expect(out.fields[0].options[0]).toBe('string-not-object');
    expect((out.fields[0].options[1] as { value: string }).value).toBe(
      'opt-0-1',
    );
    expect(out.fields[0].options[2]).toBe(null);
  });

  it('is idempotent — re-applying backfill on already-filled payload returns same reference (W#3)', () => {
    // JSDoc states: "Side-effect-free — 적어도 하나의 옵션이 갱신될 때만 새
    // payload 참조를 반환." Re-applying to an already-backfilled payload must
    // return the identical reference (no-op fast path).
    const payload = {
      fields: [
        {
          name: 'pick',
          type: 'select',
          options: [
            { label: 'A' }, // needs backfill
            { label: 'B' }, // needs backfill
          ],
        },
      ],
    };

    const once = backfillFormOptionValues('form', payload);
    // first call must have changed reference
    expect(once).not.toBe(payload);

    // second call: all values are now non-empty → no-op fast path → same ref
    const twice = backfillFormOptionValues('form', once);
    expect(twice).toBe(once);
  });

  it('skips field entries that are primitives (non-object field in fields array) (W#4)', () => {
    // Guard for code path: `if (field === null || typeof field !== 'object') return field`
    const payload = {
      fields: [
        'primitive-field-entry', // primitive — pass through unchanged
        42, // number — pass through
        null, // null — pass through
        {
          name: 'pick',
          type: 'select',
          options: [{ label: 'A' }], // gets backfilled
        },
      ],
    };
    const out = backfillFormOptionValues('form', payload) as {
      fields: Array<unknown>;
    };
    expect(out.fields[0]).toBe('primitive-field-entry');
    expect(out.fields[1]).toBe(42);
    expect(out.fields[2]).toBe(null);
    expect(
      (out.fields[3] as { options: Array<{ value: string }> }).options[0].value,
    ).toBe('opt-3-0');
  });
});

describe('RenderToolProvider.execute — backfillFormOptionValues integration (spec §10.5 step 4)', () => {
  it('render_form execute backfills missing option values before push to blockingFormRender', async () => {
    const result = await provider.execute(
      {
        id: 'call_f_opt',
        name: 'render_form',
        arguments: JSON.stringify({
          title: '상품 문의 작성',
          fields: [
            {
              name: 'inquiryType',
              type: 'select',
              label: '문의 유형',
              required: true,
              options: [
                { label: '주문 문의' },
                { label: '교환/환불' },
                { label: '기타' },
              ],
            },
            {
              name: 'message',
              type: 'textarea',
              label: '문의 내용',
              required: true,
            },
          ],
        }),
      },
      {
        config: { mode: 'multi_turn', presentationTools: [{ type: 'form' }] },
        workspaceId: 'ws',
      },
    );

    expect(result.status).toBe('success');
    expect(result.blockingFormRender).toBeDefined();
    const formConfig = result.blockingFormRender!.formConfig as {
      fields: Array<{
        options?: Array<{ label: string; value: string }>;
      }>;
    };
    expect(formConfig.fields[0].options?.[0].value).toBe('opt-0-0');
    expect(formConfig.fields[0].options?.[1].value).toBe('opt-0-1');
    expect(formConfig.fields[0].options?.[2].value).toBe('opt-0-2');
    // Labels preserved verbatim.
    expect(formConfig.fields[0].options?.[0].label).toBe('주문 문의');
    expect(formConfig.fields[0].options?.[1].label).toBe('교환/환불');
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
    // spec/4-nodes/3-ai/1-ai-agent.md §6.1.d.ii + §12.5 — active form 의 UI
    // 단일 진실은 assistant turn 의 `presentations[*].form` payload. 본
    // payload 가 ai-agent.handler 의 `presentationPayloads` 누적기로 push 되어
    // turn 끝의 `pushAiThreadTurn` 가 assistant turn 의 top-level
    // `presentations[]` 에 부착할 수 있어야 한다. frontend 의
    // `AssistantPresentationsBlock` 이 timeline 인라인으로 form 을 렌더하는
    // root identifier 가 본 payload 의 `toolCallId`.
    expect(result.presentationPayload).toBeDefined();
    expect(result.presentationPayload!.type).toBe('form');
    expect(result.presentationPayload!.toolCallId).toBe('call_f1');
    expect(result.presentationPayload!.payload).toMatchObject({
      title: 'Please provide your email',
      fields: [{ name: 'email', type: 'email', label: 'Email' }],
    });
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
