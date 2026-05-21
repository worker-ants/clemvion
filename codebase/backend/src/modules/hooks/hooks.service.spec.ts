import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHmac } from 'crypto';
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

describe('HooksService', () => {
  let service: HooksService;
  let triggerRepo: jest.Mocked<Repository<Trigger>>;
  let nodeRepo: jest.Mocked<Repository<Node>>;
  let engine: jest.Mocked<ExecutionEngineService>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
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
      ],
    }).compile();

    service = moduleRef.get(HooksService);
    triggerRepo = moduleRef.get(getRepositoryToken(Trigger));
    nodeRepo = moduleRef.get(getRepositoryToken(Node));
    engine = moduleRef.get(ExecutionEngineService);
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

  describe('auth — bearer / HMAC (constantTimeEquals coverage)', () => {
    const bearerTrigger: Trigger = {
      ...activeTrigger,
      config: { authType: 'bearer', bearerToken: 'sekret-token-1234' },
    };

    const hmacSecret = 'webhook-secret';
    const hmacTrigger: Trigger = {
      ...activeTrigger,
      config: {
        authType: 'hmac',
        secret: hmacSecret,
        hmacHeader: 'x-hub-signature-256',
        hmacAlgorithm: 'sha256',
      },
    };

    const noTriggerParamsNode = {
      id: 'n',
      workflowId: 'wf1',
      type: 'manual_trigger',
      category: NodeCategory.TRIGGER,
      config: {},
    } as unknown as Node;

    it('bearer: rejects when token is missing', async () => {
      triggerRepo.findOne.mockResolvedValue(bearerTrigger);
      nodeRepo.findOne.mockResolvedValue(noTriggerParamsNode);
      await expect(service.handleWebhook('abc', input)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('bearer: rejects on length mismatch (constantTimeEquals fast-path)', async () => {
      triggerRepo.findOne.mockResolvedValue(bearerTrigger);
      nodeRepo.findOne.mockResolvedValue(noTriggerParamsNode);
      const headers = { authorization: 'Bearer short' };
      await expect(
        service.handleWebhook('abc', { ...input, headers }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('bearer: rejects on equal-length mismatch', async () => {
      triggerRepo.findOne.mockResolvedValue(bearerTrigger);
      nodeRepo.findOne.mockResolvedValue(noTriggerParamsNode);
      const headers = { authorization: 'Bearer sekret-token-0000' };
      await expect(
        service.handleWebhook('abc', { ...input, headers }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('bearer: accepts valid token (constantTimeEquals match)', async () => {
      triggerRepo.findOne.mockResolvedValue(bearerTrigger);
      triggerRepo.save.mockImplementation((t) => Promise.resolve(t as Trigger));
      nodeRepo.findOne.mockResolvedValue(noTriggerParamsNode);
      engine.execute.mockResolvedValue('exec-bearer');
      const headers = { authorization: 'Bearer sekret-token-1234' };
      const res = await service.handleWebhook('abc', { ...input, headers });
      expect(res).toEqual({ executionId: 'exec-bearer' });
    });

    it('hmac: rejects when signature header is missing', async () => {
      triggerRepo.findOne.mockResolvedValue(hmacTrigger);
      nodeRepo.findOne.mockResolvedValue(noTriggerParamsNode);
      const rawBody = Buffer.from(JSON.stringify(input.body));
      await expect(
        service.handleWebhook('abc', input, rawBody),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('hmac: rejects when rawBody is undefined', async () => {
      triggerRepo.findOne.mockResolvedValue(hmacTrigger);
      nodeRepo.findOne.mockResolvedValue(noTriggerParamsNode);
      const headers = { 'x-hub-signature-256': 'sha256=deadbeef' };
      await expect(
        service.handleWebhook('abc', { ...input, headers }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('hmac: rejects on signature mismatch', async () => {
      triggerRepo.findOne.mockResolvedValue(hmacTrigger);
      nodeRepo.findOne.mockResolvedValue(noTriggerParamsNode);
      const rawBody = Buffer.from(JSON.stringify(input.body));
      const wrong = `sha256=${createHmac('sha256', 'WRONG-SECRET').update(rawBody).digest('hex')}`;
      const headers = { 'x-hub-signature-256': wrong };
      await expect(
        service.handleWebhook('abc', { ...input, headers }, rawBody),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('hmac: accepts valid sha256 signature', async () => {
      triggerRepo.findOne.mockResolvedValue(hmacTrigger);
      triggerRepo.save.mockImplementation((t) => Promise.resolve(t as Trigger));
      nodeRepo.findOne.mockResolvedValue(noTriggerParamsNode);
      engine.execute.mockResolvedValue('exec-hmac');
      const rawBody = Buffer.from(JSON.stringify(input.body));
      const sig = `sha256=${createHmac('sha256', hmacSecret).update(rawBody).digest('hex')}`;
      const headers = { 'x-hub-signature-256': sig };
      const res = await service.handleWebhook(
        'abc',
        { ...input, headers },
        rawBody,
      );
      expect(res).toEqual({ executionId: 'exec-hmac' });
    });

    it('hmac: rejects unsupported algorithm (allowlist)', async () => {
      triggerRepo.findOne.mockResolvedValue({
        ...activeTrigger,
        config: {
          authType: 'hmac',
          secret: hmacSecret,
          hmacHeader: 'x-hub-signature-256',
          hmacAlgorithm: 'md5',
        },
      });
      nodeRepo.findOne.mockResolvedValue(noTriggerParamsNode);
      const rawBody = Buffer.from(JSON.stringify(input.body));
      const headers = { 'x-hub-signature-256': 'md5=deadbeef' };
      await expect(
        service.handleWebhook('abc', { ...input, headers }, rawBody),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('hmac: unsupported algorithm response does not leak the rejected name', async () => {
      // information leakage 차단: 거부 응답이 알고리즘명을 반사하면 외부 호출자가
      // 서버 구성을 탐지할 단서를 얻는다. 응답 메시지는 일반 인증 실패와 동일해야 한다.
      triggerRepo.findOne.mockResolvedValue({
        ...activeTrigger,
        config: {
          authType: 'hmac',
          secret: hmacSecret,
          hmacHeader: 'x-hub-signature-256',
          hmacAlgorithm: 'md5',
        },
      });
      nodeRepo.findOne.mockResolvedValue(noTriggerParamsNode);
      const rawBody = Buffer.from(JSON.stringify(input.body));
      const err = await service
        .handleWebhook(
          'abc',
          { ...input, headers: { 'x-hub-signature-256': 'md5=x' } },
          rawBody,
        )
        .catch((e: unknown) => e as UnauthorizedException);
      const response = (err as UnauthorizedException).getResponse() as {
        code: string;
        message: string;
      };
      expect(response.code).toBe('AUTH_FAILED');
      expect(response.message).toBe('Authentication failed');
      expect(response.message).not.toMatch(/md5/i);
    });

    it('hmac: accepts valid sha512 signature (allow-list 두 번째 알고리즘 경로)', async () => {
      const sha512Trigger: Trigger = {
        ...activeTrigger,
        config: {
          authType: 'hmac',
          secret: hmacSecret,
          hmacHeader: 'x-hub-signature-512',
          hmacAlgorithm: 'sha512',
        },
      };
      triggerRepo.findOne.mockResolvedValue(sha512Trigger);
      triggerRepo.save.mockImplementation((t) => Promise.resolve(t as Trigger));
      nodeRepo.findOne.mockResolvedValue(noTriggerParamsNode);
      engine.execute.mockResolvedValue('exec-sha512');
      const rawBody = Buffer.from(JSON.stringify(input.body));
      const sig = `sha512=${createHmac('sha512', hmacSecret).update(rawBody).digest('hex')}`;
      const headers = { 'x-hub-signature-512': sig };
      const res = await service.handleWebhook(
        'abc',
        { ...input, headers },
        rawBody,
      );
      expect(res).toEqual({ executionId: 'exec-sha512' });
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
});
