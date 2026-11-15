import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { HooksService, WebhookInput } from './hooks.service';
import { InteractionTokenService } from '../external-interaction/interaction-token.service';
import { InteractionService } from '../external-interaction/interaction.service';
import { Trigger } from '../triggers/entities/trigger.entity';
import { Node } from '../nodes/entities/node.entity';
import { Workflow } from '../workflows/entities/workflow.entity';
import { ExecutionEngineService } from '../execution-engine/execution-engine.service';
import { ExecutionsService } from '../executions/executions.service';
import { ChannelAdapterRegistry } from '../chat-channel/channel-adapter.registry';
import { ChannelConversationService } from '../chat-channel/channel-conversation.service';
import { ChatChannelRateLimiterService } from '../chat-channel/chat-channel-rate-limiter.service';
import { ChatChannelDedupService } from '../chat-channel/chat-channel-dedup.service';
import { ChatChannelInboundAuthenticator } from '../chat-channel/chat-channel-inbound-authenticator';
import { AuthConfigsService } from '../auth-configs/auth-configs.service';
import { BusinessMetricsService } from '../metrics/business-metrics.service';
import {
  FORM_VALIDATION_FAILED_DEFAULT,
  formNextFieldDefault,
  GROUP_CHAT_REFUSAL_DEFAULT,
} from '../chat-channel/shared/language-hint-defaults';

