import type { ChannelUpdate } from '../../types';

/**
 * Slack inbound payload → ChannelUpdate 변환 (pure, side-effect free).
 *
 * Spec [providers/slack §4]:
 *   - 4.1 Events API (envelope.type === 'event_callback'): DM message / file_shared
 *   - 4.2 Interactivity (`payload` field 가 JSON string): block_actions / view_submission
 *   - 4.3 Slash Commands (form parsed `command` + `text`): start / cancel / text_message
 *   - url_verification (envelope.type === 'url_verification') → null (caller 가 challenge 응답)
 *   - DM 외 채널 (channel_type !== 'im') → null (호출자가 groupChatRefusal 안내)
 *   - bot_id 존재 / subtype === 'bot_message' → null (봇 무시)
 *
 * Convention §1.1: pure. DB 미접근, 외부 API 미호출.
 *
 * Hooks layer 는 Content-Type 분기:
 *   - `application/json` → JSON.parse(rawBody) 그대로 본 함수에 전달 (Events API envelope)
 *   - `application/x-www-form-urlencoded` → URLSearchParams 로 parse 후 plain object 전달
 *     (Interactivity 는 `{ payload: '<JSON string>' }`, Slash Commands 는 `{ command, text, ... }`)
 *
 * `idempotencyKey` 는 envelope 별로 다르게 도출:
 *   - Events API: `event_id`
 *   - Interactivity: `payload.trigger_id`
 *   - Slash Commands: `body.trigger_id`
 */
export function parseSlackUpdate(raw: unknown): ChannelUpdate | null {
  if (!raw || typeof raw !== 'object') return null;
  const body = raw as Record<string, unknown>;
  const receivedAt = new Date().toISOString();

  // 1) Events API envelope.
  if (body.type === 'event_callback') {
    return parseEventsApi(body, receivedAt);
  }
  // url_verification 은 caller (HooksService) 가 challenge 응답 — 본 함수는 null.
  if (body.type === 'url_verification') return null;

  // 2) Interactivity — body 에 `payload` 필드 (JSON string).
  if (typeof body.payload === 'string') {
    return parseInteractivity(body.payload, receivedAt);
  }

  // 3) Slash Commands — form-urlencoded parsed object.
  if (typeof body.command === 'string' && typeof body.text === 'string') {
    return parseSlashCommand(body, receivedAt);
  }

  return null;
}

// ---------- Events API ----------

function parseEventsApi(
  envelope: Record<string, unknown>,
  receivedAt: string,
): ChannelUpdate | null {
  const event = envelope.event as Record<string, unknown> | undefined;
  if (!event || typeof event !== 'object') return null;

  const eventId = envelope.event_id;
  const idempotencyKey =
    typeof eventId === 'string' && eventId.length > 0 ? eventId : '';
  if (!idempotencyKey) return null;

  const eventType = event.type;
  const channel = event.channel;
  const user = event.user;
  const channelType = event.channel_type;
  const botId = event.bot_id;
  const subtype = event.subtype;

  // 봇 메시지 / 자기 메시지 무시.
  if (typeof botId === 'string') return null;
  if (subtype === 'bot_message') return null;

  // message event (DM only).
  if (eventType === 'message') {
    if (channelType !== 'im') return null; // DM 외 → null (caller 가 groupChatRefusal)
    const text = event.text;
    if (
      typeof channel !== 'string' ||
      typeof user !== 'string' ||
      typeof text !== 'string'
    ) {
      return null;
    }
    return {
      conversationKey: channel,
      channelUserKey: user,
      command: { kind: 'text_message', text },
      idempotencyKey,
      receivedAt,
    };
  }

  // file_shared event (DM only — channel_type 가 event 가 아닌 root 에 있을 수 있음).
  if (eventType === 'file_shared') {
    const fileId = event.file_id;
    if (typeof channel !== 'string' || typeof user !== 'string') return null;
    if (typeof fileId !== 'string') return null;
    // mimeType 은 caller (HooksService) 가 files.info 1회 호출로 보강 (R-S-7 normative).
    return {
      conversationKey: channel,
      channelUserKey: user,
      command: {
        kind: 'file_upload',
        fileId,
        mimeType: 'application/octet-stream',
      },
      idempotencyKey,
      receivedAt,
    };
  }

  // app_mention 은 DM 안에서는 message 로 흡수되므로 별도 처리 불필요.
  // 그 외 event 는 v1 미처리.
  return null;
}

