import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { findUserSecretLeaks } from '../../shared/testing/user-secret-absence';
import { WorkspacesService } from './workspaces.service';
import { Workspace } from './entities/workspace.entity';
import { WorkspaceMember } from './entities/workspace-member.entity';
import { WorkspaceInvitation } from './entities/workspace-invitation.entity';
import { User } from '../users/entities/user.entity';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AUDIT_ACTIONS } from '../audit-logs/audit-action.const';

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

  describe('findAdminUserIdsByWorkspaces (M-2 batch)', () => {
    it('returns empty map for empty input without querying', async () => {
      const result = await service.findAdminUserIdsByWorkspaces([]);
      expect(result.size).toBe(0);
      expect(memberRepo.find).not.toHaveBeenCalled();
    });

    it('groups owner/admin user ids by workspace in a single query', async () => {
      memberRepo.find.mockResolvedValue([
        { workspaceId: 'ws-1', userId: 'u-owner', role: 'owner' },
        { workspaceId: 'ws-1', userId: 'u-admin', role: 'admin' },
        { workspaceId: 'ws-2', userId: 'u-x', role: 'owner' },
      ]);

      const result = await service.findAdminUserIdsByWorkspaces([
        'ws-1',
        'ws-2',
        'ws-3',
      ]);

      expect(memberRepo.find).toHaveBeenCalledTimes(1);
      expect(result.get('ws-1')).toEqual(['u-owner', 'u-admin']);
      expect(result.get('ws-2')).toEqual(['u-x']);
      // 멤버 없는 워크스페이스는 map 에 부재.
      expect(result.has('ws-3')).toBe(false);
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

    it('§2.2 timezone 제공 시 IANA 검증 후 settings 에 병합', async () => {
      memberRepo.findOne.mockResolvedValue({ role: 'admin' });
      workspaceRepo.findOne.mockResolvedValue({
        ...mockWorkspace,
        type: 'team',
        settings: {},
      });
      const result = await service.updateWorkspaceSettings(
        'ws-uuid-1',
        { interactionAllowedOrigins: [], timezone: 'Europe/London' },
        'user-uuid-1',
      );
      expect(result.settings).toEqual({
        interactionAllowedOrigins: [],
        timezone: 'Europe/London',
      });
    });

    it('§2.2 timezone 단독 patch 는 기존 interactionAllowedOrigins 를 보존한다 (partial patch — origins 미침묵삭제)', async () => {
      memberRepo.findOne.mockResolvedValue({ role: 'admin' });
      workspaceRepo.findOne.mockResolvedValue({
        ...mockWorkspace,
        type: 'team',
        settings: { interactionAllowedOrigins: ['https://keep.example.com'] },
      });
      const result = await service.updateWorkspaceSettings(
        'ws-uuid-1',
        { timezone: 'UTC' },
        'user-uuid-1',
      );
      // interactionAllowedOrigins 미제공 → 기존 목록 보존, timezone 만 병합
      expect(result.settings).toEqual({
        interactionAllowedOrigins: ['https://keep.example.com'],
        timezone: 'UTC',
      });
    });

    it('§2.2 무효 timezone → INVALID_TIMEZONE BadRequest', async () => {
      memberRepo.findOne.mockResolvedValue({ role: 'admin' });
      workspaceRepo.findOne.mockResolvedValue({
        ...mockWorkspace,
        type: 'team',
        settings: {},
      });
      await expect(
        service.updateWorkspaceSettings(
          'ws-uuid-1',
          { interactionAllowedOrigins: [], timezone: 'Not/AZone' },
          'user-uuid-1',
        ),
      ).rejects.toMatchObject({ response: { code: 'INVALID_TIMEZONE' } });
      expect(workspaceRepo.save).not.toHaveBeenCalled();
    });

    it('§2.2 빈 timezone 문자열 → 설정 해제(키 제거)', async () => {
      memberRepo.findOne.mockResolvedValue({ role: 'admin' });
      workspaceRepo.findOne.mockResolvedValue({
        ...mockWorkspace,
        type: 'team',
        settings: { timezone: 'Asia/Seoul' },
      });
      const result = await service.updateWorkspaceSettings(
        'ws-uuid-1',
        { interactionAllowedOrigins: [], timezone: '' },
        'user-uuid-1',
      );
      expect(result.settings).toEqual({ interactionAllowedOrigins: [] });
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

    it('returns empty array when origins key absent (timezone 설정은 함께 반환)', async () => {
      memberRepo.findOne.mockResolvedValue({ role: 'editor' });
      workspaceRepo.findOne.mockResolvedValue({
        ...mockWorkspace,
        settings: { timezone: 'Asia/Seoul' },
      });

      const result = await service.getWorkspaceSettings(
        'ws-uuid-1',
        'user-uuid-1',
      );

      expect(result).toEqual({
        interactionAllowedOrigins: [],
        timezone: 'Asia/Seoul',
      });
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
          action: AUDIT_ACTIONS.WORKSPACE_TRANSFER_OWNERSHIP,
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

  // 결정4=B (spec-sync-data-flow-12-workspace-gaps): workspace/member CRUD 감사 로깅.
  // workspace.deleted 는 audit_log.workspace_id ON DELETE CASCADE 제약으로 영속 불가 →
  // 의도적 미기록 (아래 별도 케이스로 부재를 회귀 검증).
  describe('audit logging (결정4=B)', () => {
    function getAudit(): { record: jest.Mock } {
      return (service as unknown as { auditLogsService: { record: jest.Mock } })
        .auditLogsService;
    }

    it('records workspace.created on createTeam', async () => {
      const audit = getAudit();
      await service.createTeam('user-uuid-1', 'My Team');
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: 'ws-uuid-1',
          userId: 'user-uuid-1',
          action: AUDIT_ACTIONS.WORKSPACE_CREATED,
          resourceType: 'workspace',
          resourceId: 'ws-uuid-1',
        }),
      );
    });

    it('records workspace.updated (field=name) on renameWorkspace', async () => {
      memberRepo.findOne.mockResolvedValue({ role: 'admin' });
      workspaceRepo.findOne.mockResolvedValue({
        ...mockWorkspace,
        type: 'team',
      });
      const audit = getAudit();
      await service.renameWorkspace('ws-uuid-1', 'New Name', 'user-uuid-1');
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: 'ws-uuid-1',
          userId: 'user-uuid-1',
          action: AUDIT_ACTIONS.WORKSPACE_UPDATED,
          resourceType: 'workspace',
          resourceId: 'ws-uuid-1',
          details: { field: 'name' },
        }),
      );
    });

    it('records workspace.updated (field=settings) on updateWorkspaceSettings', async () => {
      memberRepo.findOne.mockResolvedValue({ role: 'owner' });
      workspaceRepo.findOne.mockResolvedValue({
        ...mockWorkspace,
        type: 'team',
        settings: {},
      });
      const audit = getAudit();
      await service.updateWorkspaceSettings(
        'ws-uuid-1',
        { interactionAllowedOrigins: ['https://a.com'] } as never,
        'user-uuid-1',
      );
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: 'ws-uuid-1',
          userId: 'user-uuid-1',
          action: AUDIT_ACTIONS.WORKSPACE_UPDATED,
          resourceType: 'workspace',
          resourceId: 'ws-uuid-1',
          details: { field: 'settings' },
        }),
      );
    });

    it('records member.invited (mode=direct_add) on addMemberByEmail', async () => {
      workspaceRepo.findOne.mockResolvedValue({
        ...mockWorkspace,
        type: 'team',
      });
      // getMemberRole(admin) → then existing-member lookup returns null.
      memberRepo.findOne
        .mockResolvedValueOnce({ role: 'admin' })
        .mockResolvedValueOnce(null);
      (
        service as unknown as { userRepository: { findOne: jest.Mock } }
      ).userRepository.findOne.mockResolvedValue({ id: 'user-added' });
      memberRepo.save.mockResolvedValue({ id: 'mem-added' });
      const audit = getAudit();
      await service.addMemberByEmail(
        'ws-uuid-1',
        'added@example.com',
        'editor',
        'user-uuid-1',
      );
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: 'ws-uuid-1',
          userId: 'user-uuid-1',
          action: AUDIT_ACTIONS.MEMBER_INVITED,
          resourceType: 'member',
          resourceId: 'mem-added',
          details: expect.objectContaining({ mode: 'direct_add' }),
        }),
      );
    });

    it('records member.role_changed (from/to) on updateMemberRole', async () => {
      // getMemberRole(admin) for assertAdmin, then the member being changed.
      memberRepo.findOne
        .mockResolvedValueOnce({ role: 'admin' })
        .mockResolvedValueOnce({
          id: 'mem-x',
          role: 'viewer',
          userId: 'user-x',
          workspaceId: 'ws-uuid-1',
        });
      memberRepo.save.mockImplementation((m: unknown) => Promise.resolve(m));
      const audit = getAudit();
      await service.updateMemberRole(
        'ws-uuid-1',
        'mem-x',
        'editor',
        'user-uuid-1',
      );
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: 'ws-uuid-1',
          userId: 'user-uuid-1',
          action: AUDIT_ACTIONS.MEMBER_ROLE_CHANGED,
          resourceType: 'member',
          resourceId: 'mem-x',
          details: expect.objectContaining({ from: 'viewer', to: 'editor' }),
        }),
      );
    });

    it('records member.removed (mode=removed) on admin removeMember', async () => {
      // member lookup (not self, not owner), then assertAdmin getMemberRole(admin).
      memberRepo.findOne
        .mockResolvedValueOnce({
          id: 'mem-y',
          role: 'editor',
          userId: 'user-y',
          workspaceId: 'ws-uuid-1',
        })
        .mockResolvedValueOnce({ role: 'admin' });
      const audit = getAudit();
      await service.removeMember('ws-uuid-1', 'mem-y', 'user-uuid-1');
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: 'ws-uuid-1',
          userId: 'user-uuid-1',
          action: AUDIT_ACTIONS.MEMBER_REMOVED,
          resourceType: 'member',
          resourceId: 'mem-y',
          details: expect.objectContaining({ mode: 'removed' }),
        }),
      );
    });

    it('records member.removed (mode=left) on leaveWorkspace', async () => {
      workspaceRepo.findOne.mockResolvedValue({
        ...mockWorkspace,
        type: 'team',
      });
      memberRepo.findOne.mockResolvedValue({
        id: 'mem-self',
        role: 'editor',
        userId: 'user-uuid-1',
        workspaceId: 'ws-uuid-1',
      });
      const audit = getAudit();
      await service.leaveWorkspace('ws-uuid-1', 'user-uuid-1');
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: 'ws-uuid-1',
          userId: 'user-uuid-1',
          action: AUDIT_ACTIONS.MEMBER_REMOVED,
          resourceType: 'member',
          details: expect.objectContaining({ mode: 'left' }),
        }),
      );
    });

    it('does NOT record any workspace.deleted action (CASCADE constraint)', () => {
      // 회귀 가드: audit_log.workspace_id ON DELETE CASCADE 로 삭제 감사는 영속 불가라
      // AUDIT_ACTIONS 에 workspace.deleted 자체가 없어야 한다.
      expect(
        Object.values(AUDIT_ACTIONS as Record<string, string>),
      ).not.toContain('workspace.deleted');
    });
  });

  /**
   * **2026-09-08 에 DB 레벨 투영으로 옮겼다.**
   *
   * 종전에는 `relations: ['user']` 로 `User` 전 컬럼을 싣고 **JS 단 수동 매핑**으로 필드를
   * 골랐다. `user-entity-exposure-guard` 는 **로드 형태**만 보므로 그 매핑이 넓어져도
   * (`...m.user` 스프레드 등) 초록이었고, 안전망이 e2e `workspace-rbac` J. 하나뿐이었다.
   * 이제 `select` 투영이라 컬럼이 애초에 오지 않고, 그 가드의 화이트리스트에서도 빠졌다.
   *
   * **아래 두 축을 다 유지한다.** 반환 키 단언(수동 매핑 축)만 두면 **투영을 되돌려도
   * 초록**이다 — `.map` 이 여전히 좁히기 때문이다. 그래서 *"쿼리가 투영을 요청했는가"* 를
   * 따로 단언한다. 반대로 투영 단언만 두면 `.map` 이 넓어지는 것을 놓친다.
   */
  describe('listMembers — DB 투영 + 반환 키', () => {
    const memberRow = (user: Record<string, unknown>) => ({
      id: 'm-1',
      userId: 'u-1',
      role: 'admin',
      joinedAt: new Date('2026-01-02T03:04:05.000Z'),
      user,
    });

    beforeEach(() => {
      memberRepo.findOne.mockResolvedValue({ id: 'm-req', role: 'owner' });
    });

    it('로드된 `User` 에 비밀 컬럼이 실려 와도 반환 키는 6개로 좁는다', async () => {
      memberRepo.find.mockResolvedValue([
        memberRow({
          id: 'u-1',
          email: 'a@b.c',
          name: 'A',
          // 실제로 로드되는 것 — 투영이 없으므로 전 컬럼이 온다.
          passwordHash: '$2b$10$x',
          twoFactorSecret: 's',
          totpRecoveryCodes: ['r1'],
          emailChangeToken: 't',
        }),
      ]);

      const rows = await service.listMembers('ws-uuid-1', 'user-uuid-1');

      expect(Object.keys(rows[0]).sort()).toEqual([
        'email',
        'id',
        'joinedAt',
        'name',
        'role',
        'userId',
      ]);
      // 이름 축과 같은 그물을 단위 레벨에서도 건다 — 키 목록만 보면 중첩으로 새는
      // 형태를 놓친다.
      expect(findUserSecretLeaks(rows)).toEqual([]);
    });

    it('쿼리가 `user` 관계를 `select` 로 좁혀 요청한다', async () => {
      // **위 단언만으로는 이 사실이 고정되지 않는다** — `select` 를 지워 전 컬럼을 로드해도
      // 아래 `.map` 이 여전히 6키로 좁히므로 반환 키 단언은 초록이다. 실제로 그 상태가
      // 2026-09-08 이전의 코드였고, 그때 이 자리는 `user-entity-exposure-guard` 의
      // 화이트리스트에 실려 있었다. 방어가 **어느 층에 있는지**를 단언한다.
      memberRepo.find.mockResolvedValue([]);

      await service.listMembers('ws-uuid-1', 'user-uuid-1');

      const opts = memberRepo.find.mock.calls[0][0] as {
        select?: { user?: Record<string, boolean> };
      };
      // 불리언이 아니라 **객체**여야 한다 — `select: { user: true }` 는 컬럼을 하나도
      // 좁히지 않아 투영이 아니다(그 형태는 구조 가드도 위반으로 본다).
      expect(opts.select?.user).toEqual({
        id: true,
        email: true,
        name: true,
      });
    });

    it.each([
      ['관계가 `null`', { user: null }],
      ['키 자체가 없음', {}],
    ])(
      '%s 이어도 터지지 않고 빈 문자열로 채운다',
      async (_label, userShape) => {
        // TypeORM 은 로드 실패한 관계를 **`null`** 로 돌려준다 — 키가 아예 없는 형태만
        // mock 하면 실제 경로를 안 태운다 (`review/code/2026/09/06/15_52_58` INFO#7).
        // 둘 다 옵셔널 체이닝으로 같은 결과여야 한다.
        memberRepo.find.mockResolvedValue([
          {
            id: 'm-2',
            userId: 'u-2',
            role: 'viewer',
            joinedAt: null,
            ...userShape,
          },
        ]);

        const rows = await service.listMembers('ws-uuid-1', 'user-uuid-1');

        expect(rows[0]).toEqual({
          id: 'm-2',
          userId: 'u-2',
          email: '',
          name: '',
          role: 'viewer',
          joinedAt: null,
        });
      },
    );
  });
});
