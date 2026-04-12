import { WebClient } from '@slack/web-api';
import {
  ExecutionContext,
  NodeHandler,
  ValidationResult,
} from '../node-handler.interface.js';
import {
  IntegrationError,
  IntegrationHandlerBase,
  toLogError,
} from './integration-handler-base.js';
import { IntegrationsService } from '../../../integrations/integrations.service.js';

const SUPPORTED_ACTIONS = [
  'send_message',
  'update_message',
  'add_reaction',
  'list_channels',
  'upload_file',
] as const;
type SlackAction = (typeof SUPPORTED_ACTIONS)[number];

export class SlackHandler
  extends IntegrationHandlerBase
  implements NodeHandler
{
  constructor(integrationsService?: IntegrationsService) {
    super(integrationsService);
  }

  validate(config: Record<string, unknown>): ValidationResult {
    const errors: string[] = [];

    if (!config.integrationId || typeof config.integrationId !== 'string') {
      errors.push('integrationId is required');
    }

    const action = config.action as string | undefined;
    if (!action) {
      errors.push('action is required and must be a string');
    } else if (!SUPPORTED_ACTIONS.includes(action as SlackAction)) {
      errors.push(`action must be one of: ${SUPPORTED_ACTIONS.join(', ')}`);
    } else {
      errors.push(...perActionErrors(action as SlackAction, config));
    }

    return { valid: errors.length === 0, errors };
  }

  async execute(
    _input: unknown,
    config: Record<string, unknown>,
    context: ExecutionContext,
  ): Promise<unknown> {
    const integrationId = config.integrationId as string;
    const action = config.action as SlackAction;

    if (!this.integrationsService) {
      // Legacy stub behaviour for engine tests that don't wire the service.
      return {
        action,
        channel: config.channel,
        text: config.text,
        status: 'requires_integration',
      };
    }

    const start = Date.now();
    try {
      const integration = await this.resolveIntegration(
        integrationId,
        context,
        'slack',
      );
      const token = (integration.credentials as { access_token?: string })
        .access_token;
      if (!token) {
        throw new IntegrationError(
          'INTEGRATION_INCOMPLETE',
          `Slack integration "${integration.name}" has no access_token`,
        );
      }

      const client = new WebClient(token);
      const result = await runAction(client, action, config);

      const durationMs = Date.now() - start;
      await this.logUsage(context, {
        integrationId,
        status: 'success',
        durationMs,
      });
      return { action, status: 'ok', durationMs, ...result };
    } catch (err) {
      await this.logUsage(context, {
        integrationId,
        status: 'failed',
        durationMs: Date.now() - start,
        error: toLogError(err),
      });
      throw err;
    }
  }
}

function perActionErrors(
  action: SlackAction,
  config: Record<string, unknown>,
): string[] {
  const errors: string[] = [];
  const requireString = (key: string) => {
    const v = config[key];
    if (!v || typeof v !== 'string' || v.trim().length === 0) {
      errors.push(`${key} is required for action "${action}"`);
    }
  };

  switch (action) {
    case 'send_message':
      requireString('channel');
      requireString('text');
      break;
    case 'update_message':
      requireString('channel');
      requireString('ts');
      requireString('text');
      break;
    case 'add_reaction':
      requireString('channel');
      requireString('ts');
      requireString('emoji');
      break;
    case 'upload_file':
      requireString('channel');
      // Either content (string) or file (base64/path) must be present
      if (!config.content && !config.file) {
        errors.push('content or file is required for action "upload_file"');
      }
      break;
    case 'list_channels':
      break;
  }
  return errors;
}

async function runAction(
  client: WebClient,
  action: SlackAction,
  config: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  switch (action) {
    case 'send_message': {
      const res = await client.chat.postMessage({
        channel: config.channel as string,
        text: config.text as string,
      });
      return { channel: res.channel, ts: res.ts };
    }
    case 'update_message': {
      const res = await client.chat.update({
        channel: config.channel as string,
        ts: config.ts as string,
        text: config.text as string,
      });
      return { channel: res.channel, ts: res.ts };
    }
    case 'add_reaction': {
      await client.reactions.add({
        channel: config.channel as string,
        timestamp: config.ts as string,
        name: stripColons(config.emoji as string),
      });
      return {};
    }
    case 'list_channels': {
      const res = await client.conversations.list({
        limit: (config.limit as number | undefined) ?? 100,
        types:
          (config.types as string | undefined) ??
          'public_channel,private_channel',
      });
      return {
        channels: res.channels?.map((c) => ({ id: c.id, name: c.name })) ?? [],
      };
    }
    case 'upload_file': {
      const res = await client.files.uploadV2({
        channel_id: config.channel as string,
        filename: (config.filename as string | undefined) ?? 'upload.txt',
        content: (config.content as string | undefined) ?? '',
        initial_comment: config.comment as string | undefined,
      });
      return { file: (res as { files?: unknown }).files };
    }
  }
}

function stripColons(s: string): string {
  return s.replace(/^:|:$/g, '');
}
