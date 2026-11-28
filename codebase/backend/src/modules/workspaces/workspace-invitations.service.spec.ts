import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  NotFoundException,
} from '@nestjs/common';
import { IsNull, LessThan } from 'typeorm';
import type { DataSource, EntityManager } from 'typeorm';
import {
  WorkspaceInvitationsService,
  invitationNotFoundException,
} from './workspace-invitations.service';

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
  let notifications: { notify: Mock };
  let auditLogs: { record: Mock };
  let usersService: { lookupByEmail: Mock };

  beforeEach(() => {
    invitationRepo = repo();
    workspaceRepo = repo();
    memberRepo = repo();
    userRepo = repo();
    mailService = {
      sendWorkspaceInvitationEmail: jest.fn().mockResolvedValue(undefined),
    };
    notifications = { notify: jest.fn().mockResolvedValue(undefined) };
    auditLogs = { record: jest.fn().mockResolvedValue(undefined) };
    usersService = {
      lookupByEmail: jest.fn().mockResolvedValue({ kind: 'none' }),
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
      notifications as never,
      auditLogs as never,
      usersService as never,
    );
  });

  describe('invite', () => {
    it('rejects when requester is not admin', async () => {
      memberRepo.findOne.mockResolvedValueOnce(null);
      await expect(
        service.invite('ws-1', 'a@x.com', 'editor', 'user-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    /**
     * NERV CLE-ACCT-WS 「관리자 역할 규칙」 — 관리자 역할로 초대하는 것은 owner 만 한다. 대기 중인 관리자 초대를 다른
     * 역할로 덮어쓰는 것도 관리자 역할을 빼는 일이라 owner 만 한다(CLE-T-0W7CA7).
     */
    describe('관리자 역할 초대는 owner 만 한다', () => {
      const OWNER_ONLY = {
        code: 'OWNER_REQUIRED',
        message: 'Only the owner can grant or revoke the admin role.',
      };

      function arrange(requesterRole: string, pendingRole?: string): void {
        memberRepo.findOne.mockResolvedValueOnce({ role: requesterRole });
        workspaceRepo.findOne.mockResolvedValueOnce({
          id: 'ws-1',
          name: 'Team',
          type: 'team',
        });
        userRepo.findOne.mockResolvedValueOnce({ id: 'user-1', name: 'Alice' }); // inviter
        invitationRepo.findOne.mockResolvedValueOnce(
          pendingRole
            ? {
                id: 'inv-1',
                token: 'old-token',
                email: 'b@x.com',
                role: pendingRole,
                invitedBy: 'owner-1',
                expiresAt: new Date(Date.now() + 1000),
              }
            : null,
        );
      }

      async function rejection(promise: Promise<unknown>): Promise<unknown> {
        return promise.then(
          () => {
            throw new Error('expected rejection');
          },
          (err: unknown) => err,
        );
      }

      it('admin 요청자의 admin 초대는 403 OWNER_REQUIRED 이고 초대를 만들지 않는다', async () => {
        arrange('admin');

        const err = await rejection(
          service.invite('ws-1', 'b@x.com', 'admin', 'user-1'),
        );
        expect(err).toBeInstanceOf(ForbiddenException);
        expect((err as ForbiddenException).getResponse()).toEqual(OWNER_ONLY);
        expect(invitationRepo.save).not.toHaveBeenCalled();
        expect(mailService.sendWorkspaceInvitationEmail).not.toHaveBeenCalled();
        expect(auditLogs.record).not.toHaveBeenCalled();
      });

      it('admin 요청자가 대기 중인 admin 초대를 editor 로 덮어쓰면 403 OWNER_REQUIRED', async () => {
        arrange('admin', 'admin');

        const err = await rejection(
          service.invite('ws-1', 'b@x.com', 'editor', 'user-1'),
        );
        expect(err).toBeInstanceOf(ForbiddenException);
        expect((err as ForbiddenException).getResponse()).toEqual(OWNER_ONLY);
        expect(invitationRepo.save).not.toHaveBeenCalled();
        expect(mailService.sendWorkspaceInvitationEmail).not.toHaveBeenCalled();
      });

      it.each([
        ['owner', 'admin', undefined],
        ['owner', 'editor', 'admin'],
        ['admin', 'editor', undefined],
        ['admin', 'viewer', 'editor'],
      ] as Array<[string, 'admin' | 'editor' | 'viewer', string | undefined]>)(
        '%s 요청자의 %s 초대(대기 초대 역할 %s)는 만든다',
        async (requesterRole, role, pendingRole) => {
          arrange(requesterRole, pendingRole);

          const result = await service.invite(
            'ws-1',
            'b@x.com',
            role,
            'user-1',
          );
          expect(result.role).toBe(role);
          expect(invitationRepo.save).toHaveBeenCalled();
        },
      );
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
      usersService.lookupByEmail.mockResolvedValueOnce({
        kind: 'found',
        user: { id: 'user-2' },
      });
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
      userRepo.findOne.mockResolvedValueOnce({ id: 'user-1', name: 'Alice' }); // inviter
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
      // 대기 중(acceptedAt IS NULL)인 초대만 덮어쓴다. 읽은 역할을 동시 변경이 덮어쓰지 못하게 잠그고 읽는다.
      expect(invitationRepo.findOne).toHaveBeenCalledWith({
        where: { workspaceId: 'ws-1', email: 'b@x.com', acceptedAt: IsNull() },
        lock: { mode: 'pessimistic_write' },
      });
    });

    it('creates invitation, persists, and sends email with invitedByName', async () => {
      memberRepo.findOne.mockResolvedValueOnce({ role: 'admin' });
      workspaceRepo.findOne.mockResolvedValueOnce({
        id: 'ws-1',
        name: 'Team',
        type: 'team',
      });
      userRepo.findOne.mockResolvedValueOnce({ id: 'user-1', name: 'Alice' }); // inviter
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
      // 결정4=B: 초대 발급은 member.invited(mode=invitation) 로 감사. raw 이메일은 미저장(PII).
      expect(auditLogs.record).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: 'ws-1',
          userId: 'user-1',
          action: 'member.invited',
          resourceType: 'member',
          details: expect.objectContaining({
            mode: 'invitation',
            role: 'editor',
          }),
        }),
      );
      const recordArg = auditLogs.record.mock.calls[0][0] as {
        details: Record<string, unknown>;
      };
      expect(recordArg.details).not.toHaveProperty('email');
    });

    it('기존 가입자(비멤버) 초대 시 team_invite 알림 발사(channel=in_app)', async () => {
      memberRepo.findOne
        .mockResolvedValueOnce({ role: 'admin' }) // requester (assertAdmin)
        .mockResolvedValueOnce(null); // invitee 는 아직 비멤버
      workspaceRepo.findOne.mockResolvedValueOnce({
        id: 'ws-1',
        name: 'Team',
        type: 'team',
      });
      usersService.lookupByEmail.mockResolvedValueOnce({
        kind: 'found',
        user: { id: 'user-9', email: 'ex@x.com' },
      });
      userRepo.findOne.mockResolvedValueOnce({ id: 'inviter', name: 'Bob' }); // inviter
      invitationRepo.findOne.mockResolvedValueOnce(null);
      invitationRepo.save.mockResolvedValueOnce({ id: 'inv-1' });

      await service.invite('ws-1', 'EX@x.com', 'editor', 'inviter');

      expect(notifications.notify).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: 'ws-1',
          userId: 'user-9',
          type: 'team_invite',
          resourceType: 'workspace_invitation',
          resourceId: 'inv-1',
          channel: 'in_app',
        }),
      );
    });

    it('신규(미가입) 이메일 초대 시 team_invite 미발사', async () => {
      memberRepo.findOne.mockResolvedValueOnce({ role: 'admin' });
      workspaceRepo.findOne.mockResolvedValueOnce({
        id: 'ws-1',
        name: 'Team',
        type: 'team',
      });
      userRepo.findOne.mockResolvedValueOnce({ id: 'inviter', name: 'Bob' });
      invitationRepo.findOne.mockResolvedValueOnce(null);

      await service.invite('ws-1', 'new@x.com', 'editor', 'inviter');

      expect(notifications.notify).not.toHaveBeenCalled();
    });

    it('team_invite 발사 실패해도 invite 는 성공(best-effort)', async () => {
      memberRepo.findOne
        .mockResolvedValueOnce({ role: 'admin' })
        .mockResolvedValueOnce(null);
      workspaceRepo.findOne.mockResolvedValueOnce({
        id: 'ws-1',
        name: 'Team',
        type: 'team',
      });
      usersService.lookupByEmail.mockResolvedValueOnce({
        kind: 'found',
        user: { id: 'user-9', email: 'ex@x.com' },
      });
      userRepo.findOne.mockResolvedValueOnce({ id: 'inviter', name: 'Bob' }); // inviter
      invitationRepo.findOne.mockResolvedValueOnce(null);
      invitationRepo.save.mockResolvedValueOnce({ id: 'inv-1' });
      notifications.notify.mockRejectedValueOnce(new Error('notif down'));

      await expect(
        service.invite('ws-1', 'ex@x.com', 'editor', 'inviter'),
      ).resolves.toBeDefined();
    });

    it('does not roll back invitation row when mail fails', async () => {
      memberRepo.findOne.mockResolvedValueOnce({ role: 'admin' });
      workspaceRepo.findOne.mockResolvedValueOnce({
        id: 'ws-1',
        name: 'Team',
        type: 'team',
      });
      userRepo.findOne.mockResolvedValueOnce({ id: 'user-1', name: 'Alice' });
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

    /**
     * NERV CLE-ACCT-WS REQ-WSPACE-070 · 072 — 기존 가입자는 가입과 로그인 「이메일 비교 규칙」
     * (`UsersService.lookupByEmail`)대로 찾는다. 어느 계정인지 정할 수 없으면 가입하지 않은 이메일처럼
     * 다룬다(CLE-T-KG01YT).
     */
    describe('기존 가입자는 이메일 비교 규칙으로 찾는다', () => {
      function arrangeTeamInvite(): void {
        workspaceRepo.findOne.mockResolvedValueOnce({
          id: 'ws-1',
          name: 'Team',
          type: 'team',
        });
        userRepo.findOne.mockResolvedValue({ id: 'inviter', name: 'Bob' }); // inviter
        invitationRepo.findOne.mockResolvedValueOnce(null);
        invitationRepo.save.mockResolvedValueOnce({ id: 'inv-1' });
      }

      it('입력을 소문자로 바꾸지 않고 조회에 넘기고 토큰 이메일만 소문자로 저장한다', async () => {
        memberRepo.findOne.mockResolvedValueOnce({ role: 'admin' });
        arrangeTeamInvite();

        await service.invite('ws-1', 'Mixed.Case@X.com', 'editor', 'inviter');

        // 소문자로 바꿔 넘기면 대소문자까지 같은 계정을 고르는 규칙이 소문자 계정만 고른다.
        expect(usersService.lookupByEmail).toHaveBeenCalledWith(
          'Mixed.Case@X.com',
        );
        expect(invitationRepo.create).toHaveBeenCalledWith(
          expect.objectContaining({ email: 'mixed.case@x.com' }),
        );
        // 사용자 저장소를 이메일로 직접 조회하지 않는다(대소문자를 그대로 비교하던 옛 경로).
        for (const [arg] of userRepo.findOne.mock.calls as Array<
          [{ where: Record<string, unknown> }]
        >) {
          expect(arg.where).not.toHaveProperty('email');
        }
      });

      it('대문자가 섞여 저장된 계정이 이미 멤버면 409 already_a_member 이고 초대를 만들지 않는다', async () => {
        memberRepo.findOne
          .mockResolvedValueOnce({ role: 'admin' }) // 요청자
          .mockResolvedValueOnce({ id: 'mem-9' }); // 찾은 계정은 이미 멤버
        workspaceRepo.findOne.mockResolvedValueOnce({
          id: 'ws-1',
          name: 'Team',
          type: 'team',
        });
        usersService.lookupByEmail.mockResolvedValueOnce({
          kind: 'found',
          user: { id: 'user-9', email: 'Legacy@X.com' },
        });

        await expect(
          service.invite('ws-1', 'legacy@x.com', 'editor', 'inviter'),
        ).rejects.toMatchObject({ response: { code: 'already_a_member' } });
        expect(memberRepo.findOne).toHaveBeenLastCalledWith({
          where: { workspaceId: 'ws-1', userId: 'user-9' },
        });
        expect(invitationRepo.save).not.toHaveBeenCalled();
        expect(mailService.sendWorkspaceInvitationEmail).not.toHaveBeenCalled();
      });

      it('어느 계정인지 정할 수 없으면 멤버 여부를 보지 않고 인앱 알림 없이 초대 메일만 보낸다', async () => {
        memberRepo.findOne.mockResolvedValueOnce({ role: 'admin' });
        arrangeTeamInvite();
        usersService.lookupByEmail.mockResolvedValueOnce({ kind: 'ambiguous' });

        const result = await service.invite(
          'ws-1',
          'DUP@x.com',
          'editor',
          'inviter',
        );

        expect(result).toEqual({ id: 'inv-1' });
        // 요청자 역할 조회 한 번뿐이다. 찾은 계정의 멤버 조회가 없다.
        expect(memberRepo.findOne).toHaveBeenCalledTimes(1);
        expect(notifications.notify).not.toHaveBeenCalled();
        expect(mailService.sendWorkspaceInvitationEmail).toHaveBeenCalledWith(
          'dup@x.com',
          'Team',
          'Bob',
          expect.any(String),
        );
      });
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

    it('throws NotFoundException when the workspace was deleted in flight', async () => {
      memberRepo.findOne.mockResolvedValueOnce({ role: 'admin' });
      invitationRepo.findOne.mockResolvedValueOnce({
        id: 'inv-1',
        token: 'old',
        email: 'b@x.com',
        role: 'editor',
        invitedBy: null,
        acceptedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
        workspaceId: 'ws-1',
      });
      workspaceRepo.findOne.mockResolvedValueOnce(null);
      userRepo.findOne.mockResolvedValueOnce(null);
      await expect(
        service.resend('ws-1', 'inv-1', 'user-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('still returns saved row when mail dispatch fails', async () => {
      memberRepo.findOne.mockResolvedValueOnce({ role: 'admin' });
      invitationRepo.findOne.mockResolvedValueOnce({
        id: 'inv-1',
        token: 'old',
        email: 'b@x.com',
        role: 'editor',
        invitedBy: null,
        acceptedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
        workspaceId: 'ws-1',
      });
      workspaceRepo.findOne.mockResolvedValueOnce({ id: 'ws-1', name: 'Team' });
      userRepo.findOne.mockResolvedValueOnce({ id: 'user-1', name: 'Alice' });
      mailService.sendWorkspaceInvitationEmail.mockRejectedValueOnce(
        new Error('smtp down'),
      );
      const result = await service.resend('ws-1', 'inv-1', 'user-1');
      expect(result.token).not.toBe('old');
      expect(invitationRepo.save).toHaveBeenCalled();
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

    it('throws NotFoundException when workspace has been deleted', async () => {
      invitationRepo.findOne.mockResolvedValueOnce({
        token: 't',
        email: 'a@x.com',
        role: 'editor',
        workspaceId: 'ws-1',
        invitedBy: null,
        acceptedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
      });
      workspaceRepo.findOne.mockResolvedValueOnce(null);
      await expect(service.getMetaByToken('t')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  /**
   * 초대 id 모드(CLE-ACCT-WS-INVITE 「이미 가입한 사용자의 수락 경로」, CLE-T-86E38Q). 초대 알림이 넘기는 초대 id 와
   * 로그인 이메일로 본인 초대만 찾는다. 남의 초대는 있는지조차 드러내지 않으려고 없는 초대와 같은 404 를 낸다.
   */
  describe('초대 id 로 본인 초대 조회 · 수락', () => {
    const INVITATION_ID = '0b9d6f0e-1c2a-4b8e-9a51-3f2d7c6e8a10';
    const pending = (over: Record<string, unknown> = {}) => ({
      id: INVITATION_ID,
      token: 't',
      email: 'invited@x.com',
      role: 'editor',
      workspaceId: 'ws-1',
      invitedBy: 'inviter-1',
      acceptedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      ...over,
    });

    function arrange(
      invitation: Record<string, unknown> | null,
      userEmail: string | null = 'Invited@X.com',
    ): void {
      invitationRepo.findOne.mockResolvedValueOnce(invitation);
      userRepo.findOne.mockImplementation(
        ({ where }: { where: { id: string } }) =>
          Promise.resolve(
            where.id === 'user-1' && userEmail !== null
              ? { id: 'user-1', email: userEmail }
              : where.id === 'inviter-1'
                ? { id: 'inviter-1', name: 'Alice' }
                : null,
          ),
      );
      workspaceRepo.findOne.mockResolvedValue({ id: 'ws-1', name: 'Team' });
    }

    const NOT_FOUND = { response: { code: 'invitation_not_found' } };

    describe.each([
      [
        'getMetaForRecipient',
        (id: string) => service.getMetaForRecipient(id, 'user-1'),
      ],
      ['acceptById', (id: string) => service.acceptById(id, 'user-1')],
    ] as const)('%s', (_name, call) => {
      it('초대 id 가 UUID 가 아니면 조회하지 않고 404 다', async () => {
        await expect(call('not-a-uuid')).rejects.toMatchObject(NOT_FOUND);
        expect(invitationRepo.findOne).not.toHaveBeenCalled();
      });

      it('없는(취소한) 초대는 404 다', async () => {
        arrange(null);
        await expect(call(INVITATION_ID)).rejects.toMatchObject(NOT_FOUND);
      });

      it('초대 이메일이 로그인 이메일과 다르면 404 다', async () => {
        arrange(pending(), 'other@x.com');
        const err = await call(INVITATION_ID).catch((err_: unknown) => err_);
        expect(err).toBeInstanceOf(NotFoundException);
        expect(err).toMatchObject(NOT_FOUND);
        expect(updateMock).not.toHaveBeenCalled();
      });

      it('남의 초대는 이미 수락됐거나 만료돼도 410 이 아니라 404 다', async () => {
        arrange(pending({ acceptedAt: new Date() }), 'other@x.com');
        await expect(call(INVITATION_ID)).rejects.toMatchObject(NOT_FOUND);
        arrange(
          pending({ expiresAt: new Date(Date.now() - 1000) }),
          'other@x.com',
        );
        await expect(call(INVITATION_ID)).rejects.toMatchObject(NOT_FOUND);
      });

      it('본인 초대가 이미 수락됐으면 410 invitation_already_used 다', async () => {
        arrange(pending({ acceptedAt: new Date() }));
        const err = await call(INVITATION_ID).catch((err_: unknown) => err_);
        expect(err).toBeInstanceOf(GoneException);
        expect(err).toMatchObject({
          response: { code: 'invitation_already_used' },
        });
      });

      it('본인 초대가 만료됐으면 410 invitation_expired 다', async () => {
        arrange(pending({ expiresAt: new Date(Date.now() - 1000) }));
        const err = await call(INVITATION_ID).catch((err_: unknown) => err_);
        expect(err).toBeInstanceOf(GoneException);
        expect(err).toMatchObject({ response: { code: 'invitation_expired' } });
      });
    });

    it('getMetaForRecipient 는 본인 초대의 메타를 돌려준다', async () => {
      arrange(pending());
      await expect(
        service.getMetaForRecipient(INVITATION_ID, 'user-1'),
      ).resolves.toEqual({
        workspaceName: 'Team',
        invitedByName: 'Alice',
        email: 'invited@x.com',
        role: 'editor',
        expiresAt: expect.any(Date),
      });
      expect(invitationRepo.findOne).toHaveBeenCalledWith({
        where: { id: INVITATION_ID },
      });
    });

    it('acceptById 는 본인 초대를 원자적으로 소비하고 멤버로 넣는다', async () => {
      arrange(pending());
      memberRepo.findOne.mockResolvedValueOnce(null);
      await expect(
        service.acceptById(INVITATION_ID, 'user-1'),
      ).resolves.toEqual({ workspaceId: 'ws-1', role: 'editor' });
      expect(updateMock).toHaveBeenCalledTimes(1);
      expect(memberRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: 'ws-1',
          userId: 'user-1',
          role: 'editor',
        }),
      );
    });

    it('acceptById 는 이미 멤버인 사용자의 멤버 행을 다시 넣지 않고 초대만 소비한다', async () => {
      arrange(pending());
      memberRepo.findOne.mockResolvedValueOnce({ id: 'existing' });
      await expect(
        service.acceptById(INVITATION_ID, 'user-1'),
      ).resolves.toEqual({ workspaceId: 'ws-1', role: 'editor' });
      expect(memberRepo.save).not.toHaveBeenCalled();
      expect(updateMock).toHaveBeenCalledTimes(1);
    });

    it('acceptById 의 동시 수락에서 진 쪽은 410 invitation_already_used 다', async () => {
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
        notifications as never,
        auditLogs as never,
        usersService as never,
      );
      arrange(pending());
      const err = await service
        .acceptById(INVITATION_ID, 'user-1')
        .catch((err_: unknown) => err_);
      expect(err).toBeInstanceOf(GoneException);
      expect(err).toMatchObject({
        response: { code: 'invitation_already_used' },
      });
      expect(memberRepo.save).not.toHaveBeenCalled();
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
        notifications as never,
        auditLogs as never,
        usersService as never,
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
      const now = new Date();
      const removed = await service.pruneExpired(now);
      expect(removed).toBe(3);
      // 수락되지 않은(acceptedAt IS NULL) 만료 초대만 지운다. 수락된 초대는 감사용으로 남는다.
      expect(invitationRepo.delete).toHaveBeenCalledWith({
        acceptedAt: IsNull(),
        expiresAt: LessThan(now),
      });
    });
  });

  describe('listPending', () => {
    it('수락되지 않은(acceptedAt IS NULL) 초대만 최신순으로 돌려준다', async () => {
      memberRepo.findOne.mockResolvedValueOnce({ role: 'admin' });
      await service.listPending('ws-1', 'user-1');
      expect(invitationRepo.find).toHaveBeenCalledWith({
        where: { workspaceId: 'ws-1', acceptedAt: IsNull() },
        order: { createdAt: 'DESC' },
      });
    });
  });
});

describe('invitationNotFoundException', () => {
  it('본인 초대 경로가 쓰는 404 invitation_not_found 를 매번 새로 만든다', () => {
    const first = invitationNotFoundException();
    const second = invitationNotFoundException();

    expect(first).toBeInstanceOf(NotFoundException);
    expect(first.getStatus()).toBe(404);
    expect(first.getResponse()).toEqual({
      code: 'invitation_not_found',
      message: 'Invitation not found.',
    });
    expect(second).not.toBe(first);
  });
});
