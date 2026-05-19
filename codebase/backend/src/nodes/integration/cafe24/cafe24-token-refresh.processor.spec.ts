import { Cafe24TokenRefreshProcessor } from './cafe24-token-refresh.processor';
import type { Integration } from '../../../modules/integrations/entities/integration.entity';
import type { Job } from 'bullmq';
import type { Cafe24RefreshJobData } from '../../../modules/integrations/cafe24-token-refresh.constants';
import { makeFakeJwt } from '../../../modules/integrations/__test-utils__/make-fake-jwt';

describe('Cafe24TokenRefreshProcessor', () => {
  // W-40 — fake timer 로 wall clock 고정. processor 내부 `Date.now()` 와
  // setup 의 `new Date(Date.now() - 30_000)` 사이 ms 단위 drift 가 슬로우
  // 머신 (특히 CI) 에서 expiry 분기 결과를 흔들 수 있어 명시적으로 고정.
  const NOW_MS = 1_700_000_000_000;

  let processor: Cafe24TokenRefreshProcessor;
  let integrationRepository: { findOne: jest.Mock };
  let cafe24ApiClient: { refreshAccessToken: jest.Mock };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW_MS);
    integrationRepository = { findOne: jest.fn() };
    cafe24ApiClient = {
      refreshAccessToken: jest.fn().mockResolvedValue(undefined),
    };
    processor = new Cafe24TokenRefreshProcessor(
      integrationRepository as never,
      cafe24ApiClient as never,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
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
      tokenExpiresAt: new Date(NOW_MS - 30_000), // 30s past expiry
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
        tokenExpiresAt: new Date(NOW_MS + 60 * 60 * 1000), // 1h future
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

  // 2026-05-19 — resolveTokenExpiry 가 JWT exp 를 최우선으로 쓰므로,
  // tokenExpiresAt 이 TZ 버그로 미래 값(+9h)이어도 JWT exp 가 과거면
  // proactive short-circuit 이 발동하지 않아야 한다.
  it('proactive source — tokenExpiresAt 이 미래(TZ 버그)이어도 JWT exp 가 과거면 short-circuit 없이 refresh', async () => {
    const expiredJwt = makeFakeJwt({
      exp: Math.floor((NOW_MS - 5 * 60 * 1000) / 1000), // 5분 전 만료
    });
    integrationRepository.findOne.mockResolvedValue(
      makeIntegration({
        tokenExpiresAt: new Date(NOW_MS + 9 * 60 * 60 * 1000), // +9h (TZ 버그 잔존값)
        credentials: {
          mall_id: 'shop',
          refresh_token: 'r',
          access_token: expiredJwt,
        },
      }),
    );
    await processor.process(
      makeJob({ integrationId: 'int-1', source: 'proactive' }),
    );
    expect(cafe24ApiClient.refreshAccessToken).toHaveBeenCalledTimes(1);
  });

  // 2026-05-18 — source='reactive_401' 은 short-circuit guard 를 skip 하고
  // 항상 refresh 를 시도해야 한다. caller (executeWithRateLimit 의 401 자가
  // 회복) 가 empirical 401 을 받았다는 강한 신호이므로 DB 의 tokenExpiresAt
  // 을 신뢰하면 안 된다 (옛 TZ 모호성 회귀로 9h 미래로 저장된 케이스 등).
  // 본 테스트는 short-circuit 회피 invariant 를 회귀 방지.
  // spec/2-navigation/4-integration.md ## Rationale "Cafe24 token 만료 SoT —
  // JWT exp 격상 (2026-05-18)".
  it('reactive_401 source — token 이 fresh 로 보여도 short-circuit skip 하고 refresh', async () => {
    integrationRepository.findOne.mockResolvedValue(
      makeIntegration({
        // DB 가 1h 미래 expiry 로 보고 있음 (proactive 라면 short-circuit)
        tokenExpiresAt: new Date(NOW_MS + 60 * 60 * 1000),
      }),
    );
    await processor.process(
      makeJob({ integrationId: 'int-1', source: 'reactive_401' }),
    );
    // 핵심 어서션: short-circuit 무시하고 refresh 가 실행됨
    expect(cafe24ApiClient.refreshAccessToken).toHaveBeenCalledTimes(1);
  });

  // 회귀 보호 — reactive_401 도 status='connected' 가 아니면 skip (CONC H-2
  // race-safe invariant 는 모든 source 에 적용). reactive_401 의 short-circuit
  // skip 은 *expiry guard* 만 우회하지 status guard 까지 우회하지는 않는다.
  it.each(['error', 'expired', 'pending_install'] as const)(
    'reactive_401 source — status %s 일 때는 여전히 skip',
    async (status) => {
      integrationRepository.findOne.mockResolvedValue(
        makeIntegration({ status }),
      );
      await processor.process(
        makeJob({ integrationId: 'int-1', source: 'reactive_401' }),
      );
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
});
