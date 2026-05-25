import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Response } from 'express';
import { WorkflowsController } from './workflows.controller';
import { WorkflowsService } from './workflows.service';
import { ExecutionEngineService } from '../execution-engine/execution-engine.service';
import { ShutdownStateService } from '../execution-engine/shutdown/shutdown-state.service';
import { Node, NodeCategory } from '../nodes/entities/node.entity';
import type { JwtPayload } from '../../common/decorators';

// 공용 mock Response — passthrough 용. setHeader 만 노출.
function mockResponse(): Response {
  const headers: Record<string, string> = {};
  return {
    setHeader: jest.fn((k: string, v: string) => {
      headers[k] = v;
    }),
    getHeader: (k: string) => headers[k],
  } as unknown as Response;
}

// 공용 mock — shutdown 상태 off (정상 경로).
function mockShutdownState(overrides?: Partial<ShutdownStateService>) {
  return {
    isShuttingDown: false,
    inFlightCount: 0,
    retryAfterSec: 30,
    registerInFlight: jest.fn(),
    unregisterInFlight: jest.fn(),
    onApplicationShutdown: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as ShutdownStateService;
}

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
          provide: ShutdownStateService,
          useValue: mockShutdownState(),
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

    const res = await controller.execute('wf1', 'ws', user, mockResponse(), {
      parameterValues: { name: 'Alice', count: '5' },
    });
    expect(res).toEqual({ executionId: 'exec-1' });
    const executeMock = engine.execute;
    expect(executeMock).toHaveBeenCalledWith(
      'wf1',
      expect.objectContaining({
        parameters: { name: 'Alice', count: 5 },
      }),
      { executedBy: 'u1' },
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
      .execute('wf1', 'ws', user, mockResponse(), { parameterValues: {} })
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

    await controller.execute('wf1', 'ws', user, mockResponse(), {
      input: { parameters: { name: 'Bob' } },
    });
    const executeMock = engine.execute;
    expect(executeMock).toHaveBeenCalledWith(
      'wf1',
      expect.objectContaining({ parameters: { name: 'Bob' } }),
      { executedBy: 'u1' },
    );
  });

  it('verifies workflow belongs to workspace', async () => {
    nodeRepo.findOne.mockResolvedValue(null);
    await controller.execute('wf1', 'ws', user, mockResponse(), {
      parameterValues: {},
    });
    const findMock = workflowsService.findById;
    expect(findMock).toHaveBeenCalledWith('wf1', 'ws');
  });
});

// workflow-resumable-execution Phase 1.2 — Graceful Shutdown 503 gate.
// SoT: spec/5-system/4-execution-engine.md §11.
describe('WorkflowsController (execute — graceful shutdown gate)', () => {
  let controller: WorkflowsController;
  let engine: jest.Mocked<ExecutionEngineService>;

  const user: JwtPayload = {
    sub: 'u1',
    email: 'x@y',
  } as unknown as JwtPayload;

  async function buildController(
    shutdown: Partial<ShutdownStateService>,
  ): Promise<WorkflowsController> {
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
          provide: ShutdownStateService,
          useValue: mockShutdownState(shutdown),
        },
        {
          provide: getRepositoryToken(Node),
          useValue: { findOne: jest.fn() },
        },
      ],
    }).compile();
    engine = moduleRef.get(ExecutionEngineService);
    return moduleRef.get(WorkflowsController);
  }

  it('shutting down 시 503 + SERVER_SHUTTING_DOWN + Retry-After 헤더', async () => {
    controller = await buildController({
      isShuttingDown: true,
      retryAfterSec: 30,
    });
    const res = mockResponse();

    const err = await controller
      .execute('wf1', 'ws', user, res, { parameterValues: {} })
      .catch((e: unknown) => e as ServiceUnavailableException);

    expect(err).toBeInstanceOf(ServiceUnavailableException);
    expect((err as ServiceUnavailableException).getStatus()).toBe(503);
    const body = (err as ServiceUnavailableException).getResponse() as Record<
      string,
      unknown
    >;
    expect(body.code).toBe('SERVER_SHUTTING_DOWN');
    // W-13 fix (SUMMARY#W-13): body.message 중립 문구 검증.
    expect(typeof body.message).toBe('string');
    expect(body.message).toBe('Service temporarily unavailable. Please retry.');
    expect(res.setHeader).toHaveBeenCalledWith('Retry-After', '30');
    // 거부 시 engine.execute 호출되지 않음.
    expect(engine.execute).not.toHaveBeenCalled();
  });

  it('isShuttingDown=false 면 정상 처리 (Retry-After 없음)', async () => {
    controller = await buildController({ isShuttingDown: false });
    const res = mockResponse();

    // 정상 경로 — nodeRepo.findOne 이 trigger schema 가 없으므로 자연스레
    // workflow ownership 검증 통과 후 진행. 본 테스트는 503 미발사만 검증.
    await controller
      .execute('wf1', 'ws', user, res, { parameterValues: {} })
      .catch(() => undefined); // schema 미설정으로 인한 기타 에러는 무시.
    expect(res.setHeader).not.toHaveBeenCalledWith(
      'Retry-After',
      expect.any(String),
    );
  });
});

