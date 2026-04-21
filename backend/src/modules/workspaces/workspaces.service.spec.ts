import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { WorkspacesService } from './workspaces.service';
import { Workspace } from './entities/workspace.entity';
import { WorkspaceMember } from './entities/workspace-member.entity';
import { WorkspaceInvitation } from './entities/workspace-invitation.entity';
import { User } from '../users/entities/user.entity';

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
});
