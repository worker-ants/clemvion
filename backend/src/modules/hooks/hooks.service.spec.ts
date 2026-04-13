/* eslint-disable @typescript-eslint/unbound-method */
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  BadRequestException,
  GoneException,
  NotFoundException,
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
    expect(executeMock).toHaveBeenCalledWith('wf1', {
      parameters: { orderId: 'o1', amount: 1500 },
      body: input.body,
      headers: input.headers,
      query: input.query,
      method: 'POST',
    });
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
    );
  });
});
