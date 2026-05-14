import { ConversationTurn } from './conversation-thread.types';

/** spec/conventions/conversation-thread.md §5.3 */
export const MAX_INJECTED_TURNS = 100;
export const MAX_TURN_TEXT_CHARS = 4000;
export const MAX_INJECTED_CHARS = 200_000;

/** form 텍스트 변환 시 단일 turn 의 추가 cap (spec §1.4 — 200자). */
const FORM_TEXT_HARD_CAP = 200;

/**
 * presentation 노드의 `output.interaction.{type, data}` 를 받는 최소 인터페이스.
 * `type` 은 `form_submitted` / `button_click` / `button_continue` 외에도 다른
 * 노드가 새 interaction type 을 emit 할 수 있으므로 `string` 으로 둔다 — 알려지지
 * 않은 type 은 `renderInteractionText` 가 빈 문자열을 반환한다.
 */
export interface InteractionLike {
  type: string;
  data?: Record<string, unknown>;
}

/**
 * spec/conventions/conversation-thread.md §1.4 — `interaction.{type,data}` 를
 * 사람-읽기 가능한 한 줄 텍스트로 변환. ConversationThreadService 가
 * presentation interaction 을 thread 에 push 할 때 사용.
 */
export function renderInteractionText(interaction: InteractionLike): string {
  const data = interaction.data ?? {};
  switch (interaction.type) {
    case 'form_submitted': {
      const parts: string[] = [];
      for (const [k, v] of Object.entries(data)) {
        parts.push(`${k}=${stringifyValue(v)}`);
      }
      const text = parts.join(', ');
      return text.length > FORM_TEXT_HARD_CAP
        ? text.slice(0, FORM_TEXT_HARD_CAP) + '...'
        : text;
    }
    case 'button_click': {
      const label = data.buttonLabel ?? data.buttonId ?? '';
      return `clicked: ${stringifyValue(label)}`;
    }
    case 'button_continue': {
      const url = data.url;
      return url !== undefined && url !== null
        ? `continued: ${stringifyValue(url)}`
        : 'continued';
    }
    default:
      return '';
  }
}

function stringifyValue(v: unknown): string {
  if (v === null) return 'null';
  if (v === undefined) return 'undefined';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'bigint')
    return v.toString();
  // object / array / function / symbol — JSON 직렬화 (cycle 등 실패 시 generic
  // 문자열로 대체. 의도된 fallback 으로 lint 의 base-to-string 검사를 회피).
  try {
    return JSON.stringify(v) ?? '[unserializable]';
  } catch {
    return '[unserializable]';
  }
}

/**
 * spec/conventions/conversation-thread.md §5.2 — system_text injection 모드용
 * thread → 텍스트 렌더. AI Agent 핸들러가 systemPrompt 끝에 첨부.
 */
export function renderThreadAsSystemText(turns: ConversationTurn[]): string {
  if (turns.length === 0) return '';
  const lines: string[] = ['[Conversation Context — chronological]'];
  for (const t of turns) {
    lines.push(
      `[#${t.seq} ${t.timestamp} · ${t.nodeLabel} (${t.nodeType}) · ${t.source}]`,
    );
    if (t.text) lines.push(t.text);
    lines.push('');
  }
  lines.push('[End of Conversation Context]');
  return lines.join('\n');
}

export interface ApplyCapResult {
  turns: ConversationTurn[];
  droppedCount: number;
  totalChars: number;
}

/**
 * spec/conventions/conversation-thread.md §5.3 — char 기반 cap 3종 적용.
 *
 * 1. per-turn text 가 MAX_TURN_TEXT_CHARS 초과 시 truncate (`...` 접미사)
 * 2. 전체 turn 수가 MAX_INJECTED_TURNS 초과 시 가장 오래된 turn 부터 drop
 * 3. 합산 char 가 MAX_INJECTED_CHARS 초과 시 추가 drop
 *
 * 입력 배열은 변형하지 않으며, 새 ConversationTurn 인스턴스를 반환한다
 * (text truncate 가 발생한 turn 만 새 객체로 복제 — 나머지는 원본 reference 보존).
 */
export function applyCap(turns: readonly ConversationTurn[]): ApplyCapResult {
  // 1. per-turn text truncate (새 인스턴스로)
  const truncated = turns.map((t) =>
    t.text.length > MAX_TURN_TEXT_CHARS
      ? { ...t, text: t.text.slice(0, MAX_TURN_TEXT_CHARS) + '...' }
      : t,
  );

  // 2. turn 개수 cap — 오래된 것부터 drop
  let dropped = 0;
  let kept =
    truncated.length > MAX_INJECTED_TURNS
      ? truncated.slice(truncated.length - MAX_INJECTED_TURNS)
      : truncated;
  dropped += truncated.length - kept.length;

  // 3. 합산 char cap — 오래된 것부터 추가 drop
  let totalChars = sumChars(kept);
  while (totalChars > MAX_INJECTED_CHARS && kept.length > 0) {
    const removed = kept[0];
    kept = kept.slice(1);
    totalChars -= removed.text.length;
    dropped += 1;
  }

  return { turns: kept, droppedCount: dropped, totalChars };
}

function sumChars(turns: readonly ConversationTurn[]): number {
  let sum = 0;
  for (const t of turns) sum += t.text.length;
  return sum;
}
