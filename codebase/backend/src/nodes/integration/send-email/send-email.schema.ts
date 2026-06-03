import { z } from 'zod';
import {
  NodeComponentMetadata,
  NodePorts,
} from '../../core/node-component.interface';

// Send Email attachment shape (Phase 4 / C — nodemailer 전달 구현).
//
// 보안 주의 — `path` 는 의도적으로 스키마에 포함하지 않는다. nodemailer 의
// `path` 옵션은 로컬 파일 시스템에서 파일을 읽어 첨부하기 때문에, 사용자
// 입력으로 노출되면 `/etc/passwd` 같은 임의 경로 노출 (path traversal /
// arbitrary file read) 로 이어질 수 있다. 핸들러도 매핑 단계에서 `path` 를
// 제거하고, 추가 방어선으로 `disableFileAccess: true` 를 sendMail 옵션에
// 부여한다 (`mapAttachmentsForNodemailer` 참조).
const attachmentSchema = z.object({
  filename: z.string().meta({ ui: { label: 'Filename', widget: 'text' } }),
  content: z
    .string()
    .meta({ ui: { label: 'Content / URL', widget: 'expression' } }),
  contentType: z
    .string()
    .optional()
    .meta({ ui: { label: 'Content-Type', widget: 'text' } }),
  encoding: z
    .string()
    .optional()
    .meta({ ui: { label: 'Encoding', widget: 'text' } }),
  cid: z
    .string()
    .optional()
    .meta({ ui: { label: 'Inline CID', widget: 'text' } }),
});

/**
 * Send Email output. CONVENTIONS Principle 7 — `config` echoes the **raw**
 * template the workflow author entered (`{{ ... }}` preserved); `output`
 * surfaces the evaluated subject / body / bodyType alongside nodemailer's
 * messageId / accepted / rejected lists + deliveryStatus. On failure routes
 * to `port: 'error'` with the standardized
 * `output.error.{code, message, details}` envelope — body is still echoed so
 * a downstream node can branch on the failed payload.
 *
 * `to` / `cc` / `bcc` are `string[]` — raw form is array-only since the
 * 2026-05-19 정준화 (spec §8 Rationale). Each element may itself be a
 * `{{ ... }}` expression that evaluates to a single address at runtime;
 * comma-separated single strings are no longer accepted. The normalised
 * array is not echoed on `config` — `output.accepted` / `output.rejected`
 * (from nodemailer) carry the actually delivered list.
 */
export const sendEmailNodeOutputSchema = z
  .object({
    config: z
      .object({
        integrationId: z.string().optional(),
        to: z.array(z.string()).optional(),
        cc: z.array(z.string()).optional(),
        bcc: z.array(z.string()).optional(),
        subject: z.string().optional(),
        body: z.string().optional(),
        bodyType: z.enum(['text', 'html']).optional(),
        attachments: z.array(z.unknown()).optional(),
      })
      .partial()
      .passthrough()
      .optional(),
    output: z
      .object({
        messageId: z.string().optional(),
        accepted: z.array(z.string()).optional(),
        rejected: z.array(z.string()).optional(),
        subject: z.string().optional(),
        body: z.unknown().optional(),
        bodyType: z.enum(['text', 'html']).optional(),
        bodyTruncated: z.boolean().optional(),
        error: z
          .object({
            code: z.string().optional(),
            message: z.string().optional(),
            details: z.record(z.string(), z.unknown()).optional(),
          })
          .partial()
          .passthrough()
          .optional(),
      })
      .partial()
      .passthrough()
      .optional(),
    meta: z
      .object({
        durationMs: z.number().optional(),
        deliveryStatus: z.enum(['sent', 'failed']).optional(),
      })
      .partial()
      .passthrough()
      .optional(),
    port: z.enum(['out', 'error']).optional(),
    status: z.string().optional(),
  })
  .passthrough();

export const sendEmailNodeConfigSchema = z
  .object({
    integrationId: z
      .string()
      .optional()
      .meta({
        ui: {
          label: 'Integration',
          widget: 'integration-selector',
          order: 1,
          // warningRule `send_email:no-integration` 와 정렬.
          required: true,
        },
        // Assistant candidate picker 의 후보 조회 범위 힌트.
        // backend 의 CandidateLookupService 가 Integration 테이블을
        // `service_type=email` 로 필터해 이 노드의 picker 에 전달한다.
        // 값이 비면 connected 전체가 후보로 노출된다.
        integrationServiceType: 'email',
      }),
    to: z
      .array(z.string())
      .default([])
      .meta({
        ui: {
          label: 'To',
          widget: 'field-array',
          itemLabel: 'Recipient',
          order: 2,
          // warningRule `send_email:no-recipient` 와 정렬.
          required: true,
        },
      }),
    cc: z
      .array(z.string())
      .default([])
      .meta({
        ui: {
          label: 'CC',
          widget: 'field-array',
          itemLabel: 'Recipient',
          order: 3,
        },
      }),
    bcc: z
      .array(z.string())
      .default([])
      .meta({
        ui: {
          label: 'BCC',
          widget: 'field-array',
          itemLabel: 'Recipient',
          order: 4,
        },
      }),
    // `.default('')`: LLM 이 optional 로 오인해 인자 생략하는 것을 차단 (review I-4).
    subject: z
      .string()
      .default('')
      .meta({
        ui: {
          label: 'Subject',
          widget: 'expression',
          order: 5,
          // warningRule `send_email:no-subject` 와 정렬.
          required: true,
        },
      }),
    body: z
      .string()
      .default('')
      .meta({
        ui: {
          label: 'Body',
          widget: 'expression',
          order: 6,
          // warningRule `send_email:no-body` 와 정렬.
          required: true,
        },
      }),
    bodyType: z
      .enum(['text', 'html'])
      .default('text')
      .meta({ ui: { label: 'Body Type', widget: 'select', order: 7 } }),
    attachments: z
      .array(attachmentSchema)
      .default([])
      .meta({
        ui: {
          label: 'Attachments',
          widget: 'field-array',
          itemLabel: 'Attachment',
          order: 8,
        },
      }),
  })
  .passthrough();
