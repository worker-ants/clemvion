import {
  Injectable,
  Logger,
  NotFoundException,
  GoneException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Trigger } from '../triggers/entities/trigger.entity';
import { Node } from '../nodes/entities/node.entity';
import { ExecutionEngineService } from '../execution-engine/execution-engine.service';
import { resolveTriggerParameters } from '../execution-engine/utils/resolve-trigger-parameters';
import { loadTriggerParameterSchema } from '../execution-engine/utils/load-trigger-parameter-schema';
import { TriggerParameterValidationException } from '../execution-engine/types/trigger-parameter.types';
import { InteractionTokenService } from '../external-interaction/interaction-token.service';
import { InteractionService } from '../external-interaction/interaction.service';
import type { InternalInteractionRequestContext } from '../external-interaction/interaction.guard';
import { ExecutionsService } from '../executions/executions.service';
import { ExecutionStatus } from '../executions/entities/execution.entity';
import { ChannelAdapterRegistry } from '../chat-channel/channel-adapter.registry';
import { ChannelConversationService } from '../chat-channel/channel-conversation.service';
import {
  ChannelUpdate,
  ChatChannelAdapter,
  ChatChannelConfig,
  isNativeFormAdapter,
} from '../chat-channel/types';
import { validateFormSubmission } from '../chat-channel/shared/form-mode';
import { randomUUID } from 'crypto';
import { ChatChannelInboundAuthenticator } from '../chat-channel/chat-channel-inbound-authenticator';
import { AuthConfigsService } from '../auth-configs/auth-configs.service';

export interface WebhookInput {
  body: unknown;
  headers: Record<string, string>;
  query: Record<string, string>;
  method: string;
}

@Injectable()
export class HooksService {
  private readonly logger = new Logger(HooksService.name);

  constructor(
    @InjectRepository(Trigger)
    private readonly triggerRepository: Repository<Trigger>,
    @InjectRepository(Node)
    private readonly nodeRepository: Repository<Node>,
    private readonly executionEngineService: ExecutionEngineService,
    private readonly tokenService: InteractionTokenService,
    private readonly channelAdapterRegistry: ChannelAdapterRegistry,
    private readonly channelConversationService: ChannelConversationService,
    private readonly interactionService: InteractionService,
    private readonly executionsService: ExecutionsService,
    private readonly chatChannelInboundAuthenticator: ChatChannelInboundAuthenticator,
    private readonly authConfigsService: AuthConfigsService,
  ) {}

