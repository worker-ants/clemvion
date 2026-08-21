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
import { Edge } from '../edges/entities/edge.entity';
import { Execution } from '../executions/entities/execution.entity';
import { NodeComponentRegistry } from '../../nodes/core/node-component.registry';
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
          useValue: { findOne: jest.fn(), find: jest.fn() },
        },
        {
          provide: getRepositoryToken(Edge),
          useValue: { find: jest.fn() },
        },
        {
          provide: getRepositoryToken(Execution),
          useValue: { findOneBy: jest.fn() },
        },
        {
          provide: NodeComponentRegistry,
          useValue: { getComponent: jest.fn().mockReturnValue(undefined) },
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

  /**
   * **마스킹 값 재제출을 서버가 거부한다** (EIA §R17 서버측 2층).
   *
   * 이 엔드포인트는 재제출 전용이 아니라 Manual 실행 전체의 진입점이고, 값이 히스토리에서
   * 왔는지 방금 타이핑됐는지 구분할 플래그가 없다 — 마커 세 문자열은 Manual 파라미터의
   * **예약어**다. 프런트(`editor-toolbar.tsx`)가 이미 같은 규칙으로 막고, 서버가 그 규칙을
   * API 레벨로 옮긴다(두 층이 갈리면 한쪽만 통과하는 값이 생긴다).
   */
  it('[캐너리] parameterValues 에 마스킹 마커가 실리면 400 + details[] 로 거부', async () => {
    nodeRepo.findOne.mockResolvedValue({
      id: 'n',
      workflowId: 'wf1',
      category: NodeCategory.TRIGGER,
      config: { parameters: [{ name: 'apiKey', type: 'string' }] },
    } as unknown as Node);

    const err = await controller
      .execute('wf1', 'ws', user, mockResponse(), {
        parameterValues: { apiKey: '***' },
      })
      .catch((err_: unknown) => err_ as BadRequestException);

    expect(err).toBeInstanceOf(BadRequestException);
    expect(engine.execute).not.toHaveBeenCalled();
    const response = (err as BadRequestException).getResponse() as {
      code: string;
      details: Array<{ field: string; code: string; message: string }>;
    };
    expect(response.code).toBe('INVALID_TRIGGER_PARAMETERS');
    expect(response.details).toEqual([
      {
        field: 'apiKey',
        code: 'MASKED_VALUE_RESUBMITTED',
        message: expect.any(String) as unknown as string,
      },
    ]);
  });

  /** 중첩 마커도 잡는다 — 스칼라만 보면 #1188 의 CRITICAL 이 서버에 남는다. */
  it('[캐너리] 중첩 object 안의 마커도 거부한다', async () => {
    nodeRepo.findOne.mockResolvedValue({
      id: 'n',
      workflowId: 'wf1',
      category: NodeCategory.TRIGGER,
      config: { parameters: [{ name: 'headers', type: 'object' }] },
    } as unknown as Node);

    const err = await controller
      .execute('wf1', 'ws', user, mockResponse(), {
        parameterValues: { headers: { apiKey: '***' } },
      })
      .catch((err_: unknown) => err_ as BadRequestException);

    expect(err).toBeInstanceOf(BadRequestException);
    expect(engine.execute).not.toHaveBeenCalled();
  });

  /**
   * **legacy 진입 경로도 같은 거부를 받는다** (`02_29_01` testing INFO-6).
   *
   * 컨트롤러는 `parameterValues`(선호)와 `input.parameters`(back-compat) 둘을 같은
   * `rawValues` 로 접어 거부 함수에 넘긴다. 신규 캐너리 셋이 전부 `parameterValues` 만
   * 써서, 그 접기가 깨져도 GREEN 이었다 — 코드 구조로만 보장되던 것을 테스트로 고정한다.
   */
  it('[캐너리] legacy input.parameters 경로의 마커도 거부한다', async () => {
    nodeRepo.findOne.mockResolvedValue({
      id: 'n',
      workflowId: 'wf1',
      category: NodeCategory.TRIGGER,
      config: { parameters: [{ name: 'apiKey', type: 'string' }] },
    } as unknown as Node);

    const err = await controller
      .execute('wf1', 'ws', user, mockResponse(), {
        input: { parameters: { apiKey: '***' } },
      })
      .catch((err_: unknown) => err_ as BadRequestException);

    expect(err).toBeInstanceOf(BadRequestException);
    expect(engine.execute).not.toHaveBeenCalled();
    const response = (err as BadRequestException).getResponse() as {
      details: Array<{ field: string; code: string }>;
    };
    expect(response.details[0].code).toBe('MASKED_VALUE_RESUBMITTED');
  });

  /** 과잉 차단 아님 — 정확 일치만 본다. */
  it('[캐너리] 마커를 포함만 하는 값은 실행된다', async () => {
    nodeRepo.findOne.mockResolvedValue({
      id: 'n',
      workflowId: 'wf1',
      category: NodeCategory.TRIGGER,
      config: { parameters: [{ name: 'note', type: 'string' }] },
    } as unknown as Node);

    const res = await controller.execute('wf1', 'ws', user, mockResponse(), {
      parameterValues: { note: 'a***b' },
    });
    expect(res).toEqual({ executionId: 'exec-1' });
    expect(engine.execute).toHaveBeenCalled();
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
      .catch((err_: unknown) => err_ as BadRequestException);
    expect(err).toBeInstanceOf(BadRequestException);
    const executeMock = engine.execute;
    expect(executeMock).not.toHaveBeenCalled();
    // 봉투: errors 가 아니라 details[] 로 필드별 사유가 surface 되어야 한다
    // (GlobalExceptionFilter 가 details 만 전달 — manual-trigger §6 / webhook §5.2 동일 헬퍼).
    const response = (err as BadRequestException).getResponse() as {
      code: string;
      details: Array<{ field: string; code: string; message: string }>;
    };
    expect(response.code).toBe('INVALID_TRIGGER_PARAMETERS');
    expect(response.details).toEqual([
      {
        field: 'name',
        code: 'MISSING_REQUIRED_FIELD',
        message: 'Required parameter is missing',
      },
    ]);
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

// 단일 노드 실행 (§1.3) — POST /api/workflows/:id/nodes/:nodeId/execute.
// SoT: spec/3-workflow-editor/3-execution.md §1.3 / §9.
describe('WorkflowsController (executeNode endpoint, §1.3)', () => {
  let controller: WorkflowsController;
  let nodeRepo: jest.Mocked<Repository<Node>>;
  let executionRepo: jest.Mocked<Repository<Execution>>;
  let engine: jest.Mocked<ExecutionEngineService>;
  let workflowsService: jest.Mocked<WorkflowsService>;

  const user: JwtPayload = { sub: 'u1', email: 'x@y' } as unknown as JwtPayload;

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
          useValue: { execute: jest.fn().mockResolvedValue('exec-node-1') },
        },
        { provide: ShutdownStateService, useValue: mockShutdownState() },
        {
          provide: getRepositoryToken(Node),
          useValue: {
            findOneBy: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
          },
        },
        { provide: getRepositoryToken(Edge), useValue: { find: jest.fn() } },
        {
          provide: getRepositoryToken(Execution),
          useValue: { findOneBy: jest.fn() },
        },
        {
          provide: NodeComponentRegistry,
          useValue: { getComponent: jest.fn().mockReturnValue(undefined) },
        },
      ],
    }).compile();

    controller = moduleRef.get(WorkflowsController);
    nodeRepo = moduleRef.get(getRepositoryToken(Node));
    executionRepo = moduleRef.get(getRepositoryToken(Execution));
    engine = moduleRef.get(ExecutionEngineService);
    workflowsService = moduleRef.get(WorkflowsService);
  });

  it('runs a single node with singleNodeId + previousExecutionId injected', async () => {
    nodeRepo.findOneBy.mockResolvedValue({
      id: 'n1',
      workflowId: 'wf1',
    } as unknown as Node);
    executionRepo.findOneBy.mockResolvedValue({
      id: 'prev-1',
      workflowId: 'wf1',
    } as unknown as Execution);

    const res = await controller.executeNode(
      'wf1',
      'n1',
      'ws',
      user,
      mockResponse(),
      { previousExecutionId: 'prev-1' },
    );

    expect(res).toEqual({ executionId: 'exec-node-1' });
    expect(workflowsService.findById).toHaveBeenCalledWith('wf1', 'ws');
    expect(engine.execute).toHaveBeenCalledWith(
      'wf1',
      expect.objectContaining({ __triggerSource: 'manual' }),
      {
        executedBy: 'u1',
        singleNodeId: 'n1',
        previousExecutionId: 'prev-1',
      },
    );
  });

  it('passes previousExecutionId undefined when omitted (manual input only)', async () => {
    nodeRepo.findOneBy.mockResolvedValue({
      id: 'n1',
      workflowId: 'wf1',
    } as unknown as Node);

    await controller.executeNode('wf1', 'n1', 'ws', user, mockResponse(), {
      input: { foo: 1 },
    });

    expect(executionRepo.findOneBy).not.toHaveBeenCalled();
    expect(engine.execute).toHaveBeenCalledWith(
      'wf1',
      expect.objectContaining({ foo: 1, __triggerSource: 'manual' }),
      { executedBy: 'u1', singleNodeId: 'n1', previousExecutionId: undefined },
    );
  });

  it('returns 400 when the node is not in the workflow', async () => {
    nodeRepo.findOneBy.mockResolvedValue(null);

    const err = await controller
      .executeNode('wf1', 'n-foreign', 'ws', user, mockResponse(), {})
      .catch((err_: unknown) => err_ as BadRequestException);

    expect(err).toBeInstanceOf(BadRequestException);
    expect(engine.execute).not.toHaveBeenCalled();
  });

  it('propagates workspace 404 (findById throws) without touching node/engine', async () => {
    workflowsService.findById.mockRejectedValue(
      new BadRequestException('workflow not in workspace'),
    );

    const err = await controller
      .executeNode('wf-foreign', 'n1', 'ws', user, mockResponse(), {})
      .catch((err_: unknown) => err_ as BadRequestException);

    expect(err).toBeInstanceOf(BadRequestException);
    expect(nodeRepo.findOneBy).not.toHaveBeenCalled();
    expect(engine.execute).not.toHaveBeenCalled();
  });

  it('returns 400 when previousExecutionId belongs to another workflow', async () => {
    nodeRepo.findOneBy.mockResolvedValue({
      id: 'n1',
      workflowId: 'wf1',
    } as unknown as Node);
    executionRepo.findOneBy.mockResolvedValue(null);

    const err = await controller
      .executeNode('wf1', 'n1', 'ws', user, mockResponse(), {
        previousExecutionId: 'prev-other',
      })
      .catch((err_: unknown) => err_ as BadRequestException);

    expect(err).toBeInstanceOf(BadRequestException);
    expect(engine.execute).not.toHaveBeenCalled();
  });

  it('rejects with 503 while shutting down (does not touch repos/engine)', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [WorkflowsController],
      providers: [
        {
          provide: WorkflowsService,
          useValue: { findById: jest.fn() },
        },
        {
          provide: ExecutionEngineService,
          useValue: { execute: jest.fn() },
        },
        {
          provide: ShutdownStateService,
          useValue: mockShutdownState({ isShuttingDown: true }),
        },
        {
          provide: getRepositoryToken(Node),
          useValue: { findOneBy: jest.fn() },
        },
        { provide: getRepositoryToken(Edge), useValue: { find: jest.fn() } },
        {
          provide: getRepositoryToken(Execution),
          useValue: { findOneBy: jest.fn() },
        },
        {
          provide: NodeComponentRegistry,
          useValue: { getComponent: jest.fn() },
        },
      ],
    }).compile();
    const ctrl = moduleRef.get(WorkflowsController);
    const eng = moduleRef.get<ExecutionEngineService>(ExecutionEngineService);
    const res = mockResponse();

    const err = await ctrl
      .executeNode('wf1', 'n1', 'ws', user, res, {})
      .catch((err_: unknown) => err_ as ServiceUnavailableException);

    expect(err).toBeInstanceOf(ServiceUnavailableException);
    expect(res.setHeader).toHaveBeenCalledWith('Retry-After', '30');
    expect(eng.execute as jest.Mock).not.toHaveBeenCalled();
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
          useValue: { findOne: jest.fn(), find: jest.fn() },
        },
        {
          provide: getRepositoryToken(Edge),
          useValue: { find: jest.fn() },
        },
        {
          provide: getRepositoryToken(Execution),
          useValue: { findOneBy: jest.fn() },
        },
        {
          provide: NodeComponentRegistry,
          useValue: { getComponent: jest.fn().mockReturnValue(undefined) },
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
      .catch((err_: unknown) => err_ as ServiceUnavailableException);

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
          useValue: { findOne: jest.fn(), find: jest.fn() },
        },
        {
          provide: getRepositoryToken(Edge),
          useValue: { find: jest.fn() },
        },
        {
          provide: getRepositoryToken(Execution),
          useValue: { findOneBy: jest.fn() },
        },
        {
          provide: NodeComponentRegistry,
          useValue: { getComponent: jest.fn().mockReturnValue(undefined) },
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
        { provide: getRepositoryToken(Edge), useValue: {} },
        { provide: getRepositoryToken(Execution), useValue: {} },
        { provide: NodeComponentRegistry, useValue: {} },
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

// SUMMARY#1/2 — controller 가 workflowsService.getGraphWarnings() 로 위임하도록 리팩터링됨.
// 이전 테스트는 nodeRepo/edgeRepo/registry 를 직접 모킹했으나, 이제는 서비스 메서드 mock 으로 교체.
describe('WorkflowsController (graph-warnings endpoint, parallel-p2 §6)', () => {
  let controller: WorkflowsController;
  let workflowsService: jest.Mocked<
    Pick<WorkflowsService, 'findById' | 'getGraphWarnings'>
  >;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [WorkflowsController],
      providers: [
        {
          provide: WorkflowsService,
          useValue: {
            findById: jest.fn().mockResolvedValue({ id: 'wf-1' }),
            getGraphWarnings: jest.fn(),
          },
        },
        { provide: ExecutionEngineService, useValue: {} },
        { provide: ShutdownStateService, useValue: mockShutdownState() },
        { provide: getRepositoryToken(Node), useValue: {} },
        { provide: getRepositoryToken(Execution), useValue: {} },
      ],
    }).compile();

    controller = moduleRef.get(WorkflowsController);
    workflowsService = moduleRef.get(WorkflowsService);
  });

  it('returns empty results when no nodes have graphWarningRules', async () => {
    (workflowsService.getGraphWarnings as jest.Mock).mockResolvedValue({
      results: [],
      hasError: false,
      hasWarning: false,
    });

    const res = await controller.graphWarnings('wf-1', 'ws');
    expect(res.results).toEqual([]);
    expect(res.hasError).toBe(false);
    expect(res.hasWarning).toBe(false);
    expect(workflowsService.getGraphWarnings).toHaveBeenCalledWith(
      'wf-1',
      'ws',
    );
  });

  it('returns triggered rule results with hasError/hasWarning summary', async () => {
    (workflowsService.getGraphWarnings as jest.Mock).mockResolvedValue({
      results: [
        {
          ruleId: 'parallel:test-error',
          severity: 'error',
          nodeId: 'p1',
          message: 'error: P1',
        },
        {
          ruleId: 'parallel:test-warn',
          severity: 'warning',
          nodeId: 'p1',
          message: 'warn',
        },
      ],
      hasError: true,
      hasWarning: true,
    });

    const res = await controller.graphWarnings('wf-1', 'ws');
    expect(res.results).toHaveLength(2);
    expect(res.results[0]).toEqual({
      ruleId: 'parallel:test-error',
      severity: 'error',
      nodeId: 'p1',
      message: 'error: P1',
    });
    expect(res.hasError).toBe(true);
    expect(res.hasWarning).toBe(true);
  });

  it('rejects when workflow not found (delegates to workflowsService.findById)', async () => {
    (workflowsService.findById as jest.Mock).mockRejectedValueOnce(
      new Error('not found'),
    );
    await expect(controller.graphWarnings('wf-x', 'ws')).rejects.toThrow();
  });
});

