/**
 * Discord Interactions Webhook payload TypeScript 타입 (최소 필요 fields).
 *
 * Spec [providers/discord §3 / §4]. Interaction type:
 *   1 = PING (handshake)
 *   2 = APPLICATION_COMMAND (slash command)
 *   3 = MESSAGE_COMPONENT (button / select_menu)
 *   4 = APPLICATION_COMMAND_AUTOCOMPLETE
 *   5 = MODAL_SUBMIT
 *
 * Component type:
 *   1 = ACTION_ROW
 *   2 = BUTTON
 *   3 = SELECT_MENU
 *   4 = TEXT_INPUT (modal only)
 *
 * Button style: 1=PRIMARY 2=SECONDARY 3=SUCCESS 4=DANGER 5=LINK
 */

type LiteralOrInt<L extends number> = L | (number & Record<never, never>);

/** Interactions Webhook envelope. */
export interface DiscordInteraction {
  id: string;
  application_id: string;
  type: LiteralOrInt<1 | 2 | 3 | 4 | 5>;
  data?: DiscordInteractionData;
  guild_id?: string;
  channel_id?: string;
  channel?: { id?: string; type?: number };
  member?: { user?: { id?: string; username?: string; bot?: boolean } };
  user?: { id?: string; username?: string; bot?: boolean };
  token: string;
  version: number;
}

export interface DiscordInteractionData {
  /** APPLICATION_COMMAND: command name. */
  name?: string;
  /** MESSAGE_COMPONENT: custom_id of the clicked component. */
  custom_id?: string;
  component_type?: LiteralOrInt<2 | 3 | 4>;
  /** APPLICATION_COMMAND: option array (sub-commands). */
  options?: Array<{
    name: string;
    type: number;
    value?: string | number | boolean;
    options?: Array<{ name: string; value?: string }>;
  }>;
  /** MESSAGE_COMPONENT select_menu: selected values. */
  values?: string[];
  /** MODAL_SUBMIT: components array (TEXT_INPUT 결과). */
  components?: Array<{
    type: 1;
    components: Array<{
      type: 4;
      custom_id: string;
      value: string;
    }>;
  }>;
}

/** Channel type values. DM=1, GROUP_DM=3, GUILD_TEXT=0 등. */
export const DISCORD_CHANNEL_TYPE_DM = 1;

/** Discord REST API generic 응답 — 4xx/5xx 는 별 형태. */
export interface DiscordApiError {
  ok: false;
  code?: number;
  message?: string;
}

export interface DiscordMessage {
  id: string;
  channel_id: string;
  content?: string;
}

/** GET /applications/@me 응답. */
export interface DiscordApplication {
  id: string;
  name: string;
  description?: string;
  /** Discord Developer Portal 에서 사용자가 보는 ed25519 public key (hex 64). */
  verify_key?: string;
  owner?: { id: string; username: string };
}
