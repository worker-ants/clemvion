import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Job } from 'bullmq';
import { Repository } from 'typeorm';
import { Trigger } from '../triggers/entities/trigger.entity';
import {
  Execution,
  ExecutionStatus,
} from '../executions/entities/execution.entity';
import {
  NOTIFICATION_WEBHOOK_QUEUE,
  NotificationWebhookJob,
} from './notification-dispatcher.types';
import {
  buildSignatureHeader,
  computeHmacSignature,
  SupportedHmacAlgorithm,
} from './notification-signature.util';
import {
  checkResolvedHostIp,
  checkSsrfSafeUrl,
} from '../../common/utils/ssrf-safe-url.util';
import { SecretResolverService } from '../secret-store/secret-resolver.service';
import { isSecretRef } from '../secret-store/secret-ref';

const HTTP_TIMEOUT_MS = 10_000;
const STALE_ELIGIBLE_EVENTS = new Set<string>([
  'execution.waiting_for_input',
  'execution.ai_message',
]);
const LAST_ERROR_MAX_LENGTH = 500;

/**
 * Trigger.config.notification 의 런타임 shape. DTO 와 별도 타입 — 큐 페이로드를 통해 들어오는
 * 임의 객체이므로 narrow 시 필드별 type 검사 필요.
 */
interface NotificationConfigRuntime {
  url?: unknown;
  events?: unknown;
  signing?: { algorithm?: unknown; secret?: unknown; secretRef?: unknown };
}

function truncate(msg: string, max: number): string {
  return msg.length <= max ? msg : `${msg.slice(0, max)}…`;
}

/**
 * [Spec EIA §6 / §R10] — Outbound notification 의 BullMQ worker.
 *
 * 책임: Trigger config 로 url/secret/algorithm 조회 → stale 차단 검사 → HMAC 서명 →
 * HTTP POST (10s timeout) → 결과에 따라 health 갱신.
 *
 * BullMQ 가 attempts/backoff 로 재시도를 자동 관리한다. 본 process() 가 throw 하면 BullMQ 가
 * exponential backoff 로 재시도 (default 5회). 최종 실패 시 `notification_health='degraded'` +
 * `notification_last_error` 갱신, trigger 자체는 비활성화하지 않음 ([Spec EIA §R6]).
 */
