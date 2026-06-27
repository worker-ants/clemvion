import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import Redis from 'ioredis';

import { ExecutionSeqAllocator } from '../src/modules/websocket/execution-seq-allocator.service';
import type { RedisConnectionProvider } from '../src/common/redis/redis-connection.provider';

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

/** 분산 발급 부하 테스트(테스트 1·2)의 총 발급 수 — 인스턴스당 절반씩 동시 발사. */
const ALLOC_COUNT = 1000;
/** process.hrtime.bigint() 의 나노초 → 밀리초 환산 상수. */
const NS_PER_MS = 1e6;
/** 측정 로그 공통 접두어. */
const LOG_PREFIX = '[seq-load]';
/** latency 분포 보고용 p95 분위수. */
const P95_PERCENTILE = 0.95;

/**
 * 실 ioredis 연결 하나를 ExecutionSeqAllocator 가 기대하는 RedisConnectionProvider
 * 표면 (getClient / getClientOrNull) 으로 감싸는 최소 어댑터. 각 인스턴스가 자기
 * 연결을 소유 → Redis 관점에서 별도 클라이언트(=별도 backend 인스턴스).
 *
 * 반환 타입을 실 `RedisConnectionProvider` 의 `Pick` 으로 묶어 두 메서드 시그니처가
 * 인터페이스 drift 시 컴파일 에러로 잡히게 한다 (blind `as never` 대비 안전). 주입
 * 시점의 cast 는 provider 가 private 멤버를 가져 구조적 매칭이 불가하기 때문 (아래 참조).
 */
function makeProvider(
  client: Redis,
): Pick<RedisConnectionProvider, 'getClient' | 'getClientOrNull'> {
  return {
    getClient: () => client,
    getClientOrNull: () => client,
  };
}

/**
 * 두 인스턴스의 `next()` 를 인터리브해 같은 executionId 로 동시에 발사한다 —
 * 같은 Redis 키에 대한 cross-instance race 를 최대화하기 위함. 인스턴스당 `total/2`
 * 호출. 발급된 seq 배열(발사 순서)을 반환한다. (테스트 1·2 공용 — 중복 제거.)
 */
async function allocateConcurrentlyAcrossInstances(
  instances: readonly [ExecutionSeqAllocator, ExecutionSeqAllocator],
  executionId: string,
  total: number,
): Promise<number[]> {
  // 두 인스턴스에 정확히 절반씩 분배해야 union=1..total 가정이 성립 → 짝수만 허용.
  if (total % 2 !== 0) {
    throw new Error(`total must be even (got ${total})`);
  }
  const [a, b] = instances;
  const perInstance = total / 2;
  const calls: Array<Promise<number>> = [];
  for (let i = 0; i < perInstance; i++) {
    calls.push(a.next(executionId));
    calls.push(b.next(executionId));
  }
  return Promise.all(calls);
}

/**
 * 발급된 seq 집합이 정확히 `1..expectedCount` (중복·역전·빠짐 0) 임을 단언한다.
 * min/max 는 스프레드(`Math.min(...seqs)`) 대신 단일 패스로 구한다 — N 이 V8
 * 인자 한도(~65,536)를 넘어도 스택 오버플로우 없이 안전(테스트 1·2 공용).
 */
