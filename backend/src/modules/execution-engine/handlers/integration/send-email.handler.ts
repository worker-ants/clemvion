import { createTransport, type Transporter } from 'nodemailer';
import {
  ExecutionContext,
  NodeHandler,
  ValidationResult,
} from '../node-handler.interface.js';
import { IntegrationsService } from '../../../integrations/integrations.service.js';

interface SmtpCredentials {
  host: string;
  port: number;
  secure: 'none' | 'starttls' | 'tls';
  username: string;
  password: string;
  default_from: string;
}

export class SendEmailHandler implements NodeHandler {
  constructor(private readonly integrationsService?: IntegrationsService) {}

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

    // The engine may be exercising this handler without wiring (e.g. older
    // unit tests). Keep the legacy stub behaviour so those paths still pass.
    if (!this.integrationsService) {
      return {
        to,
        cc,
        subject,
        bodyType,
        status: 'requires_integration',
      };
    }

    const workspaceId = context.variables.__workspaceId as string | undefined;
    if (!workspaceId) {
      throw new Error(
        'Missing workspace context — send_email cannot resolve the integration',
      );
    }

    const start = Date.now();
    let integration;
    try {
      integration = await this.integrationsService.getForExecution(
        integrationId,
        workspaceId,
      );
    } catch (err) {
      await this.safeLogUsage(context, integrationId, {
        status: 'failed',
        durationMs: Date.now() - start,
        error: {
          code: 'INTEGRATION_NOT_FOUND',
          message: err instanceof Error ? err.message : String(err),
        },
      });
      throw err;
    }

    if (integration.serviceType !== 'email') {
      const message = `Integration ${integrationId} is type "${integration.serviceType}", not "email"`;
      await this.safeLogUsage(context, integrationId, {
        status: 'failed',
        durationMs: Date.now() - start,
        error: { code: 'INTEGRATION_TYPE_MISMATCH', message },
      });
      throw new Error(message);
    }

    if (integration.status !== 'connected') {
      const message = `Integration "${integration.name}" is ${integration.status}${
        integration.statusReason ? ` (${integration.statusReason})` : ''
      }`;
      await this.safeLogUsage(context, integrationId, {
        status: 'failed',
        durationMs: Date.now() - start,
        error: { code: 'INTEGRATION_NOT_CONNECTED', message },
      });
      throw new Error(message);
    }

    const credentials = integration.credentials as Partial<SmtpCredentials>;
    const missing = missingSmtpFields(credentials);
    if (missing.length > 0) {
      const message = `SMTP integration is missing fields: ${missing.join(', ')}`;
      await this.safeLogUsage(context, integrationId, {
        status: 'failed',
        durationMs: Date.now() - start,
        error: { code: 'INTEGRATION_INCOMPLETE', message },
      });
      throw new Error(message);
    }

    const transporter = this.buildTransport(credentials as SmtpCredentials);

    try {
      const info = await transporter.sendMail({
        from: credentials.default_from,
        to,
        cc: cc.length > 0 ? cc : undefined,
        subject,
        ...(bodyType === 'html' ? { html: body } : { text: body }),
      });
      const durationMs = Date.now() - start;
      await this.safeLogUsage(context, integrationId, {
        status: 'success',
        durationMs,
      });
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
      const message = err instanceof Error ? err.message : String(err);
      await this.safeLogUsage(context, integrationId, {
        status: 'failed',
        durationMs: Date.now() - start,
        error: { code: 'SMTP_SEND_FAILED', message },
      });
      throw err;
    } finally {
      transporter.close();
    }
  }

  private buildTransport(credentials: SmtpCredentials): Transporter {
    const { host, port, secure, username, password } = credentials;
    return createTransport({
      host,
      port,
      secure: secure === 'tls',
      requireTLS: secure === 'starttls',
      auth: { user: username, pass: password },
    });
  }

  private async safeLogUsage(
    context: ExecutionContext,
    integrationId: string,
    params: {
      status: 'success' | 'failed';
      durationMs: number;
      error?: { code?: string; message?: string };
    },
  ): Promise<void> {
    if (!this.integrationsService) return;
    if (!context.nodeExecutionId) return;
    await this.integrationsService.logUsage({
      integrationId,
      nodeExecutionId: context.nodeExecutionId,
      workflowId: context.workflowId,
      status: params.status,
      durationMs: params.durationMs,
      error: params.error ?? null,
    });
  }
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
