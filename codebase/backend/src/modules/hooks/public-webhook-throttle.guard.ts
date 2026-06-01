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
 *
 * W14 — Guard 가 조회한 trigger 를 `req.__publicWebhookTrigger` 에 첨부해 HooksService 가
 * 재사용할 수 있게 한다 (동일 endpointPath 의 DB 왕복 중복 제거).
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
      __publicWebhookTrigger?: Trigger | null;
    }>();

    const endpointPath = req.params?.endpointPath;
    if (!endpointPath) return true; // 라우트 형태상 발생하지 않음 — 방어적 통과.

    // 1. trigger 해석 — 공개 여부 판정. 미존재 시 통과(HooksService 가 404).
    let trigger: Trigger | null = null;
    try {
      trigger = await this.triggerRepository.findOne({
        where: { endpointPath, type: 'webhook' },
        select: { authConfigId: true } as Parameters<
          Repository<Trigger>['findOne']
        >[0]['select'],
      });
    } catch (err) {
      // trigger 조회 실패는 throttle 판단 불가 → fail-open(통과). 후속 HooksService 가 정식 처리.
      this.logger.warn(
        `PublicWebhookThrottleGuard: trigger 조회 실패 — fail-open: ${err instanceof Error ? err.message : String(err)}`,
      );
      return true;
    }

    // Guard 결과를 req 에 첨부 — HooksService 가 동일 엔드포인트 DB 재조회 불필요(W14).
    req.__publicWebhookTrigger = trigger;

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
    //    W1/W3: XFF 신뢰 체계는 인프라·trust proxy 설정에 위임 (rate-limit 은 best-effort
    //    defense-in-depth, 인증 게이트 아님). IP 미식별 시 fail-open — spec graceful degradation.
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

  /**
   * body 크기 측정 — rawBody 우선(정확), 없으면 직렬화 추정.
   * 직렬화 불가 시 `maxBodyBytes + 1` 반환 — 크기 미상인 body 를 통과시키지 않는 보수적 차단(W6).
   */
  measureBodyBytes(rawBody: Buffer | undefined, body: unknown): number {
    if (rawBody) return rawBody.length;
    if (body === undefined || body === null) return 0;
    try {
      return Buffer.byteLength(
        typeof body === 'string' ? body : JSON.stringify(body),
        'utf8',
      );
    } catch {
      // 직렬화 불가(순환 참조 등) — 크기 미상이므로 보수적으로 한도 초과 취급(W6).
      return this.maxBodyBytes + 1;
    }
  }
}

/**
 * 공개 webhook 요청 body의 `__publicWebhookTrigger` 확장 타입.
 * Guard 가 조회한 Trigger 를 HooksService 에서 재사용할 수 있도록 req 에 첨부 (W14).
 *
 * `export` 되어 있어 HooksService/Controller 등 소비 측이 import 가능.
 */
export interface PublicWebhookReqExtension {
  /** Guard 가 조회·첨부한 Trigger (null = 미존재). HooksService DB 재조회 불필요. */
  __publicWebhookTrigger?: Trigger | null;
}

/**
 * 클라이언트 IP 추출 — `cf-connecting-ip` → `x-forwarded-for` 첫 항목 순.
 * (hooks.service.ts 의 동명 헬퍼와 동일 정책. 추후 공용 util 추출 후보.)
 *
 * XFF 신뢰 관련(W1): 헤더 조작 방어는 인프라 레이어(`trust proxy` / Cloudflare 고정 IP 검증)
 * 의 책임. rate-limit 은 best-effort defense-in-depth 이므로 애플리케이션 레이어에서 강제하지 않음.
 */
export function extractClientIp(
  headers: Record<string, unknown>,
): string | undefined {
  const cf = headers['cf-connecting-ip'];
  if (typeof cf === 'string' && cf.trim()) return cf.trim();
  const xff = headers['x-forwarded-for'];
  if (typeof xff === 'string') {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  return undefined;
}
