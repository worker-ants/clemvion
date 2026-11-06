import { KbChannelAuthorizer } from './kb-channel-authorizer';
import { KnowledgeBaseService } from './knowledge-base.service';
import type { ChannelAuthorizerContext } from '../websocket/channel-authorizer';

// Document.id = @PrimaryGeneratedColumn('uuid') → 채널 documentId 는 UUID.
const VALID_DOC_ID = '44444444-4444-4444-8444-444444444444';

function makeAuthorizer(
  verifyDocumentOwnership: jest.Mock,
): KbChannelAuthorizer {
  return new KbChannelAuthorizer({
    verifyDocumentOwnership,
  } as unknown as KnowledgeBaseService);
}

describe('KbChannelAuthorizer', () => {
  it('matches only kb: channels', () => {
    const authorizer = makeAuthorizer(jest.fn());
    expect(authorizer.matches('kb:doc-1')).toBe(true);
    expect(authorizer.matches('execution:doc-1')).toBe(false);
  });

  it('rejects non-UUID documentId before DB lookup (비-UUID 선차단 일관성)', async () => {
    const verify = jest.fn();
    const authorizer = makeAuthorizer(verify);

    const result = await authorizer.authorize('kb:not-a-uuid', {
      workspaceId: 'ws-1',
      userId: 'u-1',
    });

    expect(result).toEqual({ error: 'Not authorized for this document' });
    expect(verify).not.toHaveBeenCalled();
  });

  it('allows when document ownership verified', async () => {
    const verify = jest.fn().mockResolvedValue(true);
    const authorizer = makeAuthorizer(verify);

    const result = await authorizer.authorize(`kb:${VALID_DOC_ID}`, {
      workspaceId: 'ws-1',
      userId: 'u-1',
    });

    expect(result).toBeNull();
    expect(verify).toHaveBeenCalledWith(VALID_DOC_ID, 'ws-1');
  });

  it('rejects when ownership check resolves false (cross-workspace)', async () => {
    const verify = jest.fn().mockResolvedValue(false);
    const authorizer = makeAuthorizer(verify);

    const result = await authorizer.authorize(`kb:${VALID_DOC_ID}`, {
      workspaceId: 'ws-other',
      userId: 'u-1',
    });

    expect(result).toEqual({ error: 'Not authorized for this document' });
  });

  it('rejects when ownership check throws', async () => {
    const verify = jest.fn().mockRejectedValue(new Error('PG error'));
    const authorizer = makeAuthorizer(verify);

    const result = await authorizer.authorize(`kb:${VALID_DOC_ID}`, {
      workspaceId: 'ws-1',
      userId: 'u-1',
    });

    expect(result).toEqual({ error: 'Not authorized for this document' });
  });

  /**
   * 구독 인가는 워크스페이스 소유만 본다. 컨텍스트(`ChannelAuthorizerContext`)에 역할 필드가 없어서
   * 뷰어도 이 채널을 받는다. 그래서 발행 쪽 wire 값 마스킹이 뷰어에게 자격 증명이 원문으로
   * 가지 않게 하는 층이다(CLE-T-7ZYES5, `websocket.service.spec.ts` 「kb · background 채널 값
   * 마스킹」). 이 테스트는 그 전제(컨텍스트에 `role` 이 없다)를 타입 수준에서 고정한다.
   * 컨텍스트에 `role` 이 생기면 컴파일 단계에서 걸리고, 그때 EGRESS 의 수신 인구 서술도 함께 고친다.
   */
  it('컨텍스트에 역할 필드가 없어 뷰어도 구독할 수 있다', async () => {
    const contextHasNoRole: 'role' extends keyof ChannelAuthorizerContext
      ? never
      : true = true;
    expect(contextHasNoRole).toBe(true);

    const verify = jest.fn().mockResolvedValue(true);
    const authorizer = makeAuthorizer(verify);

    const result = await authorizer.authorize(`kb:${VALID_DOC_ID}`, {
      workspaceId: 'ws-1',
      userId: 'viewer-1',
    });

    expect(result).toBeNull();
    expect(verify).toHaveBeenCalledWith(VALID_DOC_ID, 'ws-1');
  });
});
