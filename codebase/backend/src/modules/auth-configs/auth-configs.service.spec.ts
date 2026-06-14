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
import { AUDIT_ACTIONS } from '../audit-logs/audit-action.const';

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
const USER = 'user-1';

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
      const ac = await service.create(
        WS,
        {
          type: 'api_key',
        } as Partial<AuthConfig>,
        USER,
      );
      expect(ac.config.key).toMatch(/^wfk_[0-9a-f]{48}$/);
    });

    it('bearer_token: token=wft_<hex64> 자동 발급', async () => {
      const ac = await service.create(
        WS,
        {
          type: 'bearer_token',
        } as Partial<AuthConfig>,
        USER,
      );
      expect(ac.config.token).toMatch(/^wft_[0-9a-f]{64}$/);
    });

    it('hmac: secret=whs_<hex64> 자동 발급 + header/algorithm default', async () => {
      const ac = await service.create(
        WS,
        {
          type: 'hmac',
        } as Partial<AuthConfig>,
        USER,
      );
      expect(ac.config.secret).toMatch(/^whs_[0-9a-f]{64}$/);
      expect(ac.config.header).toBe('X-Hub-Signature-256');
      expect(ac.config.algorithm).toBe('sha256');
    });

    it('hmac: 사용자가 header/algorithm 지정 시 보존', async () => {
      const ac = await service.create(
        WS,
        {
          type: 'hmac',
          config: { header: 'Stripe-Signature', algorithm: 'sha512' },
        } as Partial<AuthConfig>,
        USER,
      );
      expect(ac.config.header).toBe('Stripe-Signature');
      expect(ac.config.algorithm).toBe('sha512');
      expect(ac.config.secret).toMatch(/^whs_/);
    });

    it('basic_auth: 자동 발급 없음 — username/password 보존', async () => {
      const ac = await service.create(
        WS,
        {
          type: 'basic_auth',
          config: { username: 'u', password: 'p' },
        } as Partial<AuthConfig>,
        USER,
      );
      expect(ac.config.username).toBe('u');
      expect(ac.config.password).toBe('p');
      expect(ac.config.key).toBeUndefined();
    });
  });

  describe('regenerate', () => {
    it('hmac: secret 만 교체, header/algorithm 보존', async () => {
      const ac = await service.create(
        WS,
        {
          type: 'hmac',
          config: { header: 'X-Sig', algorithm: 'sha512' },
        } as Partial<AuthConfig>,
        USER,
      );
      const oldSecret = ac.config.secret;
      const re = await service.regenerate(ac.id, WS, USER);
      expect(re.config.secret).not.toBe(oldSecret);
      expect(re.config.secret).toMatch(/^whs_/);
      expect(re.config.header).toBe('X-Sig');
      expect(re.config.algorithm).toBe('sha512');
    });

    it('api_key: key 교체', async () => {
      const ac = await service.create(
        WS,
        {
          type: 'api_key',
        } as Partial<AuthConfig>,
        USER,
      );
      const old = ac.config.key;
      const re = await service.regenerate(ac.id, WS, USER);
      expect(re.config.key).not.toBe(old);
      expect(re.config.key).toMatch(/^wfk_/);
    });
  });

  describe('CRUD audit 기록 (spec/5-system/1-auth.md §4.1)', () => {
    it('create → auth_config.create 기록 (resourceId·userId·ipAddress)', async () => {
      const ac = await service.create(
        WS,
        { type: 'api_key' } as Partial<AuthConfig>,
        USER,
        '1.2.3.4',
      );
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AUDIT_ACTIONS.AUTH_CONFIG_CREATE,
          resourceType: 'auth_config',
          resourceId: ac.id,
          workspaceId: WS,
          userId: USER,
          ipAddress: '1.2.3.4',
        }),
      );
    });

    it('create → ipAddress 미지정(trust proxy 미설정 시 req.ip=undefined) 시에도 기록', async () => {
      const ac = await service.create(
        WS,
        { type: 'api_key' } as Partial<AuthConfig>,
        USER,
      );
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AUDIT_ACTIONS.AUTH_CONFIG_CREATE,
          resourceType: 'auth_config',
          resourceId: ac.id,
          userId: USER,
          ipAddress: undefined,
        }),
      );
    });

    it('update → auth_config.update 기록', async () => {
      const ac = await service.create(
        WS,
        { type: 'api_key', name: 'a' } as Partial<AuthConfig>,
        USER,
      );
      audit.record.mockClear();
      await service.update(
        ac.id,
        WS,
        { name: 'b' } as Partial<AuthConfig>,
        USER,
        '1.2.3.4',
      );
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AUDIT_ACTIONS.AUTH_CONFIG_UPDATE,
          resourceType: 'auth_config',
          resourceId: ac.id,
          workspaceId: WS,
          userId: USER,
          ipAddress: '1.2.3.4',
        }),
      );
    });

    it('regenerate → auth_config.regenerate 기록', async () => {
      const ac = await service.create(
        WS,
        { type: 'api_key' } as Partial<AuthConfig>,
        USER,
      );
      audit.record.mockClear();
      await service.regenerate(ac.id, WS, USER, '1.2.3.4');
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AUDIT_ACTIONS.AUTH_CONFIG_REGENERATE,
          resourceType: 'auth_config',
          resourceId: ac.id,
          workspaceId: WS,
          userId: USER,
          ipAddress: '1.2.3.4',
        }),
      );
    });

    it('remove → auth_config.delete 기록 (삭제 후에도 resourceId 보존)', async () => {
      const ac = await service.create(
        WS,
        { type: 'api_key' } as Partial<AuthConfig>,
        USER,
      );
      audit.record.mockClear();
      await service.remove(ac.id, WS, USER, '1.2.3.4');
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AUDIT_ACTIONS.AUTH_CONFIG_DELETE,
          resourceType: 'auth_config',
          resourceId: ac.id,
          workspaceId: WS,
          userId: USER,
          ipAddress: '1.2.3.4',
        }),
      );
    });
  });

  describe('update — shallow-merge·비밀값 보호', () => {
    it('비-비밀 키만 shallow-merge — 기존 비밀값(key) 보존', async () => {
      const ac = await service.create(
        WS,
        { type: 'api_key', name: 'a' } as Partial<AuthConfig>,
        USER,
      );
      const originalKey = ac.config.key;
      await service.update(
        ac.id,
        WS,
        { config: { headerName: 'X-Tenant' } } as Partial<AuthConfig>,
        USER,
      );
      const stored = repo.store.get(ac.id)!;
      expect(stored.config.headerName).toBe('X-Tenant');
      expect(stored.config.key).toBe(originalKey); // 비밀값 미파손
    });

    it('secret 키 이름은 update 로 변경 불가 (마스킹값 역류 시에도 실 비밀 보존)', async () => {
      const ac = await service.create(
        WS,
        { type: 'api_key', name: 'a' } as Partial<AuthConfig>,
        USER,
      );
      const originalKey = ac.config.key as string;
      await service.update(
        ac.id,
        WS,
        {
          config: {
            headerName: 'X-Edit',
            key: `wfk_***${originalKey.slice(-4)}`,
          },
        } as Partial<AuthConfig>,
        USER,
      );
      const stored = repo.store.get(ac.id)!;
      expect(stored.config.key).toBe(originalKey); // 마스킹값으로 덮어쓰지 않음
      expect(stored.config.headerName).toBe('X-Edit');
    });

    it('config 미전달 시 기존 config 불변, top-level 필드만 갱신', async () => {
      const ac = await service.create(
        WS,
        { type: 'api_key', name: 'a' } as Partial<AuthConfig>,
        USER,
      );
      const originalConfig = { ...ac.config };
      await service.update(
        ac.id,
        WS,
        { ipWhitelist: ['10.0.0.0/8'] } as Partial<AuthConfig>,
        USER,
      );
      const stored = repo.store.get(ac.id)!;
      expect(stored.config).toEqual(originalConfig);
      expect(stored.ipWhitelist).toEqual(['10.0.0.0/8']);
    });

    it('ipWhitelist=[] 은 전체 비움으로 적용', async () => {
      const ac = await service.create(
        WS,
        {
          type: 'api_key',
          name: 'a',
          ipWhitelist: ['10.0.0.0/8'],
        } as Partial<AuthConfig>,
        USER,
      );
      await service.update(
        ac.id,
        WS,
        { ipWhitelist: [] } as Partial<AuthConfig>,
        USER,
      );
      expect(repo.store.get(ac.id)!.ipWhitelist).toEqual([]);
    });
  });

  describe('findByIdForResponse — 마스킹', () => {
    it('secret 류 필드만 ***<last4> 마스킹, 메타는 평문', async () => {
      const ac = await service.create(
        WS,
        {
          type: 'basic_auth',
          config: { username: 'alice', password: 'supersecret' },
        } as Partial<AuthConfig>,
        USER,
      );
      const masked = await service.findByIdForResponse(ac.id, WS);
      expect(masked.config.password).toBe('***cret');
      expect(masked.config.username).toBe('alice'); // 평문 유지
    });

    it('짧은 값(<4)은 *** 로만', async () => {
      const ac = await service.create(
        WS,
        {
          type: 'basic_auth',
          config: { username: 'u', password: 'ab' },
        } as Partial<AuthConfig>,
        USER,
      );
      const masked = await service.findByIdForResponse(ac.id, WS);
      expect(masked.config.password).toBe('***');
    });

    it('hmac header/algorithm 은 평문, secret 은 마스킹', async () => {
      const ac = await service.create(
        WS,
        {
          type: 'hmac',
        } as Partial<AuthConfig>,
        USER,
      );
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
      return service.create(
        WS,
        {
          type,
          config,
          ...extra,
        } as Partial<AuthConfig>,
        USER,
      );
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
    it('올바른 비밀번호 → 평문 config 반환 + audit 기록', async () => {
      const ac = await service.create(
        WS,
        {
          type: 'bearer_token',
        } as Partial<AuthConfig>,
        USER,
      );
      const plainToken = ac.config.token as string;
      userRepo.findOne.mockResolvedValue({
        id: USER,
        passwordHash: await bcrypt.hash('pw', 4),
      });

      const result = await service.reveal(ac.id, WS, USER, 'pw', '1.2.3.4');
      expect(result.config.token).toBe(plainToken); // 마스킹 없음
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AUDIT_ACTIONS.AUTH_CONFIG_REVEAL,
          resourceType: 'auth_config',
          resourceId: ac.id,
          workspaceId: WS,
          userId: USER,
          ipAddress: '1.2.3.4',
        }),
      );
    });

    it('잘못된 비밀번호 → 401, audit 미기록', async () => {
      const ac = await service.create(
        WS,
        {
          type: 'bearer_token',
        } as Partial<AuthConfig>,
        USER,
      );
      // create 단계의 auth_config.create 기록을 제거 — 이 테스트는 reveal 실패가
      // auth_config.reveal 을 기록하지 않음만 검증한다.
      audit.record.mockClear();
      userRepo.findOne.mockResolvedValue({
        id: USER,
        passwordHash: await bcrypt.hash('pw', 4),
      });
      await expect(
        service.reveal(ac.id, WS, USER, 'wrong', '1.2.3.4'),
      ).rejects.toThrow(UnauthorizedException);
      expect(audit.record).not.toHaveBeenCalled();
    });

    it('passwordHash 없음(OAuth-only) → 401', async () => {
      const ac = await service.create(
        WS,
        {
          type: 'bearer_token',
        } as Partial<AuthConfig>,
        USER,
      );
      // create 단계 기록을 제거 — reveal 실패가 auth_config.reveal 을 기록하지 않음 검증.
      audit.record.mockClear();
      userRepo.findOne.mockResolvedValue({ id: USER, passwordHash: null });
      await expect(
        service.reveal(ac.id, WS, USER, 'pw', '1.2.3.4'),
      ).rejects.toThrow(UnauthorizedException);
      expect(audit.record).not.toHaveBeenCalled();
    });
  });

  // §A.3 인증 사용량/이력 — 기간별 호출 수(롤링 윈도) + 호출 이력 소스 IP·응답 코드.
  describe('getUsage — 기간별 호출 수 + 소스 IP/응답 코드 (§A.3)', () => {
    const CFG_ID = 'cfg-usage';

    /** getCount / getRawOne / getMany 를 한 객체로 지원하는 체이너블 QB 목. */
    function makeExecutionRepo(opts: {
      totalCalls: number;
      period: { last24h: string; last7d: string; last30d: string } | null;
      recent: Array<Partial<Execution> & { trigger?: { name: string } }>;
    }) {
      const qb = {
        where: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        innerJoinAndSelect: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        setParameters: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(opts.totalCalls),
        getRawOne: jest.fn().mockResolvedValue(opts.period),
        getMany: jest.fn().mockResolvedValue(opts.recent),
      };
      return { qb, createQueryBuilder: jest.fn(() => qb) };
    }

    async function buildService(
      execRepo: ReturnType<typeof makeExecutionRepo>,
      triggerFind: jest.Mock,
    ) {
      const acRepo = makeAuthConfigRepo();
      await acRepo.save({
        id: CFG_ID,
        workspaceId: WS,
        name: 'webhook auth',
        type: 'hmac',
        lastUsedAt: new Date('2026-06-01T00:00:00.000Z'),
      } as AuthConfig);

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          AuthConfigsService,
          { provide: getRepositoryToken(AuthConfig), useValue: acRepo },
          { provide: getRepositoryToken(Execution), useValue: execRepo },
          {
            provide: getRepositoryToken(Trigger),
            useValue: { find: triggerFind },
          },
          {
            provide: getRepositoryToken(User),
            useValue: { findOne: jest.fn() },
          },
          { provide: AuditLogsService, useValue: { record: jest.fn() } },
        ],
      }).compile();
      return module.get(AuthConfigsService);
    }

    it('연결된 트리거가 없으면 totalCalls 0 + periodCounts 전부 0 + 빈 이력', async () => {
      const execRepo = makeExecutionRepo({
        totalCalls: 0,
        period: null,
        recent: [],
      });
      const svc = await buildService(execRepo, jest.fn().mockResolvedValue([]));

      const res = await svc.getUsage(CFG_ID, WS);

      expect(res.totalCalls).toBe(0);
      expect(res.periodCounts).toEqual({ last24h: 0, last7d: 0, last30d: 0 });
      expect(res.recentCalls).toEqual([]);
      // 트리거가 없으면 execution 쿼리 자체를 돌리지 않는다.
      expect(execRepo.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('기간별 호출 수를 숫자로 파싱하고, 이력에 소스 IP·응답 코드를 채운다', async () => {
      const execRepo = makeExecutionRepo({
        totalCalls: 7,
        period: { last24h: '2', last7d: '5', last30d: '7' },
        recent: [
          {
            id: 'e-webhook',
            status: 'completed',
            startedAt: new Date('2026-06-14T10:00:00.000Z'),
            sourceIp: '203.0.113.7',
            responseCode: '202',
            trigger: { name: 'Order Webhook' },
          },
          {
            id: 'e-schedule',
            status: 'failed',
            startedAt: new Date('2026-06-13T10:00:00.000Z'),
            sourceIp: null,
            responseCode: null,
            trigger: { name: 'Nightly' },
          },
        ],
      });
      const svc = await buildService(
        execRepo,
        jest.fn().mockResolvedValue([{ id: 't1' }, { id: 't2' }]),
      );

      const res = await svc.getUsage(CFG_ID, WS);

      expect(res.totalCalls).toBe(7);
      // getRawOne 의 문자열 카운트가 number 로 변환돼야 한다.
      expect(res.periodCounts).toEqual({ last24h: 2, last7d: 5, last30d: 7 });

      const [webhookCall, scheduleCall] = res.recentCalls;
      expect(webhookCall.sourceIp).toBe('203.0.113.7');
      expect(webhookCall.responseCode).toBe('202');
      // 비-HTTP 트리거: responseCode NULL → status enum 으로 폴백, sourceIp null.
      expect(scheduleCall.sourceIp).toBeNull();
      expect(scheduleCall.responseCode).toBe('failed');
    });

    it('getRawOne 가 null 을 반환해도 periodCounts 가 0 으로 안전하게 떨어진다', async () => {
      const execRepo = makeExecutionRepo({
        totalCalls: 1,
        period: null,
        recent: [],
      });
      const svc = await buildService(
        execRepo,
        jest.fn().mockResolvedValue([{ id: 't1' }]),
      );

      const res = await svc.getUsage(CFG_ID, WS);
      expect(res.periodCounts).toEqual({ last24h: 0, last7d: 0, last30d: 0 });
    });
  });
});
