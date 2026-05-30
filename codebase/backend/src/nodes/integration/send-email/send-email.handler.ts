import { Logger } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';
import type Mail from 'nodemailer/lib/mailer';
import { createHash } from 'crypto';
import {
  ExecutionContext,
  NodeHandler,
  NodeHandlerOutput,
  ValidationResult,
} from '../../core/node-handler.interface.js';
import { evaluateMetadataBlockingErrors } from '../../core/metadata-validation.js';
import {
  IntegrationError,
  IntegrationHandlerBase,
  toLogError,
} from '../_base/integration-handler-base.js';
import { truncateBodyForOutput } from '../../core/truncate-output.util.js';
import { IntegrationsService } from '../../../modules/integrations/integrations.service.js';
import {
  maskEmailForErrorDetails,
  truncateForErrorDetails,
} from '../../core/error-codes.js';
import { sendEmailNodeMetadata } from './send-email.schema.js';
import { isSmtpHostBlocked } from '../../../common/utils/smtp-host-guard.js';

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

  metadata = sendEmailNodeMetadata;

  validate(config: Record<string, unknown>): ValidationResult {
    // Schema SSOT (warningRules + validateConfig) covers integrationId / to /
    // subject / body required + cc/bcc array-only guards (2026-05-19 정준화,
    // spec 4-nodes/4-integration/3-send-email.md §8.1). Handler retains the
    // string type guards for subject/body and the bodyType enum guard
    // because zod narrows them at parse time only.
    const errors = [...evaluateMetadataBlockingErrors(this.metadata, config)];
    if (config.subject !== undefined && typeof config.subject !== 'string') {
      errors.push('subject is required and must be a string');
    }
    if (config.body !== undefined && typeof config.body !== 'string') {
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
  ): Promise<NodeHandlerOutput> {
    // parallel-p2-followups §1 (2026-05-30) — node-cancellation 사전 체크.
    // SMTP 진행 중 abort 의 nodemailer 처리는 transporter.close() 가 best-effort
    // — 본 PR 은 사전 체크 + spec 명시.
    if (context.abortSignal?.aborted) {
      const err = new Error('Operation was aborted before email send');
      err.name = 'AbortError';
      throw err;
    }

    const integrationId = config.integrationId as string;
    const to = normalizeRecipients(config.to);
    const cc = normalizeRecipients(config.cc);
    const bcc = normalizeRecipients(config.bcc);
    const subject = config.subject as string;
    const body = config.body as string;
    const bodyType = (config.bodyType as string) ?? 'text';
    const attachments = mapAttachmentsForNodemailer(config.attachments);

    // CONVENTIONS Principle 7 — `config` echo is the **raw** template the
    // workflow author entered (`{{ ... }}` preserved). evaluated bodies are
    // surfaced on `output.subject` / `output.body` so downstream nodes can
    // read either side without ambiguity. Engine populates `rawConfig` for
    // every dispatch (Phase 1); the `?? config` fallback is solely for unit
    // tests that don't go through the engine.
    const rawConfig = context.rawConfig ?? config;
    const configEcho: Record<string, unknown> = {
      integrationId: rawConfig.integrationId,
      to: rawConfig.to,
      cc: rawConfig.cc,
      bcc: rawConfig.bcc,
      subject: rawConfig.subject,
      body: rawConfig.body,
      bodyType: rawConfig.bodyType,
      attachments: rawConfig.attachments,
    };

    // Cap the evaluated body before it lands on `output.body` — multi-MB
    // HTML bodies would balloon NodeExecution rows otherwise.
    const cappedBody = truncateBodyForOutput(body);

    if (to.length === 0) {
      throw new Error('No valid recipients after normalizing the `to` field');
    }

    if (!this.integrationsService) {
      return {
        config: configEcho,
        output: {
          subject,
          body: cappedBody.value,
          bodyType,
          ...(cappedBody.truncated ? { bodyTruncated: true } : {}),
        },
        status: 'requires_integration',
      };
    }

    const start = Date.now();
    // INT-US-05 — apiInfo 는 외부 catch 에서도 참조한다. SMTP host 는
    // credentials resolve 성공 후 채우고, 그 전엔 NULL fallback.
    const apiInfo: {
      method?: string | null;
      path?: string | null;
    } = { method: 'SEND', path: null };
    try {
      const integration = await this.resolveIntegration(
        integrationId,
        context,
        'email',
      );
      const credentials = integration.credentials as Partial<SmtpCredentials>;
      apiInfo.path = credentials.host ?? null;
      const missing = missingSmtpFields(credentials);
      if (missing.length > 0) {
        throw new IntegrationError(
          'INTEGRATION_INCOMPLETE',
          `SMTP integration is missing fields: ${missing.join(', ')}`,
        );
      }

      // SSRF 완화 (opt-in) — `SMTP_BLOCK_PRIVATE_HOSTS` 정책이 켜진 경우 사설/
      // loopback host 로의 발송을 차단. 연결 테스트와 동일한 가드를 발송 경로에도
      // 적용해 비대칭(테스트만 차단)을 막는다.
      if (await isSmtpHostBlocked(credentials.host as string)) {
        throw new IntegrationError(
          'EMAIL_HOST_BLOCKED',
          'SMTP host points to a private/loopback address blocked by policy.',
        );
      }

      const transporter = this.resolveTransport(
        integrationId,
        credentials as SmtpCredentials,
      );

      const info = (await transporter.sendMail({
        from: credentials.default_from,
        to,
        cc: cc.length > 0 ? cc : undefined,
        bcc: bcc.length > 0 ? bcc : undefined,
        subject,
        ...(bodyType === 'html' ? { html: body } : { text: body }),
        ...(attachments.length > 0 ? { attachments } : {}),
        // 보안 방어선 — 사용자 입력으로 임의 파일 시스템 / URL 접근이
        // 발생하지 않도록 nodemailer 단에서 차단. 스키마에서 `path` 를
        // 노출하지 않는 것과 mapAttachmentsForNodemailer 가 path/href 를
        // strip 하는 것에 더해 다중 방어 (defense in depth).
        disableFileAccess: true,
        disableUrlAccess: true,
      })) as {
        messageId?: string;
        accepted?: string[];
        rejected?: string[];
      };
      const durationMs = Date.now() - start;
      await this.logUsage(context, {
        integrationId,
        status: 'success',
        durationMs,
        api: apiInfo,
      }).catch(() => {});
      return {
        config: configEcho,
        output: {
          messageId: info.messageId,
          accepted: info.accepted,
          rejected: info.rejected,
          subject,
          body: cappedBody.value,
          bodyType,
          ...(cappedBody.truncated ? { bodyTruncated: true } : {}),
        },
        meta: { durationMs, deliveryStatus: 'sent' },
      };
    } catch (err) {
      const logError =
        err instanceof IntegrationError
          ? toLogError(err)
          : { code: 'EMAIL_SEND_FAILED', message: safeMessage(err) };
      await this.logUsage(context, {
        integrationId,
        status: 'failed',
        durationMs: Date.now() - start,
        error: logError,
        api: apiInfo,
      }).catch(() => {});
      // CONVENTIONS §3.2 — runtime failures route to the `error` port with
      // a standardized `output.error.{code,message,details}` envelope.
      // `IntegrationError` carries the precise cause (INTEGRATION_INCOMPLETE,
      // INTEGRATION_TYPE_MISMATCH, INTEGRATION_NOT_CONNECTED, …); preserve
      // that code directly, falling back to `EMAIL_SEND_FAILED` only for
      // generic transport failures.
      const code =
        err instanceof IntegrationError ? err.code : 'EMAIL_SEND_FAILED';
      // CONVENTIONS §7 — error details must not leak full recipient lists
      // or arbitrarily large subject lines. Mask addresses and truncate
      // subject before echoing for downstream consumption.
      const details: Record<string, unknown> = {
        to: to.map(maskEmailForErrorDetails),
        subject: truncateForErrorDetails(subject, 200),
      };
      if (err instanceof IntegrationError) {
        details.integrationCode = err.code;
      }
      const durationMs = Date.now() - start;
      return {
        config: configEcho,
        output: {
          subject,
          body: cappedBody.value,
          bodyType,
          ...(cappedBody.truncated ? { bodyTruncated: true } : {}),
          error: {
            code,
            message: safeMessage(err),
            details,
          },
        },
        meta: { durationMs, deliveryStatus: 'failed' },
        port: 'error',
      };
    }
  }

  /**
   * Drop the cached transport for an integration — useful when credentials
   * change or the process is shutting down.
   */
  invalidateTransport(integrationId: string): void {
    const entry = this.transports.get(integrationId);
    if (!entry) return;
    this.transports.delete(integrationId);
    try {
      entry.transporter.close();
    } catch {
      /* ignore */
    }
  }

  shutdown(): void {
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

// `isOptionalRecipientSet` / `isRecipientsLike` were removed from this file
// when the inline validate() was replaced with the schema SSOT helper —
// send-email.schema.ts owns the canonical implementations now.
//
// `to/cc/bcc` are array-only as of the 2026-05-19 정준화 (spec
// 4-nodes/4-integration/3-send-email.md §8 Rationale). Both zod schema and
// validateSendEmailConfig reject raw `string`, so non-array inputs cannot
// reach this handler through the standard execution path. The defensive
// `return []` for non-array input remains as the runtime safety net for
// legacy data (pre-정준화 workflows) or direct handler invocation that
// bypassed schema parsing — it produces an empty recipient list, which the
// downstream `to.length === 0` guard converts into `EMAIL_NO_RECIPIENTS`.
//
// The `logger.warn` on the defensive branch makes the legacy / bypass path
// observable so an empty `[]` doesn't disguise itself as "user simply
// omitted recipients" in logs. Once production has no legacy string-shaped
// data this branch can be tightened to throw at the engine boundary.
const normalizeRecipientsLogger = new Logger('send-email.normalizeRecipients');
function normalizeRecipients(value: unknown): string[] {
  if (!Array.isArray(value)) {
    if (value !== undefined && value !== null) {
      normalizeRecipientsLogger.warn(
        `recipient field is not an array (type=${typeof value}) — defensive [] returned. ` +
          'spec §8: raw must be string[]. Likely legacy data or schema-bypass path.',
      );
    }
    return [];
  }
  return value
    .filter((v): v is string => typeof v === 'string')
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
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

/**
 * Map the `config.attachments` array (validated by `attachmentSchema` in
 * send-email.schema.ts) to nodemailer's `Attachment[]` shape.
 *
 * Security boundary — only an explicit allow-list of safe properties is
 * forwarded. Crucially `path` (local file read) and `href` (URL fetch) are
 * **not** part of the schema and are stripped here as a second defence even
 * if a future schema change accidentally introduces them. Combined with the
 * `disableFileAccess: true` / `disableUrlAccess: true` flags on `sendMail`,
 * sandbox the attachment surface so a malicious workflow author cannot use
 * an SMTP send to exfiltrate `/etc/passwd` or similar.
 *
 * Empty / non-array input returns `[]` — silent no-op preserved for
 * non-breaking migration (Phase 4 § "비-breaking" note).
 */
function mapAttachmentsForNodemailer(value: unknown): Mail.Attachment[] {
  if (!Array.isArray(value)) return [];
  const out: Mail.Attachment[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const item = raw as Record<string, unknown>;
    const att: Mail.Attachment = {};
    if (typeof item.filename === 'string' && item.filename.length > 0) {
      att.filename = item.filename;
    }
    if (typeof item.content === 'string') {
      att.content = item.content;
    }
    if (typeof item.contentType === 'string' && item.contentType.length > 0) {
      att.contentType = item.contentType;
    }
    if (typeof item.encoding === 'string' && item.encoding.length > 0) {
      att.encoding = item.encoding;
    }
    if (typeof item.cid === 'string' && item.cid.length > 0) {
      att.cid = item.cid;
    }
    // Skip entries that have neither a filename nor any content — they would
    // be useless to nodemailer and a no-op at best, mis-encoded at worst.
    if (att.filename === undefined && att.content === undefined) continue;
    out.push(att);
  }
  return out;
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