  async handleWebhook(
    endpointPath: string,
    input: WebhookInput,
    rawBody?: Buffer,
  ): Promise<{
    executionId: string;
    status?: 'pending';
    interaction?: {
      token?: string;
      expiresAt?: string;
      endpoints: {
        stream: string;
        submit: string;
        status: string;
        cancel: string;
        refresh: string;
      };
    };
  }> {
    // 1. Find trigger by endpoint path (no workspace filter — external call)
    const trigger = await this.triggerRepository.findOne({
      where: { endpointPath, type: 'webhook' },
    });

    if (!trigger) {
      throw new NotFoundException({
        code: 'TRIGGER_NOT_FOUND',
        message: 'Webhook endpoint not found',
      });
    }

    // 2. Chat Channel 분기 — config.chatChannel 가 있으면 adapter 가 inbound 처리.
    //     일반 webhook 경로와 별도 — auth / parameter schema 검증 모두 우회 (chat 채널은
    //     자체 inbound-signing 헤더/서명 검증 + parseUpdate 의 raw body 만 사용 —
    //     provider 별: Telegram secret_token / Slack X-Slack-Signature / Discord X-Signature-Ed25519).
    //     active 검사는 chatChannel 판정 *뒤* 에 한다 — 비활성 chatChannel 트리거는
    //     410 Gone 이 아니라 202 Accepted + { executionId: 'ignored' } 로 조용히 무시한다
    //     (spec/5-system/15-chat-channel.md R-CC-12, §5.5 비활성 trigger 행;
    //     spec/5-system/12-webhook.md WH-EP-07 의 chatChannel 예외).
    const chatChannelCfg = readChatChannelConfig(trigger.config);
    if (chatChannelCfg) {
      // 비활성 chatChannel 트리거도 inbound 서명 검증은 먼저 수행한다 (R-CC-12(d):
      // 인증 실패 시 401). isActive 단락은 handleChatChannelWebhook 의 verify() 뒤에서
      // 처리하여, 인증되지 않은 요청이 trigger 활성 상태를 우회·탐지하지 못하게 한다.
      return this.handleChatChannelWebhook(
        trigger,
        chatChannelCfg,
        input,
        rawBody?.toString('utf8') ?? '',
      );
    }

    // 3. Check active status — 일반 webhook 비활성은 410 Gone (WH-EP-07).
    if (!trigger.isActive) {
      throw new GoneException({
        code: 'TRIGGER_INACTIVE',
        message: 'Webhook trigger is inactive',
      });
    }

    // 3. Authenticate — trigger.authConfigId 가 가리키는 AuthConfig 로 위임
    //    (spec/5-system/12-webhook.md §7 step 6). authConfigId 가 null 이면 인증 없음(none).
    if (trigger.authConfigId) {
      await this.authConfigsService.verifyWebhookRequest(
        trigger.authConfigId,
        trigger.workspaceId,
        {
          headers: input.headers,
          rawBody,
          clientIp: extractClientIp(input.headers),
        },
      );
    }

    // 4. Extract & validate trigger parameters from body
    const schema = await loadTriggerParameterSchema(
      this.nodeRepository,
      trigger.workflowId,
      this.logger,
    );
    let parameters: Record<string, unknown>;
    try {
      parameters = resolveTriggerParameters(schema, input.body);
    } catch (err) {
      if (err instanceof TriggerParameterValidationException) {
        throw new BadRequestException({
          code: 'INVALID_WEBHOOK_PAYLOAD',
          message: 'Invalid webhook payload',
          errors: err.errors,
        });
      }
      throw err;
    }

    // 5. Execute workflow. The `__triggerSource` marker is stamped here so
    //    the Manual Trigger handler can record `meta.source: 'webhook'` and
    //    group `body`/`headers`/`query`/`method` under `output.request.*`
    //    instead of spreading them at the top level (CONVENTIONS Principle 1).
    const executionId = await this.executionEngineService.execute(
      trigger.workflowId,
      { __triggerSource: 'webhook', parameters, ...input },
      { triggerId: trigger.id },
    );

    this.logger.log(
      `Webhook ${endpointPath} triggered execution ${executionId} for workflow ${trigger.workflowId}`,
    );

    // 6. Update lastTriggeredAt
    trigger.lastTriggeredAt = new Date();
    await this.triggerRepository.save(trigger);

    // 7. External Interaction API — interaction.enabled=true 일 때 interaction token + endpoints
    //    동봉 ([Spec EIA §4.1] / WH-RS-04). per_execution 전략이면 단명 JWT 발급, per_trigger
    //    전략이면 응답에 token 미동봉 (호출자가 이미 itk_* 보유).
    const interaction = await this.buildInteractionResponse(
      trigger.config,
      executionId,
    );

    return interaction
      ? { executionId, status: 'pending' as const, interaction }
      : { executionId };
  }

