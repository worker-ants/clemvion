import { Injectable, Logger } from '@nestjs/common';
import { SecretResolverService } from '../../../secret-store/secret-resolver.service';
import type {
  ChannelButton,
  ChannelMessage,
  ChannelUpdate,
  ChatChannelConfig,
  ChatChannelInternalEvent,
  EiaEvent,
  FormSubmissionResult,
  InboundInteractionResponse,
  NativeFormAdapter,
  OpenFormModalParams,
  OpenFormModalResult,
  SendResult,
  SetupResult,
} from '../../types';
import { credentialRejectedError } from '../../types';
import { DiscordClient } from './discord-client';
import {
  buildDiscordEphemeralMessageResponse,
  DISCORD_INTERACTION_CALLBACK_TYPE,
  isDiscordApiError,
  type DiscordApiError,
  type DiscordMessage,
  DISCORD_COMPONENT_TYPE,
} from './discord.types';
import { renderDiscordEvent } from './discord-message.renderer';
import { isDiscordPing, parseDiscordUpdate } from './discord-update.parser';
import {
  buildDiscordDefaultInteractionResponse,
  DISCORD_DEFAULT_SLASH_PREFIX,
} from './discord-interaction-response';
import { NATIVE_MODAL_MAX_FIELDS } from '../../shared/form-mode';

/**
 * `setupChannel` 의 Discord 호출(`GET /applications/@me` · `PUT /applications/{id}/commands`)이
 * 실어 준 HTTP status 중 "자격 증명 거부" 로 판정하는 값.
 * Telegram(`TELEGRAM_CREDENTIAL_REJECTED_STATUSES`)·Slack(`SLACK_CREDENTIAL_REJECTED_ERRORS`)
 * 과 같은 이름 있는 상수 관례를 따른다 — 인라인 리터럴은 판정 기준이 바뀔 때 스타일 혼선을 낳는다.
 */
const DISCORD_CREDENTIAL_REJECTED_STATUSES: readonly number[] = [401, 403];

/**
 * Discord Chat Channel Adapter.
 *
 * Spec [providers/discord.md] — REST + Interactions Webhook 기반.
 *
 * Spec 의 핵심 결정:
 *   - Interactions Webhook only (R-D-3). Gateway 는 v2.
 *   - DM only (R-D-4). guild 채널 차단.
 *   - typing native (`POST /channels/{id}/typing`, 10초).
 *   - Form 다단계 (Convention §4 / R-D-6). modal 은 v2.
 *   - inboundSigningRef = ed25519 public key (R-D-1). provider-issued (사용자 입력).
 *     `SetupResult.issuedInboundSigning` 은 항상 비움.
 *   - R-CC-13: 자유 텍스트 DM 미수신 → reply 는 `/workflow reply` slash 또는 modal TEXT_INPUT.
 */
@Injectable()
export class DiscordAdapter implements NativeFormAdapter {
  private readonly logger = new Logger(DiscordAdapter.name);
  readonly provider = 'discord';
  /** Discord 는 MODAL (type 9) 지원 — §4.1 native form modal (TEXT_INPUT only: text 계열만 수용). */
  readonly supportsNativeForm = true as const;

  constructor(
    private readonly client: DiscordClient,
    private readonly secrets: SecretResolverService,
  ) {}

  private async resolveBotToken(config: ChatChannelConfig): Promise<string> {
    if (!config.botTokenRef) {
      throw new Error(
        'DiscordAdapter: botTokenRef 미설정 — setupChannel 이전 상태.',
      );
    }
    return this.secrets.resolve(config.botTokenRef);
  }

