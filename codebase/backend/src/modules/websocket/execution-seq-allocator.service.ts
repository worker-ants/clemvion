import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import type Redis from 'ioredis';
import { RedisConnectionProvider } from '../../common/redis/redis-connection.provider';

/**
 * `exec:cont:seq:` (continuation-bus) 와 별개의 emit-event seq 네임스페이스 default TTL.
 * sliding window: 매 next() 가 EXPIRE 를 갱신해 활성 execution 동안 키가 유지되고,
 * execution 종료 후 (마지막 emit 으로부터) TTL 경과 시 자동 회수된다 (in-memory 누수 방지와 별도로
 * Redis 측 누수 방지). 24시간 = continuation-bus 와 동일 보수값.
 */
const DEFAULT_SEQ_KEY_TTL_SECONDS = 86_400;

/**
 * Execution 단위 monotonic seq 발급기 — Redis `INCR exec:seq:<id>`.
 *
 * **배경**: WebsocketService 의 v1 seq counter 는 single-instance in-memory `Map`
 * 이었다. multi-instance 운영에서 같은 execution 의 emit 이 다른 인스턴스에서 발생하면
 * (예: continuation-bus 가 BullMQ job 으로 continuation 을 다른 worker 에 분배) seq 가
 * 중복·역전돼 외부 SSE `id:` / Notification `seq` 의 monotonic invariant
 * (Spec EIA §R7) 가 깨졌다. 본 서비스가 Redis atomic INCR 로 그 발급을 분산-안전하게
 * 강화한다 (Spec EIA §R7 "execution 별 atomic INCR" 전제 충족).
 *
 * **저장소 정책**: Redis-only (사용자 결정 2026-06-02). DB fallback 미사용.
 * Redis 미가용 시 in-memory per-instance counter 로 **degrade** — 분산 monotonic 은
 * 포기하되(single-instance baseline 과 동등) 엔진 emit 이 멈추지 않도록 best-effort
 * 단조 발급을 유지하고 `logger.warn` 으로 degraded mode 를 기록한다.
 *
 * **in-memory mirror**: Redis 정상 발급 시에도 본 인스턴스가 발급한 마지막 seq 를
 * {@link fallbackCounters} 에 mirror 한다. Redis 장애로 전환되더라도 이 인스턴스를
 * 거친 execution 은 mirror high-water mark 를 이어받아 1 로 reset 되지 않는다
 * (자기 인스턴스 기준 monotonic 연속성). 다른 인스턴스가 발급한 seq 는 mirror 에
 * 없으므로 degraded 구간의 분산 monotonic 은 보장하지 않는다 (수용된 trade-off).
 *
 * lifecycle 은 WebsocketService 의 seq 와 동일 — terminal event 발송 후 호출자가
 * {@link release} 를 호출해 in-memory mirror 를 회수하고 Redis 키를 best-effort DEL 한다.
 */
@Injectable()
export class ExecutionSeqAllocator implements OnModuleDestroy {
  private readonly logger = new Logger(ExecutionSeqAllocator.name);

  /** monotonic seq per executionId 용 Redis INCR 키 prefix. */
  private static readonly SEQ_KEY_PREFIX = 'exec:seq:';

  /**
   * Redis 미가용 시 사용하는 in-memory per-execution high-water mark.
   * 정상 경로에서도 mirror 로 갱신된다 (위 클래스 주석 참조).
   * 키 = executionId, 값 = 마지막 발급 seq. {@link release} 로 회수.
   */
  private readonly fallbackCounters = new Map<string, number>();

  private readonly seqKeyTtlSeconds: number;

  constructor(private readonly redisConn: RedisConnectionProvider) {
    // ENV 오버라이드 (양수 정수만 채택). continuation-bus 의 NaN/음수 방어 패턴 동일.
    const parsed = Number(process.env.EXECUTION_SEQ_TTL_SECONDS);
    this.seqKeyTtlSeconds =
      Number.isFinite(parsed) && parsed > 0
        ? Math.floor(parsed)
        : DEFAULT_SEQ_KEY_TTL_SECONDS;
  }

  /**
   * 공유 command 연결 반환 (INFO-12) — RedisConnectionProvider 가 lazy connect·소유.
   * config 누락 시 throw → 아래 next() 의 catch 가 degraded fallback 처리.
   */
  private getClient(): Redis {
    return this.redisConn.getClient();
  }

