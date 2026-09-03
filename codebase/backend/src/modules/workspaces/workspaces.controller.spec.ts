import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { WorkspacesController } from './workspaces.controller';
import { WorkspacesService } from './workspaces.service';
import { WorkspaceInvitationsService } from './workspace-invitations.service';
import type { JwtPayload } from '../../common/decorators';

describe('WorkspacesController', () => {
  let controller: WorkspacesController;
  let service: jest.Mocked<WorkspacesService>;
  let invitations: jest.Mocked<WorkspaceInvitationsService>;

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
    invitations = module.get(WorkspaceInvitationsService);
  });

  describe('listInvitations', () => {
    /**
     * `invited_by` 는 `ON DELETE SET NULL`(V017) 이라 **초대자 계정이 삭제되면 NULL** 이
     * 되고, 대기 중 초대는 그대로 남는다. 이 핸들러는 값을 **그대로 통과**시키므로 `null`
     * 이 응답 본문에 실린다 — `WorkspaceInvitationDto.invitedBy` 가 nullable 로 선언돼야
     * 하는 근거가 이것이다.
     *
     * 이 테스트가 고정하는 것은 **통과 동작**이다. 여기에 `?? ''` 같은 코어션을 넣으면
     * 이 테스트가 깨지고, 그때 DTO 선언도 함께 재검토해야 한다.
     */
    it('초대자가 삭제된 초대의 `invitedBy: null` 을 코어션 없이 그대로 싣는다', async () => {
      invitations.listPending.mockResolvedValue([
        {
          id: 'inv-1',
          email: 'a@example.com',
          role: 'editor',
          expiresAt: '2026-12-31T00:00:00.000Z',
          invitedBy: null,
          createdAt: '2026-09-03T00:00:00.000Z',
        },
      ] as never);

      const result = await controller.listInvitations(user, 'ws-1');

      expect(result.data[0].invitedBy).toBeNull();
    });

    it('[대조군] 초대자가 살아 있으면 그 id 를 싣는다', async () => {
      invitations.listPending.mockResolvedValue([
        {
          id: 'inv-2',
          email: 'b@example.com',
          role: 'viewer',
          expiresAt: '2026-12-31T00:00:00.000Z',
          invitedBy: 'user-uuid-1',
          createdAt: '2026-09-03T00:00:00.000Z',
        },
      ] as never);

      const result = await controller.listInvitations(user, 'ws-1');

      expect(result.data[0].invitedBy).toBe('user-uuid-1');
    });
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

    it('propagates ForbiddenException for personal workspace', async () => {
      service.transferOwnership.mockRejectedValue(
        new ForbiddenException({ code: 'CANNOT_TRANSFER_PERSONAL' }),
      );
      await expect(
        controller.transferOwnership(user, 'ws-1', {
          newOwnerMemberId: 'mem-2',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('propagates BadRequestException when target is self', async () => {
      service.transferOwnership.mockRejectedValue(
        new BadRequestException({ code: 'TARGET_IS_SELF' }),
      );
      await expect(
        controller.transferOwnership(user, 'ws-1', {
          newOwnerMemberId: 'mem-self',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('propagates NotFoundException when target member missing', async () => {
      service.transferOwnership.mockRejectedValue(
        new NotFoundException({ code: 'MEMBER_NOT_FOUND' }),
      );
      await expect(
        controller.transferOwnership(user, 'ws-1', {
          newOwnerMemberId: 'mem-2',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('propagates ConflictException when target already owner', async () => {
      service.transferOwnership.mockRejectedValue(
        new ConflictException({ code: 'TARGET_ALREADY_OWNER' }),
      );
      await expect(
        controller.transferOwnership(user, 'ws-1', {
          newOwnerMemberId: 'mem-2',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });
});
