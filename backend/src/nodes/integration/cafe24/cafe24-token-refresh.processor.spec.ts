import { Cafe24TokenRefreshProcessor } from './cafe24-token-refresh.processor';
import type { Integration } from '../../../modules/integrations/entities/integration.entity';
import type { Job } from 'bullmq';
import type { Cafe24RefreshJobData } from '../../../modules/integrations/cafe24-token-refresh.constants';

describe('Cafe24TokenRefreshProcessor', () => {
  let processor: Cafe24TokenRefreshProcessor;
  let integrationRepository: { findOne: jest.Mock };
  let cafe24ApiClient: { refreshAccessToken: jest.Mock };

  beforeEach(() => {
    integrationRepository = { findOne: jest.fn() };
    cafe24ApiClient = {
      refreshAccessToken: jest.fn().mockResolvedValue(undefined),
    };
    processor = new Cafe24TokenRefreshProcessor(
      integrationRepository as never,
      cafe24ApiClient as never,
    );
  });

  function makeJob(data: Cafe24RefreshJobData): Job<Cafe24RefreshJobData> {
    return { data, id: data.integrationId } as Job<Cafe24RefreshJobData>;
  }

  function makeIntegration(overrides: Partial<Integration> = {}): Integration {
    return {
      id: 'int-1',
      serviceType: 'cafe24',
      status: 'connected',
      credentials: { mall_id: 'shop', refresh_token: 'r' },
      tokenExpiresAt: new Date(Date.now() - 30_000), // 30s past expiry
      ...overrides,
    } as Integration;
  }

  it('refreshes when token is expired', async () => {
    integrationRepository.findOne.mockResolvedValue(makeIntegration());
    await processor.process(
      makeJob({ integrationId: 'int-1', source: 'proactive' }),
    );
    expect(cafe24ApiClient.refreshAccessToken).toHaveBeenCalledTimes(1);
  });

  it('short-circuits when token is already fresh (race protection)', async () => {
    integrationRepository.findOne.mockResolvedValue(
      makeIntegration({
        tokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1h future
      }),
    );
    await processor.process(
      makeJob({ integrationId: 'int-1', source: 'proactive' }),
    );
    expect(cafe24ApiClient.refreshAccessToken).not.toHaveBeenCalled();
  });

  it('skips silently when integration is missing (deleted between enqueue and pickup)', async () => {
    integrationRepository.findOne.mockResolvedValue(null);
    await processor.process(
      makeJob({ integrationId: 'missing', source: 'proactive' }),
    );
    expect(cafe24ApiClient.refreshAccessToken).not.toHaveBeenCalled();
  });

  it('skips integration with serviceType !== cafe24 (defensive)', async () => {
    integrationRepository.findOne.mockResolvedValue(
      makeIntegration({ serviceType: 'google' }),
    );
    await processor.process(
      makeJob({ integrationId: 'int-1', source: 'proactive' }),
    );
    expect(cafe24ApiClient.refreshAccessToken).not.toHaveBeenCalled();
  });

  it('background source — skips non-connected integrations to preserve user reauthorize flow', async () => {
    integrationRepository.findOne.mockResolvedValue(
      makeIntegration({ status: 'error', statusReason: 'auth_failed' }),
    );
    await processor.process(
      makeJob({ integrationId: 'int-1', source: 'background' }),
    );
    expect(cafe24ApiClient.refreshAccessToken).not.toHaveBeenCalled();
  });

  it('proactive source — still attempts even on non-connected (caller decides)', async () => {
    // proactive 경로는 API 호출 직전 lazy path. 호출자가 이미 status 검증을
    // 끝낸 후 도착한 잡이므로 worker 가 status 를 재차 거부하지 않는다.
    // 만약 다른 워크플로우가 status 를 바꾼 race 라면 refresh 자체는 시도되고
    // (refresh_token 이 살아있으면) connected 로 복원될 수도 있다.
    integrationRepository.findOne.mockResolvedValue(
      makeIntegration({ status: 'expired' }),
    );
    await processor.process(
      makeJob({ integrationId: 'int-1', source: 'proactive' }),
    );
    expect(cafe24ApiClient.refreshAccessToken).toHaveBeenCalledTimes(1);
  });

  // TEST-C2 — refreshAccessToken 이 throw 했을 때 process() 가 그대로
  // re-throw 해야 BullMQ 가 job 을 failed 로 마킹한다. `.catch()` 로
  // 삼키면 refresh 실패가 silently no-op 되어 알림·진단이 불가능해진다.
  // 본 테스트는 propagation invariant 를 회귀 방지.
  it('propagates refreshAccessToken failure (BullMQ failed marking depends on this)', async () => {
    integrationRepository.findOne.mockResolvedValue(makeIntegration());
    const refreshError = new Error('refresh_token invalid');
    cafe24ApiClient.refreshAccessToken.mockRejectedValue(refreshError);

    await expect(
      processor.process(
        makeJob({ integrationId: 'int-1', source: 'proactive' }),
      ),
    ).rejects.toBe(refreshError);
  });
});
