import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type Redis from 'ioredis';
import { RedisConnectionProvider } from '../../common/redis/redis-connection.provider';

/**
 * 공개(인증 없음) webhook 남용 방어용 IP 단위 quota 카운터.
 *
 * Spec [7-channel-web-chat/4-security.md §4] v1 기본:
 *   - IP 단위 대화 시작 rate-limit (분당 10/IP)
 *   - 익명 IP 누적 신규 대화 상한 (시간당 신규 ≤20/IP)
 *   - (동시 ≤3 캡은 대화 종료 신호 연동 필요 → followup, 본 서비스 밖)
 *
 * 구현: Redis fixed-window 카운터. pipeline 으로 INCR+EXPIRE 원자화(W7/W15).
 * Redis 미가용/오류 시 **fail-open**(허용) — 정당한 webhook 을 인프라 장애로 깨지 않는다
 * (ChannelConversationService 와 동일 graceful degradation 정책).
 *
 * DI 토큰(W4): `PUBLIC_WEBHOOK_QUOTA_REDIS` 는 `@Optional()` 로 주입 — 주입 시
 * Redis 인스턴스를 재사용(테스트·공용 RedisModule 연동). 미주입 시
 * `RedisConnectionProvider` 공유 command 연결을 사용 (INFO-12). HooksModule 에 별도
 * provider 등록 불필요 (ChannelConversationService 동일 패턴).
 *
 * config keys (publicWebhook.*):
 *   publicWebhook.startupPerMinute  분당 IP 시작 한도 (기본 10)
 *   publicWebhook.hourlyNewMax      시간당 누적 신규 상한 (기본 20)
 *   publicWebhook.maxBodyBytes      body 크기 제한 bytes (기본 32768, Guard 사용)
 */
@Injectable()
export class PublicWebhookQuotaService {
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
    @Optional() redisConn?: RedisConnectionProvider,
  ) {
    this.startupPerMinute =
      configService?.get<number>('publicWebhook.startupPerMinute') ??
      PublicWebhookQuotaService.DEFAULT_STARTUP_PER_MINUTE;
    this.hourlyNewMax =
      configService?.get<number>('publicWebhook.hourlyNewMax') ??
      PublicWebhookQuotaService.DEFAULT_HOURLY_NEW_MAX;

    // 테스트 주입(injectedRedis) 우선, 아니면 공유 command connection (INFO-12).
    // 미가용 시 null 로 degrade — fail-open (정당한 webhook 을 막지 않음).
    this.redis = injectedRedis ?? redisConn?.getClientOrNull() ?? null;
  }

  /** Redis 가용성 여부. */
  isAvailable(): boolean {
    return this.redis !== null;
  }

  /**
   * IP 의 "대화 시작" 한도를 검사하고 카운터를 1 증가시킨다(원자적).
   * Redis 미가용/오류 시 fail-open → `{ allowed: true, reason: null }`.
   *
   * @param ip 클라이언트 IP. IP 미식별 시 호출부(guard)가 `UNIDENTIFIED_IP_BUCKET` sentinel 을
   *   전달해 미식별 트래픽을 단일 공유 버킷에 누적시킨다(D-12).
   * @returns allowed=false 일 때 reason 으로 어떤 한도인지 식별.
   */
  async consumeStart(ip: string): Promise<{
    allowed: boolean;
    reason: 'startup_rate' | 'hourly_new' | null;
  }> {
    if (!this.redis) return { allowed: true, reason: null };
    try {
      const minuteCount = await this.incrWithWindow(
        makeMinKey(ip),
        MINUTE_WINDOW_SEC,
      );
      if (minuteCount > this.startupPerMinute) {
        return { allowed: false, reason: 'startup_rate' };
      }
      const hourCount = await this.incrWithWindow(
        makeHourKey(ip),
        HOUR_WINDOW_SEC,
      );
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

  /**
   * fixed-window 원자적 증가 — pipeline 으로 INCR + NX-EXPIRE 단일 왕복(W7/W15).
   * pipeline 결과는 [incrResult, expireResult] 배열. count=1 일 때만 EXPIRE 를 건다.
   * ioredis pipeline 은 배열 결과이므로 타입 캐스팅 필요.
   */
  private async incrWithWindow(
    key: string,
    windowSec: number,
  ): Promise<number> {
    // pipeline: INCR → 결과 확인 → 필요 시 EXPIRE
    // 단일 왕복으로 최악 4 RTT 를 2 RTT 로 단축(W15).
    const pipeline = this.redis!.pipeline();
    pipeline.incr(key);
    const results = await pipeline.exec();
    // exec() 결과: [[err, value], ...] | null
    if (!results || results.length === 0) {
      throw new Error('Redis pipeline returned null');
    }
    const [incrErr, count] = results[0] as [Error | null, number];
    if (incrErr) throw incrErr;

    // 키가 새로 생성된 첫 증가(=1)일 때만 TTL 설정(W7: 비원자 EXPIRE 분리 안전성 확보).
    // count=1 이면 키가 방금 생성된 것이므로 EXPIRE 를 건다.
    if (count === 1) {
      await this.redis!.expire(key, windowSec);
    }
    return count;
  }

  // 공유 connection 은 RedisConnectionProvider 가 소유·종료 (INFO-12) — 본 서비스는 quit 안 함.
}

/** 분 단위 슬라이딩 윈도우 초 (60 s). */
export const MINUTE_WINDOW_SEC = 60;
/** 시간 단위 슬라이딩 윈도우 초 (3600 s). */
export const HOUR_WINDOW_SEC = 3600;

/** rate-limit 분 키 포맷 (IP 별, 또는 `UNIDENTIFIED_IP_BUCKET` sentinel). 테스트에서 import 해 직접 의존 방지(Info#10). */
export const makeMinKey = (ip: string): string => `wh:rl:min:${ip}`;
/** rate-limit 시간 키 포맷 (IP 별, 또는 `UNIDENTIFIED_IP_BUCKET` sentinel). 테스트에서 import 해 직접 의존 방지(Info#10). */
export const makeHourKey = (ip: string): string => `wh:rl:hour:${ip}`;

/**
 * IP 미식별(공개 webhook 진입 시 `X-Forwarded-For`/신뢰 시 `CF-Connecting-IP` 헤더 부재) 요청을
 * 묶는 **단일 공유 버킷 sentinel** (D-12). 헤더 제거로 IP 가 null 인 요청 전체가 이 키 하나에
 * 누적되어 per-IP 와 동일한 fixed-window 한도가 적용된다 — 과거 fail-open(`if (!ip) return true`)
 * 무제한 우회를 유한 상한으로 강화한 완화 한도. 정상 IP 와 충돌하지 않도록 유효 IP 표기가 아닌
 * 문자열을 쓴다(단일 공유 버킷이 곧 보수적: 미식별 트래픽 총량이 한 IP 분량으로 상한).
 * 정책·근거 SoT: [spec/7-channel-web-chat/4-security.md §4·R6].
 *
 * @remarks `consumeStart`/`makeMinKey`/`makeHourKey` 는 이 sentinel 을 일반 IP 인자처럼 받는다 —
 *   Redis 키(`wh:rl:min:__no_client_ip__`)가 로그·메트릭에 IP 처럼 보일 수 있으나 의도된 집계
 *   버킷이다(consistency I-8).
 */
export const UNIDENTIFIED_IP_BUCKET = '__no_client_ip__';
