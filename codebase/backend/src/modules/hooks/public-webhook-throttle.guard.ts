import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  Optional,
  PayloadTooLargeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Trigger } from '../triggers/entities/trigger.entity';
import { PublicWebhookQuotaService } from './public-webhook-quota.service';

/**
 * 공개(인증 없음) webhook 남용 방어 Guard — `POST /api/hooks/:endpointPath` 전용.
 *
 * Spec [7-channel-web-chat/4-security.md §4]. `/api/hooks/*` 는 위젯 외에도 서버-to-서버
 * webhook(GitHub 등 고빈도)을 받는 **공유 엔드포인트**라 blanket throttle 은 정당한 webhook 을 깬다.
 * 따라서 **trigger 의 `auth_config_id IS NULL`(=공개) 여부를 먼저 해석한 뒤 그 경우에만** 적용한다:
 *   1. authConfigId 가 있으면(인증 webhook) → 무제한 통과.
 *   2. 공개 webhook → body 크기 제한 + IP 단위 시작 rate-limit/누적 상한.
 *
 * Redis 미가용 시 quota 는 fail-open(PublicWebhookQuotaService). trigger 미존재 시엔
 * 통과시키고 HooksService 가 404 처리(이중 책임 회피).
 */
@Injectable()
export class PublicWebhookThrottleGuard implements CanActivate {
  private readonly logger = new Logger(PublicWebhookThrottleGuard.name);

  /** 공개 webhook body 최대 크기(bytes) 기본값 (config: `publicWebhook.maxBodyBytes`). spec §4 body 32KB. */
  static readonly DEFAULT_MAX_BODY_BYTES = 32 * 1024;

  private readonly maxBodyBytes: number;

  constructor(
    @InjectRepository(Trigger)
    private readonly triggerRepository: Repository<Trigger>,
    private readonly quota: PublicWebhookQuotaService,
    @Optional() configService?: ConfigService,
  ) {
    this.maxBodyBytes =
      configService?.get<number>('publicWebhook.maxBodyBytes') ??
      PublicWebhookThrottleGuard.DEFAULT_MAX_BODY_BYTES;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{
      params?: { endpointPath?: string };
      headers?: Record<string, unknown>;
      body?: unknown;
      rawBody?: Buffer;
    }>();

    const endpointPath = req.params?.endpointPath;
    if (!endpointPath) return true; // 라우트 형태상 발생하지 않음 — 방어적 통과.

    // 1. trigger 해석 — 공개 여부 판정. 미존재 시 통과(HooksService 가 404).
    let trigger: Pick<Trigger, 'authConfigId'> | null = null;
    try {
      trigger = await this.triggerRepository.findOne({
        where: { endpointPath, type: 'webhook' },
        select: { authConfigId: true },
      });
    } catch (err) {
      // trigger 조회 실패는 throttle 판단 불가 → fail-open(통과). 후속 HooksService 가 정식 처리.
      this.logger.warn(
        `PublicWebhookThrottleGuard: trigger 조회 실패 — fail-open: ${err instanceof Error ? err.message : String(err)}`,
      );
      return true;
    }
    if (!trigger) return true;

    // 2. 인증 webhook(authConfigId 존재) → 무제한 통과.
    if (trigger.authConfigId !== null) return true;

    // 3. 공개 webhook — body 크기 제한.
    const bodyBytes = this.measureBodyBytes(req.rawBody, req.body);
    if (bodyBytes > this.maxBodyBytes) {
      throw new PayloadTooLargeException({
        error: {
          code: 'PUBLIC_WEBHOOK_BODY_TOO_LARGE',
          message: `Webhook body exceeds ${this.maxBodyBytes} bytes`,
        },
      });
    }

    // 4. IP 단위 시작 rate-limit/누적 상한. IP 식별 불가 시 추적 불가 → 통과(fail-open).
    const ip = extractClientIp(req.headers ?? {});
    if (!ip) return true;

    const { allowed, reason } = await this.quota.consumeStart(ip);
    if (!allowed) {
      throw new HttpException(
        {
          error: {
            code:
              reason === 'hourly_new'
                ? 'PUBLIC_WEBHOOK_HOURLY_LIMIT'
                : 'PUBLIC_WEBHOOK_RATE_LIMIT',
            message:
              'Too many conversation starts from this client. Try again later.',
          },
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }

  /** rawBody 우선(정확), 없으면 직렬화 추정. */
  private measureBodyBytes(rawBody: Buffer | undefined, body: unknown): number {
    if (rawBody) return rawBody.length;
    if (body === undefined || body === null) return 0;
    try {
      return Buffer.byteLength(
        typeof body === 'string' ? body : JSON.stringify(body),
        'utf8',
      );
    } catch {
      return 0; // 직렬화 불가 시 크기 미상 — 통과(별도 검증은 service 책임).
    }
  }
}

/**
 * 클라이언트 IP 추출 — `cf-connecting-ip` → `x-forwarded-for` 첫 항목 순.
 * (hooks.service.ts 의 동명 헬퍼와 동일 정책. 추후 공용 util 추출 후보.)
 */
function extractClientIp(headers: Record<string, unknown>): string | undefined {
  const cf = headers['cf-connecting-ip'];
  if (typeof cf === 'string' && cf.trim()) return cf.trim();
  const xff = headers['x-forwarded-for'];
  if (typeof xff === 'string') {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  return undefined;
}
