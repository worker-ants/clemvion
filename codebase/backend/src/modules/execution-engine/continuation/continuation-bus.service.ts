import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { hostname } from 'node:os';
import { randomUUID } from 'node:crypto';
import Redis, { RedisOptions } from 'ioredis';
import {
  CONTINUATION_EXECUTION_QUEUE,
  CONTINUATION_QUEUE_DEFAULT_OPTS,
  buildContinuationJobId,
  type ContinuationJob,
} from '../queues/continuation-execution.queue';

/**
 * Phase 2 — Durable Continuation Bus.
 *
 * SoT: spec/5-system/4-execution-engine.md §7.4 / §7.5.
 *
 * 옛 Redis pub/sub 채널 `execution:continuation` (at-most-once) 을 BullMQ
 * 영속 큐 `execution-continuation` (at-least-once + dead-letter) 로 교체한
 * 후속. publish API 표면은 호환 유지 — caller 가 BullMQ infra 를 직접
 * 알 필요 없도록 ContinuationBusService 가 단일 진입점.
 *
 * 라우팅 원칙 (spec §7.4 Rationale): **모든 진입점 항상 enqueue**.
 * 자기 인스턴스가 host 인 경우에도 BullMQ 경유 (sticky fast-path 도입 안 함).
 * Worker (continuation-execution.processor.ts) 가 pick up 후 로컬
 * `pendingContinuations` Map 키 hit 면 즉시 resolve, miss 면 §7.5
 * rehydration 경로.
 */
export type ContinuationType =
  | 'continue'
  | 'cancel'
  | 'button_click'
  | 'ai_message'
  | 'ai_end_conversation';

export type ContinuationMessage = {
  type: ContinuationType;
  executionId: string;
  /**
   * Phase 2 (workflow-resumable-execution) — §7.5 rehydration 경로에서
   * NodeExecution 체크포인트 lookup 의 1차 키. publisher 가 enqueue 직전
   * `execution_id + node_id + status='waiting_for_input'` lookup 으로 채운다.
   *
   * legacy publisher (Phase 1 까지) 가 미설정으로 호출할 수 있어 optional 로
   * 두지만, Phase 2 worker 는 이 값이 없으면 fast-path 만 지원하고 rehydration
   * 은 `RESUME_CHECKPOINT_MISSING` 으로 실패한다.
   */
  nodeExecutionId?: string;
  payload?: unknown;
};

/**
 * 부팅 시 stuck recovery 분산 lock 키. spec §9.2 의 전역 키 예외.
 */
export const RECOVERY_LOCK_KEY = 'exec:recover:lock';

/**
 * G3 (spec §9.2) — `exec:cont:seq:<executionId>` 키 TTL 기본값 (초, 24시간).
 *
 * sliding window: 매 publish (`nextSeq`) 가 EXPIRE 를 갱신해 continuation 이
 * 활성인 동안 키가 유지되고, executionId 종결 후 (publish 중단) TTL 경과 시
 * 자연 소멸 → 옛 "TTL 미설정 잔류" 메모리 누수 해소. seq 단조성은 활성 구간
 * 내내 보존된다 (활성 구간 = window 미만 간격으로 publish 가 이어지는 동안).
 *
 * 인터랙티브 워크플로의 executionId 최대 수명 + 여유를 커버. 더 긴 대기가
 * 필요한 배포는 ENV `CONTINUATION_SEQ_TTL_SECONDS` (양수 정수) 로 오버라이드.
 */
export const DEFAULT_SEQ_KEY_TTL_SECONDS = 86_400;

@Injectable()
export class ContinuationBusService {
  private readonly logger = new Logger(ContinuationBusService.name);
  /** lock 용 Redis 클라이언트. BullMQ 큐와 별개 (BullMQ 가 자체 관리). */
  private lockClient?: Redis;
  /** 분산 lock 의 owner token — 컨테이너에서도 고유 (hostname + UUID). */
  private readonly lockToken = `${hostname()}:${randomUUID()}`;
  /** monotonic seq per executionId 용 Redis INCR 키 prefix. */
  private static readonly SEQ_KEY_PREFIX = 'exec:cont:seq:';
  /** seq 키 sliding-window TTL (초). G3 — spec §9.2. */
  private readonly seqKeyTtlSeconds: number;

