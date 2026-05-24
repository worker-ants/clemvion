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

function createInMemoryRepository(): Repository<SecretStore> {
  const store = new Map<string, Row>();
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
        where(_condition: string, params: { prefix: string }) {
          // `prefix` 파라미터는 'secret://...%' 형식 — 끝의 '%' 를 제거해 startsWith 로 비교.
          this._lastPrefix = params.prefix.replace(/%$/, '');
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
  } as unknown as Repository<SecretStore> & { _dump: () => unknown };
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
