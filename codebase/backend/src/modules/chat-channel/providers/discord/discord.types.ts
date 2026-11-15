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

/** 인바운드 interaction 의 `type`. https://discord.com/developers/docs/interactions/receiving-and-responding */
export const DISCORD_INTERACTION_TYPE = {
  PING: 1,
  APPLICATION_COMMAND: 2,
  MESSAGE_COMPONENT: 3,
  APPLICATION_COMMAND_AUTOCOMPLETE: 4,
  MODAL_SUBMIT: 5,
} as const;

/** 메시지 컴포넌트 `type`. */
export const DISCORD_COMPONENT_TYPE = {
  ACTION_ROW: 1,
  TEXT_INPUT: 4,
} as const;

/**
 * interaction 응답(callback)의 `type`. 3초 안에 200 과 함께 보낸다.
 * DEFERRED_UPDATE_MESSAGE(6)는 MODAL_SUBMIT 과 컴포넌트 interaction 에만 쓸 수 있다(Discord 문서 각주).
 * 문서는 모달을 어디서 열었는지 따지지 않는다. 이 제품의 모달은 모두 버튼에서 연다.
 */
export const DISCORD_INTERACTION_CALLBACK_TYPE = {
  PONG: 1,
  CHANNEL_MESSAGE_WITH_SOURCE: 4,
  DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE: 5,
  DEFERRED_UPDATE_MESSAGE: 6,
  UPDATE_MESSAGE: 7,
  MODAL: 9,
} as const;

/** 메시지 flag — 명령을 보낸 사용자에게만 보인다(EPHEMERAL, 1 << 6). */
export const DISCORD_MESSAGE_FLAG_EPHEMERAL = 64;

/**
 * 멘션 알림을 모두 끄는 `allowed_mentions`(NERV Task `CLE-T-FQTQ7K`, 2026-11-14 사람 결정).
 * Template 결과 · AI 응답 · 안내 문구에 `@everyone` · `@here` · 역할 · 사용자 멘션이 있어도 글자만
 * 보이고 알림은 울리지 않는다. 워크플로우가 일부러 넣은 멘션도 울리지 않는다.
 *
 * 붙이는 곳은 아래 두 빌더뿐이다(NERV Task `CLE-T-VE7QVM`).
 * - 채널 메시지: `DiscordClient.postChannelMessage` → {@link withDiscordMentionsDisabled}
 * - 메시지를 싣는 interaction 응답(type 4): 슬래시 명령 기본 응답
 *   (`buildDiscordDefaultInteractionResponse`)과 모달 제출 응답
 *   (`DiscordAdapter.buildFormSubmissionResponse` 의 성공 · 검증 오류 두 분기) →
 *   {@link buildDiscordEphemeralMessageResponse}
 */
const NO_MENTION_PARSE: readonly string[] = Object.freeze([]);
export const DISCORD_ALLOWED_MENTIONS_NONE = Object.freeze({
  parse: NO_MENTION_PARSE,
});

/**
 * 채널 메시지 본문에 {@link DISCORD_ALLOWED_MENTIONS_NONE} 을 싣는다. 호출자가 `allowed_mentions` 를
 * 넣었어도 이 값으로 덮는다.
 */
export function withDiscordMentionsDisabled<T extends object>(
  body: T,
): Omit<T, 'allowed_mentions'> & {
  allowed_mentions: typeof DISCORD_ALLOWED_MENTIONS_NONE;
} {
  return { ...body, allowed_mentions: DISCORD_ALLOWED_MENTIONS_NONE };
}

/** {@link buildDiscordEphemeralMessageResponse} 가 만드는 interaction 응답. */
export interface DiscordEphemeralMessageResponse {
  type: typeof DISCORD_INTERACTION_CALLBACK_TYPE.CHANNEL_MESSAGE_WITH_SOURCE;
  data: {
    content: string;
    flags: number;
    allowed_mentions: typeof DISCORD_ALLOWED_MENTIONS_NONE;
  };
}

/**
 * 본인에게만 보이는 메시지 interaction 응답
 * `{ type: 4, data: { content, flags: 64, allowed_mentions: { parse: [] } } }`.
 * 메시지를 싣는 interaction 응답은 모두 이 함수로 만든다.
 */
export function buildDiscordEphemeralMessageResponse(
  content: string,
): DiscordEphemeralMessageResponse {
  return {
    type: DISCORD_INTERACTION_CALLBACK_TYPE.CHANNEL_MESSAGE_WITH_SOURCE,
    data: withDiscordMentionsDisabled({
      content,
      flags: DISCORD_MESSAGE_FLAG_EPHEMERAL,
    }),
  };
}

/**
 * Discord REST 클라이언트의 실패 결과. 4xx 본문이든 재시도를 다 쓴 합성 실패(5xx · 429 소진 ·
 * fetch 예외)든 `ok: false` 를 싣는다. 실패 판정은 이 표지로 한다([isDiscordApiError]).
 */
export interface DiscordApiError {
  ok: false;
  /**
   * **Discord 원본 응답의 숫자 error code** — 우리 `Error.code` 판별자와 **다른 네임스페이스**다
   * ([spec/conventions/chat-channel-adapter.md §1.1.2] 3중 표). 인증 실패 시 `0` 이 올 수 있어
   * 값만으로는 자격 증명 거부를 알 수 없다 — 그래서 `status` 를 따로 싣는다. 클라이언트가 만든
   * 합성 실패에는 이 필드가 없으므로 실패 판정에 쓰지 않는다(NERV Task `CLE-T-KX2Q2N`).
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

/**
 * 클라이언트 결과가 실패인지 `ok: false` 표지로 가른다. Discord 원본 숫자 `code` 의 있고 없음으로
 * 판정하면 합성 실패를 성공으로 본다(NERV Task `CLE-T-KX2Q2N`). 성공 응답 객체(메시지 · 애플리케이션 ·
 * 명령 배열 · 204 의 빈 객체)에는 `ok: false` 가 없다.
 */
export function isDiscordApiError(res: unknown): res is DiscordApiError {
  return (
    typeof res === 'object' &&
    res !== null &&
    (res as { ok?: unknown }).ok === false
  );
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