  constructor(
    private readonly configService: ConfigService,
    @InjectQueue(CONTINUATION_EXECUTION_QUEUE)
    private readonly continuationQueue: Queue<ContinuationJob>,
  ) {
    // ENV 오버라이드 (양수 정수만 채택, 그 외 기본값). shutdown 모듈의
    // SIGTERM_GRACE_MS 팩토리와 동일한 NaN/음수 방어 패턴.
    const parsed = Number(process.env.CONTINUATION_SEQ_TTL_SECONDS);
    this.seqKeyTtlSeconds =
      Number.isFinite(parsed) && parsed > 0
        ? Math.floor(parsed)
        : DEFAULT_SEQ_KEY_TTL_SECONDS;
  }

  /**
   * Lazy 초기화: lockClient 가 처음 필요할 때 connect.
   * onModuleInit 으로 미루지 않는 이유 — 모듈 초기화 순서 race 회피
   * (다른 onModuleInit 이 본 service 의 publish/acquireLock 을 호출하는 경우).
   */
  private getLockClient(): Redis {
    if (!this.lockClient) {
      const host = this.configService.get<string>('redis.host');
      const port = this.configService.get<number>('redis.port');
      if (!host || !port) {
        throw new Error(
          'redis.host / redis.port 설정이 누락됐습니다. 환경 변수 REDIS_HOST / REDIS_PORT 를 확인하세요.',
        );
      }
      const password = this.configService.get<string>('redis.password');
      const tlsEnabled = this.configService.get<boolean>('redis.tls');
      const opts: RedisOptions = {
        host,
        port,
        ...(password ? { password } : {}),
        ...(tlsEnabled ? { tls: {} } : {}),
        // lock 전용이므로 ready check 와 retry 정책은 BullMQ 기본보다 보수적.
        enableReadyCheck: true,
        maxRetriesPerRequest: 3,
      };
      this.lockClient = new Redis(opts);
      this.lockClient.on('error', (err: Error) => {
        this.logger.error(`Redis lockClient error: ${err.message}`);
      });
    }
    return this.lockClient;
  }

  async onModuleDestroy(): Promise<void> {
    if (this.lockClient) {
      await this.lockClient.quit().catch(() => undefined);
    }
  }

