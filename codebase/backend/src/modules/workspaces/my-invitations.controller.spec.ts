import { GoneException, NotFoundException } from '@nestjs/common';
import { MyInvitationsController } from './my-invitations.controller';
import type { WorkspaceInvitationsService } from './workspace-invitations.service';
import type { JwtPayload } from '../../common/decorators';

describe('MyInvitationsController', () => {
  const INVITATION_ID = '0b9d6f0e-1c2a-4b8e-9a51-3f2d7c6e8a10';
  const user = { sub: 'user-1' } as JwtPayload;
  let controller: MyInvitationsController;
  let service: jest.Mocked<
    Pick<WorkspaceInvitationsService, 'getMetaForRecipient' | 'acceptById'>
  >;

  beforeEach(() => {
    service = {
      getMetaForRecipient: jest.fn(),
      acceptById: jest.fn(),
    };
    controller = new MyInvitationsController(
      service as unknown as WorkspaceInvitationsService,
    );
  });

  it('GET :invitationId 는 로그인 사용자 기준 메타를 감싸 돌려준다', async () => {
    const meta = {
      workspaceName: 'Team Alpha',
      invitedByName: 'Alice',
      email: 'invited@example.com',
      role: 'editor' as const,
      expiresAt: new Date(Date.now() + 60_000),
    };
    service.getMetaForRecipient.mockResolvedValue(meta);

    await expect(controller.getMeta(user, INVITATION_ID)).resolves.toEqual({
      data: meta,
    });
    expect(service.getMetaForRecipient).toHaveBeenCalledWith(
      INVITATION_ID,
      'user-1',
    );
  });

  it('POST :invitationId/accept 는 수락 결과를 감싸 돌려준다', async () => {
    service.acceptById.mockResolvedValue({
      workspaceId: 'ws-1',
      role: 'editor',
    });

    await expect(controller.accept(user, INVITATION_ID)).resolves.toEqual({
      data: { workspaceId: 'ws-1', role: 'editor' },
    });
    expect(service.acceptById).toHaveBeenCalledWith(INVITATION_ID, 'user-1');
  });

  it('서비스의 404 · 410 을 그대로 올린다', async () => {
    service.getMetaForRecipient.mockRejectedValue(
      new NotFoundException({ code: 'invitation_not_found' }),
    );
    service.acceptById.mockRejectedValue(
      new GoneException({ code: 'invitation_expired' }),
    );
    await expect(
      controller.getMeta(user, INVITATION_ID),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(controller.accept(user, INVITATION_ID)).rejects.toBeInstanceOf(
      GoneException,
    );
  });
});
