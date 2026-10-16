import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Redis } from 'ioredis';
import { RedisConnectionProvider } from '../../common/redis/redis-connection.provider';

/**
 * 트리거 단위 listener 레지스트리의 등록 · 해제를 모든 인스턴스에 알리는 Redis pub/sub 채널.
 * 접두는 이 모듈이 이미 쓰는 `chat-channel:` 이다([Redis 키 명명 규약 「규칙」](CLE-ENG-REDIS#규칙) 규칙 6).
 */
export const CHAT_CHANNEL_LISTENER_CHANNEL = 'chat-channel:listener';

/** 메시지 형식 버전. 형식을 바꾸면 올리고, 모르는 버전은 받는 쪽이 버린다. */
const MESSAGE_VERSION = 1;

/** 레지스트리에 반영할 변경 하나. */
export type ChannelListenerChange =
  | { op: 'register'; triggerId: string; provider: string }
  | { op: 'unregister'; triggerId: string };

export type ChannelListenerChangeHandler = (
  change: ChannelListenerChange,
) => void;

/** 구독이 (다시) 확립된 뒤 부르는 콜백. 거부는 bus 가 삼키고 로그만 남긴다. */
export type ChannelListenerSubscribedHandler = () => void | Promise<void>;

/**
 * 트리거 단위 listener 레지스트리(`ChannelListenerRegistry`)의 변경을 모든 인스턴스에
 * 알린다(NERV Task `CLE-T-PXTGVQ`, [채팅 채널 「R8 트리거 단위 listener 정책」](CLE-CHAT-CORE#r8-트리거-단위-listener-정책)).
 *
 * **문제**: 레지스트리는 프로세스 안 `Map` 이고 `executionEvents$` 도 그 프로세스 안에서만
 * 전달된다. 실행을 맡은 인스턴스의 dispatcher 는 자기 레지스트리만 본다. 트리거를 켜거나
 * 만든 요청을 받은 인스턴스에만 등록하면 다른 인스턴스에서 시작한 실행의 메시지가 채널로
 * 나가지 않는다. 지운 트리거도 다른 인스턴스의 레지스트리에 남는다.
 *
 * **해법**: 레지스트리가 자기 `Map` 에 반영한 뒤 이 채널로 변경을 보낸다. 다른 인스턴스는
 * 받은 변경을 자기 `Map` 에만 반영한다(다시 보내지 않는다). 메시지에 보낸 인스턴스의 id 를
 * 실어 자기 메시지는 건너뛴다. 이미 반영했고, 등록 뒤 곧바로 해제한 경우 늦게 돌아온 자기
 * 등록 메시지가 항목을 잠깐 되살리기 때문이다.
 *
 * **놓친 메시지**: pub/sub 는 저장하지 않으므로 구독 연결이 끊긴 사이의 변경은 사라진다.
 * 그래서 구독 연결이 `ready` 가 될 때마다(첫 연결 포함) SUBSCRIBE 응답을 받은 뒤
 * {@link onSubscribed} handler 를 부른다. `ChatChannelModule` 이 여기서 활성 트리거를 DB
 * 에서 다시 일괄 등록한다. 응답을 기다리는 이유는 SUBSCRIBE 가 Redis 에서 처리되기 전에
 * DB 를 읽으면 그 사이 커밋 · 발행된 등록을 둘 다 놓칠 수 있어서다. 놓친 해제는 보정하지
 * 않는다. 지운 트리거의 항목이 남아도 dispatcher 가 DB 에서 트리거를 찾지 못해 건너뛴다.
 *
 * **첫 연결의 순서**: 구독은 이 클래스의 `onModuleInit` 에서 시작하고 handler 는 모든
 * `onModuleInit` 이 끝난 뒤 `ChatChannelModule.onApplicationBootstrap` 에서 등록된다. 그래서 첫
 * SUBSCRIBE 응답이 등록보다 먼저 올 수 있고, 그때는 handler 가 불리지 않는다. 지키는 것은
 * «SUBSCRIBE 응답 뒤의 DB 읽기가 적어도 한 번 있다» 이고 두 순서가 모두 그것을 채운다.
 * 응답이 등록보다 먼저 오면 등록 직후 모듈의 부팅 복원이 DB 를 읽으므로 응답 뒤다. 응답이
 * 등록보다 늦으면 응답 뒤에 handler 가 돈다. 이때 부팅 복원의 DB 읽기는 응답 앞일 수 있고,
 * 그 읽기만으로는 놓침을 막지 못한다. 두 순서는 `chat-channel.module.spec.ts` 가 단언한다.
 *
 * **실패 정책**: 모든 pub/sub 실패는 warn 만 남기고 삼킨다. 트리거 PATCH · 삭제를 실패시키지
 * 않는다. Redis 가 없으면 프로세스 안 레지스트리만 바뀐다(단일 인스턴스 동작).
 *
 * **연결 분리**: `IntegrationCacheBus` 와 같다. 공유 command 연결에는 SUBSCRIBE 를 보내지
 * 않고 전용 `duplicate()` 연결로 구독한다. PUBLISH 는 공유 연결로 보낸다.
 */