  /**
   * BullMQ 큐에 continuation job 을 enqueue.
   *
   * Phase 2 — 옛 Redis pub/sub `bus.publish` 의 호환 표면. caller signature 는
   * 그대로 유지하되 내부적으로 영속 큐 사용. jobId 가 idempotency key —
   * `${executionId}:${nodeExecutionId}:${seq}` 형태로 monotonic 증가.
   *
   * @returns enqueue 성공 시 jobId, 실패 (Redis 장애) 시 null + logger.error.
   */
  async publish(msg: ContinuationMessage): Promise<string | null> {
    const nodeExecutionId = msg.nodeExecutionId ?? '__no_node_exec__';
    try {
      const seq = await this.nextSeq(msg.executionId);
      const jobId = buildContinuationJobId(
        msg.executionId,
        nodeExecutionId,
        seq,
      );
      const job: ContinuationJob = {
        type: msg.type,
        executionId: msg.executionId,
        nodeExecutionId,
        payload: msg.payload,
      };
      await this.continuationQueue.add('continuation', job, {
        jobId,
        ...CONTINUATION_QUEUE_DEFAULT_OPTS,
      });
      return jobId;
    } catch (err) {
      this.logger.error(
        `Continuation enqueue 실패 (${ContinuationBusService.sanitizeForLog(
          msg.type,
        )} / ${ContinuationBusService.sanitizeForLog(msg.executionId)}): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return null;
    }
  }

  /**
   * 옛 `on(type, handler)` API 호환 호출 — Phase 2 부터는 BullMQ Worker
   * (continuation-execution.processor.ts) 가 처리하므로 본 메서드는 **no-op**.
   * 옛 ExecutionEngineService.registerContinuationHandlers() 가 호출하던
   * 5개 type 등록은 processor 의 단일 dispatcher 로 이전.
   *
   * @deprecated Phase 2 부터는 worker 가 처리. 호출 코드 제거 예정.
   */
  on(
    _type: ContinuationType,
    _handler: (msg: ContinuationMessage) => void,
  ): void {
    this.logger.debug(
      'ContinuationBusService.on() 호출은 Phase 2 부터 no-op — worker (continuation-execution.processor.ts) 가 dispatch 담당',
    );
  }

  /**
   * monotonic 증가 seq per executionId. Redis INCR — 동시 호출에서도 단조
   * 증가 보장. 같은 executionId 의 두 publish 가 같은 seq 를 받으면 jobId
   * 가 같아져 BullMQ 가 두 번째를 중복으로 거부한다 (idempotency 1단 가드).
   */
  private async nextSeq(executionId: string): Promise<number> {
    const key = `${ContinuationBusService.SEQ_KEY_PREFIX}${executionId}`;
    try {
      const client = this.getLockClient();
      const seq = await client.incr(key);
      // G3 (spec §9.2) — sliding-window TTL. 매 publish 가 만료 시계를 갱신.
      // EXPIRE 실패는 이미 성공한 INCR (= 유효 seq) 를 무효화하지 않도록 swallow
      // — 다음 publish 가 TTL 을 다시 시도하므로 누수는 일시적.
      await client.expire(key, this.seqKeyTtlSeconds).catch((err: unknown) => {
        this.logger.warn(
          `seq 키 EXPIRE 설정 실패 (${ContinuationBusService.sanitizeForLog(
            executionId,
          )}): ${err instanceof Error ? err.message : String(err)}`,
        );
        return 0;
      });
      return seq;
    } catch (err) {
      this.logger.warn(
        `nextSeq Redis INCR 실패 (${ContinuationBusService.sanitizeForLog(
          executionId,
        )}): ${err instanceof Error ? err.message : String(err)} — fallback random seq`,
      );
      // fallback: random 16-bit seq. 충돌 확률 매우 낮으나 결정적 보장 없음.
      return Math.floor(Math.random() * 65536) + 1_000_000;
    }
  }

  /**
   * Redis SET NX 분산 lock — 다중 인스턴스가 같은 작업을 중복 수행하지
   * 못하도록 보장. 대표 사용처: recoverStuckExecutions 가 부팅 시 동시에
   * 여러 인스턴스에서 stuck row 를 FAIL 시키지 않도록 하는 가드.
   *
   * Phase 2 — 옛 publisher Redis 클라이언트가 BullMQ 로 이전되었으므로 lock
   * 전용 별도 ioredis 클라이언트를 lazy 초기화 (getLockClient).
   */
  async acquireLock(key: string, ttlSeconds: number): Promise<boolean> {
    try {
      const client = this.getLockClient();
      const result = await client.set(
        key,
        this.lockToken,
        'EX',
        ttlSeconds,
        'NX',
      );
      return result === 'OK';
    } catch (err) {
      this.logger.error(
        `acquireLock(${ContinuationBusService.sanitizeForLog(key)}) 실패: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return false;
    }
  }

  /**
   * 본 인스턴스가 보유 중인 lock 을 명시적으로 해제. Lua script 로 owner
   * 검증 후 DEL — token 일치 시에만 삭제해 다른 인스턴스가 잡고 있는 lock
   * 을 잘못 해제하지 않는다.
   */
  async releaseLock(key: string): Promise<boolean> {
    const script =
      "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end";
    try {
      const client = this.getLockClient();
      const result = await client.eval(script, 1, key, this.lockToken);
      return result === 1;
    } catch (err) {
      this.logger.warn(
        `releaseLock(${ContinuationBusService.sanitizeForLog(key)}) 실패: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return false;
    }
  }

  /**
   * 로그 인젝션 방어 — 외부 출처일 가능성이 있는 값을 운영 로그에 남길 때
   * 제어문자 (`\x00-\x1F`, `\x7F`) 를 공백으로 치환하고 길이를 제한한다.
   */
  private static sanitizeForLog(value: unknown, maxLength = 200): string {
    const str = typeof value === 'string' ? value : String(value);
    // eslint-disable-next-line no-control-regex
    return str.slice(0, maxLength).replace(/[\x00-\x1F\x7F]/g, ' ');
  }
}
