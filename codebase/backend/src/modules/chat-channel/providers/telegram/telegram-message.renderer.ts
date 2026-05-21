import {
  ChannelMessage,
  ChatChannelConfig,
  EiaEvent,
} from '../../types';

const TELEGRAM_MESSAGE_LIMIT = 4096;
const CONTINUED_SUFFIX = '\n_(continued…)_';

/**
 * Telegram MarkdownV2 escape rule per Bot API docs.
 * Escape: `_ * [ ] ( ) ~ ` > # + - = | { } . !`
 */
const MD_V2_ESCAPE_REGEX = /([_*\[\]()~`>#+\-=|{}.!])/g;

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
  event: EiaEvent,
  config: ChatChannelConfig,
): ChannelMessage[] {
  switch (event.type) {
    case 'execution.ai_message':
      return renderText(event.message);
    case 'execution.completed':
      return renderText(
        config.languageHints?.executionCompleted ??
          '워크플로우가 완료되었습니다.',
      );
    case 'execution.failed':
      return renderText(
        config.languageHints?.executionFailed ??
          '워크플로우 실행 중 문제가 발생했습니다.',
      );
    case 'execution.cancelled':
      return renderText(
        config.languageHints?.executionCancelled ??
          '워크플로우가 취소되었습니다.',
      );
    case 'execution.waiting_for_input':
      return renderWaitingForInput(event, config);
  }
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
    case 'ai_conversation': {
      const message =
        (event.context.conversationConfig as { message?: unknown } | undefined)
          ?.message;
      if (typeof message === 'string' && message.length > 0) {
        return renderText(message);
      }
      return renderText(
        config.languageHints?.awaitingInput ?? '메시지를 보내주세요.',
      );
    }
    case 'buttons':
    case 'form':
      // Phase 3 / 4 에서 구현. v1 PR-A 는 fallback text 안내.
      return renderText(
        config.languageHints?.unsupportedInteraction ??
          '이 기능은 곧 지원될 예정입니다.',
      );
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
