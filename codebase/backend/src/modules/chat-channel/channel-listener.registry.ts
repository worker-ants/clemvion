import { Injectable, Logger } from '@nestjs/common';
import {
  ChannelListenerBus,
  type ChannelListenerChange,
} from './channel-listener.bus';

/**
 * [채팅 채널 「R8 트리거 단위 listener 정책」](CLE-CHAT-CORE#r8-트리거-단위-listener-정책) per-trigger listener registry.
 *
 * `ChatChannelDispatcher` 는 모듈 단위 1회 subscription 을 유지하지만, 본 registry 가
 * (a) trigger 삭제 후 race event 안전 가드 — `unregister` 호출 후 도달하는 event 는 handle 에서 skip
 * (b) hot reload / process restart 후 listener 미등록 race window 회피 — bootstrap 에서 일괄 register
 * (c) handle() 의 DB round-trip 절감 — registry 에 없는 trigger 의 event 는 silent skip
 *
 * 세 가지 invariant 를 강화한다. message routing 자체는 여전히 `ChatChannelDispatcher.handle()`
 * 안에서 일어나며 본 registry 는 lifecycle 추적 + 사전 가드 용도.
 *
 * **다중 인스턴스** (NERV Task `CLE-T-PXTGVQ`): `Map` 은 프로세스마다 따로 있다. `register` ·
 * `unregister` 는 자기 `Map` 을 바꾼 뒤 {@link ChannelListenerBus} 로 다른 인스턴스에 알리고,
 * 다른 인스턴스는 받은 변경을 자기 `Map` 에만 반영한다. `bulkRegister` 는 알리지 않는다.
 * 인스턴스마다 DB 에서 스스로 복원하기 때문이다. Redis 가 없으면 bus 가 알리기를 건너뛰어
 * 프로세스 안에서만 바뀐다(단일 인스턴스 동작). bus 는 필수 의존성이다 — 빠지면 DI 가 기동을
 * 실패시킨다. 조용히 단일 인스턴스로 내려앉게 두지 않는다.
 *
 * SoT:
 *   - [채팅 채널 「R8 트리거 단위 listener 정책」](CLE-CHAT-CORE#r8-트리거-단위-listener-정책) — per-trigger listener dedup/teardown
 *   - [채팅 채널 어댑터 규약 「setupChannel 멱등의 뜻」](CLE-CHAT-ADAPTER#setupchannel-멱등의-뜻) — setupChannel 멱등성
 */
export interface ChannelListenerEntry {
  /** chat-channel provider 식별자 (telegram / slack / discord). */
  provider: string;
  /** registry 에 등록된 시각 (debug / monitoring 용도). */
  registeredAt: Date;
}

@Injectable()
export class ChannelListenerRegistry {
  private readonly logger = new Logger(ChannelListenerRegistry.name);
  private readonly entries = new Map<string, ChannelListenerEntry>();

  constructor(private readonly bus: ChannelListenerBus) {
    this.bus.onChange((change) => this.applyRemote(change));
  }

  /**
   * Trigger 의 chat-channel listener 등록. 자기 `Map` 에 넣은 뒤 다른 인스턴스에 알린다.
   *
   * 동일 `triggerId` 가 이미 있으면 entry 를 overwrite — `setupChannel()` 멱등성 정합.
   * provider 가 바뀌는 경우 (trigger 재구성) 도 새 provider 로 갱신.
   * 알리기가 실패해도 던지지 않는다(호출자의 PATCH · 생성을 실패시키지 않는다).
   */
  async register(triggerId: string, provider: string): Promise<void> {
    this.set(triggerId, provider);
    await this.broadcast({ op: 'register', triggerId, provider });
  }

  private set(triggerId: string, provider: string): void {
    if (this.entries.has(triggerId)) {
      const existing = this.entries.get(triggerId);
      if (existing && existing.provider !== provider) {
        this.logger.warn(
          `ChannelListenerRegistry: trigger=${triggerId} provider 변경 ${existing.provider} → ${provider}. 같은 trigger 의 provider 변경은 미지원 — 재생성 권장.`,
        );
      }
    }
    this.entries.set(triggerId, { provider, registeredAt: new Date() });
  }

  /**
   * Trigger 의 chat-channel listener 해제. 트리거 행을 없애는 경로의 외부 해제 단계
   * (`TriggerResourceReleaser`)가 부른다. 자기 `Map` 에서 뺀 뒤 다른 인스턴스에 알린다.
   * 미등록 triggerId 도 graceful (noop).
   */
  async unregister(triggerId: string): Promise<void> {
    this.entries.delete(triggerId);
    await this.broadcast({ op: 'unregister', triggerId });
  }

  /** 다른 인스턴스에서 온 변경. 자기 `Map` 에만 반영하고 다시 알리지 않는다. */
  private applyRemote(change: ChannelListenerChange): void {
    if (change.op === 'register') {
      this.set(change.triggerId, change.provider);
    } else {
      this.entries.delete(change.triggerId);
    }
  }

  private async broadcast(change: ChannelListenerChange): Promise<void> {
    try {
      await this.bus.publish(change);
    } catch (err) {
      // bus 는 실패를 삼키도록 돼 있다. 그래도 새면 여기서 막는다.
      this.logger.warn(
        `ChannelListenerRegistry: trigger=${change.triggerId} ${change.op} 알리기 실패: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  /**
   * Trigger 가 active listener 로 등록됐는지 확인. `ChatChannelDispatcher.handle` 의 사전 가드.
   */
  has(triggerId: string): boolean {
    return this.entries.has(triggerId);
  }

  /** Trigger 의 listener entry 조회 (provider 식별 등 디버그 용도). */
  get(triggerId: string): ChannelListenerEntry | undefined {
    return this.entries.get(triggerId);
  }

  /**
   * 현재 등록된 listener 수 — monitoring / 테스트 용도. message routing 영향 없음.
   */
  size(): number {
    return this.entries.size;
  }

  /**
   * **DB 복원 전용** — DB 의 활성 trigger 를 자기 `Map` 에 일괄 등록한다. 다른 인스턴스에
   * 알리지 않는다. caller 는 `ChatChannelModule` 이다. 부팅(`onApplicationBootstrap`)과
   * listener 구독 연결이 (다시) 붙었을 때 부른다. `source` 는 로그에만 쓴다.
   */
  bulkRegister(
    entries: Array<{ triggerId: string; provider: string }>,
    source = 'bootstrap 복원',
  ): void {
    for (const entry of entries) {
      this.entries.set(entry.triggerId, {
        provider: entry.provider,
        registeredAt: new Date(),
      });
    }
    this.logger.log(
      `ChannelListenerRegistry: ${source} — ${entries.length}건 등록`,
    );
  }
}
