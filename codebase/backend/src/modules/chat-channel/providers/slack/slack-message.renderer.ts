import type {
  ChannelButton,
  ChannelMessage,
  ChatChannelConfig,
  ChatChannelInternalEvent,
  EiaEvent,
} from '../../types';
import type { PresentationPayload } from '../../../../shared/conversation-thread/conversation-thread.types';
import { classifyExecutionFailure } from '../../shared/execution-failure-classifier';
import {
  resolveLanguageHint,
  applyPlaceholders,
  type LanguageLocale,
} from '../../shared/language-hint-defaults';

/**
 * Slack mrkdwn / Block Kit renderer (pure, side-effect free).
 *
 * Spec [providers/slack §5] / [conventions chat-channel-adapter §3]:
 *   - 5.1 ai_message → text (mrkdwn, 3500자 분할)
 *   - 5.2 waiting_for_input(buttons) → buttons
 *   - 5.3 waiting_for_input(form) → form_prompt (다단계 — 첫 필드만)
 *   - 5.4 waiting_for_input + visual node → text fallback (v1)
 *   - 5.5 typing → no-op (Slack Web API 미지원, R-S-5)
 *   - completed / failed / cancelled → text (languageHints 또는 default)
 *
 * Slack mrkdwn escape: `<`, `>`, `&` 만 (Slack 권장 — `&` → `&amp;` 등).
 * ChannelMessage.conversationKey 는 dispatcher 가 보정하므로 본 renderer 는 빈 string 으로 채움
 * (Telegram renderer 와 동일 패턴).
 */

const SLACK_TEXT_LIMIT = 3500;
const CONTINUED_SUFFIX = '\n_(continued…)_';

