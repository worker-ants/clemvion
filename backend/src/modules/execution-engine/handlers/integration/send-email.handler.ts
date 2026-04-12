import { createTransport, type Transporter } from 'nodemailer';
import { createHash } from 'crypto';
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

interface SmtpCredentials {
  host: string;
  port: number;
  secure: 'none' | 'starttls' | 'tls';
  username: string;
  password: string;
  default_from: string;
}

export class SendEmailHandler
  extends IntegrationHandlerBase
  implements NodeHandler
{
  /**
   * integrationId → cached SMTP transport. Re-creating a transport per call
   * costs a fresh TLS handshake; nodemailer's pool keeps the connection open
   * across messages. Keyed by credentials hash so a credential rotation
   * evicts the stale instance.
   */
  private readonly transports = new Map<
    string,
    { transporter: Transporter; credsHash: string }
  >();

  constructor(integrationsService?: IntegrationsService) {
    super(integrationsService);
  }

  validate(config: Record<string, unknown>): ValidationResult {
    const errors: string[] = [];

    if (!config.integrationId || typeof config.integrationId !== 'string') {
      errors.push('integrationId is required');
    }

    if (!isRecipientsLike(config.to)) {
      errors.push(
        'to is required and must be a non-empty string or array of email addresses',
      );
    }

    if (
      config.cc !== undefined &&
      config.cc !== null &&
      config.cc !== '' &&
      !isRecipientsLike(config.cc)
    ) {
      errors.push('cc must be a string or array of email addresses');
    }

    if (!config.subject || typeof config.subject !== 'string') {
      errors.push('subject is required and must be a string');
    }

    if (!config.body || typeof config.body !== 'string') {
      errors.push('body is required and must be a string');
    }

    if (
      config.bodyType !== undefined &&
      !['text', 'html'].includes(config.bodyType as string)
    ) {
      errors.push('bodyType must be either "text" or "html"');
    }

    return { valid: errors.length === 0, errors };
  }

  async execute(
    _input: unknown,
    config: Record<string, unknown>,
    context: ExecutionContext,
  ): Promise<unknown> {
    const integrationId = config.integrationId as string;
    const to = normalizeRecipients(config.to);
    const cc = normalizeRecipients(config.cc);
    const subject = config.subject as string;
    const body = config.body as string;
    const bodyType = (config.bodyType as string) ?? 'text';

    if (to.length === 0) {
      throw new Error('No valid recipients after normalizing the `to` field');
    }

    if (!this.integrationsService) {
      return {
        to,
        cc,
        subject,
        bodyType,
        status: 'requires_integration',
      };
    }

    const start = Date.now();
    try {
      const integration = await this.resolveIntegration(
        integrationId,
        context,
        'email',
      );
      const credentials = integration.credentials as Partial<SmtpCredentials>;
      const missing = missingSmtpFields(credentials);
      if (missing.length > 0) {
        throw new IntegrationError(
          'INTEGRATION_INCOMPLETE',
          `SMTP integration is missing fields: ${missing.join(', ')}`,
        );
      }

      const transporter = this.resolveTransport(
        integrationId,
        credentials as SmtpCredentials,
      );

      const info = await transporter.sendMail({
        from: credentials.default_from,
        to,
        cc: cc.length > 0 ? cc : undefined,
        subject,
        ...(bodyType === 'html' ? { html: body } : { text: body }),
      });
      const durationMs = Date.now() - start;
      await this.logUsage(context, {
        integrationId,
        status: 'success',
        durationMs,
      }).catch(() => {});
      return {
        messageId: info.messageId,
        accepted: info.accepted,
        rejected: info.rejected,
        to,
        cc,
        subject,
        bodyType,
        status: 'sent',
        durationMs,
      };
    } catch (err) {
      const logError =
        err instanceof IntegrationError
          ? toLogError(err)
          : { code: 'SMTP_SEND_FAILED', message: safeMessage(err) };
      await this.logUsage(context, {
        integrationId,
        status: 'failed',
        durationMs: Date.now() - start,
        error: logError,
      }).catch(() => {});
      throw err;
    }
  }

  /**
   * Drop the cached transport for an integration — useful when credentials
   * change or the process is shutting down.
   */
  async invalidateTransport(integrationId: string): Promise<void> {
    const entry = this.transports.get(integrationId);
    if (!entry) return;
    this.transports.delete(integrationId);
    try {
      entry.transporter.close();
    } catch {
      /* ignore */
    }
  }

  async shutdown(): Promise<void> {
    const entries = Array.from(this.transports.values());
    this.transports.clear();
    for (const { transporter } of entries) {
      try {
        transporter.close();
      } catch {
        /* ignore */
      }
    }
  }

  private resolveTransport(
    integrationId: string,
    creds: SmtpCredentials,
  ): Transporter {
    const credsHash = hashCredentials(creds);
    const existing = this.transports.get(integrationId);
    if (existing && existing.credsHash === credsHash) {
      return existing.transporter;
    }
    if (existing) {
      try {
        existing.transporter.close();
      } catch {
        /* ignore */
      }
    }

    const transporter = createTransport({
      host: creds.host,
      port: creds.port,
      secure: creds.secure === 'tls',
      requireTLS: creds.secure === 'starttls',
      auth: { user: creds.username, pass: creds.password },
      pool: true,
      maxConnections: 3,
      maxMessages: 100,
    });
    this.transports.set(integrationId, { transporter, credsHash });
    return transporter;
  }
}

function safeMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  // Reuse the sanitizer so passwords / auth headers don't leak from
  // nodemailer SMTP errors.
  return toLogError(new Error(msg)).message;
}

function isRecipientsLike(value: unknown): boolean {
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) {
    return (
      value.length > 0 &&
      value.every((v) => typeof v === 'string' && v.trim().length > 0)
    );
  }
  return false;
}

function normalizeRecipients(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((v): v is string => typeof v === 'string')
      .map((v) => v.trim())
      .filter((v) => v.length > 0);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((v) => v.trim())
      .filter((v) => v.length > 0);
  }
  return [];
}

function missingSmtpFields(creds: Partial<SmtpCredentials>): string[] {
  const required: (keyof SmtpCredentials)[] = [
    'host',
    'port',
    'secure',
    'username',
    'password',
    'default_from',
  ];
  return required.filter(
    (k) => creds[k] === undefined || creds[k] === null || creds[k] === '',
  );
}

function hashCredentials(creds: SmtpCredentials): string {
  const fingerprint = [
    creds.host,
    creds.port,
    creds.secure,
    creds.username,
    creds.password,
    creds.default_from,
  ].join('|');
  return createHash('sha256').update(fingerprint).digest('hex');
}
