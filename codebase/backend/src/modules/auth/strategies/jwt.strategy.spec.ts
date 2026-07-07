import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import type { Request } from 'express';
import { JwtStrategy } from './jwt.strategy';
import { UsersService } from '../../users/users.service';
import { WorkspacesService } from '../../workspaces/workspaces.service';

/** validate(req, payload) 용 최소 Request stub (헤더 override 가능). */
const reqWith = (headers: Record<string, string> = {}): Request =>
  ({ headers }) as unknown as Request;

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let usersService: jest.Mocked<UsersService>;
  let workspacesService: jest.Mocked<WorkspacesService>;

  const mockUser = {
    id: 'user-uuid-1',
    email: 'test@example.com',
    name: 'Test User',
    emailVerified: true,
  };

  const mockWorkspace = {
    id: 'workspace-uuid-1',
    name: 'Personal',
    type: 'personal',
  };

  const validPayload = { sub: 'user-uuid-1', email: 'test@example.com' };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('test-secret') },
        },
        {
          provide: UsersService,
          useValue: { findById: jest.fn() },
        },
        {
          provide: WorkspacesService,
          useValue: {
            findPersonalWorkspace: jest.fn(),
            getMemberRole: jest.fn(),
            listForUser: jest.fn().mockResolvedValue([]),
          },
        },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
    usersService = module.get(UsersService);
    workspacesService = module.get(WorkspacesService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return valid JwtPayload when user and workspace exist', async () => {
    usersService.findById.mockResolvedValue(mockUser as never);
    workspacesService.findPersonalWorkspace.mockResolvedValue(
      mockWorkspace as never,
    );
    workspacesService.getMemberRole.mockResolvedValue('owner');

    const result = await strategy.validate(reqWith(), validPayload);

    expect(result).toEqual({
      sub: 'user-uuid-1',
      email: 'test@example.com',
      workspaceId: 'workspace-uuid-1',
      role: 'owner',
    });
    expect(usersService.findById).toHaveBeenCalledWith('user-uuid-1');
    expect(workspacesService.findPersonalWorkspace).toHaveBeenCalledWith(
      'user-uuid-1',
    );
    expect(workspacesService.getMemberRole).toHaveBeenCalledWith(
      'workspace-uuid-1',
      'user-uuid-1',
    );
  });

  it('should throw UnauthorizedException when user not found', async () => {
    usersService.findById.mockResolvedValue(null);

    await expect(strategy.validate(reqWith(), validPayload)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should throw UnauthorizedException when user email not verified', async () => {
    usersService.findById.mockResolvedValue({
      ...mockUser,
      emailVerified: false,
    } as never);

    await expect(strategy.validate(reqWith(), validPayload)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should throw UnauthorizedException when workspace not found', async () => {
    usersService.findById.mockResolvedValue(mockUser as never);
    workspacesService.findPersonalWorkspace.mockResolvedValue(null);

    await expect(strategy.validate(reqWith(), validPayload)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should default role to member when getMemberRole returns null', async () => {
    usersService.findById.mockResolvedValue(mockUser as never);
    workspacesService.findPersonalWorkspace.mockResolvedValue(
      mockWorkspace as never,
    );
    workspacesService.getMemberRole.mockResolvedValue(null);

    const result = await strategy.validate(reqWith(), validPayload);

    expect(result.role).toBe('member');
  });

  it('should propagate error when getMemberRole throws', async () => {
    usersService.findById.mockResolvedValue(mockUser as never);
    workspacesService.findPersonalWorkspace.mockResolvedValue(
      mockWorkspace as never,
    );
    workspacesService.getMemberRole.mockRejectedValue(
      new Error('DB connection error'),
    );

    await expect(strategy.validate(reqWith(), validPayload)).rejects.toThrow(
      'DB connection error',
    );
  });

  // 결정1·2 (토큰 SoT + activeWorkspaceId dual-read):
  describe('활성 워크스페이스 클레임 존중 (결정1·2)', () => {
    it('honors activeWorkspaceId claim when the user is a member (no personal re-derive)', async () => {
      usersService.findById.mockResolvedValue(mockUser as never);
      workspacesService.getMemberRole.mockResolvedValue('admin');

      const result = await strategy.validate(reqWith(), {
        ...validPayload,
        activeWorkspaceId: 'team-ws-9',
      });

      expect(result).toEqual({
        sub: 'user-uuid-1',
        email: 'test@example.com',
        workspaceId: 'team-ws-9',
        role: 'admin',
      });
      expect(workspacesService.getMemberRole).toHaveBeenCalledWith(
        'team-ws-9',
        'user-uuid-1',
      );
      // 클레임이 유효하면 personal 재해석을 하지 않는다.
      expect(workspacesService.findPersonalWorkspace).not.toHaveBeenCalled();
    });

    it('dual-read: honors legacy workspaceId claim when activeWorkspaceId is absent', async () => {
      usersService.findById.mockResolvedValue(mockUser as never);
      workspacesService.getMemberRole.mockResolvedValue('editor');

      const result = await strategy.validate(reqWith(), {
        ...validPayload,
        workspaceId: 'legacy-ws-3',
      });

      expect(result.workspaceId).toBe('legacy-ws-3');
      expect(result.role).toBe('editor');
      expect(workspacesService.getMemberRole).toHaveBeenCalledWith(
        'legacy-ws-3',
        'user-uuid-1',
      );
    });

    it('rollout: X-Workspace-Id header overrides legacy workspaceId when no activeWorkspaceId', async () => {
      usersService.findById.mockResolvedValue(mockUser as never);
      workspacesService.getMemberRole.mockResolvedValue('viewer');

      const result = await strategy.validate(
        reqWith({ 'x-workspace-id': 'header-ws-7' }),
        { ...validPayload, workspaceId: 'legacy-ws-3' },
      );

      // 우선순위: activeWorkspaceId(없음) → 헤더(있음) → legacy workspaceId.
      expect(result.workspaceId).toBe('header-ws-7');
      expect(workspacesService.getMemberRole).toHaveBeenCalledWith(
        'header-ws-7',
        'user-uuid-1',
      );
    });

    it('activeWorkspaceId wins over both header and legacy workspaceId', async () => {
      usersService.findById.mockResolvedValue(mockUser as never);
      workspacesService.getMemberRole.mockResolvedValue('owner');

      const result = await strategy.validate(
        reqWith({ 'x-workspace-id': 'header-ws-7' }),
        {
          ...validPayload,
          activeWorkspaceId: 'active-ws-1',
          workspaceId: 'legacy-ws-3',
        },
      );

      expect(result.workspaceId).toBe('active-ws-1');
    });

    it('falls back to personal when claimed workspace membership is gone (graceful)', async () => {
      usersService.findById.mockResolvedValue(mockUser as never);
      // claimed workspace → 비멤버(null), personal → owner.
      workspacesService.getMemberRole
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce('owner');
      workspacesService.findPersonalWorkspace.mockResolvedValue(
        mockWorkspace as never,
      );

      const result = await strategy.validate(reqWith(), {
        ...validPayload,
        activeWorkspaceId: 'stale-ws',
      });

      expect(result.workspaceId).toBe('workspace-uuid-1');
      expect(result.role).toBe('owner');
      expect(workspacesService.findPersonalWorkspace).toHaveBeenCalled();
    });

    it('falls back to first membership when user has no personal workspace (invitation sign-up)', async () => {
      usersService.findById.mockResolvedValue(mockUser as never);
      workspacesService.getMemberRole.mockResolvedValue(null); // claimed 비멤버
      workspacesService.findPersonalWorkspace.mockResolvedValue(null);
      workspacesService.listForUser.mockResolvedValue([
        { id: 'team-first', role: 'editor' } as never,
      ]);

      const result = await strategy.validate(reqWith(), {
        ...validPayload,
        activeWorkspaceId: 'stale-ws',
      });

      expect(result.workspaceId).toBe('team-first');
      expect(result.role).toBe('editor');
    });
  });
});
