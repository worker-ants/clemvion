import { Injectable, Logger } from '@nestjs/common';

/**
 * [Spec Chat Channel §3.1 / R8 (2026-05-24 v1 적용)] per-trigger listener registry.
 *
 * `ChatChannelDispatcher` 는 모듈 단위 1회 subscription 을 유지하지만, 본 registry 가
 * (a) trigger 삭제 후 race event 안전 가드 — `unregister` 호출 후 도달하는 event 는 handle 에서 skip
 * (b) hot reload / process restart 후 listener 미등록 race window 회피 — bootstrap 에서 일괄 register
 * (c) handle() 의 DB round-trip 절감 — registry 에 없는 trigger 의 event 는 silent skip
 *
 * 세 가지 invariant 를 강화한다. message routing 자체는 여전히 `ChatChannelDispatcher.handle()`
 * 안에서 일어나며 본 registry 는 lifecycle 추적 + 사전 가드 용도.
 *
 * SoT:
 *   - spec/5-system/15-chat-channel.md R8 (2026-05-24 갱신) — per-trigger listener dedup/teardown
 *   - spec/conventions/chat-channel-adapter.md §1.1 — setupChannel 멱등성
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

  /**
   * Trigger 의 chat-channel listener 등록.
   *
   * 동일 `triggerId` 가 이미 있으면 entry 를 overwrite — `setupChannel()` 멱등성 정합.
   * provider 가 바뀌는 경우 (trigger 재구성) 도 새 provider 로 갱신.
   */
  register(triggerId: string, provider: string): void {
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
   * Trigger 의 chat-channel listener 해제 — `teardownChannel` / `TriggersService.remove` 직후 호출.
   * 미등록 triggerId 도 graceful (noop).
   */
  unregister(triggerId: string): void {
    this.entries.delete(triggerId);
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
   * **Bootstrap 전용** — hot reload / process restart 후 registry 가 비어있는 상태에서
   * DB 로부터 active trigger 를 일괄 복원할 때 사용. caller 는 `ChatChannelModule
   * .onApplicationBootstrap` 에서 호출.
   */
  bulkRegister(entries: Array<{ triggerId: string; provider: string }>): void {
    for (const entry of entries) {
      this.entries.set(entry.triggerId, {
        provider: entry.provider,
        registeredAt: new Date(),
      });
    }
    this.logger.log(
      `ChannelListenerRegistry: bootstrap 복원 — ${entries.length}건 등록`,
    );
  }
}
