/* eslint-disable @typescript-eslint/unbound-method */
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtStrategy } from './jwt.strategy';
import { UsersService } from '../../users/users.service';
import { WorkspacesService } from '../../workspaces/workspaces.service';

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

    const result = await strategy.validate(validPayload);

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
    usersService.findById.mockResolvedValue(null as never);

    await expect(strategy.validate(validPayload)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should throw UnauthorizedException when user email not verified', async () => {
    usersService.findById.mockResolvedValue({
      ...mockUser,
      emailVerified: false,
    } as never);

    await expect(strategy.validate(validPayload)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should throw UnauthorizedException when workspace not found', async () => {
    usersService.findById.mockResolvedValue(mockUser as never);
    workspacesService.findPersonalWorkspace.mockResolvedValue(null as never);

    await expect(strategy.validate(validPayload)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should default role to member when getMemberRole returns null', async () => {
    usersService.findById.mockResolvedValue(mockUser as never);
    workspacesService.findPersonalWorkspace.mockResolvedValue(
      mockWorkspace as never,
    );
    workspacesService.getMemberRole.mockResolvedValue(null as never);

    const result = await strategy.validate(validPayload);

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

    await expect(strategy.validate(validPayload)).rejects.toThrow(
      'DB connection error',
    );
  });
});
