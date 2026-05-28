import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { AuthConfigsService } from './auth-configs.service';
import { AuthConfig } from './entities/auth-config.entity';
import { Execution } from '../executions/entities/execution.entity';
import { Trigger } from '../triggers/entities/trigger.entity';
import { User } from '../users/entities/user.entity';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

/** in-memory AuthConfig repo mock — save 가 들어온 객체를 그대로 반환. */
function makeAuthConfigRepo() {
  const store = new Map<string, AuthConfig>();
  return {
    store,
    // entity 의 isActive @Column({ default: true }) 를 mock 에서 재현 — DB insert 시
    // isActive 미지정이면 true 가 되므로, 테스트에서도 동일하게 기본 true 로 둔다.
    create: jest.fn(
      (data: Partial<AuthConfig>) =>
        ({ isActive: true, ...data }) as AuthConfig,
    ),
    save: jest.fn(async (ac: AuthConfig) => {
      if (!ac.id) ac.id = crypto.randomUUID();
      store.set(ac.id, ac);
      return ac;
    }),
    findOne: jest.fn(async ({ where }: { where: Partial<AuthConfig> }) => {
      for (const ac of store.values()) {
        if (
          ac.id === where.id &&
          (where.workspaceId === undefined ||
            ac.workspaceId === where.workspaceId)
        ) {
          return ac;
        }
      }
      return null;
    }),
    update: jest.fn(async () => ({ affected: 1 })),
    remove: jest.fn(async () => undefined),
  };
}

const WS = 'ws-1';

