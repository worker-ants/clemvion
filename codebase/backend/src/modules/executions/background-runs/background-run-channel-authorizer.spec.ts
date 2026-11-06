import { BackgroundRunChannelAuthorizer } from './background-run-channel-authorizer';
import { BackgroundRunsService } from './background-runs.service';
import type { ChannelAuthorizerContext } from '../../websocket/channel-authorizer';

const VALID_ID = '22222222-2222-4222-8222-222222222222';

function makeAuthorizer(
  verifyBackgroundRunOwnership: jest.Mock,
): BackgroundRunChannelAuthorizer {
  return new BackgroundRunChannelAuthorizer({
    verifyBackgroundRunOwnership,
  } as unknown as BackgroundRunsService);
}

describe('BackgroundRunChannelAuthorizer', () => {
  it('matches only background:run: channels', () => {
    const authorizer = makeAuthorizer(jest.fn());
    expect(authorizer.matches('background:run:abc')).toBe(true);
    // execution: 와 prefix 가 겹치지 않는다.
    expect(authorizer.matches('execution:abc')).toBe(false);
  });

  it('rejects non-UUID id before DB lookup (비-UUID 선차단)', async () => {
    const verify = jest.fn();
    const authorizer = makeAuthorizer(verify);

    const result = await authorizer.authorize('background:run:nope', {
      workspaceId: 'ws-1',
      userId: 'u-1',
    });

    expect(result).toEqual({ error: 'Not authorized for this background run' });
    expect(verify).not.toHaveBeenCalled();
  });

  it('allows when ownership verified', async () => {
    const verify = jest.fn().mockResolvedValue(true);
    const authorizer = makeAuthorizer(verify);

    const result = await authorizer.authorize(`background:run:${VALID_ID}`, {
      workspaceId: 'ws-1',
      userId: 'u-1',
    });

    expect(result).toBeNull();
    expect(verify).toHaveBeenCalledWith(VALID_ID, 'ws-1');
  });

  it('rejects when ownership check resolves false', async () => {
    const verify = jest.fn().mockResolvedValue(false);
    const authorizer = makeAuthorizer(verify);

    const result = await authorizer.authorize(`background:run:${VALID_ID}`, {
      workspaceId: 'ws-1',
      userId: 'u-1',
    });

    expect(result).toEqual({ error: 'Not authorized for this background run' });
  });

  it('rejects when ownership check throws (catch → false)', async () => {
    const verify = jest.fn().mockRejectedValue(new Error('PG error'));
    const authorizer = makeAuthorizer(verify);

    const result = await authorizer.authorize(`background:run:${VALID_ID}`, {
      workspaceId: 'ws-1',
      userId: 'u-1',
    });

    expect(result).toEqual({ error: 'Not authorized for this background run' });
  });

  /**
   * 구독 인가는 워크스페이스 소유만 본다. 컨텍스트(`ChannelAuthorizerContext`)에 역할이 없어서
   * 뷰어도 이 채널을 받는다. 그래서 발행 쪽 wire 값 마스킹이 뷰어에게 자격 증명이 원문으로
   * 가지 않게 하는 층이다(CLE-T-7ZYES5, `websocket.service.spec.ts` 「kb · background 채널 값
   * 마스킹」). 컨텍스트의 `role` 로 뷰어를 거르기 시작하면 이 테스트가 깨지고, 그때 EGRESS 의 수신 인구 서술도 함께 고친다.
   */
  it('뷰어 역할도 구독할 수 있다 (역할을 보지 않는다)', async () => {
    const verify = jest.fn().mockResolvedValue(true);
    const authorizer = makeAuthorizer(verify);
    const viewerContext = {
      workspaceId: 'ws-1',
      userId: 'viewer-1',
      role: 'viewer',
    } as ChannelAuthorizerContext;

    const result = await authorizer.authorize(
      `background:run:${VALID_ID}`,
      viewerContext,
    );

    expect(result).toBeNull();
    expect(verify).toHaveBeenCalledWith(VALID_ID, 'ws-1');
  });
});
