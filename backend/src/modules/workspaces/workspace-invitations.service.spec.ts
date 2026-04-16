import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { WorkspaceInvitationsService } from './workspace-invitations.service';

type Mock = jest.Mock;

function repo(): Record<string, Mock> {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    save: jest.fn().mockImplementation((r: unknown) => r),
    create: jest.fn().mockImplementation((r: unknown) => r),
    remove: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue({ affected: 0 }),
  };
}

describe('WorkspaceInvitationsService', () => {
  let service: WorkspaceInvitationsService;
  let invitationRepo: Record<string, Mock>;
  let workspaceRepo: Record<string, Mock>;
  let memberRepo: Record<string, Mock>;
  let userRepo: Record<string, Mock>;
  let mailService: { sendWorkspaceInvitationEmail: Mock };

  beforeEach(() => {
    invitationRepo = repo();
    workspaceRepo = repo();
    memberRepo = repo();
    userRepo = repo();
    mailService = {
      sendWorkspaceInvitationEmail: jest.fn().mockResolvedValue(undefined),
    };
    service = new WorkspaceInvitationsService(
      invitationRepo as never,
      workspaceRepo as never,
      memberRepo as never,
      userRepo as never,
      mailService as never,
    );
  });

  describe('invite', () => {
    it('rejects when requester is not admin', async () => {
      memberRepo.findOne.mockResolvedValueOnce(null);
      await expect(
        service.invite('ws-1', 'a@x.com', 'editor', 'user-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects when workspace is not a team workspace', async () => {
      memberRepo.findOne.mockResolvedValueOnce({ role: 'admin' });
      workspaceRepo.findOne.mockResolvedValueOnce({
        id: 'ws-1',
        name: 'Personal',
        type: 'personal',
      });
      await expect(
        service.invite('ws-1', 'a@x.com', 'editor', 'user-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects when invitee is already a member', async () => {
      memberRepo.findOne
        .mockResolvedValueOnce({ role: 'admin' })
        .mockResolvedValueOnce({ id: 'mem-1' });
      workspaceRepo.findOne.mockResolvedValueOnce({
        id: 'ws-1',
        name: 'Team',
        type: 'team',
      });
      userRepo.findOne.mockResolvedValueOnce({ id: 'user-2' });
      await expect(
        service.invite('ws-1', 'b@x.com', 'editor', 'user-1'),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects duplicate pending invitations', async () => {
      memberRepo.findOne.mockResolvedValueOnce({ role: 'admin' });
      workspaceRepo.findOne.mockResolvedValueOnce({
        id: 'ws-1',
        name: 'Team',
        type: 'team',
      });
      userRepo.findOne.mockResolvedValueOnce(null);
      invitationRepo.findOne.mockResolvedValueOnce({ id: 'inv-1' });
      await expect(
        service.invite('ws-1', 'b@x.com', 'editor', 'user-1'),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('creates invitation, persists, and sends email', async () => {
      memberRepo.findOne.mockResolvedValueOnce({ role: 'admin' });
      workspaceRepo.findOne.mockResolvedValueOnce({
        id: 'ws-1',
        name: 'Team',
        type: 'team',
      });
      userRepo.findOne.mockResolvedValueOnce(null);
      invitationRepo.findOne.mockResolvedValueOnce(null);

      const result = await service.invite(
        'ws-1',
        'NEW@example.com',
        'editor',
        'user-1',
      );
      expect(result.email).toBe('new@example.com');
      expect(result.role).toBe('editor');
      expect(result.token).toMatch(/^[a-f0-9]+$/);
      expect(invitationRepo.save).toHaveBeenCalled();
      expect(mailService.sendWorkspaceInvitationEmail).toHaveBeenCalledWith(
        'new@example.com',
        'Team',
        result.token,
      );
    });

    it('does not roll back invitation row when mail fails', async () => {
      memberRepo.findOne.mockResolvedValueOnce({ role: 'admin' });
      workspaceRepo.findOne.mockResolvedValueOnce({
        id: 'ws-1',
        name: 'Team',
        type: 'team',
      });
      userRepo.findOne.mockResolvedValueOnce(null);
      invitationRepo.findOne.mockResolvedValueOnce(null);
      mailService.sendWorkspaceInvitationEmail.mockRejectedValueOnce(
        new Error('smtp down'),
      );

      const result = await service.invite(
        'ws-1',
        'new@example.com',
        'editor',
        'user-1',
      );
      expect(result).toBeDefined();
      expect(invitationRepo.save).toHaveBeenCalled();
    });
  });

  describe('accept', () => {
    it('throws when token does not exist', async () => {
      invitationRepo.findOne.mockResolvedValueOnce(null);
      await expect(service.accept('bad', 'user-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('throws when invitation already accepted', async () => {
      invitationRepo.findOne.mockResolvedValueOnce({
        token: 't',
        acceptedAt: new Date(),
        expiresAt: new Date(Date.now() + 1000),
      });
      await expect(service.accept('t', 'user-1')).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('throws when invitation expired', async () => {
      invitationRepo.findOne.mockResolvedValueOnce({
        token: 't',
        acceptedAt: null,
        expiresAt: new Date(Date.now() - 1000),
      });
      await expect(service.accept('t', 'user-1')).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('throws when accepting user email mismatches invitation email', async () => {
      invitationRepo.findOne.mockResolvedValueOnce({
        token: 't',
        email: 'invited@x.com',
        acceptedAt: null,
        expiresAt: new Date(Date.now() + 1000),
        workspaceId: 'ws-1',
        role: 'editor',
      });
      userRepo.findOne.mockResolvedValueOnce({
        id: 'user-1',
        email: 'someone-else@x.com',
      });
      await expect(service.accept('t', 'user-1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('creates membership and marks invitation accepted on success', async () => {
      const inv = {
        id: 'inv-1',
        token: 't',
        email: 'invited@x.com',
        role: 'editor' as const,
        workspaceId: 'ws-1',
        acceptedAt: null,
        acceptedBy: null,
        expiresAt: new Date(Date.now() + 1000),
      };
      invitationRepo.findOne.mockResolvedValueOnce(inv);
      userRepo.findOne.mockResolvedValueOnce({
        id: 'user-1',
        email: 'INVITED@x.com',
      });
      memberRepo.findOne.mockResolvedValueOnce(null);

      const result = await service.accept('t', 'user-1');
      expect(result).toEqual({ workspaceId: 'ws-1', role: 'editor' });
      expect(memberRepo.save).toHaveBeenCalled();
      expect(invitationRepo.save).toHaveBeenCalled();
      expect(inv.acceptedBy).toBe('user-1');
      expect(inv.acceptedAt).toBeInstanceOf(Date);
    });

    it('marks invitation accepted but skips duplicate membership insert', async () => {
      const inv = {
        token: 't',
        email: 'a@x.com',
        role: 'editor' as const,
        workspaceId: 'ws-1',
        acceptedAt: null,
        acceptedBy: null,
        expiresAt: new Date(Date.now() + 1000),
      };
      invitationRepo.findOne.mockResolvedValueOnce(inv);
      userRepo.findOne.mockResolvedValueOnce({
        id: 'user-1',
        email: 'a@x.com',
      });
      memberRepo.findOne.mockResolvedValueOnce({ id: 'existing' });

      await service.accept('t', 'user-1');
      expect(memberRepo.save).not.toHaveBeenCalled();
      expect(invitationRepo.save).toHaveBeenCalled();
    });
  });

  describe('pruneExpired', () => {
    it('delegates to delete with expiresAt < now', async () => {
      invitationRepo.delete.mockResolvedValueOnce({ affected: 3 });
      const removed = await service.pruneExpired(new Date());
      expect(removed).toBe(3);
      expect(invitationRepo.delete).toHaveBeenCalled();
    });
  });
});