describe('WorkflowsController (canvas + version endpoints)', () => {
  let controller: WorkflowsController;
  let workflowsService: jest.Mocked<WorkflowsService>;

  const user: JwtPayload = {
    sub: 'user-42',
    email: 'x@y',
  } as unknown as JwtPayload;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [WorkflowsController],
      providers: [
        {
          provide: WorkflowsService,
          useValue: {
            saveCanvas: jest
              .fn()
              .mockResolvedValue({ workflow: {}, nodes: [], edges: [] }),
            restoreVersion: jest
              .fn()
              .mockResolvedValue({ workflow: {}, nodes: [], edges: [] }),
          },
        },
        {
          provide: ExecutionEngineService,
          useValue: { execute: jest.fn() },
        },
        {
          provide: ShutdownStateService,
          useValue: mockShutdownState(),
        },
        {
          provide: getRepositoryToken(Node),
          useValue: { findOne: jest.fn() },
        },
      ],
    }).compile();

    controller = moduleRef.get(WorkflowsController);
    workflowsService = moduleRef.get(WorkflowsService);
  });

  it('passes user.sub and dto into saveCanvas', async () => {
    const dto = {
      nodes: [],
      edges: [],
      changeSummary: 'tweak',
    } as never;
    await controller.saveCanvas('wf-1', 'ws-1', user, dto);
    expect(workflowsService.saveCanvas).toHaveBeenCalledWith(
      'wf-1',
      'ws-1',
      'user-42',
      dto,
    );
  });

  it('forwards version + workflow ids into restoreVersion', async () => {
    await controller.restoreVersion('wf-1', 'v-1', 'ws-1', user);
    expect(workflowsService.restoreVersion).toHaveBeenCalledWith(
      'wf-1',
      'ws-1',
      'v-1',
      'user-42',
    );
  });
});

describe('WorkflowsController (findAll — ownership wiring)', () => {
  let controller: WorkflowsController;
  let workflowsService: jest.Mocked<WorkflowsService>;

  const user: JwtPayload = {
    sub: 'user-42',
    email: 'a@b',
  } as unknown as JwtPayload;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [WorkflowsController],
      providers: [
        {
          provide: WorkflowsService,
          useValue: {
            findAll: jest.fn().mockResolvedValue({
              data: [],
              pagination: { page: 1, limit: 20, totalItems: 0, totalPages: 0 },
            }),
          },
        },
        { provide: ExecutionEngineService, useValue: {} },
        { provide: ShutdownStateService, useValue: mockShutdownState() },
        { provide: getRepositoryToken(Node), useValue: {} },
      ],
    }).compile();

    controller = moduleRef.get(WorkflowsController);
    workflowsService = moduleRef.get(WorkflowsService);
  });

  it('passes user.sub as the third argument to service.findAll', async () => {
    await controller.findAll(user, 'ws-1', { page: 1, limit: 20 });
    expect(workflowsService.findAll).toHaveBeenCalledWith(
      'ws-1',
      { page: 1, limit: 20 },
      'user-42',
    );
  });

  it('forwards ownership query value untouched', async () => {
    await controller.findAll(user, 'ws-1', {
      page: 1,
      limit: 20,
      ownership: 'mine',
    });
    expect(workflowsService.findAll).toHaveBeenCalledWith(
      'ws-1',
      expect.objectContaining({ ownership: 'mine' }),
      'user-42',
    );
  });
});
