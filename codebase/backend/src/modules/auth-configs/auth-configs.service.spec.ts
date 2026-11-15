import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DeleteResult } from 'typeorm';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { AuthConfigsService } from './auth-configs.service';
import { AuthConfig } from './entities/auth-config.entity';
import { UpdateAuthConfigDto } from './dto/update-auth-config.dto';
import { Execution } from '../executions/entities/execution.entity';
import { Trigger } from '../triggers/entities/trigger.entity';
import { User } from '../users/entities/user.entity';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AUDIT_ACTIONS } from '../audit-logs/audit-action.const';
import { encryptedJsonTransformer } from '../integrations/services/credentials-transformer';

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
    // 동시 삭제 판별자 — 기본은 «한 행을 지웠다». 진 쪽·드라이버 미보고는 테스트가 덮어쓴다.
    // 반환 타입을 `DeleteResult` 로 **명시**해야 `mockResolvedValueOnce` 의 파라미터 타입이
    // 추론된 리터럴(`{affected: number; raw: never[]}`)로 좁혀지지 않는다 — 좁혀지면 대조군의
    // `affected: null|undefined` 를 캐스트해도 받지 못한다(타입체크 ratchet 이 실측으로 잡았다).
    delete: jest.fn(async ({ id }: { id: string }): Promise<DeleteResult> => {
      const existed = store.delete(id);
      return { affected: existed ? 1 : 0, raw: [] };
    }),
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

  /** 400 `VALIDATION_ERROR` 로 거부됐는지 확인하고 `details[].field` 목록을 돌려준다. */
  async function rejectedFields(pending: Promise<unknown>): Promise<string[]> {
    const err: unknown = await pending.then(
      () => {
        throw new Error('거부되지 않았다');
      },
      (err_: unknown) => err_,
    );
    expect(err).toBeInstanceOf(BadRequestException);
    const body = (err as BadRequestException).getResponse() as {
      code: string;
      details: { field: string; message: string; code: string }[];
    };
    expect(body.code).toBe('VALIDATION_ERROR');
    for (const d of body.details) {
      expect(d.code).toBe('INVALID_FIELD');
      expect(d.message).toEqual(expect.any(String));
    }
    return body.details.map((d) => d.field);
  }

  describe('Basic Auth 빈 값 — 생성 · 편집 PATCH 를 400 으로 거부 (REQ-AUTHCFG-027 · 028)', () => {
    function createBasic(config: unknown) {
      return service.create(
        WS,
        { type: 'basic_auth', name: 'b', config } as Partial<AuthConfig>,
        USER,
      );
    }

    it.each<[string, unknown, string[]]>([
      ['config 없음', undefined, ['config.username', 'config.password']],
      [
        'username · password 둘 다 빈 문자열',
        { username: '', password: '' },
        ['config.username', 'config.password'],
      ],
      [
        'username 만 빈 문자열',
        { username: '', password: 'p' },
        ['config.username'],
      ],
      [
        'password 만 빈 문자열',
        { username: 'u', password: '' },
        ['config.password'],
      ],
      ['password 없음', { username: 'u' }, ['config.password']],
      [
        'username 이 문자열이 아님',
        { username: 123, password: 'p' },
        ['config.username'],
      ],
      [
        'password 가 null',
        { username: 'u', password: null },
        ['config.password'],
      ],
    ])(
      '생성: %s → 400, 저장 · 감사 기록 없음',
      async (_label, config, fields) => {
        await expect(rejectedFields(createBasic(config))).resolves.toEqual(
          fields,
        );
        expect(repo.save).not.toHaveBeenCalled();
        expect(audit.record).not.toHaveBeenCalled();
      },
    );

    it('생성: 공백만 있는 값은 받는다 (웹훅 인증이 같은 값을 보낸 요청을 통과시킨다)', async () => {
      const ac = await createBasic({ username: ' ', password: ' ' });
      expect(repo.store.get(ac.id)?.config).toEqual({
        username: ' ',
        password: ' ',
      });
    });

    async function seedBasic(config: Record<string, unknown>) {
      const ac = await createBasic({ username: 'u', password: 'p' });
      repo.store.get(ac.id)!.config = config;
      repo.save.mockClear();
      audit.record.mockClear();
      return ac.id;
    }

    it.each<[string, unknown]>([
      ['빈 문자열', ''],
      ['null', null],
      ['문자열이 아닌 값', 42],
    ])(
      '편집: config.username 이 %s → 400 · 아무것도 바꾸지 않는다',
      async (_label, username) => {
        const id = await seedBasic({ username: 'u', password: 'p' });
        await expect(
          rejectedFields(
            service.update(
              id,
              WS,
              { name: 'renamed', config: { username } } as Partial<AuthConfig>,
              USER,
            ),
          ),
        ).resolves.toEqual(['config.username']);
        expect(repo.save).not.toHaveBeenCalled();
        expect(audit.record).not.toHaveBeenCalled();
        const stored = repo.store.get(id)!;
        expect(stored.name).toBe('b');
        expect(stored.config).toEqual({ username: 'u', password: 'p' });
      },
    );

    it('편집: 올바른 config.username 은 바꾼다', async () => {
      const id = await seedBasic({ username: 'u', password: 'p' });
      await service.update(
        id,
        WS,
        { config: { username: 'next' } } as Partial<AuthConfig>,
        USER,
      );
      expect(repo.store.get(id)!.config).toEqual({
        username: 'next',
        password: 'p',
      });
    });

    it('편집: password 는 빈 값이어도 무시하고 거부하지 않는다', async () => {
      const id = await seedBasic({ username: 'u', password: 'p' });
      await service.update(
        id,
        WS,
        { config: { password: '' } } as Partial<AuthConfig>,
        USER,
      );
      expect(repo.store.get(id)!.config).toEqual({
        username: 'u',
        password: 'p',
      });
    });

    it.each(['api_key', 'bearer_token', 'hmac'] as const)(
      '편집: %s 설정은 config.username 을 검사하지 않는다 (판정은 basic_auth 에만 걸린다)',
      async (type) => {
        const ac = await service.create(
          WS,
          { type, name: 'n' } as Partial<AuthConfig>,
          USER,
        );
        await expect(
          service.update(
            ac.id,
            WS,
            { config: { username: '' } } as Partial<AuthConfig>,
            USER,
          ),
        ).resolves.toBeDefined();
        expect(repo.store.get(ac.id)!.config.username).toBe('');
      },
    );

    it('편집: config.username 을 싣지 않으면 빈 값으로 저장된 옛 설정도 고칠 수 있다', async () => {
      const id = await seedBasic({ username: '', password: '' });
      await service.update(
        id,
        WS,
        { name: 'renamed', config: {} } as Partial<AuthConfig>,
        USER,
      );
      const stored = repo.store.get(id)!;
      expect(stored.name).toBe('renamed');
      expect(stored.config).toEqual({ username: '', password: '' });
    });
  });

  // `__` 로 시작하는 키는 복호화하지 못한 설정의 표식(`__unreadable` · `__original_ciphertext`)이 쓰는
  // 이름이다. 사용자가 이 키를 넣으면 저장할 때 표식으로 읽혀 입력이 버려지거나(원래 암호문 재사용),
  // 읽을 때 표식으로 오인된다. 생성 · 편집 모두 400 으로 거부한다.
  describe('`__` 로 시작하는 config 키 — 생성 · 편집 PATCH 를 400 으로 거부 (REQ-AUTHCFG-032)', () => {
    it.each<[string, Record<string, unknown>, string[]]>([
      ['__unreadable', { __unreadable: true }, ['config.__unreadable']],
      [
        '__original_ciphertext',
        { __original_ciphertext: 'enc:v1:AAAA' },
        ['config.__original_ciphertext'],
      ],
      [
        '임의의 __ 키 두 개',
        { __a: 1, headerName: 'X-K', __b: 'x' },
        ['config.__a', 'config.__b'],
      ],
    ])('생성: %s → 400 · 저장 · 감사 없음', async (_label, config, fields) => {
      await expect(
        rejectedFields(
          service.create(
            WS,
            { type: 'api_key', name: 'n', config } as Partial<AuthConfig>,
            USER,
          ),
        ),
      ).resolves.toEqual(fields);
      expect(repo.save).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
    });

    it('생성: basic_auth 의 빈 값과 `__` 키를 한 응답에 모은다', async () => {
      await expect(
        rejectedFields(
          service.create(
            WS,
            {
              type: 'basic_auth',
              name: 'b',
              config: { username: 'u', __unreadable: true },
            } as Partial<AuthConfig>,
            USER,
          ),
        ),
      ).resolves.toEqual(['config.password', 'config.__unreadable']);
    });

    it('생성: `_` 하나로 시작하는 키는 받는다', async () => {
      const ac = await service.create(
        WS,
        {
          type: 'api_key',
          name: 'n',
          config: { _note: 'x' },
        } as Partial<AuthConfig>,
        USER,
      );
      expect(repo.store.get(ac.id)!.config._note).toBe('x');
    });

    it('편집: `__` 키 → 400 · 아무것도 바꾸지 않는다', async () => {
      const ac = await service.create(
        WS,
        { type: 'api_key', name: 'n' } as Partial<AuthConfig>,
        USER,
      );
      const before = { ...repo.store.get(ac.id)!.config };
      repo.save.mockClear();
      audit.record.mockClear();
      await expect(
        rejectedFields(
          service.update(
            ac.id,
            WS,
            {
              name: 'renamed',
              config: { __unreadable: true },
            } as Partial<AuthConfig>,
            USER,
          ),
        ),
      ).resolves.toEqual(['config.__unreadable']);
      expect(repo.save).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
      expect(repo.store.get(ac.id)!.name).toBe('n');
      expect(repo.store.get(ac.id)!.config).toEqual(before);
    });

    it('편집: basic_auth 의 빈 username 과 `__` 키를 한 응답에 모은다', async () => {
      const ac = await service.create(
        WS,
        {
          type: 'basic_auth',
          name: 'b',
          config: { username: 'u', password: 'p' },
        } as Partial<AuthConfig>,
        USER,
      );
      await expect(
        rejectedFields(
          service.update(
            ac.id,
            WS,
            { config: { username: '', __x: 1 } } as Partial<AuthConfig>,
            USER,
          ),
        ),
      ).resolves.toEqual(['config.username', 'config.__x']);
    });

    it('편집: 읽지 못한 설정이어도 `__` 키 검사가 먼저다', async () => {
      const ac = await repo.save({
        workspaceId: WS,
        name: 'unreadable',
        type: 'api_key',
        isActive: true,
        config: { __unreadable: true, __original_ciphertext: 'enc:v1:xx' },
      } as unknown as AuthConfig);
      repo.save.mockClear();
      await expect(
        rejectedFields(
          service.update(
            ac.id,
            WS,
            {
              name: 'x',
              config: { __unreadable: false },
            } as Partial<AuthConfig>,
            USER,
          ),
        ),
      ).resolves.toEqual(['config.__unreadable']);
      expect(repo.save).not.toHaveBeenCalled();
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

    it('api_key: key 만 교체, headerName 보존', async () => {
      const ac = await service.create(
        WS,
        {
          type: 'api_key',
          config: { headerName: 'X-My-Key' },
        } as Partial<AuthConfig>,
        USER,
      );
      const old = ac.config.key;
      const re = await service.regenerate(ac.id, WS, USER);
      expect(re.config.key).not.toBe(old);
      expect(re.config.key).toMatch(/^wfk_[0-9a-f]{48}$/);
      expect(re.config.headerName).toBe('X-My-Key');
    });

    it('bearer_token: token 교체', async () => {
      const ac = await service.create(
        WS,
        { type: 'bearer_token' } as Partial<AuthConfig>,
        USER,
      );
      const old = ac.config.token;
      const re = await service.regenerate(ac.id, WS, USER);
      expect(re.config.token).not.toBe(old);
      expect(re.config.token).toMatch(/^wft_[0-9a-f]{64}$/);
      expect(Object.keys(re.config)).toEqual(['token']);
    });

    // 사용자 이름과 비밀번호는 사용자 입력이라 새로 발급할 값이 없다. 전에는 설정을 그대로 저장하고
    // 감사를 남긴 뒤 저장된 비밀번호를 평문으로 응답했다(평문 보기의 비밀번호 재확인을 건너뛰는 길).
    it('basic_auth: 400 AUTH_CONFIG_REGENERATE_UNSUPPORTED · 저장 · 감사 없음 · 비밀번호를 싣지 않는다 (REQ-AUTHCFG-029)', async () => {
      const ac = await service.create(
        WS,
        {
          type: 'basic_auth',
          config: { username: 'u', password: 'secret-pw' },
        } as Partial<AuthConfig>,
        USER,
      );
      repo.save.mockClear();
      audit.record.mockClear();
      const err: unknown = await service.regenerate(ac.id, WS, USER).then(
        () => {
          throw new Error('거부되지 않았다');
        },
        (err_: unknown) => err_,
      );
      expect(err).toBeInstanceOf(BadRequestException);
      const body = (err as BadRequestException).getResponse();
      expect(body).toEqual({
        code: 'AUTH_CONFIG_REGENERATE_UNSUPPORTED',
        message: expect.any(String),
      });
      expect(JSON.stringify(body)).not.toContain('secret-pw');
      expect(repo.save).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
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

  /**
   * 동시 삭제 두 건이 `auth_config.delete` 감사를 두 번 남기던 결함의 회귀 테스트.
   * 형제 여섯(#1369~#1373)과 같은 클래스이고, 이 경로엔 락이 없어 처방도 통합 경로와 같다 —
   * 원자적 `DELETE` 의 `affected` 를 판별자로 쓴다.
   */
  describe('remove — 동시 삭제', () => {
    async function seed(): Promise<string> {
      const ac = await service.create(
        WS,
        { type: 'api_key' } as Partial<AuthConfig>,
        USER,
      );
      audit.record.mockClear();
      return ac.id;
    }

    it('워크스페이스로 스코프한 원자적 DELETE 를 친다', async () => {
      const id = await seed();

      await service.remove(id, WS, USER);

      // `workspaceId` 가 빠지면 cross-tenant 삭제가 된다 — 조건을 통째로 단언한다.
      expect(repo.delete).toHaveBeenCalledWith({ id, workspaceId: WS });
      expect(audit.record).toHaveBeenCalled();
    });

    it('진 쪽은 404 RESOURCE_NOT_FOUND 이고 감사를 남기지 않는다', async () => {
      const id = await seed();
      // 둘 다 무락 findById 를 통과했지만 원자적 DELETE 는 하나만 1행을 지운다.
      repo.delete.mockResolvedValueOnce({ affected: 0, raw: [] });

      await expect(service.remove(id, WS, USER)).rejects.toMatchObject({
        response: { code: 'RESOURCE_NOT_FOUND' },
      });
      expect(audit.record).not.toHaveBeenCalled();
    });

    /**
     * 판정이 `affected === 0` **명시 비교**인 이유를 붙드는 대조군.
     * `null`·`undefined` 는 드라이버가 «보고하지 않았다» 는 뜻이지 «못 지웠다» 가 아니다 —
     * `!affected` 로 되돌리면 정상 삭제가 404 로 뒤집힌다. #1371 에서 이 대조군이 빠져
     * 같은 뮤턴트가 32건을 통과했다.
     */
    it.each([[undefined], [null]])(
      'affected 가 %p(드라이버 미보고)면 정상 삭제로 취급한다',
      async (affected) => {
        const id = await seed();
        // `affected: null | undefined` 는 `DeleteResult` 의 `number` 에 대입되지 않는다.
        // 이 대조군이 재현하려는 것이 바로 «드라이버가 타입을 지키지 않는 경우» 이므로
        // 캐스트로 그 상태를 만든다 — 형제 PR(#1371·#1372)과 같은 처리다.
        repo.delete.mockResolvedValueOnce({
          affected,
          raw: [],
        } as unknown as DeleteResult);

        await expect(service.remove(id, WS, USER)).resolves.toBeUndefined();
        expect(audit.record).toHaveBeenCalled();
      },
    );

    it('대상이 없으면 DELETE 를 시도하지 않는다', async () => {
      await expect(
        service.remove(crypto.randomUUID(), WS, USER),
      ).rejects.toMatchObject({ response: { code: 'RESOURCE_NOT_FOUND' } });
      expect(repo.delete).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
    });
  });

  describe('update — 보내지 않은 필드', () => {
    // 실제 요청처럼 DTO **인스턴스**를 넘긴다 — 보내지 않은 필드가 `undefined` own property 로 있는 형태다
    // (`useDefineForClassFields`). 걸러내지 않으면 PATCH 응답에서 그 값이 사라지거나 null 로 실렸다.
    it('보내지 않은 필드(undefined)로 로드한 값을 덮지 않는다', async () => {
      const ac = await service.create(
        WS,
        {
          type: 'api_key',
          name: 'a',
          ipWhitelist: ['10.0.0.0/8'],
          isActive: false,
        } as Partial<AuthConfig>,
        USER,
      );
      const result = await service.update(
        ac.id,
        WS,
        Object.assign(new UpdateAuthConfigDto(), {
          name: 'renamed',
        }) as Partial<AuthConfig>,
        USER,
      );
      expect(result).toMatchObject({
        name: 'renamed',
        ipWhitelist: ['10.0.0.0/8'],
        isActive: false,
      });
    });

    // §5.5 tri-state 의 나머지 한 칸 — 명시적 `null` 은 «값을 지운다» 는 요청이라 걸러내면 안 된다.
    it('명시적 null 은 로드한 값을 지운다', async () => {
      const ac = await service.create(
        WS,
        {
          type: 'api_key',
          name: 'a',
          ipWhitelist: ['10.0.0.0/8'],
        } as Partial<AuthConfig>,
        USER,
      );
      const result = await service.update(
        ac.id,
        WS,
        Object.assign(new UpdateAuthConfigDto(), { ipWhitelist: null }),
        USER,
      );
      expect(result).toHaveProperty('ipWhitelist', null);
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

  // 키를 바꿔 복호화하지 못한 행은 `{__unreadable: true, __original_ciphertext: 'enc:v1:...'}` 로
  // 읽힌다. 원래 암호문은 저장 왕복용이다. 옛 키가 공개 예시 값이던 배포라면 풀 수 있으므로 어떤
  // 응답에도 싣지 않고 표식만 남긴다. 저장할 값은 건드리지 않는다(재저장이 원래 암호문을 그대로
  // 다시 써야 한다).
  describe('복호화 불가 표식 — 응답에서 원래 암호문을 뺀다', () => {
    const CIPHERTEXT = 'enc:v1:AW9sZC1rZXktY2lwaGVydGV4dC1zYW1wbGU=';

    async function seedUnreadable(type: string): Promise<AuthConfig> {
      return repo.save({
        workspaceId: WS,
        name: 'unreadable',
        type,
        isActive: true,
        config: { __unreadable: true, __original_ciphertext: CIPHERTEXT },
      } as unknown as AuthConfig);
    }

    it('상세 응답: 표식만 남고 저장된 값의 원래 암호문은 그대로다', async () => {
      const ac = await seedUnreadable('api_key');
      const res = await service.findByIdForResponse(ac.id, WS);
      expect(res.config).toEqual({ __unreadable: true });
      expect(repo.store.get(ac.id)!.config.__original_ciphertext).toBe(
        CIPHERTEXT,
      );
    });

    it('목록 응답: 표식만 남는다', async () => {
      const ac = await seedUnreadable('bearer_token');
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(1),
        getMany: jest.fn().mockResolvedValue([ac]),
      };
      Object.assign(repo, { createQueryBuilder: jest.fn(() => qb) });
      const res = await service.findAll(WS, {});
      expect(res.data).toHaveLength(1);
      expect(res.data[0].config).toEqual({ __unreadable: true });
    });

    // 저장소 mock 은 transformer 를 거치지 않는다. 실제로 DB 에 쓰일 값은 엔티티의
    // `encryptedJsonTransformer.to` 결과라 그것을 직접 계산해 본다.
    function storedColumn(config: unknown): unknown {
      return encryptedJsonTransformer.to(config as Record<string, unknown>);
    }

    it('편집 응답: 표식만 남고 저장에는 원래 암호문이 그대로 간다', async () => {
      const ac = await seedUnreadable('api_key');
      repo.save.mockClear();
      const res = await service.update(ac.id, WS, { name: 'renamed' }, USER);
      expect(res.name).toBe('renamed');
      expect(res.config).toEqual({ __unreadable: true });
      const saved = repo.save.mock.calls[0][0];
      expect(storedColumn(saved.config)).toBe(CIPHERTEXT);
    });

    // 표식에 병합한 값은 재저장 때 원래 암호문에 덮여(`encryptJson`) 저장되지 않는다. 그래서 편집이
    // 성공으로 보이지만 바뀐 것이 없었다. config 를 무시하고 이름 · IP · 활성만 바꾼다.
    it('편집: 읽지 못한 설정에는 config 를 병합하지 않는다 · 이름은 바뀐다 (REQ-AUTHCFG-031)', async () => {
      const ac = await seedUnreadable('api_key');
      repo.save.mockClear();
      const res = await service.update(
        ac.id,
        WS,
        { name: 'renamed', config: { headerName: 'X-New' } },
        USER,
      );
      expect(res.name).toBe('renamed');
      expect(res.config).toEqual({ __unreadable: true });
      const saved = repo.save.mock.calls[0][0];
      expect(saved.config).toEqual({
        __unreadable: true,
        __original_ciphertext: CIPHERTEXT,
      });
      expect(storedColumn(saved.config)).toBe(CIPHERTEXT);
    });

    it('편집: 원래 암호문이 없는 표식에도 config 를 병합하지 않는다', async () => {
      const ac = await repo.save({
        workspaceId: WS,
        name: 'unreadable',
        type: 'bearer_token',
        isActive: true,
        config: { __unreadable: true },
      } as unknown as AuthConfig);
      repo.save.mockClear();
      const res = await service.update(
        ac.id,
        WS,
        { config: { token: 'x', extra: 'y' } },
        USER,
      );
      expect(res.config).toEqual({ __unreadable: true });
      expect(repo.save.mock.calls[0][0].config).toEqual({
        __unreadable: true,
      });
    });

    // 전에는 표식에 새 키를 얹어 저장했다. `encryptJson` 이 표식의 원래 암호문을 그대로 다시 써서
    // 새 키는 저장되지 않고 응답에만 실렸다(웹훅이 그 키를 받지 않는다). 표식을 버리고 생성 때와
    // 같은 모양의 새 설정을 만든다.
    describe.each([
      ['api_key', /^wfk_[0-9a-f]{48}$/, 'key'],
      ['bearer_token', /^wft_[0-9a-f]{64}$/, 'token'],
      ['hmac', /^whs_[0-9a-f]{64}$/, 'secret'],
    ] as const)(
      '재생성: 읽지 못한 %s 는 새 설정을 저장한다 (REQ-AUTHCFG-030)',
      (type, pattern, field) => {
        it('저장되는 값이 원래 암호문이 아니고 응답의 새 값과 같다', async () => {
          const ac = await seedUnreadable(type);
          repo.save.mockClear();
          const res = await service.regenerate(ac.id, WS, USER);
          const saved = repo.save.mock.calls[0][0];
          const column = storedColumn(saved.config);
          expect(column).not.toBe(CIPHERTEXT);
          expect(encryptedJsonTransformer.from(column)).toEqual(res.config);
          expect(res.config[field]).toMatch(pattern);
          expect(res.config).not.toHaveProperty('__unreadable');
          expect(res.config).not.toHaveProperty('__original_ciphertext');
        });

        it('새 설정은 생성 때 기본값과 같은 모양이다', async () => {
          const ac = await seedUnreadable(type);
          const res = await service.regenerate(ac.id, WS, USER);
          const expected: Record<string, unknown> = {
            [field]: expect.stringMatching(pattern),
          };
          if (type === 'hmac') {
            expected.header = 'X-Hub-Signature-256';
            expected.algorithm = 'sha256';
          }
          expect(res.config).toEqual(expected);
        });
      },
    );

    it('재생성: 읽지 못한 basic_auth 도 400 · 저장 없음', async () => {
      const ac = await seedUnreadable('basic_auth');
      repo.save.mockClear();
      await expect(service.regenerate(ac.id, WS, USER)).rejects.toMatchObject({
        response: { code: 'AUTH_CONFIG_REGENERATE_UNSUPPORTED' },
      });
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('평문 보기 응답: 원래 암호문을 싣지 않는다', async () => {
      const ac = await seedUnreadable('bearer_token');
      userRepo.findOne.mockResolvedValue({
        id: USER,
        passwordHash: await bcrypt.hash('pw', 4),
      });
      const res = await service.reveal(ac.id, WS, USER, 'pw');
      expect(res.config).toEqual({ __unreadable: true });
      expect(repo.store.get(ac.id)!.config.__original_ciphertext).toBe(
        CIPHERTEXT,
      );
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

    // 키를 바꿔 복호화하지 못한 행은 transformer 가 `{__unreadable: true, ...}` 센티넬을 돌려준다
    // (`credentials-transformer.ts` non-throwing 계약). 검증 쪽이 이것을 빈 기대값으로 읽어
    // 빈 자격 증명을 받아들이면 안 된다.
    describe('빈 기대값 · 복호화하지 못한 설정 → 401', () => {
      const emptyBasic = Buffer.from(':').toString('base64'); // `Og==`

      // 생성은 빈 값을 400 으로 거부하므로(REQ-AUTHCFG-027) 올바른 값으로 만든 뒤 그 규칙 전에 저장된
      // 옛 행처럼 바꿔 둔다.
      async function seedLegacyBasic(config: Record<string, unknown>) {
        const ac = await seed('basic_auth', { username: 'u', password: 'p' });
        ac.config = config;
        return ac;
      }

      it.each([
        ['username · password 둘 다 빈 문자열', { username: '', password: '' }],
        ['password 만 빈 문자열', { username: 'u', password: '' }],
        ['username 만 빈 문자열', { username: '', password: 'p' }],
        ['username · password 키 없음', {}],
      ])('basic_auth: %s 이면 `:` 자격 증명을 거부', async (_label, config) => {
        const ac = await seedLegacyBasic(config);
        await expect(
          service.verifyWebhookRequest(ac.id, WS, {
            headers: { authorization: `Basic ${emptyBasic}` },
          }),
        ).rejects.toThrow(UnauthorizedException);
        expect(repo.update).not.toHaveBeenCalled();
      });

      it('basic_auth: password 만 빈 설정은 올바른 username 에 빈 password 로도 거부', async () => {
        const ac = await seedLegacyBasic({ username: 'u', password: '' });
        const b64 = Buffer.from('u:').toString('base64');
        await expect(
          service.verifyWebhookRequest(ac.id, WS, {
            headers: { authorization: `Basic ${b64}` },
          }),
        ).rejects.toThrow(UnauthorizedException);
      });

      it('basic_auth: __unreadable 센티넬 설정이면 `:` 자격 증명을 거부', async () => {
        const ac = await seed('basic_auth', { username: 'u', password: 'p' });
        ac.config = { __unreadable: true, __original_ciphertext: 'enc:v1:xx' };
        await expect(
          service.verifyWebhookRequest(ac.id, WS, {
            headers: { authorization: `Basic ${emptyBasic}` },
          }),
        ).rejects.toThrow(UnauthorizedException);
        expect(repo.update).not.toHaveBeenCalled();
      });

      it('hmac: secret 이 빈 문자열이면 빈 키로 계산한 서명을 거부', async () => {
        const ac = await seed('hmac', {});
        ac.config = {
          secret: '',
          header: 'X-Hub-Signature-256',
          algorithm: 'sha256',
        };
        const rawBody = Buffer.from('{"a":1}');
        const sig = `sha256=${crypto.createHmac('sha256', '').update(rawBody).digest('hex')}`;
        await expect(
          service.verifyWebhookRequest(ac.id, WS, {
            headers: { 'x-hub-signature-256': sig },
            rawBody,
          }),
        ).rejects.toThrow(UnauthorizedException);
        expect(repo.update).not.toHaveBeenCalled();
      });

      it('hmac: __unreadable 센티넬 설정이면 빈 키로 계산한 서명을 거부', async () => {
        const ac = await seed('hmac', {});
        ac.config = { __unreadable: true, __original_ciphertext: 'enc:v1:xx' };
        const rawBody = Buffer.from('{"a":1}');
        const sig = `sha256=${crypto.createHmac('sha256', '').update(rawBody).digest('hex')}`;
        await expect(
          service.verifyWebhookRequest(ac.id, WS, {
            headers: { 'x-hub-signature-256': sig },
            rawBody,
          }),
        ).rejects.toThrow(UnauthorizedException);
        expect(repo.update).not.toHaveBeenCalled();
      });

      it('bearer_token · api_key: __unreadable 센티넬 설정이면 빈 값 헤더도 거부 (기존 규칙 고정)', async () => {
        const bearer = await seed('bearer_token', {});
        bearer.config = { __unreadable: true };
        await expect(
          service.verifyWebhookRequest(bearer.id, WS, {
            headers: { authorization: 'Bearer ' },
          }),
        ).rejects.toThrow(UnauthorizedException);
        const apiKey = await seed('api_key', {});
        apiKey.config = { __unreadable: true };
        await expect(
          service.verifyWebhookRequest(apiKey.id, WS, {
            headers: { 'x-api-key': '' },
          }),
        ).rejects.toThrow(UnauthorizedException);
      });
    });

    // 저장된 설정은 jsonb 라 문자열이 아닌 값이 들어 있을 수 있다(생성 · 편집이 비밀이 아닌 키의
    // 타입을 검사하지 않는다). 전에는 그 값이 `Buffer.from` · `toLowerCase` · `createHmac` 에서
    // TypeError 를 내 500 이 됐다. 빈 기대값과 같이 401 로 거부한다(REQ-WEBHOOK-053).
    describe('문자열이 아닌 기대값 · 헤더 이름 → 401', () => {
      const NON_STRINGS: ReadonlyArray<[string, unknown]> = [
        ['숫자', 123],
        ['객체', { a: 1 }],
        ['배열', ['x']],
        ['불리언', true],
      ];

      async function expectRejected(
        type: string,
        config: Record<string, unknown>,
        req: { headers: Record<string, string>; rawBody?: Buffer },
      ) {
        // 생성 검증을 지나도록 유효한 설정으로 만든 뒤 저장된 값을 바꿔 둔다.
        const ac = await seed(
          type,
          type === 'basic_auth' ? { username: 'u', password: 'p' } : {},
        );
        ac.config = config;
        repo.update.mockClear();
        const err: unknown = await service
          .verifyWebhookRequest(ac.id, WS, req)
          .then(
            () => new Error('통과했다'),
            (err_: unknown) => err_,
          );
        expect(err).toBeInstanceOf(UnauthorizedException);
        expect((err as UnauthorizedException).getResponse()).toMatchObject({
          code: 'AUTH_FAILED',
        });
        expect(repo.update).not.toHaveBeenCalled();
      }

      it.each(NON_STRINGS)('bearer_token: token 이 %s', async (_l, value) => {
        await expectRejected(
          'bearer_token',
          { token: value },
          { headers: { authorization: `Bearer ${String(value)}` } },
        );
      });

      it.each(NON_STRINGS)('api_key: key 가 %s', async (_l, value) => {
        await expectRejected(
          'api_key',
          { key: value },
          { headers: { 'x-api-key': String(value) } },
        );
      });

      it.each(NON_STRINGS)(
        'api_key: headerName 이 %s 면 기본 헤더로 바꾸지 않는다',
        async (_l, value) => {
          await expectRejected(
            'api_key',
            { key: 'wfk_x', headerName: value },
            { headers: { 'x-api-key': 'wfk_x' } },
          );
        },
      );

      it.each(NON_STRINGS)('basic_auth: username 이 %s', async (_l, value) => {
        const b64 = Buffer.from(`${String(value)}:p`).toString('base64');
        await expectRejected(
          'basic_auth',
          { username: value, password: 'p' },
          { headers: { authorization: `Basic ${b64}` } },
        );
      });

      it.each(NON_STRINGS)('basic_auth: password 가 %s', async (_l, value) => {
        const b64 = Buffer.from(`u:${String(value)}`).toString('base64');
        await expectRejected(
          'basic_auth',
          { username: 'u', password: value },
          { headers: { authorization: `Basic ${b64}` } },
        );
      });

      it.each(NON_STRINGS)('hmac: secret 이 %s', async (_l, value) => {
        const rawBody = Buffer.from('{"a":1}');
        const sig = `sha256=${crypto.createHmac('sha256', String(value)).update(rawBody).digest('hex')}`;
        await expectRejected(
          'hmac',
          { secret: value, header: 'X-Hub-Signature-256', algorithm: 'sha256' },
          { headers: { 'x-hub-signature-256': sig }, rawBody },
        );
      });

      it.each(NON_STRINGS)(
        'hmac: header 가 %s 면 기본 헤더로 바꾸지 않는다',
        async (_l, value) => {
          const rawBody = Buffer.from('{"a":1}');
          const sig = `sha256=${crypto.createHmac('sha256', 'whs_x').update(rawBody).digest('hex')}`;
          await expectRejected(
            'hmac',
            { secret: 'whs_x', header: value, algorithm: 'sha256' },
            { headers: { 'x-hub-signature-256': sig }, rawBody },
          );
        },
      );

      it.each(NON_STRINGS)(
        'hmac: algorithm 이 %s 면 기본 알고리즘으로 바꾸지 않고 401',
        async (_l, value) => {
          const rawBody = Buffer.from('{"a":1}');
          const sig = `sha256=${crypto.createHmac('sha256', 'whs_x').update(rawBody).digest('hex')}`;
          await expectRejected(
            'hmac',
            {
              secret: 'whs_x',
              header: 'X-Hub-Signature-256',
              algorithm: value,
            },
            { headers: { 'x-hub-signature-256': sig }, rawBody },
          );
        },
      );

      it('api_key: headerName 키가 없으면 기본 X-API-Key 를 쓴다 (기존 동작)', async () => {
        const ac = await seed('api_key', {});
        ac.config = { key: 'wfk_x' };
        await expect(
          service.verifyWebhookRequest(ac.id, WS, {
            headers: { 'x-api-key': 'wfk_x' },
          }),
        ).resolves.toBeUndefined();
      });

      it('hmac: header 키가 없으면 기본 X-Hub-Signature-256 을 쓴다 (기존 동작)', async () => {
        const ac = await seed('hmac', {});
        ac.config = { secret: 'whs_x', algorithm: 'sha256' };
        const rawBody = Buffer.from('{"a":1}');
        const sig = `sha256=${crypto.createHmac('sha256', 'whs_x').update(rawBody).digest('hex')}`;
        await expect(
          service.verifyWebhookRequest(ac.id, WS, {
            headers: { 'x-hub-signature-256': sig },
            rawBody,
          }),
        ).resolves.toBeUndefined();
      });

      it('config 자체가 null 이면 401', async () => {
        const ac = await seed('bearer_token', {});
        (ac as unknown as { config: unknown }).config = null;
        repo.update.mockClear();
        await expect(
          service.verifyWebhookRequest(ac.id, WS, {
            headers: { authorization: 'Bearer x' },
          }),
        ).rejects.toThrow(UnauthorizedException);
      });
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

    // null 과 빈 배열은 같은 뜻 — 화이트리스트 없음. PATCH 가 둘 다 받는다고 광고하므로(`UpdateAuthConfigDto.ipWhitelist`) 판정도 같아야 한다.
    it.each([
      ['null', null],
      ['빈 배열', []],
    ])(
      'ip_whitelist: %s 이면 제한 없음 — 목록 밖 IP 도 통과',
      async (_label, ipWhitelist) => {
        const ac = await seed('bearer_token', {}, { ipWhitelist });
        const token = ac.config.token as string;
        await expect(
          service.verifyWebhookRequest(ac.id, WS, {
            headers: { authorization: `Bearer ${token}` },
            clientIp: '203.0.113.9',
          }),
        ).resolves.toBeUndefined();
      },
    );

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

    /**
     * W-11: getCount / getRawOne / getMany 를 **독립 QB 객체**로 분리.
     * Promise.all 병렬화(W-4) 이후 createQueryBuilder 호출 순서가 보장되지 않으므로
     * 각 QB 가 자신의 terminal 만 응답해야 쿼리별 파라미터 혼용을 테스트가 검출할 수 있다.
     */
    function makeExecutionRepo(opts: {
      totalCalls: number;
      period: { last24h: string; last7d: string; last30d: string } | null;
      recent: Array<Partial<Execution> & { trigger?: { name: string } }>;
    }) {
      /** 체이너블 메서드 공통 — 각 QB 가 독립 체인을 갖도록 별도 생성. */
      const makeQbBase = () => ({
        where: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        innerJoinAndSelect: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        setParameters: jest.fn().mockReturnThis(),
      });

      const countQb = {
        ...makeQbBase(),
        getCount: jest.fn().mockResolvedValue(opts.totalCalls),
      };
      const periodQb = {
        ...makeQbBase(),
        getRawOne: jest.fn().mockResolvedValue(opts.period),
      };
      const recentQb = {
        ...makeQbBase(),
        getMany: jest.fn().mockResolvedValue(opts.recent),
      };

      // 순서 비의존 — 각 QB 가 자신의 terminal 만 제공하므로 호출 순서가 달라도 안전.
      const createQueryBuilder = jest
        .fn()
        .mockReturnValueOnce(countQb)
        .mockReturnValueOnce(periodQb)
        .mockReturnValueOnce(recentQb);

      return { countQb, periodQb, recentQb, createQueryBuilder };
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

      // W-11: 3개 QB 가 독립 객체 — 각 terminal 이 정확히 1회 호출됨.
      expect(execRepo.countQb.getCount).toHaveBeenCalledTimes(1);
      expect(execRepo.periodQb.getRawOne).toHaveBeenCalledTimes(1);
      expect(execRepo.recentQb.getMany).toHaveBeenCalledTimes(1);
      // I-11: recentQb 에 limit(USAGE_RECENT_CALLS_LIMIT=20) 이 적용됐는지 단언.
      expect(execRepo.recentQb.limit).toHaveBeenCalledWith(20);
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

    // I-10: trigger 관계 null(orphan execution) 시 triggerName 이 'Unknown' 으로 폴백.
    it('trigger 관계가 null 인 orphan execution 은 triggerName 이 Unknown 으로 폴백된다', async () => {
      const execRepo = makeExecutionRepo({
        totalCalls: 1,
        period: { last24h: '1', last7d: '1', last30d: '1' },
        recent: [
          {
            id: 'e-orphan',
            status: 'completed',
            startedAt: new Date('2026-06-14T10:00:00.000Z'),
            sourceIp: null,
            responseCode: '202',
            trigger: undefined, // orphan — trigger 관계 없음
          },
        ],
      });
      const svc = await buildService(
        execRepo,
        jest.fn().mockResolvedValue([{ id: 't1' }]),
      );

      const res = await svc.getUsage(CFG_ID, WS);

      expect(res.recentCalls).toHaveLength(1);
      expect(res.recentCalls[0].triggerName).toBe('Unknown');
    });
  });
});
