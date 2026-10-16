import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Trigger } from '../triggers/entities/trigger.entity';
import { ChannelListenerBus } from './channel-listener.bus';
import { ChannelListenerRegistry } from './channel-listener.registry';
import { readTriggerChatChannelProvider } from './chat-channel-secret-refs';

/** 복원을 요청한 곳. 로그에만 쓴다. */
type RestoreSource = '부팅' | 'listener 재구독';

/**
 * 트리거 단위 listener 레지스트리(`ChannelListenerRegistry`)를 DB 의 활성 채팅 채널 트리거로
 * 채운다([채팅 채널 「R8 트리거 단위 listener 정책」](CLE-CHAT-CORE#r8-트리거-단위-listener-정책),
 * REQ-CHAT-072). 부팅과 listener 구독 연결이 (다시) 붙을 때마다 복원한다.
 *
 * `onApplicationBootstrap` 은 모든 모듈의 init 과 DB 연결 준비가 끝난 뒤에 돈다.
 * `onModuleInit` 시점에는 typeorm repository 의 query 가 안전하지 않다.
 *
 * 구독이 다시 붙을 때도 복원하는 이유는 끊긴 사이 다른 서버 인스턴스가 보낸 등록이 pub/sub 에
 * 남지 않기 때문이다(NERV Task `CLE-T-PXTGVQ`). 이유와 순서는 `ChannelListenerBus` 머리 주석에
 * 있다. 부팅 때도 바로 복원하는 것은 Redis 가 없어 구독이 붙지 않는 경우에도 이 서버 인스턴스의
 * 레지스트리를 채우기 위해서다. 첫 SUBSCRIBE 응답이 handler 등록보다 먼저 온 경우의 응답 뒤 DB
 * 읽기도 이 부팅 복원이 맡는다. **handler 를 먼저 등록하고 그 뒤에 복원을 시작하는 순서**가 그
 * 보장의 전제다(`channel-listener.restorer.spec.ts` 「첫 연결의 SUBSCRIBE 응답 순서」).
 *
 * 구독이 반복해서 끊기면 `ready` 마다 요청이 와서 한 서버 인스턴스 안에서 조회가 겹쳐 돈다.
 * 그래서 읽기가 진행 중일 때 온 요청은 새 읽기를 시작하지 않고, 그 읽기가 끝난 뒤 한 번만 더
 * 읽는 것으로 합친다. 진행 중인 읽기는 요청보다 먼저 시작했다. 요청이 기다리는 것은 «SUBSCRIBE
 * 응답 뒤에 시작한 읽기» 라서 그 읽기로는 요청을 채울 수 없고, 뒤이은 한 번의 읽기가 그 사이에
 * 쌓인 요청을 모두 채운다. 서버 인스턴스끼리 같은 순간에 읽는 것은 막지 못한다.
 */
@Injectable()
export class ChannelListenerRestorer implements OnApplicationBootstrap {
  private readonly logger = new Logger(ChannelListenerRestorer.name);
  /** 진행 중인 복원. 없으면 `null`. */
  private restoring: Promise<void> | null = null;
  /** 아직 읽기를 시작하지 않은 요청의 출처. 비어 있지 않으면 한 번 더 읽어야 한다. */
  private readonly pendingSources = new Set<RestoreSource>();

  constructor(
    private readonly listenerRegistry: ChannelListenerRegistry,
    private readonly listenerBus: ChannelListenerBus,
    @InjectRepository(Trigger)
    private readonly triggerRepository: Repository<Trigger>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    // 순서를 바꾸지 않는다 — 머리 주석의 «handler 를 먼저 등록하고 복원을 시작한다».
    this.listenerBus.onSubscribed(() => this.restore('listener 재구독'));
    await this.restore('부팅');
  }

  /**
   * 활성 채팅 채널 트리거를 DB 에서 읽어 레지스트리에 일괄 등록한다. 읽기는 한 번에 하나만 돈다.
   * 돌려주는 promise 는 요청이 들어온 뒤에 시작한 읽기까지 끝나야 이행된다.
   */
  private restore(source: RestoreSource): Promise<void> {
    this.pendingSources.add(source);
    this.restoring ??= this.drainRestoreRequests();
    return this.restoring;
  }

  /** 쌓인 요청이 없어질 때까지 읽는다. 끝나는 자리에서 `restoring` 을 비워 요청을 놓치는 틈이 없다. */
  private async drainRestoreRequests(): Promise<void> {
    try {
      while (this.pendingSources.size > 0) {
        const sources = [...this.pendingSources];
        this.pendingSources.clear();
        try {
          await this.readAndRegisterActiveListeners(sources);
        } catch (err) {
          // 뒤이은 요청이 있으면 그 읽기가 이 실패를 대신한다. 없으면 호출자에게 알린다.
          if (this.pendingSources.size === 0) throw err;
          this.logger.warn(
            `listener 복원 읽기 실패 — 뒤이은 요청의 읽기로 대신한다: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        }
      }
    } finally {
      this.restoring = null;
    }
  }

  private async readAndRegisterActiveListeners(
    sources: RestoreSource[],
  ): Promise<void> {
    const activeTriggers = await this.triggerRepository
      .createQueryBuilder('t')
      .where('t.is_active = true')
      .andWhere("t.config ->> 'chatChannel' IS NOT NULL")
      .select(['t.id', 't.config'])
      .getMany();

    const entries: Array<{ triggerId: string; provider: string }> = [];
    for (const trigger of activeTriggers) {
      const provider = readTriggerChatChannelProvider(trigger.config);
      if (provider === null) continue;
      entries.push({ triggerId: trigger.id, provider });
    }
    this.listenerRegistry.bulkRegister(entries);
    // 합친 읽기는 그 사이 쌓인 요청을 모두 채우므로 출처를 모두 적는다.
    this.logger.log(
      `listener 레지스트리 복원(${sources.join(' · ')}) — ${entries.length}건 등록`,
    );
  }
}
