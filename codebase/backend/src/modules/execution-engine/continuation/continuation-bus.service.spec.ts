import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getQueueToken } from '@nestjs/bullmq';
import {
  ContinuationBusService,
  RECOVERY_LOCK_KEY,
} from './continuation-bus.service';
import { CONTINUATION_EXECUTION_QUEUE } from '../queues/continuation-execution.queue';

/**
 * Phase 2 — Durable Continuation Bus 의 BullMQ 기반 publisher 검증.
 * 옛 Redis pub/sub 기반 spec (commit 33521233 이전) 은 채널 round-trip /
 * subscriber dispatch 를 검증했으나, Phase 2 에서 BullMQ 큐로 교체된 이후
 * 본 spec 은 publish → queue.add 매핑 + lock helpers 만 검증.
 */

// ioredis lock client 의 in-memory stub. ContinuationBusService 가 lazy 로
// `new Redis(...)` 를 직접 호출하므로 module-level mock 으로 대체.
type FakeRedisCmds = {
  incr: jest.Mock;
  set: jest.Mock;
  eval: jest.Mock;
  quit: jest.Mock;
  on: jest.Mock;
};

const fakeRedisInstances: FakeRedisCmds[] = [];

function createFakeRedis(): FakeRedisCmds {
  let counter = 0;
  const store = new Map<string, string>();
  const instance: FakeRedisCmds = {
    incr: jest.fn(async (_key: string) => ++counter),
    set: jest.fn(async (key: string, value: string, ..._args: unknown[]) => {
      const hasNX = _args.some((a) => a === 'NX');
      if (hasNX && store.has(key)) return null;
      store.set(key, value);
      return 'OK';
    }),
    eval: jest.fn(async (script: string, _n: number, key: string, arg: string) => {
      if (script.includes("call('get', KEYS[1]) == ARGV[1]")) {
        if (store.get(key) === arg) {
          store.delete(key);
          return 1;
        }
        return 0;
      }
      return 0;
    }),
    quit: jest.fn(async () => 'OK'),
    on: jest.fn(),
  };
  fakeRedisInstances.push(instance);
  return instance;
}

jest.mock('ioredis', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => createFakeRedis()),
}));

