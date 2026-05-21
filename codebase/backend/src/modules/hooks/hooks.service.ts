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
import { InteractionTokenService } from '../external-interaction/interaction-token.service';
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
    private readonly tokenService: InteractionTokenService,
  ) {}

  async handleWebhook(
    endpointPath: string,
    input: WebhookInput,
    rawBody?: Buffer,
  ): Promise<{
    executionId: string;
    status?: 'pending';
    interaction?: {
      token?: string;
      expiresAt?: string;
      endpoints: {
        stream: string;
        submit: string;
        status: string;
        cancel: string;
        refresh: string;
      };
    };
  }> {
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

    // 7. External Interaction API — interaction.enabled=true 일 때 interaction token + endpoints
    //    동봉 ([Spec EIA §4.1] / WH-RS-04). per_execution 전략이면 단명 JWT 발급, per_trigger
    //    전략이면 응답에 token 미동봉 (호출자가 이미 itk_* 보유).
    const interaction = await this.buildInteractionResponse(
      trigger.config,
      executionId,
    );

    return interaction
      ? { executionId, status: 'pending' as const, interaction }
      : { executionId };
  }

  private async buildInteractionResponse(
    config: Record<string, unknown>,
    executionId: string,
  ): Promise<{
    token?: string;
    expiresAt?: string;
    endpoints: {
      stream: string;
      submit: string;
      status: string;
      cancel: string;
      refresh: string;
    };
  } | null> {
    const interactionCfg = (config as { interaction?: unknown }).interaction;
    if (!interactionCfg || typeof interactionCfg !== 'object') return null;
    const enabled = (interactionCfg as { enabled?: unknown }).enabled === true;
    if (!enabled) return null;
    const strategy =
      (interactionCfg as { tokenStrategy?: unknown }).tokenStrategy ??
      'per_execution';
    const endpoints = {
      stream: `/api/external/executions/${executionId}/stream`,
      submit: `/api/external/executions/${executionId}/interact`,
      status: `/api/external/executions/${executionId}`,
      cancel: `/api/external/executions/${executionId}/cancel`,
      refresh: `/api/external/executions/${executionId}/refresh-token`,
    };
    if (strategy === 'per_execution') {
      const issued = await this.tokenService.issuePerExecution(executionId);
      return {
        token: issued.token,
        expiresAt: issued.expiresAt,
        endpoints,
      };
    }
    // per_trigger — token 미동봉 (호출자가 trigger 등록 시 받은 itk_* 사용)
    return { endpoints };
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
        // 응답 메시지는 다른 인증 실패와 동일하게 고정 — 알고리즘 값을 반사하면
        // 외부 호출자가 서버 내부 구성을 탐지할 단서를 얻는다 (information leakage).
        // 진단은 서버 로그에만 남긴다.
        this.logger.warn(
          `webhook HMAC config rejected: algorithm=${algorithm} (not in allow-list)`,
        );
        throw new UnauthorizedException({
          code: 'AUTH_FAILED',
          message: 'Authentication failed',
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
