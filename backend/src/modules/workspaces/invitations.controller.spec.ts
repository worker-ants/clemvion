import { GoneException, NotFoundException } from '@nestjs/common';
import { InvitationsController } from './invitations.controller';
import type { WorkspaceInvitationsService } from './workspace-invitations.service';

describe('InvitationsController', () => {
  let controller: InvitationsController;
  let service: jest.Mocked<Pick<WorkspaceInvitationsService, 'getMetaByToken'>>;

  beforeEach(() => {
    service = {
      getMetaByToken: jest.fn(),
    } as jest.Mocked<Pick<WorkspaceInvitationsService, 'getMetaByToken'>>;
    controller = new InvitationsController(
      service as unknown as WorkspaceInvitationsService,
    );
  });

  it('returns the wrapped meta on success', async () => {
    const meta = {
      workspaceName: 'Team Alpha',
      invitedByName: 'Alice',
      email: 'invited@example.com',
      role: 'editor' as const,
      expiresAt: new Date(Date.now() + 60_000),
    };
    service.getMetaByToken.mockResolvedValue(meta);

    const result = await controller.getMeta('t');
    expect(result).toEqual({ data: meta });
    expect(service.getMetaByToken).toHaveBeenCalledWith('t');
  });

  it('propagates NotFoundException (404) for missing token', async () => {
    service.getMetaByToken.mockRejectedValue(
      new NotFoundException({ code: 'invitation_not_found' }),
    );
    await expect(controller.getMeta('bad')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('propagates GoneException (410) for expired/used token', async () => {
    service.getMetaByToken.mockRejectedValue(
      new GoneException({ code: 'invitation_expired' }),
    );
    await expect(controller.getMeta('old')).rejects.toBeInstanceOf(
      GoneException,
    );
  });
});
