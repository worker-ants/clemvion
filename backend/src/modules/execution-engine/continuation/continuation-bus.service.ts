import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

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

const CHANNEL = 'execution:continuation';

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
@Injectable()
export class ContinuationBusService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ContinuationBusService.name);
  private publisher!: Redis;
  private subscriber!: Redis;
  private readonly handlers = new Map<
    ContinuationType,
    (msg: ContinuationMessage) => void
  >();

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const host = this.configService.get<string>('redis.host');
    const port = this.configService.get<number>('redis.port');
    this.publisher = new Redis({ host, port });
    this.subscriber = new Redis({ host, port });

    this.subscriber.on('message', (_channel: string, raw: string) => {
      this.dispatch(raw);
    });
    await this.subscriber.subscribe(CHANNEL);
  }

  async onModuleDestroy(): Promise<void> {
    // ioredis 의 quit() 은 in-flight command 를 graceful 하게 마무리하고 닫는다.
    await Promise.allSettled([this.subscriber?.quit(), this.publisher?.quit()]);
  }

  /**
   * 모든 인스턴스에 메시지를 송출한다. 자기 인스턴스도 동일 채널 구독자이므로
   * 핸들러가 등록돼 있다면 본인 콜이 다시 들어온다 — `pendingContinuations`
   * Map 키가 있는 인스턴스 하나만 실제 resolve 를 수행한다.
   */
  async publish(msg: ContinuationMessage): Promise<number> {
    return this.publisher.publish(CHANNEL, JSON.stringify(msg));
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
   * @returns 획득 성공 시 true, 다른 인스턴스가 이미 보유 시 false.
   */
  async acquireLock(key: string, ttlSeconds: number): Promise<boolean> {
    const result = await this.publisher.set(
      key,
      String(process.pid),
      'EX',
      ttlSeconds,
      'NX',
    );
    return result === 'OK';
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
        `Continuation bus 메시지 형식이 올바르지 않음: ${raw.slice(0, 200)}`,
      );
      return;
    }
    const handler = this.handlers.get(msg.type);
    if (!handler) return;
    try {
      handler(msg);
    } catch (error) {
      this.logger.error(
        `Continuation handler (${msg.type}) 에러 — execution=${
          msg.executionId
        }: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
