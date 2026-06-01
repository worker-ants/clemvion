import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * 공개(인증 없음) webhook 남용 방어용 IP 단위 quota 카운터.
 *
 * Spec [7-channel-web-chat/4-security.md §4] v1 기본:
 *   - IP 단위 대화 시작 rate-limit (분당 10/IP)
 *   - 익명 IP 누적 신규 대화 상한 (시간당 신규 ≤20/IP)
 *   - (동시 ≤3 캡은 대화 종료 신호 연동 필요 → followup, 본 서비스 밖)
 *
 * 구현: Redis fixed-window 카운터. 윈도우 첫 증가 시에만 EXPIRE 설정.
 * Redis 미가용/오류 시 **fail-open**(허용) — 정당한 webhook 을 인프라 장애로 깨지 않는다
 * (ChannelConversationService 와 동일 graceful degradation 정책).
 */
@Injectable()
export class PublicWebhookQuotaService implements OnModuleDestroy {
  private readonly logger = new Logger(PublicWebhookQuotaService.name);
  private readonly redis: Redis | null;

  /** 분당 IP 시작 rate-limit 기본값 (config: `publicWebhook.startupPerMinute`). */
  static readonly DEFAULT_STARTUP_PER_MINUTE = 10;
  /** 시간당 IP 누적 신규 대화 상한 기본값 (config: `publicWebhook.hourlyNewMax`). */
  static readonly DEFAULT_HOURLY_NEW_MAX = 20;

  private readonly startupPerMinute: number;
  private readonly hourlyNewMax: number;

  constructor(
    @Optional() configService?: ConfigService,
    @Optional()
    @Inject('PUBLIC_WEBHOOK_QUOTA_REDIS')
    injectedRedis?: Redis,
  ) {
    this.startupPerMinute =
      configService?.get<number>('publicWebhook.startupPerMinute') ??
      PublicWebhookQuotaService.DEFAULT_STARTUP_PER_MINUTE;
    this.hourlyNewMax =
      configService?.get<number>('publicWebhook.hourlyNewMax') ??
      PublicWebhookQuotaService.DEFAULT_HOURLY_NEW_MAX;

    if (injectedRedis) {
      this.redis = injectedRedis;
      return;
    }
    if (!configService) {
      this.redis = null;
      return;
    }
    const host = configService.get<string>('redis.host');
    const port = configService.get<number>('redis.port');
    if (!host || !port) {
      this.redis = null;
      return;
    }
    const password = configService.get<string>('redis.password');
    const tlsEnabled = configService.get<boolean>('redis.tls');
    try {
      this.redis = new Redis({
        host,
        port,
        ...(password ? { password } : {}),
        ...(tlsEnabled ? { tls: {} } : {}),
        lazyConnect: true,
        maxRetriesPerRequest: 2,
      });
      this.redis.on('error', (err) => {
        this.logger.warn(
          `PublicWebhookQuotaService Redis error — fail-open: ${err.message}`,
        );
      });
    } catch (err) {
      this.logger.warn(
        `PublicWebhookQuotaService: Redis 초기화 실패 — graceful degradation: ${err instanceof Error ? err.message : String(err)}`,
      );
      this.redis = null;
    }
  }

  /** Redis 가용성 여부. */
  isAvailable(): boolean {
    return this.redis !== null;
  }

  /**
   * IP 의 "대화 시작" 한도를 검사하고 카운터를 1 증가시킨다(원자적).
   * Redis 미가용/오류 시 fail-open → `{ allowed: true, reason: null }`.
   *
   * @returns allowed=false 일 때 reason 으로 어떤 한도인지 식별.
   */
  async consumeStart(ip: string): Promise<{
    allowed: boolean;
    reason: 'startup_rate' | 'hourly_new' | null;
  }> {
    if (!this.redis) return { allowed: true, reason: null };
    try {
      const minuteCount = await this.incrWithWindow(`wh:rl:min:${ip}`, 60);
      if (minuteCount > this.startupPerMinute) {
        return { allowed: false, reason: 'startup_rate' };
      }
      const hourCount = await this.incrWithWindow(`wh:rl:hour:${ip}`, 3600);
      if (hourCount > this.hourlyNewMax) {
        return { allowed: false, reason: 'hourly_new' };
      }
      return { allowed: true, reason: null };
    } catch (err) {
      this.logger.warn(
        `PublicWebhookQuotaService.consumeStart 실패 — fail-open: ${err instanceof Error ? err.message : String(err)}`,
      );
      return { allowed: true, reason: null };
    }
  }

  /** 현재 한도 설정값(테스트/관찰용). */
  get limits(): { startupPerMinute: number; hourlyNewMax: number } {
    return {
      startupPerMinute: this.startupPerMinute,
      hourlyNewMax: this.hourlyNewMax,
    };
  }

  /** fixed-window 증가 — 윈도우 첫 증가(=1)일 때만 EXPIRE 를 건다. */
  private async incrWithWindow(
    key: string,
    windowSec: number,
  ): Promise<number> {
    const count = await this.redis!.incr(key);
    if (count === 1) {
      await this.redis!.expire(key, windowSec);
    }
    return count;
  }

  async onModuleDestroy(): Promise<void> {
    if (this.redis) {
      try {
        await this.redis.quit();
      } catch {
        // 종료 best-effort.
      }
    }
  }
}