  /**
   * Spec §3.1 — `GET /applications/@me` 로 bot identity + verify_key 검증.
   * Interactions Endpoint URL 은 Discord Developer Portal 사전 등록 (R-D-2). 어댑터가 API 등록 안 함.
   * `PUT /applications/{app_id}/commands` bulk overwrite 로 slash commands 등록.
   * `issuedInboundSigning` 은 비움 — Discord public key 는 사용자 입력.
   */
  async setupChannel(
    config: ChatChannelConfig,
    _callbackUrl: string,
  ): Promise<SetupResult> {
    const botToken = await this.resolveBotToken(config);
    const app = await this.client.getApplicationMe(botToken);
    // 실패는 `ok: false` 표지로 가른다. Discord 원본 숫자 `code` 는 재시도를 다 쓴 합성 실패에
    // 없어서 그걸로 가르면 실패가 성공 경로로 흘렀다(NERV Task `CLE-T-KX2Q2N`).
    if (isDiscordApiError(app)) {
      throw toSetupError('getApplicationMe', app);
    }
    const application = app;
    if (!application.id) {
      throw new Error('Discord application 응답에 id 누락');
    }
    // §3.1 — GET /applications/@me 의 verify_key 와 사용자 입력 public key
    // (inboundSigningRef) 일치 검증. 불일치면 BOT_TOKEN_INVALID (잘못된 앱/키 등록).
    if (config.inboundSigningRef) {
      const expectedPublicKey = await this.secrets.resolve(
        config.inboundSigningRef,
      );
      if (
        expectedPublicKey &&
        application.verify_key &&
        application.verify_key !== expectedPublicKey
      ) {
        // message 접두(`'BOT_TOKEN_INVALID: …'`)는 **규칙 부재의 흔적**이었다 — 호출자가
        // 문자열에서 숫자를 찾는 판별식에 안 걸려 조용히 502 로 갔다. 이제 `code` 로 선언한다.
        throw credentialRejectedError(
          'Discord verify_key 가 등록된 public key 와 불일치',
        );
      }
      // inboundSigningRef 가 있는데 resolve 결과 또는 verify_key 가 비어 cross-verify 를 못 한 경우
      // 경고 — 잘못된 앱/키 등록이 silent 통과하지 않도록 운영자 인지. (서명 검증 SoT 는 §6 inbound 경로.)
      if (!expectedPublicKey || !application.verify_key) {
        this.logger.warn(
          `Discord setupChannel: verify_key cross-verify skip (expectedPublicKey ${
            expectedPublicKey ? 'present' : 'empty'
          }, verify_key ${application.verify_key ? 'present' : 'empty'}) — inbound 서명 검증(§6)은 계속 유효.`,
        );
      }
    }
    // slash command bulk overwrite — default prefix '/workflow'.
    const slashPrefix =
      config.languageHints?.slashPrefix ?? DISCORD_DEFAULT_SLASH_PREFIX;
    const commands = await this.client.putApplicationCommands(
      botToken,
      application.id,
      [
        {
          name: slashPrefix,
          description: 'Workflow assistant',
          type: 1,
          options: [
            { name: 'start', type: 1, description: 'Start a new conversation' },
            {
              name: 'cancel',
              type: 1,
              description: 'Cancel the active conversation',
            },
            { name: 'help', type: 1, description: 'Show help' },
            {
              name: 'reply',
              type: 1,
              description: 'Reply to the active AI conversation',
              options: [
                {
                  name: 'message',
                  type: 3,
                  description: 'Reply text',
                  required: true,
                },
              ],
            },
          ],
        },
      ],
    );
    // 명령 등록이 실패하면 slash command 가 없는 봇이 연결된 것처럼 보인다. setupChannel 실패로
    // 올린다(401/403 은 자격 증명 거부). NERV Task `CLE-T-KX2Q2N`.
    if (isDiscordApiError(commands)) {
      throw toSetupError('putApplicationCommands', commands);
    }
    return {
      registeredAt: new Date().toISOString(),
      identity: { applicationId: application.id, name: application.name },
      configUpdates: {
        botIdentity: {
          botId: hashStringToInt(application.id),
          username: application.name,
          // §3.1 — verify_key(ed25519 public key) 캐시. inbound 서명 검증의 SoT 는 여전히
          // inboundSigningRef(secret store) 지만, identity 표시·재검증 편의로 비민감 public key 를 보관.
          ...(application.verify_key
            ? { publicKey: application.verify_key }
            : {}),
        },
      },
    };
  }

