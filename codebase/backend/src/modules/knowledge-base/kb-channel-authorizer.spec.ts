import { KbChannelAuthorizer } from './kb-channel-authorizer';
import { KnowledgeBaseService } from './knowledge-base.service';

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
});