  /**
   * execution 채널 emit 직전에 호출. atomic INCR 후 새 seq 반환.
   * Redis 장애 시 in-memory degraded fallback (logged).
   */
  async next(executionId: string): Promise<number> {
    const key = `${ExecutionSeqAllocator.SEQ_KEY_PREFIX}${executionId}`;
    try {
      const client = this.getClient();
      // INCR + sliding-window EXPIRE 를 **단일 round-trip pipeline** 으로 묶는다 —
      // emit 당 Redis RTT 를 2회 → 1회로 절감 (대규모 ForEach / AI multi-turn 워크플로
      // latency 누적 방지). exec() → [[incrErr, seq], [expireErr, _]]. 연결 자체
      // 실패 시 reject → 아래 catch 의 degraded fallback.
      const results = await client
        .pipeline()
        .incr(key)
        .expire(key, this.seqKeyTtlSeconds)
        .exec();
      const incrEntry = results?.[0];
      if (!incrEntry) {
        throw new Error('Redis pipeline 가 INCR 결과를 반환하지 않음');
      }
      const [incrErr, seqRaw] = incrEntry;
      if (incrErr) throw incrErr;
      const seq = Number(seqRaw);
      // EXPIRE 실패는 이미 성공한 INCR(= 유효 seq)를 무효화하지 않도록 swallow —
      // 다음 발급의 pipeline 이 TTL 을 다시 시도하므로 누수는 일시적.
      const expireErr = results?.[1]?.[0];
      if (expireErr) {
        this.logger.warn(
          `seq 키 EXPIRE 실패 (${ExecutionSeqAllocator.sanitize(executionId)}): ${
            expireErr instanceof Error ? expireErr.message : String(expireErr)
          }`,
        );
      }
      // in-memory mirror — 장애 전환 시 high-water mark 를 이어받기 위함.
      this.fallbackCounters.set(executionId, seq);
      return seq;
    } catch (err) {
      // degraded: in-memory per-instance monotonic. 분산 monotonic 미보장(수용된 mode).
      const current = this.fallbackCounters.get(executionId) ?? 0;
      const degradedSeq = current + 1;
      this.fallbackCounters.set(executionId, degradedSeq);
      this.logger.warn(
        `Redis INCR 실패 — in-memory degraded seq=${degradedSeq} ` +
          `(${ExecutionSeqAllocator.sanitize(executionId)}): ${
            err instanceof Error ? err.message : String(err)
          }`,
      );
      return degradedSeq;
    }
  }

  /**
   * terminal event 발송 후 호출 — in-memory mirror 회수 + Redis 키 best-effort DEL.
   * DEL 실패해도 TTL 이 결국 회수하므로 swallow. 같은 executionId 가 즉시 재사용되면
   * (테스트 fixture 등) seq 가 1 부터 다시 시작 — 정상 흐름에서는 execution id 가
   * UUID 라 충돌하지 않는다 (수용된 trade-off).
   */
  release(executionId: string): void {
    this.fallbackCounters.delete(executionId);
    // best-effort DEL — 공유 연결이 가용할 때만 시도 (config 누락 시 null → skip).
    // release 는 종료 정리이므로 getClientOrNull 로 degrade-safe.
    const client = this.redisConn.getClientOrNull();
    if (client) {
      const key = `${ExecutionSeqAllocator.SEQ_KEY_PREFIX}${executionId}`;
      client.del(key).catch((err: unknown) => {
        this.logger.warn(
          `seq 키 DEL 실패 (${ExecutionSeqAllocator.sanitize(executionId)}): ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
        return 0;
      });
    }
  }

  onModuleDestroy(): void {
    // graceful shutdown 시 in-memory mirror 반납 (release 누락분 누수 방지).
    // 공유 connection 은 RedisConnectionProvider 가 소유·종료 (INFO-12) — 본 서비스는 quit 안 함.
    this.fallbackCounters.clear();
  }

  /** 로그 인젝션 방지 — executionId 의 CR/LF/탭 제거 (기타 C0 생략) + 길이 cap. */
  private static sanitize(value: string): string {
    return String(value)
      .replace(/[\r\n\t]/g, ' ')
      .slice(0, 128);
  }
}
