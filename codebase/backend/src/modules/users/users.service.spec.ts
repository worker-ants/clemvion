import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { S3Service } from '../../common/services/s3.service';
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
        // 아바타 업로드(§6.1)로 생성자 의존이 늘었다. 이 스위트의 케이스들은 S3 를
        // 건드리지 않으므로 호출되면 **테스트가 시끄럽게 실패하도록** 던지는 stub 을 준다
        // — 조용한 no-op 을 주면 S3 를 부르는 회귀가 여기서 통과해 버린다.
        {
          provide: S3Service,
          useValue: {
            upload: jest.fn(() => {
              throw new Error('unexpected S3 upload in this suite');
            }),
            getPublicUrl: jest.fn(() => {
              throw new Error('unexpected S3 getPublicUrl in this suite');
            }),
            delete: jest.fn(() => {
              throw new Error('unexpected S3 delete in this suite');
            }),
          },
        },
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

    /**
     * OAuth-only 사용자 fixture — `passwordHash` 가 **없는** 계정.
     *
     * 캐스트가 필요한 이유: `User.passwordHash` 의 TS 타입은 `string`(non-null)인데
     * 컬럼은 `nullable: true` 이고 엔티티 자신의 `validatePasswordHashFormat` 이
     * `=== null` 을 검사한다 — 즉 **타입이 실제보다 좁다**. 엔티티 타입을
     * `string | null` 로 넓히는 것은 전 사용처에 파급되는 별개 작업이라, 여기서는
     * 캐스트를 **이 한 곳에** 모아 둔다 (종전에는 각 테스트가 따로 캐스트해
     * 타입 진단이 사이트마다 쌓였다).
     */
    function oauthOnlyUser(): User {
      return {
        id: 'user-uuid',
        email: 'oauth@example.com',
        passwordHash: null,
      } as unknown as User;
    }

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

    /**
     * 두 실패 분기가 **서로 다른 코드**를 내는지 본다. 종전 테스트는 예외 *클래스*
     * (`UnauthorizedException`)만 단언했는데 두 분기가 같은 클래스라 통과했고, 그래서
     * 둘이 같은 `INVALID_PASSWORD` 를 쓰던 drift 가 보이지 않았다.
     *
     * 단언은 상수가 아니라 **리터럴**로 쓴다 — 테스트와 소스가 같은 상수를 읽으면 값이
     * 통째로 바뀌어도 둘이 함께 움직여 아무것도 못 잡는다.
     */
    async function rejectionOf(
      promise: Promise<unknown>,
    ): Promise<UnauthorizedException> {
      let thrown: unknown;
      try {
        await promise;
      } catch (err) {
        thrown = err;
      }
      // 가드 단언은 catch **밖**에서 한다 — try 안에서 throw 하면 "reject 하지 않는"
      // 회귀가 났을 때 그 가드가 자기 catch 에 잡혀 무관한 메시지로 실패한다.
      expect(thrown).toBeInstanceOf(UnauthorizedException);
      return thrown as UnauthorizedException;
    }

    async function codeOf(promise: Promise<unknown>): Promise<string> {
      try {
        await promise;
      } catch (err) {
        const body = (err as UnauthorizedException).getResponse();
        return (body as { code: string }).code;
      }
      throw new Error('expected changePassword to reject');
    }

    it('OAuth-only 계정(passwordHash 부재)은 401 로 막고 저장하지 않는다', async () => {
      repo.findOne.mockResolvedValue(oauthOnlyUser());
      await expect(
        service.changePassword('user-uuid', 'anything', strongNewPassword),
      ).rejects.toThrow(UnauthorizedException);
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('OAuth-only 실패 코드는 형제 흐름과 같은 PASSWORD_REQUIRED 다', async () => {
      repo.findOne.mockResolvedValue(oauthOnlyUser());
      await expect(
        codeOf(
          service.changePassword('user-uuid', 'anything', strongNewPassword),
        ),
      ).resolves.toBe('PASSWORD_REQUIRED');
    });

    it('현재 비밀번호 불일치는 401 로 막고 저장하지 않는다', async () => {
      repo.findOne.mockResolvedValue(await userWithHash());
      await expect(
        service.changePassword('user-uuid', 'WrongPass1!', strongNewPassword),
      ).rejects.toThrow(UnauthorizedException);
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('불일치 실패 코드는 형제 흐름과 같은 PASSWORD_INVALID 다', async () => {
      repo.findOne.mockResolvedValue(await userWithHash());
      await expect(
        codeOf(
          service.changePassword('user-uuid', 'WrongPass1!', strongNewPassword),
        ),
      ).resolves.toBe('PASSWORD_INVALID');
    });

    it('[대조군] 두 실패 분기가 서로 다른 코드를 낸다', async () => {
      repo.findOne.mockResolvedValue(oauthOnlyUser());
      const notSet = await codeOf(
        service.changePassword('user-uuid', 'anything', strongNewPassword),
      );
      repo.findOne.mockResolvedValue(await userWithHash());
      const mismatch = await codeOf(
        service.changePassword('user-uuid', 'WrongPass1!', strongNewPassword),
      );
      expect(notSet).not.toBe(mismatch);
    });

    it('OAuth-only 메시지는 비밀번호 추가 경로를 안내한다', async () => {
      repo.findOne.mockResolvedValue(oauthOnlyUser());
      const err = await rejectionOf(
        service.changePassword('user-uuid', 'anything', strongNewPassword),
      );
      const body = err.getResponse() as { message: string };
      // 문구 전문이 아니라 "안내가 있다" 는 계약만 고정한다 — FE 가 서버 message 를
      // 그대로 노출하므로(실측) 이 안내의 존재 자체가 관측 가능한 계약이다.
      expect(body.message).toContain('재설정');
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
