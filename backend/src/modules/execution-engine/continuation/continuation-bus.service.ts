import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { hostname } from 'node:os';
import { randomUUID } from 'node:crypto';
import Redis, { RedisOptions } from 'ioredis';

/**
 * 분산 인스턴스에 걸친 워크플로 실행 재개 / 취소 / 사용자 입력 전달용
 * 메시지 타입.
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
  payload?: unknown;
};

/**
 * Continuation 메시지가 분산되는 단일 Redis pub/sub 채널. spec §9.2 (Redis
 * 키 컨벤션) 의 예외 — workspace 단위가 아니라 전역이며, 키 패턴
 * `{service}:{resource}` 를 따른다 (인증 / 입력 라우팅의 cross-cutting 성격).
 */
export const CONTINUATION_CHANNEL = 'execution:continuation';

/**
 * 부팅 시 stuck recovery 분산 lock 키. spec §9.2 의 전역 키 예외.
 */
export const RECOVERY_LOCK_KEY = 'exec:recover:lock';

/**
 * 다중 인스턴스 환경에서 사용자 입력 (form / button / ai-message / cancel) 을
 * 정확히 호스팅 인스턴스의 Promise resolver 로 라우팅하기 위한 Redis pub/sub
 * 버스. Promise 의 resolve/reject 자체는 직렬화 불가능하므로 인스턴스에 머물고,
 * 이벤트만 모든 인스턴스에 publish 한다 — 키가 있는 인스턴스 한 곳만 hit.
 *
 * 설계 근거:
 * - LB 가 WebSocket 호출을 어느 인스턴스로 보낼지 모르는 상태로 진입.
 * - "내 Map 에 있으면 직접, 없으면 publish" 분기는 race window 가 생긴다.
 * - 항상 publish + 모든 인스턴스 수신 → 정확히 한 인스턴스만 처리. 단순.
 * - Redis pub/sub round-trip 은 ms 단위라 사용자 체감 지연 무시 가능.
 *
 * pub/sub 모드는 connection 분리 필수 — 동일 connection 으로 publish 할 수
 * 없다 (subscribe 후 connection 은 read-only command 만 받음).
 */
/**
 * 라이프사이클 race 가드 정책: `publisher` / `subscriber` 는 `onModuleInit`
 * 에서 비로소 할당되므로 타입을 `Redis | undefined` 로 선언한다. 같은 모듈
 * 내 다른 service 의 `onModuleInit` 이 본 service 보다 먼저 실행되며 public
 * API (`publish` / `acquireLock` / `releaseLock`) 를 호출하는 경우에도
 * process crash 가 나지 않도록 진입부에서 publisher 가드를 둔다. subscriber
 * 는 외부에 노출되지 않고 `onModuleInit` 내부에서만 사용되므로 별도 가드를
 * 두지 않는다.
 */
