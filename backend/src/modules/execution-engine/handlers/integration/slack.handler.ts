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
  /**
   * access_token → WebClient cache. Sharing an instance preserves the SDK's
   * internal rate-limit queue across node executions using the same token.
   */
  private readonly clients = new Map<string, WebClient>();

  constructor(integrationsService?: IntegrationsService) {
    super(integrationsService);
  }

  private resolveClient(token: string): WebClient {
    const existing = this.clients.get(token);
    if (existing) return existing;
    const client = new WebClient(token);
    this.clients.set(token, client);
    return client;
  }

  /** Evict a cached client — useful when a token is rotated. */
  invalidateClient(token: string): void {
    this.clients.delete(token);
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

      const client = this.resolveClient(token);
      const result = await runAction(client, action, config);

      const durationMs = Date.now() - start;
      await this.logUsage(context, {
        integrationId,
        status: 'success',
        durationMs,
      }).catch(() => {});
      return { action, status: 'ok', durationMs, ...result };
    } catch (err) {
      await this.logUsage(context, {
        integrationId,
        status: 'failed',
        durationMs: Date.now() - start,
        error: toLogError(err),
      }).catch(() => {});
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
      const fileBuffer = coerceFile(config.file);
      const basePayload = {
        channel_id: config.channel as string,
        filename: (config.filename as string | undefined) ?? 'upload.txt',
        initial_comment: config.comment as string | undefined,
      };
      const payload = fileBuffer
        ? { ...basePayload, file: fileBuffer }
        : { ...basePayload, content: (config.content as string | undefined) ?? '' };
      const res = await client.files.uploadV2(
        payload as Parameters<typeof client.files.uploadV2>[0],
      );
      return { file: (res as { files?: unknown }).files };
    }
  }
}

function stripColons(s: string): string {
  return s.replace(/^:|:$/g, '');
}

/**
 * Accept the upload payload in the shapes a workflow might produce:
 *  - Buffer (pass-through)
 *  - string prefixed `base64:...` → decoded
 *  - `{ base64: '...' }` object → decoded
 *  - `{ url: '...' }` — not supported here (Slack SDK accepts URL separately);
 *    falls back to `content` path by returning null.
 */
function coerceFile(raw: unknown): Buffer | null {
  if (!raw) return null;
  if (Buffer.isBuffer(raw)) return raw;
  if (typeof raw === 'string') {
    if (raw.startsWith('base64:')) {
      return Buffer.from(raw.slice(7), 'base64');
    }
    return null;
  }
  if (typeof raw === 'object') {
    const obj = raw as { base64?: unknown };
    if (typeof obj.base64 === 'string') {
      return Buffer.from(obj.base64, 'base64');
    }
  }
  return null;
}
