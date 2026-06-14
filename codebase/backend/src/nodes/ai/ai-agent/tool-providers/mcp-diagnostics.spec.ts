import { McpServerSummary, pushMcpServerSummary } from './mcp-diagnostics';

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
