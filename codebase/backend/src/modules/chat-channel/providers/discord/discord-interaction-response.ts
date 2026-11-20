import type {
  ChatChannelConfig,
  InboundInteractionResponse,
} from '../../types';
import {
  GROUP_CHAT_REFUSAL_DEFAULT,
  pickLocaleDefault,
  readLanguageHintOverride,
  resolveCommandReceivedMessage,
  SLASH_HELP_DEFAULTS,
} from '../../shared/language-hint-defaults';
import {
  buildDiscordEphemeralMessageResponse,
  DISCORD_CHANNEL_TYPE_DM,
  DISCORD_INTERACTION_CALLBACK_TYPE,
  DISCORD_INTERACTION_TYPE,
  type DiscordInteraction,
} from './discord.types';

/** 슬래시 명령의 기본 prefix. `setupChannel` 의 명령 등록과 같은 값이다. */
export const DISCORD_DEFAULT_SLASH_PREFIX = 'workflow';

/**
 * Discord interaction 에 3초 안에 200 으로 돌려줄 기본 응답(Spec CLE-CHAT-DISCORD 「인바운드 응답」).
 *
 * - 컴포넌트 클릭(type 3) · 모달 제출(type 5): `{ type: 6 }`(DEFERRED_UPDATE_MESSAGE). 메시지를 바꾸지
 *   않고 받았다는 것만 알린다. Discord 문서는 type 6 을 MODAL_SUBMIT 과 컴포넌트 interaction 에
 *   허용하고 모달을 어디서 열었는지는 따지지 않는다. 이 제품의 모달은 모두 버튼에서 연다. 슬래시 명령에서
 *   모달을 여는 경로를 더하면 수정할 원본 메시지가 없으므로 type 6 이 맞는지 다시 확인한다.
 * - DM 밖(서버 채널 · 스레드 · 그룹 DM)에서 친 슬래시 명령: 하위 명령과 상관없이 본인에게만 보이는
 *   groupChatRefusal 안내(`languageHints.groupChatRefusal` 나 기본 문구)다. DM 밖 판정은 파서
 *   (`parseDiscordUpdate`)와 같다. `channel.type` 이 숫자이고 DM(1)이 아니면 DM 밖이다. 파서는 이 명령을
 *   실행으로 보내지 않는다(REQ-CHAT-017, Slack 과 같은 규칙). 2026-11-19 사람 결정, NERV Task
 *   `CLE-T-B9CRCF`.
 * - 슬래시 명령(type 2): 본인에게만 보이는 `{ type: 4 }`. `help` 는 도움말
 *   (`languageHints.help` 나 기본 문구), 나머지는 수신 문구(`languageHints.commandReceived` 나 기본
 *   문구)다. type 6 은 슬래시 명령에 쓸 수 없다. 2026-11-12 사람 결정(NERV Task `CLE-T-TSEP9G`).
 *   `allowed_mentions` 로 멘션 알림을 끈다(NERV Task `CLE-T-FQTQ7K`).
 * - PING(type 1)은 핸드셰이크라 `DiscordAdapter.handshakeResponse` 가 따로 답한다. AUTOCOMPLETE(type 4)와 알 수 없는 type 은
 *   `undefined` 라 지금처럼 `202` 다.
 *
 * pure — 외부 호출 없음. 트리거가 꺼져 있어도 HooksService 가 이 응답으로 답한다.
 */
export function buildDiscordDefaultInteractionResponse(
  raw: unknown,
  config: ChatChannelConfig,
): InboundInteractionResponse | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const interaction = raw as Partial<DiscordInteraction>;
  const type: unknown = interaction.type;
  if (
    type === DISCORD_INTERACTION_TYPE.MESSAGE_COMPONENT ||
    type === DISCORD_INTERACTION_TYPE.MODAL_SUBMIT
  ) {
    return {
      body: { type: DISCORD_INTERACTION_CALLBACK_TYPE.DEFERRED_UPDATE_MESSAGE },
    };
  }
  if (type === DISCORD_INTERACTION_TYPE.APPLICATION_COMMAND) {
    if (isOutsideDirectMessage(interaction)) {
      return {
        body: buildDiscordEphemeralMessageResponse(
          readLanguageHintOverride(config.languageHints, 'groupChatRefusal') ??
            GROUP_CHAT_REFUSAL_DEFAULT,
        ),
      };
    }
    const subCommand = interaction.data?.options?.[0]?.name;
    const content =
      subCommand === 'help'
        ? resolveDiscordHelpText(config)
        : resolveCommandReceivedMessage(
            config.languageHints,
            config.languageLocale,
          );
    return { body: buildDiscordEphemeralMessageResponse(content) };
  }
  return undefined;
}

/** 파서(`parseDiscordUpdate`)의 DM 밖 판정과 같다. `channel.type` 이 없으면 DM 밖으로 보지 않는다. */
function isOutsideDirectMessage(
  interaction: Partial<DiscordInteraction>,
): boolean {
  const channelType: unknown = interaction.channel?.type;
  return (
    typeof channelType === 'number' && channelType !== DISCORD_CHANNEL_TYPE_DM
  );
}

/**
 * `languageHints.help` 가 있으면 그 문구를 그대로 쓴다(`{prefix}` 를 바꾸지 않는다).
 * 없으면 locale 기본 도움말에 등록한 prefix 를 넣는다. override · locale 규칙은
 * {@link readLanguageHintOverride} · {@link pickLocaleDefault} 로 다른 문구와 같게 맞춘다.
 */
function resolveDiscordHelpText(config: ChatChannelConfig): string {
  const override = readLanguageHintOverride(config.languageHints, 'help');
  if (override !== undefined) return override;
  const prefix =
    readLanguageHintOverride(config.languageHints, 'slashPrefix') ??
    DISCORD_DEFAULT_SLASH_PREFIX;
  return pickLocaleDefault(SLASH_HELP_DEFAULTS, config.languageLocale)
    .split('{prefix}')
    .join(prefix);
}
