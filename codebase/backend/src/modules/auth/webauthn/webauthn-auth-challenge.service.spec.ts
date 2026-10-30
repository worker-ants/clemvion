import { RedisConnectionProvider } from '../../../common/redis/redis-connection.provider';
import {
  WEBAUTHN_AUTH_CHALLENGE_EXPIRY_MARGIN_SEC,
  WebAuthnAuthChallengeService,
  makeWebAuthnAuthChallengeKey,
} from './webauthn-auth-challenge.service';

describe('WebAuthnAuthChallengeService', () => {
  const nowSec = 1_800_000_000;
  let redis: { set: jest.Mock };
  let redisConn: { getClient: jest.Mock };
  let service: WebAuthnAuthChallengeService;

  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(nowSec * 1000);
    redis = { set: jest.fn().mockResolvedValue('OK') };
    redisConn = { getClient: jest.fn().mockReturnValue(redis) };
    service = new WebAuthnAuthChallengeService(
      redisConn as unknown as RedisConnectionProvider,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('builds the key from the auth domain and the raw challenge', () => {
    expect(makeWebAuthnAuthChallengeKey('Y2hhbGxlbmdl')).toBe(
      'auth:webauthn-auth-challenge:Y2hhbGxlbmdl',
    );
  });

  it('records the challenge with SET NX EX until exp plus the clock margin and reports first use', async () => {
    await expect(service.consume('chal-1', nowSec + 300)).resolves.toBe(true);
    expect(redis.set).toHaveBeenCalledWith(
      'auth:webauthn-auth-challenge:chal-1',
      '1',
      'EX',
      300 + WEBAUTHN_AUTH_CHALLENGE_EXPIRY_MARGIN_SEC,
      'NX',
    );
  });

  it('reports reuse when the key already exists', async () => {
    redis.set.mockResolvedValue(null);
    await expect(service.consume('chal-1', nowSec + 300)).resolves.toBe(false);
  });

  // 다른 인스턴스의 시계가 늦으면 이 인스턴스 기준으로 exp 가 지났어도 토큰을 받아 준다.
  // 그 경우에도 기록이 0초나 음수 TTL 로 사라지지 않고 여유 시간만큼은 남아야 한다.
  it('keeps the record for the clock margin when exp is already past on this instance', async () => {
    await service.consume('chal-1', nowSec - 10);
    expect(redis.set).toHaveBeenCalledWith(
      expect.any(String),
      '1',
      'EX',
      WEBAUTHN_AUTH_CHALLENGE_EXPIRY_MARGIN_SEC,
      'NX',
    );
  });

  // 기록하지 못하면 한 번만 쓴다는 보장이 없다. 판정은 호출자가 503 으로 막는다.
  it('propagates a Redis command error instead of treating the challenge as unused', async () => {
    redis.set.mockRejectedValue(new Error('connection lost'));
    await expect(service.consume('chal-1', nowSec + 300)).rejects.toThrow(
      'connection lost',
    );
  });

  it('propagates missing Redis configuration', async () => {
    redisConn.getClient.mockImplementation(() => {
      throw new Error('redis.host / redis.port 설정이 누락됐습니다.');
    });
    await expect(service.consume('chal-1', nowSec + 300)).rejects.toThrow(
      'redis.host',
    );
  });
});
