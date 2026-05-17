import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';

describe('UsersService', () => {
  let service: UsersService;
  let repo: { findOne: jest.Mock };

  beforeEach(async () => {
    repo = { findOne: jest.fn() };
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
});
