import { CandidateLookupService } from './candidate-lookup.service';
import type { PendingUserConfigField } from './detect-pending-user-config';

/**
 * 본 spec 은 5 widget (integration / llm-config / kb / workflow / mcp-server)
 * 각각에 대해 `fillCandidates` 가 알맞은 서비스로 위임하고, 결과를
 * `CandidateEntry[]` shape 으로 맵핑하는지, 20개 상한과 serviceType 필터가
 * 동작하는지 고정한다 (ED-AI-39, spec §4.3.1).
 */

function makeService() {
  const mocks = {
    integrations: { findAll: jest.fn() },
    llmConfigs: { findAll: jest.fn() },
    knowledgeBases: { findAll: jest.fn() },
    exploreTools: { listWorkflows: jest.fn() },
  };
  const service = new CandidateLookupService(
    mocks.integrations as never,
    mocks.llmConfigs as never,
    mocks.knowledgeBases as never,
    mocks.exploreTools as never,
  );
  return { service, mocks };
}

describe('CandidateLookupService', () => {
  describe('integration-selector', () => {
    it('filters by integrationServiceType hint and returns connected items only', async () => {
      const { service, mocks } = makeService();
      mocks.integrations.findAll.mockResolvedValue({
        data: [
          { id: 'int-1', name: 'Gmail SMTP', serviceType: 'email' },
          { id: 'int-2', name: 'Mailgun', serviceType: 'email' },
        ],
      });
      const pending: PendingUserConfigField[] = [
        {
          field: 'integrationId',
          widget: 'integration-selector',
          label: 'Integration',
          selectionMode: 'single',
          integrationServiceType: 'email',
          candidates: [],
        },
      ];

      const out = await service.fillCandidates('ws-1', 'wf-1', pending);

      expect(mocks.integrations.findAll).toHaveBeenCalledWith(
        'ws-1',
        expect.objectContaining({
          status: 'connected',
          serviceType: ['email'],
        }),
      );
      expect(out).toHaveLength(1);
      expect(out[0].candidates).toEqual([
        { id: 'int-1', label: 'Gmail SMTP', sublabel: 'email' },
        { id: 'int-2', label: 'Mailgun', sublabel: 'email' },
      ]);
      // 원본 pending 객체는 변형하지 않는다 (불변 반환).
      expect(pending[0].candidates).toEqual([]);
    });

    it('skips the serviceType filter when no hint is attached (falls back to all connected)', async () => {
      const { service, mocks } = makeService();
      mocks.integrations.findAll.mockResolvedValue({ data: [] });
      await service.fillCandidates('ws-1', 'wf-1', [
        {
          field: 'integrationId',
          widget: 'integration-selector',
          label: 'Integration',
          selectionMode: 'single',
          candidates: [],
        },
      ]);
      const call = mocks.integrations.findAll.mock.calls[0][1];
      expect(call).not.toHaveProperty('serviceType');
      expect(call.status).toBe('connected');
    });

    it('caps candidates at 20 even when the service returns more', async () => {
      const { service, mocks } = makeService();
      const many = Array.from({ length: 25 }, (_, i) => ({
        id: `int-${i}`,
        name: `Integration ${i}`,
        serviceType: 'email',
      }));
      mocks.integrations.findAll.mockResolvedValue({ data: many });
      const out = await service.fillCandidates('ws-1', 'wf-1', [
        {
          field: 'integrationId',
          widget: 'integration-selector',
          label: 'Integration',
          selectionMode: 'single',
          integrationServiceType: 'email',
          candidates: [],
        },
      ]);
      expect(out[0].candidates).toHaveLength(20);
    });
  });

  describe('llm-config-selector', () => {
    it('maps llmConfig rows to {id, label, sublabel(model)}', async () => {
      const { service, mocks } = makeService();
      mocks.llmConfigs.findAll.mockResolvedValue({
        data: [
          { id: 'cfg-1', name: 'Prod GPT', defaultModel: 'gpt-4o' },
          { id: 'cfg-2', name: 'Claude Opus', model: 'claude-opus-4-7' },
        ],
      });
      const out = await service.fillCandidates('ws-1', 'wf-1', [
        {
          field: 'llmConfigId',
          widget: 'llm-config-selector',
          label: 'LLM Config',
          selectionMode: 'single',
          candidates: [],
        },
      ]);
      expect(out[0].candidates).toEqual([
        { id: 'cfg-1', label: 'Prod GPT', sublabel: 'gpt-4o' },
        { id: 'cfg-2', label: 'Claude Opus', sublabel: 'claude-opus-4-7' },
      ]);
    });
  });

  describe('kb-selector', () => {
    it('maps kb rows to {id, label}', async () => {
      const { service, mocks } = makeService();
      mocks.knowledgeBases.findAll.mockResolvedValue({
        data: [{ id: 'kb-1', name: 'Product docs' }],
      });
      const out = await service.fillCandidates('ws-1', 'wf-1', [
        {
          field: 'knowledgeBaseIds',
          widget: 'kb-selector',
          label: 'Knowledge Bases',
          selectionMode: 'multi',
          candidates: [],
        },
      ]);
      expect(out[0].candidates).toEqual([
        { id: 'kb-1', label: 'Product docs' },
      ]);
    });
  });

  describe('mcp-server-selector', () => {
    it('looks up workspace integrations of service_type=mcp and maps to {id, label}', async () => {
      const { service, mocks } = makeService();
      mocks.integrations.findAll.mockResolvedValue({
        data: [
          { id: 'int-mcp-1', name: 'GitHub MCP', serviceType: 'mcp' },
          { id: 'int-mcp-2', name: 'Linear MCP', serviceType: 'mcp' },
        ],
      });
      const out = await service.fillCandidates('ws-1', 'wf-1', [
        {
          field: 'mcpServers',
          widget: 'mcp-server-selector',
          label: 'MCP Servers',
          selectionMode: 'multi',
          candidates: [],
        },
      ]);
      expect(mocks.integrations.findAll).toHaveBeenCalledWith(
        'ws-1',
        expect.objectContaining({
          status: 'connected',
          serviceType: ['mcp'],
        }),
      );
      expect(out[0].candidates).toEqual([
        { id: 'int-mcp-1', label: 'GitHub MCP' },
        { id: 'int-mcp-2', label: 'Linear MCP' },
      ]);
    });

    it('caps MCP candidates at 20', async () => {
      const { service, mocks } = makeService();
      const many = Array.from({ length: 25 }, (_, i) => ({
        id: `int-mcp-${i}`,
        name: `MCP ${i}`,
        serviceType: 'mcp',
      }));
      mocks.integrations.findAll.mockResolvedValue({ data: many });
      const out = await service.fillCandidates('ws-1', 'wf-1', [
        {
          field: 'mcpServers',
          widget: 'mcp-server-selector',
          label: 'MCP Servers',
          selectionMode: 'multi',
          candidates: [],
        },
      ]);
      expect(out[0].candidates).toHaveLength(20);
    });
  });

  describe('workflow-selector', () => {
    it('excludes the current workflow via ExploreToolsService.listWorkflows', async () => {
      const { service, mocks } = makeService();
      mocks.exploreTools.listWorkflows.mockResolvedValue({
        ok: true,
        items: [
          { id: 'wf-2', name: 'Order intake', description: 'Entry point' },
          { id: 'wf-3', name: 'Refund', description: '' },
        ],
      });
      const out = await service.fillCandidates('ws-1', 'wf-1', [
        {
          field: 'workflowId',
          widget: 'workflow-selector',
          label: 'Sub-workflow',
          selectionMode: 'single',
          candidates: [],
        },
      ]);
      expect(mocks.exploreTools.listWorkflows).toHaveBeenCalledWith('ws-1', {
        limit: 20,
        excludeId: 'wf-1',
      });
      expect(out[0].candidates).toEqual([
        { id: 'wf-2', label: 'Order intake', sublabel: 'Entry point' },
        { id: 'wf-3', label: 'Refund' },
      ]);
    });
  });

  describe('error degradation', () => {
    it('returns [] candidates when the underlying service throws (warn + continue)', async () => {
      const { service, mocks } = makeService();
      mocks.integrations.findAll.mockRejectedValue(new Error('db down'));
      const out = await service.fillCandidates('ws-1', 'wf-1', [
        {
          field: 'integrationId',
          widget: 'integration-selector',
          label: 'Integration',
          selectionMode: 'single',
          integrationServiceType: 'email',
          candidates: [],
        },
      ]);
      expect(out[0].candidates).toEqual([]);
    });
  });

  it('short-circuits when pending is empty', async () => {
    const { service, mocks } = makeService();
    const out = await service.fillCandidates('ws-1', 'wf-1', []);
    expect(out).toEqual([]);
    expect(mocks.integrations.findAll).not.toHaveBeenCalled();
  });
});
