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

    // 5. Execute workflow
    const executionId = await this.executionEngineService.execute(
      trigger.workflowId,
      { parameters, ...input },
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
      if (!token || token !== config.bearerToken) {
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

      if (
        !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
      ) {
        throw new UnauthorizedException({
          code: 'AUTH_FAILED',
          message: 'Invalid HMAC signature',
        });
      }
      return;
    }
  }
}
