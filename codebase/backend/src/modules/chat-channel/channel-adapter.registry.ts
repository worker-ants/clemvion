import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ChatChannelAdapter } from './types';

/**
 * Provider 문자열 ↔ ChatChannelAdapter 인스턴스 매핑.
 *
 * 신규 provider 추가 시 [Spec Convention §5]:
 *   1. providers/<name>/<name>.adapter.ts 구현
 *   2. ChatChannelModule 의 providers 에 등록
 *   3. ChatChannelModule.onModuleInit 에서 registry.register(adapter)
 *   4. spec/4-nodes/7-trigger/providers/<name>.md + _overview.md 갱신
 */
@Injectable()
export class ChannelAdapterRegistry {
  private readonly logger = new Logger(ChannelAdapterRegistry.name);
  private readonly adapters = new Map<string, ChatChannelAdapter>();

  register(adapter: ChatChannelAdapter): void {
    const key = adapter.provider;
    if (this.adapters.has(key)) {
      this.logger.warn(
        `ChannelAdapterRegistry: duplicate registration for "${key}" — overwriting`,
      );
    }
    this.adapters.set(key, adapter);
    this.logger.log(`ChannelAdapterRegistry: registered provider "${key}"`);
  }

  get(provider: string): ChatChannelAdapter {
    const adapter = this.adapters.get(provider);
    if (!adapter) {
      throw new NotFoundException({
        error: {
          code: 'CHANNEL_ADAPTER_NOT_FOUND',
          message: `No chat channel adapter registered for provider "${provider}"`,
        },
      });
    }
    return adapter;
  }

  has(provider: string): boolean {
    return this.adapters.has(provider);
  }

  /** 등록된 provider 목록 — UI / API 의 select 옵션 노출 등. */
  list(): string[] {
    return Array.from(this.adapters.keys());
  }
}