// HooksService 가 languageHints override 가 없을 때 공용 기본 문구(language-hint-defaults)를
// 실제로 발송하는지 본다. 기본 문구 값 자체는 language-hint-defaults.spec.ts 가 단언하고,
// 이 파일은 HooksService 의 세 발송 지점(단체방 거절 · 폼 검증 실패 · 다음 항목 안내)이 그 상수에
// 연결됐는지를 본다. 근거: CLE-CHAT-DATA-CONFIG 「안내 문구 기본값」, NERV Task CLE-T-77C0HP.
describe('HooksService — 채팅 채널 안내 기본 문구', () => {
  let service: HooksService;
  let triggerRepo: { findOne: jest.Mock; update: jest.Mock };
  let conversation: { lookup: jest.Mock; upsert: jest.Mock };
  let interaction: { interact: jest.Mock };
  let executionRepo: { findOne: jest.Mock };
  let sendMessage: jest.Mock;
  let parseUpdate: jest.Mock;

  const languageHints: Record<string, string> = {};
  const trigger = {
    id: 't1',
    workspaceId: 'ws',
    workflowId: 'wf1',
    type: 'webhook',
    isActive: true,
    endpointPath: 'abc',
    authConfigId: null,
    config: {
      chatChannel: {
        provider: 'telegram',
        botTokenRef: 'secret://triggers/t1/bot-token',
        inboundSigningRef: 'secret://triggers/t1/inbound-signing',
        languageHints,
      },
    },
  } as unknown as Trigger;

  const input: WebhookInput = {
    body: { update_id: 1 },
    headers: { 'x-telegram-bot-api-secret-token': 'secret' },
    query: {},
    method: 'POST',
  };

  /** 마지막으로 발송한 안내의 본문 텍스트. */
  function lastSentText(): string {
    const calls = sendMessage.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    return (calls[calls.length - 1][0] as { body: { text: string } }).body.text;
  }

  /** 폼 다단계 시퀀스 중인 대화에 텍스트 응답이 들어온 상황을 만든다. */
  function arrangeFormStep(currentFieldIdx: number): void {
    parseUpdate.mockResolvedValue({
      conversationKey: 'chat-1',
      channelUserKey: 'user-1',
      command: { kind: 'text_message', text: 'answer' },
      idempotencyKey: '10',
      receivedAt: new Date().toISOString(),
    });
    conversation.lookup.mockResolvedValue({
      executionId: 'exec-1',
      threadId: 'default',
      channelUserKey: 'user-1',
      startedAt: new Date().toISOString(),
      lastUpdateAt: new Date().toISOString(),
      formState: { nodeId: 'node-form', currentFieldIdx, partialFormData: {} },
    });
    executionRepo.findOne.mockResolvedValue({ status: 'waiting_for_input' });
  }

  beforeEach(async () => {
    for (const k of Object.keys(languageHints)) delete languageHints[k];
    executionRepo = { findOne: jest.fn().mockResolvedValue(null) };
    sendMessage = jest.fn().mockResolvedValue({
      externalMsgId: 'm1',
      sentAt: new Date().toISOString(),
    });
    parseUpdate = jest.fn();
    const adapter = {
      provider: 'telegram',
      parseUpdate,
      sendMessage,
      setupChannel: jest.fn(),
      teardownChannel: jest.fn(),
      renderNode: jest.fn(),
      ackInteraction: jest.fn().mockResolvedValue(undefined),
      // 발송 텍스트를 그대로 보려고 escape 를 passthrough 로 둔다.
      escapeControlText: jest.fn((t: string) => t),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        HooksService,
        {
          provide: getRepositoryToken(Trigger),
          useValue: {
            findOne: jest.fn().mockResolvedValue(trigger),
            save: jest.fn(),
            update: jest.fn().mockResolvedValue({ affected: 1 }),
          },
        },
        { provide: getRepositoryToken(Node), useValue: { findOne: jest.fn() } },
        {
          provide: getRepositoryToken(Workflow),
          useValue: {
            findOne: jest.fn().mockResolvedValue({ id: 'wf1', isActive: true }),
          },
        },
        { provide: ExecutionEngineService, useValue: { execute: jest.fn() } },
        { provide: InteractionTokenService, useValue: {} },
        {
          provide: ChannelAdapterRegistry,
          useValue: { get: jest.fn(() => adapter), has: jest.fn(() => true) },
        },
        {
          provide: ChannelConversationService,
          useValue: {
            lookup: jest.fn().mockResolvedValue(null),
            upsert: jest.fn().mockResolvedValue(undefined),
            clearExecutionIdIfMatches: jest.fn().mockResolvedValue(true),
            acquireLock: jest.fn().mockResolvedValue(true),
            releaseLock: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: ChatChannelRateLimiterService,
          useValue: { consume: jest.fn().mockResolvedValue(true) },
        },
        {
          provide: ChatChannelDedupService,
          useValue: {
            claim: jest.fn().mockResolvedValue(true),
            release: jest.fn().mockResolvedValue(undefined),
          },
        },
        { provide: InteractionService, useValue: { interact: jest.fn() } },
        {
          provide: ExecutionsService,
          useValue: {
            stop: jest.fn(),
            getStatusById: jest.fn(async (id: string) => {
              const row = (await executionRepo
                .findOne({ where: { id } })
                .catch(() => null)) as { status?: string } | null;
              return row?.status ?? null;
            }),
          },
        },
        {
          provide: ChatChannelInboundAuthenticator,
          useValue: { verify: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: AuthConfigsService,
          useValue: { verifyWebhookRequest: jest.fn() },
        },
        {
          provide: BusinessMetricsService,
          useValue: { recordChatChannelInboundErrorAbsorbed: jest.fn() },
        },
      ],
    }).compile();

    service = moduleRef.get(HooksService);
    triggerRepo = moduleRef.get(getRepositoryToken(Trigger));
    conversation = moduleRef.get(ChannelConversationService);
    interaction = moduleRef.get(InteractionService);
  });

  describe('단체방 메시지(parseUpdate 가 null)', () => {
    const groupInput: WebhookInput = {
      ...input,
      body: {
        message: { chat: { id: 4242, type: 'group' }, from: { is_bot: false } },
      },
    };

    it('override 가 없으면 단체방 거절 기본 문구를 보낸다', async () => {
      parseUpdate.mockResolvedValue(null);

      await service.handleWebhook('abc', groupInput);

      expect(lastSentText()).toBe(GROUP_CHAT_REFUSAL_DEFAULT);
    });

    it('override 가 있으면 그 문구를 보낸다', async () => {
      languageHints.groupChatRefusal = '개인 대화에서만 써 주세요.';
      parseUpdate.mockResolvedValue(null);

      await service.handleWebhook('abc', groupInput);

      expect(lastSentText()).toBe('개인 대화에서만 써 주세요.');
    });
  });

  describe('폼 다단계 응답', () => {
    it('다음 항목이 남았으면 다음 항목 번호(1부터)를 붙인 기본 문구를 보낸다', async () => {
      // 첫 항목(인덱스 0)에 답했으므로 다음은 두 번째 항목이다.
      arrangeFormStep(0);

      await service.handleWebhook('abc', input);

      expect(lastSentText()).toBe(formNextFieldDefault(2));
      expect(lastSentText()).toBe('다음 항목을 입력해 주세요. (2)');
    });

    it('override 가 있으면 다음 항목 안내도 그 문구를 보낸다', async () => {
      languageHints.formNextField = '다음 칸을 채워 주세요.';
      arrangeFormStep(0);

      await service.handleWebhook('abc', input);

      expect(lastSentText()).toBe('다음 칸을 채워 주세요.');
    });

    it('마지막 항목 제출이 실패하면 폼 검증 실패 기본 문구를 보낸다', async () => {
      // 10필드 휴리스틱의 마지막 응답 → submit_form. interact 가 실패하면 처음부터 다시 안내한다.
      arrangeFormStep(9);
      interaction.interact.mockRejectedValue(new Error('validation failed'));

      await service.handleWebhook('abc', input);

      expect(interaction.interact).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ command: 'submit_form' }),
      );
      expect(lastSentText()).toBe(FORM_VALIDATION_FAILED_DEFAULT);
      expect(triggerRepo.findOne).toHaveBeenCalled();
    });
  });
});