@Injectable()
export class ChannelListenerBus implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ChannelListenerBus.name);
  /** 이 프로세스의 id. 자기 메시지를 알아보는 데만 쓴다. */
  private readonly origin = randomUUID();
  private readonly changeHandlers = new Set<ChannelListenerChangeHandler>();
  private readonly subscribedHandlers =
    new Set<ChannelListenerSubscribedHandler>();
  private subscriber: Redis | null = null;

  constructor(private readonly redis: RedisConnectionProvider) {}

  /** 다른 인스턴스에서 온 변경을 받을 handler 를 등록한다. 같은 참조는 한 번만 등록된다. */
  onChange(handler: ChannelListenerChangeHandler): void {
    this.changeHandlers.add(handler);
  }

  /** 구독이 (다시) 확립될 때마다 부를 handler 를 등록한다. */
  onSubscribed(handler: ChannelListenerSubscribedHandler): void {
    this.subscribedHandlers.add(handler);
  }

  /** 변경을 다른 인스턴스에 알린다. 실패해도 던지지 않는다. */
  async publish(change: ChannelListenerChange): Promise<void> {
    const client = this.redis.getClientOrNull();
    if (!client) return;
    const message = JSON.stringify({
      v: MESSAGE_VERSION,
      origin: this.origin,
      ...change,
    });
    try {
      await client.publish(CHAT_CHANNEL_LISTENER_CHANNEL, message);
    } catch (err) {
      this.logger.warn(
        `listener ${change.op} 발행 실패 (trigger=${change.triggerId}): ${errMessage(err)}`,
      );
    }
  }

  onModuleInit(): void {
    const base = this.redis.getClientOrNull();
    if (!base) {
      this.logger.warn(
        'Redis 미가용 — listener 레지스트리 변경을 다른 인스턴스와 주고받지 않는다',
      );
      return;
    }
    // duplicate() 는 lazyConnect 를 상속해 아래 subscribe() 가 연결을 연다. 'error' 를 먼저
    // 달아 연결 단계 오류가 unhandled 로 프로세스를 죽이지 않게 한다.
    const sub = base.duplicate();
    sub.on('error', (err: Error) => {
      this.logger.error(`listener 구독 연결 오류: ${err.message}`);
    });
    sub.on('message', (channel: string, message: string) => {
      if (channel !== CHAT_CHANNEL_LISTENER_CHANNEL) return;
      this.dispatch(message);
    });
    // ioredis 는 'ready' 직전에 끊기기 전의 채널을 다시 구독한다(autoResubscribe). 그 명령의
    // 응답은 받을 수 없어서 같은 채널을 한 번 더 구독하고 그 응답 뒤에 handler 를 부른다.
    // 이미 구독한 채널의 SUBSCRIBE 는 아무것도 바꾸지 않는다.
    sub.on('ready', () => {
      sub
        .subscribe(CHAT_CHANNEL_LISTENER_CHANNEL)
        .then(() => this.runSubscribedHandlers())
        .catch((err: unknown) => {
          this.logger.warn(`listener 채널 재구독 실패: ${errMessage(err)}`);
        });
    });
    sub.subscribe(CHAT_CHANNEL_LISTENER_CHANNEL).catch((err: unknown) => {
      this.logger.warn(`listener 채널 구독 실패: ${errMessage(err)}`);
    });
    this.subscriber = sub;
  }

  async onModuleDestroy(): Promise<void> {
    const sub = this.subscriber;
    this.subscriber = null;
    if (sub) await sub.quit().catch(() => undefined);
  }

  private dispatch(message: string): void {
    const change = this.parse(message);
    if (!change) return;
    for (const handler of this.changeHandlers) {
      try {
        handler(change);
      } catch (err) {
        this.logger.warn(
          `listener ${change.op} 반영 실패 (trigger=${change.triggerId}): ${errMessage(err)}`,
        );
      }
    }
  }

  /** 다른 인스턴스가 보낸 올바른 메시지만 변경으로 바꾼다. 나머지는 `null`. */
  private parse(message: string): ChannelListenerChange | null {
    let raw: unknown;
    try {
      raw = JSON.parse(message);
    } catch {
      this.logger.warn('listener 메시지가 JSON 이 아니어서 버린다');
      return null;
    }
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      return null;
    }
    const m = raw as Record<string, unknown>;
    if (m.v !== MESSAGE_VERSION) return null;
    if (typeof m.origin !== 'string' || m.origin.length === 0) return null;
    if (m.origin === this.origin) return null;
    if (typeof m.triggerId !== 'string' || m.triggerId.length === 0) {
      return null;
    }
    if (m.op === 'unregister') {
      return { op: 'unregister', triggerId: m.triggerId };
    }
    if (
      m.op === 'register' &&
      typeof m.provider === 'string' &&
      m.provider.length > 0
    ) {
      return { op: 'register', triggerId: m.triggerId, provider: m.provider };
    }
    return null;
  }

  private async runSubscribedHandlers(): Promise<void> {
    for (const handler of this.subscribedHandlers) {
      try {
        await handler();
      } catch (err) {
        this.logger.warn(`listener 재구독 뒤 처리 실패: ${errMessage(err)}`);
      }
    }
  }
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