  /**
   * Chat Channel inbound 처리 — Spec §3.1 / CCH-AD-04 / CCH-AD-06.
   *
   * 1. provider 별 adapter 조회
   * 2. (Telegram) X-Telegram-Bot-Api-Secret-Token 헤더 검증
   * 3. adapter.parseUpdate(rawBody) — null 이면 202 ignored 즉시 반환
   * 4. ChannelConversation 조회 — 활성 execution + waiting_for_input 이면 interact() in-process 호출
   *    그 외에는 새 execution 시작 (또는 /cancel 명령 처리)
   * 5. ackInteraction (button_callback 등)
   *
   * 본 메서드는 200ms 안에 202 Accepted 응답해야 함 (WH-NF-01). 무거운 작업은 fire-and-forget.
   */
  private async handleChatChannelWebhook(
    trigger: Trigger,
    config: ChatChannelConfig,
    input: WebhookInput,
    rawBodyString = '',
  ): Promise<{
    executionId: string;
    status?: 'pending';
    challenge?: string;
    discordPing?: boolean;
    /**
     * §4.1 native modal — provider 가 webhook 응답 body 로 직접 돌려줘야 하는 JSON
     * (Discord modal open `{ type: 9 }` / MODAL_SUBMIT ack `{ type: 4 }` / Slack
     * view_submission `{ response_action: 'errors' }`). HooksController 가 res.json 으로 전송.
     * SoT: spec/conventions/chat-channel-adapter.md §4.1.
     */
    interactionHttpResponse?: unknown;
  }> {
    let adapter: ChatChannelAdapter;
    try {
      adapter = this.channelAdapterRegistry.get(config.provider);
    } catch (_err) {
      throw new BadRequestException({
        code: 'CHAT_CHANNEL_PROVIDER_UNKNOWN',
        message: `Unknown chat channel provider: ${config.provider}`,
      });
    }

    // Provider 별 inbound 인증 (Guard 패턴) — 단일 책임 분리. Slack 은 rawBody string 필요.
    await this.chatChannelInboundAuthenticator.verify(
      trigger.id,
      config,
      input.headers,
      rawBodyString,
    );

    // 서명 검증을 통과한 뒤에야 비활성 트리거를 202 { executionId: 'ignored' } 로
    // 무시한다 (R-CC-12(d) / §5.5). 인증은 활성/비활성 무관하게 수행하되, 비활성이면
    // adapter·execution 을 호출하지 않는다. (verify 실패 시 위에서 이미 401 throw.)
    if (!trigger.isActive) {
      return { executionId: 'ignored' };
    }

    // Slack url_verification handshake (Spec providers/slack §3.1) — Slack 이 Request URL 등록 시
    // 1회 발송. parser 가 null 반환 후 challenge 추출하여 controller 에 전달.
    if (config.provider === 'slack' && isSlackUrlVerification(input.body)) {
      const challenge = (input.body as { challenge?: unknown }).challenge;
      if (typeof challenge === 'string' && challenge.length > 0) {
        return { executionId: 'ignored', challenge };
      }
    }

    // Discord PING handshake (Spec providers/discord §3.1) — Interactions Endpoint URL
    // 등록 시 1회 + 주기적. type=1 → { type: 1 } 200 응답.
    if (config.provider === 'discord' && isDiscordPing(input.body)) {
      return { executionId: 'ignored', discordPing: true };
    }

    const parsed = await adapter.parseUpdate(input.body, config);
    if (!parsed) {
      // 무시 대상 (group/bot/unsupported) — parseUpdate 의 pure 계약 (I-6) 에 따라 호출자가 안내 발송.
      // raw body 의 chat 정보가 있으면 안내 sendMessage. 봇 메시지나 chat 정보 없으면 silent skip.
      await this.maybeNotifyIgnored(input.body, config, adapter);
      return { executionId: 'ignored' };
    }
    // parseUpdate 직후 provider 별 비동기 보강 (Slack file_upload → files.info 로
    // mimeType/filename/urlPrivate 채움). 미구현 provider 는 update 그대로 반환 (R-S-7).
    const update = adapter.enrichInbound
      ? await adapter.enrichInbound(parsed, config)
      : parsed;

    // /help 명령 — v1 정적 안내 (Spec providers/telegram §7).
    if (
      update.command.kind === 'text_message' &&
      update.command.text.trim() === '/help'
    ) {
      await adapter.sendMessage(
        {
          conversationKey: update.conversationKey,
          body: {
            kind: 'text',
            text:
              config.languageHints?.help ??
              '/start \\- 새 대화 시작\n/cancel \\- 진행 중인 대화 취소\n/help \\- 도움말',
          },
        },
        config,
      );
      return { executionId: 'ignored' };
    }

    // ChannelConversation 조회.
    const state = await this.channelConversationService.lookup(
      trigger.id,
      update.conversationKey,
    );
    const hasActiveExecution =
      state?.executionId && (await this.isActiveExecution(state.executionId));

    // /cancel 명령 — 활성 execution 이 있으면 취소, 없으면 noop.
    if (update.command.kind === 'cancel') {
      if (hasActiveExecution) {
        await this.executionsService.stop(state.executionId!);
        await this.channelConversationService.updateExecutionId(
          trigger.id,
          update.conversationKey,
          null,
        );
      }
      await adapter.ackInteraction(update, config);
      return { executionId: state?.executionId ?? 'ignored' };
    }

    // §4.1 native modal — "양식 작성하기" 버튼 클릭. pendingFormModal 의 fields + provider
    // openContext (trigger_id / interaction token) 로 adapter 가 modal 을 연다. Discord 는
    // httpResponse 로 modal 을 반환 (controller 가 res.json), Slack 은 views.open API (httpResponse 없음).
    if (update.command.kind === 'open_form_modal') {
      // Security guard: DM-only providers make conversationKey≈user, but in group channels
      // another member could click the button and intercept a different user's form.
      if (state && state.channelUserKey !== update.channelUserKey) {
        this.logger.warn(
          `open_form_modal channelUserKey mismatch — state.channelUserKey=${state.channelUserKey} update.channelUserKey=${update.channelUserKey} conversationKey=${update.conversationKey}`,
        );
        return { executionId: state?.executionId ?? 'ignored' };
      }
      // §5.1(b) AI Multi Turn reply modal — "Reply" 버튼은 pendingFormModal 없이
      // openContext.modal='reply' 마커만 운반한다. 단일 TEXT_INPUT modal 을 연다.
      if (update.command.openContext.modal === 'reply') {
        if (isNativeFormAdapter(adapter)) {
          const result = await adapter.openFormModal({
            config,
            openContext: update.command.openContext,
            fields: [],
            conversationKey: update.conversationKey,
            nodeId: '',
            modalKind: 'reply',
          });
          if (result.httpResponse !== undefined) {
            return {
              executionId: state?.executionId ?? 'ignored',
              interactionHttpResponse: result.httpResponse,
            };
          }
        } else {
          this.logger.warn(
            `open_form_modal(reply): adapter.openFormModal 미지원 — conversationKey=${update.conversationKey}`,
          );
        }
        return { executionId: state?.executionId ?? 'ignored' };
      }
      if (state?.pendingFormModal && isNativeFormAdapter(adapter)) {
        const result = await adapter.openFormModal({
          config,
          openContext: update.command.openContext,
          fields: state.pendingFormModal.fields,
          conversationKey: update.conversationKey,
          nodeId: state.pendingFormModal.nodeId,
        });
        if (result.httpResponse !== undefined) {
          return {
            executionId: state.executionId ?? 'ignored',
            interactionHttpResponse: result.httpResponse,
          };
        }
      } else {
        this.logger.warn(
          `open_form_modal: pendingFormModal 없거나 adapter.openFormModal 미지원 — conversationKey=${update.conversationKey}`,
        );
      }
      return { executionId: state?.executionId ?? 'ignored' };
    }

    // §4.1 native modal — modal 일괄 제출. pendingFormModal.nodeId 로 EIA submit_form 단일 호출.
    if (update.command.kind === 'form_submission') {
      // Security guard: same channelUserKey check as open_form_modal.
      if (state && state.channelUserKey !== update.channelUserKey) {
        this.logger.warn(
          `form_submission channelUserKey mismatch — state.channelUserKey=${state.channelUserKey} update.channelUserKey=${update.channelUserKey} conversationKey=${update.conversationKey}`,
        );
        return { executionId: state?.executionId ?? 'ignored' };
      }
      const nodeId = state?.pendingFormModal?.nodeId;
      if (hasActiveExecution && nodeId) {
        // Concurrency guard (CCH race): acquire a per-conversation lock so a duplicate
        // submit (double-click / provider retry) can't fire two submit_form calls.
        // fail-open when redis unavailable (acquireLock returns true).
        const lockToken = randomUUID();
        const acquired = await this.channelConversationService.acquireLock(
          trigger.id,
          update.conversationKey,
          lockToken,
        );
        if (!acquired) {
          this.logger.warn(
            `form_submission 중복 제출 감지 — lock 미획득, skip: conversationKey=${update.conversationKey}`,
          );
          return { executionId: state?.executionId ?? 'ignored' };
        }
        try {
          // Security: filter submitted fields to only keys declared in pendingFormModal.
          // This prevents undefined-field injection and bounds Discord component count.
          const allowedNames = new Set(
            state.pendingFormModal!.fields.map((f) => f.name),
          );
          const filteredFields = Object.fromEntries(
            Object.entries(update.command.fields).filter(([k]) =>
              allowedNames.has(k),
            ),
          );

          // §4.1 step 4: client-side 값 검증 — submit_form 전 1차 게이트. 실패 시 interact 호출
          // 없이 provider 재표시 응답 + 버튼 재노출 (catch 경로와 동일한 best-effort re-noise).
          // pendingFormModal 유지 → 사용자가 정정 후 재제출 가능.
          const verr = validateFormSubmission(
            filteredFields as Record<string, string>,
            state.pendingFormModal!.fields,
          );
          if (verr) {
            this.logger.warn(
              `form_submission client-side 검증 실패 — field=${verr.field} msg=${verr.message} conversationKey=${update.conversationKey}`,
            );
            const r = isNativeFormAdapter(adapter)
              ? adapter.buildFormSubmissionResponse({
                  config,
                  validationError: verr,
                })
              : undefined;
            await this.reNoiseFormModal(update, state, config, adapter);
            if (r?.httpResponse !== undefined) {
              return {
                executionId: state.executionId!,
                interactionHttpResponse: r.httpResponse,
              };
            }
            return { executionId: state.executionId! };
          }

          const ctx: InternalInteractionRequestContext = {
            executionId: state.executionId!,
            triggerId: trigger.id,
            scope: 'in_process_trusted',
          };
          await this.interactionService.interact(ctx, {
            command: 'submit_form',
            nodeId,
            data: filteredFields,
          });
          // 성공 — pendingFormModal clear.
          state.pendingFormModal = undefined;
          state.lastUpdateAt = new Date().toISOString();
          await this.channelConversationService.upsert(
            trigger.id,
            update.conversationKey,
            state,
          );
          if (isNativeFormAdapter(adapter)) {
            const r = adapter.buildFormSubmissionResponse({ config });
            if (r.httpResponse !== undefined) {
              return {
                executionId: state.executionId!,
                interactionHttpResponse: r.httpResponse,
              };
            }
          }
          return { executionId: state.executionId! };
        } catch (err) {
          this.logger.warn(
            `form_submission submit_form 실패 — 검증 재안내: ${err instanceof Error ? err.message : String(err)}`,
          );
          const r = isNativeFormAdapter(adapter)
            ? adapter.buildFormSubmissionResponse({
                config,
                validationError: { message: '입력값을 다시 확인해주세요.' },
              })
            : undefined;
          // §4.1 step 5: spec 에 따라 Discord 는 검증 실패 후 "양식 작성하기" 버튼을 재노출해
          // 사용자가 재시도할 수 있게 한다 (Interactions 응답 후 동일 modal 재전송 불가이므로
          // 별도 sendMessage 로 버튼 재발송). pendingFormModal 은 유지 (재클릭 가능).
          await this.reNoiseFormModal(update, state, config, adapter);
          if (r?.httpResponse !== undefined) {
            return {
              executionId: state.executionId ?? 'ignored',
              interactionHttpResponse: r.httpResponse,
            };
          }
          return { executionId: state.executionId ?? 'ignored' };
        } finally {
          // 성공·검증실패·예외 모든 경로에서 lock 해제 — 정당한 재제출 (re-noise 후) 이 막히지 않도록.
          await this.channelConversationService.releaseLock(
            trigger.id,
            update.conversationKey,
            lockToken,
          );
        }
      }
      return { executionId: state?.executionId ?? 'ignored' };
    }

    // 활성 execution 이 있고 사용자 인터랙션 명령이면 in-process interact 호출.
    if (
      hasActiveExecution &&
      (update.command.kind === 'text_message' ||
        update.command.kind === 'button_callback' ||
        update.command.kind === 'contact_share' ||
        update.command.kind === 'file_upload')
    ) {
      // Form 다단계 시퀀스 진행 중이면 dispatcher 의 form handler 로 라우팅.
      if (
        state?.formState &&
        (update.command.kind === 'text_message' ||
          update.command.kind === 'contact_share' ||
          update.command.kind === 'file_upload')
      ) {
        await this.handleFormStep(trigger, state, update, config, adapter);
      } else {
        await this.forwardToInteractionService(
          trigger,
          state.executionId!,
          update,
        );
      }
      await adapter.ackInteraction(update, config);
      return { executionId: state.executionId! };
    }

    // 새 execution 시작 (start 또는 활성 없음 / terminal 상태).
    const executionId = await this.executionEngineService.execute(
      trigger.workflowId,
      {
        __triggerSource: 'webhook',
        parameters: {},
        body: input.body,
        headers: input.headers,
        query: input.query,
        method: input.method,
        chatChannel: {
          provider: config.provider,
          conversationKey: update.conversationKey,
          channelUserKey: update.channelUserKey,
        },
      },
      { triggerId: trigger.id },
    );

    await this.channelConversationService.upsert(
      trigger.id,
      update.conversationKey,
      {
        executionId,
        threadId: 'default',
        channelUserKey: update.channelUserKey,
        startedAt: state?.startedAt ?? new Date().toISOString(),
        lastUpdateAt: new Date().toISOString(),
      },
    );

    trigger.lastTriggeredAt = new Date();
    await this.triggerRepository.save(trigger);

    await adapter.ackInteraction(update, config);
    return { executionId, status: 'pending' as const };
  }

