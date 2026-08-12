/**
 * `ChatChannelDedupService` 단위 테스트 — [Spec CCH-SE-02].
 *
 * 이 서비스가 없던 동안 `ChannelUpdate.idempotencyKey` 는 파서가 채우기만 하고 **읽는 곳이
 * 0곳인 dead field** 였다. 따라서 여기서 고정하는 것은 "값이 계산된다" 가 아니라
 * **"그 값으로 실제 억제가 일어난다"** 다.
 *
 * fail-open 이 이 클래스의 계약이라 그 경로도 함께 고정한다 — 억제는 방어 기능이고, 부재가
 * 정상 트래픽을 끊는 것보다 낫다. 다만 그 구간에는 중복 처리가 가능하므로 **warn 을 남기는지**
 * 까지 본다(로그 한 줄이 사라지는 회귀는 반환값만 봐서는 안 잡힌다).
 */
import { Logger } from '@nestjs/common';
import {
  ChatChannelDedupService,
  makeChatDedupKey,
  CHAT_DEDUP_WINDOW_SEC,
} from './chat-channel-dedup.service';

function makeRedis(setImpl?: jest.Mock) {
  return { set: setImpl ?? jest.fn().mockResolvedValue('OK') };
}

function makeService(redis: unknown): ChatChannelDedupService {
  return new ChatChannelDedupService(redis as never, undefined);
}

describe('ChatChannelDedupService (CCH-SE-02)', () => {
  it('최초 도착은 통과하고 `SET NX EX 30` 으로 선점한다', async () => {
    const redis = makeRedis();
    const ok = await makeService(redis).claim('trig-1', 'update-42');

    expect(ok).toBe(true);
    // 인자를 통째로 단언한다 — TTL 이나 NX 가 빠지면 억제가 영구화되거나 아예 안 걸린다.
    expect(redis.set).toHaveBeenCalledWith(
      makeChatDedupKey('trig-1', 'update-42'),
      '1',
      'EX',
      CHAT_DEDUP_WINDOW_SEC,
      'NX',
    );
  });

  it('재도착(SET NX 가 null)은 차단된다 — 이 클래스의 본체', async () => {
    const redis = makeRedis(jest.fn().mockResolvedValue(null));
    expect(await makeService(redis).claim('trig-1', 'update-42')).toBe(false);
  });

  it('trigger 가 다르면 서로를 막지 않는다 — 키가 trigger 로 스코프된다', async () => {
    const seen = new Set<string>();
    const redis = makeRedis(
      jest.fn().mockImplementation((key: string) => {
        if (seen.has(key)) return Promise.resolve(null);
        seen.add(key);
        return Promise.resolve('OK');
      }),
    );
    const svc = makeService(redis);

    expect(await svc.claim('trig-A', 'same-update')).toBe(true);
    // 같은 update id 라도 다른 trigger 면 통과해야 한다. trigger 세그먼트가 빠지면 여기서 막힌다.
    expect(await svc.claim('trig-B', 'same-update')).toBe(true);
    // 같은 trigger 의 재도착만 막힌다.
    expect(await svc.claim('trig-A', 'same-update')).toBe(false);
  });

  it('Redis 미주입 → fail-open (통과), Redis 호출 없음', async () => {
    const svc = new ChatChannelDedupService(undefined, undefined);
    expect(await svc.claim('trig-1', 'update-42')).toBe(true);
  });

  it('Redis 에러 → fail-open + warn (조용히 넘어가지 않는다)', async () => {
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    try {
      const redis = makeRedis(
        jest.fn().mockRejectedValue(new Error('ECONNRESET')),
      );
      expect(await makeService(redis).claim('trig-1', 'update-42')).toBe(true);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('update dedup 실패'),
      );
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('빈 idempotencyKey 는 dedup 대상이 아니다 — 서로 다른 update 가 한 키로 뭉치는 것을 막는다', async () => {
    // provider 가 update id 를 못 준 경우. 한 키(`cc:dedup:<trig>:`)로 뭉치면 **무관한
    // update 들이 서로를 지운다** — 억제가 아니라 유실이 된다. 그 상황은 통과가 맞다.
    const redis = makeRedis();
    expect(await makeService(redis).claim('trig-1', '')).toBe(true);
    expect(redis.set).not.toHaveBeenCalled();
  });
});
