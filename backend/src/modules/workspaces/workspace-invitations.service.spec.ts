import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  NotFoundException,
} from '@nestjs/common';
import type { DataSource, EntityManager } from 'typeorm';
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

/**
 * Builds a stub DataSource whose `transaction(cb)` invokes cb with an
 * EntityManager that returns the same repository mocks the service top-level
 * was wired with. We also stub a chainable QueryBuilder for the atomic accept
 * UPDATE.
 */
function buildDataSource(opts: {
  invitationRepo: Record<string, Mock>;
  memberRepo: Record<string, Mock>;
  updateAffected?: number;
}): { dataSource: DataSource; updateMock: Mock } {
  const updateMock = jest
    .fn()
    .mockResolvedValue({ affected: opts.updateAffected ?? 1 });
  const qb = {
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    execute: updateMock,
  };
  // service calls invitationRepo.createQueryBuilder() — attach for both
  // the top-level repo and the manager.getRepository(...) result.
  opts.invitationRepo.createQueryBuilder = jest.fn().mockReturnValue(qb);

  const manager = {
    getRepository: jest.fn((entity: { name?: string }) => {
      const name =
        typeof entity === 'function' ? entity.name : (entity?.name ?? '');
      if (name === 'WorkspaceInvitation') return opts.invitationRepo;
      if (name === 'WorkspaceMember') return opts.memberRepo;
      throw new Error(`unexpected repo: ${name}`);
    }),
  } as unknown as EntityManager;

  const dataSource = {
    transaction: jest.fn(async (cb: (m: EntityManager) => Promise<unknown>) =>
      cb(manager),
    ),
  } as unknown as DataSource;

  return { dataSource, updateMock };
}

