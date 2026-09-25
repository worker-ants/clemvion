import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { TRIGGER_RESOURCE_RELEASER } from '../triggers/trigger-resource-release';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DeleteResult, FindOperator } from 'typeorm';
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
    delete: jest.Mock;
  };

  /**
   * `service` 에 주입된 mock `AuditLogsService` 를 꺼낸다. 최상위 스코프로 한 번만 정의—
   * 종전엔 형제 `describe` 블록(`audit logging (결정4=B)` · `removeMember — 동시 제거`) 둘이
   * 바이트 단위로 동일한 지역 함수를 각자 갖고 있었다 (`/ai-review`
   * `review/code/2026/09/21/12_57_05` maintainability WARNING 4).
   */
  function getAudit(): { record: jest.Mock } {
    return (service as unknown as { auditLogsService: { record: jest.Mock } })
      .auditLogsService;
  }

  const mockWorkspace = {
    id: 'ws-uuid-1',
    name: "Test User's Workspace",
    type: 'personal',
    ownerId: 'user-uuid-1',
    slug: 'test-a1b2',
    settings: {},
  };

  /** 워크스페이스 삭제의 자원 정리 순서를 한 배열에 모은다. */
  const deleteEvents: string[] = [];
  const triggerReleaser = {
    releaseExternalForParent: jest.fn((parent: unknown) => {
      deleteEvents.push(`releaseExternal:${JSON.stringify(parent)}`);
      return Promise.resolve();
    }),
    lockParentAndListTriggerIds: jest.fn((_m: unknown, parent: unknown) => {
      deleteEvents.push(`lockAndList:${JSON.stringify(parent)}`);
      return Promise.resolve({
        parentPresence: 'present',
        triggerIds: ['trig-x'],
      });
    }),
    releaseSecretsAfterCommit: jest.fn((ids: string[], caller: string) => {
      deleteEvents.push(`releaseSecrets:${ids.join(',')}:${caller}`);
      return Promise.resolve();
    }),
  };

  beforeEach(async () => {
    deleteEvents.length = 0;
    // 전역 clearAllMocks 대신 이 mock 만 — 다른 케이스의 mock 상태를 건드리지 않는다.
    Object.values(triggerReleaser).forEach((fn) => fn.mockClear());
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
        { provide: TRIGGER_RESOURCE_RELEASER, useValue: triggerReleaser },
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

    // 비멤버는 요구 역할과 무관하게 NOT_A_MEMBER — `RolesGuard` 와 같은 규칙(두 번째 선도 같은 답).
    it('throws NOT_A_MEMBER when requester is not a member', async () => {
      memberRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateWorkspaceSettings(
          'ws-uuid-1',
          { interactionAllowedOrigins: ['https://example.com'] },
          'user-uuid-1',
        ),
      ).rejects.toMatchObject({ response: { code: 'NOT_A_MEMBER' } });
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

    // 종전 FORBIDDEN — spec(`9-user-profile.md` §6.1)과 가드가 NOT_A_MEMBER 라 두 번째 선도 맞춘다.
    it('throws NOT_A_MEMBER when requester is not a member', async () => {
      memberRepo.findOne.mockResolvedValue(null);

      await expect(
        service.getWorkspaceSettings('ws-uuid-1', 'user-uuid-1'),
      ).rejects.toMatchObject({ response: { code: 'NOT_A_MEMBER' } });
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

    /**
     * 워크스페이스의 트리거는 FK CASCADE 로 함께 지워진다 — 외부 해제는 트랜잭션 **밖에서 먼저**,
     * 비밀은 **커밋 뒤** (spec 트리거 목록 §4.3 · data-flow 12-workspace §1.10). 트리거 열거는
     * 워크스페이스 행을 잠근 **뒤** 같은 트랜잭션에서 한다.
     */
    it('owner — 외부 해제 → (열거·잠금 → 잠금 재검사 → 삭제) → 커밋 뒤 비밀 순서다', async () => {
      memberRepo.findOne.mockImplementation((opts: { lock?: unknown }) => {
        deleteEvents.push(opts.lock ? 'check:locked' : 'check:unlocked');
        return Promise.resolve({ role: 'owner' });
      });
      workspaceRepo.findOne.mockResolvedValue({
        ...mockWorkspace,
        type: 'team',
      });
      workspaceRepo.remove.mockImplementation(() => {
        deleteEvents.push('workspace.remove');
        return Promise.resolve(undefined);
      });

      await service.deleteWorkspace('ws-uuid-1', 'user-uuid-1');

      expect(deleteEvents).toEqual([
        'check:unlocked',
        'releaseExternal:{"workspaceId":"ws-uuid-1"}',
        // 트랜잭션의 **첫 호출**이 잠금 상한·워크스페이스 잠금·열거다 — 그래야 뒤 재검사의 잠금에도
        // 상한이 걸린다.
        'lockAndList:{"workspaceId":"ws-uuid-1"}',
        'check:locked',
        'workspace.remove',
        'releaseSecrets:trig-x:WorkspacesService.deleteWorkspace',
      ]);
    });

    it('owner 가 아니면(403) 외부 자원을 건드리지 않는다 — 권한 검사가 먼저다', async () => {
      // 트랜잭션 안에서만 검사하면 403 이 날 요청이 provider 등록·schedule job 부터 뜯는다.
      memberRepo.findOne.mockResolvedValue({ role: 'admin' });
      workspaceRepo.findOne.mockResolvedValue({
        ...mockWorkspace,
        type: 'team',
      });

      await expect(
        service.deleteWorkspace('ws-uuid-1', 'user-uuid-1'),
      ).rejects.toMatchObject({ response: { code: 'OWNER_REQUIRED' } });

      expect(triggerReleaser.releaseExternalForParent).not.toHaveBeenCalled();
      expect(triggerReleaser.releaseSecretsAfterCommit).not.toHaveBeenCalled();
    });

    it('정리 협력자를 못 찾으면 아무것도 지우지 않고 던진다 (no-op 금지)', async () => {
      // 워크플로 삭제와 같은 규칙 — 조용히 넘어가면 트리거 자원이 정리되지 않는 결함이 돌아온다.
      const bare = await Test.createTestingModule({
        providers: [
          WorkspacesService,
          { provide: getRepositoryToken(Workspace), useValue: workspaceRepo },
          {
            provide: getRepositoryToken(WorkspaceMember),
            useValue: memberRepo,
          },
          {
            provide: getRepositoryToken(User),
            useValue: { findOne: jest.fn() },
          },
          { provide: AuditLogsService, useValue: { record: jest.fn() } },
        ],
      }).compile();
      memberRepo.findOne.mockResolvedValue({ role: 'owner' });
      workspaceRepo.findOne.mockResolvedValue({
        ...mockWorkspace,
        type: 'team',
      });

      // **무엇이 던졌는지** 본다 — 다른 이유로 던져도 GREEN 이 되면 안 된다.
      await expect(
        bare.get(WorkspacesService).deleteWorkspace('ws-uuid-1', 'user-uuid-1'),
      ).rejects.toThrow(/TRIGGER_RESOURCE_RELEASER/);

      expect(workspaceRepo.remove).not.toHaveBeenCalled();
    });

    it('잠금 순서는 워크스페이스 → 멤버십이다 (transferOwnership 과 같아야 교착이 없다)', async () => {
      // 반대 순서(멤버십 → 워크스페이스)면 같은 owner 의 소유권 이전과 겹칠 때 `40P01` 이 난다.
      const locks: string[] = [];
      workspaceRepo.findOne.mockImplementation((opts: { lock?: unknown }) => {
        if (opts.lock) locks.push('workspace');
        return Promise.resolve({ ...mockWorkspace, type: 'team' });
      });
      memberRepo.findOne.mockImplementation((opts: { lock?: unknown }) => {
        if (opts.lock) locks.push('member');
        return Promise.resolve({ role: 'owner' });
      });

      await service.deleteWorkspace('ws-uuid-1', 'user-uuid-1');

      expect(locks).toEqual(['workspace', 'member']);
    });

    /**
     * 동시 DELETE 두 건 — 먼저 커밋한 쪽이 워크스페이스를 지우면 CASCADE 로 멤버 행도 함께
     * 사라진다. `assertWorkspaceDeletable` 재검사는 «멤버십(권한)» 을 «존재» 보다 먼저 보므로,
     * 이 가드가 없으면 두 번째 요청은 404 가 아니라 403 `OWNER_REQUIRED` 를 받고 바깥 `.catch` 가
     * 이를 «수동 정리가 필요하다» 는 거짓 error 로 남긴다(워크플로 경로와 같은 형태 —
     * `/ai-review` `review/code/2026/09/20/20_06_26` WARNING#1).
     */
    it('잠금 뒤 워크스페이스가 사라졌으면(동시 삭제) 404 이고 거짓 로그를 남기지 않는다', async () => {
      const error = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => undefined);
      try {
        memberRepo.findOne.mockResolvedValue({ role: 'owner' });
        workspaceRepo.findOne.mockResolvedValue({
          ...mockWorkspace,
          type: 'team',
        });
        triggerReleaser.lockParentAndListTriggerIds.mockImplementationOnce(
          (_m: unknown, parent: unknown) => {
            deleteEvents.push(`lockAndList:${JSON.stringify(parent)}`);
            return Promise.resolve({
              parentPresence: 'absent',
              triggerIds: [],
            });
          },
        );

        await expect(
          service.deleteWorkspace('ws-uuid-1', 'user-uuid-1'),
        ).rejects.toMatchObject({ response: { code: 'WORKSPACE_NOT_FOUND' } });

        expect(workspaceRepo.remove).not.toHaveBeenCalled();
        expect(
          (memberRepo as unknown as { delete: jest.Mock }).delete,
        ).not.toHaveBeenCalled();
        expect(
          triggerReleaser.releaseSecretsAfterCommit,
        ).not.toHaveBeenCalled();
        expect(error).not.toHaveBeenCalled();
      } finally {
        error.mockRestore();
      }
    });

    it('선검사 뒤 역할이 바뀌어 재검사가 거부하면, 외부 해제가 이미 끝났다는 사실을 남기고 던진다', async () => {
      // 선검사(잠금 없음)와 재검사(잠금) 사이의 좁은 창이다. 외부 해제는 되돌릴 수 없으므로 워크스페이스는
      // 남았는데 트리거가 발화하지 않는 상태를 소리내어 남긴다(`/ai-review` `review/code/2026/09/17/18_45_09` WARNING#2·#4).
      const error = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => undefined);
      try {
        workspaceRepo.findOne.mockResolvedValue({
          ...mockWorkspace,
          type: 'team',
        });
        memberRepo.findOne
          .mockResolvedValueOnce({ role: 'owner' })
          .mockResolvedValueOnce({ role: 'admin' });

        await expect(
          service.deleteWorkspace('ws-uuid-1', 'user-uuid-1'),
        ).rejects.toMatchObject({ response: { code: 'OWNER_REQUIRED' } });

        expect(triggerReleaser.releaseExternalForParent).toHaveBeenCalled();
        expect(
          triggerReleaser.releaseSecretsAfterCommit,
        ).not.toHaveBeenCalled();
        const logged = error.mock.calls.map(([m]) => String(m)).join('\n');
        expect(logged).toContain('ws-uuid-1');
        expect(logged).toContain('이미 끝났으므로');
      } finally {
        error.mockRestore();
      }
    });

    it('personal 워크스페이스면 외부 자원을 건드리지 않는다', async () => {
      memberRepo.findOne.mockResolvedValue({ role: 'owner' });
      workspaceRepo.findOne.mockResolvedValue({
        ...mockWorkspace,
        type: 'personal',
      });

      await expect(
        service.deleteWorkspace('ws-uuid-1', 'user-uuid-1'),
      ).rejects.toMatchObject({ response: { code: 'CANNOT_DELETE_PERSONAL' } });

      expect(triggerReleaser.releaseExternalForParent).not.toHaveBeenCalled();
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
      // 멤버여야 유형 판정까지 간다 — 비멤버는 그 전에 NOT_A_MEMBER 다(아래 오라클 케이스).
      memberRepo.findOne.mockResolvedValue({
        id: 'mem-1',
        role: 'owner',
        userId: 'user-uuid-1',
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

  /**
   * 인가가 조회보다 먼저다 — 종전 두 메서드는 워크스페이스를 먼저 조회해 비멤버가 «없음(404) ·
   * 개인 · 팀» 을 구분할 수 있었다(존재 · 유형 오라클). HTTP 경로에서는 이제 `RolesGuard` 가 먼저
   * 막지만, 서비스 검사는 가드의 인식이 깨졌을 때의 두 번째 선이라 같은 오라클을 남기지 않는다
   * (`spec/data-flow/12-workspace.md` §Rationale "경로 파라미터 워크스페이스도 가드가 본다").
   */
  describe('비멤버에게 워크스페이스 존재 · 유형을 드러내지 않는다', () => {
    const workspaces = [
      ['부재', null],
      ['개인', { ...mockWorkspace, type: 'personal' as const }],
      ['팀', { ...mockWorkspace, type: 'team' as const }],
    ] as const;

    it.each(workspaces)(
      'leaveWorkspace — 워크스페이스 %s 여도 NOT_A_MEMBER, 워크스페이스는 조회하지 않는다',
      async (_label, workspace) => {
        workspaceRepo.findOne.mockResolvedValue(workspace);
        memberRepo.findOne.mockResolvedValue(null);

        await expect(
          service.leaveWorkspace('ws-uuid-1', 'user-uuid-1'),
        ).rejects.toMatchObject({ response: { code: 'NOT_A_MEMBER' } });
        expect(workspaceRepo.findOne).not.toHaveBeenCalled();
      },
    );

    it.each(workspaces)(
      'addMemberByEmail — 워크스페이스 %s 여도 NOT_A_MEMBER, 워크스페이스는 조회하지 않는다',
      async (_label, workspace) => {
        workspaceRepo.findOne.mockResolvedValue(workspace);
        memberRepo.findOne.mockResolvedValue(null);

        await expect(
          service.addMemberByEmail(
            'ws-uuid-1',
            'added@example.com',
            'editor',
            'user-uuid-1',
          ),
        ).rejects.toMatchObject({ response: { code: 'NOT_A_MEMBER' } });
        expect(workspaceRepo.findOne).not.toHaveBeenCalled();
      },
    );

    /**
     * 멤버지만 admin 이 아니어도 같다 — 역할 판정이 유형 판정보다 먼저라 개인 워크스페이스라는 사실을
     * 드러내지 않는다(`review/code/2026/09/25/17_47_18` testing WARNING — 비멤버만 보던 빈칸).
     */
    it.each(workspaces)(
      'addMemberByEmail — 비-admin 멤버는 워크스페이스 %s 여도 ADMIN_REQUIRED, 워크스페이스는 조회하지 않는다',
      async (_label, workspace) => {
        workspaceRepo.findOne.mockResolvedValue(workspace);
        memberRepo.findOne.mockResolvedValue({ role: 'editor' });

        await expect(
          service.addMemberByEmail(
            'ws-uuid-1',
            'added@example.com',
            'editor',
            'user-uuid-1',
          ),
        ).rejects.toMatchObject({ response: { code: 'ADMIN_REQUIRED' } });
        expect(workspaceRepo.findOne).not.toHaveBeenCalled();
      },
    );

    /**
     * `transferOwnership` 도 같은 모양이었다 — 트랜잭션 안에서 워크스페이스를 먼저 읽어 «없음 404 · 개인
     * `CANNOT_TRANSFER_PERSONAL` · 팀 비-owner `OWNER_REQUIRED`» 로 갈렸다. 계획 단계 실측이 놓친 세 번째
     * 자리다(`review/code/2026/09/25/17_47_18` requirement WARNING).
     */
    it.each(workspaces)(
      'transferOwnership — 워크스페이스 %s 여도 비멤버는 NOT_A_MEMBER, 워크스페이스는 조회하지 않는다',
      async (_label, workspace) => {
        workspaceRepo.findOne.mockResolvedValue(workspace);
        memberRepo.findOne.mockResolvedValue(null);

        await expect(
          service.transferOwnership('ws-uuid-1', 'user-uuid-1', 'mem-target'),
        ).rejects.toMatchObject({ response: { code: 'NOT_A_MEMBER' } });
        expect(workspaceRepo.findOne).not.toHaveBeenCalled();
      },
    );

    it.each(workspaces)(
      'transferOwnership — 워크스페이스 %s 여도 비-owner 멤버는 OWNER_REQUIRED, 워크스페이스는 조회하지 않는다',
      async (_label, workspace) => {
        workspaceRepo.findOne.mockResolvedValue(workspace);
        memberRepo.findOne.mockResolvedValue({ id: 'mem-1', role: 'admin' });

        // 코드는 가드와 같은 OWNER_REQUIRED 이고, 문장은 이 동작의 서비스 고유 문구다 — 가드의 «Owner 권한이
        // 필요합니다.» 로 바뀌면 e2e 가 어느 층이 막았는지 가르는 근거가 사라진다.
        await expect(
          service.transferOwnership('ws-uuid-1', 'user-uuid-1', 'mem-target'),
        ).rejects.toMatchObject({
          response: {
            code: 'OWNER_REQUIRED',
            message: 'owner 이양은 현재 owner 만 수행할 수 있습니다.',
          },
        });
        expect(workspaceRepo.findOne).not.toHaveBeenCalled();
      },
    );
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
      // 첫 조회는 트랜잭션 **밖**의 인가 선행이라 무락이다(존재 · 유형 오라클 제거). 트랜잭션 안의
      // 조회(요청자 재검사 · 대상)는 전부 락이다 — 동시 owner 변경과의 경합은 그쪽이 막는다.
      expect(memberCalls[0].lock).toBeUndefined();
      expect(memberCalls.length).toBeGreaterThan(1);
      for (const call of memberCalls.slice(1)) {
        expect(call.lock).toEqual({ mode: 'pessimistic_write' });
      }
    });

    /**
     * 트랜잭션 안 재검사 분기 — 무락 인가 선행은 owner 로 통과했는데, 락을 잡고 다시 보니 owner 가 아니다(그 사이
     * 다른 이양으로 강등됐다). 이 분기가 없으면 강등된 요청자가 두 번째 이양을 끝낸다. 선행만 보는 위 테스트들로는
     * 이 자리가 고정되지 않는다 — 조회를 `lock` 유무로 갈라 선행에는 owner, 재검사에는 admin 을 돌려준다.
     */
    it('인가 선행은 owner 였지만 락 재검사에서 강등이 보이면 OWNER_REQUIRED — 멤버를 바꾸지 않는다', async () => {
      workspaceRepo.findOne.mockResolvedValue(teamWorkspace);
      memberRepo.findOne.mockImplementation(
        (opts: { where?: Record<string, unknown>; lock?: unknown }) => {
          const where = opts?.where ?? {};
          if (where.userId === requesterId) {
            return Promise.resolve({
              id: 'mem-owner',
              // 선행(무락)은 owner, 락을 잡은 재검사는 이미 강등된 admin.
              role: opts.lock ? 'admin' : 'owner',
              userId: requesterId,
              workspaceId: 'ws-uuid-1',
            });
          }
          return Promise.resolve(null);
        },
      );

      await expect(
        service.transferOwnership('ws-uuid-1', requesterId, newOwnerMemberId),
      ).rejects.toMatchObject({
        response: {
          code: 'OWNER_REQUIRED',
          message: 'owner 이양은 현재 owner 만 수행할 수 있습니다.',
        },
      });
      // 재검사 분기를 실제로 탔는지 — 선행(무락)과 재검사(락) 두 번 요청자를 읽었다.
      const requesterReads = memberRepo.findOne.mock.calls
        .map((c) => c[0] as { where?: Record<string, unknown>; lock?: unknown })
        .filter((o) => o.where?.userId === requesterId);
      expect(requesterReads.map((o) => o.lock ?? null)).toEqual([
        null,
        { mode: 'pessimistic_write' },
      ]);
      expect(memberRepo.save).not.toHaveBeenCalled();
      expect(workspaceRepo.save).not.toHaveBeenCalled();
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
      // 요청자 role 조회(admin)와 대상 조회(not self, not owner)를 **where 로** 가른다.
      // 종전엔 `mockResolvedValueOnce` 두 개로 **호출 순서**에 결합돼 있었는데, 권한 검사를
      // 대상 조회보다 앞으로 옮기자 두 값이 서로 바뀌어 들어갔다. 순서가 아니라 질의 내용으로
      // 답하면 다음 재배치에도 깨지지 않는다 (형제 `wireFindOne` 과 같은 방식).
      memberRepo.findOne.mockImplementation(
        (opts: { where: { id?: string } }) =>
          Promise.resolve(
            opts.where.id === 'mem-y'
              ? {
                  id: 'mem-y',
                  role: 'editor',
                  userId: 'user-y',
                  workspaceId: 'ws-uuid-1',
                }
              : { role: 'admin' },
          ),
      );
      // 이 테스트의 전제는 «한 행이 실제로 지워졌다» 이다. 공유 mock 의 기본값은
      // `deleteWorkspace` 의 cascade 용 `{affected: 0}` 이므로 여기서 명시한다.
      memberRepo.delete.mockResolvedValue({ affected: 1 });
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

  /**
   * 동시 제거 두 건이 `member.removed` 감사를 두 번 남기던 결함의 회귀 테스트.
   * 형제 다섯(#1369~#1372)과 같은 클래스이고, 이 자리엔 락이 없어 처방도 통합 경로와 같다 —
   * 원자적 `DELETE` 의 `affected` 를 판별자로 쓴다.
   */
  describe('removeMember — 동시 제거', () => {
    const workspaceId = 'ws-uuid-1';
    const memberId = 'mem-1';
    const requesterId = 'admin-user';

    /**
     * `removeMember` 는 `findOne` 을 두 번 부른다 — **요청자 멤버십**(`where.userId`, 이제
     * `getMemberRole` 로 **직접** 읽는다. `assertAdmin` 을 거치지 않는다)과 **대상 멤버**
     * (`where.id`)다. 둘을 where 로 갈라 답한다. 요청자 멤버십 레코드는 기본 owner 지만,
     * 두 번째 인자로 비-admin(또는 `null` = 비-멤버) 응답도 흉내낼 수 있다.
     *
     * > **호출 «순서» 에 결합하지 않는다.** 인가를 대상 조회보다 앞으로 옮기면서 두 조회의
     * > 순서가 뒤집혔는데, 같은 파일의 감사 테스트가 `mockResolvedValueOnce` 체인이라 두 값이
     * > 서로 바뀌어 들어가 깨졌다(그쪽도 where-키로 바꿨다). 질의 내용으로 답하면 다음
     * > 재배치에도 버틴다.
     */
    function wireFindOne(
      target: Record<string, unknown> | null,
      /** `null` 이면 요청자가 **그 워크스페이스 멤버가 아니다**. */
      requesterMembership: Record<string, unknown> | null = {
        id: 'mem-req',
        role: 'owner',
      },
      /**
       * 주면 대상 멤버의 **두 번째 조회부터** 이 값을 답한다 — 즉 TOCTOU 를 단위에서 재현한다.
       * `removeMember` 는 0-행 경로에서만 대상을 다시 읽으므로, 여기에 `role: 'owner'` 를 주면
       * «읽을 땐 editor 였는데 지울 땐 owner» 가 된다. 생략하면 종전대로 항상 `target` 이다.
       */
      targetOnReread?: Record<string, unknown> | null,
    ): void {
      let targetReads = 0;
      memberRepo.findOne.mockImplementation(
        (opts: { where: { id?: string; userId?: string } }) => {
          if (opts.where.id !== memberId) {
            return Promise.resolve(requesterMembership);
          }
          const first = targetReads++ === 0;
          return Promise.resolve(
            first || targetOnReread === undefined ? target : targetOnReread,
          );
        },
      );
    }

    beforeEach(() => {
      wireFindOne({ id: memberId, userId: 'target-user', role: 'editor' });
      memberRepo.delete.mockResolvedValue({ affected: 1 });
    });

    it('한 행을 지우면 그 멤버의 감사를 남긴다', async () => {
      await service.removeMember(workspaceId, memberId, requesterId);

      // `Not('owner')` 는 deep-equality 에 불투명하다 — `toHaveBeenCalledWith` 로는
      // «술어가 있다» 를 확인할 수 없고(형제 `sessions.service.spec.ts` 가 같은 이유로
      // criteria 객체를 직접 본다), 그래서 FindOperator 를 풀어 본다.
      // 이 단언은 «술어를 넘겼다» 까지만 고정한다 — «그것이 SQL 로 옳게 렌더된다» 는
      // 실 DB 만 오라클이고 `member-remove-concurrency.e2e-spec.ts` 가 고정한다.
      const [criteria] = memberRepo.delete.mock.calls[0] as [
        { id: string; workspaceId: string; role: FindOperator<string> },
      ];
      expect(criteria.id).toBe(memberId);
      expect(criteria.workspaceId).toBe(workspaceId);
      expect(criteria.role.type).toBe('not');
      expect(criteria.role.value).toBe('owner');
      expect(getAudit().record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AUDIT_ACTIONS.MEMBER_REMOVED,
          resourceType: 'member',
          resourceId: memberId,
          details: { mode: 'removed', memberUserId: 'target-user' },
        }),
      );
    });

    /**
     * 진 쪽은 404 다 — 재조회가 **행이 없다**를 답하는 경우. 0-행의 나머지 한 이유이고,
     * 아래 owner 갈래 둘과 짝이 돼 «존재하든 말든 403» 으로 넓히는 편집을 죽인다.
     *
     * > **종전 이 블록은 일어날 수 없는 상태를 고정하고 있었다.** 재조회가 `editor` 를
     * > 답하게 두고 404 를 기대했는데, DELETE 의 술어는 `role` 하나뿐이라 «행이 남아 있고
     * > owner 가 아닌데 0행» 은 성립하지 않는다. 술어가 들어오기 **전**에 쓰인 단언이
     * > 그대로 남아 있었던 것이고, `/ai-review` `08_09_57` W3 이 그 틈을 짚었다.
     *
     * > **그 정정이 곧바로 중복을 만들었다.** 같은 라운드에서 «행이 사라졌으면 404» 블록을
     * > 따로 추가했는데, 이 블록을 `null` 재조회로 고치자 둘이 **mock·단언까지 동일**해졌다.
     * > 다음 라운드(`08_46_47` W1)가 그것을 잡아 중복 쪽을 지웠다 — 한쪽만 갱신되고 다른
     * > 쪽이 낡는 silent drift 자리였다.
     */
    it('진 쪽은 404 이고 감사를 남기지 않는다', async () => {
      // 둘 다 무락 조회를 통과했지만 원자적 DELETE 는 하나만 1행을 지운다 —
      // 진 쪽이 다시 읽으면 행이 이미 없다.
      wireFindOne(
        { id: memberId, userId: 'target-user', role: 'editor' },
        undefined,
        null,
      );
      memberRepo.delete.mockResolvedValue({ affected: 0 });

      await expect(
        service.removeMember(workspaceId, memberId, requesterId),
      ).rejects.toMatchObject({
        response: { code: 'MEMBER_NOT_FOUND' },
      });
      expect(getAudit().record).not.toHaveBeenCalled();
    });

    /**
     * **owner 보호 가드의 TOCTOU** — 이 describe 의 다른 블록들과 계약이 다르다.
     * 다른 블록은 «감사를 두 번 남기지 않는다» 이고 이것은 «owner 를 지우지 않는다» 다.
     *
     * 무락 선조회는 `editor` 를 봤는데 DELETE 시점엔 `transferOwnership` 이 그 행을 승격시킨
     * 상태다. 술어 `role: Not('owner')` 가 0행을 만들고, 0-행 경로의 재조회가 **행이 남아
     * 있음**을 보고 403 으로 간다. 술어를 빼면 owner 가 지워지고 `workspace.ownerId` 가
     * 멤버십 없는 사용자를 가리킨다 (e2e 로 재현: 고치기 전 200).
     */
    it('DELETE 시점에 대상이 owner 로 승격됐으면 403 이고 감사가 없다', async () => {
      wireFindOne(
        { id: memberId, userId: 'target-user', role: 'editor' },
        undefined,
        {
          id: memberId,
          userId: 'target-user',
          role: 'owner',
        },
      );
      memberRepo.delete.mockResolvedValue({ affected: 0 });

      await expect(
        service.removeMember(workspaceId, memberId, requesterId),
      ).rejects.toMatchObject({
        response: { code: 'CANNOT_REMOVE_OWNER' },
      });
      expect(getAudit().record).not.toHaveBeenCalled();
    });

    /**
     * **이양 연쇄 — 재조회가 강등된 행을 본다.** 승격돼 DELETE 를 막은 뒤 다시 admin 으로
     * 내려온 상태다. 그래도 «DELETE 를 막은 것은 owner 였다» 는 사실은 변하지 않으므로
     * 403 이다. 여기서 현재 role 을 다시 물으면 **실재하는 멤버를 404 로** 보고하게 된다
     * (`/ai-review` `review/code/2026/09/24/08_09_57` W3 — 이 제3 상태를 짚었다).
     *
     * 이 블록이 «재조회의 role 을 본다» 로 되돌리는 편집을 죽인다.
     */
    it('재조회가 강등된 행을 봐도 403 이다 — 막은 것은 owner 였다', async () => {
      wireFindOne(
        { id: memberId, userId: 'target-user', role: 'editor' },
        undefined,
        { id: memberId, userId: 'target-user', role: 'admin' },
      );
      memberRepo.delete.mockResolvedValue({ affected: 0 });

      await expect(
        service.removeMember(workspaceId, memberId, requesterId),
      ).rejects.toMatchObject({
        response: { code: 'CANNOT_REMOVE_OWNER' },
      });
      expect(getAudit().record).not.toHaveBeenCalled();
    });

    /**
     * 판정이 `affected === 0` **명시 비교**인 이유를 붙드는 대조군.
     * `null`·`undefined` 는 드라이버가 «보고하지 않았다» 는 뜻이지 «못 지웠다» 가 아니다 —
     * `!affected` 로 되돌리면 정상 삭제가 404 로 뒤집힌다. #1371 에서 이 대조군이 빠져
     * 같은 뮤턴트가 32건을 통과했다.
     */
    it.each([[undefined], [null]])(
      'affected 가 %p(드라이버 미보고)면 정상 삭제로 취급한다',
      async (affected) => {
        memberRepo.delete.mockResolvedValue({
          affected,
          raw: [],
        } as unknown as DeleteResult);

        await expect(
          service.removeMember(workspaceId, memberId, requesterId),
        ).resolves.toBeUndefined();
        expect(getAudit().record).toHaveBeenCalled();
      },
    );

    it('대상이 없으면 삭제를 시도하지 않는다', async () => {
      wireFindOne(null);

      await expect(
        service.removeMember(workspaceId, memberId, requesterId),
      ).rejects.toMatchObject({ response: { code: 'MEMBER_NOT_FOUND' } });
      expect(memberRepo.delete).not.toHaveBeenCalled();
      expect(getAudit().record).not.toHaveBeenCalled();
    });

    it('owner 는 지우지 않는다', async () => {
      wireFindOne({ id: memberId, userId: 'target-user', role: 'owner' });

      await expect(
        service.removeMember(workspaceId, memberId, requesterId),
      ).rejects.toMatchObject({ response: { code: 'CANNOT_REMOVE_OWNER' } });
      expect(memberRepo.delete).not.toHaveBeenCalled();
      expect(getAudit().record).not.toHaveBeenCalled();
    });

    /**
     * 요청자가 admin/owner 가 아니면 거부돼야 한다. **검사 순서에 결합하지 않는다** —
     * "어느 단계에서 거부되는가" 가 아니라 **"`ADMIN_REQUIRED` 로 거부되고 `delete` 가
     * 호출되지 않는다"** 는 불변만 본다.
     *
     * > **그 순서 재배치는 2026-09-24 에 일어났고, 이 블록은 그대로 통과했다** — 순서에
     * > 결합하지 않게 써 둔 것이 값을 했다. 다만 예고 문구("후속 PR 이 `assertAdmin` 을 앞으로
     * > 옮길 예정")는 **실제 처방과 달랐다**: `assertAdmin` 자체는 그대로 두고, `removeMember`
     * > 안에서 요청자 role 을 직접 읽어(`getMemberRole`) 멤버십은 앞에서·admin 은 self 위임
     * > 뒤에서 판정한다. `assertAdmin` 을 통째로 앞에 두면 자가 탈퇴가 깨지기 때문이다.
     * >
     * > 대상이 `editor` 라 이 블록은 admin/owner 두 판정의 **순서를 가르지 못한다** —
     * > 그것은 아래 «비-admin 이 owner 를 지목하면 …» 블록이 본다.
     */
    it('admin/owner 가 아니면 ADMIN_REQUIRED 로 거부하고 delete 를 타지 않는다', async () => {
      wireFindOne(
        { id: memberId, userId: 'target-user', role: 'editor' },
        { id: 'mem-req', role: 'editor' },
      );

      await expect(
        service.removeMember(workspaceId, memberId, requesterId),
      ).rejects.toMatchObject({ response: { code: 'ADMIN_REQUIRED' } });
      expect(memberRepo.delete).not.toHaveBeenCalled();
      expect(getAudit().record).not.toHaveBeenCalled();
    });

    /**
     * **비-멤버는 대상을 읽기도 전에 끝난다.** 이것이 존재 오라클을 닫는 자리다 — ~~가드 층은
     * 이 라우트를 막지 못하므로(`@Roles()` 없음 + `@Param('id')` → `handlerConsumesWorkspaceId`
     * false) 서비스가 첫 방어선이다.~~ (2026-09-25 정정) 이제 `@WorkspaceParam('id')` 라
     * `RolesGuard` 가 먼저 막고, 이 순서는 가드 인식이 깨졌을 때의 **두 번째 선**이다.
     *
     * 단언이 «`NOT_A_MEMBER` 를 던진다» 에서 멈추지 않는다 — **대상 조회 자체가 없었음**까지
     * 본다. 코드만 바꾸고 조회를 남겨 두면 오라클이 그대로인데 이 테스트는 초록이 된다.
     */
    it('비-멤버는 대상을 조회하기 전에 NOT_A_MEMBER 로 끝난다', async () => {
      wireFindOne(
        { id: memberId, userId: 'target-user', role: 'editor' },
        null,
      );

      await expect(
        service.removeMember(workspaceId, memberId, requesterId),
      ).rejects.toMatchObject({ response: { code: 'NOT_A_MEMBER' } });

      const targetLookups = memberRepo.findOne.mock.calls.filter(
        (c: [{ where?: { id?: string } }]) => c[0]?.where?.id === memberId,
      );
      expect(targetLookups).toHaveLength(0);
      expect(memberRepo.delete).not.toHaveBeenCalled();
      expect(getAudit().record).not.toHaveBeenCalled();
    });

    /**
     * **admin 판정이 owner 판정보다 앞이다.** 비-admin 멤버가 owner 를 지목하면
     * `CANNOT_REMOVE_OWNER` 가 아니라 `ADMIN_REQUIRED` 다 — 전자는 «대상이 owner 만 아니면
     * 가능하다» 는 거짓 함의를 준다(editor 는 누구도 제거할 수 없다).
     *
     * 이 블록이 두 판정을 되돌려 놓는 편집을 죽인다. 위 «admin/owner 가 아니면 …» 블록은
     * 대상이 editor 라 순서를 가르지 못한다.
     */
    it('비-admin 이 owner 를 지목하면 CANNOT_REMOVE_OWNER 가 아니라 ADMIN_REQUIRED 다', async () => {
      wireFindOne(
        { id: memberId, userId: 'target-user', role: 'owner' },
        { id: 'mem-req', role: 'editor' },
      );

      await expect(
        service.removeMember(workspaceId, memberId, requesterId),
      ).rejects.toMatchObject({ response: { code: 'ADMIN_REQUIRED' } });
      expect(memberRepo.delete).not.toHaveBeenCalled();
    });

    /**
     * 자가 제거는 `leaveWorkspace` 로 위임된다 — 그쪽은 트랜잭션 안 `pessimistic_write` 라
     * 이 PR 의 수정 대상이 아니다. 위임 경계가 사라지면 같은 결함이 이 라우트로 되돌아온다.
     */
    it('자기 자신이면 leaveWorkspace 로 위임하고 이 경로의 DELETE 는 타지 않는다', async () => {
      wireFindOne({ id: memberId, userId: requesterId, role: 'editor' });
      const leave = jest
        .spyOn(service, 'leaveWorkspace')
        .mockResolvedValue(undefined);

      await service.removeMember(workspaceId, memberId, requesterId);

      expect(leave).toHaveBeenCalledWith(workspaceId, requesterId);
      expect(memberRepo.delete).not.toHaveBeenCalled();
      leave.mockRestore();
    });

    /**
     * **비-admin 도 자기 자신은 나갈 수 있다.** 위 블록은 요청자가 기본값 `owner` 라 admin
     * 판정을 어차피 통과하므로 «self 위임이 admin 판정보다 **앞**» 이라는 계약을 가르지
     * 못한다 — 그 분기를 admin 판정 뒤로 옮기는 회귀에도 초록이다
     * (`/ai-review` `review/code/2026/09/24/11_10_45` W1).
     *
     * 이 계약이 바로 «`assertAdmin` 을 형제처럼 첫 줄에 두지 못하는» 이유다.
     */
    it('비-admin 도 자기 자신이면 위임된다 — ADMIN_REQUIRED 가 아니다', async () => {
      wireFindOne(
        { id: memberId, userId: requesterId, role: 'editor' },
        { id: 'mem-req', role: 'editor' },
      );
      const leave = jest
        .spyOn(service, 'leaveWorkspace')
        .mockResolvedValue(undefined);

      await expect(
        service.removeMember(workspaceId, memberId, requesterId),
      ).resolves.toBeUndefined();

      expect(leave).toHaveBeenCalledWith(workspaceId, requesterId);
      expect(memberRepo.delete).not.toHaveBeenCalled();
      leave.mockRestore();
    });

    /**
     * **대상 존재 판정이 admin 판정보다 앞이다.** 비-admin 멤버가 없는 대상을 지목하면
     * `ADMIN_REQUIRED` 가 아니라 `MEMBER_NOT_FOUND` 다 — self 위임이 대상을 읽어야 하고,
     * 읽었으면 «없다» 가 먼저 드러난다.
     *
     * 위 «대상이 없으면 삭제를 시도하지 않는다» 블록은 요청자가 기본값 owner 라 admin 판정을
     * 어차피 통과하므로 이 순서를 가르지 못한다. null 검사를 admin 판정 뒤로 내리고 self
     * 비교를 `member?.userId` 로 바꾸는 편집은 타입체크도, 나머지 스위트도 통과한다.
     *
     * > **이것은 보안 불변이 아니라 문서화된 순서다.** 403 을 줘도 새는 것이 없다 —
     * > `listMembers` 가 멤버십만 요구하므로 멤버는 이미 모든 `memberId` 를 열거할 수 있다.
     * > 형제 `updateMemberRole` 은 `assertAdmin` 이 첫 줄이라 같은 입력에 403 을 준다. 그쪽에
     * > 맞추기로 한다면 `removeMember` 머리 주석의 판정 순서와 이 블록을 **함께** 바꿀 것 —
     * > 이 블록이 막는 것은 403 이 아니라 둘이 조용히 갈라지는 것이다.
     */
    it('비-admin 이 없는 대상을 지목하면 ADMIN_REQUIRED 가 아니라 MEMBER_NOT_FOUND 다', async () => {
      wireFindOne(null, { id: 'mem-req', role: 'editor' });

      await expect(
        service.removeMember(workspaceId, memberId, requesterId),
      ).rejects.toMatchObject({ response: { code: 'MEMBER_NOT_FOUND' } });
      expect(memberRepo.delete).not.toHaveBeenCalled();
      expect(getAudit().record).not.toHaveBeenCalled();
    });

    /**
     * **요청자 role 은 한 번만 읽는다.** 멤버십과 admin 을 같은 값으로 판정한다. admin 판정을
     * 형제처럼 `await this.assertAdmin(...)` 로 «정리» 하면 동작은 그대로이고 같은 쿼리만
     * 하나 는다 — 이 블록이 그 편집을 잡는다.
     *
     * 세는 단위는 **쿼리**다. `getMemberRole` 을 spy 로 세면 `findOne` 을 인라인하는 편집을
     * 놓친다. 기대값이 정확히 1이라 조회 키가 바뀌어 필터가 0건을 내도 공허하게 통과하지 않는다.
     *
     * 경로는 정상 제거다 — 판정 다섯 칸을 전부 지난다.
     */
    it('요청자 role 을 한 번만 조회한다', async () => {
      wireFindOne({ id: memberId, userId: 'target-user', role: 'editor' });
      memberRepo.delete.mockResolvedValue({ affected: 1 });

      await service.removeMember(workspaceId, memberId, requesterId);

      const requesterLookups = memberRepo.findOne.mock.calls.filter(
        (c: [{ where?: { userId?: string } }]) =>
          c[0]?.where?.userId === requesterId,
      );
      expect(requesterLookups).toHaveLength(1);
    });
  });
});