export type SendEmailConfig = z.infer<typeof sendEmailNodeConfigSchema>;

export const sendEmailNodePorts: NodePorts = {
  inputs: [{ id: 'in', label: 'Input', type: 'data' }],
  outputs: [
    { id: 'out', label: 'Output', type: 'data' },
    { id: 'error', label: 'Error', type: 'error' },
  ],
};

/**
 * Imperative escape hatch — recipient fields are `string[]` (array-only as
 * of the 2026-05-19 정준화). "set" means "non-empty array of non-empty
 * trimmed strings". The mini-DSL's `length(to) == 0` declarative rule
 * catches the empty-array case for the canvas badge; this validator
 * additionally rejects arrays containing empty / non-string elements and
 * — most importantly — rejects the legacy `string` raw shape that zod
 * already refuses to parse, so both layers agree.
 *
 * spec/4-nodes/4-integration/3-send-email.md §8 Rationale: the previous
 * sum-type (`string | string[]`) caused zod ↔ validator disagreement —
 * raw `string` failed zod parse but slipped past the validator. Aligning
 * both layers on array-only collapses that disagreement.
 */
function isRecipientsLike(value: unknown): boolean {
  if (!Array.isArray(value)) return false;
  return (
    value.length > 0 &&
    value.every((v) => typeof v === 'string' && v.trim().length > 0)
  );
}

/**
 * cc/bcc 가 사용자가 "명시한 값" 인지 판단. 명시되었다면 추가로 array-only
 * 형식 검증을 trigger 해야 한다. 명시되지 않았다면 (unset / 빈 배열) 검증
 * skip — optional field 이므로 부재가 valid 상태.
 *
 * **주의**: 비-배열 truthy 값 (예: `string`, `number`) 도 "set" 으로 판단해
 * `true` 를 반환한다. 이는 "사용자가 값을 넣었지만 형식이 잘못됐다" 는
 * 의미로, 호출자(`validateSendEmailConfig`) 가 `isRecipientsLike` 로 다시
 * 검사해 reject 메시지를 push 하는 패턴을 의도한다. 직접 호출자 외 다른
 * 컨텍스트에서 단독 사용 시 함수명이 오해를 부를 수 있음.
 */
function isOptionalRecipientSet(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (Array.isArray(value) && value.length === 0) return false;
  return true;
}

export function validateSendEmailConfig(config: unknown): string[] {
  const c = (config ?? {}) as Record<string, unknown>;
  const errors: string[] = [];

  if (!isRecipientsLike(c.to)) {
    errors.push(
      'to is required and must be a non-empty array of email addresses',
    );
  }

  if (isOptionalRecipientSet(c.cc) && !isRecipientsLike(c.cc)) {
    errors.push('cc must be an array of email addresses');
  }

  if (isOptionalRecipientSet(c.bcc) && !isRecipientsLike(c.bcc)) {
    errors.push('bcc must be an array of email addresses');
  }

  return errors;
}

export const sendEmailNodeMetadata: NodeComponentMetadata = {
  type: 'send_email',
  category: 'integration',
  label: 'Send Email',
  description: 'Send emails via SMTP',
  icon: 'Mail',
  color: '#F97316',
  executionMetadata: { kind: 'standard' },
  // Re-run dry-run (spec/5-system/13-replay-rerun.md §7) — 외부 SMTP 발송을
  // 수행하는 부수효과 노드이므로 dry-run 시 mock 반환을 지원한다.
  supportsDryRun: true,
  // SSOT for warnings (frontend canvas + backend handler.validate).
  // Mirror points:
  //  - frontend `sendEmailSummary` warning ("Recipient not set" — covered
  //    by `send_email:no-recipient` below as the empty-array case)
  //  - backend handler.validate's "integrationId is required" / "subject is
  //    required" / "body is required" rules.
  // `bodyType` enum is bounded by zod (`'text' | 'html'`), so no extra rule
  // is needed there. Recipient **array-only** validation (non-empty array
  // of non-empty trimmed strings) lives in `validateConfig` because the
  // mini-DSL can't model the per-element guard. 2026-05-19 정준화 (spec §8.1).
  warningRules: [
    {
      id: 'send_email:no-integration',
      when: '!integrationId',
      message: 'Email integration must be selected.',
    },
    {
      id: 'send_email:no-recipient',
      when: 'length(to) == 0',
      message: 'Recipient (To) must include at least one address.',
    },
    {
      id: 'send_email:no-subject',
      when: '!subject',
      message: 'Subject must be entered.',
    },
    {
      id: 'send_email:no-body',
      when: '!body',
      message: 'Body must be entered.',
    },
  ],
  summaryTemplate: {
    template: '{{to.length}} recipients · {{subject}}',
  },
  validateConfig: validateSendEmailConfig,
};
