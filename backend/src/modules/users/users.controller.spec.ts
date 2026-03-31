import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import type { JwtPayload } from '../../common/decorators';
import type { User } from './entities/user.entity';

describe('UsersController', () => {
  let controller: UsersController;
  let service: UsersService;

  const mockUser: Partial<User> = {
    id: 'user-uuid',
    email: 'test@example.com',
    name: 'Test User',
    avatarUrl: undefined,
    locale: 'ko',
    theme: 'light',
    passwordHash: 'hashed-secret',
    twoFactorSecret: 'totp-secret',
  };

  const payload: JwtPayload = {
    sub: 'user-uuid',
    email: 'test@example.com',
    workspaceId: 'ws-uuid',
    role: 'owner',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: {
            findById: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getMe', () => {
    it('should return current user profile', async () => {
      jest.spyOn(service, 'findById').mockResolvedValue(mockUser as User);

      const result = await controller.getMe(payload);
      expect(result).toEqual({
        data: {
          id: 'user-uuid',
          email: 'test@example.com',
          name: 'Test User',
          avatarUrl: undefined,
          locale: 'ko',
          theme: 'light',
        },
      });
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(service.findById).toHaveBeenCalledWith('user-uuid');
    });

    it('should not expose sensitive fields', async () => {
      jest.spyOn(service, 'findById').mockResolvedValue(mockUser as User);

      const result = await controller.getMe(payload);
      expect(result.data).not.toHaveProperty('passwordHash');
      expect(result.data).not.toHaveProperty('twoFactorSecret');
    });

    it('should throw NotFoundException when user not found', async () => {
      jest.spyOn(service, 'findById').mockResolvedValue(null);

      await expect(controller.getMe(payload)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should propagate service errors', async () => {
      jest
        .spyOn(service, 'findById')
        .mockRejectedValue(new Error('DB connection error'));

      await expect(controller.getMe(payload)).rejects.toThrow(
        'DB connection error',
      );
    });

    it('should apply default values for locale and theme', async () => {
      const userWithNulls: Partial<User> = {
        ...mockUser,
        locale: undefined as unknown as string,
        theme: undefined as unknown as string,
      };
      jest.spyOn(service, 'findById').mockResolvedValue(userWithNulls as User);

      const result = await controller.getMe(payload);
      expect(result.data.locale).toBe('ko');
      expect(result.data.theme).toBe('light');
    });
  });
});
