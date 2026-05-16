import {
  Injectable,
  Logger,
  NotFoundException,
  GoneException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Trigger } from '../triggers/entities/trigger.entity';
import { Node } from '../nodes/entities/node.entity';
import { ExecutionEngineService } from '../execution-engine/execution-engine.service';
import { resolveTriggerParameters } from '../execution-engine/utils/resolve-trigger-parameters';
import { loadTriggerParameterSchema } from '../execution-engine/utils/load-trigger-parameter-schema';
import { TriggerParameterValidationException } from '../execution-engine/types/trigger-parameter.types';
import * as crypto from 'crypto';

const HMAC_ALLOWED_ALGORITHMS = new Set(['sha256', 'sha512']);

interface WebhookConfig {
  authType?: 'none' | 'hmac' | 'bearer';
  secret?: string;
  bearerToken?: string;
  hmacHeader?: string;
  hmacAlgorithm?: string;
}

export interface WebhookInput {
  body: unknown;
  headers: Record<string, string>;
  query: Record<string, string>;
  method: string;
}

@Injectable()
export class HooksService {
  private readonly logger = new Logger(HooksService.name);

  constructor(
    @InjectRepository(Trigger)
    private readonly triggerRepository: Repository<Trigger>,
    @InjectRepository(Node)
    private readonly nodeRepository: Repository<Node>,
    private readonly executionEngineService: ExecutionEngineService,
  ) {}

  async handleWebhook(
    endpointPath: string,
    input: WebhookInput,
    rawBody?: Buffer,
  ): Promise<{ executionId: string }> {
    // 1. Find trigger by endpoint path (no workspace filter — external call)
    const trigger = await this.triggerRepository.findOne({
      where: { endpointPath, type: 'webhook' },
    });

    if (!trigger) {
      throw new NotFoundException({
        code: 'TRIGGER_NOT_FOUND',
        message: 'Webhook endpoint not found',
      });
    }

    // 2. Check active status
    if (!trigger.isActive) {
      throw new GoneException({
        code: 'TRIGGER_INACTIVE',
        message: 'Webhook trigger is inactive',
      });
    }

    // 3. Authenticate
    const config = (trigger.config ?? {}) as WebhookConfig;
    this.verifyAuth(config, input.headers, rawBody);

    // 4. Extract & validate trigger parameters from body
    const schema = await loadTriggerParameterSchema(
      this.nodeRepository,
      trigger.workflowId,
      this.logger,
    );
    let parameters: Record<string, unknown>;
    try {
      parameters = resolveTriggerParameters(schema, input.body);
    } catch (err) {
      if (err instanceof TriggerParameterValidationException) {
        throw new BadRequestException({
          code: 'INVALID_WEBHOOK_PAYLOAD',
          message: 'Invalid webhook payload',
          errors: err.errors,
        });
      }
      throw err;
    }

    // 5. Execute workflow. The `__triggerSource` marker is stamped here so
    //    the Manual Trigger handler can record `meta.source: 'webhook'` and
    //    group `body`/`headers`/`query`/`method` under `output.request.*`
    //    instead of spreading them at the top level (CONVENTIONS Principle 1).
    const executionId = await this.executionEngineService.execute(
      trigger.workflowId,
      { __triggerSource: 'webhook', parameters, ...input },
      { triggerId: trigger.id },
    );

    this.logger.log(
      `Webhook ${endpointPath} triggered execution ${executionId} for workflow ${trigger.workflowId}`,
    );

    // 6. Update lastTriggeredAt
    trigger.lastTriggeredAt = new Date();
    await this.triggerRepository.save(trigger);

    return { executionId };
  }

  private verifyAuth(
    config: WebhookConfig,
    headers: Record<string, string>,
    rawBody?: Buffer,
  ): void {
    const authType = config.authType ?? 'none';

    if (authType === 'none') {
      return;
    }

    if (authType === 'bearer') {
      const authHeader = headers['authorization'] ?? '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
      const expected = config.bearerToken ?? '';
      if (!token || !expected || !this.constantTimeEquals(token, expected)) {
        throw new UnauthorizedException({
          code: 'AUTH_FAILED',
          message: 'Invalid bearer token',
        });
      }
      return;
    }

    if (authType === 'hmac') {
      const hmacHeader = (
        config.hmacHeader ?? 'x-hub-signature-256'
      ).toLowerCase();
      const algorithm = config.hmacAlgorithm ?? 'sha256';
      // 알고리즘 허용 목록. 외부 입력(트리거 설정)이 그대로 crypto.createHmac 에
      // 전달되므로 화이트리스트로 좁혀 임의 알고리즘·낮은 보안 다이제스트 사용을 차단한다.
      if (!HMAC_ALLOWED_ALGORITHMS.has(algorithm)) {
        throw new UnauthorizedException({
          code: 'AUTH_FAILED',
          message: `Unsupported HMAC algorithm: ${algorithm}`,
        });
      }
      const signature = headers[hmacHeader] ?? '';
      const secret = config.secret ?? '';

      if (!signature || !rawBody) {
        throw new UnauthorizedException({
          code: 'AUTH_FAILED',
          message: 'Missing HMAC signature',
        });
      }

      const expected = `${algorithm}=${crypto
        .createHmac(algorithm, secret)
        .update(rawBody)
        .digest('hex')}`;

      if (!this.constantTimeEquals(signature, expected)) {
        throw new UnauthorizedException({
          code: 'AUTH_FAILED',
          message: 'Invalid HMAC signature',
        });
      }
      return;
    }
  }

  /**
   * 길이가 다르면 즉시 false 를 반환한 뒤 길이가 같을 때만 timingSafeEqual 을
   * 호출한다. timingSafeEqual 은 길이가 다르면 동기적으로 RangeError 를 던지므로
   * 사전 길이 비교가 없으면 외부 입력으로 unhandled exception → 요청 단위 DoS 가
   * 가능하다. 한 쌍의 길이만 노출되며 내용 비교는 일정 시간으로 수행된다.
   */
  private constantTimeEquals(a: string, b: string): boolean {
    const aBuf = Buffer.from(a);
    const bBuf = Buffer.from(b);
    if (aBuf.length !== bBuf.length) return false;
    return crypto.timingSafeEqual(aBuf, bBuf);
  }
}
