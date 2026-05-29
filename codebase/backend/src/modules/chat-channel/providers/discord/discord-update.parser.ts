import type { ChannelUpdate } from '../../types';
import { DISCORD_CHANNEL_TYPE_DM } from './discord.types';
import type { DiscordInteraction } from './discord.types';

/**
 * Discord Interactions Webhook payload → ChannelUpdate 변환 (pure, side-effect free).
 *
 * Spec [providers/discord §4]:
 *   - type=1 (PING) → null (caller 가 { type: 1 } 200 응답)
 *   - type=2 (APPLICATION_COMMAND): start / cancel / help / reply 분기
 *   - type=3 (MESSAGE_COMPONENT button/select) → button_callback
 *   - type=5 (MODAL_SUBMIT) → text_message (Reply modal 의 TEXT_INPUT 결과)
 *   - DM 외 channel.type → null (caller 가 groupChatRefusal 안내)
 *   - bot user → null
 *
 * `idempotencyKey` = `interaction.id` (Discord snowflake, retry 시 같음).
 */
export function parseDiscordUpdate(raw: unknown): ChannelUpdate | null {
  if (!raw || typeof raw !== 'object') return null;
  const i = raw as DiscordInteraction;
  if (typeof i.id !== 'string' || typeof i.type !== 'number') return null;
  const receivedAt = new Date().toISOString();
  const idempotencyKey = i.id;

  // type=1 PING — caller 가 handshake 응답.
  if (i.type === 1) return null;

  // bot 무시.
  const user = i.member?.user ?? i.user;
  if (user?.bot === true) return null;
  const userId = user?.id;

  // DM 외 channel 차단.
  const channelType = i.channel?.type;
  if (
    typeof channelType === 'number' &&
    channelType !== DISCORD_CHANNEL_TYPE_DM
  ) {
    return null;
  }
  const channelId = i.channel_id ?? i.channel?.id;
  if (!userId || !channelId) return null;

  if (i.type === 2) {
    // APPLICATION_COMMAND — slash. sub-command (options[0].name) 으로 분기.
    const sub = i.data?.options?.[0]?.name;
    if (sub === 'start') {
      return {
        conversationKey: channelId,
        channelUserKey: userId,
        command: { kind: 'start' },
        idempotencyKey,
        receivedAt,
      };
    }
    if (sub === 'cancel') {
      return {
        conversationKey: channelId,
        channelUserKey: userId,
        command: { kind: 'cancel' },
        idempotencyKey,
        receivedAt,
      };
    }
    if (sub === 'reply') {
      // /workflow reply <message> — text option.
      const text = i.data?.options?.[0]?.options?.[0]?.value;
      if (typeof text !== 'string' || text.length === 0) return null;
      return {
        conversationKey: channelId,
        channelUserKey: userId,
        command: { kind: 'text_message', text },
        idempotencyKey,
        receivedAt,
      };
    }
    // help / 그 외 → null (helper 응답 caller 책임).
    return null;
  }

  if (i.type === 3) {
    // MESSAGE_COMPONENT — button or select.
    // §4.1 native modal 게이팅 — "양식 작성하기" 버튼 클릭. interaction token (15분) 운반.
    if (i.data?.custom_id === '__open_form__') {
      return {
        conversationKey: channelId,
        channelUserKey: userId,
        command: {
          kind: 'open_form_modal',
          openContext: {
            interactionId: String(i.id),
            interactionToken: String(i.token),
          },
        },
        idempotencyKey,
        receivedAt,
      };
    }
    const componentType = i.data?.component_type;
    let callbackData: string | undefined;
    if (componentType === 2) {
      // BUTTON: custom_id 자체가 callback.
      callbackData = i.data?.custom_id;
    } else if (componentType === 3) {
      // SELECT_MENU: values[0].
      callbackData = i.data?.values?.[0];
    }
    if (typeof callbackData !== 'string') return null;
    return {
      conversationKey: channelId,
      channelUserKey: userId,
      command: { kind: 'button_callback', callbackData, callbackQueryId: '' },
      idempotencyKey,
      receivedAt,
    };
  }

  if (i.type === 5) {
    // MODAL_SUBMIT — custom_id 로 분기.
    const modalId = i.data?.custom_id;
    const components = i.data?.components ?? [];
    // §4.1 native form modal — TEXT_INPUT 결과를 fields 로 일괄 평탄화 (custom_id = field name).
    if (modalId === 'clemvion_form') {
      const fields: Record<string, string> = {};
      for (const tc of components.flatMap((c) => c.components ?? [])) {
        if (
          typeof tc.custom_id === 'string' &&
          typeof tc.value === 'string' &&
          tc.value.length > 0
        ) {
          fields[tc.custom_id] = tc.value;
        }
      }
      return {
        conversationKey: channelId,
        channelUserKey: userId,
        command: { kind: 'form_submission', fields },
        idempotencyKey,
        receivedAt,
      };
    }
    // clemvion_reply (또는 그 외) — TEXT_INPUT 결과를 text_message 로 normalize
    // (R-CC-13 의 inbound path b).
    const text = components
      .flatMap((c) => c.components ?? [])
      .map((tc) => tc.value)
      .filter((v) => typeof v === 'string' && v.length > 0)
      .join('\n');
    if (text.length === 0) return null;
    return {
      conversationKey: channelId,
      channelUserKey: userId,
      command: { kind: 'text_message', text },
      idempotencyKey,
      receivedAt,
    };
  }

  return null;
}

/**
 * Discord PING handshake — Interactions endpoint 등록 시 1회 + 주기적.
 * Caller (HooksService) 가 type=1 응답을 위해 사용.
 */
export function isDiscordPing(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object') return false;
  return (raw as { type?: unknown }).type === 1;
}