describe('AuthConfigsService', () => {
  let service: AuthConfigsService;
  let repo: ReturnType<typeof makeAuthConfigRepo>;
  let userRepo: { findOne: jest.Mock };
  let audit: { record: jest.Mock };

  beforeEach(async () => {
    repo = makeAuthConfigRepo();
    userRepo = { findOne: jest.fn() };
    audit = { record: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthConfigsService,
        { provide: getRepositoryToken(AuthConfig), useValue: repo },
        { provide: getRepositoryToken(Execution), useValue: {} },
        { provide: getRepositoryToken(Trigger), useValue: { find: jest.fn() } },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: AuditLogsService, useValue: audit },
      ],
    }).compile();

    service = module.get(AuthConfigsService);
  });

  describe('create — 자동 발급', () => {
    it('api_key: key=wfk_<hex48> 자동 발급', async () => {
      const ac = await service.create(WS, {
        type: 'api_key',
      } as Partial<AuthConfig>);
      expect(ac.config.key).toMatch(/^wfk_[0-9a-f]{48}$/);
    });

    it('bearer_token: token=wft_<hex64> 자동 발급', async () => {
      const ac = await service.create(WS, {
        type: 'bearer_token',
      } as Partial<AuthConfig>);
      expect(ac.config.token).toMatch(/^wft_[0-9a-f]{64}$/);
    });

    it('hmac: secret=whs_<hex64> 자동 발급 + header/algorithm default', async () => {
      const ac = await service.create(WS, {
        type: 'hmac',
      } as Partial<AuthConfig>);
      expect(ac.config.secret).toMatch(/^whs_[0-9a-f]{64}$/);
      expect(ac.config.header).toBe('X-Hub-Signature-256');
      expect(ac.config.algorithm).toBe('sha256');
    });

    it('hmac: 사용자가 header/algorithm 지정 시 보존', async () => {
      const ac = await service.create(WS, {
        type: 'hmac',
        config: { header: 'Stripe-Signature', algorithm: 'sha512' },
      } as Partial<AuthConfig>);
      expect(ac.config.header).toBe('Stripe-Signature');
      expect(ac.config.algorithm).toBe('sha512');
      expect(ac.config.secret).toMatch(/^whs_/);
    });

    it('basic_auth: 자동 발급 없음 — username/password 보존', async () => {
      const ac = await service.create(WS, {
        type: 'basic_auth',
        config: { username: 'u', password: 'p' },
      } as Partial<AuthConfig>);
      expect(ac.config.username).toBe('u');
      expect(ac.config.password).toBe('p');
      expect(ac.config.key).toBeUndefined();
    });
  });

  describe('regenerate', () => {
    it('hmac: secret 만 교체, header/algorithm 보존', async () => {
      const ac = await service.create(WS, {
        type: 'hmac',
        config: { header: 'X-Sig', algorithm: 'sha512' },
      } as Partial<AuthConfig>);
      const oldSecret = ac.config.secret;
      const re = await service.regenerate(ac.id, WS);
      expect(re.config.secret).not.toBe(oldSecret);
      expect(re.config.secret).toMatch(/^whs_/);
      expect(re.config.header).toBe('X-Sig');
      expect(re.config.algorithm).toBe('sha512');
    });

    it('api_key: key 교체', async () => {
      const ac = await service.create(WS, {
        type: 'api_key',
      } as Partial<AuthConfig>);
      const old = ac.config.key;
      const re = await service.regenerate(ac.id, WS);
      expect(re.config.key).not.toBe(old);
      expect(re.config.key).toMatch(/^wfk_/);
    });
  });

  describe('findByIdForResponse — 마스킹', () => {
    it('secret 류 필드만 ***<last4> 마스킹, 메타는 평문', async () => {
      const ac = await service.create(WS, {
        type: 'basic_auth',
        config: { username: 'alice', password: 'supersecret' },
      } as Partial<AuthConfig>);
      const masked = await service.findByIdForResponse(ac.id, WS);
      expect(masked.config.password).toBe('***cret');
      expect(masked.config.username).toBe('alice'); // 평문 유지
    });

    it('짧은 값(<4)은 *** 로만', async () => {
      const ac = await service.create(WS, {
        type: 'basic_auth',
        config: { username: 'u', password: 'ab' },
      } as Partial<AuthConfig>);
      const masked = await service.findByIdForResponse(ac.id, WS);
      expect(masked.config.password).toBe('***');
    });

    it('hmac header/algorithm 은 평문, secret 은 마스킹', async () => {
      const ac = await service.create(WS, {
        type: 'hmac',
      } as Partial<AuthConfig>);
      const masked = await service.findByIdForResponse(ac.id, WS);
      expect(masked.config.header).toBe('X-Hub-Signature-256');
      expect(masked.config.algorithm).toBe('sha256');
      expect(String(masked.config.secret).startsWith('***')).toBe(true);
    });
  });

  describe('verifyWebhookRequest', () => {
    async function seed(
      type: string,
      config: Record<string, unknown>,
      extra: Partial<AuthConfig> = {},
    ) {
      return service.create(WS, {
        type,
        config,
        ...extra,
      } as Partial<AuthConfig>);
    }

    it('bearer_token: 올바른 토큰 → 통과 + lastUsedAt 갱신', async () => {
      const ac = await seed('bearer_token', {});
      const token = ac.config.token as string; // 자동 발급된 값
      await expect(
        service.verifyWebhookRequest(ac.id, WS, {
          headers: { authorization: `Bearer ${token}` },
        }),
      ).resolves.toBeUndefined();
      expect(repo.update).toHaveBeenCalledWith(
        { id: ac.id },
        expect.objectContaining({ lastUsedAt: expect.any(Date) }),
      );
    });

    it('bearer_token: 잘못된 토큰 → 401 AUTH_FAILED, lastUsedAt 미갱신', async () => {
      const ac = await seed('bearer_token', { token: 'tok-abc' });
      await expect(
        service.verifyWebhookRequest(ac.id, WS, {
          headers: { authorization: 'Bearer wrong' },
        }),
      ).rejects.toThrow(UnauthorizedException);
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('isActive=false → 401', async () => {
      const ac = await seed(
        'bearer_token',
        { token: 'tok-abc' },
        { isActive: false },
      );
      await expect(
        service.verifyWebhookRequest(ac.id, WS, {
          headers: { authorization: 'Bearer tok-abc' },
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('api_key: 기본 X-API-Key 헤더 검증', async () => {
      const ac = await seed('api_key', {});
      const key = ac.config.key as string;
      await expect(
        service.verifyWebhookRequest(ac.id, WS, {
          headers: { 'x-api-key': key },
        }),
      ).resolves.toBeUndefined();
    });

    it('api_key: headerName 커스텀 헤더 검증', async () => {
      const ac = await seed('api_key', { headerName: 'X-My-Key' });
      const key = ac.config.key as string;
      await expect(
        service.verifyWebhookRequest(ac.id, WS, {
          headers: { 'x-my-key': key },
        }),
      ).resolves.toBeUndefined();
    });

    it('basic_auth: Authorization Basic base64 검증', async () => {
      const ac = await seed('basic_auth', { username: 'u', password: 'p' });
      const b64 = Buffer.from('u:p').toString('base64');
      await expect(
        service.verifyWebhookRequest(ac.id, WS, {
          headers: { authorization: `Basic ${b64}` },
        }),
      ).resolves.toBeUndefined();
    });

    it('basic_auth: 잘못된 비밀번호 → 401', async () => {
      const ac = await seed('basic_auth', { username: 'u', password: 'p' });
      const b64 = Buffer.from('u:wrong').toString('base64');
      await expect(
        service.verifyWebhookRequest(ac.id, WS, {
          headers: { authorization: `Basic ${b64}` },
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('hmac: 올바른 서명 → 통과', async () => {
      const ac = await seed('hmac', {
        header: 'X-Hub-Signature-256',
        algorithm: 'sha256',
      });
      const secret = ac.config.secret as string; // 자동 발급된 값
      const rawBody = Buffer.from('{"a":1}');
      const sig = `sha256=${crypto.createHmac('sha256', secret).update(rawBody).digest('hex')}`;
      await expect(
        service.verifyWebhookRequest(ac.id, WS, {
          headers: { 'x-hub-signature-256': sig },
          rawBody,
        }),
      ).resolves.toBeUndefined();
    });

    it('hmac: 잘못된 서명 → 401', async () => {
      const ac = await seed('hmac', {
        secret: 'whs_test',
        header: 'X-Hub-Signature-256',
        algorithm: 'sha256',
      });
      await expect(
        service.verifyWebhookRequest(ac.id, WS, {
          headers: { 'x-hub-signature-256': 'sha256=deadbeef' },
          rawBody: Buffer.from('{"a":1}'),
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('hmac: 허용 목록 밖 algorithm → 401', async () => {
      const ac = await seed('hmac', {
        secret: 'whs_test',
        header: 'X-Hub-Signature-256',
        algorithm: 'md5',
      });
      await expect(
        service.verifyWebhookRequest(ac.id, WS, {
          headers: { 'x-hub-signature-256': 'md5=abc' },
          rawBody: Buffer.from('x'),
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('ip_whitelist: 미허용 IP → 401', async () => {
      const ac = await seed(
        'bearer_token',
        { token: 't' },
        {
          ipWhitelist: ['10.0.0.1'],
        },
      );
      await expect(
        service.verifyWebhookRequest(ac.id, WS, {
          headers: { authorization: 'Bearer t' },
          clientIp: '203.0.113.9',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('ip_whitelist: 허용 IP → 통과', async () => {
      const ac = await seed(
        'bearer_token',
        {},
        {
          ipWhitelist: ['10.0.0.1'],
        },
      );
      const token = ac.config.token as string;
      await expect(
        service.verifyWebhookRequest(ac.id, WS, {
          headers: { authorization: `Bearer ${token}` },
          clientIp: '10.0.0.1',
        }),
      ).resolves.toBeUndefined();
    });

    it('ip_whitelist: 설정됐는데 clientIp 불명 → 401 (fail-closed)', async () => {
      const ac = await seed(
        'bearer_token',
        {},
        {
          ipWhitelist: ['10.0.0.1'],
        },
      );
      const token = ac.config.token as string;
      await expect(
        service.verifyWebhookRequest(ac.id, WS, {
          headers: { authorization: `Bearer ${token}` },
          // clientIp 미지정 — whitelist 설정 시 거부돼야 함
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('ip_whitelist: CIDR 범위 내 IP → 통과', async () => {
      const ac = await seed(
        'bearer_token',
        {},
        { ipWhitelist: ['10.0.0.0/8'] },
      );
      const token = ac.config.token as string;
      await expect(
        service.verifyWebhookRequest(ac.id, WS, {
          headers: { authorization: `Bearer ${token}` },
          clientIp: '10.5.6.7',
        }),
      ).resolves.toBeUndefined();
    });

    it('ip_whitelist: CIDR 범위 밖 IP → 401', async () => {
      const ac = await seed(
        'bearer_token',
        {},
        { ipWhitelist: ['10.0.0.0/8'] },
      );
      const token = ac.config.token as string;
      await expect(
        service.verifyWebhookRequest(ac.id, WS, {
          headers: { authorization: `Bearer ${token}` },
          clientIp: '11.0.0.1',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('ip_whitelist: IPv6 CIDR 범위 내 IP → 통과', async () => {
      const ac = await seed(
        'bearer_token',
        {},
        { ipWhitelist: ['2001:db8::/32'] },
      );
      const token = ac.config.token as string;
      await expect(
        service.verifyWebhookRequest(ac.id, WS, {
          headers: { authorization: `Bearer ${token}` },
          clientIp: '2001:db8::1',
        }),
      ).resolves.toBeUndefined();
    });

    it('ip_whitelist: IPv4-mapped IPv6 클라이언트 IP → v4 항목과 매칭 통과', async () => {
      const ac = await seed(
        'bearer_token',
        {},
        { ipWhitelist: ['10.0.0.0/8'] },
      );
      const token = ac.config.token as string;
      await expect(
        service.verifyWebhookRequest(ac.id, WS, {
          headers: { authorization: `Bearer ${token}` },
          clientIp: '::ffff:10.5.6.7',
        }),
      ).resolves.toBeUndefined();
    });

    it('ip_whitelist: 파싱 불가한 clientIp → 401 (fail-closed)', async () => {
      const ac = await seed(
        'bearer_token',
        {},
        { ipWhitelist: ['10.0.0.0/8'] },
      );
      const token = ac.config.token as string;
      await expect(
        service.verifyWebhookRequest(ac.id, WS, {
          headers: { authorization: `Bearer ${token}` },
          clientIp: 'not-an-ip',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('ip_whitelist: 주소 패밀리 불일치 (v4 클라이언트 vs v6 항목) → 401', async () => {
      const ac = await seed(
        'bearer_token',
        {},
        { ipWhitelist: ['2001:db8::/32'] },
      );
      const token = ac.config.token as string;
      await expect(
        service.verifyWebhookRequest(ac.id, WS, {
          headers: { authorization: `Bearer ${token}` },
          clientIp: '10.5.6.7',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('authConfigId 미존재 → 401', async () => {
      await expect(
        service.verifyWebhookRequest(crypto.randomUUID(), WS, { headers: {} }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('reveal', () => {
    const userId = 'user-1';

    it('올바른 비밀번호 → 평문 config 반환 + audit 기록', async () => {
      const ac = await service.create(WS, {
        type: 'bearer_token',
      } as Partial<AuthConfig>);
      const plainToken = ac.config.token as string;
      userRepo.findOne.mockResolvedValue({
        id: userId,
        passwordHash: await bcrypt.hash('pw', 4),
      });

      const result = await service.reveal(ac.id, WS, userId, 'pw', '1.2.3.4');
      expect(result.config.token).toBe(plainToken); // 마스킹 없음
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'auth_config.reveal',
          resourceType: 'auth_config',
          resourceId: ac.id,
          workspaceId: WS,
          userId,
        }),
      );
    });

    it('잘못된 비밀번호 → 401, audit 미기록', async () => {
      const ac = await service.create(WS, {
        type: 'bearer_token',
      } as Partial<AuthConfig>);
      userRepo.findOne.mockResolvedValue({
        id: userId,
        passwordHash: await bcrypt.hash('pw', 4),
      });
      await expect(
        service.reveal(ac.id, WS, userId, 'wrong', '1.2.3.4'),
      ).rejects.toThrow(UnauthorizedException);
      expect(audit.record).not.toHaveBeenCalled();
    });

    it('passwordHash 없음(OAuth-only) → 401', async () => {
      const ac = await service.create(WS, {
        type: 'bearer_token',
      } as Partial<AuthConfig>);
      userRepo.findOne.mockResolvedValue({ id: userId, passwordHash: null });
      await expect(
        service.reveal(ac.id, WS, userId, 'pw', '1.2.3.4'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
