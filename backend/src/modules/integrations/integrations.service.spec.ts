import {
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { IntegrationsService } from './integrations.service';
import type { Integration } from './entities/integration.entity';

type Mock = jest.Mock;

function makeIntegration(overrides: Partial<Integration> = {}): Integration {
  const base: Integration = {
    id: 'int-1',
    workspaceId: 'ws-1',
    serviceType: 'google',
    name: 'My Google',
    authType: 'oauth2',
    credentials: {
      access_token: 'ya29-secret',
      refresh_token: 'refresh-secret',
      account_email: 'user@example.com',
      scopes: ['https://www.googleapis.com/auth/drive'],
    },
    scope: 'personal',
    status: 'connected',
    statusReason: null,
    tokenExpiresAt: null,
    lastUsedAt: null,
    lastRotatedAt: null,
    lastError: null,
    createdBy: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Integration;
  return { ...base, ...overrides };
}

function makeQueryBuilder(result: {
  count?: number;
  many?: unknown[];
  raw?: unknown[];
}): Record<string, Mock> {
  const qb: Record<string, Mock> = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getCount: jest.fn().mockResolvedValue(result.count ?? 0),
    getMany: jest.fn().mockResolvedValue(result.many ?? []),
    getRawMany: jest.fn().mockResolvedValue(result.raw ?? []),
  };
  return qb;
}

describe('IntegrationsService', () => {
  let service: IntegrationsService;
  let integrationRepo: Record<string, Mock>;
  let usageLogRepo: Record<string, Mock>;
  let nodeRepo: Record<string, Mock>;
  let workspacesService: { getMemberRole: Mock };
  let oauthServiceMock: {
    begin: Mock;
    consumePreviewToken: Mock;
  };
  let auditLogsService: { record: Mock };
  let mcpTestConnection: { test: Mock };
  let integration: Integration;

  beforeEach(() => {
    integration = makeIntegration();

    integrationRepo = {
      findOne: jest.fn().mockResolvedValue(integration),
      create: jest
        .fn()
        .mockImplementation((data) => ({ ...integration, ...data })),
      save: jest
        .fn()
        .mockImplementation((entity) => Promise.resolve(entity as Integration)),
      remove: jest.fn().mockResolvedValue(undefined),
      createQueryBuilder: jest
        .fn()
        .mockReturnValue(makeQueryBuilder({ count: 0, many: [] })),
    };

    usageLogRepo = {
      create: jest.fn().mockImplementation((data: unknown) => data),
      save: jest.fn().mockResolvedValue(undefined),
      createQueryBuilder: jest
        .fn()
        .mockReturnValue(makeQueryBuilder({ many: [], raw: [] })),
    };

    nodeRepo = {
      createQueryBuilder: jest
        .fn()
        .mockReturnValue(makeQueryBuilder({ raw: [] })),
    };

    workspacesService = {
      getMemberRole: jest.fn().mockResolvedValue('member'),
    };

    oauthServiceMock = {
      begin: jest
        .fn()
        .mockResolvedValue({ authUrl: 'https://example.com', state: 'abc' }),
      consumePreviewToken: jest.fn(),
    };
    auditLogsService = { record: jest.fn().mockResolvedValue(undefined) };
    mcpTestConnection = {
      test: jest
        .fn()
        .mockResolvedValue({ success: true, message: 'Connection successful' }),
    };

    service = new IntegrationsService(
      integrationRepo as never,
      usageLogRepo as never,
      nodeRepo as never,
      workspacesService as never,
      oauthServiceMock as never,
      auditLogsService as never,
      mcpTestConnection as never,
    );
  });

  // -----------------------------------------------------------------
  // findById / masking
  // -----------------------------------------------------------------
  describe('findById', () => {
    it('masks secret credential fields', async () => {
      const result = await service.findById('int-1', 'ws-1');
      expect(result.credentials.access_token).toBe('********');
      expect(result.credentials.account_email).toBe('user@example.com');
    });

    it('throws NotFoundException when missing', async () => {
      integrationRepo.findOne.mockResolvedValue(null);
      await expect(service.findById('missing', 'ws-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // -----------------------------------------------------------------
  // testConnection
  // -----------------------------------------------------------------
  describe('testConnection', () => {
    it('returns success for valid credentials', async () => {
      const result = await service.testConnection('int-1', 'ws-1');
      expect(result.success).toBe(true);
    });

    it('throws NotFoundException for missing integration', async () => {
      integrationRepo.findOne.mockResolvedValue(null);
      await expect(service.testConnection('missing', 'ws-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // -----------------------------------------------------------------
  // reauthorize
  // -----------------------------------------------------------------
  describe('reauthorize', () => {
    it('delegates to OAuth service for OAuth integrations', async () => {
      const result = await service.reauthorize('int-1', 'ws-1', 'user-1');
      expect(result.authUrl).toBe('https://example.com');
      expect(oauthServiceMock.begin).toHaveBeenCalledWith(
        expect.objectContaining({
          service: 'google',
          mode: 'reauthorize',
          integrationId: 'int-1',
        }),
      );
    });

    it('resets status for non-OAuth integrations', async () => {
      integrationRepo.findOne.mockResolvedValue(
        makeIntegration({
          serviceType: 'http',
          authType: 'api_key',
          status: 'error',
          statusReason: 'auth_failed',
        }),
      );
      const result = await service.reauthorize('int-1', 'ws-1', 'user-1');
      expect(result).toEqual({ authUrl: '', state: '' });
      expect(integrationRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'connected', statusReason: null }),
      );
    });
  });

  // -----------------------------------------------------------------
  // remove / usage-block
  // -----------------------------------------------------------------
  describe('remove', () => {
    it('deletes when no usages exist', async () => {
      await service.remove('int-1', 'ws-1', 'user-1');
      expect(integrationRepo.remove).toHaveBeenCalled();
      expect(auditLogsService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'integration.deleted' }),
      );
    });

    it('throws ConflictException when usages exist', async () => {
      nodeRepo.createQueryBuilder.mockReturnValue(
        makeQueryBuilder({
          raw: [
            {
              node_id: 'n1',
              node_label: 'Send HTTP',
              node_type: 'http-request',
              workflow_id: 'w1',
              workflow_name: 'Workflow A',
              is_active: true,
            },
          ],
        }),
      );
      await expect(service.remove('int-1', 'ws-1', 'user-1')).rejects.toThrow(
        ConflictException,
      );
      expect(integrationRepo.remove).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------
  // getUsages
  // -----------------------------------------------------------------
  describe('getUsages', () => {
    it('groups rows by workflow', async () => {
      nodeRepo.createQueryBuilder.mockReturnValue(
        makeQueryBuilder({
          raw: [
            {
              node_id: 'n1',
              node_label: 'Send',
              node_type: 'http-send',
              workflow_id: 'w1',
              workflow_name: 'Workflow A',
              is_active: true,
            },
            {
              node_id: 'n2',
              node_label: 'Lookup',
              node_type: 'http-user',
              workflow_id: 'w1',
              workflow_name: 'Workflow A',
              is_active: true,
            },
            {
              node_id: 'n3',
              node_label: 'Notify',
              node_type: 'http-send',
              workflow_id: 'w2',
              workflow_name: 'Workflow B',
              is_active: false,
            },
          ],
        }),
      );
      const usages = await service.getUsages('int-1', 'ws-1');
      expect(usages).toHaveLength(2);
      expect(usages[0].nodes).toHaveLength(2);
      expect(usages[1].isActive).toBe(false);
    });
  });

  // -----------------------------------------------------------------
  // rotate
  // -----------------------------------------------------------------
  describe('rotate', () => {
    beforeEach(() => {
      integrationRepo.findOne.mockResolvedValue(
        makeIntegration({
          serviceType: 'http',
          authType: 'api_key',
          credentials: {
            location: 'header',
            key_name: 'X-Api-Key',
            value: 'old-secret',
          },
        }),
      );
    });

    it('rejects OAuth rotation', async () => {
      integrationRepo.findOne.mockResolvedValue(makeIntegration());
      await expect(
        service.rotate('int-1', 'ws-1', 'user-1', 'member', {
          credentials: { access_token: 'new' },
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('merges credentials and marks rotated on success', async () => {
      const result = await service.rotate('int-1', 'ws-1', 'user-1', 'member', {
        credentials: { value: 'new-secret' },
      });
      expect(result.credentials.value).toBe('********');
      expect(integrationRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          lastRotatedAt: expect.any(Date),
          status: 'connected',
          statusReason: null,
        }),
      );
      expect(auditLogsService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'integration.rotated' }),
      );
    });

    it('rejects org-scope rotation for non-admin', async () => {
      integrationRepo.findOne.mockResolvedValue(
        makeIntegration({
          serviceType: 'http',
          authType: 'api_key',
          scope: 'organization',
          credentials: {
            location: 'header',
            key_name: 'X-Api-Key',
            value: 'v',
          },
        }),
      );
      await expect(
        service.rotate('int-1', 'ws-1', 'user-1', 'member', {
          credentials: { value: 'v2' },
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // -----------------------------------------------------------------
  // requestScopes
  // -----------------------------------------------------------------
  describe('requestScopes', () => {
    it('merges existing + new scopes and delegates to OAuth service', async () => {
      await service.requestScopes('int-1', 'ws-1', 'user-1', 'member', {
        scopes: ['https://www.googleapis.com/auth/gmail.send'],
      });
      expect(oauthServiceMock.begin).toHaveBeenCalledWith(
        expect.objectContaining({
          service: 'google',
          mode: 'request_scopes',
          integrationId: 'int-1',
          scopes: expect.arrayContaining([
            'https://www.googleapis.com/auth/drive',
            'https://www.googleapis.com/auth/gmail.send',
          ]),
        }),
      );
    });

    it('rejects non-OAuth services', async () => {
      integrationRepo.findOne.mockResolvedValue(
        makeIntegration({
          serviceType: 'http',
          authType: 'api_key',
          credentials: { location: 'header', key_name: 'X', value: 'v' },
        }),
      );
      await expect(
        service.requestScopes('int-1', 'ws-1', 'user-1', 'member', {
          scopes: ['x'],
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // -----------------------------------------------------------------
  // updateScope
  // -----------------------------------------------------------------
  describe('updateScope', () => {
    it('requires admin role', async () => {
      await expect(
        service.updateScope('int-1', 'ws-1', 'user-1', 'member', {
          scope: 'organization',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows admin to change scope', async () => {
      const result = await service.updateScope(
        'int-1',
        'ws-1',
        'user-1',
        'owner',
        { scope: 'organization' },
      );
      expect(result.scope).toBe('organization');
      expect(auditLogsService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'integration.scope_changed' }),
      );
    });
  });

  // -----------------------------------------------------------------
  // create
  // -----------------------------------------------------------------
  describe('create', () => {
    it('rejects organization scope for non-admin', async () => {
      await expect(
        service.create('ws-1', 'user-1', 'member', {
          serviceType: 'http',
          authType: 'api_key',
          name: 'My API',
          scope: 'organization',
          credentials: { location: 'header', key_name: 'X', value: 'v' },
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('validates credentials against schema', async () => {
      await expect(
        service.create('ws-1', 'user-1', 'member', {
          serviceType: 'http',
          authType: 'api_key',
          name: 'My API',
          credentials: { location: 'header' },
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('persists valid integration', async () => {
      const result = await service.create('ws-1', 'user-1', 'member', {
        serviceType: 'http',
        authType: 'api_key',
        name: 'My API',
        credentials: {
          location: 'header',
          key_name: 'X-Api-Key',
          value: 'secret',
        },
      });
      expect(result.name).toBe('My API');
      expect(result.credentials.value).toBe('********');
      expect(auditLogsService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'integration.created' }),
      );
    });
  });

  // -----------------------------------------------------------------
  // findAll — filter translation
  // -----------------------------------------------------------------
  describe('findAll', () => {
    it('applies q/scope/serviceType/status filters to query builder', async () => {
      const qb = makeQueryBuilder({ count: 0, many: [] });
      integrationRepo.createQueryBuilder.mockReturnValue(qb);
      await service.findAll('ws-1', {
        q: 'google',
        scope: 'organization',
        serviceType: ['google', 'github'],
        status: 'expiring',
      });
      const sql = qb.andWhere.mock.calls.map((c) => c[0]).join(' | ');
      expect(sql).toContain('i.name ILIKE');
      expect(sql).toContain('i.scope');
      expect(sql).toContain('service_type IN');
      expect(sql).toContain('status');
    });

    it('ignores empty serviceType array', async () => {
      const qb = makeQueryBuilder({ count: 0, many: [] });
      integrationRepo.createQueryBuilder.mockReturnValue(qb);
      await service.findAll('ws-1', { serviceType: [] });
      const sql = qb.andWhere.mock.calls.map((c) => c[0]).join(' | ');
      expect(sql).not.toContain('service_type IN');
    });
  });

  // -----------------------------------------------------------------
  // previewTest
  // -----------------------------------------------------------------
  describe('previewTest', () => {
    it('returns success for valid credentials', async () => {
      const result = await service.previewTest({
        serviceType: 'http',
        authType: 'api_key',
        credentials: {
          location: 'header',
          key_name: 'X',
          value: 'v',
        },
      });
      expect(result.success).toBe(true);
    });

    it('returns failure for invalid credentials', async () => {
      const result = await service.previewTest({
        serviceType: 'http',
        authType: 'api_key',
        credentials: { location: 'header' },
      });
      expect(result.success).toBe(false);
      expect(result.message).toContain('required');
    });

    it('delegates mcp service to McpTestConnectionService and exposes capability preview', async () => {
      mcpTestConnection.test.mockResolvedValueOnce({
        success: true,
        message: 'Connection successful',
        capabilities: { tools: {}, resources: {} },
        serverInfo: { name: 's', version: '1' },
        preview: {
          toolCount: 3,
          resourceSupported: true,
          promptSupported: false,
        },
      });
      const result = await service.previewTest({
        serviceType: 'mcp',
        authType: 'bearer_token',
        credentials: {
          url: 'https://mcp.example.com',
          token: 'abc',
        },
      });
      expect(result.success).toBe(true);
      // Critical-2 fix: capability data must be exposed to the registration
      // UI rather than discarded.
      expect(result.capabilities).toEqual({ tools: {}, resources: {} });
      expect(result.serverInfo).toEqual({ name: 's', version: '1' });
      expect(result.preview).toEqual({
        toolCount: 3,
        resourceSupported: true,
        promptSupported: false,
      });
      expect(mcpTestConnection.test).toHaveBeenCalledWith({
        authType: 'bearer_token',
        url: 'https://mcp.example.com',
        token: 'abc',
        defaultHeaders: undefined,
      });
    });

    it('mcp transport failure surfaces MCP_* code in result.code (not message)', async () => {
      mcpTestConnection.test.mockResolvedValueOnce({
        success: false,
        code: 'MCP_AUTH_FAILED',
        message: 'invalid credentials',
      });
      const result = await service.previewTest({
        serviceType: 'mcp',
        authType: 'bearer_token',
        credentials: { url: 'https://mcp.example.com', token: 't' },
      });
      expect(result.success).toBe(false);
      expect(result.code).toBe('MCP_AUTH_FAILED');
      // Message no longer carries an inline `[CODE]` prefix — clients use
      // result.code for branching and result.message for display.
      expect(result.message).toBe('invalid credentials');
    });

    it('falls back to MCP_CONNECT_FAILED when test result omits code', async () => {
      // Defensive fallback — if the MCP layer ever returns a failure without
      // a vocabulary code, the dispatch must still surface a stable code so
      // the UI can branch deterministically.
      mcpTestConnection.test.mockResolvedValueOnce({
        success: false,
        message: 'unspecified failure',
      });
      const result = await service.previewTest({
        serviceType: 'mcp',
        authType: 'none',
        credentials: { url: 'https://mcp.example.com' },
      });
      expect(result.success).toBe(false);
      expect(result.code).toBe('MCP_CONNECT_FAILED');
    });

    it('mcp structural validation runs before transport probe', async () => {
      const result = await service.previewTest({
        serviceType: 'mcp',
        authType: 'bearer_token',
        credentials: { token: 't' }, // missing url
      });
      expect(result.success).toBe(false);
      expect(result.message).toContain('url is required');
      expect(mcpTestConnection.test).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------
  // getActivity — clamping & summary
  // -----------------------------------------------------------------
  describe('getActivity', () => {
    it('clamps limit to [1,100] and days to [1,30]', async () => {
      const itemsQb = makeQueryBuilder({ many: [], raw: [] });
      const summaryQb = makeQueryBuilder({ many: [], raw: [] });
      let call = 0;
      usageLogRepo.createQueryBuilder.mockImplementation(() =>
        call++ === 0 ? itemsQb : summaryQb,
      );
      const result = await service.getActivity('int-1', 'ws-1', 9999, 9999);
      expect(itemsQb.limit).toHaveBeenCalledWith(100);
      expect(result.summary.successRate).toBe(1);
    });

    it('computes summary from raw rows', async () => {
      const itemsQb = makeQueryBuilder({ many: [] });
      const summaryQb = makeQueryBuilder({
        raw: [
          { day: '2026-04-10', total: '10', failed: '2' },
          { day: '2026-04-11', total: '5', failed: '0' },
        ],
      });
      let call = 0;
      usageLogRepo.createQueryBuilder.mockImplementation(() =>
        call++ === 0 ? itemsQb : summaryQb,
      );
      const result = await service.getActivity('int-1', 'ws-1', 20, 7);
      expect(result.summary.totalCalls).toBe(15);
      expect(result.summary.successRate).toBeCloseTo(13 / 15);
      expect(result.summary.dailyCounts).toHaveLength(2);
    });
  });

  // -----------------------------------------------------------------
  // logUsage
  // -----------------------------------------------------------------
  describe('logUsage', () => {
    it('records success row and updates lastUsedAt', async () => {
      integrationRepo.findOne.mockResolvedValue(makeIntegration());
      await service.logUsage({
        integrationId: 'int-1',
        nodeExecutionId: 'nex-1',
        workflowId: 'wf-1',
        status: 'success',
        durationMs: 120,
      });
      expect(usageLogRepo.save).toHaveBeenCalled();
      expect(integrationRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ lastUsedAt: expect.any(Date) }),
      );
    });

    it('records lastError on failure', async () => {
      integrationRepo.findOne.mockResolvedValue(makeIntegration());
      await service.logUsage({
        integrationId: 'int-1',
        nodeExecutionId: 'nex-1',
        workflowId: 'wf-1',
        status: 'failed',
        durationMs: 800,
        error: { code: 'auth_failed', message: '401' },
      });
      expect(integrationRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          lastError: expect.objectContaining({ code: 'auth_failed' }),
        }),
      );
    });

    it('swallows DB failure (non-blocking)', async () => {
      usageLogRepo.save.mockRejectedValue(new Error('boom'));
      await expect(
        service.logUsage({
          integrationId: 'int-1',
          nodeExecutionId: 'nex-1',
          workflowId: 'wf-1',
          status: 'success',
          durationMs: 1,
        }),
      ).resolves.toBeUndefined();
    });

    it('flips status to error(auth_failed) on MCP_AUTH_FAILED', async () => {
      const i = makeIntegration({ status: 'connected', statusReason: null });
      integrationRepo.findOne.mockResolvedValue(i);
      await service.logUsage({
        integrationId: 'int-1',
        nodeExecutionId: 'nex-1',
        workflowId: 'wf-1',
        status: 'failed',
        durationMs: 50,
        error: { code: 'MCP_AUTH_FAILED', message: '401' },
      });
      expect(integrationRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'error',
          statusReason: 'auth_failed',
        }),
      );
    });

    it('does NOT flip status for non-auth failures', async () => {
      const i = makeIntegration({ status: 'connected', statusReason: null });
      integrationRepo.findOne.mockResolvedValue(i);
      await service.logUsage({
        integrationId: 'int-1',
        nodeExecutionId: 'nex-1',
        workflowId: 'wf-1',
        status: 'failed',
        durationMs: 50,
        error: { code: 'MCP_CALL_FAILED', message: 'transport hiccup' },
      });
      expect(integrationRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'connected' }),
      );
    });
  });
});