/**
 * 컨트롤러 → 서비스 **행위자(userId) 배선** 검증.
 *
 * `update(id, workspaceId, dto, userId)` 는 여러 인자가 **전부 string** 이라 자리를 바꿔도
 * 컴파일이 통과한다(실측: 스왑 후 `tsc --noEmit` 오류 0건). 스왑되면 감사 로그의 workspace 와
 * actor 가 뒤바뀐 채로도 행이 정상적으로 쌓여 **조용히 틀린 감사**가 된다. 서비스 spec 은 이미
 * 들어온 값을 볼 뿐이라 경계에서 단언해야 잡힌다.
 *
 * 위 본문 테스트들과 달리 DI 컨테이너가 필요 없어 직접 생성한다 — 감사 배선에 무관한
 * 의존성은 미사용이므로 빈 객체로 채운다.
 */
describe('WorkflowsController — 행위자(userId) 배선', () => {
  let controller: WorkflowsController;
  let service: {
    create: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
    duplicate: jest.Mock;
    importWorkflow: jest.Mock;
  };

  const WS = 'ws-1';
  const USER = 'user-1';
  // 이 핸들러들은 `@CurrentUser() user: JwtPayload` 를 받아 `user.sub` 를 넘긴다.
  const JWT = { sub: USER } as unknown as JwtPayload;

  beforeEach(() => {
    service = {
      create: jest.fn().mockResolvedValue({ id: 'wf-1' }),
      update: jest.fn().mockResolvedValue({ id: 'wf-1' }),
      remove: jest.fn().mockResolvedValue(undefined),
      duplicate: jest.fn().mockResolvedValue({ id: 'wf-copy' }),
      importWorkflow: jest.fn().mockResolvedValue({ id: 'wf-imp' }),
    };
    controller = new WorkflowsController(
      service as unknown as WorkflowsService,
      {} as unknown as ExecutionEngineService,
      {} as unknown as ShutdownStateService,
      {} as unknown as Repository<Node>,
      {} as unknown as Repository<Execution>,
    );
  });

  it('create 는 workspaceId 와 user.sub 를 각자 자리에 전달한다', async () => {
    const dto = { name: 'W' } as never;

    await controller.create(WS, JWT, dto);

    // 위치까지 고정한다 — objectContaining 으로는 스왑을 못 잡는다.
    expect(service.create).toHaveBeenCalledWith(WS, USER, dto);
  });

  it('duplicate 는 id·workspaceId·user.sub 순서를 지킨다', async () => {
    await controller.duplicate('wf-1', WS, JWT);

    expect(service.duplicate).toHaveBeenCalledWith('wf-1', WS, USER);
  });

  it('importWorkflow 는 workspaceId·user.sub·dto 순서를 지킨다', async () => {
    const dto = { workflow: {} } as never;

    await controller.importWorkflow(WS, JWT, dto);

    expect(service.importWorkflow).toHaveBeenCalledWith(WS, USER, dto);
  });

  it('update 는 id·workspaceId·dto·userId 순서를 지킨다', async () => {
    const dto = { name: 'W2' } as never;

    await controller.update('wf-1', WS, dto, USER);

    expect(service.update).toHaveBeenCalledWith('wf-1', WS, dto, USER);
  });

  it('remove 는 id·workspaceId·userId 순서를 지킨다', async () => {
    await controller.remove('wf-2', WS, USER);

    expect(service.remove).toHaveBeenCalledWith('wf-2', WS, USER);
  });
});