@Processor(NOTIFICATION_WEBHOOK_QUEUE)
export class NotificationWebhookProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationWebhookProcessor.name);

  constructor(
    @InjectRepository(Trigger)
    private readonly triggerRepository: Repository<Trigger>,
    @InjectRepository(Execution)
    private readonly executionRepository: Repository<Execution>,
    private readonly secrets: SecretResolverService,
  ) {
    super();
  }

  /**
   * `config.signing.secretRef` (secret store ref) 또는 legacy plaintext (`config.signing.secret`)
   * 중 존재하는 쪽을 resolve 해 plaintext 를 반환.
   *
   * - secretRef 가 있으면 secret store 에서 복호화. 실패 시 null 반환 → 호출자가 markDegraded.
   * - secretRef 없고 legacy plaintext 있으면 그대로 반환.
   *   SUMMARY#6: legacy fallback 진입 시 운영자가 마이그레이션 미완료를 추적할 수 있도록 warn 로그.
   * - 둘 다 없으면 null.
   */
  private async resolveSigningSecret(
    config: NotificationConfigRuntime,
    triggerId: string,
  ): Promise<string | null> {
    const secretRef = config.signing?.secretRef;
    if (typeof secretRef === 'string' && isSecretRef(secretRef)) {
      try {
        return await this.secrets.resolve(secretRef);
      } catch (err) {
        this.logger.warn(
          `NotificationWebhookProcessor: secretRef resolve 실패 (triggerId=${triggerId}): ${err instanceof Error ? err.message : String(err)}`,
        );
        return null;
      }
    }
    // legacy plaintext fallback (마이그레이션 호환성).
    const refOrLegacy = config.signing?.secret;
    if (typeof refOrLegacy === 'string' && refOrLegacy.length > 0) {
      this.logger.warn(
        `legacy plaintext signing secret detected (triggerId=${triggerId}) — migration to secret store recommended.`,
      );
      return refOrLegacy;
    }
    return null;
  }

  async process(job: Job<NotificationWebhookJob>): Promise<void> {
    const {
      deliveryId,
      triggerId,
      eventType,
      executionId,
      workflowId,
      eventBody,
    } = job.data;
    const trigger = await this.triggerRepository.findOne({
      where: { id: triggerId },
    });
    if (!trigger) {
      // trigger 가 이미 삭제되었으면 더 이상 재시도 의미 없음 — 정상 종료 (skip).
      this.logger.warn(
        `notification skip — trigger 삭제됨: triggerId=${triggerId} deliveryId=${deliveryId}`,
      );
      return;
    }
    const config = (trigger.config?.notification ??
      {}) as NotificationConfigRuntime;
    if (typeof config.url !== 'string' || config.url.length === 0) {
      // notification 설정 자체가 없으면 발송 불가 (재시도 의미 없음 — fail-silent).
      return;
    }
    const url = config.url;
    // post-resolve SSRF 검증 — 등록 시점과 발송 시점 사이에 DNS 가 사설 IP 로 바뀌었거나 사용자가
    // 직접 사설 IP 로 update 한 경우 차단 (Spec EIA §8.1).
    const urlCheck = checkSsrfSafeUrl(url);
    if (!urlCheck.ok) {
      const reason = `outbound URL 거부: ${urlCheck.reason ?? 'unsafe'}`;
      await this.markDegraded(triggerId, reason);
      this.logger.warn(
        `notification skip — ${reason} (triggerId=${triggerId})`,
      );
      return;
    }

    // DNS rebinding 방어 (옵션, [Spec EIA §8.1]) — `NOTIFICATION_ENFORCE_DNS_REBIND_GUARD=1`
    // 일 때만 발송 직전 DNS resolve → IP 가 사설 대역인지 확인. default 는 OFF (DNS 호출 비용 +
    // latency 증가 회피). 활성 시 발송 직전마다 도메인 → IP resolve 비용 발생.
    if (process.env.NOTIFICATION_ENFORCE_DNS_REBIND_GUARD === '1') {
      let hostname: string;
      try {
        hostname = new URL(url).hostname;
      } catch {
        await this.markDegraded(triggerId, 'invalid URL');
        return;
      }
      const dnsCheck = await checkResolvedHostIp(hostname);
      if (!dnsCheck.ok) {
        const reason = `DNS rebinding 차단: ${dnsCheck.reason ?? 'private resolved IP'}`;
        await this.markDegraded(triggerId, reason);
        this.logger.warn(
          `notification skip — ${reason} (triggerId=${triggerId})`,
        );
        return;
      }
    }

    // 구독 이벤트 검사
    const subscribed =
      Array.isArray(config.events) &&
      (config.events as unknown[]).includes(eventType);
    if (!subscribed) {
      // 호출자가 구독 안 한 이벤트를 enqueue 한 경우 (정합성 깨진 호출) — fail-silent.
      return;
    }

    // Stale 차단 — waiting_for_input / ai_message 같은 in-flight 이벤트는 발송 직전에 execution
    // 상태가 여전히 RUNNING/WAITING 인지 확인. 이미 cancelled 면 skip (재시도 무의미).
    if (STALE_ELIGIBLE_EVENTS.has(eventType)) {
      const execution = await this.executionRepository.findOne({
        where: { id: executionId },
        select: ['id', 'status'],
      });
      if (
        !execution ||
        execution.status === ExecutionStatus.CANCELLED ||
        execution.status === ExecutionStatus.FAILED ||
        execution.status === ExecutionStatus.COMPLETED
      ) {
        this.logger.log(
          `notification skip stale ${eventType} executionId=${executionId} status=${execution?.status ?? 'missing'}`,
        );
        return;
      }
    }

    // 서명
    const algorithm = this.resolveAlgorithm(config.signing?.algorithm);
    const primarySecret = await this.resolveSigningSecret(config, triggerId);
    const secondarySecret =
      typeof trigger.notificationSecretV2 === 'string'
        ? trigger.notificationSecretV2
        : null;
    if (!primarySecret) {
      // secret 미설정 또는 resolve 실패 — unsigned 발송하지 않는다.
      await this.markDegraded(
        triggerId,
        'notification secret 미설정 또는 resolve 실패',
      );
      return;
    }
    const rawBody = JSON.stringify(eventBody);
    const timestamp = Math.floor(Date.now() / 1000);
    const primaryHex = computeHmacSignature(
      algorithm,
      primarySecret,
      timestamp,
      rawBody,
    );
    const secondaryHex = secondarySecret
      ? computeHmacSignature(algorithm, secondarySecret, timestamp, rawBody)
      : undefined;
    const signatureHeader = buildSignatureHeader(
      timestamp,
      primaryHex,
      secondaryHex,
    );

    // HTTP POST
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'X-Clemvion-Event': eventType,
          'X-Clemvion-Execution-Id': executionId,
          'X-Clemvion-Trigger-Id': triggerId,
          'X-Clemvion-Workflow-Id': workflowId,
          'X-Clemvion-Delivery': deliveryId,
          'X-Clemvion-Timestamp': String(timestamp),
          'X-Clemvion-Signature': signatureHeader,
        },
        body: rawBody,
      });
    } catch (err) {
      clearTimeout(timer);
      const msg = err instanceof Error ? err.message : String(err);
      // 마지막 attempt 라면 health 갱신 (BullMQ 가 retry 를 어떻게 처리하는지에 따라 다름).
      await this.maybeMarkDegradedOnFinalAttempt(
        job,
        triggerId,
        `network: ${msg}`,
      );
      throw err; // BullMQ 가 backoff 후 재시도.
    } finally {
      clearTimeout(timer);
    }

    if (res.status >= 200 && res.status < 300) {
      await this.markHealthy(triggerId);
      return;
    }

    const errMsg = `HTTP ${res.status} ${res.statusText}`;
    await this.maybeMarkDegradedOnFinalAttempt(job, triggerId, errMsg);
    // BullMQ 재시도를 트리거하기 위해 throw.
    throw new Error(errMsg);
  }

  private resolveAlgorithm(raw: unknown): SupportedHmacAlgorithm {
    if (raw === 'hmac-sha512') return 'hmac-sha512';
    // default: hmac-sha256 (spec §R12 - outbound 표기).
    return 'hmac-sha256';
  }

  private async maybeMarkDegradedOnFinalAttempt(
    job: Job<NotificationWebhookJob>,
    triggerId: string,
    reason: string,
  ): Promise<void> {
    const attemptsMade = job.attemptsMade ?? 0;
    const maxAttempts = job.opts.attempts ?? 5;
    // BullMQ 가 process() 진입 시점에 attemptsMade 가 (try 횟수 - 1) 일 수 있어 +1 후 비교.
    if (attemptsMade + 1 >= maxAttempts) {
      await this.markDegraded(triggerId, reason);
    }
  }

  private async markDegraded(triggerId: string, reason: string): Promise<void> {
    try {
      await this.triggerRepository.update(triggerId, {
        notificationHealth: 'degraded',
        notificationLastError: truncate(reason, LAST_ERROR_MAX_LENGTH),
      });
    } catch (err) {
      this.logger.warn(
        `notification health update 실패 triggerId=${triggerId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private async markHealthy(triggerId: string): Promise<void> {
    try {
      await this.triggerRepository.update(triggerId, {
        notificationHealth: 'healthy',
        notificationLastError: null,
      });
    } catch (err) {
      this.logger.warn(
        `notification health update 실패 triggerId=${triggerId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
