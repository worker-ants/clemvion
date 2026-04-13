/* eslint-disable @typescript-eslint/unbound-method */
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BadRequestException } from '@nestjs/common';
import { WorkflowsController } from './workflows.controller';
import { WorkflowsService } from './workflows.service';
import { ExecutionEngineService } from '../execution-engine/execution-engine.service';
import { Node, NodeCategory } from '../nodes/entities/node.entity';
import type { JwtPayload } from '../../common/decorators';

describe('WorkflowsController (execute endpoint)', () => {
  let controller: WorkflowsController;
  let nodeRepo: jest.Mocked<Repository<Node>>;
  let engine: jest.Mocked<ExecutionEngineService>;
  let workflowsService: jest.Mocked<WorkflowsService>;

  const user: JwtPayload = {
    sub: 'u1',
    email: 'x@y',
  } as unknown as JwtPayload;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [WorkflowsController],
      providers: [
        {
          provide: WorkflowsService,
          useValue: { findById: jest.fn().mockResolvedValue({ id: 'wf1' }) },
        },
        {
          provide: ExecutionEngineService,
          useValue: { execute: jest.fn().mockResolvedValue('exec-1') },
        },
        {
          provide: getRepositoryToken(Node),
          useValue: { findOne: jest.fn() },
        },
      ],
    }).compile();

    controller = moduleRef.get(WorkflowsController);
    nodeRepo = moduleRef.get(getRepositoryToken(Node));
    engine = moduleRef.get(ExecutionEngineService);
    workflowsService = moduleRef.get(WorkflowsService);
  });

  it('resolves parameterValues against trigger schema and calls engine.execute', async () => {
    nodeRepo.findOne.mockResolvedValue({
      id: 'n',
      workflowId: 'wf1',
      category: NodeCategory.TRIGGER,
      config: {
        parameters: [
          { name: 'name', type: 'string', required: true },
          { name: 'count', type: 'number' },
        ],
      },
    } as unknown as Node);

    const res = await controller.execute('wf1', 'ws', user, {
      parameterValues: { name: 'Alice', count: '5' },
    });
    expect(res).toEqual({ executionId: 'exec-1' });
    const executeMock = engine.execute;
    expect(executeMock).toHaveBeenCalledWith(
      'wf1',
      expect.objectContaining({
        parameters: { name: 'Alice', count: 5 },
      }),
      'u1',
    );
  });

  it('returns 400 when required parameter is missing', async () => {
    nodeRepo.findOne.mockResolvedValue({
      id: 'n',
      workflowId: 'wf1',
      category: NodeCategory.TRIGGER,
      config: {
        parameters: [{ name: 'name', type: 'string', required: true }],
      },
    } as unknown as Node);

    const err = await controller
      .execute('wf1', 'ws', user, { parameterValues: {} })
      .catch((e: unknown) => e as BadRequestException);
    expect(err).toBeInstanceOf(BadRequestException);
    const executeMock = engine.execute;
    expect(executeMock).not.toHaveBeenCalled();
  });

  it('falls back to input.parameters when parameterValues is absent', async () => {
    nodeRepo.findOne.mockResolvedValue({
      id: 'n',
      workflowId: 'wf1',
      category: NodeCategory.TRIGGER,
      config: {
        parameters: [{ name: 'name', type: 'string' }],
      },
    } as unknown as Node);

    await controller.execute('wf1', 'ws', user, {
      input: { parameters: { name: 'Bob' } },
    });
    const executeMock = engine.execute;
    expect(executeMock).toHaveBeenCalledWith(
      'wf1',
      expect.objectContaining({ parameters: { name: 'Bob' } }),
      'u1',
    );
  });

  it('verifies workflow belongs to workspace', async () => {
    nodeRepo.findOne.mockResolvedValue(null);
    await controller.execute('wf1', 'ws', user, { parameterValues: {} });
    const findMock = workflowsService.findById;
    expect(findMock).toHaveBeenCalledWith('wf1', 'ws');
  });
});
