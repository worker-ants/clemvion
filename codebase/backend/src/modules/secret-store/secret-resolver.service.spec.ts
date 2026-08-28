import { ConfigService } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { Repository } from 'typeorm';
import { SecretStore } from './entities/secret-store.entity';
import { SecretResolverService } from './secret-resolver.service';

/**
 * 단위 테스트 — DB 접근은 in-memory Map 으로 stub.
 *
 * 실 DB 통합 테스트는 e2e 의 secret-store 시나리오에서 검증.
 */

type Row = SecretStore;

/** 마지막으로 실행된 delete 쿼리의 조건문·바인딩 값 — 쿼리 **형태**를 단언하기 위한 관측점. */
interface LastDeleteQuery {
  condition?: string;
  pattern?: string;
}

type InMemoryRepository = Repository<SecretStore> & {
  _dump: () => unknown;
  _lastDeleteQuery: LastDeleteQuery;
};

function createInMemoryRepository(): InMemoryRepository {
  const store = new Map<string, Row>();
  const lastDeleteQuery: LastDeleteQuery = {};
  const repo = {
    async findOne({ where }: { where: { ref: string } }): Promise<Row | null> {
      return store.get(where.ref) ?? null;
    },
    async insert(row: Partial<Row>): Promise<void> {
      if (!row.ref) throw new Error('ref required');
      store.set(row.ref, {
        ref: row.ref,
        workspaceId: row.workspaceId!,
        encrypted: row.encrypted as Buffer,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    },
    async update(where: { ref: string }, patch: Partial<Row>): Promise<void> {
      const existing = store.get(where.ref);
      if (!existing) return;
      store.set(where.ref, { ...existing, ...patch });
    },
    async delete(where: { ref: string }): Promise<void> {
      store.delete(where.ref);
    },
    async count({ where }: { where: { ref: string } }): Promise<number> {
      return store.has(where.ref) ? 1 : 0;
    },
    createQueryBuilder() {
      const qb = {
        _lastPrefix: undefined as string | undefined,
        delete() {
          return this;
        },
        where(condition: string, params: { prefix: string }) {
          lastDeleteQuery.condition = condition;
          lastDeleteQuery.pattern = params.prefix;
          // `prefix` 파라미터는 'secret://...%' 형식 — 끝의 '%' 를 제거해 startsWith 로 비교.
          //
          // **이 치환이 SQL `LIKE` 와 동치인 것은 나머지에 메타문자가 없을 때뿐이다.**
          // Postgres 는 `_` 를 임의 1글자, `%` 를 임의 문자열로 해석하므로, 메타문자가
          // 섞인 패턴에서 `startsWith` 는 실제보다 **적게** 지운다 — 즉 mock 이
          // 과다삭제를 조용히 감춘다. 그 전제는 `deleteByPrefix` 의 입력 거부 가드가
          // 세워 주므로, **여기서 전제를 직접 단언**한다. 가드가 사라지면 이 스위트가
          // 조용히 GREEN 으로 남는 대신 아래 throw 로 그 사실이 드러난다.
          //
          // LIKE 해석기를 여기 구현하지 않는 이유: 테스트가 DB 를 흉내 내다 틀릴 새 위험을
          // 만든다. 실제 와일드카드 의미론은 실 Postgres 가 고정한다
          // (`test/secret-store-like-prefix.e2e-spec.ts`).
          const literalPart = params.prefix.replace(/%$/, '');
          if (/[%_\\]/.test(literalPart)) {
            // **문구는 서비스 가드의 에러와 겹치지 않아야 한다.** 가드 쪽 메시지에도 있는
            // 단어(`메타문자`)를 여기 쓰면, 가드를 지우는 회귀가 와도 위 `toThrow(/메타문자/)`
            // 단언들이 이 mock 의 throw 로 **그대로 충족돼** 스위트가 GREEN 으로 남는다
            // (실측: 그 문구로 처음 작성했다가 가드 제거 뮤턴트가 47/47 통과했다).
            throw new Error(
              'in-memory repository mock: LIKE 와일드카드가 섞인 패턴은 startsWith 로 ' +
                `모사할 수 없습니다 (받음: "${params.prefix}"). deleteByPrefix 의 입력 ` +
                '거부 가드가 사라졌는지 확인하세요 — 실 Postgres 는 이 패턴에서 의도보다 ' +
                '넓게 삭제합니다.',
            );
          }
          this._lastPrefix = literalPart;
          return this;
        },
        async execute() {
          let n = 0;
          for (const k of store.keys()) {
            if (qb._lastPrefix !== undefined && k.startsWith(qb._lastPrefix)) {
              store.delete(k);
              n++;
            }
          }
          return { affected: n };
        },
      };
      return qb;
    },
    // helper for tests
    _dump: () => Array.from(store.entries()),
    _lastDeleteQuery: lastDeleteQuery,
  } as unknown as InMemoryRepository;
  return repo;
}

function createConfigService(key: string | undefined): ConfigService {
  return {
    get: (path: string) => (path === 'llm.encryptionKey' ? key : undefined),
  } as unknown as ConfigService;
}

const validKey = randomBytes(32).toString('hex');

describe('SecretResolverService', () => {
  describe('onModuleInit', () => {
    it('정상 — 64-char hex 키', () => {
      const svc = new SecretResolverService(
        createInMemoryRepository(),
        createConfigService(validKey),
      );
      expect(() => svc.onModuleInit()).not.toThrow();
    });

    it('실패 — ENCRYPTION_KEY 미설정', () => {
      const origEnv = process.env.ENCRYPTION_KEY;
      delete process.env.ENCRYPTION_KEY;
      try {
        const svc = new SecretResolverService(
          createInMemoryRepository(),
          createConfigService(undefined),
        );
        expect(() => svc.onModuleInit()).toThrow(/ENCRYPTION_KEY is not set/);
      } finally {
        if (origEnv !== undefined) process.env.ENCRYPTION_KEY = origEnv;
      }
    });

    it('정상 — 임의 길이 문자열 키도 SHA-256 derive 로 부팅 통과', () => {
      const svc = new SecretResolverService(
        createInMemoryRepository(),
        createConfigService('not-hex-passphrase'),
      );
      expect(() => svc.onModuleInit()).not.toThrow();
    });
  });

  describe('round-trip store/resolve', () => {
    it('정상 — store 후 resolve 로 plaintext 복구', async () => {
      const repo = createInMemoryRepository();
      const svc = new SecretResolverService(
        repo,
        createConfigService(validKey),
      );
      svc.onModuleInit();
      const ref = 'secret://triggers/abc/bot-token';
      await svc.store(ref, 'ws-1', '1234567890:AAAAA');
      const result = await svc.resolve(ref);
      expect(result).toBe('1234567890:AAAAA');
    });

    it('실패 — 미존재 ref 는 NotFoundException', async () => {
      const svc = new SecretResolverService(
        createInMemoryRepository(),
        createConfigService(validKey),
      );
      svc.onModuleInit();
      await expect(
        svc.resolve('secret://triggers/abc/missing'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('실패 — 잘못된 ref 형식', async () => {
      const svc = new SecretResolverService(
        createInMemoryRepository(),
        createConfigService(validKey),
      );
      svc.onModuleInit();
      await expect(svc.resolve('not-a-ref')).rejects.toThrow(
        /invalid ref format/,
      );
    });

    it('실패 — store 시 중복 ref 면 throw', async () => {
      const svc = new SecretResolverService(
        createInMemoryRepository(),
        createConfigService(validKey),
      );
      svc.onModuleInit();
      const ref = 'secret://triggers/abc/bot-token';
      await svc.store(ref, 'ws-1', 'a');
      await expect(svc.store(ref, 'ws-1', 'b')).rejects.toThrow(/이미 존재/);
    });

    /**
     * `resolve()` catch 분기에 걸린 `eslint-disable-next-line preserve-caught-error`
     * 의 보안 불변식을 잠근다 — cause 를 보존하면 crypto 에러 상세가 Activity API 로
     * 노출된다(SS-SE-05, `#814` 근거). 메시지만 단언하면 vacuous 하다: disable 주석이
     * 실수로 지워지고 `throw new Error(msg, { cause: err })` 로 바뀌어도 메시지 단언은
     * 여전히 통과하기 때문이다 — 그래서 `cause` 부재를 **함께** 단언한다.
     */
    it('실패 — 복호화 실패(authTag 위조) 시 메시지만 노출되고 cause 는 보존되지 않는다', async () => {
      const repo = createInMemoryRepository();
      const svc = new SecretResolverService(
        repo,
        createConfigService(validKey),
      );
      svc.onModuleInit();
      const ref = 'secret://triggers/abc/bot-token';
      // 형식은 유효(IV 12B + ciphertext 4B + tag 16B)하지만 전부 0 — AES-GCM authTag
      // 검증이 반드시 실패해 decryptSecret 내부에서 crypto 상세 에러를 던진다.
      await repo.insert({
        ref,
        workspaceId: 'ws-1',
        encrypted: Buffer.alloc(12 + 4 + 16),
      });

      expect.assertions(3);
      try {
        await svc.resolve(ref);
      } catch (err) {
        expect(err).toBeInstanceOf(Error);
        expect((err as Error).message).toBe('Secret decryption failed');
        expect((err as Error).cause).toBeUndefined();
      }
    });
  });

  describe('rotate', () => {
    it('정상 — 기존 ref 의 plaintext 를 newPlaintext 로 교체', async () => {
      const svc = new SecretResolverService(
        createInMemoryRepository(),
        createConfigService(validKey),
      );
      svc.onModuleInit();
      const ref = 'secret://triggers/abc/bot-token';
      await svc.store(ref, 'ws-1', 'old');
      await svc.rotate(ref, 'ws-1', 'new');
      expect(await svc.resolve(ref)).toBe('new');
    });

    it('정상 — 미존재 ref 는 UPSERT', async () => {
      const svc = new SecretResolverService(
        createInMemoryRepository(),
        createConfigService(validKey),
      );
      svc.onModuleInit();
      const ref = 'secret://triggers/abc/bot-token.v2';
      await svc.rotate(ref, 'ws-1', 'fresh');
      expect(await svc.resolve(ref)).toBe('fresh');
    });
  });

  describe('deleteByPrefix', () => {
    it('정상 — prefix 매칭 건만 삭제, 나머지는 보존', async () => {
      const svc = new SecretResolverService(
        createInMemoryRepository(),
        createConfigService(validKey),
      );
      svc.onModuleInit();
      await svc.store('secret://triggers/t1/bot-token', 'ws-1', 'a');
      await svc.store('secret://triggers/t1/inbound-signing', 'ws-1', 'b');
      await svc.store('secret://triggers/t2/bot-token', 'ws-1', 'c');

      const affected = await svc.deleteByPrefix('secret://triggers/t1/');
      expect(affected).toBe(2);
      // t1 의 두 ref 는 삭제됨
      await expect(
        svc.resolve('secret://triggers/t1/bot-token'),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        svc.resolve('secret://triggers/t1/inbound-signing'),
      ).rejects.toBeInstanceOf(NotFoundException);
      // t2 의 ref 는 보존됨
      expect(await svc.resolve('secret://triggers/t2/bot-token')).toBe('c');
    });

    it('0건 매칭 시 affected=0 반환', async () => {
      const svc = new SecretResolverService(
        createInMemoryRepository(),
        createConfigService(validKey),
      );
      svc.onModuleInit();
      await svc.store('secret://triggers/t1/bot-token', 'ws-1', 'a');

      const affected = await svc.deleteByPrefix('secret://triggers/t99/');
      expect(affected).toBe(0);
      // t1 의 ref 는 보존됨
      expect(await svc.resolve('secret://triggers/t1/bot-token')).toBe('a');
    });

    it('실패 — secret:// 로 시작하지 않는 prefix 는 throw', async () => {
      const svc = new SecretResolverService(
        createInMemoryRepository(),
        createConfigService(validKey),
      );
      svc.onModuleInit();
      await expect(svc.deleteByPrefix('triggers/t1/')).rejects.toThrow(
        /secret:\/\//,
      );
    });

    /**
     * prefix 는 `LIKE` 패턴으로 쓰이므로 `%`·`_` 가 섞이면 **의도보다 넓게 지워진다**.
     * 삭제는 되돌릴 수 없어 방향이 나쁘다. 현재 호출부는 내부 생성 UUID 경로뿐이지만
     * 그 안전은 호출부 목록이 그대로일 때만 참이라 입력 자체를 거부한다.
     */
    it.each([
      ['%', 'secret://triggers/%/'],
      ['_', 'secret://triggers/t_/'],
      ['백슬래시(ESCAPE 절 도입 시 의미가 생긴다)', 'secret://triggers/t\\1/'],
      ['전체를 노리는 형태', 'secret://%'],
    ])('실패 — prefix 에 LIKE 메타문자 %s 는 throw', async (_label, prefix) => {
      const svc = new SecretResolverService(
        createInMemoryRepository(),
        createConfigService(validKey),
      );
      svc.onModuleInit();
      await expect(svc.deleteByPrefix(prefix)).rejects.toThrow(/메타문자/);
    });

    /**
     * 가드의 **존재 근거**("메타문자가 섞이면 실 DB 가 과다삭제한다")를 실행 가능하게
     * 만드는 두 축 중 이쪽 — "prefix 가 정말 `LIKE` 패턴으로 쓰이는가".
     *
     * 나머지 축(그래서 `_`·`%` 가 와일드카드로 해석된다)은 in-memory mock 이 `startsWith`
     * 라 재현할 수 없어 실 Postgres 가 맡는다
     * (`test/secret-store-like-prefix.e2e-spec.ts`). mock 에 LIKE 해석기를 넣는 대신
     * 축을 가른 이유는 그쪽이 **테스트가 DB 를 흉내 내다 틀릴** 새 위험을 만들기 때문이다.
     *
     * 이 단언이 두 축의 연결점이다 — e2e 가 증명한 사실이 이 코드에 적용되려면 쿼리가
     * `LIKE` 여야 하고 패턴이 `<prefix>%` 여야 한다. 쿼리가 `LIKE` 를 떠나거나 `ESCAPE`
     * 절이 붙으면 여기서 RED 가 나고, 그때는 e2e 의 전제도 다시 봐야 한다.
     */
    it('prefix 는 `ref LIKE :prefix` 로 바인딩된다 — e2e 가 고정한 과다삭제 전제의 연결점', async () => {
      const repo = createInMemoryRepository();
      const svc = new SecretResolverService(
        repo,
        createConfigService(validKey),
      );
      svc.onModuleInit();

      await svc.deleteByPrefix('secret://triggers/t1/');

      expect(repo._lastDeleteQuery.condition).toBe('ref LIKE :prefix');
      expect(repo._lastDeleteQuery.pattern).toBe('secret://triggers/t1/%');
      // `ESCAPE` 절이 **없다**는 것도 계약의 일부다. 붙는 순간 메타문자가 리터럴로
      // 바뀌어 가드의 전제(메타문자는 와일드카드로 해석된다)가 무효가 된다.
      expect(repo._lastDeleteQuery.condition).not.toMatch(/escape/i);
    });

    it('mock 이 자기 전제를 단언한다 — 메타문자 패턴에서 조용히 적게 지우지 않고 throw', () => {
      // 가드를 제거하는 회귀가 오면 메타문자 패턴이 이 mock 까지 내려온다. 그때
      // `startsWith` 는 아무 일 없다는 듯 **적게** 지워 스위트를 GREEN 으로 통과시킨다 —
      // 실 DB 의 동작과 정반대 방향이라 가장 나쁜 침묵이다. 그 침묵을 여기서 닫는다.
      const repo = createInMemoryRepository();
      expect(() =>
        repo
          .createQueryBuilder()
          .delete()
          .where('ref LIKE :prefix', { prefix: 'secret://triggers/t_/%' }),
      ).toThrow(/startsWith 로/);
    });

    it('통과 — 실제 호출부 형태(내부 생성 UUID 경로)는 그대로 동작한다', async () => {
      // 가드가 정상 경로까지 막으면 trigger 삭제가 조용히 실패한다 — 그 방향도 고정한다.
      const repo = createInMemoryRepository();
      const svc = new SecretResolverService(
        repo,
        createConfigService(validKey),
      );
      svc.onModuleInit();
      await svc.store(
        'secret://triggers/8f3c6b1a-0d2e-4a7e-9c1d-2f0e5a8b1234/token',
        'ws-1',
        'v',
      );
      const affected = await svc.deleteByPrefix(
        'secret://triggers/8f3c6b1a-0d2e-4a7e-9c1d-2f0e5a8b1234/',
      );
      expect(affected).toBe(1);
    });
  });

  describe('delete / exists', () => {
    it('exists — 존재 시 true, 미존재 시 false', async () => {
      const svc = new SecretResolverService(
        createInMemoryRepository(),
        createConfigService(validKey),
      );
      svc.onModuleInit();
      const ref = 'secret://triggers/abc/bot-token';
      expect(await svc.exists(ref)).toBe(false);
      await svc.store(ref, 'ws-1', 'x');
      expect(await svc.exists(ref)).toBe(true);
    });

    it('exists — 잘못된 형식은 false (throw 안 함)', async () => {
      const svc = new SecretResolverService(
        createInMemoryRepository(),
        createConfigService(validKey),
      );
      svc.onModuleInit();
      expect(await svc.exists('garbage')).toBe(false);
    });

    it('delete — 미존재 ref noop', async () => {
      const svc = new SecretResolverService(
        createInMemoryRepository(),
        createConfigService(validKey),
      );
      svc.onModuleInit();
      await expect(
        svc.delete('secret://triggers/abc/nope'),
      ).resolves.toBeUndefined();
    });
  });
});
