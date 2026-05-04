import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { WorkspacesController } from './workspaces.controller';
import { WorkspacesService } from './workspaces.service';
import { WorkspaceInvitationsService } from './workspace-invitations.service';
import type { JwtPayload } from '../../common/decorators';

describe('WorkspacesController', () => {
  let controller: WorkspacesController;
  let service: jest.Mocked<WorkspacesService>;

  const user: JwtPayload = {
    sub: 'user-uuid-1',
    email: 'me@example.com',
  } as JwtPayload;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WorkspacesController],
      providers: [
        {
          provide: WorkspacesService,
          useValue: {
            listForUser: jest.fn(),
            createTeam: jest.fn(),
            findById: jest.fn(),
            renameWorkspace: jest.fn(),
            deleteWorkspace: jest.fn(),
            leaveWorkspace: jest.fn(),
            listMembers: jest.fn(),
            addMemberByEmail: jest.fn(),
            updateMemberRole: jest.fn(),
            removeMember: jest.fn(),
            transferOwnership: jest.fn(),
          },
        },
        {
          provide: WorkspaceInvitationsService,
          useValue: {
            listPending: jest.fn(),
            invite: jest.fn(),
            revoke: jest.fn(),
            accept: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(WorkspacesController);
    service = module.get(WorkspacesService);
  });

  describe('update', () => {
    it('delegates to renameWorkspace and wraps response', async () => {
      service.renameWorkspace.mockResolvedValue({
        id: 'ws-1',
        name: 'New Name',
        type: 'team',
        slug: 'team-abc',
      } as never);

      const result = await controller.update(user, 'ws-1', {
        name: 'New Name',
      });

      expect(service.renameWorkspace).toHaveBeenCalledWith(
        'ws-1',
        'New Name',
        user.sub,
      );
      expect(result).toEqual({
        data: { id: 'ws-1', name: 'New Name', type: 'team', slug: 'team-abc' },
      });
    });

    it('propagates service errors', async () => {
      service.renameWorkspace.mockRejectedValue(
        new ForbiddenException({ code: 'ADMIN_REQUIRED' }),
      );
      await expect(
        controller.update(user, 'ws-1', { name: 'New Name' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('remove', () => {
    it('delegates to deleteWorkspace and returns ok envelope', async () => {
      service.deleteWorkspace.mockResolvedValue(undefined);

      const result = await controller.remove(user, 'ws-1');

      expect(service.deleteWorkspace).toHaveBeenCalledWith('ws-1', user.sub);
      expect(result).toEqual({ data: { ok: true } });
    });

    it('propagates NotFoundException', async () => {
      service.deleteWorkspace.mockRejectedValue(
        new NotFoundException({ code: 'WORKSPACE_NOT_FOUND' }),
      );
      await expect(controller.remove(user, 'ws-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('leave', () => {
    it('delegates to leaveWorkspace and returns ok envelope', async () => {
      service.leaveWorkspace.mockResolvedValue(undefined);

      const result = await controller.leave(user, 'ws-1');

      expect(service.leaveWorkspace).toHaveBeenCalledWith('ws-1', user.sub);
      expect(result).toEqual({ data: { ok: true } });
    });

    it('propagates ForbiddenException for sole owner', async () => {
      service.leaveWorkspace.mockRejectedValue(
        new ForbiddenException({ code: 'SOLE_OWNER_CANNOT_LEAVE' }),
      );
      await expect(controller.leave(user, 'ws-1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });

  describe('transferOwnership', () => {
    it('delegates to transferOwnership and returns ok envelope', async () => {
      service.transferOwnership.mockResolvedValue(undefined);

      const result = await controller.transferOwnership(user, 'ws-1', {
        newOwnerMemberId: 'mem-2',
      });

      expect(service.transferOwnership).toHaveBeenCalledWith(
        'ws-1',
        user.sub,
        'mem-2',
      );
      expect(result).toEqual({ data: { ok: true } });
    });

    it('propagates ForbiddenException when requester is not owner', async () => {
      service.transferOwnership.mockRejectedValue(
        new ForbiddenException({ code: 'OWNER_REQUIRED' }),
      );
      await expect(
        controller.transferOwnership(user, 'ws-1', {
          newOwnerMemberId: 'mem-2',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
