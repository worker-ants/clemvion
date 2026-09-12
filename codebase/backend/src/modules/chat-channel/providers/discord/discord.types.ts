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
  /**
   * **Discord 원본 응답의 숫자 error code** — 우리 `Error.code` 판별자와 **다른 네임스페이스**다
   * ([spec/conventions/chat-channel-adapter.md §1.1.2] 3중 표). 인증 실패 시 `0` 이 올 수 있어
   * 값만으로는 자격 증명 거부를 알 수 없다 — 그래서 `status` 를 따로 싣는다.
   */
  code?: number;
  message?: string;
  /**
   * HTTP status. Discord 의 body `code` 는 자격 증명 거부(`401`/`403`)를 구별해 주지 않으므로,
   * 어댑터가 `code: 'BOT_TOKEN_INVALID'` 를 부착할지 판단하려면 status 가 필요하다. client 가
   * 4xx 를 반환할 때 채운다 ([spec/conventions/chat-channel-adapter.md §1.1.2]).
   */
  status?: number;
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
