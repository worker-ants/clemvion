import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import Redis from 'ioredis';

import { ExecutionSeqAllocator } from '../src/modules/websocket/execution-seq-allocator.service';

/**
 * e2e (real-Redis integration): ExecutionSeqAllocator 분산 monotonic 부하 repro.
 *
 * 상위 plan: plan/in-progress/eia-distributed-seq-load-verify.md
 *           (← plan/complete/eia-distributed-seq-counter.md 의 선택적 경험 검증 분리분)
 * spec: spec/5-system/14-external-interaction-api.md §R7,
 *       spec/5-system/6-websocket-protocol.md §2.2 (seq envelope)
 *
 * **무엇을 검증하나**: ExecutionSeqAllocator 의 분산 monotonic 보장은 전적으로
 * Redis `INCR exec:seq:<id>` 의 원자성에 의존한다. unit 테스트
 * (execution-seq-allocator.service.spec.ts) 는 fake Redis 가 INCR 원자성을
 * 재현하도록 만들어 계약을 고정하지만, **실 Redis** + **독립 연결 두 개** 위에서
 * 그 보장이 경험적으로 성립하는지는 검증하지 않았다. 본 spec 이 그 갭을 메운다.
 *
 * **왜 두 allocator 인스턴스 = 두 backend 인스턴스인가**: Redis 입장에서 클라이언트는
 * "연결(connection)" 단위로 구분된다. 한 테스트 프로세스 안이라도 **서로 다른 ioredis
 * 연결**을 가진 두 ExecutionSeqAllocator 는, 두 backend 프로세스가 같은 Redis 를 공유하는
 * 분산 배치와 INCR 원자성 관점에서 동일하다 (INCR 는 Redis 단일 스레드에서 직렬화). 따라서
 * docker backend-e2e-2 컨테이너 없이도 분산 race 를 충실히 재현한다 (plan 의 방식 결정 참조).
 *
 * **degraded 경로와의 구별**: Redis 가 불가용이면 allocator 는 in-memory per-instance
 * 카운터로 degrade 한다. 그 경우 두 인스턴스가 각자 1 부터 발급해 cross-instance
 * 유일성이 깨진다. 본 spec 은 beforeAll 에서 PING 으로 실 Redis 가용성을 강제 확인하므로,
 * 유일성 assert 통과 = "실 Redis INCR 가 분산 발급을 직렬화했다" 의 증거다 (degraded
 * false-pass 아님).
 */

const REDIS_HOST = process.env.REDIS_HOST ?? 'redis';
const REDIS_PORT = Number(process.env.REDIS_PORT ?? '6379');

/**
 * 실 ioredis 연결 하나를 ExecutionSeqAllocator 가 기대하는 RedisConnectionProvider
 * 표면 (getClient / getClientOrNull) 으로 감싸는 최소 어댑터. 각 인스턴스가 자기
 * 연결을 소유 → Redis 관점에서 별도 클라이언트(=별도 backend 인스턴스).
 */
function makeProvider(client: Redis): {
  getClient: () => Redis;
  getClientOrNull: () => Redis | null;
} {
  return {
    getClient: () => client,
    getClientOrNull: () => client,
  };
}