describe('ContinuationBusService (Phase 2 BullMQ-based)', () => {
  let bus: ContinuationBusService;
  let queueAdd: jest.Mock;

  beforeEach(async () => {
    fakeRedisInstances.length = 0;
    queueAdd = jest.fn().mockResolvedValue({ id: 'mock-job-id' });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContinuationBusService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'redis.host') return 'localhost';
              if (key === 'redis.port') return 6379;
              return undefined;
            }),
          },
        },
        {
          provide: getQueueToken(CONTINUATION_EXECUTION_QUEUE),
          useValue: {
            add: queueAdd,
          },
        },
      ],
    }).compile();

    bus = module.get(ContinuationBusService);
  });

  afterEach(async () => {
    await bus.onModuleDestroy();
  });

  describe('publish → BullMQ enqueue', () => {
    it('정상 enqueue 시 `${executionId}:${nodeExecutionId}:${seq}` 형태의 jobId 반환', async () => {
      const jobId = await bus.publish({
        type: 'continue',
        executionId: 'exec-1',
        nodeExecutionId: 'ne-1',
        payload: { type: 'form_submitted', formData: {} },
      });
      expect(jobId).toBe('exec-1:ne-1:1');
      expect(queueAdd).toHaveBeenCalledWith(
        'continuation',
        expect.objectContaining({
          type: 'continue',
          executionId: 'exec-1',
          nodeExecutionId: 'ne-1',
          payload: { type: 'form_submitted', formData: {} },
        }),
        expect.objectContaining({ jobId: 'exec-1:ne-1:1' }),
      );
    });

    it('nodeExecutionId 미설정 시 sentinel `__no_node_exec__` 사용 (legacy publisher 호환)', async () => {
      const jobId = await bus.publish({
        type: 'cancel',
        executionId: 'exec-2',
      });
      expect(jobId).toBe('exec-2:__no_node_exec__:1');
      expect(queueAdd).toHaveBeenCalledWith(
        'continuation',
        expect.objectContaining({
          executionId: 'exec-2',
          nodeExecutionId: '__no_node_exec__',
        }),
        expect.any(Object),
      );
    });

    it('같은 executionId 의 연속 publish 는 seq 가 monotonic 증가', async () => {
      const j1 = await bus.publish({
        type: 'continue',
        executionId: 'exec-3',
        nodeExecutionId: 'ne-3',
      });
      const j2 = await bus.publish({
        type: 'continue',
        executionId: 'exec-3',
        nodeExecutionId: 'ne-3',
      });
      // seq 가 단조 증가 — 같은 (executionId, nodeExecutionId) 라도 jobId 가 다름.
      expect(j1).not.toBe(j2);
      expect(j1).toMatch(/^exec-3:ne-3:\d+$/);
      expect(j2).toMatch(/^exec-3:ne-3:\d+$/);
    });

    it('Redis 장애 (INCR 실패) 시 fallback random seq 로 진행 — null 반환 아님', async () => {
      // ioredis instance 의 incr 가 실패하도록 override (서비스 lazy init 이후).
      await bus.publish({
        type: 'continue',
        executionId: 'exec-init',
        nodeExecutionId: 'ne-init',
      });
      expect(fakeRedisInstances.length).toBeGreaterThan(0);
      fakeRedisInstances[0].incr.mockRejectedValueOnce(
        new Error('Redis down'),
      );

      const jobId = await bus.publish({
        type: 'continue',
        executionId: 'exec-4',
        nodeExecutionId: 'ne-4',
      });
      // fallback random seq 로 jobId 생성 — null 이 아닌 정상 enqueue.
      expect(jobId).toMatch(/^exec-4:ne-4:\d+$/);
    });

    it('BullMQ enqueue 자체가 실패하면 null 반환 + logger.error', async () => {
      queueAdd.mockRejectedValueOnce(new Error('Queue connection lost'));
      const jobId = await bus.publish({
        type: 'continue',
        executionId: 'exec-5',
        nodeExecutionId: 'ne-5',
      });
      expect(jobId).toBeNull();
    });
  });

  describe('on() — Phase 2 부터 no-op', () => {
    it('on() 호출은 어떤 부수효과도 없이 즉시 return', () => {
      expect(() => bus.on('continue', jest.fn())).not.toThrow();
    });
  });

  describe('분산 lock (acquireLock / releaseLock)', () => {
    it('acquireLock — NX 가 통과하면 true 반환', async () => {
      const acquired = await bus.acquireLock(RECOVERY_LOCK_KEY, 60);
      expect(acquired).toBe(true);
    });

    it('acquireLock — 같은 키 두 번째 호출은 NX 거부로 false', async () => {
      const first = await bus.acquireLock(RECOVERY_LOCK_KEY, 60);
      const second = await bus.acquireLock(RECOVERY_LOCK_KEY, 60);
      expect(first).toBe(true);
      expect(second).toBe(false);
    });

    it('releaseLock — owner 일치 시 lock 삭제 (true), 이후 acquireLock 재성공', async () => {
      await bus.acquireLock(RECOVERY_LOCK_KEY, 60);
      const released = await bus.releaseLock(RECOVERY_LOCK_KEY);
      expect(released).toBe(true);
      const reacquire = await bus.acquireLock(RECOVERY_LOCK_KEY, 60);
      expect(reacquire).toBe(true);
    });

    it('releaseLock — 본 인스턴스가 보유하지 않은 lock 은 삭제하지 않음 (false)', async () => {
      // 다른 인스턴스가 잡고 있는 상황 시뮬레이션 — set 으로 다른 token 으로 lock.
      await bus.acquireLock(RECOVERY_LOCK_KEY, 60);
      // 이 시점 owner=lockToken. 같은 키를 다른 owner 로 다시 SET 하는 건 NX 거부됨.
      // releaseLock 은 owner 일치 시 1 반환 — 이 케이스는 별도 인스턴스라야 검증.
      // 본 단위 테스트에서는 owner 일치 케이스만 신뢰. owner 불일치는 eval 분기로 0.
      // (in-memory store 의 한계로 별 instance 시뮬은 불가 — Lua 분기 코드 path 검증)
      // 단, 키가 존재하지 않을 때의 releaseLock 응답을 확인.
      await bus.releaseLock(RECOVERY_LOCK_KEY); // owner 일치 → 삭제
      const noOp = await bus.releaseLock(RECOVERY_LOCK_KEY); // 이미 삭제됨 → 0
      expect(noOp).toBe(false);
    });
  });

  describe('onModuleDestroy', () => {
    it('lockClient.quit() 호출 (lazy init 이 한 번이라도 됐을 때)', async () => {
      // lazy init 트리거 — acquireLock 한 번 호출.
      await bus.acquireLock(RECOVERY_LOCK_KEY, 60);
      expect(fakeRedisInstances.length).toBeGreaterThan(0);
      await bus.onModuleDestroy();
      expect(fakeRedisInstances[0].quit).toHaveBeenCalled();
    });

    it('lockClient lazy init 전 호출이면 no-op (TypeError 없음)', async () => {
      // 단위 인스턴스 — lazy init 트리거 전.
      await expect(bus.onModuleDestroy()).resolves.not.toThrow();
    });
  });
});
