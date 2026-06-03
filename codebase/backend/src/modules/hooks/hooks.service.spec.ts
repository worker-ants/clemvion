import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  BadRequestException,
  GoneException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { HooksService, WebhookInput } from './hooks.service';
import { InteractionTokenService } from '../external-interaction/interaction-token.service';
import { InteractionService } from '../external-interaction/interaction.service';
import { Trigger } from '../triggers/entities/trigger.entity';
import { Node, NodeCategory } from '../nodes/entities/node.entity';
import { ExecutionEngineService } from '../execution-engine/execution-engine.service';
import { ExecutionsService } from '../executions/executions.service';
import { ChannelAdapterRegistry } from '../chat-channel/channel-adapter.registry';
import { ChannelConversationService } from '../chat-channel/channel-conversation.service';
import { ChatChannelAdapter } from '../chat-channel/types';
import { ChatChannelInboundAuthenticator } from '../chat-channel/chat-channel-inbound-authenticator';
import { AuthConfigsService } from '../auth-configs/auth-configs.service';

describe('HooksService', () => {
  let service: HooksService;
  let triggerRepo: jest.Mocked<Repository<Trigger>>;
  let nodeRepo: jest.Mocked<Repository<Node>>;
  let engine: jest.Mocked<ExecutionEngineService>;
  let authConfigs: { verifyWebhookRequest: jest.Mock };

  let moduleRef: any;

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        HooksService,
        {
          provide: getRepositoryToken(Trigger),
          useValue: { findOne: jest.fn(), save: jest.fn() },
        },
        {
          provide: getRepositoryToken(Node),
          useValue: { findOne: jest.fn() },
        },
        {
          provide: ExecutionEngineService,
          useValue: { execute: jest.fn() },
        },
        {
          provide: InteractionTokenService,
          useValue: {
            issuePerExecution: jest.fn(() =>
              Promise.resolve({
                token: 'iext_test',
                expiresAt: '2099-01-01T00:00:00Z',
                jti: 'jti-test',
              }),
            ),
          },
        },
        {
          provide: ChannelAdapterRegistry,
          useValue: { get: jest.fn(), has: jest.fn() },
        },
        {
          provide: ChannelConversationService,
          useValue: {
            lookup: jest.fn().mockResolvedValue(null),
            upsert: jest.fn().mockResolvedValue(undefined),
            updateExecutionId: jest.fn().mockResolvedValue(undefined),
            acquireLock: jest.fn().mockResolvedValue(true),
            releaseLock: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: InteractionService,
          useValue: { interact: jest.fn() },
        },
        {
          provide: ExecutionsService,
          useValue: {
            stop: jest.fn(),
            // hooks.service 가 ['executionRepository'] 로 indexed access — 빈 객체로 충분.
            executionRepository: { findOne: jest.fn().mockResolvedValue(null) },
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
      ],
    }).compile();

    service = moduleRef.get(HooksService);
    triggerRepo = moduleRef.get(getRepositoryToken(Trigger));
    nodeRepo = moduleRef.get(getRepositoryToken(Node));
    engine = moduleRef.get(ExecutionEngineService);
    authConfigs = moduleRef.get(AuthConfigsService);
  });

  const activeTrigger: Trigger = {
    id: 't1',
    workspaceId: 'ws',
    workflowId: 'wf1',
    type: 'webhook',
    name: 'hook',
    isActive: true,
    config: { authType: 'none' },
    endpointPath: 'abc',
    authConfigId: null,
    lastTriggeredAt: null as unknown as Date,
    createdAt: new Date(),
    updatedAt: new Date(),
    workspace: undefined as never,
    workflow: undefined as never,
    notificationHealth: 'unknown',
    notificationLastError: null,
    notificationSecretV2: null,
    notificationRotatedAt: null,
    chatChannelHealth: 'unknown',
    chatChannelLastError: null,
    chatChannelSetupAt: null,
    chatChannelTokenV2: null,
    chatChannelRotatedAt: null,
  };

  const input: WebhookInput = {
    body: { orderId: 'o1', amount: '1500' },
    headers: {},
    query: {},
    method: 'POST',
  };

  it('throws 404 when trigger not found', async () => {
    triggerRepo.findOne.mockResolvedValue(null);
    await expect(service.handleWebhook('xxx', input)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('throws 410 when trigger inactive', async () => {
    triggerRepo.findOne.mockResolvedValue({
      ...activeTrigger,
      isActive: false,
    });
    await expect(service.handleWebhook('abc', input)).rejects.toBeInstanceOf(
      GoneException,
    );
  });

  it('extracts parameters from body and calls executor with { parameters, ...input }', async () => {
    triggerRepo.findOne.mockResolvedValue(activeTrigger);
    triggerRepo.save.mockImplementation((t) => Promise.resolve(t as Trigger));
    nodeRepo.findOne.mockResolvedValue({
      id: 'n',
      workflowId: 'wf1',
      type: 'manual_trigger',
      category: NodeCategory.TRIGGER,
      config: {
        parameters: [
          { name: 'orderId', type: 'string', required: true },
          { name: 'amount', type: 'number', required: true },
        ],
      },
    } as unknown as Node);
    engine.execute.mockResolvedValue('exec-1');

    const res = await service.handleWebhook('abc', input);
    expect(res).toEqual({ executionId: 'exec-1' });
    const executeMock = engine.execute;
    expect(executeMock).toHaveBeenCalledWith(
      'wf1',
      {
        __triggerSource: 'webhook',
        parameters: { orderId: 'o1', amount: 1500 },
        body: input.body,
        headers: input.headers,
        query: input.query,
        method: 'POST',
      },
      { triggerId: 't1' },
    );
  });

  it('returns 400 when required parameter is missing', async () => {
    triggerRepo.findOne.mockResolvedValue(activeTrigger);
    nodeRepo.findOne.mockResolvedValue({
      id: 'n',
      workflowId: 'wf1',
      type: 'manual_trigger',
      category: NodeCategory.TRIGGER,
      config: {
        parameters: [{ name: 'orderId', type: 'string', required: true }],
      },
    } as unknown as Node);

    const err = await service
      .handleWebhook('abc', { ...input, body: {} })
      .catch((e: unknown) => e as BadRequestException);
    expect(err).toBeInstanceOf(BadRequestException);
    const executeMock = engine.execute;
    expect(executeMock).not.toHaveBeenCalled();
    const response = (err as BadRequestException).getResponse() as {
      errors: Array<{ field: string; reason: string }>;
    };
    expect(response.errors).toEqual([
      { field: 'orderId', reason: 'missing_required' },
    ]);
  });

  it('returns 400 with coerce_failed when body value cannot be coerced to declared type', async () => {
    triggerRepo.findOne.mockResolvedValue(activeTrigger);
    nodeRepo.findOne.mockResolvedValue({
      id: 'n',
      workflowId: 'wf1',
      type: 'manual_trigger',
      category: NodeCategory.TRIGGER,
      config: {
        parameters: [{ name: 'amount', type: 'number', required: true }],
      },
    } as unknown as Node);

    const err = (await service
      .handleWebhook('abc', { ...input, body: { amount: 'not-a-number' } })
      .catch((e: unknown) => e)) as BadRequestException;
    expect(err).toBeInstanceOf(BadRequestException);
    const response = err.getResponse() as {
      errors: Array<{ field: string; reason: string }>;
    };
    expect(response.errors).toEqual([
      { field: 'amount', reason: 'coerce_failed' },
    ]);
  });

  describe('auth — AuthConfig 위임 (verifyWebhookRequest)', () => {
    const noTriggerParamsNode = {
      id: 'n',
      workflowId: 'wf1',
      type: 'manual_trigger',
      category: NodeCategory.TRIGGER,
      config: {},
    } as unknown as Node;

    const authConfigId = 'ac-1';
    const authTrigger: Trigger = { ...activeTrigger, authConfigId };

    it('authConfigId 가 null 이면 verifyWebhookRequest 미호출 + 통과 (인증 없음)', async () => {
      triggerRepo.findOne.mockResolvedValue(activeTrigger); // authConfigId: null
      triggerRepo.save.mockImplementation((t) => Promise.resolve(t as Trigger));
      nodeRepo.findOne.mockResolvedValue(noTriggerParamsNode);
      engine.execute.mockResolvedValue('exec-noauth');

      const res = await service.handleWebhook('abc', input);
      expect(res).toEqual({ executionId: 'exec-noauth' });
      expect(authConfigs.verifyWebhookRequest).not.toHaveBeenCalled();
    });

    it('authConfigId 존재 시 verifyWebhookRequest(authConfigId, workspaceId, ctx) 위임 — clientIp 는 CF-Connecting-IP 에서 추출', async () => {
      triggerRepo.findOne.mockResolvedValue(authTrigger);
      triggerRepo.save.mockImplementation((t) => Promise.resolve(t as Trigger));
      nodeRepo.findOne.mockResolvedValue(noTriggerParamsNode);
      engine.execute.mockResolvedValue('exec-auth');
      authConfigs.verifyWebhookRequest.mockResolvedValue(undefined);
      const rawBody = Buffer.from(JSON.stringify(input.body));
      const headers = {
        authorization: 'Bearer xyz',
        'cf-connecting-ip': '203.0.113.7',
      };

      const res = await service.handleWebhook(
        'abc',
        { ...input, headers },
        rawBody,
      );
      expect(res).toEqual({ executionId: 'exec-auth' });
      expect(authConfigs.verifyWebhookRequest).toHaveBeenCalledWith(
        authConfigId,
        'ws',
        expect.objectContaining({
          headers,
          rawBody,
          clientIp: '203.0.113.7',
        }),
      );
    });

    it('verifyWebhookRequest 가 401 throw 시 handleWebhook 도 전파 + execute 미호출', async () => {
      triggerRepo.findOne.mockResolvedValue(authTrigger);
      nodeRepo.findOne.mockResolvedValue(noTriggerParamsNode);
      authConfigs.verifyWebhookRequest.mockRejectedValue(
        new UnauthorizedException({
          code: 'AUTH_FAILED',
          message: 'Authentication failed',
        }),
      );

      await expect(service.handleWebhook('abc', input)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(engine.execute).not.toHaveBeenCalled();
    });
  });

  it('passes { parameters: {} } when workflow has no trigger parameters schema', async () => {
    triggerRepo.findOne.mockResolvedValue(activeTrigger);
    triggerRepo.save.mockImplementation((t) => Promise.resolve(t as Trigger));
    nodeRepo.findOne.mockResolvedValue({
      id: 'n',
      workflowId: 'wf1',
      type: 'manual_trigger',
      category: NodeCategory.TRIGGER,
      config: {},
    } as unknown as Node);
    engine.execute.mockResolvedValue('exec-2');

    await service.handleWebhook('abc', input);
    const executeMock = engine.execute;
    expect(executeMock).toHaveBeenCalledWith(
      'wf1',
      expect.objectContaining({ parameters: {} }),
      { triggerId: 't1' },
    );
  });

  /**
   * [ai-review W6] External Interaction API 의 응답 확장 회귀 — trigger.config.interaction.enabled=true
   * 일 때 webhook 응답에 `status: 'pending'` + `interaction.{token, expiresAt, endpoints}` 동봉.
   *
   * per_execution / per_trigger 두 전략 모두 검증.
   */
  describe('External Interaction API — 응답 확장 (W6)', () => {
    const triggerWithInteraction = (
      tokenStrategy: 'per_execution' | 'per_trigger',
    ): Trigger =>
      ({
        ...activeTrigger,
        config: {
          authType: 'none',
          interaction: { enabled: true, tokenStrategy },
        },
      }) as Trigger;

    beforeEach(() => {
      triggerRepo.save.mockImplementation((t) => Promise.resolve(t as Trigger));
      nodeRepo.findOne.mockResolvedValue({
        id: 'n',
        workflowId: 'wf1',
        type: 'manual_trigger',
        category: NodeCategory.TRIGGER,
        config: {},
      } as unknown as Node);
      engine.execute.mockResolvedValue('exec-eia-1');
    });

    it('per_execution — interaction.token + expiresAt + endpoints 5종 동봉', async () => {
      triggerRepo.findOne.mockResolvedValue(
        triggerWithInteraction('per_execution'),
      );
      const res = await service.handleWebhook('abc', input);
      expect(res).toMatchObject({
        executionId: 'exec-eia-1',
        status: 'pending',
        interaction: {
          token: 'iext_test',
          expiresAt: '2099-01-01T00:00:00Z',
          endpoints: {
            stream: '/api/external/executions/exec-eia-1/stream',
            submit: '/api/external/executions/exec-eia-1/interact',
            status: '/api/external/executions/exec-eia-1',
            cancel: '/api/external/executions/exec-eia-1/cancel',
            refresh: '/api/external/executions/exec-eia-1/refresh-token',
          },
        },
      });
    });

    it('per_trigger — interaction.endpoints 만 동봉 (token 미동봉, 호출자가 itk_* 보유)', async () => {
      triggerRepo.findOne.mockResolvedValue(
        triggerWithInteraction('per_trigger'),
      );
      const res = await service.handleWebhook('abc', input);
      expect(res).toMatchObject({
        executionId: 'exec-eia-1',
        status: 'pending',
        interaction: expect.objectContaining({
          endpoints: expect.objectContaining({
            stream: '/api/external/executions/exec-eia-1/stream',
          }),
        }),
      });
      const r = res as { interaction?: { token?: string } };
      expect(r.interaction?.token).toBeUndefined();
    });

    it('interaction.enabled=false — 응답에 interaction 미동봉 (하위 호환)', async () => {
      triggerRepo.findOne.mockResolvedValue({
        ...activeTrigger,
        config: { authType: 'none', interaction: { enabled: false } },
      } as Trigger);
      const res = await service.handleWebhook('abc', input);
      expect(res).toEqual({ executionId: 'exec-eia-1' });
    });

    it('interaction 자체 미설정 — 응답에 interaction 미동봉', async () => {
      triggerRepo.findOne.mockResolvedValue(activeTrigger);
      const res = await service.handleWebhook('abc', input);
      expect(res).toEqual({ executionId: 'exec-eia-1' });
    });
  });

  /**
   * [ai-review W2] Chat Channel 분기 — HooksService.handleChatChannelWebhook 통합 테스트.
   * Spec §3.1 / CCH-AD-04 / 12-webhook.md §7 처리 흐름 Chat Channel 분기.
   */
  describe('Chat Channel 분기', () => {
    const SECRET_TOKEN = 'secret-token-abc';
    const SECRET_TOKEN_REF = 'secret://triggers/t1/inbound-signing';
    /** 헤더에 올바른 inbound-signing 자료 (Telegram secret_token) 을 포함한 입력 */
    const chatInput: WebhookInput = {
      ...input,
      headers: { 'x-telegram-bot-api-secret-token': SECRET_TOKEN },
    };
    const chatChannelTrigger: Trigger = {
      ...activeTrigger,
      config: {
        chatChannel: {
          provider: 'telegram',
          botTokenRef: 'secret://triggers/t1/bot-token',
          inboundSigningRef: SECRET_TOKEN_REF,
        },
      },
    } as unknown as Trigger;

    let authenticator: jest.Mocked<ChatChannelInboundAuthenticator>;

    let adapterRegistry: jest.Mocked<ChannelAdapterRegistry>;
    let conversationService: jest.Mocked<ChannelConversationService>;
    let interactionService: jest.Mocked<{
      interact: jest.MockedFunction<() => Promise<void>>;
    }>;
    let mockAdapter: {
      provider: string;
      parseUpdate: jest.MockedFunction<() => Promise<unknown>>;
      setupChannel: jest.MockedFunction<() => Promise<unknown>>;
      teardownChannel: jest.MockedFunction<() => Promise<void>>;
      renderNode: jest.MockedFunction<() => Promise<unknown[]>>;
      sendMessage: jest.MockedFunction<() => Promise<unknown>>;
      ackInteraction: jest.MockedFunction<() => Promise<void>>;
    };

    beforeEach(() => {
      adapterRegistry = moduleRef.get(
        ChannelAdapterRegistry,
      ) as jest.Mocked<ChannelAdapterRegistry>;
      conversationService = moduleRef.get(
        ChannelConversationService,
      ) as jest.Mocked<ChannelConversationService>;
      interactionService = moduleRef.get(InteractionService) as jest.Mocked<
        typeof interactionService
      >;
      authenticator = moduleRef.get(
        ChatChannelInboundAuthenticator,
      ) as jest.Mocked<ChatChannelInboundAuthenticator>;
      // default: authenticator.verify resolves (인증 통과). 거부 케이스 테스트에서 override.
      authenticator.verify.mockResolvedValue(undefined);

      mockAdapter = {
        provider: 'telegram',
        parseUpdate: jest.fn(),
        setupChannel: jest.fn(),
        teardownChannel: jest.fn(),
        renderNode: jest.fn(),
        sendMessage: jest.fn().mockResolvedValue({
          externalMsgId: 'msg-1',
          sentAt: new Date().toISOString(),
        }),
        ackInteraction: jest.fn().mockResolvedValue(undefined),
      };
      adapterRegistry.get.mockReturnValue(
        mockAdapter as unknown as ChatChannelAdapter,
      );
    });

    it('parseUpdate 가 null 반환 시 { executionId: "ignored" } 반환 (CCH-AD-04 무시 경로)', async () => {
      triggerRepo.findOne.mockResolvedValue(chatChannelTrigger);
      mockAdapter.parseUpdate.mockResolvedValue(null);

      const res = await service.handleWebhook('abc', chatInput);

      expect(res).toMatchObject({ executionId: 'ignored' });
      expect(engine.execute).not.toHaveBeenCalled();
    });

    // C-2: 비활성 chatChannel 트리거는 410 Gone 이 아니라 202 + { executionId: 'ignored' }.
    // isActive 검사가 chatChannel 판정보다 먼저 실행되던 결함의 회귀 가드
    // (spec R-CC-12 / §5.5 비활성 trigger 행 / WH-EP-07 chatChannel 예외).
    it('비활성 chatChannel 트리거 → Gone 대신 { executionId: "ignored" } (R-CC-12)', async () => {
      triggerRepo.findOne.mockResolvedValue({
        ...chatChannelTrigger,
        isActive: false,
      } as Trigger);

      const res = await service.handleWebhook('abc', chatInput);

      expect(res).toMatchObject({ executionId: 'ignored' });
      // adapter/parseUpdate 까지 가지 않고 즉시 무시.
      expect(mockAdapter.parseUpdate).not.toHaveBeenCalled();
      expect(engine.execute).not.toHaveBeenCalled();
    });

    it('parseUpdate 성공 + conversation 없음 → 새 execution 시작 (CCH-CV-03 신규 경로)', async () => {
      triggerRepo.findOne.mockResolvedValue(chatChannelTrigger);
      triggerRepo.save.mockImplementation((t) => Promise.resolve(t as Trigger));
      const channelUpdate = {
        conversationKey: 'chat-123',
        channelUserKey: 'user-456',
        command: { kind: 'text_message', text: 'hello' },
        idempotencyKey: '1001',
        receivedAt: new Date().toISOString(),
      };
      mockAdapter.parseUpdate.mockResolvedValue(channelUpdate);
      conversationService.lookup.mockResolvedValue(null);
      engine.execute.mockResolvedValue('exec-cc-1');

      const res = await service.handleWebhook('abc', chatInput);

      expect(engine.execute).toHaveBeenCalledWith(
        chatChannelTrigger.workflowId,
        expect.objectContaining({
          __triggerSource: 'webhook',
          chatChannel: expect.objectContaining({
            provider: 'telegram',
            conversationKey: 'chat-123',
          }),
        }),
        { triggerId: chatChannelTrigger.id },
      );
      expect(conversationService.upsert).toHaveBeenCalledWith(
        chatChannelTrigger.id,
        'chat-123',
        expect.objectContaining({ executionId: 'exec-cc-1' }),
      );
      expect(res).toMatchObject({ executionId: 'exec-cc-1' });
    });

    it('parseUpdate 성공 + 활성 execution 있음 → InteractionService.interact() in-process 호출 (CCH-CV-03 forwarding 경로)', async () => {
      triggerRepo.findOne.mockResolvedValue(chatChannelTrigger);
      const channelUpdate = {
        conversationKey: 'chat-123',
        channelUserKey: 'user-456',
        command: { kind: 'text_message', text: 'my answer' },
        idempotencyKey: '1002',
        receivedAt: new Date().toISOString(),
      };
      mockAdapter.parseUpdate.mockResolvedValue(channelUpdate);
      conversationService.lookup.mockResolvedValue({
        executionId: 'exec-active',
        threadId: 'default',
        channelUserKey: 'user-456',
        startedAt: new Date().toISOString(),
        lastUpdateAt: new Date().toISOString(),
      });
      // isActiveExecution — ExecutionsService.executionRepository.findOne 으로 활성 체크.
      const execRepo = (
        moduleRef.get(ExecutionsService) as {
          executionRepository: jest.Mocked<{
            findOne: jest.MockedFunction<() => Promise<{ status: string }>>;
          }>;
        }
      ).executionRepository;
      execRepo.findOne.mockResolvedValue({ status: 'waiting_for_input' });

      await service.handleWebhook('abc', chatInput);

      expect(interactionService.interact).toHaveBeenCalledWith(
        expect.objectContaining({
          executionId: 'exec-active',
          scope: 'in_process_trusted',
        }),
        expect.objectContaining({
          command: 'submit_message',
          message: 'my answer',
        }),
      );
      expect(engine.execute).not.toHaveBeenCalled();
    });

    it('§4.1 open_form_modal → adapter.openFormModal 호출 + interactionHttpResponse 반환 (discord-style)', async () => {
      triggerRepo.findOne.mockResolvedValue(chatChannelTrigger);
      const channelUpdate = {
        conversationKey: 'chat-123',
        channelUserKey: 'user-456',
        command: {
          kind: 'open_form_modal',
          openContext: { interactionId: 'I1', interactionToken: 'tok' },
        },
        idempotencyKey: 'I1',
        receivedAt: new Date().toISOString(),
      };
      mockAdapter.parseUpdate.mockResolvedValue(channelUpdate);
      const openFormModal = jest.fn().mockResolvedValue({
        httpResponse: { type: 9, data: { custom_id: 'clemvion_form' } },
      });
      (mockAdapter as Record<string, unknown>).openFormModal = openFormModal;
      (mockAdapter as Record<string, unknown>).supportsNativeForm = true;
      (mockAdapter as Record<string, unknown>).buildFormSubmissionResponse =
        jest.fn().mockReturnValue({});
      conversationService.lookup.mockResolvedValue({
        executionId: 'exec-active',
        threadId: 'default',
        channelUserKey: 'user-456',
        startedAt: new Date().toISOString(),
        lastUpdateAt: new Date().toISOString(),
        pendingFormModal: {
          nodeId: 'node-form',
          fields: [{ name: 'email', label: 'Email', type: 'email' }],
        },
      });

      const res = await service.handleWebhook('abc', chatInput);

      expect(openFormModal).toHaveBeenCalledWith(
        expect.objectContaining({
          openContext: { interactionId: 'I1', interactionToken: 'tok' },
          nodeId: 'node-form',
          fields: [{ name: 'email', label: 'Email', type: 'email' }],
          conversationKey: 'chat-123',
        }),
      );
      expect(res).toMatchObject({
        interactionHttpResponse: {
          type: 9,
          data: { custom_id: 'clemvion_form' },
        },
      });
      expect(engine.execute).not.toHaveBeenCalled();
    });

    // C-11 §5.1(b): open_form_modal + openContext.modal='reply' → reply modal
    // (pendingFormModal 없이도 동작, modalKind='reply' 전달).
    it("§5.1(b) open_form_modal modal='reply' → openFormModal(modalKind=reply) + httpResponse", async () => {
      triggerRepo.findOne.mockResolvedValue(chatChannelTrigger);
      const channelUpdate = {
        conversationKey: 'chat-123',
        channelUserKey: 'user-456',
        command: {
          kind: 'open_form_modal',
          openContext: { interactionId: 'I9', interactionToken: 'tok9', modal: 'reply' },
        },
        idempotencyKey: 'I9',
        receivedAt: new Date().toISOString(),
      };
      mockAdapter.parseUpdate.mockResolvedValue(channelUpdate);
      const openFormModal = jest.fn().mockResolvedValue({
        httpResponse: { type: 9, data: { custom_id: 'clemvion_reply' } },
      });
      (mockAdapter as Record<string, unknown>).openFormModal = openFormModal;
      (mockAdapter as Record<string, unknown>).supportsNativeForm = true;
      (mockAdapter as Record<string, unknown>).buildFormSubmissionResponse =
        jest.fn().mockReturnValue({});
      // reply 는 pendingFormModal 없이 동작해야 한다.
      conversationService.lookup.mockResolvedValue({
        executionId: 'exec-active',
        threadId: 'default',
        channelUserKey: 'user-456',
        startedAt: new Date().toISOString(),
        lastUpdateAt: new Date().toISOString(),
      });

      const res = await service.handleWebhook('abc', chatInput);

      expect(openFormModal).toHaveBeenCalledWith(
        expect.objectContaining({ modalKind: 'reply', fields: [] }),
      );
      expect(res).toMatchObject({
        interactionHttpResponse: { type: 9, data: { custom_id: 'clemvion_reply' } },
      });
    });

    it('§4.1 form_submission → interact submit_form (pendingFormModal.nodeId + fields) + pendingFormModal clear', async () => {
      triggerRepo.findOne.mockResolvedValue(chatChannelTrigger);
      const channelUpdate = {
        conversationKey: 'chat-123',
        channelUserKey: 'user-456',
        command: {
          kind: 'form_submission',
          fields: { email: 'a@b.io', name: 'Bob' },
        },
        idempotencyKey: 'V1',
        receivedAt: new Date().toISOString(),
      };
      mockAdapter.parseUpdate.mockResolvedValue(channelUpdate);
      const buildFormSubmissionResponse = jest.fn().mockReturnValue({});
      (mockAdapter as Record<string, unknown>).buildFormSubmissionResponse =
        buildFormSubmissionResponse;
      (mockAdapter as Record<string, unknown>).supportsNativeForm = true;
      (mockAdapter as Record<string, unknown>).openFormModal = jest.fn();
      const state = {
        executionId: 'exec-active',
        threadId: 'default',
        channelUserKey: 'user-456',
        startedAt: new Date().toISOString(),
        lastUpdateAt: new Date().toISOString(),
        pendingFormModal: {
          nodeId: 'node-form',
          fields: [{ name: 'email', label: 'Email', type: 'email' }],
        },
      };
      conversationService.lookup.mockResolvedValue(state);
      const execRepo = (
        moduleRef.get(ExecutionsService) as {
          executionRepository: jest.Mocked<{
            findOne: jest.MockedFunction<() => Promise<{ status: string }>>;
          }>;
        }
      ).executionRepository;
      execRepo.findOne.mockResolvedValue({ status: 'waiting_for_input' });
      interactionService.interact.mockResolvedValue(undefined);

      const res = await service.handleWebhook('abc', chatInput);

      // Fields are allowlist-filtered to only keys declared in pendingFormModal.fields.
      // 'name' is not in pendingFormModal.fields so it is stripped (security guard).
      expect(interactionService.interact).toHaveBeenCalledWith(
        expect.objectContaining({
          executionId: 'exec-active',
          scope: 'in_process_trusted',
        }),
        expect.objectContaining({
          command: 'submit_form',
          nodeId: 'node-form',
          data: { email: 'a@b.io' },
        }),
      );
      // pendingFormModal clear 후 upsert.
      expect(conversationService.upsert).toHaveBeenCalledWith(
        chatChannelTrigger.id,
        'chat-123',
        expect.objectContaining({ pendingFormModal: undefined }),
      );
      expect(res).toMatchObject({ executionId: 'exec-active' });
    });

    it('§4.1 form_submission → interact reject 시 buildFormSubmissionResponse(validationError) + re-noise sendMessage', async () => {
      triggerRepo.findOne.mockResolvedValue(chatChannelTrigger);
      const channelUpdate = {
        conversationKey: 'chat-123',
        channelUserKey: 'user-456',
        command: {
          // client-side 검증은 통과 (valid email) → interact 호출 → server reject 로 catch 경로 진입.
          kind: 'form_submission',
          fields: { email: 'a@b.io' },
        },
        idempotencyKey: 'V2',
        receivedAt: new Date().toISOString(),
      };
      mockAdapter.parseUpdate.mockResolvedValue(channelUpdate);
      const buildFormSubmissionResponse = jest.fn().mockReturnValue({
        httpResponse: {
          type: 4,
          data: { content: '⚠️ 입력값을 다시 확인해주세요.', flags: 64 },
        },
      });
      (mockAdapter as Record<string, unknown>).buildFormSubmissionResponse =
        buildFormSubmissionResponse;
      (mockAdapter as Record<string, unknown>).supportsNativeForm = true;
      (mockAdapter as Record<string, unknown>).openFormModal = jest.fn();
      const state = {
        executionId: 'exec-active',
        threadId: 'default',
        channelUserKey: 'user-456',
        startedAt: new Date().toISOString(),
        lastUpdateAt: new Date().toISOString(),
        pendingFormModal: {
          nodeId: 'node-form',
          fields: [{ name: 'email', label: 'Email', type: 'email' }],
        },
      };
      conversationService.lookup.mockResolvedValue(state);
      const execRepo = (
        moduleRef.get(ExecutionsService) as {
          executionRepository: jest.Mocked<{
            findOne: jest.MockedFunction<() => Promise<{ status: string }>>;
          }>;
        }
      ).executionRepository;
      execRepo.findOne.mockResolvedValue({ status: 'waiting_for_input' });
      interactionService.interact.mockRejectedValue(
        new Error('validation failed'),
      );

      const res = await service.handleWebhook('abc', chatInput);

      // buildFormSubmissionResponse 가 validationError 와 함께 호출돼야 함.
      expect(buildFormSubmissionResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          validationError: { message: '입력값을 다시 확인해주세요.' },
        }),
      );
      // interactionHttpResponse 가 반환돼야 함.
      expect(res).toMatchObject({
        interactionHttpResponse: {
          type: 4,
          data: { content: '⚠️ 입력값을 다시 확인해주세요.', flags: 64 },
        },
      });
      // re-noise: sendMessage 로 form_modal 버튼 재발송해야 함.
      expect(mockAdapter.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({ kind: 'form_modal' }),
        }),
        expect.anything(),
      );
    });

    it('§4.1 form_submission → lock 획득 후 interact + 성공 시 lock 해제 (concurrency guard)', async () => {
      triggerRepo.findOne.mockResolvedValue(chatChannelTrigger);
      const channelUpdate = {
        conversationKey: 'chat-123',
        channelUserKey: 'user-456',
        command: { kind: 'form_submission', fields: { email: 'a@b.io' } },
        idempotencyKey: 'L1',
        receivedAt: new Date().toISOString(),
      };
      mockAdapter.parseUpdate.mockResolvedValue(channelUpdate);
      (mockAdapter as Record<string, unknown>).buildFormSubmissionResponse =
        jest.fn().mockReturnValue({});
      (mockAdapter as Record<string, unknown>).supportsNativeForm = true;
      (mockAdapter as Record<string, unknown>).openFormModal = jest.fn();
      const state = {
        executionId: 'exec-active',
        threadId: 'default',
        channelUserKey: 'user-456',
        startedAt: new Date().toISOString(),
        lastUpdateAt: new Date().toISOString(),
        pendingFormModal: {
          nodeId: 'node-form',
          fields: [{ name: 'email', label: 'Email', type: 'email' }],
        },
      };
      conversationService.lookup.mockResolvedValue(state);
      const execRepo = (
        moduleRef.get(ExecutionsService) as {
          executionRepository: jest.Mocked<{
            findOne: jest.MockedFunction<() => Promise<{ status: string }>>;
          }>;
        }
      ).executionRepository;
      execRepo.findOne.mockResolvedValue({ status: 'waiting_for_input' });
      interactionService.interact.mockResolvedValue(undefined);

      await service.handleWebhook('abc', chatInput);

      expect(conversationService.acquireLock).toHaveBeenCalledWith(
        chatChannelTrigger.id,
        'chat-123',
        expect.any(String),
      );
      expect(interactionService.interact).toHaveBeenCalledTimes(1);
      // 성공 경로에서도 lock 해제 (finally).
      expect(conversationService.releaseLock).toHaveBeenCalledWith(
        chatChannelTrigger.id,
        'chat-123',
        expect.any(String),
      );
    });

    it('§4.1 form_submission → 동시 중복 제출 (acquireLock=false) 시 interact 호출 없이 반환', async () => {
      triggerRepo.findOne.mockResolvedValue(chatChannelTrigger);
      const channelUpdate = {
        conversationKey: 'chat-123',
        channelUserKey: 'user-456',
        command: { kind: 'form_submission', fields: { email: 'a@b.io' } },
        idempotencyKey: 'L2',
        receivedAt: new Date().toISOString(),
      };
      mockAdapter.parseUpdate.mockResolvedValue(channelUpdate);
      (mockAdapter as Record<string, unknown>).supportsNativeForm = true;
      (mockAdapter as Record<string, unknown>).openFormModal = jest.fn();
      (mockAdapter as Record<string, unknown>).buildFormSubmissionResponse =
        jest.fn().mockReturnValue({});
      const state = {
        executionId: 'exec-active',
        threadId: 'default',
        channelUserKey: 'user-456',
        startedAt: new Date().toISOString(),
        lastUpdateAt: new Date().toISOString(),
        pendingFormModal: {
          nodeId: 'node-form',
          fields: [{ name: 'email', label: 'Email', type: 'email' }],
        },
      };
      conversationService.lookup.mockResolvedValue(state);
      const execRepo = (
        moduleRef.get(ExecutionsService) as {
          executionRepository: jest.Mocked<{
            findOne: jest.MockedFunction<() => Promise<{ status: string }>>;
          }>;
        }
      ).executionRepository;
      execRepo.findOne.mockResolvedValue({ status: 'waiting_for_input' });
      // 두 번째 동시 요청 → lock 미획득.
      conversationService.acquireLock.mockResolvedValue(false);

      const res = await service.handleWebhook('abc', chatInput);

      expect(interactionService.interact).not.toHaveBeenCalled();
      expect(res).toMatchObject({ executionId: 'exec-active' });
    });

    it('§4.1 form_submission → client-side 검증 실패 시 interact 미호출 + buildFormSubmissionResponse(validationError) + lock 해제', async () => {
      triggerRepo.findOne.mockResolvedValue(chatChannelTrigger);
      const channelUpdate = {
        conversationKey: 'chat-123',
        channelUserKey: 'user-456',
        command: { kind: 'form_submission', fields: { email: 'not-an-email' } },
        idempotencyKey: 'L3',
        receivedAt: new Date().toISOString(),
      };
      mockAdapter.parseUpdate.mockResolvedValue(channelUpdate);
      const buildFormSubmissionResponse = jest.fn().mockReturnValue({
        httpResponse: { type: 4, data: { content: '⚠️ 형식 오류', flags: 64 } },
      });
      (mockAdapter as Record<string, unknown>).buildFormSubmissionResponse =
        buildFormSubmissionResponse;
      (mockAdapter as Record<string, unknown>).supportsNativeForm = true;
      (mockAdapter as Record<string, unknown>).openFormModal = jest.fn();
      const state = {
        executionId: 'exec-active',
        threadId: 'default',
        channelUserKey: 'user-456',
        startedAt: new Date().toISOString(),
        lastUpdateAt: new Date().toISOString(),
        pendingFormModal: {
          nodeId: 'node-form',
          fields: [
            { name: 'email', label: 'Email', type: 'email', required: true },
          ],
        },
      };
      conversationService.lookup.mockResolvedValue(state);
      const execRepo = (
        moduleRef.get(ExecutionsService) as {
          executionRepository: jest.Mocked<{
            findOne: jest.MockedFunction<() => Promise<{ status: string }>>;
          }>;
        }
      ).executionRepository;
      execRepo.findOne.mockResolvedValue({ status: 'waiting_for_input' });

      const res = await service.handleWebhook('abc', chatInput);

      // client-side gate: interact 호출 금지.
      expect(interactionService.interact).not.toHaveBeenCalled();
      // validationError 가 client-side 검증 결과 (email 형식) 로 전달.
      expect(buildFormSubmissionResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          validationError: {
            field: 'email',
            message: '올바른 이메일 형식이 아닙니다.',
          },
        }),
      );
      // re-noise 버튼 재발송 + lock 해제.
      expect(mockAdapter.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({ kind: 'form_modal' }),
        }),
        expect.anything(),
      );
      expect(conversationService.releaseLock).toHaveBeenCalled();
      expect(res).toMatchObject({
        interactionHttpResponse: {
          type: 4,
          data: { content: '⚠️ 형식 오류', flags: 64 },
        },
      });
    });

    it('§4.1 open_form_modal channelUserKey mismatch → 거부 (executionId ignored)', async () => {
      triggerRepo.findOne.mockResolvedValue(chatChannelTrigger);
      const channelUpdate = {
        conversationKey: 'chat-123',
        channelUserKey: 'attacker-999',
        command: {
          kind: 'open_form_modal',
          openContext: { interactionId: 'I2', interactionToken: 'tok2' },
        },
        idempotencyKey: 'I2',
        receivedAt: new Date().toISOString(),
      };
      mockAdapter.parseUpdate.mockResolvedValue(channelUpdate);
      const openFormModal = jest
        .fn()
        .mockResolvedValue({ httpResponse: { type: 9 } });
      (mockAdapter as Record<string, unknown>).openFormModal = openFormModal;
      conversationService.lookup.mockResolvedValue({
        executionId: 'exec-active',
        threadId: 'default',
        channelUserKey: 'user-456',
        startedAt: new Date().toISOString(),
        lastUpdateAt: new Date().toISOString(),
        pendingFormModal: {
          nodeId: 'node-form',
          fields: [{ name: 'email', label: 'Email', type: 'email' }],
        },
      });

      const res = await service.handleWebhook('abc', chatInput);

      // openFormModal 가 호출되면 안 됨.
      expect(openFormModal).not.toHaveBeenCalled();
      expect(res).toMatchObject({ executionId: 'exec-active' });
    });

    it('§4.1 form_submission channelUserKey mismatch → 거부 (executionId ignored)', async () => {
      triggerRepo.findOne.mockResolvedValue(chatChannelTrigger);
      const channelUpdate = {
        conversationKey: 'chat-123',
        channelUserKey: 'attacker-999',
        command: {
          kind: 'form_submission',
          fields: { email: 'a@b.io' },
        },
        idempotencyKey: 'V3',
        receivedAt: new Date().toISOString(),
      };
      mockAdapter.parseUpdate.mockResolvedValue(channelUpdate);
      const state = {
        executionId: 'exec-active',
        threadId: 'default',
        channelUserKey: 'user-456',
        startedAt: new Date().toISOString(),
        lastUpdateAt: new Date().toISOString(),
        pendingFormModal: {
          nodeId: 'node-form',
          fields: [{ name: 'email', label: 'Email', type: 'email' }],
        },
      };
      conversationService.lookup.mockResolvedValue(state);

      const res = await service.handleWebhook('abc', chatInput);

      // interact 가 호출되면 안 됨.
      expect(interactionService.interact).not.toHaveBeenCalled();
      expect(res).toMatchObject({ executionId: 'exec-active' });
    });

    it('Authenticator 가 401 throw 시 HooksService 도 전파', async () => {
      triggerRepo.findOne.mockResolvedValue(chatChannelTrigger);
      authenticator.verify.mockRejectedValueOnce(
        new UnauthorizedException({
          code: 'AUTH_FAILED',
          message: 'Invalid Telegram secret token',
        }),
      );

      await expect(
        service.handleWebhook('abc', {
          ...input,
          headers: { 'x-telegram-bot-api-secret-token': 'wrong-token' },
        }),
      ).rejects.toMatchObject({ status: 401 });
      // adapter 호출 자체가 차단됨.
      expect(mockAdapter.parseUpdate).not.toHaveBeenCalled();
    });

    it('Authenticator 가 통과시 정상 흐름 진행 — verify 호출 검증', async () => {
      triggerRepo.findOne.mockResolvedValue(chatChannelTrigger);
      mockAdapter.parseUpdate.mockResolvedValue(null);
      await service.handleWebhook('abc', chatInput);
      // HooksService 가 authenticator.verify 를 trigger.id, config, headers, rawBody (string) 와 호출.
      // Slack signing 검증을 위해 4번째 param (rawBody string) 추가됨 — Telegram 은 무시.
      expect(authenticator.verify).toHaveBeenCalledWith(
        chatChannelTrigger.id,
        expect.objectContaining({ provider: 'telegram' }),
        chatInput.headers,
        expect.any(String),
      );
    });
  });
});