describe('WorkspaceInvitationsService', () => {
  let service: WorkspaceInvitationsService;
  let invitationRepo: Record<string, Mock>;
  let workspaceRepo: Record<string, Mock>;
  let memberRepo: Record<string, Mock>;
  let userRepo: Record<string, Mock>;
  let mailService: { sendWorkspaceInvitationEmail: Mock };
  let dataSource: DataSource;
  let updateMock: Mock;

  beforeEach(() => {
    invitationRepo = repo();
    workspaceRepo = repo();
    memberRepo = repo();
    userRepo = repo();
    mailService = {
      sendWorkspaceInvitationEmail: jest.fn().mockResolvedValue(undefined),
    };
    const built = buildDataSource({ invitationRepo, memberRepo });
    dataSource = built.dataSource;
    updateMock = built.updateMock;
    service = new WorkspaceInvitationsService(
      invitationRepo as never,
      workspaceRepo as never,
      memberRepo as never,
      userRepo as never,
      mailService as never,
      dataSource,
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

    it('overwrites pending invitation with new token (does NOT reject)', async () => {
      memberRepo.findOne.mockResolvedValueOnce({ role: 'admin' });
      workspaceRepo.findOne.mockResolvedValueOnce({
        id: 'ws-1',
        name: 'Team',
        type: 'team',
      });
      userRepo.findOne
        .mockResolvedValueOnce(null) // existingUser lookup
        .mockResolvedValueOnce({ id: 'user-1', name: 'Alice' }); // inviter
      const existing = {
        id: 'inv-1',
        token: 'old-token',
        email: 'b@x.com',
        role: 'viewer',
        invitedBy: 'someone-else',
        expiresAt: new Date(Date.now() - 1000),
      };
      invitationRepo.findOne.mockResolvedValueOnce(existing);

      const result = await service.invite(
        'ws-1',
        'b@x.com',
        'editor',
        'user-1',
      );
      expect(result.id).toBe('inv-1');
      expect(result.token).not.toBe('old-token');
      expect(result.token).toMatch(/^[A-Za-z0-9_-]+$/); // base64url
      expect(result.token.length).toBe(64);
      expect(result.role).toBe('editor');
      expect(result.invitedBy).toBe('user-1');
      expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
      expect(invitationRepo.save).toHaveBeenCalled();
    });

    it('creates invitation, persists, and sends email with invitedByName', async () => {
      memberRepo.findOne.mockResolvedValueOnce({ role: 'admin' });
      workspaceRepo.findOne.mockResolvedValueOnce({
        id: 'ws-1',
        name: 'Team',
        type: 'team',
      });
      userRepo.findOne
        .mockResolvedValueOnce(null) // existingUser (invitee)
        .mockResolvedValueOnce({ id: 'user-1', name: 'Alice' }); // inviter
      invitationRepo.findOne.mockResolvedValueOnce(null);

      const result = await service.invite(
        'ws-1',
        'NEW@example.com',
        'editor',
        'user-1',
      );
      expect(result.email).toBe('new@example.com');
      expect(result.role).toBe('editor');
      expect(result.token).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(result.token.length).toBe(64);
      expect(invitationRepo.save).toHaveBeenCalled();
      expect(mailService.sendWorkspaceInvitationEmail).toHaveBeenCalledWith(
        'new@example.com',
        'Team',
        'Alice',
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
      userRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'user-1', name: 'Alice' });
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

  describe('resend', () => {
    it('rejects non-admin', async () => {
      memberRepo.findOne.mockResolvedValueOnce(null);
      await expect(
        service.resend('ws-1', 'inv-1', 'user-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects already-accepted invitations', async () => {
      memberRepo.findOne.mockResolvedValueOnce({ role: 'admin' });
      invitationRepo.findOne.mockResolvedValueOnce({
        id: 'inv-1',
        acceptedAt: new Date(),
        token: 'old',
      });
      await expect(
        service.resend('ws-1', 'inv-1', 'user-1'),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('reissues token, resets expiry, dispatches mail', async () => {
      memberRepo.findOne.mockResolvedValueOnce({ role: 'admin' });
      const existing = {
        id: 'inv-1',
        token: 'old-token',
        email: 'b@x.com',
        role: 'editor',
        invitedBy: 'someone-else',
        acceptedAt: null,
        expiresAt: new Date(Date.now() - 1000),
        workspaceId: 'ws-1',
      };
      invitationRepo.findOne.mockResolvedValueOnce(existing);
      workspaceRepo.findOne.mockResolvedValueOnce({ id: 'ws-1', name: 'Team' });
      userRepo.findOne.mockResolvedValueOnce({ id: 'user-1', name: 'Alice' });

      const result = await service.resend('ws-1', 'inv-1', 'user-1');
      expect(result.token).not.toBe('old-token');
      expect(result.token).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(result.token.length).toBe(64);
      expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
      expect(result.invitedBy).toBe('user-1');
      expect(mailService.sendWorkspaceInvitationEmail).toHaveBeenCalledWith(
        'b@x.com',
        'Team',
        'Alice',
        result.token,
      );
    });
  });

  describe('getMetaByToken', () => {
    it('returns 404 when token does not exist', async () => {
      invitationRepo.findOne.mockResolvedValueOnce(null);
      await expect(service.getMetaByToken('bad')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('returns 410 when token already used', async () => {
      invitationRepo.findOne.mockResolvedValueOnce({
        token: 't',
        acceptedAt: new Date(),
        expiresAt: new Date(Date.now() + 1000),
      });
      await expect(service.getMetaByToken('t')).rejects.toBeInstanceOf(
        GoneException,
      );
    });

    it('returns 410 when token expired', async () => {
      invitationRepo.findOne.mockResolvedValueOnce({
        token: 't',
        acceptedAt: null,
        expiresAt: new Date(Date.now() - 1000),
      });
      await expect(service.getMetaByToken('t')).rejects.toBeInstanceOf(
        GoneException,
      );
    });

    it('returns workspaceName, invitedByName, email, role, expiresAt', async () => {
      invitationRepo.findOne.mockResolvedValueOnce({
        token: 't',
        email: 'a@x.com',
        role: 'editor',
        workspaceId: 'ws-1',
        invitedBy: 'user-1',
        acceptedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
      });
      workspaceRepo.findOne.mockResolvedValueOnce({ id: 'ws-1', name: 'Team' });
      userRepo.findOne.mockResolvedValueOnce({ id: 'user-1', name: 'Alice' });

      const meta = await service.getMetaByToken('t');
      expect(meta).toEqual({
        workspaceName: 'Team',
        invitedByName: 'Alice',
        email: 'a@x.com',
        role: 'editor',
        expiresAt: expect.any(Date),
      });
    });

    it('returns null invitedByName when inviter is gone', async () => {
      invitationRepo.findOne.mockResolvedValueOnce({
        token: 't',
        email: 'a@x.com',
        role: 'editor',
        workspaceId: 'ws-1',
        invitedBy: null,
        acceptedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
      });
      workspaceRepo.findOne.mockResolvedValueOnce({ id: 'ws-1', name: 'Team' });

      const meta = await service.getMetaByToken('t');
      expect(meta.invitedByName).toBeNull();
    });
  });

  describe('accept', () => {
    it('throws NotFound when token does not exist', async () => {
      invitationRepo.findOne.mockResolvedValueOnce(null);
      await expect(service.accept('bad', 'user-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('throws 410 Gone when invitation already accepted', async () => {
      invitationRepo.findOne.mockResolvedValueOnce({
        token: 't',
        acceptedAt: new Date(),
        expiresAt: new Date(Date.now() + 1000),
      });
      await expect(service.accept('t', 'user-1')).rejects.toBeInstanceOf(
        GoneException,
      );
    });

    it('throws 410 Gone when invitation expired', async () => {
      invitationRepo.findOne.mockResolvedValueOnce({
        token: 't',
        acceptedAt: null,
        expiresAt: new Date(Date.now() - 1000),
      });
      await expect(service.accept('t', 'user-1')).rejects.toBeInstanceOf(
        GoneException,
      );
    });

    it('throws 400 when accepting user email mismatches invitation email', async () => {
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
        BadRequestException,
      );
    });

    it('creates membership and stamps invitation accepted on success', async () => {
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
      expect(updateMock).toHaveBeenCalled();
    });

    it('skips duplicate membership insert when user is already a member', async () => {
      const inv = {
        id: 'inv-1',
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
      expect(updateMock).toHaveBeenCalled();
    });

    it('losing side of concurrent accept sees 410', async () => {
      const built = buildDataSource({
        invitationRepo,
        memberRepo,
        updateAffected: 0,
      });
      service = new WorkspaceInvitationsService(
        invitationRepo as never,
        workspaceRepo as never,
        memberRepo as never,
        userRepo as never,
        mailService as never,
        built.dataSource,
      );
      invitationRepo.findOne.mockResolvedValueOnce({
        id: 'inv-1',
        token: 't',
        email: 'a@x.com',
        role: 'editor',
        workspaceId: 'ws-1',
        acceptedAt: null,
        expiresAt: new Date(Date.now() + 1000),
      });
      userRepo.findOne.mockResolvedValueOnce({
        id: 'user-1',
        email: 'a@x.com',
      });

      await expect(service.accept('t', 'user-1')).rejects.toBeInstanceOf(
        GoneException,
      );
    });
  });

  describe('consumeForRegistration', () => {
    async function captureManager(): Promise<EntityManager> {
      let captured: EntityManager | undefined;
      await dataSource.transaction(async (m) => {
        captured = m;
      });
      if (!captured) throw new Error('manager not captured');
      return captured;
    }

    it('attaches membership inside provided manager', async () => {
      const inv = {
        id: 'inv-1',
        token: 't',
        email: 'a@x.com',
        role: 'viewer' as const,
        workspaceId: 'ws-1',
        acceptedAt: null,
        expiresAt: new Date(Date.now() + 1000),
      };
      invitationRepo.findOne.mockResolvedValueOnce(inv);
      memberRepo.findOne.mockResolvedValueOnce(null);

      const manager = await captureManager();
      const result = await service.consumeForRegistration(
        manager,
        't',
        'user-1',
      );
      expect(result).toEqual({
        workspaceId: 'ws-1',
        role: 'viewer',
        email: 'a@x.com',
      });
      expect(memberRepo.save).toHaveBeenCalled();
    });

    it('throws 410 when expired', async () => {
      invitationRepo.findOne.mockResolvedValueOnce({
        id: 'inv-1',
        token: 't',
        email: 'a@x.com',
        role: 'viewer',
        workspaceId: 'ws-1',
        acceptedAt: null,
        expiresAt: new Date(Date.now() - 1000),
      });
      const manager = await captureManager();
      await expect(
        service.consumeForRegistration(manager, 't', 'user-1'),
      ).rejects.toBeInstanceOf(GoneException);
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
