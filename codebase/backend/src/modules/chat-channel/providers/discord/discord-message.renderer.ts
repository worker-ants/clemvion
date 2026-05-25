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
 * Discord renderer (pure, side-effect free).
 *
 * Spec [providers/discord §5]:
 *   - 5.1 ai_message → text (2000 char hard limit + Reply button)
 *   - 5.2 buttons → ACTION_ROW + BUTTON components
 *   - 5.3 form → form_prompt (v1 다단계, modal 은 v2)
 *   - 5.4 시각형 → markdown fallback (v1)
 *   - 5.5 typing → typing kind (sendMessage 가 POST /channels/{id}/typing)
 *   - completed / failed / cancelled → text
 *
 * conversationKey 는 dispatcher 가 보정.
 */

const DISCORD_TEXT_LIMIT = 2000;
const CONTINUED_SUFFIX = '\n_(continued…)_';

export function renderDiscordEvent(
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
 * CCH-MP-01 보강 (2026-05-25): AI Multi Turn 의 `execution.ai_message` 가 응답
 * 텍스트 다음에 `presentations?: PresentationPayload[]` (AI Agent `render_*` 도구
 * 호출 turn) 를 sequential 발송한다. `Promise.all` 금지 — provider rate limit +
 * 표시 순서 보장.
 *
 * SoT: spec/conventions/chat-channel-adapter.md §3 매핑 표 `execution.ai_message`
 *      행. R-CC-16 / R-CC-17 (chat-channel-form-template-render-fix).
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
 * CCH-MP-06 (2026-05-25): 비-blocking presentation 노드 (`template` body,
 * `carousel`/`table`/`chart` 의 buttons 없음 케이스) 의 `execution.node.completed`
 * → Discord 메시지로 변환. v1 fallback 정책은 CCH-MP-04 (Discord §5.4) 와 동일.
 *
 * SoT: spec/5-system/15-chat-channel.md §3.3 CCH-MP-06,
 *      spec/conventions/chat-channel-adapter.md §3 매핑 표 + §R-CCA-7.
 */
function renderNodeCompleted(
  event: Extract<
    ChatChannelInternalEvent,
    { type: 'execution.node.completed' }
  >,
  config: ChatChannelConfig,
): ChannelMessage[] {
  return renderPresentationByType(event.node.type, event.output, config);
}

/**
 * AI Agent `render_*` 도구가 emit 한 PresentationPayload 1건을 channel 메시지로
 * 변환. payload shape 은 [spec/4-nodes/3-ai/1-ai-agent.md §7.10] 의
 * `PresentationPayload` — `{type, toolCallId, renderedAt, payload, truncation?}`.
 *
 * 두 진입 경로:
 *   1. `execution.node.completed` (CCH-MP-06) — handler structured `{config, output}` shape
 *   2. `execution.ai_message.presentations[]` (CCH-MP-01 보강) — `{payload: {...}}` wrapped
 *
 * `type === 'form'` 은 별 plan `chat-channel-form-native-modal` v2 가 native
 * modal 로 격상하기 전까지 v1 임시 skip — Discord 는 텔레그램과 달리 v1 fallback
 * text 도입 안 함 (별도 결정).
 *
 * v1 fallback 정책 재사용 (CCH-MP-04 §5.4): `nodeOutput` shape 으로 변환해
 * 기존 `renderVisualFallback` (markdown 텍스트) 사용.
 */
function renderPresentationPayload(
  presentation: PresentationPayload,
  config: ChatChannelConfig,
): ChannelMessage[] {
  // 회귀 ④ fix (사용자 보고 2026-05-25): render_form 도 v1 임시 fallback 발화.
  // SoT: spec/conventions/chat-channel-adapter.md §3.
  if (presentation.type === 'form') {
    return renderFormFallback(presentation.payload);
  }
  return renderPresentationByType(
    presentation.type,
    { payload: presentation.payload },
    config,
  );
}

/**
 * 회귀 ⑤ (사용자 보고 2026-05-25): handler structured return shape 처리.
 * nodeOutput 의 여러 위치 (payload/output/config/flat) 에서 본문 추출.
 */
function extractRendered(nodeOutput: Record<string, unknown>): string | null {
  const candidates: unknown[] = [
    nodeOutput.rendered,
    (nodeOutput.payload as { rendered?: unknown } | undefined)?.rendered,
    (nodeOutput.output as { rendered?: unknown } | undefined)?.rendered,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.length > 0) return c;
  }
  return null;
}

