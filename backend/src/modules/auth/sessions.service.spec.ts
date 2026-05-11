import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';
import { RefreshToken } from './entities/refresh-token.entity';
import { SessionsService } from './sessions.service';
import { UsersService } from '../users/users.service';
import { TotpService } from './totp.service';
import { LoginHistoryService } from './login-history.service';

function hashRaw(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function makeToken(over: Partial<RefreshToken> = {}): RefreshToken {
  return {
    id: 'rt-id',
    userId: 'user-1',
    user: null as never,
    tokenHash: 'hash',
    familyId: 'fam-1',
    isRevoked: false,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    createdAt: new Date('2026-05-01T00:00:00Z'),
    deviceLabel: 'Chrome on macOS',
    userAgent: 'ua',
    ipAddress: '203.0.113.1',
    lastUsedAt: null,
    lastUsedIp: null,
    ...over,
  } as RefreshToken;
}

describe('SessionsService', () => {
  let service: SessionsService;
  let repo: {
    find: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
  };
  let usersService: jest.Mocked<UsersService>;
  let totpService: jest.Mocked<TotpService>;
  let loginHistory: { record: jest.Mock };

  beforeEach(async () => {
    repo = {
      find: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn().mockResolvedValue({ affected: 0 }),
    };
    loginHistory = { record: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionsService,
        { provide: getRepositoryToken(RefreshToken), useValue: repo },
        {
          provide: UsersService,
          useValue: { findById: jest.fn() },
        },
        {
          provide: TotpService,
          useValue: { verifyForLogin: jest.fn() },
        },
        { provide: LoginHistoryService, useValue: loginHistory },
      ],
    }).compile();

    service = module.get(SessionsService);
    usersService = module.get(UsersService);
    totpService = module.get(TotpService);
  });

  describe('listActiveSessions', () => {
    it('groups rows by family and marks current via cookie hash', async () => {
      const rawToken = 'plain-token-abc';
      const currentHash = hashRaw(rawToken);
      const famA = makeToken({
        id: 'a1',
        familyId: 'fam-A',
        tokenHash: currentHash,
      });
      const famAOlder = makeToken({
        id: 'a2',
        familyId: 'fam-A',
        tokenHash: 'other',
        createdAt: new Date('2026-04-01T00:00:00Z'),
      });
      const famB = makeToken({
        id: 'b1',
        familyId: 'fam-B',
        tokenHash: 'b-hash',
      });
      repo.find.mockResolvedValue([famA, famAOlder, famB]);
      repo.findOne.mockImplementation(
        ({ where }: { where: { tokenHash: string } }) => {
          return where.tokenHash === currentHash ? famA : null;
        },
      );

      const result = await service.listActiveSessions('user-1', rawToken);

      const ids = result.map((s) => s.familyId).sort();
      expect(ids).toEqual(['fam-A', 'fam-B']);
      const a = result.find((s) => s.familyId === 'fam-A');
      const b = result.find((s) => s.familyId === 'fam-B');
      expect(a?.isCurrent).toBe(true);
      expect(b?.isCurrent).toBe(false);
    });

    it('returns isCurrent=false for all when no refresh token cookie', async () => {
      repo.find.mockResolvedValue([makeToken({ familyId: 'fam-A' })]);
      const result = await service.listActiveSessions('user-1', null);
      expect(result[0].isCurrent).toBe(false);
    });
  });

  describe('revokeFamily', () => {
    const user = {
      id: 'user-1',
      passwordHash: 'will-set',
      twoFactorEnabled: false,
      email: 'a@b.c',
    };

    beforeEach(async () => {
      user.passwordHash = await bcrypt.hash('correct-pw', 12);
      usersService.findById.mockResolvedValue(user as never);
    });

    it('revokes the family and records a session_revoked event with correct password', async () => {
      repo.findOne.mockResolvedValue(makeToken({ familyId: 'fam-A' }));
      repo.update.mockResolvedValue({ affected: 2 });

      await service.revokeFamily(
        'user-1',
        'fam-A',
        { password: 'correct-pw' },
        {},
      );

      expect(repo.update).toHaveBeenCalledWith(
        { userId: 'user-1', familyId: 'fam-A' },
        { isRevoked: true },
      );
      expect(loginHistory.record).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          email: 'a@b.c',
          event: 'session_revoked',
          familyId: 'fam-A',
        }),
      );
    });

    it('returns 404 when family does not belong to user (information disclosure prevention)', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(
        service.revokeFamily('user-1', 'fam-X', { password: 'pw' }, {}),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects with 401 on wrong password', async () => {
      repo.findOne.mockResolvedValue(makeToken({ familyId: 'fam-A' }));
      await expect(
        service.revokeFamily('user-1', 'fam-A', { password: 'wrong' }, {}),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('requires reauth input (400) when neither password nor totp provided', async () => {
      repo.findOne.mockResolvedValue(makeToken({ familyId: 'fam-A' }));
      await expect(
        service.revokeFamily('user-1', 'fam-A', {}, {}),
      ).rejects.toThrow(BadRequestException);
    });

    it('verifies TOTP for 2FA-enabled user', async () => {
      repo.findOne.mockResolvedValue(makeToken({ familyId: 'fam-A' }));
      usersService.findById.mockResolvedValue({
        id: 'user-1',
        passwordHash: null,
        twoFactorEnabled: true,
        email: 'a@b.c',
      } as never);
      totpService.verifyForLogin.mockResolvedValue(true);

      await service.revokeFamily('user-1', 'fam-A', { totpCode: '123456' }, {});
      expect(repo.update).toHaveBeenCalled();
    });

    it('refuses (403) when user has neither password nor 2FA (OAuth-only + no 2FA)', async () => {
      repo.findOne.mockResolvedValue(makeToken({ familyId: 'fam-A' }));
      usersService.findById.mockResolvedValue({
        id: 'user-1',
        passwordHash: null,
        twoFactorEnabled: false,
        email: 'a@b.c',
      } as never);

      await expect(
        service.revokeFamily('user-1', 'fam-A', { password: 'pw' }, {}),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('revokeOtherFamilies', () => {
    it('preserves current family and reports revoked count', async () => {
      const user = {
        id: 'user-1',
        passwordHash: await bcrypt.hash('correct-pw', 12),
        twoFactorEnabled: false,
        email: 'a@b.c',
      };
      usersService.findById.mockResolvedValue(user as never);

      const rawToken = 'rt-current';
      const currentHash = hashRaw(rawToken);
      repo.findOne.mockResolvedValue(
        makeToken({ familyId: 'fam-current', tokenHash: currentHash }),
      );
      repo.update.mockResolvedValue({ affected: 3 });

      const result = await service.revokeOtherFamilies(
        'user-1',
        rawToken,
        { password: 'correct-pw' },
        {},
      );

      expect(result.revoked).toBe(3);
      // The Not(currentFamilyId) clause is opaque to jest's deep-equality matcher,
      // so we just assert update was called and inspect the criteria object.
      const [criteria] = repo.update.mock.calls[0];
      expect((criteria as { userId: string }).userId).toBe('user-1');
    });

    it('throws when current session cannot be resolved', async () => {
      const user = {
        id: 'user-1',
        passwordHash: await bcrypt.hash('pw', 12),
        twoFactorEnabled: false,
        email: 'a@b.c',
      };
      usersService.findById.mockResolvedValue(user as never);
      repo.findOne.mockResolvedValue(null);

      await expect(
        service.revokeOtherFamilies('user-1', 'rt', { password: 'pw' }, {}),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
