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

  // CONC H-2 회귀 — source 와 무관하게 status='connected' 만 처리해야 한다.
  // 옛 코드는 proactive 경로에서 status 검증을 건너뛰어, BullMQ jobId
  // dedup race (proactive 가 먼저 enqueue → background 가 같은 잡 재사용,
  // worker 는 'proactive' source 만 봄) 시 사용자가 의도한 reauthorize
  // 흐름이 우회될 수 있었다. source 무관 status 검증으로 race-safe.
  it.each(['proactive', 'background'] as const)(
    '%s source — skips when status is not connected (CONC H-2 race-safe)',
    async (source) => {
      integrationRepository.findOne.mockResolvedValue(
        makeIntegration({ status: 'error', statusReason: 'auth_failed' }),
      );
      await processor.process(makeJob({ integrationId: 'int-1', source }));
      expect(cafe24ApiClient.refreshAccessToken).not.toHaveBeenCalled();
    },
  );

  // CONC H-2 회귀 (2026-05-16 follow-up) — source 와 무관하게 expired
  // status 도 거부해야 한다. Phase 2 의 source-based 검증을 source-
  // agnostic 으로 격상하면서 의도된 동작.
  it.each(['proactive', 'background'] as const)(
    '%s source — skips when status is expired',
    async (source) => {
      integrationRepository.findOne.mockResolvedValue(
        makeIntegration({ status: 'expired' }),
      );
      await processor.process(makeJob({ integrationId: 'int-1', source }));
      expect(cafe24ApiClient.refreshAccessToken).not.toHaveBeenCalled();
    },
  );

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