describe('ExecutionSeqAllocator 분산 monotonic 부하 repro (e2e, real Redis)', () => {
  // 두 "backend 인스턴스" 를 시뮬레이션하는 독립 연결.
  let redisA: Redis;
  let redisB: Redis;
  let allocA: ExecutionSeqAllocator;
  let allocB: ExecutionSeqAllocator;

  beforeAll(async () => {
    redisA = new Redis({ host: REDIS_HOST, port: REDIS_PORT });
    redisB = new Redis({ host: REDIS_HOST, port: REDIS_PORT });
    // 실 Redis 가용성 강제 확인 — 불가용이면 allocator 가 degraded(in-memory) 로
    // 빠져 분산 유일성 검증이 무의미해지므로, 그 전에 명시적으로 실패시킨다.
    const [pongA, pongB] = await Promise.all([redisA.ping(), redisB.ping()]);
    expect(pongA).toBe('PONG');
    expect(pongB).toBe('PONG');

    allocA = new ExecutionSeqAllocator(makeProvider(redisA) as never);
    allocB = new ExecutionSeqAllocator(makeProvider(redisB) as never);
  }, 60_000);

  afterAll(async () => {
    await Promise.all([
      redisA?.quit().catch(() => undefined),
      redisB?.quit().catch(() => undefined),
    ]);
  });

  it('두 인스턴스가 같은 executionId 를 동시 발급해도 중복·역전 0 (union = 1..N)', async () => {
    const executionId = `load-${randomUUID()}`;
    const N = 1000; // 인스턴스당 500개씩, 총 1000 동시 발급.
    const perInstance = N / 2;

    try {
      // 두 인스턴스의 next() 를 인터리브해 동시에 발사 — 같은 키에 대한 race 를 최대화.
      const calls: Array<Promise<number>> = [];
      for (let i = 0; i < perInstance; i++) {
        calls.push(allocA.next(executionId));
        calls.push(allocB.next(executionId));
      }
      const seqs = await Promise.all(calls);

      // 중복 0: 발급된 seq 가 전부 유일.
      const unique = new Set(seqs);
      expect(unique.size).toBe(N);
      // 빠짐·역전 0: 두 인스턴스 발급의 합집합이 정확히 1..N (gap/중복 모두 없음).
      expect(Math.min(...seqs)).toBe(1);
      expect(Math.max(...seqs)).toBe(N);
    } finally {
      allocA.release(executionId);
    }
  }, 60_000);

  it('1000 events/s 부하에서 단조 유일 보장 + throughput 측정', async () => {
    const executionId = `tput-${randomUUID()}`;
    const N = 1000;
    const perInstance = N / 2;

    try {
      const calls: Array<Promise<number>> = [];
      const start = process.hrtime.bigint();
      for (let i = 0; i < perInstance; i++) {
        calls.push(allocA.next(executionId));
        calls.push(allocB.next(executionId));
      }
      const seqs = await Promise.all(calls);
      const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;
      const throughput = (N / elapsedMs) * 1000; // events/s

      // 단조 유일 보장이 부하에서도 유지.
      expect(new Set(seqs).size).toBe(N);
      expect(Math.max(...seqs)).toBe(N);

      // throughput 측정 보고 + 회귀 가드. 파이프라인 INCR 동시성으로 로컬/도커망
      // Redis 는 수천 events/s 가 정상 — 1000/s 목표 대비 큰 여유. (criterion: 1000 events/s)
      // eslint-disable-next-line no-console
      console.log(
        `[seq-load] ${N} allocations across 2 instances in ${elapsedMs.toFixed(
          1,
        )}ms → ${throughput.toFixed(0)} events/s`,
      );
      expect(throughput).toBeGreaterThanOrEqual(1000);
    } finally {
      allocA.release(executionId);
    }
  }, 60_000);

  it('single-instance 발급 latency < 5ms (수용 기준 #3: in-memory baseline 대비 회귀 < 5ms)', async () => {
    const executionId = `lat-${randomUUID()}`;
    const WARMUP = 20; // 연결·키 초기화 outlier 제외.
    const SAMPLES = 200;

    try {
      for (let i = 0; i < WARMUP; i++) await allocA.next(executionId);

      const latenciesMs: number[] = [];
      for (let i = 0; i < SAMPLES; i++) {
        const start = process.hrtime.bigint();
        await allocA.next(executionId);
        latenciesMs.push(Number(process.hrtime.bigint() - start) / 1e6);
      }

      const sorted = [...latenciesMs].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      const p95 = sorted[Math.floor(sorted.length * 0.95)];
      const avg = latenciesMs.reduce((s, v) => s + v, 0) / latenciesMs.length;
      // eslint-disable-next-line no-console
      console.log(
        `[seq-load] single-instance next() latency over ${SAMPLES} samples: ` +
          `median=${median.toFixed(3)}ms avg=${avg.toFixed(
            3,
          )}ms p95=${p95.toFixed(3)}ms`,
      );

      // in-memory baseline 은 사실상 0 → 절대 per-call latency 가 곧 회귀량.
      // median 으로 평가해 일시적 GC/네트워크 outlier 에 견고. criterion: < 5ms.
      expect(median).toBeLessThan(5);
    } finally {
      allocA.release(executionId);
    }
  }, 60_000);
});
