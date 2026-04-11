import {
  Injectable,
  Logger,
  NotFoundException,
  GoneException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Trigger } from '../triggers/entities/trigger.entity';
import { ExecutionEngineService } from '../execution-engine/execution-engine.service';
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

    // 4. Execute workflow
    const executionId = await this.executionEngineService.execute(
      trigger.workflowId,
      input,
    );

    this.logger.log(
      `Webhook ${endpointPath} triggered execution ${executionId} for workflow ${trigger.workflowId}`,
    );

    // 5. Update lastTriggeredAt
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
      const token = authHeader.startsWith('Bearer ')
        ? authHeader.slice(7)
        : '';
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
        !crypto.timingSafeEqual(
          Buffer.from(signature),
          Buffer.from(expected),
        )
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
