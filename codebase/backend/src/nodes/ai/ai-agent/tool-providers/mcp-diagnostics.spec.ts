import {
  McpServerSummary,
  McpDiagnosticError,
  McpDiagnosticsAccumulator,
  classifyMcpCall,
  createMcpDiagnosticsAccumulator,
  finalizeMcpDiagnostics,
  pushMcpDiagnosticError,
  pushMcpServerSummary,
} from './mcp-diagnostics';

describe('pushMcpServerSummary', () => {
  const entry: McpServerSummary = {
    integrationId: 'i-1',
    serviceType: 'mcp',
    status: 'connected',
    toolCount: 3,
  };

  it('배열이 있으면 entry 를 append 한다', () => {
    const acc: McpServerSummary[] = [];
    pushMcpServerSummary(acc, entry);
    expect(acc).toEqual([entry]);
    pushMcpServerSummary(acc, { ...entry, integrationId: 'i-2', toolCount: 0 });
    expect(acc).toHaveLength(2);
  });

  it('acc 가 undefined 면 no-op (throw 없음)', () => {
    expect(() => pushMcpServerSummary(undefined, entry)).not.toThrow();
  });

  it('skipped entry 는 skipReason 과 함께 누적된다', () => {
    const acc: McpServerSummary[] = [];
    pushMcpServerSummary(acc, {
      integrationId: 'i-3',
      serviceType: 'mcp',
      status: 'skipped',
      skipReason: 'error',
      toolCount: 0,
    });
    expect(acc[0]).toMatchObject({ status: 'skipped', skipReason: 'error' });
  });
});

describe('pushMcpDiagnosticError', () => {
  const err: McpDiagnosticError = {
    integrationId: 'i-1',
    phase: 'tools/list',
    code: 'MCP_TIMEOUT',
    message: 'tools/list timed out after 10000ms',
  };

  it('배열이 있으면 error entry 를 append 한다', () => {
    const acc: McpDiagnosticError[] = [];
    pushMcpDiagnosticError(acc, err);
    expect(acc).toEqual([err]);
  });

  it('acc 가 undefined 면 no-op', () => {
    expect(() => pushMcpDiagnosticError(undefined, err)).not.toThrow();
  });
});

describe('classifyMcpCall', () => {
  it('일반 MCP 도구는 tool 로 분류', () => {
    expect(classifyMcpCall('mcp_abcd1234__get_orders')).toBe('tool');
  });

  it('read_resource 메타도구는 resource_read', () => {
    expect(classifyMcpCall('mcp_abcd1234__read_resource')).toBe(
      'resource_read',
    );
  });

  it('get_prompt 메타도구는 prompt_get', () => {
    expect(classifyMcpCall('mcp_abcd1234__get_prompt')).toBe('prompt_get');
  });

  it('list_resources / list_prompts (discovery) 는 미집계(null)', () => {
    expect(classifyMcpCall('mcp_abcd1234__list_resources')).toBeNull();
    expect(classifyMcpCall('mcp_abcd1234__list_prompts')).toBeNull();
  });

  it('mcp_ prefix 가 아니면 null (kb_/render_/cond_)', () => {
    expect(classifyMcpCall('kb_workspace_main')).toBeNull();
    expect(classifyMcpCall('render_form')).toBeNull();
    expect(classifyMcpCall('cond_1')).toBeNull();
  });

  it('sanitize 된 tool 이름에 언더스코어가 있어도 첫 __ 로 분리', () => {
    // sid 는 __ 를 포함하지 않으므로 첫 __ 뒤 전체가 identifier.
    expect(classifyMcpCall('mcp_abcd1234__some_tool_name')).toBe('tool');
    // identifier 자체가 read_resource 와 정확히 일치할 때만 메타로 판정.
    expect(classifyMcpCall('mcp_abcd1234__read_resource_x')).toBe('tool');
  });

  it('__ 미포함 mcp_ 이름(비정상)은 방어적으로 tool 로 분류 (실무상 미도달)', () => {
    // executor 는 buildTools 가 만든 `mcp_<sid>__<tool>` 만 넘기므로 __ 없는
    // 이름은 도달하지 않는다. 도달해도 카운터를 깨지 않도록 tool 기본값 고정.
    expect(classifyMcpCall('mcp_abcd1234')).toBe('tool');
  });
});

describe('finalizeMcpDiagnostics', () => {
  it('acc 가 undefined 면 undefined', () => {
    expect(finalizeMcpDiagnostics(undefined)).toBeUndefined();
  });

  it('아무 것도 시도 안 됐으면 undefined (meta lean 유지)', () => {
    expect(
      finalizeMcpDiagnostics(createMcpDiagnosticsAccumulator()),
    ).toBeUndefined();
  });

  it('connected + skipped 요약과 counters·errors 를 전체 구조로 emit', () => {
    const acc: McpDiagnosticsAccumulator = createMcpDiagnosticsAccumulator();
    pushMcpServerSummary(acc.serverSummaries, {
      integrationId: 'i-a',
      serviceType: 'cafe24',
      status: 'connected',
      toolCount: 18,
    });
    pushMcpServerSummary(acc.serverSummaries, {
      integrationId: 'i-b',
      serviceType: 'mcp',
      status: 'skipped',
      skipReason: 'error',
      toolCount: 0,
    });
    pushMcpDiagnosticError(acc.errors, {
      integrationId: 'i-b',
      phase: 'tools/list',
      code: 'MCP_TIMEOUT',
      message: '...',
    });
    acc.toolCalls = 4;
    acc.resourceReads = 1;

    const out = finalizeMcpDiagnostics(acc);
    expect(out).toEqual({
      attempted: true,
      serverCount: 1, // connected 1건만
      toolCalls: 4,
      resourceReads: 1,
      promptGets: 0,
      serverSummaries: acc.serverSummaries,
      errors: acc.errors,
    });
  });

  it('errors 는 비어도 항상 [] 로 포함 (안정 shape, §7.1)', () => {
    const acc = createMcpDiagnosticsAccumulator();
    pushMcpServerSummary(acc.serverSummaries, {
      integrationId: 'i-a',
      serviceType: 'mcp',
      status: 'connected',
      toolCount: 2,
    });
    const out = finalizeMcpDiagnostics(acc);
    expect(out?.errors).toEqual([]);
  });

  it('connected 여러 건 + skipped 혼재 시 serverCount 는 connected 만 센다', () => {
    const acc = createMcpDiagnosticsAccumulator();
    pushMcpServerSummary(acc.serverSummaries, {
      integrationId: 'i-a',
      serviceType: 'mcp',
      status: 'connected',
      toolCount: 2,
    });
    pushMcpServerSummary(acc.serverSummaries, {
      integrationId: 'i-b',
      serviceType: 'cafe24',
      status: 'connected',
      toolCount: 5,
    });
    pushMcpServerSummary(acc.serverSummaries, {
      integrationId: 'i-c',
      serviceType: 'mcp',
      status: 'skipped',
      skipReason: 'error',
      toolCount: 0,
    });
    expect(finalizeMcpDiagnostics(acc)?.serverCount).toBe(2);
  });

  it('summary 없이 호출 카운터만 있어도 attempted=true', () => {
    const acc = createMcpDiagnosticsAccumulator();
    acc.promptGets = 1;
    const out = finalizeMcpDiagnostics(acc);
    expect(out).toMatchObject({
      attempted: true,
      serverCount: 0,
      promptGets: 1,
    });
  });
});
