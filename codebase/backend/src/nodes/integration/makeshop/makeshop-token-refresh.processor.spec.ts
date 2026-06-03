import { MakeshopTokenRefreshProcessor } from './makeshop-token-refresh.processor';
import type { Integration } from '../../../modules/integrations/entities/integration.entity';
import type { Job } from 'bullmq';
import type { MakeshopRefreshJobData } from '../../../modules/integrations/makeshop-token-refresh.constants';

describe('MakeshopTokenRefreshProcessor', () => {
  const NOW_MS = 1_700_000_000_000;

  let processor: MakeshopTokenRefreshProcessor;
  let integrationRepository: { findOne: jest.Mock };
  let makeshopApiClient: { refreshAccessToken: jest.Mock };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW_MS);
    integrationRepository = { findOne: jest.fn() };
    makeshopApiClient = {
      refreshAccessToken: jest.fn().mockResolvedValue(undefined),
    };
    processor = new MakeshopTokenRefreshProcessor(
      integrationRepository as never,
      makeshopApiClient as never,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  function makeJob(data: MakeshopRefreshJobData): Job<MakeshopRefreshJobData> {
    return { data, id: data.integrationId } as Job<MakeshopRefreshJobData>;
  }

  function makeIntegration(overrides: Partial<Integration> = {}): Integration {
    return {
      id: 'int-1',
      serviceType: 'makeshop',
      status: 'connected',
      credentials: { shop_uid: 'shop', refresh_token: 'r' },
      tokenExpiresAt: new Date(NOW_MS - 30_000), // 30s past expiry
      ...overrides,
    } as Integration;
  }

  it('refreshes when token is expired', async () => {
    integrationRepository.findOne.mockResolvedValue(makeIntegration());
    await processor.process(
      makeJob({ integrationId: 'int-1', source: 'proactive' }),
    );
    expect(makeshopApiClient.refreshAccessToken).toHaveBeenCalledTimes(1);
  });

  it('short-circuits when token expiry is future (race protection)', async () => {
    integrationRepository.findOne.mockResolvedValue(
      makeIntegration({
        tokenExpiresAt: new Date(NOW_MS + 60 * 60 * 1000), // 1h future
      }),
    );
    await processor.process(
      makeJob({ integrationId: 'int-1', source: 'proactive' }),
    );
    expect(makeshopApiClient.refreshAccessToken).not.toHaveBeenCalled();
  });

  it('reactive_401 skips the short-circuit and always refreshes', async () => {
    integrationRepository.findOne.mockResolvedValue(
      makeIntegration({
        tokenExpiresAt: new Date(NOW_MS + 60 * 60 * 1000), // future, but...
      }),
    );
    await processor.process(
      makeJob({ integrationId: 'int-1', source: 'reactive_401' }),
    );
    // reactive_401 = caller got empirical 401 → always refresh.
    expect(makeshopApiClient.refreshAccessToken).toHaveBeenCalledTimes(1);
  });

  it('skips missing integration', async () => {
    integrationRepository.findOne.mockResolvedValue(null);
    await processor.process(
      makeJob({ integrationId: 'gone', source: 'background' }),
    );
    expect(makeshopApiClient.refreshAccessToken).not.toHaveBeenCalled();
  });

  it('skips non-makeshop integration (defensive)', async () => {
    integrationRepository.findOne.mockResolvedValue(
      makeIntegration({ serviceType: 'cafe24' }),
    );
    await processor.process(
      makeJob({ integrationId: 'int-1', source: 'proactive' }),
    );
    expect(makeshopApiClient.refreshAccessToken).not.toHaveBeenCalled();
  });

  it('skips when status !== connected (reauthorize required)', async () => {
    integrationRepository.findOne.mockResolvedValue(
      makeIntegration({ status: 'error', statusReason: 'auth_failed' }),
    );
    await processor.process(
      makeJob({ integrationId: 'int-1', source: 'proactive' }),
    );
    expect(makeshopApiClient.refreshAccessToken).not.toHaveBeenCalled();
  });
});