function assertMonotonicUniqueness(
  seqs: number[],
  expectedCount: number,
): void {
  let min = Infinity;
  let max = -Infinity;
  for (const s of seqs) {
    if (s < min) min = s;
    if (s > max) max = s;
  }
  expect(new Set(seqs).size).toBe(expectedCount); // 중복 0
  expect(min).toBe(1); // 시작 1
  expect(max).toBe(expectedCount); // 1..N 빠짐없이 (gap·역전 0)
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

    // 주입 cast: ExecutionSeqAllocator 는 RedisConnectionProvider(클래스, private 멤버 보유)를
    // DI 로 받지만, 본 테스트는 실 ioredis 를 감싼 duck-typed 어댑터(getClient/getClientOrNull
    // 만)를 주입한다. private 멤버 때문에 구조적 매칭이 불가해 `as unknown as` 이중 cast 가
    // 필요하다 — 단, makeProvider 반환이 Pick 으로 타입되어 두 메서드 시그니처 자체는 검사된다.
    allocA = new ExecutionSeqAllocator(
      makeProvider(redisA) as unknown as RedisConnectionProvider,
    );
    allocB = new ExecutionSeqAllocator(
      makeProvider(redisB) as unknown as RedisConnectionProvider,
    );
  }, 60_000);

  afterAll(async () => {
    await Promise.all([
      redisA?.quit().catch(() => undefined),
      redisB?.quit().catch(() => undefined),
    ]);
  });

  /** 두 인스턴스가 모두 발급한 키이므로 양쪽 release 로 lifecycle 계약을 완결한다. */
  function releaseBoth(executionId: string): void {
    allocA.release(executionId);
    allocB.release(executionId);
  }

  it('두 인스턴스가 같은 executionId 를 동시 발급해도 중복·역전 0 (union = 1..N)', async () => {
    const executionId = `load-${randomUUID()}`;

    try {
      const seqs = await allocateConcurrentlyAcrossInstances(
        [allocA, allocB],
        executionId,
        ALLOC_COUNT,
      );
      // 합집합이 정확히 1..ALLOC_COUNT (중복·역전·빠짐 0).
      assertMonotonicUniqueness(seqs, ALLOC_COUNT);
    } finally {
      releaseBoth(executionId);
    }
  }, 60_000);

  it('1000 events/s 부하에서 단조 유일 보장 + throughput 측정', async () => {
    const executionId = `tput-${randomUUID()}`;

    try {
      const start = process.hrtime.bigint();
      const seqs = await allocateConcurrentlyAcrossInstances(
        [allocA, allocB],
        executionId,
        ALLOC_COUNT,
      );
      const elapsedMs = Number(process.hrtime.bigint() - start) / NS_PER_MS;
      const throughput = (ALLOC_COUNT / elapsedMs) * 1000; // events/s

      // 단조 유일 보장이 부하에서도 유지 — test 1 과 동일 대칭 검증.
      assertMonotonicUniqueness(seqs, ALLOC_COUNT);

      // throughput 측정 보고 + 회귀 가드. 파이프라인 INCR 동시성으로 로컬/도커망
      // Redis 는 수천 events/s 가 정상 — 1000/s 목표 대비 큰 여유. (criterion: 1000 events/s)
      // eslint-disable-next-line no-console
      console.log(
        `${LOG_PREFIX} ${ALLOC_COUNT} allocations across 2 instances in ${elapsedMs.toFixed(
          1,
        )}ms → ${throughput.toFixed(0)} events/s`,
      );
      expect(throughput).toBeGreaterThanOrEqual(1000);
    } finally {
      releaseBoth(executionId);
    }
  }, 60_000);

  it('single-instance 발급 latency < 5ms (in-memory baseline 대비 회귀 < 5ms)', async () => {
    // 전제: 테스트 1·2 가 먼저 실행돼 연결이 warmup 된 상태. 추가로 본 테스트
    // 자체도 WARMUP 회 사전 발급해 연결·키 초기화 outlier 를 제외한다.
    const executionId = `lat-${randomUUID()}`;
    const WARMUP = 20; // 연결·키 초기화 outlier 제외.
    const SAMPLES = 200;

    try {
      for (let i = 0; i < WARMUP; i++) await allocA.next(executionId);

      const latenciesMs: number[] = [];
      for (let i = 0; i < SAMPLES; i++) {
        const start = process.hrtime.bigint();
        await allocA.next(executionId);
        latenciesMs.push(Number(process.hrtime.bigint() - start) / NS_PER_MS);
      }

      const sorted = [...latenciesMs].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      // avg/p95 는 측정 보고 전용(assert 안 함) — 회귀 가드는 outlier 에 견고한
      // median 으로만 평가한다(아래 expect). p95 는 분포 가시성을 위한 로그값.
      const p95 = sorted[Math.floor(sorted.length * P95_PERCENTILE)];
      const avg = latenciesMs.reduce((s, v) => s + v, 0) / latenciesMs.length;
      // eslint-disable-next-line no-console
      console.log(
        `${LOG_PREFIX} single-instance next() latency over ${SAMPLES} samples: ` +
          `median=${median.toFixed(3)}ms avg=${avg.toFixed(
            3,
          )}ms p95=${p95.toFixed(3)}ms`,
      );

      // in-memory baseline 은 사실상 0 → 절대 per-call latency 가 곧 회귀량.
      // median 으로 평가해 일시적 GC/네트워크 outlier 에 견고. criterion: < 5ms.
      expect(median).toBeLessThan(5);
    } finally {
      releaseBoth(executionId);
    }
  }, 60_000);
});