// ---------- Interactivity ----------

function parseInteractivity(
  payloadJson: string,
  receivedAt: string,
): ChannelUpdate | null {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(payloadJson) as Record<string, unknown>;
  } catch {
    return null;
  }

  const type = parsed.type;
  const user = parsed.user as { id?: string } | undefined;
  const channel = parsed.channel as { id?: string } | undefined;
  const container = parsed.container as { channel_id?: string } | undefined;
  const triggerId = parsed.trigger_id;
  const userId = user?.id;
  const channelId = channel?.id ?? container?.channel_id;

  // §4.1 view_submission — modal 일괄 제출. conversationKey 는 modal-open 시 set 한
  // view.private_metadata (channel object 가 payload 에 없을 수 있어 channelId 가드 전 처리).
  if (type === 'view_submission') {
    const view = parsed.view as
      | {
          id?: string;
          callback_id?: string;
          private_metadata?: string;
          state?: { values?: Record<string, Record<string, unknown>> };
        }
      | undefined;
    if (view?.callback_id !== 'clemvion_form') return null;
    const conversationKey =
      typeof view.private_metadata === 'string' ? view.private_metadata : '';
    const fields = flattenViewStateValues(view.state?.values);
    return {
      conversationKey,
      channelUserKey: typeof userId === 'string' ? userId : '',
      command: { kind: 'form_submission', fields },
      idempotencyKey:
        (typeof view.id === 'string' && view.id) ||
        (typeof triggerId === 'string' ? triggerId : ''),
      receivedAt,
    };
  }

  if (typeof triggerId !== 'string' || triggerId.length === 0) return null;
  if (typeof userId !== 'string' || typeof channelId !== 'string') return null;

  if (type === 'block_actions') {
    const actions = parsed.actions as
      | Array<{
          action_id?: string;
          value?: string;
          selected_option?: { value?: string };
        }>
      | undefined;
    if (!Array.isArray(actions) || actions.length === 0) return null;
    const a0 = actions[0];
    // §4.1 native modal 게이팅 — "양식 작성하기" 버튼 클릭. trigger_id (3초) 운반.
    if (a0.action_id === '__open_form__') {
      return {
        conversationKey: channelId,
        channelUserKey: userId,
        command: {
          kind: 'open_form_modal',
          openContext: { triggerId },
        },
        idempotencyKey: triggerId,
        receivedAt,
      };
    }
    const callbackData = a0.value ?? a0.selected_option?.value;
    if (typeof callbackData !== 'string') return null;
    return {
      conversationKey: channelId,
      channelUserKey: userId,
      command: { kind: 'button_callback', callbackData, callbackQueryId: '' },
      idempotencyKey: triggerId,
      receivedAt,
    };
  }

  // shortcut / message_action / view_closed — v1 미처리.
  return null;
}

/**
 * §4.1 view_submission 의 `view.state.values` 를 `{ [fieldName]: value }` 로 평탄화.
 * block_id = field name (modal open 시 set), 각 block 의 단일 inner element (action_id 'v') 의
 * 값을 element type 별로 추출. action_id 는 상수라 inner key 를 iterate 하여 값을 읽는다.
 * SoT: spec/conventions/chat-channel-adapter.md §2.1 / §4.1.
 */