  /**
   * §4.1 step 5 — form_submission 검증 실패 (client-side gate 또는 EIA reject) 후 "양식 작성하기"
   * 버튼을 재노출 (best-effort). Interactions 응답 후 동일 modal 재전송 불가이므로 별도 sendMessage.
   * pendingFormModal 은 호출자가 유지 (재클릭 가능). 실패는 swallow (logger.warn).
   */
  private async reNoiseFormModal(
    update: ChannelUpdate,
    state: { pendingFormModal?: { fields: unknown } },
    config: ChatChannelConfig,
    adapter: ChatChannelAdapter,
  ): Promise<void> {
    if (!state.pendingFormModal) return;
    try {
      const openLabel =
        config.languageHints?.formOpenLabel ??
        (config.languageLocale === 'en' ? 'Fill out form' : '양식 작성하기');
      await adapter.sendMessage(
        {
          conversationKey: update.conversationKey,
          body: {
            kind: 'form_modal',
            openLabel,
            formConfig: { fields: state.pendingFormModal.fields },
          },
        },
        config,
      );
    } catch (reNoiseErr) {
      this.logger.warn(
        `form_submission 재안내 버튼 재발송 실패 (best-effort): ${reNoiseErr instanceof Error ? reNoiseErr.message : String(reNoiseErr)}`,
      );
    }
  }