@Injectable()
export class ContinuationBusService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ContinuationBusService.name);
  private publisher?: Redis;
  private subscriber?: Redis;
  private readonly handlers = new Map<
    ContinuationType,
    (msg: ContinuationMessage) => void
  >();
  /** publish 중인 in-flight 작업 — onModuleDestroy 가 graceful 하게 대기. */
  private readonly inflight = new Set<Promise<unknown>>();
  /** 분산 lock 의 owner token — 컨테이너에서도 고유 (hostname + UUID). */
  private readonly lockToken = `${hostname()}:${randomUUID()}`;
  /** subscribe 가 완료됐는지 — 핸들러 등록 race window 완전 닫힘 표지. */
  private subscribed = false;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
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
    };
    // 로컬 변수로 setup 한 뒤 마지막에 this 에 할당한다 — subscribe 가 끝나기
    // 전 외부 호출자에게 publisher 가 노출되지 않게 함 (race 회피). 타입
    // 시스템에도 await 사이 narrowing 이 풀리지 않는다.
    const publisher = new Redis(opts);
    const subscriber = new Redis(opts);

    // ioredis 의 'error' 이벤트는 unhandled 일 경우 process crash 를 유발한다.
    // 명시적으로 listener 를 달아 로깅으로 처리하고 계속 진행한다.
    publisher.on('error', (err: Error) => {
      this.logger.error(`Redis publisher error: ${err.message}`);
    });
    subscriber.on('error', (err: Error) => {
      this.logger.error(`Redis subscriber error: ${err.message}`);
    });

    subscriber.on('message', (_channel: string, raw: string) => {
      this.dispatch(raw);
    });
    await subscriber.subscribe(CONTINUATION_CHANNEL);

    this.publisher = publisher;
    this.subscriber = subscriber;
    this.subscribed = true;
  }

  async onModuleDestroy(): Promise<void> {
    // 진행 중 publish 가 모두 정착 (성공/실패 무관) 한 뒤에 connection 종료.
    await Promise.allSettled(this.inflight);
    // ioredis 의 quit() 은 in-flight command 를 graceful 하게 마무리하고 닫는다.
    await Promise.allSettled([this.subscriber?.quit(), this.publisher?.quit()]);
  }

  /**
   * 모든 인스턴스에 메시지를 송출한다. 자기 인스턴스도 동일 채널 구독자이므로
   * 핸들러가 등록돼 있다면 본인 콜이 다시 들어온다 — `pendingContinuations`
   * Map 키가 있는 인스턴스 하나만 실제 resolve 를 수행한다.
   *
   * 호출자가 awaiting 하지 않더라도 publish 실패가 silent 로 사라지지
   * 않도록 본 메서드 내부에서 catch + 로깅을 수행한다. 호출자는 수신 보장은
   * 하지 못하지만, 적어도 운영 로그로 Redis 장애를 인지할 수 있다.
   *
   * publisher 가 미초기화 (`onModuleInit` 이전 호출) 인 경우에도 throw 대신
   * `null` 반환 + `logger.error` 로 기록한다 — 라이프사이클 race 방어.
   */
  async publish(msg: ContinuationMessage): Promise<number | null> {
    const publisher = this.publisher;
    if (!publisher) {
      this.logger.error(
        `Continuation publish 실패 (${ContinuationBusService.sanitizeForLog(
          msg.type,
        )} / ${ContinuationBusService.sanitizeForLog(
          msg.executionId,
        )}): Redis publisher 미초기화 — onApplicationBootstrap 이후에 호출하세요.`,
      );
      return null;
    }
    const task = publisher
      .publish(CONTINUATION_CHANNEL, JSON.stringify(msg))
      .catch((err: unknown) => {
        this.logger.error(
          `Continuation publish 실패 (${ContinuationBusService.sanitizeForLog(
            msg.type,
          )} / ${ContinuationBusService.sanitizeForLog(msg.executionId)}): ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
        return null;
      });
    this.inflight.add(task);
    void task.finally(() => this.inflight.delete(task));
    return task;
  }

  /**
   * 메시지 타입별 핸들러를 등록한다. 같은 타입에 대해 여러 번 호출하면
   * 마지막 등록만 유지된다 (현재 사용 패턴: ExecutionEngineService 가
   * onModuleInit 에서 5개 타입 1회 등록).
   */
  on(
    type: ContinuationType,
    handler: (msg: ContinuationMessage) => void,
  ): void {
    this.handlers.set(type, handler);
  }

  /**
   * Redis SET NX 분산 lock — 다중 인스턴스가 같은 작업을 중복 수행하지
   * 못하도록 보장. 대표 사용처: `recoverStuckExecutions` 가 부팅 시 동시에
   * 여러 인스턴스에서 stuck row 를 FAIL 시키지 않도록 하는 가드.
   *
   * lock 의 owner 식별자로 `process.pid` 대신 `hostname + UUID` 를 사용한다 —
   * 컨테이너 환경에서 모든 인스턴스가 PID 1 을 갖는 경우에도 고유성 보장.
   *
   * @returns 획득 성공 시 true. 다른 인스턴스가 이미 보유 / Redis 오류 /
   *          publisher 미초기화 (라이프사이클 race) 시 false.
   */
  async acquireLock(key: string, ttlSeconds: number): Promise<boolean> {
    const publisher = this.publisher;
    if (!publisher) {
      this.logger.error(
        `acquireLock(${ContinuationBusService.sanitizeForLog(
          key,
        )}) 실패: Redis publisher 미초기화 — onApplicationBootstrap 이후에 호출하세요.`,
      );
      return false;
    }
    try {
      const result = await publisher.set(
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
   *
   * 본 메서드는 best-effort 동작 — TTL expire 가 fallback 이므로 Redis 오류는
   * `logger.warn` 으로 기록한다. 단, publisher 미초기화는 acquireLock 과 동일
   * 라이프사이클 race 결함이므로 동일 severity (`logger.error`) 로 기록한다.
   *
   * @returns owner 일치 시 true. 불일치 / Redis 오류 / publisher 미초기화
   *          (라이프사이클 race) 시 false.
   */
  async releaseLock(key: string): Promise<boolean> {
    const publisher = this.publisher;
    if (!publisher) {
      this.logger.error(
        `releaseLock(${ContinuationBusService.sanitizeForLog(
          key,
        )}) 실패: Redis publisher 미초기화 — onApplicationBootstrap 이후에 호출하세요.`,
      );
      return false;
    }
    const script =
      "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end";
    try {
      const result = await publisher.eval(script, 1, key, this.lockToken);
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

  /** 테스트 / observability 용 — subscribe 완료 여부. */
  isSubscribed(): boolean {
    return this.subscribed;
  }

  /**
   * 로그 인젝션 방어 — 외부 출처일 가능성이 있는 값을 운영 로그에 남길 때
   * 제어문자 (`\x00-\x1F`, `\x7F`) 를 공백으로 치환하고 길이를 제한한다.
   * Redis pub/sub 채널은 외부 publish 가 가능하므로 메시지 필드 (`type`,
   * `executionId`) 와 lock key 모두 본 헬퍼를 거쳐 로깅한다.
   */
  private static sanitizeForLog(value: unknown, maxLength = 200): string {
    const str = typeof value === 'string' ? value : String(value);
    // eslint-disable-next-line no-control-regex
    return str.slice(0, maxLength).replace(/[\x00-\x1F\x7F]/g, ' ');
  }

  private dispatch(raw: string): void {
    let msg: ContinuationMessage;
    try {
      msg = JSON.parse(raw) as ContinuationMessage;
    } catch (error) {
      this.logger.warn(
        `Continuation bus 메시지 파싱 실패: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return;
    }
    if (!msg || typeof msg.type !== 'string' || !msg.executionId) {
      this.logger.warn(
        `Continuation bus 메시지 형식이 올바르지 않음: ${ContinuationBusService.sanitizeForLog(
          raw,
        )}`,
      );
      return;
    }
    const handler = this.handlers.get(msg.type);
    if (!handler) return;
    try {
      handler(msg);
    } catch (error) {
      this.logger.error(
        `Continuation handler (${ContinuationBusService.sanitizeForLog(
          msg.type,
        )}) 에러 — execution=${ContinuationBusService.sanitizeForLog(
          msg.executionId,
        )}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
