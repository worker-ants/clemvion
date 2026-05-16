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
import { Trigger } from '../triggers/entities/trigger.entity';
import { Node, NodeCategory } from '../nodes/entities/node.entity';
import { ExecutionEngineService } from '../execution-engine/execution-engine.service';

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
});
