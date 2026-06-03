import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { WorkspacesService } from './workspaces.service';
import { Workspace } from './entities/workspace.entity';
import { WorkspaceMember } from './entities/workspace-member.entity';
import { WorkspaceInvitation } from './entities/workspace-invitation.entity';
import { User } from '../users/entities/user.entity';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

describe('WorkspacesService', () => {
  let service: WorkspacesService;
  let workspaceRepo: {
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
    remove: jest.Mock;
  };
  let memberRepo: {
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
    remove: jest.Mock;
    find: jest.Mock;
  };

  const mockWorkspace = {
    id: 'ws-uuid-1',
    name: "Test User's Workspace",
    type: 'personal',
    ownerId: 'user-uuid-1',
    slug: 'test-a1b2',
    settings: {},
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkspacesService,
        {
          provide: getRepositoryToken(Workspace),
          useValue: {
            create: jest.fn().mockImplementation((data: unknown) => data),
            save: jest.fn().mockImplementation((data: unknown) =>
              Promise.resolve({
                id: 'ws-uuid-1',
                ...(data as Record<string, unknown>),
              }),
            ),
            findOne: jest.fn(),
            remove: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: getRepositoryToken(WorkspaceMember),
          useValue: {
            create: jest.fn().mockImplementation((data: unknown) => data),
            save: jest
              .fn()
              .mockImplementation((data: unknown) => Promise.resolve(data)),
            findOne: jest.fn(),
            remove: jest.fn().mockResolvedValue(undefined),
            find: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: AuditLogsService,
          useValue: { record: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();

    service = module.get<WorkspacesService>(WorkspacesService);
    workspaceRepo = module.get(getRepositoryToken(Workspace));
    memberRepo = module.get(getRepositoryToken(WorkspaceMember));

    // Wire a transaction mock that delegates to the base repo mocks so the
    // inner callback's getRepository() returns the same jest.fn() instances
    // the tests inspect.
    const invRepo = {
      delete: jest.fn().mockResolvedValue({ affected: 0 }),
    };
    const fakeManager = {
      getRepository: jest.fn().mockImplementation((entity: unknown) => {
        if (entity === WorkspaceMember) return memberRepo;
        if (entity === Workspace) return workspaceRepo;
        if (entity === WorkspaceInvitation) return invRepo;
        return {};
      }),
    };
    (
      memberRepo as unknown as {
        manager: {
          transaction: jest.Mock;
        };
      }
    ).manager = {
      transaction: jest
        .fn()
        .mockImplementation(
          async (cb: (m: typeof fakeManager) => Promise<unknown>) =>
            cb(fakeManager),
        ),
    };
    // Also expose delete on workspace/member repos for cascade/deletes
    (workspaceRepo as unknown as { delete: jest.Mock }).delete = jest
      .fn()
      .mockResolvedValue({ affected: 1 });
    (memberRepo as unknown as { delete: jest.Mock }).delete = jest
      .fn()
      .mockResolvedValue({ affected: 0 });
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createPersonalWorkspace', () => {
    it('should create a personal workspace and member', async () => {
      const result = await service.createPersonalWorkspace(
        'user-uuid-1',
        'Test User',
        'test@example.com',
      );

      expect(workspaceRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Test User's Workspace",
          type: 'personal',
          ownerId: 'user-uuid-1',
        }),
      );
      expect(workspaceRepo.save).toHaveBeenCalled();
      expect(memberRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-uuid-1',
          role: 'owner',
        }),
      );
      expect(memberRepo.save).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should use provided EntityManager when given', async () => {
      const mockManagerWsRepo = {
        create: jest.fn().mockImplementation((data: unknown) => data),
        save: jest.fn().mockResolvedValue({ id: 'ws-mgr-1' }),
      };
      const mockManagerMemRepo = {
        create: jest.fn().mockImplementation((data: unknown) => data),
        save: jest.fn().mockResolvedValue({}),
      };
      const mockManager = {
        getRepository: jest.fn().mockImplementation((entity: unknown) => {
          if (entity === Workspace) return mockManagerWsRepo;
          if (entity === WorkspaceMember) return mockManagerMemRepo;
          return {};
        }),
      };

      await service.createPersonalWorkspace(
        'user-uuid-1',
        'Test User',
        'test@example.com',
        mockManager as never,
      );

      expect(mockManagerWsRepo.create).toHaveBeenCalled();
      expect(mockManagerWsRepo.save).toHaveBeenCalled();
      expect(mockManagerMemRepo.create).toHaveBeenCalled();
      expect(mockManagerMemRepo.save).toHaveBeenCalled();
      // Default repos should NOT be called
      expect(workspaceRepo.create).not.toHaveBeenCalled();
      expect(memberRepo.create).not.toHaveBeenCalled();
    });

    it('should generate slug from email local part', async () => {
      await service.createPersonalWorkspace(
        'user-uuid-1',
        'Test User',
        'test@example.com',
      );

      const createArg = workspaceRepo.create.mock.calls[0][0] as {
        slug: string;
      };
      expect(createArg.slug).toMatch(/^test-[a-f0-9]{4}$/);
    });
  });

  describe('findPersonalWorkspace', () => {
    it('should find workspace by ownerId and type personal', async () => {
      workspaceRepo.findOne.mockResolvedValue(mockWorkspace);

      const result = await service.findPersonalWorkspace('user-uuid-1');

      expect(workspaceRepo.findOne).toHaveBeenCalledWith({
        where: { ownerId: 'user-uuid-1', type: 'personal' },
      });
      expect(result).toEqual(mockWorkspace);
    });

    it('should return null when no workspace found', async () => {
      workspaceRepo.findOne.mockResolvedValue(null);

      const result = await service.findPersonalWorkspace('user-uuid-1');
      expect(result).toBeNull();
    });
  });

  describe('findOrCreatePersonalWorkspace', () => {
    it('should return existing workspace if found', async () => {
      workspaceRepo.findOne.mockResolvedValue(mockWorkspace);

      const result = await service.findOrCreatePersonalWorkspace(
        'user-uuid-1',
        'Test User',
        'test@example.com',
      );

      expect(result).toEqual(mockWorkspace);
      expect(workspaceRepo.create).not.toHaveBeenCalled();
    });

    it('should create workspace if none exists', async () => {
      workspaceRepo.findOne.mockResolvedValue(null);

      const result = await service.findOrCreatePersonalWorkspace(
        'user-uuid-1',
        'Test User',
        'test@example.com',
      );

      expect(workspaceRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Test User's Workspace",
          type: 'personal',
          ownerId: 'user-uuid-1',
        }),
      );
      expect(workspaceRepo.save).toHaveBeenCalled();
      expect(memberRepo.save).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should handle race condition by retrying find on create failure', async () => {
      workspaceRepo.findOne
        .mockResolvedValueOnce(null) // First find returns null
        .mockResolvedValueOnce(mockWorkspace); // Retry find returns workspace
      workspaceRepo.save.mockRejectedValueOnce(
        new Error('duplicate key violation'),
      );

      const result = await service.findOrCreatePersonalWorkspace(
        'user-uuid-1',
        'Test User',
        'test@example.com',
      );

      expect(result).toEqual(mockWorkspace);
      expect(workspaceRepo.findOne).toHaveBeenCalledTimes(2);
    });

    it('should throw when both create and retry find fail', async () => {
      workspaceRepo.findOne.mockResolvedValue(null);
      workspaceRepo.save.mockRejectedValueOnce(new Error('DB error'));

      await expect(
        service.findOrCreatePersonalWorkspace(
          'user-uuid-1',
          'Test User',
          'test@example.com',
        ),
      ).rejects.toThrow('Failed to create personal workspace');
    });
  });

  describe('getMemberRole', () => {
    it('should return role when member found', async () => {
      memberRepo.findOne.mockResolvedValue({ role: 'owner' });

      const result = await service.getMemberRole('ws-uuid-1', 'user-uuid-1');
      expect(result).toBe('owner');
    });

    it('should return null when member not found', async () => {
      memberRepo.findOne.mockResolvedValue(null);

      const result = await service.getMemberRole('ws-uuid-1', 'user-uuid-1');
      expect(result).toBeNull();
    });
  });

  describe('renameWorkspace', () => {
    it('renames when requester is admin and name is valid', async () => {
      memberRepo.findOne.mockResolvedValue({ role: 'admin' });
      workspaceRepo.findOne.mockResolvedValue({
        ...mockWorkspace,
        type: 'team',
      });

      const result = await service.renameWorkspace(
        'ws-uuid-1',
        'New Name',
        'user-uuid-1',
      );

      expect(workspaceRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'New Name' }),
      );
      expect(result.name).toBe('New Name');
    });

    it('throws when requester is viewer', async () => {
      memberRepo.findOne.mockResolvedValue({ role: 'viewer' });

      await expect(
        service.renameWorkspace('ws-uuid-1', 'New Name', 'user-uuid-1'),
      ).rejects.toMatchObject({ response: { code: 'ADMIN_REQUIRED' } });
    });

    it('throws when workspace not found', async () => {
      memberRepo.findOne.mockResolvedValue({ role: 'owner' });
      workspaceRepo.findOne.mockResolvedValue(null);

      await expect(
        service.renameWorkspace('ws-uuid-1', 'New Name', 'user-uuid-1'),
      ).rejects.toMatchObject({ response: { code: 'WORKSPACE_NOT_FOUND' } });
    });
  });

  describe('updateWorkspaceSettings', () => {
    it('merges interactionAllowedOrigins, preserves other keys, normalizes trailing slash (owner)', async () => {
      memberRepo.findOne.mockResolvedValue({ role: 'owner' });
      workspaceRepo.findOne.mockResolvedValue({
        ...mockWorkspace,
        type: 'team',
        settings: { timezone: 'Asia/Seoul' },
      });

      const result = await service.updateWorkspaceSettings(
        'ws-uuid-1',
        {
          interactionAllowedOrigins: [
            'https://example.com/',
            'https://shop.example.com',
          ],
        },
        'user-uuid-1',
      );

      expect(workspaceRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          settings: {
            timezone: 'Asia/Seoul',
            interactionAllowedOrigins: [
              'https://example.com',
              'https://shop.example.com',
            ],
          },
        }),
      );
      expect(result.settings).toEqual({
        timezone: 'Asia/Seoul',
        interactionAllowedOrigins: [
          'https://example.com',
          'https://shop.example.com',
        ],
      });
    });

    it('updates when requester is admin', async () => {
      memberRepo.findOne.mockResolvedValue({ role: 'admin' });
      workspaceRepo.findOne.mockResolvedValue({
        ...mockWorkspace,
        type: 'team',
        settings: {},
      });

      const result = await service.updateWorkspaceSettings(
        'ws-uuid-1',
        { interactionAllowedOrigins: ['https://example.com'] },
        'user-uuid-1',
      );

      expect(result.settings).toEqual({
        interactionAllowedOrigins: ['https://example.com'],
      });
    });

    it('throws ADMIN_REQUIRED when requester is editor', async () => {
      memberRepo.findOne.mockResolvedValue({ role: 'editor' });

      await expect(
        service.updateWorkspaceSettings(
          'ws-uuid-1',
          { interactionAllowedOrigins: ['https://example.com'] },
          'user-uuid-1',
        ),
      ).rejects.toMatchObject({ response: { code: 'ADMIN_REQUIRED' } });
    });

    it('throws ADMIN_REQUIRED when requester is viewer', async () => {
      memberRepo.findOne.mockResolvedValue({ role: 'viewer' });

      await expect(
        service.updateWorkspaceSettings(
          'ws-uuid-1',
          { interactionAllowedOrigins: [] },
          'user-uuid-1',
        ),
      ).rejects.toMatchObject({ response: { code: 'ADMIN_REQUIRED' } });
    });

    it('throws ADMIN_REQUIRED when requester is not a member', async () => {
      memberRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateWorkspaceSettings(
          'ws-uuid-1',
          { interactionAllowedOrigins: ['https://example.com'] },
          'user-uuid-1',
        ),
      ).rejects.toMatchObject({ response: { code: 'ADMIN_REQUIRED' } });
    });

    it('throws WORKSPACE_NOT_FOUND when workspace missing', async () => {
      memberRepo.findOne.mockResolvedValue({ role: 'owner' });
      workspaceRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateWorkspaceSettings(
          'ws-uuid-1',
          { interactionAllowedOrigins: ['https://example.com'] },
          'user-uuid-1',
        ),
      ).rejects.toMatchObject({ response: { code: 'WORKSPACE_NOT_FOUND' } });
    });
  });

  describe('getWorkspaceSettings', () => {
    it('returns interactionAllowedOrigins for a member (viewer)', async () => {
      memberRepo.findOne.mockResolvedValue({ role: 'viewer' });
      workspaceRepo.findOne.mockResolvedValue({
        ...mockWorkspace,
        settings: { interactionAllowedOrigins: ['https://example.com'] },
      });

      const result = await service.getWorkspaceSettings(
        'ws-uuid-1',
        'user-uuid-1',
      );

      expect(result).toEqual({
        interactionAllowedOrigins: ['https://example.com'],
      });
    });

    it('returns empty array when key absent', async () => {
      memberRepo.findOne.mockResolvedValue({ role: 'editor' });
      workspaceRepo.findOne.mockResolvedValue({
        ...mockWorkspace,
        settings: { timezone: 'Asia/Seoul' },
      });

      const result = await service.getWorkspaceSettings(
        'ws-uuid-1',
        'user-uuid-1',
      );

      expect(result).toEqual({ interactionAllowedOrigins: [] });
    });

    it('throws FORBIDDEN when requester is not a member', async () => {
      memberRepo.findOne.mockResolvedValue(null);

      await expect(
        service.getWorkspaceSettings('ws-uuid-1', 'user-uuid-1'),
      ).rejects.toMatchObject({ response: { code: 'FORBIDDEN' } });
    });

    it('throws WORKSPACE_NOT_FOUND when member but workspace missing', async () => {
      memberRepo.findOne.mockResolvedValue({ role: 'viewer' });
      workspaceRepo.findOne.mockResolvedValue(null);

      await expect(
        service.getWorkspaceSettings('ws-uuid-1', 'user-uuid-1'),
      ).rejects.toMatchObject({ response: { code: 'WORKSPACE_NOT_FOUND' } });
    });
  });

  describe('deleteWorkspace', () => {
    it('deletes team workspace when requester is owner', async () => {
      memberRepo.findOne.mockResolvedValue({ role: 'owner' });
      workspaceRepo.findOne.mockResolvedValue({
        ...mockWorkspace,
        type: 'team',
      });

      await service.deleteWorkspace('ws-uuid-1', 'user-uuid-1');

      expect(workspaceRepo.remove).toHaveBeenCalled();
    });

    it('throws when requester is admin (not owner)', async () => {
      memberRepo.findOne.mockResolvedValue({ role: 'admin' });
      workspaceRepo.findOne.mockResolvedValue({
        ...mockWorkspace,
        type: 'team',
      });

      await expect(
        service.deleteWorkspace('ws-uuid-1', 'user-uuid-1'),
      ).rejects.toMatchObject({ response: { code: 'OWNER_REQUIRED' } });
    });

    it('refuses to delete personal workspace', async () => {
      memberRepo.findOne.mockResolvedValue({ role: 'owner' });
      workspaceRepo.findOne.mockResolvedValue({
        ...mockWorkspace,
        type: 'personal',
      });

      await expect(
        service.deleteWorkspace('ws-uuid-1', 'user-uuid-1'),
      ).rejects.toMatchObject({
        response: { code: 'CANNOT_DELETE_PERSONAL' },
      });
    });
  });

  describe('leaveWorkspace', () => {
    it('removes my membership from team workspace', async () => {
      workspaceRepo.findOne.mockResolvedValue({
        ...mockWorkspace,
        type: 'team',
      });
      memberRepo.findOne.mockResolvedValue({
        id: 'mem-1',
        role: 'editor',
        userId: 'user-uuid-1',
      });

      await service.leaveWorkspace('ws-uuid-1', 'user-uuid-1');

      expect(memberRepo.remove).toHaveBeenCalled();
    });

    it('refuses to leave personal workspace', async () => {
      workspaceRepo.findOne.mockResolvedValue({
        ...mockWorkspace,
        type: 'personal',
      });

      await expect(
        service.leaveWorkspace('ws-uuid-1', 'user-uuid-1'),
      ).rejects.toMatchObject({
        response: { code: 'CANNOT_LEAVE_PERSONAL' },
      });
    });

    it('refuses when requester is the sole owner', async () => {
      workspaceRepo.findOne.mockResolvedValue({
        ...mockWorkspace,
        type: 'team',
      });
      memberRepo.findOne.mockResolvedValue({
        id: 'mem-1',
        role: 'owner',
        userId: 'user-uuid-1',
      });
      memberRepo.find.mockResolvedValue([
        { id: 'mem-1', role: 'owner', userId: 'user-uuid-1' },
      ]);

      await expect(
        service.leaveWorkspace('ws-uuid-1', 'user-uuid-1'),
      ).rejects.toMatchObject({
        response: { code: 'SOLE_OWNER_CANNOT_LEAVE' },
      });
    });

    it('allows owner to leave when another owner exists', async () => {
      workspaceRepo.findOne.mockResolvedValue({
        ...mockWorkspace,
        type: 'team',
      });
      memberRepo.findOne.mockResolvedValue({
        id: 'mem-1',
        role: 'owner',
        userId: 'user-uuid-1',
      });
      memberRepo.find.mockResolvedValue([
        { id: 'mem-1', role: 'owner', userId: 'user-uuid-1' },
        { id: 'mem-2', role: 'owner', userId: 'user-uuid-2' },
      ]);

      await service.leaveWorkspace('ws-uuid-1', 'user-uuid-1');

      expect(memberRepo.remove).toHaveBeenCalled();
    });

    it('throws when requester is not a member', async () => {
      workspaceRepo.findOne.mockResolvedValue({
        ...mockWorkspace,
        type: 'team',
      });
      memberRepo.findOne.mockResolvedValue(null);

      await expect(
        service.leaveWorkspace('ws-uuid-1', 'user-uuid-1'),
      ).rejects.toMatchObject({ response: { code: 'NOT_A_MEMBER' } });
    });
  });

  describe('transferOwnership', () => {
    const requesterId = 'user-owner';
    const newOwnerMemberId = 'mem-new-owner';
    const newOwnerUserId = 'user-new-owner';
    const teamWorkspace = { ...mockWorkspace, type: 'team' as const };

    function setupOwnerLookup(currentRole: string) {
      // findOne is called twice in transferOwnership:
      //   1) requester membership (by workspaceId+userId)
      //   2) new owner membership (by id+workspaceId)
      memberRepo.findOne.mockImplementation(
        (opts: { where?: Record<string, unknown> }) => {
          const where = opts?.where ?? {};
          if (where.userId === requesterId) {
            return Promise.resolve({
              id: 'mem-owner',
              role: currentRole,
              userId: requesterId,
              workspaceId: 'ws-uuid-1',
            });
          }
          if (where.id === newOwnerMemberId) {
            return Promise.resolve({
              id: newOwnerMemberId,
              role: 'editor',
              userId: newOwnerUserId,
              workspaceId: 'ws-uuid-1',
            });
          }
          return Promise.resolve(null);
        },
      );
    }

    it('atomically swaps roles in a single batch save and updates workspace.ownerId', async () => {
      workspaceRepo.findOne.mockResolvedValue(teamWorkspace);
      setupOwnerLookup('owner');

      await service.transferOwnership(
        'ws-uuid-1',
        requesterId,
        newOwnerMemberId,
      );

      // 두 멤버는 한 번의 save([target, requester]) 호출로 함께 갱신된다.
      expect(memberRepo.save).toHaveBeenCalledWith([
        expect.objectContaining({ id: newOwnerMemberId, role: 'owner' }),
        expect.objectContaining({ id: 'mem-owner', role: 'admin' }),
      ]);
      expect(workspaceRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'ws-uuid-1', ownerId: newOwnerUserId }),
      );
    });

    it('locks workspace and members with pessimistic_write inside the transaction', async () => {
      workspaceRepo.findOne.mockResolvedValue(teamWorkspace);
      setupOwnerLookup('owner');

      await service.transferOwnership(
        'ws-uuid-1',
        requesterId,
        newOwnerMemberId,
      );

      expect(workspaceRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ws-uuid-1' },
          lock: { mode: 'pessimistic_write' },
        }),
      );
      const memberCalls = memberRepo.findOne.mock.calls.map(
        (c) => c[0] as { lock?: unknown },
      );
      for (const call of memberCalls) {
        expect(call.lock).toEqual({ mode: 'pessimistic_write' });
      }
    });

    it('records an audit log entry after a successful transfer', async () => {
      workspaceRepo.findOne.mockResolvedValue(teamWorkspace);
      setupOwnerLookup('owner');
      const audit = (
        service as unknown as {
          auditLogsService: { record: jest.Mock };
        }
      ).auditLogsService;

      await service.transferOwnership(
        'ws-uuid-1',
        requesterId,
        newOwnerMemberId,
      );

      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: 'ws-uuid-1',
          userId: requesterId,
          action: 'workspace.transfer_ownership',
          resourceType: 'workspace',
          resourceId: 'ws-uuid-1',
          details: { newOwnerMemberId },
        }),
      );
    });

    it('refuses when requester is not owner', async () => {
      workspaceRepo.findOne.mockResolvedValue(teamWorkspace);
      setupOwnerLookup('admin');

      await expect(
        service.transferOwnership('ws-uuid-1', requesterId, newOwnerMemberId),
      ).rejects.toMatchObject({ response: { code: 'OWNER_REQUIRED' } });
    });

    it('refuses on personal workspace', async () => {
      workspaceRepo.findOne.mockResolvedValue({
        ...mockWorkspace,
        type: 'personal',
      });
      setupOwnerLookup('owner');

      await expect(
        service.transferOwnership('ws-uuid-1', requesterId, newOwnerMemberId),
      ).rejects.toMatchObject({
        response: { code: 'CANNOT_TRANSFER_PERSONAL' },
      });
    });

    it('refuses self-transfer', async () => {
      workspaceRepo.findOne.mockResolvedValue(teamWorkspace);
      memberRepo.findOne.mockImplementation(
        (opts: { where?: Record<string, unknown> }) => {
          const where = opts?.where ?? {};
          const ownerMember = {
            id: 'mem-owner',
            role: 'owner',
            userId: requesterId,
            workspaceId: 'ws-uuid-1',
          };
          if (where.userId === requesterId) return Promise.resolve(ownerMember);
          if (where.id === 'mem-owner') return Promise.resolve(ownerMember);
          return Promise.resolve(null);
        },
      );

      await expect(
        service.transferOwnership('ws-uuid-1', requesterId, 'mem-owner'),
      ).rejects.toMatchObject({ response: { code: 'TARGET_IS_SELF' } });
    });

    it('refuses when target member does not exist in workspace', async () => {
      workspaceRepo.findOne.mockResolvedValue(teamWorkspace);
      memberRepo.findOne.mockImplementation(
        (opts: { where?: Record<string, unknown> }) => {
          const where = opts?.where ?? {};
          if (where.userId === requesterId) {
            return Promise.resolve({
              id: 'mem-owner',
              role: 'owner',
              userId: requesterId,
              workspaceId: 'ws-uuid-1',
            });
          }
          return Promise.resolve(null);
        },
      );

      await expect(
        service.transferOwnership('ws-uuid-1', requesterId, newOwnerMemberId),
      ).rejects.toMatchObject({ response: { code: 'MEMBER_NOT_FOUND' } });
    });

    it('refuses when target is already owner', async () => {
      workspaceRepo.findOne.mockResolvedValue(teamWorkspace);
      memberRepo.findOne.mockImplementation(
        (opts: { where?: Record<string, unknown> }) => {
          const where = opts?.where ?? {};
          if (where.userId === requesterId) {
            return Promise.resolve({
              id: 'mem-owner',
              role: 'owner',
              userId: requesterId,
              workspaceId: 'ws-uuid-1',
            });
          }
          if (where.id === newOwnerMemberId) {
            return Promise.resolve({
              id: newOwnerMemberId,
              role: 'owner',
              userId: newOwnerUserId,
              workspaceId: 'ws-uuid-1',
            });
          }
          return Promise.resolve(null);
        },
      );

      await expect(
        service.transferOwnership('ws-uuid-1', requesterId, newOwnerMemberId),
      ).rejects.toMatchObject({ response: { code: 'TARGET_ALREADY_OWNER' } });
    });

    it('refuses when workspace not found', async () => {
      workspaceRepo.findOne.mockResolvedValue(null);
      setupOwnerLookup('owner');

      await expect(
        service.transferOwnership('ws-uuid-1', requesterId, newOwnerMemberId),
      ).rejects.toMatchObject({ response: { code: 'WORKSPACE_NOT_FOUND' } });
    });
  });
});
