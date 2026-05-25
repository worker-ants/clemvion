import {
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

const TELEGRAM_MESSAGE_LIMIT = 4096;
const CONTINUED_SUFFIX = '\n_(continued…)_';

/**
 * Telegram MarkdownV2 escape rule per Bot API docs.
 * Escape: `_ * [ ] ( ) ~ ` > # + - = | { } . !`
 */
const MD_V2_ESCAPE_REGEX = /([_*[\]()~`>#+\-=|{}.!])/g;

export function escapeMarkdownV2(text: string): string {
  return text.replace(MD_V2_ESCAPE_REGEX, '\\$1');
}

/**
 * EiaEvent → ChannelMessage[] 변환 (pure, side-effect free).
 *
 * Spec [providers/telegram §5] / [conventions chat-channel-adapter §3]:
 *   - ai_message → text (chunked if >4096)
 *   - completed → text (languageHints.executionCompleted)
 *   - failed → text (사용자 안전 안내)
 *   - cancelled → text (languageHints.executionCancelled 또는 default)
 *   - waiting_for_input(ai_conversation) → text (conversationConfig.message)
 *   - waiting_for_input(buttons) → buttons (Phase 3 에서 구현)
 *   - waiting_for_input(form) → form_prompt (Phase 4 에서 구현)
 *
 * v1 (Phase 2 / PR-A) = text 만. 그 외 분기는 Phase 3/4/5 에서 fill in.
 */
export function renderTelegramMessages(
  event: EiaEvent | ChatChannelInternalEvent,
  config: ChatChannelConfig,
): ChannelMessage[] {
  switch (event.type) {
    case 'execution.ai_message':
      return renderAiMessage(event, config);
    case 'execution.completed':
      return renderText(
        config.languageHints?.executionCompleted ??
          '워크플로우가 완료되었습니다.',
      );
    case 'execution.failed':
      return renderText(renderFailureMessage(event, config));
    case 'execution.cancelled':
      return renderText(
        config.languageHints?.executionCancelled ??
          '워크플로우가 취소되었습니다.',
      );
    case 'execution.waiting_for_input':
      return renderWaitingForInput(event, config);
    case 'execution.node.completed':
      return renderNodeCompleted(event, config);
  }
}

/**
 * CCH-MP-01 보강 (2026-05-25): AI Multi Turn 의 `execution.ai_message` 가 응답
 * 텍스트 다음에 `presentations?: PresentationPayload[]` (AI Agent `render_*` 도구
 * 호출 turn) 를 sequential 발송한다. `Promise.all` 금지 — provider rate limit +
 * 표시 순서 보장. `form` (interactive) 은 별 plan `chat-channel-form-native-modal`
 * 추적 — 본 룰 처리 대상 아님.
 *
 * SoT: spec/conventions/chat-channel-adapter.md §3 매핑 표 `execution.ai_message` 행.
 */
function renderAiMessage(
  event: Extract<EiaEvent, { type: 'execution.ai_message' }>,
  config: ChatChannelConfig,
): ChannelMessage[] {
  const out: ChannelMessage[] = [...renderText(event.message)];
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
 * → 채널 메시지로 변환. v1 fallback 정책은 CCH-MP-04 (텔레그램 §5.4) 와 동일.
 *
 * SoT: spec/5-system/15-chat-channel.md §3.3 CCH-MP-06,
 *      spec/conventions/chat-channel-adapter.md §3 매핑 표 + §R-CCA-7.
 */
function renderNodeCompleted(
  event: Extract<ChatChannelInternalEvent, { type: 'execution.node.completed' }>,
  config: ChatChannelConfig,
): ChannelMessage[] {
  return renderPresentationByType(
    event.node.type,
    event.output,
    config,
  );
}

/**
 * AI Agent `render_*` 도구가 emit 한 PresentationPayload 1건을 channel 메시지로
 * 변환. payload shape 은 [spec/4-nodes/3-ai/1-ai-agent.md §7.10] 의
 * `PresentationPayload` — `{type, toolCallId, renderedAt, payload, truncation?}`.
 *
 * `type === 'form'` 은 별 plan 추적 — skip.
 *
 * v1 fallback 정책 재사용 (CCH-MP-04 §5.4): `nodeOutput` shape 으로 변환해
 * 기존 `renderCarouselFallback` / `renderTableFallback` / `renderChartFallback`
 * 사용.
 */
function renderPresentationPayload(
  presentation: PresentationPayload,
  config: ChatChannelConfig,
): ChannelMessage[] {
  // render_form 은 별 plan — 본 룰 처리 대상 아님.
  if (presentation.type === 'form') return [];
  return renderPresentationByType(
    presentation.type,
    // PresentationPayload 의 `payload` 는 zod-validated 본문 (`items`/`rows`/`rendered` 등).
    // §5.4 fallback 함수들은 `nodeOutput.payload` shape 을 요구하므로 그대로 wrap.
    { payload: presentation.payload },
    config,
  );
}

/**
 * presentation 4종 (`template`/`carousel`/`table`/`chart`) 별 분기 — §5.4 v1
 * fallback 함수 재사용. `execution.node.completed` (output 직접) /
 * `execution.ai_message.presentations[]` (payload wrapping) 두 진입점 공유.
 */
function renderPresentationByType(
  type: 'carousel' | 'table' | 'chart' | 'template',
  nodeOutput: Record<string, unknown>,
  config: ChatChannelConfig,
): ChannelMessage[] {
  switch (type) {
    case 'template': {
      // Template: `output.rendered` 본문 직접 추출.
      // 1) execution.node.completed: `output = { rendered: '...' }`
      // 2) ai_message.presentations[i]: `nodeOutput = { payload: { rendered: '...' } }`
      const rendered =
        typeof nodeOutput.rendered === 'string'
          ? nodeOutput.rendered
          : typeof (nodeOutput.payload as { rendered?: unknown } | undefined)
                ?.rendered === 'string'
            ? (nodeOutput.payload as { rendered: string }).rendered
            : null;
      if (rendered === null || rendered.length === 0) return [];
      return renderText(rendered);
    }
    case 'carousel':
      return renderCarouselFallback(nodeOutput, config);
    case 'table':
      return renderTableFallback(nodeOutput, config);
    case 'chart':
      return renderChartFallback(nodeOutput, config);
  }
}

/**
 * Spec [providers/telegram §5.6] / CCH-ERR-01~03 — Execution Failed.
 *
 * classifier 가 (key, placeholders) 결정 → resolveLanguageHint 로 3-level lookup →
 * applyPlaceholders 로 {statusCode} 치환. MarkdownV2 escape 는 renderText 에서 자동 적용.
 *
 * 민감정보 (error.message, nodeId, executionId, details.url 등) 는 본 함수에서 절대
 * 사용하지 않는다 (CCH-ERR-03 — 입력은 classifier 의 결과만).
 */
function renderFailureMessage(
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

function renderText(rawText: string): ChannelMessage[] {
  const escaped = escapeMarkdownV2(rawText);
  const chunks = splitByLimit(escaped, TELEGRAM_MESSAGE_LIMIT);
  return chunks.map((text, idx) => ({
    conversationKey: '', // dispatcher 가 보정
    body: {
      kind: 'text' as const,
      text,
      chunked: chunks.length > 1,
    },
    ...(idx === chunks.length - 1 ? {} : { _continuation: true }),
  }));
}

function renderWaitingForInput(
  event: Extract<EiaEvent, { type: 'execution.waiting_for_input' }>,
  config: ChatChannelConfig,
): ChannelMessage[] {
  switch (event.node.interactionType) {
    // chat channel 안에서 ai_conversation / ai_form_render 의 waiting 은 silent.
    // 이유: ai-agent multi-turn 의 매 turn 마다 (a) `ai_message` event 가 응답 본문을
    // emit 하고 (b) 직후 `waiting_for_input(ai_conversation).conversationConfig.message`
    // 가 같은 본문을 echo (frontend reconcile 용) → chat channel 에 둘 다 발송하면
    // 사용자에게 동일 메시지 2회 도착. messaging app UX 에서 텍스트 입력 자체가
    // default prompt 이므로 awaitingInput 안내도 발송 안 함.
    // SoT: spec/conventions/chat-channel-adapter.md §3 (2026-05-25 갱신).
    case 'ai_conversation':
    case 'ai_form_render':
      return [];
    case 'buttons':
      return renderButtons(event, config);
    case 'form':
      return renderFormPrompt(event, config);
  }
}

/**
 * Spec [providers/telegram §5.2] / CCH-MP-02 — Button Presentation.
 *
 * `buttonConfig.buttons[]` → `body.kind='buttons'`. dispatcher 가 sendMessage 호출.
 * nodeOutput 이 시각형 (carousel/chart/table) 이면 image 가 먼저 (Phase 5/PR-D 에서 추가).
 */
function renderButtons(
  event: Extract<EiaEvent, { type: 'execution.waiting_for_input' }>,
  config: ChatChannelConfig,
): ChannelMessage[] {
  const buttonConfig = event.context.buttonConfig as
    | {
        buttons?: Array<{
          id?: string;
          label?: string;
          type?: 'callback' | 'link';
          url?: string;
          style?: 'primary' | 'danger' | 'none';
        }>;
        prompt?: string;
        nodeOutput?: { nodeType?: string; rendered?: unknown; title?: string };
      }
    | undefined;
  const rawButtons = Array.isArray(buttonConfig?.buttons)
    ? buttonConfig.buttons
    : [];
  const buttons: ChannelButton[] = rawButtons
    .filter(
      (
        b,
      ): b is {
        id: string;
        label: string;
        type?: 'callback' | 'link';
        url?: string;
        style?: 'primary' | 'danger' | 'none';
      } => typeof b?.id === 'string' && typeof b?.label === 'string',
    )
    .map((b) => ({
      id: b.id,
      label: b.label,
      type: b.type ?? 'callback',
      url: b.url,
      style: b.style,
    }));
  const promptText =
    (typeof buttonConfig?.prompt === 'string' && buttonConfig.prompt.length > 0
      ? buttonConfig.prompt
      : null) ??
    config.languageHints?.buttonPrompt ??
    '선택해주세요.';
  const out: ChannelMessage[] = [];

  // 시각형 노드 출력이 있으면 시각 ChannelMessage 시퀀스를 먼저 발송 (텔레그램 §5.4 / CCH-MP-04 v1).
  // [Spec Chat Channel R-CC-11] visualNode enum 분기:
  //   - 'text'     → 시각형 미발송 (carousel imageUrl 도 무시. legacy 'text_only' 는 DTO 단에서 normalize)
  //   - 'photo'    → v1 단계는 SSR 인프라 미도입 → fallback to text + warning 로그 (chat_channel_health 변경 없음)
  //   - 'auto'/미설정 → 노드별 휴리스틱 (chart/table → text, carousel → 카드별 imageUrl 분기)
  const nodeOutput = buttonConfig?.nodeOutput as
    | { nodeType?: string; payload?: unknown; title?: string }
    | undefined;
  const visualKind = nodeOutput?.nodeType;
  // legacy 'text_only' 가 DB 에 남아있는 경우 read-time normalize (DTO normalize 와 중복 안전망).
  const rawVisualNode = config.uiMapping?.visualNode;
  const visualNode: 'text' | 'photo' | 'auto' =
    rawVisualNode === 'text_only'
      ? 'text'
      : rawVisualNode === 'photo' || rawVisualNode === 'text'
        ? rawVisualNode
        : 'auto';
  if (visualNode === 'photo') {
    // v1 fallback — SSR PNG 인프라 도입 시 별 plan `chat-channel-visual-ssr-png` 의 SSR adapter 로 위임.
    console.warn(
      `[chat-channel/telegram] uiMapping.visualNode='photo' is not supported in v1 — falling back to text (nodeType=${visualKind ?? 'none'})`,
    );
  }
  if (visualNode !== 'text' && typeof visualKind === 'string') {
    if (visualKind === 'chart') {
      out.push(...renderChartFallback(nodeOutput, config));
    } else if (visualKind === 'table') {
      out.push(...renderTableFallback(nodeOutput, config));
    } else if (visualKind === 'carousel') {
      out.push(...renderCarouselFallback(nodeOutput, config));
    } else if (
      visualKind === 'template' &&
      typeof (nodeOutput as { rendered?: unknown }).rendered === 'string'
    ) {
      // template plain text fallback — HTML 은 noop (SSR PNG v2 영역).
      out.push(...renderText((nodeOutput as { rendered: string }).rendered));
    } else if (typeof nodeOutput?.title === 'string' && nodeOutput.title) {
      // 미인식 visualKind — title 만 안내.
      out.push(...renderText(nodeOutput.title));
    }
  }

  out.push({
    conversationKey: '',
    body: {
      kind: 'buttons',
      text: escapeMarkdownV2(promptText),
      buttons,
    },
  });
  return out;
}

/**
 * Spec [providers/telegram §5.3] / CCH-MP-03 — Form 다단계 시퀀스.
 *
 * waiting_for_input(form) 도착 시 첫 prompt 만 발행. 후속 필드는 사용자 응답 도착 시 HooksService
 * → dispatcher 가 next field prompt 를 직접 발송 (state 는 ChannelConversation.formState).
 *
 * v1 PR-C: currentFieldIdx 가 event.interaction.currentFieldIdx 로 들어오면 그 위치, 아니면 0.
 */
function renderFormPrompt(
  event: Extract<EiaEvent, { type: 'execution.waiting_for_input' }>,
  config: ChatChannelConfig,
): ChannelMessage[] {
  const formConfig = event.context.formConfig as
    | {
        fields?: Array<{
          name?: string;
          label?: string;
          description?: string;
          type?: string;
          required?: boolean;
        }>;
      }
    | undefined;
  const fields = Array.isArray(formConfig?.fields) ? formConfig.fields : [];
  if (fields.length === 0) {
    return renderText(
      config.languageHints?.unsupportedInteraction ?? '폼이 비어 있습니다.',
    );
  }
  const currentIdx =
    typeof (event.interaction as { currentFieldIdx?: unknown })
      .currentFieldIdx === 'number'
      ? ((event.interaction as { currentFieldIdx: number }).currentFieldIdx ??
        0)
      : 0;
  const field = fields[Math.min(currentIdx, fields.length - 1)];
  if (!field?.name || !field?.label) {
    return renderText(
      config.languageHints?.unsupportedInteraction ??
        '폼 필드가 잘못되었습니다.',
    );
  }
  const required = field.required === true;
  const labelLine = `${field.label}${required ? ' *' : ''}`;
  const descLine = field.description ? `\n${field.description}` : '';
  return [
    {
      conversationKey: '',
      body: {
        kind: 'form_prompt',
        fieldName: field.name,
        label: `${labelLine}${descLine}`,
        hint: keyboardHintForFieldType(field.type),
      },
    },
  ];
}

function keyboardHintForFieldType(
  fieldType: string | undefined,
):
  | 'text'
  | 'number'
  | 'email'
  | 'phone'
  | 'date'
  | 'file_upload'
  | 'share_contact'
  | undefined {
  switch (fieldType) {
    case 'number':
      return 'number';
    case 'email':
      return 'email';
    case 'phone':
      return 'share_contact';
    case 'date':
      return 'date';
    case 'file':
      return 'file_upload';
    case 'text':
    case 'textarea':
    case 'select':
    case 'radio':
    case 'checkbox':
      return 'text';
    default:
      return undefined;
  }
}

/**
 * Telegram 4096자 한계 분할.
 *
 * 단순 size-based — 마지막 chunk 전까지는 CONTINUED_SUFFIX (`\n_(continued…)_`) 가
 * 본문에 포함. 단어 경계 splitting 은 v1 best-effort — 너무 긴 단일 단어는 그대로 자른다.
 *
 * Telegram MarkdownV2 escape 가 적용된 텍스트 가정 — `\\.` 같은 escape sequence 의 중간을
 * 자르지 않도록 cut 위치를 한 글자 뒤로 이동.
 */
function splitByLimit(text: string, limit: number): string[] {
  if (text.length <= limit) return [text];
  const chunks: string[] = [];
  let cursor = 0;
  const reserve = CONTINUED_SUFFIX.length;
  while (cursor < text.length) {
    const remaining = text.length - cursor;
    if (remaining <= limit) {
      chunks.push(text.slice(cursor));
      break;
    }
    // 다음 chunk = (limit - reserve) 만큼, 단어 경계로 정렬 시도.
    const naive = cursor + (limit - reserve);
    let cut = naive;
    // 단어 경계 탐색 (뒤로 최대 80자).
    for (let i = naive; i > naive - 80 && i > cursor; i -= 1) {
      const ch = text.charAt(i);
      if (ch === ' ' || ch === '\n') {
        cut = i;
        break;
      }
    }
    // escape sequence 중간 회피 — `\\` 의 직후 글자가 잘려도 chunk 의 끝이 backslash 가
    // 되지 않게 한 글자 추가 이동.
    if (text.charAt(cut - 1) === '\\') cut -= 1;
    if (cut <= cursor) cut = naive; // fallback — 전혀 자를 곳이 없으면 그냥 자른다.
    chunks.push(text.slice(cursor, cut) + CONTINUED_SUFFIX);
    cursor = cut;
  }
  return chunks;
}

// ----------------------------------------------------------------------------
// Visual fallback renderers (CCH-MP-04 v1 — MarkdownV2 텍스트/monospace 표현)
// ----------------------------------------------------------------------------

const TABLE_ROW_CAP = 20;
const TABLE_CELL_MAX_WIDTH = 16;
const CAROUSEL_CARD_CAP = 10;
const CHART_BAR_WIDTH = 24;

/** MarkdownV2 monospace code block 으로 감싼다. ``` 자체는 escape 미적용. */
function wrapMonospace(text: string): string {
  return '```\n' + text + '\n```';
}

/** 텍스트를 cell width 에 맞춰 padEnd (다국어 문자도 대략 정렬 — surrogate 무시). */
function padCell(value: string, width: number): string {
  if (value.length >= width) return value;
  return value + ' '.repeat(width - value.length);
}

/** 너무 긴 cell 값 truncate. */
function truncateCell(value: string, maxWidth: number): string {
  if (value.length <= maxWidth) return value;
  return value.slice(0, maxWidth - 1) + '…';
}

/**
 * Chart fallback — `nodeOutput.payload.{title, series, labels}` 에서 단일 series 의
 * monospace mini bar chart 생성. 다중 series 는 first series 만 사용 (안내 footer).
 *
 * payload shape (chart node 가 emit 하는 형식, [Spec Chart](../../6-presentation/3-chart.md)):
 *   { title?: string, labels?: string[], series?: Array<{ name?: string, data?: number[] }> }
 */
function renderChartFallback(
  nodeOutput: { title?: string; payload?: unknown } | undefined,
  _config: ChatChannelConfig,
): ChannelMessage[] {
  const payload = (nodeOutput?.payload ?? {}) as {
    title?: string;
    labels?: unknown;
    series?: unknown;
  };
  const title = (
    typeof nodeOutput?.title === 'string' && nodeOutput.title
      ? nodeOutput.title
      : typeof payload.title === 'string' && payload.title
        ? payload.title
        : '차트'
  ).trim();
  const labels: string[] = Array.isArray(payload.labels)
    ? payload.labels.map((l) => String(l ?? ''))
    : [];
  const seriesArr: Array<{ name?: unknown; data?: unknown }> = Array.isArray(
    payload.series,
  )
    ? (payload.series as Array<{ name?: unknown; data?: unknown }>)
    : [];
  const firstSeries = seriesArr[0];
  const data: number[] = Array.isArray(firstSeries?.data)
    ? firstSeries.data
        .map((v) => (typeof v === 'number' && Number.isFinite(v) ? v : NaN))
        .filter((v): v is number => !Number.isNaN(v))
    : [];

  if (data.length === 0) {
    // 데이터 없음 — title 만 안내.
    return renderText(`📊 ${title}`);
  }

  const max = data.reduce((m, v) => (v > m ? v : m), 0);
  const labelWidth = Math.min(
    labels.reduce((w, l) => Math.max(w, l.length), 0) || 6,
    12,
  );
  const valueWidth = data.reduce((w, v) => {
    const s = formatChartValue(v);
    return s.length > w ? s.length : w;
  }, 0);

  const lines: string[] = [];
  for (let i = 0; i < data.length; i += 1) {
    const label = padCell(
      truncateCell(labels[i] ?? `#${i + 1}`, labelWidth),
      labelWidth,
    );
    const value = data[i];
    const barLen =
      max > 0 ? Math.max(1, Math.round((value / max) * CHART_BAR_WIDTH)) : 0;
    const bar = '█'.repeat(barLen);
    const valueStr = padCell(formatChartValue(value), valueWidth);
    lines.push(`${label} ${bar} ${valueStr}`);
  }

  const firstName =
    typeof firstSeries?.name === 'string' && firstSeries.name
      ? firstSeries.name
      : 'series 1';
  const seriesNote =
    seriesArr.length > 1
      ? `\n(전체 ${seriesArr.length}개 시리즈 중 "${firstName}" 만 표시)`
      : '';

  const body = `📊 ${title}\n\n${wrapMonospace(lines.join('\n'))}${seriesNote}`;
  // body 에 wrapMonospace 가 있으므로 일반 renderText (escape 적용) 사용 불가 — 직접 chunk.
  return chunkRichText(body);
}

function formatChartValue(v: number): string {
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(2).replace(/\.?0+$/, '');
}

/**
 * Table fallback — `nodeOutput.payload.{rows, columns}` 에서 monospace MarkdownV2 표 생성.
 * row cap 20, cell max width 16, column width 자동 정렬, header separator 추가.
 *
 * payload shape (table node 가 emit, [Spec Table](../../6-presentation/2-table.md)):
 *   { rows: Array<Record<string, unknown>>, columns: Array<{ key: string, label?: string }>,
 *     rowsTruncated?: boolean, rowsTotalCount?: number, title?: string }
 */
function renderTableFallback(
  nodeOutput: { title?: string; payload?: unknown } | undefined,
  _config: ChatChannelConfig,
): ChannelMessage[] {
  const payload = (nodeOutput?.payload ?? {}) as {
    title?: string;
    rows?: unknown;
    columns?: unknown;
    rowsTruncated?: unknown;
    rowsTotalCount?: unknown;
  };
  const title = (
    typeof nodeOutput?.title === 'string' && nodeOutput.title
      ? nodeOutput.title
      : typeof payload.title === 'string' && payload.title
        ? payload.title
        : '표'
  ).trim();
  const rawRows: Array<Record<string, unknown>> = Array.isArray(payload.rows)
    ? (payload.rows as Array<Record<string, unknown>>)
    : [];
  const rawColumns: Array<{ key?: unknown; label?: unknown }> = Array.isArray(
    payload.columns,
  )
    ? (payload.columns as Array<{ key?: unknown; label?: unknown }>)
    : [];
  const columns = rawColumns
    .filter(
      (c): c is { key: string; label?: unknown } =>
        typeof c?.key === 'string' && c.key.length > 0,
    )
    .map((c) => ({
      key: c.key,
      label: typeof c.label === 'string' && c.label ? c.label : c.key,
    }));

  if (columns.length === 0) {
    return renderText(`📋 ${title}\n(열 정보가 없습니다.)`);
  }

  const cappedRows = rawRows.slice(0, TABLE_ROW_CAP);
  const remaining = rawRows.length - cappedRows.length;
  const truncatedFlag =
    payload.rowsTruncated === true ||
    (typeof payload.rowsTotalCount === 'number' &&
      payload.rowsTotalCount > rawRows.length);
  const totalCount =
    typeof payload.rowsTotalCount === 'number'
      ? payload.rowsTotalCount
      : rawRows.length;

  // column 별 width 계산 — max(label, cell 값들) cap to TABLE_CELL_MAX_WIDTH.
  const widths: number[] = columns.map((col) => {
    let w = truncateCell(col.label, TABLE_CELL_MAX_WIDTH).length;
    for (const row of cappedRows) {
      const cell = formatTableCell(row[col.key]);
      const truncated = truncateCell(cell, TABLE_CELL_MAX_WIDTH);
      if (truncated.length > w) w = truncated.length;
    }
    return w;
  });

  const headerLine = columns
    .map((col, i) =>
      padCell(truncateCell(col.label, TABLE_CELL_MAX_WIDTH), widths[i]),
    )
    .join(' │ ');
  const separator = widths.map((w) => '─'.repeat(w)).join('─┼─');
  const dataLines = cappedRows.map((row) =>
    columns
      .map((col, i) => {
        const cell = formatTableCell(row[col.key]);
        return padCell(truncateCell(cell, TABLE_CELL_MAX_WIDTH), widths[i]);
      })
      .join(' │ '),
  );

  const footer =
    remaining > 0
      ? `\n(외 ${remaining}행 — 전체 ${totalCount}행)`
      : truncatedFlag
        ? `\n(상위 ${cappedRows.length}행 표시 — 전체 ${totalCount}행)`
        : '';

  const body = `📋 ${title}\n\n${wrapMonospace([headerLine, separator, ...dataLines].join('\n'))}${footer}`;
  return chunkRichText(body);
}

function formatTableCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value);
  try {
    return JSON.stringify(value) ?? '';
  } catch {
    return '[object]';
  }
}

/**
 * Carousel fallback — `nodeOutput.payload.items[]` 의 카드들을 sequential ChannelMessage 로.
 * 각 카드: imageUrl 있으면 image, 없으면 text. global buttons 는 마지막 카드 후 별 메시지.
 * 카드 cap 10장 — 초과 시 마지막에 "외 N장" 안내.
 *
 * payload shape (carousel node 가 emit, [Spec Carousel](../../6-presentation/1-carousel.md)):
 *   { items: Array<{ title?: string, description?: string, imageUrl?: string, buttons?: ChannelButton[] }>,
 *     title?: string }
 *
 * 텔레그램 sendPhoto 는 image bytes (Buffer) 만 받으므로 imageUrl 은 v1 에서 fetch 하지 않고
 * 텍스트로 URL 표시. v2 에서 fetch + Buffer 변환 추가 가능.
 */
function renderCarouselFallback(
  nodeOutput: { title?: string; payload?: unknown } | undefined,
  _config: ChatChannelConfig,
): ChannelMessage[] {
  const payload = (nodeOutput?.payload ?? {}) as {
    title?: string;
    items?: unknown;
  };
  const title = (
    typeof nodeOutput?.title === 'string' && nodeOutput.title
      ? nodeOutput.title
      : typeof payload.title === 'string' && payload.title
        ? payload.title
        : ''
  ).trim();
  const items: Array<{
    title?: unknown;
    description?: unknown;
    imageUrl?: unknown;
    buttons?: unknown;
  }> = Array.isArray(payload.items)
    ? (payload.items as Array<{
        title?: unknown;
        description?: unknown;
        imageUrl?: unknown;
        buttons?: unknown;
      }>)
    : [];

  const out: ChannelMessage[] = [];

  if (title) {
    out.push(...renderText(`🎴 ${title}`));
  }

  if (items.length === 0) {
    out.push(...renderText('(카드가 없습니다.)'));
    return out;
  }

  const capped = items.slice(0, CAROUSEL_CARD_CAP);
  const remaining = items.length - capped.length;

  for (let i = 0; i < capped.length; i += 1) {
    const item = capped[i];
    const cardTitle =
      typeof item.title === 'string' && item.title
        ? item.title
        : `카드 ${i + 1}`;
    const cardDesc =
      typeof item.description === 'string' && item.description
        ? item.description
        : '';
    const cardImage =
      typeof item.imageUrl === 'string' && item.imageUrl ? item.imageUrl : '';

    const bodyText = [
      `*${escapeMarkdownV2(cardTitle)}*`,
      cardDesc ? escapeMarkdownV2(cardDesc) : '',
      cardImage ? `🖼 ${escapeMarkdownV2(cardImage)}` : '',
    ]
      .filter((s) => s.length > 0)
      .join('\n');

    out.push({
      conversationKey: '',
      body: { kind: 'text' as const, text: bodyText },
    });
  }

  if (remaining > 0) {
    out.push(...renderText(`(외 ${remaining}장 — 전체 ${items.length}장)`));
  }
  return out;
}

/**
 * monospace code block 등 이미 MarkdownV2 형식이 부분적으로 들어간 텍스트의 chunking.
 * `renderText` 와 달리 escape 미적용 (호출자가 책임). chunked 플래그 동일.
 */
function chunkRichText(text: string): ChannelMessage[] {
  const chunks = splitByLimit(text, TELEGRAM_MESSAGE_LIMIT);
  return chunks.map((t) => ({
    conversationKey: '',
    body: {
      kind: 'text' as const,
      text: t,
      chunked: chunks.length > 1,
    },
  }));
}