function flattenViewStateValues(
  values: Record<string, Record<string, unknown>> | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!values || typeof values !== 'object') return out;
  for (const [blockId, inner] of Object.entries(values)) {
    if (!inner || typeof inner !== 'object') continue;
    const innerKeys = Object.keys(inner);
    if (innerKeys.length === 0) continue;
    // action_id 는 상수 'v' 라 단일 inner element 만 존재 — 첫 key 의 값을 읽는다.
    const element = inner[innerKeys[0]] as Record<string, unknown> | undefined;
    if (!element || typeof element !== 'object') continue;
    const value = extractElementValue(element);
    if (value !== undefined) out[blockId] = value;
  }
  return out;
}

/** Slack input element type 별 값 추출. optional 빈 입력은 undefined (key omit). */
function extractElementValue(
  element: Record<string, unknown>,
): string | undefined {
  // plain_text_input → .value
  if (typeof element.value === 'string' && element.value.length > 0) {
    return element.value;
  }
  // static_select / radio_buttons → .selected_option?.value
  const selected = element.selected_option as { value?: unknown } | undefined;
  if (selected && typeof selected.value === 'string') {
    return selected.value;
  }
  // datepicker → .selected_date
  if (
    typeof element.selected_date === 'string' &&
    element.selected_date.length > 0
  ) {
    return element.selected_date;
  }
  // checkboxes → .selected_options?.map(o => o.value).join(',')
  const selectedOptions = element.selected_options as
    | Array<{ value?: unknown }>
    | undefined;
  if (Array.isArray(selectedOptions) && selectedOptions.length > 0) {
    const vals = selectedOptions
      .map((o) => (typeof o.value === 'string' ? o.value : ''))
      .filter((v) => v.length > 0);
    if (vals.length > 0) return vals.join(',');
  }
  return undefined;
}

// ---------- Slash Commands ----------

function parseSlashCommand(
  body: Record<string, unknown>,
  receivedAt: string,
): ChannelUpdate | null {
  const userId = body.user_id;
  const channelId = body.channel_id;
  const text = body.text;
  const triggerId = body.trigger_id;

  if (typeof userId !== 'string' || typeof channelId !== 'string') return null;
  if (typeof text !== 'string') return null;
  if (typeof triggerId !== 'string' || triggerId.length === 0) return null;

  const idempotencyKey = triggerId;
  // text 의 첫 token 으로 sub-command 분기 (start / cancel / 일반 text).
  const trimmed = text.trim();
  const firstSpace = trimmed.indexOf(' ');
  const subCommand = firstSpace === -1 ? trimmed : trimmed.slice(0, firstSpace);
  const rest = firstSpace === -1 ? '' : trimmed.slice(firstSpace + 1).trim();

  if (trimmed === '' || subCommand === 'start') {
    return {
      conversationKey: channelId,
      channelUserKey: userId,
      command: { kind: 'start' },
      idempotencyKey,
      receivedAt,
    };
  }
  if (subCommand === 'cancel') {
    return {
      conversationKey: channelId,
      channelUserKey: userId,
      command: { kind: 'cancel' },
      idempotencyKey,
      receivedAt,
    };
  }
  // 그 외 text 는 일반 메시지 (reply / 자유 입력).
  // sub-command 가 'reply' 등 reserved 였다면 rest 만 메시지로, 그 외엔 trimmed 전체.
  const messageText = subCommand === 'reply' ? rest : trimmed;
  if (messageText.length === 0) return null;
  return {
    conversationKey: channelId,
    channelUserKey: userId,
    command: { kind: 'text_message', text: messageText },
    idempotencyKey,
    receivedAt,
  };
}

/**
 * url_verification handshake 응답을 위한 challenge 값 추출.
 *
 * HooksService 가 envelope.type === 'url_verification' 케이스에서 `{ challenge }` JSON 으로
 * 200 OK 응답하기 위해 사용. parseSlackUpdate 가 null 반환 후 caller 가 본 함수로 challenge 추출.
 *
 * @returns string | null — null 이면 url_verification 이 아니거나 challenge 필드 부재.
 */
export function extractSlackChallenge(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') return null;
  const body = raw as Record<string, unknown>;
  if (body.type !== 'url_verification') return null;
  const challenge = body.challenge;
  return typeof challenge === 'string' && challenge.length > 0
    ? challenge
    : null;
}
