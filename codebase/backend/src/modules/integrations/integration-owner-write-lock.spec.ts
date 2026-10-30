import { ForbiddenException } from '@nestjs/common';
import { Workspace } from '../workspaces/entities/workspace.entity';
import { WorkspaceMember } from '../workspaces/entities/workspace-member.entity';
import {
  lockForIntegrationWrite,
  throwUnlessIntegrationCreateLocked,
} from './integration-owner-write-lock';

function makeManager(found: { workspace: boolean; member: boolean }) {
  const order: string[] = [];
  const findOne = jest.fn((entity: unknown) => {
    if (entity === Workspace) {
      order.push('workspace');
      return Promise.resolve(found.workspace ? { id: 'ws-1' } : null);
    }
    if (entity === WorkspaceMember) {
      order.push('member');
      return Promise.resolve(found.member ? { id: 'm-1' } : null);
    }
    throw new Error('unexpected entity');
  });
  return { manager: { findOne }, findOne, order };
}

describe('lockForIntegrationWrite', () => {
  it('워크스페이스를 FOR KEY SHARE 로, 개인 통합 소유자의 멤버십을 FOR SHARE 로 차례로 잠근다', async () => {
    const { manager, findOne, order } = makeManager({
      workspace: true,
      member: true,
    });

    await expect(
      lockForIntegrationWrite(manager as never, {
        workspaceId: 'ws-1',
        personalOwnerId: 'user-1',
      }),
    ).resolves.toBe('ok');

    // 순서가 규칙이다. 멤버십을 먼저 잠그면 INSERT 의 FK 확인이 워크스페이스를 그 뒤에 잡아
    // 워크스페이스 삭제 · 소유자 이양(워크스페이스 → 멤버십)과 엇갈린다.
    expect(order).toEqual(['workspace', 'member']);
    expect(findOne).toHaveBeenNthCalledWith(
      1,
      Workspace,
      expect.objectContaining({
        where: { id: 'ws-1' },
        lock: { mode: 'for_key_share' },
      }),
    );
    expect(findOne).toHaveBeenNthCalledWith(
      2,
      WorkspaceMember,
      expect.objectContaining({
        where: { workspaceId: 'ws-1', userId: 'user-1' },
        lock: { mode: 'pessimistic_read' },
      }),
    );
  });

  it('조직 통합 쓰기는 워크스페이스만 잠그고 멤버십은 읽지 않는다', async () => {
    const { manager, order } = makeManager({ workspace: true, member: false });

    await expect(
      lockForIntegrationWrite(manager as never, {
        workspaceId: 'ws-1',
        personalOwnerId: null,
      }),
    ).resolves.toBe('ok');
    expect(order).toEqual(['workspace']);
  });

  it('워크스페이스 행이 없으면 멤버십을 읽지 않고 workspace_absent 다', async () => {
    const { manager, order } = makeManager({ workspace: false, member: true });

    await expect(
      lockForIntegrationWrite(manager as never, {
        workspaceId: 'ws-1',
        personalOwnerId: 'user-1',
      }),
    ).resolves.toBe('workspace_absent');
    expect(order).toEqual(['workspace']);
  });

  it('개인 통합 소유자의 멤버십이 없으면 owner_not_member 다', async () => {
    const { manager } = makeManager({ workspace: true, member: false });

    await expect(
      lockForIntegrationWrite(manager as never, {
        workspaceId: 'ws-1',
        personalOwnerId: 'user-1',
      }),
    ).resolves.toBe('owner_not_member');
  });
});

describe('throwUnlessIntegrationCreateLocked', () => {
  it('ok 면 통과한다', () => {
    expect(() => throwUnlessIntegrationCreateLocked('ok')).not.toThrow();
  });

  it.each(['owner_not_member', 'workspace_absent'] as const)(
    '%s 면 403 NOT_A_MEMBER 다',
    (lock) => {
      try {
        throwUnlessIntegrationCreateLocked(lock);
        throw new Error('expected throw');
      } catch (err) {
        expect(err).toBeInstanceOf(ForbiddenException);
        expect((err as ForbiddenException).getResponse()).toMatchObject({
          code: 'NOT_A_MEMBER',
        });
      }
    },
  );
});
