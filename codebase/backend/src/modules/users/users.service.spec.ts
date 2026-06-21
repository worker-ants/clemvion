import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';

/** createQueryBuilder 체인 mock 빌더 — emailTakenByOther 테스트용. */
function makeQb(count: number): unknown {
  const qb = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getCount: jest.fn().mockResolvedValue(count),
  };
  return qb;
}

describe('UsersService', () => {
  let service: UsersService;
  let repo: {
    findOne: jest.Mock;
    update: jest.Mock;
    findOneOrFail: jest.Mock;
    createQueryBuilder: jest.Mock;
  };

  beforeEach(async () => {
    repo = {
      findOne: jest.fn(),
      update: jest.fn(),
      findOneOrFail: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(makeQb(0)),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: repo },
      ],
    }).compile();
    service = module.get(UsersService);
  });

  describe('findByOauth', () => {
    it('returns the user matching (provider, providerId)', async () => {
      const user = { id: 'u-1', email: 'a@example.com' };
      repo.findOne.mockResolvedValue(user);
      const result = await service.findByOauth('google', 'g-42');
      expect(repo.findOne).toHaveBeenCalledWith({
        where: { oauthProvider: 'google', oauthProviderId: 'g-42' },
      });
      expect(result).toBe(user);
    });

    it('returns null when no user is bound to the provider identity', async () => {
      repo.findOne.mockResolvedValue(null);
      const result = await service.findByOauth('github', 'gh-1');
      expect(result).toBeNull();
    });
  });

  describe('changePassword (refactor 04 B-2 — SRP)', () => {
    const strongNewPassword = 'N3wP@ssw0rd!';

    async function userWithHash(): Promise<User> {
      return {
        id: 'user-uuid',
        email: 'test@example.com',
        passwordHash: await bcrypt.hash('OldP@ssw0rd1', 4),
      } as User;
    }

    it('verifies current password, hashes new password and persists it', async () => {
      const user = await userWithHash();
      repo.findOne.mockResolvedValue(user);
      repo.findOneOrFail.mockResolvedValue(user);

      await service.changePassword(
        'user-uuid',
        'OldP@ssw0rd1',
        strongNewPassword,
      );

      expect(repo.update).toHaveBeenCalledTimes(1);
      const [userId, patch] = repo.update.mock.calls[0];
      expect(userId).toBe('user-uuid');
      expect(patch.passwordHash).toBeDefined();
      expect(patch.passwordHash).not.toBe(user.passwordHash);
      await expect(
        bcrypt.compare(strongNewPassword, patch.passwordHash as string),
      ).resolves.toBe(true);
    });

    it('throws NotFoundException when user missing', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(
        service.changePassword('user-uuid', 'whatever', strongNewPassword),
      ).rejects.toThrow(NotFoundException);
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException for OAuth-only account (no passwordHash)', async () => {
      repo.findOne.mockResolvedValue({
        id: 'user-uuid',
        email: 'oauth@example.com',
        passwordHash: null,
      } as User);
      await expect(
        service.changePassword('user-uuid', 'anything', strongNewPassword),
      ).rejects.toThrow(UnauthorizedException);
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException when current password does not match', async () => {
      repo.findOne.mockResolvedValue(await userWithHash());
      await expect(
        service.changePassword('user-uuid', 'WrongPass1!', strongNewPassword),
      ).rejects.toThrow(UnauthorizedException);
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when new password violates strength policy', async () => {
      repo.findOne.mockResolvedValue(await userWithHash());
      await expect(
        service.changePassword('user-uuid', 'OldP@ssw0rd1', 'alllowercase'),
      ).rejects.toThrow(BadRequestException);
      expect(repo.update).not.toHaveBeenCalled();
    });
  });

  describe('emailTakenByOther (W3 — 이메일 변경 중복 검사)', () => {
    it('다른 계정이 동일 이메일(소문자) 사용 중 → true', async () => {
      repo.createQueryBuilder.mockReturnValue(makeQb(1));
      const result = await service.emailTakenByOther(
        'Taken@Example.com',
        'self-id',
      );
      expect(result).toBe(true);
    });

    it('이메일이 자신의 것이거나 없음 → false', async () => {
      repo.createQueryBuilder.mockReturnValue(makeQb(0));
      const result = await service.emailTakenByOther(
        'mine@example.com',
        'self-id',
      );
      expect(result).toBe(false);
    });

    it('QueryBuilder 가 LOWER + excludeUserId 조건을 모두 받는다', async () => {
      const qb = makeQb(0) as {
        where: jest.Mock;
        andWhere: jest.Mock;
        getCount: jest.Mock;
      };
      repo.createQueryBuilder.mockReturnValue(qb);

      await service.emailTakenByOther('target@example.com', 'excl-id');

      // LOWER(:email) 조건 — 대소문자 무시 검사
      expect(qb.where).toHaveBeenCalledWith(
        expect.stringContaining('LOWER'),
        expect.objectContaining({ email: 'target@example.com' }),
      );
      // 본인 제외 조건
      expect(qb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('!= :id'),
        expect.objectContaining({ id: 'excl-id' }),
      );
    });
  });
});