/** Slack mrkdwn escape — <, >, & 만 escape. */
export function escapeSlackMrkdwn(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function renderSlackEvent(
  event: EiaEvent | ChatChannelInternalEvent,
  config: ChatChannelConfig,
): ChannelMessage[] {
  switch (event.type) {
    case 'execution.ai_message':
      return renderAiMessage(event, config);
    case 'execution.completed':
      return [
        textMessage(
          config.languageHints?.executionCompleted ??
            '워크플로우가 완료되었습니다.',
        ),
      ];
    case 'execution.failed':
      return [textMessage(renderFailedMessage(event, config))];
    case 'execution.cancelled':
      return [
        textMessage(
          config.languageHints?.executionCancelled ??
            '워크플로우가 취소되었습니다.',
        ),
      ];
    case 'execution.waiting_for_input':
      return renderWaitingForInput(event, config);
    case 'execution.node.completed':
      return renderNodeCompleted(event, config);
    default:
      return [];
  }
}

/**
 * CCH-MP-01 보강 (2026-05-25): Slack renderer 의 ai_message 가 응답 텍스트
 * 다음에 `presentations?: PresentationPayload[]` 를 sequential 발송.
 * SoT: spec/conventions/chat-channel-adapter.md §3 매핑 표.
 */
function renderAiMessage(
  event: Extract<EiaEvent, { type: 'execution.ai_message' }>,
  config: ChatChannelConfig,
): ChannelMessage[] {
  const out: ChannelMessage[] = [...chunkText(event.message)];
  const presentations = event.presentations;
  if (Array.isArray(presentations) && presentations.length > 0) {
    for (const p of presentations) {
      out.push(...renderPresentationPayload(p, config));
    }
  }
  return out;
}

/**
 * CCH-MP-06 (2026-05-25): 비-blocking presentation 노드 완료 → Slack 메시지.
 * v1 fallback 정책 (mrkdwn 텍스트) 그대로 적용.
 */
function renderNodeCompleted(
  event: Extract<ChatChannelInternalEvent, { type: 'execution.node.completed' }>,
  config: ChatChannelConfig,
): ChannelMessage[] {
  return renderPresentationByType(event.node.type, event.output, config);
}

function renderPresentationPayload(
  presentation: PresentationPayload,
  config: ChatChannelConfig,
): ChannelMessage[] {
  if (presentation.type === 'form') return [];
  return renderPresentationByType(
    presentation.type,
    { payload: presentation.payload },
    config,
  );
}

function renderPresentationByType(
  type: 'carousel' | 'table' | 'chart' | 'template',
  nodeOutput: Record<string, unknown>,
  _config: ChatChannelConfig,
): ChannelMessage[] {
  if (type === 'template') {
    const rendered =
      typeof nodeOutput.rendered === 'string'
        ? nodeOutput.rendered
        : typeof (nodeOutput.payload as { rendered?: unknown } | undefined)
              ?.rendered === 'string'
          ? (nodeOutput.payload as { rendered: string }).rendered
          : null;
    if (rendered === null || rendered.length === 0) return [];
    return chunkText(rendered);
  }
  const payload =
    (nodeOutput.payload as unknown) ?? (nodeOutput as unknown);
  const text = renderVisualFallback(type, payload);
  if (!text) return [];
  return chunkText(text);
}

function renderWaitingForInput(
  event: Extract<EiaEvent, { type: 'execution.waiting_for_input' }>,
  config: ChatChannelConfig,
): ChannelMessage[] {
  const interactionType = event.node?.interactionType;
  // chat channel 에서 ai_conversation / ai_form_render waiting 은 silent — 직전 ai_message
  // event 가 응답 본문 발송 책임. conversationConfig.message 는 frontend reconcile 용
  // echo 라 chat channel 에 발송 시 사용자에게 중복 도착.
  // SoT: spec/conventions/chat-channel-adapter.md §3 (2026-05-25 갱신).
  if (
    interactionType === 'ai_conversation' ||
    interactionType === 'ai_form_render'
  ) {
    return [];
  }
  if (interactionType === 'buttons') {
    return renderButtons(event, config);
  }
  if (interactionType === 'form') {
    return renderFormFirstField(event);
  }
  return [];
}

function renderButtons(
  event: Extract<EiaEvent, { type: 'execution.waiting_for_input' }>,
  config: ChatChannelConfig,
): ChannelMessage[] {
  const buttonConfig = event.context?.buttonConfig as
    | {
        prompt?: string;
        buttons?: Array<{
          id?: string;
          label?: string;
          style?: 'primary' | 'danger' | 'none';
          type?: 'callback' | 'link';
          url?: string;
        }>;
        nodeOutput?: { nodeType?: string; payload?: unknown };
      }
    | undefined;
  if (!buttonConfig?.buttons || buttonConfig.buttons.length === 0) return [];

  const messages: ChannelMessage[] = [];
  // 시각형 nodeOutput → v1 = mrkdwn text fallback (Spec §5.4).
  const visualType = buttonConfig.nodeOutput?.nodeType;
  if (
    visualType === 'chart' ||
    visualType === 'table' ||
    visualType === 'carousel'
  ) {
    const visualText = renderVisualFallback(
      visualType,
      buttonConfig.nodeOutput?.payload,
    );
    if (visualText.length > 0) messages.push(textMessage(visualText));
  }

  const buttons: ChannelButton[] = buttonConfig.buttons
    .filter((b) => typeof b.id === 'string' && typeof b.label === 'string')
    .map((b) => ({
      id: b.id!,
      label: b.label!,
      type: b.type ?? 'callback',
      url: b.url,
      style: b.style ?? 'none',
    }));
  messages.push({
    conversationKey: '',
    body: {
      kind: 'buttons',
      text: buttonConfig.prompt ?? '선택해 주세요',
      buttons,
    },
  });
  void config;
  return messages;
}

function renderFormFirstField(
  event: Extract<EiaEvent, { type: 'execution.waiting_for_input' }>,
): ChannelMessage[] {
  const formConfig = event.context?.formConfig as
    | {
        fields?: Array<{
          name?: string;
          label?: string;
          type?: string;
          required?: boolean;
          description?: string;
        }>;
      }
    | undefined;
  const first = formConfig?.fields?.[0];
  if (!first?.name || !first.label) return [];
  return [
    {
      conversationKey: '',
      body: {
        kind: 'form_prompt',
        fieldName: first.name,
        label: `${first.label}${first.required ? ' *' : ''}${
          first.description ? `\n${first.description}` : ''
        }`,
        hint: mapFieldTypeToHint(first.type),
      },
    },
  ];
}

function mapFieldTypeToHint(
  type: string | undefined,
):
  | 'text'
  | 'number'
  | 'email'
  | 'phone'
  | 'date'
  | 'file_upload'
  | 'share_contact'
  | undefined {
  switch (type) {
    case 'number':
      return 'number';
    case 'email':
      return 'email';
    case 'date':
      return 'date';
    case 'file':
      return 'file_upload';
    case 'text':
    case 'textarea':
      return 'text';
    default:
      return undefined;
  }
}

function renderVisualFallback(nodeType: string, payload: unknown): string {
  if (nodeType === 'chart') {
    const p = payload as
      | { title?: string; series?: number[]; labels?: string[] }
      | undefined;
    if (!p) return '';
    const title =
      typeof p.title === 'string' ? `*${escapeSlackMrkdwn(p.title)}*\n` : '';
    const lines: string[] = [];
    const labels = Array.isArray(p.labels) ? p.labels : [];
    const series = Array.isArray(p.series) ? p.series : [];
    const max = Math.max(0, ...series.filter((n) => typeof n === 'number'));
    series.slice(0, 20).forEach((v, i) => {
      const label = labels[i] ?? `#${i + 1}`;
      const barWidth = max > 0 ? Math.round((Number(v) / max) * 24) : 0;
      lines.push(
        `${String(label).slice(0, 10).padEnd(10)} | ${'█'.repeat(barWidth)} ${v}`,
      );
    });
    return `${title}\`\`\`\n${lines.join('\n')}\n\`\`\``;
  }
  if (nodeType === 'table') {
    const p = payload as
      | { rows?: Array<Record<string, unknown>>; columns?: string[] }
      | undefined;
    if (!p?.rows || !p.columns) return '';
    const cols = p.columns.slice(0, 6);
    const header = cols.join(' | ');
    const rows = p.rows
      .slice(0, 20)
      .map((r) => cols.map((c) => stringifyCell(r[c]).slice(0, 16)).join(' | '))
      .join('\n');
    return `\`\`\`\n${header}\n${'-'.repeat(header.length)}\n${rows}\n\`\`\``;
  }
  if (nodeType === 'carousel') {
    const p = payload as
      | { items?: Array<{ title?: string; description?: string }> }
      | undefined;
    if (!p?.items) return '';
    return p.items
      .slice(0, 10)
      .map(
        (it, i) =>
          `*${i + 1}. ${escapeSlackMrkdwn(it.title ?? '')}*\n${
            it.description ? escapeSlackMrkdwn(it.description) : ''
          }`,
      )
      .join('\n\n');
  }
  return '';
}

/**
 * Spec [providers/slack §5.6] / CCH-ERR-01~03 — Execution Failed.
 *
 * Breaking change (2026-05-25): 이전 구현은 `{{code}}` / `{{message}}` placeholder 로
 * `error.code` / `error.message` 원문을 사용자에게 노출했다 — CCH-ERR-03 위반 (내부
 * 인프라 정보 / 노드 핸들러 stack 누설 위험). 본 함수는 분류 helper 결과의 generic
 * i18n 문구만 사용 + `{statusCode}` placeholder 1종만 허용.
 *
 * Slack mrkdwn 무사용 — plain text 만 (blocks 미부여, thread_ts 미부여).
 */
function renderFailedMessage(
  event: Extract<EiaEvent, { type: 'execution.failed' }>,
  config: ChatChannelConfig,
): string {
  const { key, placeholders } = classifyExecutionFailure(event);
  const template = resolveLanguageHint(
    key,
    config.languageHints,
    config.languageLocale as LanguageLocale | undefined,
  );
  return applyPlaceholders(template, placeholders);
}

function chunkText(text: string): ChannelMessage[] {
  if (text.length <= SLACK_TEXT_LIMIT) return [textMessage(text)];
  const chunks: string[] = [];
  let cursor = 0;
  while (cursor < text.length) {
    const isLast = cursor + SLACK_TEXT_LIMIT >= text.length;
    const slice = text.slice(cursor, cursor + SLACK_TEXT_LIMIT);
    const suffix = isLast ? '' : CONTINUED_SUFFIX;
    chunks.push(slice + suffix);
    cursor += SLACK_TEXT_LIMIT;
  }
  return chunks.map((c) => ({
    conversationKey: '',
    body: { kind: 'text', text: c, chunked: true } as const,
  }));
}

function textMessage(text: string): ChannelMessage {
  return {
    conversationKey: '',
    body: { kind: 'text', text },
  };
}

function stringifyCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  ) {
    return String(value);
  }
  // object / array — JSON 직렬화 (테이블 cell 의 비-스칼라 값 fallback).
  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
}