function extractVisualPayload(
  type: 'carousel' | 'table' | 'chart',
  nodeOutput: Record<string, unknown>,
): unknown {
  const keys =
    type === 'carousel' ? ['items'] : type === 'table' ? ['rows'] : ['series'];
  const hasArrayKey = (v: unknown): boolean => {
    if (!v || typeof v !== 'object') return false;
    const obj = v as Record<string, unknown>;
    return keys.some((k) => Array.isArray(obj[k]));
  };
  const candidates: unknown[] = [
    nodeOutput.payload,
    nodeOutput.output,
    nodeOutput.config,
    nodeOutput,
  ];
  return candidates.find(hasArrayKey) ?? nodeOutput.payload ?? nodeOutput;
}

/**
 * presentation 4종 (`template`/`carousel`/`table`/`chart`) 별 분기 — Discord v1
 * fallback (markdown 텍스트) 함수 재사용. 세 진입점 공유 (renderNodeCompleted /
 * renderPresentationPayload). handler structured return shape (회귀 ⑤, PR #329)
 * 보강은 위 `extractRendered`/`extractVisualPayload` 가 처리.
 *
 * SoT: spec/conventions/chat-channel-adapter.md §3 매핑 표 + §R-CCA-7.
 */
function renderPresentationByType(
  type: 'carousel' | 'table' | 'chart' | 'template',
  nodeOutput: Record<string, unknown>,
  _config: ChatChannelConfig,
): ChannelMessage[] {
  if (type === 'template') {
    const rendered = extractRendered(nodeOutput);
    if (rendered === null) return [];
    return chunkText(rendered);
  }
  // chart/table/carousel: 기존 renderVisualFallback (markdown 텍스트) 재사용.
  const payload = extractVisualPayload(type, nodeOutput);
  const text = renderVisualFallback(type, payload);
  if (!text) return [];
  return chunkText(text);
}

/**
 * 회귀 ④ (사용자 보고 2026-05-25): AI Agent `render_form` v1 임시 fallback.
 * SoT: spec/conventions/chat-channel-adapter.md §3 매핑 표 (2026-05-25 갱신).
 */
function renderFormFallback(
  payload: Record<string, unknown>,
): ChannelMessage[] {
  const fields = Array.isArray(payload?.fields)
    ? (payload.fields as Array<{
        name?: unknown;
        label?: unknown;
        type?: unknown;
        required?: unknown;
      }>)
    : [];
  if (fields.length === 0) return [];
  const lines: string[] = ['📝 입력이 필요해요:'];
  for (const f of fields) {
    const label = typeof f.label === 'string' ? f.label : '';
    const name = typeof f.name === 'string' ? f.name : '';
    const fieldType = typeof f.type === 'string' ? f.type : 'text';
    const required = f.required === true ? ' *' : '';
    const display = label || name;
    if (!display) continue;
    lines.push(`• ${display}${required} (${fieldType})`);
  }
  lines.push('');
  lines.push('답변을 메시지로 보내주세요.');
  return chunkText(lines.join('\n'));
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
    const title = typeof p.title === 'string' ? `**${p.title}**\n` : '';
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
        (it, i) => `**${i + 1}. ${it.title ?? ''}**\n${it.description ?? ''}`,
      )
      .join('\n\n');
  }
  return '';
}

/**
 * Spec [providers/discord §5.6] / CCH-ERR-01~03 — Execution Failed.
 *
 * Breaking change (2026-05-25): 이전 구현은 `{{code}}` / `{{message}}` placeholder 로
 * `error.code` / `error.message` 원문을 사용자에게 노출했다 — CCH-ERR-03 위반 (내부
 * 인프라 정보 / 노드 핸들러 stack 누설 위험). 본 함수는 분류 helper 결과의 generic
 * i18n 문구만 사용 + `{statusCode}` placeholder 1종만 허용.
 *
 * Discord plain text 만 (embeds 미부여, components 미부여, message_reference 미부여).
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
  if (text.length <= DISCORD_TEXT_LIMIT) return [textMessage(text)];
  const chunks: string[] = [];
  let cursor = 0;
  while (cursor < text.length) {
    const isLast = cursor + DISCORD_TEXT_LIMIT >= text.length;
    const slice = text.slice(cursor, cursor + DISCORD_TEXT_LIMIT);
    chunks.push(slice + (isLast ? '' : CONTINUED_SUFFIX));
    cursor += DISCORD_TEXT_LIMIT;
  }
  return chunks.map((c) => ({
    conversationKey: '',
    body: { kind: 'text', text: c, chunked: true } as const,
  }));
}

function textMessage(text: string): ChannelMessage {
  return { conversationKey: '', body: { kind: 'text', text } };
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
  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
}