  /**
   * Spec §3.2 — slash command bulk overwrite 를 빈 배열로 호출 → 등록 해제. best-effort.
   * Interactions Endpoint URL 자체는 사용자가 Portal 에서 직접 비워야 함.
   *
   * application id 는 `GET /applications/@me` 로 다시 읽는다. 저장된 `botIdentity.botId` 는
   * id 의 32비트 해시라 Discord 경로에 넣으면 PUT 이 늘 실패했다(NERV Task `CLE-T-Z9J25Z`).
   * 해시만 저장된 기존 행도 같은 방식으로 지운다. `@me` 조회가 실패하면 경고만 남기고 명령 해제를 건너뛴다.
   */
  async teardownChannel(config: ChatChannelConfig): Promise<void> {
    try {
      // botIdentity 가 없으면 setup 이 끝나지 않은 채널이라 지울 명령이 없다.
      if (config.botIdentity?.botId == null) return;
      const botToken = await this.resolveBotToken(config);
      const app = await this.client.getApplicationMe(botToken);
      if (isDiscordApiError(app)) {
        this.logger.warn(
          `DiscordAdapter.teardownChannel best-effort 실패: getApplicationMe ${app.message ?? 'unknown'} (application id 를 몰라 명령 해제를 건너뜀)`,
        );
        return;
      }
      if (!app.id) {
        this.logger.warn(
          'DiscordAdapter.teardownChannel best-effort 실패: getApplicationMe 응답에 id 가 없어 명령 해제를 건너뜀',
        );
        return;
      }
      const res = await this.client.putApplicationCommands(
        botToken,
        app.id,
        [],
      );
      if (isDiscordApiError(res)) {
        this.logger.warn(
          `DiscordAdapter.teardownChannel best-effort 실패: putApplicationCommands ${res.message ?? 'unknown'}`,
        );
      }
    } catch (err) {
      this.logger.warn(
        `DiscordAdapter.teardownChannel best-effort 실패: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * Spec §4 — Interactions Webhook envelope 분기 (PING / APPLICATION_COMMAND / MESSAGE_COMPONENT
   * / MODAL_SUBMIT). PING 케이스는 null 이다. { type: 1 } 200 응답은 {@link handshakeResponse} 가 정한다.
   */
  parseUpdate(
    raw: unknown,
    _config: ChatChannelConfig,
  ): Promise<ChannelUpdate | null> {
    return Promise.resolve(parseDiscordUpdate(raw));
  }

  /**
   * Spec §5 — 5종 EIA event → ChannelMessage. conversationKey 는 dispatcher 보정.
   */
  renderNode(
    event: EiaEvent | ChatChannelInternalEvent,
    config: ChatChannelConfig,
  ): Promise<ChannelMessage[]> {
    return Promise.resolve(renderDiscordEvent(event, config));
  }

  /**
   * Spec §3 / §5 — ChannelMessage → Discord REST 호출 분기.
   *   - text → POST /channels/{id}/messages (content)
   *   - buttons → content + components (ACTION_ROW + BUTTON)
   *   - form_prompt → content + hint note
   *   - image → fallbackText (v1 multipart upload 미구현)
   *   - typing → POST /channels/{id}/typing (R-D-5 native)
   */
  async sendMessage(
    message: ChannelMessage,
    config: ChatChannelConfig,
  ): Promise<SendResult> {
    const botToken = await this.resolveBotToken(config);
    const channel = message.conversationKey;
    if (!channel) {
      throw new Error('DiscordAdapter.sendMessage: conversationKey 누락');
    }
    if (message.body.kind === 'typing') {
      const res = await this.client.postChannelTyping(botToken, channel);
      if (!res.ok) {
        // typing 실패는 silent — UX-only.
        this.logger.warn(`Discord typing 실패 (channel=${channel})`);
      }
      return { externalMsgId: '', sentAt: new Date().toISOString() };
    }
    if (message.body.kind === 'text') {
      const res = await this.client.postChannelMessage(botToken, channel, {
        content: message.body.text,
      });
      return wrapSendResult(res, 'postChannelMessage');
    }
    if (message.body.kind === 'buttons') {
      const components = buildComponents(message.body.buttons);
      const res = await this.client.postChannelMessage(botToken, channel, {
        content: message.body.text,
        components,
      });
      return wrapSendResult(res, 'postChannelMessage(buttons)');
    }
    if (message.body.kind === 'form_prompt') {
      const hintNote = message.body.hint ? `\n_(${message.body.hint})_` : '';
      const res = await this.client.postChannelMessage(botToken, channel, {
        content: `${message.body.label}${hintNote}`,
      });
      return wrapSendResult(res, 'postChannelMessage(form_prompt)');
    }
    if (message.body.kind === 'form_modal') {
      // §4.1 native modal 게이팅 — "양식 작성하기" 버튼 메시지. 클릭 시 openFormModal 가
      // type:9 MODAL 을 interaction HTTP 응답으로 연다 (custom_id '__open_form__' 분기).
      const openLabel = message.body.openLabel;
      const components = [
        {
          type: 1,
          components: [
            {
              type: 2,
              style: 1,
              custom_id: '__open_form__',
              label: openLabel,
            },
          ],
        },
      ];
      const res = await this.client.postChannelMessage(botToken, channel, {
        content: openLabel,
        components,
      });
      return wrapSendResult(res, 'postChannelMessage(form_modal)');
    }
    if (message.body.kind === 'image') {
      const text = message.body.caption ?? message.body.fallbackText;
      const res = await this.client.postChannelMessage(botToken, channel, {
        content: text,
      });
      return wrapSendResult(res, 'postChannelMessage(image fallback)');
    }
    return { externalMsgId: '', sentAt: new Date().toISOString() };
  }

  /**
   * Discord 의 3초 ack 는 webhook HTTP 응답 본문이라 이 함수는 noop 이다. 기본 응답은
   * `defaultInteractionResponse` 가 정하고(컴포넌트 클릭 · 모달 제출 `{ type: 6 }`, 슬래시 명령
   * 본인에게만 보이는 `{ type: 4 }`), 모달 열기(type 9) · 폼 제출 결과(type 4)는 각 경로가 정한다.
   * 비동기 후속 갱신은 별 PATCH /webhooks/.../messages/@original 호출 (Phase 후속 v2).
   */
  ackInteraction(
    _update: ChannelUpdate,
    _config: ChatChannelConfig,
  ): Promise<void> {
    return Promise.resolve();
  }

  /**
   * §4.1 native modal open — `open_form_modal` command 처리 시 HooksService 가 호출.
   * Discord 는 modal 을 webhook HTTP 응답 body (`{ type: 9, data }`) 로 열어야 하므로 API 호출
   * 없이 modal object 를 OpenFormModalResult.httpResponse 로 반환 (HooksController 가 res.json).
   * TEXT_INPUT only — custom_id = field name (MODAL_SUBMIT 가 custom_id 로 field 식별).
   * SoT: spec/conventions/chat-channel-adapter.md §4.1 / providers/discord §5.3.
   */
  openFormModal(params: OpenFormModalParams): Promise<OpenFormModalResult> {
    // §5.1(b) AI Multi Turn reply modal — 단일 TEXT_INPUT (custom_id 'message').
    // MODAL_SUBMIT(custom_id 'clemvion_reply') 는 parser 가 text_message 로 normalize.
    if (params.modalKind === 'reply') {
      const replyModal = {
        type: DISCORD_INTERACTION_CALLBACK_TYPE.MODAL,
        data: {
          custom_id: 'clemvion_reply',
          title: (params.config.languageHints?.replyModalTitle ?? '답변').slice(
            0,
            45,
          ),
          components: [
            {
              type: DISCORD_COMPONENT_TYPE.ACTION_ROW,
              components: [
                {
                  type: DISCORD_COMPONENT_TYPE.TEXT_INPUT,
                  custom_id: 'message',
                  label:
                    params.config.languageHints?.replyModalLabel ?? '메시지',
                  style: 2,
                  required: true,
                },
              ],
            },
          ],
        },
      };
      return Promise.resolve({ httpResponse: replyModal });
    }
    // §3.3 — modal title 은 formConfig.title 우선, 없으면 languageHints, 최종 '양식'.
    // Discord modal title 은 1–45자 → 초과 시 truncate.
    const rawTitle =
      params.title ?? params.config.languageHints?.formModalTitle ?? '양식';
    const modal = {
      type: DISCORD_INTERACTION_CALLBACK_TYPE.MODAL,
      data: {
        custom_id: 'clemvion_form',
        title: rawTitle.slice(0, 45),
        components: params.fields
          .slice(0, NATIVE_MODAL_MAX_FIELDS)
          .map((f) => ({
            type: DISCORD_COMPONENT_TYPE.ACTION_ROW,
            components: [
              {
                type: DISCORD_COMPONENT_TYPE.TEXT_INPUT,
                custom_id: f.name,
                label: f.label,
                style: f.type === 'textarea' ? 2 : 1,
                required: f.required === true,
                // §3.3 — TEXT_INPUT 길이 제약 (Discord: 0–4000). max 는 1 이상일 때만.
                ...(typeof f.minLength === 'number' && f.minLength >= 0
                  ? { min_length: Math.min(f.minLength, 4000) }
                  : {}),
                ...(typeof f.maxLength === 'number' && f.maxLength >= 1
                  ? { max_length: Math.min(f.maxLength, 4000) }
                  : {}),
                ...(f.description
                  ? { placeholder: f.description.slice(0, 100) }
                  : {}),
              },
            ],
          })),
      },
    };
    return Promise.resolve({ httpResponse: modal });
  }

  /**
   * §4.1 native modal 제출의 Discord HTTP 응답 합성. Discord 는 MODAL_SUBMIT 에 반드시
   * 응답해야 하므로 항상 type 4 (ephemeral, flags 64) ack 를 반환. validationError 가 있으면
   * 경고 문구로 재안내 (Interactions 응답 후 동일 modal 재전송 불가 — providers/discord §5.3).
   * SoT: spec/conventions/chat-channel-adapter.md §4.1 step 5.
   */
  buildFormSubmissionResponse(params: {
    config: ChatChannelConfig;
    validationError?: { field?: string; message: string };
  }): FormSubmissionResult {
    if (params.validationError) {
      return {
        httpResponse: buildDiscordEphemeralMessageResponse(
          `⚠️ ${params.validationError.message}`,
        ),
      };
    }
    return {
      httpResponse: buildDiscordEphemeralMessageResponse('✅ 제출되었습니다.'),
    };
  }

  /**
   * control-plane 안내 escape — discord 는 텍스트를 그대로(discord markdown) 렌더하며, 렌더러
   * (`renderDiscordEvent`)도 별도 escape 를 하지 않는다. control-plane 발송도 같은 규칙으로
   * 평문 그대로 보낸다 (마침표·하이픈 등은 안전; 일관성 위해 identity 유지). 멘션 알림은
   * `DiscordClient.postChannelMessage` 의 `allowed_mentions` 가 끈다(NERV Task `CLE-T-FQTQ7K`).
   */
  escapeControlText(text: string): string {
    return text;
  }

  /**
   * Interactions Endpoint URL 을 확인하는 PING(type 1)에 PONG(`{ type: 1 }`)으로 답한다(Spec
   * CLE-CHAT-DISCORD-INBOUND). 그 밖의 interaction 은 `undefined` 다. pure — 외부 호출 없음.
   */
  handshakeResponse(
    raw: unknown,
    _config: ChatChannelConfig,
  ): InboundInteractionResponse | undefined {
    return isDiscordPing(raw)
      ? { body: { type: DISCORD_INTERACTION_CALLBACK_TYPE.PONG } }
      : undefined;
  }

  /**
   * 컴포넌트 클릭 · 모달 제출 · 슬래시 명령의 기본 interaction 응답
   * ({@link buildDiscordDefaultInteractionResponse}). PING · AUTOCOMPLETE 는 `undefined` 다.
   */
  defaultInteractionResponse(
    raw: unknown,
    config: ChatChannelConfig,
  ): InboundInteractionResponse | undefined {
    return buildDiscordDefaultInteractionResponse(raw, config);
  }
}

function hashStringToInt(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** ChannelButton[] → Discord ACTION_ROW + BUTTON components (Spec §5.2). */
function buildComponents(buttons: ChannelButton[]): unknown[] {
  // 5 buttons / row, 최대 5 rows.
  const rows: unknown[] = [];
  for (let i = 0; i < Math.min(buttons.length, 25); i += 5) {
    const slice = buttons.slice(i, i + 5);
    rows.push({
      type: 1,
      components: slice.map((b) => {
        if (b.type === 'link' && b.url) {
          return {
            type: 2,
            style: 5,
            label: b.label,
            url: b.url,
          };
        }
        const style = b.style === 'primary' ? 1 : b.style === 'danger' ? 4 : 2;
        return {
          type: 2,
          style,
          label: b.label,
          custom_id: b.id,
        };
      }),
    });
  }
  return rows;
}

/**
 * `setupChannel` 의 Discord 호출 실패를 Error 로 바꾼다. `res.code` 는 Discord 원본 숫자 필드라
 * (§1.1.2 3중 표) 우리 판별자 `Error.code` 와 네임스페이스가 다르고 인증 실패에 `0` 이 온다.
 * 자격 증명 거부 판정은 client 가 실어 준 HTTP `status` 로 한다. 합성 실패에는 `status` 가 없어
 * 그냥 Error 다(호출자가 502).
 */
function toSetupError(context: string, res: DiscordApiError): Error {
  const message = `Discord ${context} failed: ${res.message ?? 'unknown'}`;
  return typeof res.status === 'number' &&
    DISCORD_CREDENTIAL_REJECTED_STATUSES.includes(res.status)
    ? credentialRejectedError(message)
    : new Error(message);
}

/**
 * 발송 결과를 `SendResult` 로 바꾼다. 실패(`ok: false`)는 throw 해서 호출자가 건강도를
 * `degraded` 로 두게 한다. 재시도를 다 쓴 합성 실패에는 원본 `code` 가 없으므로 `code` 로
 * 가르지 않는다(NERV Task `CLE-T-KX2Q2N`).
 */
function wrapSendResult(
  res: DiscordMessage | DiscordApiError,
  context: string,
): SendResult {
  if (isDiscordApiError(res)) {
    throw new Error(`Discord ${context} failed: ${res.message ?? 'unknown'}`);
  }
  return {
    externalMsgId: res.id ?? '',
    sentAt: new Date().toISOString(),
  };
}
