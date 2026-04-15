import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { IntegrationOAuthService } from './integration-oauth.service';

type Mock = jest.Mock;

function makeRepo(): Record<string, Mock> {
  return {
    create: jest.fn().mockImplementation((data: unknown) => data),
    save: jest
      .fn()
      .mockImplementation((entity: unknown) => Promise.resolve(entity)),
    findOne: jest.fn().mockResolvedValue(null),
    delete: jest.fn().mockResolvedValue(undefined),
  };
}

describe('IntegrationOAuthService', () => {
  let service: IntegrationOAuthService;
  let integrationRepo: Record<string, Mock>;
  let stateRepo: Record<string, Mock>;
  let previewRepo: Record<string, Mock>;
  let dataSource: {
    query: Mock;
    transaction: Mock;
  };

  beforeEach(() => {
    integrationRepo = makeRepo();
    stateRepo = makeRepo();
    previewRepo = makeRepo();
    dataSource = {
      query: jest.fn().mockResolvedValue([]),
      transaction: jest
        .fn()
        .mockImplementation(
          async (cb: (manager: { getRepository: Mock }) => Promise<void>) => {
            await cb({
              getRepository: jest.fn().mockReturnValue(integrationRepo),
            });
          },
        ),
    };

    process.env.OAUTH_STUB_MODE = 'true';

    service = new IntegrationOAuthService(
      integrationRepo as never,
      stateRepo as never,
      previewRepo as never,
      dataSource as never,
    );
  });

  afterEach(() => {
    delete process.env.OAUTH_STUB_MODE;
  });

  describe('begin', () => {
    it('throws when service is not OAuth-capable', async () => {
      await expect(
        service.begin({
          workspaceId: 'ws-1',
          userId: 'u-1',
          service: 'http',
          scopes: [],
          mode: 'new',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws InternalServerError when CLIENT_ID env var is missing', async () => {
      delete process.env.GOOGLE_CLIENT_ID;
      await expect(
        service.begin({
          workspaceId: 'ws-1',
          userId: 'u-1',
          service: 'google',
          scopes: ['https://www.googleapis.com/auth/drive'],
          mode: 'new',
        }),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('returns authUrl and persists state for new mode', async () => {
      process.env.GOOGLE_CLIENT_ID = 'cid-123';
      const result = await service.begin({
        workspaceId: 'ws-1',
        userId: 'u-1',
        service: 'google',
        scopes: [
          'https://www.googleapis.com/auth/drive',
          'https://www.googleapis.com/auth/calendar',
        ],
        mode: 'new',
      });
      expect(result.authUrl).toContain('client_id=cid-123');
      expect(result.authUrl).toContain('https');
      expect(result.state).toHaveLength(48);
      expect(stateRepo.save).toHaveBeenCalled();
      delete process.env.GOOGLE_CLIENT_ID;
    });
  });

  describe('handleCallback', () => {
    it('rejects unknown provider', async () => {
      await expect(
        service.handleCallback('evil', { code: 'x', state: 'y' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects on error param', async () => {
      await expect(
        service.handleCallback('google', { error: 'access_denied' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects on missing state', async () => {
      await expect(
        service.handleCallback('google', { code: 'x' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects on missing code', async () => {
      await expect(
        service.handleCallback('google', { state: 'y' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects already-consumed state', async () => {
      dataSource.query.mockResolvedValue([]);
      await expect(
        service.handleCallback('google', { code: 'x', state: 'y' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects expired state', async () => {
      dataSource.query.mockResolvedValue([
        {
          provider: 'google',
          serviceType: 'google',
          mode: 'new',
          workspaceId: 'ws-1',
          userId: 'u-1',
          requestedScopes: ['https://www.googleapis.com/auth/drive'],
          integrationId: null,
          expiresAt: new Date(Date.now() - 60_000),
        },
      ]);
      await expect(
        service.handleCallback('google', { code: 'x', state: 'y' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('returns previewToken for new mode', async () => {
      dataSource.query.mockResolvedValue([
        {
          provider: 'google',
          serviceType: 'google',
          mode: 'new',
          workspaceId: 'ws-1',
          userId: 'u-1',
          requestedScopes: ['https://www.googleapis.com/auth/drive'],
          integrationId: null,
          expiresAt: new Date(Date.now() + 60_000),
        },
      ]);
      const result = await service.handleCallback('google', {
        code: 'code-xyz',
        state: 'abc',
      });
      expect(result.mode).toBe('new');
      expect(result.previewToken).toMatch(/^tmp_/);
      expect(previewRepo.save).toHaveBeenCalled();
    });

    it('updates integration for reauthorize mode', async () => {
      dataSource.query.mockResolvedValue([
        {
          provider: 'google',
          serviceType: 'google',
          mode: 'reauthorize',
          workspaceId: 'ws-1',
          userId: 'u-1',
          requestedScopes: ['https://www.googleapis.com/auth/drive'],
          integrationId: 'int-1',
          expiresAt: new Date(Date.now() + 60_000),
        },
      ]);
      integrationRepo.findOne.mockResolvedValue({
        id: 'int-1',
        workspaceId: 'ws-1',
        credentials: { access_token: 'old' },
        status: 'error',
      });
      const result = await service.handleCallback('google', {
        code: 'code',
        state: 'abc',
      });
      expect(result.mode).toBe('reauthorize');
      expect(result.integrationId).toBe('int-1');
      expect(integrationRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'connected', statusReason: null }),
      );
    });

    it('merges scopes for request_scopes mode', async () => {
      dataSource.query.mockResolvedValue([
        {
          provider: 'google',
          serviceType: 'google',
          mode: 'request_scopes',
          workspaceId: 'ws-1',
          userId: 'u-1',
          requestedScopes: [
            'https://www.googleapis.com/auth/drive',
            'https://www.googleapis.com/auth/gmail.send',
          ],
          integrationId: 'int-1',
          expiresAt: new Date(Date.now() + 60_000),
        },
      ]);
      integrationRepo.findOne.mockResolvedValue({
        id: 'int-1',
        workspaceId: 'ws-1',
        credentials: {
          access_token: 'old',
          scopes: ['https://www.googleapis.com/auth/drive'],
        },
        status: 'error',
      });
      const result = await service.handleCallback('google', {
        code: 'code',
        state: 'abc',
      });
      expect(result.mode).toBe('request_scopes');
      const saved = integrationRepo.save.mock.calls[0][0] as {
        credentials: { scopes: string[] };
      };
      expect(saved.credentials.scopes).toEqual(
        expect.arrayContaining([
          'https://www.googleapis.com/auth/drive',
          'https://www.googleapis.com/auth/gmail.send',
        ]),
      );
    });
  });

  describe('consumePreviewToken', () => {
    it('rejects unknown token', async () => {
      dataSource.query.mockResolvedValue([]);
      await expect(
        service.consumePreviewToken('tmp_x', 'ws-1', 'u-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects mismatched owner', async () => {
      dataSource.query.mockResolvedValue([
        {
          previewToken: 'tmp_x',
          workspaceId: 'other',
          userId: 'u-1',
          serviceType: 'google',
          credentials: { access_token: 't' },
          tokenExpiresAt: null,
          expiresAt: new Date(Date.now() + 60_000),
        },
      ]);
      await expect(
        service.consumePreviewToken('tmp_x', 'ws-1', 'u-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects expired preview', async () => {
      dataSource.query.mockResolvedValue([
        {
          previewToken: 'tmp_x',
          workspaceId: 'ws-1',
          userId: 'u-1',
          serviceType: 'google',
          credentials: { access_token: 't' },
          tokenExpiresAt: null,
          expiresAt: new Date(Date.now() - 60_000),
        },
      ]);
      await expect(
        service.consumePreviewToken('tmp_x', 'ws-1', 'u-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('returns credentials on success', async () => {
      dataSource.query.mockResolvedValue([
        {
          previewToken: 'tmp_x',
          workspaceId: 'ws-1',
          userId: 'u-1',
          serviceType: 'google',
          credentials: { access_token: 't' },
          tokenExpiresAt: null,
          expiresAt: new Date(Date.now() + 60_000),
        },
      ]);
      const result = await service.consumePreviewToken('tmp_x', 'ws-1', 'u-1');
      expect(result.serviceType).toBe('google');
      expect(result.credentials.access_token).toBe('t');
    });
  });
});