  /**
   * Active execution 의 inbound 인터랙션 명령을 EIA InteractionService 로 in-process forwarding.
   * Spec [EIA-AU-08] — `scope: 'in_process_trusted'` 로 ctx 합성, token 검증 우회.
   */
  private async forwardToInteractionService(
    trigger: Trigger,
    executionId: string,
    update: ChannelUpdate,
  ): Promise<void> {
    // text_message → submit_message (AI Multi Turn).
    // button_callback → click_button (Button Presentation, Phase 3 에서 구체화).
    // file_upload / contact_share → submit_form (Form, Phase 4 에서 구체화).
    // v1 PR-A 는 text_message → submit_message 만 의미 있음.
    if (update.command.kind === 'text_message') {
      const ctx: InternalInteractionRequestContext = {
        executionId,
        triggerId: trigger.id,
        scope: 'in_process_trusted',
      };
      await this.interactionService.interact(ctx, {
        command: 'submit_message',
        nodeId: 'chat-channel',
        message: update.command.text,
      });
    } else if (update.command.kind === 'button_callback') {
      const ctx: InternalInteractionRequestContext = {
        executionId,
        triggerId: trigger.id,
        scope: 'in_process_trusted',
      };
      await this.interactionService.interact(ctx, {
        command: 'click_button',
        nodeId: 'chat-channel',
        buttonId: update.command.callbackData,
      });
    }
    // file_upload / contact_share — Phase 4 (Form) 에서 처리.
  }

