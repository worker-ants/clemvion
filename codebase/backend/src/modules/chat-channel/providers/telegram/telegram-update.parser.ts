import { ChannelCommand, ChannelUpdate } from '../../types';

/**
 * Telegram Update → ChannelUpdate 변환 (pure, side-effect free).
 *
 * Spec [providers/telegram §4]:
 *   - /start, /cancel, text_message, callback_query, file_upload, contact_share
 *   - group/channel/bot/unsupported → null
 *
 * `idempotencyKey` 는 `update.update_id` 직접 사용.
 *
 * 본 함수는 spec convention §1.1 의 "parseUpdate 는 pure" 계약을 따른다 — DB 미접근, 외부 API
 * 미호출, 안내 메시지 발송도 호출자 책임 (HooksService 가 chat.type 검사 후 별도 sendMessage).
 */
export function parseTelegramUpdate(raw: unknown): ChannelUpdate | null {
  if (!raw || typeof raw !== 'object') return null;
  const update = raw as Record<string, unknown>;
  const updateId = update.update_id;
  if (typeof updateId !== 'number') return null;
  const receivedAt = new Date().toISOString();
  const idempotencyKey = String(updateId);

  // 1) callback_query (inline_keyboard tap) — message 보다 우선 분기.
  const callbackQuery = update.callback_query as
    | {
        id?: string;
        from?: { id?: number; is_bot?: boolean };
        message?: { chat?: { id?: number; type?: string } };
        data?: string;
      }
    | undefined;
  if (callbackQuery) {
    const chatId = callbackQuery.message?.chat?.id;
    const fromId = callbackQuery.from?.id;
    const callbackQueryId = callbackQuery.id;
    const callbackData = callbackQuery.data;
    if (
      typeof chatId !== 'number' ||
      typeof fromId !== 'number' ||
      typeof callbackQueryId !== 'string' ||
      typeof callbackData !== 'string'
    ) {
      return null;
    }
    if (callbackQuery.from?.is_bot === true) return null;
    if (
      callbackQuery.message?.chat?.type &&
      callbackQuery.message.chat.type !== 'private'
    ) {
      return null;
    }
    return {
      conversationKey: String(chatId),
      channelUserKey: String(fromId),
      command: {
        kind: 'button_callback',
        callbackData,
        callbackQueryId,
      },
      idempotencyKey,
      receivedAt,
    };
  }

  // 2) message — 일반 메시지/명령/파일/연락처 분기.
  const message = update.message as
    | {
        chat?: { id?: number; type?: string };
        from?: { id?: number; is_bot?: boolean };
        text?: string;
        document?: { file_id?: string; mime_type?: string };
        photo?: Array<{ file_id?: string }>;
        video?: { file_id?: string; mime_type?: string };
        contact?: { phone_number?: string };
      }
    | undefined;
  if (!message) return null;
  if (message.from?.is_bot === true) return null;
  if (message.chat?.type && message.chat.type !== 'private') return null;

  const chatId = message.chat?.id;
  const fromId = message.from?.id;
  if (typeof chatId !== 'number' || typeof fromId !== 'number') return null;

  const base = {
    conversationKey: String(chatId),
    channelUserKey: String(fromId),
    idempotencyKey,
    receivedAt,
  };

  const command = readCommand(message);
  if (!command) return null;
  return { ...base, command };
}

interface TelegramMessageShape {
  chat?: { id?: number; type?: string };
  from?: { id?: number; is_bot?: boolean };
  text?: string;
  document?: { file_id?: string; mime_type?: string };
  photo?: Array<{ file_id?: string }>;
  video?: { file_id?: string; mime_type?: string };
  contact?: { phone_number?: string };
}

function readCommand(message: TelegramMessageShape): ChannelCommand | null {
  const text = (message as { text?: string }).text;
  if (typeof text === 'string') {
    const trimmed = text.trim();
    if (trimmed === '/start' || trimmed.startsWith('/start ')) {
      return { kind: 'start' };
    }
    if (trimmed === '/cancel') {
      return { kind: 'cancel' };
    }
    if (trimmed.startsWith('/')) {
      // v1 은 /start /cancel /help 외 명령 무시 — /help 도 v1 정적 안내 (PR-E 처리). 그 외는 null.
      return null;
    }
    return { kind: 'text_message', text };
  }

  const document = (message as { document?: { file_id?: string; mime_type?: string } })
    .document;
  if (document?.file_id) {
    return {
      kind: 'file_upload',
      fileId: document.file_id,
      mimeType: document.mime_type ?? 'application/octet-stream',
    };
  }
  const video = (message as { video?: { file_id?: string; mime_type?: string } })
    .video;
  if (video?.file_id) {
    return {
      kind: 'file_upload',
      fileId: video.file_id,
      mimeType: video.mime_type ?? 'video/mp4',
    };
  }
  const photo = (message as { photo?: Array<{ file_id?: string }> }).photo;
  if (Array.isArray(photo) && photo.length > 0) {
    // 가장 큰 해상도 사용 (배열 마지막 = 가장 큼).
    const last = photo[photo.length - 1];
    if (last?.file_id) {
      return {
        kind: 'file_upload',
        fileId: last.file_id,
        mimeType: 'image/jpeg',
      };
    }
  }
  const contact = (message as { contact?: { phone_number?: string } }).contact;
  if (contact?.phone_number) {
    return { kind: 'contact_share', phone: contact.phone_number };
  }
  return null;
}
