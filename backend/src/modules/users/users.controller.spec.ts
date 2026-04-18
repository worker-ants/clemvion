import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
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
            update: jest.fn(),
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

  describe('updateMe', () => {
    it('should update name/locale/theme and return updated profile', async () => {
      const updatedUser = {
        ...mockUser,
        name: 'Renamed',
        locale: 'en',
        theme: 'dark',
      } as User;
      jest.spyOn(service, 'findById').mockResolvedValue(mockUser as User);
      jest.spyOn(service, 'update').mockResolvedValue(updatedUser);

      const result = await controller.updateMe(payload, {
        name: 'Renamed',
        locale: 'en',
        theme: 'dark',
      });

      expect(service.update).toHaveBeenCalledWith('user-uuid', {
        name: 'Renamed',
        locale: 'en',
        theme: 'dark',
      });
      expect(result).toEqual({
        data: {
          id: 'user-uuid',
          email: 'test@example.com',
          name: 'Renamed',
          avatarUrl: undefined,
          locale: 'en',
          theme: 'dark',
        },
      });
    });

    it('should not expose sensitive fields on update', async () => {
      jest.spyOn(service, 'findById').mockResolvedValue(mockUser as User);
      jest.spyOn(service, 'update').mockResolvedValue(mockUser as User);

      const result = await controller.updateMe(payload, { name: 'Who' });
      expect(result.data).not.toHaveProperty('passwordHash');
      expect(result.data).not.toHaveProperty('twoFactorSecret');
    });

    it('should throw NotFoundException when user missing', async () => {
      jest.spyOn(service, 'findById').mockResolvedValue(null);

      await expect(
        controller.updateMe(payload, { name: 'Nope' }),
      ).rejects.toThrow(NotFoundException);
      expect(service.update).not.toHaveBeenCalled();
    });

    it('should accept an empty patch as a no-op update', async () => {
      jest.spyOn(service, 'findById').mockResolvedValue(mockUser as User);
      jest.spyOn(service, 'update').mockResolvedValue(mockUser as User);

      await controller.updateMe(payload, {});
      expect(service.update).toHaveBeenCalledWith('user-uuid', {});
    });
  });

  describe('changePassword', () => {
    const strongNewPassword = 'N3wP@ssw0rd!';

    it('should hash and persist a new password when current password matches', async () => {
      const userWithHash = {
        ...mockUser,
        passwordHash: await bcrypt.hash('OldP@ssw0rd1', 4),
      } as User;
      jest.spyOn(service, 'findById').mockResolvedValue(userWithHash);
      const updateSpy = jest
        .spyOn(service, 'update')
        .mockResolvedValue(userWithHash);

      const result = await controller.changePassword(payload, {
        currentPassword: 'OldP@ssw0rd1',
        newPassword: strongNewPassword,
      });

      expect(updateSpy).toHaveBeenCalledTimes(1);
      const [userId, patch] = updateSpy.mock.calls[0] as [
        string,
        Partial<User>,
      ];
      expect(userId).toBe('user-uuid');
      expect(patch.passwordHash).toBeDefined();
      expect(patch.passwordHash).not.toBe(userWithHash.passwordHash);
      await expect(
        bcrypt.compare(strongNewPassword, patch.passwordHash as string),
      ).resolves.toBe(true);
      expect(result).toEqual({ data: { success: true } });
    });

    it('should reject when current password does not match', async () => {
      const userWithHash = {
        ...mockUser,
        passwordHash: await bcrypt.hash('OldP@ssw0rd1', 4),
      } as User;
      jest.spyOn(service, 'findById').mockResolvedValue(userWithHash);

      await expect(
        controller.changePassword(payload, {
          currentPassword: 'WrongPass1!',
          newPassword: strongNewPassword,
        }),
      ).rejects.toThrow(UnauthorizedException);
      expect(service.update).not.toHaveBeenCalled();
    });

    it('should reject new password that violates strength policy', async () => {
      const userWithHash = {
        ...mockUser,
        passwordHash: await bcrypt.hash('OldP@ssw0rd1', 4),
      } as User;
      jest.spyOn(service, 'findById').mockResolvedValue(userWithHash);

      await expect(
        controller.changePassword(payload, {
          currentPassword: 'OldP@ssw0rd1',
          newPassword: 'alllowercase',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(service.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when user missing', async () => {
      jest.spyOn(service, 'findById').mockResolvedValue(null);

      await expect(
        controller.changePassword(payload, {
          currentPassword: 'whatever',
          newPassword: strongNewPassword,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject when user has no password hash (OAuth-only account)', async () => {
      const userWithoutHash = {
        ...mockUser,
        passwordHash: null as unknown as string,
      } as User;
      jest.spyOn(service, 'findById').mockResolvedValue(userWithoutHash);

      await expect(
        controller.changePassword(payload, {
          currentPassword: 'anything',
          newPassword: strongNewPassword,
        }),
      ).rejects.toThrow(UnauthorizedException);
      expect(service.update).not.toHaveBeenCalled();
    });
  });
});