  /**
   * Spec I-6 — `parseUpdate` 가 null 반환 (group/bot/unsupported) 시 호출자가 안내 sendMessage 발송.
   * 봇 자기 메시지 (`from.is_bot=true`) 는 silent skip. 그 외 (group, unsupported) 는 안내 발송 후 무시.
   */
  private async maybeNotifyIgnored(
    rawBody: unknown,
    config: ChatChannelConfig,
    adapter: ChatChannelAdapter,
  ): Promise<void> {
    if (!rawBody || typeof rawBody !== 'object') return;
    const message = (rawBody as { message?: unknown }).message;
    if (!message || typeof message !== 'object') return;
    const chat = (message as { chat?: { id?: number; type?: string } }).chat;
    const from = (message as { from?: { is_bot?: boolean } }).from;
    if (!chat?.id) return;
    if (from?.is_bot === true) return; // 봇 메시지 — silent
    const chatType = chat.type ?? '';
    const isGroup = ['group', 'supergroup', 'channel'].includes(chatType);
    const announcement = isGroup
      ? (config.languageHints?.groupChatRefusal ??
        '이 봇은 1:1 대화만 지원합니다\\.')
      : (config.languageHints?.unsupportedMessageKind ??
        '지원하지 않는 메시지 형식입니다\\.');
    try {
      await adapter.sendMessage(
        {
          conversationKey: String(chat.id),
          body: { kind: 'text', text: announcement },
        },
        config,
      );
    } catch (err) {
      this.logger.warn(
        `maybeNotifyIgnored sendMessage 실패 (chatId=${chat.id}): ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * Phase 4 (PR-C) — Form 다단계 시퀀스 한 step 처리.
   *
   * Spec [providers/telegram §5.3 / convention §4]:
   *   1. 사용자 응답을 partialFormData[currentField.name] = value 로 누적
   *   2. 클라이언트-side 검증 (type / required) — 실패 시 같은 필드 재질문
   *   3. 마지막 필드면 EIA submit_form 호출, 아니면 currentFieldIdx++ + 다음 prompt 발송
   *   4. EIA server-side validation 실패 시 currentFieldIdx 를 fieldErrors[0].field 로 되돌리고 재질문
   *      (v1 정책: catch → 안내 후 currentFieldIdx 유지. 정확한 EIA-RL-03 복원은 PR-E 보강)
   */
  private async handleFormStep(
    trigger: Trigger,
    state: NonNullable<
      Awaited<ReturnType<ChannelConversationService['lookup']>>
    >,
    update: ChannelUpdate,
    config: ChatChannelConfig,
    adapter: ChatChannelAdapter,
  ): Promise<void> {
    if (!state.formState) return;
    const formState = state.formState;

    // formConfig 필드 정보를 가져와야 하는데, dispatcher 가 waiting_for_input 에서 받은 정보를
    // ChannelConversationState 에 같이 저장해두지 않음. v1 구현: state.formState 의 nodeId 와
    // partialFormData 로만 진행, field 정보 (name) 는 사용자 응답으로 추정 불가 → fallback 정책:
    //   - 각 응답을 `field_<currentFieldIdx>` key 로 저장. 실제 EIA submit_form 은 이 key 매핑이
    //     formConfig 와 어긋날 수 있어 v1 의 한계 — PR-E 에서 dispatcher 가 formConfig.fields 를
    //     state.formState.fieldsCatalog 로 함께 저장하도록 개선.

    const valueKey = `field_${formState.currentFieldIdx}`;
    let value: unknown = null;
    if (update.command.kind === 'text_message') value = update.command.text;
    else if (update.command.kind === 'contact_share')
      value = update.command.phone;
    else if (update.command.kind === 'file_upload')
      value = {
        fileId: update.command.fileId,
        mimeType: update.command.mimeType,
        // enrichInbound(files.info)가 채운 경우만 포함 (Slack).
        ...(update.command.filename
          ? { filename: update.command.filename }
          : {}),
        ...(update.command.urlPrivate
          ? { urlPrivate: update.command.urlPrivate }
          : {}),
      };

    formState.partialFormData[valueKey] = value;
    formState.currentFieldIdx += 1;

    // v1 stub: 사용자가 응답할 다음 필드가 있을지 dispatcher 가 알 수 없으므로 단순 정책 —
    // currentFieldIdx 가 일정 이하 (3) 면 계속 prompt 발송 (placeholder), 초과 시 submit_form.
    // 실 구현은 dispatcher 가 fieldsCatalog 를 state 에 저장하는 PR-E 보강 사항.
    const MAX_FIELDS_HEURISTIC = 10;
    if (formState.currentFieldIdx >= MAX_FIELDS_HEURISTIC) {
      try {
        const ctx: InternalInteractionRequestContext = {
          executionId: state.executionId!,
          triggerId: trigger.id,
          scope: 'in_process_trusted',
        };
        await this.interactionService.interact(ctx, {
          command: 'submit_form',
          nodeId: formState.nodeId,
          data: formState.partialFormData,
        });
        state.formState = undefined;
      } catch (err) {
        this.logger.warn(
          `handleFormStep submit_form 실패 — 재시도 안내: ${err instanceof Error ? err.message : String(err)}`,
        );
        // v1 정책: 사용자에게 처음부터 다시 안내 (Spec 의 fieldErrors[0].field 복원은 PR-E 보강).
        formState.currentFieldIdx = 0;
        formState.partialFormData = {};
        await adapter.sendMessage(
          {
            conversationKey: update.conversationKey,
            body: {
              kind: 'text',
              text:
                config.languageHints?.formValidationFailed ??
                '입력값을 다시 확인해주세요\\.',
            },
          },
          config,
        );
      }
    } else {
      // 다음 필드 prompt — v1 stub: dispatcher 가 fieldsCatalog 없이는 정확한 prompt 생성 불가.
      // placeholder 안내 발송.
      await adapter.sendMessage(
        {
          conversationKey: update.conversationKey,
          body: {
            kind: 'text',
            text:
              config.languageHints?.formNextField ??
              `다음 항목을 입력해주세요\\. \\(${formState.currentFieldIdx + 1}\\)`,
          },
        },
        config,
      );
    }

    state.lastUpdateAt = new Date().toISOString();
    await this.channelConversationService.upsert(
      trigger.id,
      update.conversationKey,
      state,
    );
  }

  /** Active execution 여부 확인 — terminal 상태가 아니면 active. */
  private async isActiveExecution(executionId: string): Promise<boolean> {
    const execution = await this.executionsService['executionRepository']
      ?.findOne?.({
        where: { id: executionId },
        select: ['id', 'status'],
      })
      .catch(() => null);
    if (!execution) return false;
    return (
      execution.status !== ExecutionStatus.COMPLETED &&
      execution.status !== ExecutionStatus.FAILED &&
      execution.status !== ExecutionStatus.CANCELLED
    );
  }

  private async buildInteractionResponse(
    config: Record<string, unknown>,
    executionId: string,
  ): Promise<{
    token?: string;
    expiresAt?: string;
    endpoints: {
      stream: string;
      submit: string;
      status: string;
      cancel: string;
      refresh: string;
    };
  } | null> {
    const interactionCfg = (config as { interaction?: unknown }).interaction;
    if (!interactionCfg || typeof interactionCfg !== 'object') return null;
    const enabled = (interactionCfg as { enabled?: unknown }).enabled === true;
    if (!enabled) return null;
    const strategy =
      (interactionCfg as { tokenStrategy?: unknown }).tokenStrategy ??
      'per_execution';
    const endpoints = {
      stream: `/api/external/executions/${executionId}/stream`,
      submit: `/api/external/executions/${executionId}/interact`,
      status: `/api/external/executions/${executionId}`,
      cancel: `/api/external/executions/${executionId}/cancel`,
      refresh: `/api/external/executions/${executionId}/refresh-token`,
    };
    if (strategy === 'per_execution') {
      const issued = await this.tokenService.issuePerExecution(executionId);
      return {
        token: issued.token,
        expiresAt: issued.expiresAt,
        endpoints,
      };
    }
    // per_trigger — token 미동봉 (호출자가 trigger 등록 시 받은 itk_* 사용)
    return { endpoints };
  }
}

/**
 * 클라이언트 IP 추출 — CF-Connecting-IP 우선, X-Forwarded-For 첫 IP, 없으면 undefined.
 * (spec/5-system/1-auth.md §2.3 의 IP 추출 우선순위와 정합. ip_whitelist 검증용.)
 */
function extractClientIp(headers: Record<string, string>): string | undefined {
  const cf = headers['cf-connecting-ip'];
  if (cf) return cf.trim();
  const xff = headers['x-forwarded-for'];
  if (xff) return xff.split(',')[0]?.trim();
  return undefined;
}

/** Trigger.config.chatChannel 추출 (HooksService 내부 헬퍼 — dispatcher 와 중복 정의 OK). */
function readChatChannelConfig(config: unknown): ChatChannelConfig | null {
  if (!config || typeof config !== 'object') return null;
  const chatChannel = (config as { chatChannel?: unknown }).chatChannel;
  if (!chatChannel || typeof chatChannel !== 'object') return null;
  const provider = (chatChannel as { provider?: unknown }).provider;
  if (typeof provider !== 'string' || provider.length === 0) return null;
  return chatChannel as ChatChannelConfig;
}

/**
 * Slack Events API url_verification envelope 여부 — controller 가 challenge 응답을 200 OK 로
 * 반환하기 위한 분기. Spec [providers/slack §3.1].
 */
function isSlackUrlVerification(body: unknown): boolean {
  if (!body || typeof body !== 'object') return false;
  return (body as { type?: unknown }).type === 'url_verification';
}

/**
 * Discord Interactions Webhook PING (type=1) envelope 여부 — controller 가 `{ type: 1 }`
 * 200 응답으로 handshake 처리하기 위한 분기. Spec [providers/discord §3.1].
 */
function isDiscordPing(body: unknown): boolean {
  if (!body || typeof body !== 'object') return false;
  return (body as { type?: unknown }).type === 1;
}
